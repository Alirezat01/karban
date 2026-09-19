-- ═══════════════════════════════════════════════════════════════
--  کاربان — عیب‌یابی کامل دسترسی ادمین (نسخه ۳)
--  همه احتمالات را یکجا چک و ترمیم می‌کند
--  اجرا: Supabase → SQL Editor → New query → Paste کل فایل → Run
--  ⚠️ اگر جایی خطای قرمز دیدی، همان‌جا را اسکرین‌شات بگیر
-- ═══════════════════════════════════════════════════════════════

-- ── ۱) وضعیت واقعی: کاربران + نقش + آخرین ورود ─────────────────
--    این جدول مهم‌ترین خروجی است؛ اسکرین‌شاتش را نگه دار
select u.id, u.email, u.last_sign_in_at, p.role as profile_role,
       (p.id is null) as بدون_پروفایل
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at;

-- ── ۲) ساخت ردیف پروفایل برای کاربرانِ بی‌پروفایل ───────────────
insert into public.profiles (id, role)
select u.id, 'admin'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- ── ۳) نقش همه کاربران = admin ──────────────────────────────────
update public.profiles
set role = 'admin'
where role is distinct from 'admin';

-- ── ۴) بازسازی پالیسی‌های profiles (اگر خراب/حذف شده باشند) ─────
drop policy if exists "users_read_own_profile" on public.profiles;
create policy "users_read_own_profile" on public.profiles
  for select to authenticated
  using (auth.uid() = id);

drop policy if exists "admins_read_all_profiles" on public.profiles;
create policy "admins_read_all_profiles" on public.profiles
  for select to authenticated
  using (exists (select 1 from public.profiles pp where pp.id = auth.uid() and pp.role = 'admin'));

drop policy if exists "admins_update_all_profiles" on public.profiles;
create policy "admins_update_all_profiles" on public.profiles
  for update to authenticated
  using (exists (select 1 from public.profiles pp where pp.id = auth.uid() and pp.role = 'admin'))
  with check (exists (select 1 from public.profiles pp where pp.id = auth.uid() and pp.role = 'admin'));

-- ── ۵) چک دسترسی‌های جدول (grants) ──────────────────────────────
--    باید برای authenticated چند ردیف SELECT/INSERT/UPDATE ببینی
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'profiles'
order by grantee, privilege_type;

-- ── ۶) خروجی نهایی: نقش‌ها + پالیسی‌ها ──────────────────────────
select u.email, p.role, u.last_sign_in_at
from auth.users u
left join public.profiles p on p.id = u.id;

select policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'profiles'
order by policyname;

-- ═══════════════════════════════════════════════════════════════
-- بعد از Run:
--   ۱) بخش ۶ باید ایمیلت را با role = admin نشان دهد
--   ۲) برگه پنل → Ctrl+Shift+R (رفرش کامل)
--   ۳) اگر هنوز نشد: اسکرین‌شات خروجی بخش ۱ و ۶ را برایم بفرست
--      (مخصوصاً ستون آخرین ورود — چک می‌کنم با اکانتی که لاگین
--       می‌کنی یکی باشد یا نه)
-- ═══════════════════════════════════════════════════════════════
