-- ═════════════════════════════════════════════════════════════════════
-- sql-5: ارتقای بزرگ حسابداری کاربان — نسخه حرفه‌ای (۱۴۰۵/۰۶/۲۷)
--
-- اجرا: Supabase Dashboard → SQL Editor → کل فایل را Paste و Run کن
-- کاملاً idempotent است — چندبار اجرا بی‌ضرر است
--
-- این فایل شامل:
--   بخش ۰) رفع قطعی خطای «صدور فاکتور» (قید CHECK قدیمی status) + RLS مغایرت‌گیری
--          ⚠️ اگر sql-4 قبلی را اجرا نکرده‌اید، این بخش جایگزین آن است
--   بخش ۱) کدینگ چندسطحی کل ← معین ← تفصیلی (parent_id, level, is_leaf)
--   بخش ۲) تفصیلی شناور (acc_details)
--   بخش ۳) ردیف سند حرفه‌ای (project_id, detail_id, line_desc) + ابطال سند
--   بخش ۴) ضمائم همه اسناد (acc_attachments)
--   بخش ۵) تنخواه‌گردان (acc_petty + acc_petty_ops)
--   بخش ۶) پیش‌دریافت و پیش‌پرداخت (acc_prepayments)
--   بخش ۷) مغایرت بانکی واقعی (acc_bank_lines — گردآوری صورت‌حساب بانک و تطبیق)
--   بخش ۸) دوره مالی سالانه (acc_fiscal_years — بستن/افتتاح)
--   بخش ۹) ابطال (voided_at) برای همه اسناد + استرداد فاکتور (return_of) + پیشرفت پروژه
--   بخش ۱۰) کنترل دسترسی ریزدانه (acc_access.perms jsonb)
--   بخش ۱۱) اندیس‌ها و اعتبارسنجی نهایی
-- ═════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- بخش ۰) رفع قطعی B15 و B40 حسابرسی
-- ─────────────────────────────────────────────────────────────────────

-- ۰-۱) حذف همه قیدهای CHECK قدیمی روی acc_invoices.status (مقدار issued را نمی‌شناسند)
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
    raise notice 'dropped old status constraint: %', c.conname;
  end loop;
end $$;

alter table public.acc_invoices
  add constraint acc_invoices_status_check
  check (status in ('draft', 'issued', 'final', 'partial', 'paid', 'cancelled'));

-- ۰-۲) جدول مغایرت‌گیری (اگر موجود نیست) + ستون‌های جدید تطبیق واقعی
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

-- ─────────────────────────────────────────────────────────────────────
-- بخش ۱) کدینگ چندسطحی: کل (level 1) ← معین (level 2) ← تفصیلی (level 3)
-- ─────────────────────────────────────────────────────────────────────
alter table public.acc_chart add column if not exists parent_id uuid references public.acc_chart(id) on delete cascade;
alter table public.acc_chart add column if not exists level int default 1;
alter table public.acc_chart add column if not exists is_leaf boolean default true;
alter table public.acc_chart add column if not exists nature text default 'debit';
alter table public.acc_chart add column if not exists active boolean default true;

-- سرفصل‌های موجود سیستم/قبلی → سطح کل
update public.acc_chart set level = 1, is_leaf = true where level is null;
update public.acc_chart set nature = 'credit' where nature is null and (kind = 'liability' or kind = 'equity' or kind = 'income');
update public.acc_chart set nature = 'debit' where nature is null;

create index if not exists acc_chart_parent_idx on public.acc_chart(parent_id);
create index if not exists acc_chart_biz_level_idx on public.acc_chart(business_id, level);

-- ─────────────────────────────────────────────────────────────────────
-- بخش ۲) تفصیلی شناور — طرف‌حساب‌های آزاد روی هر ردیف سند
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.acc_details (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.acc_businesses(id) on delete cascade,
  code text,
  title text not null,
  kind text not null default 'other'
    check (kind in ('customer','supplier','employee','project','bank','partner','other')),
  ref_id uuid,
  active boolean default true,
  created_at timestamptz default now()
);
alter table public.acc_details enable row level security;
create index if not exists acc_details_biz_idx on public.acc_details(business_id);

