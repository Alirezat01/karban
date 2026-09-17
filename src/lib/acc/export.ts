/* خروجی‌های اکسل / ورد / PDF برای ماژول حسابداری
   — لوگو: اگر کسب‌وکار اشتراک فعال داشته باشد و لوگو آپلود کرده باشد
     لوگوی خودش؛ در غیر این صورت لوگوی کاربان روی خروجی‌ها می‌نشیند. */

import type { AccBusiness } from './types';

export const KARBAN_LOGO_URL = '/assets/images/Gemini_Generated_Image_3xp4kz3xp4kz3xp4-removebg-preview.png';

export type BrandAccess = { status: string; plan?: string | null } | null | undefined;

/** آیا اشتراک فعال (پلن‌دار یا آزمایشی در حال اعتبار) دارد؟ */
export function hasActiveSubscription(access: BrandAccess): boolean {
  if (!access) return false;
  return ['active', 'trial'].includes(access.status);
}

/** لوگوی مؤثر برای سربرگ خروجی‌ها */
export function brandLogoUrl(business: Pick<AccBusiness, 'logo_url'>, access: BrandAccess): string {
  if (business.logo_url && hasActiveSubscription(access)) return business.logo_url;
  return KARBAN_LOGO_URL;
}

export function brandName(business: Pick<AccBusiness, 'brand' | 'name'>): string {
  return business.brand || business.name;
}

/* ───────────────── اکسل (xlsx واقعی با SheetJS) ───────────────── */

export interface ExcelSheet {
  name: string;
  headers: string[];
  rows: (string | number)[][];
  /** ردیف‌های اضافی بعد از جدول (مثل جمع‌ها) */
  footerRows?: (string | number)[][];
}

