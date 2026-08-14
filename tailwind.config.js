/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        karban: {
          green: '#0F5132',
          'green-dark': '#0A3D26',
          'green-light': '#1A7A4F',
          gold: '#C9A227',
          'gold-light': '#E0BE4A',
          'gold-dark': '#A8851C',
          bg: '#FAFAF7',
          navy: '#12344D',
          'navy-light': '#1E4A6E',
          'navy-dark': '#0B2335',
        },
      },
      fontFamily: {
        vazir: ['Vazirmatn', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 4px 24px -8px rgba(18, 52, 77, 0.12)',
        'card': '0 8px 40px -12px rgba(18, 52, 77, 0.15)',
        'glow-green': '0 0 40px -8px rgba(15, 81, 50, 0.35)',
        'glow-gold': '0 0 40px -8px rgba(201, 162, 39, 0.4)',
      },
      animation: {
        'fade-up': 'fade-up 0.7s ease-out both',
      },
    },
  },
  plugins: [],
};
