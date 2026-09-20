-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  کاربان — سخت‌سازی هستهٔ حسابداری (acc core hardening)                 ║
-- ║  نسخه: 2026-09-20 · فایل: 20260920120000_acc_core_hardening.sql       ║
-- ║                                                                        ║
-- ║  روش اجرا: Supabase Dashboard → SQL Editor → Paste کل فایل → Run      ║
-- ║  فایل idempotent است (اجرای مجدد بی‌ضرر) و Backward-compatible.        ║
-- ║                                                                        ║
-- ║  محتوا:                                                                ║
-- ║   §0  توابع کمکی نقش/مجوز (enforce در دیتابیس)                        ║
-- ║   §1  شماره‌گذاری اتمیک اسناد (کنترل‌ر + قید یگانی) — رفع Race          ║
-- ║   §2  تقویم جلالی در SQL (برای نگهبان دورهٔ مالی)                     ║
-- ║   §3  نگهبان دورهٔ مالی بسته / ماه قفل / اختتامیه و افتتاحیه تکراری   ║
-- ║   §4  قفل حذف سند قطعی (DELETE trigger)                                ║
-- ║   §5  قفل ردیف‌های سند سیستمی/باطل‌شده                                 ║
-- ║   §6  کنترل تراز سند در دیتابیس (SUM(debit)=SUM(credit))               ║
-- ║   §7  CHECK مبلغ‌های منفی/دوتایی ردیف                                  ║
-- ║   §8  RPCهای اتمیک: ثبت سند، ابطال سند، ابطال فاکتور، موجودی، ضمیمه   ║
-- ║   §9  ثبت سند آینه‌ای فاکتور/هزینه/تراکنش (idempotent)                 ║
-- ║   §10 پالیسی‌های RLS با مجوز ریزدانه (viewer ممنوعِ نوشتن)             ║
-- ║   §11 قفل حذف فاکتور صادره                                              ║
-- ║   §12 باکت خصوصی ضمائم مالی + پالیسی‌های Storage                       ║
-- ║   §13 رفع ناسازگاری CHECK مغایرت بانکی (needs_doc/ignored)             ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ══════════════════════ §0 توابع کمکی نقش/مجوز ══════════════════════
-- نکته: بدنهٔ acc_is_admin/acc_member_role در مایگریشن‌های ریپو موجود نیست؛
-- برای استقلال از آن‌ها، کمکی‌های مستقل با نام جدید ساخته می‌شود.

create or replace function public.acc_sys_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.acc_role_of(p_business uuid)
returns text
language sql stable security definer set search_path = public as $$
  select a.role from public.acc_access a
  where a.business_id = p_business
    and a.user_id = auth.uid()
    and a.status in ('active','trial')
    and (a.expires_at is null or a.expires_at > now())
  limit 1;
$$;

