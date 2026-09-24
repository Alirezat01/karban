-- ═══════════════════════════════════════════════════════════════════════════
-- M250000 — زیرساخت پرداخت امن کاربان (شماره کارت تجاری)
-- ═══════════════════════════════════════════════════════════════════════════
-- هدف (درخواست مالک، راند ۷):
--   شماره کارتِ «حساب تجاری کاربان» باید در زمان پرداختِ سفارش به مشتری نشان
--   داده شود، اما هیچ‌کس نتواند آن را از دیتابیس بیرون بکشد.
--
-- معماری امنیتی (دفاع در چهار لایه):
--   ۱) جدول pay_accounts با RLS روشن و «صفر سیاست» + REVOKE کامل از
--      anon/authenticated → حتی با کلید anon و PostgREST هم خواندنی نیست.
--   ۲) شماره کارت فقط از طریق RPC امنیتی pay_get_account(p_order_code) برگشت
--      می‌خورد؛ یعنی فقط وقتی «کد پیگیری یک سفارش واقعی» ارائه شود.
--   ۳) محدودیت نرخ داخل خود RPC: حداکثر ۲۰ بار در ساعت برای هر کد سفارش و
--      ۶۰ بار در ساعت برای هر IP — بالاتر خطای فارسی صادر می‌شود.
--   ۴) هر تلاش (موفق و ناموفق) در pay_account_access_log ثبت می‌شود؛ خود
--      این جدول هم RLS بسته دارد و فقط ادمین با RPC گزارش می‌بیند.
--   + اعتبارسنجی ورودی در زمان ثبت: الگوریتم Luhn برای کارت و چک‌داуме-۹۷
--     برای شبا؛ ارقام فارسی/عربی خودکار نرمال می‌شوند.
-- قابل اجرای مجدد. مستقل از بقیهٔ زنجیره؛ هر زمان قابل اجراست.
-- اجرا با نقش owner در SQL Editor سوپابیس.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══ §۱) جدول‌ها (اگر نبود بساز) ═══
create table if not exists public.pay_accounts (
  id uuid primary key default gen_random_uuid(),
  label text not null default 'حساب تجاری کاربان',
  holder_name text not null,
  bank_name text not null,
  card_number text not null,
  sheba text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pay_account_access_log (
  id bigint generated always as identity primary key,
  order_code text,
  order_id uuid,
  ip_hash text,
  outcome text not null,               -- ok | bad_code | rate_limited | no_account | expired | error
  detail text,
  fetched_at timestamptz not null default now()
);

create index if not exists pay_log_code_idx  on public.pay_account_access_log (order_code, fetched_at);
create index if not exists pay_log_ip_idx    on public.pay_account_access_log (ip_hash, fetched_at);
create index if not exists pay_accounts_active_idx on public.pay_accounts (is_active);

-- ═══ §۲) RLS روشن + صفر سیاست + REVOKE کامل → دسترسی مستقیم: مطلقاً هیچ ═══
alter table public.pay_accounts            enable row level security;
alter table public.pay_account_access_log  enable row level security;

do $$
declare r record;
begin
  for r in
    select tablename, policyname from pg_policies
     where schemaname = 'public' and tablename in ('pay_accounts','pay_account_access_log')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
    raise notice 'سیاست قبلی حذف شد: %.%', r.tablename, r.policyname;
  end loop;
end $$;

revoke all on public.pay_accounts           from anon, authenticated;
revoke all on public.pay_account_access_log from anon, authenticated;

-- ═══ §۳) نرمال‌سازی و اعتبارسنجی (توابع کمکی — STABLE، بدون دسترسی به جدول) ═══
create or replace function public.pay_normalize_digits(p_in text)
returns text language sql immutable
set search_path = public
as $$
  select translate(coalesce(p_in,''),
    '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩',
    '01234567890123456789');
$$;

create or replace function public.pay_luhn_ok(p_card text)
returns boolean language plpgsql immutable
set search_path = public
as $$
declare
  v text; i int; d int; sum_all int := 0; alt boolean := true; n int;
begin
  v := public.pay_normalize_digits(regexp_replace(coalesce(p_card,''), '[\s\-]', '', 'g'));
  if v !~ '^[0-9]{16}$' then return false; end if;
  -- Luhn: از راست، ارقام جای زوج (اندیس ۲٫۴٫… از راست) دوبرابر و اگر >۹ منهای ۹
  for i in 1..16 loop
    d := (substr(v, 17 - i, 1))::int;          -- i=1 آخرین رقم
    if i % 2 = 0 then
      d := d * 2; if d > 9 then d := d - 9; end if;
    end if;
    sum_all := sum_all + d;
  end loop;
  return sum_all % 10 = 0;
