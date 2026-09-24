import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

/* ─────────────────────────────────────────────────────────────────────────
   خودترمیمی ناوبری بعد از دیپلوی جدید (RCA باگ «کلیک منو کار نمی‌کند»):
   منوی سایت، صفحات را با import پویا (lazy chunk) باز می‌کند. وقتی روی
   سرور نسخهٔ جدید دیپلوی می‌شود، فایل‌های chunk نسخهٔ قدیمی که در تبِ باز
   کاربر کش شده‌اند از سرور حذف شده‌اند → کلیک روی منو فقط لودر بی‌پایان
   نشان می‌دهد و به نظر می‌رسد «منو کار نمی‌کند».
   راه‌حل: اگر بارگذاری chunk شکست خورد، یک‌بار صفحه به‌طور کامل رفرش می‌شود
   تا باندل تازه از سرور گرفته شود. فلگ sessionStorage جلوی رفرشِ بی‌نهایت
   (مثلاً در حالت آفلاین) را می‌گیرد و چند ثانیه بعد از بوتِ موفق پاک می‌شود.
   ───────────────────────────────────────────────────────────────────────── */
const CHUNK_FLAG = 'karban:chunk-reload';

window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason as { message?: string } | string | null | undefined;
  const msg = typeof reason === 'string' ? reason : reason?.message || '';
  if (
    /dynamically imported module|importing a module|Failed to fetch dynamically|error loading dynamically|Loading chunk|chunk/i.test(msg)
    && !sessionStorage.getItem(CHUNK_FLAG)
  ) {
    sessionStorage.setItem(CHUNK_FLAG, String(Date.now()));
    window.location.reload();
  }
});

/* React.lazy بدون Error Boundary خطا را به window.onerror می‌دهد — همان سیاست */
window.addEventListener('error', (e) => {
  const msg = e?.message || '';
  if (
    /dynamically imported module|importing a module|Failed to fetch dynamically|error loading dynamically|Loading chunk|chunk/i.test(msg)
    && !sessionStorage.getItem(CHUNK_FLAG)
  ) {
    sessionStorage.setItem(CHUNK_FLAG, String(Date.now()));
    window.location.reload();
  }
});

/* اگر بوت موفق بود و چند ثانیه گذشت، فلگ پاک می‌شود تا دیپلویِ بعدی هم
   بتواند خودش را ترمیم کند (نه فقط بار اول) */
window.setTimeout(() => sessionStorage.removeItem(CHUNK_FLAG), 8000);

if (window.location.hash && window.location.hash.startsWith('#/')) {
  const path = window.location.hash.slice(1);
  window.history.replaceState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
