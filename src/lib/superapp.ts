/* ────────────────────────────────────────────────────────────
   سوپراپ کاربان — تنظیمات قابل ویرایش از پنل ادمین + درخواست‌های دسترسی
   ────────────────────────────────────────────────────────────
   جدول superapp_settings (key='config') از پنل مدیریت پر می‌شود؛
   صفحه /superapp همین مقدار را می‌خواند و اگر جدول خالی بود یا
   خطا رخ داد، با DEFAULT_SUPERAPP_CONFIG کار می‌کند تا هیچ‌وقت
   صفحه سفید یا خطا نداشته باشیم.
   ──────────────────────────────────────────────────────────── */
import { supabase } from '@/lib/supabase';

export type SuperAppPlan = {
  id: string;
  name: string;
  /** مبلغ به تومان — صفر یعنی رایگان */
  price: number;
  periodLabel: string;
  badge: string | null;
  highlight: boolean;
  cta: string;
  features: string[];
};

export type SuperAppPromo = { code: string; percent: number; active: boolean };

export type SuperAppConfig = {
  /** مسیر نصب اپ موبایل روی سایت (پیش‌فرض: /app) */
  appUrl: string;
  /** طول دوره تست رایگان (روز) */
  trialDays: number;
  /** دریافت درخواست دسترسی فعال باشد؟ */
  requestsOpen: boolean;
  promo: SuperAppPromo;
  plans: SuperAppPlan[];
};

export type AccessRequestInput = {
  fullName: string;
  mobile: string;
  businessName?: string;
  plan: string;
};

export type AccessRequestRow = {
  id: string;
  full_name: string;
  mobile: string;
  business_name: string | null;
  plan: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  created_at: string;
  updated_at: string;
};

/** هم‌ارز مقادیر ثابت قبلی صفحه سوپراپ — منبع حقیقت در نبود دیتابیس */
export const DEFAULT_SUPERAPP_CONFIG: SuperAppConfig = {
  appUrl: '/app',
  trialDays: 10,
  requestsOpen: true,
  promo: { code: 'کاربان۱۴۰۵', percent: 25, active: true },
  plans: [
    {
      id: 'trial',
      name: 'تست رایگان',
      price: 0,
      periodLabel: '۱۰ روز',
      badge: null,
      highlight: false,
      cta: 'شروع رایگان',
      features: ['۲۵ فاکتور', '۱۵ گفت‌وگوی هوش مصنوعی', '۵ تحلیل هوشمند', '۱ کسب‌وکار'],
    },
    {
      id: 'monthly',
      name: 'ماهانه پیشرفته',
      price: 490000,
      periodLabel: 'ماه',
      badge: null,
      highlight: false,
      cta: 'درخواست فعال‌سازی',
      features: ['۳ کسب‌وکار', 'فاکتور نامحدود', '۲۰ گفت‌وگو در روز', '۱۰ تحلیل در روز', 'اسکنر هوشمند فاکتور و چک', 'لایحه دفاعیه مالیاتی'],
    },
    {
      id: 'yearly',
      name: 'سالانه پیشرفته',
      price: 4900000,
      periodLabel: 'سال',
      badge: '۲ ماه هدیه',
      highlight: true,
      cta: 'بهترین انتخاب',
      features: ['۵ کسب‌وکار', 'تمام امکانات ماهانه', 'رادار نقدینگی ۳۰ روزه', 'دستیار صوتی فارسی', 'پشتیبانی اولویت‌دار'],
    },
    {
      id: 'founder',
      name: 'بنیان‌گذار ویژه',
      price: 9800000,
      periodLabel: 'یک‌باره',
      badge: 'محدود',
      highlight: false,
      cta: 'همکاری ویژه',
      features: ['۱۰ شرکت هم‌زمان', 'هوش مصنوعی نامحدود', 'مشاور اختصاصی', 'راه‌اندازی مالیاتی'],
    },
  ],
};

/** ادغام محتاطانه مقدار دیتابیس با پیش‌فرض‌ها — فیلد گمشده هرگز undefined نمی‌ماند */
function mergeConfig(stored: Partial<SuperAppConfig> | null | undefined): SuperAppConfig {
  if (!stored || typeof stored !== 'object') return DEFAULT_SUPERAPP_CONFIG;
  const plans = Array.isArray(stored.plans) && stored.plans.length
    ? (stored.plans as SuperAppPlan[]).map((p, i) => ({ ...DEFAULT_SUPERAPP_CONFIG.plans[i], ...p, id: p.id || `plan-${i}` }))
    : DEFAULT_SUPERAPP_CONFIG.plans;
  return {
    ...DEFAULT_SUPERAPP_CONFIG,
    ...stored,
    promo: { ...DEFAULT_SUPERAPP_CONFIG.promo, ...(stored.promo || {}) },
    plans,
  };
}

/** خواندن تنظیمات سوپراپ — برای عموم (RLS: SELECT عمودی مجاز است) */
export async function fetchSuperAppConfig(): Promise<SuperAppConfig> {
  try {
    const { data, error } = await supabase
      .from('superapp_settings')
      .select('value')
      .eq('key', 'config')
      .maybeSingle();
    if (error || !data) return DEFAULT_SUPERAPP_CONFIG;
    return mergeConfig(data.value as Partial<SuperAppConfig>);
  } catch {
    return DEFAULT_SUPERAPP_CONFIG;
  }
}

/** ذخیره تنظیمات — فقط از پنل ادمین (RLS: نوشتن فقط ادمین) */
export async function saveSuperAppConfig(config: SuperAppConfig): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('superapp_settings')
    .upsert({ key: 'config', value: config, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** ثبت درخواست دسترسی از صفحه سوپراپ (عمومی — RLS: INSERT با CHECK true) */
export async function createAccessRequest(input: AccessRequestInput): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('superapp_access_requests').insert({
    full_name: input.fullName.trim(),
    mobile: input.mobile.trim(),
    business_name: input.businessName?.trim() || null,
    plan: input.plan,
    status: 'pending',
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** فهرست درخواست‌ها — فقط ادمین (در تب تنظیمات اپلیکیشن) */
export async function fetchAccessRequests(): Promise<AccessRequestRow[]> {
  const { data, error } = await supabase
    .from('superapp_access_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) return [];
  return (data || []) as AccessRequestRow[];
}

export const SUPERAPP_PLAN_LABELS: Record<string, string> = {
  trial: 'تست رایگان',
  monthly: 'ماهانه پیشرفته',
  yearly: 'سالانه پیشرفته',
  founder: 'بنیان‌گذار ویژه',
};
