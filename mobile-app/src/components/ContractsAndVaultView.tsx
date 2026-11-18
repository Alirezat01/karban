import React, { useRef, useState, useEffect } from 'react';
import {
  FileSignature,
  PenTool,
  FolderLock,
  FileText,
  Printer,
  Share2,
  Trash2,
  CheckCircle2,
  BookmarkPlus,
  FileDown,
  Loader2,
} from 'lucide-react';
import {
  VaultDocument,
  PlanType,
  isProPlan,
  formatRial,
  formatToman,
  numberToPersianWords,
  toFaDigits,
  formatFaNum,
  CONTRACT_TYPES_ALL,
  INDUSTRIES_ALL,
} from '../lib/karbanData';
import {
  FaNumberInput,
  FaDigitsInput,
  JalaliDatePicker,
} from './ui/PersianInputs';
import { PrintPreviewPdfModal, PrintDocumentPayload } from './PrintPreviewPdfModal';
import { exportA4DocumentToPdf, ExportA4PdfOptions } from '../lib/pdfExport';

interface ContractsAndVaultViewProps {
  plan: PlanType;
  onOpenUpgrade: (featureTitle?: string) => void;
  signatureDataUrl: string | null;
  onSaveSignature: (dataUrl: string | null) => void;
  vaultDocs: VaultDocument[];
  onAddVaultDoc: (doc: VaultDocument) => void;
  initialSubTab?: 'builder' | 'signpad' | 'letters' | 'vault';
}

