-- ═══════════════════════════════════════════════════════════════════════════
-- M9 — اصلاح تعامل acc_purge_business_data با گاردهای حفاظت داده (RCA سوییتهٔ زنده)
-- ═══════════════════════════════════════════════════════════════════════════
-- RCA (اجرای زندهٔ ۱۸-spec، af0091):
--   پاک‌سازی مالک‌محور (M170000 §۶.۵) روی بنگاه دارای سند قطعی/تفصیلی سیستمی
--   در جدول acc_details با خطای «گردش حسابداری دارد یا سیستمی است» شکست می‌خورد:
--     ۱) acc_master_delete_guard (M150000-pkg: master_subledger §۱۴) هیچ مسیر
--        عبور مشروعی ندارد؛ «سیستمی بودن» تفصیلی‌های زیرledger (ref_id حساب/بانک)
--        و is_locked تفصیلی‌های کانونیکال (M120000) همیشه گارد را می‌ترکاند.
--     ۲) گاردهای acc_journal_lines و acc_invoices همین الگوی عبور را با
--        current_user دارند و درون definer درست باز می‌شوند — این یکی نه.
-- ریشه‌یابی کامل: سنجه‌های CLEANUP/IVD/E2E/BRC/TB/BKP/DEL — همهٔ موارد دیگر
-- باگ تست بودند و در سوییته اصلاح شده‌اند؛ این فایل فقط اصلاح معماری است.
-- راه‌حل: GUC تراکنش‌محور app.purge_mode — فقط acc_purge_business_data (دارای
-- گیت settings.manage) آن را روشن می‌کند؛ مسیرهای کلاینت از طریق PostgREST هیچ
-- راهی برای SET کردن GUC ندارند؛ بقیهٔ گاردها دست‌نخورده می‌مانند.
-- قابل اجرای مجدد. ترتیب: بعد از M180000.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ §۱) گارد master-data — افزودن تنها دریچهٔ مجاز: purge_mode ═══
create or replace function public.acc_master_delete_guard()
returns trigger
language plpgsql
security definer
set search_path = public as $$
declare
  v_table text := tg_table_name;
  v_old record := old;
  v_count int := 0;
  v_err text;
begin
  -- پاک‌سازی مالک-محور (acc_purge_business_data) — تنها مسیر مشروع عبور از گارد.
  -- کلاینت‌ها از طریق PostgREST نمی‌توانند GUC ست کنند؛ این GUC فقط در همین
  -- تراکنش و فقط توسط RPC دارای گیت settings.manage روشن می‌شود.
  if coalesce(current_setting('app.purge_mode', true), '') = 'on' then
    return coalesce(new, old);
  end if;

  case v_table
    when 'acc_partners' then
      select count(*) into v_count from public.acc_journal_lines where partner_id = v_old.id;
      if v_count = 0 then select count(*) into v_count from public.acc_invoices where partner_id = v_old.id; end if;
      if v_count = 0 then select count(*) into v_count from public.acc_transactions where partner_id = v_old.id; end if;
      if v_count = 0 then select count(*) into v_count from public.acc_expenses where partner_id = v_old.id; end if;
      if v_count = 0 then select count(*) into v_count from public.acc_checks where partner_id = v_old.id; end if;
      if v_count = 0 then select count(*) into v_count from public.acc_prepayments where partner_id = v_old.id; end if;
      if v_count = 0 then select count(*) into v_count from public.acc_contracts where partner_id = v_old.id; end if;
      if v_count = 0 then select count(*) into v_count from public.acc_recurring where partner_id = v_old.id; end if;
      if v_count > 0 then
        raise exception 'طرف‌حساب «%» گردش حسابداری دارد (% رکورد وابسته) — حذف ممنوع؛ از غیرفعال‌سازی (active=false) استفاده کنید', v_old.name, v_count;
      end if;

    when 'acc_details' then
      select count(*) into v_count from public.acc_journal_lines where detail_id = v_old.id;
      if v_count = 0 then select count(*) into v_count from public.acc_expenses where detail_id = v_old.id; end if;
      if v_count = 0 then select count(*) into v_count from public.acc_accounts where detail_id = v_old.id; end if;
      if v_count > 0 or v_old.is_locked then
        raise exception 'تفصیلی «%» گردش حسابداری دارد یا سیستمی است — حذف ممنوع؛ از غیرفعال‌سازی (active=false) استفاده کنید', v_old.title;
      end if;

    when 'acc_cost_centers' then
      select count(*) into v_count from public.acc_journal_lines where cost_center_id = v_old.id;
      if v_count = 0 then select count(*) into v_count from public.acc_expenses where cost_center_id = v_old.id; end if;
      if v_count > 0 then
        raise exception 'مرکز هزینهٔ «%» گردش دارد (% رکورد) — حذف ممنوع؛ از غیرفعال‌سازی (active=false) استفاده کنید', v_old.name, v_count;
      end if;

    when 'acc_accounts' then
      select count(*) into v_count from public.acc_transactions where account_id = v_old.id or to_account_id = v_old.id;
      if v_count = 0 then select count(*) into v_count from public.acc_expenses where account_id = v_old.id; end if;
      if v_count = 0 then select count(*) into v_count from public.acc_invoices where account_id = v_old.id; end if;
      if v_count = 0 then select count(*) into v_count from public.acc_bank_lines where account_id = v_old.id; end if;
      if v_count = 0 then select count(*) into v_count from public.acc_petty where source_account_id = v_old.id; end if;
      if v_count = 0 then select count(*) into v_count from public.acc_prepayments where account_id = v_old.id; end if;
      if v_count = 0 then select count(*) into v_count from public.acc_checks where account_id = v_old.id; end if;
      if v_count = 0 then select count(*) into v_count from public.acc_recurring where account_id = v_old.id; end if;
      if v_count = 0 then select count(*) into v_count from public.acc_assets where account_id = v_old.id; end if;
      if v_count = 0 then select count(*) into v_count from public.acc_payrolls where account_id = v_old.id; end if;
      if v_count = 0 then select count(*) into v_count from public.acc_reconciliations where account_id = v_old.id; end if;
      if v_count > 0 then
        raise exception 'حساب «%» گردش مالی دارد (% رکورد وابسته) — حذف ممنوع؛ از غیرفعال‌سازی (active=false) استفاده کنید', v_old.name, v_count;
      end if;

    when 'acc_projects' then
      select count(*) into v_count from public.acc_journal_lines where project_id = v_old.id;
      if v_count = 0 then select count(*) into v_count from public.acc_expenses where project_id = v_old.id; end if;
      if v_count = 0 then select count(*) into v_count from public.acc_contracts where project_id = v_old.id; end if;
      if v_count > 0 then
        raise exception 'پروژهٔ «%» گردش حسابداری دارد (% رکورد) — حذف ممنوع؛ از بایگانی (archived) استفاده کنید', v_old.name, v_count;
      end if;

    when 'acc_chart' then
      if exists (select 1 from public.acc_chart c where c.parent_id = v_old.id) then
        raise exception 'سرفصل «%» زیرمجموعه دارد — حذف ممنوع', v_old.title;
      end if;
      select count(*) into v_count from public.acc_journal_lines
       where account_id = v_old.id or (account_id is null and account_code = v_old.code and business_id = v_old.business_id);
      if v_count > 0 then
        raise exception 'سرفصل «%» در اسناد گردش دارد (% ردیف) — حذف ممنوع؛ از غیرفعال‌سازی (active=false) استفاده کنید', v_old.title, v_count;
      end if;
  else
    return old;
  end case;
  return old;
