import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BadgeCheck, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { isIranianMobile } from '@/lib/validation';
import { normalizeMobile } from '@/lib/normalize';
import { notifyAdmin } from '@/lib/notify';
import { formatRial, toNumericValue } from '@/lib/format';

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

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.from('services').select('*').eq('id', serviceId).maybeSingle();
      if (alive) {
        setService((data as Service) ?? null);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [serviceId]);

  const baseAmount = useMemo(() => (service ? toNumericValue(service.price) : 0), [service]);
  const discount = service?.discount_percent ?? 0;
  const finalAmount = useMemo(() => Math.round(baseAmount * (1 - discount / 100)), [baseAmount, discount]);
  const mobileOk = isIranianMobile(mobile);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!service) return;
    if (fullName.trim().length < 3) { setError('نام و نام خانوادگی را کامل وارد کنید.'); return; }
    if (!mobileOk) { setError('شماره موبایل معتبر نیست؛ نمونه درست: ۰۹۱۲۳۴۵۶۷۸۹'); return; }
    if (!terms) { setError('برای ادامه، قوانین و شرایط را بپذیرید.'); return; }
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
    if (dbError) { setError('ثبت سفارش انجام نشد؛ دوباره تلاش کنید یا از صفحه تماس پیام بدهید.'); return; }
    void notifyAdmin(`🛒 سفارش جدید: ${service.title} | ${fullName} | ${normalizeMobile(mobile)} | ${formatRial(finalAmount)} ریال`);
    setDoneCode(String(data.id).slice(0, 8));
  }

  if (loading) {
    return <section className="inner-page"><div className="container narrow-content"><p>در حال بارگذاری خدمت…</p></div></section>;
  }

  if (!service) {
    return (
      <section className="inner-page">
        <div className="container narrow-content">
          <span className="eyebrow">ثبت سفارش</span>
          <h1>خدمت پیدا نشد</h1>
          <p className="lead">خدمتی که انتخاب کرده‌اید در دسترس نیست.</p>
          <a className="button" href="/خدمات">مشاهده خدمات <ArrowLeft size={16} /></a>
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
            <p>پرداخت آنلاین به‌زودی فعال می‌شود؛ تا آن زمان همکاران ما برای هماهنگی پرداخت و شروع کار با شما تماس می‌گیرند.</p>
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
            <strong>{discount > 0 ? <s className="old-price">{formatRial(baseAmount)}</s> : null} {formatRial(finalAmount)} ریال</strong>
          </div>
          {discount > 0 && <div className="order-ribbon">تخفیف {discount}٪ فعال شد</div>}
        </div>

        <form className="consult-form order-form" onSubmit={submit} noValidate>
          <label>نام و نام خانوادگی *
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="مثلاً: علی رضایی" />
          </label>
          <label>شماره موبایل *
            <input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="۰۹۲…" inputMode="tel" className={mobile && mobileOk ? 'input-ok' : ''} />
          </label>
          {mobile && mobileOk ? <span className="ok-tick">✓ شماره معتبر است</span> : null}
          <label>ایمیل (اختیاری)
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
          <label>نام شرکت / کسب‌وکار (اختیاری)
            <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="اختیاری" />
          </label>
          <label>توضیح درخواست (اختیاری)
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="اگر نکته‌ای هست بنویسید…" />
          </label>

          <label className="terms-check">
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
            <span><a href="/قوانین" target="_blank" rel="noreferrer">قوانین و شرایط</a> کاربان را خواندم و می‌پذیرم. *</span>
          </label>

          {error ? <div className="form-error">{error}</div> : null}

          <button className="button" disabled={sending}>
            {sending ? 'در حال ثبت…' : 'ثبت سفارش'} <ArrowLeft size={16} />
          </button>
          <p className="muted-note"><ShieldCheck size={14} /> پرداخت آنلاین به‌زودی؛ فعلاً پس از ثبت سفارش، هماهنگی پرداخت تلفنی انجام می‌شود.</p>
        </form>
      </div>
    </section>
  );
}
