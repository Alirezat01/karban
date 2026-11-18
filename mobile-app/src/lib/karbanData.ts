import { formatFaNum, toFaDigits, formatSayadiFa } from '../components/ui/PersianInputs';

export { formatFaNum, toFaDigits, formatSayadiFa };

export type PlanType = 'free' | 'monthly' | 'yearly' | 'founder';

export type FeatureKey =
  | 'purchase_return_invoice'
  | 'double_entry_books'
  | 'trial_balance_4col'
  | 'profit_loss_report'
  | 'vat_seasonal_169'
  | 'sales_customer_analytics'
  | 'export_excel_word_pdf'
  | 'tax_expense_validation'
  | 'moadian_commodity_code'
  | 'custom_logo_stamp_sign'
  | 'sayadi_check_reminders'
  | 'auto_inventory_stock'
  | 'partner_ledger_card'
  | 'invite_accountant_rbac'
  | 'multi_business_support'
  | 'bank_reconciliation'
  | 'payroll_voucher_engine'
  | 'mobile_ai_ocr_scanner'
  | 'mobile_tax_defense_brief'
  | 'mobile_cashflow_ai_radar'
  | 'mobile_touch_sign_share';

export interface ProFeatureDef {
  key: FeatureKey;
  title: string;
  desc: string;
  badge?: 'موبایل‌پرو' | 'حسابداری پیشرفته';
}

export const PRO_FEATURES: ProFeatureDef[] = [
  {
    key: 'mobile_ai_ocr_scanner',
    title: 'اسکن هوشمند فاکتور و چک صیادی با دوربین (AI OCR)',
    desc: 'عکسبرداری از فاکتور کاغذی یا چک صیادی و تبدیل خودکار به سند حسابداری و رکورد چک ۱۶ رقمی.',
    badge: 'موبایل‌پرو',
  },
  {
    key: 'mobile_tax_defense_brief',
    title: 'تولید خودکار لایحه دفاعیه مالیاتی و اداره کار',
    desc: 'نگارش رسمی لایحه اعتراض به برگ تشخیص (ماده ۲۴۴ و ۲۵۱ مکرر) و هیئت تشخیص کار با استناد قانونی.',
    badge: 'موبایل‌پرو',
  },
  {
    key: 'mobile_cashflow_ai_radar',
    title: 'رادار پیش‌بینی نقدینگی و هشدار کسری چک و مالیات',
    desc: 'تحلیل ۳۰ روز آینده خزانه، هشدار هوشمند سررسید چک‌های صیادی و پیش‌بینی بدهی ارزش افزوده.',
    badge: 'موبایل‌پرو',
  },
  {
    key: 'mobile_touch_sign_share',
    title: 'امضای دیجیتال لمسی روی موبایل و اشتراک آنی واتساپ/تلگرام',
    desc: 'ترسیم امضا با انگشت روی صفحه گوشی، درج خودکار مهر و امضا پای فاکتور و قرارداد و ارسال فوری.',
    badge: 'موبایل‌پرو',
  },
  {
    key: 'purchase_return_invoice',
    title: 'فاکتور خرید و برگشت از فروش رسمی',
    desc: 'ثبت کامل فاکتورهای خرید با اعتبار مالیاتی و صورتحساب‌های برگشت از فروش استاندارد.',
    badge: 'حسابداری پیشرفته',
  },
  {
    key: 'double_entry_books',
    title: 'دفتر روزنامه و دفتر کل دوطرفه خودکار',
    desc: 'صدور خودکار سند حسابداری دوطرفه (بدهکار/بستانکار) برای هر فاکتور، دریافت، پرداخت و هزینه.',
    badge: 'حسابداری پیشرفته',
  },
  {
    key: 'trial_balance_4col',
    title: 'تراز آزمایشی چهارستونی استاندارد',
    desc: 'نمایش گردش بدهکار، گردش بستانکار و مانده نهایی تمامی حساب‌های کل و معین در لحظه.',
    badge: 'حسابداری پیشرفته',
  },
  {
    key: 'profit_loss_report',
    title: 'صورت سود و زیان تحلیلی دوره',
    desc: 'محاسبه دقیق درآمد خالص، بهای تمام‌شده، هزینه‌های عملیاتی و حاشیه سود کسب‌وکار.',
    badge: 'حسابداری پیشرفته',
  },
  {
    key: 'vat_seasonal_169',
    title: 'گزارش ارزش افزوده ۱۰٪ و معاملات فصلی ماده ۱۶۹',
    desc: 'محاسبه مالیات فروش، اعتبار خرید و خروجی استاندارد جهت ارسال اظهارنامه و صورت معاملات فصلی.',
    badge: 'حسابداری پیشرفته',
  },
  {
    key: 'sales_customer_analytics',
    title: 'تحلیل پیشرفته فروش و وفاداری مشتریان',
    desc: 'رتبه‌بندی پرفروش‌ترین کالاها و خوش‌حساب‌ترین مشتریان به تفکیک ماه و فصل.',
    badge: 'حسابداری پیشرفته',
  },
  {
    key: 'export_excel_word_pdf',
    title: 'خروجی رسمی Excel، CSV، Word و PDF مودیان',
    desc: 'دریافت فایل اکسل دفاتر، خروجی چاپی صورتحساب الکترونیکی مودیان و متن قراردادها.',
    badge: 'حسابداری پیشرفته',
  },
  {
    key: 'tax_expense_validation',
    title: 'اعتبارسنجی مالیاتی هزینه‌ها و پیوست تصویر سند',
    desc: 'بررسی شروط قابل قبول بودن هزینه از نظر ممیز مالیاتی (ماده ۱۴۷ و ۱۴۸ ق.م.م).',
    badge: 'حسابداری پیشرفته',
  },
  {
    key: 'moadian_commodity_code',
    title: 'شناسه ۱۳ رقمی کالا و خدمات سامانه مودیان',
    desc: 'نگه‌داری و درج خودکار شناسه یکتای کالا/خدمت و نرخ ارزش افزوده اختصاصی روی هر ردیف فاکتور.',
    badge: 'حسابداری پیشرفته',
  },
  {
    key: 'custom_logo_stamp_sign',
    title: 'چاپ فاکتور با لوگو، امضای مجاز و مهر اختصاصی شرکت',
    desc: 'شخصی‌سازی کامل سربرگ صورتحساب رسمی با هویت بصری و مهر قانونی کسب‌وکار شما.',
    badge: 'حسابداری پیشرفته',
  },
  {
    key: 'sayadi_check_reminders',
    title: 'دفتر چک‌های صیادی ۱۶ رقمی + استعلام رنگ و یادآوری',
    desc: 'مدیریت چک‌های دریافتنی و پرداختنی با وضعیت رنگ صیادی و هشدار سررسید قبل از موعد.',
    badge: 'حسابداری پیشرفته',
  },
  {
    key: 'auto_inventory_stock',
    title: 'انبارداری و کنترل موجودی خودکار کالا',
    desc: 'کسر و افزایش خودکار موجودی انبار با هر فاکتور فروش، خرید و برگشت همراه با هشدار نقطه سفارش.',
    badge: 'حسابداری پیشرفته',
  },
  {
    key: 'partner_ledger_card',
    title: 'کارت حساب و صورت‌گردش تفصیلی طرف‌حساب',
    desc: 'مشاهده ریز بدهکاری، بستانکاری، چک‌های در جریان و مانده لحظه‌ای هر مشتری یا تأمین‌کننده.',
    badge: 'حسابداری پیشرفته',
  },
  {
    key: 'invite_accountant_rbac',
    title: 'دعوت حسابدار و مدیریت سطوح دسترسی (RBAC)',
    desc: 'تعریف دسترسی محدود یا کامل برای حسابدار، انباردار و شریک تجاری روی فضای ابری.',
    badge: 'حسابداری پیشرفته',
  },
  {
    key: 'multi_business_support',
    title: 'مدیریت هم‌زمان چند کسب‌وکار و سال مالی مستقل',
    desc: 'امکان تعریف تا ۳ کسب‌وکار در پلن ماهانه و ۵ کسب‌وکار در پلن سالانه و بنیان‌گذار.',
    badge: 'حسابداری پیشرفته',
  },
  {
    key: 'bank_reconciliation',
    title: 'مغایرت‌گیری هوشمند بانکی و صورتحساب شبا',
    desc: 'تطبیق خودکار واریزی‌ها و برداشتی‌های بانک با فاکتورها و اسناد ثبت‌شده.',
    badge: 'حسابداری پیشرفته',
  },
  {
    key: 'payroll_voucher_engine',
    title: 'صدور فیش حقوقی و سند حسابداری حقوق و دستمزد',
    desc: 'ثبت خودکار لیست حقوق، حق بیمه سهم کارفرما (۲۳٪)، سهم کارگر (۷٪) و مالیات حقوق.',
    badge: 'حسابداری پیشرفته',
  },
];

