import React, { useState } from 'react';
import {
  Check,
  Sparkles,
  ShieldCheck,
  X,
  Lock,
  Smartphone,
  Zap,
} from 'lucide-react';
import {
  PRO_FEATURES,
  PlanType,
  formatToman,
  formatFaNum,
  toFaDigits,
  isProPlan,
  getTrialStatus,
  resetTrial10Days,
} from '../lib/karbanData';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: PlanType;
  onSelectPlan: (plan: PlanType) => void;
  highlightedFeatureTitle?: string;
  isAuthenticated?: boolean;
  onOpenAuthModal?: () => void;
  onSubmitPaymentRequest?: (payload: {
    requestedPlan: 'monthly' | 'yearly' | 'founder';
    amountRial: number;
    trackingCode: string;
    bankRef: string;
    note: string;
  }) => Promise<void>;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  currentPlan,
  onSelectPlan,
  highlightedFeatureTitle,
  isAuthenticated = false,
  onOpenAuthModal,
  onSubmitPaymentRequest,
}) => {
  const [discountCode, setDiscountCode] = useState('');
  const [discountApplied, setDiscountApplied] = useState(false);
  const [purchaseToast, setPurchaseToast] = useState<string | null>(null);
  const [trial, setTrial] = useState(() => getTrialStatus());
  const [pendingPlanTarget, setPendingPlanTarget] = useState<'monthly' | 'yearly' | 'founder' | null>(null);
  const [trackingCode, setTrackingCode] = useState('');
  const [bankRef, setBankRef] = useState('کارت به کارت / شبا بانکی');
  const [paymentNote, setPaymentNote] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  if (!isOpen) return null;

  const factor = discountApplied ? 0.75 : 1;
  const monthlyPriceRial = Math.round(4_900_000 * factor);
  const yearlyPriceRial = Math.round(49_000_000 * factor);
  const founderPriceRial = Math.round(98_000_000 * factor);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (discountCode.trim().length >= 3) {
      setDiscountApplied(true);
    }
  };

  const handleActivatePlan = (plan: PlanType, label: string) => {
    if (plan !== 'free' && onSubmitPaymentRequest) {
      if (!isAuthenticated) {
        onClose();
        onOpenAuthModal?.();
        return;
      }
      setPendingPlanTarget(plan);
      return;
    }
    onSelectPlan(plan);
    setPurchaseToast(`اشتراک «${label}» با موفقیت فعال شد و تمام ۲۱ قابلیت پیشرفته باز شدند.`);
    setTimeout(() => {
      setPurchaseToast(null);
      onClose();
    }, 1200);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingPlanTarget || !onSubmitPaymentRequest || submittingPayment) return;
    if (trackingCode.trim().length < 3) return;
    setSubmittingPayment(true);
    const amount =
      pendingPlanTarget === 'monthly'
        ? monthlyPriceRial
        : pendingPlanTarget === 'yearly'
        ? yearlyPriceRial
        : founderPriceRial;
    try {
      await onSubmitPaymentRequest({
        requestedPlan: pendingPlanTarget,
        amountRial: amount,
        trackingCode: trackingCode.trim(),
        bankRef: bankRef.trim(),
        note: paymentNote.trim(),
      });
      setPurchaseToast('درخواست پرداخت شما ثبت شد و پس از تأیید ادمین، اشتراک فوراً فعال می‌شود.');
      setPendingPlanTarget(null);
      setTrackingCode('');
      setPaymentNote('');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleResetTrial = () => {
    resetTrial10Days();
    setTrial(getTrialStatus());
    onSelectPlan('free');
    setPurchaseToast('دوره تست رایگان ۱۰ روزه کاربان با موفقیت تمدید شد.');
    setTimeout(() => setPurchaseToast(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0F172A]/55 backdrop-blur-xs">
      <div className="w-full max-w-[430px] rounded-t-[32px] frost-sheet-bg border-t border-x border-white/80 dark:border-slate-700/60 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mt-3 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/70 dark:border-slate-800/70 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/karban-logo.png"
              alt="لوگوی رسمی کاربان"
              className="w-10 h-10 object-contain rounded-full p-1 bg-white border border-slate-200 dark:border-slate-700 shadow-xs shrink-0"
            />
            <div className="min-w-0">
              <h2 className="text-sm font-black text-[#0F172A] dark:text-white truncate">
                تعرفه‌ها و اشتراک رسمی کاربان
              </h2>
              <p className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">
                ۱۰ روز تست رایگان + ۲۱ امکان حسابداری و هوش مصنوعی
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="circle-icon-btn w-10 h-10 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0"
            aria-label="بستن"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Trial Countdown Card */}
          <div
            className={`p-3.5 rounded-[22px] border flex flex-col gap-3 ${
              trial.isExpired
                ? 'bg-rose-500/10 border-rose-500/30'
                : 'crisp-card'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  trial.isExpired
                    ? 'bg-rose-500/15 text-rose-500'
                    : 'bg-[#EEF2FF] dark:bg-[#1D2B57] text-[#1D4DF5] dark:text-[#608BFF]'
                }`}
              >
                {trial.isExpired ? <Lock className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
              </div>
              <div className="space-y-0.5 min-w-0">
                <div className="text-xs font-black text-[#0F172A] dark:text-white">
                  {trial.isExpired
                    ? 'مهلت تست رایگان ۱۰ روزه کاربان به پایان رسیده است'
                    : `دوره تست ۱۰ روزه رایگان فعال است (${toFaDigits(trial.daysRemaining)} روز مانده)`}
                </div>
                <div className="text-[10.5px] text-slate-500 dark:text-slate-400">
                  {trial.isExpired
                    ? 'برای ادامه استفاده، یکی از اشتراک‌های زیر را انتخاب کنید.'
                    : 'دسترسی کامل آزمایشی به حسابداری ابری و هوش مصنوعی برقرار است.'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetTrial}
              className="self-start px-3.5 py-1.5 rounded-full bg-[#EFF1FA] dark:bg-[#1A223B] text-[11px] font-bold text-slate-700 dark:text-slate-200"
            >
              تست مجدد ۱۰ روزه
            </button>
          </div>

          {highlightedFeatureTitle && !isProPlan(currentPlan) && trial.isExpired && (
            <div className="p-3.5 rounded-[20px] bg-rose-500/10 border border-rose-500/30 flex items-center gap-3">
              <Lock className="w-5 h-5 text-rose-500 shrink-0" />
              <div className="text-xs font-bold text-[#0F172A] dark:text-rose-200">
                دسترسی به «{highlightedFeatureTitle}» نیازمند خرید اشتراک است
              </div>
            </div>
          )}

          {purchaseToast && (
            <div className="p-3.5 rounded-[20px] bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold text-center">
              {purchaseToast}
            </div>
          )}

          {pendingPlanTarget && (
            <form
              data-testid="payment-request-form"
              onSubmit={handlePaymentSubmit}
              className="crisp-card p-4 rounded-[22px] border border-[#1D4DF5]/40 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-black text-[#0F172A] dark:text-white">
                  ثبت رسید و کد پیگیری جهت تأیید ادمین
                </div>
                <button
                  type="button"
                  onClick={() => setPendingPlanTarget(null)}
                  className="text-[11px] font-bold text-slate-400"
                >
                  انصراف
                </button>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                مبلغ قابل واریز:{' '}
                <strong className="text-[#1D4DF5] dark:text-[#608BFF] tabular-nums">
                  {formatToman(
                    pendingPlanTarget === 'monthly'
                      ? monthlyPriceRial
                      : pendingPlanTarget === 'yearly'
                      ? yearlyPriceRial
                      : founderPriceRial
                  )}
                </strong>
              </div>
              <input
                type="text"
                required
                minLength={3}
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
                placeholder="شماره پیگیری / ارجاع بانکی (حداقل ۳ کاراکتر) *"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold"
              />
              <input
                type="text"
                value={bankRef}
                onChange={(e) => setBankRef(e.target.value)}
                placeholder="نام بانک یا روش واریز"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold"
              />
              <input
                type="text"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                placeholder="توضیحات تکمیلی برای ادمین (اختیاری)"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold"
              />
              <button
                type="submit"
                disabled={submittingPayment}
                className="cobalt-pill-btn w-full min-h-[42px] text-xs font-black"
              >
                {submittingPayment ? 'در حال ارسال...' : 'ارسال درخواست تأیید پرداخت به ادمین'}
              </button>
            </form>
          )}

          {/* Mobile Stacked Pricing Cards */}
          <div className="space-y-3">
            {/* Yearly Pro Featured Banner */}
            <div className="cobalt-hero-banner p-4 rounded-[24px] text-white space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-full bg-white/15 text-[10px] font-black">
                  پیشنهاد ویژه · ۲ ماه هدیه
                </span>
                <span className="text-xs font-black tabular-nums">{formatToman(yearlyPriceRial)}</span>
              </div>
              <div>
                <h3 className="text-sm font-black">اشتراک سالانه پیشرفته</h3>
                <p className="text-[11px] text-blue-100 mt-0.5 tabular-nums">
                  سالانه ({formatFaNum(yearlyPriceRial)} ریال) · تا ۵ کسب‌وکار + سامانه مودیان کامل
                </p>
              </div>
              <button
                onClick={() => handleActivatePlan('yearly', 'اشتراک سالانه پیشرفته')}
                className="w-full min-h-[44px] rounded-full bg-white text-[#1D4DF5] text-xs font-black active:scale-[0.98] transition-transform shadow-md"
              >
                {currentPlan === 'yearly' ? 'پلن فعال فعلی شما' : 'خرید و فعال‌سازی سالانه'}
              </button>
            </div>

            {/* Monthly Pro */}
            <div className="crisp-card p-4 rounded-[22px] space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-[#1D4DF5] dark:text-[#608BFF]">کسب‌وکارهای در حال رشد</div>
                  <h3 className="text-sm font-black text-[#0F172A] dark:text-white">اشتراک ماهانه پیشرفته</h3>
                </div>
                <div className="text-left">
                  <div className="text-sm font-black text-[#0F172A] dark:text-white tabular-nums">
                    {formatToman(monthlyPriceRial)}
                  </div>
                  <div className="text-[10px] text-slate-400 tabular-nums">
                    {formatFaNum(monthlyPriceRial)} ریال
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                تا ۳ کسب‌وکار، اسکنر هوشمند چک صیادی، لایحه دفاعیه، تراز ۴ ستونی و گزارش ۱۶۹
              </p>
              <button
                onClick={() => handleActivatePlan('monthly', 'اشتراک ماهانه پیشرفته')}
                className="cobalt-pill-btn w-full min-h-[42px] text-xs font-black"
              >
                {currentPlan === 'monthly' ? 'پلن فعال فعلی شما' : 'فعال‌سازی اشتراک ماهانه'}
              </button>
            </div>

            {/* Founder VIP */}
            <div className="crisp-card p-4 rounded-[22px] space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <Zap className="w-3 h-3" /> ظرفیت محدود مدیران
                  </div>
                  <h3 className="text-sm font-black text-[#0F172A] dark:text-white">پلن بنیان‌گذار (ویژه)</h3>
                </div>
                <div className="text-left">
                  <div className="text-sm font-black text-[#0F172A] dark:text-white tabular-nums">
                    {formatToman(founderPriceRial)}
                  </div>
                  <div className="text-[10px] text-slate-400 tabular-nums">
                    {formatFaNum(founderPriceRial)} ریال
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                تا ۱۰ شرکت هم‌زمان، هوش مصنوعی کاملاً نامحدود (∞) و مشاور اختصاصی مالیاتی
              </p>
              <button
                onClick={() => handleActivatePlan('founder', 'پلن بنیان‌گذار')}
                className="w-full min-h-[42px] rounded-full bg-[#0F172A] dark:bg-[#1D4DF5] text-white text-xs font-black"
              >
                {currentPlan === 'founder' ? 'پلن فعال فعلی شما' : 'فعال‌سازی پلن بنیان‌گذار'}
              </button>
            </div>

            {/* Free 10-Day */}
            <div className="crisp-card p-4 rounded-[22px] flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-black text-[#0F172A] dark:text-white">تست ۱۰ روزه رایگان</h3>
                <p className="text-[10.5px] text-slate-400 mt-0.5">بدون نیاز به کارت بانکی</p>
              </div>
              <button
                onClick={() => handleActivatePlan('free', 'تست ۱۰ روزه رایگان')}
                className="px-4 min-h-[38px] rounded-full bg-[#EFF1FA] dark:bg-[#1A223B] text-xs font-extrabold text-[#0F172A] dark:text-white shrink-0"
              >
                {currentPlan === 'free' && !trial.isExpired
                  ? `فعال (${toFaDigits(trial.daysRemaining)} روز)`
                  : 'انتخاب تست'}
              </button>
            </div>
          </div>

          {/* Coupon Form */}
          <form
            onSubmit={handleApplyCoupon}
            className="crisp-card p-3.5 rounded-[22px] space-y-2.5"
          >
            <div className="text-[11px] text-slate-600 dark:text-slate-300">
              کد تخفیف ۲۵٪ جشنواره: <strong className="text-[#1D4DF5] dark:text-[#608BFF]">کاربان۱۴۰۵</strong>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={discountCode}
                onChange={(e) => setDiscountCode(toFaDigits(e.target.value))}
                placeholder="کاربان۱۴۰۵"
                className="flex-1 px-3.5 py-2 rounded-full bg-[#EFF1FA] dark:bg-[#1A223B] text-xs font-bold text-[#0F172A] dark:text-white focus:outline-none"
              />
              <button
                type="submit"
                className="cobalt-pill-btn min-h-[38px] px-4 py-1.5 text-xs font-extrabold shrink-0"
              >
                {discountApplied ? 'اعمال شد' : 'اعمال کد'}
              </button>
            </div>
          </form>

          {/* 21 Capabilities */}
          <div className="space-y-2">
            <h3 className="text-xs font-black text-[#0F172A] dark:text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#1D4DF5] dark:text-[#608BFF]" />
              <span>۲۱ امکان انحصاری نسخه پیشرفته</span>
            </h3>
            <div className="space-y-2">
              {PRO_FEATURES.map((feat) => (
                <div
                  key={feat.key}
                  className="crisp-card p-3 rounded-[18px] flex items-start gap-2.5"
                >
                  <div className="mt-0.5 text-[#1D4DF5] dark:text-[#608BFF] shrink-0">
                    {feat.badge === 'موبایل‌پرو' ? (
                      <Smartphone className="w-4 h-4" />
                    ) : (
                      <Check className="w-4 h-4 text-emerald-500" />
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xs font-extrabold text-[#0F172A] dark:text-white">
                      {feat.title}{' '}
                      <span className="text-[10.5px] font-semibold text-[#1D4DF5] dark:text-[#608BFF]">
                        · {feat.badge}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      {feat.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-[10.5px] text-slate-500 dark:text-slate-400 pt-2 pb-4 border-t border-slate-200/70 dark:border-slate-800">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>ضمانت بازگشت وجه ۷ روزه کاربان</span>
            </span>
            <span>ارزش افزوده ۱۴۰۵: ۱۰٪</span>
          </div>
        </div>
      </div>
    </div>
  );
};
