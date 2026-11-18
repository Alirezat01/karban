import React, { useState } from 'react';
import {
  Camera,
  Scale,
  Activity,
  MessageSquare,
  ShieldAlert,
  Sparkles,
  Mic,
  MicOff,
  CheckCircle2,
  Send,
  Crown,
  FileCheck2,
  RefreshCw,
  Printer,
  BookmarkCheck,
  QrCode,
} from 'lucide-react';
import {
  PlanType,
  isProPlan,
  getPlanInfo,
  OfficialInvoice,
  SayadiCheck,
  JournalEntry,
  VaultDocument,
  formatRial,
  formatToman,
  toFaDigits,
  formatFaNum,
  formatSayadiFa,
} from '../lib/karbanData';
import { FaNumberInput, JalaliDatePicker } from './ui/PersianInputs';
import { SayadiCheckQrScannerModal } from './SayadiCheckQrScannerModal';
import { PrintPreviewPdfModal } from './PrintPreviewPdfModal';
import scannerArt from '../assets/images/paperpillar_scanner_art_1794563328851.jpg';

interface AiProStudioViewProps {
  plan: PlanType;
  chatUsed: number;
  analyzeUsed: number;
  onIncrementUsage: (type: 'chat' | 'analyze') => boolean;
  onOpenUpgrade: (featureTitle?: string) => void;
  invoices: OfficialInvoice[];
  checks: SayadiCheck[];
  onAddInvoiceFromOcr: (inv: OfficialInvoice, jr: JournalEntry) => void;
  onAddCheckFromOcr: (chk: SayadiCheck, jr: JournalEntry) => void;
  onSaveToVault: (doc: VaultDocument) => void;
}

interface OcrResult {
  docType: string;
  title: string;
  partyName: string;
  nationalOrEcoId: string;
  dateJalali: string;
  totalAmountRial: number;
  vatAmountRial: number;
  sayadiId?: string;
  bankName?: string;
  sayadiStatusSummary?: string;
  suggestedDebitAccount: string;
  suggestedCreditAccount: string;
  items?: { description: string; quantity: number; unitPriceRial: number; totalRial: number }[];
}

interface TaxDefenseResult {
  briefTitle: string;
  legalCitations: string[];
  formalDefenseBody: string;
  winProbabilityPercent: number;
  requiredAttachments: string[];
  strategicTip: string;
}

interface CashflowRadarResult {
  liquidityStatus: string;
  projected30DayNetRial: number;
  riskAlerts: string[];
  actionableRecommendations: string[];
}

interface ContractAuditResult {
  safetyScore: number;
  overallSummary: string;
  riskyClauses: {
    clauseTitle: string;
    severity: string;
    riskExplanation: string;
    suggestedRewrite: string;
  }[];
  missingClauses: string[];
}

