/** @type {import('tailwindcss').Config} */
/* ════════════════════════════════════════════════════════════════════════════
   tailwind.config.js — نسخه تمیزشده
   ───────────────────────────────────────────────────────────────────────────
   تغییرات نسبت به نسخه قبلی:
     - حذف پالت karban.green که در CSS واقعی استفاده نمی‌شد (داده مرده)
     - اضافه کردن پالت karban.gold و karban.navy که در src/index.css استفاده می‌شود
     - اضافه کردن انیمیشن‌های fade-up و fade-in که در کارت‌ها استفاده می‌شود
   ════════════════════════════════════════════════════════════════════════════ */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        karban: {
          /* پالت طلایی (اصلی) — هماهنگ با --gold در src/index.css */
          gold: '#D8A53F',
          'gold-light': '#E8C476',
          'gold-dark': '#A8861B',
          /* پالت سرمه‌ای (پس‌زمینه) — هماهنگ با --bg در src/index.css */
          navy: '#0A0F1C',
          'navy-light': '#16203A',
          'navy-dark': '#070B14',
          /* سطح‌های کارت */
          surface: '#111A2C',
          'surface-2': '#16203A',
          line: '#1F2A44',
          /* متن */
          text: '#EEF2F8',
          muted: '#A7B3C9',
        },
      },
      fontFamily: {
        vazir: ['Vazirmatn', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 4px 24px -8px rgba(10, 15, 28, 0.25)',
        'card': '0 8px 40px -12px rgba(10, 15, 28, 0.4)',
        'glow-gold': '0 0 40px -8px rgba(216, 165, 63, 0.4)',
        'glow-gold-strong': '0 0 60px -10px rgba(216, 165, 63, 0.55)',
      },
      animation: {
        'fade-up': 'fade-up 0.7s ease-out both',
        'fade-in': 'fade-in 0.5s ease-out both',
        'shimmer': 'shimmer 2.5s ease-in-out infinite',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'shimmer': {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
      },
      borderRadius: {
        'xl2': '18px',
        'xl3': '24px',
      },
    },
  },
  plugins: [],
};
