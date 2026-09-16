/* تنظیمات سراسری ماژول حسابداری — از جدول app_settings (کلید acc_config)
   ادمین در پنل مدیریت می‌تواند همه این‌ها را تغییر دهد؛ مقادیر پیش‌فرض اینجاست */

export interface AccConfig {
  /** نرخ پیش‌فرض ارزش افزوده (٪) */
  vat_rate: number;
  /** روزهای نسخه آزمایشی رایگان */
  trial_days: number;
  /** سقف صورتحساب در دوره آزمایشی */
  trial_invoice_limit: number;
  /** قیمت پلن ماهانه (ریال) */
  price_monthly: number;
  /** قیمت پلن سالانه (ریال) */
  price_yearly: number;
  /** سقف کسب‌وکار هر پلن */
  business_limit_trial: number;
  business_limit_monthly: number;
  business_limit_yearly: number;
  business_limit_founder: number;
  /** نمایش فاکتورساز عمومی در سایت */
  public_invoice_maker: boolean;
  /** پیام تبلیغاتی زیر فاکتورهای بدون برند */
  brand_tagline: string;
}

export const DEFAULT_ACC_CONFIG: AccConfig = {
  vat_rate: 10,
  trial_days: 14,
  trial_invoice_limit: 20,
  price_monthly: 2_900_000,
  price_yearly: 29_000_000,
  business_limit_trial: 1,
  business_limit_monthly: 3,
  business_limit_yearly: 5,
  business_limit_founder: 10,
  public_invoice_maker: true,
  brand_tagline: 'صادرشده با نرم‌افزار حسابداری هوشمند کاربان — karbanapp.ir',
};

/** خواندن تنظیمات حسابداری از دیتابیس (بدون خطا — بازگشت به پیش‌فرض) */
export async function fetchAccConfig(): Promise<AccConfig> {
  try {
    const { supabase } = await import('@/lib/supabase');
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'acc_config')
      .maybeSingle();
    if (!data?.value) return { ...DEFAULT_ACC_CONFIG };
    const v = data.value as Record<string, unknown>;
    return {
      ...DEFAULT_ACC_CONFIG,
      ...(typeof v.vat_rate === 'number' ? { vat_rate: v.vat_rate } : {}),
      ...(typeof v.trial_days === 'number' ? { trial_days: v.trial_days } : {}),
      ...(typeof v.trial_invoice_limit === 'number' ? { trial_invoice_limit: v.trial_invoice_limit } : {}),
      ...(typeof v.price_monthly === 'number' ? { price_monthly: v.price_monthly } : {}),
      ...(typeof v.price_yearly === 'number' ? { price_yearly: v.price_yearly } : {}),
      ...(typeof v.business_limit_trial === 'number' ? { business_limit_trial: v.business_limit_trial } : {}),
      ...(typeof v.business_limit_monthly === 'number' ? { business_limit_monthly: v.business_limit_monthly } : {}),
      ...(typeof v.business_limit_yearly === 'number' ? { business_limit_yearly: v.business_limit_yearly } : {}),
      ...(typeof v.business_limit_founder === 'number' ? { business_limit_founder: v.business_limit_founder } : {}),
      ...(typeof v.public_invoice_maker === 'boolean' ? { public_invoice_maker: v.public_invoice_maker } : {}),
      ...(typeof v.brand_tagline === 'string' ? { brand_tagline: v.brand_tagline } : {}),
    };
  } catch {
    return { ...DEFAULT_ACC_CONFIG };
  }
}
