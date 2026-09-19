/* ═════════════════════════════════════════════════════════════════════
   واردات فاکتور از فایل Word (.docx) / PDF / Excel (.xlsx)
   ─────────────────────────────────────────────────────────────────
   کاربری: فاکتورهایی که در قالب استاندارد (قالب قابل دانلود در همین
   صفحه) پر شده‌اند، بدون تایپ دستی وارد سیستم می‌شوند.

   معماری پارس:
   • docx → JSZip → word/document.xml → DOMParser → پاراگراف‌ها + جدول‌ها
   • xlsx → SheetJS → ردیف‌های آبجکتی
   • pdf  → pdfjs-dist → آیتم‌های متنی → گروه‌بندی خطی بر اساس مختصات Y
     (پارس PDF بهترین‌تلاش است؛ ساختار PDF فاقد مفهوم «جدول» است)
   همه مسیرها به یک استخراج‌کننده یکسان می‌رسند: یافتن فیلدهای سربرگ
   با نام‌های مستعار + یافتن «جدول ردیف‌ها» از روی هدر آن.

   نکته: هر سه کتابخانه با import پویا بارگذاری می‌شوند تا باندل
   اصلی حسابداری سنگین نشود.
   ═════════════════════════════════════════════════════════════════════ */

import { toEnDigits, jalaliInputToISO } from './jalali';

export type ParsedInvoiceItem = {
  title: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount: number;
  vat_rate: number;
};

export type ParsedInvoice = {
  source: string;
  type: 'sale' | 'proforma' | 'purchase';
  number: string;
  date_j: string;          /* جلالی ۱۴۰۴/۰۷/۰۱ */
  date_g: string | null;   /* ISO گرگوری — اگر تاریخ معتبر بود */
  buyer: string;
  buyer_national: string;  /* شناسه/کد ملی یا اقتصادی */
  notes: string;
  items: ParsedInvoiceItem[];
  warnings: string[];
};

/* ── نام‌های مستعار فیلدها ── */
const norm = (s: unknown) => toEnDigits(String(s ?? '')).replace(/[\u200c\s_./\\-]+/g, '').toLowerCase();
const ALIAS: Record<string, string[]> = {
  number: ['شماره فاکتور', 'شماره صورتحساب', 'شماره فاکتور فروش', 'invoice number', 'invoice no', 'number'],
  date: ['تاریخ صدور', 'تاریخ فاکتور', 'تاریخ صورتحساب', 'تاریخ', 'date'],
  buyer: ['خریدار', 'مشتری', 'طرف حساب', 'طرف حساب فروش', 'buyer', 'customer'],
  national: ['شناسه ملی', 'کد اقتصادی', 'کد/شناسه ملی', 'شناسه ملی/کد اقتصادی', 'national id', 'economic code'],
  notes: ['توضیحات', 'شرح فاکتور', 'ملاحظات', 'notes', 'description'],
};
const ITEM_HEADER: Record<string, string[]> = {
  title: ['شرح کالا/خدمت', 'شرح کالا / خدمت', 'شرح کالا', 'شرح', 'کالا / خدمت', 'کالا', 'خدمت', 'محصول', 'item', 'description'],
  unit: ['واحد', 'unit'],
  quantity: ['مقدار', 'تعداد', 'qty', 'quantity', 'count'],
  unit_price: ['مبلغ واحد', 'قیمت واحد', 'مبلغ واحد (ریال)', 'نرخ', 'فی', 'unit price', 'price'],
  discount: ['تخفیف', 'discount'],
  vat_rate: ['مالیات ٪', 'نرخ مالیات', 'مالیات درصد', 'vat %', 'tax %'],
  vat_amount: ['مبلغ مالیات', 'مالیات', 'ارزش افزوده', 'vat', 'tax'],
  total: ['جمع ردیف', 'مبلغ کل', 'جمع', 'جمع کل', 'total'],
};
const TYPE_ALIASES: { type: ParsedInvoice['type']; keys: string[] }[] = [
  { type: 'proforma', keys: ['پیش فاکتور', 'پیشفاکتور', 'استعلام قیمت', 'proforma', 'quotation'] },
  { type: 'purchase', keys: ['فاکتور خرید', 'صورتحساب خرید', 'خرید از تامین', 'صورتحساب خرید', 'purchase', 'supplier invoice'] },
  { type: 'sale', keys: ['فاکتور فروش', 'صورتحساب فروش', 'فاکتور', 'sale', 'invoice'] },
];