create or replace function public.acc_is_member(p_business uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.acc_role_of(p_business) is not null;
$$;

-- مجوز ریزدانه — سازگار با مدل UI (api7.ts PERM_KEYS):
--  · مالک و ادمین سیستم: همیشه مجاز
--  · اگر perms jsonb خالی باشد (بدون پیکربندی): رفتار قدیم حفظ می‌شود (حسابدار کامل)
--  · بعد از اولین پیکربندی مجوزها، مدل سخت می‌شود (کلید غایب = ممنوع)
create or replace function public.acc_perm_ok(p_business uuid, p_perm text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_role text;
  v_perms jsonb;
  v_configured boolean;
begin
  if p_business is null or p_perm is null or p_perm = '' then return false; end if;
  if public.acc_sys_admin() then return true; end if;
  select a.role, a.perms into v_role, v_perms
  from public.acc_access a
  where a.business_id = p_business
    and a.user_id = auth.uid()
    and a.status in ('active','trial')
    and (a.expires_at is null or a.expires_at > now())
  limit 1;
  if v_role is null then return false; end if;
  if v_role = 'owner' then return true; end if;
  if v_role <> 'accountant' then return false; end if; -- viewer/سایر نقش‌ها: فقط خواندن
  v_perms := coalesce(v_perms, '{}'::jsonb);
  select exists (select 1 from jsonb_object_keys(v_perms) k limit 1) into v_configured;
  if not v_configured then return true; end if; -- حالت قدیمی: بدون پیکربندی
  return coalesce(v_perms ->> p_perm, 'false')::boolean;
end $$;

revoke all on function public.acc_sys_admin() from public, anon;
revoke all on function public.acc_role_of(uuid) from public, anon;
revoke all on function public.acc_perm_ok(uuid, text) from public, anon;
grant execute on function public.acc_sys_admin() to authenticated;
grant execute on function public.acc_role_of(uuid) to authenticated;
grant execute on function public.acc_is_member(uuid) to authenticated;
grant execute on function public.acc_perm_ok(uuid, text) to authenticated;

-- ══════════════════════ §1 شماره‌گذاری اتمیک اسناد ══════════════════════
-- ریشهٔ باگ: nextEntryNo در مرورگر (max+1) — دو درخواست هم‌زمان شماره تکراری می‌گیرند.
-- راه‌حل: جدول شمارنده + تخصیص اتمیک با ON CONFLICT DO UPDATE (قفل ردیفی).
-- پشتوانه: قید یگانی (business_id, entry_no) روی acc_journal.

create table if not exists public.acc_entry_counters (
  business_id uuid primary key references public.acc_businesses(id) on delete cascade,
  last_entry_no bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.acc_entry_counters enable row level security;
-- شمارنده فقط از طریق توابع security definer نوشته می‌شود؛ پالیسی نوشتن مستقیم ندارد.
drop policy if exists "acc counters member read" on public.acc_entry_counters;
create policy "acc counters member read" on public.acc_entry_counters
  for select to authenticated
  using (public.acc_is_member(business_id));

-- بذرگیری اولیه از وضعیت فعلی هر کسب‌وکار
insert into public.acc_entry_counters (business_id, last_entry_no)
select j.business_id, max(j.entry_no)
from public.acc_journal j
group by j.business_id
on conflict (business_id) do nothing;

create or replace function public.acc_next_entry_no(p_business uuid)
returns integer
language plpgsql
security definer
set search_path = public as $$
declare
  v_no bigint;
  v_max bigint;
begin
  if p_business is null then
    raise exception 'کسب‌وکار نامعتبر است';
  end if;
  insert into public.acc_entry_counters (business_id, last_entry_no)
  values (p_business, 1)
  on conflict (business_id) do update
    set last_entry_no = public.acc_entry_counters.last_entry_no + 1,
        updated_at = now()
  returning last_entry_no into v_no;
  -- دفاع عمقی: اگر به هر دلیل شمارنده عقب بود (اجرای دستی/بازیابی)، از ماکس واقعی عبور کند
  if v_no is null or v_no < 1 then
    raise exception 'خطای شمارنده سند';
  end if;
  return v_no::integer;
exception
  when others then
    -- اگر ردیف شمارنده به‌هر دلیل گم شده بود، از ماکس واقعی بساز
    select coalesce(max(entry_no), 0) + 1 into v_max from public.acc_journal where business_id = p_business;
    insert into public.acc_entry_counters (business_id, last_entry_no)
    values (p_business, v_max)
    on conflict (business_id) do update
      set last_entry_no = greatest(public.acc_entry_counters.last_entry_no + 1, v_max),
          updated_at = now()
    returning last_entry_no into v_no;
    return v_no::integer;
end $$;

revoke all on function public.acc_next_entry_no(uuid) from public, anon, authenticated;

-- قید یگانی شماره سند در هر کسب‌وکار — با ترمیم خودکار دادهٔ تکراری موجود
do $$
declare
  dup_count int;
  rec record;
begin
  select count(*) into dup_count from (
    select business_id, entry_no
    from public.acc_journal
    group by business_id, entry_no
    having count(*) > 1
  ) d;
  if dup_count > 0 then
    raise notice 'ترمیم % شماره سند تکراری پیش از افزودن قید یگانی…', dup_count;
    -- قدیمی‌ترین سند (اولین created_at) شماره را نگه می‌دارد؛ بقیه به ماکس+۱ منتقل می‌شوند
    for rec in
      select id, business_id, entry_no, created_at,
             row_number() over (partition by business_id, entry_no order by created_at, id) as rn
      from public.acc_journal
      where (business_id, entry_no) in (
        select business_id, entry_no from public.acc_journal
        group by business_id, entry_no having count(*) > 1
      )
      order by business_id, entry_no, created_at
    loop
      if rec.rn > 1 then
        update public.acc_journal j
        set entry_no = (select coalesce(max(entry_no), 0) + 1 from public.acc_journal where business_id = rec.business_id)
        where j.id = rec.id;
        update public.acc_entry_counters c
        set last_entry_no = greatest(c.last_entry_no, (select entry_no from public.acc_journal where id = rec.id))
        where c.business_id = rec.business_id;
        raise notice 'سند % به شماره جدید منتقل شد', rec.id;
      end if;
    end loop;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.acc_journal'::regclass and conname = 'acc_journal_biz_entryno_uniq'
  ) then
    alter table public.acc_journal
      add constraint acc_journal_biz_entryno_uniq unique (business_id, entry_no);
    raise notice 'قید یگانی acc_journal_biz_entryno_uniq افزوده شد';
  end if;
end $$;

-- ══════════════════════ §2 تقویم جلالی در SQL ══════════════════════
-- پورت الگوریتم استاندارد jalaali-js — برای نگهبان دورهٔ مالی سمت دیتابیس.
create or replace function public.acc_date_to_jalali(p_date date, out jy int, out jm int, out jd int)
language plpgsql immutable as $$
declare
  v_gy int; v_gm int; v_gd int;
  v_jdn numeric;
  v_j int; v_i int;
  v_leapj int := -14; v_jp int; v_jump int := 0; v_leap int; v_leapg int; v_march int; v_n int;
  v_jy int; v_k numeric; v_jdn1f numeric;
  b int[] := array[-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178];
  v_bl int := 20;
  v_i2 int; v_jm2 int;
begin
  if p_date is null then jy := 0; jm := 0; jd := 0; return; end if;
  v_gy := extract(year from p_date)::int;
  v_gm := extract(month from p_date)::int;
  v_gd := extract(day from p_date)::int;

  -- g2d: تاریخ میلادی به شماره روز ژولینی
  v_jdn := trunc((v_gy + trunc((v_gm - 8)::numeric / 6) + 100100) * 1461 / 4)
         + trunc((153 * ((v_gm + 9) % 12) + 2)::numeric / 5)
         + v_gd - 34840408;
  v_jdn := v_jdn - trunc(trunc((v_gy + 100100 + trunc((v_gm - 8)::numeric / 6))::numeric / 100) * 3 / 4) + 752;

  -- d2g (فقط برای gy) — از روی jdn
  v_j := (4 * v_jdn + 139361631)::int;
  v_j := (v_j + trunc(trunc((4 * v_jdn + 183187720)::numeric / 146097) * 3 / 4) * 4 - 3908)::int;
  v_i := (trunc((v_j % 1461)::numeric / 4) * 5 + 308)::int;
  v_gy := (trunc(v_j::numeric / 1461) - 100100 + trunc((8 - ((trunc(v_i::numeric / 153) % 12) + 1))::numeric / 6))::int;

  -- jalCal
  v_jy := v_gy - 621;
  v_jp := b[1];
  for v_i2 in 2..v_bl loop
    v_jm2 := b[v_i2];
    v_jump := v_jm2 - v_jp;
    if v_jy < v_jm2 then exit; end if;
    v_leapj := v_leapj + trunc(v_jump::numeric / 33) * 8;
    v_leapj := v_leapj + trunc(((v_jump % 33))::numeric / 4);  -- خط حیاتی الگوریتم jalaali
    v_jp := v_jm2;
  end loop;
  v_n := v_jy - v_jp;
  v_leapj := v_leapj + trunc(v_n::numeric / 33) * 8 + trunc(((v_n % 33) + 3)::numeric / 4);
  if (v_jump % 33) = 4 and (v_jump - v_n) = 4 then v_leapj := v_leapj + 1; end if;
  v_leapg := trunc(v_gy::numeric / 4) - trunc(((trunc(v_gy::numeric / 100) + 1) * 3)::numeric / 4) - 150;
  v_march := 20 + v_leapj - v_leapg;
  if (v_jump - v_n) < 6 then v_n := v_n - v_jump + trunc((v_jump + 4)::numeric / 33) * 33; end if;
  v_leap := (( ((v_n + 1) % 33) - 1) % 4);
  if v_leap = -1 then v_leap := 4; end if;

  -- d2j
  v_jdn1f := trunc((v_gy + trunc((-8 + 3)::numeric / 6) + 100100) * 1461 / 4)
           + trunc((153 * ((3 + 9) % 12) + 2)::numeric / 5) + v_march - 34840408;
  v_jdn1f := v_jdn1f - trunc(trunc((v_gy + 100100 + trunc((-8 + 3)::numeric / 6))::numeric / 100) * 3 / 4) + 752;
  -- (g2d(gy, 3, march))

  v_k := v_jdn - v_jdn1f;
  if v_k >= 0 then
    if v_k <= 185 then
      jm := (1 + trunc(v_k::numeric / 31))::int;
      jd := ((v_k % 31) + 1)::int;
      jy := v_jy;
      return;
    end if;
    v_k := v_k - 186;
  else
    v_jy := v_jy - 1;
    v_k := v_k + 179;
    if v_leap = 1 then v_k := v_k + 1; end if;
  end if;
  jm := (7 + trunc(v_k::numeric / 30))::int;
  jd := ((v_k % 30) + 1)::int;
  jy := v_jy;
end $$;

-- ══════════════════════ §3 نگهبان دورهٔ مالی ══════════════════════
-- · ثبت سند در سال مالی «بسته» یا ماه «قفل‌شده» ممنوع (به‌جز افتتاحیه/اختتامیه/برگشت)
-- · دو اختتامیه برای یک سال ممنوع · دو افتتاحیه برای یک سال ممنوع
-- تضمین وجود جدول دوره‌های ماهانه (روی دیتابیس زنده موجود است؛ برای محیط‌های تازه ساخته می‌شود)
create table if not exists public.acc_periods (
  business_id uuid not null references public.acc_businesses(id) on delete cascade,
  jyear int not null,
  jmonth int not null,
  locked boolean not null default false,
  locked_at timestamptz,
  primary key (business_id, jyear, jmonth)
);
alter table public.acc_periods enable row level security;
drop policy if exists "acc periods member select" on public.acc_periods;
create policy "acc periods member select" on public.acc_periods
  for select to authenticated
  using (public.acc_is_member(business_id));
drop policy if exists "acc periods member write" on public.acc_periods;
create policy "acc periods member write" on public.acc_periods
  for all to authenticated
  using (public.acc_perm_ok(business_id, 'fiscal.close'))
  with check (public.acc_perm_ok(business_id, 'fiscal.close'));

create or replace function public.acc_period_guard()
returns trigger
language plpgsql
security definer
set search_path = public as $$
declare
  v_jy int; v_jm int; v_jd int;
  v_exempt boolean;
begin
  select jy, jm, jd into v_jy, v_jm, v_jd from public.acc_date_to_jalali(new.date_g);
  v_exempt := coalesce(new.ref_action, 'post') = 'reverse'
           or new.ref_type in ('opening', 'closing');

  -- سال مالی بسته؟
  if not v_exempt and exists (
    select 1 from public.acc_fiscal_years fy
    where fy.business_id = new.business_id and fy.jyear = v_jy and fy.status = 'closed'
  ) then
    raise exception 'سال مالی % بسته شده است — ثبت سند در دورهٔ بسته مجاز نیست', v_jy;
  end if;

  -- ماه قفل‌شده؟
  if not v_exempt and exists (
    select 1 from public.acc_periods p
    where p.business_id = new.business_id and p.jyear = v_jy and p.jmonth = v_jm and p.locked
  ) then
    raise exception 'دورهٔ ماه % سال % قفل شده است — ابتدا قفل را باز کنید', v_jm, v_jy;
  end if;

  -- اختتامیهٔ تکراری ممنوع
  if new.ref_type = 'closing' and exists (
    select 1 from public.acc_fiscal_years fy
    where fy.business_id = new.business_id and fy.jyear = v_jy and fy.closing_entry_id is not null
  ) then
    raise exception 'سند اختتامیهٔ سال % قبلاً صادر شده است — بستن دوبارهٔ دوره مجاز نیست', v_jy;
  end if;

  -- افتتاحیهٔ تکراری ممنوع
  if new.ref_type = 'opening' and exists (
    select 1 from public.acc_fiscal_years fy
    where fy.business_id = new.business_id and fy.jyear = v_jy and fy.opening_entry_id is not null
  ) then
    raise exception 'سند افتتاحیهٔ سال % قبلاً ثبت شده است', v_jy;
  end if;

  return new;
end $$;

drop trigger if exists acc_period_guard_tr on public.acc_journal;
create trigger acc_period_guard_tr
  before insert or update of date_g, ref_type, ref_action on public.acc_journal
  for each row execute function public.acc_period_guard();

-- ══════════════════════ §4 قفل حذف سند قطعی ══════════════════════
-- فقط سند دستیِ بدون ابطال قابل حذف است؛ سند سیستمی فقط از مسیر ابطال (سند معکوس).
create or replace function public.acc_journal_delete_guard()
returns trigger
language plpgsql
as $$
begin
  -- مسیرهای سیستمی (RPC definer / کنسول / service_role حسابرسی) آزادند؛
  -- کاربر اپ (authenticated) مشمول قفل است.
  -- استثنا: حذف آبشاری کل کسب‌وکار (pg_trigger_depth>1 یعنی از FK cascade آمده)
  if current_user <> 'authenticated' then return old; end if;
  if pg_trigger_depth() > 1 then return old; end if;
  if old.ref_type <> 'manual' then
    raise exception 'سند سیستمی (% ) قابل حذف نیست — برای اصلاح، آن را ابطال کنید', old.ref_type;
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

-- ══════════════════════ §5 قفل ردیف‌های سند ══════════════════════
-- ردیف‌های سند سیستمی (فاکتور/هزینه/تراکنش/افتتاحیه/اختتامیه) و سند باطل‌شده ثابت‌اند.
-- درج توسط توابع definer (current_user=postgres) و service_role مجاز است؛
-- نوشتن مستقیم کاربر اپ (authenticated) روی سند سیستمی بسته است.
create or replace function public.acc_journal_lines_guard()
returns trigger
language plpgsql
as $$
declare
  v_ref_type text;
  v_ref_action text;
  v_voided timestamptz;
  v_entry uuid;
begin
  -- اجرا از درون RPCهای definer یا مسیرهای سیستمی — بدون قفل
  if current_user <> 'authenticated' then
    if tg_op = 'DELETE' then return old; end if;
    return coalesce(new, old);
  end if;
  -- حذف آبشاری کل کسب‌وکار (FK cascade) مجاز است
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then return old; end if;

  v_entry := case when tg_op = 'DELETE' then old.entry_id else new.entry_id end;
  if v_entry is null then
    raise exception 'ردیف سند بدون entry_id مجاز نیست';
  end if;
  select ref_type, ref_action, voided_at into v_ref_type, v_ref_action, v_voided
  from public.acc_journal where id = v_entry;
  if not found then
    raise exception 'سند والد یافت نشد';
  end if;
  if v_ref_type <> 'manual' or v_ref_action = 'reverse' or v_voided is not null then
    raise exception 'ردیف‌های سند قطعی/سیستمی قابل تغییر نیستند — برای اصلاح از ابطال استفاده کنید';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists acc_journal_lines_guard_tr on public.acc_journal_lines;
create trigger acc_journal_lines_guard_tr
  before insert or update or delete on public.acc_journal_lines
  for each row execute function public.acc_journal_lines_guard();

-- ══════════════════════ §6 کنترل تراز در دیتابیس ══════════════════════
-- هر تغییری در ردیف‌ها، در پایان تراکنش باید تراز بماند: SUM(debit)=SUM(credit)
create or replace function public.acc_journal_balance_check()
returns trigger
language plpgsql
security definer
set search_path = public as $$
declare
  v_entry uuid;
  v_d bigint;
  v_c bigint;
  v_no int;
begin
  v_entry := case when tg_op = 'DELETE' then old.entry_id else new.entry_id end;
  select coalesce(sum(debit), 0), coalesce(sum(credit), 0) into v_d, v_c
  from public.acc_journal_lines where entry_id = v_entry;
  if v_d <> v_c then
    select entry_no into v_no from public.acc_journal where id = v_entry;
    raise exception 'سند شماره % تراز نیست — جمع بدهکار % و بستانکار % باید برابر شود', v_no, v_d, v_c;
  end if;
  return null;
end $$;

drop trigger if exists acc_journal_balance_chk on public.acc_journal_lines;
create constraint trigger acc_journal_balance_chk
  after insert or update or delete on public.acc_journal_lines
  deferrable initially deferred
  for each row execute function public.acc_journal_balance_check();

-- ══════════════════════ §7 CHECK ردیف سند ══════════════════════
-- ستون طرف‌حساب خط سند (در تایپ‌های TS هست ولی تضمین زنده نداشت) — idempotent
alter table public.acc_journal_lines add column if not exists partner_id uuid;
-- مبلغ منفی ممنوع · بدهکار و بستانکار هم‌زمان مثبت ممنوع · ردیف صفر ممنوع
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.acc_journal_lines'::regclass and conname = 'acc_jline_amounts_chk'
  ) then
    begin
      alter table public.acc_journal_lines
        add constraint acc_jline_amounts_chk
        check (debit >= 0 and credit >= 0 and not (debit > 0 and credit > 0) and (debit + credit) > 0) not valid;
      raise notice 'CHECK مبالغ ردیف سند افزوده شد (not valid — دادهٔ تاریخی دست‌نخورده)';
    exception when others then
      raise notice 'افزودن CHECK مبالغ ناموفق: %', sqlerrm;
    end;
  end if;
end $$;

-- ══════════════════════ §7.2 هم‌خوانی ref_type سند با مقادیر اپ ══════════════════════
-- CHECK قدیمی فقط ۵ مقدار را می‌پذیرفت؛ اپ برای اختتامیه/تنخواه/پیش‌پرداخت
-- «closing/petty/prepay» می‌نویسد و بدون این اصلاح با check_violation رد می‌شد.
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any(con.conkey)
    where con.conrelid = 'public.acc_journal'::regclass
      and con.contype = 'c'
      and att.attname = 'ref_type'
  loop
    execute format('alter table public.acc_journal drop constraint %I', c.conname);
    raise notice 'dropped journal ref_type constraint: %', c.conname;
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.acc_journal'::regclass and conname = 'acc_journal_ref_type_chk'
  ) then
    alter table public.acc_journal
      add constraint acc_journal_ref_type_chk
      check (ref_type in ('invoice','expense','transaction','opening','manual','closing','petty','prepay'));
    raise notice 'CHECK ref_type با مقادیر کامل اپ بازسازی شد';
  end if;
