-- ═══════════════════════════════════════════════════════════════
--  کاربان — ترمیم نهایی دسترسی ثبت سرنخ/سفارش (نسخه ۲ — ساده و ضدخطا)
--  اجرا: Supabase → SQL Editor → New query → کل این متن → Run
--  ✓ اگر بعد از Run هر متن قرمز/خطایی دیدی، ازش اسکرین‌شات بفرست
-- ═══════════════════════════════════════════════════════════════

-- ۰) اول ببین الان چه پالیسی‌هایی وجود دارد (خروجی بالای Results)
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- ۱) ثبت سرنخ: گیت دانلود PDF + خبرنامه + درخواست چاپ
drop policy if exists "public_insert_leads" on public.leads;
create policy "public_insert_leads" on public.leads
  for insert to anon, authenticated with check (true);

drop policy if exists "admin_all_leads" on public.leads;
create policy "admin_all_leads" on public.leads
  for all to authenticated using (true) with check (true);

-- ۲) ثبت سفارش از صفحه خدمات
drop policy if exists "public_insert_orders" on public.orders;
create policy "public_insert_orders" on public.orders
  for insert to anon, authenticated with check (true);

drop policy if exists "admin_all_orders" on public.orders;
create policy "admin_all_orders" on public.orders
  for all to authenticated using (true) with check (true);

-- ۳) تب مشاوره‌های ادمین (اگر جدولش باشد)
drop policy if exists "admin_all_consultation_requests" on public.consultation_requests;
create policy "admin_all_consultation_requests" on public.consultation_requests
  for all to authenticated using (true) with check (true);

-- ۴) ستون شمارنده تلاش‌ها برای لاگ ورک‌فلو (اگر نبود اضافه می‌شود)
alter table public.content_jobs add column if not exists attempts integer default 0;
alter table public.consultation_requests add column if not exists service text;

-- ۵) آزادسازی مقدار «منبع» سرنخ — سایت الان مقادیر جدیدتری می‌فرستد
--    (contract_download / contract_print / request_print)
alter table public.leads drop constraint if exists leads_source_check;

-- ۶) تأیید نهایی — این ۵ ردیف باید در خروجی ببینی:
--      leads                     | public_insert_leads
--      leads                     | admin_all_leads
--      orders                    | public_insert_orders
--      orders                    | admin_all_orders
--      consultation_requests     | admin_all_consultation_requests
select tablename, policyname
from pg_policies
where schemaname = 'public'
  and tablename in ('leads','orders','consultation_requests')
order by tablename, policyname;
