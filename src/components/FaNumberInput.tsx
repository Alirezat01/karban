/* ورودی عددی سراسری کاربان — ارقام فارسی + جداکننده سه‌رقمی زنده
   هر جا در سایت عدد وارد می‌شود (پنل ادمین، ماشین‌حساب‌ها، سازنده قرارداد…)
   باید از همین کامپوننت استفاده کند تا همه‌جا فارسی و گروه‌بندی‌شده باشد.
   • کاربر هر رقمی تایپ کند (فارسی یا انگلیسی) همان لحظه فارسی و گروه‌بندی می‌شود
   • موقعیت نشانگر هنگام ویرایش وسط رشته حفظ می‌شود
   • decimal: امکان ورود اعشار با ممیز فارسی (٫) — مثلاً ضریب ۱٫۴ یا نرخ ۰٫۰۷ */

import { useEffect, useRef, useState } from 'react';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export const toFaDigitsStr = (s: string | number) =>
  String(s).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);

export const toEnDigitsStr = (s: string) =>
  s
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));

const group3 = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, '٬');

/* نمایش نهایی: بخش صحیح گروه‌بندی‌شده + بخش اعشار با ممیز فارسی */
function formatDisplay(clean: string, decimal: boolean): string {
  if (!clean) return '';
  const dot = clean.indexOf('.');
  const intPart = dot >= 0 ? clean.slice(0, dot) : clean;
  const fracPart = dot >= 0 ? clean.slice(dot + 1) : null;
  const int = group3(intPart || '0');
  if (decimal && fracPart !== null) return `${toFaDigitsStr(int)}٫${toFaDigitsStr(fracPart)}`;
  return toFaDigitsStr(int);
}

interface Props {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  disabled?: boolean;
  /** اجازه ورود اعشار (ضریب، نرخ، سال ۰٫۵) */
  decimal?: boolean;
  'aria-label'?: string;
}

export default function FaNumberInput({
  value,
  onChange,
  className,
  style,
  placeholder,
  disabled,
  decimal = false,
  ...rest
}: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const focused = useRef(false);
  const normalize = (v: number) => {
    if (!Number.isFinite(v)) return '';
    const s = String(v);
    return formatDisplay(s, decimal);
  };
  const [text, setText] = useState(() => (value ? normalize(value) : ''));

  useEffect(() => {
    if (!focused.current) setText(value ? normalize(value) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, decimal]);

  return (
    <input
      ref={ref}
      type="text"
      dir="ltr"
      inputMode={decimal ? 'decimal' : 'numeric'}
      autoComplete="off"
      disabled={disabled}
      className={className}
      style={{ fontVariantNumeric: 'tabular-nums', ...style }}
      placeholder={placeholder || '۰'}
      aria-label={rest['aria-label']}
      value={text}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        setText(value ? normalize(value) : '');
      }}
      onChange={(e) => {
        const el = e.target;
        const raw = toEnDigitsStr(el.value);
        const filtered = decimal ? raw.replace(/[^0-9.]/g, '') : raw.replace(/[^0-9]/g, '');
        /* فقط یک نقطه + حذف صفرهای ابتدایی */
        const firstDot = filtered.indexOf('.');
        const clean =
          firstDot >= 0
            ? `${filtered.slice(0, firstDot + 1)}${filtered.slice(firstDot + 1).replace(/\./g, '')}`
            : filtered;
        const cleanTrimmed = clean.replace(/^0+(?=\d)/, '');
        const caret = el.selectionStart ?? el.value.length;
        const digitsBefore = toEnDigitsStr(el.value.slice(0, caret)).replace(/[^0-9]/g, '').length;
        const display = formatDisplay(cleanTrimmed, decimal);
        setText(display);
        onChange(Number(cleanTrimmed.replace(/\.$/, '')) || 0);
        requestAnimationFrame(() => {
          const inp = ref.current;
          if (!inp) return;
          let seen = 0;
          let i = 0;
          while (i < display.length && seen < digitsBefore) {
            if (/[۰-۹]/.test(display[i])) seen += 1;
            i += 1;
          }
          try {
            inp.setSelectionRange(i, i);
          } catch {
            /* بی‌اهمیت */
          }
        });
      }}
    />
  );
}
