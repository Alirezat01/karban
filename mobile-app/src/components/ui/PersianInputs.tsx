import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronRight, ChevronLeft, X } from 'lucide-react';

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toFaDigits(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/\d/g, (d) => FA_DIGITS[Number(d)])
    .replace(/[٠-٩]/g, (d) => FA_DIGITS['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]);
}

export function toEnDigits(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/**
 * Formats any number or numeric string with 3-digit separators and 100% Persian digits
 * Example: 1265000000 -> "۱٬۲۶۵٬۰۰۰٬۰۰۰"
 */
export function formatFaNum(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '۰';
  const clean = toEnDigits(String(value)).replace(/[^\d.-]/g, '');
  const num = Number(clean);
  if (isNaN(num)) return '۰';
  const isNeg = num < 0;
  const abs = Math.abs(Math.round(num));
  const withCommas = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  return (isNeg ? '−' : '') + toFaDigits(withCommas);
}

/**
 * Automatically converts all numbers in an arbitrary text block to Persian digits
 * and adds 3-digit separators (٬) to standalone numbers (skipping Jalali years 1300-1450,
 * dates with '/', and hyphenated Sayadi/national IDs).
 */
export function formatAllNumbersInText(text: string): string {
  if (!text) return text;

  // Step 1: Convert English/Arabic digits to Persian digits first
  let out = toFaDigits(text);

  // Step 2: Normalize any comma between Persian digits (, or ،) into standard Persian thousands separator (٬)
  out = out.replace(/([۰-۹])[,،](?=[۰-۹]{3})/g, '$1٬');

  // Step 3: Add 3-digit separators to standalone unformatted Persian numbers (4+ digits)
  // that are NOT preceded or followed by '/', '-', ':', or '٬'
  out = out.replace(/(?<![\/\-:٬۰-۹])([۰-۹]{4,})(?![\/\-:٬۰-۹])/g, (match) => {
    const en = toEnDigits(match);
    // Preserve leading-zero codes (like 10-digit national/postal codes starting with 0) or 16-digit raw IDs
    if (en.startsWith('0') || en.length === 10 || en.length === 16) {
      return match;
    }
    const num = Number(en);
    // Do not add comma to 4-digit Jalali/Gregorian years (1300..2100)
    if (en.length === 4 && num >= 1300 && num <= 2100) {
      return match;
    }
    const grouped = en.replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
    return toFaDigits(grouped);
  });

  return out;
}

/**
 * Global React Hook that observes the entire DOM (Dashboard, Tables, Charts, Modals, AI outputs)
 * and automatically enforces standard Persian digits and 3-digit separators everywhere.
 */
export function useGlobalPersianNumberEnforcer() {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const shouldSkipNode = (node: Node | null): boolean => {
      let curr: Node | null = node;
      while (curr && curr !== document.body) {
        if (curr instanceof HTMLElement) {
          const tag = curr.tagName;
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'CODE' || tag === 'PRE') {
            return true;
          }
          if (curr.getAttribute('dir') === 'ltr' && (tag === 'INPUT' || tag === 'PRE')) {
            // Note: FaNumberInput & FaDigitsInput format their own values directly; skip raw URL/key inputs
            const type = (curr as HTMLInputElement).type;
            if (type === 'url' || type === 'password' || type === 'email') {
              return true;
            }
          }
        }
        curr = curr.parentNode;
      }
      return false;
    };

    const processNode = (root: Node) => {
      if (shouldSkipNode(root)) return;

      if (root.nodeType === Node.TEXT_NODE) {
        const val = root.nodeValue;
        if (val && /[0-9٠-٩۰-۹]/.test(val)) {
          const formatted = formatAllNumbersInText(val);
          if (formatted !== val) {
            root.nodeValue = formatted;
          }
        }
        return;
      }

      if (root instanceof HTMLElement || root instanceof SVGElement) {
        const title = root.getAttribute('title');
        if (title && /[0-9٠-٩۰-۹]/.test(title)) {
          const formattedTitle = formatAllNumbersInText(title);
          if (formattedTitle !== title) {
            root.setAttribute('title', formattedTitle);
          }
        }
      }

      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      let current = walker.nextNode();
      while (current) {
        if (!shouldSkipNode(current)) {
          const val = current.nodeValue;
          if (val && /[0-9٠-٩۰-۹]/.test(val)) {
            const formatted = formatAllNumbersInText(val);
            if (formatted !== val) {
              current.nodeValue = formatted;
            }
          }
        }
        current = walker.nextNode();
      }
    };

    // Initial full-document pass
    processNode(document.body);

    // Live MutationObserver for any dynamic updates, tables, charts, or AI responses
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'characterData' && m.target) {
          processNode(m.target);
        } else if (m.type === 'childList') {
          m.addedNodes.forEach((n) => processNode(n));
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, []);
}

