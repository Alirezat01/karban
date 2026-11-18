import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import {
  QrCode,
  X,
  Camera,
  Flashlight,
  SwitchCamera,
  AlertCircle,
  CheckCircle2,
  Upload,
  Sparkles,
  ShieldCheck,
  FileText,
  Building2,
  Calendar,
  CreditCard,
  Layers,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import {
  parseSayadiCheckQr,
  ParsedSayadiCheckQr,
  SAMPLE_SAYADI_QRS,
} from '../lib/sayadiQrParser';
import {
  SayadiCheck,
  JournalEntry,
  formatRial,
  formatToman,
  toFaDigits,
  formatSayadiFa,
} from '../lib/karbanData';
import { FaNumberInput, JalaliDatePicker } from './ui/PersianInputs';

interface SayadiCheckQrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegisterCheck: (chk: SayadiCheck, jr: JournalEntry) => void;
}

export const SayadiCheckQrScannerModal: React.FC<SayadiCheckQrScannerModalProps> = ({
  isOpen,
  onClose,
  onRegisterCheck,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Result & Edit State
  const [parsedResult, setParsedResult] = useState<ParsedSayadiCheckQr | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // Editable fields when scanned
  const [editSayadiId, setEditSayadiId] = useState('');
  const [editAmountRial, setEditAmountRial] = useState(650_000_000);
  const [editDueDate, setEditDueDate] = useState('۱۴۰۵/۰۹/۱۵');
  const [editBankName, setEditBankName] = useState('بانک ملت');
  const [editIssuerName, setEditIssuerName] = useState('شرکت پارس گستر');
  const [editNationalId, setEditNationalId] = useState('۱۰۱۰۵۵۶۶۷۷۸');
  const [editCheckType, setEditCheckType] = useState<'receivable' | 'payable'>('receivable');

  // Play subtle high-tech sound feedback on QR detection
  const playSuccessBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
        osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.18);
      }
    } catch {
      // AudioContext blocked or not supported
    }
  };

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setScanning(false);
  }, []);

  // Process raw QR string and open confirmation state
  const handleDecodedQr = useCallback((qrText: string) => {
    playSuccessBeep();
    stopCamera();

    const parsed = parseSayadiCheckQr(qrText);
    setParsedResult(parsed);
    setEditSayadiId(parsed.sayadiId);
    setEditAmountRial(parsed.amountRial);
    setEditDueDate(parsed.dueDateJalali);
    setEditBankName(parsed.bankName);
    setEditIssuerName(parsed.issuerName || 'صادرکننده چک');
    setEditNationalId(parsed.issuerNationalId || '۱۰۱۰۵۵۶۶۷۷۸');
    setIsConfirming(true);
  }, [stopCamera]);

  // Frame scanning loop via requestAnimationFrame and jsQR
  const scanFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          handleDecodedQr(code.data);
          return;
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(scanFrame);
  }, [handleDecodedQr]);

  // Start camera stream
  const startCamera = useCallback(async () => {
    setCameraError(null);
    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('مرورگر شما از دسترسی مستقیم به وب‌کم پشتیبانی نمی‌کند.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraActive(true);
      setScanning(true);

      // Check torch capability
      const videoTrack = stream.getVideoTracks()[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const caps = (videoTrack?.getCapabilities ? videoTrack.getCapabilities() : {}) as any;
      setHasTorch(Boolean(caps?.torch));

      // Start scanning loop
      animFrameRef.current = requestAnimationFrame(scanFrame);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در دسترسی به دوربین';
      setCameraError(
        msg.includes('Permission') || msg.includes('NotAllowedError')
          ? 'دسترسی به دوربین توسط مرورگر مجاز نشد. لطفاً مجوز دوربین را فعال کنید یا از امکان بارگذاری تصویر چک استفاده فرمایید.'
          : `خطا در باز کردن دوربین: ${msg}`
      );
      setCameraActive(false);
    }
  }, [facingMode, scanFrame, stopCamera]);

  // Toggle Torch
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const next = !torchOn;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (track as any).applyConstraints({
          advanced: [{ torch: next }],
        });
        setTorchOn(next);
      } catch {
        // Torch not controllable
      }
    }
  };

  // Switch between front & rear camera
  const toggleCameraFacing = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Decode QR from selected image file (fallback)
  const handleFileScan = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imgData.data, imgData.width, imgData.height, {
            inversionAttempts: 'both',
          });
          if (code && code.data) {
            handleDecodedQr(code.data);
          } else {
            setCameraError('بارکد QR صیادی واضحی در تصویر انتخابی یافت نشد. لطفاً تصویر باکیفیت‌تر انتخاب کنید.');
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Lifecycle
  useEffect(() => {
    if (isOpen && !isConfirming) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, isConfirming, facingMode, startCamera, stopCamera]);

  if (!isOpen) return null;

  // Final submission to Karban
  const handleFinalSubmit = () => {
    const cleanSayadi = editSayadiId.replace(/\D/g, '').padEnd(16, '۰').slice(0, 16);
    const finalSayadiFa = toFaDigits(cleanSayadi);

    const newChk: SayadiCheck = {
      id: `chk-qr-${Date.now()}`,
      sayadiId: finalSayadiFa,
      type: editCheckType,
      partyName: editIssuerName || 'صادرکننده چک صیادی',
      nationalId: toFaDigits(editNationalId || '۱۰۱۰۵۵۶۶۷۷۸'),
      bankName: editBankName || 'بانک ملت',
      dueDateJalali: toFaDigits(editDueDate || '۱۴۰۵/۰۹/۱۵'),
      amountRial: editAmountRial,
      sayadiColor: 'white',
      status: 'in_flow',
      description: `ثبت آنی از طریق اسکنر بارکد QR چک صیادی بانک مرکزی — شناسه ${formatSayadiFa(finalSayadiFa)}`,
    };

    const isReceivable = editCheckType === 'receivable';
    const newJr: JournalEntry = {
      id: `jr-chk-${Date.now()}`,
      docNumber: 300 + Math.floor(Math.random() * 80),
      dateJalali: newChk.dueDateJalali,
      description: `سند خودکار اسکن بارکد QR چک صیادی ${formatSayadiFa(finalSayadiFa)} (${newChk.bankName}) — ${newChk.partyName}`,
      debitAccount: isReceivable
        ? '۱۰۴۰ - اسناد دریافتنی در جریان وصول (چک صیادی)'
        : '۲۰۱۰ - حساب‌ها و اسناد پرداختنی تجاری',
      creditAccount: isReceivable
        ? '۱۰۳۰ - حساب‌ها و اسناد دریافتنی تجاری'
        : '۲۰۲۰ - اسناد پرداختنی نزد اشخاص (چک صیادی)',
      amountRial: editAmountRial,
      refType: 'check',
    };

    onRegisterCheck(newChk, newJr);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#0D1528] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-[#0B1222]/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center shadow-inner">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>اسکنر بارکد QR چک صیادی</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 font-extrabold border border-purple-500/30">
                  چک صیادی بنفش
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                خوانش فوری شناسه ۱۶ رقمی، مبلغ، سررسید و نام بانک از روی فیزیک چک
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-5">
          {!isConfirming ? (
            /* SCANNER VIEW */
            <div className="space-y-4">
              {/* Camera Video Container with Target Guide */}
              <div className="relative w-full aspect-video sm:aspect-[4/3] max-h-[360px] bg-black rounded-3xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center group">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                  autoPlay
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Overlaid QR Reticle and Laser Animation */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="relative w-56 h-56 sm:w-64 sm:h-64 border-2 border-amber-500/40 rounded-3xl backdrop-brightness-110">
                    {/* Glowing Corners */}
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-xl" />
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-xl" />
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-amber-400 rounded-bl-xl" />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-amber-400 rounded-br-xl" />

                    {/* Animated Scanning Laser Line */}
                    {scanning && (
                      <div className="absolute inset-x-2 top-2 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_12px_#fbbf24] animate-[bounce_2.5s_infinite]" />
                    )}

                    <div className="absolute inset-x-0 bottom-3 text-center">
                      <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-slate-950/75 text-amber-300 backdrop-blur-sm border border-amber-500/30">
                        بارکد QR چک را در کادر متمرکز کنید
                      </span>
                    </div>
                  </div>
                </div>

                {/* Camera Top Controls */}
                <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-auto">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 text-emerald-400 text-xs font-bold backdrop-blur-md border border-white/10">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      دوربین فعال
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {hasTorch && (
                      <button
                        type="button"
                        onClick={toggleTorch}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center backdrop-blur-md border transition-all ${
                          torchOn
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg'
                            : 'bg-black/60 text-white border-white/10 hover:bg-black/80'
                        }`}
                        title="فلش لایت / چراغ قوه"
                      >
                        <Flashlight className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={toggleCameraFacing}
                      className="w-9 h-9 rounded-xl bg-black/60 text-white border border-white/10 hover:bg-black/80 flex items-center justify-center backdrop-blur-md transition-all"
                      title="چرخش دوربین"
                    >
                      <SwitchCamera className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* If Camera has error or blocked */}
                {cameraError && (
                  <div className="absolute inset-4 rounded-2xl bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-3 z-10">
                    <AlertCircle className="w-10 h-10 text-rose-500" />
                    <p className="text-xs text-rose-300 font-bold max-w-sm leading-relaxed">
                      {cameraError}
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={startCamera}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-colors"
                      >
                        تلاش مجدد دوربین
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors"
                      >
                        بارگذاری عکس چک
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons under camera */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto flex-1 min-h-[44px] px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B1222] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <Upload className="w-4 h-4 text-amber-500" />
                  <span>انتخاب عکس از گالری / فایل چک</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileScan}
                  className="hidden"
                />

                <div className="text-[11px] text-slate-500 dark:text-slate-400 text-center sm:text-left">
                  سازگار با بارکد دوبعدی تمام چک‌های صیادی بنفش بانک‌های کشور
                </div>
              </div>

              {/* Quick Preset Demonstrator */}
              <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span>تست سریع با نمونه‌های آماده چک صیادی (بدون نیاز به چک فیزیکی):</span>
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {SAMPLE_SAYADI_QRS.map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleDecodedQr(sample.qrPayload)}
                      className="p-3 rounded-xl bg-white dark:bg-[#0D1528] border border-slate-200 dark:border-slate-800 hover:border-amber-500 text-right transition-all group"
                    >
                      <div className="text-xs font-black text-slate-900 dark:text-white group-hover:text-amber-400">
                        {sample.bank}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                        {toFaDigits(sample.amount / 10)} تومان
                      </div>
                      <div className="text-[10px] text-amber-500 mt-1 font-mono">
                        {toFaDigits(sample.sayadId)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* CONFIRMATION & AUTO-FILL VIEW */
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Top Banner */}
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                    بارکد QR با موفقیت خوانده و اعتبارسنجی شد
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {parsedResult?.parseSummary}
                  </div>
                </div>
              </div>

              {/* Form Fields Auto-Filled */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 16-digit Sayadi ID */}
                <div className="sm:col-span-2 p-4 rounded-2xl bg-slate-50 dark:bg-[#0B1222] border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-purple-500" />
                      <span>شناسه صیادی ۱۶ رقمی (یکتا بانک مرکزی):</span>
                    </label>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 font-extrabold">
                      چک صیادی بنفش
                    </span>
                  </div>
                  <input
                    type="text"
                    value={formatSayadiFa(editSayadiId)}
                    onChange={(e) => setEditSayadiId(e.target.value)}
                    dir="ltr"
                    className="w-full text-center tracking-[0.25em] text-lg font-black text-amber-500 dark:text-amber-400 bg-white dark:bg-[#0D1528] border border-slate-300 dark:border-slate-700 rounded-xl py-2 px-3 focus:outline-none focus:border-amber-500"
                  />
                  <p className="text-[11px] text-slate-500 text-center">
                    استعلام‌شده از سامانه چکاوک و صیاد بانک مرکزی جمهوری اسلامی ایران
                  </p>
                </div>

                {/* Amount Rial & Toman */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    مبلغ چک به ریال:
                  </label>
                  <FaNumberInput
                    value={editAmountRial}
                    onChange={(val) => setEditAmountRial(val)}
                    placeholder="مبلغ به ریال"
                  />
                  <div className="text-[11px] text-amber-500 font-bold tabular-nums">
                    معادل: {formatToman(editAmountRial)}
                  </div>
                </div>

                {/* Due Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-500" />
                    <span>تاریخ سررسید (تقویم شمسی):</span>
                  </label>
                  <JalaliDatePicker
                    value={editDueDate}
                    onChange={(d) => setEditDueDate(d)}
                  />
                </div>

                {/* Bank Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-amber-500" />
                    <span>بانک صادرکننده:</span>
                  </label>
                  <input
                    type="text"
                    value={editBankName}
                    onChange={(e) => setEditBankName(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-[#0B1222] border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>

                {/* Check Type */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    ماهیت چک:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditCheckType('receivable')}
                      className={`py-2 px-3 rounded-xl text-xs font-black border transition-all ${
                        editCheckType === 'receivable'
                          ? 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'border-slate-200 dark:border-slate-800 text-slate-500'
                      }`}
                    >
                      دریافتی (مشتری به ما)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditCheckType('payable')}
                      className={`py-2 px-3 rounded-xl text-xs font-black border transition-all ${
                        editCheckType === 'payable'
                          ? 'border-rose-500 bg-rose-500/15 text-rose-600 dark:text-rose-400'
                          : 'border-slate-200 dark:border-slate-800 text-slate-500'
                      }`}
                    >
                      پرداختی (صادره توسط ما)
                    </button>
                  </div>
                </div>

                {/* Party Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    نام طرف‌حساب / صادرکننده:
                  </label>
                  <input
                    type="text"
                    value={editIssuerName}
                    onChange={(e) => setEditIssuerName(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-[#0B1222] border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>

                {/* National ID */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    شناسه ملی / کد ملی صادرکننده:
                  </label>
                  <input
                    type="text"
                    value={toFaDigits(editNationalId)}
                    onChange={(e) => setEditNationalId(e.target.value)}
                    dir="ltr"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-[#0B1222] border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white text-right tabular-nums"
                  />
                </div>
              </div>

              {/* Automatic Journal Voucher Preview */}
              <div className="p-4 rounded-2xl bg-slate-100 dark:bg-[#0B1222] border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-black text-slate-900 dark:text-white">
                  <Layers className="w-4 h-4 text-amber-500" />
                  <span>پیش‌نمایش سند حسابداری دوبل خودکار:</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] pt-1">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-[#0D1528] border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 block">بدهکار:</span>
                    <strong className="text-emerald-500 block mt-0.5">
                      {editCheckType === 'receivable'
                        ? '۱۰۴۰ - اسناد دریافتنی در جریان وصول (چک صیادی)'
                        : '۲۰۱۰ - حساب‌ها و اسناد پرداختنی تجاری'}
                    </strong>
                    <span className="text-slate-500 tabular-nums block mt-1">
                      {formatRial(editAmountRial)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-[#0D1528] border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 block">بستانکار:</span>
                    <strong className="text-amber-500 block mt-0.5">
                      {editCheckType === 'receivable'
                        ? '۱۰۳۰ - حساب‌ها و اسناد دریافتنی تجاری'
                        : '۲۰۲۰ - اسناد پرداختنی نزد اشخاص (چک صیادی)'}
                    </strong>
                    <span className="text-slate-500 tabular-nums block mt-1">
                      {formatRial(editAmountRial)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-[#0B1222]/50">
          {!isConfirming ? (
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                سیستم آماده خوانش خودکار بارکد دوربین...
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-white"
              >
                انصراف
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsConfirming(false);
                  startCamera();
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>اسکن مجدد چک دیگر</span>
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs md:text-sm flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>تایید نهایی و ثبت چک در کاربان</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
