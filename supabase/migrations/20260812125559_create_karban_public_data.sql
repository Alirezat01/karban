/*
# Create Karban public lead, consultation, service, and settings data

1. New Tables
- `leads`: public contact submissions with a mobile number and source (`free_download` or `weekly_brief`).
- `consultation_requests`: public consultation requests with mobile, business domain, and selected service.
- `services`: public service catalog rows grouped by `financial` or `labor`, including title, price, description, and unit.
- `settings`: public configuration values keyed by name; the frontend reads `salary_1405` when present.

2. Seed Data
- Adds the initial service catalog used by the current app to `services` without replacing existing rows.

3. Security
- Enables RLS on every new table.
- Allows anonymous and signed-in visitors to submit leads and consultation requests, with database constraints limiting accepted values.
- Allows anonymous and signed-in visitors to read services and settings.
- Does not allow public visitors to read, update, or delete submitted lead or consultation records.

4. Important Notes
- No authentication or user ownership columns are added because the app has no sign-in requirement.
- Phone numbers are validated as exactly 11 digits beginning with `09` at the database boundary.
*/

CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile text NOT NULL CHECK (mobile ~ '^09[0-9]{9}$'),
  source text NOT NULL CHECK (source IN ('free_download', 'weekly_brief')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.consultation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile text NOT NULL CHECK (mobile ~ '^09[0-9]{9}$'),
  domain text NOT NULL CHECK (domain IN ('financial', 'labor')),
  service text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  price text NOT NULL,
  description text NOT NULL,
  domain text NOT NULL CHECK (domain IN ('financial', 'labor')),
  unit text NOT NULL,
  featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can submit leads" ON public.leads;
CREATE POLICY "Public can submit leads" ON public.leads FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Leads are not publicly readable" ON public.leads;
CREATE POLICY "Leads are not publicly readable" ON public.leads FOR SELECT TO anon, authenticated USING (false);
DROP POLICY IF EXISTS "Leads cannot be publicly updated" ON public.leads;
CREATE POLICY "Leads cannot be publicly updated" ON public.leads FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Leads cannot be publicly deleted" ON public.leads;
CREATE POLICY "Leads cannot be publicly deleted" ON public.leads FOR DELETE TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "Public can submit consultation requests" ON public.consultation_requests;
CREATE POLICY "Public can submit consultation requests" ON public.consultation_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Consultations are not publicly readable" ON public.consultation_requests;
CREATE POLICY "Consultations are not publicly readable" ON public.consultation_requests FOR SELECT TO anon, authenticated USING (false);
DROP POLICY IF EXISTS "Consultations cannot be publicly updated" ON public.consultation_requests;
CREATE POLICY "Consultations cannot be publicly updated" ON public.consultation_requests FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Consultations cannot be publicly deleted" ON public.consultation_requests;
CREATE POLICY "Consultations cannot be publicly deleted" ON public.consultation_requests FOR DELETE TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "Public can read services" ON public.services;
CREATE POLICY "Public can read services" ON public.services FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Services are not publicly inserted" ON public.services;
CREATE POLICY "Services are not publicly inserted" ON public.services FOR INSERT TO anon, authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "Services are not publicly updated" ON public.services;
CREATE POLICY "Services are not publicly updated" ON public.services FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Services are not publicly deleted" ON public.services;
CREATE POLICY "Services are not publicly deleted" ON public.services FOR DELETE TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "Public can read settings" ON public.settings;
CREATE POLICY "Public can read settings" ON public.settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Settings are not publicly inserted" ON public.settings;
CREATE POLICY "Settings are not publicly inserted" ON public.settings FOR INSERT TO anon, authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "Settings are not publicly updated" ON public.settings;
CREATE POLICY "Settings are not publicly updated" ON public.settings FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Settings are not publicly deleted" ON public.settings;
CREATE POLICY "Settings are not publicly deleted" ON public.settings FOR DELETE TO anon, authenticated USING (false);

GRANT INSERT ON public.leads TO anon, authenticated;
GRANT INSERT ON public.consultation_requests TO anon, authenticated;
GRANT SELECT ON public.services, public.settings TO anon, authenticated;

INSERT INTO public.services (title, price, description, domain, unit, featured)
VALUES
  ('مشاوره متنی', '۲۹۰ هزار تومان', 'پاسخ تخصصی به پرسش حقوقی، مالی یا مدیریتی شما.', 'financial', 'هر درخواست', false),
  ('مشاوره تلفنی ۳۰ دقیقه', '۸۹۰ هزار تومان', 'گفت‌وگوی مستقیم با متخصص تأییدشده کاربان.', 'labor', '۳۰ دقیقه', true),
  ('مشاوره حضوری ۱ ساعت', '۲,۹۰۰,۰۰۰ تومان', 'جلسه عمیق برای بررسی مسئله کسب‌وکار.', 'labor', '۱ ساعت', false),
  ('پکیج ماهانه', '۱۴,۹۰۰,۰۰۰ / ۱۲,۹۰۰,۰۰۰', 'پشتیبانی منظم برای امور مالی، مالیاتی و روابط کار.', 'financial', 'ماهانه', false)
ON CONFLICT DO NOTHING;