/**
 * Formats a 16-digit Sayadi ID into 4 groups of 4 Persian digits
 */
export function formatSayadiFa(id: string): string {
  const digitsOnly = toEnDigits(id).replace(/\D/g, '').slice(0, 16);
  const grouped = digitsOnly.replace(/(\d{4})(?=\d)/g, '$1-');
  return toFaDigits(grouped);
}

interface FaNumberInputProps {
  value: number;
  onChange: (newValue: number) => void;
  label?: string;
  suffix?: string;
  placeholder?: string;
  showTomanHint?: boolean;
  quickChips?: { label: string; value: number }[];
  min?: number;
  max?: number;
  className?: string;
}

export const FaNumberInput: React.FC<FaNumberInputProps> = ({
  value,
  onChange,
  label,
  suffix = 'ریال',
  placeholder = '۰',
  showTomanHint = false,
  quickChips,
  min = 0,
  max,
  className = '',
}) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawEn = toEnDigits(e.target.value).replace(/\D/g, '');
    if (!rawEn) {
      onChange(min);
      return;
    }
    let parsed = Number(rawEn);
    if (max !== undefined && parsed > max) parsed = max;
    onChange(parsed);
  };

  const displayValue = value === 0 && placeholder !== '۰' ? '' : formatFaNum(value);
  const tomanVal = Math.round((value || 0) / 10);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <input
          type="text"
          inputMode="numeric"
          dir="ltr"
          value={displayValue}
          onChange={handleInputChange}
          placeholder={toFaDigits(placeholder)}
          className="fa-num-global w-full pl-14 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0B1222] border border-slate-200 dark:border-slate-800 focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/15 text-right font-extrabold text-sm text-slate-900 dark:text-white tabular-nums transition-all outline-none"
        />
        {suffix && (
          <span className="absolute left-3 text-[11px] font-bold text-slate-400 dark:text-slate-500 pointer-events-none select-none">
            {suffix}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {showTomanHint && value > 0 && (
          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">
            معادل {formatFaNum(tomanVal)} تومان
          </span>
        )}
        {quickChips && quickChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {quickChips.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => onChange(chip.value)}
                className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/90 hover:bg-amber-500/20 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:text-amber-500 transition-colors tabular-nums"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface FaDigitsInputProps {
  value: string;
  onChange: (val: string) => void;
  label?: string;
  maxLength?: number;
  placeholder?: string;
  grouped4?: boolean;
}

export const FaDigitsInput: React.FC<FaDigitsInputProps> = ({
  value,
  onChange,
  label,
  maxLength = 16,
  placeholder = '',
  grouped4 = false,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleanEn = toEnDigits(e.target.value).replace(/\D/g, '').slice(0, maxLength);
    onChange(toFaDigits(cleanEn));
  };

  const display = grouped4 ? formatSayadiFa(value) : toFaDigits(value);

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      <input
        type="text"
        inputMode="numeric"
        dir="ltr"
        value={display}
        onChange={handleChange}
        placeholder={toFaDigits(placeholder)}
        className="fa-num-global w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0B1222] border border-slate-200 dark:border-slate-800 focus:border-amber-500 text-right font-bold text-xs md:text-sm text-slate-900 dark:text-white tabular-nums outline-none transition-all"
      />
    </div>
  );
};

export const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

export const JALALI_WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

function parseJalaliString(str: string): { year: number; month: number; day: number } {
  const en = toEnDigits(str || '1405/08/14');
  const parts = en.split('/').map((n) => parseInt(n, 10));
  const year = parts[0] && parts[0] >= 1350 && parts[0] <= 1450 ? parts[0] : 1405;
  const month = parts[1] && parts[1] >= 1 && parts[1] <= 12 ? parts[1] : 8;
  const day = parts[2] && parts[2] >= 1 && parts[2] <= 31 ? parts[2] : 14;
  return { year, month, day };
}

function formatJalaliParts(year: number, month: number, day: number): string {
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return toFaDigits(`${year}/${m}/${d}`);
}

function getDaysInJalaliMonth(year: number, month: number): number {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  // Leap year approximation for Esfand
  const isLeap = ((year + 12) % 33) % 4 === 1;
  return isLeap ? 30 : 29;
}

interface JalaliDatePickerProps {
  value: string;
  onChange: (newDateJalali: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

export const JalaliDatePicker: React.FC<JalaliDatePickerProps> = ({
  value,
  onChange,
  label,
  placeholder,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const parsed = parseJalaliString(value);
  const [viewYear, setViewYear] = useState(parsed.year);
  const [viewMonth, setViewMonth] = useState(parsed.month);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = parseJalaliString(value);
    setViewYear(p.year);
    setViewMonth(p.month);
  }, [value]);

  const daysCount = getDaysInJalaliMonth(viewYear, viewMonth);
  const firstDayOffset = (viewYear + viewMonth * 2) % 7;

  const handleSelectDay = (d: number) => {
    onChange(formatJalaliParts(viewYear, viewMonth, d));
    setIsOpen(false);
  };

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  return (
    <div ref={containerRef} className={`relative space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full min-h-[42px] px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0B1222] border border-slate-200 dark:border-slate-800 hover:border-amber-500/60 flex items-center justify-between gap-2 text-xs font-bold text-slate-900 dark:text-white transition-all"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Calendar className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="tabular-nums truncate">
            {value ? toFaDigits(value) : placeholder || 'انتخاب تاریخ'}
          </span>
        </div>
        {value ? (
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 shrink-0">
            {toFaDigits(parsed.day)} {JALALI_MONTHS[parsed.month - 1]} {toFaDigits(parsed.year)}
          </span>
        ) : (
          <span className="text-[10px] font-medium text-slate-400 shrink-0">شمسی</span>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            {/* Calendar Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <div className="text-xs font-bold text-amber-500">تقویم رسمی هجری شمسی کاربان</div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
                  انتخاب تاریخ سند / سررسید
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Month & Year Navigator */}
            <div className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-900/90 p-2 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 shadow-sm"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2">
                <select
                  value={viewMonth}
                  onChange={(e) => setViewMonth(Number(e.target.value))}
                  className="bg-transparent font-extrabold text-xs text-slate-900 dark:text-white outline-none cursor-pointer"
                >
                  {JALALI_MONTHS.map((m, idx) => (
                    <option key={m} value={idx + 1} className="bg-white dark:bg-slate-900">
                      {m}
                    </option>
                  ))}
                </select>
                <select
                  value={viewYear}
                  onChange={(e) => setViewYear(Number(e.target.value))}
                  className="bg-transparent font-extrabold text-xs text-amber-600 dark:text-amber-400 outline-none cursor-pointer tabular-nums"
                >
                  {[1402, 1403, 1404, 1405, 1406, 1407, 1408].map((yr) => (
                    <option key={yr} value={yr} className="bg-white dark:bg-slate-900">
                      {toFaDigits(yr)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 shadow-sm"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {/* Weekday Header */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {JALALI_WEEKDAYS.map((w, idx) => (
                <div
                  key={w}
                  className={`text-[11px] font-extrabold py-1 ${
                    idx === 6 ? 'text-rose-500' : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {w}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: firstDayOffset }).map((_, i) => (
                <div key={`empty-${i}`} className="h-9" />
              ))}
              {Array.from({ length: daysCount }).map((_, idx) => {
                const dayNum = idx + 1;
                const isSelected =
                  parsed.year === viewYear && parsed.month === viewMonth && parsed.day === dayNum;
                const isFriday = (firstDayOffset + idx) % 7 === 6;
                return (
                  <button
                    key={dayNum}
                    type="button"
                    onClick={() => handleSelectDay(dayNum)}
                    className={`h-9 rounded-xl text-xs font-extrabold tabular-nums flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30 scale-105'
                        : isFriday
                        ? 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20'
                        : 'bg-slate-50 dark:bg-slate-900/70 text-slate-800 dark:text-slate-200 hover:bg-amber-500/20 hover:text-amber-500'
                    }`}
                  >
                    {toFaDigits(dayNum)}
                  </button>
                );
              })}
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  onChange(toFaDigits('1405/08/10'));
                  setIsOpen(false);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-amber-500 hover:text-slate-950 transition-colors"
              >
                امروز (۱۰ آبان ۱۴۰۵)
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange(toFaDigits('1405/09/10'));
                  setIsOpen(false);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-amber-500 hover:text-slate-950 transition-colors"
              >
                چک ۱ ماهه (۱۰ آذر)
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange(toFaDigits('1405/09/30'));
                  setIsOpen(false);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-amber-500 hover:text-slate-950 transition-colors"
              >
                پایان فصل پاییز
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
