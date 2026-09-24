/* اجزای رابط مشترک پنل حسابداری */

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, X } from 'lucide-react';
import { formatInputMoney, formatMoney } from '@/lib/acc/money';
import {
  dateToISO, isoToJalaliInput, JALALI_MONTHS, jalaliInputToISO, jalaliMonthLength,
  toEnDigits, toFaDigits, toGregorian, toJalali,
} from '@/lib/acc/jalali';
import './acc.css';

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="acc-field">
      <label>{label}</label>
      {children}
      {hint ? <span className="acc-hint">{hint}</span> : null}
    </div>
  );
}

export function Badge({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'draft'; children: React.ReactNode }) {
  return <span className={`acc-badge ${tone}`}>{children}</span>;
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="acc-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`acc-modal${wide ? ' acc-modal-wide' : ''}`} role="dialog" aria-modal="true">
        <div className="acc-modal-head">
          <h3>{title}</h3>
          <button className="acc-icon-btn" onClick={onClose} aria-label="بستن"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, hint }: { icon?: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="acc-empty">
      {icon}
      <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '.3rem' }}>{title}</p>
      {hint ? <p style={{ fontSize: '.8rem' }}>{hint}</p> : null}
    </div>
  );
}

/* ── توست ── */
type ToastMsg = { id: number; text: string; type: 'ok' | 'error' };
const TOAST_EVENT = 'acc-toast';

export function toast(text: string, type: 'ok' | 'error' = 'ok') {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { text, type } }));
}

export function ToastHost() {
  const [items, setItems] = useState<ToastMsg[]>([]);
  useEffect(() => {
    const onToast = (e: Event) => {
      const { text, type } = (e as CustomEvent).detail as { text: string; type: 'ok' | 'error' };
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev, { id, text, type }]);
      setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3200);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);
  return <div className="acc-toast-wrap">{items.map((t) => <div key={t.id} className={`acc-toast ${t.type === 'error' ? 'error' : ''}`}>{t.text}</div>)}</div>;
}

/* ── تأیید.promise ── */
type ConfirmFn = (message: string, danger?: boolean) => Promise<boolean>;
let confirmHandler: ConfirmFn | null = null;
export const confirmAction: ConfirmFn = (message, danger = true) =>
  confirmHandler ? confirmHandler(message, danger) : Promise.resolve(window.confirm(message));

export function ConfirmHost() {
  const [state, setState] = useState<{ message: string; danger: boolean; resolve: (v: boolean) => void } | null>(null);
  useEffect(() => {
    confirmHandler = (message, danger = true) => new Promise<boolean>((resolve) => setState({ message, danger, resolve }));
    return () => { confirmHandler = null; };
  }, []);
  if (!state) return null;
  const close = (v: boolean) => { state.resolve(v); setState(null); };
  return (
    <Modal open onClose={() => close(false)} title="تأیید عملیات">
      <div style={{ display: 'flex', gap: '.8rem', alignItems: 'flex-start', marginBottom: '1.2rem' }}>
        <AlertTriangle size={22} color={state.danger ? '#ef9a94' : 'var(--gold)'} style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: '.9rem', lineHeight: 1.9 }}>{state.message}</p>
      </div>
      <div style={{ display: 'flex', gap: '.6rem', justifyContent: 'flex-start' }}>
        <button className={`acc-btn ${state.danger ? 'acc-btn-danger' : 'acc-btn-primary'}`} onClick={() => close(true)}>بله، انجام بده</button>
        <button className="acc-btn acc-btn-outline" onClick={() => close(false)}>انصراف</button>
      </div>
    </Modal>
  );
}

/* ── ورودی مبلغ با گروه‌بندی فارسی زنده ──
   کاربر هر رقمی (فارسی یا انگلیسی) تایپ کند:
   • همان لحظه به ارقام فارسی تبدیل می‌شود
   • جداکننده سه‌رقمی (٬) همان لحظه اعمال می‌شود
   • موقعیت نشانگر هنگام ویرایش وسط رشته حفظ می‌شود */
