/* پول، نرخ و عدد به حروف — مطابق استاندارد صورتحساب‌های رسمی ایران */

import { toFaDigits, toEnDigits } from './jalali';

const groupFormatter = new Intl.NumberFormat('en-US');

/** گروه‌بندی با ارقام فارسی: ۱۲۳٬۴۵۶ */
export function formatMoney(value: number | string | null | undefined, faDigits = true): string {
  const n = typeof value === 'number' ? value : Number(toEnDigits(String(value ?? '')).replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(n)) return faDigits ? '۰' : '0';
  const grouped = groupFormatter.format(Math.round(n)).replace(/,/g, '٬');
  return faDigits ? toFaDigits(grouped) : grouped;
}

/** با واحد: ۱۲۳٬۴۵۶ ریال */
export function formatMoneyUnit(value: number | string | null | undefined, currency: 'IRR' | 'IRT' = 'IRR'): string {
  return `${formatMoney(value)} ${currency === 'IRT' ? 'تومان' : 'ریال'}`;
}

/** ورودی کاربر (با ارقام فارسی و جداکننده) → عدد */
export function parseMoney(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Math.round(value);
  const cleaned = toEnDigits(String(value ?? '')).replace(/[^\d.-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** نمایش مقدار داخل input با گروه‌بندی فارسی */
export function formatInputMoney(value: string | number | null | undefined): string {
  const n = parseMoney(value);
  if (!n) return '';
  return formatMoney(n);
}

/* ───────────── عدد به حروف (برای صورتحساب رسمی) ───────────── */

const ONES = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
const TEENS = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
const TENS = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
const HUNDREDS = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
const SCALES = ['', 'هزار', 'میلیون', 'میلیارد', 'هزار میلیارد'];

function threeToWords(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const t = n % 100;
  if (h) parts.push(HUNDREDS[h]);
  if (t >= 10 && t < 20) {
    parts.push(TEENS[t - 10]);
  } else {
    const ten = Math.floor(t / 10);
    const one = t % 10;
    if (ten) parts.push(TENS[ten]);
    if (one) parts.push(ONES[one]);
  }
  return parts.join(' و ');
}

export function numberToWords(value: number): string {
  let n = Math.round(Math.abs(value));
  if (!n) return 'صفر';
  const groups: number[] = [];
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }
  const words: string[] = [];
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    if (!groups[i]) continue;
    const scale = SCALES[i] ? ` ${SCALES[i]}` : '';
    words.push(`${threeToWords(groups[i])}${scale}`);
  }
  return (value < 0 ? 'منفی ' : '') + words.join(' و ');
}

/** «دویست و پنجاه میلیون ریال» — برای فاکتور رسمی */
export function amountToWords(value: number | null | undefined, currency: 'IRR' | 'IRT' = 'IRR'): string {
  return `${numberToWords(value || 0)} ${currency === 'IRT' ? 'تومان' : 'ریال'}`;
}

/** گرد کردن مالیات هر ردیف */
export function roundVat(base: number, rate: number): number {
  return Math.round((base * (rate || 0)) / 100);
}
