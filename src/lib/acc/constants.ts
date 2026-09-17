/* ثابت‌های ماژول حسابداری */

import type { InvoiceStatus, InvoiceType } from './types';

export const VAT_DEFAULT_RATE = 10; // نرخ مالیات بر ارزش افزوده ۱۴۰۵

export const INVOICE_TYPES: Record<InvoiceType, { label: string; short: string }> = {
  sale: { label: 'صورتحساب فروش', short: 'فروش' },
  proforma: { label: 'پیش‌فاکتور (استعلام)', short: 'پیش‌فاکتور' },
  purchase: { label: 'صورتحساب خرید', short: 'خرید' },
  return_sale: { label: 'برگشت از فروش', short: 'برگشت' },
};

export const INVOICE_STATUSES: Record<InvoiceStatus, { label: string; tone: 'draft' | 'ok' | 'warn' | 'bad' }> = {
  draft: { label: 'پیش‌نویس', tone: 'draft' },
  issued: { label: 'صادر شده', tone: 'ok' },
  partial: { label: 'تسویه جزئی', tone: 'warn' },
  paid: { label: 'تسویه شده', tone: 'ok' },
  cancelled: { label: 'ابطال شده', tone: 'bad' },
};

/* نوع خریدار طبق سامانه مودیان — نوع ۱ بنگاه اقتصادی، نوع ۲ مصرف‌کننده نهایی */
export const BUYER_TYPES: Record<'business' | 'final', string> = {
  business: 'بنگاه اقتصادی — نوع ۱ (رسمی)',
  final: 'مصرف‌کننده نهایی — نوع ۲',
};

/* ───────────── دسته‌بندی هزینه‌ها — ۲۲ سرفصل پیش‌فرض (قابل ویرایش توسط کاربر) ───────────── */

export interface ExpenseCategoryDef { title: string; code: string }

export const EXPENSE_CATEGORY_DEFAULTS: ExpenseCategoryDef[] = [
  { title: 'اداری و عمومی', code: '5201' },
  { title: 'حقوق و دستمزد', code: '5202' },
  { title: 'اجاره محل کار', code: '5203' },
  { title: 'آب، برق، گاز و تلفن', code: '5204' },
  { title: 'تبلیغات و بازاریابی', code: '5205' },
  { title: 'حمل و نقل', code: '5206' },
  { title: 'خرید کالا و مواد اولیه', code: '5101' },
  { title: 'تعمیر و نگهداری', code: '5207' },
  { title: 'بیمه و عوارض', code: '5208' },
  { title: 'مالیات و عوارض پرداختی', code: '5209' },
  { title: 'اینترنت، نرم‌افزار و سرویس ابری', code: '5210' },
  { title: 'پذیرایی و مهمانی', code: '5211' },
  { title: 'سوخت و بنزین', code: '5212' },
  { title: 'استهلاک', code: '5213' },
  { title: 'مشاوره و خدمات قانونی', code: '5214' },
  { title: 'آموزش و مطالعات', code: '5215' },
  { title: 'سفر و اقامت', code: '5216' },
  { title: 'لوازم و تجهیزات', code: '5217' },
  { title: 'بسته‌بندی و ظروف', code: '5218' },
  { title: 'کمیسیون و پورسانت', code: '5219' },
  { title: 'هزینه‌های مالی و کارمزد بانک', code: '5301' },
  { title: 'سایر هزینه‌ها', code: '5299' },
];

/** سازگاری با کدهای قبلی — عنوان‌ها کمی تغییر کرده‌اند */
export const EXPENSE_CATEGORY_CODE: Record<string, string> =
  Object.fromEntries(EXPENSE_CATEGORY_DEFAULTS.map((c) => [c.title, c.code]));

/** عناوین پیش‌فرض — فقط برای seed اولیه دیتابیس */
export const EXPENSE_CATEGORIES = EXPENSE_CATEGORY_DEFAULTS.map((c) => c.title);

/* ───────────── مدل‌های فاکتور — ۲ نگه؛ ۲ رایگان (با لوگوی کاربان) + ۸ پیشرفته ───────────── */

export interface InvoiceTemplateInfo {
  id: string;
  name: string;
  desc: string;
  free: boolean;
}

