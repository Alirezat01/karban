/* ────────────────────────────────────────────────────────────
   Public content fetching: testimonials, site stats.
   Used by HomePage and RolePage for social proof.
   ──────────────────────────────────────────────────────────── */
import { supabase } from '@/lib/supabase';

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

export async function fetchSiteStats(): Promise<SiteStat[]> {
  const { data, error } = await supabase
    .from('site_stats')
    .select('key, value, label')
    .order('key', { ascending: true });
  if (error || !data) return [];
  return data as SiteStat[];
}

/* فال‌بک آمار، در صورت عدم دسترسی به دیتابیس */
export const FALLBACK_STATS: SiteStat[] = [
  { key: 'contracts_count', value: 90, label: 'قرارداد تخصصی' },
  { key: 'calculator_uses', value: 12000, label: 'محاسبه حقوقی' },
  { key: 'users_count', value: 5000, label: 'کاربر فعال' },
  { key: 'industries_count', value: 60, label: 'صنف پوشش‌داده‌شده' },
];
