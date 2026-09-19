/* اجزای رابط مشترک پنل حسابداری */

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, X } from 'lucide-react';
import { formatInputMoney, formatMoney } from '@/lib/acc/money';
import { isoToJalaliInput, jalaliInputToISO, toFaDigits, toEnDigits } from '@/lib/acc/jalali';
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

/* ── فیلد تاریخ شمسی ── */
export function JalaliDateInput({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const [text, setText] = useState(() => isoToJalaliInput(value));
  useEffect(() => { setText(isoToJalaliInput(value)); }, [value]);
  return (
    <div style={{ display: 'flex', gap: '.4rem' }}>
      <input
        className="acc-input"
        inputMode="numeric"
        placeholder="۱۴۰۵/۰۶/۲۶"
        value={text}
        onChange={(e) => { setText(e.target.value); onChange(jalaliInputToISO(e.target.value)); }}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      />
      <button type="button" className="acc-icon-btn" title="امروز" onClick={() => { const iso = jalaliInputToISO(''); setText(isoToJalaliInput(iso)); onChange(iso); }}>
        <CalendarDays size={16} />
      </button>
    </div>
  );
}
