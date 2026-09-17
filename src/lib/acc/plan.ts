/* سیستم پلن‌ها و تفکیک امکانات — نرم‌افزار معمولی (آزمایشی) در برابر نسخه پیشرفته
   پلن‌های پولی (monthly/yearly/founder) = پیشرفته
   پلن آزمایشی (trial) = معمولی — فقط ابزارهای روزمره پایه */

export type PlanTier = 'basic' | 'pro';

/* کلیدهای امکانات — امکانات پایه همیشه فعال‌اند؛ امکانات پیشرفته فقط با پلن پولی */
export type FeatureKey =
  | 'invoice_sale'            // فاکتور فروش و پیش‌فاکتور (پایه)
  | 'invoice_purchase'        // فاکتور خرید و برگشت از فروش
  | 'books'                   // دفترخانه: روزنامه، کل، تراز آزمایشی
  | 'trial_balance_4col'      // تراز آزمایشی چهارستونی
  | 'report_pl'               // گزارش سود و زیان
  | 'report_vat'              // گزارش ارزش افزوده فصلی
  | 'report_seasonal'         // صورت معاملات فصلی + CSV
  | 'report_sales_analysis'   // تحلیل فروش و مشتریان
  | 'report_product_profit'   // گزارش سود محصولات
  | 'manual_journal'          // سند حسابداری دستی + سرفصل اضافه
  | 'moadian_json'            // خروجی JSON سامانه مودیان
  | 'export_multiformat'      // خروجی اکسل / ورد / PDF
  | 'expense_tax_validation'  // اعتبارسنجی مالیاتی هزینه + آپلود سند
  | 'stuff_catalog'           // شناسه کالا و خدمات مودیان
  | 'brand_print'             // چاپ با لوگو/امضا/مهر شخصی
  | 'accountant_access'       // مدیریت حسابدار و دسترسی‌ها
  | 'multi_business'          // چند کسب‌وکار
  | 'checks'                  // دفتر چک‌ها
  | 'inventory'               // انبار و موجودی
  | 'reminders'               // یادآوری سررسیدها
  | 'partner_statement';      // صورت‌حساب طرف‌حساب + تحلیل سررسید

/* امکانات انحصاری نسخه پیشرفته — ۲۰ مورد (بیش از حداقل ۱۰ مورد درخواستی) */
export interface ProFeatureInfo {
  key: FeatureKey;
  title: string;
  desc: string;
}

export const PRO_FEATURES: ProFeatureInfo[] = [
  { key: 'invoice_purchase', title: 'صورتحساب خرید و برگشت از فروش', desc: 'ثبت خرید تامین‌کننده‌ها و برگشتی‌ها با سند دوطرفه خودکار' },
  { key: 'books', title: 'دفترخانه کامل', desc: 'دفتر روزنامه، دفتر کل و تراز آزمایشی خودکار' },
  { key: 'manual_journal', title: 'سند حسابداری دستی و سرفصل اضافه', desc: 'ثبت اسناد بدهکار/بستانکار دلخواه + ساخت سرفصل‌های اختصاصی' },
  { key: 'trial_balance_4col', title: 'تراز آزمایشی چهارستونی', desc: 'گردش بدهکار/بستانکار و مانده دوطرفه هر سرفصل' },
  { key: 'report_pl', title: 'گزارش سود و زیان', desc: 'سود واقعی دوره در یک نگاه، محاسبه‌شده از اسناد واقعی' },
  { key: 'report_vat', title: 'گزارش ارزش افزوده فصلی', desc: 'اظهارنامه فصلی با تفکیک اعتبار خرید و هزینه' },
  { key: 'report_seasonal', title: 'صورت معاملات فصلی + CSV', desc: 'خروجی رسمی معاملات فصل برای سامانه مالیاتی' },
  { key: 'report_sales_analysis', title: 'تحلیل فروش و مشتریان', desc: 'بیشترین مشتری، پرتکرارترین کالا و روند فروش' },
  { key: 'report_product_profit', title: 'گزارش سود محصولات', desc: 'سود هر کالا = فروش منهای بهای تمام‌شده، رتبه‌بندی‌شده' },
  { key: 'moadian_json', title: 'خروجی JSON سامانه مودیان', desc: 'بسته JSON هر صورتحساب آماده ارسال با کارپوشه/TSP' },
  { key: 'export_multiformat', title: 'خروجی اکسل، ورد و PDF', desc: 'دانلود همه جدول‌ها و گزارش‌ها در سه فرمت' },
  { key: 'expense_tax_validation', title: 'اعتبارسنجی مالیاتی هزینه‌ها', desc: 'کنترل سند هزینه طبق مواد ۱۴۷، ۱۴۸ و ۱۶۹ + آپلود عکس فاکتور' },
  { key: 'stuff_catalog', title: 'شناسه کالا و خدمات مودیان', desc: 'انتخابگر رسمی stuffId و واردات کاتالوگ مالیاتی' },
  { key: 'brand_print', title: 'چاپ با لوگو، امضا و مهر شخصی', desc: 'فاکتور رسمی با هویت بصری کسب‌وکار شما (معمولی: لوگوی کاربان)' },
  { key: 'accountant_access', title: 'مدیریت حسابدار و دسترسی‌ها', desc: 'دعوت حسابدار با نقش محدود و رهگیری فعالیت' },
  { key: 'multi_business', title: 'چند کسب‌وکار همزمان', desc: 'تا ۳ کسب‌وکار در پلن ماهانه، ۵ در سالانه و ۱۰ در بنیان‌گذار' },
  { key: 'checks', title: 'دفتر چک‌ها', desc: 'چک‌های دریافتی/پرداختی با سررسید، وصول، برگشت و یادآوری' },
  { key: 'inventory', title: 'انبار و موجودی', desc: 'کاهش/افزایش خودکار موجودی با صدور فاکتور + هشدار کمبود' },
  { key: 'reminders', title: 'یادآوری سررسیدها', desc: 'فاکتورهای وصول‌نشده، چک‌های نزدیک و کالای رو به اتمام' },
  { key: 'partner_statement', title: 'صورت‌حساب طرف‌حساب', desc: 'گردش حساب هر مشتری/تامین‌کننده + تحلیل سررسید مطالبات' },
];

const PRO_KEYS = new Set(PRO_FEATURES.map((f) => f.key));

const PRO_PLANS = new Set(['monthly', 'yearly', 'founder', 'active']);

export const PLAN_TIER_LABEL: Record<PlanTier, string> = {
  basic: 'معمولی',
  pro: 'پیشرفته',
};

/** پلن پولی دارد یا نسخه معمولی (آزمایشی) است */
export function isProPlan(plan: string | null | undefined): boolean {
  return PRO_PLANS.has(plan || '');
}

export function planTier(plan: string | null | undefined): PlanTier {
  return isProPlan(plan) ? 'pro' : 'basic';
}

/** آیا امکان داده‌شده برای این پلن فعال است؟ */
export function featureEnabled(plan: string | null | undefined, key: FeatureKey): boolean {
  if (!PRO_KEYS.has(key)) return true; // امکان پایه
  return isProPlan(plan);
}

/** فهرست امکاناتی که کاربر معمولی ندارد — برای نمایش در پنجره ارتقا */
export function lockedFeatures(plan: string | null | undefined): ProFeatureInfo[] {
  if (isProPlan(plan)) return [];
  return PRO_FEATURES;
}