end $$;

-- ══════════════════════ §8 RPCهای اتمیک حسابداری ══════════════════════

-- ۸.۱ ثبت سند اتمیک: سرِسند + ردیف‌ها + شماره‌گذاری + تراز — همه در یک تراکنش
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
  v_no int;
  v_id uuid;
  v_d bigint := 0;
  v_c bigint := 0;
  v_line jsonb;
  v_debit bigint;
  v_credit bigint;
  v_rows jsonb := '[]'::jsonb;
begin
  if v_user is null then raise exception 'ابتدا وارد حساب کاربری شوید'; end if;
  -- سندهای آینه‌ای (invoice/expense/transaction) فقط از مسیر acc_post_document ساخته می‌شوند
  -- تا idempotency و تراز با سند مادر تضمین شود.
  if p_ref_type not in ('manual','opening','closing') then
    raise exception 'این نوع سند از مسیر ثبت مستقیم پذیرفته نیست: %', p_ref_type;
  end if;
  -- بستن/افتتاح دوره مجوز مخصوص می‌خواهد
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

  -- اعتبارسنجی و نرمال‌سازی ردیف‌ها
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
      raise exception 'یک ردیف نمی‌تواند هم‌زمان بدهکار و بستانکار باشد (% )', v_line ->> 'account_code';
    end if;
    if v_debit = 0 and v_credit = 0 then
      continue; -- ردیف صفر نادیده گرفته می‌شود
    end if;
    v_d := v_d + v_debit;
    v_c := v_c + v_credit;
    v_rows := v_rows || jsonb_build_object(
      'account_code', v_line ->> 'account_code',
      'account_title', coalesce(nullif(v_line ->> 'account_title', ''), v_line ->> 'account_code'),
      'debit', v_debit, 'credit', v_credit,
      'detail_id', nullif(v_line ->> 'detail_id', ''),
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

  -- شماره‌گذاری اتمیک + درج سرِسند (با یک تلاش مجدد در برخورد نادر)
  for attempt in 1..3 loop
    begin
      v_no := public.acc_next_entry_no(p_business);
      insert into public.acc_journal (business_id, entry_no, date_g, ref_type, ref_action, ref_id, reversal_of, description, attachment_url)
      values (p_business, v_no, p_date, p_ref_type, p_ref_action, p_ref_id, p_reversal_of,
              coalesce(nullif(p_description, ''), 'سند شماره ' || v_no), p_attachment_url)
      returning id into v_id;
      exit;
    exception
      when unique_violation then
        if attempt = 3 then raise exception 'شماره‌گذاری سند با تداخل مکرر ناموفق ماند'; end if;
    end;
  end loop;

  insert into public.acc_journal_lines (entry_id, business_id, account_code, account_title, debit, credit, detail_id, project_id, line_desc, partner_id)
  select v_id,
         p_business,
         r ->> 'account_code',
         coalesce(r ->> 'account_title', r ->> 'account_code'),
         (r ->> 'debit')::bigint,
         (r ->> 'credit')::bigint,
         (r ->> 'detail_id')::uuid,
         (r ->> 'project_id')::uuid,
         r ->> 'line_desc',
         (r ->> 'partner_id')::uuid
  from jsonb_array_elements(v_rows) r;

  return v_id;
end $$;

-- ۸.۲ ابطال اتمیک سند: سند معکوس + نشانه‌گذاری ابطال در یک تراکنش
create or replace function public.acc_void_journal(
  p_business uuid,
  p_entry uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_e public.acc_journal%rowtype;
  v_rev_no int;
  v_rev_id uuid;
  v_lines jsonb := '[]'::jsonb;
  v_l record;
begin
  if v_user is null then raise exception 'ابتدا وارد حساب کاربری شوید'; end if;
  if not public.acc_perm_ok(p_business, 'journal.void') then
    raise exception 'اجازهٔ ابطال سند در این کسب‌وکار را ندارید';
  end if;
  select * into v_e from public.acc_journal where id = p_entry for update;
  if not found then raise exception 'سند یافت نشد'; end if;
  if v_e.business_id <> p_business then raise exception 'سند متعلق به این کسب‌وکار نیست'; end if;
  if v_e.voided_at is not null then raise exception 'این سند قبلاً باطل شده است'; end if;
  if v_e.ref_action = 'reverse' then raise exception 'سند معکوس قابل ابطال نیست'; end if;

  for v_l in
    select * from public.acc_journal_lines where entry_id = p_entry order by account_code
  loop
    v_lines := v_lines || jsonb_build_object(
      'account_code', v_l.account_code, 'account_title', v_l.account_title,
      'debit', v_l.credit, 'credit', v_l.debit,
      'detail_id', v_l.detail_id, 'project_id', v_l.project_id,
      'line_desc', case when v_l.line_desc is not null then 'برگشت: ' || v_l.line_desc else null end,
      'partner_id', v_l.partner_id
    );
  end loop;
  if v_lines = '[]'::jsonb then raise exception 'سند بدون ردیف قابل ابطال نیست'; end if;

  v_rev_no := public.acc_next_entry_no(p_business);
  insert into public.acc_journal (business_id, entry_no, date_g, ref_type, ref_action, ref_id, reversal_of, description)
  values (p_business, v_rev_no, current_date, v_e.ref_type, 'reverse', v_e.ref_id, p_entry,
          'برگشت سند ' || coalesce(v_e.description, '') || coalesce(' — علت: ' || nullif(p_reason, ''), ''))
  returning id into v_rev_id;

  insert into public.acc_journal_lines (entry_id, business_id, account_code, account_title, debit, credit, detail_id, project_id, line_desc, partner_id)
  select v_rev_id, p_business,
         r ->> 'account_code', coalesce(r ->> 'account_title', r ->> 'account_code'),
         (r ->> 'debit')::bigint, (r ->> 'credit')::bigint,
         (r ->> 'detail_id')::uuid, (r ->> 'project_id')::uuid,
         r ->> 'line_desc', (r ->> 'partner_id')::uuid
  from jsonb_array_elements(v_lines) r;

  update public.acc_journal
  set voided_at = now(), void_reason = nullif(p_reason, '')
  where id = p_entry;

  return v_rev_id;
end $$;

-- ۸.۳ ابطال اتمیک فاکتور: قفل سطر + برگشت موجودی + ابطال سندها + وضعیت ابطال
create or replace function public.acc_void_invoice(
  p_business uuid,
  p_invoice uuid,
  p_reason text,
  p_restore_stock boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_inv public.acc_invoices%rowtype;
  v_j record;
  v_revs int := 0;
  v_rev_id uuid;
  v_rev_ids uuid[] := '{}';
begin
  if v_user is null then raise exception 'ابتدا وارد حساب کاربری شوید'; end if;
  if not public.acc_perm_ok(p_business, 'invoices.void') then
    raise exception 'اجازهٔ ابطال صورتحساب را ندارید';
  end if;
  select * into v_inv from public.acc_invoices where id = p_invoice for update;
  if not found then raise exception 'فاکتور یافت نشد'; end if;
  if v_inv.business_id <> p_business then raise exception 'فاکتور متعلق به این کسب‌وکار نیست'; end if;
  if v_inv.voided_at is not null then raise exception 'این فاکتور قبلاً ابطال شده است'; end if;
  if v_inv.status = 'draft' then raise exception 'پیش‌نویس ابطال نمی‌شود؛ آن را حذف کنید'; end if;

  -- برگشت موجودی کالا (یک UPDATE اتمیک — بدون خواندن/نوشتن قدم‌به‌قدم)
  if p_restore_stock and v_inv.type = 'sale' and v_inv.posted_at is not null then
    update public.acc_items i
    set stock = coalesce(i.stock, 0) + ii.quantity
    from public.acc_invoice_items ii
    where ii.invoice_id = p_invoice and ii.item_id = i.id and i.track_stock;
  end if;

  -- ابطال سندهای آینه‌ای فاکتور (سند معکوس برای هر کدام)
  for v_j in
    select id from public.acc_journal
    where business_id = p_business and ref_type = 'invoice' and ref_id = p_invoice and voided_at is null
  loop
    begin
      v_rev_id := public.acc_void_journal_internal(p_business, v_j.id, coalesce(nullif(p_reason, ''), 'ابطال فاکتور'));
      v_revs := v_revs + 1;
      if v_rev_id is not null then v_rev_ids := v_rev_ids || v_rev_id; end if;
    exception when others then
      -- سند بدون گردش قابل ابطال نیست — همان رفتار قبلی اپ
      null;
    end;
  end loop;

  update public.acc_invoices
  set status = 'cancelled', voided_at = now(), void_reason = nullif(p_reason, '')
  where id = p_invoice;

  return jsonb_build_object('invoice_id', p_invoice, 'reversed_journals', v_revs, 'reversal_ids', to_jsonb(v_rev_ids));
end $$;

-- نسخهٔ داخلی ابطال سند (بدون کنترل مجوز دوباره — از RPC ابطال فاکتور صدا زده می‌شود)
create or replace function public.acc_void_journal_internal(p_business uuid, p_entry uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public as $$
declare
  v_e public.acc_journal%rowtype;
  v_rev_no int;
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
      'account_code', v_l.account_code, 'account_title', v_l.account_title,
      'debit', v_l.credit, 'credit', v_l.debit,
      'detail_id', v_l.detail_id, 'project_id', v_l.project_id,
      'line_desc', case when v_l.line_desc is not null then 'برگشت: ' || v_l.line_desc else null end,
      'partner_id', v_l.partner_id
    );
  end loop;
  if v_lines = '[]'::jsonb then raise exception 'سند بدون ردیف'; end if;
  v_rev_no := public.acc_next_entry_no(p_business);
  insert into public.acc_journal (business_id, entry_no, date_g, ref_type, ref_action, ref_id, reversal_of, description)
  values (p_business, v_rev_no, current_date, v_e.ref_type, 'reverse', v_e.ref_id, p_entry,
          'برگشت سند ' || coalesce(v_e.description, '') || coalesce(' — علت: ' || nullif(p_reason, ''), ''))
  returning id into v_rev_id;
  insert into public.acc_journal_lines (entry_id, business_id, account_code, account_title, debit, credit, detail_id, project_id, line_desc, partner_id)
  select v_rev_id, p_business,
         r ->> 'account_code', coalesce(r ->> 'account_title', r ->> 'account_code'),
         (r ->> 'debit')::bigint, (r ->> 'credit')::bigint,
         (r ->> 'detail_id')::uuid, (r ->> 'project_id')::uuid,
         r ->> 'line_desc', (r ->> 'partner_id')::uuid
  from jsonb_array_elements(v_lines) r;
  update public.acc_journal set voided_at = now(), void_reason = nullif(p_reason, '') where id = p_entry;
  return v_rev_id;
end $$;
revoke all on function public.acc_void_journal_internal(uuid, uuid, text) from public, anon, authenticated;

-- ۸.۴ تعدیل اتمیک موجودی هنگام صدور/ابطال (به‌جای حلقهٔ خواندن/نوشتن مرورگر)
create or replace function public.acc_adjust_stock(p_invoice uuid, p_direction text)
returns integer
language plpgsql
security definer
set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_inv record;
  v_biz uuid;
  v_sign int;
begin
  if v_user is null then raise exception 'ابتدا وارد حساب کاربری شوید'; end if;
  select business_id, type, posted_at into v_inv from public.acc_invoices where id = p_invoice;
  if not found then raise exception 'فاکتور یافت نشد'; end if;
  v_biz := v_inv.business_id;
  if v_inv.type <> 'sale' then return 0; end if;
  if not (public.acc_perm_ok(v_biz, 'invoices.issue') or public.acc_perm_ok(v_biz, 'invoices.void')) then
    raise exception 'اجازهٔ تغییر موجودی را ندارید';
  end if;
  if p_direction not in ('decrease','increase') then raise exception 'جهت تعدیل نامعتبر'; end if;
  v_sign := case when p_direction = 'decrease' then -1 else 1 end;
  update public.acc_items i
  set stock = coalesce(i.stock, 0) + v_sign * ii.quantity
  from public.acc_invoice_items ii
  where ii.invoice_id = p_invoice and ii.item_id = i.id and i.track_stock;
  return 0;
end $$;

-- ۸.۵ حذف ضمیمه: پاکسازی فایل واقعی Storage + رکورد، اتمیک
create or replace function public.acc_delete_attachment(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_row record;
  v_path text;
begin
  if v_user is null then raise exception 'ابتدا وارد حساب کاربری شوید'; end if;
  select * into v_row from public.acc_attachments where id = p_id;
  if not found then return false; end if;
  if not public.acc_perm_ok(v_row.business_id, 'attachments.manage') then
    raise exception 'اجازهٔ حذف ضمیمه را ندارید';
  end if;
  v_path := public.acc_storage_path_of(v_row.file_url);
  if v_path is not null then
    begin
      delete from storage.objects
      where bucket_id = split_part(v_path, '/', 1)
        and name = substring(v_path from position('/' in v_path) + 1);
    exception when others then null;
    end;
  end if;
  delete from public.acc_attachments where id = p_id;
  return true;
end $$;

-- استخراج مسیر کامل «bucket/object» از URL ذخیره‌شده (سازگار با public و authenticated)
create or replace function public.acc_storage_path_of(p_url text)
returns text
language plpgsql
immutable as $$
declare
  v text := coalesce(p_url, '');
  pos int;
begin
  if v = '' then return null; end if;
  pos := position('/object/public/' in v);
  if pos > 0 then
    return substring(v from pos + length('/object/public/'));
  end if;
  pos := position('/object/authenticated/' in v);
  if pos > 0 then
    return substring(v from pos + length('/object/authenticated/'));
  end if;
  -- مسیر خام «bucket/object…»
  if position('/' in v) > 0 and v !~ '^https?://' then
    return v;
  end if;
  return null;
end $$;

-- تریگر پاکسازی فایل: هر حذف ردیف ضمیمه (از هر مسیری) فایل Storage را هم پاک می‌کند
create or replace function public.acc_attachment_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public as $$
declare
  v_path text;
begin
  v_path := public.acc_storage_path_of(old.file_url);
  if v_path is not null then
    begin
      delete from storage.objects
      where bucket_id = split_part(v_path, '/', 1)
        and name = substring(v_path from position('/' in v_path) + 1);
    exception when others then null;
    end;
  end if;
  return old;
end $$;

drop trigger if exists acc_attachment_cleanup_tr on public.acc_attachments;
create trigger acc_attachment_cleanup_tr
  before delete on public.acc_attachments
  for each row execute function public.acc_attachment_cleanup();

grant execute on function public.acc_create_journal(uuid, date, text, text, text, uuid, uuid, jsonb, text) to authenticated;
grant execute on function public.acc_void_journal(uuid, uuid, text) to authenticated;
grant execute on function public.acc_void_invoice(uuid, uuid, text, boolean) to authenticated;
grant execute on function public.acc_adjust_stock(uuid, text) to authenticated;
grant execute on function public.acc_delete_attachment(uuid) to authenticated;
revoke all on function public.acc_create_journal(uuid, date, text, text, text, uuid, uuid, jsonb, text) from public, anon;
revoke all on function public.acc_void_journal(uuid, uuid, text) from public, anon;
revoke all on function public.acc_void_invoice(uuid, uuid, text, boolean) from public, anon;
revoke all on function public.acc_adjust_stock(uuid, text) from public, anon;
revoke all on function public.acc_delete_attachment(uuid) from public, anon;

-- ۸.۶ صدور اتمیک فاکتور: قفل سطر + وضعیت «صادرشده» + کسر موجودی + سند آینه‌ای دوبل
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

  -- کسر موجودی (یک UPDATE اتمیک)
  if v_inv.type = 'sale' then
    update public.acc_items i
    set stock = coalesce(i.stock, 0) - ii.quantity
    from public.acc_invoice_items ii
    where ii.invoice_id = p_invoice and ii.item_id = i.id and i.track_stock;
  end if;

  -- سند آینه‌ای دوبل (فروش/خرید/برگشت) — در همان تراکنش
  v_journal := public.acc_post_document('invoice', p_invoice);
  if v_journal is null then
    raise exception 'سند حسابداری برای این فاکتور ساخته نشد';
  end if;

  return jsonb_build_object('invoice_id', p_invoice, 'journal_id', v_journal);
end $$;

grant execute on function public.acc_issue_invoice(uuid) to authenticated;
revoke all on function public.acc_issue_invoice(uuid) from public, anon;

-- ══════════════════════ §9 سند آینه‌ای اسناد عملیاتی ══════════════════════
-- صدور فاکتور / هزینه / دریافت-پرداخت باید سند دوبل بسازد (اصل حسابداری دوطرفه)
-- idempotent: برای هر سند مادر حداکثر یک سند معتبر (باطل‌نشده) ساخته می‌شود.
create or replace function public.acc_ensure_chart(p_business uuid, p_code text, p_title text, p_kind text)
returns void
language plpgsql
security definer
set search_path = public as $$
begin
  if not exists (
    select 1 from public.acc_chart
    where code = p_code and (business_id = p_business or business_id is null)
  ) then
    insert into public.acc_chart (business_id, code, title, kind, is_system, level, is_leaf, nature, active)
    values (p_business, p_code, p_title, p_kind, false, 1, true,
            case when p_kind in ('liability','equity','income') then 'credit' else 'debit' end, true);
  end if;
end $$;

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
  v_no int;
  v_rec record;
  v_cash_code text;
  v_net bigint;
  v_vat bigint;
  v_total bigint;
  v_acc_kind text;
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
    -- پیش‌فاکتور و پیش‌نویس سند نمی‌سازند
    if v_rec.type = 'proforma' or v_rec.status = 'draft' then return null; end if;
    if v_rec.status = 'cancelled' then return null; end if;
    select id into v_exists from public.acc_journal
    where business_id = v_biz and ref_type = 'invoice' and ref_id = p_ref_id and voided_at is null limit 1;
    if v_exists is not null then return v_exists; end if;

    v_net := coalesce(v_rec.subtotal, 0) - coalesce(v_rec.discount_total, 0);
    v_vat := coalesce(v_rec.vat_total, 0);
    v_total := v_net + v_vat; -- از اجزا محاسبه می‌شود تا سند همیشه تراز بماند
    v_date := v_rec.date_g;
    v_desc := case v_rec.type
      when 'sale' then 'فاکتور فروش ' || v_rec.number
      when 'purchase' then 'فاکتور خرید ' || v_rec.number
      when 'return_sale' then 'برگشت از فروش ' || v_rec.number
      else 'فاکتور ' || v_rec.number end;

    -- حساب نقدی/بانکی مرتبط (برای فروش نقدی و خرید نقدی)
    v_cash_code := null;
    if v_rec.account_id is not null then
      select kind into v_acc_kind from public.acc_accounts where id = v_rec.account_id;
      v_cash_code := case when v_acc_kind = 'cash' then '1101' else '1102' end;
    end if;

    if v_rec.type = 'sale' then
      perform public.acc_ensure_chart(v_biz, '4101', 'درآمد فروش کالا و خدمات', 'income');
      perform public.acc_ensure_chart(v_biz, '2102', 'مالیات و عوارض ارزش افزوده فروش', 'liability');
      perform public.acc_ensure_chart(v_biz, '1103', 'حساب‌های دریافتنی تجاری', 'asset');
      if v_cash_code is not null then
        perform public.acc_ensure_chart(v_biz, v_cash_code, case when v_cash_code = '1101' then 'موجودی نقد و بانک — صندوق' else 'موجودی نقد و بانک — بانک' end, 'asset');
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('account_code', v_cash_code, 'account_title', case when v_cash_code = '1101' then 'موجودی نقد و بانک — صندوق' else 'موجودی نقد و بانک — بانک' end, 'debit', v_total, 'credit', 0, 'line_desc', 'فروش نقدی')
        );
      else
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('account_code', '1103', 'account_title', 'حساب‌های دریافتنی تجاری', 'debit', v_total, 'credit', 0, 'partner_id', v_rec.partner_id, 'line_desc', 'طلب از مشتری')
        );
      end if;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('account_code', '4101', 'account_title', 'درآمد فروش کالا و خدمات', 'debit', 0, 'credit', v_net, 'line_desc', 'درآمد فروش'),
        jsonb_build_object('account_code', '2102', 'account_title', 'مالیات و عوارض ارزش افزوده فروش', 'debit', 0, 'credit', v_vat, 'line_desc', 'مالیات بر ارزش افزوده')
      );
    elsif v_rec.type = 'purchase' then
      perform public.acc_ensure_chart(v_biz, '1201', 'موجودی کالا و خرید', 'asset');
      perform public.acc_ensure_chart(v_biz, '2103', 'اعتبار مالیات و عوارض ارزش افزوده', 'asset');
      perform public.acc_ensure_chart(v_biz, '2101', 'حساب‌های پرداختنی تجاری', 'liability');
      if v_cash_code is not null then
        perform public.acc_ensure_chart(v_biz, v_cash_code, case when v_cash_code = '1101' then 'موجودی نقد و بانک — صندوق' else 'موجودی نقد و بانک — بانک' end, 'asset');
      end if;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('account_code', '1201', 'account_title', 'موجودی کالا و خرید', 'debit', v_net, 'credit', 0, 'line_desc', 'خرید کالا/خدمت'),
        jsonb_build_object('account_code', '2103', 'account_title', 'اعتبار مالیات و عوارض ارزش افزوده', 'debit', v_vat, 'credit', 0, 'line_desc', 'اعتبار مالیات خرید')
      );
      if v_cash_code is not null then
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('account_code', v_cash_code, 'account_title', case when v_cash_code = '1101' then 'موجودی نقد و بانک — صندوق' else 'موجودی نقد و بانک — بانک' end, 'debit', 0, 'credit', v_total, 'line_desc', 'پرداخت نقدی خرید')
        );
      else
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('account_code', '2101', 'account_title', 'حساب‌های پرداختنی تجاری', 'debit', 0, 'credit', v_total, 'partner_id', v_rec.partner_id, 'line_desc', 'بدهی به تامین‌کننده')
        );
      end if;
    elsif v_rec.type = 'return_sale' then
      perform public.acc_ensure_chart(v_biz, '4103', 'برگشت از فروش و تخفیفات', 'income');
      perform public.acc_ensure_chart(v_biz, '2102', 'مالیات و عوارض ارزش افزوده فروش', 'liability');
      perform public.acc_ensure_chart(v_biz, '1103', 'حساب‌های دریافتنی تجاری', 'asset');
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('account_code', '4103', 'account_title', 'برگشت از فروش و تخفیفات', 'debit', v_net, 'credit', 0, 'line_desc', 'برگشت از فروش'),
        jsonb_build_object('account_code', '2102', 'account_title', 'مالیات و عوارض ارزش افزوده فروش', 'debit', v_vat, 'credit', 0, 'line_desc', 'برگشت مالیات فروش')
      );
      if v_cash_code is not null then
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('account_code', v_cash_code, 'account_title', case when v_cash_code = '1101' then 'موجودی نقد و بانک — صندوق' else 'موجودی نقد و بانک — بانک' end, 'debit', 0, 'credit', v_total, 'line_desc', 'عودت وجه')
        );
      else
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('account_code', '1103', 'account_title', 'حساب‌های دریافتنی تجاری', 'debit', 0, 'credit', v_total, 'partner_id', v_rec.partner_id, 'line_desc', 'کاهش طلب از مشتری')
        );
      end if;
    end if;

  elsif p_kind = 'expense' then
    select * into v_rec from public.acc_expenses where id = p_ref_id;
    if not found then raise exception 'هزینه یافت نشد'; end if;
    v_biz := v_rec.business_id;
    if not public.acc_perm_ok(v_biz, 'expenses.manage') then raise exception 'اجازهٔ ثبت هزینه را ندارید'; end if;
    if v_rec.voided_at is not null then return null; end if;
    select id into v_exists from public.acc_journal
    where business_id = v_biz and ref_type = 'expense' and ref_id = p_ref_id and voided_at is null limit 1;
    if v_exists is not null then return v_exists; end if;

    v_net := coalesce(v_rec.amount, 0);
    v_vat := coalesce(v_rec.vat_amount, 0);
    v_total := v_net + v_vat;
    v_date := v_rec.date_g;
    v_desc := 'هزینه: ' || coalesce(v_rec.title, v_rec.category, '');
    declare
      v_code text;
      v_title text;
    begin
      -- کد سرفصل هزینه از دستهٔ هزینه؛ اگر در کدینگ نبود همین‌جا ساخته می‌شود
      select cc.code into v_code
      from public.acc_expense_categories cc
      where cc.business_id = v_biz and cc.title = v_rec.category
      limit 1;
      v_code := coalesce(v_code, '5299');
      select c.title into v_title
      from public.acc_chart c
      where c.code = v_code and (c.business_id = v_biz or c.business_id is null)
      order by c.business_id nulls last
      limit 1;
      v_title := coalesce(v_title, coalesce(v_rec.category, 'سایر هزینه‌ها'));
      perform public.acc_ensure_chart(v_biz, v_code, v_title, 'expense');
      perform public.acc_ensure_chart(v_biz, '2103', 'اعتبار مالیات و عوارض ارزش افزوده', 'asset');
      perform public.acc_ensure_chart(v_biz, '2101', 'حساب‌های پرداختنی تجاری', 'liability');
      v_lines := jsonb_build_array(
        jsonb_build_object('account_code', v_code, 'account_title', v_title, 'debit', v_net, 'credit', 0, 'line_desc', v_rec.category),
        jsonb_build_object('account_code', '2103', 'account_title', 'اعتبار مالیات و عوارض ارزش افزوده', 'debit', v_vat, 'credit', 0, 'line_desc', 'اعتبار مالیات هزینه')
      );
      if v_rec.is_paid and v_rec.account_id is not null then
        select kind into v_acc_kind from public.acc_accounts where id = v_rec.account_id;
        v_cash_code := case when v_acc_kind = 'cash' then '1101' else '1102' end;
        perform public.acc_ensure_chart(v_biz, v_cash_code, case when v_cash_code = '1101' then 'موجودی نقد و بانک — صندوق' else 'موجودی نقد و بانک — بانک' end, 'asset');
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('account_code', v_cash_code, 'account_title', case when v_cash_code = '1101' then 'موجودی نقد و بانک — صندوق' else 'موجودی نقد و بانک — بانک' end, 'debit', 0, 'credit', v_total, 'line_desc', 'پرداخت هزینه')
        );
      else
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('account_code', '2101', 'account_title', 'حساب‌های پرداختنی تجاری', 'debit', 0, 'credit', v_total, 'partner_id', v_rec.partner_id, 'line_desc', 'هزینه پرداخت‌نشده')
        );
      end if;
    end;

  elsif p_kind = 'transaction' then
    select * into v_rec from public.acc_transactions where id = p_ref_id;
    if not found then raise exception 'تراکنش یافت نشد'; end if;
    v_biz := v_rec.business_id;
    if not public.acc_perm_ok(v_biz, 'payments.manage') then raise exception 'اجازهٔ ثبت دریافت/پرداخت را ندارید'; end if;
    if v_rec.voided_at is not null then return null; end if;
    select id into v_exists from public.acc_journal
    where business_id = v_biz and ref_type = 'transaction' and ref_id = p_ref_id and voided_at is null limit 1;
    if v_exists is not null then return v_exists; end if;

    v_total := coalesce(v_rec.amount, 0);
    v_date := v_rec.date_g;
    v_cash_code := '1101';
    if v_rec.account_id is not null then
      select kind into v_acc_kind from public.acc_accounts where id = v_rec.account_id;
      v_cash_code := case when v_acc_kind = 'cash' then '1101' else '1102' end;
    end if;
    perform public.acc_ensure_chart(v_biz, v_cash_code, case when v_cash_code = '1101' then 'موجودی نقد و بانک — صندوق' else 'موجودی نقد و بانک — بانک' end, 'asset');
    perform public.acc_ensure_chart(v_biz, '1103', 'حساب‌های دریافتنی تجاری', 'asset');
    perform public.acc_ensure_chart(v_biz, '2101', 'حساب‌های پرداختنی تجاری', 'liability');
    if v_rec.kind = 'receipt' then
      v_desc := 'دریافت: ' || coalesce(v_rec.description, '');
      v_lines := jsonb_build_array(
        jsonb_build_object('account_code', v_cash_code, 'account_title', case when v_cash_code = '1101' then 'موجودی نقد و بانک — صندوق' else 'موجودی نقد و بانک — بانک' end, 'debit', v_total, 'credit', 0, 'line_desc', 'دریافت وجه'),
        jsonb_build_object('account_code', '1103', 'account_title', 'حساب‌های دریافتنی تجاری', 'debit', 0, 'credit', v_total, 'partner_id', v_rec.partner_id, 'line_desc', 'تسویه مطالبات')
      );
    else
      v_desc := 'پرداخت: ' || coalesce(v_rec.description, '');
      v_lines := jsonb_build_array(
        jsonb_build_object('account_code', '2101', 'account_title', 'حساب‌های پرداختنی تجاری', 'debit', v_total, 'credit', 0, 'partner_id', v_rec.partner_id, 'line_desc', 'تسویه بدهی'),
        jsonb_build_object('account_code', v_cash_code, 'account_title', case when v_cash_code = '1101' then 'موجودی نقد و بانک — صندوق' else 'موجودی نقد و بانک — بانک' end, 'debit', 0, 'credit', v_total, 'line_desc', 'پرداخت وجه')
      );
    end if;
  end if;

  v_no := public.acc_next_entry_no(v_biz);
  insert into public.acc_journal (business_id, entry_no, date_g, ref_type, ref_action, ref_id, description)
  values (v_biz, v_no, v_date, p_kind, 'post', p_ref_id, v_desc)
  returning id into v_id;

  insert into public.acc_journal_lines (entry_id, business_id, account_code, account_title, debit, credit, line_desc, partner_id)
  select v_id, v_biz,
         r ->> 'account_code', coalesce(r ->> 'account_title', r ->> 'account_code'),
         (r ->> 'debit')::bigint, (r ->> 'credit')::bigint,
         r ->> 'line_desc', (r ->> 'partner_id')::uuid
  from jsonb_array_elements(v_lines) r;

  return v_id;