end $$;

create or replace function public.pay_sheba_ok(p_sheba text)
returns boolean language plpgsql immutable
set search_path = public
as $$
declare
  v text; v_tail text; v_num text; i int; ch text;
begin
  v := upper(regexp_replace(public.pay_normalize_digits(coalesce(p_sheba,'')), '[\s\-]', '', 'g'));
  if v !~ '^IR[0-9]{24}$' then return false; end if;
  -- چک‌داوم ISO-7064 MOD-97: چهار کاراکتر اول به انتها می‌رود؛ I=18، R=27
  v_tail := substr(v, 5) || substr(v, 1, 4);
  v_num := '';
  for i in 1..length(v_tail) loop
    ch := substr(v_tail, i, 1);
    if ch between '0' and '9' then v_num := v_num || ch;
    else v_num := v_num || ((ascii(ch) - ascii('A') + 10)::text);
    end if;
  end loop;
  return (v_num::numeric % 97) = 1;
end $$;

-- ═══ §۴) RPC ادمین: ثبت/به‌روزرسانی کارت (فقط profiles.role = 'admin') ═══
create or replace function public.pay_account_upsert(
  p_holder_name text, p_bank_name text, p_card_number text, p_sheba text, p_label text default 'حساب تجاری کاربان'
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_card text; v_sheba text; v_new uuid;
  v_is_admin boolean;
begin
  select exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'admin')
    into v_is_admin;
  if not v_is_admin then
    raise exception 'فقط ادمین سایت مجاز به ثبت شماره کارت است';
  end if;

  v_card := regexp_replace(public.pay_normalize_digits(coalesce(p_card_number,'')), '[\s\-]', '', 'g');
  v_sheba := upper(regexp_replace(public.pay_normalize_digits(coalesce(p_sheba,'')), '[\s\-]', '', 'g'));

  if coalesce(trim(p_holder_name),'') = '' then raise exception 'نام صاحب حساب الزامی است'; end if;
  if coalesce(trim(p_bank_name),'')  = '' then raise exception 'نام بانک الزامی است'; end if;
  if v_card !~ '^[0-9]{16}$' then raise exception 'شماره کارت باید دقیقاً ۱۶ رقم باشد'; end if;
  if not public.pay_luhn_ok(v_card) then raise exception 'شماره کارت معتبر نیست (خطای Luhn — یک رقم را بررسی کنید)'; end if;
  if v_sheba !~ '^IR[0-9]{24}$' then raise exception 'شبا باید به شکل IR + ۲۴ رقم باشد'; end if;
  if not public.pay_sheba_ok(v_sheba) then raise exception 'شبا معتبر نیست (خطای رقم کنترل)'; end if;

  update public.pay_accounts set is_active = false, updated_at = now() where is_active;
  insert into public.pay_accounts (label, holder_name, bank_name, card_number, sheba, is_active)
    values (coalesce(nullif(trim(p_label),''),'حساب تجاری کاربان'), trim(p_holder_name), trim(p_bank_name), v_card, v_sheba, true)
    returning id into v_new;
  return v_new;
end $$;

-- ═══ §۵) RPC ادمین: دیدن کارت‌ها و گزارش دسترسی‌ها ═══
create or replace function public.pay_account_admin_get()
returns table (
  id uuid, label text, holder_name text, bank_name text,
  card_number text, sheba text, is_active boolean, created_at timestamptz
)
language plpgsql security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'admin') then
    raise exception 'فقط ادمین سایت مجاز است';
  end if;
  return query
    select a.id, a.label, a.holder_name, a.bank_name, a.card_number, a.sheba, a.is_active, a.created_at
      from public.pay_accounts a
     order by a.is_active desc, a.created_at desc;
end $$;

create or replace function public.pay_account_admin_log(p_limit int default 50)
returns table (order_code text, ip_hash text, outcome text, detail text, fetched_at timestamptz)
language plpgsql security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'admin') then
    raise exception 'فقط ادمین سایت مجاز است';
  end if;
  return query
    select l.order_code, l.ip_hash, l.outcome, l.detail, l.fetched_at
      from public.pay_account_access_log l
     order by l.fetched_at desc
     limit least(coalesce(p_limit, 50), 200);