end $$;

-- ═══ §۲) purge — روشن‌کردن GUC در ابتدای تراکنش + ترتیب پیشین بدون تغییر ═══
create or replace function public.acc_purge_business_data(p_business uuid)
returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_tables text[] := array[
    'acc_journal_lines','acc_attachments','acc_petty_ops','acc_prepayments',
    'acc_invoice_items','acc_transactions','acc_expenses','acc_checks',
    'acc_bank_lines','acc_reconciliations','acc_journal',
    'acc_invoices','acc_fiscal_years','acc_periods','acc_petty',
    'acc_items','acc_details','acc_partner_roles','acc_partners',
    'acc_accounts','acc_cost_centers','acc_projects','acc_expense_categories',
    'acc_contracts','acc_recurring','acc_entry_counters','acc_code_counters'
  ];
  v_counts jsonb := '{}'::jsonb;
  t text;
  n bigint;
begin
  if v_user is null then raise exception 'ابتدا وارد حساب کاربری شوید'; end if;
  if not public.acc_perm_ok(p_business, 'settings.manage') then
    raise exception 'فقط مالک کسب‌وکار مجاز به پاک‌سازی داده است';
  end if;

  -- تنها نقطهٔ روشن‌شدن دریچهٔ گاردها — محدود به همین تراکنش
  set local app.purge_mode = 'on';

  foreach t in array v_tables loop
    execute format('delete from public.%I where business_id = $1', t) using p_business;
    get diagnostics n = row_count;
    v_counts := jsonb_set(v_counts, array[t], to_jsonb(n));
  end loop;

  return jsonb_build_object('purged', true, 'business_id', p_business, 'deleted', v_counts);
end $$;

revoke all on function public.acc_purge_business_data(uuid) from public, anon;
grant execute on function public.acc_purge_business_data(uuid) to authenticated;

-- ═══ §۳) Post-check ═══
do $$
declare
  v_guard text;
  v_purge text;
begin
  select pg_get_functiondef('public.acc_master_delete_guard()'::regprocedure) into v_guard;
  select pg_get_functiondef('public.acc_purge_business_data(uuid)'::regprocedure) into v_purge;
  if v_guard is null or v_purge is null then
    raise exception 'POSTCHECK: تابع گارد یا purge یافت نشد';
  end if;
  if position('app.purge_mode' in v_guard) = 0 or position('app.purge_mode' in v_purge) = 0 then
    raise exception 'POSTCHECK: دریچهٔ purge_mode در هر دو تابع باید باشد';
  end if;
  raise notice 'POSTCHECK M190000: گارد master-data + purge هر دو دریچهٔ purge_mode دارند ✓';
end $$;
