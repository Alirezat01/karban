import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Lock,
  Crown,
  ShieldAlert,
  RotateCcw,
  Zap,
  BarChart3,
  Bot,
  FileSpreadsheet,
} from 'lucide-react';
import {
  PlanType,
  TrialStatus,
  getTrialStatus,
  isProPlan,
  toFaDigits,
  resetTrial10Days,
} from '../lib/karbanData';

export interface SubscriptionGuardProps {
  plan: PlanType;
  trialStatus?: TrialStatus;
  featureTitle: string;
  featureDescription?: string;
  requiredPlan?: 'pro' | 'founder';
  onOpenUpgrade: (featureTitle?: string) => void;
  autoRedirect?: boolean;
  onTrialReset?: () => void;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const SubscriptionGuard: React.FC<SubscriptionGuardProps> = ({
  plan,
  trialStatus,
  featureTitle,
  featureDescription,
  onOpenUpgrade,
  autoRedirect = false,
  onTrialReset,
  children,
  fallback,
}) => {
  const currentTrial = trialStatus || getTrialStatus();
  const isPro = isProPlan(plan);
  const isTrialValid = !currentTrial.isExpired;
  const hasAccess = isPro || isTrialValid;

  useEffect(() => {
    if (!hasAccess && autoRedirect) {
      const timer = setTimeout(() => {
        onOpenUpgrade(featureTitle);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [hasAccess, autoRedirect, featureTitle, onOpenUpgrade]);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  const handleResetTrialClick = () => {
    resetTrial10Days();
    if (onTrialReset) {
      onTrialReset();
    } else if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const featureHighlights = [
    {
      icon: Bot,
      title: 'استودیو هوش مصنوعی و OCR',
      desc: 'اسکن مستقیم دوربین، استخراج خودکار فاکتورها و بازشناسی داده‌های چک صیادی',
    },
    {
      icon: FileSpreadsheet,
      title: 'دفاتر قانونی و تراز ۴ ستونی',
      desc: 'صدور تراز آزمایشی استاندارد، دفتر روزنامه و کل منطبق با الزامات سازمان امور مالیاتی',
    },
    {
      icon: BarChart3,
      title: 'گزارش فصلی ماده ۱۶۹ و ارزش افزوده',
      desc: 'تولید فایل رسمی TTMS برای ارسال به سامانه مودیان و کسر هوشمند اعتبارات ارزش افزوده',
    },
    {
      icon: Zap,
      title: 'رادار جریان نقدینگی و لایحه‌نگار',
      desc: 'پیش‌بینی تعهدات و مطالبات ۹۰ روزه به انضمام لوایح دفاعی قانونی موضوع ماده ۲۳۸',
    },
  ];

  return (
    <motion.div
      data-testid="subscription-guard-restricted"
      initial={{ opacity: 0, scale: 0.98, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className="crisp-card relative overflow-hidden rounded-[26px] p-4 space-y-4"
    >
      {/* Top Status Section */}
      <div className="flex flex-col gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#EEF2FF] dark:bg-[#1D2B57] text-[#1D4DF5] dark:text-[#608BFF] flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1 text-[10.5px] font-black text-rose-600 dark:text-rose-400 mb-0.5">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span>مهلت تست ۱۰ روزه به پایان رسیده است</span>
            </div>
            <h2 className="text-sm font-black text-[#0F172A] dark:text-white tracking-tight">
              {featureTitle}
            </h2>
          </div>
        </div>

        <div className="flex items-center justify-between bg-[#EFF1FA] dark:bg-[#1A223B] rounded-full px-3.5 py-2">
          <span className="text-[11px] text-slate-500 dark:text-slate-300 font-semibold">وضعیت تست رایگان:</span>
          <span className="text-xs font-black text-rose-600 dark:text-rose-400 tabular-nums">
            {toFaDigits(currentTrial.daysRemaining)} روز باقی‌مانده (منقضی)
          </span>
        </div>
      </div>

      {/* Description & Feature Rows */}
      <div className="space-y-3">
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
          {featureDescription ||
            'این بخش جزو امکانات ویژه کاربان است. برای فعال‌سازی پردازش هوشمند و دفاتر قانونی، اشتراک خود را ارتقا دهید.'}
        </p>

        <div className="grid grid-cols-1 gap-2">
          {featureHighlights.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                className="flex items-start gap-2.5 p-3 rounded-2xl bg-[#F4F5FB] dark:bg-[#1A223B] border border-slate-200/60 dark:border-slate-700/50"
              >
                <div className="w-8 h-8 rounded-xl bg-white dark:bg-[#12182B] text-[#1D4DF5] dark:text-[#608BFF] flex items-center justify-center shrink-0 shadow-xs">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <div className="text-xs font-black text-[#0F172A] dark:text-white">{feat.title}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{feat.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Buttons (Reference Cobalt Pill CTA) */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => onOpenUpgrade(featureTitle)}
          className="cobalt-pill-btn w-full min-h-[48px] px-4 py-2.5 text-xs font-black flex items-center justify-center gap-2"
        >
          <Crown className="w-4 h-4" />
          <span>مشاهده تعرفه‌ها و ارتقا به اشتراک حرفه‌ای</span>
        </motion.button>

        <button
          type="button"
          onClick={handleResetTrialClick}
          className="w-full min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full bg-[#EFF1FA] dark:bg-[#1A223B] text-slate-700 dark:text-slate-200 text-[11px] font-bold border border-slate-200/80 dark:border-slate-700/60"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#1D4DF5] dark:text-[#608BFF]" />
          <span>شارژ مجدد ۱۰ روز تست (حالت تستی)</span>
        </button>
      </div>
    </motion.div>
  );
};
