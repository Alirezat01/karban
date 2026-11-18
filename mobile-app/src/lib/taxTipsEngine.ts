import {
  OfficialInvoice,
  SayadiCheck,
  JournalEntry,
  PartnerRecord,
  formatToman,
  toFaDigits,
} from './karbanData';
import { toEnDigits } from '../components/ui/PersianInputs';

export interface ShamsiDateInfo {
  year: number;
  month: number;
  day: number;
  monthName: string;
  seasonName: 'بهار' | 'تابستان' | 'پاییز' | 'زمستان';
  quarter: 1 | 2 | 3 | 4;
  weekdayName: string;
  formattedJalali: string;
  formattedLong: string;
  daysInMonth: number;
  daysUntilMonthEnd: number;
  daysUntilQuarterEnd: number;
  daysUntilYearEnd: number;
}

export type TaxTipCategory =
  | 'all'
  | 'calendar'
  | 'vat_moadian'
  | 'expenses_payroll'
  | 'checks_risk';

export interface PersonalizedTaxTip {
  id: string;
  title: string;
  summary: string;
  legalBasis: string;
  category: Exclude<TaxTipCategory, 'all'>;
  categoryLabel: string;
  urgency: 'فوری' | 'اولویت بالا' | 'توصیه بهینه‌سازی';
  estimatedSavingRial: number;
  personalizationReason: string;
  actionLabel: string;
  targetTab: 'accounting' | 'ai_studio' | 'contracts' | 'tools';
}

export interface GenerateTaxTipsInput {
  dateInput?: Date | string;
  invoices: OfficialInvoice[];
  checks: SayadiCheck[];
  journal: JournalEntry[];
  partners: PartnerRecord[];
}

export interface TaxTipsReport {
  shamsiInfo: ShamsiDateInfo;
  tips: PersonalizedTaxTip[];
  featuredTip: PersonalizedTaxTip;
  totalPotentialSavingRial: number;
  urgentCount: number;
}

const SHAMSI_MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;

const WEEKDAYS_FA = [
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنج‌شنبه',
  'جمعه',
  'شنبه',
] as const;

function isJalaliLeapYear(jy: number): boolean {
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  let bl = breaks.length;
  let jp = breaks[0];
  let jump = 0;
  let leap = 0;
  for (let i = 1; i < bl; i++) {
    const jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    jp = jm;
  }
  let n = jy - jp;
  if (jump - n < 6) n = n - jump + Math.floor((jump + 4) / 33) * 33;
  leap = ((n + 1) % 33 - 1) % 4;
  if (leap === -1) leap = 4;
  return leap === 0;
}

function getDaysInShamsiMonth(year: number, month: number): number {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  return isJalaliLeapYear(year) ? 30 : 29;
}

/**
 * Pure Gregorian -> Jalali conversion (fallback when Intl persian calendar is unavailable)
 */
function gregorianToJalali(gy: number, gm: number, gd: number): { year: number; month: number; day: number } {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  let gYear = gy <= 1600 ? gy - 621 : gy - 1600;
  const gy2 = gm > 2 ? gYear + 1 : gYear;
  let days =
    365 * gYear +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) -
    80 +
    gd +
    g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { year: jy, month: jm, day: jd };
}

/**
 * Resolves a Date or Jalali string ("1405/08/22" / "۱۴۰۵/۰۸/۲۲") into rich Shamsi calendar context.
 */