export function isProPlan(plan: PlanType): boolean {
  return plan === 'monthly' || plan === 'yearly' || plan === 'founder';
}

export interface TrialStatus {
  isTrial: boolean;
  daysRemaining: number;
  isExpired: boolean;
  percentUsed: number;
  startedAt: string;
}

const TRIAL_DURATION_DAYS = 10;

export function getTrialStatus(): TrialStatus {
  if (typeof window === 'undefined') {
    return {
      isTrial: true,
      daysRemaining: TRIAL_DURATION_DAYS,
      isExpired: false,
      percentUsed: 0,
      startedAt: new Date().toISOString(),
    };
  }

  let storedStart = localStorage.getItem('karban_trial_started_at');
  if (!storedStart) {
    storedStart = new Date().toISOString();
    localStorage.setItem('karban_trial_started_at', storedStart);
  }

  const startTime = new Date(storedStart).getTime();
  const now = Date.now();
  const elapsedMs = Math.max(0, now - startTime);
  const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, TRIAL_DURATION_DAYS - elapsedDays);
  const isExpired = daysRemaining <= 0;
  const percentUsed = Math.min(100, Math.round((elapsedDays / TRIAL_DURATION_DAYS) * 100));

  return {
    isTrial: true,
    daysRemaining,
    isExpired,
    percentUsed,
    startedAt: storedStart,
  };
}

export function resetTrial10Days() {
  if (typeof window !== 'undefined') {
    localStorage.setItem('karban_trial_started_at', new Date().toISOString());
  }
}

export function canAccessProFeatures(plan: PlanType): { allowed: boolean; reason: 'pro_subscription' | 'active_trial' | 'trial_expired' } {
  if (isProPlan(plan)) {
    return { allowed: true, reason: 'pro_subscription' };
  }
  const trial = getTrialStatus();
  if (!trial.isExpired) {
    return { allowed: true, reason: 'active_trial' };
  }
  return { allowed: false, reason: 'trial_expired' };
}

export function getPlanInfo(plan: PlanType) {
  const trial = getTrialStatus();
  switch (plan) {
    case 'founder':
      return {
        name: 'بنیان‌گذار (ویژه مدیران)',
        shortLabel: 'بنیان‌گذار VIP',
        chatLimit: -1,
        analyzeLimit: -1,
        businessLimit: 10,
        invoiceLimit: -1,
        badgeColor: 'from-amber-400 via-yellow-500 to-amber-600 text-slate-950',
      };
    case 'yearly':
      return {
        name: 'اشتراک سالانه پیشرفته',
        shortLabel: 'پیشرفته سالانه',
        chatLimit: 20,
        analyzeLimit: 10,
        businessLimit: 5,
        invoiceLimit: -1,
        badgeColor: 'from-amber-500 to-amber-600 text-slate-950',
      };
    case 'monthly':
      return {
        name: 'اشتراک ماهانه پیشرفته',
        shortLabel: 'پیشرفته ماهانه',
        chatLimit: 20,
        analyzeLimit: 10,
        businessLimit: 3,
        invoiceLimit: -1,
        badgeColor: 'from-emerald-500 to-teal-600 text-white',
      };
    case 'free':
    default:
      return {
        name: trial.isExpired ? 'آزمایشی پایان یافته (نیازمند تمدید)' : `تست رایگان ۱۰ روزه (${toFaDigits(trial.daysRemaining)} روز باقی‌مانده)`,
        shortLabel: trial.isExpired ? 'پایان مهلت تست' : `تست ۱۰ روزه (${toFaDigits(trial.daysRemaining)} روز)`,
        chatLimit: trial.isExpired ? 0 : 15,
        analyzeLimit: trial.isExpired ? 0 : 5,
        businessLimit: 1,
        invoiceLimit: trial.isExpired ? 0 : 25,
        badgeColor: trial.isExpired ? 'from-rose-600 to-red-700 text-white' : 'from-amber-500 to-amber-600 text-slate-950',
      };
  }
}

export function formatRial(amount: number): string {
  return `${formatFaNum(Math.round(amount || 0))} ریال`;
}

export function formatToman(amountRial: number): string {
  const toman = Math.round((amountRial || 0) / 10);
  return `${formatFaNum(toman)} تومان`;
}

export function numberToPersianWords(numRial: number): string {
  const toman = Math.round((numRial || 0) / 10);
  if (toman <= 0) return 'صفر ریال';
  const miliard = Math.floor(toman / 1_000_000_000);
  const milion = Math.floor((toman % 1_000_000_000) / 1_000_000);
  const hezar = Math.floor((toman % 1_000_000) / 1_000);
  const baghi = toman % 1_000;
  const parts: string[] = [];
  if (miliard > 0) parts.push(`${formatFaNum(miliard)} میلیارد`);
  if (milion > 0) parts.push(`${formatFaNum(milion)} میلیون`);
  if (hezar > 0) parts.push(`${formatFaNum(hezar)} هزار`);
  if (baghi > 0) parts.push(`${formatFaNum(baghi)}`);
  return `${parts.join(' و ')} تومان (معادل ${formatFaNum(numRial)} ریال)`;
}

export interface InvoiceItem {
  id: string;
  commodityCode: string;
  name: string;
  quantity: number;
  unitPriceRial: number;
  discountRial: number;
  vatRatePercent: number;
}

export interface OfficialInvoice {
  id: string;
  invoiceNumber: string;
  moadianTaxId: string;
  type: 'sale' | 'proforma' | 'purchase' | 'return';
  dateJalali: string;
  partnerName: string;
  partnerNationalId: string;
  partnerEconomicCode: string;
  partnerPostalCode: string;
  status: 'paid' | 'pending' | 'overdue';
  items: InvoiceItem[];
  subtotalRial: number;
  discountTotalRial: number;
  vatTotalRial: number;
  grandTotalRial: number;
  notes?: string;
}

