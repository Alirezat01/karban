-- ┌─────────────────────────────────────────────────────────────┐
-- │ اعطای دسترسی «بنیان‌گذار» حسابداری کاربان به ادمین            │
-- │                                                             │
-- │ روش اجرا:                                                   │
-- │  ۱) وارد Supabase Dashboard شو → SQL Editor                 │
-- │  ۲) «کل محتوای این فایل» را کپی و در ادیتور Paste کن        │
-- │  ۳) دکمه Run را بزن — باید پیام OK: founder license ready    │
-- │     را در خروجی ببینی                                        │
-- │                                                             │
-- │ این فایل فقط SQL خالص است؛ هیچ متن اضافه‌ای ندارد.           │
-- └─────────────────────────────────────────────────────────────┘

-- ۱) لایسنس بنیان‌گذار (بدون تاریخ انقضا، تا ۱۰ کسب‌وکار)
insert into public.acc_access (user_id, email, role, status, plan)
select u.id, u.email, 'owner', 'active', 'founder'
from auth.users u
where u.email = 'tajvidinejad@gmail.com'
  and not exists (
    select 1 from public.acc_access a
    where a.user_id = u.id and a.plan = 'founder'
  );

-- ۲) اگر کاربر قبلاً یک ردیف لایسنس بدون کسب‌وکار (business_id خالی) دارد،
--    همان ردیف به بنیان‌گذار ارتقا می‌یابد (بدون ساخت ردیف تکراری)
update public.acc_access a
set role = 'owner', status = 'active', plan = 'founder', expires_at = null
from auth.users u
where a.user_id = u.id
  and u.email = 'tajvidinejad@gmail.com'
  and a.business_id is null;

-- ۳) بررسی نتیجه — باید یک ردیف با plan = founder ببینی
select a.id, a.email, a.role, a.status, a.plan, a.expires_at, a.created_at
from public.acc_access a
join auth.users u on u.id = a.user_id
where u.email = 'tajvidinejad@gmail.com';

-- اگر بالای کوئری پیام «OK: founder license ready» را نمی‌بینی،
-- خروجی جدول پایین را چک کن: ستون plan باید founder باشد.
select 'OK: founder license ready' as result;