end $$;

grant execute on function public.acc_post_document(text, uuid) to authenticated;
revoke all on function public.acc_post_document(text, uuid) from public, anon;
revoke all on function public.acc_ensure_chart(uuid, text, text, text) from public, anon, authenticated;

-- ══════════════════════ §10 پالیسی‌های RLS با مجوز ریزدانه ══════════════════════
-- پالیسی‌های «member all» نسخهٔ v7 نوشتن را برای viewer هم باز می‌گذاشتند.
-- تفکیک: SELECT برای همهٔ اعضا · نوشتن برای owner/accountant (+ مجوز مربوطه)
-- نکته سازگاری: تا وقتی مالک مجوزها را پیکربندی نکرده، حسابدار مثل قبل دسترسی کامل دارد.

do $$
declare t text;
begin
  -- ۱۰.۱ تفصیلی شناور — نوشتن فقط owner/accountant
  execute 'drop policy if exists "acc details member all" on public.acc_details';
  execute 'drop policy if exists "acc details member select" on public.acc_details';
  execute $f$create policy "acc details member select" on public.acc_details
    for select to authenticated
    using (public.acc_is_member(business_id))$f$;
  execute 'drop policy if exists "acc details member write" on public.acc_details';
  execute $f$create policy "acc details member write" on public.acc_details
    for all to authenticated
    using (public.acc_role_of(business_id) in ('owner','accountant'))
    with check (public.acc_role_of(business_id) in ('owner','accountant'))$f$;

  -- ۱۰.۲ ضمائم — نوشتن با مجوز attachments.manage
  execute 'drop policy if exists "acc attach member all" on public.acc_attachments';
  execute 'drop policy if exists "acc attach member select" on public.acc_attachments';
  execute $f$create policy "acc attach member select" on public.acc_attachments
    for select to authenticated
    using (public.acc_is_member(business_id))$f$;
  execute 'drop policy if exists "acc attach member write" on public.acc_attachments';
  execute $f$create policy "acc attach member write" on public.acc_attachments
    for all to authenticated
    using (public.acc_perm_ok(business_id, 'attachments.manage'))
    with check (public.acc_perm_ok(business_id, 'attachments.manage'))$f$;

  -- ۱۰.۳ تنخواه و عملیاتش — مجوز petty.manage
  execute 'drop policy if exists "acc petty member all" on public.acc_petty';
  execute 'drop policy if exists "acc petty member select" on public.acc_petty';
  execute $f$create policy "acc petty member select" on public.acc_petty
    for select to authenticated
    using (public.acc_is_member(business_id))$f$;
  execute 'drop policy if exists "acc petty member write" on public.acc_petty';
  execute $f$create policy "acc petty member write" on public.acc_petty
    for all to authenticated
    using (public.acc_perm_ok(business_id, 'petty.manage'))
    with check (public.acc_perm_ok(business_id, 'petty.manage'))$f$;

  execute 'drop policy if exists "acc pettyops member all" on public.acc_petty_ops';
  execute 'drop policy if exists "acc pettyops member select" on public.acc_petty_ops';
  execute $f$create policy "acc pettyops member select" on public.acc_petty_ops
    for select to authenticated
    using (public.acc_is_member(business_id))$f$;
  execute 'drop policy if exists "acc pettyops member write" on public.acc_petty_ops';
  execute $f$create policy "acc pettyops member write" on public.acc_petty_ops
    for all to authenticated
    using (public.acc_perm_ok(business_id, 'petty.manage'))
    with check (public.acc_perm_ok(business_id, 'petty.manage'))$f$;

  -- ۱۰.۴ پیش‌دریافت/پیش‌پرداخت — مجوز prepay.manage
  execute 'drop policy if exists "acc prepay member all" on public.acc_prepayments';
  execute 'drop policy if exists "acc prepay member select" on public.acc_prepayments';
  execute $f$create policy "acc prepay member select" on public.acc_prepayments
    for select to authenticated
    using (public.acc_is_member(business_id))$f$;
  execute 'drop policy if exists "acc prepay member write" on public.acc_prepayments';
  execute $f$create policy "acc prepay member write" on public.acc_prepayments
    for all to authenticated
    using (public.acc_perm_ok(business_id, 'prepay.manage'))
    with check (public.acc_perm_ok(business_id, 'prepay.manage'))$f$;

  -- ۱۰.۵ خطوط بانک — مجوز recon.manage
  execute 'drop policy if exists "acc banklines member all" on public.acc_bank_lines';
  execute 'drop policy if exists "acc banklines member select" on public.acc_bank_lines';
  execute $f$create policy "acc banklines member select" on public.acc_bank_lines
    for select to authenticated
    using (public.acc_is_member(business_id))$f$;
  execute 'drop policy if exists "acc banklines member write" on public.acc_bank_lines';
  execute $f$create policy "acc banklines member write" on public.acc_bank_lines
    for all to authenticated
    using (public.acc_perm_ok(business_id, 'recon.manage'))
    with check (public.acc_perm_ok(business_id, 'recon.manage'))$f$;

  -- ۱۰.۶ دورهٔ مالی — نوشتن با مجوز fiscal.close
  execute 'drop policy if exists "acc fy member all" on public.acc_fiscal_years';
  execute 'drop policy if exists "acc fy member select" on public.acc_fiscal_years';
  execute $f$create policy "acc fy member select" on public.acc_fiscal_years
    for select to authenticated
    using (public.acc_is_member(business_id))$f$;
  execute 'drop policy if exists "acc fy member write" on public.acc_fiscal_years';
  execute $f$create policy "acc fy member write" on public.acc_fiscal_years
    for all to authenticated
    using (public.acc_perm_ok(business_id, 'fiscal.close'))
    with check (public.acc_perm_ok(business_id, 'fiscal.close'))$f$;

  -- ۱۰.۷ مغایرت‌گیری — نوشتن با مجوز recon.manage
  execute 'drop policy if exists "acc recon member write" on public.acc_reconciliations';
  execute $f$create policy "acc recon member write" on public.acc_reconciliations
    for all to authenticated
    using (public.acc_perm_ok(business_id, 'recon.manage'))
    with check (public.acc_perm_ok(business_id, 'recon.manage'))$f$;

  raise notice 'پالیسی‌های RLS ریزدانه بازسازی شدند';
