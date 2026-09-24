-- ═══════════════════════════════════════════════════════════════════════════
-- M4 — چرخهٔ مالی اتمیک (بند ۱۶) + قفل مسیر مستقیم دفتر (بندهای ۶/۱۹)
-- ═══════════════════════════════════════════════════════════════════════════
-- ریشه: بستن/افتتاح سال قبلاً ۳+ فراخوان REST جدا در مرورگر بود (پنجرهٔ رقابت
-- «بستن دوباره» + سند closing یتیم). حالا: دو RPC اتمیک با advisory lock و
-- recheck داخل تراکنش؛ نویسندهٔ ردیف‌ها همان acc_post_journal واحد است.
--
-- ⚠️ ترتیب استقرار: این فایل INSERT/UPDATE مستقیم دفتر را از authenticated
--     می‌گیرد؛ فرانتِ جدید (P1..P8) باید بلافاصله پس از اجرای مایگریشن‌ها
--     دیپلوی شود. نسخهٔ قدیمی فرانت خطای permission شفاف می‌گیرد (نه خرابیِ خاموش).
-- Rollback: grantهای §۳ برعکس revokeهاست؛ توابع DROP می‌شوند.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ §۱) بستن سال مالی — یک تراکنش، بدون پنجرهٔ رقابت ═══
-- گارد واریانت: هر overloadeٔ قدیمی این RPC (پیش‌نویس‌های جلسات قبل) حذف می‌شود
-- تا create or replace قطعی باشد و PostgREST هم با دو نسخهٔ همنام گیج نشود.
do $drop_overloads$
declare r record;
begin
  for r in select p.oid::regprocedure::text as sig
             from pg_proc p
             join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'acc_close_fiscal_year'
  loop
    execute format('drop function if exists public.%s', r.sig);
  end loop;
end
$drop_overloads$;

create or replace function public.acc_close_fiscal_year(
  p_business uuid, p_jyear int, p_date date, p_description text, p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public as $$
declare
  v_user  uuid := auth.uid();
  v_entry uuid;
  v_fy    public.acc_fiscal_years%rowtype;
begin
  if v_user is null then raise exception 'ابتدا وارد حساب کاربری شوید'; end if;
  if not public.acc_perm_ok(p_business, 'fiscal.close') then
    raise exception 'اجازهٔ بستن دورهٔ مالی را ندارید';
  end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'سند اختتامیه بدون ردیف مجاز نیست';
  end if;

  -- قفل منطقی کسب‌وکار: دو بستنِ هم‌زمان سریال می‌شوند
  perform pg_advisory_xact_lock(hashtextextended(p_business::text, 0));

  insert into public.acc_fiscal_years (business_id, jyear, status)
  values (p_business, p_jyear, 'open')
  on conflict (business_id, jyear) do nothing;

  select * into v_fy
    from public.acc_fiscal_years
   where business_id = p_business and jyear = p_jyear
   for update;

  if v_fy.closing_entry_id is not null then
    raise exception 'سند اختتامیهٔ سال % قبلاً صادر شده است — بستن دوبارهٔ دوره مجاز نیست', p_jyear;
  end if;
  if v_fy.status = 'closed' then
    raise exception 'سال مالی % بسته شده است', p_jyear;
  end if;

  -- نویسندهٔ واحد (بند ۶) — شماره‌گذاری از همان شمارندهٔ اصلی
  v_entry := public.acc_post_journal(p_business, p_date, 'closing', 'post', null,
    coalesce(nullif(p_description, ''), 'سند اختتامیهٔ سال ' || p_jyear), p_lines);

  update public.acc_fiscal_years
     set status = 'closed', closing_entry_id = v_entry, closed_at = now()
   where business_id = p_business and jyear = p_jyear;

  -- قفل ۱۲ ماه همان سال — در همان تراکنش
  insert into public.acc_periods (business_id, jyear, jmonth, locked)
  select p_business, p_jyear, m, true from generate_series(1, 12) m
  on conflict (business_id, jyear, jmonth) do update set locked = true;

  return v_entry;
end $$;

-- ═══ §۲) افتتاح سال بعد — یک تراکنش ═══
-- گارد واریانت: هر overloadeٔ قدیمی این RPC (پیش‌نویس‌های جلسات قبل) حذف می‌شود
-- تا create or replace قطعی باشد و PostgREST هم با دو نسخهٔ همنام گیج نشود.
do $drop_overloads$
declare r record;
begin
  for r in select p.oid::regprocedure::text as sig
             from pg_proc p
             join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'acc_open_next_year'
  loop
    execute format('drop function if exists public.%s', r.sig);
  end loop;