export function MoneyInput({ value, onChange, placeholder, disabled, big }: { value: number; onChange: (n: number) => void; placeholder?: string; disabled?: boolean; big?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => (value ? formatInputMoney(value) : ''));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value ? formatInputMoney(value) : '');
  }, [value]);

  return (
    <input
      ref={ref}
      className="acc-input num"
      dir="ltr"
      inputMode="numeric"
      disabled={disabled}
      style={big ? { textAlign: 'left', minHeight: 46, fontSize: '1rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' } : { textAlign: 'left', fontVariantNumeric: 'tabular-nums' }}
      placeholder={placeholder || '۰'}
      value={text}
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; setText(value ? formatInputMoney(value) : ''); }}
      onChange={(e) => {
        const el = e.target;
        const caret = el.selectionStart ?? el.value.length;
        const digitsBefore = toEnDigits(el.value.slice(0, caret)).replace(/\D/g, '').length;
        const digits = toEnDigits(el.value).replace(/\D/g, '').replace(/^0+(?=\d)/, '');
        const n = Number(digits || '0');
        const display = digits ? formatMoney(n) : '';
        setText(display);
        onChange(n);
        requestAnimationFrame(() => {
          const inp = ref.current;
          if (!inp) return;
          let seen = 0, i = 0;
          while (i < display.length && seen < digitsBefore) {
            if (/[۰-۹]/.test(display[i])) seen += 1;
            i += 1;
          }
          inp.setSelectionRange(i, i);
        });
      }}
    />
  );
}

/* ── ورودی ارقام فارسی برای شناسه‌ها (کد ملی، اقتصادی، پستی، تلفن، شماره سند…) ──
   هر چه تایپ شود فارسی ذخیره و نمایش داده می‌شود؛ حروف اضافه حذف می‌شود.
   allow: نویسه‌های مجاز اضافی مثل «-/» برای شماره فاکتور */
export function DigitsInput({
  value, onChange, placeholder, disabled, allow, maxLength = 40,
}: {
  value: string | null | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allow?: string;
  maxLength?: number;
}) {
  const [text, setText] = useState(() => toFaDigits(value || ''));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(toFaDigits(value || '')); }, [value]);
  const strip = (s: string) => {
    const esc = (allow || '').replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
    const re = new RegExp(`[^0-9${esc}]`, 'g');
    return toEnDigits(s).replace(re, '').slice(0, maxLength);
  };
  return (
    <input
      className="acc-input num"
      dir="ltr"
      inputMode={allow ? 'text' : 'numeric'}
      disabled={disabled}
      placeholder={placeholder}
      value={text}
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; setText(toFaDigits(value || '')); }}
      onChange={(e) => {
        const clean = strip(e.target.value);
        setText(toFaDigits(clean));
        onChange(clean);
      }}
      style={{ textAlign: 'left', fontVariantNumeric: 'tabular-nums' }}
    />
  );
}

/* ── ورودی مقدار/تعداد با ارقام فارسی و اعشار فارسی (٫) ── */
export function QtyInput({
  value, onChange, placeholder, disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState(() => (value ? toFaDigits(String(value)).replace('.', '٫') : ''));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(value ? toFaDigits(String(value)).replace('.', '٫') : ''); }, [value]);

  return (
    <input
      className="acc-input num"
      dir="ltr"
      inputMode="decimal"
      disabled={disabled}
      placeholder={placeholder || '۱'}
      value={text}
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; setText(value ? toFaDigits(String(value)).replace('.', '٫') : ''); }}
      onChange={(e) => {
        let en = toEnDigits(e.target.value).replace(/[٫,]/g, '.').replace(/[^0-9.]/g, '');
        const first = en.indexOf('.');
        if (first >= 0) en = en.slice(0, first + 1) + en.slice(first + 1).replace(/\./g, '');
        setText(en ? toFaDigits(en).replace('.', '٫') : '');
        onChange(Number(en) || 0);
      }}
      style={{ textAlign: 'left', fontVariantNumeric: 'tabular-nums' }}
    />
  );
}

/* ── تقویم شمسی سراسری — پاپ‌آپ ماهانه ──
   تقویم ایرانی برای همهٔ فیلدهای تاریخ پنل (یک کامپوننت، ۳۳+ نقطهٔ استفاده).
   کلیک روز → ISO؛ ناوبری ماه/سال؛ دکمهٔ «امروز»؛ بستن با کلیک بیرون یا Escape */