end $$;

-- ۱۰.۸ سقف نقش روی UPDATE سند: viewer نباید بتواند حتی voided_at/attachment را عوض کند
drop policy if exists "acc journal upd role" on public.acc_journal;
create policy "acc journal upd role" on public.acc_journal
  as restrictive for update to authenticated
  using (public.acc_role_of(business_id) in ('owner','accountant') or public.acc_sys_admin());

-- ۱۰.۹ سقف نقش روی DELETE سند (دفاع دوم پشت تریگر §4)
drop policy if exists "acc journal del role" on public.acc_journal;
create policy "acc journal del role" on public.acc_journal
  as restrictive for delete to authenticated
  using (public.acc_role_of(business_id) in ('owner','accountant') or public.acc_sys_admin());

-- ══════════════════════ §11 قفل حذف فاکتور صادره ══════════════════════
-- فاکتور صادره/ابطال‌شده (posted_at ثبت‌شده) حذف نمی‌شود — فقط پیش‌نویس.
create or replace function public.acc_invoice_delete_guard()
returns trigger
language plpgsql
as $$
begin
  if current_user <> 'authenticated' then return old; end if;
  if pg_trigger_depth() > 1 then return old; end if; -- حذف آبشاری کسب‌وکار
  if old.posted_at is not null then
    raise exception 'صورتحساب صادره قابل حذف نیست — برای اصلاح آن را ابطال کنید';
  end if;
  return old;
