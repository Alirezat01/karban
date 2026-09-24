-- ═══════════════════════════════════════════════════════════════════════════
-- M1 — موتور سند کانونیکال (Canonical Posting Engine) — یک موتور، یک نویسنده
-- ═══════════════════════════════════════════════════════════════════════════
-- هدف (بندهای ۶، ۷، ۸، ۹، ۱۱، ۱۲، ۱۳ دستور):
--   • acc_post_journal v2 = تنها نویسندهٔ سر‌سند/ردیف در کل دیتابیس
--       (قفل مشورتی per-business + شمارندهٔ اتمیک + حل account_id + skip ردیف صفر)
--   • acc_post_document v3 = تنها «تصمیم‌ساز ردیف» برای اسناد عملیاتی
--       (فاکتور/هزینه/دریافت‌وپرداخت) و همهٔ تریگرهای آینه فقط wrapper نازک آن
--   • acc_create_journal v5 = اعتبارسنجی سند دستی v3 + عبور از نویسندهٔ واحد
--   • acc_void_journal_internal v2 = سند برگشتی هم از نویسندهٔ واحد + reversal_of
--   • حذف کامل 7101 به‌عنوان حساب تراز مصنوعی:
--       فروش/خرید نسیه بدون طرف‌حساب → REJECT (طرف‌حساب اجباری)
--       فروش/خرید نقدی بدون طرف‌حساب → حساب بانک/صندوق واقعی سند
--       دریافت/پرداخت بدون طرف‌حساب → REJECT
--       هزینهٔ پرداخت‌شدهٔ شخصی → 2110 پرداختنی به اشخاص (تفصیلی پرداخت‌کننده)
--   • COGS: فروش کالای انباری → DR 5101 / CR 1201 به بهای خرید؛ برگشت فروش عکس آن
--   • acc_ensure_chart v2 و acc_ensure_detail v2 (اتمیک/ایزوله/بدون Duplicate)
--   • گارد تغییرناپذیری اسناد سندخورده (هزینه/تراکنش) + چرخهٔ وضعیت فاکتور
-- قابل اجرای مجدد (idempotent). اجرا: SQL Editor — کل فایل یکجا.
-- Rollback: بازنشانی بدنهٔ توابع از نسخهٔ قبلی (05) + DROP تریگرهای گارد.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ §–۱) گارد پیش‌شرط — نه silent-break، بلکه پیام صریح ═══
-- این بسته روی «لایهٔ هستهٔ حسابداری» سوار است (مایگریشن‌های ۲۰۲۶۰۹۱۷ تا
-- ۲۰۲۶۰۹۲۰ + ترمیم‌های زنده). اگر هر وابستگیِ خارجی غایب باشد، همین‌جا با
-- فهرست دقیق کمبودها متوقف می‌شوید — نه با 42P01 در میانهٔ فایل.
do $precond$
declare
  missing text[] := array[]::text[];
  t text;
  f text;
begin
  foreach t in array array[
    'acc_businesses','acc_access','acc_journal','acc_journal_lines','acc_chart',
    'acc_details','acc_partners','acc_partner_roles','acc_accounts','acc_invoices',
    'acc_invoice_items','acc_items','acc_expenses','acc_transactions','acc_checks',
    'acc_fiscal_years','acc_periods','acc_bank_lines','acc_reconciliations',
    'acc_contracts','acc_recurring','acc_attachments','acc_expense_categories',
    'acc_cost_centers','acc_projects','acc_code_counters'
  ] loop
    if to_regclass('public.' || t) is null then
      missing := array_append(missing, 'table ' || t);
    end if;
  end loop;

  foreach f in array array[
    'acc_is_member(uuid)','acc_perm_ok(uuid,text)','acc_sys_admin()',
    'acc_account_detail_id(uuid)','acc_chart_title(uuid,text)',
    'acc_expense_code(text)','acc_cash_title(text)','acc_date_to_jalali(date)',
    'acc_cash_code(uuid)','acc_next_detail_code(uuid)'
  ] loop
    if to_regprocedure('public.' || f) is null then
      missing := array_append(missing, 'function ' || f);
    end if;
  end loop;

  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='acc_chart'
                    and column_name='requires_detail') then
    missing := array_append(missing, 'column acc_chart.requires_detail');
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='acc_journal_lines'
                    and column_name='account_id') then
    missing := array_append(missing, 'column acc_journal_lines.account_id');
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='acc_journal'
                    and column_name='reversal_of') then
    missing := array_append(missing, 'column acc_journal.reversal_of');
  end if;
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.acc_journal'::regclass
                    and conname = 'acc_journal_biz_entryno_uniq') then
    missing := array_append(missing, 'constraint acc_journal_biz_entryno_uniq (یگانی شمارهٔ سند)');
  end if;

  if array_length(missing, 1) > 0 then
    raise exception 'زنجیرهٔ حسابداری کامل نیست — % وابستگی غایب است: % — ابتدا مایگریشن‌های هسته (20260917..20260920 + ترمیم‌های زنده) را کامل اجرا کنید',
      array_length(missing, 1), array_to_string(missing, ' | ');
  end if;
  raise notice 'PRECONDITION OK — لایهٔ هسته کامل است';
end
$precond$;

-- ═══ §۰) پیش‌نیازهای ساختاری این مایگریشن ═══

-- ۰.۰) حذف هدفمند تریگرهای خارج از زنجیرهٔ migration روی acc_chart (شواهد زنده:
--   تریگر ناشناس «حساب بدون والد باید level=1 باشد» جلوی ساخت بنگاه تازه را می‌گیرد
--   و با گارد سلسله‌مراتب کانونیکال M2 جایگزین می‌شود). شناسایی بر اساس امضای متن
--   بدنه — گاردهای شناخته‌شده (master delete guard) دست‌نخورده می‌مانند.
do $$
declare r record;
begin
  for r in select t.tgname
             from pg_trigger t
             join pg_class c on c.oid = t.tgrelid
             join pg_proc p on p.oid = t.tgfoid
            where c.relname = 'acc_chart' and not t.tgisinternal
              and position('بدون والد' in p.prosrc) > 0
  loop
    execute format('drop trigger if exists %I on public.acc_chart', r.tgname);
    raise notice 'تریگر خارج از migration حذف شد (acc_chart): %', r.tgname;
  end loop;
end $$;


-- ۰.۱) ستون‌های «پرداخت‌کنندهٔ هزینه» (بند ۵ و ۱۳): چه کسی هزینه را پرداخت کرده؟
alter table public.acc_expenses
  add column if not exists paid_by_kind text not null default 'company';
alter table public.acc_expenses
  add column if not exists paid_by_detail_id uuid references public.acc_details(id) on delete set null;

do $$ begin
  if not exists (select 1 from pg_constraint con where con.conrelid = 'public.acc_expenses'::regclass
                  and con.conname = 'acc_expenses_paid_by_kind_chk') then
    alter table public.acc_expenses add constraint acc_expenses_paid_by_kind_chk
      check (paid_by_kind in ('company','partner','employee','shareholder','other_person','unpaid'));
  end if;
end $$;

-- سازگاری دادهٔ موجود: هزینهٔ پرداخت‌شدهٔ بدون بانک با partner → به‌عنوان نسیه ثبت شده؛ دستهٔ unpaid
update public.acc_expenses
   set paid_by_kind = 'unpaid'
 where paid_by_kind = 'company' and not coalesce(is_paid, false);

-- ۰.۲) حساب‌های جدید استاندارد (کدینگ پایه) — اگر نبود
insert into public.acc_chart (business_id, code, title, kind, is_system, level, is_leaf, nature, active,
                              requires_detail, allowed_detail_types)
values
  (null, '5101', 'بهای تمام‌شده کالای فروش رفته', 'expense',  true, 3, true, 'debit',  true, false, '{}'),
  -- ۲۱۱۲: «پرداختنی به اشخاص». کد ۲۱۱۰ در کدینگ پایهٔ نصب‌شده = «مالیات عملکرد
  -- پرداختنی» است و نباید بازتعریف شود؛ نخستین جایگاه خالی 21xx = 2112 (پروب زنده).
  (null, '2112', 'پرداختنی به اشخاص',             'liability',true, 3, true, 'credit', true, true,
     '{customer,supplier,shareholder,employee,partner,other}')
on conflict (business_id, code) do nothing;

do $$ begin
  if not exists (select 1 from pg_constraint con where con.conrelid = 'public.acc_chart'::regclass
                  and con.conname = 'acc_chart_biz_code_uniq') then
    -- یگانی بودن کد در هر فضای‌نام (اگر از قبل با نام دیگری هست، این بلاک بی‌اثر است)
    begin
      alter table public.acc_chart
        add constraint acc_chart_biz_code_uniq unique (business_id, code);
    exception when duplicate_table or duplicate_object then null;
    end;
  end if;
