import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Printer,
  FileDown,
  X,
  Share2,
  ZoomIn,
  ZoomOut,
  CheckCircle2,
  ShieldCheck,
  PenTool,
  Loader2,
  Stamp,
  FileText,
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import {
  OfficialInvoice,
  formatFaNum,
  formatRial,
  formatToman,
  numberToPersianWords,
  toFaDigits,
} from '../lib/karbanData';

export type PrintDocumentPayload =
  | {
      kind: 'invoice';
      invoice: OfficialInvoice;
    }
  | {
      kind: 'tax_brief';
      title: string;
      authority: string;
      taxpayerName: string;
      dateJalali: string;
      amountRial: number;
      citations: string[];
      body: string;
      strategicTip?: string;
    }
  | {
      kind: 'contract';
      title: string;
      categoryLabel: string;
      dateJalali: string;
      referenceCode?: string;
      employerName: string;
      employerId?: string;
      workerName: string;
      workerId?: string;
      amountRial?: number;
      body: string;
    }
  | {
      kind: 'letter';
      title: string;
      targetOrg: string;
      dateJalali: string;
      employerName: string;
      employeeName: string;
      body: string;
    };

interface PrintPreviewPdfModalProps {
  documentData: PrintDocumentPayload | null;
  signatureDataUrl?: string | null;
  onClose: () => void;
  onShare?: () => void;
  onRequestSignaturePad?: () => void;
}

const buildPdfFileName = (doc: PrintDocumentPayload): string => {
  const stamp = new Date().toISOString().slice(0, 10);
  if (doc.kind === 'invoice') {
    return `karban-moadian-invoice-${doc.invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '') || stamp}.pdf`;
  }
  if (doc.kind === 'tax_brief') {
    return `karban-tax-defense-${stamp}.pdf`;
  }
  if (doc.kind === 'contract') {
    return `karban-contract-${stamp}.pdf`;
  }
  return `karban-official-letter-${stamp}.pdf`;
};

const getDocHeaderTitle = (doc: PrintDocumentPayload): string => {
  switch (doc.kind) {
    case 'invoice':
      return 'پیش‌نمایش چاپ و دانلود PDF صورتحساب رسمی سامانه مودیان';
    case 'tax_brief':
      return 'پیش‌نمایش چاپ و دانلود PDF لایحه دفاعیه رسمی مالیاتی / اداره کار';
    case 'contract':
      return 'پیش‌نمایش چاپ و دانلود PDF قرارداد رسمی';
    case 'letter':
      return 'پیش‌نمایش چاپ و دانلود PDF نامه رسمی اداری';
  }
};

