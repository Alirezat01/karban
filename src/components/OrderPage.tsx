import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BadgeCheck, Copy, Check, ShieldCheck, CreditCard, Landmark } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { isIranianMobile } from '@/lib/validation';
import { normalizeMobile } from '@/lib/normalize';
import { sendEmail } from '@/lib/notify';
import { notifyTelegram } from '@/lib/acc/telegram';
import { formatRial, toNumericValue } from '@/lib/format';
import KarbanLoader from '@/components/KarbanLoader';

type Service = {
  id: string;
  title: string;
  description: string;
  price: string;
  unit: string;
  featured?: boolean;
  discount_percent?: number | null;
};

type Props = { serviceId: string };

type PayInfo = {
  label: string;
  holder_name: string;
  bank_name: string;
  card_number: string;
  sheba: string;
  order: { code: string; title: string; amount: number | string; status: string; created_at: string };
};

/* نمایش کارت/شبا به شکل گروه‌چهاررقمی — اعداد LTR برای خوانایی بانکی */
const group4 = (s: string) => s.replace(/(\d{4})(?=\d)/g, '$1 ');
const formatSheba = (s: string) => {
  const clean = s.toUpperCase().replace(/\s|-/g, '');
  if (!clean.startsWith('IR')) return clean;
  return 'IR ' + clean.slice(2).replace(/(\d{4})(?=\d)/g, '$1 ');
};

