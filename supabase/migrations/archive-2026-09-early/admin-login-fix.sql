-- ═══════════════════════════════════════════════════════════════
--  کاربان — ترمیم دسترسی پنل مدیریت («دسترسی غیرمجاز»)
--  علت: یا ردیف پروفایل برای حسابت ساخته نشده، یا نقشش admin نیست
--  نحوه اجرا: Supabase → SQL Editor → New query → Paste → Run
--  ⚠️ قابل اجرای مجدد است؛ فقط نقش کاربرانِ خودت را ادمین می‌کند
-- ═══════════════════════════════════════════════════════════════

-- ۱) برای هر کاربری که ردیف پروفایل ندارد، ردیف بساز (نقش اولیه: user)
insert into public.profiles (id, role)
select u.id, 'admin'
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
);

-- ۲) همه کاربران فعلی (که فقط خودت هستی، چون ثبت‌نام بسته است) را ادمین کن
update public.profiles
set role = 'admin'
where role is distinct from 'admin';

-- ۳) ستون‌های موردنیاز پنل و فاز ۲ (اگر نبودند ساخته می‌شوند)
alter table public.profiles add column if not exists password_sha256 text;
alter table public.profiles add column if not exists full_name     text;
alter table public.profiles add column if not exists phone         text;
alter table public.profiles add column if not exists user_role     text; -- employer | employee
alter table public.profiles add column if not exists company_name  text;

-- ═══════════════ تأیید ═══════════════
-- خروجی زیر باید اکانت تو را نشان دهد با role = admin
select p.id, p.role, u.email, u.created_at
from public.profiles p
join auth.users u on u.id = p.id;

-- ═══════════════ پایان ═══════════════
-- بعد از اجرا: صفحه پنل را رفرش کن (یا خروج/ورود دوباره) —
-- دیگر پیام «دسترسی غیرمجاز» نمی‌بینی.