export const AiProStudioView: React.FC<AiProStudioViewProps> = ({
  plan,
  chatUsed,
  analyzeUsed,
  onIncrementUsage,
  onOpenUpgrade,
  invoices,
  checks,
  onAddInvoiceFromOcr,
  onAddCheckFromOcr,
  onSaveToVault,
}) => {
  const [activeTool, setActiveTool] = useState<'ocr' | 'defense' | 'radar' | 'contract_chat'>('ocr');
  const planInfo = getPlanInfo(plan);
  const proUnlocked = isProPlan(plan);

  // 1. OCR Scanner State
  const [scanMode, setScanMode] = useState<'check' | 'invoice'>('check');
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [selectedImageMime, setSelectedImageMime] = useState<string>('image/png');
  const [ocrHint, setOcrHint] = useState(
    'چک صیادی بنفش بانک ملت به شناسه صیادی ۱۴۰۵۶۶۷۷۸۸۹۹۰۰۱۱ به مبلغ ۶۵۰,۰۰۰,۰۰۰ ریال در وجه شرکت کاربان به تاریخ سررسید ۱۴۰۵/۰۹/۱۵ صادرکننده شرکت پارس گستر با شناسه ملی ۱۰۱۰۵۵۶۶۷۷۸'
  );
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [ocrSavedMsg, setOcrSavedMsg] = useState<string | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);

  // 2. Tax & Labor Defense Brief State
  const [defenseTopic] = useState('اعتراض به برگ تشخیص مالیات عملکرد و تراکنش‌های بانکی');
  const [defenseAuthority, setDefenseAuthority] = useState('هیئت حل اختلاف مالیاتی بدوی (ماده ۲۴۴ ق.م.م)');
  const [defenseTaxpayer, setDefenseTaxpayer] = useState('شرکت توسعه فناوری پارس سیستم');
  const [defenseDateJalali, setDefenseDateJalali] = useState('۱۴۰۵/۰۸/۱۰');
  const [defenseAmountRial, setDefenseAmountRial] = useState(1_850_000_000);
  const [defenseIssue, setDefenseIssue] = useState(
    'ممیز محترم مالیاتی واریزی‌های مربوط به جابه‌جایی بین دو حساب بانکی شرکت و دریافت وام بانکی مضاربه را به عنوان درآمد کتمان‌شده منظور نموده و جریمه عدم صدور صورتحساب سامانه مودیان لحاظ کرده است.'
  );
  const [defenseLoading, setDefenseLoading] = useState(false);
  const [defenseResult, setDefenseResult] = useState<TaxDefenseResult | null>(null);
  const [defenseError, setDefenseError] = useState<string | null>(null);
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [showDefensePrintModal, setShowDefensePrintModal] = useState(false);

  // 3. Cashflow Radar State
  const [radarLoading, setRadarLoading] = useState(false);
  const [radarResult, setRadarResult] = useState<CashflowRadarResult | null>(null);
  const [radarError, setRadarError] = useState<string | null>(null);

  // 4. Contract Audit & Legal Chat State
  const [contractSampleText, setContractSampleText] = useState(
    'ماده ۱: کارپذیر متعهد به طراحی نرم‌افزار طبق نظر کارفرما می‌باشد. ماده ۲: کارفرما هر زمان که بخواهد می‌تواند بدون پرداخت خسارت قرارداد را یک‌طرفه فسخ کند و کلیه سفته‌های حسن انجام کار به مبلغ ۵ میلیارد ریال در اختیار کارفرما باقی می‌ماند. ماده ۳: حق بیمه و مالیات به عهده کارپذیر است.'
  );
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditResult, setAuditResult] = useState<ContractAuditResult | null>(null);

  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant'; text: string }[]>([
    {
      role: 'assistant',
      text: 'سلام! من مشاور هوشمند حقوقی، مالیاتی و سامانه مودیان کاربان هستم. هر سؤالی درباره قوانین کار ۱۴۰۵، مالیات ارزش افزوده ۱۰٪، چک صیادی یا بیمه تأمین اجتماعی دارید بپرسید.',
    },
  ]);

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedImageMime(file.type || 'image/jpeg');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSelectedImagePreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRunOcr = async () => {
    if (!onIncrementUsage('analyze')) {
      onOpenUpgrade('اسکن هوشمند فاکتور و چک صیادی با دوربین');
      return;
    }
    setOcrLoading(true);
    setOcrError(null);
    setOcrSavedMsg(null);
    try {
      const res = await fetch('/api/ai/ocr-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: selectedImagePreview,
          mimeType: selectedImageMime,
          scanMode,
          manualHint: ocrHint,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'خطا در اسکن هوشمند');
      setOcrResult(data.result);
    } catch (err: unknown) {
      setOcrError(err instanceof Error ? err.message : 'خطا در ارتباط با سرور هوش مصنوعی');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleRegisterOcrToAccounting = () => {
    if (!ocrResult) return;
    const total = ocrResult.totalAmountRial || 650_000_000;
    const vat = ocrResult.vatAmountRial || Math.round(total * 0.0909);

    if (scanMode === 'check' || ocrResult.docType === 'check') {
      const cleanSayadi = toFaDigits(ocrResult.sayadiId || '۱۴۰۵۶۶۷۷۸۸۹۹۰۰۱۱').slice(0, 16).padEnd(16, '۰');
      const newChk: SayadiCheck = {
        id: `chk-ocr-${Date.now()}`,
        sayadiId: cleanSayadi,
        type: 'receivable',
        partyName: ocrResult.partyName || 'صادرکننده چک اسکن‌شده',
        nationalId: toFaDigits(ocrResult.nationalOrEcoId || '۱۰۱۰۵۵۶۶۷۷۸'),
        bankName: ocrResult.bankName || 'بانک ملت',
        dueDateJalali: toFaDigits(ocrResult.dateJalali || '۱۴۰۵/۰۹/۱۵'),
        amountRial: total,
        sayadiColor: 'white',
        status: 'in_flow',
        description: `ثبت خودکار از طریق اسکنر هوشمند دوربین — ${ocrResult.title || ''}`,
      };
      const newJr: JournalEntry = {
        id: `jr-ocr-${Date.now()}`,
        docNumber: 200 + Math.floor(Math.random() * 90),
        dateJalali: newChk.dueDateJalali,
        description: `سند خودکار اسکن چک صیادی ${formatSayadiFa(cleanSayadi)} — ${newChk.partyName}`,
        debitAccount: ocrResult.suggestedDebitAccount || '۱۰۴۰ - اسناد دریافتنی در جریان وصول (چک صیادی)',
        creditAccount: ocrResult.suggestedCreditAccount || '۱۰۳۰ - حساب‌ها و اسناد دریافتنی تجاری',
        amountRial: total,
        refType: 'ocr',
      };
      onAddCheckFromOcr(newChk, newJr);
      setOcrSavedMsg('چک صیادی ۱۶ رقمی و سند روزنامه متناظر با موفقیت در بخش حسابداری ثبت شدند.');
    } else {
      const newInv: OfficialInvoice = {
        id: `inv-ocr-${Date.now()}`,
        invoiceNumber: `۱۴۰۵/اسکن-${toFaDigits(invoices.length + 10)}`,
        moadianTaxId: toFaDigits(`140508100010556677${invoices.length + 10}`),
        type: 'purchase',
        dateJalali: toFaDigits(ocrResult.dateJalali || '۱۴۰۵/۰۸/۱۰'),
        partnerName: ocrResult.partyName || 'فروشنده فاکتور اسکن‌شده',
        partnerNationalId: toFaDigits(ocrResult.nationalOrEcoId || '۱۰۱۰۵۵۶۶۷۷۸'),
        partnerEconomicCode: toFaDigits(ocrResult.nationalOrEcoId || '۴۱۱۵۵۶۶۷۷۸۸۹'),
        partnerPostalCode: '۱۵۸۸۹۹۰۰۱۱',
        status: 'paid',
        items: [
          {
            id: 'ocr-it-1',
            commodityCode: '۲۹۰۱۲۳۴۵۶۷۸۹۰',
            name: ocrResult.title || 'اقلام استخراج‌شده از فاکتور کاغذی',
            quantity: 1,
            unitPriceRial: total - vat,
            discountRial: 0,
            vatRatePercent: 10,
          },
        ],
        subtotalRial: total - vat,
        discountTotalRial: 0,
        vatTotalRial: vat,
        grandTotalRial: total,
        notes: 'استخراج و ثبت خودکار توسط اسکنر اپتیکال کاربان.',
      };
      const newJr: JournalEntry = {
        id: `jr-ocr-${Date.now()}`,
        docNumber: 200 + Math.floor(Math.random() * 90),
        dateJalali: newInv.dateJalali,
        description: `سند خودکار اسکن فاکتور ${newInv.invoiceNumber} — ${newInv.partnerName}`,
        debitAccount: ocrResult.suggestedDebitAccount || '۵۰۱۰ - بهای تمام‌شده خرید و هزینه',
        creditAccount: ocrResult.suggestedCreditAccount || '۱۰۱۰ - موجودی بانک و نقد',
        amountRial: total,
        refType: 'ocr',
      };
      onAddInvoiceFromOcr(newInv, newJr);
      setOcrSavedMsg('فاکتور اسکن‌شده و سند حسابداری دوطرفه با موفقیت در دفاتر ثبت شدند.');
    }
  };

  const toggleVoiceDictation = () => {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setDefenseIssue((prev) => prev + ' [دیکته صوتی فارسی فعال شد]');
      return;
    }
    if (isListeningVoice) {
      setIsListeningVoice(false);
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recognition = new (SpeechRecognition as any)();
      recognition.lang = 'fa-IR';
      recognition.continuous = false;
      setIsListeningVoice(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setDefenseIssue((prev) => `${prev ? prev + ' ' : ''}${transcript}`);
        }
        setIsListeningVoice(false);
      };
      recognition.onerror = () => setIsListeningVoice(false);
      recognition.onend = () => setIsListeningVoice(false);
      recognition.start();
    } catch {
      setIsListeningVoice(false);
    }
  };

  const handleGenerateDefenseBrief = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onIncrementUsage('analyze')) {
      onOpenUpgrade('تولید خودکار لایحه دفاعیه مالیاتی و اداره کار');
      return;
    }
    setDefenseLoading(true);
    setDefenseError(null);
    try {
      const res = await fetch('/api/ai/tax-defense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicType: defenseTopic,
          targetAuthority: defenseAuthority,
          taxpayerName: defenseTaxpayer,
          fiscalYear: defenseDateJalali,
          claimedAmountRial: defenseAmountRial,
          issueDescription: defenseIssue,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'خطا در تولید لایحه');
      setDefenseResult(data.result);
    } catch (err: unknown) {
      setDefenseError(err instanceof Error ? err.message : 'خطا در تولید لایحه دفاعیه');
    } finally {
      setDefenseLoading(false);
    }
  };

  const handleRunCashflowRadar = async () => {
    if (!onIncrementUsage('analyze')) {
      onOpenUpgrade('رادار پیش‌بینی نقدینگی و هشدار کسری چک و مالیات');
      return;
    }
    setRadarLoading(true);
    setRadarError(null);
    try {
      const snapshot = {
        totalInvoicesCount: invoices.length,
        salesTotalRial: invoices.filter((i) => i.type === 'sale').reduce((s, i) => s + i.grandTotalRial, 0),
        purchasesTotalRial: invoices.filter((i) => i.type === 'purchase').reduce((s, i) => s + i.grandTotalRial, 0),
        activeChecks: checks.map((c) => ({
          type: c.type,
          amountRial: c.amountRial,
          dueDate: c.dueDateJalali,
          sayadiColor: c.sayadiColor,
          party: c.partyName,
        })),
      };
      const res = await fetch('/api/ai/cashflow-radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ financialSnapshot: snapshot }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'خطا در تحلیل رادار نقدینگی');
      setRadarResult(data.result);
    } catch (err: unknown) {
      setRadarError(err instanceof Error ? err.message : 'خطا در اجرای رادار نقدینگی');
    } finally {
      setRadarLoading(false);
    }
  };

  const handleRunContractAudit = async () => {
    if (!onIncrementUsage('analyze')) {
      onOpenUpgrade('تحلیل‌گر هوشمند ریسک قرارداد');
      return;
    }
    setAuditLoading(true);
    try {
      const res = await fetch('/api/ai/contract-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractText: contractSampleText,
          userRole: 'کارپذیر / پیمانکار',
        }),
      });
      const data = await res.json();
      if (data.ok) setAuditResult(data.result);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    if (!onIncrementUsage('chat')) {
      onOpenUpgrade('مشاور هوشمند حقوقی و مالیاتی (افزایش سقف روزانه)');
      return;
    }
    const userMsg = chatInput.trim();
    setChatInput('');
    const nextHistory = [...chatHistory, { role: 'user' as const, text: userMsg }];
    setChatHistory(nextHistory);
    setChatLoading(true);
    try {
      const res = await fetch('/api/ai/legal-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, history: nextHistory.slice(-6) }),
      });
      const data = await res.json();
      setChatHistory((prev) => [
        ...prev,
        { role: 'assistant', text: data.reply || data.error || 'پاسخی دریافت نشد.' },
      ]);
    } catch {
      setChatHistory((prev) => [
        ...prev,
        { role: 'assistant', text: 'خطا در ارتباط با سرور مشاور هوشمند.' },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* AI Quota & Pro Status Header */}
      <div className="crisp-card p-4 rounded-[26px] flex flex-col justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#1D4DF5] dark:text-[#608BFF]" />
            <h1 className="text-base font-black text-[#0F172A] dark:text-white">
              استودیو هوش مصنوعی موبایل‌پرو کاربان
            </h1>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            اسکن اپتیکال فاکتور و چک صیادی با دوربین، نگارش لایحه دفاعیه مالیاتی و تحلیل قرارداد
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3.5 py-2 rounded-full bg-[#EFF1FA] dark:bg-[#1A223B] text-[11px] tabular-nums">
            <span className="text-slate-500 dark:text-slate-400">سهمیه امروز ({planInfo.shortLabel}): </span>
            <strong className="text-[#1D4DF5] dark:text-[#608BFF]">
              {planInfo.analyzeLimit === -1
                ? 'تحلیل نامحدود (∞)'
                : `${formatFaNum(Math.max(0, planInfo.analyzeLimit - analyzeUsed))} تحلیل`}
            </strong>
            <span className="mx-1.5">·</span>
            <strong className="text-emerald-600 dark:text-emerald-400">
              {planInfo.chatLimit === -1
                ? 'چت نامحدود (∞)'
                : `${formatFaNum(Math.max(0, planInfo.chatLimit - chatUsed))} پرسش`}
            </strong>
          </div>
          {!proUnlocked && (
            <button
              onClick={() => onOpenUpgrade('بسته کامل هوش مصنوعی موبایل‌پرو')}
              className="cobalt-pill-btn min-h-[40px] px-4 py-2 text-xs font-black flex items-center gap-1.5"
            >
              <Crown className="w-4 h-4" />
              <span>ارتقا به سقف پیشرفته</span>
            </button>
          )}
        </div>
      </div>

      {/* Tool Selector Square-Tile Cards */}
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { id: 'ocr', title: '۱. اسکنر چک و فاکتور', sub: 'استخراج ۱۶ رقم صیاد', icon: Camera },
          { id: 'defense', title: '۲. لایحه‌نگار مالیاتی', sub: 'ماده ۲۴۴ و اداره کار', icon: Scale },
          { id: 'radar', title: '۳. رادار نقدینگی', sub: 'پیش‌بینی ۳۰ روزه چک', icon: Activity },
          { id: 'contract_chat', title: '۴. تحلیل قرارداد و چت', sub: 'کالبدشکافی ریسک', icon: MessageSquare },
        ].map((item) => {
          const Icon = item.icon;
          const active = activeTool === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTool(item.id as typeof activeTool)}
              className={`p-3.5 rounded-[22px] border text-right transition-all flex items-start gap-2.5 ${
                active
                  ? 'border-[#1D4DF5] bg-[#EEF2FF] dark:bg-[#1D2B57] shadow-sm'
                  : 'crisp-card hover:border-[#1D4DF5]/40'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  active
                    ? 'bg-[#1D4DF5] text-white shadow-sm shadow-blue-600/30'
                    : 'bg-[#EFF1FA] dark:bg-[#1A223B] text-[#1D4DF5] dark:text-[#608BFF]'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black text-[#0F172A] dark:text-white truncate">
                  {item.title}
                </div>
                <div className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {item.sub}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* TOOL 1: SMART OCR & QR CAMERA SCANNER */}
      {activeTool === 'ocr' && (
        <div className="grid grid-cols-1 gap-4">
          <div className="paper-card p-4 rounded-[28px] space-y-4">
            {/* Live Sayadi QR Camera Scanner Banner with Bespoke Paperpillar Illustration */}
            <div className="p-4 rounded-[26px] bg-gradient-to-br from-[#EDE9FE] via-[#F5F3FF] to-[#ECFDF5] dark:from-[#211D3F] dark:via-[#1B1736] dark:to-[#17252B] border border-slate-200/80 dark:border-slate-700/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3.5">
                <div className="w-16 h-14 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700/50 bg-[#EFF1FA] shrink-0">
                  <img
                    src={scannerArt}
                    alt="اسکن هوشمند چک صیادی و فاکتور"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <h3 className="font-black text-[#0F172A] dark:text-white">
                      اسکنر زنده بارکد QR چک صیادی
                    </h3>
                    <span className="text-[11px] text-[#1D4DF5] dark:text-[#789BFF] font-bold">
                      · سامانه صیاد
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                    استخراج آنی شناسه ۱۶ رقمی، نام بانک، مبلغ و تاریخ سررسید از دوربین
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsQrScannerOpen(true)}
                className="w-full sm:w-auto min-h-[42px] px-4 py-2.5 rounded-2xl bg-[#1D4DF5] hover:bg-[#163ED4] dark:bg-[#3B6BFF] dark:hover:bg-amber-300 text-white dark:text-white font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-950/15 transition-all shrink-0 cursor-pointer whitespace-nowrap"
              >
                <QrCode className="w-4 h-4" />
                <span>اسکن با دوربین</span>
              </button>
            </div>

            <div className="flex items-center justify-between pt-1">
              <h2 className="text-sm font-black text-[#0F172A] dark:text-white flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#1D4DF5] dark:text-[#608BFF]" />
                <span>یا اسکن تصویر اپتیکال برگه چک / فاکتور</span>
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setScanMode('check');
                  setOcrHint(
                    'چک صیادی بنفش بانک ملت به شناسه صیادی ۱۴۰۵۶۶۷۷۸۸۹۹۰۰۱۱ به مبلغ ۶۵۰,۰۰۰,۰۰۰ ریال در وجه شرکت کاربان به تاریخ سررسید ۱۴۰۵/۰۹/۱۵ صادرکننده شرکت پارس گستر با شناسه ملی ۱۰۱۰۵۵۶۶۷۷۸'
                  );
                }}
                className={`min-h-[42px] rounded-2xl text-xs font-extrabold border transition-colors ${
                  scanMode === 'check'
                    ? 'border-[#1D4DF5] bg-[#EFF1FA]0/15 text-[#1D4DF5] dark:border-amber-400 dark:bg-[#1D4DF5]/20 dark:text-[#608BFF]'
                    : 'border-slate-200/80 dark:border-slate-700/60 text-slate-500 dark:text-slate-400'
                }`}
              >
                اسکن برگه چک صیادی ۱۶ رقمی
              </button>
              <button
                type="button"
                onClick={() => {
                  setScanMode('invoice');
                  setOcrHint(
                    'فاکتور رسمی خرید تجهیزات شبکه از فروشگاه دیجیتال پرداز به شناسه اقتصادی ۴۱۱۷۷۸۸۹۹۰۰۱ در تاریخ ۱۴۰۵/۰۸/۱۰ به مبلغ کل ۴۴۰,۰۰۰,۰۰۰ ریال شامل ۴۰,۰۰۰,۰۰۰ ریال ارزش افزوده ۱۰ درصد'
                  );
                }}
                className={`min-h-[42px] rounded-2xl text-xs font-extrabold border transition-colors ${
                  scanMode === 'invoice'
                    ? 'border-[#1D4DF5] bg-[#EFF1FA]0/15 text-[#1D4DF5] dark:border-amber-400 dark:bg-[#1D4DF5]/20 dark:text-[#608BFF]'
                    : 'border-slate-200/80 dark:border-slate-700/60 text-slate-500 dark:text-slate-400'
                }`}
              >
                اسکن فاکتور خرید / رسید هزینه
              </button>
            </div>

            <div className="p-5 rounded-3xl border-2 border-dashed border-blue-200/80 dark:border-slate-700/60 bg-[#F4F6FD] dark:bg-[#18213D] text-center space-y-3">
              {selectedImagePreview ? (
                <div className="space-y-2">
                  <img
                    src={selectedImagePreview}
                    alt="پیش‌نمایش سند اسکن‌شده"
                    referrerPolicy="no-referrer"
                    className="max-h-44 mx-auto rounded-2xl object-contain border border-slate-200 dark:border-violet-700"
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedImagePreview(null)}
                    className="text-xs text-rose-500 underline font-bold"
                  >
                    حذف تصویر و انتخاب مجدد
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer block py-4 space-y-2">
                  <div className="w-14 h-14 rounded-2xl bg-[#EEF2FF] dark:bg-amber-500/15 text-[#1D4DF5] dark:text-[#608BFF] flex items-center justify-center mx-auto">
                    <Camera className="w-7 h-7" />
                  </div>
                  <div className="text-xs font-extrabold text-[#0F172A] dark:text-white">
                    باز کردن دوربین موبایل یا انتخاب تصویر چک/فاکتور
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    پشتیبانی از عکس مستقیم دوربین موبایل یا اجرای نمونه آماده زیر
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageFileSelect}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-300 mb-1.5">
                متن خوانش اپتیکال / توضیحات کمکی سند (با ارقام فارسی):
              </label>
              <textarea
                rows={3}
                value={ocrHint}
                onChange={(e) => setOcrHint(toFaDigits(e.target.value))}
                className="w-full p-3.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-medium text-[#0F172A] dark:text-white leading-relaxed"
              />
            </div>

            {ocrError && <p className="text-xs text-rose-500 font-bold">{ocrError}</p>}

            <button
              type="button"
              onClick={handleRunOcr}
              disabled={ocrLoading}
              className="w-full min-h-[48px] rounded-2xl bg-[#1D4DF5] hover:bg-[#163ED4] text-white font-black text-xs md:text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-950/15"
            >
              <RefreshCw className={`w-4 h-4 ${ocrLoading ? 'animate-spin' : ''}`} />
              <span>
                {ocrLoading
                  ? 'در حال استخراج فیلدها با هوش مصنوعی کاربان...'
                  : 'استخراج هوشمند اطلاعات و پیشنهاد سند حسابداری'}
              </span>
            </button>
          </div>

          <div className="paper-card p-4 rounded-[28px] space-y-4">
            <h3 className="text-base font-black text-[#0F172A] dark:text-white">
              خروجی ساخت‌یافته هوش مصنوعی و ثبت در دفاتر
            </h3>
            {ocrResult ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-[#EFF1FA] dark:bg-[#18213D] border border-slate-200/75 dark:border-slate-700/50 space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">عنوان تشخیص‌داده‌شده:</span>
                    <strong className="text-[#0F172A] dark:text-white">{toFaDigits(ocrResult.title)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">طرف‌حساب / صادرکننده:</span>
                    <strong className="text-[#0F172A] dark:text-white">{ocrResult.partyName}</strong>
                  </div>
                  <div className="flex justify-between tabular-nums">
                    <span className="text-slate-500 dark:text-slate-400">شناسه ملی / اقتصادی:</span>
                    <strong className="text-[#0F172A] dark:text-white">{toFaDigits(ocrResult.nationalOrEcoId)}</strong>
                  </div>
                  {ocrResult.sayadiId && (
                    <div className="flex justify-between tabular-nums">
                      <span className="text-slate-500 dark:text-slate-400">شناسه ۱۶ رقمی صیادی:</span>
                      <strong className="text-[#1D4DF5] dark:text-[#608BFF]">
                        {formatSayadiFa(ocrResult.sayadiId)}
                      </strong>
                    </div>
                  )}
                  <div className="flex justify-between tabular-nums">
                    <span className="text-slate-500 dark:text-slate-400">تاریخ سند / سررسید شمسی:</span>
                    <strong className="text-[#0F172A] dark:text-white">{toFaDigits(ocrResult.dateJalali)}</strong>
                  </div>
                  <div className="flex justify-between tabular-nums pt-2.5 border-t border-slate-200/75 dark:border-slate-700/50">
                    <span className="text-slate-500 dark:text-slate-400 font-bold">مبلغ کل استخراج‌شده:</span>
                    <strong className="text-base font-black text-emerald-600 dark:text-emerald-400">
                      {formatRial(ocrResult.totalAmountRial)} ({formatToman(ocrResult.totalAmountRial)})
                    </strong>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#FFFBEB] dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-xs space-y-1">
                  <div className="font-extrabold text-amber-700 dark:text-[#608BFF]">
                    پیشنهاد قید دوطرفه دفتر روزنامه:
                  </div>
                  <div>بدهکار: {toFaDigits(ocrResult.suggestedDebitAccount)}</div>
                  <div>بستانکار: {toFaDigits(ocrResult.suggestedCreditAccount)}</div>
                </div>

                {ocrSavedMsg ? (
                  <div className="p-4 rounded-2xl bg-[#ECFDF5] dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-extrabold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{ocrSavedMsg}</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleRegisterOcrToAccounting}
                    className="w-full min-h-[48px] rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    <FileCheck2 className="w-4 h-4" />
                    <span>ثبت خودکار در دفاتر حسابداری و لیست چک‌های صیادی</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {ocrSavedMsg && (
                  <div className="p-4 rounded-2xl bg-[#ECFDF5] dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-extrabold flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span>{ocrSavedMsg}</span>
                  </div>
                )}
                <div className="p-8 text-center border border-dashed border-blue-200/80 dark:border-slate-700/60 rounded-3xl space-y-3 bg-[#F4F6FD] dark:bg-[#18213D]/60">
                  <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] dark:bg-amber-500/15 text-[#1D4DF5] dark:text-[#608BFF] flex items-center justify-center mx-auto shadow-inner">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-black text-[#0F172A] dark:text-white">
                    اسکنر بارکد صیادی و OCR اسناد آماده است
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                    با باز کردن دوربین، بارکد دوبعدی QR چک‌های صیادی بنفش بانک مرکزی به‌صورت بی‌درنگ پردازش شده و فیلدهای شناسه، مبلغ و تاریخ مستقیماً در دفاتر کاربان ثبت می‌گردند.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsQrScannerOpen(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-violet-700 hover:bg-[#1D4DF5] text-white font-black text-xs shadow-lg shadow-violet-600/20 transition-all cursor-pointer"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>شروع اسکن زنده بارکد چک صیادی</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TOOL 2: AUTOMATIC TAX & LABOR DEFENSE BRIEF GENERATOR */}
      {activeTool === 'defense' && (
        <div className="grid grid-cols-1 gap-4">
          <form
            onSubmit={handleGenerateDefenseBrief}
            className="paper-card p-4 rounded-[28px] space-y-4"
          >
            <h2 className="text-base font-black text-[#0F172A] dark:text-white flex items-center gap-2">
              <Scale className="w-5 h-5 text-[#1D4DF5] dark:text-[#608BFF]" />
              <span>تولیدکننده خودکار لایحه دفاعیه مالیاتی و اداره کار</span>
            </h2>
            <div>
              <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-300 mb-1.5">
                مرجع رسیدگی قانونی
              </label>
              <select
                value={defenseAuthority}
                onChange={(e) => setDefenseAuthority(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold text-[#0F172A] dark:text-white"
              >
                <option value="هیئت حل اختلاف مالیاتی بدوی (ماده ۲۴۴ ق.م.م)">
                  هیئت حل اختلاف مالیاتی بدوی (ماده ۲۴۴ ق.م.م)
                </option>
                <option value="هیئت حل اختلاف مالیاتی تجدیدنظر (ماده ۲۴۷)">
                  هیئت حل اختلاف مالیاتی تجدیدنظر (ماده ۲۴۷)
                </option>
                <option value="شورای عالی مالیاتی و هیئت ماده ۲۵۱ مکرر">
                  شورای عالی مالیاتی و هیئت ماده ۲۵۱ مکرر
                </option>
                <option value="بخشودگی جرایم سامانه مودیان و ماده ۱۶۹">
                  بخشودگی جرایم سامانه مودیان و ماده ۱۶۹
                </option>
                <option value="هیئت تشخیص و حل اختلاف اداره تعاون، کار و رفاه اجتماعی">
                  هیئت تشخیص و حل اختلاف اداره کار
                </option>
              </select>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-300 mb-1.5">
                  نام مودی / شرکت
                </label>
                <input
                  type="text"
                  value={defenseTaxpayer}
                  onChange={(e) => setDefenseTaxpayer(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold text-[#0F172A] dark:text-white"
                />
              </div>
              <JalaliDatePicker
                label="تاریخ تنظیم لایحه (شمسی)"
                value={defenseDateJalali}
                onChange={setDefenseDateJalali}
              />
            </div>

            <FaNumberInput
              label="مبلغ مورد اعتراض در برگ تشخیص (ریال)"
              value={defenseAmountRial}
              onChange={setDefenseAmountRial}
              showTomanHint
            />

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-[#0F172A] dark:text-slate-300">
                  شرح برگ تشخیص یا ادعای مطرح‌شده (متنی یا صوتی)
                </label>
                <button
                  type="button"
                  onClick={toggleVoiceDictation}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 ${
                    isListeningVoice
                      ? 'bg-rose-500 text-white'
                      : 'bg-[#EEF2FF] dark:bg-amber-500/15 text-[#1D4DF5] dark:text-[#608BFF]'
                  }`}
                >
                  {isListeningVoice ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  <span>{isListeningVoice ? 'در حال شنیدن...' : 'تایپ صوتی فارسی'}</span>
                </button>
              </div>
              <textarea
                rows={4}
                required
                value={defenseIssue}
                onChange={(e) => setDefenseIssue(toFaDigits(e.target.value))}
                className="w-full p-3.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs text-[#0F172A] dark:text-white leading-relaxed"
              />
            </div>
            {defenseError && <p className="text-xs text-rose-500 font-bold">{defenseError}</p>}
            <button
              type="submit"
              disabled={defenseLoading}
              className="w-full min-h-[48px] rounded-2xl bg-[#1D4DF5] hover:bg-[#163ED4] text-white font-black text-xs md:text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-950/15"
            >
              <Scale className="w-4 h-4" />
              <span>
                {defenseLoading ? 'در حال نگارش حقوقی و استناد به مواد قانونی...' : 'تولید لایحه دفاعیه رسمی و مستند'}
              </span>
            </button>
          </form>

          <div className="paper-card p-4 rounded-[28px] space-y-4">
            {defenseResult ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/75 dark:border-slate-700/50">
                  <h3 className="text-sm md:text-base font-black text-[#0F172A] dark:text-white">
                    {toFaDigits(defenseResult.briefTitle)}
                  </h3>
                  <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    برآورد شانس پذیرش در هیئت: {formatFaNum(defenseResult.winProbabilityPercent)}٪
                  </span>
                </div>

                <div className="text-xs text-[#1D4DF5] dark:text-[#608BFF] font-bold">
                  مستندات قانونی: {toFaDigits(defenseResult.legalCitations?.join(' · '))}
                </div>

                <div className="p-4 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/75 dark:border-slate-700/50 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-line leading-7 max-h-80 overflow-y-auto">
                  {toFaDigits(defenseResult.formalDefenseBody)}
                </div>

                <div className="p-4 rounded-2xl bg-[#ECFDF5] dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-xs space-y-1">
                  <div className="font-extrabold text-emerald-700 dark:text-emerald-400">
                    نکته استراتژیک برای جلسه دفاع حضوری:
                  </div>
                  <p className="text-slate-700 dark:text-slate-300">{toFaDigits(defenseResult.strategicTip)}</p>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowDefensePrintModal(true)}
                    className="min-h-[42px] px-4 py-2 rounded-2xl bg-[#1D4DF5] hover:bg-[#163ED4] dark:bg-violet-800 dark:hover:bg-[#163ED4] text-white text-xs font-extrabold flex items-center gap-2 transition-colors"
                  >
                    <Printer className="w-4 h-4 text-amber-400" />
                    <span>پیش‌نمایش چاپ و دانلود PDF لایحه</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onSaveToVault({
                        id: `vlt-def-${Date.now()}`,
                        title: toFaDigits(defenseResult.briefTitle),
                        category: 'لایحه مالیاتی',
                        dateJalali: defenseDateJalali,
                        referenceCode: `سند-${toFaDigits(Math.floor(1000 + Math.random() * 9000))}`,
                        status: 'آماده ارائه به هیئت',
                        contentPreview: toFaDigits(defenseResult.formalDefenseBody),
                      })
                    }
                    className="min-h-[42px] px-4 py-2 rounded-2xl bg-[#1D4DF5] hover:bg-[#163ED4] text-white text-xs font-black flex items-center gap-2"
                  >
                    <BookmarkCheck className="w-4 h-4" />
                    <span>ذخیره در گاوصندوق اسناد</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-blue-200/70 dark:border-slate-700/60 rounded-3xl leading-6 bg-[#F4F6FD] dark:bg-[#18213D]/40">
                مشخصات برگ تشخیص یا پرونده را در فرم سمت راست وارد و دکمه «تولید لایحه دفاعیه رسمی» را لمس کنید تا متن کامل حقوقی آماده ارائه به هیئت تولید شود.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TOOL 3: PREDICTIVE CASHFLOW & DEFICIT RADAR */}
      {activeTool === 'radar' && (
        <div className="paper-card p-6 rounded-[32px] space-y-5">
          <div className="flex flex-col justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-[#0F172A] dark:text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#1D4DF5] dark:text-[#608BFF]" />
                <span>رادار هوش مصنوعی جریان نقدینگی، سررسید چک‌ها و مالیات</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                پایش زنده {formatFaNum(invoices.length)} فاکتور رسمی و {formatFaNum(checks.length)} فقره چک صیادی ثبت‌شده در حساب شما
              </p>
            </div>
            <button
              type="button"
              onClick={handleRunCashflowRadar}
              disabled={radarLoading}
              className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-[#1D4DF5] hover:bg-[#163ED4] text-white font-black text-xs flex items-center gap-2 transition-colors shadow-lg shadow-indigo-950/15"
            >
              <RefreshCw className={`w-4 h-4 ${radarLoading ? 'animate-spin' : ''}`} />
              <span>{radarLoading ? 'در حال اجرای شبیه‌سازی ۳۰ روزه...' : 'اجرای تحلیل هوشمند نقدینگی ۳۰ روز آینده'}</span>
            </button>
          </div>

          {radarError && <p className="text-xs text-rose-500 font-bold">{radarError}</p>}

          {radarResult ? (
            <div className="grid grid-cols-1 gap-3">
              <div className="p-5 rounded-2xl bg-[#EFF1FA] dark:bg-[#18213D] border border-slate-200/75 dark:border-slate-700/50 space-y-2">
                <div className="text-xs text-slate-500 dark:text-slate-400">وضعیت کلی نقدینگی ۳۰ روز آینده</div>
                <div className="text-base font-black text-emerald-600 dark:text-emerald-400">
                  {toFaDigits(radarResult.liquidityStatus)}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 pt-2">تراز خالص پیش‌بینی‌شده:</div>
                <div className="text-lg font-black text-[#0F172A] dark:text-white tabular-nums">
                  {formatToman(radarResult.projected30DayNetRial)}
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-[#FFFBEB] dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 space-y-2">
                <div className="text-xs font-extrabold text-amber-700 dark:text-[#608BFF] flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" />
                  <span>هشدارهای ریسک چک و مالیات</span>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                  {radarResult.riskAlerts?.map((al, i) => (
                    <li key={i}>• {toFaDigits(al)}</li>
                  ))}
                </ul>
              </div>

              <div className="p-5 rounded-2xl bg-[#ECFDF5] dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 space-y-2">
                <div className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
                  پیشنهادهای عملیاتی مدیر مالی هوشمند
                </div>
                <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                  {radarResult.actionableRecommendations?.map((rec, i) => (
                    <li key={i}>• {toFaDigits(rec)}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/75 dark:border-slate-700/50 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              با کلیک روی دکمه بالا، هوش مصنوعی کاربان تمامی چک‌های در جریان (شامل چک‌های وضعیت زرد صیادی)، سررسیدهای پرداختنی و بدهی ارزش افزوده فصل جاری را تحلیل کرده و ریسک کسری نقدینگی را پیش‌بینی می‌کند.
            </div>
          )}
        </div>
      )}

      {/* TOOL 4: CONTRACT RISK AUDIT & LEGAL CHATBOT */}
      {activeTool === 'contract_chat' && (
        <div className="grid grid-cols-1 gap-4">
          <div className="paper-card p-4 rounded-[28px] space-y-4">
            <h2 className="text-base font-black text-[#0F172A] dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[#1D4DF5] dark:text-[#608BFF]" />
              <span>کالبدشکافی و تحلیل ریسک بندهای قرارداد</span>
            </h2>
            <textarea
              rows={4}
              value={contractSampleText}
              onChange={(e) => setContractSampleText(toFaDigits(e.target.value))}
              placeholder="متن قرارداد یا بندهای مورد نظر را اینجا جای‌گذاری کنید..."
              className="w-full p-3.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs text-[#0F172A] dark:text-white leading-relaxed"
            />
            <button
              type="button"
              onClick={handleRunContractAudit}
              disabled={auditLoading}
              className="w-full min-h-[46px] rounded-2xl bg-[#1D4DF5] hover:bg-[#163ED4] text-white font-black text-xs transition-colors"
            >
              {auditLoading ? 'در حال شناسایی تله‌های حقوقی قرارداد...' : 'تحلیل هوشمند ریسک و پیشنهاد اصلاح بندها'}
            </button>

            {auditResult && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs font-extrabold">
                  <span>امتیاز ایمنی حقوقی قرارداد:</span>
                  <span className="text-[#1D4DF5] dark:text-[#608BFF] tabular-nums">{formatFaNum(auditResult.safetyScore)} از ۱۰۰</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">{toFaDigits(auditResult.overallSummary)}</p>
                {auditResult.riskyClauses?.map((rc, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs space-y-1"
                  >
                    <div className="font-extrabold text-rose-600 dark:text-rose-400">{toFaDigits(rc.clauseTitle)}</div>
                    <div className="text-slate-700 dark:text-slate-300">{toFaDigits(rc.riskExplanation)}</div>
                    <div className="text-emerald-600 dark:text-emerald-400 font-bold pt-1">
                      نگارش ایمن پیشنهادی: {toFaDigits(rc.suggestedRewrite)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="paper-card p-4 rounded-[28px] flex flex-col h-[420px]">
            <h2 className="text-base font-black text-[#0F172A] dark:text-white flex items-center gap-2 pb-3 border-b border-slate-200/75 dark:border-slate-700/50">
              <MessageSquare className="w-5 h-5 text-emerald-500" />
              <span>مشاور آنلاین حقوقی، مالیاتی و بیمه کاربان</span>
            </h2>
            <div className="flex-1 overflow-y-auto py-3 space-y-3">
              {chatHistory.map((m, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-2xl text-xs leading-relaxed max-w-[88%] ${
                    m.role === 'user'
                      ? 'bg-[#1D4DF5] text-white font-bold mr-auto'
                      : 'bg-[#EFF1FA] dark:bg-[#18213D] text-[#0F172A] dark:text-slate-200 ml-auto border border-slate-200/75 dark:border-slate-700/50'
                  }`}
                >
                  {toFaDigits(m.text)}
                </div>
              ))}
              {chatLoading && (
                <div className="text-xs text-slate-400 animate-pulse">مشاور کاربان در حال نگارش پاسخ مستند...</div>
              )}
            </div>
            <form onSubmit={handleSendChat} className="flex items-center gap-2 pt-3 border-t border-slate-200/75 dark:border-slate-700/50">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="سؤال حقوقی یا مالیاتی خود را بپرسید..."
                className="flex-1 px-3.5 py-2.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold text-[#0F172A] dark:text-white"
              />
              <button
                type="submit"
                disabled={chatLoading}
                className="min-h-[42px] px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                <span>ارسال</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Sayadi Check Physical QR Scanner Modal */}
      <SayadiCheckQrScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        onRegisterCheck={(chk, jr) => {
          onAddCheckFromOcr(chk, jr);
          setOcrSavedMsg(
            `چک صیادی ۱۶ رقمی به شناسه ${chk.sayadiId} (${chk.bankName}) با موفقیت ثبت و سند حسابداری دوطرفه صادر گردید.`
          );
        }}
      />

      <PrintPreviewPdfModal
        documentData={
          showDefensePrintModal && defenseResult
            ? {
                kind: 'tax_brief',
                title: defenseResult.briefTitle,
                authority: defenseAuthority,
                taxpayerName: defenseTaxpayer,
                dateJalali: defenseDateJalali,
                amountRial: defenseAmountRial,
                citations: defenseResult.legalCitations || [],
                body: defenseResult.formalDefenseBody,
                strategicTip: defenseResult.strategicTip,
              }
            : null
        }
        onClose={() => setShowDefensePrintModal(false)}
      />
    </div>
  );
};
