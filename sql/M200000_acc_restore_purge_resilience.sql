-- ═══════════════════════════════════════════════════════════════════════════
-- M10 — تاب‌آوری purge/restore + بذر مجدد مراکز هزینه (RCA اجرای زندهٔ دوم)
-- ═══════════════════════════════════════════════════════════════════════════
-- RCA (اجرای زندهٔ ۱۸-spec، ۹d3094 — بعد از M190000):
--   ۴ اشکال واقعی معماری پیدا شد؛ ۴ مورد دیگر باگ تست بودند و در سوییته اصلاح شدند.
--
--   ۱) acc_invoice_items_guard (20260919100000 §۲) SECURITY DEFINER و بدون هیچ
--      دریچه‌ای است: «این صورتحساب صادر شده و ردیف‌های آن قابل تغییر نیست».
--      تریگر BEFORE INSERT «قبل از» بررسی on conflict اجرا می‌شود؛ بنابراین
--        الف) acc_restore_business (M170000) روی بازیابی idempotent (همه Duplicate)
--           با on conflict (id) do nothing هم می‌ترکد — سنجهٔ BKP-5؛
--        ب) acc_purge_business_data هنگام حذف ردیف‌های فاکتور صادره می‌ترکد —
--           سنجهٔ CLEANUP (M190000 فقط گارد master-data را دریچه داد؛ این یکی نه).
--      راه‌حل: همان الگوی معماری M190000 — GUC تراکنش‌محور app.purge_mode و
--      app.restore_mode که فقط درون RPCهای definer دارای گیت مالک set می‌شوند؛
--      مسیر PostgREST کلاینت هیچ راهی برای ست‌کردن GUC ندارد.
--
--   ۲) پاک‌سازی موفق، مراکز هزینهٔ بذر ۵تایی (بند ۲۲) را هم حذف می‌کند و بنگاهِ
--      باقی‌مانده بدون بذر می‌ماند (سنجهٔ MD4: seeded=0). راه‌حل: purge = بازگشت
--      به وضعیت کارخانه — در پایان پاک‌سازی، بذر استاندارد دوباره کاشته می‌شود
--      (acc_seed_cost_centers خودش idempotent است: اگر ردیفی باشد کاری نمی‌کند)
--      + بک‌فیل یک‌باره برای بنگاه‌های موجود فاقد بذر.
--
--   ۳) گارد حذف master-data برای acc_partners فقط گردش مستقیم (partner_id روی
--      ردیف سند/فاکتور/تراکنش/…) را می‌شمارد؛ سناریوی «سند دستی با تفصیلیِ
--      مشتریِ همان طرف‌حساب» را از دست می‌دهد (سنجهٔ MD5). راه‌حل: شمارش گردش
--      از مسیر تفصیلی (acc_details.ref_id) هم اضافه شد — دفاع دولایه.
--
--   سنجه‌های IVD-3/IVD-8 باگ بودند: سند آینه‌ای با جفت COGS (5103/1301) کامل و
--   تراز است؛ ثابت تست به‌روزرسانی شد (در سوییته، نه اینجا).
--   قابل اجرای مجدد. ترتیب: بعد از M190000.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ §۱) گارد ردیف‌های فاکتور — دریچهٔ فقط-نگهداشتی: purge_mode / restore_mode ═══
create or replace function public.acc_invoice_items_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_posted timestamptz;
  v_type text;
begin
  -- مسیرهای نگهداشتی مالک‌محور (acc_purge_business_data / acc_restore_business):
  -- هر دو RPC دارای گیت مالک‌اند و GUC را فقط با set local در همین تراکنش روشن می‌کنند؛
  -- کلاینت از طریق PostgREST نمی‌تواند GUC ست کند → دریچه برای اپ بسته می‌ماند.
  if coalesce(current_setting('app.purge_mode', true), '') = 'on'
     or coalesce(current_setting('app.restore_mode', true), '') = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return coalesce(new, old);
  end if;

  if tg_op in ('INSERT','UPDATE') then
    select posted_at, type into v_posted, v_type from public.acc_invoices where id = new.invoice_id;
  else
    select posted_at, type into v_posted, v_type from public.acc_invoices where id = old.invoice_id;
  end if;
  if v_posted is not null and v_type in ('sale','purchase','return_sale') then
    raise exception 'این صورتحساب صادر شده و ردیف‌های آن قابل تغییر نیست؛ برای اصلاح، آن را ابطال و صورتحساب جدید صادر کنید';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