export interface SayadiCheck {
  id: string;
  sayadiId: string;
  type: 'receivable' | 'payable';
  partyName: string;
  nationalId: string;
  bankName: string;
  dueDateJalali: string;
  amountRial: number;
  sayadiColor: 'white' | 'yellow' | 'orange' | 'brown' | 'red';
  status: 'in_flow' | 'cleared' | 'endorsed' | 'bounced';
  description: string;
}

export interface JournalEntry {
  id: string;
  docNumber: number;
  dateJalali: string;
  description: string;
  debitAccount: string;
  creditAccount: string;
  amountRial: number;
  refType: 'invoice' | 'check' | 'expense' | 'payroll' | 'ocr';
}

export interface PartnerRecord {
  id: string;
  name: string;
  role: 'customer' | 'vendor' | 'both';
  nationalId: string;
  economicCode: string;
  phone: string;
  postalCode: string;
  balanceRial: number;
}

export interface InventoryItem {
  id: string;
  code: string;
  moadianId: string;
  name: string;
  category: 'کالا' | 'خدمات';
  unit: string;
  stock: number;
  minStock: number;
  priceRial: number;
  vatRate: number;
}

export interface VaultDocument {
  id: string;
  title: string;
  category: 'قرارداد رسمی' | 'لایحه مالیاتی' | 'سند ملکی و ثبتی' | 'گواهی اداری';
  dateJalali: string;
  referenceCode: string;
  status: 'امضاشده دیجیتال' | 'معتبر در پرونده' | 'آماده ارائه به هیئت';
  contentPreview: string;
}

export const INITIAL_INVOICES: OfficialInvoice[] = [
  {
    id: 'inv-1405-101',
    invoiceNumber: '۱۴۰۵/۱۰۰۱',
    moadianTaxId: '۱۴۰۵۰۸۰۴۰۰۱۰۲۹۴۸۵۷۱۰۰۱',
    type: 'sale',
    dateJalali: '۱۴۰۵/۰۸/۰۴',
    partnerName: 'شرکت توسعه فناوری پارس سیستم (سهامی خاص)',
    partnerNationalId: '۱۰۱۰۲۹۴۸۵۷۱',
    partnerEconomicCode: '۴۱۱۳۸۹۵۶۷۱۲۳',
    partnerPostalCode: '۱۹۹۸۷۶۵۴۳۱',
    status: 'paid',
    items: [
      {
        id: 'it-1',
        commodityCode: '۲۹۰۱۲۳۴۵۶۷۸۹۱',
        name: 'پیاده‌سازی و استقرار زیرساخت ابری و ماژول مالی',
        quantity: 1,
        unitPriceRial: 850_000_000,
        discountRial: 20_000_000,
        vatRatePercent: 10,
      },
      {
        id: 'it-2',
        commodityCode: '۲۹۰۱۲۳۴۵۶۷۸۹۲',
        name: 'پشتیبانی تخصصی و اتصال پایانه فروشگاهی مودیان (سالیانه)',
        quantity: 1,
        unitPriceRial: 320_000_000,
        discountRial: 0,
        vatRatePercent: 10,
      },
    ],
    subtotalRial: 1_170_000_000,
    discountTotalRial: 20_000_000,
    vatTotalRial: 115_000_000,
    grandTotalRial: 1_265_000_000,
    notes: 'تسویه طی حواله پایا بانک ملت — ارسال‌شده به کارپوشه مودیان.',
  },
  {
    id: 'inv-1405-102',
    invoiceNumber: '۱۴۰۵/۱۰۰۲',
    moadianTaxId: '۱۴۰۵۰۸۰۷۰۰۱۰۳۲۰۸۴۷۵۰۰۲',
    type: 'sale',
    dateJalali: '۱۴۰۵/۰۸/۰۷',
    partnerName: 'گروه بازرگانی آریا گستر ایرانیان',
    partnerNationalId: '۱۰۳۲۰۸۴۷۵۱۲',
    partnerEconomicCode: '۴۱۱۴۹۸۲۳۰۱۱۲',
    partnerPostalCode: '۱۵۸۷۵۴۳۲۱۱',
    status: 'pending',
    items: [
      {
        id: 'it-3',
        commodityCode: '۲۳۰۴۵۶۷۸۹۰۱۲۳',
        name: 'تجهیزات شبکه و سرور پردازش لبه (رک صنعتی نسل ۱۱)',
        quantity: 2,
        unitPriceRial: 640_000_000,
        discountRial: 30_000_000,
        vatRatePercent: 10,
      },
    ],
    subtotalRial: 1_280_000_000,
    discountTotalRial: 30_000_000,
    vatTotalRial: 125_000_000,
    grandTotalRial: 1_375_000_000,
    notes: 'دریافت چک صیادی به سررسید ۱۴۰۵/۰۸/۲۵.',
  },
  {
    id: 'inv-1405-103',
    invoiceNumber: '۱۴۰۵/خ-۲۰۱',
    moadianTaxId: '۱۴۰۵۰۸۰۸۰۰۱۰۸۶۱۲۳۴۹۲۰۱',
    type: 'purchase',
    dateJalali: '۱۴۰۵/۰۸/۰۸',
    partnerName: 'تأمین‌کننده قطعات صنعتی نوین پرداز',
    partnerNationalId: '۱۰۸۶۱۲۳۴۹۰۱',
    partnerEconomicCode: '۴۱۱۵۶۷۱۲۳۸۹۰',
    partnerPostalCode: '۱۴۵۶۷۸۹۰۱۲',
    status: 'paid',
    items: [
      {
        id: 'it-4',
        commodityCode: '۲۳۰۴۵۶۷۸۹۰۱۹۹',
        name: 'خرید قطعات سخت‌افزاری و ماژول حافظه سرور',
        quantity: 5,
        unitPriceRial: 110_000_000,
        discountRial: 0,
        vatRatePercent: 10,
      },
    ],
    subtotalRial: 550_000_000,
    discountTotalRial: 0,
    vatTotalRial: 55_000_000,
    grandTotalRial: 605_000_000,
    notes: 'دارای اعتبار مالیاتی ارزش افزوده قابل کسر در دوره پاییز ۱۴۰۵.',
  },
];

