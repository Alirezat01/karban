# راهنمای قدم به قدم فاز ۴ و ۵ + تنظیمات نهایی

این راهنما شامل تمام مراحل نصب فازهای ۴ و ۵ پروژه کاربان است (که فازهای ۰ تا ۳ هم در آن گنجانده شده).

## 📦 فایل‌های این پچ (karban-fix-3.zip)

این پچ کامل‌ترین نسخه است و شامل تمام تغییرات فازهای ۰ تا ۵ می‌شود. ۴۸ فایل در آن هست:

### فایل‌های اصلی برای آپلود

```
api/otp.js                 — OTP با sms.ir
api/ai-analyze.js          — تحلیل‌گر قرارداد با Z.ai
api/ai-chat.js              — چت‌بات حقوقی
api/cron-reminders.js      — یادآورهای روزانه
api/v1/[...path].js        — REST API عمومی (فاز ۵.۴)
src/lib/social.ts           — آمار واقعی
src/lib/theme.ts            — تم روشن/تاریک
src/lib/vault.ts            — گاوصندوق اسناد
src/lib/comments.ts         — کامنت بندهای قرارداد
src/lib/api-keys.ts         — مدیریت کلیدهای API
src/components/*.tsx        — ۱۵ کامپوننت جدید
src/data/*.json             — داده‌های ماشین‌حساب‌ها و متا
supabase/migrations/*.sql   — ۲ مایگریشن جدید
public/manifest.json        — PWA
public/sw.js                — Service Worker
index.html, vercel.json     — پیکربندی
.env.example                — نمونه متغیرها
package.json                — با z-ai-web-dev-sdk
SETUP-GUIDE.md              — همین فایل
```

---

## 🆕 امکانات جدید فاز ۵

### فاز ۵.۱: ماشین‌حساب ثبت شرکت و برند
- مسیر: `/ابزارهای-هوش-مصنوعی/ثبت-شرکت`
- محاسبه هزینه ثبت شرکت (سهامی خاص، با مسئولیت محدود، فردی)
- محاسبه هزینه ثبت برند در مالکیت معنوی
- جدول تفکیکی هزینه‌ها (تعرفه، دفترخانه، روزنامه، مهر، کارت آمار)
- امکان انتخاب تعداد سهامداران اضافه و کلاس‌های برند

### فاز ۵.۲ و ۵.۳: کمک‌حساب اظهارنامه مالیات
- مسیر: `/اظهارنامه-مالیات`
- دو حالت: شخص حقیقی (تشخیصی) و شخص حقوقی (عملکرد سالانه)
- ویزارد ۳ مرحله‌ای: درآمد → کسورات → محاسبه
- پله‌بندی مالیات اشخاص حقیقی (ماده ۱۳۱)
- نرخ ثابت ۲۵٪ اشخاص حقوقی (ماده ۱۴۸)
- خروجی XML برای اظهارنامه الکترونیکی
- محاسبه نرخ مؤثر مالیاتی

### فاز ۵.۴: REST API عمومی
- مسیر: `/api-keys` (مدیریت کلیدها در داشبورد)
- مسیر: `/api/v1/*` (endpoint‌های REST)
- ساخت کلید با scopes (contracts, calculators, ai)
- Rate limit روزانه قابل تنظیم (پیش‌فرض ۱۰۰۰/روز)
- کلید کامل فقط یک‌بار نمایش داده می‌شود (مثل GitHub tokens)
- endpoint‌ها:
  - `GET /api/v1/me` — اطلاعات کلید
  - `GET /api/v1/contracts` — لیست قراردادها
  - `GET /api/v1/contracts/:id` — یک قرارداد
  - `GET /api/v1/calculators` — پارامترهای ماشین‌حساب
  - `POST /api/v1/ai/analyze` — تحلیل AI