end $$;

drop trigger if exists acc_invoice_delete_guard_tr on public.acc_invoices;
create trigger acc_invoice_delete_guard_tr
  before delete on public.acc_invoices
  for each row execute function public.acc_invoice_delete_guard();

-- ══════════════════════ §12 باکت خصوصی ضمائم مالی ══════════════════════
-- اسناد مالی (پیوست فاکتور/سند/رسید هزینه) در باکت خصوصی acc-attach با مسیر {business_id}/…
-- لوگو/امضا/مهر (برندینگ چاپی) در acc-media باقی می‌مانند (عمومی — سند مالی نیستند).
insert into storage.buckets (id, name, public)
values ('acc-attach', 'acc-attach', false)
on conflict (id) do update set public = false;

-- مسیر {business_id}/… باید متعلق به همان کسب‌وکاری باشد که عضوش هستیم
create or replace function public.acc_attach_biz_of(p_name text)
returns uuid
language plpgsql
immutable as $$
begin
  return ((storage.foldername(p_name))[1])::uuid;
exception when others then
  return null;
end $$;

drop policy if exists "acc attach storage read" on storage.objects;
create policy "acc attach storage read" on storage.objects
  for select to authenticated
  using (bucket_id = 'acc-attach' and public.acc_is_member(public.acc_attach_biz_of(name)));