-- ─────────────────────────────────────────────────────────────────────
-- بخش ۳) ردیف سند حرفه‌ای + ابطال سند
-- ─────────────────────────────────────────────────────────────────────
alter table public.acc_journal_lines add column if not exists detail_id uuid references public.acc_details(id) on delete set null;
alter table public.acc_journal_lines add column if not exists project_id uuid references public.acc_projects(id) on delete set null;
alter table public.acc_journal_lines add column if not exists line_desc text;
alter table public.acc_journal add column if not exists voided_at timestamptz;
alter table public.acc_journal add column if not exists void_reason text;
alter table public.acc_journal add column if not exists reversal_of uuid references public.acc_journal(id) on delete set null;
alter table public.acc_journal add column if not exists attachment_url text;

create index if not exists acc_journal_lines_entry_idx on public.acc_journal_lines(entry_id);
create index if not exists acc_journal_lines_code_idx on public.acc_journal_lines(business_id, account_code);
create index if not exists acc_journal_lines_proj_idx on public.acc_journal_lines(project_id);

-- ─────────────────────────────────────────────────────────────────────
-- بخش ۴) ضمائم همه اسناد
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.acc_attachments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.acc_businesses(id) on delete cascade,
  entity_type text not null
    check (entity_type in ('invoice','journal','transaction','check','contract','expense','payroll','asset','prepay','petty','project')),
  entity_id uuid not null,
  title text,
  file_url text not null,
  file_name text,
  file_size int,
  uploaded_by uuid,
  created_at timestamptz default now()
);
alter table public.acc_attachments enable row level security;
create index if not exists acc_attachments_entity_idx on public.acc_attachments(business_id, entity_type, entity_id);

-- ─────────────────────────────────────────────────────────────────────
-- بخش ۵) تنخواه‌گردان
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.acc_petty (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.acc_businesses(id) on delete cascade,
  name text not null,
  custodian text,
  source_account_id uuid references public.acc_accounts(id) on delete set null,
  charge_total bigint default 0,
  spent_total bigint default 0,
  settled_total bigint default 0,
  status text default 'open' check (status in ('open','settled','closed')),
  voided_at timestamptz,
  void_reason text,
  description text,
  created_at timestamptz default now()
);

create table if not exists public.acc_petty_ops (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.acc_businesses(id) on delete cascade,
  petty_id uuid not null references public.acc_petty(id) on delete cascade,
  kind text not null check (kind in ('charge','spend','settle')),
  amount bigint not null default 0,
  date_g date not null default current_date,
  chart_code text,
  chart_title text,
  description text,
  journal_id uuid references public.acc_journal(id) on delete set null,
  created_by uuid,
  created_at timestamptz default now()
);
alter table public.acc_petty enable row level security;
alter table public.acc_petty_ops enable row level security;
create index if not exists acc_petty_biz_idx on public.acc_petty(business_id);
create index if not exists acc_petty_ops_petty_idx on public.acc_petty_ops(petty_id);

-- ─────────────────────────────────────────────────────────────────────
-- بخش ۶) پیش‌دریافت و پیش‌پرداخت — جدا از بدهی/طلب عادی
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.acc_prepayments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.acc_businesses(id) on delete cascade,
  kind text not null check (kind in ('advance_received','advance_paid')),
  partner_id uuid references public.acc_partners(id) on delete set null,
  account_id uuid references public.acc_accounts(id) on delete set null,
  amount bigint not null default 0,
  allocated_amount bigint default 0,
  date_g date not null default current_date,
  status text default 'open' check (status in ('open','allocated','refunded','void')),
  invoice_id uuid references public.acc_invoices(id) on delete set null,
  expense_id uuid references public.acc_expenses(id) on delete set null,
  description text,
  journal_id uuid references public.acc_journal(id) on delete set null,
  voided_at timestamptz,
  void_reason text,
  created_by uuid,
  created_at timestamptz default now()
);
alter table public.acc_prepayments enable row level security;
create index if not exists acc_prepay_biz_idx on public.acc_prepayments(business_id, kind);