-- ═══ §۲) restore — روشن‌کردن دریچهٔ بازیابی در ابتدای تراکنش (بدنهٔ M170000 + یک خط) ═══
create or replace function public.acc_restore_business(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  v_report jsonb;
  v_biz uuid;
  v_data jsonb;
  v_rows jsonb;
  v_inserted bigint := 0;
  v_total_inserted bigint := 0;
  t text;
  v_tables text[] := array[
    -- ترتیب دقیقاً مطابق وابستگی FK
    'acc_partners','acc_partner_roles','acc_details','acc_chart','acc_accounts',
    'acc_cost_centers','acc_projects','acc_expense_categories','acc_items',
    'acc_journal','acc_journal_lines','acc_fiscal_years',
    'acc_invoices','acc_invoice_items','acc_checks','acc_expenses',
    'acc_transactions','acc_petty','acc_petty_ops','acc_prepayments',
    'acc_bank_lines','acc_reconciliations','acc_contracts','acc_recurring',
    'acc_attachments'
  ];
begin
  -- ۱) اعتبارسنجی کامل (ساختار + مالکیت + تعلق Business)
  v_report := public.acc_backup_validate(p_payload, 'restore');
  if (v_report ->> 'valid')::boolean is not true then
    raise exception 'بازیابی رد شد: %', v_report ->> 'errors';
  end if;
  v_biz := p_payload ->> 'business_id';
  v_data := p_payload -> 'data';

  -- دریچهٔ بازیابی: فقط در همین تراکنش؛ ردیف‌های تکراری با on conflict do nothing
  -- رد می‌شوند و هیچ ردیفِ موجودی بازنویسی نمی‌شود (idempotent).
  set local app.restore_mode = 'on';

  -- ۲) درج به ترتیب FK — بدون Duplicate
  foreach t in array v_tables loop
    v_rows := v_data -> t;
    if v_rows is null or jsonb_typeof(v_rows) is distinct from 'array'
       or coalesce(jsonb_array_length(v_rows), 0) = 0 then
      continue;
    end if;
    execute format(
      'insert into public.%I
       select * from jsonb_populate_recordset(null::public.%I, $1) x
        where x.business_id = $2
        on conflict (id) do nothing', t, t)
      using v_rows, v_biz;
    get diagnostics v_inserted = row_count;
    v_total_inserted := v_total_inserted + v_inserted;
  end loop;

  -- ۳) دوره‌ها (PK ترکیبی — بدون id)
  v_rows := v_data -> 'acc_periods';
  if v_rows is not null and jsonb_typeof(v_rows) = 'array' then
    insert into public.acc_periods (business_id, jyear, jmonth, locked, locked_at)
    select x.business_id, x.jyear, x.jmonth, coalesce(x.locked, false), x.locked_at
      from jsonb_populate_recordset(null::public.acc_periods, v_rows) x
     where x.business_id = v_biz
    on conflict (business_id, jyear, jmonth) do nothing;
    get diagnostics v_inserted = row_count;
    v_total_inserted := v_total_inserted + v_inserted;
  end if;

  -- ۴) هم‌سازی شمارنده‌ها با واقعیت دفترِ پس از بازیابی
  insert into public.acc_entry_counters (business_id, last_entry_no)
  select v_biz, coalesce(max(j.entry_no), 0) from public.acc_journal j where j.business_id = v_biz
  on conflict (business_id) do update
    set last_entry_no = greatest(public.acc_entry_counters.last_entry_no,
                                 excluded.last_entry_no),
        updated_at = now();

  -- شمارندهٔ کدها: ستون کلید بسته به نسخهٔ جدول «kind» یا «counter_name» است
  if exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='acc_code_counters' and column_name='kind') then
    insert into public.acc_code_counters (business_id, kind, last_no)
    select v_biz, x.kind, x.last_no
      from jsonb_populate_recordset(null::public.acc_code_counters, coalesce(v_data -> 'acc_code_counters', '[]'::jsonb)) x
     where x.business_id = v_biz
    on conflict (business_id, kind) do update
      set last_no = greatest(public.acc_code_counters.last_no, excluded.last_no);
  elsif exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='acc_code_counters' and column_name='counter_name') then
    insert into public.acc_code_counters (business_id, counter_name, last_no)
    select v_biz, x.counter_name, x.last_no
      from jsonb_populate_recordset(null::public.acc_code_counters, coalesce(v_data -> 'acc_code_counters', '[]'::jsonb)) x
     where x.business_id = v_biz
    on conflict (business_id, counter_name) do update
      set last_no = greatest(public.acc_code_counters.last_no, excluded.last_no);
  end if;

  return jsonb_build_object(
    'restored', true,
    'business_id', v_biz,
    'inserted_rows', v_total_inserted,
    'per_table', v_report -> 'tables',
    'warnings', v_report -> 'warnings',
    'counters', (select to_jsonb(c) from public.acc_entry_counters c where c.business_id = v_biz)
  );
