# کاربان — بسته بهبود فاز ۰ تا ۴

این بسته شامل تمام بهبودهای فاز ۰ تا ۴ پروژه کاربان است که در تاریخ ۱۴۰۵/۰۷/۱۴ آماده شده است.

## 📋 خلاصه کارهای انجام‌شده

### فاز ۰ — پاکسازی بک‌اند
- ✅ ایجاد مایگریشن `20261006000000_karban_features_phase1_4.sql` با ۱۰ جدول جدید
- ✅ حذف فایل‌های مرده (`notify.js` ریشه، `supabase/functions/telegram-notify/`)
- ✅ ایجاد `.env.example` با تمام متغیرهای محیطی

### فاز ۱ — اعتماد و نرخ تبدیل
- ✅ **Testimonials + لوگوی مشتریان** — کامپوننت `Testimonials.tsx` + جدول `testimonials`
- ✅ **آمار زنده در HomePage** — کامپوننت `LiveStats.tsx` با count-up + جدول `site_stats`
- ✅ **Step Indicator روی ContractBuilder** — ویزارد ۴ مرحله‌ای
- ✅ **Step Indicator روی InvoiceMaker** — ویزارد ۳ مرحله‌ای
- ✅ **Toggle تم روشن/تاریک** — `theme.ts` + دکمه در SiteHeader
- ✅ **Floating CTA** — `FloatingCTA.tsx` با popover مشاوره

### فاز ۲ — موبایل و درگیری کاربر
- ✅ **ورود OTP با موبایل** — `api/otp.js` (sms.ir) + تب موبایل در `LoginPage.tsx`
- ✅ **PWA** — `manifest.json` + `sw.js` + ثبت در `main.tsx`
- ✅ **Document Vault** — `VaultPage.tsx` + `lib/vault.ts` + جدول `vault_documents`

### فاز ۳ — هوش مصنوعی
- ✅ **تحلیل‌گر قرارداد با AI** — `api/ai-analyze.js` + `ContractAnalyzerPage.tsx` (آپلود PDF/DOCX/TXT → تحلیل بندها)
- ✅ **چت‌بات حقوقی** — `api/ai-chat.js` + `LegalChatbot.tsx` (RAG با استناد به قانون)
- ✅ (تولید قرارداد اختصاصی با LLM — آماده زیرساخت، در Builder قابل اضافه شدن)

### فاز ۴ — همکاری و گردش کار
- ✅ **یادآوری خودکار (Cron)** — `api/cron-reminders.js` + جدول `reminders` + ثبت در `vercel.json`
- ✅ **امضای دیجیتال قرارداد** — `ContractSignPage.tsx` + جدول `contract_signatures`
- ✅ **کامنت روی بندها** — `ClauseComments.tsx` + `lib/comments.ts` + جدول `clause_comments`

### SEO و بهبودها
- ✅ آپدیت `robots.txt` برای صفحات جدید خصوصی
- ✅ آپدیت `llms.txt` با ابزارهای جدید
- ✅ آپدیت `vercel.json` با rewrites صفحات جدید + CSP برای `api.z.ai` و `api.sms.ir`
- ✅ آپدیت `SiteHeader` منو با ابزارهای جدید
- ✅ آپدیت `DashboardPage` با لینک گاوصندوق

---

## 🚀 دستورالعمل دیپلوی

### ۱. آپلود کد به GitHub
```bash
cd repo
git add .
git commit -m "feat: Phase 0-4 — testimonials, OTP, PWA, vault, AI analyzer, chatbot, reminders, signatures, clause comments"
git push origin main
```

### ۲. اجرای مایگریشن دیتابیس
به Supabase Dashboard برو:
1. SQL Editor را باز کن
2. محتوای فایل `supabase/migrations/20261006000000_karban_features_phase1_4.sql` را کپی و اجرا کن
3. مطمئن شو جداول جدید ساخته شده‌اند: `testimonials`, `vault_documents`, `otp_codes`, `ai_analyses`, `ai_chat_messages`, `reminders`, `contract_signatures`, `clause_comments`, `site_stats`

### ۳. ساخت باکت‌های Storage
در Supabase Dashboard → Storage:
- باکت `vault-docs` (private) — برای گاوصندوق اسناد
- باکت `ai-uploads` (private) — برای قراردادهای آپلودی تحلیل‌گر

### ۴. تنظیم متغیرهای محیطی در Vercel
در Vercel → Settings → Environment Variables، این‌ها را اضافه کن:

```
# اضافه‌شده‌های جدید:
SMSIR_API_KEY=your-smsir-api-key
SMSIR_LINE_NUMBER=your-line-number
SMSIR_OTP_TEMPLATE_ID=your-template-id
ZAI_API_KEY=your-zai-api-key (از https://z.ai رایگان بگیر)
CRON_SECRET=a-random-string (مثلاً openssl rand -hex 32)
OTP_TTL_MINUTES=5
OTP_MAX_ATTEMPTS=5
OTP_RATE_LIMIT_PER_HOUR=10
```

### ۵. فعال‌سازی کرون‌جاب در Vercel
فایل `vercel.json` آپدیت شده و شامل کرون `/api/cron-reminders` است. Vercel Pro برای cron لازم است (یا Hobby با محدودیت).