export const PrintPreviewPdfModal: React.FC<PrintPreviewPdfModalProps> = ({
  documentData,
  signatureDataUrl,
  onClose,
  onShare,
  onRequestSignaturePad,
}) => {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState<0.75 | 1 | 1.25>(1);
  const [showOfficialStamp, setShowOfficialStamp] = useState(true);
  const [showDigitalSignature, setShowDigitalSignature] = useState(true);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfSuccessMsg, setPdfSuccessMsg] = useState<string | null>(null);
  const [pdfErrorMsg, setPdfErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!documentData) return;
    document.body.classList.add('karban-printing-modal');
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.body.classList.remove('karban-printing-modal');
      window.removeEventListener('keydown', handleEsc);
    };
  }, [documentData, onClose]);

  if (!documentData) return null;

  const handleDownloadPdf = async () => {
    if (!sheetRef.current || isExportingPdf) return;
    setIsExportingPdf(true);
    setPdfErrorMsg(null);
    setPdfSuccessMsg(null);

    try {
      const node = sheetRef.current;
      let dataUrl: string;
      try {
        dataUrl = await toPng(node, {
          pixelRatio: 2,
          backgroundColor: '#ffffff',
          cacheBust: true,
        });
      } catch {
        // Fallback when remote stylesheet fonts reject cross-origin canvas reading
        dataUrl = await toPng(node, {
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

      const props = pdf.getImageProperties(dataUrl);
      const renderedWidth = printableWidth;
      const renderedHeight = (props.height * renderedWidth) / props.width;
      const usablePageHeight = pageHeight - margin * 2;

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

      pdf.save(buildPdfFileName(documentData));
      setPdfSuccessMsg('فایل PDF رسمی با کیفیت چاپ A۴ آماده و ذخیره شد.');
      setTimeout(() => setPdfSuccessMsg(null), 4000);
    } catch {
      setPdfErrorMsg('ساخت مستقیم PDF با محدودیت مرورگر مواجه شد؛ لطفاً از دکمه «چاپ / ذخیره PDF مرورگر» استفاده کنید.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const modalNode = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={getDocHeaderTitle(documentData)}
      className="print-modal-portal fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-2"
    >
      <div className="print-modal-container w-full max-w-[430px] max-h-[92vh] rounded-[30px] frost-sheet-bg border border-white/80 dark:border-slate-700/60 shadow-2xl overflow-hidden flex flex-col">
        {/* TOP ACTION BAR (HIDDEN ON PRINT) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-2.5 px-4 py-3 border-b border-slate-200/70 dark:border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-[#1D4DF5] text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-600/30">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-black text-[#0F172A] dark:text-white truncate">{getDocHeaderTitle(documentData)}</h2>
              <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                قطع استاندارد A۴ عمودی · خروجی رسمی با فونت فارسی و مهر دیجیتال
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full justify-between pt-1">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="cobalt-pill-btn min-h-[42px] px-4 py-2 disabled:opacity-60 text-xs font-black flex items-center gap-1.5 whitespace-nowrap"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>در حال ساخت PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>دانلود فایل PDF</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePrint}
                className="min-h-[40px] px-3.5 py-2 rounded-full bg-white dark:bg-[#1A223B] border border-slate-200/80 dark:border-slate-700 text-[#0F172A] dark:text-white text-xs font-extrabold flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Printer className="w-4 h-4 text-[#1D4DF5] dark:text-[#608BFF]" />
                <span>چاپ مستقیم</span>
              </button>

              {onShare && (
                <button
                  type="button"
                  onClick={onShare}
                  aria-label="اشتراک"
                  className="circle-icon-btn w-10 h-10 flex items-center justify-center text-slate-700 dark:text-slate-200"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                aria-label="بستن پیش‌نمایش چاپ"
                className="circle-icon-btn w-10 h-10 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-rose-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* PREVIEW OPTIONS STRIP (HIDDEN ON PRINT) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 bg-white/90 dark:bg-[#12182B]/90 border-b border-slate-200/70 dark:border-slate-800 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-1.5 cursor-pointer select-none font-bold text-[#0F172A] dark:text-slate-200">
              <input
                type="checkbox"
                checked={showOfficialStamp}
                onChange={(e) => setShowOfficialStamp(e.target.checked)}
                className="accent-[#1D4DF5] w-4 h-4 rounded"
              />
              <Stamp className="w-3.5 h-3.5 text-[#1D4DF5] dark:text-[#608BFF]" />
              <span>درج مهر و سربرگ کاربان</span>
            </label>

            <label className="inline-flex items-center gap-1.5 cursor-pointer select-none font-bold text-[#0F172A] dark:text-slate-200">
              <input
                type="checkbox"
                checked={showDigitalSignature}
                onChange={(e) => setShowDigitalSignature(e.target.checked)}
                className="accent-[#1D4DF5] w-4 h-4 rounded"
              />
              <PenTool className="w-3.5 h-3.5 text-[#1D4DF5] dark:text-[#608BFF]" />
              <span>درج امضای لمسی دیجیتال</span>
            </label>
          </div>

          <div className="flex items-center gap-1 bg-[#EFF1FA] dark:bg-[#1A223B] p-1 rounded-full">
            <span className="px-2 text-[10.5px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              {zoom < 1 ? <ZoomOut className="w-3.5 h-3.5" /> : <ZoomIn className="w-3.5 h-3.5" />}
              بزرگنمایی:
            </span>
            {[
              { value: 0.75 as const, label: '۷۵٪' },
              { value: 1 as const, label: '۱۰۰٪' },
              { value: 1.25 as const, label: '۱۲۵٪' },
            ].map((z) => (
              <button
                key={z.value}
                type="button"
                onClick={() => setZoom(z.value)}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold transition-colors tabular-nums ${
                  zoom === z.value
                    ? 'bg-[#1D4DF5] text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {z.label}
              </button>
            ))}
          </div>
        </div>

        {/* STATUS FEEDBACK BANNER (HIDDEN ON PRINT) */}
        {(pdfSuccessMsg || pdfErrorMsg) && (
          <div
            className={`no-print px-5 py-2.5 text-xs font-extrabold flex items-center gap-2 border-b ${
              pdfSuccessMsg
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{pdfSuccessMsg || pdfErrorMsg}</span>
          </div>
        )}

        {/* SCROLLABLE A4 SHEET STAGE */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 flex justify-center items-start bg-[#EDE9FE]/70 dark:bg-[#0B0918]">
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top center',
            }}
            className="print-sheet-only transition-transform duration-200 w-full max-w-[794px]"
          >
            {/* OFFICIAL A4 WHITE PAPER SHEET */}
            <div
              ref={sheetRef}
              dir="rtl"
              className="bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-300 p-6 sm:p-8 md:p-10 space-y-5 relative overflow-hidden"
            >
              {/* LETTERHEAD */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b-2 border-[#1E1B3A]">
                <div className="flex items-center gap-3">
                  {showOfficialStamp && (
                    <img
                      src="/karban-logo.png"
                      alt="لوگوی رسمی کاربان"
                      className="w-12 h-12 rounded-xl object-contain border border-slate-200 p-1 bg-white"
                    />
                  )}
                  <div>
                    <div className="text-base font-black text-[#1E1B3A]">
                      {documentData.kind === 'invoice'
                        ? 'صورتحساب الکترونیکی فروش کالا و خدمات (نوع اول — سامانه مودیان)'
                        : documentData.kind === 'tax_brief'
                        ? toFaDigits(documentData.title)
                        : toFaDigits(documentData.title)}
                    </div>
                    <div className="text-[11px] text-slate-600 mt-1 tabular-nums">
                      {documentData.kind === 'invoice' && (
                        <>
                          شناسه یکتای مالیاتی ۲۲ رقمی:{' '}
                          <strong className="text-slate-900">
                            {toFaDigits(documentData.invoice.moadianTaxId)}
                          </strong>
                        </>
                      )}
                      {documentData.kind === 'tax_brief' && (
                        <>مرجع رسیدگی: {toFaDigits(documentData.authority)}</>
                      )}
                      {documentData.kind === 'contract' && (
                        <>
                          {documentData.categoryLabel}
                          {documentData.referenceCode ? ` · شماره سند: ${toFaDigits(documentData.referenceCode)}` : ''}
                        </>
                      )}
                      {documentData.kind === 'letter' && (
                        <>مخاطب: {toFaDigits(documentData.targetOrg)}</>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-left text-xs tabular-nums space-y-1 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
                  {documentData.kind === 'invoice' && (
                    <>
                      <div>
                        شماره سریال: <strong>{toFaDigits(documentData.invoice.invoiceNumber)}</strong>
                      </div>
                      <div>
                        تاریخ صدور: <strong>{toFaDigits(documentData.invoice.dateJalali)}</strong>
                      </div>
                    </>
                  )}
                  {documentData.kind !== 'invoice' && (
                    <>
                      <div>
                        تاریخ شمسی: <strong>{toFaDigits(documentData.dateJalali)}</strong>
                      </div>
                      <div className="text-[11px] text-slate-500">تأیید ساختار حقوقی کاربان</div>
                    </>
                  )}
                </div>
              </div>

              {/* BODY PER DOCUMENT TYPE */}
              {documentData.kind === 'invoice' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 tabular-nums leading-6">
                    <div>
                      <div className="font-black text-[#1E1B3A] mb-1">مشخصات فروشنده:</div>
                      <div>شرکت راهکارهای هوشمند کاربان (سهامی خاص)</div>
                      <div>شناسه ملی: ۱۰۱۰۳۹۴۸۵۷۶ · کد اقتصادی: ۴۱۱۱۲۲۳۳۴۴۵۵</div>
                    </div>
                    <div>
                      <div className="font-black text-[#1E1B3A] mb-1">مشخصات خریدار / طرف‌حساب:</div>
                      <div>{documentData.invoice.partnerName}</div>
                      <div>
                        شناسه ملی: {toFaDigits(documentData.invoice.partnerNationalId)} · کد اقتصادی:{' '}
                        {toFaDigits(documentData.invoice.partnerEconomicCode)}
                      </div>
                    </div>
                  </div>

                  <table className="w-full border-collapse border border-slate-400 text-right tabular-nums text-[11px] sm:text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-[#1E1B3A]">
                        <th className="border border-slate-400 p-2.5">شناسه ۱۳ رقمی کالا/خدمت</th>
                        <th className="border border-slate-400 p-2.5">شرح کالا یا خدمت</th>
                        <th className="border border-slate-400 p-2.5">تعداد</th>
                        <th className="border border-slate-400 p-2.5">مبلغ واحد (ریال)</th>
                        <th className="border border-slate-400 p-2.5">ارزش افزوده</th>
                        <th className="border border-slate-400 p-2.5">جمع کل ردیف (ریال)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documentData.invoice.items.map((it) => {
                        const net = it.quantity * it.unitPriceRial - it.discountRial;
                        const vat = Math.round((net * it.vatRatePercent) / 100);
                        return (
                          <tr key={it.id}>
                            <td className="border border-slate-400 p-2.5 font-bold">
                              {toFaDigits(it.commodityCode)}
                            </td>
                            <td className="border border-slate-400 p-2.5 font-extrabold">{it.name}</td>
                            <td className="border border-slate-400 p-2.5">{formatFaNum(it.quantity)}</td>
                            <td className="border border-slate-400 p-2.5">{formatFaNum(it.unitPriceRial)}</td>
                            <td className="border border-slate-400 p-2.5">{formatFaNum(vat)}</td>
                            <td className="border border-slate-400 p-2.5 font-black">{formatFaNum(net + vat)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 bg-slate-100 rounded-xl border border-slate-300">
                    <div>
                      <strong>مبلغ قابل پرداخت به حروف:</strong>{' '}
                      {numberToPersianWords(documentData.invoice.grandTotalRial)}
                    </div>
                    <div className="text-sm font-black tabular-nums text-[#1E1B3A]">
                      جمع کل: {formatRial(documentData.invoice.grandTotalRial)}
                    </div>
                  </div>
                </div>
              )}

              {documentData.kind === 'tax_brief' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 tabular-nums">
                    <div>
                      <span className="text-slate-500">نام مودی / شرکت: </span>
                      <strong className="text-[#1E1B3A]">{documentData.taxpayerName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">مبلغ مورد اعتراض: </span>
                      <strong className="text-[#1E1B3A]">
                        {formatRial(documentData.amountRial)} ({formatToman(documentData.amountRial)})
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">مستندات قانونی: </span>
                      <strong className="text-violet-800">
                        {toFaDigits(documentData.citations.join(' · ') || 'مقررات قانون مالیات‌های مستقیم')}
                      </strong>
                    </div>
                  </div>

                  <div className="p-5 rounded-xl border border-slate-300 bg-white whitespace-pre-line leading-8 text-justify text-slate-800">
                    {toFaDigits(documentData.body)}
                  </div>

                  {documentData.strategicTip && (
                    <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/70 text-emerald-950 leading-6">
                      <strong>یادداشت استراتژیک جلسه دفاع: </strong>
                      {toFaDigits(documentData.strategicTip)}
                    </div>
                  )}
                </div>
              )}

              {documentData.kind === 'contract' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 tabular-nums leading-6">
                    <div>
                      <span className="text-slate-500">طرف اول (کارفرما / افشاکننده): </span>
                      <strong className="text-[#1E1B3A]">{documentData.employerName}</strong>
                      {documentData.employerId && (
                        <div className="text-[11px] text-slate-600">
                          شناسه / کد ملی: {toFaDigits(documentData.employerId)}
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-500">طرف دوم (همکار / پیمانکار): </span>
                      <strong className="text-[#1E1B3A]">{documentData.workerName}</strong>
                      {documentData.workerId && (
                        <div className="text-[11px] text-slate-600">
                          کد ملی: {toFaDigits(documentData.workerId)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-5 rounded-xl border border-slate-300 bg-white whitespace-pre-line leading-8 text-justify text-slate-800">
                    {toFaDigits(documentData.body)}
                  </div>

                  {typeof documentData.amountRial === 'number' && documentData.amountRial > 0 && (
                    <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-300 flex flex-wrap justify-between items-center gap-2 tabular-nums">
                      <span>مبلغ قرارداد به حروف: {numberToPersianWords(documentData.amountRial)}</span>
                      <strong>{formatRial(documentData.amountRial)}</strong>
                    </div>
                  )}
                </div>
              )}

              {documentData.kind === 'letter' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 leading-6">
                    <div>
                      <span className="text-slate-500">صادرکننده: </span>
                      <strong className="text-[#1E1B3A]">{documentData.employerName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">شخص ذینفع: </span>
                      <strong className="text-[#1E1B3A]">{documentData.employeeName}</strong>
                    </div>
                  </div>
                  <div className="p-6 rounded-xl border border-slate-300 bg-white whitespace-pre-line leading-8 text-justify text-slate-800">
                    {toFaDigits(documentData.body)}
                  </div>
                </div>
              )}

              {/* OFFICIAL STAMP & SIGNATURE FOOTER */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-5 border-t border-slate-300 text-xs">
                <div className="space-y-2">
                  <div className="font-extrabold text-[#1E1B3A]">
                    {documentData.kind === 'invoice'
                      ? 'مهر و امضای مجاز فروشنده:'
                      : documentData.kind === 'contract'
                      ? 'مهر و امضای طرف اول:'
                      : documentData.kind === 'tax_brief'
                      ? 'مهر و امضای مودی / نماینده قانونی:'
                      : 'مهر و امضای مدیریت صادرکننده:'}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 min-h-[76px]">
                    {showOfficialStamp && (
                      <div className="px-3 py-2 rounded-lg border-2 border-dashed border-violet-700 text-violet-900 font-bold text-[11px] -rotate-2 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-violet-700 shrink-0" />
                        <span>مهر رسمی کاربان · سند تأییدشده سامانه مودیان</span>
                      </div>
                    )}
                    {showDigitalSignature && signatureDataUrl ? (
                      <img
                        src={signatureDataUrl}
                        alt="امضای دیجیتال"
                        referrerPolicy="no-referrer"
                        className="h-16 object-contain"
                      />
                    ) : showDigitalSignature && onRequestSignaturePad ? (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onRequestSignaturePad();
                        }}
                        className="no-print text-violet-700 underline font-extrabold"
                      >
                        + افزودن امضای لمسی روی سند
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="font-extrabold text-[#1E1B3A]">
                    {documentData.kind === 'invoice'
                      ? 'مهر و امضای خریدار:'
                      : documentData.kind === 'contract'
                      ? 'امضا و اثر انگشت طرف دوم:'
                      : 'تأییدیه دبیرخانه / دریافت‌کننده:'}
                  </div>
                  <div className="h-[76px] border border-dashed border-slate-300 rounded-xl flex items-center justify-center text-slate-400">
                    محل امضا و مهر دریافت‌کننده سند
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(modalNode, document.body);
  }
  return modalNode;
};