-- ─────────────────────────────────────────────────────────────────────
-- بخش ۷) مغایرت بانکی واقعی — خطوط صورت‌حساب بانک + تطبیق
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.acc_bank_lines (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.acc_businesses(id) on delete cascade,
  account_id uuid not null references public.acc_accounts(id) on delete cascade,
  date_g date not null,
  description text,
  ref_no text,
  amount bigint not null default 0,          -- + واریز / - برداشت
  match_status text default 'unmatched' check (match_status in ('unmatched','auto','manual','onbook')),
  match_entity_type text,
  match_entity_id uuid,
  matched_at timestamptz,
  batch_id uuid,
  created_at timestamptz default now()
);
alter table public.acc_bank_lines enable row level security;
create index if not exists acc_bank_lines_acct_idx on public.acc_bank_lines(business_id, account_id, date_g);

-- ─────────────────────────────────────────────────────────────────────
-- بخش ۸) دوره مالی سالانه — بستن و افتتاح
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.acc_fiscal_years (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.acc_businesses(id) on delete cascade,
  jyear int not null,
  status text default 'open' check (status in ('open','closed')),
  opening_entry_id uuid references public.acc_journal(id) on delete set null,
  closing_entry_id uuid references public.acc_journal(id) on delete set null,
  closed_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  unique (business_id, jyear)
);
alter table public.acc_fiscal_years enable row level security;
create index if not exists acc_fy_biz_idx on public.acc_fiscal_years(business_id, jyear);

-- ─────────────────────────────────────────────────────────────────────
-- بخش ۹) ابطال همه اسناد + استرداد فاکتور + پیشرفت پروژه
-- ─────────────────────────────────────────────────────────────────────
alter table public.acc_invoices   add column if not exists voided_at timestamptz;
alter table public.acc_invoices   add column if not exists void_reason text;
alter table public.acc_invoices   add column if not exists return_of uuid references public.acc_invoices(id) on delete set null;
alter table public.acc_invoices   add column if not exists project_id uuid references public.acc_projects(id) on delete set null;
alter table public.acc_invoices   add column if not exists posting_note text;
alter table public.acc_expenses   add column if not exists voided_at timestamptz;
alter table public.acc_expenses   add column if not exists void_reason text;
alter table public.acc_transactions add column if not exists voided_at timestamptz;
alter table public.acc_transactions add column if not exists void_reason text;
alter table public.acc_checks     add column if not exists voided_at timestamptz;
alter table public.acc_checks     add column if not exists void_reason text;
alter table public.acc_contracts  add column if not exists voided_at timestamptz;
alter table public.acc_contracts  add column if not exists void_reason text;
alter table public.acc_projects   add column if not exists progress int default 0;
alter table public.acc_projects   add column if not exists overhead_rate numeric default 0;
alter table public.acc_projects   add column if not exists indirect_cost bigint default 0;

-- ─────────────────────────────────────────────────────────────────────
-- بخش ۱۰) کنترل دسترسی ریزدانه — مجوز عملیاتی روی ردیف دسترسی
-- ─────────────────────────────────────────────────────────────────────
alter table public.acc_access add column if not exists perms jsonb default '{}'::jsonb;

-- ─────────────────────────────────────────────────────────────────────
-- RLS همه جداول جدید — الگوی عضو کسب‌وکار (active/trial)
-- ─────────────────────────────────────────────────────────────────────
-- الگو: عضو فعال/آزمایشی کسب‌وکار = دسترسی کامل
drop policy if exists "acc details member all" on public.acc_details;
create policy "acc details member all" on public.acc_details
  for all to authenticated
  using (exists (select 1 from public.acc_access a
    where a.business_id = acc_details.business_id and a.user_id = auth.uid()
      and a.status in ('active','trial') and (a.expires_at is null or a.expires_at > now())))
  with check (exists (select 1 from public.acc_access a
    where a.business_id = acc_details.business_id and a.user_id = auth.uid()
      and a.status in ('active','trial') and (a.expires_at is null or a.expires_at > now())));

drop policy if exists "acc attach member all" on public.acc_attachments;
create policy "acc attach member all" on public.acc_attachments
  for all to authenticated
  using (exists (select 1 from public.acc_access a
    where a.business_id = acc_attachments.business_id and a.user_id = auth.uid()
      and a.status in ('active','trial') and (a.expires_at is null or a.expires_at > now())))
  with check (exists (select 1 from public.acc_access a
    where a.business_id = acc_attachments.business_id and a.user_id = auth.uid()
      and a.status in ('active','trial') and (a.expires_at is null or a.expires_at > now())));

