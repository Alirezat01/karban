-- ═══════════════════════════════════════════════════════════════
--  کاربان — تشخیص + ترمیم دسترسی ادمین (نسخه ۲)
--  این نسخه اول «وضعیت واقعی» را نشان می‌دهد، بعد درست می‌کند
--  اجرا: Supabase → SQL Editor → New query → Paste کل فایل → Run
--  قابل اجرای مجدد است و هیچ داده‌ای حذف نمی‌کند
-- ═══════════════════════════════════════════════════════════════

-- ۱) وضعیت فعلی: چه کاربرانی داری و نقش هر کدام چیست؟
--    (اگر profile_role = NULL بود یعنی ردیف پروفایل ندارد)
select u.id, u.email, u.created_at, p.role as profile_role
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at;

-- ۲) برای هر کاربر بی‌پروفایل، ردیف بساز (مستقیم با نقش ادمین)
insert into public.profiles (id, role)
select u.id, 'admin'
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
);

-- ۳) نقش همه کاربران فعلی را ادمین کن (ثبت‌نام بسته است، فقط خودت هستی)
update public.profiles
set role = 'admin'
where role is distinct from 'admin';

-- ۴) خروجی نهایی — این جدول باید ایمیل تو را با role = admin نشان دهد
select u.email, p.role, u.last_sign_in_at
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at;

-- ═══════════════════════════════════════════════════════════════
-- بعد از اجرا:
--   ۱) خروجی بخش ۴ را چک کن — ایمیلت کنارش باید admin نوشته باشد
--   ۲) برگه پنل (karbanapp.ir/admin) را با Ctrl+Shift+R رفرش کن
--      یا «خروج» بزن و دوباره وارد شو
--   ۳) اگر باز «دسترسی غیرمجاز» دیدی، اسکرین‌شات خروجی بخش ۴ را
--      برای من بفرست تا از رویش دقیق بگویم کجا خراب است
-- ═══════════════════════════════════════════════════════════════