end $$;

-- ۰.۳) پیش‌نیاز موتور: شمارندهٔ اتمیک اسناد (بند ۷) — «بنیان»، نه سخت‌سازی بعدی
-- acc_post_journal در §۱ همین فایل acc_next_entry_no را صدا می‌زند؛ پس جدول شمارنده
-- و تابع آن باید «قبل از» موتور تضمین شوند. روی DB زندهٔ فعلی no-op است (از قبل
-- ساخته شده) و روی DB تازه/برنچ از صفر می‌سازد — بسته خودبسنده می‌شود.
create table if not exists public.acc_entry_counters (
  business_id uuid primary key references public.acc_businesses(id) on delete cascade,
  last_entry_no bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.acc_entry_counters enable row level security;
drop policy if exists "acc counters member read" on public.acc_entry_counters;
create policy "acc counters member read" on public.acc_entry_counters
  for select to authenticated
  using (public.acc_is_member(business_id));

-- بذرگیری از واقعیت دفتر (فقط ردیف‌های گم‌شده)
insert into public.acc_entry_counters (business_id, last_entry_no)
select j.business_id, max(j.entry_no)
  from public.acc_journal j
 group by j.business_id
on conflict (business_id) do nothing;

-- نسخهٔ ۲: خودترمیم در مسیر عادی — زیر قفل ردیف شمارنده، MAX واقعی دفتر خوانده
-- می‌شود؛ شمارنده هیچ‌وقت از دفتر عقب‌تر نمی‌ماند (پاک‌سازی/بازیابی هم بی‌خطر است).
drop function if exists public.acc_next_entry_no(uuid);
create or replace function public.acc_next_entry_no(p_business uuid)
returns integer
language plpgsql
security definer
set search_path = public as $$
declare
  v_no  bigint;
  v_max bigint;
begin
  if p_business is null then
    raise exception 'کسب‌وکار نامعتبر است';
  end if;

  select last_entry_no into v_no
    from public.acc_entry_counters
   where business_id = p_business
   for update;

  if not found then
    insert into public.acc_entry_counters (business_id, last_entry_no)
    values (p_business, 0)
    on conflict (business_id) do update set updated_at = now();

    select last_entry_no into v_no
      from public.acc_entry_counters
     where business_id = p_business
     for update;
  end if;

  -- خودترمیمی: شمارنده هرگز از ماکس واقعی دفتر عقب‌تر نمی‌ماند
  select coalesce(max(entry_no), 0) into v_max
    from public.acc_journal
   where business_id = p_business;

  v_no := greatest(v_no, v_max) + 1;

  update public.acc_entry_counters
     set last_entry_no = v_no, updated_at = now()
   where business_id = p_business;

  return v_no::integer;
end $$;

revoke all on function public.acc_next_entry_no(uuid) from public, anon, authenticated;

-- ═══ §۱) نویسندهٔ واحد دفتر — acc_post_journal v2 ═══
-- قواعد: قفل مشورتی per-business (سریال‌سازی کامل) + شمارندهٔ اتمیک + skip ردیف صفر
--        + حل account_id از کدینگ (کل→معین) + پشتیبانی reversal_of (اتصال برگشتی به اصلی)
-- امضای قدیمی ۷پارامتری حذف می‌شود تا تنها یک نویسندهٔ واحد باقی بماند
drop function if exists public.acc_post_journal(uuid, date, text, text, uuid, text, jsonb);
create or replace function public.acc_post_journal(
  p_business uuid, p_date date, p_ref_type text, p_ref_action text,
  p_ref_id uuid, p_desc text, p_lines jsonb,
  p_reversal_of uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public as $$
declare
  v_entry uuid;
  v_no bigint;
  l jsonb;
  v_code text;
  v_title text;
  v_acc_id uuid;
  v_req boolean;
  v_allowed text[];
  v_detail uuid;
  v_partner uuid;
  v_pname text;
begin
  if p_business is null then raise exception 'کسب‌وکار نامعتبر است'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'سند بدون ردیف مجاز نیست';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_business::text, 0));
  v_no := public.acc_next_entry_no(p_business);
  insert into public.acc_journal (business_id, entry_no, date_g, ref_type, ref_action, ref_id, reversal_of, description)
  values (p_business, v_no, p_date, p_ref_type, p_ref_action, p_ref_id, p_reversal_of,
          coalesce(nullif(p_desc, ''), 'سند شماره ' || v_no))
  returning id into v_entry;

  for l in select * from jsonb_array_elements(p_lines) loop
    -- سازگاری کلیدها: 'code'/'account_code' و 'title'/'account_title'
    v_code  := coalesce(nullif(l->>'account_code', ''), nullif(l->>'code', ''));
    v_title := coalesce(nullif(l->>'account_title', ''), nullif(l->>'title', ''), v_code);
    -- ردیف‌های مبلغ صفر درج نمی‌شوند (سازگار با acc_jline_amounts_chk)
    if coalesce(nullif(l->>'debit','')::bigint, 0) = 0
       and coalesce(nullif(l->>'credit','')::bigint, 0) = 0 then
      continue;
    end if;

    -- حل حساب + پل خودکار partner → تفصیلی (بند ۱۰): حسابِ requires_detail هرگز
    -- با partner_id بدون تفصیلی نمی‌ماند؛ تفصیلیِ ناهم‌نوع هم خودکار هم‌نوع می‌شود
    select c.id, coalesce(c.requires_detail, false), coalesce(c.allowed_detail_types, '{}'::text[])
      into v_acc_id, v_req, v_allowed
      from public.acc_chart c
     where c.code = v_code and (c.business_id = p_business or c.business_id is null)
     order by (c.business_id = p_business) desc nulls last, c.level desc
     limit 1;
    v_detail  := nullif(l->>'detail_id','')::uuid;
    v_partner := nullif(l->>'partner_id','')::uuid;
    if v_detail is null and v_partner is not null and v_req then
      if v_allowed <> '{}' then
        select id into v_detail from public.acc_details
         where business_id = p_business and ref_id = v_partner and kind = any (v_allowed)
         order by created_at limit 1;
      else
        select id into v_detail from public.acc_details
         where business_id = p_business and ref_id = v_partner
         order by created_at limit 1;
      end if;
      if v_detail is null then
        select name into v_pname from public.acc_partners where id = v_partner;
        v_detail := public.acc_ensure_detail(p_business,
          case when v_allowed <> '{}' then v_allowed[1] else 'other' end,
          coalesce(v_pname, ''), v_partner);
      end if;
    end if;

    insert into public.acc_journal_lines
      (entry_id, business_id, account_code, account_title, debit, credit,
       account_id, partner_id, detail_id, cost_center_id, project_id, line_desc)
    values (
      v_entry, p_business, v_code, v_title,
      coalesce(nullif(l->>'debit','')::bigint, 0),
      coalesce(nullif(l->>'credit','')::bigint, 0),
      v_acc_id, v_partner, v_detail,
      nullif(l->>'cost_center_id','')::uuid,
      nullif(l->>'project_id','')::uuid,
      nullif(l->>'line_desc','')
    );
  end loop;
  return v_entry;
end $$;

revoke all on function public.acc_post_journal(uuid, date, text, text, uuid, text, jsonb, uuid)
  from public, anon, authenticated;

