<div align="center">

<img src="public/karban-icon.svg" width="110" alt="Karban logo" />

# Karban | کاربان

### The all-in-one Persian legal–finance super app — contracts, labor law, tax & accounting

**پلتفرم یکپارچه‌ی حقوقی–مالی ایرانی: قرارداد، قانون کار، مالیات و حسابداری**

🌐 Live website: **[karbanapp.ir](https://karbanapp.ir)** · 📱 Web app: **[karbanapp.ir/app](https://karbanapp.ir/app)**

🚧 **This project is under active development** 🚧

[![Status](https://img.shields.io/badge/status-under_development-orange)](https://github.com/Alirezat01/karban)
[![Live](https://img.shields.io/badge/website-karbanapp.ir-blue)](https://karbanapp.ir)
[![React](https://img.shields.io/badge/React-18%20%7C%2019-61dafb?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%2B%20Auth%20%2B%20RLS-3ecf8e?logo=supabase&logoColor=white)](https://supabase.com)
[![Gemini](https://img.shields.io/badge/AI-Google%20Gemini-8e75b2)](https://ai.google.dev)

</div>

---

## 📖 Table of Contents

- [About the Project](#-about-the-project)
- [At a Glance](#-at-a-glance)
- [✨ Features](#-features)
- [🧱 Tech Stack](#-tech-stack)
- [📂 Project Structure](#-project-structure)
- [🚀 Getting Started](#-getting-started)
- [☁️ Deployment](#️-deployment)
- [🗺️ Roadmap](#️-roadmap)
- [👨‍💻 Author — Developer & Designer](#-author--developer--designer)
- [🤝 Contributing & License](#-contributing--license)
- [🌍 فارسی](#-فارسی)

---

## 📖 About the Project

**Karban (کاربان)** is a complete, all-in-one **legal & finance super app** built for Iranian businesses, employers, employees, and freelancers. It combines four products in one ecosystem — all designed and developed end-to-end by a single developer:

1. 🌐 **The Karban Website** — contract bank, AI calculators, labor-law knowledge base, consulting services and an online invoice maker ([karbanapp.ir](https://karbanapp.ir))
2. 📊 **Karban Accounting SaaS** — a full double-entry accounting engine for Iranian SMEs (chart of accounts, journal, invoices, Sayadi checks, payroll, fiscal years, reports)
3. 📱 **The Karban Mobile Super App** — a PWA + Capacitor Android app with the full accounting suite, OCR scanning, AI tools and biometric security ([karbanapp.ir/app](https://karbanapp.ir/app))
4. 🤖 **Karban AI Services** — Gemini-powered contract analysis, legal chatbot, tax-defense letter writer, cashflow radar, voice assistant and an automated content engine

The whole platform is built **RTL-first in Persian**, follows Iranian labor law and tax tables (updated for fiscal year **۱۴۰۵**), and is designed around Iranian realities — Jalali dates, Persian digits, Sayadi cheque numbers, the Moadian e-invoicing system, and social-security rules.

---

## 📊 At a Glance

| | |
| --- | --- |
| 📄 Contract bank | **23 contract types × 64 industries → 1,472 tailored variants** (+90 ready templates) |
| 🧮 Legal/tax calculators | **13 calculators** based on FY ۱۴۰۵ rates, each with its legal citations |
| 📊 Accounting modules | **35 dedicated modules** — a complete double-entry system |
| 🤖 AI services | **7 Gemini-powered endpoints** (analyze, chat, OCR, radar, defense, voice, content) |
| ✅ Quality | **21 live E2E accounting test suites** · automated audit with **56 checks** |
| 🔌 Public API | **REST API v1** with API keys and per-key rate limiting |
| ⚙️ Automation | **5 GitHub Actions workflows** + 2 Vercel cron jobs |
| 🔐 Security | RLS policies, RPC-only journal writes, CSP/HSTS headers, hashed API keys |

---

## ✨ Features

### 🌐 1. The Karban Website ([karbanapp.ir](https://karbanapp.ir))

- **📄 Contract Bank (بانک قراردادها)** — 23 contract types (employment, partnership, consulting, NDA, non-compete, franchise, agency, …) across **64 industries** (medical, IT, restaurants, construction, e-commerce, legal, …) combined dynamically into **1,472 tailored variants**, with ready-made templates for free download.
- **🛠 AI Contract Builder (ساخت قرارداد هوشمند)** — answers a few questions and generates a contract tailored to the user's role and industry.
- **🧮 13 Legal & Tax Calculators** — salary & payroll ۱۴۰۵, income tax (Art. 131 stepped rates), salary tax, 10% VAT (base or inclusive), overtime, year-end bonus (عیدی), severance (سنوات), social security split (7% / 23%), retirement, leave balance, end-of-cooperation settlement, hiring cost, company & brand registration cost. Every calculator shows the **exact law articles** it is based on (Labor Law, Social Security Law, Direct Taxes Act).
- **🤝 Business Health Test (تست سلامت کسب‌وکار)** — a 16-question diagnostic across contracts, payroll/insurance, finance/tax and operations, producing a scored gauge and recommendations.
- **📚 Knowledge Base & Law Library** — labor-law and tax articles with legal citations, a structured law library, and practical checklists (چک‌لیست‌ها).
- **🧾 Online Invoice Maker (فاکتورساز)** — free invoice generator with automatic 10% VAT, print-ready output and **PDF / Excel / Word** export.
- **🧰 Services & Orders** — text / 30-minute phone / in-person consulting, monthly support packages, custom contract drafting, VAT & income-tax return filing, and quarterly transaction declarations — with a full order flow: OTP login, checkout, order tracking and notifications.
- **🔐 Vault (گاوصندوق)** — a secure space for users' documents and agreements.
- **📈 Tax Return assistant (اظهارنامه مالیات)** — guided preparation of income and VAT declarations.
- **👤 User accounts** — SMS OTP login (SMS.ir), personal dashboard, profile, order history and notification bell.

### 🤖 2. Karban AI Services (Google Gemini)

- **🔎 AI Contract Analyzer** — upload any contract (PDF/Word/text) and get a **clause-by-clause risk assessment** with suggested fixes.
- **💬 Legal Chatbot (دستیار حقوقی)** — answers labor-law, insurance and tax questions **with legal citations**.
- **📷 OCR Scan** — scans Sayadi cheques and invoices from a photo and extracts their data.
- **📉 Cashflow Radar** — detects collisions between incoming and outgoing cheque due-dates and forecasts 90-day liquidity.
- **🛡 Tax-Defense Writer (لایحه دفاعیه ماده ۲۴۴)** — drafts dispute/objection letters against tax assessments.
- **🎙 Voice Assistant** — talk to Karban in Persian and get spoken answers.
- **📰 Automated Content Engine** — scheduled AI generation of knowledge-base articles and contract content (GitHub Actions + retry pipeline), feeding the site's SEO content automatically.

### 📊 3. Karban Accounting SaaS (حسابداری حرفه‌ای)

A complete **double-entry accounting system** for Iranian SMEs, implemented as 35 React modules on a hardened PostgreSQL/Supabase engine:

| Area | Modules |
| --- | --- |
| **Core engine** | Canonical posting engine (transactional SQL RPC — journal tables accept **no direct writes**), tree-shaped chart of accounts (کدینگ), journal & vouchers (دفتر روزنامه)، general/subsidiary ledgers (کل و معین)، trial balance (تراز ۴ ستونی)، statutory books (دفاتر قانونی) |
| **Sales & purchase** | Official sales/purchase invoices, quotations (پیش‌فاکتور)، invoice editor & official print layout, invoice import, items & inventory tracking, partners (طرف‌حساب‌ها با شناسه ملی) |
| **Banking & cheques** | Bank accounts with IBAN validation (IR+24), cash boxes, **Sayadi cheque** lifecycle tracking, bank statement import, concurrent-safe bank reconciliation |
| **Costs & payments** | Expenses with tax status & custom categories, recurring expenses, petty cash (تنخواه)، prepayments, person payables settlement |
| **HR & operations** | Payroll with payslips & insurance, fixed assets, projects & cost centers, service contracts |
| **Governance** | Fiscal years & periods with **period locking**, void/delete guards, transactional backup & restore (idempotent), user activity logs, multi-user role permissions, business-level data isolation (RLS) |
| **Business** | Subscription gate (14-day trial → paid plans), Telegram-based support, Excel/backup export, Persian (Jalali) date engine & Persian digit formatting everywhere |

> The engine is validated by **21 live E2E test suites** (journal atomicity & concurrency, trial balance, sub-ledger integrity, RLS business isolation, permissions, backup/restore, Sayadi cheques, invoice voiding, numeric rounding, …) — **56 automated checks** run on every audit.

### 📱 4. The Karban Mobile Super App ([karbanapp.ir/app](https://karbanapp.ir/app))

- Full **accounting suite** on mobile, synced with the same Supabase backend.
- 🔐 **Biometric lock** (fingerprint/Face) on top of authentication.
- 📷 **Sayadi cheque & invoice QR/OCR scanner** using the phone camera (jsQR + Gemini).
- 🛡 **Tax-defense letter writer** (Art. 244) right from the phone.
- 📉 **90-day cashflow forecaster** with cheque-collision radar and monthly profit charts (d3).
- 💳 **Neobank-style 3D metal card & treasury widget** (Three.js).
- 💡 **Daily tax-saving tips engine** matched to the user's invoices.
- 🗓 **Tax & insurance calendar** — VAT return, payroll insurance list, income declaration deadlines.
- ✍️ **Digital signature canvas** → signed contract PDF export (jsPDF / pdf-lib).
- 🎙 **Voice assistant**, print preview, subscription management (**10-day free trial → monthly / yearly / founder VIP**).
- Persian-optimized inputs, RTL UI, motion animations, PWA install + **Android APK built by GitHub Actions**.

### 🔌 5. Public REST API v1

Authenticated with `x-api-key` (keys stored **SHA-256 hashed**, managed from the dashboard):

| Endpoint | Description |
| --- | --- |
| `GET /api/v1/me` | Current API key info |
| `GET /api/v1/contracts` | List published contracts (`?limit`, `?industry`, `?type`) |
| `GET /api/v1/contracts/:id` | Single contract |
| `GET /api/v1/calculators` | List calculator slugs |
| `GET /api/v1/calculators/:slug` | Calculator parameters |
| `POST /api/v1/ai/analyze` | AI contract analysis (scoped key) |

Rate limit: **1,000 requests/day per key** by default.

### ⚙️ 6. Automation, CI/CD & Quality

| Workflow / Cron | Schedule | Purpose |
| --- | --- | --- |
| `acc-audit` (GH Actions) | daily | Full automated audit of the live accounting system → Persian `audit-report.md` |
| `acc-test` (GH Actions) | scheduled | Runs the 21 live accounting E2E suites from a clean GitHub runner |
| `content-weekly` (GH Actions) | 3×/week | AI content engine — generates articles & contract content |
| `content-retry` (GH Actions) | every 3h | Retries failed content generation |
| `health-check` (GH Actions) | weekly | End-to-end platform health check |
| `/api/acc-audit` (Vercel cron) | daily 04:00 | Server-side audit trigger |
| `/api/cron-reminders` (Vercel cron) | daily 04:00 | Deadline reminders → users (Telegram/email) |

### 🔐 7. Security

- Row-Level Security on every table + storage lock policies; journal/fiscal tables are **RPC-only** (no direct INSERT/UPDATE).
- Strict security headers on Vercel: **CSP, HSTS, X-Frame-Options: DENY, nosniff, Permissions-Policy**.
- SMS **OTP** with TTL and max-attempt controls; API keys stored hashed; secrets only as environment variables.
- Mobile: `security_spec.md`, hardened Firestore rules, biometric gate.

### 🔍 8. SEO & Localization

- RTL Persian UI with the **Vazirmatn** font, Persian digits & Jalali dates.
- Dynamic `sitemap.xml`, `robots.txt`, `llms.txt`, per-section Open Graph images, `hreflang`, prerendered meta tags.
- **Schema.org** Organization + WebSite JSON-LD, Google Search Console, Google Analytics, **Enamad** trust seal, PWA manifest + service worker.

---

## 🧱 Tech Stack

| Layer | Technology |
| --- | --- |
| **Website frontend** | Vite 5, React 18, TypeScript 5, Tailwind CSS 3, lucide-react |
| **Backend / DB** | Supabase (PostgreSQL, Auth, Storage, RLS, RPC posting engine) |
| **Serverless** | Vercel Functions (Node.js 24) — AI endpoints, OTP, notifications, cron jobs, REST API v1 |
| **AI** | Google Gemini (`@google/genai` + `z-ai-web-dev-sdk`) |
| **Mobile** | React 19, Vite 8, Tailwind CSS 4, Capacitor 8, Firebase, jsQR, jsPDF / pdf-lib, Three.js, d3, motion |
| **Documents & data** | SheetJS (Excel), pdf-lib / pdfjs-dist / jsPDF, JSZip |
| **Testing** | 21 custom Node E2E suites (accounting), Vitest (mobile), ESLint 9, `tsc --noEmit` |
| **CI/CD** | GitHub Actions ×5, Vercel (hosting, crons, headers) |
| **Integrations** | SMS.ir (OTP), Telegram Bot API (notifications & support), Resend (email), Google Analytics |

---

## 📂 Project Structure

```
karban/
├── api/                    # Vercel serverless: AI endpoints, OTP, notify, cron, REST API v1
│   └── ai/                 # Gemini services: contract audit, legal chat, OCR, cashflow radar,
│                           #   tax defense, voice assistant
├── src/                    # Website (React + Vite, RTL Persian)
│   ├── components/         # Pages: contracts, calculators, knowledge, services, vault,
│   │   │                   #   admin, profile, …
│   │   └── acc/            # Accounting SaaS — 35 modules
│   ├── lib/                # auth, SEO, format/i18n, acc engine clients, telegram, …
│   └── data/               # Legal config ۱۴۰۵, calculator catalog, laws, checklists
├── mobile-app/             # Karban Super App (React 19 + Capacitor + Firebase + PWA)
├── sql/                    # Canonical accounting SQL chain — 16 ordered migrations
├── supabase/migrations/    # Public site schema — 11 migrations
├── tests/acc/              # 21 live E2E accounting suites + harness
├── scripts/                # build, prerender-meta, content engine, mobile build, verifiers
└── .github/workflows/      # 5 CI/CD & automation workflows
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js 24.x** (see `engines` in `package.json`)
- A **Supabase** project (for database, auth & storage)
- A **Gemini** API key (for AI features)
- Optional: SMS.ir, Telegram bot, Resend — for OTP, notifications and email

### Environment variables (Vercel / `.env`)

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL` | Supabase connection |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | AI services |
| `SMSIR_API_KEY`, `SMSIR_OTP_TEMPLATE_ID`, `SMSIR_OTP_PARAM_NAME` | SMS OTP login |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `NOTIFY_TOKEN`, `ADMIN_NOTIFY_EMAIL` | Notifications |
| `RESEND_API_KEY`, `RESEND_FROM` | Email delivery |
| `CRON_SECRET`, `AUDIT_TOKEN`, `OTP_TTL_MINUTES`, `OTP_MAX_ATTEMPTS` | Cron/audit security & OTP policy |

### Database

- Run the ordered chain in [`sql/`](sql/README.md) from top to bottom in the Supabase SQL editor (accounting engine, 16 migrations, each with its own POSTCHECK guard).
- Then run the public-site migrations in `supabase/migrations/` (11 migrations).

### Run

```bash
# 1. Clone
git clone https://github.com/Alirezat01/karban.git
cd karban

# 2. Install dependencies
npm install

# 3. Development (website)
npm run dev

# 4. Production build — website + prerendered meta + mobile app (at /app)
npm run build

# Build only the website or only the mobile app
npm run build:site
npm run build:mobile

# 5. Accounting E2E test suites
npm run test:acc

# Lint & typecheck
npm run lint
npm run typecheck
```

### Mobile app (development)

```bash
cd mobile-app
npm install            # independent package.json (uses --legacy-peer-deps if needed)
cp .env.example .env.local   # set GEMINI_API_KEY, APP_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
npm run dev            # web preview
npm test               # Vitest suites
```

The Android APK is built automatically by the `build-android-apk` GitHub Action in `mobile-app/`.

---

## ☁️ Deployment

- Hosted on **Vercel**: the website at the root, the mobile super app bundled at **`/app`**.
- `vercel.json` sets Persian-route rewrites, immutable asset caching, security headers, and two daily cron jobs (accounting audit + reminders).
- `www.karbanapp.ir` → permanent redirect to `karbanapp.ir`.

---

## 🗺️ Roadmap

- [x] Website core — contract bank, calculators, knowledge base, services & orders
- [x] Accounting engine v2 (canonical posting, RPC lockdown, hardening)
- [x] AI services (contract analyzer, legal chatbot, OCR, cashflow radar, tax defense, voice)
- [x] Mobile super app (biometric, scanner, forecaster, subscriptions)
- [x] Public REST API v1 with API keys
- [x] Automated audit & content pipelines
- [ ] 🚧 Continuous development — more accounting modules, more AI services, app polish & public launch

**Karban is under active development — features and docs are updated regularly.**

---

## 👨‍💻 Author — Developer & Designer

<div align="center">

### Alireza Tajvidi — علیرضا تجویدی

*Full design & development of the Karban website, accounting SaaS and mobile app*

📧 [tajvidinejad@gmail.com](mailto:tajvidinejad@gmail.com) · 🐙 [@Alirezat01](https://github.com/Alirezat01)

</div>

**Project contact:** hello@karbanapp.ir · [Instagram — @karbanapp](https://www.instagram.com/karbanapp) · +98-21-88342679 · Tehran, Karimkhan, Senani St., No. 61

---

## 🤝 Contributing & License

The project is in early development; bug reports and suggestions are welcome via [Issues](https://github.com/Alirezat01/karban/issues) or email.

© 2026 Alireza Tajvidi — All rights reserved. *(No open-source license applied yet.)*

---
---

<div dir="rtl" align="center">

# 🌍 فارسی

<img src="public/karban-icon.svg" width="90" alt="لوگوی کاربان" />

# کاربان | Karban

### ابراپلیکیشن یکپارچه‌ی حقوقی–مالی ایرانی: قرارداد، قانون کار، مالیات و حسابداری

🌐 وب‌سایت: **[karbanapp.ir](https://karbanapp.ir)** · 📱 اپلیکیشن وب: **[karbanapp.ir/app](https://karbanapp.ir/app)**

🚧 **این پروژه در حال توسعه‌ی فعال است** 🚧

</div>

<div dir="rtl">

## 📖 درباره‌ی پروژه

**کاربان** یک **ابراپلیکیشن جامع حقوقی و مالی** برای کسب‌وکارها، کارفرمایان، کارمندان و فریلنسرهای ایرانی است که چهار محصول را در یک اکوسیستم یکپارچه جمع کرده — و همه‌ی آن از طراحی تا توسعه، به‌صورت کامل توسط یک نفر ساخته شده است:

1. 🌐 **وب‌سایت کاربان** — بانک قرارداد، ماشین‌حساب‌های حقوق و مالیات، دانشنامه‌ی حقوق کار، خدمات تخصصی و فاکتورساز آنلاین ([karbanapp.ir](https://karbanapp.ir))
2. 📊 **نرم‌افزار حسابداری کاربان (SaaS)** — موتور کامل حسابداری دوبل برای کسب‌وکارهای ایرانی: کدینگ، سند، فاکتور، چک صیادی، حقوق و دستمزد، سال مالی و گزارش‌ها
3. 📱 **اپلیکیشن موبایل کاربان (سوپراپ)** — PWA + اپ اندروید Capacitor با کل مجموعه‌ی حسابداری، اسکن هوشمند، ابزارهای AI و قفل بیومتریک ([karbanapp.ir/app](https://karbanapp.ir/app))
4. 🤖 **سرویس‌های هوش مصنوعی کاربان** — تحلیل قرارداد، دستیار حقوقی، لایحه‌نگار دفاع مالیاتی، رادار نقدینگی، دستیار صوتی و موتور تولید محتوا (بر پایه‌ی Gemini)

کل پلتفرم **راست‌به‌چپ و فارسی‌محور** است، بر مبنای قانون کار و جداول مالیاتی سال **۱۴۰۵** ساخته شده و برای واقعیت‌های ایران طراحی شده است: تاریخ شمسی، اعداد فارسی، شماره‌ی چک صیادی، سامانه‌ی مودیان و قواعد تأمین اجتماعی.

---

## 📊 کاربان در یک نگاه

| | |
| --- | --- |
| 📄 بانک قرارداد | **۲۳ نوع قرارداد × ۶۴ صنف ← ۱٬۴۷۲ نسخه‌ی تخصصی** (بیش از ۹۰ نمونه‌ی آماده) |
| 🧮 ماشین‌حساب‌ها | **۱۳ ماشین‌حساب** حقوق، مالیات و بازنشستگی بر اساس نرخ‌های ۱۴۰۵ — هرکدام با استناد قانونی |
| 📊 ماژول‌های حسابداری | **۳۵ ماژول اختصاصی** — یک سیستم حسابداری دوبل کامل |
| 🤖 سرویس‌های AI | **۷ سرویس Gemini** (تحلیل، چت، OCR، رادار، لایحه، صوت، محتوا) |
| ✅ کیفیت | **۲۱ سوئیت تست E2E زنده** · حسابرسی خودکار با **۵۶ بررسی** |
| 🔌 API عمومی | **REST API v1** با کلید API و محدودیت مصرف روزانه |
| ⚙️ اتوماسیون | **۵ ورک‌فوی GitHub Actions** + ۲ کرون جاب Vercel |
| 🔐 امنیت | سیاست‌های RLS، نوشتن سند فقط از طریق RPC، هدرهای CSP/HSTS، کلیدهای هش‌شده |

---

## ✨ امکانات

### 🌐 ۱. وب‌سایت کاربان ([karbanapp.ir](https://karbanapp.ir))

- **📄 بانک قراردادها** — ۲۳ نوع قرارداد (کار، همکاری، پیمانکاری، محرمانگی، عدم رقابت، فرانچایز، وکالت، …) در **۶۴ صنف** (پزشکان، برنامه‌نویسان، رستوران‌ها، ساختمان، فروشگاه آنلاین، وکلا، …) که به‌صورت پویا **۱٬۴۷۲ نسخه‌ی تخصصی** می‌سازند؛ به‌همراه بیش از ۹۰ نمونه‌ی آماده با دانلود رایگان.
- **🛠 ساخت قرارداد هوشمند** — با چند پرسش، قرارداد متناسب با نقش و صنف کاربر تولید می‌شود.
- **🧮 ۱۳ ماشین‌حساب حقوق و مالیات** — محاسبه‌ی حقوق و دستمزد ۱۴۰۵، مالیات مشاغل (پلکانی ماده ۱۳۱)، مالیات حقوق، ارزش افزوده ۱۰٪ (از پایه یا از داخل فاکتور)، اضافه‌کاری، عیدی و پاداش، سنوات پایان خدمت، بیمه تأمین اجتماعی (سهم ۷٪ کارگر و ۲۳٪ کارفرما)، بازنشستگی، مرخصی، تسویه‌ی پایان همکاری، هزینه‌ی واقعی استخدام و هزینه‌ی ثبت شرکت و برند. هر ماشین‌حساب **ماده‌های قانونی مبنای محاسبه** را نمایش می‌دهد.
- **🤝 تست سلامت کسب‌وکار** — ۱۶ سؤال تشخیصی در چهار محور قراردادها، حقوق و بیمه، مالی و مالیات، و عملیات؛ با گیج نمره و پیشنهادهای بهبود.
- **📚 دانشنامه و کتابخانه‌ی قانون** — مقالات حقوق کار و مالیات با استناد قانونی، کتابخانه‌ی قوانین و چک‌لیست‌های عملی.
- **🧾 فاکتورساز آنلاین** — صدور فاکتور با محاسبه‌ی خودکار ۱۰٪ ارزش افزوده و خروجی چاپ، **PDF، اکسل و ورد**.
- **🧰 خدمات و سفارش** — مشاوره‌ی متنی، تلفنی (۳۰ دقیقه) و حضوری، پکیج ماهانه، تنظیم قرارداد اختصاصی، انجام اظهارنامه‌ی عملکرد و ارزش افزوده و معاملات فصلی — با چرخه‌ی کامل سفارش: ورود با OTP، پرداخت، پیگیری و اعلان‌ها.
- **🔐 گاوصندوق** — فضای امن برای اسناد و توافق‌نامه‌های کاربر.
- **📈 اظهارنامه مالیات** — آماده‌سازی راهنمامحور اظهارنامه‌ی عملکرد و ارزش افزوده.
- **👤 حساب کاربری** — ورود با کد یک‌بارمصرف پیامکی (SMS.ir)، داشبورد، پروفایل، سابقه‌ی سفارش‌ها و زنگ اعلان‌ها.

### 🤖 ۲. سرویس‌های هوش مصنوعی کاربان (Google Gemini)

- **🔎 تحلیلگر قرارداد با AI** — هر قراردادی (PDF/Word/متن) را بارگذاری کنید و **ارزیابی ریسک بندبه‌بند** همراه با پیشنهاد اصلاح بگیرید.
- **💬 دستیار حقوقی** — پاسخ به پرسش‌های قانون کار، بیمه و مالیات **همراه با استناد به ماده‌های قانونی**.
- **📷 اسکن هوشمند (OCR)** — استخراج اطلاعات چک صیادی و فاکتور از عکس.
- **📉 رادار نقدینگی** — تشخیص تداخل سررسید چک‌های دریافتنی و پرداختنی و پیش‌بینی ۹۰ روزه‌ی نقدینگی.
- **🛡 لایحه‌نگار دفاع مالیاتی (ماده ۲۴۴)** — نگارش خودکار لایحه‌ی اعتراض به برگه‌های مالیاتی.
- **🎙 دستیار صوتی** — با کاربان فارسی حرف بزنید و پاسخ صوتی بگیرید.
- **📰 موتور تولید محتوا** — تولید زمان‌بندی‌شده‌ی مقالات و محتوای قرارداد با AI (GitHub Actions + خط تلاش مجدد) برای تغذیه‌ی خودکار محتوای سایت.

### 📊 ۳. نرم‌افزار حسابداری کاربان (حسابداری حرفه‌ای)

سیستم کامل **حسابداری دوبل** برای کسب‌وکارهای ایرانی، با ۳۵ ماژول React روی یک موتور سخت‌گیرانه‌ی PostgreSQL/Supabase:

| حوزه | ماژول‌ها |
| --- | --- |
| **موتور اصلی** | موتور کانونی صدور سند (RPC تراکنشی — جدول‌های سند **هیچ نوشتن مستقیمی نمی‌پذیرند**)، کدینگ درختی حساب‌ها، دفتر روزنامه و اسناد، دفتر کل و معین، تراز آزمایشی ۴ ستونی، دفاتر قانونی |
| **فروش و خرید** | فاکتور فروش/خرید رسمی، پیش‌فاکتور (استعلام قیمت)، ویرایشگر و چاپ رسمی فاکتور، وارد کردن فاکتور، کالا و خدمات با ردیابی موجودی، طرف‌حساب‌ها با شناسه ملی |
| **بانک و چک** | حساب‌های بانکی با اعتبارسنجی شبا (IR+۲۴ رقم)، صندوق نقدی، چرخه‌ی کامل **چک صیادی**، وارد کردن صورتحساب بانکی، مغایرت‌گیری بانکی امن در برابر هم‌زمانی |
| **هزینه و پرداخت** | هزینه‌ها با وضعیت مالیاتی و دسته‌بندی سفارشی، هزینه‌های تکرارشونده، تنخواه، پیش‌پرداخت، تسویه‌ی پرداختنی اشخاص |
| **منابع انسانی و عملیات** | حقوق و دستمزد با فیش و بیمه، دارایی‌های ثابت، پروژه‌ها و مراکز هزینه، قراردادهای خدماتی |
| **حاکمیت داده** | سال و دوره‌ی مالی با **قفل دوره**، گاردهای ابطال/حذف، بکاپ و ری‌استور تراکنشی (idempotent)، لاگ فعالیت کاربران، دسترسی چندکاربره‌ی نقش‌محور، جداسازی داده در سطح کسب‌وکار (RLS) |
| **کسب‌وکار** | دروازه‌ی اشتراک (۱۴ روز تست رایگان ← پلن‌های پرداختی)، پشتیبانی از طریق تلگرام، خروجی اکسل و بکاپ، موتور تاریخ شمسی و اعداد فارسی در همه‌جا |

> این موتور با **۲۱ سوئیت تست E2E زنده** اعتبارسنجی می‌شود (اتمیک بودن و هم‌زمانی اسناد، تراز آزمایشی، صحت معین، جداسازی RLS کسب‌وکارها، دسترسی‌ها، بکاپ/ری‌استور، چک صیادی، ابطال فاکتور، گرد کردن مبالغ و …) — **۵۶ بررسی خودکار** در هر حسابرسی اجرا می‌شود.

### 📱 ۴. اپلیکیشن موبایل کاربان (سوپراپ) ([karbanapp.ir/app](https://karbanapp.ir/app))

- مجموعه‌ی کامل **حسابداری روی موبایل**، همگام با همان بک‌اند Supabase.
- 🔐 **قفل بیومتریک** (اثر انگشت/چهره) روی احراز هویت.
- 📷 **اسکنر QR و OCR چک صیادی و فاکتور** با دوربین گوشی (jsQR + Gemini).
- 🛡 **لایحه‌نگار دفاعیه مالیاتی (ماده ۲۴۴)** مستقیم از روی گوشی.
- 📉 **پیش‌بینی ۹۰ روزه‌ی نقدینگی** با رادار تداخل چک‌ها و نمودار سود ماه‌های شمسی (d3).
- 💳 **کارت فلزی سه‌بعدی و خزانه** به سبک نئوبانک (Three.js).
- 💡 **مهندس «صرفه‌جویی مالیاتی امروز»** — نکات روز متناسب با فاکتورهای کاربر.
- 🗓 **تقویم تکالیف مالیاتی و بیمه** — سررسید ارزش افزوده، فهرست حقوق و اظهارنامه‌ی عملکرد.
- ✍️ **بوم امضای دیجیتال** ← خروجی PDF قرارداد امضاشده (jsPDF / pdf-lib).
- 🎙 دستیار صوتی، پیش‌نمایش چاپ، مدیریت اشتراک (**۱۰ روز تست رایگان ← ماهانه / سالانه / VIP همراه اول**).
- ورودی‌های فارسی‌سازی‌شده، رابط RTL، انیمیشن‌های Motion، نصب PWA + **خروجی APK اندروید با GitHub Actions**.

### 🔌 ۵. REST API عمومی نسخه ۱

احراز هویت با هدر `x-api-key` (کلیدها به‌صورت **SHA-256 هش**شده ذخیره می‌شوند و از داشبورد مدیریت می‌شوند):

| اندپوینت | شرح |
| --- | --- |
| `GET /api/v1/me` | اطلاعات کلید فعلی |
| `GET /api/v1/contracts` | فهرست قراردادهای منتشرشده (`?limit`, `?industry`, `?type`) |
| `GET /api/v1/contracts/:id` | یک قرارداد مشخص |
| `GET /api/v1/calculators` | فهرست ماشین‌حساب‌ها |
| `GET /api/v1/calculators/:slug` | پارامترهای هر ماشین‌حساب |
| `POST /api/v1/ai/analyze` | تحلیل قرارداد با AI (کلید با دسترسی ai) |

محدودیت مصرف: به‌صورت پیش‌فرض **۱٬۰۰۰ درخواست در روز برای هر کلید**.

### ⚙️ ۶. اتوماسیون، CI/CD و کیفیت

| ورک‌فو / کرون | زمان‌بندی | هدف |
| --- | --- | --- |
| `acc-audit` (GitHub Actions) | روزانه | حسابرسی خودکار کامل سیستم حسابداری زنده ← گزارش فارسی `audit-report.md` |
| `acc-test` (GitHub Actions) | زمان‌بندی‌شده | اجرای ۲۱ سوئیت تست حسابداری از روی رانر تمیز GitHub |
| `content-weekly` (GitHub Actions) | ۳ بار در هفته | موتور تولید محتوای AI — مقاله و قرارداد |
| `content-retry` (GitHub Actions) | هر ۳ ساعت | تلاش مجدد برای تولید محتوای ناموفق |
| `health-check` (GitHub Actions) | هفتگی | بررسی سلامت کامل پلتفرم |
| `/api/acc-audit` (کرون Vercel) | روزانه ۰۴:۰۰ | تریگر حسابرسی سمت سرور |
| `/api/cron-reminders` (کرون Vercel) | روزانه ۰۴:۰۰ | یادآوری سررسیدها برای کاربران (تلگرام/ایمیل) |

### 🔐 ۷. امنیت

- Row-Level Security روی همه‌ی جدول‌ها + سیاست‌های قفل Storage؛ جدول‌های سند و سال مالی **فقط از طریق RPC** قابل تغییرند.
- هدرهای امنیتی سخت‌گیرانه روی Vercel: **CSP، HSTS، X-Frame-Options: DENY، nosniff، Permissions-Policy**.
- ورود با **OTP** پیامکی با کنترل TTL و تعداد تلاش؛ کلیدهای API به‌صورت هش‌شده؛ رمزها فقط به‌صورت متغیر محیطی.
- موبایل: `security_spec.md`، قواعد Firestore سخت‌گیرانه و دروازه‌ی بیومتریک.

### 🔍 ۸. سئو و فارسی‌سازی

- رابط RTL فارسی با فونت **وزیرمتن**، اعداد فارسی و تاریخ شمسی.
- `sitemap.xml` پویا، `robots.txt`، `llms.txt`، تصاویر Open Graph اختصاصی هر بخش، `hreflang` و متاتگ‌های پیش‌رندر.
- **Schema.org** (Organization + WebSite)، Google Search Console، Google Analytics، نشان **اینماد**، مانیفست PWA و Service Worker.

---

## 🧱 تکنولوژی‌ها

| لایه | فناوری |
| --- | --- |
| **فرانت‌اند سایت** | Vite 5، React 18، TypeScript 5، Tailwind CSS 3، lucide-react |
| **بک‌اند / دیتابیس** | Supabase (PostgreSQL، Auth، Storage، RLS، موتور RPC اسناد) |
| **سمت سرور** | توابع Serverless Vercel (Node.js 24) — اندپوینت‌های AI، OTP، اعلان‌ها، کرون‌ها، REST API v1 |
| **هوش مصنوعی** | Google Gemini (`@google/genai` + `z-ai-web-dev-sdk`) |
| **موبایل** | React 19، Vite 8، Tailwind CSS 4، Capacitor 8، Firebase، jsQR، jsPDF / pdf-lib، Three.js، d3، motion |
| **اسناد و داده** | SheetJS (اکسل)، pdf-lib / pdfjs-dist / jsPDF، JSZip |
| **تست** | ۲۱ سوئیت E2E سفارشی (حسابداری)، Vitest (موبایل)، ESLint 9، `tsc --noEmit` |
| **CI/CD** | GitHub Actions ×۵، Vercel (هاست، کرون، هدرها) |
| **یکپارچه‌سازی‌ها** | SMS.ir (OTP)، Telegram Bot API (اعلان و پشتیبانی)، Resend (ایمیل)، Google Analytics |

---

## 📂 ساختار پروژه

```
karban/
├── api/                    # توابع Vercel: اندپوینت‌های AI، OTP، اعلان، کرون، REST API v1
│   └── ai/                 # سرویس‌های Gemini: تحلیل قرارداد، چت حقوقی، OCR، رادار نقدینگی،
│                           #   لایحه دفاعیه، دستیار صوتی
├── src/                    # وب‌سایت (React + Vite، فارسی RTL)
│   ├── components/         # صفحات: قراردادها، ماشین‌حساب‌ها، دانشنامه، خدمات، گاوصندوق،
│   │   │                   #   ادمین، پروفایل و …
│   │   └── acc/            # نرم‌افزار حسابداری — ۳۵ ماژول
│   ├── lib/                # auth، سئو، قالب‌بندی، کلاینت‌های موتور حسابداری، تلگرام و …
│   └── data/               # پیکربندی قانونی ۱۴۰۵، کاتالوگ ماشین‌حساب‌ها، قوانین، چک‌لیست‌ها
├── mobile-app/             # سوپراپ کاربان (React 19 + Capacitor + Firebase + PWA)
├── sql/                    # زنجیره‌ی SQL حسابداری — ۱۶ مایگریشن ترتیب‌دار
├── supabase/migrations/    # اسکیمای بخش عمومی سایت — ۱۱ مایگریشن
├── tests/acc/              # ۲۱ سوئیت تست E2E حسابداری + هارنس
├── scripts/                # بیلد، پیش‌رندر متا، موتور محتوا، بیلد موبایل، تست sitemap
└── .github/workflows/      # ۵ ورک‌فوی CI/CD و اتوماسیون
```

---

## 🚀 راه‌اندازی

### پیش‌نیازها

- **Node.js نسخه 24.x**
- یک پروژه‌ی **Supabase** (دیتابیس، احراز هویت و Storage)
- کلید **Gemini** (برای قابلیت‌های هوش مصنوعی)
- اختیاری: SMS.ir، ربات تلگرام و Resend — برای OTP، اعلان‌ها و ایمیل

### متغیرهای محیطی (Vercel / `.env`)

| متغیر | کاربرد |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL` | اتصال به Supabase |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | سرویس‌های هوش مصنوعی |
| `SMSIR_API_KEY`, `SMSIR_OTP_TEMPLATE_ID`, `SMSIR_OTP_PARAM_NAME` | ورود با OTP پیامکی |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `NOTIFY_TOKEN`, `ADMIN_NOTIFY_EMAIL` | اعلان‌ها |
| `RESEND_API_KEY`, `RESEND_FROM` | ارسال ایمیل |
| `CRON_SECRET`, `AUDIT_TOKEN`, `OTP_TTL_MINUTES`, `OTP_MAX_ATTEMPTS` | امنیت کرون/حسابرسی و سیاست OTP |

### دیتابیس

- زنجیره‌ی ترتیب‌دار [`sql/`](sql/README.md) را از بالا به پایین در SQL Editor سوپابیس اجرا کنید (موتور حسابداری — ۱۶ مایگریشن، هرکدام با بلوک POSTCHECK اختصاصی).
- سپس مایگریشن‌های بخش عمومی سایت در `supabase/migrations/` (۱۱ مایگریشن).

### اجرا

```bash
# ۱. کلون کردن ریپو
git clone https://github.com/Alirezat01/karban.git
cd karban

# ۲. نصب وابستگی‌ها
npm install

# ۳. اجرای محیط توسعه (سایت)
npm run dev

# ۴. بیلد پروداکشن — سایت + متای پیش‌رندر + اپ موبایل (در مسیر /app)
npm run build

# بیلد فقط سایت یا فقط اپ موبایل
npm run build:site
npm run build:mobile

# ۵. سوئیت‌های تست E2E حسابداری
npm run test:acc

# لینت و چک تایپ
npm run lint
npm run typecheck
```

### اپلیکیشن موبایل (محیط توسعه)

```bash
cd mobile-app
npm install            # package.json مستقل (در صورت نیاز با --legacy-peer-deps)
cp .env.example .env.local   # مقدار GEMINI_API_KEY، APP_URL، VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY
npm run dev            # پیش‌نمایش وب
npm test               # تست‌های Vitest
```

خروجی APK اندروید به‌صورت خودکار توسط ورک‌فوی `build-android-apk` در `mobile-app/` ساخته می‌شود.

---

## ☁️ استقرار

- میزبانی روی **Vercel**: وب‌سایت در ریشه و اپ موبایل در مسیر **`/app`**.
- `vercel.json` شامل ری‌رایت مسیرهای فارسی، کش ابدی دارایی‌ها، هدرهای امنیتی و دو کرون روزانه (حسابرسی حسابداری + یادآوری‌ها) است.
- `www.karbanapp.ir` به‌صورت دائمی به `karbanapp.ir` ریدایرکت می‌شود.

---

## 🗺️ نقشه‌ی راه

- [x] هسته‌ی وب‌سایت — بانک قرارداد، ماشین‌حساب‌ها، دانشنامه، خدمات و سفارش
- [x] موتور حسابداری نسخه ۲ (صدور کانونی سند، قفل RPC، سخت‌سازی)
- [x] سرویس‌های AI (تحلیل قرارداد، دستیار حقوقی، OCR، رادار نقدینگی، لایحه، صوت)
- [x] سوپراپ موبایل (بیومتریک، اسکنر، پیش‌بینی نقدینگی، اشتراک)
- [x] REST API عمومی نسخه ۱ با کلید API
- [x] خطوط خودکار حسابرسی و تولید محتوا
- [ ] 🚧 توسعه‌ی مداوم — ماژول‌های بیشتر حسابداری، سرویس‌های بیشتر AI، نهایی‌سازی اپ و انتشار عمومی

**کاربان در حال توسعه‌ی فعال است — امکانات و مستندات به‌صورت منظم به‌روزرسانی می‌شوند.**

---

## 👨‍💻 برنامه‌نویس و طراح

<div align="center">

### علیرضا تجویدی — Alireza Tajvidi

*طراحی و توسعه‌ی کامل وب‌سایت، نرم‌افزار حسابداری و اپلیکیشن موبایل کاربان*

📧 [tajvidinejad@gmail.com](mailto:tajvidinejad@gmail.com) · 🐙 [@Alirezat01](https://github.com/Alirezat01)

</div>

**تماس پروژه:** hello@karbanapp.ir · [اینستاگرام — @karbanapp](https://www.instagram.com/karbanapp) · ۰۲۱-۸۸۳۴۲۶۷۹ · تهران، کریمخان، خیابان سنایی، پلاک ۶۱

---

## 🤝 مشارکت و لایسنس

پروژه در مراحل اولیه‌ی توسعه است؛ گزارش باگ و پیشنهادها از طریق [Issues](https://github.com/Alirezat01/karban/issues) یا ایمیل خوش‌آمد است.

© ۲۰۲۶ علیرضا تجویدی — تمامی حقوق محفوظ است. *(هنوز لایسنس متن‌باز منتشر نشده است.)*

---

<div align="center">

**⭐ اگر کاربان برایتان مفید بود، یک ستاره در گیت‌هاب فراموش نشود ⭐**

**🚧 در حال توسعه 🚧**

</div>

</div>
