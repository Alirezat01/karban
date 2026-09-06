/**
 * اسلاگ فارسی مقاله‌ها و دسته‌های دانشنامه — منبع واحد React و prerender و sitemap.
 * الگوی URL مقاله: /دانشنامه/مقاله/{slug}-{id}
 *  - id عدد لاتین انتهایی است و عنوان فارسی قبل از آن می‌آید؛ پس از همیشه قابل تفکیک است
 *    (عنوان‌ها ارقام فارسی دارند، id لاتین است).
 * URLهای عددی قدیمی (/دانشنامه/مقاله/12) هم پاسخ می‌دهند ولی canonical به URL اسلاگ است.
 */

export const KNOWLEDGE_CATEGORIES = ['حقوقی و قانون کار', 'مالیات', 'حسابداری', 'منابع انسانی', 'مدیریت'];

/* اسلاگ دسته: فاصله → خط تیره (مطابق کتابخانه قوانین) */
export const categorySlug = (name: string): string => name.replace(/ /g, '-');

/* اسلاگ دسته از URL segment؛ ورودی می‌تواند خود نام یا اسلاگ باشد */
export const categoryFromSegment = (seg: string): string | null => {
  const name = KNOWLEDGE_CATEGORIES.find((c) => c === seg || categorySlug(c) === seg);
  return name || null;
};

/* پاکسازی عنوان برای URL: فاصله/نیم‌فاصله → خط تیره، حذف علائم + سقف ۴۰ کاراکتر
   (نام فایل/پوشه انکد‌شده باید زیر محدودیت ۲۵۵ بایت فایلسیستم بماند؛
    هر حرف فارسی در انکد ≈ ۶ بایت → ۴۰ حرف ≈ ۲۴۰ بایت) */
const MAX_SLUG_CHARS = 40;

export function slugifyTitle(title: string): string {
  let s = (title || '')
    .trim()
    .replace(/[\s\u200c]+/g, '-')
    .replace(/[?؟!:؛،«»"'.()[\]{}+*&%=#$@_|~^<>,؛]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (s.length > MAX_SLUG_CHARS) {
    s = s.slice(0, MAX_SLUG_CHARS);
    const cut = s.lastIndexOf('-');
    if (cut > 15) s = s.slice(0, cut);
  }
  return s || 'مقاله';
}

/* مسیر خام (بدون انکد) — مثل بقیه مسیرهای فارسی؛ انکد در لایه‌های نمایش/فایل انجام می‌شود */
export const articleSlugPath = (title: string, id: number | string): string =>
  `/دانشنامه/مقاله/${slugifyTitle(title)}-${id}`;

/**
 * استخراج id مقاله از segment انتهایی URL:
 *  - «عنوان-دو-کلمه-42» → 42
 *  - «42» (URL عددی قدیمی) → 42
 *  - بقیه → null
 */
export function articleIdFromSegment(rawSeg: string): number | null {
  let seg = rawSeg;
  try { seg = decodeURIComponent(rawSeg); } catch { /* همان خام */ }
  const trailing = seg.match(/-(\d+)$/);
  if (trailing) return Number(trailing[1]);
  if (/^\d+$/.test(seg)) return Number(seg);
  return null;
}