-- ═══ §۲) تصمیم‌ساز واحد اسناد عملیاتی — acc_post_document v3 ═══
-- فقط ردیف‌ها را «تصمیم» می‌گیرد؛ نوشتن فقط با acc_post_journal
create or replace function public.acc_post_document(p_kind text, p_ref_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_biz uuid;
  v_exists uuid;
  v_id uuid;
  v_lines jsonb := '[]'::jsonb;
  v_desc text;
  v_date date;
  v_rec record;
  v_cash_code text;
  v_net bigint;
  v_vat bigint;
  v_total bigint;
  v_acc_kind text;
  v_cogs bigint := 0;
  v_cash_detail uuid;
begin
  if v_user is null then raise exception 'ابتدا وارد حساب کاربری شوید'; end if;
  if p_kind not in ('invoice','expense','transaction') then
    raise exception 'نوع سند آینه‌ای نامعتبر: %', p_kind;
  end if;

  if p_kind = 'invoice' then
    select * into v_rec from public.acc_invoices where id = p_ref_id;
    if not found then raise exception 'فاکتور یافت نشد'; end if;
    v_biz := v_rec.business_id;
    if not public.acc_perm_ok(v_biz, 'invoices.issue') then raise exception 'اجازهٔ صدور صورتحساب را ندارید'; end if;
    if v_rec.type = 'proforma' or v_rec.status = 'draft' then return null; end if;
    if v_rec.status = 'cancelled' then return null; end if;
    -- idempotency سخت‌گیرانه: هر رویداد فقط یک سند post در کل عمر خود دارد
    select id into v_exists from public.acc_journal
      where business_id = v_biz and ref_type = 'invoice' and ref_id = p_ref_id and ref_action = 'post' limit 1;
    if v_exists is not null then return v_exists; end if;

    v_net := coalesce(v_rec.subtotal, 0) - coalesce(v_rec.discount_total, 0);
    v_vat := coalesce(v_rec.vat_total, 0);
    v_total := v_net + v_vat;
    v_date := v_rec.date_g;
    v_desc := case v_rec.type
      when 'sale' then 'فاکتور فروش ' || v_rec.number
      when 'purchase' then 'فاکتور خرید ' || v_rec.number
      when 'return_sale' then 'برگشت از فروش ' || v_rec.number
      else 'فاکتور ' || v_rec.number end;

    v_cash_code := null;
    if v_rec.account_id is not null then
      select kind into v_acc_kind from public.acc_accounts where id = v_rec.account_id;
      v_cash_code := case when v_acc_kind = 'cash' then '1101' else '1102' end;
    end if;

    if v_rec.type in ('sale','return_sale') then
      perform public.acc_ensure_chart(v_biz, '4101', 'درآمد فروش کالا و خدمات', 'income');
      perform public.acc_ensure_chart(v_biz, '4103', 'برگشت از فروش و تخفیفات', 'income');
      perform public.acc_ensure_chart(v_biz, '2102', 'مالیات و عوارض ارزش افزوده فروش', 'liability');
      perform public.acc_ensure_chart(v_biz, '1103', 'حساب‌های دریافتنی تجاری', 'asset');
      perform public.acc_ensure_chart(v_biz, '5101', 'بهای تمام‌شده کالای فروش رفته', 'expense');
      perform public.acc_ensure_chart(v_biz, '1201', 'موجودی کالا و خرید', 'asset');

      -- طرف حساب واقعی: نقدی → حساب بانک/صندوق سند؛ نسیه → دریافتنی با طرف‌حساب اجباری
      if v_cash_code is not null then
        perform public.acc_ensure_chart(v_biz, v_cash_code,
          case when v_cash_code = '1101' then 'موجودی نقد و بانک — صندوق' else 'موجودی نقد و بانک — بانک' end, 'asset');
        v_cash_detail := public.acc_account_detail_id(v_rec.account_id);
      else
        if v_rec.partner_id is null then
          raise exception 'فروش نسیه بدون طرف‌حساب مجاز نیست — مشتری را انتخاب کنید یا حساب نقدی/بانکی را برای فروش نقدی مشخص کنید';
        end if;
      end if;

      if v_rec.type = 'sale' then
        -- طرف بدهکار
        if v_cash_code is not null then
          v_lines := v_lines || jsonb_build_array(
            jsonb_build_object('account_code', v_cash_code, 'account_title',
              case when v_cash_code = '1101' then 'موجودی نقد و بانک — صندوق' else 'موجودی نقد و بانک — بانک' end,
              'debit', v_total, 'credit', 0, 'detail_id', v_cash_detail, 'line_desc', 'فروش نقدی'));
        else
          v_lines := v_lines || jsonb_build_array(
            jsonb_build_object('account_code', '1103', 'account_title', 'حساب‌های دریافتنی تجاری',
              'debit', v_total, 'credit', 0, 'partner_id', v_rec.partner_id, 'line_desc', 'طلب از مشتری'));
        end if;
        -- درآمد + مالیات
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('account_code', '4101', 'account_title', 'درآمد فروش کالا و خدمات',
            'debit', 0, 'credit', v_net, 'line_desc', 'درآمد فروش'),
          jsonb_build_object('account_code', '2102', 'account_title', 'مالیات و عوارض ارزش افزوده فروش',
            'debit', 0, 'credit', v_vat, 'line_desc', 'مالیات بر ارزش افزوده'));
        -- COGS کالای انباری (بند ۱۲)
        select coalesce(sum(round(ii.quantity * coalesce(i.purchase_price, 0))), 0) into v_cogs
          from public.acc_invoice_items ii
          join public.acc_items i on i.id = ii.item_id
         where ii.invoice_id = p_ref_id and i.track_stock and i.kind = 'goods';
        if v_cogs > 0 then
          v_lines := v_lines || jsonb_build_array(
            jsonb_build_object('account_code', '5101', 'account_title', 'بهای تمام‌شده کالای فروش رفته',
              'debit', v_cogs, 'credit', 0, 'line_desc', 'بهای تمام‌شده فروش'),
            jsonb_build_object('account_code', '1201', 'account_title', 'موجودی کالا و خرید',
              'debit', 0, 'credit', v_cogs, 'line_desc', 'کاهش موجودی'));
        end if;
      else
        -- برگشت از فروش: عکس اثر — کاهش درآمد، عودت وجه/بدهی، بازگشت موجودی
        if v_cash_code is not null then
          v_lines := v_lines || jsonb_build_array(
            jsonb_build_object('account_code', v_cash_code, 'account_title',
              case when v_cash_code = '1101' then 'موجودی نقد و بانک — صندوق' else 'موجودی نقد و بانک — بانک' end,
              'debit', 0, 'credit', v_total, 'detail_id', v_cash_detail, 'line_desc', 'عودت وجه برگشت فروش'));
        else
          v_lines := v_lines || jsonb_build_array(
            jsonb_build_object('account_code', '1103', 'account_title', 'حساب‌های دریافتنی تجاری',
              'debit', 0, 'credit', v_total, 'partner_id', v_rec.partner_id, 'line_desc', 'کاهش طلب از مشتری'));
        end if;
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('account_code', '4103', 'account_title', 'برگشت از فروش و تخفیفات',
            'debit', v_net, 'credit', 0, 'line_desc', 'برگشت از فروش'),
          jsonb_build_object('account_code', '2102', 'account_title', 'مالیات و عوارض ارزش افزوده فروش',
            'debit', v_vat, 'credit', 0, 'line_desc', 'برگشت مالیات فروش'));
        select coalesce(sum(round(ii.quantity * coalesce(i.purchase_price, 0))), 0) into v_cogs
          from public.acc_invoice_items ii
          join public.acc_items i on i.id = ii.item_id
         where ii.invoice_id = p_ref_id and i.track_stock and i.kind = 'goods';
        if v_cogs > 0 then
          v_lines := v_lines || jsonb_build_array(
            jsonb_build_object('account_code', '1201', 'account_title', 'موجودی کالا و خرید',
              'debit', v_cogs, 'credit', 0, 'line_desc', 'بازگشت موجودی'),
            jsonb_build_object('account_code', '5101', 'account_title', 'بهای تمام‌شده کالای فروش رفته',
              'debit', 0, 'credit', v_cogs, 'line_desc', 'برگشت بهای تمام‌شده'));
        end if;
      end if;

    elsif v_rec.type = 'purchase' then
      perform public.acc_ensure_chart(v_biz, '1201', 'موجودی کالا و خرید', 'asset');
      perform public.acc_ensure_chart(v_biz, '2103', 'اعتبار مالیات و عوارض ارزش افزوده', 'asset');
      perform public.acc_ensure_chart(v_biz, '2101', 'حساب‌های پرداختنی تجاری', 'liability');
      if v_cash_code is not null then
        perform public.acc_ensure_chart(v_biz, v_cash_code,
          case when v_cash_code = '1101' then 'موجودی نقد و بانک — صندوق' else 'موجودی نقد و بانک — بانک' end, 'asset');
        v_cash_detail := public.acc_account_detail_id(v_rec.account_id);
      else
        if v_rec.partner_id is null then
          raise exception 'خرید نسیه بدون طرف‌حساب مجاز نیست — تامین‌کننده را انتخاب کنید یا حساب پرداخت نقدی را مشخص کنید';
        end if;
      end if;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('account_code', '1201', 'account_title', 'موجودی کالا و خرید',
          'debit', v_net, 'credit', 0, 'line_desc', 'خرید کالا/خدمت'),
        jsonb_build_object('account_code', '2103', 'account_title', 'اعتبار مالیات و عوارض ارزش افزوده',
          'debit', v_vat, 'credit', 0, 'line_desc', 'اعتبار مالیات خرید'));
      if v_cash_code is not null then
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('account_code', v_cash_code, 'account_title',
            case when v_cash_code = '1101' then 'موجودی نقد و بانک — صندوق' else 'موجودی نقد و بانک — بانک' end,
            'debit', 0, 'credit', v_total, 'detail_id', v_cash_detail, 'line_desc', 'پرداخت نقدی خرید'));
      else
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('account_code', '2101', 'account_title', 'حساب‌های پرداختنی تجاری',
            'debit', 0, 'credit', v_total, 'partner_id', v_rec.partner_id, 'line_desc', 'بدهی به تامین‌کننده'));
      end if;
    end if;

  elsif p_kind = 'expense' then
    select * into v_rec from public.acc_expenses where id = p_ref_id;
    if not found then raise exception 'هزینه یافت نشد'; end if;
    v_biz := v_rec.business_id;
    if not public.acc_perm_ok(v_biz, 'expenses.manage') then raise exception 'اجازهٔ ثبت هزینه را ندارید'; end if;
    if v_rec.voided_at is not null then return null; end if;
    select id into v_exists from public.acc_journal
      where business_id = v_biz and ref_type = 'expense' and ref_id = p_ref_id and ref_action = 'post' limit 1;
    if v_exists is not null then return v_exists; end if;

    v_net := coalesce(v_rec.amount, 0);
    v_vat := coalesce(v_rec.vat_amount, 0);
    v_total := v_net + v_vat;
    v_date := v_rec.date_g;
    v_desc := 'هزینه: ' || coalesce(v_rec.title, v_rec.category, '');

    declare
      v_code text;
      v_title text;
      v_cash_detail uuid;
      v_pd_detail uuid;
      v_cc_code text;
    begin
      -- کد سرفصل هزینه: حساب انتخابی > mapping دسته > کد پیش‌فرض دسته‌بندی
      if v_rec.expense_account_id is not null then
        select code, title into v_code, v_title from public.acc_chart where id = v_rec.expense_account_id limit 1;
      end if;
      if v_code is null and v_rec.category is not null then
        select coalesce(cc.chart_code, cc.code) into v_code
          from public.acc_expense_categories cc
         where cc.business_id = v_biz and cc.title = v_rec.category limit 1;
        if v_code is not null then
          v_title := public.acc_chart_title(v_biz, v_code);
        end if;
      end if;
      if v_code is null then
        v_code := public.acc_expense_code(v_rec.category);
        v_title := public.acc_chart_title(v_biz, v_code);
      end if;
      v_code := coalesce(v_code, '5299');
      v_title := coalesce(v_title, coalesce(v_rec.category, 'سایر هزینه‌ها'));
      perform public.acc_ensure_chart(v_biz, v_code, v_title, 'expense');
      perform public.acc_ensure_chart(v_biz, '2103', 'اعتبار مالیات و عوارض ارزش افزوده', 'asset');

      -- بدهکار: هزینه (+اعتبار مالیات خرید در صورت وجود)
      v_lines := jsonb_build_array(
        jsonb_build_object('account_code', v_code, 'account_title', v_title,
          'debit', v_net, 'credit', 0, 'detail_id', v_rec.detail_id,
          'cost_center_id', v_rec.cost_center_id, 'project_id', v_rec.project_id,
          'line_desc', coalesce(v_rec.title, v_rec.category)));
      if v_vat > 0 then
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('account_code', '2103', 'account_title', 'اعتبار مالیات و عوارض ارزش افزوده',
            'debit', v_vat, 'credit', 0, 'line_desc', 'اعتبار مالیات هزینه'));
      end if;

      -- بستانکار بر اساس پرداخت‌کننده (بند ۱۳) — هیچ مسیری به 7101 نمی‌رود
      if v_rec.paid_by_kind in ('partner','employee','shareholder','other_person') then
        -- شخص ثالث پرداخت کرده → بدهی ما به شخص (2110)؛ بانک/صندوق شرکت دست نمی‌خورد
        perform public.acc_ensure_chart(v_biz, '2112', 'پرداختنی به اشخاص', 'liability');
        if v_rec.paid_by_detail_id is null then
          raise exception 'پرداخت‌کنندهٔ شخصی هزینه مشخص نشده است — «پرداخت‌کننده» را انتخاب کنید';
        end if;
        select id into v_pd_detail from public.acc_details
         where id = v_rec.paid_by_detail_id and business_id = v_biz;
        if v_pd_detail is null then
          raise exception 'تفصیلی پرداخت‌کننده به این کسب‌وکار تعلق ندارد';
        end if;
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('account_code', '2112', 'account_title', 'پرداختنی به اشخاص',
            'debit', 0, 'credit', v_total, 'detail_id', v_pd_detail,
            'line_desc', 'پرداخت توسط شخص ثالث — بازپرداخت به شخص'));
      elsif v_rec.paid_by_kind = 'unpaid' then
        -- پرداخت‌نشده: بدهی به طرف‌حساب (سهامدار → جاری شرکا | کارمند → جاری کارکنان | غیره → پرداختنی تجاری)
        if v_rec.partner_id is null then
          raise exception 'هزینهٔ پرداخت‌نشده بدون طرف‌حساب مجاز نیست — طرف‌حساب را مشخص کنید';
        end if;
        select case when exists (select 1 from public.acc_partner_roles r where r.partner_id = v_rec.partner_id and r.role = 'shareholder')
                     then '3103'
                    when exists (select 1 from public.acc_partner_roles r where r.partner_id = v_rec.partner_id and r.role = 'employee')
                     then '2108'
                    else '2101' end
          into v_cc_code;
        perform public.acc_ensure_chart(v_biz, v_cc_code,
          case v_cc_code when '3103' then 'جاری شرکا' when '2108' then 'جاری کارکنان' else 'حساب‌های پرداختنی تجاری' end,
          case when v_cc_code = '3103' then 'equity' else 'liability' end);
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('account_code', v_cc_code, 'account_title',
            coalesce(public.acc_chart_title(v_biz, v_cc_code), v_cc_code),
            'debit', 0, 'credit', v_total, 'partner_id', v_rec.partner_id,
            'line_desc', 'هزینه پرداخت‌نشده'));
      else
        -- شرکت پرداخت کرده → باید حساب بانک/صندوق مشخص باشد
        if v_rec.account_id is null then
          raise exception 'هزینهٔ پرداخت‌شدهٔ شرکت بدون حساب بانک/صندوق مجاز نیست — حساب پرداخت‌کننده را انتخاب کنید یا پرداخت‌کنندهٔ شخصی/پرداخت‌نشده را مشخص کنید';
        end if;
        select kind into v_acc_kind from public.acc_accounts where id = v_rec.account_id;
        v_cash_code := case when v_acc_kind = 'cash' then '1101' else '1102' end;
        perform public.acc_ensure_chart(v_biz, v_cash_code,
          case when v_cash_code = '1101' then 'موجودی نقد و بانک — صندوق' else 'موجودی نقد و بانک — بانک' end, 'asset');
        v_cash_detail := public.acc_account_detail_id(v_rec.account_id);
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('account_code', v_cash_code, 'account_title',
            case when v_cash_code = '1101' then 'موجودی نقد و بانک — صندوق' else 'موجودی نقد و بانک — بانک' end,
            'debit', 0, 'credit', v_total, 'detail_id', v_cash_detail, 'line_desc', 'پرداخت هزینه'));
      end if;
    end;

  elsif p_kind = 'transaction' then
    select * into v_rec from public.acc_transactions where id = p_ref_id;
    if not found then raise exception 'تراکنش یافت نشد'; end if;
    v_biz := v_rec.business_id;
    if not public.acc_perm_ok(v_biz, 'payments.manage') then raise exception 'اجازهٔ ثبت دریافت/پرداخت را ندارید'; end if;
    if v_rec.voided_at is not null then return null; end if;
    select id into v_exists from public.acc_journal
      where business_id = v_biz and ref_type = 'transaction' and ref_id = p_ref_id and ref_action = 'post' limit 1;
    if v_exists is not null then return v_exists; end if;

    v_total := coalesce(v_rec.amount, 0);
    v_date := v_rec.date_g;

    if v_rec.kind = 'transfer' then
      -- انتقال داخلی: فقط جابه‌جایی بین دو حساب خودِ کسب‌وکار
      if v_rec.account_id is null or v_rec.to_account_id is null then
        return null; -- انتقال ناقص سند ندارد (قید قدیمی)
      end if;
      v_desc := 'انتقال: ' || coalesce(v_rec.description, '');
      declare v_to_cash text; v_to_title text; begin
        select kind into v_acc_kind from public.acc_accounts where id = v_rec.to_account_id;
        v_to_cash := case when v_acc_kind = 'cash' then '1101' else '1102' end;
        perform public.acc_ensure_chart(v_biz, v_to_cash,
          case when v_to_cash = '1101' then 'موجودی نقد و بانک — صندوق' else 'موجودی نقد و بانک — بانک' end, 'asset');
        v_lines := jsonb_build_array(
          jsonb_build_object('account_code', v_to_cash, 'account_title',
            coalesce(public.acc_chart_title(v_biz, v_to_cash), v_to_cash),
            'debit', v_total, 'credit', 0,
            'detail_id', public.acc_account_detail_id(v_rec.to_account_id),
            'line_desc', coalesce(v_rec.description, 'انتقال وجه')));
        select kind into v_acc_kind from public.acc_accounts where id = v_rec.account_id;
        v_cash_code := case when v_acc_kind = 'cash' then '1101' else '1102' end;
        perform public.acc_ensure_chart(v_biz, v_cash_code,
          case when v_cash_code = '1101' then 'موجودی نقد و بانک — صندوق' else 'موجودی نقد و بانک — بانک' end, 'asset');
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('account_code', v_cash_code, 'account_title',
            coalesce(public.acc_chart_title(v_biz, v_cash_code), v_cash_code),
            'debit', 0, 'credit', v_total,
            'detail_id', public.acc_account_detail_id(v_rec.account_id),
            'line_desc', coalesce(v_rec.description, 'انتقال وجه')));
      end;
    else
      -- دریافت/پرداخت: طرف‌حساب اجباری (بند ۱۱) — بدون 7101
      if v_rec.partner_id is null then
        raise exception 'ثبت % بدون طرف‌حساب مجاز نیست — طرف‌حساب را انتخاب کنید',
          case when v_rec.kind = 'receipt' then 'دریافت' else 'پرداخت' end;
      end if;
      if v_rec.account_id is null then
        raise exception 'حساب بانک/صندوق % مشخص نشده است', case when v_rec.kind = 'receipt' then 'دریافت' else 'پرداخت' end;
      end if;
      select kind into v_acc_kind from public.acc_accounts where id = v_rec.account_id;
      v_cash_code := case when v_acc_kind = 'cash' then '1101' else '1102' end;
      perform public.acc_ensure_chart(v_biz, v_cash_code,
        case when v_cash_code = '1101' then 'موجودی نقد و بانک — صندوق' else 'موجودی نقد و بانک — بانک' end, 'asset');
      perform public.acc_ensure_chart(v_biz, '1103', 'حساب‌های دریافتنی تجاری', 'asset');
      perform public.acc_ensure_chart(v_biz, '2101', 'حساب‌های پرداختنی تجاری', 'liability');

      declare
        v_pd uuid;
        v_pname text;
        v_pcode text;
        v_ptitle text;
      begin
        -- تفصیلی طرف‌حساب با نقش: سهامدار → 3103 | کارمند → 2108 | غیره → 1103/2101
        select role into v_acc_kind from public.acc_partner_roles
         where partner_id = v_rec.partner_id and role in ('shareholder','employee')
         order by case role when 'shareholder' then 1 else 2 end limit 1;
        if v_acc_kind = 'shareholder' then
          v_pcode := '3103'; v_ptitle := coalesce(public.acc_chart_title(v_biz, '3103'), 'جاری شرکا');
          perform public.acc_ensure_chart(v_biz, '3103', 'جاری شرکا', 'equity');
        elsif v_acc_kind = 'employee' then
          v_pcode := '2108'; v_ptitle := coalesce(public.acc_chart_title(v_biz, '2108'), 'جاری کارکنان');
          perform public.acc_ensure_chart(v_biz, '2108', 'جاری کارکنان', 'liability');
        else
          v_pcode := case when v_rec.kind = 'receipt' then '1103' else '2101' end;
          v_ptitle := case when v_rec.kind = 'receipt' then 'حساب‌های دریافتنی تجاری' else 'حساب‌های پرداختنی تجاری' end;
        end if;
        select name into v_pname from public.acc_partners where id = v_rec.partner_id;
        v_pd := public.acc_ensure_detail(
          v_biz,
          case when v_acc_kind = 'shareholder' then 'shareholder'
               when v_acc_kind = 'employee' then 'employee'
               when v_rec.kind = 'receipt' then 'customer' else 'supplier' end,
          coalesce(v_pname, ''), v_rec.partner_id);

        if v_rec.kind = 'receipt' then
          v_desc := 'دریافت: ' || coalesce(v_rec.description, '');
          v_lines := jsonb_build_array(
            jsonb_build_object('account_code', v_cash_code, 'account_title',
              coalesce(public.acc_chart_title(v_biz, v_cash_code), public.acc_cash_title(v_cash_code)),
              'debit', v_total, 'credit', 0,
              'detail_id', public.acc_account_detail_id(v_rec.account_id),
              'line_desc', coalesce(v_rec.description, 'دریافت وجه')),
            jsonb_build_object('account_code', v_pcode, 'account_title', v_ptitle,
              'debit', 0, 'credit', v_total, 'partner_id', v_rec.partner_id, 'detail_id', v_pd,
              'line_desc', coalesce(v_rec.description, 'تسویه مطالبات')));
        else
          v_desc := 'پرداخت: ' || coalesce(v_rec.description, '');
          v_lines := jsonb_build_array(
            jsonb_build_object('account_code', v_pcode, 'account_title', v_ptitle,
              'debit', v_total, 'credit', 0, 'partner_id', v_rec.partner_id, 'detail_id', v_pd,
              'line_desc', coalesce(v_rec.description, 'تسویه بدهی')),
            jsonb_build_object('account_code', v_cash_code, 'account_title',
              coalesce(public.acc_chart_title(v_biz, v_cash_code), public.acc_cash_title(v_cash_code)),
              'debit', 0, 'credit', v_total,
              'detail_id', public.acc_account_detail_id(v_rec.account_id),
              'line_desc', coalesce(v_rec.description, 'پرداخت وجه')));
        end if;
      end;
    end if;
  end if;

  -- نویسندهٔ واحد
  v_id := public.acc_post_journal(v_biz, v_date, p_kind, 'post', p_ref_id, v_desc, v_lines);
  return v_id;
