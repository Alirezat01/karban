-- ═══════════════════════════════════════════════════════════════════════════
-- M6 — پرداختنی به اشخاص (بند ۵) + Backup/Restore تراکنشی (بند ۱)
-- ═══════════════════════════════════════════════════════════════════════════
-- الف) ماندهٔ بدهی کسب‌وکار به اشخاصِ پرداخت‌کنندهٔ هزینه (2110) + تسویهٔ اتمیک
-- ب) خروجی Backup کامل Business (JSON کانونیکال، مرتب بر اساس FK)
--    + Preview/Validation بدون نوشتن + Restore اتمیک:
--      - اعتبارسنجی ساختار فایل
--      - بررسی مالکیت (فقط مالکِ همان Business)
--      - ممنوعیت ورود دادهٔ Business دیگر (هر سطر راستی‌آزمایی می‌شود)
--      - بدون Duplicate (ON CONFLICT DO NOTHING) + گزارش شمارنده‌ها
--      - ترتیب Import مطابق FK
--      - هر خطا → Rollback کامل (تابع = یک تراکنش)
-- قابل اجرای مجدد. ترتیب: بعد از M5.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ §۱) گزارش پرداختنی به اشخاص — ماندهٔ بدهی به هر پرداخت‌کننده ═══
create or replace function public.acc_person_payables(p_business uuid)
returns table (detail_id uuid, detail_title text, detail_kind text,
               ref_partner_id uuid, partner_name text,
               total_paid bigint, total_settled bigint, balance bigint)
language sql stable security definer set search_path = public as $$
  with mov as (
    select l.detail_id,
           coalesce(sum(l.credit), 0) as total_paid,
           coalesce(sum(l.debit), 0)  as total_settled
      from public.acc_journal_lines l
      join public.acc_journal j on j.id = l.entry_id
     where l.business_id = p_business
       and l.account_code = '2112'
       and j.voided_at is null
     group by l.detail_id
  )
  select d.id, d.title, d.kind, d.ref_id, p.name,
         m.total_paid, m.total_settled, m.total_paid - m.total_settled
    from mov m
    join public.acc_details d on d.id = m.detail_id
    left join public.acc_partners p on p.id = d.ref_id
   where public.acc_is_member(p_business)
  union all
  select null::uuid, null::text, null::text, null::uuid, null::text,
         0::bigint, 0::bigint, 0::bigint
   where false;
$$;

revoke all on function public.acc_person_payables(uuid) from public, anon;
grant execute on function public.acc_person_payables(uuid) to authenticated;

-- ═══ §۲) تسویهٔ بدهی به شخص — بازپرداخت از بانک/صندوق شرکت (اتمیک) ═══
-- بازپرداخت: DR 2110 (تفصیلی شخص) / CR بانک یا صندوق شرکت
create or replace function public.acc_settle_person_payable(
  p_business uuid, p_detail uuid, p_account uuid,
  p_amount bigint, p_date date, p_description text
)
returns uuid
language plpgsql
security definer
set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_detail record;
  v_acc record;
  v_cash_code text;
  v_cash_title text;
  v_id uuid;
  v_balance bigint;
