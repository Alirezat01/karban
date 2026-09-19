-- ═══════════════════════════════════════════════════════════════
--  کاربان — اسکریپت فاز ۱ و ۲ (امتیازدهی + حساب کاربری + تیکت + اعلان)
--  نحوه اجرا: Supabase → SQL Editor → New query → Paste کل فایل → Run
--  ⚠️ قابل اجرای مجدد است (idempotent) و هیچ داده‌ای حذف نمی‌کند
-- ═══════════════════════════════════════════════════════════════

-- ── ۰) ستون‌های تکمیلی (اگر قبلاً ساخته نشده‌اند) ─────────────────
alter table public.profiles add column if not exists password_sha256 text;
alter table public.profiles add column if not exists full_name     text;
alter table public.profiles add column if not exists phone         text;
alter table public.profiles add column if not exists user_role     text; -- employer | employee
alter table public.profiles add column if not exists company_name  text;

alter table public.consultation_requests
  add column if not exists user_id     uuid references auth.users(id) on delete set null,
  add column if not exists topic       text,
  add column if not exists description text,
  add column if not exists priority    text default 'معمولی',
  add column if not exists status      text default 'new',
  add column if not exists admin_note  text;

-- ── ۱) قراردادهای ذخیره‌شده کاربران (با نسخه‌بندی) ────────────────
create table if not exists public.saved_contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  root_id uuid not null,
  title text not null default 'قرارداد',
  type text not null default '',
  industry text not null default '',
  version int not null default 1,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_saved_contracts_user on public.saved_contracts (user_id);
create index if not exists idx_saved_contracts_root on public.saved_contracts (root_id);
alter table public.saved_contracts enable row level security;
drop policy if exists "own_saved_contracts" on public.saved_contracts;
create policy "own_saved_contracts" on public.saved_contracts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "admin_saved_contracts" on public.saved_contracts;
create policy "admin_saved_contracts" on public.saved_contracts
  for all to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ── ۲) امتیازدهی و بازخورد (عمومی: ثبت و خواندن میانگین) ─────────
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,              -- contract | service | article
  target_id text not null,
  rating int not null check (rating between 1 and 5),
  comment text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_feedback_target on public.feedback (target_type, target_id);
alter table public.feedback enable row level security;
drop policy if exists "public_insert_feedback" on public.feedback;
create policy "public_insert_feedback" on public.feedback
  for insert to anon, authenticated with check (rating between 1 and 5);
drop policy if exists "public_read_feedback" on public.feedback;
create policy "public_read_feedback" on public.feedback
  for select using (true);
drop policy if exists "admin_all_feedback" on public.feedback;
create policy "admin_all_feedback" on public.feedback
  for all to authenticated using (true) with check (true);

-- ── ۳) تیکت پشتیبانی ─────────────────────────────────────────────
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  priority text not null default 'معمولی',
  status text not null default 'open',    -- open | answered | closed
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tickets_user on public.tickets (user_id);
alter table public.tickets enable row level security;
drop policy if exists "own_tickets" on public.tickets;
create policy "own_tickets" on public.tickets
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "admin_all_tickets" on public.tickets;
create policy "admin_all_tickets" on public.tickets
  for all to authenticated using (true) with check (true);

create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  sender text not null check (sender in ('user','admin')),
  body text not null default '',
  attachment_path text,
  created_at timestamptz not null default now()
);
create index if not exists idx_ticket_messages_ticket on public.ticket_messages (ticket_id);
alter table public.ticket_messages enable row level security;
drop policy if exists "ticket_messages_participants" on public.ticket_messages;
create policy "ticket_messages_participants" on public.ticket_messages
  for all to authenticated using (
    exists (select 1 from public.tickets t where t.id = ticket_id and t.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.tickets t where t.id = ticket_id and t.user_id = auth.uid())
  );
drop policy if exists "admin_ticket_messages" on public.ticket_messages;
create policy "admin_ticket_messages" on public.ticket_messages
  for all to authenticated using (true) with check (true);

-- ── ۴) اعلان‌ها ──────────────────────────────────────────────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  href text default '/داشبورد',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications (user_id, is_read);
alter table public.notifications enable row level security;
drop policy if exists "own_notifications_read" on public.notifications;
create policy "own_notifications_read" on public.notifications
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "own_notifications_update" on public.notifications;
create policy "own_notifications_update" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "admin_send_notifications" on public.notifications;
create policy "admin_send_notifications" on public.notifications
  for all to authenticated using (true) with check (true);

-- ── ۵) مشاوره: کاربرِ لاگین سابقه خودش را ببیند ──────────────────
drop policy if exists "own_consultation_requests" on public.consultation_requests;
create policy "own_consultation_requests" on public.consultation_requests
  for select to authenticated using (user_id = auth.uid() or mobile = (select phone from public.profiles where id = auth.uid()));
drop policy if exists "auth_insert_consultation_requests" on public.consultation_requests;
create policy "auth_insert_consultation_requests" on public.consultation_requests
  for insert to authenticated with check (true);

-- ── ۶) باکس فایل تیکت (Supabase Storage) ────────────────────────
insert into storage.buckets (id, name, public)
values ('ticket-files', 'ticket-files', false)
on conflict (id) do nothing;

drop policy if exists "ticket_upload_own" on storage.objects;
create policy "ticket_upload_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ticket-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "ticket_read_own" on storage.objects;
create policy "ticket_read_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'ticket-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "ticket_admin_storage" on storage.objects;
create policy "ticket_admin_storage" on storage.objects
  for all to authenticated
  using (bucket_id = 'ticket-files') with check (bucket_id = 'ticket-files');

-- ═══════════════ تأیید نهایی ═══════════════
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('saved_contracts','feedback','tickets','ticket_messages','notifications','consultation_requests')
order by tablename, policyname;

-- ═══════════════ پایان ═══════════════
-- یادآوری برای فعال شدن «ورود با گوگل»:
--   1) داشبورد Supabase → Authentication → Sign In / Providers → Google → Enable
--      (Client ID و Client Secret را از console.cloud.google.com بگیر)
--   2) Authentication → Sign In / Providers → گزینه «Allow new users to sign up» را روشن کن
--      (بدون آن، ورود گوگل برای کاربران جدید خطا می‌دهد)
--   3) در Google Cloud Console، Authorized redirect URI را این‌طور بگذار:
--      https://rocjeanizzhfvhnuhnms.supabase.co/auth/v1/callback