end $$;

grant execute on function public.acc_post_document(text, uuid) to authenticated;
revoke all on function public.acc_post_document(text, uuid) from public, anon;

-- ═══ §۳) تریگرهای آینه — فقط wrapper نازکِ موتور (حذف منطق دوبل) ═══

-- ─── فاکتور: صدور → post_document | ابطال → برگشتِ متصل به سند اصلی ───
create or replace function public.acc_invoice_after()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_post_id uuid;
  v_lines jsonb;
begin
  -- صدور: وضعیت issued + مهر posted → موتور کانونیکال
  if tg_op in ('INSERT','UPDATE')
     and new.type in ('sale','purchase','return_sale')
     and new.status = 'issued'
     and new.posted_at is not null
     and not exists (select 1 from public.acc_journal
                     where ref_type = 'invoice' and ref_id = new.id and ref_action = 'post') then
    perform public.acc_post_document('invoice', new.id);
  end if;

  -- ابطال: قید عکس — از نویسندهٔ واحد با reversal_of متصل به سند اصلی (بند ۱۴)
  if tg_op = 'UPDATE'
     and old.posted_at is not null
     and new.status = 'cancelled'
     and old.status <> 'cancelled'
     and not exists (select 1 from public.acc_journal
                     where ref_type = 'invoice' and ref_id = new.id and ref_action = 'reverse') then
    select j.id into v_post_id
      from public.acc_journal j
     where j.ref_type = 'invoice' and j.ref_id = new.id and j.ref_action = 'post'
     limit 1;
    select coalesce(jsonb_agg(
             jsonb_build_object('code', l.account_code, 'title', l.account_title,
                                'debit', l.credit, 'credit', l.debit,
                                'partner_id', l.partner_id, 'detail_id', l.detail_id,
                                'cost_center_id', l.cost_center_id, 'project_id', l.project_id,
                                'line_desc', l.line_desc)
           ), '[]'::jsonb)
      into v_lines
      from public.acc_journal_lines l
     where l.entry_id = v_post_id;
    if coalesce(jsonb_array_length(v_lines), 0) > 0 and v_post_id is not null then
      perform public.acc_post_journal(new.business_id, current_date, 'invoice', 'reverse', new.id,
        'ابطال صورتحساب شماره ' || new.number, v_lines, v_post_id);
    end if;
  end if;
  return new;