export const INVOICE_TEMPLATES: InvoiceTemplateInfo[] = [
  { id: 'official', name: 'رسمی مالیاتی', desc: 'فرم استاندارد صورتحساب مطابق پیش‌نویس سازمان مالیاتی', free: true },
  { id: 'minimal', name: 'مینیمال کاربان', desc: 'طرح تمیز و ساده با لوگوی کاربان — مناسب همه مشاغل', free: true },
  { id: 'classic', name: 'کلاسیک قاب‌دار', desc: 'قاب دوخط کلاسیک شبیه دفاتر چاپی قدیمی', free: false },
  { id: 'modern', name: 'مدرن نوار رنگی', desc: 'نوار رنگی بالای صفحه با چیدمان مدرن', free: false },
  { id: 'corporate', name: 'شرکتی سرمه‌ای', desc: 'سربرگ سرمه‌ای رسمی برای شرکت‌ها و سازمان‌ها', free: false },
  { id: 'luxury', name: 'لاکچری طلایی', desc: 'حاشیه طلایی و ظاهر لوکس برای مشاغل خاص', free: false },
  { id: 'compact', name: 'رسید فشرده', desc: 'نسخه فشرده کوچک — مناسب فروشگاه و پرینتر حرارتی', free: false },
  { id: 'ticket', name: 'تیکت دوپاره', desc: 'طرح کوپن دوپاره با خط جداکننده کنگره‌دار', free: false },
  { id: 'vintage', name: 'وینتیج کاغذی', desc: 'بافت کاغذ قدیمی با تایپوگرافی نسخ خطی‌نما', free: false },
  { id: 'carbon', name: 'کربن تیره', desc: 'هدر تیره مدرن با اعداد درشت — طرح روز', free: false },
];

export const FREE_TEMPLATE_IDS = new Set(INVOICE_TEMPLATES.filter((t) => t.free).map((t) => t.id));

export const UNITS = ['عدد', 'دستگاه', 'بسته', 'کارتن', 'کیلوگرم', 'متر', 'متر مربع', 'لیتر', 'ساعت', 'روز', 'نفر', 'شب', 'خدمت', 'پروژه'];

export const PAYMENT_METHODS: Record<string, string> = {
  cash: 'نقدی',
  transfer: 'کارت به کارت / حواله',
  cheque: 'چک',
  card: 'کارت‌خوان',
  other: 'سایر',
};

/* وضعیت چک‌ها */
export const CHECK_STATUS_LABEL: Record<string, string> = {
  in_hand: 'در جریان',
  deposited: 'در بانک',
  cleared: 'وصول شد',
  bounced: 'برگشت خورد',
  returned: 'عودت شد',
  canceled: 'ابطال شد',
};

export const CHART_KINDS: Record<string, string> = {
  asset: 'دارایی',
  liability: 'بدهی',
  equity: 'حقوق صاحبان سهام',
  income: 'درآمد',
  expense: 'هزینه',
};

/** کد سرفصل سیستم — هماهنگ با مایگریشن SQL */
export const SYSTEM_CHART: { code: string; title: string; kind: 'asset' | 'liability' | 'equity' | 'income' | 'expense' }[] = [
  { code: '1101', title: 'موجودی نقد و بانک — صندوق', kind: 'asset' },
  { code: '1102', title: 'موجودی نقد و بانک — بانک', kind: 'asset' },
  { code: '1103', title: 'حساب‌های دریافتنی تجاری', kind: 'asset' },
  { code: '1201', title: 'موجودی کالا و خرید', kind: 'asset' },
  { code: '2103', title: 'اعتبار مالیات و عوارض ارزش افزوده', kind: 'asset' },
  { code: '2101', title: 'حساب‌های پرداختنی تجاری', kind: 'liability' },
  { code: '2102', title: 'مالیات و عوارض ارزش افزوده فروش', kind: 'liability' },
  { code: '3101', title: 'سرمایه', kind: 'equity' },
  { code: '3102', title: 'سود (زیان) انباشته', kind: 'equity' },
  { code: '4101', title: 'درآمد فروش کالا و خدمات', kind: 'income' },
  { code: '4103', title: 'برگشت از فروش و تخفیفات', kind: 'income' },
  { code: '5101', title: 'بهای تمام‌شده کالای فروش‌رفته', kind: 'expense' },
  { code: '5201', title: 'هزینه‌های اداری و عمومی', kind: 'expense' },
  { code: '5202', title: 'هزینه حقوق و دستمزد', kind: 'expense' },
  { code: '5203', title: 'هزینه اجاره', kind: 'expense' },
  { code: '5204', title: 'هزینه آب، برق، گاز و تلفن', kind: 'expense' },
  { code: '5205', title: 'هزینه تبلیغات و بازاریابی', kind: 'expense' },
  { code: '5206', title: 'هزینه حمل و نقل', kind: 'expense' },
  { code: '5301', title: 'هزینه‌های مالی', kind: 'expense' },
];