export default function OrderPage({ serviceId }: Props) {
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [note, setNote] = useState('');
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [doneCode, setDoneCode] = useState('');
  const [payInfo, setPayInfo] = useState<PayInfo | null>(null);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.from('services').select('*').eq('id', serviceId).maybeSingle();
      if (alive) {
        setService((data as Service) ?? null);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [serviceId]);

  const baseAmount = useMemo(() => (service ? toNumericValue(service.price) : 0), [service]);
  const discount = service?.discount_percent ?? 0;
  const finalAmount = useMemo(() => Math.round(baseAmount * (1 - discount / 100)), [baseAmount, discount]);
  const mobileOk = isIranianMobile(mobile);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!service) return;
    if (fullName.trim().length < 3) {
      setError('نام و نام خانوادگی را کامل وارد کنید.');
      return;
    }
    if (!mobileOk) {
      setError('شماره موبایل معتبر نیست؛ نمونه درست: ۰۹۱۲۳۴۵۶۷۸۹');
      return;
    }
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('ایمیل معتبر نیست — یا آن را خالی بگذارید.');
      return;
    }
    if (!terms) {
      setError('برای ادامه، قوانین و شرایط را بپذیرید.');
      return;
    }
    setSending(true);
    const { data, error: dbError } = await supabase
      .from('orders')
      .insert({
        service_title: service.title,
        full_name: fullName.trim(),
        mobile: normalizeMobile(mobile),
        email: email.trim() || null,
        company: company.trim() || null,
        note: note.trim() || null,
        amount: finalAmount,
        terms_accepted: true,
      })
      .select()
      .single();
    setSending(false);
    if (dbError) {
      setError('ثبت سفارش انجام نشد؛ دوباره تلاش کنید یا از صفحه تماس پیام بدهید.');
      return;
    }
    const code = String(data.id).slice(0, 8);
    void notifyTelegram(`🛒 سفارش جدید: ${service.title} | ${fullName} | ${normalizeMobile(mobile)} | ${formatRial(finalAmount)}`, 'order');
    if (email.trim()) {
      void sendEmail(
        email.trim(),
        `کاربان: سفارش شما ثبت شد (${code})`,
        `سلام ${fullName.trim()}،\nسفارش «${service.title}» با کد پیگیری ${code} ثبت شد.\nهمکاران ما برای هماهنگی پرداخت و شروع کار با شما تماس می‌گیرند.\nکاربان؛ از قرارداد تا آرامش.`,
      );
    }
    setDoneCode(code);
    void loadPayInfo(code);
  }

  /* ═══ پرداخت امن: شماره کارت فقط از RPC کانونی — جدولِ کارت برای کلاینت غیرقابل‌خواندن است.
     اگر کارت فعالی نباشد یا خطا بدهد، بی‌صدا به هماهنگی تلفنی برمی‌گردیم. ═══ */
  async function loadPayInfo(code: string) {
    const { data, error } = await supabase.rpc('pay_get_account', { p_order_code: code });
    if (!error && data) setPayInfo(data as PayInfo);
  }

  async function copyText(value: string, tag: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(tag);
    setTimeout(() => setCopied(''), 1800);
  }

  if (loading) {
    return (
      <section className="inner-page">
        <div className="container narrow-content">
          <KarbanLoader label="در حال بازکردن خدمت…" />
        </div>
      </section>
    );
  }

  if (!service) {
    return (
      <section className="inner-page">
        <div className="container narrow-content">
          <span className="eyebrow">ثبت سفارش</span>
          <h1>خدمت پیدا نشد</h1>
          <p className="lead">خدمتی که انتخاب کرده‌اید در دسترس نیست.</p>
          <a className="button" href="/خدمات">
            مشاهده خدمات <ArrowLeft size={16} />
          </a>
        </div>
      </section>
    );
  }

  if (doneCode) {
    return (
      <section className="inner-page">
        <div className="container narrow-content">
          <div className="feedback-success">
            <BadgeCheck size={28} />
            <h1>سفارش شما ثبت شد</h1>
            <p>کد پیگیری: <strong>{doneCode}</strong></p>
            <p>اگر ایمیل وارد کرده باشید، رسید سفارش همین حالا برایتان ارسال شد؛ همکاران ما نیز به‌زودی تماس می‌گیرند.</p>

            {payInfo ? (
              <div className="contact-card pay-card-box" style={{ textAlign: 'right', marginTop: '1.2rem', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', justifyContent: 'center', marginBottom: '.2rem' }}>
                  <CreditCard size={18} />
                  <strong style={{ fontSize: '1rem' }}>پرداخت سفارش — {payInfo.label}</strong>
                </div>
                <div className="order-line"><span>مبلغ قابل واریز</span><strong>{formatRial(payInfo.order.amount)}</strong></div>
                <div className="order-line">
                  <span>شماره کارت ({payInfo.bank_name})</span>
                  <strong dir="ltr" style={{ letterSpacing: '.06em', display: 'inline-flex', alignItems: 'center', gap: '.4rem' }}>
                    {group4(payInfo.card_number)}
                    <button type="button" aria-label="کپی شماره کارت" onClick={() => void copyText(payInfo.card_number, 'card')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', padding: 2, color: 'inherit' }}>
                      {copied === 'card' ? <Check size={15} color="#2e7d32" /> : <Copy size={15} />}
                    </button>
                  </strong>
                </div>
                <div className="order-line">
                  <span>شماره شبا</span>
                  <strong dir="ltr" style={{ letterSpacing: '.04em', display: 'inline-flex', alignItems: 'center', gap: '.4rem', fontSize: '.92em' }}>
                    {formatSheba(payInfo.sheba)}
                    <button type="button" aria-label="کپی شماره شبا" onClick={() => void copyText(payInfo.sheba, 'sheba')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', padding: 2, color: 'inherit' }}>
                      {copied === 'sheba' ? <Check size={15} color="#2e7d32" /> : <Copy size={15} />}
                    </button>
                  </strong>
                </div>
                <div className="order-line"><span>به نام</span><strong>{payInfo.holder_name}</strong></div>
                <p style={{ fontSize: '.82rem', color: 'var(--muted)', margin: '.6rem 0 0', display: 'flex', alignItems: 'center', gap: '.35rem', justifyContent: 'center' }}>
                  <Landmark size={13} /> پس از واریز، رسید را برای پشتیبانی بفرستید تا سفارش سریع‌تر ثبت شود.
                </p>
              </div>
            ) : (
              <p className="muted-note" style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem', marginTop: '.6rem' }}>
                <ShieldCheck size={14} /> هماهنگی پرداخت به‌صورت تلفنی انجام می‌شود.
              </p>
            )}

            <a className="button" href="/">بازگشت به خانه</a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="inner-page">
      <div className="container narrow-content">
        <span className="eyebrow">ثبت سفارش</span>
        <h1>{service.title}</h1>
        <p className="article-intro">{service.description}</p>

        <div className="contact-card order-summary">
          <div className="order-line"><span>خدمت</span><strong>{service.title}</strong></div>
          <div className="order-line"><span>واحد</span><strong>{service.unit || '—'}</strong></div>
          <div className="order-line">
            <span>مبلغ</span>
            <strong>
              {discount > 0 ? <s className="old-price">{formatRial(baseAmount)}</s> : null} {formatRial(finalAmount)}
            </strong>
          </div>
          {discount > 0 && <div className="order-ribbon">تخفیف {discount}٪ فعال شد</div>}
        </div>

        <form className="consult-form order-form" onSubmit={submit} noValidate>
          <label>
            نام و نام خانوادگی <span className="req-star" title="الزامی">*</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="مثلاً: علی رضایی" />
          </label>
          <label>
            شماره موبایل <span className="req-star" title="الزامی">*</span>
            <input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="۰۹۱۲…" inputMode="tel" className={mobile && mobileOk ? 'input-ok' : ''} />
          </label>
          {mobile && mobileOk ? <span className="ok-tick">✓ شماره معتبر است</span> : null}
          <label>
            ایمیل (اختیاری — برای دریافت رسید سفارش)
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
          <label>
            نام شرکت / کسب‌وکار (اختیاری)
            <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="اختیاری" />
          </label>
          <label>
            توضیح درخواست (اختیاری)
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="اگر نکته‌ای هست بنویسید…" />
          </label>

          <label className="terms-check">
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
            <span>
              <a href="/قوانین" target="_blank" rel="noreferrer">قوانین و شرایط</a> کاربان را خواندم و می‌پذیرم. <span className="req-star" title="الزامی">*</span>
            </span>
          </label>

          {error ? <div className="form-error">{error}</div> : null}

          <button className="button" disabled={sending}>
            {sending ? 'در حال ثبت…' : 'ثبت سفارش'} <ArrowLeft size={16} />
          </button>
          <p className="muted-note">
            <ShieldCheck size={14} /> پرداخت آنلاین به‌زودی؛ فعلاً پس از ثبت سفارش، هماهنگی پرداخت تلفنی انجام می‌شود.
          </p>
        </form>
      </div>
    </section>
  );
}