end $function$;

-- ─── هزینه: wrapper نازک (حذف منطق دوبل) ───
create or replace function public.acc_expense_mirror()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'DELETE' then
    delete from public.acc_journal where ref_type = 'expense' and ref_id = old.id;
    return old;
  end if;
  if new.voided_at is null then
    perform public.acc_post_document('expense', new.id);
  end if;
  return new;
end $function$;

-- ─── دریافت/پرداخت/انتقال: wrapper نازک ───
create or replace function public.acc_transaction_mirror()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'DELETE' then
    delete from public.acc_journal where ref_type = 'transaction' and ref_id = old.id;
    return old;
  end if;
  if new.voided_at is null then
    perform public.acc_post_document('transaction', new.id);
  end if;
  return new;
end $function$;

-- ─── موتور قدیمی acc_mirror_journal منسوخ — حذف کامل (بند ۱۹) ───
drop function if exists public.acc_mirror_journal(uuid, date, text, uuid, text, jsonb);

-- اتصال مجدد تریگرها
drop trigger if exists acc_expense_mirror_tr on public.acc_expenses;
create trigger acc_expense_mirror_tr after insert or delete or update on public.acc_expenses
  for each row execute function public.acc_expense_mirror();

drop trigger if exists acc_transaction_mirror_tr on public.acc_transactions;
create trigger acc_transaction_mirror_tr after insert or delete or update on public.acc_transactions
  for each row execute function public.acc_transaction_mirror();

