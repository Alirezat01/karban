-- ═══════════════════════════════════════════════════════════════
--  کاربان — ترمیم ریشه‌ای «دسترسی غیرمجاز» (باگ Recursion پالیسی‌ها)
--  ریشه: پالیسی ادمین داخل خودش جدول profiles را صدا می‌زد
--  راه‌حل رسمی سوپابیس: تابع امن is_admin به‌جای زیرکوئری مستقیم
--  اجرا: Supabase → SQL Editor → Paste کل → Run  (قابل اجرای مجدد)
-- ═══════════════════════════════════════════════════════════════

-- ── ۱) تابع کمکی امن (بیرون از چرخه RLS کار می‌کند) ────────────
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

-- ── ۲) بازسازی پالیسی‌های ادمینی پروفایل با تابع جدید ───────────
drop policy if exists "admins_read_all_profiles" on public.profiles;
create policy "admins_read_all_profiles" on public.profiles
  for select to authenticated
  using (public.is_admin());

drop policy if exists "admins_update_all_profiles" on public.profiles;
create policy "admins_update_all_profiles" on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- users_read_own_profile دست نمی‌زنیم — خودش recursion ندارد

-- ── ۳) اطمینان: ردیف‌های گم‌شده + نقش ادمین (مثل قبل، بی‌ضرر) ───
insert into public.profiles (id, role)
select u.id, 'admin'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

update public.profiles
set role = 'admin'
where role is distinct from 'admin';

-- ── ۴) تست درون همان اجرا — باید OK: admin نشان دهد ────────────
do $$
declare
  uid uuid;
  res text;
begin
  select u.id into uid
  from auth.users u
  where u.last_sign_in_at is not null
  order by u.last_sign_in_at desc
  limit 1;

  perform set_config('request.jwt.claims',
    json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);

  begin
    select 'OK — نقش خوانده شد: ' || role into res
    from public.profiles where id = uid;
  exception when others then
    res = 'هنوز خطا می‌دهد: ' || sqlerrm;
  end;

  raise notice '====== نتیجه تست خواندن پروفایل: %', res;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- بعد از Run:
--   ۱) در تب Messages (کنار Results) باید «OK — نقش خوانده شد: admin» ببینی
--   ۲) برگه پنل (karbanapp.ir/admin) → Ctrl+Shift+R
--   ۳) پنل باید باز شود ✅
--   ۴) یک حساب تستی به نام probe-karban-0906@mailinator.com ساختم
--      برای تست؛ از Authentication → Users حذفش کن (۳ نقطه → Delete)
-- ═══════════════════════════════════════════════════════════════