drop policy if exists "acc attach storage write" on storage.objects;
create policy "acc attach storage write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'acc-attach' and public.acc_perm_ok(public.acc_attach_biz_of(name), 'attachments.manage'));

drop policy if exists "acc attach storage update" on storage.objects;
create policy "acc attach storage update" on storage.objects
  for update to authenticated
  using (bucket_id = 'acc-attach' and public.acc_perm_ok(public.acc_attach_biz_of(name), 'attachments.manage'))
  with check (bucket_id = 'acc-attach' and public.acc_perm_ok(public.acc_attach_biz_of(name), 'attachments.manage'));

drop policy if exists "acc attach storage delete" on storage.objects;
create policy "acc attach storage delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'acc-attach' and public.acc_perm_ok(public.acc_attach_biz_of(name), 'attachments.manage'));

-- ══════════════════════ §13 رفع CHECK مغایرت بانکی ══════════════════════
-- اپ مقادیر needs_doc و ignored می‌نویسد ولی CHECK فقط ۴ مقدار را می‌پذیرفت.
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any(con.conkey)
    where con.conrelid = 'public.acc_bank_lines'::regclass
      and con.contype = 'c'
      and att.attname = 'match_status'
  loop
    execute format('alter table public.acc_bank_lines drop constraint %I', c.conname);
    raise notice 'dropped bank match_status constraint: %', c.conname;
  end loop;
end $$;

alter table public.acc_bank_lines
  add constraint acc_bank_lines_match_status_chk
  check (match_status in ('unmatched', 'auto', 'manual', 'onbook', 'needs_doc', 'ignored'));

-- ══════════════════════ پایان مایگریشن ══════════════════════
-- یادآوری: این فایل idempotent است و می‌توان آن را مجدداً اجرا کرد.
-- پس از اجرا: npm run test:acc  →  کل مجموعهٔ تست زنده باید سبز شود.