drop trigger if exists acc_invoice_after_tr on public.acc_invoices;
create trigger acc_invoice_after_tr after insert or update on public.acc_invoices
  for each row execute function public.acc_invoice_after();

-- ═══ §۴) سند دستی v5 — همان اعتبارسنجی v3 + عبور از نویسندهٔ واحد ═══
create or replace function public.acc_create_journal(
  p_business uuid,
  p_date date,
  p_description text,
  p_ref_type text,
  p_ref_action text default 'post',
  p_ref_id uuid default null,
  p_reversal_of uuid default null,
  p_lines jsonb default null,
  p_attachment_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_jyear int;
  v_d bigint := 0;
  v_c bigint := 0;
  v_line jsonb;
  v_debit bigint;
  v_credit bigint;
  v_rows jsonb := '[]'::jsonb;
  v_chart record;
  v_detail record;
begin
  if v_user is null then raise exception 'ابتدا وارد حساب کاربری شوید'; end if;
  if p_ref_type not in ('manual','opening','closing') then
    raise exception 'این نوع سند از مسیر ثبت مستقیم پذیرفته نیست: %', p_ref_type;
  end if;
  if p_ref_type in ('opening','closing') then
    if not public.acc_perm_ok(p_business, 'fiscal.close') then
      raise exception 'اجازهٔ بستن/افتتاح دورهٔ مالی را ندارید';
    end if;
  elsif not public.acc_perm_ok(p_business, 'journal.manage') then
    raise exception 'اجازهٔ ثبت سند در این کسب‌وکار را ندارید';
  end if;
  if p_ref_action not in ('post','reverse') then
    raise exception 'عمل سند نامعتبر است: %', p_ref_action;
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'سند بدون ردیف مجاز نیست';
  end if;
  if p_date is null then raise exception 'تاریخ سند الزامی است'; end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_debit := coalesce(nullif(v_line ->> 'debit', '')::bigint, 0);
    v_credit := coalesce(nullif(v_line ->> 'credit', '')::bigint, 0);
    if coalesce(v_line ->> 'account_code', '') = '' then
      raise exception 'هر ردیف سند باید سرفصل (account_code) داشته باشد';
    end if;
    if v_debit < 0 or v_credit < 0 then
      raise exception 'مبلغ منفی در ردیف سند مجاز نیست';
    end if;
    if v_debit > 0 and v_credit > 0 then
      raise exception 'یک ردیف نمی‌تواند هم‌زمان بدهکار و بستانکار باشد (%)', v_line ->> 'account_code';
    end if;
    if v_debit = 0 and v_credit = 0 then continue; end if;

    select * into v_chart from public.acc_chart
     where code = v_line ->> 'account_code'
       and (business_id = p_business or business_id is null)
     order by business_id nulls last
     limit 1;
    if v_chart is null then
      raise exception 'حساب «%» در کدینگ حسابداری وجود ندارد', v_line ->> 'account_code';
    end if;
    if v_chart.active is not null and v_chart.active = false then
      raise exception 'حساب «% — %» غیرفعال است؛ سند روی حساب غیرفعال مجاز نیست', v_chart.code, v_chart.title;
    end if;

    if nullif(v_line ->> 'detail_id', '') is not null then
      select * into v_detail from public.acc_details where id = (v_line ->> 'detail_id')::uuid;
      if v_detail is null then
        raise exception 'تفصیلی ردیف سند یافت نشد';
      end if;
      if v_detail.business_id <> p_business then
        raise exception 'تفصیلی «%» متعلق به این کسب‌وکار نیست', v_detail.title;
      end if;
      if v_detail.active = false then
        raise exception 'تفصیلی «%» غیرفعال است', v_detail.title;
      end if;
      if v_chart.allowed_detail_types is not null and array_length(v_chart.allowed_detail_types, 1) > 0
         and not (v_detail.kind = any (v_chart.allowed_detail_types)) then
        raise exception 'تفصیلی از نوع «%» برای حساب «%» مجاز نیست (انواع مجاز: %)',
          v_detail.kind, v_chart.code, array_to_string(v_chart.allowed_detail_types, '، ');
      end if;
    elsif v_chart.requires_detail and p_ref_type not in ('opening','closing') then
      raise exception 'حساب «% — %» به تفصیلی نیاز دارد (انواع مجاز: %)',
        v_chart.code, v_chart.title, array_to_string(v_chart.allowed_detail_types, '، ');
    end if;

    if nullif(v_line ->> 'cost_center_id', '') is not null then
      if not exists (select 1 from public.acc_cost_centers c
                      where c.id = (v_line ->> 'cost_center_id')::uuid
                        and c.business_id = p_business) then
        raise exception 'مرکز هزینهٔ ردیف سند متعلق به این کسب‌وکار نیست';
      end if;
    end if;
    if nullif(v_line ->> 'project_id', '') is not null then
      if not exists (select 1 from public.acc_projects pr
                      where pr.id = (v_line ->> 'project_id')::uuid
                        and pr.business_id = p_business) then
        raise exception 'پروژهٔ ردیف سند متعلق به این کسب‌وکار نیست';
      end if;
    end if;
    if nullif(v_line ->> 'partner_id', '') is not null then
      if not exists (select 1 from public.acc_partners p
                      where p.id = (v_line ->> 'partner_id')::uuid
                        and p.business_id = p_business) then
        raise exception 'طرف‌حساب ردیف سند متعلق به این کسب‌وکار نیست';
      end if;
    end if;

    v_d := v_d + v_debit;
    v_c := v_c + v_credit;
    v_rows := v_rows || jsonb_build_object(
      'account_code', v_chart.code,
      'account_title', coalesce(nullif(v_line ->> 'account_title', ''), v_chart.title),
      'debit', v_debit, 'credit', v_credit,
      'detail_id', nullif(v_line ->> 'detail_id', ''),
      'cost_center_id', nullif(v_line ->> 'cost_center_id', ''),
      'project_id', nullif(v_line ->> 'project_id', ''),
      'line_desc', nullif(v_line ->> 'line_desc', ''),
      'partner_id', nullif(v_line ->> 'partner_id', '')
    );
  end loop;

  if v_rows = '[]'::jsonb then raise exception 'ردیف مؤثری در سند وجود ندارد'; end if;
  if v_d <> v_c then
    raise exception 'سند تراز نیست — جمع بدهکار % و بستانکار % باید برابر شود', v_d, v_c;
  end if;
  if v_d <= 0 then raise exception 'جمع سند باید بزرگ‌تر از صفر باشد'; end if;

  -- نویسندهٔ واحد (شماره‌گذاری اتمیک + قفل مشورتی — بدون حلقهٔ retry)
  v_id := public.acc_post_journal(p_business, p_date, p_ref_type, p_ref_action, p_ref_id,
           coalesce(nullif(p_description, ''), 'سند دستی'), v_rows, p_reversal_of);
  -- اتصال سند افتتاحیه دستی به سال مالی خودش (جایگزین UPDATE مستقیم client که با
  -- قفل مسیر مستقیم ممکن نیست) — idempotent و در همان تراکنش
  if v_id is not null and p_ref_type = 'opening' then
    select jy into v_jyear from public.acc_date_to_jalali(p_date);
    insert into public.acc_fiscal_years (business_id, jyear, status, opening_entry_id)
    values (p_business, v_jyear, 'open', v_id)
    on conflict (business_id, jyear) do update
      set opening_entry_id = excluded.opening_entry_id;
  end if;
  if v_id is not null and coalesce(p_attachment_url, '') <> '' then
    update public.acc_journal set attachment_url = p_attachment_url where id = v_id;
  end if;
  return v_id;
end $$;

-- ═══ §۵) برگشت سند v2 — از نویسندهٔ واحد + اتصال reversal_of ═══
create or replace function public.acc_void_journal_internal(p_business uuid, p_entry uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public as $$
declare
  v_e public.acc_journal%rowtype;
  v_rev_id uuid;
  v_lines jsonb := '[]'::jsonb;
  v_l record;
begin
  select * into v_e from public.acc_journal where id = p_entry for update;
  if not found then raise exception 'سند یافت نشد'; end if;
  if v_e.voided_at is not null then raise exception 'این سند قبلاً باطل شده است'; end if;
  if v_e.ref_action = 'reverse' then raise exception 'سند معکوس قابل ابطال نیست'; end if;
  for v_l in select * from public.acc_journal_lines where entry_id = p_entry loop
    v_lines := v_lines || jsonb_build_object(
      'code', v_l.account_code, 'title', v_l.account_title,
      'debit', v_l.credit, 'credit', v_l.debit,
      'detail_id', v_l.detail_id, 'cost_center_id', v_l.cost_center_id,
      'project_id', v_l.project_id,
      'line_desc', case when v_l.line_desc is not null then 'برگشت: ' || v_l.line_desc else null end,
      'partner_id', v_l.partner_id
    );
  end loop;
  if v_lines = '[]'::jsonb then raise exception 'سند بدون ردیف'; end if;
  v_rev_id := public.acc_post_journal(p_business, current_date, v_e.ref_type, 'reverse', v_e.ref_id,
    'برگشت سند ' || coalesce(v_e.description, '') || coalesce(' — علت: ' || nullif(p_reason, ''), ''),
    v_lines, p_entry);
  update public.acc_journal set voided_at = now(), void_reason = nullif(p_reason, '') where id = p_entry;
  return v_rev_id;
end $$;

-- ═══ §۶) صدور فاکتور v2 — وضعیت + کسر موجودی + موتور واحد (بند ۱۴) ═══
create or replace function public.acc_issue_invoice(p_invoice uuid)
returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_inv public.acc_invoices%rowtype;
  v_journal uuid;
