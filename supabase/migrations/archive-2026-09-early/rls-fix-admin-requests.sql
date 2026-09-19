-- ═══════════════════════════════════════════════════════════════
--  کاربان — ترمیم دسترسی‌های جاافتاده RLS
--  این اسکریپت ۳ چیز خراب‌شده را درست می‌کند:
--    ۱) صفحه «درخواست‌های اداری» که داده‌هایش خالی شده بود
--    ۲) فرم خبرنامه در فوتر سایت (ثبت شماره)
--    ۳) ورود به پنل مدیریت (چک نقش ادمین)
--  نحوه اجرا:
--    1) supabase.com → پروژه کاربان
--    2) SQL Editor → New query
--    3) کل این فایل را Paste کن → Run
--  ⚠️ قابل اجرای مجدد است (idempotent) و هیچ داده‌ای حذف نمی‌کند
--  ⚠️ امنیت قبلی حفظ می‌شود: شماره‌ها و سفارش‌ها همچنان خصوصی می‌مانند
-- ═══════════════════════════════════════════════════════════════

-- ── ۱) درخواست‌های اداری = محتوای عمومی سایت ────────────────────
-- (این جدول مثل مقاله‌ها و قراردادها «محتوای نمایشی» است و باید
--  برای بازدیدکننده خوانا باشد؛ مدیریتش فقط با ادمینِ لاگین‌شده)
drop policy if exists "public_read_admin_requests" on public.admin_requests;
create policy "public_read_admin_requests" on public.admin_requests
  for select using (true);

drop policy if exists "admin_all_admin_requests" on public.admin_requests;
create policy "admin_all_admin_requests" on public.admin_requests
  for all to authenticated using (true) with check (true);

-- ── ۲) خبرنامه: فرم فوتر فقط «ثبت» می‌کند؛ دیدن فقط ادمین ────────
drop policy if exists "public_insert_newsletter" on public.newsletter;
create policy "public_insert_newsletter" on public.newsletter
  for insert to anon with check (true);

drop policy if exists "admin_all_newsletter" on public.newsletter;
create policy "admin_all_newsletter" on public.newsletter
  for all to authenticated using (true) with check (true);

-- ── ۳) پروفایل‌ها: بازگرداندن قانون اصلی خود پروژه ───────────────
-- (هر کاربر ردیف خودش را می‌بیند؛ ادمینِ لاگین‌شده همه را مدیریت می‌کند
--  — همان طراحی migration اصلی؛ بدون این، ورود به پنل «unauthorized» می‌شود)
drop policy if exists "users_read_own_profile" on public.profiles;
create policy "users_read_own_profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "admins_read_all_profiles" on public.profiles;
create policy "admins_read_all_profiles" on public.profiles
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "admins_update_all_profiles" on public.profiles;
create policy "admins_update_all_profiles" on public.profiles
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ── ۴) درخواست مشاوره: بازگرداندن «ثبت عمومی» طراحی اصلی ─────────
-- (در migration خودِ پروژه ثبت عمومی مجاز بود؛ فقط خواندنش خصوصی می‌ماند)
drop policy if exists "public_insert_consultation_requests" on public.consultation_requests;
create policy "public_insert_consultation_requests" on public.consultation_requests
  for insert to anon, authenticated with check (true);

-- ── ۵) اطمینان از کار کردن گیت PDF درخواست‌ها ────────────────────
-- (حذف محدودیت قدیمی سطر leads که فقط دو منبع خاص را قبول می‌کرد)
alter table public.leads drop constraint if exists leads_source_check;

-- ═══════════════ تأیید نهایی ═══════════════
-- این دو عدد را ببین: اگر admin_requests ردیف داشت (مثلاً 5)،
-- یعنی محتوا سر جایش است و فقط دسترسی بسته شده بود.
select count(*) as admin_requests_rows from public.admin_requests;

select count(*) as newsletter_rows from public.newsletter;

-- لیست سیاست‌های نهایی (باید خط‌های جدید بالای لیست دیده شوند)
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- ═══════════════ پایان ═══════════════
-- بعد از اجرا:
--   1) سایت را باز کن → صفحه درخواست‌های اداری → باید درخواست‌ها دیده شوند
--      (اگر فوراً نشد، یک بار صفحه را با Ctrl+Shift+R رفرش کن)
--   2) ورود به پنل مدیریت را هم یک بار تست کن
--   3) اگر عدد admin_requests_rows صفر بود یعنی جدول واقعاً خالی است —
--      در آن صورت درخواست‌ها را از پنل دوباره اضافه کن
