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

export const EXPENSE_CATEGORIES = [
  'حقوق و دستمزد',
  'اجاره',
  'آب، برق، گاز و تلفن',
  'تبلیغات و بازاریابی',
  'حمل و نقل',
  'هزینه‌های مالی',
  'اداری و عمومی',
];

export const EXPENSE_CATEGORY_CODE: Record<string, string> = {
  'حقوق و دستمزد': '5202',
  'اجاره': '5203',
  'آب، برق، گاز و تلفن': '5204',
  'تبلیغات و بازاریابی': '5205',
  'حمل و نقل': '5206',
  'هزینه‌های مالی': '5301',
  'اداری و عمومی': '5201',
};

export const UNITS = ['عدد', 'دستگاه', 'بسته', 'کارتن', 'کیلوگرم', 'متر', 'متر مربع', 'لیتر', 'ساعت', 'روز', 'نفر', 'شب', 'خدمت', 'پروژه'];

export const PAYMENT_METHODS: Record<string, string> = {
  cash: 'نقدی',
  transfer: 'کارت به کارت / حواله',
  cheque: 'چک',
  card: 'کارت‌خوان',
  other: 'سایر',
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