begin
  if v_user is null then raise exception 'ابتدا وارد حساب کاربری شوید'; end if;
  select * into v_inv from public.acc_invoices where id = p_invoice for update;
  if not found then raise exception 'فاکتور یافت نشد'; end if;
  if not public.acc_perm_ok(v_inv.business_id, 'invoices.issue') then
    raise exception 'اجازهٔ صدور صورتحساب را ندارید';
  end if;
  if v_inv.voided_at is not null or v_inv.status = 'cancelled' then
    raise exception 'فاکتور ابطال‌شده قابل صدور مجدد نیست';
  end if;
  if v_inv.posted_at is not null then
    raise exception 'این فاکتور قبلاً صادر شده است';
  end if;
  if v_inv.type = 'proforma' then
    raise exception 'پیش‌فاکتور استعلام قیمت است و «صادر» نمی‌شود';
  end if;

  update public.acc_invoices set status = 'issued' where id = p_invoice; -- تریگر posted_at را مهر می‌زند

  -- کسر/بازگشت موجودی (یک UPDATE اتمیک): فروش → کسر | برگشت فروش → افزودن
  if v_inv.type = 'sale' then
    update public.acc_items i
       set stock = coalesce(i.stock, 0) - ii.quantity
      from public.acc_invoice_items ii
     where ii.invoice_id = p_invoice and ii.item_id = i.id and i.track_stock;
  elsif v_inv.type = 'return_sale' then
    update public.acc_items i
       set stock = coalesce(i.stock, 0) + ii.quantity
      from public.acc_invoice_items ii
     where ii.invoice_id = p_invoice and ii.item_id = i.id and i.track_stock;
  end if;

  v_journal := public.acc_post_document('invoice', p_invoice);
  if v_journal is null then
    raise exception 'سند حسابداری برای این فاکتور ساخته نشد — طرف‌حساب یا حساب نقدی را بررسی کنید';
  end if;

  return jsonb_build_object('invoice_id', p_invoice, 'journal_id', v_journal);
end $$;

grant execute on function public.acc_issue_invoice(uuid) to authenticated;
revoke all on function public.acc_issue_invoice(uuid) from public, anon;

-- ═══ §۷) acc_ensure_chart v2 — هیچ «معینِ بی‌والدِ سطح‌۱» نمی‌سازد (بند ۹) ═══
create or replace function public.acc_ensure_chart(p_business uuid, p_code text, p_title text, p_kind text)
returns void
language plpgsql
security definer
set search_path = public as $$
declare
  v_base     public.acc_chart%rowtype;
  v_parent   public.acc_chart%rowtype;
  v_id       uuid;
  v_nature   text;
  v_req      boolean;
  v_allowed  text[];
  v_title    text;
  v_kind     text;
begin
  if p_business is null or coalesce(p_code, '') = '' then
    raise exception 'acc_ensure_chart: کسب‌وکار یا کد حساب نامعتبر است';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('acc_chart:' || p_business::text, 0));

  select * into v_base
    from public.acc_chart
   where business_id is null and code = p_code
   limit 1;

  v_title   := coalesce(nullif(v_base.title, ''), nullif(p_title, ''), p_code);
  v_kind    := coalesce(nullif(v_base.kind, ''), nullif(p_kind, ''), 'asset');
  v_nature  := coalesce(nullif(v_base.nature, ''),
                        case when v_kind in ('liability','equity','income') then 'credit' else 'debit' end);
  v_req     := coalesce(v_base.requires_detail, false);
  v_allowed := coalesce(v_base.allowed_detail_types, '{}'::text[]);

  select id into v_id
    from public.acc_chart
   where business_id = p_business and code = p_code
   limit 1;

  if v_id is null then
    select * into v_parent
      from public.acc_chart p
     where p.business_id = p_business
       and length(p.code) in (1, 2)
       and length(p.code) < length(p_code)
       and p.code = left(p_code, length(p.code))
     order by length(p.code) desc
     limit 1;

    if v_parent.id is null and length(p_code) > 2 then
      raise exception
        'acc_ensure_chart: کد «%» نه در کدینگ پایه تعریف است و نه والدی دارد — ساختن حساب معین بی‌والد ممنوع است؛ ابتدا کد را به کدینگ پایه اضافه کنید', p_code;
    end if;

    insert into public.acc_chart
      (business_id, code, title, kind, is_system, level, is_leaf, nature, active,
       requires_detail, allowed_detail_types, parent_id)
    values
      (p_business, p_code, v_title, v_kind, false,
       coalesce(v_parent.level, 0) + 1, true, v_nature, true,
       v_req, v_allowed, v_parent.id)
    on conflict (business_id, code) do nothing
    returning id into v_id;

    if v_id is null then
      select id into v_id from public.acc_chart
       where business_id = p_business and code = p_code limit 1;
    end if;

    if v_parent.id is not null then
      update public.acc_chart set is_leaf = false
       where id = v_parent.id and is_leaf;
    end if;
  else
    update public.acc_chart
       set requires_detail = v_req,
           allowed_detail_types = v_allowed,
           nature = v_nature
     where id = v_id
       and (requires_detail is distinct from v_req
         or allowed_detail_types is distinct from v_allowed
         or nature is distinct from v_nature);
  end if;
end $$;

revoke all on function public.acc_ensure_chart(uuid, text, text, text) from public, anon, authenticated;

-- ═══ §۸) acc_ensure_detail v2 کانونیکال — اتمیک/ایزوله/بدون Duplicate (بند ۸) ═══
-- نسخه‌های قبلی با نام پارامتر متفاوت نصب شده‌اند؛ برای تعویض امضای تمیز، اول حذف
drop function if exists public.acc_ensure_detail(uuid, text, text, uuid);
create or replace function public.acc_ensure_detail(
  p_business uuid, p_kind text, p_title text, p_ref_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public as $$
declare
  v_id uuid;
  v_code text;
begin
  if p_business is null then raise exception 'کسب‌وکار نامعتبر است'; end if;
  if p_kind not in ('customer','supplier','shareholder','employee','bank','cash','project','cost_center','partner','other') then
    raise exception 'نوع تفصیلی نامعتبر است: %', p_kind;
  end if;
  if coalesce(p_title, '') = '' then
    raise exception 'عنوان تفصیلی الزامی است';
  end if;
  -- Business Isolation: فقط فراخوان مستقیم کاربر اپ (authenticated) مشمول بررسی عضویت است؛
  -- مسیرهای سیستمی (تریگرهای definer/SQL Editor/service_role) آزادند — همان قرارداد گاردها
  if current_user = 'authenticated'
     and not coalesce(public.acc_is_member(p_business), false) then
    raise exception 'به این کسب‌وکار دسترسی ندارید';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('acc_detail:' || p_business::text || ':' || p_kind || ':' || p_title, 0));

  -- ۱) اول بر اساس موجودیتِ متصل (پیوند ref_id منبع یگانهٔ هویت است)
  if p_ref_id is not null then
    select id into v_id from public.acc_details
     where business_id = p_business and kind = p_kind and ref_id = p_ref_id
     order by created_at limit 1;
  end if;
  -- ۲) وگرنه بر اساس عنوان
  if v_id is null then
    select id into v_id from public.acc_details
     where business_id = p_business and kind = p_kind and title = p_title
     order by created_at limit 1;
  end if;
  -- ۳) وگرنه ساخت — کد از شمارندهٔ اتمیک (تریگر موجود) یا here؛ race با قفل مشورتی بسته است
  if v_id is null then
    -- detail_code توسط تریگر کانونیکال از شمارندهٔ اتمیک ساخته می‌شود
    insert into public.acc_details (business_id, kind, title, ref_id, active)
    values (p_business, p_kind, p_title, p_ref_id, true)
    on conflict do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from public.acc_details
       where business_id = p_business and kind = p_kind
         and ((p_ref_id is not null and ref_id = p_ref_id) or title = p_title)
       order by created_at limit 1;
    end if;
  end if;
  -- fallback کد تفصیلی اگر تریگر کدنویس نصب نباشد
  update public.acc_details
     set detail_code = 'D-' || upper(substr(md5(id::text), 1, 8))
   where id = v_id and detail_code is null;
  return v_id;