export const INITIAL_CHECKS: SayadiCheck[] = [
  {
    id: 'chk-1',
    sayadiId: '۱۴۰۵۸۸۲۹۱۰۴۴۷۱۹۲',
    type: 'receivable',
    partyName: 'گروه بازرگانی آریا گستر ایرانیان',
    nationalId: '۱۰۳۲۰۸۴۷۵۱۲',
    bankName: 'بانک ملت - شعبه ونک',
    dueDateJalali: '۱۴۰۵/۰۸/۱۸',
    amountRial: 820_000_000,
    sayadiColor: 'white',
    status: 'in_flow',
    description: 'بابت قسط اول فاکتور فروش شماره ۱۴۰۵/۱۰۰۲',
  },
  {
    id: 'chk-2',
    sayadiId: '۱۴۰۵۹۹۱۰۲۸۳۷۴۶۵۱',
    type: 'payable',
    partyName: 'تأمین‌کننده قطعات صنعتی نوین پرداز',
    nationalId: '۱۰۸۶۱۲۳۴۹۰۱',
    bankName: 'بانک سامان - شعبه جردن',
    dueDateJalali: '۱۴۰۵/۰۸/۱۴',
    amountRial: 450_000_000,
    sayadiColor: 'white',
    status: 'in_flow',
    description: 'چک پرداختنی بابت تسویه خرید تجهیزات سرور',
  },
  {
    id: 'chk-3',
    sayadiId: '۱۴۰۵۳۳۴۹۱۸۲۷۳۶۴۰',
    type: 'receivable',
    partyName: 'فروشگاه زنجیره‌ای سپهر مارت',
    nationalId: '۱۰۱۰۵۵۴۳۲۱۹',
    bankName: 'بانک تجارت - شعبه مرکزی',
    dueDateJalali: '۱۴۰۵/۰۸/۲۹',
    amountRial: 390_000_000,
    sayadiColor: 'yellow',
    status: 'in_flow',
    description: 'دارای ۱ فقره سابقه برگشتی رفع‌سوءاثر نشده (وضعیت زرد صیادی)',
  },
];

export const INITIAL_JOURNAL: JournalEntry[] = [
  {
    id: 'jr-101',
    docNumber: 101,
    dateJalali: '۱۴۰۵/۰۸/۰۱',
    description: 'سند افتتاحیه موجودی بانک ملت و سرمایه اولیه دوره',
    debitAccount: '۱۰۱۰ - موجودی بانک و نقد',
    creditAccount: '۳۰۱۰ - سرمایه و اندوخته قانونی',
    amountRial: 3_400_000_000,
    refType: 'invoice',
  },
  {
    id: 'jr-102',
    docNumber: 102,
    dateJalali: '۱۴۰۵/۰۸/۰۴',
    description: 'فاکتور فروش رسمی ۱۴۰۵/۱۰۰۱ — پارس سیستم (شامل ۱۰٪ ارزش افزوده)',
    debitAccount: '۱۰۱۰ - موجودی بانک و نقد',
    creditAccount: '۴۰۱۰ - درآمد فروش کالا و خدمات',
    amountRial: 1_265_000_000,
    refType: 'invoice',
  },
  {
    id: 'jr-103',
    docNumber: 103,
    dateJalali: '۱۴۰۵/۰۸/۰۷',
    description: 'فاکتور فروش رسمی ۱۴۰۵/۱۰۰۲ — آریا گستر ایرانیان',
    debitAccount: '۱۰۳۰ - حساب‌ها و اسناد دریافتنی تجاری',
    creditAccount: '۴۰۱۰ - درآمد فروش کالا و خدمات',
    amountRial: 1_375_000_000,
    refType: 'invoice',
  },
  {
    id: 'jr-104',
    docNumber: 104,
    dateJalali: '۱۴۰۵/۰۸/۰۸',
    description: 'فاکتور خرید رسمی ۱۴۰۵/خ-۲۰۱ — نوین پرداز (با اعتبار ارزش افزوده)',
    debitAccount: '۵۰۱۰ - بهای تمام‌شده خرید و موجودی کالا',
    creditAccount: '۲۰۱۰ - حساب‌ها و اسناد پرداختنی تجاری',
    amountRial: 605_000_000,
    refType: 'invoice',
  },
  {
    id: 'jr-105',
    docNumber: 105,
    dateJalali: '۱۴۰۵/۰۸/۰۹',
    description: 'پرداخت لیست حقوق و بیمه تأمین اجتماعی مهرماه پرسنل',
    debitAccount: '۶۰۱۰ - هزینه حقوق، دستمزد و مزایای قانونی',
    creditAccount: '۱۰۱۰ - موجودی بانک و نقد',
    amountRial: 485_000_000,
    refType: 'payroll',
  },
];

export const INITIAL_PARTNERS: PartnerRecord[] = [
  {
    id: 'prt-1',
    name: 'شرکت توسعه فناوری پارس سیستم (سهامی خاص)',
    role: 'customer',
    nationalId: '۱۰۱۰۲۹۴۸۵۷۱',
    economicCode: '۴۱۱۳۸۹۵۶۷۱۲۳',
    phone: '۰۲۱-۸۸۷۷۶۶۵۵',
    postalCode: '۱۹۹۸۷۶۵۴۳۱',
    balanceRial: 0,
  },
  {
    id: 'prt-2',
    name: 'گروه بازرگانی آریا گستر ایرانیان',
    role: 'customer',
    nationalId: '۱۰۳۲۰۸۴۷۵۱۲',
    economicCode: '۴۱۱۴۹۸۲۳۰۱۱۲',
    phone: '۰۲۱-۲۲۱۱۴۴۳۳',
    postalCode: '۱۵۸۷۵۴۳۲۱۱',
    balanceRial: 1_375_000_000,
  },
  {
    id: 'prt-3',
    name: 'تأمین‌کننده قطعات صنعتی نوین پرداز',
    role: 'vendor',
    nationalId: '۱۰۸۶۱۲۳۴۹۰۱',
    economicCode: '۴۱۱۵۶۷۱۲۳۸۹۰',
    phone: '۰۲۱-۶۶۴۴۹۹۰۰',
    postalCode: '۱۴۵۶۷۸۹۰۱۲',
    balanceRial: -450_000_000,
  },
];

export const INITIAL_ITEMS: InventoryItem[] = [
  {
    id: 'itm-1',
    code: 'کد-۱۰۱',
    moadianId: '۲۹۰۱۲۳۴۵۶۷۸۹۱',
    name: 'پیاده‌سازی و استقرار زیرساخت ابری و ماژول مالی',
    category: 'خدمات',
    unit: 'پروژه',
    stock: 99,
    minStock: 1,
    priceRial: 850_000_000,
    vatRate: 10,
  },
  {
    id: 'itm-2',
    code: 'کد-۱۰۲',
    moadianId: '۲۳۰۴۵۶۷۸۹۰۱۲۳',
    name: 'تجهیزات شبکه و سرور پردازش لبه (رک صنعتی نسل ۱۱)',
    category: 'کالا',
    unit: 'دستگاه',
    stock: 6,
    minStock: 2,
    priceRial: 640_000_000,
    vatRate: 10,
  },
  {
    id: 'itm-3',
    code: 'کد-۱۰۳',
    moadianId: '۲۳۰۴۵۶۷۸۹۰۱۹۹',
    name: 'ماژول سخت‌افزاری توکن امضای دیجیتال مودیان',
    category: 'کالا',
    unit: 'عدد',
    stock: 14,
    minStock: 5,
    priceRial: 42_000_000,
    vatRate: 10,
  },
];

