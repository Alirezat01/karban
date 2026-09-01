# چک‌لیست سئو و بهینه‌سازی سایت کاربان

## ✅ تغییرات انجام‌شده

### 1. بهبود index.html
- [x] اصلاح OG Image از bolt.new به آدرس واقعی karban.ir/images/og-tools.png
- [x] اضافه کردن متاتگ‌های og:image:width، og:image:height و og:image:alt
- [x] اضافه کردن twitter:image:alt
- [x] بهینه‌سازی Preconnect و Preload برای فونت وزیرمتن
- [x] اضافه کردن Favicon و PWA Manifest
- [x] اضافه کردن Theme Color
- [x] کامنت‌های آماده برای Google Search Console و Analytics

### 2. اصلاح sitemap.xml
- [x] حذف صفحه /admin از sitemap

### 3. بهینه‌سازی robots.txt
- [x] اضافه کردن Crawl-delay برای ربات‌های سنگین (Ahrefs, Semrush, MJ12bot)
- [x] افزودن لینک Sitemap

### 4. Security Headers در vercel.json
- [x] HSTS (Strict-Transport-Security)
- [x] X-Frame-Options
- [x] X-Content-Type-Options
- [x] X-XSS-Protection
- [x] Referrer-Policy
- [x] Permissions-Policy
- [x] Cache-Control برای fonts, images, js, css

### 5. Schema.org JSON-LD
- [x] CollectionPage برای صفحات دانشنامه، قراردادها و ابزارها
- [x] Article برای مقالات دانشنامه و جزئیات قراردادها
- [x] SoftwareApplication برای ماشین‌حساب‌ها و تست سلامت

### 6. فایل‌های اضافی
- [x] site.webmanifest برای PWA
- [x] security.txt در مسیر .well-known

## 📋 اقدامات بعدی (دستی)

### تصاویر
- [ ] تبدیل og-tools.png به فرمت WebP برای کاهش حجم
- [ ] ایجاد favicon-32x32.png، favicon-16x16.png و apple-touch-icon.png
- [ ] اضافه کردن alt text به تمام تصاویر در کامپوننت‌ها

### Google Services
- [ ] ثبت سایت در Google Search Console
- [ ] دریافت کد تأیید و اضافه کردن به index.html
- [ ] تنظیم Google Analytics 4 و اضافه کردن GTag
- [ ] submit کردن sitemap در GSC

### محتوا
- [ ] تولید محتوای منظم برای بخش دانشنامه
- [ ] اضافه کردن FAQ به صفحات ماشین‌حساب
- [ ] بهینه‌سازی meta description برای هر صفحه
- [ ] اضافه کردن internal linking بین مقالات

### Performance
- [ ] Lazy loading برای تصاویر پایین صفحه
- [ ] Code splitting برای کامپوننت‌های سنگین
- [ ] بررسی Core Web Vitals در PageSpeed Insights
- [ ] بهینه‌سازی LCP با preload تصاویر اصلی

### Accessibility
- [ ] بررسی کنتراست رنگ‌ها
- [ ] اضافه کردن skip-to-content link
- [ ] تست با screen reader
- [ ] اضافه کردن ARIA labels به فرم‌ها

## 🎯 نمره فعلی: ۸.۵/۱۰

با انجام اقدامات دستی بالا می‌توانید به نمره ۹.۵+ برسید.