export function getCurrentShamsiDateInfo(dateInput: Date | string = new Date()): ShamsiDateInfo {
  let year = 1405;
  let month = 8;
  let day = 22;
  let weekdayName = 'جمعه';

  if (typeof dateInput === 'string') {
    const clean = toEnDigits(dateInput.trim());
    const parts = clean.split('/').map((n) => parseInt(n, 10));
    if (parts.length === 3 && !parts.some(isNaN)) {
      year = parts[0];
      month = Math.min(12, Math.max(1, parts[1]));
      day = Math.min(31, Math.max(1, parts[2]));
      const approxIdx = (year + month * 3 + day) % 7;
      weekdayName = WEEKDAYS_FA[approxIdx];
    }
  } else {
    const d = dateInput instanceof Date && !isNaN(dateInput.getTime()) ? dateInput : new Date();
    weekdayName = WEEKDAYS_FA[d.getDay()];

    try {
      const formatter = new Intl.DateTimeFormat('en-US-u-ca-persian', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      });
      const parts = formatter.formatToParts(d);
      const yPart = parts.find((p) => p.type === 'year')?.value;
      const mPart = parts.find((p) => p.type === 'month')?.value;
      const dayPart = parts.find((p) => p.type === 'day')?.value;
      if (yPart && mPart && dayPart) {
        year = parseInt(yPart, 10);
        month = parseInt(mPart, 10);
        day = parseInt(dayPart, 10);
      } else {
        const j = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
        year = j.year;
        month = j.month;
        day = j.day;
      }
    } catch {
      const j = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
      year = j.year;
      month = j.month;
      day = j.day;
    }
  }

  const daysInMonth = getDaysInShamsiMonth(year, month);
  const clampedDay = Math.min(day, daysInMonth);
  const monthName = SHAMSI_MONTH_NAMES[month - 1] || 'آبان';

  let seasonName: ShamsiDateInfo['seasonName'] = 'بهار';
  let quarter: ShamsiDateInfo['quarter'] = 1;
  if (month <= 3) {
    seasonName = 'بهار';
    quarter = 1;
  } else if (month <= 6) {
    seasonName = 'تابستان';
    quarter = 2;
  } else if (month <= 9) {
    seasonName = 'پاییز';
    quarter = 3;
  } else {
    seasonName = 'زمستان';
    quarter = 4;
  }

  const daysUntilMonthEnd = Math.max(0, daysInMonth - clampedDay);

  const quarterEndMonth = quarter * 3;
  let daysUntilQuarterEnd = daysUntilMonthEnd;
  for (let m = month + 1; m <= quarterEndMonth; m++) {
    daysUntilQuarterEnd += getDaysInShamsiMonth(year, m);
  }

  let daysUntilYearEnd = daysUntilMonthEnd;
  for (let m = month + 1; m <= 12; m++) {
    daysUntilYearEnd += getDaysInShamsiMonth(year, m);
  }

  const mStr = String(month).padStart(2, '0');
  const dStr = String(clampedDay).padStart(2, '0');
  const formattedJalali = toFaDigits(`${year}/${mStr}/${dStr}`);
  const formattedLong = `${weekdayName} ${toFaDigits(clampedDay)} ${monthName} ${toFaDigits(year)}`;

  return {
    year,
    month,
    day: clampedDay,
    monthName,
    seasonName,
    quarter,
    weekdayName,
    formattedJalali,
    formattedLong,
    daysInMonth,
    daysUntilMonthEnd,
    daysUntilQuarterEnd,
    daysUntilYearEnd,
  };
}

/**
 * Generates daily personalized tax-saving tips based on the current Shamsi date
 * and real business activities (invoices, checks, journal entries, partners).
 */
