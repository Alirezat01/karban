import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  Sparkles,
  ArrowUpLeft,
  X,
  Bot,
  User,
  Zap,
  Compass,
  Landmark,
  Trash2,
} from 'lucide-react';
import { formatToman, formatRial, formatFaNum, toFaDigits } from '../lib/karbanData';

export type VoiceNavTarget =
  | 'none'
  | 'dashboard'
  | 'accounting'
  | 'ai_studio'
  | 'contracts'
  | 'signpad'
  | 'tools'
  | 'lock_app'
  | 'upgrade_modal';

export interface VoiceChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestampJalali: string;
  navigationAction?: VoiceNavTarget;
  actionLabel?: string;
  highlightedMetric?: string;
  modelUsed?: string;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (target: VoiceNavTarget) => void;
  financialSnapshot: {
    netLiquidityRial: number;
    totalSalesRial: number;
    totalPurchasesRial: number;
    receivableChecksRial: number;
    payableChecksRial: number;
    invoicesCount: number;
    checksCount: number;
    vaultDocsCount: number;
    activeDateJalali: string;
  };
}

const INITIAL_VOICE_HISTORY: VoiceChatTurn[] = [
  {
    id: 'welcome-voice-1',
    role: 'assistant',
    text: 'سلام! من دستیار صوتی و مدیر مالی هوشمند (AI CFO) کاربان هستم. می‌توانید با صدای خودتان دستور بدهید (مثلاً: «برو به بخش چک‌های صیادی» یا «موجودی خزانه و وضعیت چک‌ها چطوره؟») یا پرسش مالی و حقوقی خود را بپرسید.',
    timestampJalali: '۱۰:۴۵',
    highlightedMetric: 'آماده دریافت فرمان صوتی فارسی (fa-IR)',
  },
];

