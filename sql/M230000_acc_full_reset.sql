-- ═══════════════════════════════════════════════════════════════════════════
-- M230000 — ریست کامل و یک‌بارهٔ کل داده‌ها (درخواست صریح مالک)
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️⚠️⚠️  این فایل «مخرب» است — فقط یک بار و فقط با تصمیم مالک اجرا کنید  ⚠️⚠️⚠️
--
-- چه چیزی پاک می‌شود:
--   • همهٔ بنگاه‌های حسابداری و داده‌های آن‌ها (تستی و واقعی، بدون استثنا)
--   • همهٔ داده‌های کاربران سایت اصلی (سفارش، تیکت، درخواست مشاوره، …)
--   • همهٔ حساب‌های کاربری از جمله ادمین (auth.users)
--   • پیوست‌های آپلودشده در storage (acc-attach و acc-media)
-- چه چیزی حفظ می‌شود:
--   • ساختار کامل جداول، توابع، گاردها و سیاست‌های RLS
--   • کاتالوگ عمومی سایت: services، contracts، settings و مقالات
--   • باکت‌های storage (خالی می‌شوند ولی سرِجایشان می‌مانند)
-- بعد از اجرا:
--   • اولین کسی که در سایت ثبت‌نام کند، «ادمین» می‌شود (تریگر §۶)
--   • با همان کاربر یک بنگاه بسازید و کار را از صفر شروع کنید
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ §۱) دادهٔ حسابداری — لایه‌به‌لایه برعکس وابستگی FK ═══
delete from public.acc_journal_lines;
delete from public.acc_attachments;
delete from public.acc_petty_ops;
delete from public.acc_prepayments;
delete from public.acc_invoice_items;
delete from public.acc_transactions;
delete from public.acc_expenses;
delete from public.acc_checks;
delete from public.acc_bank_lines;
delete from public.acc_reconciliations;
delete from public.acc_journal;
delete from public.acc_invoices;
delete from public.acc_fiscal_years;
delete from public.acc_periods;
delete from public.acc_petty;
delete from public.acc_items;
delete from public.acc_details;
delete from public.acc_partner_roles;
delete from public.acc_partners;
delete from public.acc_accounts;
delete from public.acc_cost_centers;
delete from public.acc_projects;
delete from public.acc_expense_categories;
delete from public.acc_contracts;
delete from public.acc_recurring;
delete from public.acc_entry_counters;
delete from public.acc_code_counters;
delete from public.acc_access;
delete from public.acc_businesses;

-- ═══ §۲) دادهٔ کاربران سایت اصلی (کاتالوگ و تنظیمات حفظ می‌شود) ═══
delete from public.ticket_messages;
delete from public.tickets;
delete from public.notifications;
delete from public.saved_contracts;
delete from public.orders;
delete from public.consultation_requests;
delete from public.leads;
delete from public.feedback;
delete from public.profiles;

-- ═══ §۳) پیوست‌های storage ═══
delete from storage.objects where bucket_id in ('acc-attach', 'acc-media');

-- ═══ §۴) همهٔ کاربران از جمله ادمین ═══
delete from auth.users;

-- ═══ §۵) اولین ثبت‌نام پس از ریست = ادمین ═══
-- تریگر مکمل: وقتی هیچ ادمینی وجود ندارد، اولین پروفایل ساخته‌شده ادمین می‌شود.
-- بعد از آن (تا وقتی ادمینی هست) هیچ اثر دیگری ندارد — امن برای همیشه.
create or replace function public.promote_first_user_admin()
returns trigger
language plpgsql
security definer
set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where role = 'admin') then
    update public.profiles set role = 'admin' where id = new.id;
    raise notice 'اولین کاربر (%) ادمین شد', new.id;
  end if;
  return new;
end $$;

drop trigger if exists profiles_first_admin_tr on public.profiles;
create trigger profiles_first_admin_tr
  after insert on public.profiles
  for each row execute function public.promote_first_user_admin();

-- ═══ §۶) POSTCHECK — اثبات خالی‌بودن ═══
do $$
declare
  t text;
  n bigint := null;
  bad text := '';
begin
  foreach t in array array[
    'acc_journal_lines','acc_attachments','acc_petty_ops','acc_prepayments',
    'acc_invoice_items','acc_transactions','acc_expenses','acc_checks',
    'acc_bank_lines','acc_reconciliations','acc_journal','acc_invoices',
    'acc_fiscal_years','acc_periods','acc_petty','acc_items','acc_details',
    'acc_partner_roles','acc_partners','acc_accounts','acc_cost_centers',
    'acc_projects','acc_expense_categories','acc_contracts','acc_recurring',
    'acc_entry_counters','acc_code_counters','acc_access','acc_businesses',
    'profiles','orders','tickets','ticket_messages','notifications']
  loop
    execute format('select count(*) from public.%I', t) into n;
    if n > 0 then bad := bad || t || '(' || n || ') '; end if;
  end loop;
  if bad <> '' then raise exception 'POSTCHECK ریست ناموفق — باقی‌مانده: %', bad; end if;

  select count(*) into n from auth.users;
  if n > 0 then raise exception 'POSTCHECK — % کاربر باقی مانده', n; end if;
  select count(*) into n from storage.objects where bucket_id in ('acc-attach','acc-media');
  if n > 0 then raise exception 'POSTCHECK — % شیء storage باقی مانده', n; end if;

  raise notice 'POSTCHECK M230000: ریست کامل انجام شد — صفر ردیف در ۳۴ جدول، صفر کاربر، صفر پیوست';
end $$;