export const INITIAL_VAULT_DOCS: VaultDocument[] = [
  {
    id: 'vlt-1',
    title: 'قرارداد کار مدت‌موقت کارشناس ارشد نرم‌افزار (منطبق با ماده ۷ قانون کار)',
    category: 'قرارداد رسمی',
    dateJalali: '۱۴۰۵/۰۷/۰۱',
    referenceCode: 'سند-۸۸۲۱',
    status: 'امضاشده دیجیتال',
    contentPreview: 'این قرارداد بر اساس ماده ۷ و ۱۰ قانون کار جمهوری اسلامی ایران فیمابین شرکت کاربان و کارپذیر منعقد گردید...',
  },
  {
    id: 'vlt-2',
    title: 'لایحه دفاعیه هیئت حل اختلاف مالیاتی بدوی (ماده ۲۴۴) — رفع مغایرت تراکنش بانکی',
    category: 'لایحه مالیاتی',
    dateJalali: '۱۴۰۵/۰۸/۰۲',
    referenceCode: 'سند-۴۴۱۰',
    status: 'آماده ارائه به هیئت',
    contentPreview: 'ریاست و اعضای محترم هیئت حل اختلاف مالیاتی؛ احتراماً در خصوص برگ تشخیص عملکرد سال ۱۴۰۴، به استحضار می‌رساند واریزی‌های اعلامی مربوط به جابه‌جایی بین حساب‌های بانکی شرکت و تسهیلات دریافتی بوده و ماهیت درآمدی ندارد...',
  },
  {
    id: 'vlt-3',
    title: 'توافق‌نامه حفظ محرمانگی و عدم افشای اسرار تجاری (دوطرفه)',
    category: 'قرارداد رسمی',
    dateJalali: '۱۴۰۵/۰۸/۰۵',
    referenceCode: 'سند-۹۰۳۲',
    status: 'امضاشده دیجیتال',
    contentPreview: 'طرفین متعهد می‌گردند کلیه کدهای منبع، ساختار دیتابیس، اطلاعات مشتریان و اسناد مالی مبادله‌شده را کاملاً محرمانه تلقی نموده و از افشای آن به اشخاص ثالث خودداری نمایند...',
  },
];

export interface LawArticle {
  id: string;
  category: 'قانون کار' | 'مالیات و سامانه مودیان' | 'تأمین اجتماعی' | 'قانون چک صیادی';
  articleNumber: string;
  title: string;
  text: string;
  practicalTip: string;
}

export const LAW_ARTICLES: LawArticle[] = [
  {
    id: 'law-1',
    category: 'قانون کار',
    articleNumber: 'ماده ۱۰ و ۲۱ قانون کار',
    title: 'الزامات قانونی قرارداد کار و شرایط فسخ و تسویه‌حساب',
    text: 'قرارداد کار علاوه بر مشخصات دقیق طرفین، باید حاوی نوع کار، حقوق یا مزد مبنا و لواحق آن، ساعات کار، تعطیلات، مرخصی‌ها، محل انجام کار و مدت قرارداد باشد. در قراردادهای مدت موقت، هیچ‌یک از طرفین به تنهایی حق فسخ یک‌جانبه پیش از انقضای مدت را ندارد مگر آنکه حق فسخ و نحوه اطلاع‌رسانی صراحتاً در متن قرارداد پیش‌بینی شده باشد.',
    practicalTip: 'نکته کلیدی کاربان: همواره رسید تحویل یک نسخه از قرارداد به کارگر را به امضای وی برسانید و تسویه‌حساب سنوات و عیدی را سالانه به حساب بانکی کارگر واریز کنید.',
  },
  {
    id: 'law-2',
    category: 'مالیات و سامانه مودیان',
    articleNumber: 'ماده ۱۶۹ ق.م.م و قانون پایانه‌های فروشگاهی',
    title: 'تکالیف صدور صورتحساب الکترونیکی و جرایم عدم ارسال به سامانه مودیان',
    text: 'کلیه اشخاص حقوقی و صاحبان مشاغل مکلف‌اند صورتحساب‌های فروش کالا و خدمات خود را مطابق استاندارد سازمان امور مالیاتی با شناسه یکتای مالیاتی صادر نمایند. عدم صدور صورتحساب الکترونیکی مشمول جریمه‌ای معادل ۱۰ درصد مجموع مبلغ فروش انجام‌شده بدون صورتحساب یا ۲۰ میلیون ریال (هرکدام بیشتر باشد) و محرومیت از معافیت‌ها و مشوق‌های مالیاتی خواهد بود.',
    practicalTip: 'نکته کلیدی کاربان: فاکتورهای خرید شما تنها در صورتی اعتبار مالیاتی ارزش افزوده (۱۰٪) ایجاد می‌کنند که فروشنده آن‌ها را در کارپوشه مودیان شما ثبت و شما آن‌ها را تأیید کرده باشید.',
  },
  {
    id: 'law-3',
    category: 'تأمین اجتماعی',
    articleNumber: 'ماده ۳۸ قانون تأمین اجتماعی',
    title: 'تکالیف کارفرما و پیمانکار در قراردادهای پیمانکاری و مفاصاحساب بیمه',
    text: 'در مواردی که انجام کار به طور مقاطعه به اشخاص حقیقی یا حقوقی واگذار می‌شود، کارفرما باید در قراردادی که منعقد می‌کند پیمانکار را متعهد نماید که کارکنان خود را بیمه و کل حق بیمه را بپردازد و ۵ درصد بهای کل کار هر صورت‌وضعیت را تا ارائه مفاصاحساب سازمان تأمین اجتماعی نزد خود نگه دارد.',
    practicalTip: 'نکته کلیدی کاربان: قراردادهای خرید خالص کالا (بدون عملیات اجرایی یا نصب در محل کارفرما) مشمول ضریب بیمه پیمانکاری ماده ۳۸ نیستند؛ لذا در عنوان قرارداد حتماً «فروش کالا» را از «خدمات نصب» تفکیک کنید.',
  },
  {
    id: 'law-4',
    category: 'قانون چک صیادی',
    articleNumber: 'ماده ۲۱ مکرر قانون صدور چک',
    title: 'اعتبار قانونی ثبت چک در سامانه صیاد و صدور اجراییه مستقیم دادگاه',
    text: 'صدور و انتقال هر برگه چک بنفش رنگ منوط به ثبت در سامانه صیاد بانک مرکزی با شناسه ۱۶ رقمی است. در صورتی که چک در سامانه صیاد ثبت نشود، مشمول مزایای قانون صدور چک نبوده و بانک‌ها مجاز به پرداخت وجه آن نیستند. دارنده چک صیادی برگشتی با کد رهگیری می‌تواند بدون نیاز به طرح دعوای طولانی، مستقیماً از دادگاه درخواست صدور اجراییه و توقیف اموال صادرکننده را بنماید.',
    practicalTip: 'نکته کلیدی کاربان: پیش از تحویل کالا یا امضای رسید، حتماً رنگ وضعیت صیادی صادرکننده (سفید/زرد/قرمز) و تطابق مبلغ و تاریخ مندرج روی برگه کاغذی با اطلاعات ثبت‌شده در سامانه صیاد را کنترل کنید.',
  },
  {
    id: 'law-5',
    category: 'مالیات و سامانه مودیان',
    articleNumber: 'ماده ۲۴۴ و ۲۵۱ مکرر قانون مالیات‌های مستقیم',
    title: 'مرجع رسیدگی به اختلافات مالیاتی و نحوه اعتراض به برگ تشخیص و قطعی',
    text: 'مرجع رسیدگی به کلیه اختلافات مالیاتی جز در مواردی که ضمن مقررات این قانون مرجع دیگری پیش‌بینی شده، هیئت حل اختلاف مالیاتی است. هر هیئت از سه نفر شامل نماینده سازمان امور مالیاتی، قاضی بازنشسته یا شاغل و نماینده اتاق بازرگانی/اصناف تشکیل می‌شود. در صورت قطعی شدن مالیات غیرعادلانه و انقضای مهلت‌های عادی، مودی می‌تواند به استناد ماده ۲۵۱ مکرر از وزیر امور اقتصادی و دارایی تقاضای طرح در هیئت سه‌نفره ویژه نماید.',
    practicalTip: 'نکته کلیدی کاربان: در بخش «استودیو هوش مصنوعی -> تولید لایحه دفاعیه» می‌توانید متن رسمی دفاعیه خود را مستند به دادنامه‌های دیوان عدالت اداری در کمتر از ۳۰ ثانیه تولید کنید.',
  },
];

