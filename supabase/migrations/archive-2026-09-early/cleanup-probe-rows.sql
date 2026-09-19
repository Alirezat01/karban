-- پاک‌سازی ردیف‌های تستی که حین راستی‌آزمایی RLS درج شدند
-- جای اجرا: Supabase Dashboard → SQL Editor → Run
-- (این ردیف‌ها بی‌ضررند و فقط برای تست بودند؛ حذفشان جدول را تمیز می‌کند)

delete from leads       where mobile = '09120000000' or source = '__rls_probe__';
delete from orders      where service_title = '__rls_probe__';
delete from newsletter  where mobile = '09120000000';
delete from feedback    where target_type = '__probe__';

-- تأیید: خروجی زیر باید صفر ردیف بدهد
select 'leads' as tbl, count(*) as remaining from leads  where mobile = '09120000000'
union all
select 'orders', count(*) from orders where service_title = '__rls_probe__'
union all
select 'newsletter', count(*) from newsletter where mobile = '09120000000'
union all
select 'feedback', count(*) from feedback where target_type = '__probe__';