/* ── نرمال‌سازی عدد: «۱۲٬۳۴۵ ریال» → 12345 ── */
export function parseNum(v: unknown): number {
  const s = toEnDigits(String(v ?? '')).replace(/[^\d.-]/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/* ── نرمال‌سازی تاریخ جلالی: «۱۴۰۴-۰۷-۰۱» → «1404/07/01» (اعتبارسنجی حداقلی) ── */
export function parseJalaliText(v: unknown): string {
  const s = toEnDigits(String(v ?? '')).trim();
  const m = s.match(/(\d{2,4})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{1,2})/);
  if (!m) return '';
  let y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
  if (y < 100) y += 1300;
  if (y < 1300 || y > 1500 || mo < 1 || mo > 12 || d < 1 || d > 31) return '';
  return `${y}/${String(mo).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
}

function matchAlias(text: string, aliases: string[]): boolean {
  const n = norm(text);
  if (!n) return false;
  return aliases.some((a) => n.includes(norm(a)));
}

/* تطبیق سلول جدول — برخلاف matchAlias، نام‌های کوتاه (مثل «فی») فقط تطبیق کامل
   می‌شوند تا «فی» داخل «تخفیف» ستون را اشتباه نگرفته و ستون‌ها جابه‌جا نشوند */
function matchCell(cell: string, aliases: string[]): boolean {
  const nc = norm(cell);
  if (!nc) return false;
  return aliases.some((a) => {
    const na = norm(a);
    if (!na) return false;
    return na.length <= 4 ? nc === na : nc === na || nc.includes(na);
  });
}

function detectType(text: string): ParsedInvoice['type'] {
  for (const t of TYPE_ALIASES) if (matchAlias(text, t.keys)) return t.type;
  return 'sale';
}

/* یافتن مقدار «کلید: مقدار» یا «کلید | مقدار» در یک خط —
   در PDF ترتیب x ستون‌ها ممکن است مقدار را «قبل از» کلید بگذارد؛ پس هر دو جهت بررسی می‌شود */
const ALL_KEY_ALIASES = Object.values(ALIAS).flat();
const isKeyLike = (s: string) => { const n = norm(s).replace(/:$/, ''); return ALL_KEY_ALIASES.some((a) => n === norm(a) || n === norm(a).replace(/:$/, '')); };

function fieldValue(lines: string[], aliases: string[]): string {
  for (const line of lines) {
    const parts = toEnDigits(line).split(/[:|\u2013\u2014\t]| {2,}/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      for (let i = 0; i < parts.length; i++) {
        for (const a of aliases) {
          const key = norm(parts[i]).replace(/:$/, '');
          if (key && (key === norm(a) || (norm(a).length > 5 && key.includes(norm(a))))) {
            /* مقدار در جزء بعدی یا قبلی — جزئی که خودش کلید نیست */
            const next = parts[i + 1], prev = parts[i - 1];
            const pick = (v?: string) => (v && !isKeyLike(v) ? v : '');
            const val = pick(next) || pick(prev);
            if (val) return val;
          }
        }
      }
    }
    /* حالت «کلید» در یک خط و «مقدار» در خط بعد (docx جدولی) */
    for (const a of aliases) {
      const n = norm(line);
      if (n === norm(a) || (n.endsWith(norm(a)) && n.length - norm(a).length < 3)) {
        const idx = lines.indexOf(line);
        const next = lines[idx + 1]?.trim();
        if (next && !isKeyLike(next)) return next;
      }
    }
  }
  return '';
}

/* شناسایی جدول ردیف‌ها: ردیفی که هم شرح دارد هم مبلغ واحد یا جمع */
function matchItemHeaderRow(cells: string[]): string | null {
  const hasTitle = cells.some((c) => matchCell(c, ITEM_HEADER.title));
  const hasMoney = cells.some((c) => matchCell(c, [...ITEM_HEADER.unit_price, ...ITEM_HEADER.total, ...ITEM_HEADER.quantity]));
  if (hasTitle && hasMoney) {
    /* نگاشت ستون‌ها */
    return cells.map((c) => {
      if (matchCell(c, ITEM_HEADER.title)) return 'title';
      if (matchCell(c, ITEM_HEADER.unit_price)) return 'unit_price';
      if (matchCell(c, ITEM_HEADER.discount)) return 'discount';
      if (matchCell(c, ITEM_HEADER.vat_rate)) return 'vat_rate';
      if (matchCell(c, ITEM_HEADER.vat_amount)) return 'vat_amount';
      if (matchCell(c, ITEM_HEADER.quantity)) return 'quantity';
      if (matchCell(c, ITEM_HEADER.unit)) return 'unit';
      if (matchCell(c, ITEM_HEADER.total)) return 'total';
      return 'ignore';
    }).join(',');
  }
  return null;
}

function cellsToItem(map: string[], cells: string[], warnings: string[]): ParsedInvoiceItem | null {
  const get = (k: string) => { const i = map.indexOf(k); return i >= 0 ? cells[i] : ''; };
  const title = get('title').trim();
  if (!title) return null;
  /* فقط ردیف هدر تکراری را رد کن: هیچ سلولی رقم ندارد و حداقل ۲ سلول با نام‌های مستعار ستون تطبیق دارد
     (ردیف داده واقعی همیشه رقم دارد — حتی «خدمت طراحی سایت» هم داده است نه هدر) */
  const hasAnyDigit = cells.some((c) => /\d/.test(String(c)));
  if (!hasAnyDigit) {
    const aliasHits = cells.filter((c) => matchCell(c, Object.values(ITEM_HEADER).flat())).length;
    if (aliasHits >= 2) return null;
  }
  const quantity = parseNum(get('quantity')) || 1;
  let unit_price = parseNum(get('unit_price'));
  const total = parseNum(get('total'));
  /* اگر فقط «جمع» پر شده و مقدار در دسترس است، مبلغ واحد را برگردان */
  if (!unit_price && total) unit_price = Math.round(total / quantity);
  if (!unit_price) { warnings.push(`ردیف «${title.slice(0, 30)}» بدون مبلغ رد شد`); return null; }
  let vat_rate = parseNum(get('vat_rate'));
  if (!get('vat_rate') && parseNum(get('vat_amount')) > 0) {
    /* درصد مالیات را از مبلغ مالیات تقریبی استخراج کن */
    const base = Math.round(quantity * unit_price) - parseNum(get('discount'));
    vat_rate = base > 0 ? Math.round((parseNum(get('vat_amount')) / base) * 100) : 10;
    warnings.push(`نرخ مالیات ردیف «${title.slice(0, 30)}» از مبلغ مالیات تخمین زده شد (${vat_rate}٪)`);
  }
  return {
    title,
    quantity,
    unit: get('unit').trim() || 'عدد',
    unit_price,
    discount: parseNum(get('discount')),
    vat_rate: Math.min(Math.max(vat_rate, 0), 100),
  };
}

function finalize(source: string, head: { lines: string[]; type?: ParsedInvoice['type'] }, rawItems: ParsedInvoiceItem[], warn: string[]): ParsedInvoice {
  const date_j = parseJalaliText(fieldValue(head.lines, ALIAS.date));
  return {
    source,
    type: head.type || 'sale',
    number: fieldValue(head.lines, ALIAS.number),
    date_j,
    date_g: date_j ? jalaliInputToISO(date_j) : null,
    buyer: fieldValue(head.lines, ALIAS.buyer),
    buyer_national: fieldValue(head.lines, ALIAS.national),
    notes: fieldValue(head.lines, ALIAS.notes),
    items: rawItems,
    warnings: warn,
  };
}

/* ═════════ DOCX ═════════ */
async function parseDocx(file: File): Promise<ParsedInvoice> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) throw new Error('ساختار فایل Word معتبر نیست (document.xml یافت نشد)');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const NS = '*';
  const paraText = (p: Element) => Array.from(p.getElementsByTagNameNS(NS, 't')).map((t) => t.textContent || '').join('').trim();
  /* پاراگراف‌های خارج از جدول */
  const body = doc.getElementsByTagNameNS(NS, 'body')[0];
  const lines: string[] = [];
  const tables: string[][][] = [];
  const tableEls = Array.from(doc.getElementsByTagNameNS(NS, 'tbl'));
  const directTables = new Set(tableEls);
  if (body) {
    for (const child of Array.from(body.children)) {
      const tag = child.tagName.replace(/^w:/, '');
      if (tag === 'tbl') continue;
      const t = paraText(child);
      if (t) lines.push(t);
    }
  }
  for (const tbl of tableEls) {
    const rows: string[][] = [];
    for (const tr of Array.from(tbl.getElementsByTagNameNS(NS, 'tr'))) {
      const cells = Array.from(tr.getElementsByTagNameNS(NS, 'tc')).map((tc) =>
        Array.from(tc.getElementsByTagNameNS(NS, 'p')).map(paraText).filter(Boolean).join(' ').trim());
      if (cells.some(Boolean)) rows.push(cells);
    }
    tables.push(rows);
  }
  void directTables;

  /* نوع فاکتور از کل متن */
  const allText = [...lines, ...tables.flat().flat()].join(' ');
  const type = detectType(allText);

  /* جدول ردیف‌ها */
  const items: ParsedInvoiceItem[] = [];
  const warnings: string[] = [];
  let itemsTableIdx = -1;
  for (let ti = 0; ti < tables.length; ti++) {
    const rows = tables[ti];
    for (let i = 0; i < rows.length; i++) {
      const map = matchItemHeaderRow(rows[i]);
      if (!map) continue;
      for (let j = i + 1; j < rows.length; j++) {
        if (rows[j].length < map.split(',').length - 2) break;
        const it = cellsToItem(map.split(','), rows[j], warnings);
        if (it) items.push(it);
      }
      if (items.length) break;
    }
    if (items.length) { itemsTableIdx = ti; break; }
  }
  if (!items.length) warnings.push('جدول ردیف‌ها شناسایی نشد — قالب استاندارد را بررسی کنید');

  /* فیلدهای سربرگ می‌توانند در پاراگراف یا در جدول متا (کلید | مقدار) باشند —
     جدول ردیف‌ها را از این جست‌وجو حذف می‌کنیم */
  const headLines = [...lines];
  tables.forEach((rows, ti) => {
    if (ti === itemsTableIdx) return;
    for (const r of rows) headLines.push(r.filter(Boolean).join(' | '));
  });
  return finalize(file.name, { lines: headLines, type }, items, warnings);
}

/* ═════════ XLSX ═════════ */
async function parseXlsxInvoice(file: File): Promise<ParsedInvoice> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const items: ParsedInvoiceItem[] = [];
  const warnings: string[] = [];
  const lines: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1, blankrows: false, defval: '' });
    if (sheetName !== wb.SheetNames[0]) lines.push(sheetName);
    /* اگر همین شیت جدول ردیف دارد */
    if (!items.length) {
      for (let i = 0; i < rows.length; i++) {
        const cells = rows[i].map((c) => String(c ?? '').trim());
        if (cells.some((c) => c)) lines.push(cells.filter(Boolean).join(' | '));
        const map = matchItemHeaderRow(cells);
        if (!map) continue;
        for (let j = i + 1; j < rows.length; j++) {
          const rowCells = rows[j].map((c) => String(c ?? '').trim());
          if (!rowCells.some(Boolean)) break;
          const it = cellsToItem(map.split(','), rowCells, warnings);
          if (it) items.push(it);
        }
        if (items.length) break;
      }
    } else {
      lines.push(...rows.map((r) => r.map((c) => String(c ?? '').trim()).filter(Boolean).join(' | ')).filter(Boolean));
    }
  }
  if (!items.length) warnings.push('جدول ردیف‌ها در فایل اکسل شناسایی نشد — قالب استاندارد را بررسی کنید');
  return finalize(file.name, { lines, type: detectType(lines.join(' ')) }, items, warnings);
}

/* ═════════ PDF ═════════ */
async function parsePdfInvoice(file: File): Promise<ParsedInvoice> {
  const pdfjs = await import('pdfjs-dist');
  try {
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    if (workerUrl) pdfjs.GlobalWorkerOptions.workerSrc = String(workerUrl);
  } catch { /* بدون workerSrc — pdfjs فال‌بک main-thread */ }
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const lines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    /* گروه‌بندی آیتم‌ها بر اساس Y (خط) و مرتب‌سازی بر اساس X */
    const byY = new Map<number, { x: number; s: string }[]>();
    for (const item of content.items) {
      if (!('str' in item) || !item.str?.trim()) continue;
      const y = Math.round((item.transform[5] ?? 0) / 2) * 2;
      if (!byY.has(y)) byY.set(y, []);
      byY.get(y)!.push({ x: item.transform[4] ?? 0, s: item.str });
    }
    const ys = [...byY.keys()].sort((a, b) => b - a);
    for (const y of ys) {
      const line = byY.get(y)!.sort((a, b) => a.x - b.x).map((i) => i.s.trim()).filter(Boolean).join(' | ');
      if (line.trim()) lines.push(line);
    }
  }
  const type = detectType(lines.join(' '));
  /* جدول ردیف‌ها در PDF: خطوطی که بعد از خط هدر می‌آیند و ساختار «شرح | اعداد» دارند */
  const items: ParsedInvoiceItem[] = [];
  const warnings: string[] = [];
  const headerIdx = lines.findIndex((l) => matchItemHeaderRow(l.split('|').map((s) => s.trim())));
  if (headerIdx >= 0) {
    const map = matchItemHeaderRow(lines[headerIdx].split('|').map((s) => s.trim()))!.split(',');
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const cells = lines[i].split('|').map((s) => s.trim());
      /* توقف در خطوط جمع‌بندی */
      if (matchAlias(cells.join(' '), ['جمع کل', 'جمع کل مبلغ', 'مبلغ قابل پرداخت', 'جمع تخفیف', 'جمع مالیات'])) break;
      const it = cellsToItem(map, cells, warnings);
      if (it) items.push(it);
    }
  } else {
    warnings.push('هدر جدول ردیف‌ها در PDF شناسایی نشد — پارس PDF بهترین‌تلاش است؛ در صورت ناقص بودن، قالب Word/اکسل را استفاده کنید');
  }
  return finalize(file.name, { lines, type }, items, warnings);
}

/* ═════════ ورودی اصلی ═════════ */
export async function parseInvoiceFile(file: File): Promise<ParsedInvoice> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.docx')) return parseDocx(file);
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) return parseXlsxInvoice(file);
  if (name.endsWith('.pdf')) return parsePdfInvoice(file);
  throw new Error('فرمت پشتیبانی نمی‌شود — فایل Word (.docx)، Excel (.xlsx) یا PDF بدهید');
}

/* ═════════ تولید قالب استاندارد ═════════ */
export const TEMPLATE_SAMPLE = {
  meta: [
    ['نوع فاکتور', 'فاکتور فروش'],
    ['شماره فاکتور', '1404-001'],
    ['تاریخ', '1404/07/01'],
    ['خریدار', 'شرکت نمونه تجارت'],
    ['شناسه ملی', '10101234567'],
    ['توضیحات', 'فاکتور نمونه — این ردیف‌ها را با اطلاعات واقعی جایگزین کنید'],
  ],
  headers: ['شرح کالا / خدمت', 'واحد', 'مقدار', 'مبلغ واحد (ریال)', 'تخفیف (ریال)', 'مالیات ٪'],
  rows: [
    ['خدمت طراحی سایت', 'عدد', 1, 250000000, 0, 10],
    ['میزبان سالانه', 'دستگاه', 2, 18000000, 5000000, 10],
  ],
};

export async function downloadTemplateXlsx() {
  const XLSX = await import('xlsx');
  const aoa: (string | number)[][] = [
    ...TEMPLATE_SAMPLE.meta.map(([a, b]) => [a, b]),
    [],
    TEMPLATE_SAMPLE.headers,
    ...TEMPLATE_SAMPLE.rows,
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  (ws as unknown as { '!cols': unknown[] })['!cols'] = [{ wch: 24 }, { wch: 42 }];
  (ws as unknown as { '!views': unknown[] })['!views'] = [{ RTL: true }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'فاکتور');
  XLSX.writeFile(wb, 'قالب-فاکتور-کاربان.xlsx');
}

export async function buildTemplateDocx(): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const p = (text: string, bold = false, size = 22) =>
    `<w:p><w:r>${bold ? '<w:rPr><w:b/></w:rPr>' : `<w:rPr><w:sz w:val="${size}"/></w:rPr>`}<w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
  const metaRows = TEMPLATE_SAMPLE.meta.map(([k, v]) =>
    `<w:tr><w:tc><w:tcPr><w:tcW w:w="3600" w:type="dxa"/></w:tcPr>${p(k, true)}<w:p/></w:tc><w:tc><w:tcPr><w:tcW w:w="6500" w:type="dxa"/></w:tcPr>${p(v)}<w:p/></w:tc></w:tr>`).join('');
  const headerRow = `<w:tr>${TEMPLATE_SAMPLE.headers.map((h) => `<w:tc><w:tcPr><w:tcW w:w="1700" w:type="dxa"/></w:tcPr>${p(h, true)}<w:p/></w:tc>`).join('')}</w:tr>`;
  const bodyRows = TEMPLATE_SAMPLE.rows.map((r) =>
    `<w:tr>${r.map((c) => `<w:tc><w:tcPr><w:tcW w:w="1700" w:type="dxa"/></w:tcPr>${p(String(c))}<w:p/></w:tc>`).join('')}</w:tr>`).join('');
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
${p('فاکتور فروش', true, 40)}
<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="6"/><w:left w:val="single" w:sz="6"/><w:bottom w:val="single" w:sz="6"/><w:right w:val="single" w:sz="6"/><w:insideH w:val="single" w:sz="6"/><w:insideV w:val="single" w:sz="6"/></w:tblBorders></w:tblPr>${metaRows}</w:tbl>
<w:p/>
<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="6"/><w:left w:val="single" w:sz="6"/><w:bottom w:val="single" w:sz="6"/><w:right w:val="single" w:sz="6"/><w:insideH w:val="single" w:sz="6"/><w:insideV w:val="single" w:sz="6"/></w:tblBorders></w:tblPr>${headerRow}${bodyRows}</w:tbl>
${p('')}
${p('راهنما: مقادیر جدول بالا و سطرهای جدول ردیف‌ها را با اطلاعات واقعی جایگزین کنید. تعداد ردیف‌ها آزاد است. تاریخ را به شکل 1404/07/01 وارد کنید.')}
<w:sectPr/></w:body></w:document>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypes);
  zip.folder('_rels')!.file('.rels', rels);
  zip.folder('word')!.file('document.xml', documentXml);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

export async function downloadTemplateDocx() {
  const blob = await buildTemplateDocx();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'قالب-فاکتور-کاربان.docx'; a.click();
  URL.revokeObjectURL(url);
}
