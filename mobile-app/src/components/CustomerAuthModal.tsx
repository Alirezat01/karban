import React, { useEffect, useState } from 'react';
import {
  X,
  UserPlus,
  LogIn,
  Building2,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  LogOut,
  Sparkles,
  FileSpreadsheet,
} from 'lucide-react';
import { User, signInWithPopup, signOut } from 'firebase/auth';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  UserProfile,
  createCleanWorkspace,
  createDemoWorkspace,
} from '../lib/firebase';
import { toFaDigits } from '../lib/karbanData';

interface CustomerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  firebaseUser: User | null;
  userProfile: UserProfile | null;
  onOpenAdminRegistry: () => void;
  onLoadCleanLocalWorkspace: () => void;
  onLoadDemoLocalWorkspace: () => void;
}

export const CustomerAuthModal: React.FC<CustomerAuthModalProps> = ({
  isOpen,
  onClose,
  firebaseUser,
  userProfile,
  onOpenAdminRegistry,
  onLoadCleanLocalWorkspace,
  onLoadDemoLocalWorkspace,
}) => {
  const [fullName, setFullName] = useState(userProfile?.fullName || '');
  const [businessName, setBusinessName] = useState(userProfile?.businessName || '');
  const [taxId, setTaxId] = useState(userProfile?.taxId || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [startWithDemoData, setStartWithDemoData] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile) {
      setFullName(userProfile.fullName);
      setBusinessName(userProfile.businessName);
      setTaxId(userProfile.taxId || '');
      setPhone(userProfile.phone || '');
    } else if (firebaseUser) {
      setFullName(firebaseUser.displayName || '');
    }
  }, [userProfile, firebaseUser]);

  if (!isOpen) return null;

  const handleGoogleAuth = async () => {
    if (busy) return;
    setBusy(true);
    setErrMsg(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch {
      setErrMsg('ورود با حساب گوگل لغو شد یا مرورگر پنجره ورود را مسدود کرد.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || busy) return;
    if (!fullName.trim() || !businessName.trim()) {
      setErrMsg('لطفاً نام مدیر و عنوان کسب‌وکار را وارد کنید.');
      return;
    }

    setBusy(true);
    setErrMsg(null);
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);

      if (!userProfile) {
        // First-time customer registration -> enforce plan='free' and accessStatus='trial'
        try {
          await setDoc(userRef, {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            fullName: fullName.trim(),
            businessName: businessName.trim(),
            taxId: taxId.trim(),
            phone: phone.trim(),
            plan: 'free',
            accessStatus: 'trial',
            hasSampleData: startWithDemoData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `users/${firebaseUser.uid}`);
        }

        // Create isolated personal workspace (Clean empty by default, or Demo if opted in)
        const wsRef = doc(db, 'users', firebaseUser.uid, 'workspace', 'main');
        const initialWs = startWithDemoData
          ? createDemoWorkspace(firebaseUser.uid)
          : createCleanWorkspace(firebaseUser.uid);

        try {
          await setDoc(wsRef, {
            ...initialWs,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(
            err,
            OperationType.CREATE,
            `users/${firebaseUser.uid}/workspace/main`
          );
        }

        setToast('حساب کسب‌وکار شما ساخته شد و فضای کاری اختصاصی آماده است.');
      } else {
        try {
          await updateDoc(userRef, {
            fullName: fullName.trim(),
            businessName: businessName.trim(),
            taxId: taxId.trim(),
            phone: phone.trim(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `users/${firebaseUser.uid}`);
        }
        setToast('مشخصات کسب‌وکار شما در فضای ابری ذخیره شد.');
      }

      setTimeout(() => {
        setToast(null);
        onClose();
      }, 1100);
    } catch {
      setErrMsg('ذخیره اطلاعات با خطا مواجه شد.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0F172A]/60 backdrop-blur-xs">
      <div className="w-full max-w-[430px] rounded-t-[32px] frost-sheet-bg border-t border-x border-white/80 dark:border-slate-700/60 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mt-3 shrink-0" />

        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/70 dark:border-slate-800/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#1D4DF5] text-white flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-[#0F172A] dark:text-white">
                {firebaseUser
                  ? userProfile
                    ? 'حساب کاربری و پرونده کسب‌وکار'
                    : 'تکمیل ثبت‌نام کسب‌وکار اختصاصی'
                  : 'ثبت‌نام و ورود اختصاصی کاربران'}
              </h2>
              <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                دیتابیس ابری مجزا برای هر کاربر بدون داده‌های تکراری پیش‌فرض
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="circle-icon-btn w-9 h-9 flex items-center justify-center text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          {toast && (
            <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{toast}</span>
            </div>
          )}

          {errMsg && (
            <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-bold">
              {errMsg}
            </div>
          )}

          {!firebaseUser ? (
            <div className="space-y-4">
              <div className="crisp-card p-4 rounded-[22px] space-y-2.5 text-xs">
                <div className="font-black text-[#0F172A] dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#1D4DF5]" />
                  <span>چرا ثبت‌نام اختصاصی انجام دهید؟</span>
                </div>
                <ul className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300 list-disc pr-4 leading-relaxed">
                  <li>فضای کاری تمیز و خالی اختصاصی با نام شرکت و شناسه اقتصادی خودتان</li>
                  <li>همگام‌سازی ابری فاکتورها، چک‌های صیادی و قراردادها بین موبایل و وب</li>
                  <li>ارسال کد پیگیری پرداخت و فعال‌سازی اشتراک توسط ادمین کاربان</li>
                </ul>
              </div>

              <button
                type="button"
                data-testid="customer-google-signin-btn"
                disabled={busy}
                onClick={handleGoogleAuth}
                className="cobalt-pill-btn w-full min-h-[46px] text-xs font-black flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                <span>ثبت‌نام / ورود سریع با گوگل</span>
              </button>

              <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 space-y-2">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  تنظیم سریع حالت آفلاین روی همین گوشی:
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onLoadCleanLocalWorkspace();
                      onClose();
                    }}
                    className="min-h-[40px] px-3 rounded-full bg-[#EFF1FA] dark:bg-[#1A223B] text-[11px] font-extrabold text-[#0F172A] dark:text-white"
                  >
                    پاکسازی و شروع دفتر سفید
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onLoadDemoLocalWorkspace();
                      onClose();
                    }}
                    className="min-h-[40px] px-3 rounded-full bg-[#EFF1FA] dark:bg-[#1A223B] text-[11px] font-extrabold text-slate-600 dark:text-slate-300"
                  >
                    نمایش داده‌های نمونه
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div className="crisp-card p-3.5 rounded-[20px] flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <div className="text-[10.5px] text-slate-400">ایمیل حساب متصل</div>
                  <div className="font-black text-[#0F172A] dark:text-white truncate">
                    {firebaseUser.email}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => signOut(auth)}
                  className="px-3 py-1.5 rounded-full bg-rose-500/10 text-rose-600 text-[11px] font-extrabold flex items-center gap-1 shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>خروج</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 mb-1">
                  نام و نام خانوادگی مدیر / صاحب کسب‌وکار *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="مثلاً سارا احمدی"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 mb-1">
                  نام شرکت یا فروشگاه *
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="مثلاً بازرگانی نیک‌پرداز یا فروشگاه البرز"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    شناسه ملی / کد اقتصادی
                  </label>
                  <input
                    type="text"
                    value={taxId}
                    onChange={(e) => setTaxId(toFaDigits(e.target.value))}
                    placeholder="اختیاری"
                    className="w-full px-3 py-2.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    شماره موبایل
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(toFaDigits(e.target.value))}
                    placeholder="۰۹۱۲..."
                    className="w-full px-3 py-2.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold"
                  />
                </div>
              </div>

              {!userProfile && (
                <div className="crisp-card p-3.5 rounded-[20px] space-y-2">
                  <div className="text-xs font-black text-[#0F172A] dark:text-white flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-[#1D4DF5]" />
                    <span>وضعیت داده‌های شروع کار</span>
                  </div>
                  <label className="flex items-center gap-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      name="ws-mode"
                      checked={!startWithDemoData}
                      onChange={() => setStartWithDemoData(false)}
                    />
                    <span>شروع با دفاتر تمیز و خالی (بدون اطلاعات آزمایشی)</span>
                  </label>
                  <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400 cursor-pointer">
                    <input
                      type="radio"
                      name="ws-mode"
                      checked={startWithDemoData}
                      onChange={() => setStartWithDemoData(true)}
                    />
                    <span>شروع همراه با چند فاکتور و چک نمونه جهت آشنایی</span>
                  </label>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="cobalt-pill-btn w-full min-h-[46px] text-xs font-black flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
                <span>{userProfile ? 'به‌روزرسانی پرونده کسب‌وکار' : 'ایجاد فضای کاری اختصاصی'}</span>
              </button>
            </form>
          )}

          {/* Direct link to separate Admin Registry Portal */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenAdminRegistry();
            }}
            className="w-full min-h-[42px] px-4 rounded-full border border-slate-200 dark:border-slate-700/60 text-xs font-extrabold text-slate-600 dark:text-slate-300 flex items-center justify-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4 text-[#1D4DF5]" />
            <span>ورود یا ثبت‌نام در پنل مجزای ادمین</span>
          </button>
        </div>
      </div>
    </div>
  );
};