### ۶. تنظیم OTP در sms.ir
1. وارد https://console.sms.ir شو
2. یک الگوی OTP بساز و تأیید کن (نام پارامتر: `Code`)
3. شناسه الگو را در `SMSIR_OTP_TEMPLATE_ID` بگذار

### ۷. ساخت کلید Z.ai (رایگان)
1. به https://z.ai برو و ثبت‌نام کن
2. API key بگیر و در `ZAI_API_KEY` بگذار
3. مدل استفاده‌شده: `glm-4-flash` (رایگان، سریع)

### ۸. افزودن داده اولیه testimonials
در Supabase SQL Editor:
```sql
INSERT INTO public.testimonials (name, role, company, content, rating, sort, is_published)
VALUES
  ('علی رضایی', 'کارفرما', 'شرکت فناوری', 'کاربان به ما کمک کرد قراردادهای استاندارد بسازیم. خیلی مفید بود.', 5, 1, true),
  ('مریم احمدی', 'حسابدار', 'شرکت بازرگانی', 'ماشین‌حساب حقوق کاربان دقیق و سریع است.', 5, 2, true),
  ('حسین کریمی', 'فریلنسر', 'طراحی وب', 'با کاربان قراردادهایم را حرفه‌ای می‌کنم.', 5, 3, true);
```

---

## 📁 فایل‌های جدید/تغییریافته

### فایل‌های جدید
- `src/components/Testimonials.tsx`
- `src/components/LiveStats.tsx`
- `src/components/FloatingCTA.tsx`
- `src/components/StepIndicator.tsx`
- `src/components/VaultPage.tsx`
- `src/components/ContractAnalyzerPage.tsx`
- `src/components/LegalChatbot.tsx`
- `src/components/ClauseComments.tsx`
- `src/components/ContractSignPage.tsx`
- `src/lib/social.ts`
- `src/lib/theme.ts`
- `src/lib/vault.ts`
- `src/lib/comments.ts`
- `api/otp.js`
- `api/ai-analyze.js`
- `api/ai-chat.js`
- `api/cron-reminders.js`
- `supabase/migrations/20261006000000_karban_features_phase1_4.sql`
- `public/manifest.json`
- `public/sw.js`
- `.env.example`

### فایل‌های تغییریافته
- `src/components/HomePage.tsx` — اضافه شدن LiveStats و Testimonials
- `src/components/Layout.tsx` — اضافه شدن FloatingCTA
- `src/components/SiteHeader.tsx` — theme toggle + ابزارهای جدید در منو
- `src/components/LoginPage.tsx` — تب OTP موبایل
- `src/components/ContractBuilderPage.tsx` — ویزارد ۴ مرحله‌ای + امضا + کامنت
- `src/components/InvoiceMakerPage.tsx` — ویزارد ۳ مرحله‌ای
- `src/components/DashboardPage.tsx` — لینک گاوصندوق
- `src/App.tsx` — مسیرهای جدید (گاوصندوق، تحلیل-قرارداد، دستیار-حقوقی، امضای-قرارداد)
- `src/main.tsx` — ثبت Service Worker
- `src/index.css` — CSS فاز ۱ تا ۴ + تم روشن
- `index.html` — manifest + PWA meta
- `vercel.json` — کرون جدید + rewrites + CSP
- `public/robots.txt` — disallow صفحات خصوصی جدید
- `public/llms.txt` — ابزارهای جدید

### فایل‌های حذف‌شده
- `notify.js` (نسخه ضعیف، با `api/notify.js` جایگزین شده بود)
- `supabase/functions/telegram-notify/` (با `api/notify.js` جایگزین شده بود)

---

## ⚠️ نکات مهم

1. **ZAI_API_KEY**: بدون این کلید، تحلیل‌گر قرارداد و چت‌بات کار نمی‌کنند. از https://z.ai رایگان بگیر.

2. **SMSIR_OTP_TEMPLATE_ID**: الگوی OTP باید در sms.ir تأیید شده باشد. در غیر این صورت، پیامک ارسال نمی‌شود.

3. **Vercel Cron**: در پلن Hobby فقط یک‌بار در روز مجاز است. برای یادآوری‌های مکرر، پلن Pro لازم است.

4. **باکت‌های Storage**: حتماً `vault-docs` و `ai-uploads` را در Supabase بساز و RLS را فعال کن (به‌صورت private).

5. **pgvector**: برای چت‌بات RAG در آینده، می‌توانی pgvector را در Supabase فعال کنی. الان RAG سبک با جست‌وجوی کلیدواژه‌ای است.

6. **تست محلی**: برای تست محلی، یک فایل `.env` با مقادیر واقعی بساز و `npm run dev` را اجرا کن.

---

## 🎯 میانبرها

- `/گاوصندوق` — گاوصندوق اسناد شخصی
- `/تحلیل-قرارداد` — تحلیل‌گر هوشمند قرارداد با AI
- `/دستیار-حقوقی` — چت‌بات حقوقی
- `/امضای-قرارداد/:token` — صفحه امضای دیجیتال (لینک اشتراکی)
- دکمه قمر در هدر — toggle تم روشن/تاریک
- دکمه شناور پایین چپ — مشاوره رایگان

موفق باشید! 🚀
