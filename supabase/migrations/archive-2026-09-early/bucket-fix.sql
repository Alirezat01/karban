-- ═══════════════════════════════════════════════════════════════
--  کاربان — ترمیم باکت فایل تیکت (بخش ۶ فاز ۱۲ که ساخته نشده بود)
--  اجرا: Supabase → SQL Editor → New query → Paste → Run
--  قابل اجرای مجدد است (idempotent) و چیزی را حذف نمی‌کند
-- ═══════════════════════════════════════════════════════════════

-- ۱) ساخت باکت (اگر نبود)
insert into storage.buckets (id, name, public)
values ('ticket-files', 'ticket-files', false)
on conflict (id) do nothing;

-- ۲) پالیسی‌های آپلود/خواندن فایل برای هر کاربر در پوشه خودش
drop policy if exists "ticket_upload_own" on storage.objects;
create policy "ticket_upload_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ticket-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "ticket_read_own" on storage.objects;
create policy "ticket_read_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'ticket-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "ticket_admin_storage" on storage.objects;
create policy "ticket_admin_storage" on storage.objects
  for all to authenticated
  using (bucket_id = 'ticket-files') with check (bucket_id = 'ticket-files');

-- ۳) تأیید نهایی — باید یک ردیف «ticket-files» ببینی
select id, name, public from storage.buckets where id = 'ticket-files';

-- ⚠️ اگر همین اول خطای «permission denied» دیدی، نگران نشو:
--    به جای این اسکریپت، از منوی چپ داشبورد برو:
--    Storage → New bucket → Name: ticket-files → تیک Public را نزن → Save
--    (پالیسی‌ها را هم که بالا اجرا شد سر جایشان می‌مانند)
-- ═══════════════════════════════════════════════════════════════