end $$;

revoke all on function public.acc_ensure_detail(uuid, text, text, uuid) from public, anon;
grant execute on function public.acc_ensure_detail(uuid, text, text, uuid) to authenticated;

-- ═══ §۹) گاردهای چرخهٔ عمر (بند ۱۴/۱۵) ═══

-- ۹.۱) چرخهٔ وضعیت فاکتور در DB: regress ممنوع، دوبار ابطال ممنوع، ویرایش سندخورده ممنوع
create or replace function public.acc_invoice_lifecycle_guard()
returns trigger
language plpgsql
security definer
set search_path = public as $$
declare
  v_posted boolean := old.posted_at is not null;
begin
  if tg_op = 'UPDATE' then
    -- regress وضعیت: cancelled/issued هرگز به draft برنمی‌گردند؛ cancelled تغییر نمی‌کند
    if old.status = 'cancelled' and new.status <> 'cancelled' then
      raise exception 'فاکتور ابطال‌شده تغییر وضعیت نمی‌پذیرد (Re-Issue مجاز نیست — فاکتور جدید صادر کنید)';
    end if;
    if old.status in ('issued','partial','paid') and new.status = 'draft' then
      raise exception 'فاکتور صادرشده به پیش‌نویس برنمی‌گردد — برای ابطال از «ابطال» استفاده کنید';
    end if;
    if old.voided_at is not null and (new.status <> 'cancelled' or new.voided_at is null) then
      raise exception 'فاکتور ابطال‌شده قابل بازگشت نیست';
    end if;
    -- ویرایش مالی سند صادرشده ممنوع (تغییر مبالغ/تاریخ/طرف‌حساب/نوع)
    if v_posted and (
         coalesce(new.subtotal,0) <> coalesce(old.subtotal,0)
      or coalesce(new.discount_total,0) <> coalesce(old.discount_total,0)
      or coalesce(new.vat_total,0) <> coalesce(old.vat_total,0)
      or coalesce(new.total,0) <> coalesce(old.total,0)
      or new.date_g is distinct from old.date_g
      or new.type is distinct from old.type
      or new.partner_id is distinct from old.partner_id
    ) then
      raise exception 'فاکتور صادرشده (سندخورده) قابل ویرایش مستقیم نیست — ابطال و صدور فاکتور جدید';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists acc_invoice_lifecycle_guard_tr on public.acc_invoices;
create trigger acc_invoice_lifecycle_guard_tr
  before update of status, voided_at, subtotal, discount_total, vat_total, total, date_g, type, partner_id
  on public.acc_invoices
  for each row execute function public.acc_invoice_lifecycle_guard();

-- ۹.۲) ویرایش مالی هزینهٔ سندخورده ممنوع (وگرنه سند و رکورد از هم می‌پاشند)
create or replace function public.acc_expense_posted_guard()
returns trigger
language plpgsql
security definer
set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.voided_at is null and new.voided_at is null
     and exists (select 1 from public.acc_journal j
                  where j.ref_type = 'expense' and j.ref_id = new.id and j.ref_action = 'post')
     and (
       coalesce(new.amount,0) <> coalesce(old.amount,0)
       or coalesce(new.vat_amount,0) <> coalesce(old.vat_amount,0)
       or new.date_g is distinct from old.date_g
       or new.category is distinct from old.category
       or new.account_id is distinct from old.account_id
       or new.expense_account_id is distinct from old.expense_account_id
       or new.partner_id is distinct from old.partner_id
       or new.detail_id is distinct from old.detail_id
       or new.cost_center_id is distinct from old.cost_center_id
       or new.project_id is distinct from old.project_id
       or new.paid_by_kind is distinct from old.paid_by_kind
       or new.paid_by_detail_id is distinct from old.paid_by_detail_id
     ) then
    raise exception 'هزینهٔ سندخورده قابل ویرایش نیست — ابتدا سند را ابطال کنید، سپس ویرایش و صدور مجدد';
  end if;
  return new;
end $$;

drop trigger if exists acc_expense_posted_guard_tr on public.acc_expenses;
create trigger acc_expense_posted_guard_tr
  before update on public.acc_expenses
  for each row execute function public.acc_expense_posted_guard();

-- ۹.۳) ویرایش مالی دریافت/پرداخت سندخورده ممنوع
create or replace function public.acc_transaction_posted_guard()
returns trigger
language plpgsql
security definer
set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.voided_at is null and new.voided_at is null
     and exists (select 1 from public.acc_journal j
                  where j.ref_type = 'transaction' and j.ref_id = new.id and j.ref_action = 'post')
     and (
       coalesce(new.amount,0) <> coalesce(old.amount,0)
       or new.date_g is distinct from old.date_g
       or new.kind is distinct from old.kind
       or new.account_id is distinct from old.account_id
       or new.to_account_id is distinct from old.to_account_id
       or new.partner_id is distinct from old.partner_id
       or new.invoice_id is distinct from old.invoice_id
     ) then
    raise exception 'دریافت/پرداخت سندخورده قابل ویرایش نیست — ابتدا ابطال کنید';
  end if;
  return new;
end $$;

drop trigger if exists acc_transaction_posted_guard_tr on public.acc_transactions;
create trigger acc_transaction_posted_guard_tr
  before update on public.acc_transactions
  for each row execute function public.acc_transaction_posted_guard();

-- ۹.۴) System Journal فقط Void — حذف مستقیم ممنوع (بند ۱۵)
-- قرارداد گارد موجود حفظ می‌شود: مسیرهای سیستمی (SQL Editor/definer/service_role)
-- آزادند (ابزار پاک‌سازی و RPCها کار می‌کنند)؛ فقط کاربر اپ (authenticated) مشمول قفل است.
create or replace function public.acc_journal_delete_guard()
returns trigger
language plpgsql
security definer
set search_path = public as $$
begin
  if current_user <> 'authenticated' then return old; end if;
  -- cascade (حذف کل کسب‌وکار/موجودیت والد) مجاز است
  if pg_trigger_depth() > 1 then return old; end if;
  if old.ref_type <> 'manual' then
    raise exception 'سند سیستمی (%) با حذف مستقیم پاک نمی‌شود — از ابطال (Void/Reverse) استفاده کنید', old.ref_type;
  end if;
  if old.ref_action = 'reverse' then
    raise exception 'سند معکوس بخشی از تاریخچهٔ ابطال است و حذف نمی‌شود';
  end if;
  if old.voided_at is not null then
    raise exception 'سند باطل‌شده بخشی از تاریخچهٔ حسابداری است و حذف نمی‌شود';
  end if;
  return old;
end $$;

drop trigger if exists acc_journal_delete_guard_tr on public.acc_journal;
create trigger acc_journal_delete_guard_tr
  before delete on public.acc_journal
  for each row execute function public.acc_journal_delete_guard();

-- ═══ §۱۰) خودتشخیصی ═══
do $$
declare n int; begin
  select count(*) into n from pg_proc p
   join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public' and p.proname = 'acc_post_journal';
  raise notice 'POSTCHECK نویسندهٔ واحد acc_post_journal: % (انتظار: 1)', n;

  select count(*) into n from pg_proc p
   join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public' and p.proname = 'acc_mirror_journal';
  raise notice 'POSTCHECK موتور قدیمی acc_mirror_journal (باید حذف شده باشد): % (انتظار: 0)', n;

  select count(*) into n
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where c.relname in ('acc_expenses','acc_transactions','acc_invoices')
     and t.tgname in ('acc_expense_mirror_tr','acc_transaction_mirror_tr','acc_invoice_after_tr')
     and not t.tgisinternal;
  raise notice 'POSTCHECK تریگرهای آینهٔ متصل: % (انتظار: 3)', n;

  select count(*) into n from public.acc_chart
   where business_id is null and code in ('5101','2112');
  raise notice 'POSTCHECK حساب‌های جدید 5101/2112 در کدینگ پایه: % (انتظار: 2)', n;

  select count(*) into n from public.acc_entry_counters;
  raise notice 'POSTCHECK جدول شمارندهٔ اسناد (§۰.۳): % کسب‌وکار (انتظار: ≥0)', n;
end $$;
