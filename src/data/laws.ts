import lawsData from './laws.json';

const raw = lawsData as unknown as { categories: string[]; laws: { id: string; law: string; num: string; title: string; text: string; tags: string[] }[] };

export type LawItem = {
  id: string;
  law: 'قانون کار' | 'تأمین اجتماعی' | 'مالیات‌های مستقیم' | 'آیین‌نامه‌ها';
  num: string;
  title: string;
  text: string;
  tags: string[];
};

export const LAW_CATEGORIES = raw.categories as unknown as readonly ['قانون کار', 'تأمین اجتماعی', 'مالیات‌های مستقیم', 'آیین‌نامه‌ها'];

export const LAWS: LawItem[] = raw.laws as LawItem[];

/** اسلاگ URL-safe برای دسته‌ها: فاصله → خط‌تیره */
export const lawSlug = (name: string) => name.replace(/ /g, '-');
export const lawCategoryBySlug = (slug: string): string | null =>
  raw.categories.find((c) => lawSlug(c) === slug) || null;

export function searchLaws(query: string, category: string): LawItem[] {
  const q = query.trim();
  return LAWS.filter((l) => {
    if (category !== 'همه' && l.law !== category) return false;
    if (!q) return true;
    return (
      l.title.includes(q) ||
      l.text.includes(q) ||
      l.num.includes(q) ||
      l.tags.some((t) => t.includes(q))
    );
  });
}
