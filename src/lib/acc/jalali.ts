/* تبدیل تاریخ شمسی ↔ میلادی — بازنویسی الگوریتم استاندارد jalaali بدون وابستگی */

const div = (a: number, b: number) => Math.trunc(a / b);
const mod = (a: number, b: number) => a - Math.trunc(a / b) * b;

const BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];

function jalCal(jy: number, withoutLeap = false): { leap: number; gy: number; march: number } {
  const bl = BREAKS.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0];
  let jump = 0;
  for (let i = 1; i < bl; i += 1) {
    const jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (!withoutLeap) {
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    let leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) leap = 4;
    return { leap, gy, march };
  }
  return { leap: 0, gy, march };
}

function g2d(gy: number, gm: number, gd: number): number {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4)
    + div(153 * mod(gm + 9, 12) + 2, 5)
    + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn: number): { gy: number; gm: number; gd: number } {
  let j = 4 * jdn + 139361631;
  j += div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

export type Jalali = { jy: number; jm: number; jd: number };

export function toJalali(gy: number, gm: number, gd: number): Jalali {
  const jdn = g2d(gy, gm, gd);
  const gyy = d2g(jdn).gy;
  let jy = gyy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gyy, 3, r.march);
  let k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

export function toGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  const r = jalCal(jy, true);
  return d2g(g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1);
}

export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return jalCal(jy).leap === 0 ? 30 : 29;
}

export const JALALI_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

export const toFaDigits = (v: string | number) =>
  String(v).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

export const toEnDigits = (v: string) =>
  v
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

export function dateToJalali(date: Date): Jalali {
  return toJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function todayJalali(): Jalali {
  return dateToJalali(new Date());
}

/** تاریخ میلادی ذخیره‌شده (ISO یا Date) → «۱۴۰۵/۰۶/۲۶» */
export function formatJalali(value: string | Date | null | undefined, style: 'numeric' | 'long' | 'short-month' = 'numeric'): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  const { jy, jm, jd } = dateToJalali(d);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (style === 'long') return `${toFaDigits(jd)} ${JALALI_MONTHS[jm - 1]} ${toFaDigits(jy)}`;
  if (style === 'short-month') return `${toFaDigits(jd)} ${JALALI_MONTHS[jm - 1]}`;
  return toFaDigits(`${jy}/${pad(jm)}/${pad(jd)}`);
}

/** «۱۴۰۵/۰۶/۲۶» (فارسی یا انگلیسی) → Date */
export function parseJalali(input: string, fallback: Date = new Date()): Date {
  const raw = toEnDigits(String(input || '')).replace(/[-.]/g, '/').trim();
  const m = raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return fallback;
  const jy = Number(m[1]);
  const jm = Number(m[2]);
  const jd = Number(m[3]);
  if (jm < 1 || jm > 12 || jd < 1 || jd > jalaliMonthLength(jy, jm)) return fallback;
  const g = toGregorian(jy, jm, jd);
  return new Date(g.gy, g.gm - 1, g.gd);
}

/** Date → رشته ISO (yyyy-mm-dd) برای ذخیره در ستون date_g */
export function dateToISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** ورودی کاربر شمسی → ISO میلادی برای ذخیره */
export function jalaliInputToISO(input: string, fallback: Date = new Date()): string {
  return dateToISO(parseJalali(input, fallback));
}

/** ISO → ورودی شمسی برای نمایش در فیلد */
export function isoToJalaliInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const { jy, jm, jd } = dateToJalali(d);
  const pad = (n: number) => String(n).padStart(2, '0');
  return toFaDigits(`${jy}/${pad(jm)}/${pad(jd)}`);
}

export function jalaliYearOf(value: string | Date): number {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return todayJalali().jy;
  return dateToJalali(d).jy;
}

/** اول/آخر ماه جاری شمسی به ISO — فیلتر پیش‌فرض گزارش‌ها */
export function currentJalaliMonthRange(): { from: string; to: string } {
  const t = todayJalali();
  const gFrom = toGregorian(t.jy, t.jm, 1);
  const gTo = toGregorian(t.jy, t.jm, jalaliMonthLength(t.jy, t.jm));
  return { from: dateToISO(new Date(gFrom.gy, gFrom.gm - 1, gFrom.gd)), to: dateToISO(new Date(gTo.gy, gTo.gm - 1, gTo.gd)) };
}

/** بازه سال شمسی (فروردین تا اسفند) به ISO */
export function jalaliYearRange(jy: number): { from: string; to: string } {
  const gFrom = toGregorian(jy, 1, 1);
  const gTo = toGregorian(jy, 12, jalaliMonthLength(jy, 12));
  return { from: dateToISO(new Date(gFrom.gy, gFrom.gm - 1, gFrom.gd)), to: dateToISO(new Date(gTo.gy, gTo.gm - 1, gTo.gd)) };
}

/** فصل شمسی (۱=بهار …) از تاریخ ISO */
export function jalaliSeasonOf(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 1;
  const { jm } = dateToJalali(d);
  return Math.ceil(jm / 3);
}

export const SEASON_NAMES = ['بهار', 'تابستان', 'پاییز', 'زمستان'];