### فاز ۳.۴: خلاصه AI مقالات
- دکمه «خلاصه AI» روی هر مقاله دانشنامه
- خلاصه ۳ نکته‌ای با هوش مصنوعی

---

## 🚀 مراحل نصب

### قدم ۱: استخراج فایل‌ها
```bash
# ۱. فایل karban-fix-3.zip را از باکس دانلود بگیرید
# ۲. در ریپو GitHub استخراج کنید (جایگزین فایل‌های قبلی شود)
unzip karban-fix-3.zip -d /path/to/karban-repo/
cd /path/to/karban-repo
```

### قدم ۲: نصب وابستگی‌ها
```bash
npm install  # پکیج z-ai-web-dev-sdk اضافه شده است
```

### قدم ۳: اجرای مایگریشن‌های دیتابیس

به Supabase Dashboard → SQL Editor بروید و این دو فایل را پشت سر هم اجرا کنید:

1. `supabase/migrations/20261006000000_karban_features_phase1_4.sql`
2. `supabase/migrations/20261006120000_karban_public_api.sql`

این فایل‌ها جداول زیر را می‌سازند:
- `testimonials` — نظرات مشتریان
- `vault_documents` — گاوصندوق اسناد
- `otp_codes` — کدهای OTP
- `ai_analyses`, `ai_chat_messages` — لاگ AI
- `reminders` — یادآورها
- `contract_signatures` — امضای دیجیتال
- `clause_comments` — کامنت بندها
- `site_stats` — آمار سایت
- `api_keys` — کلیدهای API (فاز ۵.۴)
- `api_usage` — لاگ استفاده از API

### قدم ۴: ساخت باکت‌های Storage

در Supabase Dashboard → Storage:
- باکت `vault-docs` (private) — برای گاوصندوق اسناد
- باکت `ai-uploads` (private) — برای قراردادهای آپلود شده در تحلیل‌گر

### قدم ۵: تنظیم متغیرهای محیطی در Vercel

در Vercel → Settings → Environment Variables:

#### برای OTP (sms.ir)
| نام متغیر | مقدار |
|---|---|
| `SMSIR_API_KEY` | کلید API از پنل sms.ir |
| `SMSIR_OTP_TEMPLATE_ID` | `123456` برای Sandbox یا شناسه قالب Production |
| `SMSIR_OTP_PARAM_NAME` | `Code` |

#### برای AI (Z.ai)
| نام متغیر | توضیح |
|---|---|
| `ZAI_TOKEN` | از فایل `/etc/.z-ai-config` فیلد `token` |
| `ZAI_USER_ID` | فیلد `userId` |
| `ZAI_CHAT_ID` | فیلد `chatId` |

#### برای یادآورهای روزانه (Cron)
| نام متغیر | مقدار |
|---|---|
| `CRON_SECRET` | یک رشته تصادفی (مثلاً `openssl rand -hex 32`) |

#### برای تلگرام و ایمیل (اختیاری)
```
TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
NOTIFY_TOKEN, VITE_NOTIFY_KEY (هر دو یکی)
RESEND_API_KEY, RESEND_FROM, ADMIN_NOTIFY_EMAIL
```

### قدم ۶: Push و دیپلوی
```bash
git add .
git commit -m "feat: Phase 4-5 — AI contract analyzer, OTP, vault, signatures, public REST API, tax return calculator"
git push origin main
```

صبر کنید تا Vercel build کند (حدود ۲ دقیقه).

---

## 🔧 تنظیم sms.ir (قالب OTP)

### حالت سریع: Sandbox (برای تست اولیه)
1. به https://sms.ir بروید و ثبت‌نام کنید
2. وارد پنل شوید → «برنامه‌نویسان» → «کلیدهای API» → «ایجاد کلید جدید»
3. نوع Sandbox را انتخاب کنید
4. کلید را کپی کنید
5. در Vercel: `SMSIR_API_KEY=<کلید>` و `SMSIR_OTP_TEMPLATE_ID=123456`
6. تست کنید (پیامک واقعی ارسال نمی‌شود، فقط شبیه‌سازی)

