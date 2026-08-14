/*
# Add kind column to services and seed contract service items

1. Schema Changes
- Adds nullable `kind` column to `services` table with CHECK constraint for values: custom_contract, contract_review, tax_filing, seasonal_transactions.
- Existing rows get kind = NULL (consultation services).

2. Seed Data
- Inserts 4 contract service items with kind values, labeled as "انجام کار توسط متخصص".

3. Security
- No policy changes; existing RLS policies remain in effect.
*/

ALTER TABLE public.services ADD COLUMN IF NOT EXISTS kind text CHECK (kind IS NULL OR kind IN ('custom_contract', 'contract_review', 'tax_filing', 'seasonal_transactions'));

INSERT INTO public.services (title, price, description, domain, unit, featured, kind)
VALUES
  ('تنظیم قرارداد اختصاصی برای شرکت شما', '۴,۹۰۰,۰۰۰ تومان', 'نگارش قرارداد اختصاصی متناسب با ساختار و نیازهای سازمان شما.', 'financial', 'هر پروژه', false, 'custom_contract'),
  ('بازبینی و حاشیه‌نویسی قرارداد', '۱,۹۰۰,۰۰۰ تومان', 'بررسی حقوقی قرارداد موجود و ثبت حاشیه‌نویسی تخصصی.', 'labor', 'هر قرارداد', false, 'contract_review'),
  ('انجام اظهارنامه عملکرد و ارزش افزوده', '۳,۹۰۰,۰۰۰ تومان', 'تنظیم و ارسال اظهارنامه عملکرد و مالیات بر ارزش افزوده.', 'financial', 'هر دوره', false, 'tax_filing'),
  ('اظهارنامه معاملات فصلی', '۱,۹۰۰,۰۰۰ تومان', 'ثبت و ارسال اظهارنامه معاملات فصلی سازمان.', 'financial', 'هر فصل', false, 'seasonal_transactions')
ON CONFLICT DO NOTHING;