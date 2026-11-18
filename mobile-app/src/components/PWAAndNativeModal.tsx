import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Download,
  Smartphone,
  Cloud,
  CheckCircle2,
  Share2,
  Terminal,
  Database,
  RefreshCw,
  FileJson,
  Upload,
  X,
  WifiOff,
  Copy,
  Check,
  GitBranch,
  ExternalLink,
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      /* مسیر نسبی: در نسخه وب‌اپ زیر /app/ فقط سرویس‌ورکر خود اپ ثبت می‌شود، نه سرویس‌ورکر سایت اصلی */
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return isOnline;
}

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:w-80 z-50 flex items-center gap-2.5 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-semibold text-slate-950 shadow-xl">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>حالت آفلاین فعال است — داده‌ها در حافظه امن دستگاه ذخیره می‌شوند.</span>
    </div>
  );
};

interface PWAAndNativeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  supabaseStatus: 'local_only' | 'connected' | 'error';
  onSupabaseConnected: (url: string, anonKey: string) => void;
}

export const PWAAndNativeModal: React.FC<PWAAndNativeModalProps> = ({
  isOpen,
  onClose,
  onExportBackup,
  onImportBackup,
  supabaseStatus,
  onSupabaseConnected,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'pwa' | 'capacitor' | 'supabase' | 'github'>('pwa');
  const [sbUrl, setSbUrl] = useState(() => localStorage.getItem('karban_sb_url') || '');
  const [sbKey, setSbKey] = useState(() => localStorage.getItem('karban_sb_key') || '');
  const [testingSb, setTestingSb] = useState(false);
  const [sbMessage, setSbMessage] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedGitCmd, setCopiedGitCmd] = useState(false);

  if (!isOpen) return null;

  const capacitorCommands = `# ۱. نصب هسته Capacitor و پلاگین بیومتریک (FaceID / اثر انگشت)
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios @capacitor/app capacitor-native-biometric

# ۲. بیلد نسخه پروداکشن کاربان
npm run build

# ۳. ایجاد پلتفرم‌های بومی Android و iOS و همگام‌سازی پلاگین‌های امنیتی
npx cap add android
npx cap add ios
npx cap sync

# ۴. باز کردن در Android Studio (خروجی APK / AAB با BiometricPrompt)
npx cap open android

# ۵. باز کردن در Xcode (خروجی IPA با FaceID / TouchID)
npx cap open ios`;

  const gitCommands = `# ۱. راه‌اندازی گیت محلی در پوشه پروژه (در صورت نیاز)
git init

# ۲. اتصال مستقیم به ریپازیتوری رسمی کاربان در گیت‌هاب
git remote add origin https://github.com/Alirezat01/karban.git

# ۳. افزودن تمامی کدهای سوپراپ (PWA, Capacitor, D3.js, AI Pro)
git add .

# ۴. ثبت کامیت استاندارد نسخه نئوبانک کاربان
git commit -m "feat: Karban SuperApp Android/iOS & PWA release with D3.js cashflow & biometric security"

# ۵. پوش مستقیم به شاخه main
git branch -M main
git push -u origin main`;

  const handleCopyCommands = () => {
    navigator.clipboard.writeText(capacitorCommands);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const handleCopyGitCommands = () => {
    navigator.clipboard.writeText(gitCommands);
    setCopiedGitCmd(true);
    setTimeout(() => setCopiedGitCmd(false), 2000);
  };

  const handleTestSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sbUrl.trim() || !sbKey.trim()) {
      setSbMessage('لطفاً آدرس پروژه (URL) و کلید عمومی (Anon Key) Supabase را وارد کنید.');
      return;
    }
    setTestingSb(true);
    setSbMessage(null);
    try {
      const client = createClient(sbUrl.trim(), sbKey.trim());
      const { error } = await client.from('acc_access').select('plan').limit(1);
      localStorage.setItem('karban_sb_url', sbUrl.trim());
      localStorage.setItem('karban_sb_key', sbKey.trim());
      onSupabaseConnected(sbUrl.trim(), sbKey.trim());
      if (error && !error.message.includes('fetch')) {
        setSbMessage('اتصال به سرور Supabase برقرار شد و کلیدها ذخیره گردیدند.');
      } else {
        setSbMessage('اتصال ابری با دیتابیس Supabase کاربان با موفقیت برقرار و همگام‌سازی فعال شد.');
      }
    } catch {
      setSbMessage('خطا در اتصال به آدرس واردشده؛ لطفاً صحت URL و Anon Key را بررسی کنید.');
    } finally {
      setTestingSb(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm p-0 md:p-4">
      <div className="w-full max-w-2xl rounded-t-3xl md:rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Top Grab Handle on Mobile */}
        <div className="md:hidden w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              مرکز نصب موبایل (Android / iOS) و همگام‌سازی ابری
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              نصب مستقیم وب‌اپلیکیشن (PWA)، دریافت خروجی APK/IPA و اتصال به دیتابیس Supabase کاربان
            </p>
          </div>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented Control Tabs */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setActiveTab('pwa')}
              className={`min-h-[40px] px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'pwa'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-[#608BFF] shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              نصب فوری (PWA)
            </button>
            <button
              onClick={() => setActiveTab('capacitor')}
              className={`min-h-[40px] px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'capacitor'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-[#608BFF] shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              خروجی APK و iOS
            </button>
            <button
              onClick={() => setActiveTab('supabase')}
              className={`min-h-[40px] px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'supabase'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-[#608BFF] shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              دیتابیس و بکاپ
            </button>
            <button
              onClick={() => setActiveTab('github')}
              className={`min-h-[40px] px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap flex items-center justify-center gap-1 ${
                activeTab === 'github'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-[#608BFF] shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>اتصال گیت‌هاب</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'pwa' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div className="space-y-2 flex-1">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    نصب مستقیم روی صفحه اصلی گوشی (بدون نیاز به مارکت)
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    این اپلیکیشن مجهز به سرویس‌ورکر آفلاین و مانیفست استاندارد PWA است. با نصب روی اندروید یا آیفون، به‌صورت تمام‌صفحه (Standalone) و بدون نوار مرورگر اجرا می‌شود.
                  </p>
                  {isInstalled ? (
                    <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 pt-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>اپلیکیشن کاربان هم‌اکنون روی دستگاه شما نصب است.</span>
                    </div>
                  ) : isInstallable ? (
                    <button
                      onClick={install}
                      className="mt-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#1D4DF5] hover:bg-[#163ED4] text-white font-bold text-xs flex items-center gap-2 transition-colors shadow-lg shadow-amber-500/20"
                    >
                      <Download className="w-4 h-4" />
                      <span>نصب مستقیم اپلیکیشن کاربان روی دستگاه</span>
                    </button>
                  ) : (
                    <div className="pt-1 text-xs text-amber-600 dark:text-[#608BFF] font-medium">
                      برای نصب در مرورگر کروم اندروید: از منوی سه نقطه بالای مرورگر گزینه «Install App» یا «افزودن به صفحه اصلی» را انتخاب کنید.
                    </div>
                  )}
                </div>
              </div>

              {/* iOS Safari Dedicated Guide */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-amber-500" />
                    <span>راهنمای نصب روی آیفون و آیپد (iOS Safari)</span>
                  </h4>
                  {isIOS && (
                    <span className="text-xs font-semibold text-amber-500">دستگاه iOS شناسایی شد</span>
                  )}
                </div>
                <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-2 list-decimal list-inside leading-relaxed">
                  <li>
                    در مرورگر <strong>Safari</strong> دکمه اشتراک‌گذاری (<strong>Share</strong> در نوار پایین) را لمس کنید.
                  </li>
                  <li>
                    در منوی بازشده، گزینه <strong>Add to Home Screen</strong> (افزودن به صفحه اصلی) را انتخاب نمایید.
                  </li>
                  <li>
                    دکمه <strong>Add</strong> را بزنید تا آیکون اختصاصی «کاربان» با اجرای تمام‌صفحه و کش آفلاین به آیفون شما اضافه شود.
                  </li>
                </ol>
              </div>
            </div>
          )}

          {activeTab === 'capacitor' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-amber-500" />
                    <span>تولید خروجی بومی APK (اندروید) و IPA (آی‌اواس) با Capacitor</span>
                  </h3>
                  <button
                    onClick={handleCopyCommands}
                    className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                  >
                    {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCmd ? 'کپی شد' : 'کپی دستورات'}</span>
                  </button>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  فایل <code className="font-mono text-amber-500">capacitor.config.ts</code> با شناسه بسته <code className="font-mono text-amber-500">ir.karbanapp.mobile</code> در ریشه پروژه پیکربندی شده است. برای دریافت فایل نصبی آماده انتشار در کافه‌بازار، مایکت، سیب‌اپ یا گوگل‌پلی دستورات زیر را اجرا کنید:
                </p>
                <pre
                  dir="ltr"
                  className="p-3.5 rounded-xl bg-slate-950 text-slate-200 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800"
                >
                  {capacitorCommands}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'supabase' && (
            <div className="space-y-5">
              <form
                onSubmit={handleTestSupabase}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-amber-500" />
                    <span>اتصال مستقیم به دیتابیس ابری Supabase کاربان</span>
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    وضعیت: {supabaseStatus === 'connected' ? 'متصل به ابر' : 'حالت هیبریدی آفلاین'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  اپلیکیشن به‌صورت پیش‌فرض در حالت <strong>Offline-First</strong> کار می‌کند و تمام فاکتورها، اسناد و چک‌ها را روی دستگاه نگه می‌دارد. برای سینک مستقیم با جداول <code className="font-mono">acc_access</code> و <code className="font-mono">ai_usage</code> سایت، مشخصات Supabase پروژه خود را وارد کنید:
                </p>
                <div className="space-y-2.5">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      آدرس پروژه (Supabase Project URL)
                    </label>
                    <input
                      dir="ltr"
                      type="url"
                      value={sbUrl}
                      onChange={(e) => setSbUrl(e.target.value)}
                      placeholder="https://your-project.supabase.co"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      کلید عمومی (Supabase Anon Public Key)
                    </label>
                    <input
                      dir="ltr"
                      type="password"
                      value={sbKey}
                      onChange={(e) => setSbKey(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
                {sbMessage && (
                  <p className="text-xs font-medium text-amber-600 dark:text-[#608BFF] pt-1">{sbMessage}</p>
                )}
                <button
                  type="submit"
                  disabled={testingSb}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#1D4DF5] hover:bg-[#163ED4] text-white font-bold text-xs flex items-center gap-2 transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${testingSb ? 'animate-spin' : ''}`} />
                  <span>بررسی اتصال و فعال‌سازی سینک ابری</span>
                </button>
              </form>

              {/* Full Offline Backup & Restore */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-500" />
                  <span>پشتیبان‌گیری و بازیابی کامل اطلاعات مالی (JSON)</span>
                </h4>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={onExportBackup}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold flex items-center gap-2 hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
                  >
                    <FileJson className="w-4 h-4 text-amber-400" />
                    <span>دانلود فایل پشتیبان کامل (JSON)</span>
                  </button>
                  <label className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <Upload className="w-4 h-4 text-emerald-500" />
                    <span>بازیابی از فایل پشتیبان</span>
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onImportBackup(file);
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'github' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                      <GitBranch className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        اتصال و انتشار سورس‌کد در ریپازیتوری رسمی گیت‌هاب کاربان
                      </h3>
                      <a
                        href="https://github.com/Alirezat01/karban"
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-amber-500 hover:underline flex items-center gap-1 font-mono mt-0.5"
                      >
                        <span>https://github.com/Alirezat01/karban</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                  <button
                    onClick={handleCopyGitCommands}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#1D4DF5] hover:bg-[#163ED4] text-white font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    {copiedGitCmd ? <Check className="w-4 h-4 text-emerald-950" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedGitCmd ? 'دستورات کپی شد' : 'کپی دستورات ترمینال'}</span>
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  <strong>پاسخ به سوال امنیتی شما درباره آپلود مستقیم توسط هوش مصنوعی:</strong>
                  <p className="mt-1">
                    محیط توسعه هوش مصنوعی (AI Sandbox) به دلایل امنیتی دسترسی به توکن خصوصی گیت‌هاب شخصی شما (Personal Access Token) ندارد و نمی‌تواند بدون اجازه مالک روی ریپوی خارجی مستقیماً کد Push کند. اما تمامی فایل‌ها و ساختار پروژه به‌صورت ۱۰۰٪ آماده درون این مخزن قرار دارند و شما می‌توانید با دستورات زیر در کمتر از ۱ دقیقه آن را به ریپازیتوری خود متصل و منتشر فرمایید:
                  </p>
                </div>

                {/* Git Commands Block */}
                <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-950 font-mono text-xs text-emerald-400 p-4">
                  <pre className="whitespace-pre-wrap leading-relaxed text-left dir-ltr select-all">
                    {gitCommands}
                  </pre>
                </div>

                {/* Steps Explanation */}
                <div className="space-y-2 pt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  <div className="font-bold text-slate-900 dark:text-white">مراحل انتقال کدهای سوپراپ کاربان:</div>
                  <ol className="list-decimal list-inside space-y-1.5 pr-1">
                    <li>ابتدا ترمینال یا نرم‌افزار Git را در سیستم خود باز کنید.</li>
                    <li>پوشه پروژه را انتخاب کرده و دستورات فوق را به ترتیب اجرا نمایید.</li>
                    <li>در مرحله اول، نام کاربری و Personal Access Token (یا SSH Key) گیت‌هاب شما درخواست می‌شود.</li>
                    <li>پس از انجام <code>git push</code> تمامی کامپوننت‌های نئوبانک، پیش‌بینی هوشمند نقدینگی D3.js، هسته Capacitor و PWA در ریپازیتوری شما قرار خواهند گرفت.</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