### حالت Production: قالب تأیید شده
1. در پنل sms.ir → «ارسال سریع» → «قالب‌ها»
2. قالب جدید با متن زیر بسازید:
   ```
   کد تأیید شما در کاربان: #Code#
   این کد ۵ دقیقه اعتبار دارد.
   ```
3. نام پارامتر باید `Code` باشد (با C بزرگ)
4. ثبت قالب — sms.ir در ۱-۲ ساعت تأیید می‌کند
5. شناسه قالب را در Vercel: `SMSIR_OTP_TEMPLATE_ID=<شناسه>`

---

## ✅ چک‌لیست نهایی

بعد از دیپلوی:

- [ ] صفحه اصلی در حالت روشن — همه دکمه‌ها خوانا هستند
- [ ] آمار صفحه اصلی واقعی است (نه ۹۰+/۱۲۰۰۰+)
- [ ] منوی «ابزارهای رایگان» وقتی موس می‌رود باز می‌ماند
- [ ] صفحه `/ورود` → تب موبایل → شماره → پیامک می‌آید
- [ ] صفحه `/تحلیل-قرارداد` → متن می‌دهید → تحلیل می‌گیرید
- [ ] صفحه `/دستیار-حقوقی` → سؤال می‌پرسید → پاسخ می‌گیرید
- [ ] صفحه `/اظهارنامه-مالیات` → محاسبه مالیات
- [ ] صفحه `/ابزارهای-هوش-مصنوعی/ثبت-شرکت` → محاسبه هزینه ثبت
- [ ] داشبورد → گاوصندوق → آپلود سند
- [ ] داشبورد → کلیدهای API → ساخت کلید → تست با curl
- [ ] مقالات دانشنامه → دکمه «خلاصه AI» کار می‌کند
- [ ] قراردادها → ذخیره → دکمه «ساخت لینک امضا» → لینک امضا

---

## 📡 تست REST API

بعد از ساخت کلید در `/api-keys`:

```bash
# اطلاعات کلید
curl -H "x-api-key: kb_live_xxxxx" https://karbanapp.ir/api/v1/me

# لیست قراردادها
curl -H "x-api-key: kb_live_xxxxx" https://karbanapp.ir/api/v1/contracts?limit=10

# جزئیات یک قرارداد
curl -H "x-api-key: kb_live_xxxxx" https://karbanapp.ir/api/v1/contracts/123

# پارامترهای ماشین‌حساب
curl -H "x-api-key: kb_live_xxxxx" https://karbanapp.ir/api/v1/calculators

# تحلیل قرارداد با AI
curl -X POST -H "x-api-key: kb_live_xxxxx" -H "Content-Type: application/json" \
  -d '{"text":"متن قرارداد..."}' \
  https://karbanapp.ir/api/v1/ai/analyze
```

---

## 🆘 اشکال‌زدایی

| مشکل | راه‌حل |
|---|---|
| AI خطای `.z-ai-config` می‌دهد | متغیرهای `ZAI_TOKEN`, `ZAI_USER_ID`, `ZAI_CHAT_ID` را در Vercel ست کنید |
| OTP «سرویس پیامک پیکربندی نشده» | `SMSIR_API_KEY` را در Vercel ست کنید |
| OTP «قالب نامعتبر» | شناسه قالب را چک کنید (Sandbox = 123456) |
| آمار صفحه اصلی صفر است | جدول `contracts` را در Supabase چک کنید (با is_published=true) |
| باکس دانلود نمایش داده نمی‌شود | صفحه را hard refresh کنید (Ctrl+Shift+R) |
| کرون یادآورها 401 می‌دهد | `CRON_SECRET` را در Vercel ست کنید |

اگر مشکلی بود، خروجی کنسول مرورگر (F12) و لاگ Vercel Functions را بفرستید.