export const ContractsAndVaultView: React.FC<ContractsAndVaultViewProps> = ({
  plan,
  onOpenUpgrade,
  signatureDataUrl,
  onSaveSignature,
  vaultDocs,
  onAddVaultDoc,
  initialSubTab = 'builder',
}) => {
  const [subTab, setSubTab] = useState<'builder' | 'signpad' | 'letters' | 'vault'>(initialSubTab);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  // Contract Builder State (All 23 Types & Industry from KarbanApp.ir)
  const [templateType, setTemplateType] = useState<'labor' | 'contractor' | 'freelance' | 'nda'>('labor');
  const [contractTypeName, setContractTypeName] = useState<string>('کار');
  const [industryName, setIndustryName] = useState<string>('برنامه‌نویسان');
  const [employerName, setEmployerName] = useState('شرکت راهکارهای هوشمند کاربان (سهامی خاص)');
  const [employerId, setEmployerId] = useState('۱۰۱۰۳۹۴۸۵۷۶');
  const [workerName, setWorkerName] = useState('امیرحسین رادمنش');
  const [workerId, setWorkerId] = useState('۰۰۱۲۳۴۵۶۷۸');
  const [contractSubject, setContractSubject] = useState('توسعه و نگهداری سامانه‌های نرم‌افزاری و ابری');
  const [durationMonths, setDurationMonths] = useState(12);
  const [startDate, setStartDate] = useState('۱۴۰۵/۰۸/۰۱');
  const [amountRial, setAmountRial] = useState(280_000_000);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  // HR Letters State
  const [letterType, setLetterType] = useState<'employment_cert' | 'settlement' | 'leave'>('employment_cert');
  const [targetOrg, setTargetOrg] = useState('بانک ملت — شعبه مرکزی');
  const [letterDate, setLetterDate] = useState('۱۴۰۵/۰۸/۱۰');
  const [printDocument, setPrintDocument] = useState<PrintDocumentPayload | null>(null);
  const [exportingPdfKey, setExportingPdfKey] = useState<string | null>(null);

  // Touch Signature Canvas State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState('#1d4ed8');

  useEffect(() => {
    if (subTab === 'signpad' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3.2;
        ctx.strokeStyle = penColor;
      }
    }
  }, [subTab, penColor]);

  const getCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      onSaveSignature(dataUrl);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    onSaveSignature(null);
  };

  const generateContractFullText = () => {
    const durFa = formatFaNum(durationMonths);
    const dateFa = toFaDigits(startDate);
    const empIdFa = toFaDigits(employerId);
    const wrkIdFa = toFaDigits(workerId);

    if (contractTypeName === 'محرمانگی' || templateType === 'nda') {
      return `توافق‌نامه ${contractTypeName} — ویژه صنف «${industryName}»

ماده ۱ — طرفین توافق‌نامه:
این توافق‌نامه فیمابین «${employerName}» به شناسه ملی ${empIdFa} به عنوان «افشاکننده اطلاعات» از یک سو، و «${workerName}» به کد ملی ${wrkIdFa} به عنوان «دریافت‌کننده اطلاعات» از سوی دیگر، در تاریخ شمسی ${dateFa} منعقد می‌گردد.

ماده ۲ — موضوع توافق‌نامه:
عبارت است از حفظ اسرار تجاری، کدهای منبع، معماری فنی، فهرست مشتریان و اسناد مالی مرتبط با موضوع «${contractSubject}».

ماده ۳ — مدت تعهد و وجه التزام قراردادی:
مدت اعتبار این تعهد از تاریخ امضا به مدت ${durFa} ماه کامل شمسی است. در صورت نقض تعهد محرمانگی توسط دریافت‌کننده، وی متعهد به پرداخت مبلغ مقطوع ${formatRial(amountRial * 10)} (${numberToPersianWords(amountRial * 10)}) به عنوان وجه التزام عدم انجام تعهد (ماده ۲۳۰ قانون مدنی) بدون نیاز به اثبات ورود خسارت خواهد بود.`;
    }

    const isLaborContract = contractTypeName === 'کار' || contractTypeName === 'کارآموزی';
    if (isLaborContract) {
      return `قرارداد ${contractTypeName} مدت‌موقت — ویژه حوزه «${industryName}» (منطبق با مواد ۷ و ۱۰ قانون کار)

ماده ۱ — مشخصات طرفین:
۱-۱. کارفرما: «${employerName}» به شناسه ملی ${empIdFa}
۱-۲. کارگر / کارپذیر: آقا/خانم «${workerName}» به کد ملی ${wrkIdFa}

ماده ۲ — نوع کار و شرح وظایف:
طرف دوم متعهد به انجام وظایف محوله در موضوع «${contractSubject}» با رعایت آیین‌نامه کارگاه و استانداردهای صنف ${industryName} می‌باشد.

ماده ۳ — مدت قرارداد و دوره آزمایشی:
مدت این قرارداد ${durFa} ماه شمسی از تاریخ ${dateFa} است. طبق ماده ۱۱ قانون کار، ماه اول همکاری به عنوان دوره آزمایشی محسوب می‌گردد و بیمه تأمین اجتماعی از روز نخست الزامی است.

ماده ۴ — حق‌السعی، حقوق و مزایای قانونی (سال ۱۴۰۵):
حقوق و مزایای ماهانه مبلغ ${formatRial(amountRial)} (${formatToman(amountRial)} — ${numberToPersianWords(amountRial)}) شامل مزد مبنا، حق مسکن، بن خواربار و پایه سنوات قانونی می‌باشد که در پایان هر ماه پس از کسر ۷٪ سهم بیمه کارگر و مالیات حقوق به حساب بانکی وی واریز می‌گردد.

ماده ۵ — شرایط فسخ و حل اختلاف:
هر یک از طرفین در صورت تمایل به قطع همکاری پیش از انقضای مدت، مکلف است حداقل ۳۰ روز قبل مراتب را کتباً اعلام نماید. موارد پیش‌بینی‌نشده تابع قانون کار جمهوری اسلامی ایران است.`;
    }

    return `قرارداد رسمی «${contractTypeName}» — ویژه صنف و حوزه «${industryName}» (بر مبنای ماده ۱۰ و ۱۹۰ قانون مدنی)

ماده ۱ — طرفین قرارداد:
۱-۱. طرف اول: «${employerName}» به شناسه ملی/اقتصادی ${empIdFa}
۱-۲. طرف دوم: «${workerName}» به کد ملی ${wrkIdFa}

ماده ۲ — موضوع و مدت قرارداد:
موضوع این قرارداد ${contractTypeName} عبارت است از «${contractSubject}» در چارچوب استانداردهای حوزه ${industryName}، به مدت ${durFa} ماه شمسی از تاریخ ${dateFa}.

ماده ۳ — مبلغ کل و نحوه پرداخت:
مبلغ ناخالص قرارداد برابر با ${formatRial(amountRial)} (معادل ${formatToman(amountRial)} — ${numberToPersianWords(amountRial)}) می‌باشد که پس از کسر کسورات قانونی در قبال تأیید صورت‌وضعیت یا تحویل مراحل انجام کار پرداخت می‌گردد.

ماده ۴ — تعهدات و مالکیت فکری:
طرفین متعهد به حفظ محرمانگی اطلاعات تجاری و فنی بوده و کلیه حقوق مادی ناشی از موضوع این قرارداد متعلق به طرف اول است (در موارد قوه قاهره، تعهدات تا رفع مانع معلق می‌شود).

ماده ۵ — مبنای قانونی و حل اختلاف:
این قرارداد در ۵ ماده و ۲ نسخه هم‌اعتبار بر اساس مواد ۱۰، ۱۹۰ و ۲۱۹ قانون مدنی تنظیم شده است. هرگونه اختلاف بدواً از طریق مذاکره و در صورت عدم سازش، از طریق داوری مرضی‌الطرفین و مراجع قضایی صالح حل‌وفصل خواهد شد.`;
  };

  const handleShareContract = async () => {
    if (!isProPlan(plan)) {
      onOpenUpgrade('امضای دیجیتال لمسی روی موبایل و اشتراک آنی واتساپ/تلگرام');
      return;
    }
    const text = generateContractFullText();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `قرارداد ${contractTypeName} — ${workerName}`,
          text,
        });
        return;
      } catch {
        // fallback
      }
    }
    navigator.clipboard.writeText(text);
    setSavedToast('متن کامل قرارداد کپی شد و آماده ارسال در واتساپ یا تلگرام است.');
    setTimeout(() => setSavedToast(null), 2500);
  };

  const handleArchiveContract = () => {
    const newDoc: VaultDocument = {
      id: `vlt-${Date.now()}`,
      title: `قرارداد ${contractTypeName} (${industryName}) — ${workerName}`,
      category: 'قرارداد رسمی',
      dateJalali: toFaDigits(startDate),
      referenceCode: `سند-${toFaDigits(Math.floor(1000 + Math.random() * 9000))}`,
      status: signatureDataUrl ? 'امضاشده دیجیتال' : 'معتبر در پرونده',
      contentPreview: generateContractFullText(),
    };
    onAddVaultDoc(newDoc);
    setSavedToast('قرارداد با موفقیت در گاوصندوق اسناد بایگانی شد.');
    setTimeout(() => setSavedToast(null), 2500);
  };

  const handleDirectPdfExport = async (key: string, options: ExportA4PdfOptions) => {
    if (exportingPdfKey) return;
    setExportingPdfKey(key);
    try {
      await exportA4DocumentToPdf(options);
      setSavedToast('فایل PDF رسمی با کیفیت A۴ آماده و ذخیره شد.');
      setTimeout(() => setSavedToast(null), 3200);
    } catch {
      setSavedToast('تولید فایل PDF با محدودیت مرورگر مواجه شد؛ از پیش‌نمایش چاپ استفاده کنید.');
      setTimeout(() => setSavedToast(null), 3200);
    } finally {
      setExportingPdfKey(null);
    }
  };

  const buildCurrentLetterDetails = () => {
    const letterTitle =
      letterType === 'employment_cert'
        ? 'گواهی اشتغال به کار و کسر از حقوق'
        : letterType === 'settlement'
        ? 'فرم تسویه‌حساب قطعی حقوق، عیدی و سنوات'
        : 'حکم مأموریت و مرخصی استحقاقی پرسنل';
    const letterBody =
      letterType === 'employment_cert'
        ? `بسمه تعالی\nتاریخ: ${toFaDigits(letterDate)}\nریاست محترم ${targetOrg}\nموضوع: گواهی اشتغال به کار\n\nبا سلام و احترام؛\nبدین‌وسیله گواهی می‌شود آقا/خانم «${workerName}» به کد ملی ${toFaDigits(workerId)} از تاریخ ${toFaDigits(startDate)} در «${employerName}» در سمت «${contractSubject}» مشغول به کار بوده و حقوق و مزایای ماهانه نامبرده مبلغ ${formatRial(amountRial)} (${formatToman(amountRial)}) می‌باشد.\nاین گواهی بنا به درخواست نامبرده و بدون ایجاد هرگونه تعهد مالی یا ضمانت بانکی برای این شرکت صادر گردیده است.`
        : letterType === 'settlement'
        ? `اقرارنامه و فرم تسویه‌حساب قطعی حقوق، عیدی و سنوات (ماده ۲۴ قانون کار)\nتاریخ تنظیم: ${toFaDigits(letterDate)}\n\nبدین‌وسیله اینجانب «${workerName}» به کد ملی ${toFaDigits(workerId)} اقرار و اعلام می‌نمایم کلیه مطالبات قانونی خود اعم از حقوق ماهانه، فوق‌العاده اضافه‌کاری، عیدی و پاداش، حق سنوات و بازخرید ایام مرخصی استحقاقی تا تاریخ ${toFaDigits(letterDate)} را به مبلغ کل ${formatRial(amountRial)} (${numberToPersianWords(amountRial)}) از «${employerName}» دریافت نموده و ذمه کارفرما را از هر حیث بری می‌نمایم.`
        : `برگه درخواست مرخصی استحقاقی / حکم مأموریت اداری\nتاریخ ثبت: ${toFaDigits(letterDate)}\nنام پرسنل: ${workerName} · کد ملی: ${toFaDigits(workerId)}\nواحد سازمانی: ${contractSubject}\nمقصد / موضوع مأموریت: ${targetOrg}\nوضعیت تأیید مدیریت منابع انسانی: موافقت شد — ثبت در کارکرد ماهانه`;
    return { letterTitle, letterBody };
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="crisp-card p-4 rounded-[26px] flex flex-col justify-between gap-3">
        <div>
          <h1 className="text-base font-black text-[#0F172A] dark:text-white">
            قراردادساز هوشمند، بوم امضای لمسی و گاوصندوق اسناد
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            تنظیم ۲۳ نوع قرارداد قانونی، ثبت امضای دیجیتال با انگشت روی موبایل و نامه‌های اداری
          </p>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: 'builder', label: 'قراردادساز هوشمند', icon: FileSignature },
            { id: 'signpad', label: 'بوم امضای لمسی', icon: PenTool },
            { id: 'letters', label: 'نامه‌های اداری', icon: FileText },
            { id: 'vault', label: 'گاوصندوق اسناد', icon: FolderLock },
          ].map((t) => {
            const Icon = t.icon;
            const active = subTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSubTab(t.id as typeof subTab)}
                className={`min-h-[40px] px-3.5 py-2 rounded-full text-xs font-extrabold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#1D4DF5] text-white shadow-md shadow-blue-600/25'
                    : 'bg-[#EFF1FA] dark:bg-[#1A223B] text-slate-600 dark:text-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {savedToast && (
        <div className="p-3.5 rounded-[20px] bg-[#ECFDF5] dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-extrabold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{savedToast}</span>
        </div>
      )}

      {/* SUBTAB 1: SMART CONTRACT BUILDER */}
      {subTab === 'builder' && (
        <div className="grid grid-cols-1 gap-4">
          <div className="crisp-card p-4 rounded-[26px] space-y-4">
            <h2 className="text-sm font-black text-[#0F172A] dark:text-white">
              تنظیم مشخصات قرارداد رسمی
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'labor', name: 'کار', label: 'قرارداد کار (ماده ۱۰)' },
                { id: 'contractor', name: 'پیمانکاری', label: 'پیمانکاری و خدمات' },
                { id: 'freelance', name: 'همکاری', label: 'همکاری و پروژه' },
                { id: 'nda', name: 'محرمانگی', label: 'عدم افشا (NDA)' },
              ].map((tp) => (
                <button
                  key={tp.id}
                  type="button"
                  onClick={() => {
                    setTemplateType(tp.id as typeof templateType);
                    setContractTypeName(tp.name);
                  }}
                  className={`min-h-[40px] px-2.5 py-2 rounded-full text-xs font-extrabold border transition-colors ${
                    contractTypeName === tp.name
                      ? 'border-[#1D4DF5] bg-[#1D4DF5] text-white shadow-sm'
                      : 'border-transparent bg-[#EFF1FA] dark:bg-[#1A223B] text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {tp.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  انتخاب از ۲۳ نوع قرارداد رسمی
                </label>
                <select
                  value={contractTypeName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setContractTypeName(val);
                    if (val === 'محرمانگی' || val === 'عدم رقابت') setTemplateType('nda');
                    else if (val === 'کار' || val === 'کارآموزی') setTemplateType('labor');
                    else if (val === 'پیمانکاری') setTemplateType('contractor');
                    else setTemplateType('freelance');
                  }}
                  className="w-full px-3 py-2.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold text-[#0F172A] dark:text-white"
                >
                  {CONTRACT_TYPES_ALL.map((ct) => (
                    <option key={ct} value={ct}>
                      قرارداد {ct}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  صنف / حوزه شغلی
                </label>
                <select
                  value={industryName}
                  onChange={(e) => setIndustryName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold text-[#0F172A] dark:text-white"
                >
                  {INDUSTRIES_ALL.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-300 mb-1.5">
                  نام کارفرما / طرف اول
                </label>
                <input
                  type="text"
                  value={employerName}
                  onChange={(e) => setEmployerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold text-[#0F172A] dark:text-white"
                />
              </div>
              <FaDigitsInput
                label="شناسه ملی کارفرما"
                value={employerId}
                onChange={setEmployerId}
                maxLength={11}
              />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-300 mb-1.5">
                  نام کارپذیر / طرف دوم
                </label>
                <input
                  type="text"
                  value={workerName}
                  onChange={(e) => setWorkerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold text-[#0F172A] dark:text-white"
                />
              </div>
              <FaDigitsInput
                label="کد ملی طرف دوم"
                value={workerId}
                onChange={setWorkerId}
                maxLength={10}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-300 mb-1.5">
                موضوع قرارداد / عنوان شغلی
              </label>
              <input
                type="text"
                value={contractSubject}
                onChange={(e) => setContractSubject(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold text-[#0F172A] dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <JalaliDatePicker
                label="تاریخ شروع قرارداد (شمسی)"
                value={startDate}
                onChange={setStartDate}
              />
              <FaNumberInput
                label="مدت قرارداد"
                value={durationMonths}
                onChange={(v) => setDurationMonths(Math.max(1, v))}
                suffix="ماه"
                min={1}
                max={60}
              />
            </div>

            <FaNumberInput
              label="مبلغ قرارداد / حقوق ماهانه (ریال — با جداکننده سه‌رقمی)"
              value={amountRial}
              onChange={setAmountRial}
              showTomanHint
              quickChips={[
                { label: '۲۰ میلیون تومان', value: 200_000_000 },
                { label: '۳۵ میلیون تومان', value: 350_000_000 },
                { label: '۸۰ میلیون تومان', value: 800_000_000 },
              ]}
            />

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={handleArchiveContract}
                className="flex-1 min-h-[46px] px-4 py-2.5 rounded-2xl bg-[#1D4DF5] hover:bg-[#163ED4] text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-950/15"
              >
                <BookmarkPlus className="w-4 h-4" />
                <span>ثبت در گاوصندوق</span>
              </button>
              <button
                type="button"
                onClick={handleShareContract}
                className="min-h-[46px] px-4 py-2.5 rounded-2xl bg-[#EFF1FA] dark:bg-[#1E294A] text-[#0F172A] dark:text-white border border-slate-200 dark:border-slate-700/60 font-extrabold text-xs flex items-center gap-1.5"
              >
                <Share2 className="w-4 h-4 text-[#1D4DF5] dark:text-[#608BFF]" />
                <span>ارسال واتساپ/تلگرام</span>
              </button>
            </div>
          </div>

          {/* Live Legal Document Preview with Touch Signature */}
          <div className="p-4 rounded-[28px] bg-white text-slate-900 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div className="text-sm font-black text-[#0F172A]">
                پیش‌نمایش رسمی متن قرارداد (با ارقام فارسی و تقویم شمسی)
              </div>
              <div className="flex flex-wrap items-center gap-2 no-print">
                <button
                  type="button"
                  data-testid="export-contract-pdf-btn"
                  disabled={exportingPdfKey === 'contract'}
                  onClick={() =>
                    handleDirectPdfExport('contract', {
                      fileName: `karban-contract-${new Date().toISOString().slice(0, 10)}.pdf`,
                      badge: 'قرارداد رسمی کاربان',
                      title: `قرارداد رسمی ${contractTypeName} — ویژه ${industryName}`,
                      dateJalali: startDate,
                      metadata: [
                        { label: 'طرف اول (کارفرما / افشاکننده)', value: `${employerName} (${employerId})` },
                        { label: 'طرف دوم (همکار / پیمانکار)', value: `${workerName} (${workerId})` },
                      ],
                      body: generateContractFullText(),
                      amountRial,
                      signatureDataUrl,
                    })
                  }
                  className="px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-extrabold flex items-center gap-1.5 transition-colors"
                >
                  {exportingPdfKey === 'contract' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileDown className="w-3.5 h-3.5" />
                  )}
                  <span>دانلود PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPrintDocument({
                      kind: 'contract',
                      title: `قرارداد رسمی ${contractTypeName} — ویژه ${industryName}`,
                      categoryLabel: 'قرارداد رسمی کاربان',
                      dateJalali: startDate,
                      employerName,
                      employerId,
                      workerName,
                      workerId,
                      amountRial,
                      body: generateContractFullText(),
                    })
                  }
                  className="px-3.5 py-1.5 rounded-full bg-[#1D4DF5] hover:bg-[#163ED4] text-white text-xs font-extrabold flex items-center gap-1.5 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-400" />
                  <span>پیش‌نمایش چاپ و PDF</span>
                </button>
              </div>
            </div>

            <div className="whitespace-pre-line text-xs leading-7 text-slate-800 bg-[#F4F6FD] p-5 rounded-2xl border border-violet-100">
              {generateContractFullText()}
            </div>

            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-200 text-xs">
              <div>
                <div className="font-extrabold text-[#0F172A]">محل مهر و امضای طرف اول ({employerName}):</div>
                <div className="mt-2 min-h-[72px] p-2 rounded-2xl border border-dashed border-blue-200 flex items-center justify-center">
                  {signatureDataUrl ? (
                    <img
                      src={signatureDataUrl}
                      alt="امضای دیجیتال ثبت‌شده"
                      referrerPolicy="no-referrer"
                      className="h-14 object-contain"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSubTab('signpad')}
                      className="text-[#1D4DF5] underline font-extrabold"
                    >
                      + ترسیم امضای لمسی روی صفحه گوشی
                    </button>
                  )}
                </div>
              </div>
              <div>
                <div className="font-extrabold text-[#0F172A]">محل امضای طرف دوم ({workerName}):</div>
                <div className="mt-2 min-h-[72px] p-2 rounded-2xl border border-dashed border-blue-200 flex items-center justify-center text-slate-400">
                  اثر انگشت و امضای طرف دوم
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: TOUCH DIGITAL SIGNATURE PAD */}
      {subTab === 'signpad' && (
        <div className="max-w-2xl mx-auto paper-card p-6 rounded-[32px] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-black text-[#0F172A] dark:text-white flex items-center gap-2">
                <PenTool className="w-5 h-5 text-[#1D4DF5] dark:text-[#608BFF]" />
                <span>بوم امضای دیجیتال لمسی روی صفحه موبایل</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                با انگشت یا قلم لمسی امضای خود را ترسیم کنید؛ این امضا به‌طور خودکار پای تمامی فاکتورهای رسمی مودیان و قراردادهای شما درج می‌شود.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {[
                { color: '#1d4ed8', label: 'آبی رسمی' },
                { color: '#0f172a', label: 'مشکی' },
                { color: '#b45309', label: 'طلایی' },
              ].map((c) => (
                <button
                  key={c.color}
                  type="button"
                  onClick={() => setPenColor(c.color)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border ${
                    penColor === c.color
                      ? 'border-[#1D4DF5] bg-[#EFF1FA]0/15 text-[#1D4DF5] dark:border-amber-400 dark:text-[#608BFF]'
                      : 'border-slate-200 dark:border-violet-800 text-slate-500'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border-2 border-dashed border-blue-200 dark:border-violet-700 bg-white overflow-hidden">
            <canvas
              ref={canvasRef}
              width={640}
              height={240}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={endDrawing}
              onMouseLeave={endDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={endDrawing}
              className="w-full h-56 touch-none cursor-crosshair"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={clearCanvas}
              className="min-h-[44px] px-4 py-2 rounded-full border border-rose-500/40 text-rose-500 text-xs font-extrabold flex items-center gap-1.5 hover:bg-rose-500/10"
            >
              <Trash2 className="w-4 h-4" />
              <span>پاک کردن بوم امضا</span>
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="export-signed-doc-pdf-btn"
                disabled={exportingPdfKey === 'signpad'}
                onClick={() => {
                  const activeSig =
                    signatureDataUrl ||
                    (canvasRef.current ? canvasRef.current.toDataURL('image/png') : null);
                  if (activeSig && !signatureDataUrl) {
                    onSaveSignature(activeSig);
                  }
                  handleDirectPdfExport('signpad', {
                    fileName: `karban-signed-document-${new Date().toISOString().slice(0, 10)}.pdf`,
                    badge: 'سند امضاشده دیجیتال کاربان',
                    title: `قرارداد ${contractTypeName} امضاشده — ${workerName}`,
                    dateJalali: startDate,
                    metadata: [
                      { label: 'امضاکننده اول (کارفرما)', value: `${employerName} (${employerId})` },
                      { label: 'طرف دوم', value: `${workerName} (${workerId})` },
                    ],
                    body: generateContractFullText(),
                    amountRial,
                    signatureDataUrl: activeSig,
                    stampText: 'تأییدیه امضای لمسی دیجیتال کاربان',
                  });
                }}
                className="min-h-[44px] px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-black flex items-center gap-1.5 shadow-sm"
              >
                {exportingPdfKey === 'signpad' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4" />
                )}
                <span>دانلود سند امضاشده (PDF)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSavedToast('امضای لمسی شما ذخیره شد و روی فاکتورها و قراردادها فعال گردید.');
                  setTimeout(() => setSavedToast(null), 2500);
                  setSubTab('builder');
                }}
                className="min-h-[44px] px-5 py-2.5 rounded-full bg-[#1D4DF5] hover:bg-[#163ED4] text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-indigo-950/15"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>تأیید و درج روی قرارداد و فاکتور</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: ADMINISTRATIVE & HR LETTERS */}
      {subTab === 'letters' && (
        <div className="grid grid-cols-1 gap-4">
          <div className="paper-card p-4 rounded-[28px] space-y-4">
            <h2 className="text-base font-black text-[#0F172A] dark:text-white">
              تولید نامه‌ها و گواهی‌های اداری استاندارد
            </h2>
            <div className="space-y-2">
              {[
                { id: 'employment_cert', label: 'گواهی اشتغال به کار و کسر از حقوق (بانک/سفارت)' },
                { id: 'settlement', label: 'فرم تسویه‌حساب قطعی سنوات، عیدی و برائت ذمه' },
                { id: 'leave', label: 'حکم مأموریت و مرخصی استحقاقی پرسنل' },
              ].map((lt) => (
                <button
                  key={lt.id}
                  type="button"
                  onClick={() => setLetterType(lt.id as typeof letterType)}
                  className={`w-full text-right p-3.5 rounded-2xl text-xs font-extrabold border ${
                    letterType === lt.id
                      ? 'border-[#1D4DF5] bg-[#EFF1FA]0/15 text-[#1D4DF5] dark:border-amber-400 dark:bg-[#1D4DF5]/20 dark:text-[#608BFF]'
                      : 'border-slate-200/80 dark:border-slate-700/60 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {lt.label}
                </button>
              ))}
            </div>
            <div>
              <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-300 mb-1.5">
                مرجع مخاطب گواهی (نام بانک، سفارت یا سازمان)
              </label>
              <input
                type="text"
                value={targetOrg}
                onChange={(e) => setTargetOrg(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold text-[#0F172A] dark:text-white"
              />
            </div>
            <JalaliDatePicker
              label="تاریخ صدور نامه (تقویم شمسی)"
              value={letterDate}
              onChange={setLetterDate}
            />
          </div>

          <div className="p-4 rounded-[28px] bg-white text-slate-900 border border-slate-200/80 space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-200 pb-3">
              <div className="text-sm font-black text-[#0F172A]">پیش‌نمایش نامه رسمی سربرگ‌دار · تاریخ: {toFaDigits(letterDate)}</div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="export-letter-pdf-btn"
                  disabled={exportingPdfKey === 'letter'}
                  onClick={() => {
                    const { letterTitle, letterBody } = buildCurrentLetterDetails();
                    handleDirectPdfExport('letter', {
                      fileName: `karban-official-letter-${new Date().toISOString().slice(0, 10)}.pdf`,
                      badge: 'نامه اداری رسمی کاربان',
                      title: letterTitle,
                      dateJalali: letterDate,
                      metadata: [
                        { label: 'صادرکننده', value: employerName },
                        { label: 'مخاطب / ذینفع', value: `${targetOrg} — ${workerName}` },
                      ],
                      body: letterBody,
                      signatureDataUrl,
                      firstPartyTitle: 'مهر و امضای مدیریت صادرکننده:',
                      secondPartyTitle: 'تأییدیه دبیرخانه / دریافت‌کننده:',
                    });
                  }}
                  className="px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-extrabold flex items-center gap-1.5 transition-colors"
                >
                  {exportingPdfKey === 'letter' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileDown className="w-3.5 h-3.5" />
                  )}
                  <span>دانلود PDF نامه</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const { letterTitle, letterBody } = buildCurrentLetterDetails();
                    setPrintDocument({
                      kind: 'letter',
                      title: letterTitle,
                      targetOrg,
                      dateJalali: letterDate,
                      employerName,
                      employeeName: workerName,
                      body: letterBody,
                    });
                  }}
                  className="px-3.5 py-1.5 rounded-full bg-[#1D4DF5] hover:bg-[#163ED4] text-white text-xs font-extrabold flex items-center gap-1.5 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-400" />
                  <span>پیش‌نمایش چاپ و PDF</span>
                </button>
              </div>
            </div>
            <div className="p-5 rounded-2xl bg-[#F4F6FD] border border-violet-100 text-xs leading-7 whitespace-pre-line">
              {letterType === 'employment_cert'
                ? `بسمه تعالی
تاریخ: ${toFaDigits(letterDate)}
رياست محترم ${targetOrg}
موضوع: گواهی اشتغال به کار

با سلام و احترام؛
بدین‌وسیله گواهی می‌شود آقا/خانم «${workerName}» به کد ملی ${toFaDigits(workerId)} از تاریخ ${toFaDigits(startDate)} در «${employerName}» در سمت «${contractSubject}» مشغول به کار بوده و حقوق و مزایای ماهانه نامبرده مبلغ ${formatRial(amountRial)} (${formatToman(amountRial)}) می‌باشد.
این گواهی بنا به درخواست نامبرده و بدون ایجاد هرگونه تعهد مالی یا ضمانت بانکی برای این شرکت صادر گردیده است.`
                : letterType === 'settlement'
                ? `اقرارنامه و فرم تسویه‌حساب قطعی حقوق، عیدی و سنوات (ماده ۲۴ قانون کار)
تاریخ تنظیم: ${toFaDigits(letterDate)}

بدین‌وسیله اینجانب «${workerName}» به کد ملی ${toFaDigits(workerId)} اقرار و اعلام می‌نمایم کلیه مطالبات قانونی خود اعم از حقوق ماهانه، فوق‌العاده اضافه‌کاری، عیدی و پاداش، حق سنوات و بازخرید ایام مرخصی استحقاقی تا تاریخ ${toFaDigits(letterDate)} را به مبلغ کل ${formatRial(amountRial)} (${numberToPersianWords(amountRial)}) از «${employerName}» دریافت نموده و ذمه کارفرما را از هر حیث بری می‌نمایم.`
                : `برگه درخواست مرخصی استحقاقی / حکم مأموریت اداری
تاریخ ثبت: ${toFaDigits(letterDate)}
نام پرسنل: ${workerName} · کد ملی: ${toFaDigits(workerId)}
واحد سازمانی: ${contractSubject}
مقصد / موضوع مأموریت: ${targetOrg}
وضعیت تأیید مدیریت منابع انسانی: موافقت شد — ثبت در کارکرد ماهانه`}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: ENCRYPTED DOCUMENT VAULT */}
      {subTab === 'vault' && (
        <div className="space-y-3.5">
          {vaultDocs.map((doc) => (
            <div
              key={doc.id}
              className="paper-card p-5 rounded-[28px] space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <div>
                  <span className="font-extrabold text-[#1D4DF5] dark:text-[#608BFF]">{doc.category}</span>
                  <span className="mx-1.5">·</span>
                  <span className="tabular-nums">{toFaDigits(doc.referenceCode)}</span>
                  <span className="mx-1.5">·</span>
                  <span className="tabular-nums">{toFaDigits(doc.dateJalali)}</span>
                </div>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  {doc.status}
                </span>
              </div>
              <h3 className="text-sm font-black text-[#0F172A] dark:text-white">{toFaDigits(doc.title)}</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                {toFaDigits(doc.contentPreview)}
              </p>
              <div className="pt-2 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  data-testid={`export-vault-pdf-${doc.id}`}
                  disabled={exportingPdfKey === doc.id}
                  onClick={() =>
                    handleDirectPdfExport(doc.id, {
                      fileName: `karban-vault-${doc.id}.pdf`,
                      badge: `${doc.category} · ${doc.status}`,
                      title: doc.title,
                      dateJalali: doc.dateJalali,
                      referenceCode: doc.referenceCode,
                      metadata: [
                        { label: 'طرف اول / مودی', value: employerName },
                        { label: 'طرف دوم / ذینفع', value: workerName },
                      ],
                      body: doc.contentPreview,
                      signatureDataUrl,
                    })
                  }
                  className="min-h-[38px] px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-extrabold flex items-center gap-1.5 transition-colors"
                >
                  {exportingPdfKey === doc.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileDown className="w-3.5 h-3.5" />
                  )}
                  <span>دانلود PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPrintDocument({
                      kind: 'contract',
                      title: doc.title,
                      categoryLabel: doc.category,
                      dateJalali: doc.dateJalali,
                      referenceCode: doc.referenceCode,
                      employerName,
                      employerId,
                      workerName,
                      workerId,
                      body: doc.contentPreview,
                    })
                  }
                  className="min-h-[38px] px-3.5 py-1.5 rounded-full bg-[#EFF1FA] dark:bg-[#1E294A] hover:bg-[#1D4DF5] hover:text-white dark:hover:bg-amber-400 dark:hover:text-[#141129] text-[#0F172A] dark:text-white text-xs font-extrabold flex items-center gap-1.5 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>پیش‌نمایش چاپ و PDF</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <PrintPreviewPdfModal
        documentData={printDocument}
        signatureDataUrl={signatureDataUrl}
        onClose={() => setPrintDocument(null)}
        onRequestSignaturePad={() => setSubTab('signpad')}
      />
    </div>
  );
};