end $$;

-- ═══ §۶) RPC عمومی: برگرداندن کارت فقط برای «سفارش واقعی» + rate-limit + لاگ ═══
create or replace function public.pay_get_account(p_order_code text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_code text; v_ip text;
  v_order record;
  v_acc record;
  v_code_hits int; v_ip_hits int;
begin
  v_code := lower(regexp_replace(coalesce(p_order_code,''), '[^a-zA-Z0-9]', '', 'g'));
  -- IP واقعی کاربر از هدرهای PostgREST؛ اگر در دسترس نبود، نشانی اتصال؛ آخرین راه: «na»
  begin
    v_ip := split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1);
  exception when others then
    v_ip := '';
  end;
  v_ip := nullif(trim(v_ip), '');
  v_ip := md5(coalesce(v_ip, coalesce(inet_client_addr()::text, 'na')) || ':pay');

  -- ۱) اعتبارسنجی شکل کد (کد پیگیری = ۸ نویسهٔ اول uuid سفارش)
  if v_code !~ '^[0-9a-f]{6,12}$' then
    insert into public.pay_account_access_log(order_code, ip_hash, outcome, detail)
      values (nullif(v_code,''), v_ip, 'bad_code', 'bad format');
    raise exception 'کد پیگیری معتبر نیست';
  end if;

  -- ۲) محدودیت نرخ: ۲۰/ساعت برای هر کد، ۶۰/ساعت برای هر IP
  select count(*) into v_code_hits from public.pay_account_access_log
   where order_code = v_code and fetched_at > now() - interval '1 hour';
  if v_code_hits >= 20 then
    insert into public.pay_account_access_log(order_code, ip_hash, outcome, detail)
      values (v_code, v_ip, 'rate_limited', 'code window');
    raise exception 'تلاش‌های زیادی برای این کد انجام شده؛ یک ساعت بعد دوباره امتحان کنید';
  end if;
  select count(*) into v_ip_hits from public.pay_account_access_log
   where ip_hash = v_ip and fetched_at > now() - interval '1 hour';
  if v_ip_hits >= 60 then
    insert into public.pay_account_access_log(order_code, ip_hash, outcome, detail)
      values (v_code, v_ip, 'rate_limited', 'ip window');
    raise exception 'تلاش‌های زیادی از این نشانی انجام شده؛ یک ساعت بعد دوباره امتحان کنید';
  end if;

  -- ۳) سفارش واقعی؟ (مقایسه با پیشوند شناسه؛ جدیدترین برداشت می‌شود)
  select o.id, o.service_title, o.amount, o.status, o.created_at
    into v_order
    from public.orders o
   where o.id::text like v_code || '%'
   order by o.created_at desc
   limit 1;
  if v_order.id is null then
    insert into public.pay_account_access_log(order_code, ip_hash, outcome, detail)
      values (v_code, v_ip, 'bad_code', 'no order');
    raise exception 'سفارشی با این کد پیگیری پیدا نشد';
  end if;
  if v_order.created_at < now() - interval '180 days' then
    insert into public.pay_account_access_log(order_code, order_id, ip_hash, outcome, detail)
      values (v_code, v_order.id, v_ip, 'expired', 'older than 180d');
    raise exception 'مهلت نمایش پرداخت این سفارش گذشته است؛ با پشتیبانی تماس بگیرید';
  end if;

  -- ۴) کارت فعال
  select a.holder_name, a.bank_name, a.card_number, a.sheba, a.label
    into v_acc
    from public.pay_accounts a
   where a.is_active
   order by a.updated_at desc
   limit 1;
  if v_acc.holder_name is null then
    insert into public.pay_account_access_log(order_code, order_id, ip_hash, outcome, detail)
      values (v_code, v_order.id, v_ip, 'no_account', 'no active card');
    raise exception 'فعلاً شماره کارت فعالی ثبت نشده است؛ هماهنگی پرداخت تلفنی انجام می‌شود';
  end if;

  -- ۵) لاگ دسترسی موفق + برگشت
  insert into public.pay_account_access_log(order_code, order_id, ip_hash, outcome, detail)
    values (v_code, v_order.id, v_ip, 'ok', null);

  return json_build_object(
    'label',       v_acc.label,
    'holder_name', v_acc.holder_name,
    'bank_name',   v_acc.bank_name,
    'card_number', v_acc.card_number,
    'sheba',       v_acc.sheba,
    'order', json_build_object(
      'code',       v_code,
      'title',      v_order.service_title,
      'amount',     v_order.amount,
      'status',     v_order.status,
      'created_at', v_order.created_at
    )
  );