drop policy if exists "acc petty member all" on public.acc_petty;
create policy "acc petty member all" on public.acc_petty
  for all to authenticated
  using (exists (select 1 from public.acc_access a
    where a.business_id = acc_petty.business_id and a.user_id = auth.uid()
      and a.status in ('active','trial') and (a.expires_at is null or a.expires_at > now())))
  with check (exists (select 1 from public.acc_access a
    where a.business_id = acc_petty.business_id and a.user_id = auth.uid()
      and a.status in ('active','trial') and (a.expires_at is null or a.expires_at > now())));

drop policy if exists "acc pettyops member all" on public.acc_petty_ops;
create policy "acc pettyops member all" on public.acc_petty_ops
  for all to authenticated
  using (exists (select 1 from public.acc_access a
    where a.business_id = acc_petty_ops.business_id and a.user_id = auth.uid()
      and a.status in ('active','trial') and (a.expires_at is null or a.expires_at > now())))
  with check (exists (select 1 from public.acc_access a
    where a.business_id = acc_petty_ops.business_id and a.user_id = auth.uid()
      and a.status in ('active','trial') and (a.expires_at is null or a.expires_at > now())));

drop policy if exists "acc prepay member all" on public.acc_prepayments;
create policy "acc prepay member all" on public.acc_prepayments
  for all to authenticated
  using (exists (select 1 from public.acc_access a
    where a.business_id = acc_prepayments.business_id and a.user_id = auth.uid()
      and a.status in ('active','trial') and (a.expires_at is null or a.expires_at > now())))
  with check (exists (select 1 from public.acc_access a
    where a.business_id = acc_prepayments.business_id and a.user_id = auth.uid()
      and a.status in ('active','trial') and (a.expires_at is null or a.expires_at > now())));

drop policy if exists "acc banklines member all" on public.acc_bank_lines;
create policy "acc banklines member all" on public.acc_bank_lines
  for all to authenticated
  using (exists (select 1 from public.acc_access a
    where a.business_id = acc_bank_lines.business_id and a.user_id = auth.uid()
      and a.status in ('active','trial') and (a.expires_at is null or a.expires_at > now())))
  with check (exists (select 1 from public.acc_access a
    where a.business_id = acc_bank_lines.business_id and a.user_id = auth.uid()
      and a.status in ('active','trial') and (a.expires_at is null or a.expires_at > now())));

drop policy if exists "acc fy member all" on public.acc_fiscal_years;
create policy "acc fy member all" on public.acc_fiscal_years
  for all to authenticated
  using (exists (select 1 from public.acc_access a
    where a.business_id = acc_fiscal_years.business_id and a.user_id = auth.uid()
      and a.status in ('active','trial') and (a.expires_at is null or a.expires_at > now())))
  with check (exists (select 1 from public.acc_access a
    where a.business_id = acc_fiscal_years.business_id and a.user_id = auth.uid()
      and a.status in ('active','trial') and (a.expires_at is null or a.expires_at > now())));

-- ─────────────────────────────────────────────────────────────────────
-- بخش ۱۱) اندیس‌های عملکردی + اعلان نهایی
-- ─────────────────────────────────────────────────────────────────────
create index if not exists acc_journal_biz_date_idx on public.acc_journal(business_id, date_g);
create index if not exists acc_invoices_biz_status_idx on public.acc_invoices(business_id, status);
create index if not exists acc_prepay_partner_idx on public.acc_prepayments(partner_id);
create index if not exists acc_bank_lines_status_idx on public.acc_bank_lines(match_status);

do $$
declare
  v_tbl int;
begin
  select count(*) into v_tbl from information_schema.tables
  where table_schema = 'public'
    and table_name in ('acc_details','acc_attachments','acc_petty','acc_petty_ops',
                       'acc_prepayments','acc_bank_lines','acc_fiscal_years');
  raise notice '✅ sql-5 اجرا شد — ۷ جدول جدید: % از ۷ موجود', v_tbl;
  raise notice '✅ قید status فاکتور اصلاح شد (صدور فاکتور الان کار می‌کند)';
  raise notice '✅ RLS مغایرت‌گیری تضمین شد (B40 رفع می‌شود)';
end $$;