export async function exportExcel(filename: string, sheets: ExcelSheet[], meta?: { business?: string; title?: string }) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  for (const sheet of sheets) {
    const aoa: (string | number)[][] = [];
    if (meta?.title) aoa.push([meta.title]);
    if (meta?.business) aoa.push([`کسب‌وکار: ${meta.business}`]);
    if (meta?.title || meta?.business) aoa.push([]);
    aoa.push(sheet.headers, ...sheet.rows, ...(sheet.footerRows || []));
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = sheet.headers.map(() => ({ wch: 16 }));
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/* ───────────────── ورد (doc از HTML) ───────────────── */

const DOC_CSS = `
  body { font-family: 'Vazirmatn', Tahoma, sans-serif; direction: rtl; }
  h1 { font-size: 15pt; } h2 { font-size: 13pt; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #444; padding: 4px 6px; font-size: 10pt; text-align: right; }
  th { background: #f3f4f6; }
  .muted { color: #666; font-size: 9pt; }
  .brand-line { margin-top: 14px; font-size: 9pt; color: #666; }
`;

export function exportWord(filename: string, title: string, bodyHtml: string, logoUrl?: string) {
  const logo = logoUrl
    ? `<div><img src="${logoUrl}" width="90" alt="logo" /></div>`
    : '';
  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" lang="fa" dir="rtl">
<head><meta charset="utf-8" /><title>${escapeHtml(title)}</title>
<style>${DOC_CSS}</style></head>
<body>
  ${logo}
  <h1>${escapeHtml(title)}</h1>
  ${bodyHtml}
  <p class="brand-line">ساخته‌شده با حسابداری هوشمند کاربان — karbanapp.ir</p>
</body></html>`;
  const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
  downloadBlob(blob, filename.endsWith('.doc') ? filename : `${filename}.doc`);
}

/* ───────────────── PDF (چاپ مرورگر → ذخیره PDF) ───────────────── */

export function printHtml(title: string, bodyHtml: string, opts: { logoUrl?: string; landscape?: boolean } = {}) {
  const w = window.open('', '_blank', 'width=980,height=720');
  if (!w) {
    alert('پنجره چاپ باز نشد — لطفاً مسدودکننده پاپ‌آپ را غیرفعال کنید.');
    return;
  }
  const logo = opts.logoUrl
    ? `<img class="print-logo" src="${opts.logoUrl}" alt="logo" />`
    : '';
  w.document.write(`<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head><meta charset="utf-8" /><title>${escapeHtml(title)}</title>
<style>
  @page { size: ${opts.landscape ? 'A4 landscape' : 'A4'}; margin: 12mm; }
  body { font-family: Vazirmatn, Tahoma, sans-serif; direction: rtl; color: #111; margin: 0; }
  .print-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 2px solid #0a0f1c; padding-bottom: 10px; margin-bottom: 14px; }
  .print-logo { max-height: 64px; max-width: 170px; object-fit: contain; }
  .print-title { font-size: 16pt; font-weight: 800; }
  .print-sub { color: #555; font-size: 10pt; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0 14px; }
  th, td { border: 1px solid #999; padding: 5px 7px; font-size: 9.5pt; text-align: right; }
  th { background: #eef1f6; }
  tfoot td { font-weight: 700; background: #f7f8fa; }
  .muted { color: #555; font-size: 9pt; }
  .summary { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
  .summary .box { border: 1px solid #ccc; border-radius: 8px; padding: 7px 12px; font-size: 10pt; }
  .brand-line { margin-top: 18px; padding-top: 8px; border-top: 1px dashed #aaa; color: #666; font-size: 9pt; text-align: center; }
</style></head>
<body>
  <div class="print-head">
    <div><div class="print-title">${escapeHtml(title)}</div>
    <div class="print-sub">تاریخ چاپ: ${new Date().toLocaleDateString('fa-IR')}</div></div>
    ${logo}
  </div>
  ${bodyHtml}
  <div class="brand-line">ساخته‌شده با حسابداری هوشمند کاربان — karbanapp.ir</div>
</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 350);
}

/* ───────────────── کمکی‌ها ───────────────── */

export function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function htmlTable(headers: string[], rows: (string | number)[][], footer?: (string | number)[]): string {
  const thead = `<thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>`;
  const tbody = `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(String(c ?? ''))}</td>`).join('')}</tr>`).join('')}</tbody>`;
  const tfoot = footer ? `<tfoot><tr>${footer.map((c) => `<td>${escapeHtml(String(c ?? ''))}</td>`).join('')}</tr></tfoot>` : '';
  return `<table>${thead}${tbody}${tfoot}</table>`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** نام فایل خروجی: فاکتور-۱۲۳-۱۴۰۵۰۷۰۱.xlsx */
export function exportFilename(prefix: string, suffix?: string, ext?: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const parts = [prefix, suffix, date].filter(Boolean).join('-');
  return ext ? `${parts}.${ext}` : parts;
}

/* ───────────────── خروجی JSON سامانه مودیان (نسخه ۵) ─────────────────
   ساختار نزدیک به Invoice.schema.json درگاه مؤدیان — آماده ارسال با TSP/کارپوشه.
   ارسال واقعی نیازمند حافظه مالیاتی و توکن است؛ این بسته فقط داده آماده می‌کند. */

export interface MoadianInvoiceInput {
  id: string;
  number: string;
  type: string;
  date_g: string;
  is_cash_sale: boolean | null;
  buyer_type: 'business' | 'final' | null;
  pay_id: string | null;
  total: number;
  vat_total: number;
  discount_total: number;
  description: string | null;
  partner?: { name?: string | null; national_id?: string | null; shenase_melli?: string | null; economic_code?: string | null; postal_code?: string | null } | null;
  items?: { title: string; unit: string; quantity: number; unit_price: number; discount: number; vat_rate: number; vat_amount: number; row_total: number; stuff_id: string | null }[];
}

export function buildMoadianJson(
  inv: MoadianInvoiceInput,
  seller: { name?: string | null; shenase_melli?: string | null; national_id?: string | null; economic_code?: string | null; postal_code?: string | null },
): string {
  const taxIdBase = `${(seller.economic_code || '000000000000').slice(-6)}${inv.date_g.replace(/-/g, '').slice(2)}${String(inv.total % 100000).padStart(5, '0')}`;
  const payload = {
    invoiceId: inv.id,
    invoiceNumber: inv.number,
    taxId: taxIdBase.slice(0, 22),
    indati2m: inv.date_g,
    ins: inv.buyer_type === 'final' ? 2 : 1, // موضوع: ۱ اصلی (بنگاه) / ۲ مصرف‌کننده نهایی
    type: inv.type === 'purchase' ? 2 : 1,   // نوع: ۱ فروش / ۲ خرید
    patternSubject: inv.is_cash_sale === false ? 2 : 1, // ۱ نقدی / ۲ غیرنقدی
    payId: inv.pay_id || undefined,
    description: inv.description || undefined,
    seller: {
      name: seller.name,
      idNum: seller.shenase_melli || seller.national_id,
      economicCode: seller.economic_code,
      postCode: seller.postal_code,
    },
    buyer: inv.buyer_type === 'final'
      ? { type: 2 }
      : {
          name: inv.partner?.name,
          idNum: inv.partner?.shenase_melli || inv.partner?.national_id,
          economicCode: inv.partner?.economic_code,
          postCode: inv.partner?.postal_code,
        },
    total: {
      amount: inv.total,
      vat: inv.vat_total,
      discount: inv.discount_total,
      settlement: inv.total,
    },
    invoiceBody: (inv.items || []).map((it, i) => ({
      sstId: it.stuff_id || undefined,
      sstTin: i + 1,
      sstTtds: it.title,
      mu: it.unit,
      am: it.quantity,
      ssrv: it.unit_price,
      sscv: Math.round(it.quantity * it.unit_price),
      ssrvv: it.discount,
      sscmf: it.vat_amount,
      ssrvam: it.row_total,
      exr: it.vat_rate,
    })),
    meta: {
      generator: 'کاربان — karbanapp.ir',
      generatedAt: new Date().toISOString(),
      note: 'این بسته برای ارسال با سرویس‌های TSP دارای مجوز سازمان امور مالیاتی آماده شده است.',
    },
  };
  return JSON.stringify(payload, null, 2);
}

/** دانلود فایل JSON مودیان */
export function exportMoadianJson(inv: MoadianInvoiceInput, seller: Parameters<typeof buildMoadianJson>[1]) {
  const json = buildMoadianJson(inv, seller);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `moadian-invoice-${inv.number}-${inv.date_g}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