export interface ChecklistDef {
  id: string;
  title: string;
  category: string;
  steps: { id: string; text: string; done: boolean }[];
}

export const INITIAL_CHECKLISTS: ChecklistDef[] = [
  {
    id: 'chklist-hire',
    title: 'چک‌لیست استخدام نیروی جدید',
    category: 'هشت گام از آگهی تا روز اول کاری و بیمه',
    steps: [
      { id: 'h1', text: 'موضوع شغلی، حقوق و مدت کار در قالب قرارداد کتبی (ماده ۷ و ۱۰ قانون کار) تعیین شده است.', done: true },
      { id: 'h2', text: 'دوره آزمایشی (حداکثر ۱ ماه کارگر ساده / ۳ ماه متخصص) در قرارداد ذکر شده است.', done: true },
      { id: 'h3', text: 'کارت ملی، کارت بیمه و مدارک هویتی و تحصیلی نفر جدید دریافت و پرونده پرسنلی ساخته شده است.', done: true },
      { id: 'h4', text: 'استعلام کد بیمه‌ای و ثبت نام کارگر در سامانه تأمین اجتماعی از روز اول انجام شده است.', done: false },
      { id: 'h5', text: 'ساعت کاری، نوبت‌کاری و محل کار به‌صورت مکتوب ابلاغ شده است.', done: false },
      { id: 'h6', text: 'سیاست‌های محرمانگی و تجهیزات تحویلی (لپ‌تاپ، ابزار) با رسید ثبت شده است.', done: false },
      { id: 'h7', text: 'شماره حساب/شبا حقوق و اطلاعات فرد به واحد مالی اعلام شده است.', done: false },
      { id: 'h8', text: 'آموزش الزامی ایمنی و معرفی همکار مرجع در تقویم هفته اول گذاشته شده است.', done: false },
    ],
  },
  {
    id: 'chklist-terminate',
    title: 'چک‌لیست اخراج و فسخ قرارداد',
    category: 'مسیر کم‌ریسک بر اساس مواد ۲۱، ۲۵، ۲۶ و ۲۷ قانون کار',
    steps: [
      { id: 't1', text: 'علت فسخ جزو موارد مصرح ماده ۲۱ یا ۲۷ قانون کار است و سند مستند دارد.', done: false },
      { id: 't2', text: 'در مورد ماده ۲۷، تشخیص عدم صلاحیت با نظر نماینده کارگران و تأیید مرکز کار اخذ شده است.', done: false },
      { id: 't3', text: 'تذکرها و اخطارهای کتبی قبلی در پرونده پرسنلی موجود است.', done: false },
      { id: 't4', text: 'نیروی جایگزین یا بازآموزی پیش از خاتمه همکاری بررسی شده است.', done: false },
      { id: 't5', text: 'مجوز مراجع خاص (برای کارگران حمایت‌شده یا دوران بارداری/مرخصی) بررسی شده است.', done: false },
      { id: 't6', text: 'محاسبه خسارت و تسویه (حقوق معوق + سنوات + عیدی + مانده مرخصی) با ماشین‌حساب کاربان انجام شده است.', done: false },
      { id: 't7', text: 'حکم تسویه حساب امضاشده و رسید تحویل کار دریافت شده است.', done: false },
      { id: 't8', text: 'لغو دسترسی‌ها و تحویل اموال شرکت در روز آخر ثبت شده است.', done: false },
    ],
  },
  {
    id: 'chklist-contract',
    title: 'چک‌لیست تنظیم قرارداد',
    category: 'بندهایی که نباید در هیچ قراردادی جا بماند',
    steps: [
      { id: 'c1', text: 'طرفین با ذکر کد ملی/شناسه ملی و نشانی دقیق مشخص شده‌اند.', done: true },
      { id: 'c2', text: 'موضوع قرارداد مشخص، قابل اندازه‌گیری و غیرمبهم است.', done: true },
      { id: 'c3', text: 'مبلغ، زمان‌بندی پرداخت و نحوه تحویل (با فاکتور/رسید) روشن است.', done: true },
      { id: 'c4', text: 'مدت قرارداد، شرایط تمدید و شرایط فسخ به‌صورت دقیق تعیین شده است.', done: false },
      { id: 'c5', text: 'بند محرمانگی، مالکیت فکری و عدم رقابت اضافه شده است.', done: false },
      { id: 'c6', text: 'بند فورس‌ماژور و حل اختلاف (مذاکره ← داوری ← مرجع قضایی) وجود دارد.', done: false },
      { id: 'c7', text: 'پیوست‌ها (نمونه کار، مشخصات فنی، جدول پرداخت) شماره‌گذاری و امضا شده‌اند.', done: false },
      { id: 'c8', text: 'قرارداد در دو نسخه هم‌اعتبار تنظیم و تاریخ‌گذاری شده است.', done: false },
    ],
  },
  {
    id: 'chklist-settlement',
    title: 'چک‌لیست پایان همکاری و تسویه',
    category: 'تسویه کامل و کم‌ریسک نیروی خارج‌شده',
    steps: [
      { id: 's1', text: 'آخرین حقوق و مزایا تا پایان روز آخر به‌درستی محاسبه شده است.', done: false },
      { id: 's2', text: 'سنوات پایان خدمت، عیدی متناسب و مانده مرخصی محاسبه و پرداخت شده است.', done: false },
      { id: 's3', text: 'سابقه و لیست بیمه در سامانه تأمین اجتماعی تکمیل شده است.', done: false },
      { id: 's4', text: 'حکم کارگزینی/تسویه‌نامه امضاشده به پرونده پیوست است.', done: false },
      { id: 's5', text: 'دسترسی‌ها، ایمیل سازمانی و اموال تحویلی بازگردانده و ثبت شده است.', done: false },
      { id: 's6', text: 'مصاحبه خروج (Exit Interview) کوتاه برای بهبود سازمان انجام شده است.', done: false },
      { id: 's7', text: 'معرفی‌نامه کار یا گواهی اشتغال (در صورت درخواست) صادر شده است.', done: false },
      { id: 's8', text: 'تعهدات جاری (محرمانگی، عدم رقابت) یادآوری و نسخه‌ای نگهداری شده است.', done: false },
    ],
  },
  {
    id: 'chklist-tax',
    title: 'چک‌لیست مالیاتی کسب‌وکار و سامانه مودیان',
    category: 'تقویم و گام‌های مالیاتی سالانه بدون جریمه',
    steps: [
      { id: 'x1', text: 'کد اقتصادی، پرونده مالیاتی و کارپوشه سامانه مودیان برای کسب‌وکار فعال است.', done: true },
      { id: 'x2', text: 'اظهارنامه عملکرد سالانه در مهلت قانونی (تیرماه) ارسال شده است.', done: true },
      { id: 'x3', text: 'اظهارنامه ارزش افزوده فصلی (۱۰٪) هر سه ماه پرداخت و ارسال شده است.', done: false },
      { id: 'x4', text: 'فهرست معاملات فصلی ماده ۱۶۹ در سامانه ثبت شده است.', done: false },
      { id: 'x5', text: 'صورتحساب و فاکتورهای رسمی برای همه فروش‌ها صادر شده است.', done: true },
      { id: 'x6', text: 'هزینه‌های قابل‌قبول (مواد ۱۴۷ و ۱۴۸) با سند و فاکتور معتبر آرشیو شده است.', done: false },
      { id: 'x7', text: 'مالیات حقوق کارکنان (ماده ۸۶) ماهانه کسر و پرداخت شده است.', done: false },
      { id: 'x8', text: 'اسناد و دفاتر قانونی تا پایان مهلت مرور زمان مالیاتی (۵ سال) نگهداری می‌شود.', done: false },
    ],
  },
];