function JalaliCalendar({ iso, onPick, onClose }: { iso: string; onPick: (d: string) => void; onClose: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const initial = iso ? isoToJalaliParts(iso) : todayJalaliParts();
  const [viewY, setViewY] = useState(initial.jy);
  const [viewM, setViewM] = useState(initial.jm);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const monthLen = jalaliMonthLength(viewY, viewM);
  /* روز هفتهٔ اول ماه: ۰ = شنبه */
  const firstG = toGregorian(viewY, viewM, 1);
  const firstDow = (new Date(firstG.gy, firstG.gm - 1, firstG.gd).getDay() + 1) % 7;
  const todayJ = todayJalaliParts();
  const selJ = iso ? isoToJalaliParts(iso) : null;

  const shift = (dm: number) => {
    let m = viewM + dm, y = viewY;
    if (m > 12) { m = 1; y++; } if (m < 1) { m = 12; y--; }
    setViewM(m); setViewY(y);
  };

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= monthLen; d++) cells.push(d);

  return (
    <div ref={wrapRef} className="acc-cal" role="dialog" aria-label="تقویم شمسی">
      <div className="acc-cal-head">
        <button type="button" className="acc-icon-btn" aria-label="سال قبل" onClick={() => setViewY(viewY - 1)}>«</button>
        <button type="button" className="acc-icon-btn" aria-label="ماه قبل" onClick={() => shift(-1)}>‹</button>
        <b style={{ flex: 1, textAlign: 'center' }}>{JALALI_MONTHS[viewM - 1]} {toFaDigits(viewY)}</b>
        <button type="button" className="acc-icon-btn" aria-label="ماه بعد" onClick={() => shift(1)}>›</button>
        <button type="button" className="acc-icon-btn" aria-label="سال بعد" onClick={() => setViewY(viewY + 1)}>»</button>
      </div>
      <div className="acc-cal-grid">
        {['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map((d) => <span key={d} className="acc-cal-dow">{d}</span>)}
        {cells.map((d, i) => {
          if (d === null) return <span key={`e${i}`} />;
          const g = toGregorian(viewY, viewM, d);
          const cellIso = dateToISO(new Date(g.gy, g.gm - 1, g.gd));
          const isToday = todayJ.jy === viewY && todayJ.jm === viewM && todayJ.jd === d;
          const isSel = !!selJ && selJ.jy === viewY && selJ.jm === viewM && selJ.jd === d;
          return (
            <button
              type="button"
              key={d}
              className={`acc-cal-day${isToday ? ' is-today' : ''}${isSel ? ' is-sel' : ''}`}
              onClick={() => { onPick(cellIso); onClose(); }}
            >{toFaDigits(d)}</button>
          );
        })}
      </div>
      <button type="button" className="acc-cal-today" onClick={() => { onPick(dateToISO(new Date(toGregorian(todayJ.jy, todayJ.jm, todayJ.jd).gy, toGregorian(todayJ.jy, todayJ.jm, todayJ.jd).gm - 1, toGregorian(todayJ.jy, todayJ.jm, todayJ.jd).gd))); onClose(); }}>
        امروز — {toFaDigits(`${todayJ.jy}/${String(todayJ.jm).padStart(2, '0')}/${String(todayJ.jd).padStart(2, '0')}`)}
      </button>
    </div>
  );
}

/* ابزار کوچک: تبدیل ISO به اجزای جلالی (بدون وابستگی جدید) */
function isoToJalaliParts(iso: string): { jy: number; jm: number; jd: number } {
  const d = new Date(iso + 'T00:00:00');
  return toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
}
function todayJalaliParts(): { jy: number; jm: number; jd: number } {
  return isoToJalaliParts(dateToISO(new Date()));
}

/* ── فیلد تاریخ شمسی (تقویم + تایپ دستی) ── */
export function JalaliDateInput({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const [text, setText] = useState(() => isoToJalaliInput(value));
  const [open, setOpen] = useState(false);
  useEffect(() => { setText(isoToJalaliInput(value)); }, [value]);
  return (
    <div style={{ display: 'flex', gap: '.4rem', position: 'relative' }}>
      <input
        className="acc-input"
        inputMode="numeric"
        placeholder="۱۴۰۵/۰۶/۲۶"
        value={text}
        onChange={(e) => { setText(e.target.value); onChange(jalaliInputToISO(e.target.value)); }}
        onFocus={() => setOpen(true)}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      />
      <button type="button" className="acc-icon-btn" title="تقویم" onClick={() => setOpen((v) => !v)}>
        <CalendarDays size={16} />
      </button>
      {open && (
        <JalaliCalendar
          iso={value}
          onPick={(iso) => { setText(isoToJalaliInput(iso)); onChange(iso); }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