end $$;

-- ═══ §۳) purge — بازگشت به وضعیت کارخانه: بذر مجدد مراکز هزینه در پایان ═══
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

  -- بازگشت به وضعیت کارخانه (بند ۲۲): بنگاه تازه‌پاک‌سازی‌شده مثل بنگاه تازه‌ساخته
  -- بذر ۵تایی مراکز هزینه را دارد؛ acc_seed_cost_centers idempotent است.
  perform public.acc_seed_cost_centers(p_business);

  return jsonb_build_object('purged', true, 'business_id', p_business, 'deleted', v_counts);
end $$;

-- ═══ §۴) گارد master-data — لایهٔ دوم گردش طرف‌حساب از مسیر تفصیلی ═══
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
      -- لایهٔ دوم: گردش از مسیر تفصیلیِ طرف‌حساب (سند دستی با تفصیلی مشتری/تامین‌کننده/…)
      if v_count = 0 then select count(*) into v_count from public.acc_journal_lines jl
        where jl.detail_id in (select d.id from public.acc_details d
                                where d.ref_id = v_old.id and d.business_id = v_old.business_id); end if;
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

-- ═══ §۵) نصب مجدد تریگر sync تفصیلی نقش‌ها + بک‌فیل (بند ۲۵) ═══
-- RCA: روی Live تریگر acc_proles_detail_sync نصب نیست (۵ پروب مستقل: درج نقش هیچ
-- تفصیلی‌ای نمی‌سازد) — در نتیجه شریک با نقش، تفصیلی ندارد و سند با تفصیلیِ آن
-- رد می‌شود تا وقتی موتور آینه در اولین پست acc_ensure_detail را صدا بزند.
create or replace function public.acc_partner_role_detail_sync()
returns trigger
language plpgsql
security definer
set search_path = public as $$
declare
  v_kind text;
  v_name text;
begin
  v_kind := case new.role
    when 'customer' then 'customer'
    when 'supplier' then 'supplier'
    when 'shareholder' then 'shareholder'
    when 'employee' then 'employee'
    else null end;
  if v_kind is null then return new; end if;
  select name into v_name from public.acc_partners where id = new.partner_id;
  perform public.acc_ensure_detail(new.business_id, v_kind, coalesce(v_name, ''), new.partner_id);
  return new;
end $$;

drop trigger if exists acc_proles_detail_sync on public.acc_partner_roles;
create trigger acc_proles_detail_sync
  after insert on public.acc_partner_roles
  for each row execute function public.acc_partner_role_detail_sync();

-- بک‌فیل: هر نقشِ فاقد تفصیلی، تفصیلی خودش را می‌گیرد (idempotent — acc_ensure_detail)
do $$
declare
  r record;
