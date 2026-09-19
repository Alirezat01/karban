-- ═══════════════════════════════════════════════════════════════════
-- sql-4: رفع یافته‌های حسابرسی خودکار (نسخه ۱۴۰۴/۰۶/۲۷)
-- اجرا: Supabase Dashboard → SQL Editor → کل فایل را paste و Run کن
-- کاملاً idempotent است — چندبار اجرا هم بی‌ضرر است
-- ═══════════════════════════════════════════════════════════════════

-- ───────────── ۱) رفع ریشه‌ای «ذخیره ناموفق هنگام صدور فاکتور» ─────────────
-- قید CHECK قدیمی روی ستون status جدول acc_invoices مقدار «issued» را نداشت؛
-- بنابراین هر بار «صدور نهایی» فاکتور از سمت برنامه رد می‌شد.
-- هر CHECK موجود روی ستون status حذف و با فهرست کامل مقادیر برنامه ساخته می‌شود.
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any(con.conkey)
    where con.conrelid = 'public.acc_invoices'::regclass
      and con.contype = 'c'
      and att.attname = 'status'
  loop
    execute format('alter table public.acc_invoices drop constraint %I', c.conname);
    raise notice 'dropped status constraint: %', c.conname;
  end loop;
end $$;

alter table public.acc_invoices
  add constraint acc_invoices_status_check
  check (status in ('draft', 'issued', 'final', 'partial', 'paid', 'cancelled'));

-- ───────────── ۲) جدول مغایرت‌گیری بانکی (اگر موجود نیست) ─────────────
create table if not exists public.acc_reconciliations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.acc_businesses(id) on delete cascade,
  account_id uuid references public.acc_accounts(id) on delete set null,
  statement_date_g date,
  statement_balance bigint default 0,
  book_balance bigint default 0,
  difference bigint default 0,
  reconciled boolean default false,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.acc_reconciliations enable row level security;

drop policy if exists "acc recon member select" on public.acc_reconciliations;
create policy "acc recon member select" on public.acc_reconciliations
  for select to authenticated
  using (
    exists (
      select 1 from public.acc_access a
      where a.business_id = acc_reconciliations.business_id
        and a.user_id = auth.uid()
        and a.status in ('active','trial')
        and (a.expires_at is null or a.expires_at > now())
    )
  );

drop policy if exists "acc recon member write" on public.acc_reconciliations;
create policy "acc recon member write" on public.acc_reconciliations
  for all to authenticated
  using (
    exists (
      select 1 from public.acc_access a
      where a.business_id = acc_reconciliations.business_id
        and a.user_id = auth.uid()
        and a.status in ('active','trial')
        and (a.expires_at is null or a.expires_at > now())
    )
  )
  with check (
    exists (
      select 1 from public.acc_access a
      where a.business_id = acc_reconciliations.business_id
        and a.user_id = auth.uid()
        and a.status in ('active','trial')
        and (a.expires_at is null or a.expires_at > now())
    )
  );

-- ───────────── ۳) ستون‌های گمشده احتمالی طبق حسابرسی (idempotent) ─────────────
-- اگر مایگریشن 20260917 هنوز اجرا نشده بود، ستون‌های نسخه۲ طرف‌حساب:
alter table public.acc_partners add column if not exists shenase_melli text;
alter table public.acc_partners add column if not exists registration_number text;
alter table public.acc_partners add column if not exists province text;
alter table public.acc_partners add column if not exists county text;
alter table public.acc_partners add column if not exists city text;
alter table public.acc_partners add column if not exists fax text;

-- اعلان پایان
do $$ begin
  raise notice '✅ sql-4 اجرا شد: قید status اصلاح شد، acc_reconciliations ساخته شد، ستون‌های نسخه۲ تضمین شدند';
end $$;