export const MONTHLY_CASHFLOW_CHART = [
  { month: 'فروردین', incomeToman: 98_000_000, expenseToman: 42_000_000 },
  { month: 'اردیبهشت', incomeToman: 124_000_000, expenseToman: 51_000_000 },
  { month: 'خرداد', incomeToman: 115_000_000, expenseToman: 48_000_000 },
  { month: 'تیر', incomeToman: 158_000_000, expenseToman: 63_000_000 },
  { month: 'مرداد', incomeToman: 189_000_000, expenseToman: 72_000_000 },
  { month: 'شهریور', incomeToman: 215_000_000, expenseToman: 68_000_000 },
  { month: 'مهر', incomeToman: 242_000_000, expenseToman: 79_000_000 },
  { month: 'آبان', incomeToman: 264_000_000, expenseToman: 60_500_000 },
];

// Official 1405 Legal & Tax Constants synced with KarbanApp.ir
export const LEGAL_CONFIG_1405 = {
  year: '۱۴۰۵',
  baseSalaryDaily: 3_463_650,
  baseSalaryMonthly: 103_909_500,
  housingAllowanceMonthly: 9_000_000,
  foodAllowanceMonthly: 22_000_000,
  familyAllowanceMonthly: 7_000_000,
  childAllowanceMonthly: 3_000_000,
  overtimeMultiplier: 1.4,
  insuranceEmployeeRate: 0.07,
  insuranceEmployerRate: 0.23,
  employerPensionRate: 0.2,
  employerUnemploymentRate: 0.03,
  vatRatePercent: 10,
  annualSalaryTaxFree: 2_880_000_000,
  taxExemptionMonthly: 240_000_000,
  salaryTaxBracketsAnnual: [
    { max: 3_600_000_000, rate: 0.1 },
    { max: 4_800_000_000, rate: 0.15 },
    { max: 7_200_000_000, rate: 0.2 },
    { max: Number.POSITIVE_INFINITY, rate: 0.3 },
  ],
  businessTaxExemption: 400_000_000,
  businessTaxBrackets: [
    { up: 2_000_000_000, rate: 0.15 },
    { up: 4_000_000_000, rate: 0.2 },
    { up: 10_000_000_000, rate: 0.25 },
    { up: 50_000_000_000, rate: 0.3 },
    { up: Number.POSITIVE_INFINITY, rate: 0.35 },
  ],
  individualTaxReturnExemption: 600_000_000,
  individualTaxReturnBrackets: [
    { up: 600_000_000, rate: 0.05 },
    { up: 1_800_000_000, rate: 0.1 },
    { up: 3_600_000_000, rate: 0.15 },
    { up: 7_200_000_000, rate: 0.2 },
    { up: 12_000_000_000, rate: 0.25 },
    { up: Number.POSITIVE_INFINITY, rate: 0.3 },
  ],
  corpTaxRate: 0.25,
  retirement: {
    minYears: 20,
    minAge: 60,
    altYears: 30,
    altAge: 50,
    maxYears: 42,
  },
} as const;

export const CONTRACT_TYPES_ALL = [
  'کار',
  'همکاری',
  'پیمانکاری',
  'خدمات',
  'مشاوره',
  'فروش',
  'تأمین کالا',
  'اجاره',
  'لیزینگ',
  'نمایندگی',
  'توزیع',
  'وکالت',
  'محرمانگی',
  'عدم رقابت',
  'آموزش',
  'کارآموزی',
  'مشارکت مدنی',
  'حمل‌ونقل',
  'پشتیبانی و نگهداری',
  'فرانچایز',
  'مبایعنامه',
  'کارگزاری',
  'جعاله',
] as const;

export const INDUSTRIES_ALL = [
  'عمومی',
  'برنامه‌نویسان',
  'فروشگاه‌های آنلاین',
  'استارتاپ‌ها',
  'طراحان گرافیک و تولید محتوا',
  'پزشکان و کلینیک‌ها',
  'دندانپزشکان',
  'داروخانه‌ها',
  'پیمانکاران ساختمان و معماری',
  'مهندسان مشاور',
  'مشاوران املاک',
  'رستوران‌ها و کافه‌ها',
  'آموزشگاه‌ها و دوره آنلاین',
  'بازاریابی دیجیتال و تبلیغات',
  'شرکت‌های حمل‌ونقل',
  'واردکنندگان و صادرکنندگان',
  'فریلنسرها',
  'حسابداران و مشاوران مالی',
  'طلا و جواهر',
  'فروشندگان و نمایشگاه خودرو',
] as const;

export interface HealthQuestionDef {
  id: string;
  area: 'قراردادها' | 'حقوق و بیمه' | 'مالی و مالیات';
  q: string;
}

export const HEALTH_QUESTIONS_12: HealthQuestionDef[] = [
  { id: 'hq1', area: 'قراردادها', q: 'با همکار و طرف قرارداد اصلی‌ات، قرارداد مکتوب و امضاشده داری؟' },
  { id: 'hq2', area: 'قراردادها', q: 'توی قراردادها، مبلغ و تاریخ و مدت کار مشخص نوشته شده؟' },
  { id: 'hq3', area: 'قراردادها', q: 'قراردادهای تاریخ‌گذشته را قبل از تمام‌شدن تمدید می‌کنی؟' },
  { id: 'hq4', area: 'قراردادها', q: 'برای کارهای حساس و محرمانه، توافق عدم افشا (NDA) امضا می‌گیری؟' },
  { id: 'hq5', area: 'حقوق و بیمه', q: 'حقوق پرسنل سر ماه و بدون تأخیر از طریق فیش بانکی پرداخت می‌شود؟' },
  { id: 'hq6', area: 'حقوق و بیمه', q: 'همه کارکنان از روز اول در سامانه تأمین اجتماعی بیمه شده‌اند؟' },
  { id: 'hq7', area: 'حقوق و بیمه', q: 'ذخیره عیدی و سنوات را جدا کنار گذاشته‌ای تا آخر سال غافلگیر نشوی؟' },
  { id: 'hq8', area: 'حقوق و بیمه', q: 'اضافه‌کاری‌ها ثبت می‌شود و با نرخ قانونی ۱٫۴ برابر پرداخت می‌گردد؟' },
  { id: 'hq9', area: 'مالی و مالیات', q: 'درآمد و هزینه‌های روزانه با مستندات مودیان یادداشت و ثبت می‌شوند؟' },
  { id: 'hq10', area: 'مالی و مالیات', q: 'حساب بانکی کسب‌وکار کاملاً از حساب شخصی مدیران جداست؟' },
  { id: 'hq11', area: 'مالی و مالیات', q: 'پیش از دریافت چک صیادی، وضعیت رنگ آن (سفید/زرد/قرمز) استعلام می‌شود؟' },
  { id: 'hq12', area: 'مالی و مالیات', q: 'اظهارنامه فصلی ارزش افزوده ۱۰٪ و لیست معاملات ماده ۱۶۹ به‌موقع ارسال می‌شود؟' },
];