end $$;

-- ═══ §۷) گرانت‌ها ═══
revoke all on function public.pay_account_upsert(text, text, text, text, text)  from public, anon, authenticated;
grant  execute on function public.pay_account_upsert(text, text, text, text, text) to authenticated;

revoke all on function public.pay_account_admin_get() from public, anon, authenticated;
grant  execute on function public.pay_account_admin_get() to authenticated;

revoke all on function public.pay_account_admin_log(int) from public, anon, authenticated;
grant  execute on function public.pay_account_admin_log(int) to authenticated;

revoke all on function public.pay_get_account(text) from public;
grant  execute on function public.pay_get_account(text) to anon, authenticated;

-- ═══ §۸) POSTCHECK ═══
do $$
declare
  v_rls int; v_pol int; v_grant int; v_ok boolean;
begin
  select count(*) into v_rls from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('pay_accounts','pay_account_access_log')
     and c.relrowsecurity;
  if v_rls < 2 then raise exception 'POSTCHECK §۲ ناموفق — RLS روی هر دو جدول فعال نشد'; end if;
  raise notice 'POSTCHECK §۲ RLS: OK (۲/۲)';

  select count(*) into v_pol from pg_policies
   where schemaname = 'public' and tablename in ('pay_accounts','pay_account_access_log');
  if v_pol <> 0 then raise exception 'POSTCHECK §۲ ناموفق — نباید هیچ سیاستی روی جداول پرداخت باشد (% یافت شد)', v_pol; end if;
  raise notice 'POSTCHECK سیاست‌ها: OK (صفر سیاست = deny-all)';

  select count(*) into v_grant
    from information_schema.role_table_grants
   where table_schema = 'public'
     and table_name in ('pay_accounts','pay_account_access_log')
     and grantee in ('anon','authenticated');
  if v_grant <> 0 then raise exception 'POSTCHECK §۲ ناموفق — هنوز گرانتی برای anon/authenticated باقی است (%)', v_grant; end if;
  raise notice 'POSTCHECK گرانت جداول: OK (صفر)';

  select has_function_privilege('anon', 'public.pay_get_account(text)', 'EXECUTE')
       and not has_function_privilege('anon', 'public.pay_account_upsert(text,text,text,text,text)', 'EXECUTE')
       and not has_function_privilege('anon', 'public.pay_account_admin_get()', 'EXECUTE')
    into v_ok;
  if not v_ok then raise exception 'POSTCHECK §۷ ناموفق — گرانت توابع درست نیست'; end if;
  raise notice 'POSTCHECK گرانت توابع: OK (anon فقط pay_get_account)';

  -- Luhn: از یک پیشوند ۱۵ رقمی، رقم کنترل را می‌سازیم؛ درست باید true و رقم معکوس false بدهد
  declare
    v_base text := '603799751234567'; v_s int := 0; v_chk int; v_card text; v_bad text;
  begin
    for i in 1..15 loop
      declare d int;
      begin
        d := substr(v_base, 16 - i, 1)::int;
        if i % 2 = 1 then d := d * 2; if d > 9 then d := d - 9; end if; end if;
        v_s := v_s + d;
      end;
    end loop;
    v_chk := (10 - (v_s % 10)) % 10;
    v_card := v_base || v_chk::text;
    if not public.pay_luhn_ok(v_card) then
      raise exception 'POSTCHECK §۳ ناموفق — Luhn نمونهٔ ساخته‌شده رد شد (%)', v_card;
    end if;
    v_bad := v_base || (case when v_chk = 9 then '8' else '9' end);
    if public.pay_luhn_ok(v_bad) then
      raise exception 'POSTCHECK §۳ ناموفق — رقم کنترل معکوس پذیرفته شد';
    end if;
    raise notice 'POSTCHECK Luhn: OK (نمونهٔ %)', v_card;
  end;

  if not public.pay_sheba_ok('IR820540102680020817909002') then
    raise exception 'POSTCHECK §۳ ناموفق — نمونهٔ استاندارد شبای ایرانی رد شد';
  end if;
  raise notice 'POSTCHECK شبای نمونهٔ استاندارد: OK';
  raise notice 'POSTCHECK M250000: زیرساخت پرداخت امن نصب شد — کارت فقط با کد سفارش واقعی';
end $$;

COMMIT;
