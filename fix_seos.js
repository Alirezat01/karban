import fs from 'fs';

const pages = [
  { file: 'src/components/HomePage.tsx', title: 'کاربان | مرجع قراردادها و مدیریت کسب‌وکار', desc: 'کاربان؛ دانلود قراردادهای معتبر، محاسبه‌گر حقوق و دستمزد، ابزارهای هوش مصنوعی و آموزش راه‌اندازی کسب‌وکار در ایران.' },
  { file: 'src/components/CalculatorPage.tsx', title: 'محاسبه‌گر حقوق و مزایا ۱۴۰۵ | کاربان', desc: 'ابزار دقیق محاسبه حقوق، دستمزد، اضافه‌کاری، سنوات و بیمه ۱۴۰۵ بر اساس آخرین تغییرات قانون کار ایران.' },
  { file: 'src/components/ContentPage.tsx', title: 'کاربان | صفحه محتوا', desc: 'مطالب تخصصی حوزه مدیریت، منابع انسانی و حقوقی در پلتفرم کاربان' },
];

pages.forEach(({file, title, desc}) => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    if (!content.includes('useSEO')) {
      content = content.replace("from 'react';", "from 'react';\nimport { useSEO } from '@/lib/useSEO';\n");

      const componentNameMatch = content.match(/export default function (\w+)/);
      if (componentNameMatch) {
        const funcStart = content.indexOf('{', content.indexOf(`export default function ${componentNameMatch[1]}`));
        content = content.slice(0, funcStart + 1) + `\n  useSEO('${title}', '${desc}');` + content.slice(funcStart + 1);
        fs.writeFileSync(file, content, 'utf8');
      }
    }
  }
});
