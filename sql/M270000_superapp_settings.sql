-- ═════════════════════════════════════════════════════════════════════════════
-- M270000 — تنظیمات اپلیکیشن موبایل کاربان (سوپراپ)
-- ─────────────────────────────────────────────────────────────────────────────
-- دو جدول:
--   ۱) superapp_settings        → تنظیمات قابل ویرایش از پنل ادمین
--                                  (قیمت پلن‌ها، طول تست رایگان، کد تخفیف، آدرس اپ)
--   ۲) superapp_access_requests → درخواست‌های دسترسی کاربران به اپ
--                                  (ثبت از صفحه /superapp، تایید از پنل ادمین)
-- نکته امنیتی: عمومی فقط INSERT (بدون SELECT)؛ خواندن/تغییر فقط ادمین.
-- اجرا: Supabase Dashboard → SQL Editor → کل این فایل → Run
-- ═════════════════════════════════════════════════════════════════════════════

-- ── ۱) تنظیمات سوپراپ (key-value) ──
CREATE TABLE IF NOT EXISTS public.superapp_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.superapp_settings ENABLE ROW LEVEL SECURITY;

/* خواندن عمومی — قیمت‌ها در صفحه سوپراپ نمایش داده می‌شود */
DROP POLICY IF EXISTS "Public read superapp settings" ON public.superapp_settings;
CREATE POLICY "Public read superapp settings" ON public.superapp_settings
  FOR SELECT TO anon, authenticated USING (true);

/* نوشتن فقط ادمین */
DROP POLICY IF EXISTS "Admin write superapp settings" ON public.superapp_settings;
CREATE POLICY "Admin write superapp settings" ON public.superapp_settings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

/* مقدار پیش‌فرض — فقط بار اول؛ بعد از آن از پنل ادمین ویرایش می‌شود */
INSERT INTO public.superapp_settings (key, value) VALUES (
  'config',
  '{
    "appUrl": "/app",
    "trialDays": 10,
    "requestsOpen": true,
    "promo": { "code": "کاربان۱۴۰۵", "percent": 25, "active": true },
    "plans": [
      {
        "id": "trial",
        "name": "تست رایگان",
        "price": 0,
        "periodLabel": "۱۰ روز",
        "badge": null,
        "highlight": false,
        "cta": "شروع رایگان",
        "features": ["۲۵ فاکتور", "۱۵ گفت‌وگوی هوش مصنوعی", "۵ تحلیل هوشمند", "۱ کسب‌وکار"]
      },
      {
        "id": "monthly",
        "name": "ماهانه پیشرفته",
        "price": 490000,
        "periodLabel": "ماه",
        "badge": null,
        "highlight": false,
        "cta": "درخواست فعال‌سازی",
        "features": ["۳ کسب‌وکار", "فاکتور نامحدود", "۲۰ گفت‌وگو در روز", "۱۰ تحلیل در روز", "اسکنر هوشمند فاکتور و چک", "لایحه دفاعیه مالیاتی"]
      },
      {
        "id": "yearly",
        "name": "سالانه پیشرفته",
        "price": 4900000,
        "periodLabel": "سال",
        "badge": "۲ ماه هدیه",
        "highlight": true,
        "cta": "بهترین انتخاب",
        "features": ["۵ کسب‌وکار", "تمام امکانات ماهانه", "رادار نقدینگی ۳۰ روزه", "دستیار صوتی فارسی", "پشتیبانی اولویت‌دار"]
      },
      {
        "id": "founder",
        "name": "بنیان‌گذار ویژه",
        "price": 9800000,
        "periodLabel": "یک‌باره",
        "badge": "محدود",
        "highlight": false,
        "cta": "همکاری ویژه",
        "features": ["۱۰ شرکت هم‌زمان", "هوش مصنوعی نامحدود", "مشاور اختصاصی", "راه‌اندازی مالیاتی"]
      }
    ]
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- ── ۲) درخواست‌های دسترسی به اپ ──
CREATE TABLE IF NOT EXISTS public.superapp_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  mobile text NOT NULL,
  business_name text,
  plan text NOT NULL DEFAULT 'trial',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.superapp_access_requests ENABLE ROW LEVEL SECURITY;

/* عمومی فقط می‌تواند درخواست ثبت کند — نمی‌تواند ببیند کی درخواست داده */
DROP POLICY IF EXISTS "Public insert access requests" ON public.superapp_access_requests;
CREATE POLICY "Public insert access requests" ON public.superapp_access_requests
  FOR INSERT TO anon, authenticated WITH CHECK (true);

/* خواندن و تغییر فقط ادمین */
DROP POLICY IF EXISTS "Admin read access requests" ON public.superapp_access_requests;
CREATE POLICY "Admin read access requests" ON public.superapp_access_requests
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admin update access requests" ON public.superapp_access_requests;
CREATE POLICY "Admin update access requests" ON public.superapp_access_requests
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admin delete access requests" ON public.superapp_access_requests;
CREATE POLICY "Admin delete access requests" ON public.superapp_access_requests
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

/* ایندکس برای مرتب‌سازی و فیلتر تب ادمین */
CREATE INDEX IF NOT EXISTS idx_superapp_requests_created ON public.superapp_access_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_superapp_requests_status ON public.superapp_access_requests (status);