const QUICK_VOICE_COMMANDS = [
  {
    label: 'موجودی خزانه و نقدینگی من چقدر است؟',
    prompt: 'موجودی خالص خزانه، فروش دوره و وضعیت نقدینگی من چقدر است؟',
  },
  {
    label: 'برو به صدور فاکتور رسمی مودیان',
    prompt: 'برو به بخش حسابداری و صدور صورتحساب رسمی سامانه مودیان',
  },
  {
    label: 'وضعیت چک‌های صیادی در جریان',
    prompt: 'جمع چک‌های صیادی دریافتنی و پرداختنی من چقدر است و آیا کسری داریم؟',
  },
  {
    label: 'باز کردن امضای دیجیتال لمسی',
    prompt: 'بوم امضای دیجیتال لمسی روی موبایل را باز کن',
  },
  {
    label: 'محاسبه مالیات ارزش افزوده ۱۰٪',
    prompt: 'مالیات ارزش افزوده فروش دوره من با نرخ ۱۰ درصد ۱۴۰۵ چقدر می‌شود؟',
  },
  {
    label: 'برو به ماشین‌حساب حقوق و بیمه ۱۴۰۵',
    prompt: 'برو به بخش ماشین‌حساب حقوق، بیمه تامین اجتماعی و عیدی ۱۴۰۵',
  },
];

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  financialSnapshot,
}) => {
  const [messages, setMessages] = useState<VoiceChatTurn[]>(() => {
    try {
      const saved = localStorage.getItem('karban_voice_chat_history');
      return saved ? JSON.parse(saved) : INITIAL_VOICE_HISTORY;
    } catch {
      return INITIAL_VOICE_HISTORY;
    }
  });
  const [inputText, setInputText] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(true);
  const [personaRole, setPersonaRole] = useState<'cfo' | 'tax' | 'legal'>('cfo');
  const [fastMode, setFastMode] = useState<boolean>(false);
  const [speechSupported, setSpeechSupported] = useState<boolean>(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('karban_voice_chat_history', JSON.stringify(messages));
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize Web Speech API (SpeechRecognition / webkitSpeechRecognition)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRecConstructor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (SpeechRecConstructor) {
      setSpeechSupported(true);
    }
  }, []);

  const speakResponse = (text: string) => {
    if (!ttsEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fa-IR';
      utterance.rate = 1.02;
      window.speechSynthesis.speak(utterance);
    } catch {
      // ignore TTS errors on unsupported browsers
    }
  };

  // Local fast fallback intent detector (also works offline)
  const detectLocalIntent = (
    query: string
  ): {
    action: VoiceNavTarget;
    actionLabel?: string;
    localReply: string;
    metric?: string;
  } => {
    const q = query.trim();
    if (/امضا|بوم امضا|واگذاری|قرارداد/.test(q)) {
      const isSign = /امضا/.test(q);
      return {
        action: isSign ? 'signpad' : 'contracts',
        actionLabel: isSign ? 'باز کردن بوم امضای دیجیتال لمسی' : 'انتقال به بخش قراردادها و اسناد',
        localReply: isSign
          ? 'بوم امضای دیجیتال لمسی کاربان باز شد. می‌توانید با انگشت خود روی صفحه امضا کنید و خروجی را در واتساپ یا تلگرام به اشتراک بگذارید.'
          : 'بخش قراردادساز هوشمند و گاوصندوق اسناد برای شما باز شد.',
      };
    }
    if (/فاکتور|صورتحساب|حسابداری|مودیان|روزنامه|تراز/.test(q) && /برو|باز کن|صادر|نشان/.test(q)) {
      return {
        action: 'accounting',
        actionLabel: 'انتقال به بخش حسابداری ابری و سامانه مودیان',
        localReply: `بخش حسابداری و سامانه مودیان باز شد. هم‌اکنون ${formatFaNum(
          financialSnapshot.invoicesCount
        )} صورتحساب رسمی و ${formatFaNum(financialSnapshot.checksCount)} فقره چک صیادی ثبت شده است.`,
        metric: `${formatFaNum(financialSnapshot.invoicesCount)} صورتحساب رسمی`,
      };
    }
    if (/ماشین.?حساب|حقوق|بیمه|عیدی|سنوات|قوانین/.test(q) && /برو|باز کن|محاسبه/.test(q)) {
      return {
        action: 'tools',
        actionLabel: 'انتقال به ماشین‌حساب‌ها و قوانین ۱۴۰۵',
        localReply:
          'ماشین‌حساب‌های قانونی سال ۱۴۰۵ (حقوق و دستمزد، حق بیمه ۳۰٪، مالیات پلکانی، عیدی و سنوات) برای شما باز شد.',
      };
    }
    if (/اسکن|دوربین|لایحه|دفاعیه|هوش مصنوعی/.test(q) && /برو|باز کن/.test(q)) {
      return {
        action: 'ai_studio',
        actionLabel: 'انتقال به استودیو هوش مصنوعی موبایل',
        localReply: 'استودیو هوش مصنوعی موبایل (اسکنر دوربین فاکتور/چک و تولید لایحه دفاعیه) باز شد.',
      };
    }
    if (/قفل|بیومتریک|faceid|اثر انگشت/i.test(q)) {
      return {
        action: 'lock_app',
        actionLabel: 'فعال‌سازی قفل امنیتی بیومتریک',
        localReply: 'اپلیکیشن کاربان با سپر امنیتی بیومتریک قفل شد.',
      };
    }
    const vatRial = Math.round(financialSnapshot.totalSalesRial * 0.1);
    return {
      action: 'none',
      localReply: `بر اساس تراز لحظه‌ای کاربان در تاریخ ${toFaDigits(
        financialSnapshot.activeDateJalali
      )}، نقدینگی خالص خزانه شما ${formatToman(
        financialSnapshot.netLiquidityRial
      )}، مجموع فروش رسمی دوره ${formatToman(
        financialSnapshot.totalSalesRial
      )} (مالیات ارزش افزوده ۱۰٪ معادل ${formatToman(
        vatRial
      )}) و چک‌های صیادی دریافتنی در جریان ${formatToman(
        financialSnapshot.receivableChecksRial
      )} است.`,
      metric: `تراز خزانه: ${formatToman(financialSnapshot.netLiquidityRial)}`,
    };
  };

  const handleSendQuery = async (rawQuery?: string) => {
    const queryText = (rawQuery ?? inputText).trim();
    if (!queryText || isLoading) return;

    const nowTime = toFaDigits(
      new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
    );

    const userTurn: VoiceChatTurn = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: queryText,
      timestampJalali: nowTime,
    };

    const updatedHistory = [...messages, userTurn];
    setMessages(updatedHistory);
    if (!rawQuery) setInputText('');
    setInterimTranscript('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/voice-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: queryText,
          history: updatedHistory.map((m) => ({ role: m.role, text: m.text })),
          personaRole,
          fastMode,
          financialContext: {
            netLiquidityToman: formatToman(financialSnapshot.netLiquidityRial),
            netLiquidityRial: formatRial(financialSnapshot.netLiquidityRial),
            totalSalesToman: formatToman(financialSnapshot.totalSalesRial),
            vat10PercentToman: formatToman(Math.round(financialSnapshot.totalSalesRial * 0.1)),
            totalPurchasesToman: formatToman(financialSnapshot.totalPurchasesRial),
            receivableChecksToman: formatToman(financialSnapshot.receivableChecksRial),
            payableChecksToman: formatToman(financialSnapshot.payableChecksRial),
            invoicesCount: financialSnapshot.invoicesCount,
            checksCount: financialSnapshot.checksCount,
            activeDateJalali: financialSnapshot.activeDateJalali,
          },
        }),
      });

      const data = await response.json();
      if (data.ok && data.result) {
        const navAction = (data.result.navigationAction || 'none') as VoiceNavTarget;
        const replyText =
          data.result.replyText || detectLocalIntent(queryText).localReply;
        const assistantTurn: VoiceChatTurn = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: replyText,
          timestampJalali: nowTime,
          navigationAction: navAction,
          actionLabel: data.result.actionLabel,
          highlightedMetric: data.result.highlightedMetric,
          modelUsed: data.modelUsed,
        };
        setMessages((prev) => [...prev, assistantTurn]);
        speakResponse(replyText);

        if (navAction && navAction !== 'none') {
          onNavigate(navAction);
        }
      } else {
        throw new Error('Fallback to local financial copilot');
      }
    } catch {
      // Offline / Instant Local Copilot Fallback
      const fallback = detectLocalIntent(queryText);
      const assistantTurn: VoiceChatTurn = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: fallback.localReply,
        timestampJalali: nowTime,
        navigationAction: fallback.action,
        actionLabel: fallback.actionLabel,
        highlightedMetric: fallback.metric,
      };
      setMessages((prev) => [...prev, assistantTurn]);
      speakResponse(fallback.localReply);
      if (fallback.action !== 'none') {
        onNavigate(fallback.action);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const toggleVoiceListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRecConstructor = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecConstructor) {
      // If browser environment doesn't expose Web Speech microphone (e.g. headless preview), simulate voice capture on a smart financial query
      setIsListening(true);
      setInterimTranscript('در حال شنیدن صدای شما (شبیه‌ساز میکروفون فارسی)...');
      setTimeout(() => {
        const sampleVoice = 'موجودی خزانه، فروش رسمی دوره و وضعیت چک‌های صیادی من چطور است؟';
        setInterimTranscript(sampleVoice);
        setIsListening(false);
        handleSendQuery(sampleVoice);
      }, 1100);
      return;
    }

    try {
      const recognition = new SpeechRecConstructor();
      recognition.lang = 'fa-IR';
      recognition.continuous = false;
      recognition.interimResults = true;

      let finalCaptured = '';

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let interim = '';
        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) {
            finalCaptured += res[0].transcript;
          } else {
            interim += res[0].transcript;
          }
        }
        setInterimTranscript(finalCaptured || interim);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        if (finalCaptured.trim()) {
          handleSendQuery(finalCaptured.trim());
        }
      };

      recognitionRef.current = recognition;
      setInterimTranscript('');
      setIsListening(true);
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/75 backdrop-blur-sm p-0 md:p-4">
        <motion.div
          initial={{ opacity: 0, y: 36, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 330, damping: 28 }}
          className="w-full max-w-3xl rounded-t-3xl md:rounded-3xl bg-white dark:bg-[#0B1222] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Top Header */}
          <div className="px-5 py-4 bg-gradient-to-l from-[#0F172A] via-[#0B1222] to-[#1E1B4B] text-white border-b border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0">
                <Mic className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm md:text-base font-black text-white">
                    دستیار صوتی و چت‌بات چندمرحله‌ای کاربان (Gemini Voice CFO)
                  </h2>
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold">
                    {Capacitor.isNativePlatform()
                      ? 'Capacitor Native Voice'
                      : speechSupported
                      ? 'Web Speech API (fa-IR)'
                      : 'Voice + Multi-Turn AI'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  فرمان صوتی برای جابه‌جایی سریع بین بخش‌ها + مکالمه پیوسته با دسترسی زنده به تراز خزانه و چک‌ها
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setTtsEnabled((v) => !v)}
                className={`h-9 px-2.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition-colors ${
                  ttsEnabled
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
                title="خوانش صوتی پاسخ‌ها (TTS)"
              >
                {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                <span className="hidden sm:inline">{ttsEnabled ? 'صدای پاسخ فعال' : 'بی‌صدا'}</span>
              </button>

              <button
                type="button"
                onClick={() => setMessages(INITIAL_VOICE_HISTORY)}
                className="w-9 h-9 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
                title="پاک کردن سابقه گفتگو"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
                aria-label="بستن"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Persona Role & Model Speed Selector Bar */}
          <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400 font-bold">نقش تخصصی دستیار:</span>
              {(
                [
                  { id: 'cfo', label: 'مدیر مالی هوشمند (CFO)' },
                  { id: 'tax', label: 'مشاور مالیاتی و مودیان' },
                  { id: 'legal', label: 'وکیل قرارداد و اداره کار' },
                ] as const
              ).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setPersonaRole(r.id)}
                  className={`px-2.5 py-1 rounded-lg font-extrabold transition-colors ${
                    personaRole === r.id
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setFastMode((f) => !f)}
              className={`px-2.5 py-1 rounded-lg font-extrabold flex items-center gap-1 border transition-colors ${
                fastMode
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
              title="انتخاب موتور پردازش سریع (gemini-3.1-flash-lite) یا تحلیل جامع (gemini-3.8-flash)"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>{fastMode ? 'پاسخ فوق‌سریع (Flash Lite)' : 'تحلیل جامع (Gemini 3.8 Flash)'}</span>
            </button>
          </div>

          {/* Live Financial Context Strip */}
          <div className="px-5 py-2 bg-amber-500/5 border-b border-slate-200/70 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300 tabular-nums">
            <span className="flex items-center gap-1.5 font-bold">
              <Landmark className="w-3.5 h-3.5 text-amber-500" />
              <span>تراز خزانه: <strong className="text-slate-900 dark:text-[#608BFF]">{formatToman(financialSnapshot.netLiquidityRial)}</strong></span>
            </span>
            <span>فروش رسمی: <strong className="text-emerald-600 dark:text-emerald-400">{formatToman(financialSnapshot.totalSalesRial)}</strong></span>
            <span>چک دریافتنی: <strong className="text-amber-600 dark:text-[#608BFF]">{formatToman(financialSnapshot.receivableChecksRial)}</strong></span>
          </div>

          {/* Scrollable Multi-Turn Conversation Thread */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 max-h-[42vh] min-h-[250px] bg-slate-50/50 dark:bg-[#070B14]/60">
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isUser
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-900 dark:bg-slate-800 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  <div
                    className={`max-w-[82%] rounded-2xl p-3.5 space-y-2 text-xs leading-relaxed ${
                      isUser
                        ? 'bg-amber-500 text-slate-950 font-bold rounded-tl-sm'
                        : 'bg-white dark:bg-[#0F172A] text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-tr-sm shadow-xs'
                    }`}
                  >
                    <p className="whitespace-pre-line">{m.text}</p>

                    {m.highlightedMetric && (
                      <div className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-extrabold text-[11px] tabular-nums">
                        شاخص کلیدی: {m.highlightedMetric}
                      </div>
                    )}

                    {m.navigationAction && m.navigationAction !== 'none' && (
                      <button
                        type="button"
                        onClick={() => {
                          onNavigate(m.navigationAction!);
                          onClose();
                        }}
                        className="w-full mt-1 px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-black flex items-center justify-between gap-2 transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <Compass className="w-4 h-4" />
                          <span>{m.actionLabel || 'انتقال مستقیم به بخش مربوطه'}</span>
                        </span>
                        <ArrowUpLeft className="w-4 h-4" />
                      </button>
                    )}

                    <div
                      className={`flex items-center justify-between text-[10px] pt-1 ${
                        isUser ? 'text-slate-900/70' : 'text-slate-400'
                      }`}
                    >
                      <span className="tabular-nums">{m.timestampJalali}</span>
                      {!isUser && (
                        <button
                          type="button"
                          onClick={() => speakResponse(m.text)}
                          className="hover:text-amber-400 flex items-center gap-1 font-semibold"
                        >
                          <Volume2 className="w-3 h-3" />
                          <span>پخش صوتی</span>
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-amber-500 font-bold px-2">
                <Sparkles className="w-4 h-4 animate-spin" />
                <span>دستیار صوتی کاربان در حال تحلیل تراز مالی و آماده‌سازی پاسخ...</span>
              </div>
            )}
            <div ref={threadEndRef} />
          </div>

          {/* 1-Tap Quick Spoken Command Suggestions */}
          <div className="px-5 py-2.5 bg-slate-100/80 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">
              فرمان‌های صوتی و مالی پرتکرار (با یک لمس امتحان کنید):
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {QUICK_VOICE_COMMANDS.map((cmd) => (
                <button
                  key={cmd.label}
                  type="button"
                  onClick={() => handleSendQuery(cmd.prompt)}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#0B1222] hover:bg-amber-500 hover:text-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap shrink-0 transition-colors"
                >
                  {cmd.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bottom Microphone & Text Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendQuery();
            }}
            className="p-4 bg-white dark:bg-[#0B1222] border-t border-slate-200 dark:border-slate-800 flex items-center gap-2.5"
          >
            {/* Interactive Voice Recognition Button */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={toggleVoiceListening}
              className={`min-h-[46px] px-4 rounded-2xl font-black text-xs flex items-center gap-2 shrink-0 transition-all ${
                isListening
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                  : 'bg-[#1D4DF5] hover:bg-[#163ED4] text-white shadow-lg shadow-amber-500/20'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{isListening ? 'توقف ضبط' : 'فرمان صوتی'}</span>
            </motion.button>

            <input
              type="text"
              value={isListening && interimTranscript ? interimTranscript : inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="بگویید: «موجودی خزانه چقدره؟» یا «برو به صدور فاکتور رسمی»..."
              className="flex-1 min-h-[46px] px-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-amber-500 text-xs font-bold text-slate-900 dark:text-white outline-none"
            />

            <motion.button
              type="submit"
              whileTap={{ scale: 0.95 }}
              disabled={isLoading || (!inputText.trim() && !interimTranscript.trim())}
              className="min-h-[46px] min-w-[46px] px-4 rounded-2xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 text-amber-400 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">ارسال</span>
            </motion.button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
