import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar,
  CheckCircle2,
  Circle,
  ArrowUpLeft,
  ShieldCheck,
  Scale,
  RotateCcw,
} from 'lucide-react';
import {
  OfficialInvoice,
  SayadiCheck,
  JournalEntry,
  PartnerRecord,
  formatRial,
  formatToman,
  toFaDigits,
} from '../lib/karbanData';
import {
  generateDailyTaxTips,
  TaxTipCategory,
  PersonalizedTaxTip,
} from '../lib/taxTipsEngine';
import taxShieldArt from '../assets/images/paperpillar_tax_shield_art_1794563328172.jpg';

interface DailyTaxSavingTipsProps {
  invoices: OfficialInvoice[];
  checks: SayadiCheck[];
  journal: JournalEntry[];
  partners: PartnerRecord[];
  activeReportDateJalali?: string;
  onNavigateTab: (tab: 'accounting' | 'ai_studio' | 'contracts' | 'tools') => void;
}

const APPLIED_STORAGE_KEY = 'karban_applied_tax_tips_v1';

const CATEGORY_TABS: { id: TaxTipCategory; label: string }[] = [
  { id: 'all', label: 'همه نکات روز' },
  { id: 'calendar', label: 'تقویم شمسی' },
  { id: 'vat_moadian', label: 'ارزش افزوده و مودیان' },
  { id: 'expenses_payroll', label: 'حقوق و هزینه‌ها' },
  { id: 'checks_risk', label: 'چک صیادی و ریسک' },
];