// Accounting Extensions synced with KarbanAcc (Accounts, Petty Cash, Expenses, Projects, Fixed Assets)
export interface BankAccountRecord {
  id: string;
  name: string;
  kind: 'bank' | 'cash';
  bankName?: string;
  shebaOrCard?: string;
  balanceRial: number;
}

export interface PettyCashFund {
  id: string;
  name: string;
  custodian: string;
  balanceRial: number;
  status: 'open' | 'settled';
  lastUpdatedJalali: string;
}

export type ExpenseTaxStatus = 'valid' | 'incomplete' | 'invalid';

export interface ExpenseRecord {
  id: string;
  dateJalali: string;
  title: string;
  category: string;
  amountRial: number;
  accountId: string;
  accountName: string;
  taxStatus: ExpenseTaxStatus;
  projectName?: string;
  notes?: string;
}

export interface ProjectRecord {
  id: string;
  code: string;
  name: string;
  clientName: string;
  budgetRial: number;
  revenueRial: number;
  costRial: number;
  status: 'active' | 'completed';
}

export interface FixedAssetRecord {
  id: string;
  code: string;
  name: string;
  purchaseDateJalali: string;
  costRial: number;
  salvageRial: number;
  usefulLifeYears: number;
}

export const INITIAL_BANK_ACCOUNTS: BankAccountRecord[] = [
  {
    id: 'acc-mellat',
    name: 'حساب جاری تجاری بانک ملت',
    kind: 'bank',
    bankName: 'بانک ملت - شعبه ونک',
    shebaOrCard: 'IR۴۵۰۱۲۰۰۲۰۰۰۰۰۰۸۸۴۹۱۰۲۹۳۴',
    balanceRial: 3_420_000_000,
  },
  {
    id: 'acc-saman',
    name: 'حساب تنخواه و پرداخت بانک سامان',
    kind: 'bank',
    bankName: 'بانک سامان - شعبه جردن',
    shebaOrCard: 'IR۸۲۰۵۶۰۰۸۱۱۰۰۰۰۴۴۱۲۰۹۸۷۱۱',
    balanceRial: 640_000_000,
  },
  {
    id: 'acc-cash',
    name: 'صندوق نقدی مرکزی دفتر',
    kind: 'cash',
    balanceRial: 185_000_000,
  },
];

export const INITIAL_PETTY_CASH: PettyCashFund[] = [
  {
    id: 'pty-1',
    name: 'تنخواه‌گردان جاری دفتر مرکزی',
    custodian: 'سارا محمدی (اداری و مالی)',
    balanceRial: 75_000_000,
    status: 'open',
    lastUpdatedJalali: '۱۴۰۵/۰۸/۰۹',
  },
  {
    id: 'pty-2',
    name: 'تنخواه حمل‌ونقل و تدارکات فنی',
    custodian: 'رضا کریمی (پشتیبانی)',
    balanceRial: 32_000_000,
    status: 'open',
    lastUpdatedJalali: '۱۴۰۵/۰۸/۰۷',
  },
];

export const INITIAL_EXPENSES: ExpenseRecord[] = [
  {
    id: 'exp-1',
    dateJalali: '۱۴۰۵/۰۸/۰۸',
    title: 'اجاره ماهیانه و شارژ دفتر شرکت',
    category: 'اجاره و تأسیسات',
    amountRial: 180_000_000,
    accountId: 'acc-mellat',
    accountName: 'حساب جاری تجاری بانک ملت',
    taxStatus: 'valid',
    projectName: 'هزینه عمومی دفتر',
    notes: 'دارای اجاره‌نامه رسمی با کد رهگیری و رسید شبا',
  },
  {
    id: 'exp-2',
    dateJalali: '۱۴۰۵/۰۸/۰۹',
    title: 'تمدید سرویس سرور ابری و پهنای باند',
    category: 'زیرساخت و نرم‌افزار',
    amountRial: 48_000_000,
    accountId: 'acc-saman',
    accountName: 'حساب تنخواه و پرداخت بانک سامان',
    taxStatus: 'valid',
    projectName: 'پروژه استقرار پارس سیستم',
    notes: 'دارای صورتحساب مودیان تأییدشده',
  },
  {
    id: 'exp-3',
    dateJalali: '۱۴۰۵/۰۸/۱۰',
    title: 'خرید ملزومات مصرفی و پذیرایی جلسات',
    category: 'ملزومات اداری',
    amountRial: 14_500_000,
    accountId: 'acc-cash',
    accountName: 'صندوق نقدی مرکزی دفتر',
    taxStatus: 'incomplete',
    notes: 'فاکتور کاغذی بدون کد اقتصادی فروشنده — نیازمند ثبت مودیان',
  },
];

export const INITIAL_PROJECTS: ProjectRecord[] = [
  {
    id: 'prj-1',
    code: 'PRJ-۱۰۱',
    name: 'استقرار سامانه مالی پارس سیستم',
    clientName: 'شرکت توسعه فناوری پارس سیستم',
    budgetRial: 1_500_000_000,
    revenueRial: 1_265_000_000,
    costRial: 410_000_000,
    status: 'active',
  },
  {
    id: 'prj-2',
    code: 'PRJ-۱۰۲',
    name: 'راه‌اندازی زیرساخت سرور آریا گستر',
    clientName: 'گروه بازرگانی آریا گستر ایرانیان',
    budgetRial: 1_400_000_000,
    revenueRial: 1_375_000_000,
    costRial: 620_000_000,
    status: 'active',
  },
];

export const INITIAL_FIXED_ASSETS: FixedAssetRecord[] = [
  {
    id: 'ast-1',
    code: 'AST-۰۰۱',
    name: 'سرور اختصاصی رک‌مونت Dell PowerEdge',
    purchaseDateJalali: '۱۴۰۴/۱۱/۱۰',
    costRial: 950_000_000,
    salvageRial: 100_000_000,
    usefulLifeYears: 5,
  },
  {
    id: 'ast-2',
    code: 'AST-۰۰۲',
    name: 'تجهیزات اداری، میز کنفرانس و ۳ دستگاه لپ‌تاپ',
    purchaseDateJalali: '۱۴۰۵/۰۲/۱۵',
    costRial: 680_000_000,
    salvageRial: 80_000_000,
    usefulLifeYears: 4,
  },
];