begin
  if v_user is null then raise exception 'ابتدا وارد حساب کاربری شوید'; end if;
  if not public.acc_perm_ok(p_business, 'payments.manage') then
    raise exception 'اجازهٔ تسویهٔ پرداختنی را ندارید';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'مبلغ تسویه باید بزرگ‌تر از صفر باشد';
  end if;

  select * into v_detail from public.acc_details
   where id = p_detail and business_id = p_business;
  if not found then raise exception 'تفصیلی پرداخت‌کننده یافت نشد'; end if;

  -- ماندهٔ فعلی این شخص
  select coalesce(sum(l.credit - l.debit), 0) into v_balance
    from public.acc_journal_lines l
    join public.acc_journal j on j.id = l.entry_id
   where l.business_id = p_business and l.account_code = '2112'
     and l.detail_id = p_detail and j.voided_at is null;
  if p_amount > v_balance then
    raise exception 'مبلغ تسویه (%) از ماندهٔ بدهی به «%» (%) بیشتر است',
      p_amount, v_detail.title, v_balance;
  end if;

  select * into v_acc from public.acc_accounts
   where id = p_account and business_id = p_business;
  if not found then raise exception 'حساب بانک/صندوق پرداخت یافت نشد'; end if;
  v_cash_code := case when v_acc.kind = 'cash' then '1101' else '1102' end;
  v_cash_title := case when v_cash_code = '1101' then 'موجودی نقد و بانک — صندوق' else 'موجودی نقد و بانک — بانک' end;

  perform public.acc_ensure_chart(p_business, '2112', 'پرداختنی به اشخاص', 'liability');
  perform public.acc_ensure_chart(p_business, v_cash_code, v_cash_title, 'asset');

  v_id := public.acc_create_journal(
    p_business, p_date,
    coalesce(nullif(p_description, ''), 'تسویهٔ بدهی به ' || v_detail.title),
    'manual', 'post', null, null,
    jsonb_build_array(
      jsonb_build_object('account_code', '2112', 'account_title', 'پرداختنی به اشخاص',
                         'debit', p_amount, 'credit', 0, 'detail_id', p_detail,
                         'line_desc', 'بازپرداخت به ' || v_detail.title),
      jsonb_build_object('account_code', v_cash_code, 'account_title', v_cash_title,
                         'debit', 0, 'credit', p_amount,
                         'detail_id', public.acc_account_detail_id(p_account),
                         'line_desc', 'پرداخت از ' || coalesce(v_acc.name, v_cash_title))
    ));
  return v_id;
end $$;

grant execute on function public.acc_settle_person_payable(uuid, uuid, uuid, bigint, date, text) to authenticated;
revoke all on function public.acc_settle_person_payable(uuid, uuid, uuid, bigint, date, text) from public, anon;

-- ═══ §۳) Backup — خروجی JSON کانونیکال مرتب بر اساس FK ═══
create or replace function public.acc_backup_export(p_business uuid)
returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_tables text[] := array[
    'acc_partners','acc_partner_roles','acc_details','acc_chart','acc_accounts',
    'acc_cost_centers','acc_projects','acc_expense_categories','acc_items',
    'acc_journal','acc_journal_lines','acc_fiscal_years','acc_periods',
    'acc_invoices','acc_invoice_items','acc_checks','acc_expenses',
    'acc_transactions','acc_petty','acc_petty_ops','acc_prepayments',
    'acc_bank_lines','acc_reconciliations','acc_contracts','acc_recurring',
    'acc_attachments'
  ];
  v_data jsonb := '{}'::jsonb;
  v_rows jsonb;
  t text;
  v_total bigint := 0;
  v_count bigint;
begin
  if v_user is null then raise exception 'ابتدا وارد حساب کاربری شوید'; end if;
  if not public.acc_perm_ok(p_business, 'settings.manage') then
    raise exception 'اجازهٔ تهیهٔ پشتیبان این کسب‌وکار را ندارید';
  end if;

  foreach t in array v_tables loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb)
         from (select * from public.%I where business_id = $1) x', t)
    into v_rows using p_business;
    v_data := jsonb_set(v_data, array[t], v_rows);
    v_count := coalesce(jsonb_array_length(v_rows), 0);
    v_total := v_total + v_count;
  end loop;

  return jsonb_build_object(
    'format', 'karban-acc-backup',
    'version', 1,
    'exported_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'business_id', p_business,
    'business', (select to_jsonb(b) from public.acc_businesses b where b.id = p_business),
    'counts', jsonb_build_object('rows', v_total),
    'data', v_data
  );
end $$;

revoke all on function public.acc_backup_export(uuid) from public, anon;
grant execute on function public.acc_backup_export(uuid) to authenticated;