export const DailyTaxSavingTips: React.FC<DailyTaxSavingTipsProps> = ({
  invoices,
  checks,
  journal,
  partners,
  activeReportDateJalali,
  onNavigateTab,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<TaxTipCategory>('all');
  const [useReportDate, setUseReportDate] = useState<boolean>(false);
  const [appliedTipIds, setAppliedTipIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(APPLIED_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const report = useMemo(() => {
    return generateDailyTaxTips({
      dateInput: useReportDate && activeReportDateJalali ? activeReportDateJalali : new Date(),
      invoices,
      checks,
      journal,
      partners,
    });
  }, [useReportDate, activeReportDateJalali, invoices, checks, journal, partners]);

  const filteredTips = useMemo(() => {
    if (selectedCategory === 'all') return report.tips;
    return report.tips.filter((t) => t.category === selectedCategory);
  }, [report.tips, selectedCategory]);

  const toggleApplied = (id: string) => {
    setAppliedTipIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      if (typeof window !== 'undefined') {
        localStorage.setItem(APPLIED_STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  };

  const handleResetProgress = () => {
    setAppliedTipIds([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(APPLIED_STORAGE_KEY);
    }
  };

  const remainingSavingRial = useMemo(() => {
    return report.tips
      .filter((t) => !appliedTipIds.includes(t.id))
      .reduce((sum, t) => sum + t.estimatedSavingRial, 0);
  }, [report.tips, appliedTipIds]);

  const appliedCount = useMemo(() => {
    return report.tips.filter((t) => appliedTipIds.includes(t.id)).length;
  }, [report.tips, appliedTipIds]);

  const urgencyTextStyle = (urgency: PersonalizedTaxTip['urgency']) => {
    switch (urgency) {
      case 'فوری':
        return 'text-rose-600 dark:text-rose-400';
      case 'اولویت بالا':
        return 'text-amber-600 dark:text-amber-400';
      default:
        return 'text-emerald-600 dark:text-emerald-400';
    }
  };

  return (
    <motion.section
      data-testid="daily-tax-saving-tips"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className="crisp-card p-4 rounded-[26px] space-y-4"
    >
      {/* Header */}
      <div className="space-y-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-semibold tabular-nums">
            <Calendar className="w-3.5 h-3.5 text-[#1D4DF5] dark:text-[#608BFF] shrink-0" />
            <span className="text-[#0F172A] dark:text-[#789BFF] font-bold">
              {report.shamsiInfo.formattedLong}
            </span>
            <span aria-hidden="true">·</span>
            <span>فصل {report.shamsiInfo.seasonName}</span>
            <span aria-hidden="true">·</span>
            <span>{toFaDigits(report.shamsiInfo.daysUntilMonthEnd)} روز تا پایان ماه</span>
          </div>

          <h2 className="text-sm font-black text-[#0F172A] dark:text-white tracking-tight">
            توصیه‌های روزانه صرفه‌جویی مالیاتی
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            تحلیل زنده فاکتورهای رسمی، چک‌های صیادی و تقویم تکالیف ۱۴۰۵
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          {activeReportDateJalali && (
            <div className="grid grid-cols-2 gap-1 p-1 rounded-full bg-[#EFF1FA] dark:bg-[#1A223B]">
              <button
                type="button"
                onClick={() => setUseReportDate(false)}
                className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold transition-colors whitespace-nowrap ${
                  !useReportDate
                    ? 'bg-white dark:bg-[#12182B] text-[#0F172A] dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                امروز واقعی
              </button>
              <button
                type="button"
                onClick={() => setUseReportDate(true)}
                className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold transition-colors whitespace-nowrap tabular-nums ${
                  useReportDate
                    ? 'bg-[#1D4DF5] text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                گزارش ({toFaDigits(activeReportDateJalali)})
              </button>
            </div>
          )}

          {/* Cobalt Potential Tax Saving Banner */}
          <div className="cobalt-hero-banner p-3.5 rounded-[20px] text-white flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] text-blue-100 font-semibold">
                صرفه‌جویی قابل تحقق باقی‌مانده
              </div>
              <div className="text-[10px] text-blue-100/85 tabular-nums mt-0.5">
                {formatRial(remainingSavingRial)} · {toFaDigits(appliedCount)} از {toFaDigits(report.tips.length)} اقدام
              </div>
            </div>
            <div
              data-testid="tax-saving-potential-total"
              className="text-base font-black text-white tabular-nums shrink-0"
            >
              {formatToman(remainingSavingRial)}
            </div>
          </div>
        </div>
      </div>

      {/* Featured Tip of the Day */}
      <div
        data-testid="featured-tax-tip"
        className={`relative overflow-hidden rounded-[22px] border p-4 space-y-3 ${
          report.featuredTip.urgency === 'فوری'
            ? 'urgent-deadline-card text-[#0F172A] dark:text-white'
            : 'bg-[#F4F6FE] dark:bg-[#18213D] text-[#0F172A] dark:text-white border-blue-200/70 dark:border-slate-700/60'
        }`}
      >
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white dark:border-slate-700 bg-white shrink-0 shadow-sm flex items-center justify-center">
              <img
                src={taxShieldArt}
                alt="سپر صرفه‌جویی مالیاتی کاربان"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-[#1D4DF5] dark:text-[#608BFF] shrink-0" />
                <span className="text-[#1D4DF5] dark:text-[#608BFF] font-black">پیشنهاد برگزیده امروز</span>
                <span aria-hidden="true">·</span>
                <span>{report.featuredTip.categoryLabel}</span>
              </div>
              <h3 className="text-xs font-black text-[#0F172A] dark:text-white leading-snug">
                {report.featuredTip.title}
              </h3>
              <div className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                تأثیر برآوردی: {formatToman(report.featuredTip.estimatedSavingRial)}
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            {report.featuredTip.summary}
          </p>

          <div className="soft-chip inline-block px-2.5 py-1 text-[10px] font-semibold">
            {report.featuredTip.legalBasis} · {report.featuredTip.personalizationReason}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => toggleApplied(report.featuredTip.id)}
              className={`min-h-[42px] px-2.5 py-2 rounded-full text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors border ${
                appliedTipIds.includes(report.featuredTip.id)
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                  : 'bg-white dark:bg-[#12182B] text-[#0F172A] dark:text-slate-200 border-slate-200/80 dark:border-slate-700'
              }`}
            >
              {appliedTipIds.includes(report.featuredTip.id) ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              )}
              <span className="truncate">
                {appliedTipIds.includes(report.featuredTip.id) ? 'انجام شد' : 'ثبت انجام'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab(report.featuredTip.targetTab)}
              className="cobalt-pill-btn min-h-[42px] px-3 py-2 text-[11px] font-black flex items-center justify-center gap-1"
            >
              <span className="truncate">{report.featuredTip.actionLabel}</span>
              <ArrowUpLeft className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>
        </div>
      </div>

      {/* Category Underline Bar */}
      <div className="space-y-2">
        <div
          role="tablist"
          aria-label="فیلتر موضوعی نکات مالیاتی"
          className="flex items-center gap-3 overflow-x-auto no-scrollbar border-b border-slate-200/80 dark:border-slate-800"
        >
          {CATEGORY_TABS.map((cat) => {
            const active = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedCategory(cat.id)}
                className={`pb-2.5 px-1 text-[11px] transition-colors whitespace-nowrap shrink-0 relative ${
                  active
                    ? 'font-black text-[#1D4DF5] dark:text-[#608BFF] border-b-2 border-[#1D4DF5] dark:border-[#608BFF]'
                    : 'font-semibold text-slate-500 dark:text-slate-400'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {appliedCount > 0 && (
          <button
            type="button"
            onClick={handleResetProgress}
            className="text-xs font-bold text-slate-500 hover:text-[#1D4DF5] dark:text-slate-400 flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>بازنشانی چک‌لیست امروز</span>
          </button>
        )}
      </div>

      {/* Tips List */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800">
        <AnimatePresence mode="popLayout">
          {filteredTips.map((tip, idx) => {
            const isApplied = appliedTipIds.includes(tip.id);
            return (
              <motion.div
                key={tip.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.16, delay: idx * 0.03 }}
                data-testid={`tax-tip-row-${tip.id}`}
                className={`py-3.5 space-y-2.5 transition-opacity ${
                  tip.urgency === 'فوری' && !isApplied
                    ? 'urgent-deadline-card px-3.5 my-2 rounded-2xl border'
                    : ''
                } ${isApplied ? 'opacity-60' : 'opacity-100'}`}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    <span className={urgencyTextStyle(tip.urgency)}>{tip.urgency}</span>
                    <span aria-hidden="true">·</span>
                    <span>{tip.categoryLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Scale className="w-3 h-3 text-slate-400" />
                      {tip.legalBasis}
                    </span>
                  </div>

                  <h4
                    className={`text-xs font-black text-[#0F172A] dark:text-white leading-snug ${
                      isApplied ? 'line-through decoration-slate-400' : ''
                    }`}
                  >
                    {tip.title}
                  </h4>

                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    {tip.summary}
                  </p>

                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    داده مبنا: <span className="text-[#0F172A] dark:text-[#789BFF] font-bold">{tip.personalizationReason}</span>
                  </div>
                </div>

                {/* Impact & Controls */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="tabular-nums">
                    <div className="text-[10px] text-slate-400 font-semibold">صرفه‌جویی برآوردی</div>
                    <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                      {formatToman(tip.estimatedSavingRial)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleApplied(tip.id)}
                      aria-label={isApplied ? `لغو انجام ${tip.title}` : `ثبت انجام ${tip.title}`}
                      className={`min-h-[38px] px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1 border transition-colors whitespace-nowrap ${
                        isApplied
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          : 'bg-[#EFF1FA] dark:bg-[#1A223B] text-[#0F172A] dark:text-slate-200 border-slate-200/70 dark:border-slate-700'
                      }`}
                    >
                      {isApplied ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <span>{isApplied ? 'اجرا شد' : 'انجام شد'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onNavigateTab(tip.targetTab)}
                      className="cobalt-pill-btn min-h-[38px] px-3.5 py-1.5 text-[11px] font-extrabold flex items-center gap-1 whitespace-nowrap"
                    >
                      <span>{tip.actionLabel}</span>
                      <ArrowUpLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredTips.length === 0 && (
          <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
            <div>هیچ توصیه‌ای در این دسته‌بندی یافت نشد.</div>
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className="cobalt-pill-btn px-4 py-2 font-black text-xs"
            >
              نمایش همه توصیه‌های امروز
            </button>
          </div>
        )}
      </div>
    </motion.section>
  );
};
