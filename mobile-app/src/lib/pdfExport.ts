import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { formatRial, numberToPersianWords, toFaDigits } from './karbanData';

export interface ExportA4PdfOptions {
  fileName: string;
  badge: string;
  title: string;
  dateJalali: string;
  referenceCode?: string;
  metadata?: Array<{ label: string; value: string }>;
  body: string;
  amountRial?: number;
  signatureDataUrl?: string | null;
  firstPartyTitle?: string;
  secondPartyTitle?: string;
  stampText?: string;
}

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function exportA4DocumentToPdf(options: ExportA4PdfOptions): Promise<void> {
  const container = document.createElement('div');
  container.setAttribute('dir', 'rtl');
  container.style.position = 'fixed';
  container.style.left = '-99999px';
  container.style.top = '0';
  container.style.width = '794px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = "'Vazirmatn', Tahoma, Arial, sans-serif";
  container.style.padding = '36px';
  container.style.boxSizing = 'border-box';
  container.style.zIndex = '-1';

  const metaHtml = (options.metadata || [])
    .filter((m) => m.value)
    .map(
      (m) => `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;">
        <div style="font-size:11px;color:#64748b;margin-bottom:4px;">${escapeHtml(m.label)}</div>
        <div style="font-size:13px;font-weight:800;color:#0f172a;">${escapeHtml(toFaDigits(m.value))}</div>
      </div>`
    )
    .join('');

  const amountHtml =
    typeof options.amountRial === 'number' && options.amountRial > 0
      ? `
      <div style="margin-top:16px;padding:12px 16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;display:flex;justify-content:space-between;align-items:center;gap:12px;">
        <span style="font-size:12px;color:#1e3a8a;">مبلغ به حروف: ${escapeHtml(numberToPersianWords(options.amountRial))}</span>
        <strong style="font-size:14px;color:#1d4df5;">${escapeHtml(formatRial(options.amountRial))}</strong>
      </div>`
      : '';

  const signatureImgHtml = options.signatureDataUrl
    ? `<img src="${escapeHtml(options.signatureDataUrl)}" alt="امضای دیجیتال" style="max-height:68px;max-width:190px;object-fit:contain;" />`
    : `<span style="font-size:11px;color:#94a3b8;">امضای لمسی ثبت نشده</span>`;

  container.innerHTML = `
    <div style="border:2px solid #cbd5e1;border-radius:18px;padding:28px;background:#ffffff;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1d4df5;padding-bottom:14px;margin-bottom:18px;">
        <div>
          <div style="font-size:11px;font-weight:800;color:#1d4df5;margin-bottom:4px;">${escapeHtml(options.badge)}</div>
          <h1 style="font-size:18px;font-weight:900;color:#0f172a;margin:0;">${escapeHtml(toFaDigits(options.title))}</h1>
        </div>
        <div style="text-align:left;font-size:12px;color:#334155;">
          <div>تاریخ: <strong>${escapeHtml(toFaDigits(options.dateJalali))}</strong></div>
          ${options.referenceCode ? `<div style="margin-top:4px;">شماره سند: <strong>${escapeHtml(toFaDigits(options.referenceCode))}</strong></div>` : ''}
        </div>
      </div>

      ${metaHtml ? `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:18px;">${metaHtml}</div>` : ''}

      <div style="padding:18px;border:1px solid #cbd5e1;border-radius:12px;background:#ffffff;font-size:13px;line-height:2;color:#1e293b;white-space:pre-line;text-align:justify;">
        ${escapeHtml(toFaDigits(options.body))}
      </div>

      ${amountHtml}

      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:24px;padding-top:18px;border-top:1px dashed #cbd5e1;">
        <div>
          <div style="font-size:12px;font-weight:800;color:#0f172a;margin-bottom:10px;">
            ${escapeHtml(options.firstPartyTitle || 'مهر و امضای طرف اول / صادرکننده:')}
          </div>
          <div style="min-height:76px;border:1px dashed #93c5fd;border-radius:12px;padding:8px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px;">
            ${signatureImgHtml}
            <span style="font-size:10px;font-weight:700;color:#1d4df5;border:1px dashed #1d4df5;padding:4px 8px;border-radius:8px;">
              ${escapeHtml(options.stampText || 'مهر دیجیتال کاربان ۱۴۰۵')}
            </span>
          </div>
        </div>
        <div>
          <div style="font-size:12px;font-weight:800;color:#0f172a;margin-bottom:10px;">
            ${escapeHtml(options.secondPartyTitle || 'امضا و اثر انگشت طرف دوم:')}
          </div>
          <div style="min-height:76px;border:1px dashed #cbd5e1;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#94a3b8;">
            محل امضا و مهر دریافت‌کننده سند
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    let dataUrl: string;
    try {
      dataUrl = await toPng(container, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true,
      });
    } catch {
      dataUrl = await toPng(container, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        skipFonts: true,
      });
    }

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const printableWidth = pageWidth - margin * 2;
    const usablePageHeight = pageHeight - margin * 2;

    const props = pdf.getImageProperties(dataUrl);
    const renderedWidth = printableWidth;
    const renderedHeight = (props.height * renderedWidth) / props.width;

    let heightLeft = renderedHeight;
    let yOffset = margin;

    pdf.addImage(dataUrl, 'PNG', margin, yOffset, renderedWidth, renderedHeight, undefined, 'FAST');
    heightLeft -= usablePageHeight;

    while (heightLeft > 2) {
      pdf.addPage();
      yOffset = margin - (renderedHeight - heightLeft);
      pdf.addImage(dataUrl, 'PNG', margin, yOffset, renderedWidth, renderedHeight, undefined, 'FAST');
      heightLeft -= usablePageHeight;
    }

    pdf.save(options.fileName);
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}
