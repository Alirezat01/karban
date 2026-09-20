-- جداول نسخهٔ ۵/۶ که فقط روی زندهٔ Supabase ساخته شده‌اند (بوت‌استرپ محیط تست)
create table if not exists public.acc_projects (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.acc_businesses(id) on delete cascade,
  name text not null, code text, partner_id uuid references public.acc_partners(id) on delete set null,
  status text default 'active', budget bigint default 0,
  start_date_g date, end_date_g date, description text,
  created_at timestamptz default now()
);
create table if not exists public.acc_contracts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.acc_businesses(id) on delete cascade,
  title text not null, partner_id uuid references public.acc_partners(id) on delete set null,
  project_id uuid references public.acc_projects(id) on delete set null,
  amount bigint default 0, vat_rate numeric default 10, status text default 'draft',
  start_date_g date, end_date_g date, description text, created_at timestamptz default now()
);
create table if not exists public.acc_employees (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.acc_businesses(id) on delete cascade,
  name text not null, national_id text, personnel_code text, position text,
  hire_date_g date, base_salary bigint default 0, housing_allowance bigint default 0,
  food_allowance bigint default 0, child_allowance bigint default 0, child_count int default 0,
  insurance_number text, bank_account text, active boolean default true,
  notes text, created_at timestamptz default now()
);
create table if not exists public.acc_payrolls (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.acc_businesses(id) on delete cascade,
  employee_id uuid references public.acc_employees(id) on delete cascade,
  jyear int, jmonth int, work_days int default 0, overtime_hours int default 0,
  base_salary bigint default 0, food_allowance bigint default 0, housing_allowance bigint default 0,
  family_allowance bigint default 0, overtime_pay bigint default 0, gross bigint default 0,
  insurance_employee bigint default 0, tax bigint default 0, other_deductions bigint default 0,
  net bigint default 0, paid boolean default false, account_id uuid, pay_date_g date,
  description text, created_at timestamptz default now()
);
create table if not exists public.acc_assets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.acc_businesses(id) on delete cascade,
  name text not null, category text, purchase_date_g date, purchase_amount bigint default 0,
  useful_life_years int default 1, salvage_value bigint default 0, account_id uuid,
  status text default 'active', sell_amount bigint, sell_date_g date, notes text,
  created_at timestamptz default now()
);
create table if not exists public.acc_recurring (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.acc_businesses(id) on delete cascade,
  title text not null, category text, amount bigint default 0, vat_amount bigint default 0,
  frequency text default 'monthly', next_date_g date, account_id uuid, partner_id uuid,
  auto_create boolean default true, active boolean default true, last_created_date_g date,
  description text, created_at timestamptz default now()
);
create table if not exists public.acc_checks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.acc_businesses(id) on delete cascade,
  kind text not null default 'received', partner_id uuid, account_id uuid, invoice_id uuid,
  amount bigint default 0, serial_no text, bank_name text, branch text,
  issue_date_g date, due_date_g date, status text default 'in_hand',
  description text, created_by uuid, created_at timestamptz default now()
);
create table if not exists public.acc_activity (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.acc_businesses(id) on delete cascade,
  user_id uuid, user_email text, action text, entity text, entity_id uuid,
  detail text, created_at timestamptz default now()
);
create table if not exists public.acc_expense_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.acc_businesses(id) on delete cascade,
  title text not null, code text, position int default 0, created_at timestamptz default now()
);

-- ستون‌های نسخهٔ ۶ که فقط روی زنده وجود دارند
alter table public.acc_expenses add column if not exists project_id uuid references public.acc_projects(id) on delete set null;
alter table public.acc_expenses add column if not exists created_by uuid;
alter table public.acc_invoices add column if not exists account_id uuid references public.acc_accounts(id) on delete set null;