begin
  for r in
    select pr.business_id, pr.partner_id, p.name, pr.role,
           case pr.role
             when 'customer' then 'customer'
             when 'supplier' then 'supplier'
             when 'shareholder' then 'shareholder'
             when 'employee' then 'employee' end as kind
    from public.acc_partner_roles pr
    join public.acc_partners p on p.id = pr.partner_id
    where pr.role in ('customer','supplier','shareholder','employee')
      and not exists (
        select 1 from public.acc_details d
         where d.business_id = pr.business_id
           and d.kind = (case pr.role
             when 'customer' then 'customer'
             when 'supplier' then 'supplier'
             when 'shareholder' then 'shareholder'
             when 'employee' then 'employee' end)
           and d.ref_id = pr.partner_id)
  loop
    perform public.acc_ensure_detail(r.business_id, r.kind, coalesce(r.name, ''), r.partner_id);
  end loop;
  raise notice 'بک‌فیل تفصیلی نقش‌ها انجام شد';
end $$;

-- ═══ §۶) بک‌فیل بذر برای بنگاه‌های موجود فاقد مراکز هزینه (یک‌باره؛ idempotent) ═══
do $$
declare
  b record;
begin
  -- بذر نباید با گارد حذف قاطی شود؛ درج است نه حذف — مستقیم امن است.
  for b in select id from public.acc_businesses
  loop
    perform public.acc_seed_cost_centers(b.id);
  end loop;
  raise notice 'بک‌فیل بذر مراکز هزینه انجام شد';
end $$;

-- ═══ §۷) امضاهای مجازی دست‌نخورده — گرانت‌ها ═══
revoke all on function public.acc_purge_business_data(uuid) from public, anon;
grant execute on function public.acc_purge_business_data(uuid) to authenticated;
revoke all on function public.acc_restore_business(jsonb) from public, anon;
grant execute on function public.acc_restore_business(jsonb) to authenticated;

-- ═══ §۸) Post-check ═══
do $$
declare
  v_items text; v_restore text; v_purge text; v_guard text; v_trig int;
begin
  select pg_get_functiondef('public.acc_invoice_items_guard()'::regprocedure) into v_items;
  select pg_get_functiondef('public.acc_restore_business(jsonb)'::regprocedure) into v_restore;
  select pg_get_functiondef('public.acc_purge_business_data(uuid)'::regprocedure) into v_purge;
  select pg_get_functiondef('public.acc_master_delete_guard()'::regprocedure) into v_guard;
  if v_items is null or v_restore is null or v_purge is null or v_guard is null then
    raise exception 'POSTCHECK: یکی از توابع یافت نشد';
  end if;
  if position('app.restore_mode' in v_items) = 0 or position('app.purge_mode' in v_items) = 0 then
    raise exception 'POSTCHECK: دریچهٔ گارد ردیف‌های فاکتور ناقص است';
  end if;
  if position('app.restore_mode' in v_restore) = 0 then
    raise exception 'POSTCHECK: restore دریچهٔ restore_mode را روشن نمی‌کند';
  end if;
  if position('app.purge_mode' in v_purge) = 0 or position('acc_seed_cost_centers' in v_purge) = 0 then
    raise exception 'POSTCHECK: purge دریچه یا بذر مجدد را ندارد';
  end if;
  if position('acc_details d' in v_guard) = 0 then
    raise exception 'POSTCHECK: لایهٔ دوم گردش طرف‌حساب (مسیر تفصیلی) در گارد نیست';
  end if;
  select count(*) into v_trig from pg_trigger
   where tgrelid = 'public.acc_partner_roles'::regclass
     and tgname = 'acc_proles_detail_sync' and not tgisinternal;
  if v_trig = 0 then
    raise exception 'POSTCHECK: تریگر sync تفصیلی نقش‌ها نصب نشده';
  end if;
  raise notice 'POSTCHECK M200000: دریچه‌های purge/restore + بذر مجدد + گارد دولایهٔ طرف‌حساب + sync تفصیلی نقش‌ها ✓';
end $$;
