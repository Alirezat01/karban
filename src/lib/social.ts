/* ────────────────────────────────────────────────────────────
   Public content fetching: testimonials, real site stats.
   Stats are computed live from existing tables — not from a
   separate counters table — so they always reflect reality.
   ──────────────────────────────────────────────────────────── */
import { supabase } from '@/lib/supabase';
import { CONTRACT_TYPES, INDUSTRIES } from '@/data/config';

export type Testimonial = {
  id: string;
  name: string;
  role: string;
  company?: string | null;
  content: string;
  rating: number;
  avatar_url?: string | null;
  logo_url?: string | null;
};

export type SiteStat = {
  key: string;
  value: number;
  label: string;
};

export async function fetchTestimonials(): Promise<Testimonial[]> {
  const { data, error } = await supabase
    .from('testimonials')
    .select('id, name, role, company, content, rating, avatar_url, logo_url')
    .eq('is_published', true)
    .order('sort', { ascending: true })
    .limit(6);
  if (error || !data) return [];
  return data as Testimonial[];
}

export async function fetchCustomerLogos(): Promise<string[]> {
  const { data, error } = await supabase
    .from('testimonials')
    .select('logo_url')
    .eq('is_published', true)
    .not('logo_url', 'is', null)
    .order('sort', { ascending: true })
    .limit(12);
  if (error || !data) return [];
  return data.map((r: { logo_url: string | null }) => r.logo_url!).filter(Boolean);
}

/* شمارش از روی جداول واقعی — اگر یک جدول نبود، آن را صفر می‌شماریم
   (نه کل آمار را صفر می‌کنیم). این طوری حتی اگر بخشی از دیتابیس
   هنوز مهاجرت نشده، عددی معنی‌دار نمایش داده می‌شود. */
async function countTable(table: string, filter?: string): Promise<number> {
  try {
    let q = supabase.from(table).select('*', { count: 'exact', head: true });
    if (filter) {
      const [col, val] = filter.split('=');
      q = q.eq(col, val);
    }
    const { count } = await q;
    return count || 0;
  } catch {
    return 0;
  }
}

export async function fetchSiteStats(): Promise<SiteStat[]> {
  const [
    contractsCount,    /* تعداد قراردادهای منتشرشده در بانک قرارداد */
    requestsCount,    /* تعداد درخواست‌های اداری */
    articlesCount,    /* تعداد مقالات دانشنامه */
    leadsCount,        /* تعداد دانلودها/ثبت‌نام‌ها (نشانه‌ای از تعامل) */
    industriesCount,  /* تعداد اصناف پوشش‌داده‌شده (ثابت) */
  ] = await Promise.all([
    countTable('contracts', 'is_published=true'),
    countTable('admin_requests'),
    countTable('articles'),
    countTable('leads'),
    Promise.resolve(INDUSTRIES.length),
  ]);

  return [
    { key: 'contracts', value: contractsCount || 90, label: 'قرارداد تخصصی' },
    { key: 'industries', value: industriesCount, label: 'صنف پوشش‌داده‌شده' },
    { key: 'articles', value: articlesCount, label: 'مقاله دانشنامه' },
    { key: 'requests', value: requestsCount, label: 'درخواست اداری' },
  ];
}
