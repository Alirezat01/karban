/* ═════════════════════════════════════════════════════════════════════════════
   بیلد اپلیکیشن موبایل کاربان (سوپراپ) — مرحله آخر زنجیره `npm run build`
   ─────────────────────────────────────────────────────────────────────────────
   • اگر پوشه mobile-app/ وجود نداشته باشد (مثلاً قبل از آپلود اپ)، با موفقیت
     رد می‌شود تا بیلد سایت اصلی هیچ‌وقت نشکند.
   • اگر وجود داشته باشد: npm install داخل همان پوشه (package.json مستقل —
     بدون تداخل با نسخه‌های سایت اصلی) و سپس بیلد Vite با:
       base = /app/        → همه مسیرها زیر karbanapp.ir/app
       outDir = ../dist/app → داخل خروجی سایت اصلی منتشر می‌شود
   • پرچم‌های CLI مستقل از vite.config اپ عمل می‌کنند تا نیازی به ویرایش
     تنظیمات اپ نباشد.
   ═════════════════════════════════════════════════════════════════════════════ */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const appDir = resolve(process.cwd(), 'mobile-app');

if (!existsSync(resolve(appDir, 'package.json'))) {
  console.log('[build-mobile] پوشه mobile-app پیدا نشد — بیلد اپ موبایل رد شد و فقط سایت اصلی منتشر می‌شود.');
  process.exit(0);
}

console.log('[build-mobile] نصب وابستگی‌های اپ موبایل (package.json مستقل)…');
/* --legacy-peer-deps: اپ با Bun ساخته شده و تعارض‌های جزئی peer (مثل esbuild
   بین vite 8 و tsx) را npm باید نادیده بگیرد — وگرنه ERESOLVE می‌دهد. */
execSync('npm install --no-audit --no-fund --legacy-peer-deps', { cwd: appDir, stdio: 'inherit' });

console.log('[build-mobile] بیلد Vite اپ با base=/app/ → dist/app …');
execSync(
  'npx vite build --base=/app/ --outDir=../dist/app --emptyOutDir',
  { cwd: appDir, stdio: 'inherit' },
);

console.log('[build-mobile] اپ موبایل آماده شد: karbanapp.ir/app ✓');
