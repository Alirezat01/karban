-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  کاربان — پیش‌ترمیم داده قبل از اجرای مجدد بستهٔ جدید (فایل ۰۱)          ║
-- ║  رفع خطای:                                                            ║
-- ║   P0001: برای هزینه پرداخت‌نشده، طرف‌حساب الزامی است                    ║
-- ║   CONTEXT: PL/pgSQL function acc_expense_mirror() line 68 at RAISE    ║
-- ║                                                                      ║
-- ║  علت ریشه‌ای: در داده‌های قدیمی، هزینه‌هایی «پرداخت‌نشده» (is_paid=false) ║
-- ║  وجود دارند که طرف‌حساب (partner_id) ندارند. تریگر سخت‌گیر جدید چنین    ║
-- ║  ردیفی را — بدرستی طبق §13 — رد می‌کند؛ پس باید «قبل از اجرای فایل ۱»  ║
-- ║  این ردیف‌های قدیمی طرف‌حساب بگیرند. این فایل همان کار را انجام می‌دهد. ║
-- ║                                                                      ║
-- ║  تضمین‌ها:                                                            ║
-- ║   • هیچ ردیفی حذف نمی‌شود؛ هیچ سند حسابداری ساخته یا تغییر نمی‌کند.    ║
-- ║   • فقط ردیف‌های مشکل‌دار، طرف‌حساب «سایر اشخاص (سیستمی)» می‌گیرند؛      ║
-- ║     این طرف‌حساب در UI قابل مشاهده است و بعداً می‌توانید طرف واقعی را   ║
-- ║     از صفحه هزینه‌ها جایگزین کنید.                                     ║
-- ║   • تریگر آینهٔ هزینه فقط «موقت و فقط همان تریگر» غیرفعال می‌شود و     ║
-- ║     در پایان همین فایل دوباره فعال می‌گردد.                            ║
-- ║   • Idempotent: اجرای مکرر بی‌ضرر است.                                 ║
-- ║   • تراکنش کامل: هر خطا = بازگشت کل تغییرات.                          ║
-- ╚══════════════════════════════════════════════════════════════════════╝

begin;

-- ─── ۱) ثبت ردیف‌های مشکل‌دار (وضعیت قبل از اصلاح) ─────────────────────────
create temp table _legacy_unpaid on commit drop as
select e.id, e.business_id, b.name as business_name, e.title,
       e.amount, e.vat_amount, e.date_g, e.created_at
  from public.acc_expenses e
  join public.acc_businesses b on b.id = e.business_id
 where e.is_paid = false
   and e.partner_id is null;

-- ─── ۲) ساخت طرف‌حساب سیستمی برای کسب‌وکارهای دارای ردیف مشکل‌دار ───────────
-- کد طرف‌حساب خودکار توسط تریگر v8 تخصیص می‌ یابد (بدون MAX+1)؛ اگر v8
-- هنوز نصب نباشد هم این Insert بدون partner_code کار می‌کند (ستون اختیاری).
insert into public.acc_partners (business_id, kind, person_type, name, notes)
select distinct t.business_id, 'both', 'real',
       'سایر اشخاص (سیستمی)',
       'ساخته‌شده در مهاجرت سیستم برای هزینه‌های نسیهٔ قدیمی بدون طرف‌حساب. ' ||
       'پس از تشخیص طرف واقعی، از صفحه هزینه‌ها طرف‌حساب درست را جایگزین کنید.'
  from _legacy_unpaid t
 where not exists (
        select 1 from public.acc_partners p
         where p.business_id = t.business_id
           and p.name = 'سایر اشخاص (سیستمی)');

-- ─── ۳) غیرفعال‌سازی موقت تریگر آینهٔ هزینه (فقط همان تریگر) ────────────────
-- دلیل: نمی‌خواهیم حین اصلاح داده، تریگر قدیمی سند حسابداری بسازد یا
-- ردیف‌های در حال اصلاح را رد کند. نام تریگر از pg_trigger خوانده می‌شود
-- تا با هر نامی (نسخه‌های مختلف بسته‌ها) کار کند.
do $$
declare r record;
begin
  for r in
    select t.tgname
      from pg_trigger t
      join pg_proc f on f.oid = t.tgfoid
     where t.tgrelid = 'public.acc_expenses'::regclass
       and not t.tgisinternal
       and f.proname = 'acc_expense_mirror'
  loop
    execute format('alter table public.acc_expenses disable trigger %I', r.tgname);
  end loop;
end $$;

-- ─── ۴) تخصیص طرف‌حساب به همهٔ ردیف‌های مشکل‌دار ────────────────────────────
update public.acc_expenses e
   set partner_id = p.id
  from public.acc_partners p
 where e.is_paid = false
   and e.partner_id is null
   and p.business_id = e.business_id
   and p.name = 'سایر اشخاص (سیستمی)';

-- ─── ۵) فعال‌سازی مجدد تریگر ───────────────────────────────────────────────
do $$
declare r record;
begin
  for r in
    select t.tgname
      from pg_trigger t
      join pg_proc f on f.oid = t.tgfoid
     where t.tgrelid = 'public.acc_expenses'::regclass
       and not t.tgisinternal
       and f.proname = 'acc_expense_mirror'
  loop
    execute format('alter table public.acc_expenses enable trigger %I', r.tgname);
  end loop;
end $$;

-- ─── ۶) گزارش نهایی (خروجی همین SELECT را برای من بفرستید) ─────────────────
select '۱- ردیف مشکل‌دار در ابتدای اجرا' as "بررسی",
       (select count(*)::text from _legacy_unpaid) as "نتیجه"
union all
select '۲- ردیف مشکل‌دار باقی‌مانده (باید ۰ باشد)',
       count(*)::text
  from public.acc_expenses
 where is_paid = false and partner_id is null
union all
select '۳- وضعیت تابع آینهٔ هزینه روی دیتابیس',
       case when to_regprocedure('public.acc_expense_mirror()') is null
            then 'تعریف نشده'
            else case when position('الزامی' in coalesce(pg_get_functiondef(
                     to_regprocedure('public.acc_expense_mirror()')), '')) > 0
                      then 'نسخهٔ سخت‌گیر (بستهٔ جدید) فعال است'
                      else 'نسخهٔ قبلی (بدون اعتبارسنجی سخت‌گیر) فعال است'
                 end
       end
union all
select '۴- طرف‌حساب‌های سیستمی ساخته‌شده',
       (select count(*)::text from public.acc_partners
         where name = 'سایر اشخاص (سیستمی)');

-- گزارش ردیفی (اگر خالی باشد یعنی هیچ ردیفی نیاز به اصلاح نداشت)
select business_name as "کسب‌وکار", title as "عنوان هزینه",
       amount as "مبلغ", date_g as "تاریخ"
  from _legacy_unpaid
 order by business_name, date_g;

commit;
