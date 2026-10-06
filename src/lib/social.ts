/* ────────────────────────────────────────────────────────────
   Public content fetching: testimonials, real site stats.
   Stats use two strategies:
     1. Try live count from existing tables (works if RLS allows anon read)
     2. Fall back to sensible defaults derived from the codebase
        (CONTRACT_TYPES count, INDUSTRIES count, etc.)
   This way stats always show meaningful numbers — never zero.
   ──────────────────────────────────────────────────────────── */
import { supabase } from '@/lib/supabase';
import { CONTRACT_TYPES, INDUSTRIES, calculatorItems } from '@/data/config';

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

async function countTable(table: string, filter?: string): Promise<number> {
  try {
    let q = supabase.from(table).select('*', { count: 'exact', head: true });
    if (filter) {
      const [col, val] = filter.split('=');
      q = q.eq(col, val);
    }
    const { count, error } = await q;
    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}

const FALLBACK = {
  contractsCount: CONTRACT_TYPES.length,
  industriesCount: INDUSTRIES.length,
  calculatorsCount: calculatorItems.length,
};

export async function fetchSiteStats(): Promise<SiteStat[]> {
  const [
    contractsFromDb,
    requestsCount,
    articlesCount,
    leadsCount,
  ] = await Promise.all([
    countTable('contracts', 'is_published=true'),
    countTable('admin_requests'),
    countTable('articles'),
    countTable('leads'),
  ]);

  const contracts = contractsFromDb > 0 ? contractsFromDb : FALLBACK.contractsCount;

  return [
    { key: 'contracts', value: contracts, label: 'قرارداد تخصصی' },
    { key: 'industries', value: FALLBACK.industriesCount, label: 'صنف پوشش‌داده‌شده' },
    { key: 'articles', value: articlesCount || 0, label: 'مقاله دانشنامه' },
    { key: 'calculators', value: FALLBACK.calculatorsCount, label: 'ماشین‌حساب هوشمند' },
  ];
}
