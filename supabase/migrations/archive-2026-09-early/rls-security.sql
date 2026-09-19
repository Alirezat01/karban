-- ═══════════════════════════════════════════════════════════════
--  کاربان — فعال‌سازی کامل امنیت RLS (Row Level Security)
--  نحوه اجرا:
--    1) وارد supabase.com شو → پروژه karban
--    2) از منوی چپ: SQL Editor → دکمه New query
--    3) کل این فایل را Paste کن و دکمه Run را بزن
--  ⚠️ این اسکریپت قابل اجرای مجدد است (idempotent)
--  ⚠️ هیچ داده‌ای حذف یا تغییر نمی‌کند؛ فقط دسترسی‌ها امن می‌شوند
-- ═══════════════════════════════════════════════════════════════

-- ── مرحله ۱: حذف سیاست‌های قبلی (شروع تمیز) ──────────────────────
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname
          from pg_policies where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ── مرحله ۲: فعال‌سازی RLS روی «همه» جدول‌های public ─────────────
-- (اگر جدولی هم در لیست پایین نباشد، امن می‌شود؛ service_role ورک‌فلو
--  همیشه از RLS عبور می‌کند و تحت تأثیر قرار نمی‌گیرد)
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;

-- ── مرحله ۳: محتوای عمومی سایت — خواندن برای همه ─────────────────
-- (سایت با کلید عمومی این جدول‌ها را می‌خواند؛ بدون این خط‌ها سایت خالی می‌شود)
create policy "public_read_contracts"    on public.contracts    for select using (true);
create policy "public_read_articles"     on public.articles     for select using (true);
create policy "public_read_services"     on public.services     for select using (true);
create policy "public_read_settings"     on public.settings     for select using (true);
create policy "public_read_app_settings" on public.app_settings for select using (true);

-- ── مرحله ۴: مدیریت محتوا — فقط ادمینِ لاگین‌شده در پنل ───────────
create policy "admin_write_contracts"    on public.contracts    for all to authenticated using (true) with check (true);
create policy "admin_write_articles"     on public.articles     for all to authenticated using (true) with check (true);
create policy "admin_write_services"     on public.services     for all to authenticated using (true) with check (true);
create policy "admin_write_settings"     on public.settings     for all to authenticated using (true) with check (true);
create policy "admin_write_app_settings" on public.app_settings for all to authenticated using (true) with check (true);

-- ── مرحله ۵: سرنخ‌ها (شماره موبایل‌ها) — عمومی فقط «ثبت» می‌کند ────
-- (فرم گیت دانلود PDF و درخواست چاپ باید کار کنند)
create policy "public_insert_leads" on public.leads for insert to anon with check (true);
create policy "admin_all_leads"     on public.leads for all to authenticated using (true) with check (true);
-- ⛔ هیچ خطی برای select عمومی نیست → دیگر هیچ‌کس شماره‌ها را نمی‌بیند

-- ── مرحله ۶: سفارش‌ها — عمومی فقط ثبت سفارش جدید ─────────────────
create policy "public_insert_orders" on public.orders for insert to anon with check (true);
create policy "admin_all_orders"     on public.orders for all to authenticated using (true) with check (true);

-- ── مرحله ۷: درخواست‌های مشاوره — فقط ادمین ──────────────────────
create policy "admin_all_consultation_requests" on public.consultation_requests for all to authenticated using (true) with check (true);

-- ── مرحله ۸: لاگ موتور محتوا — فقط ورک‌فلو (service_role) ────────
-- (بدون هیچ سیاستی = قفل برای عمومی و ادمین عادی؛ ورک‌فلو عبور می‌کند)

-- ═══════════════ پایان ═══════════════
-- بعد از اجرا: صفحه Security Advisor در Supabase را رفرش کن —
-- همه هشدارهای قرمز CRITICAL باید سبز/حذف شده باشند.
--
-- 🔒 دو اقدام تکمیلی در داشبورد (اختیاری ولی شدیداً توصیه‌شده):
-- 1) Authentication → Sign In / Providers → Email → گزینه
--    «Allow new users to sign up» را خاموش کن
--    (تا هیچ‌کس غیر از تو اکانت ادمین نسازد)
-- 2) اگر هنوز اکانت ادمین نساخته‌ای: Authentication → Users →
--    Add user → با ایمیل و رمز خودت بساز (همان که در /ورود پنل می‌زنی)