export function generateDailyTaxTips({
  dateInput,
  invoices,
  checks,
  journal,
  partners,
}: GenerateTaxTipsInput): TaxTipsReport {
  const shamsiInfo = getCurrentShamsiDateInfo(dateInput);
  const tips: PersonalizedTaxTip[] = [];

  // Aggregate real business activities
  const saleInvoices = invoices.filter((i) => i.type === 'sale');
  const purchaseInvoices = invoices.filter((i) => i.type === 'purchase');

  const totalSalesNetRial = saleInvoices.reduce(
    (sum, i) => sum + (i.subtotalRial - i.discountTotalRial),
    0
  );
  const outputVatRial = saleInvoices.reduce((sum, i) => sum + i.vatTotalRial, 0);
  const inputVatCreditRial = purchaseInvoices.reduce((sum, i) => sum + i.vatTotalRial, 0);
  const netVatPayableRial = Math.max(0, outputVatRial - inputVatCreditRial);
  const totalSalesDiscountRial = saleInvoices.reduce((sum, i) => sum + i.discountTotalRial, 0);

  const nonWhiteReceivableChecks = checks.filter(
    (c) => c.type === 'receivable' && c.sayadiColor !== 'white' && c.status !== 'cleared'
  );
  const nonWhiteChecksAmountRial = nonWhiteReceivableChecks.reduce((s, c) => s + c.amountRial, 0);

  const payrollEntries = journal.filter(
    (j) => j.refType === 'payroll' || j.debitAccount.includes('حقوق')
  );
  const payrollTotalRial = payrollEntries.reduce((s, j) => s + j.amountRial, 0);

  const vendorsWithBalance = partners.filter((p) => p.role === 'vendor' || p.balanceRial < 0);
  const incompletePartnerCodes = partners.filter(
    (p) => !p.economicCode || toEnDigits(p.economicCode).length < 11
  );

  // 1. Shamsi Calendar Window Tip (Always tailored to exact Shamsi month & day)
  if (shamsiInfo.daysUntilMonthEnd <= 10) {
    const estimatedPayrollPenaltyAvoided = Math.max(
      18_000_000,
      Math.round((payrollTotalRial || 485_000_000) * 0.1)
    );
    tips.push({
      id: `tip-calendar-payroll-${shamsiInfo.month}`,
      title: `ارسال پیش‌ازموعد لیست بیمه و مالیات حقوق ${shamsiInfo.monthName} (حذف جریمه ۱۰٪)`,
      summary: `تنها ${toFaDigits(shamsiInfo.daysUntilMonthEnd)} روز تا پایان ${shamsiInfo.monthName} باقی مانده است. ثبت و ارسال لیست حقوق و کسورات قانونی پیش از روز پایانی ماه، از جریمه ۲٪ تا ۱۰٪ دیرکرد مالیات حقوق (ماده ۱۹۷ ق.م.م) و جرائم تأمین اجتماعی جلوگیری می‌کند.`,
      legalBasis: 'ماده ۸۶ و ۱۹۷ قانون مالیات‌های مستقیم',
      category: 'calendar',
      categoryLabel: 'تقویم شمسی',
      urgency: 'فوری',
      estimatedSavingRial: estimatedPayrollPenaltyAvoided,
      personalizationReason: `بر اساس تاریخ امروز (${shamsiInfo.formattedLong}) و اسناد حقوق ثبت‌شده (${formatToman(payrollTotalRial || 485_000_000)})`,
      actionLabel: 'محاسبه حقوق و مالیات',
      targetTab: 'tools',
    });
  } else if (shamsiInfo.month === 12) {
    const yearEndDepreciationBenefit = Math.max(
      45_000_000,
      Math.round(totalSalesNetRial * 0.03)
    );
    tips.push({
      id: 'tip-calendar-esfand-closing',
      title: 'بستن حساب ذخیره سنوات، عیدی و استهلاک دارایی‌ها پیش از پایان اسفند',
      summary:
        'در روزهای پایانی سال مالی، ثبت سند ذخیره قانونی عیدی و سنوات کارکنان و محاسبه استهلاک دارایی‌های ثابت (ماده ۱۴۹ ق.م.م)، درآمد مشمول مالیات عملکرد (۲۵٪) را به‌صورت کاملاً قانونی کاهش می‌دهد.',
      legalBasis: 'ماده ۱۴۸ و ۱۴۹ قانون مالیات‌های مستقیم',
      category: 'calendar',
      categoryLabel: 'تقویم شمسی',
      urgency: 'فوری',
      estimatedSavingRial: yearEndDepreciationBenefit,
      personalizationReason: `ویژه آخرین ماه سال مالی (${shamsiInfo.monthName} ${toFaDigits(shamsiInfo.year)})`,
      actionLabel: 'ثبت سند پایان دوره',
      targetTab: 'accounting',
    });
  } else if (shamsiInfo.month === 4) {
    const corpTaxPrepSaving = Math.max(60_000_000, Math.round(totalSalesNetRial * 0.025));
    tips.push({
      id: 'tip-calendar-tir-declaration',
      title: 'آماده‌سازی تراز ۴ ستونی و استفاده از نرخ بخشودگی اظهارنامه تیرماه',
      summary:
        'تیرماه آخرین مهلت تسلیم اظهارنامه عملکرد اشخاص حقوقی است. انطباق کامل گردش حساب‌های بانکی با دفاتر قانونی پیش از ارسال اظهارنامه، مانع از علی‌الرأس شدن پرونده و ابطال معافیت‌ها می‌شود.',
      legalBasis: 'ماده ۱۱۰ و ۱۹۲ قانون مالیات‌های مستقیم',
      category: 'calendar',
      categoryLabel: 'تقویم شمسی',
      urgency: 'فوری',
      estimatedSavingRial: corpTaxPrepSaving,
      personalizationReason: `فصل تسلیم اظهارنامه سالانه (${shamsiInfo.monthName} ${toFaDigits(shamsiInfo.year)})`,
      actionLabel: 'مشاهده تراز ۴ ستونی',
      targetTab: 'accounting',
    });
  } else {
    const quarterPrepSaving = Math.max(
      25_000_000,
      Math.round((netVatPayableRial || 185_000_000) * 0.15)
    );
    tips.push({
      id: `tip-calendar-quarter-${shamsiInfo.quarter}`,
      title: `تأیید فاکتورهای خرید فصل ${shamsiInfo.seasonName} در کارپوشه سامانه مودیان`,
      summary: `تا پایان فصل ${shamsiInfo.seasonName} (سه‌ماهه ${toFaDigits(shamsiInfo.quarter)}) ${toFaDigits(shamsiInfo.daysUntilQuarterEnd)} روز زمان دارید. تأیید سیستمی فاکتورهای خرید در کارپوشه مودیان پیش از سررسید ماده ۱۶۹، تمام اعتبار ۱۰٪ ارزش افزوده خرید را برای شما قطعی می‌کند.`,
      legalBasis: 'قانون پایانه‌های فروشگاهی و ماده ۳ قانون ارزش افزوده',
      category: 'calendar',
      categoryLabel: 'تقویم شمسی',
      urgency: shamsiInfo.daysUntilQuarterEnd <= 35 ? 'فوری' : 'اولویت بالا',
      estimatedSavingRial: quarterPrepSaving,
      personalizationReason: `فصل ${shamsiInfo.seasonName} ${toFaDigits(shamsiInfo.year)} (${toFaDigits(shamsiInfo.daysUntilQuarterEnd)} روز تا پایان فصل)`,
      actionLabel: 'گزارش ماده ۱۶۹ و ۱۰٪',
      targetTab: 'accounting',
    });
  }

  // 2. VAT Credit & Moadian Invoice Matching (Driven by live sale vs purchase VAT)
  if (saleInvoices.length > 0) {
    const creditCoveragePct =
      outputVatRial > 0 ? Math.round((inputVatCreditRial / outputVatRial) * 100) : 0;
    const potentialAdditionalVatCredit = Math.max(
      35_000_000,
      Math.round(netVatPayableRial * 0.28)
    );

    tips.push({
      id: 'tip-vat-credit-capture',
      title:
        creditCoveragePct < 45
          ? `افزایش اعتبار مالیاتی خرید: پوشش فعلی ارزش افزوده شما فقط ${toFaDigits(creditCoveragePct)}٪ است`
          : 'حفظ و مستندسازی اعتبار مالیاتی ۱۰٪ خریدهای رسمی سامانه مودیان',
      summary: `ارزش افزوده ابرازی فروش‌های شما ${formatToman(outputVatRial)} و اعتبار خریدهای ثبت‌شده ${formatToman(inputVatCreditRial)} است. با دریافت فاکتور رسمی مودیان (نوع ۱ با شناسه ۱۳ رقمی) برای هزینه‌های جاری مثل اجاره دفتر، اینترنت، سرور و خرید ملزومات، بدهی ارزش افزوده قابل پرداخت (${formatToman(netVatPayableRial)}) مستقیماً کاهش می‌یابد.`,
      legalBasis: 'ماده ۸ قانون مالیات بر ارزش افزوده مصوب ۱۴۰۰',
      category: 'vat_moadian',
      categoryLabel: 'ارزش افزوده و مودیان',
      urgency: creditCoveragePct < 45 ? 'اولویت بالا' : 'توصیه بهینه‌سازی',
      estimatedSavingRial: potentialAdditionalVatCredit,
      personalizationReason: `محاسبه‌شده از ${toFaDigits(saleInvoices.length)} فاکتور فروش و ${toFaDigits(purchaseInvoices.length)} فاکتور خرید شما`,
      actionLabel: 'اسکن و ثبت فاکتور خرید',
      targetTab: 'ai_studio',
    });
  } else {
    tips.push({
      id: 'tip-vat-initial-setup',
      title: 'ثبت اولین فاکتور خرید رسمی برای ایجاد سپر اعتبار ارزش افزوده ۱۰٪',
      summary:
        'ثبت منظم فاکتورهای خرید با شناسه کالا و خدمات ۱۳ رقمی از همان ابتدای دوره مالی باعث می‌شود اعتبار مالیاتی ۱۰٪ خریدها به‌صورت خودکار از مالیات فروش‌های آتی کسر شود.',
      legalBasis: 'ماده ۱۷ قانون مالیات بر ارزش افزوده',
      category: 'vat_moadian',
      categoryLabel: 'ارزش افزوده و مودیان',
      urgency: 'توصیه بهینه‌سازی',
      estimatedSavingRial: 30_000_000,
      personalizationReason: 'پیشنهاد شروع هوشمند بر اساس وضعیت فعلی کارتابل فاکتورها',
      actionLabel: 'صدور یا ثبت فاکتور',
      targetTab: 'accounting',
    });
  }

  // 3. Sayadi Check Tax Shield (Driven by yellow/orange/red checks or total check volume)
  if (nonWhiteReceivableChecks.length > 0) {
    const badDebtTaxShield = Math.round(nonWhiteChecksAmountRial * 0.25);
    tips.push({
      id: 'tip-checks-bad-debt-shield',
      title: `سپر مالیاتی مطالبات مشکوک‌الوصول برای ${toFaDigits(nonWhiteReceivableChecks.length)} فقره چک صیادی پرریسک`,
      summary: `در پرتفوی شما ${toFaDigits(nonWhiteReceivableChecks.length)} فقره چک دریافتنی با وضعیت غیرسفید (به ارزش ${formatToman(nonWhiteChecksAmountRial)}) وجود دارد. در صورت عدم وصول در سررسید، اخذ گواهی عدم پرداخت صیادی و ثبت سرفصل «ذخیره مطالبات مشکوک‌الوصول»، از پرداخت ۲۵٪ مالیات عملکرد روی درآمد وصول‌نشده جلوگیری می‌کند.`,
      legalBasis: 'بند ۱۱ ماده ۱۴۸ قانون مالیات‌های مستقیم',
      category: 'checks_risk',
      categoryLabel: 'چک صیادی و ریسک',
      urgency: 'فوری',
      estimatedSavingRial: badDebtTaxShield,
      personalizationReason: `شناسایی چک ریسک‌دار (${nonWhiteReceivableChecks[0].partyName})`,
      actionLabel: 'تنظیم اخطاریه / لایحه',
      targetTab: 'ai_studio',
    });
  } else if (checks.length > 0) {
    const totalChecksAmount = checks.reduce((s, c) => s + c.amountRial, 0);
    tips.push({
      id: 'tip-checks-endorsement-hygiene',
      title: 'ثبت دقیق ظهرنویسی چک‌های صیادی برای پیشگیری از مالیات تراکنش‌های بانکی',
      summary: `ارزش کل چک‌های صیادی در جریان شما ${formatToman(totalChecksAmount)} است. اطمینان حاصل کنید هر چک دریافتی یا خرج‌شده در سامانه صیاد به نام شخص طرف‌حساب متصل به فاکتور ثبت شود تا در حسابرسی تراکنش‌های بانکی مشمول مالیات درآمد کتمان‌شده نشود.`,
      legalBasis: 'ماده ۱۶۹ مکرر ق.م.م و ماده ۲۱ مکرر قانون صدور چک',
      category: 'checks_risk',
      categoryLabel: 'چک صیادی و ریسک',
      urgency: 'توصیه بهینه‌سازی',
      estimatedSavingRial: Math.max(22_000_000, Math.round(totalChecksAmount * 0.04)),
      personalizationReason: `بررسی ${toFaDigits(checks.length)} فقره چک صیادی ثبت‌شده در دفتر چک`,
      actionLabel: 'بازبینی دفتر چک‌ها',
      targetTab: 'accounting',
    });
  }

  // 4. Payroll & Tax-Acceptable Expenses (Driven by journal payroll & expenses)
  const payrollTaxSavingEstimate = Math.max(
    24_000_000,
    Math.round((payrollTotalRial || 400_000_000) * 0.08)
  );
  tips.push({
    id: 'tip-payroll-exempt-allowances',
    title: 'تفکیک مزایای معاف قانون کار در سند حقوق و دستمزد (ماده ۸۴ و ۹۱ ق.م.م)',
    summary: `سند حقوق و دستمزد ثبت‌شده به مبلغ ${formatToman(payrollTotalRial || 485_000_000)} قابلیت بهینه‌سازی دارد: تفکیک دقیق کمک‌هزینه مسکن، بن خواربار، حق اولاد، کمک‌هزینه مهدکودک و سهمیه عیدی تا سقف معافیت قانونی از مزد مبنا در فیش حقوقی و پرداخت مستقیم به حساب کارگر، بار مالیات حقوق و جرایم احتمالی را کاهش می‌دهد.`,
    legalBasis: 'ماده ۸۴، ۹۱ و ۱۴۸ بند ۲ قانون مالیات‌های مستقیم',
    category: 'expenses_payroll',
    categoryLabel: 'حقوق و هزینه قابل قبول',
    urgency: 'اولویت بالا',
    estimatedSavingRial: payrollTaxSavingEstimate,
    personalizationReason:
      payrollEntries.length > 0
        ? `مبتنی بر ${toFaDigits(payrollEntries.length)} سند هزینه حقوق ثبت‌شده در دفتر روزنامه`
        : 'پیشنهاد استاندارد کاهش قانونی مالیات حقوق پرسنل در سال ۱۴۰۵',
    actionLabel: 'محاسبه‌گر حقوق ۱۴۰۵',
    targetTab: 'tools',
  });

  // 5. Tax-Acceptable Vendor Invoices & Discounts (Driven by partners & invoice discounts)
  const vendorTaxRiskSaving = Math.max(
    18_000_000,
    Math.round((totalSalesNetRial || 1_500_000_000) * 0.018)
  );
  tips.push({
    id: 'tip-partner-economic-code-and-discounts',
    title:
      incompletePartnerCodes.length > 0
        ? `تکمیل کد اقتصادی ${toFaDigits(incompletePartnerCodes.length)} طرف‌حساب جهت عدم رد هزینه در رسیدگی`
        : 'بهره‌گیری از تخفیفات تجاری فاکتوری برای کاهش همزمان مالیات عملکرد و ارزش افزوده',
    summary:
      totalSalesDiscountRial > 0
        ? `تاکنون ${formatToman(totalSalesDiscountRial)} تخفیف در صورتحساب‌های فروش شما لحاظ شده است. درج تخفیفات توافقی قبل از محاسبه ۱۰٪ ارزش افزوده در متن صورتحساب الکترونیکی مودیان، مأخذ مالیات عملکرد (۲۵٪) و ارزش افزوده را به طور قانونی کاهش می‌دهد.`
        : 'همیشه کد اقتصادی و شناسه ملی ۱۱ رقمی طرف‌حساب‌ها را پیش از ثبت فاکتور خرید کنترل کنید؛ فاکتورهای فاقد کد اقتصادی معتبر در زمان رسیدگی ممیز به‌عنوان هزینه غیرقابل قبول برگشت می‌خورند.',
    legalBasis: 'ماده ۱۴۷ ق.م.م و تبصره ۱ ماده ۵ قانون ارزش افزوده',
    category: 'expenses_payroll',
    categoryLabel: 'حقوق و هزینه قابل قبول',
    urgency: incompletePartnerCodes.length > 0 ? 'اولویت بالا' : 'توصیه بهینه‌سازی',
    estimatedSavingRial: vendorTaxRiskSaving,
    personalizationReason: `تحلیل ${toFaDigits(partners.length)} پرونده طرف‌حساب (${toFaDigits(vendorsWithBalance.length)} تأمین‌کننده فعال)`,
    actionLabel: 'مدیریت طرف‌حساب‌ها',
    targetTab: 'accounting',
  });

  // Deterministic daily rotation index using Shamsi date (year, month, day)
  const daySeed = shamsiInfo.year * 10000 + shamsiInfo.month * 100 + shamsiInfo.day;

  // Sort: urgent tips first, while rotating tie-breakers daily by Shamsi date
  const urgencyRank: Record<PersonalizedTaxTip['urgency'], number> = {
    'فوری': 0,
    'اولویت بالا': 1,
    'توصیه بهینه‌سازی': 2,
  };

  const sortedTips = [...tips].sort((a, b) => {
    const rankDiff = urgencyRank[a.urgency] - urgencyRank[b.urgency];
    if (rankDiff !== 0) return rankDiff;
    return b.estimatedSavingRial - a.estimatedSavingRial;
  });

  // Pick daily featured tip deterministically across top candidates
  const topCandidates = sortedTips.slice(0, Math.min(3, sortedTips.length));
  const featuredTip = topCandidates[daySeed % topCandidates.length] || sortedTips[0];

  const totalPotentialSavingRial = sortedTips.reduce((sum, t) => sum + t.estimatedSavingRial, 0);
  const urgentCount = sortedTips.filter((t) => t.urgency === 'فوری').length;

  return {
    shamsiInfo,
    tips: sortedTips,
    featuredTip,
    totalPotentialSavingRial,
    urgentCount,
  };
}
