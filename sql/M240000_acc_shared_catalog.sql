-- ═══════════════════════════════════════════════════════════════════════════
-- M240000 — کاتالوگ مشترک شناسهٔ کالا و خدمات (سامانه مودیان) — بارگذاری فقط از مسیر ادمین
-- ═══════════════════════════════════════════════════════════════════════════
-- RCA (درخواست مالک): جدول acc_stuff_catalog از قبل «مشترک» است (بدون business_id)،
-- اما RLS آن بسته نبود و هر کاربر خودش فایل XML را بارگذاری می‌کرد.
-- این مایگریشن: خواندن برای همهٔ کاربران واردشده؛ نوشتن فقط ادمین سایت
-- (profiles.role = 'admin'). همهٔ کاربران از یک کاتالوگ واحد استفاده می‌کنند.
-- قابل اجرای مجدد. ترتیب: بعد از M230000 (یا هر زمان — مستقل از بقیه).
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ §۱) جدول اگر نبود بساز (سازگاری با دیتابیس‌هایی که جدول را ندارند) ═══
create table if not exists public.acc_stuff_catalog (
  id text primary key,
  description text not null,
  type_name text,
  vat numeric default 0,
  taxable boolean default true,
  is_general boolean default true,
  shamsi_date text,
  updated_at timestamptz default now()
);

-- ═══ §۲) RLS روشن + حذف سیاست‌های قبلی (هر نامی که بوده باشند) ═══
alter table public.acc_stuff_catalog enable row level security;

do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
     where schemaname = 'public' and tablename = 'acc_stuff_catalog'
  loop
    execute format('drop policy if exists %I on public.acc_stuff_catalog', r.policyname);
    raise notice 'سیاست قبلی حذف شد: %', r.policyname;
  end loop;
end $$;

-- ═══ §۳) سیاست‌ها: خواندن همهٔ کاربران واردشده؛ نوشتن فقط ادمین سایت ═══
create policy acc_stuff_catalog_read_all
  on public.acc_stuff_catalog
  for select to authenticated
  using (true);

create policy acc_stuff_catalog_admin_insert
  on public.acc_stuff_catalog
  for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy acc_stuff_catalog_admin_update
  on public.acc_stuff_catalog
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy acc_stuff_catalog_admin_delete
  on public.acc_stuff_catalog
  for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ═══ §۴) شاخص جست‌وجوی شرح (پرفورمنس پیکر کاتالوگ) ═══
create index if not exists acc_stuff_catalog_desc_idx on public.acc_stuff_catalog (description);

-- ═══ §۵) POSTCHECK ═══
do $$
declare
  v_policies int;
  v_rls boolean;
begin
  select exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where c.relname = 'acc_stuff_catalog' and n.nspname = 'public' and c.relrowsecurity
  ) into v_rls;
  if not v_rls then raise exception 'POSTCHECK §۲ ناموفق — RLS فعال نشد'; end if;
  raise notice 'POSTCHECK §۲ RLS: OK';

  select count(*) into v_policies from pg_policies
   where schemaname = 'public' and tablename = 'acc_stuff_catalog';
  if v_policies < 4 then raise exception 'POSTCHECK §۳ ناموفق — فقط % سیاست نصب شد (انتظار ۴)', v_policies; end if;
  raise notice 'POSTCHECK §۳ سیاست‌ها: OK (% سیاست)', v_policies;

  raise notice 'POSTCHECK M240000: کاتالوگ مشترک مودیان — خواندن همه، نوشتن فقط ادمین';
end $$;