end
$drop_overloads$;

create or replace function public.acc_open_next_year(
  p_business uuid, p_jyear int, p_date date, p_description text, p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public as $$
declare
  v_user  uuid := auth.uid();
  v_entry uuid;
  v_fy    public.acc_fiscal_years%rowtype;
begin
  if v_user is null then raise exception 'ابتدا وارد حساب کاربری شوید'; end if;
  if not public.acc_perm_ok(p_business, 'fiscal.close') then
    raise exception 'اجازهٔ افتتاح دورهٔ مالی را ندارید';
  end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'سند افتتاحیه بدون ردیف مجاز نیست';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_business::text, 0));

  insert into public.acc_fiscal_years (business_id, jyear, status)
  values (p_business, p_jyear, 'open')
  on conflict (business_id, jyear) do nothing;

  select * into v_fy
    from public.acc_fiscal_years
   where business_id = p_business and jyear = p_jyear
   for update;

  if v_fy.opening_entry_id is not null then
    raise exception 'سند افتتاحیهٔ سال % قبلاً ثبت شده است', p_jyear;
  end if;
  if v_fy.status = 'closed' then
    raise exception 'سال مالی % بسته است — افتتاحیه روی سال بسته مجاز نیست', p_jyear;
  end if;

  v_entry := public.acc_post_journal(p_business, p_date, 'opening', 'post', null,
    coalesce(nullif(p_description, ''), 'سند افتتاحیهٔ سال ' || p_jyear), p_lines);

  update public.acc_fiscal_years
     set opening_entry_id = v_entry
   where business_id = p_business and jyear = p_jyear;

  return v_entry;
end $$;

-- ═══ §۳) مجوزهای توابع جدید + قفل مسیر مستقیم ═══
grant execute on function public.acc_close_fiscal_year(uuid, int, date, text, jsonb) to authenticated;
grant execute on function public.acc_open_next_year(uuid, int, date, text, jsonb) to authenticated;
revoke all on function public.acc_close_fiscal_year(uuid, int, date, text, jsonb) from public, anon;
revoke all on function public.acc_open_next_year(uuid, int, date, text, jsonb) from public, anon;

-- قفل مسیر مستقیم: از این پس فقط موتور سند (SECURITY DEFINER + گاردها) می‌نویسد.
-- DELETE عمداً باز می‌ماند: حذف سند «دستی» مشروع است (گارد حذف، سیستمی‌ها را
-- مسدود می‌کند) و پاک‌سازی تست از همان مسیر DELETE کار می‌کند.
revoke insert, update on public.acc_journal        from authenticated;
revoke insert, update on public.acc_journal_lines  from authenticated;
revoke insert, update on public.acc_entry_counters from authenticated;
revoke insert, update, delete on public.acc_fiscal_years from authenticated;
revoke insert, update on public.acc_periods        from authenticated;

-- ═══ §۴) Post-check ═══
do $$
declare n int;
begin
  select count(*) into n from pg_proc p
   join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public' and p.proname in ('acc_close_fiscal_year','acc_open_next_year');
  raise notice 'POSTCHECK توابع fiscal RPC: % (انتظار: 2)', n;

  select count(*) into n from information_schema.role_table_grants
  where table_schema='public' and table_name='acc_journal'
    and grantee='authenticated' and privilege_type in ('INSERT','UPDATE');
  raise notice 'POSTCHECK گرنت مستقیم INSERT/UPDATE روی acc_journal برای authenticated: % (انتظار: 0)', n;
end $$;
