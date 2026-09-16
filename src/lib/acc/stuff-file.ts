/* پارسر فایل رسمی «شناسه کالا و خدمات» سامانه مودیان
   منبع فایل: https://stuffid.tax.gov.ir/ → دانلود XML (StuffIDs.xml)
   ساختار تگ‌ها مطابق فایل رسمی: ID / Type / Date / SpecialOrGeneral /
   TaxableOrFree / Vat / VatCustomPurposes / DescriptionOfID
   همچنین CSV اکسلی خروجی‌گرفته از همان فهرست پذیرفته می‌شود. */

import type { AccStuffCatalogRow } from './types';

const faToEn = (s: string) => s
  .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

function normalizeId(raw: string): string | null {
  const digits = faToEn(String(raw || '')).replace(/[^0-9]/g, '');
  return digits.length >= 4 ? digits : null;
}

function cleanText(raw: string | null | undefined): string {
  return String(raw ?? '')
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseVat(raw: string | null | undefined): number {
  const n = Number(faToEn(String(raw ?? '')).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n)) return 0;
  /* نرخ در فایل رسمی گاهی 0.1 (کسر) و گاهی 10 (درصد) می‌آید */
  return n > 0 && n < 1 ? Math.round(n * 100) : Math.round(n);
}

function parseBoolFlag(raw: string | null | undefined, generalValue: string, freeValue: string): boolean {
  const v = cleanText(raw);
  if (!v) return true;
  if (v.includes(generalValue)) return true;
  if (v.includes(freeValue)) return false;
  return true;
}

/** پارس XML رسمی — فرزندان مستقیم ریشه، هر کدام یک شناسه (مطابق ساختار فایل رسمی) */
export function parseStuffXml(xmlText: string): AccStuffCatalogRow[] {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('فایل XML معتبر نیست');
  }
  const root = doc.documentElement;
  /* آیتم‌ها = فرزندان مستقیم ریشه؛ اگر ریشه مستقیم ID نداشت، هر فرزندی که ID دارد */
  let items = Array.from(root.children);
  if (!items.some((el) => el.getElementsByTagName('ID').length > 0)) {
    items = [root];
  }
  const rows: AccStuffCatalogRow[] = [];
  const seen = new Set<string>();
  for (const el of items) {
    const get = (tag: string) => el.getElementsByTagName(tag)[0]?.textContent ?? '';
    const id = normalizeId(get('ID'));
    const description = cleanText(get('DescriptionOfID'));
    if (!id || !description || seen.has(id)) continue;
    seen.add(id);
    rows.push({
      id,
      description,
      type_name: cleanText(get('Type')) || null,
      vat: parseVat(get('Vat')),
      taxable: parseBoolFlag(get('TaxableOrFree'), 'مشمول', 'معاف'),
      is_general: parseBoolFlag(get('SpecialOrGeneral'), 'عمومی', 'خاص'),
      shamsi_date: cleanText(get('Date')) || null,
    });
  }
  if (!rows.length) throw new Error('هیچ شناسه‌ای در فایل پیدا نشد — فایل رسمی StuffIDs.xml را انتخاب کنید.');
  return rows;
}

/** پارس CSV/TSV اکسلی: حداقل دو ستون شناسه و شرح؛ جداکننده خودکار تشخیص داده می‌شود */
export function parseStuffCsv(text: string): AccStuffCatalogRow[] {
  const clean = text.replace(/^\uFEFF/, '');
  const lines = clean.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error('فایل CSV خالی است');
  const sep = [',', ';', '\t'].sort((a, b) =>
    (lines[0].match(new RegExp(`\\${a}`, 'g')) || []).length -
    (lines[0].match(new RegExp(`\\${b}`, 'g')) || []).length).pop() || ',';
  const split = (line: string) => line.split(sep).map((c) => c.replace(/^"|"$/g, '').trim());

  const header = split(lines[0]);
  const colOf = (...names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));
  const idCol = colOf('شناسه', 'ID', 'stuff', 'کد');
  const descCol = colOf('شرح', 'Description', 'نام');
  const vatCol = colOf('ارزش افزوده', 'Vat', 'مالیات');

  const rows: AccStuffCatalogRow[] = [];
  const seen = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    const cells = split(lines[i]);
    const id = normalizeId(idCol >= 0 ? cells[idCol] : cells[0]);
    const description = cleanText(descCol >= 0 ? cells[descCol] : cells[1]);
    if (!id || !description || seen.has(id)) continue;
    seen.add(id);
    rows.push({
      id,
      description,
      type_name: null,
      vat: vatCol >= 0 ? parseVat(cells[vatCol]) : 0,
      taxable: true,
      is_general: true,
      shamsi_date: null,
    });
  }
  if (!rows.length) throw new Error('ستون شناسه و شرح در فایل پیدا نشد');
  return rows;
}

/** تشخیص خودکار فرمت از پسوند/محتوا */
export function parseStuffFile(file: File): Promise<AccStuffCatalogRow[]> {
  const name = file.name.toLowerCase();
  return file.text().then((text) => {
    const trimmed = text.trimStart();
    if (name.endsWith('.xml') || trimmed.startsWith('<?xml') || trimmed.startsWith('<')) {
      return parseStuffXml(text);
    }
    return parseStuffCsv(text);
  });
}
