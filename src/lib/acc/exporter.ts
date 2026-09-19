/* ═════════════════════════════════════════════════════════════════════
   خروجی گزارش‌ها — اکسل و PDF
   ─────────────────────────────────────────────────────────────────
   • اکسل: SheetJS (import پویا — خارج از باندل اصلی) با شیت RTL و
     اعداد خام عددی تا حسابدار بتواند مستقیماً محاسبه کند
   • PDF: از مسیر چاپ مرورگر (print) — تنها روشی که حروف فارسی را
     درست شکل می‌دهد (کتابخانه‌های jsPDF/pdf-lib شکل‌دهی RTL ندارند
     و حروف جدا-جدا چاپ می‌کنند). کاربر در دیالوگ چاپ «Save as PDF»
     را انتخاب می‌کند و خروجی وکتوری و تمیز است.
   ═════════════════════════════════════════════════════════════════════ */

export type ExportCell = string | number | null | undefined;

export type ExportBlock = {
  name: string;
  headers: string[];
  rows: ExportCell[][];
  foot?: ExportCell[];
  /** اندیس ستون‌های عددی (ریال) — در اکسل خام، در PDF قالب‌بندی سه‌رقمی فارسی */
  moneyCols?: number[];
};

export type ExportTable = {
  title: string;
  subtitle?: string;
  meta?: ReadonlyArray<readonly [string, string]>;
  landscape?: boolean;
  blocks: ExportBlock[];
};

const safeSheetName = (s: string) => (s.replace(/[\\/?*[\]:]/g, ' ').trim() || 'گزارش').slice(0, 28);

/* ── اکسل ── */
export async function exportTableToExcel(t: ExportTable, filename: string) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>();
  for (const b of t.blocks) {
    const aoa: (string | number)[][] = [[b.name], b.headers];
    for (const r of b.rows) aoa.push(r.map((c, i) => (b.moneyCols?.includes(i) ? Number(c ?? 0) : (c ?? ''))));
    if (b.foot) aoa.push(b.foot.map((c, i) => (b.moneyCols?.includes(i) ? Number(c ?? 0) : (c ?? ''))));
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    /* عرض ستون‌ها بر اساس طولانی‌ترین سلول (سقف ۴۰) */
    const colWidths = b.headers.map((h, ci) => {
      let max = String(h).length;
      for (const r of b.rows) max = Math.max(max, String(r[ci] ?? '').length);
      return { wch: Math.min(Math.max(max + 2, 10), 40) };
    });
    (ws as unknown as { '!cols': unknown[] })['!cols'] = colWidths;
    /* راست‌به‌چپ کردن شیت */
    (ws as unknown as { '!views': unknown[] })['!views'] = [{ RTL: true }];
    let name = safeSheetName(b.name);
    let i = 2;
    while (usedNames.has(name)) name = (safeSheetName(b.name).slice(0, 25) + ' ' + i++);
    usedNames.add(name);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/* ── PDF از مسیر چاپ ── */
export function printTablePdf(
  t: ExportTable,
  opts: { bizName?: string; moneyFormat?: (n: number) => string; dateLabel?: string } = {},
) {
  const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const money = opts.moneyFormat || ((n: number) => n.toLocaleString('fa-IR'));
  const cell = (c: ExportCell, isMoney: boolean) =>
    isMoney ? `<td class="num">${esc(typeof c === 'number' ? money(c) : (c ?? '—'))}</td>` : `<td>${esc(c ?? '—')}</td>`;

  const blocksHtml = t.blocks.map((b) => {
    const head = `<tr>${b.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>`;
    const body = b.rows.length
      ? b.rows.map((r) => `<tr>${r.map((c, i) => cell(c, !!b.moneyCols?.includes(i))).join('')}</tr>`).join('')
      : `<tr><td colspan="${b.headers.length}" style="text-align:center;color:#889">موردی ثبت نشده</td></tr>`;
    const foot = b.foot ? `<tfoot><tr>${b.foot.map((c, i) => cell(c, !!b.moneyCols?.includes(i))).join('')}</tr></tfoot>` : '';
    return `<h2>${esc(b.name)}</h2><table><thead>${head}</thead><tbody>${body}</tbody>${foot}</table>`;
  }).join('');

  const metaHtml = t.meta?.length
    ? `<div class="meta-box">${t.meta.map(([k, v]) => `<div><span>${esc(k)}:</span> <b>${esc(v)}</b></div>`).join('')}</div>`
    : '';

  const w = window.open('', '_blank', 'width=1150,height=820');
  if (!w) {
    alert('پنجره چاپ باز نشد — لطفاً popup را برای این سایت مجاز کنید و دوباره تلاش کنید.');
    return;
  }
  w.document.open();
  w.document.write(`<!doctype html>
<html dir="rtl" lang="fa"><head><meta charset="utf-8"><title>${esc(t.title)}</title>
<link rel="stylesheet" href="${location.origin}/fonts/vazirmatn.css">
<style>
  @page { size: A4 ${t.landscape ? 'landscape' : 'portrait'}; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Vazirmatn, Tahoma, sans-serif; color: #1c2333; margin: 0; font-size: 10pt; }
  header { text-align: center; border-bottom: 2px solid #b8963e; padding-bottom: 8px; margin-bottom: 6mm; }
  header .brand { font-size: 8.5pt; color: #8a7a4e; letter-spacing: .5px; margin-top: 2px; }
  h1 { font-size: 14.5pt; margin: 0; }
  h2 { font-size: 11.5pt; margin: 7mm 0 2mm; color: #7a5c14; border-right: 3px solid #b8963e; padding-right: 7px; }
  .sub { font-size: 9.5pt; color: #555; margin-top: 3px; }
  .meta-box { display: flex; flex-wrap: wrap; gap: 4px 18px; background: #faf6ec; border: 1px solid #e5d9b8; border-radius: 8px; padding: 6px 12px; font-size: 9pt; margin-bottom: 4mm; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 3mm; }
  th { background: #f3ead2; border: 1px solid #cdb87f; padding: 5px 7px; font-weight: 700; }
  td { border: 1px solid #ddd0a8; padding: 4.5px 7px; }
  tbody tr:nth-child(even) td { background: #fcfaf3; }
  tfoot td { background: #f3ead2; font-weight: 800; }
  .num { font-variant-numeric: tabular-nums; text-align: left; direction: ltr; }
  @media print { h2 { break-after: avoid; } table { break-inside: auto; } tr { break-inside: avoid; } }
</style></head><body>
<header>
  <h1>${esc(t.title)}</h1>
  ${t.subtitle ? `<div class="sub">${esc(t.subtitle)}</div>` : ''}
  ${opts.bizName ? `<div class="sub">${esc(opts.bizName)}</div>` : ''}
  <div class="brand">کاربان — نرم‌افزار حسابداری هوشمند${opts.dateLabel ? ` | ${esc(opts.dateLabel)}` : ''}</div>
</header>
${metaHtml}
${blocksHtml}
<script>window.onload = function () { setTimeout(function () { window.print(); }, 350); };<\/script>
</body></html>`);
  w.document.close();
}