-- ═══ §۴) اعتبارسنجی مشترک Backup (برای Preview و Restore) ═══
-- خروجی: (valid, biz, errors, warnings, insert_counts jsonb)
create or replace function public.acc_backup_validate(p_payload jsonb, p_mode text)
returns text  -- jsonb گزارش
language plpgsql
security definer
set search_path = public as $$
declare
  v_tables text[] := array[
    'acc_partners','acc_partner_roles','acc_details','acc_chart','acc_accounts',
    'acc_cost_centers','acc_projects','acc_expense_categories','acc_items',
    'acc_journal','acc_journal_lines','acc_fiscal_years','acc_periods',
    'acc_invoices','acc_invoice_items','acc_checks','acc_expenses',
    'acc_transactions','acc_petty','acc_petty_ops','acc_prepayments',
    'acc_bank_lines','acc_reconciliations','acc_contracts','acc_recurring',
    'acc_attachments'
  ];
  v_biz uuid;
  v_data jsonb;
  v_rows jsonb;
  v_errors text[] := array[]::text[];
  v_warnings text[] := array[]::text[];
  v_counts jsonb := '{}'::jsonb;
  v_bad bigint;
  v_insert bigint;
  t text;
begin
  -- ساختار فایل
  if p_payload is null or p_payload ->> 'format' is distinct from 'karban-acc-backup' then
    return jsonb_build_object('valid', false, 'errors', jsonb_build_array('ساختار فایل پشتیبان معتبر نیست (format)'));
  end if;
  if (p_payload ->> 'version')::int is distinct from 1 then
    return jsonb_build_object('valid', false, 'errors', jsonb_build_array('نسخهٔ فایل پشتیبان پشتیبانی نمی‌شود'));
  end if;
  v_biz := p_payload ->> 'business_id';
  v_data := p_payload -> 'data';
  if v_biz is null or v_data is null or jsonb_typeof(v_data) <> 'object' then
    return jsonb_build_object('valid', false, 'errors', jsonb_build_array('business_id یا data در فایل نیست'));
  end if;

  -- مالکیت: فراخوان باید مدیر/مالکِ همان Business باشد
  if not public.acc_perm_ok(v_biz, 'settings.manage') then
    return jsonb_build_object('valid', false,
      'errors', jsonb_build_array('اجازهٔ بازیابی در این کسب‌وکار را ندارید (فایل باید متعلق به کسب‌وکار خودتان باشد)'));
  end if;

  -- بررسی هر جدول
  foreach t in array v_tables loop
    v_rows := v_data -> t;
    if v_rows is null then
      v_warnings := array_append(v_warnings, ('جدول ' || t || ' در فایل نیست — به‌عنوان خالی در نظر گرفته می‌شود'));
      continue;
    end if;
    if jsonb_typeof(v_rows) <> 'array' then
      v_errors := array_append(v_errors, ('ساختار ' || t || ' نامعتبر است (آرایه نیست)'));
      continue;
    end if;
    -- ممنوعیت دادهٔ Business دیگر
    execute format(
      'select count(*) from jsonb_populate_recordset(null::public.%I, $1) x where x.business_id is null or x.business_id <> $2', t)
      into v_bad using v_rows, v_biz;
    if v_bad > 0 then
      v_errors := array_append(v_errors, format('%s سطر در %s به کسب‌وکار دیگری تعلق دارد — بازیابی رد شد', v_bad, t));
      continue;
    end if;

    -- شمارش ردیف‌های تازه (بدون Duplicate)
    if p_mode <> 'count_only' and t <> 'acc_periods' then
      execute format(
        'select count(*) from jsonb_populate_recordset(null::public.%I, $1) x
          where not exists (select 1 from public.%I e where e.id = x.id)', t, t)
        into v_insert using v_rows;
    elsif t = 'acc_periods' then
      execute format(
        'select count(*) from jsonb_populate_recordset(null::public.%I, $1) x
          where not exists (select 1 from public.%I e
                             where e.business_id = x.business_id and e.jyear = x.jyear and e.jmonth = x.jmonth)', t, t)
        into v_insert using v_rows;
    else
      v_insert := coalesce(jsonb_array_length(v_rows), 0);
    end if;
    v_counts := jsonb_set(v_counts, array[t],
      jsonb_build_object('total', coalesce(jsonb_array_length(v_rows), 0), 'insert', v_insert));
  end loop;

  -- هشدار تعارض شماره سند: بازیابی روی دادهٔ جاری
  if coalesce(jsonb_array_length(v_data -> 'acc_journal'), 0) > 0 then
    if exists (select 1 from public.acc_journal j where j.business_id = v_biz)
       and exists (select 1 from jsonb_populate_recordset(null::public.acc_journal, v_data -> 'acc_journal') x
                    where x.business_id = v_biz) then
      v_warnings := array_append(v_warnings, 'این فایل متعلق به همین کسب‌وکار است و سندهای موجودِ همان‌نام نادیده گرفته می‌شوند؛ در صورت تعارض شمارهٔ سند، کل عملیات Rollback می‌شود');
    end if;
  end if;

  -- هشدار ضمائم: فایل‌های Storage در Backup JSON نیستند
  if coalesce(jsonb_array_length(v_data -> 'acc_attachments'), 0) > 0 then
    v_warnings := array_append(v_warnings, 'متادیتای ضمائم بازیابی می‌شود؛ فایل‌های ذخیره‌شدهٔ Storage در فایل JSON نیستند');
  end if;

  return jsonb_build_object(
    'valid', coalesce(array_length(v_errors, 1), 0) = 0,
    'business_id', v_biz,
    'tables', v_counts,
    'errors', to_jsonb(v_errors),
    'warnings', to_jsonb(v_warnings)
  );
end $$;

revoke all on function public.acc_backup_validate(jsonb, text) from public, anon;

-- ═══ §۵) Preview بازیابی — فقط گزارش، بدون نوشتن ═══
create or replace function public.acc_restore_preview(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public as $$
begin
  return public.acc_backup_validate(p_payload, 'preview');
end $$;

grant execute on function public.acc_restore_preview(jsonb) to authenticated;
revoke all on function public.acc_restore_preview(jsonb) from public, anon;

-- ═══ §۶) Restore اتمیک — ترتیب FK + بدون Duplicate + Rollback کامل ═══
-- تابع plpgsql = یک تراکنش؛ هر exception کل عملیات را برمی‌گرداند.
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

grant execute on function public.acc_restore_business(jsonb) to authenticated;
revoke all on function public.acc_restore_business(jsonb) from public, anon;

-- ═══ §۶.۵) ریست دادهٔ بنگاه — فقط برای مالک (ابزار تمیزکاری و تست) ═══
-- دادهٔ گردش را لایه‌به‌لایه (برعکس FK) پاک می‌کند؛ بنگاه، دسترسی و کدینگ می‌ماند.
-- SECURITY DEFINER است چون گاردهای حذف اسناد قطعی، مسیر کاربر را می‌بندند؛
-- اما فقط مالک (settings.manage) می‌تواند بنگاه خودش را ریست کند.
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

  foreach t in array v_tables loop
    execute format('delete from public.%I where business_id = $1', t) using p_business;
    get diagnostics n = row_count;
    v_counts := jsonb_set(v_counts, array[t], to_jsonb(n));
  end loop;

  return jsonb_build_object('purged', true, 'business_id', p_business, 'deleted', v_counts);
end $$;

revoke all on function public.acc_purge_business_data(uuid) from public, anon;
grant execute on function public.acc_purge_business_data(uuid) to authenticated;

-- ═══ §۷) Post-check ═══
do $$
declare n int;
begin
  select count(*) into n from pg_proc p
   join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and p.proname in ('acc_backup_export','acc_restore_preview','acc_restore_business',
                      'acc_person_payables','acc_settle_person_payable');
  raise notice 'POSTCHECK توابع Backup/Restore/پرداختنی: % (انتظار: 5)', n;
end $$;
