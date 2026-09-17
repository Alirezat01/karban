/* صفحه فرود عمومی «نرم‌افزار حسابداری هوشمند کاربان» — معرفی، پلن‌ها و ثبت سفارش */

import React, { useEffect, useState } from 'react';
import {
  BadgeCheck, BarChart3, BookOpen, CheckCircle2, FileText, Printer, ShieldCheck, Sparkles, Stamp, Users, Wallet,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { notifyTelegram } from '@/lib/acc/telegram';
import { fetchAccConfig, DEFAULT_ACC_CONFIG, type AccConfig } from '@/lib/acc/config';
import { formatMoney } from '@/lib/acc/money';
import { toFaDigits } from '@/lib/acc/jalali';
import { PRO_FEATURES } from '@/lib/acc/plan';
import { Field, Modal, toast } from './ui';

const FEATURES = [
  { icon: FileText, title: 'صدور فاکتور رسمی', text: 'فاکتور فروش، پیش‌فاکتور، خرید و برگشت از فروش با شماره‌گذاری خودکار سالانه و مبلغ به حروف.' },
  { icon: Printer, title: 'خروجی استاندارد مودیان', text: 'چاپ و PDF با ساختار و ظاهر صورتحساب الکترونیکی سازمان امور مالیاتی؛ آماده نشر رسمی.' },
  { icon: BookOpen, title: 'دفترخانه خودکار', text: 'هر سند، قید دوطرفه در دفتر روزنامه؛ دفتر کل و تراز آزمایشی بدون دانش حسابداری.' },
  { icon: BadgeCheck, title: 'گزارش مالیاتی دقیق', text: 'اظهارنامه ارزش افزوده دوره، صورت معاملات فصلی ماده ۱۶۹ با خروجی Excel و نرخ مصوب ۱۴۰۵.' },
  { icon: Stamp, title: 'لوگو، امضا و مهر', text: 'آپلود لوگوی شرکت، امضای مجاز و مهر؛ فاکتور کاملاً شخصی‌سازی‌شده با برند خودتان.' },
  { icon: Users, title: 'مشتریان و بدهی‌ها', text: 'پرونده کامل طرف‌حساب‌ها با کد ملی و شماره اقتصادی؛ پیگیری مانده و تسویه هر مشتری.' },
  { icon: Wallet, title: 'نقدینگی و هزینه', text: 'بانک، صندوق، دریافت و پرداخت با مانده زنده؛ ثبت هزینه با اعتبار مالیاتی ارزش افزوده.' },
  { icon: ShieldCheck, title: 'دسترسی کنترل‌شده', text: 'دعوت حسابدار با نقش محدود، ثبت امن در دیتابیس ابری و گزارش کامل عملکرد مالی.' },
];

/* پلن‌ها از تنظیمات ادمین خوانده می‌شوند — همه مبالغ به ریال */
function buildPlans(cfg: AccConfig) {
  return [
    {
      key: 'trial', name: 'نسخه معمولی (آزمایشی)', price: 'رایگان', note: `${toFaDigits(cfg.trial_days)} روز کامل — بدون نیاز به کارت`,
      items: [
        '۱ کسب‌وکار', `تا ${formatMoney(cfg.trial_invoice_limit)} صورتحساب رسمی`, 'فاکتور رسمی استاندارد مالیاتی',
        'مشتریان، کالا/خدمات، بانک و صندوق', 'ثبت هزینه‌های روزانه', '۱۷ امکان پیشرفته خاموش',
      ],
      cta: 'شروع رایگان', href: '/حسابداری/پنل', featured: false,
    },
    {
      key: 'monthly', name: 'اشتراک ماهانه', price: formatMoney(cfg.price_monthly), note: 'ریال در ماه — نسخه پیشرفته',
      items: [
        `${formatMoney(cfg.business_limit_monthly)} کسب‌وکار`, 'صورتحساب نامحدود + خرید و برگشت', 'دفترخانه، تراز چهارستونی و سود و زیان',
        'گزارش ارزش افزوده و معاملات فصلی + CSV', 'خروجی اکسل، ورد و PDF', 'دفتر چک‌ها، انبار و یادآوری‌ها',
        'لوگو، امضا و مهر اختصاصی', 'دعوت حسابدار و صورت‌حساب طرف‌حساب', 'پشتیبانی کاربان',
      ],
      cta: 'خرید اشتراک ماهانه', featured: true,
    },
    {
      key: 'yearly', name: 'اشتراک سالانه', price: formatMoney(cfg.price_yearly), note: 'ریال در سال — ۲ ماه هدیه',
      items: [
        `${formatMoney(cfg.business_limit_yearly)} کسب‌وکار`, 'همه امکانات پلن ماهانه', 'اولویت پشتیبانی', 'قیمت ثابت تا پایان دوره',
        'آماده‌سازی اتصال به سامانه مودیان', 'مشاوره راه‌اندازی اولیه',
      ],
      cta: 'خرید اشتراک سالانه', featured: false,
    },
  ];
}

/* جدول مقایسه — تفکیک شفاف معمولی/پیشرفته (از ۱۷ امکان انحصاری) */
const COMPARE: { label: string; trial: string; monthly: string; yearly: string }[] = [
  { label: 'تعداد کسب‌وکار', trial: '۱', monthly: '۳', yearly: '۵' },
  { label: 'سقف صورتحساب رسمی', trial: '۲۰ عدد', monthly: 'نامحدود', yearly: 'نامحدود' },
  { label: 'فاکتور فروش و پیش‌فاکتور رسمی', trial: '✓', monthly: '✓', yearly: '✓' },
  { label: 'مشتریان، کالا/خدمات، بانک و صندوق', trial: '✓', monthly: '✓', yearly: '✓' },
  { label: 'ثبت هزینه روزانه', trial: '✓', monthly: '✓', yearly: '✓' },
  { label: 'فاکتور خرید و برگشت از فروش', trial: '—', monthly: '✓', yearly: '✓' },
  { label: 'دفترخانه، تراز آزمایشی چهارستونی، سود و زیان', trial: '—', monthly: '✓', yearly: '✓' },
  { label: 'گزارش ارزش افزوده و معاملات فصلی ماده ۱۶۹', trial: '—', monthly: '✓', yearly: '✓' },
  { label: 'تحلیل فروش و مشتریان', trial: '—', monthly: '✓', yearly: '✓' },
  { label: 'خروجی اکسل، ورد و PDF', trial: '—', monthly: '✓', yearly: '✓' },
  { label: 'اعتبارسنجی مالیاتی هزینه + آپلود سند', trial: '—', monthly: '✓', yearly: '✓' },
  { label: 'شناسه کالا و خدمات مودیان', trial: '—', monthly: '✓', yearly: '✓' },
  { label: 'چاپ با لوگو، امضا و مهر شخصی', trial: '—', monthly: '✓', yearly: '✓' },
  { label: 'دفتر چک‌ها + یادآوری سررسید', trial: '—', monthly: '✓', yearly: '✓' },
  { label: 'انبار و موجودی خودکار', trial: '—', monthly: '✓', yearly: '✓' },
  { label: 'صورت‌حساب و گردش طرف‌حساب', trial: '—', monthly: '✓', yearly: '✓' },
  { label: 'دعوت حسابدار', trial: '—', monthly: '✓', yearly: '✓' },
  { label: 'پشتیبانی', trial: 'پایه', monthly: 'عادی', yearly: 'اولویت‌دار' },
];

const FAQ = [
  { q: 'فاکتورهای این سیستم از نظر مالیاتی معتبرند؟', a: 'سیستم، فاکتور را دقیقاً با ساختار و ظاهر صورتحساب الکترونیکی سازمان امور مالیاتی صادر می‌کند و اطلاعات رسمی (شناسه ملی، شماره اقتصادی، کد پستی) را استاندارد نگه می‌دارد. اتصال مستقیم به سامانه مودیان در نقشه راه نسخه بعدی است؛ تا آن زمان ارسال به سامانه طبق روال جاری خودتان انجام می‌شود.' },
  { q: 'برای استفاده باید حسابداری بلد باشم؟', a: 'خیر. شما فقط فاکتور بزنید و هزینه و دریافتی‌ها را ثبت کنید؛ قیدهای دوطرفه، دفتر روزنامه، دفتر کل، تراز آزمایشی و گزارش سود و زیان به‌صورت خودکار و دقیق ساخته می‌شود.' },
  { q: 'داده‌های مالی من کجا ذخیره می‌شود؟', a: 'روی زیرساخت ابری Supabase با رمزنگاری و قوانین دسترسی سطح ردیف (RLS)؛ هیچ کاربر دیگری — حتی کاربران ثبت‌نام‌شده کاربان — به کسب‌وکار شما دسترسی ندارد و تنها حساب‌هایی که خودتان مجاز می‌کنید وارد می‌شوند.' },
  { q: 'نرخ مالیات ارزش افزوده چقدر است؟', a: 'نرخ مصوب سال ۱۴۰۵ برای عموم کالاها و خدمات ۱۰ درصد است؛ کالاهای معاف یا با نرخ خاص را می‌توانید به‌تفکیک تنظیم کنید و نرخ پیش‌فرض در تنظیمات قابل تغییر است.' },
];

export default function AccLanding() {
  const [order, setOrder] = useState<{ plan: string; label: string } | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [cfg, setCfg] = useState<AccConfig>(DEFAULT_ACC_CONFIG);

  useEffect(() => {
    fetchAccConfig().then(setCfg).catch(() => {});
  }, []);

  const plans = buildPlans(cfg);

  async function submitOrder() {
    if (!phone.trim()) { toast('شماره تماس را وارد کنید', 'error'); return; }
    setBusy(true);
    try {
      const amountRial = order?.plan === 'monthly' ? cfg.price_monthly : order?.plan === 'yearly' ? cfg.price_yearly : 0;
      const { error } = await supabase.from('orders').insert({
        mobile: phone.trim(),
        service: `نرم‌افزار حسابداری هوشمند کاربان — ${order?.label || ''}`,
        amount: `${amountRial} ریال`,
        status: 'pending',
      });
      if (error) throw error;
      void notifyTelegram(`🧾 سفارش حسابداری کاربان\nپلن: ${order?.label}\nنام: ${name || '—'}\nتماس: ${phone}\nمبلغ: ${formatMoney(amountRial)} ریال`, 'order');
      toast('سفارش شما ثبت شد؛ کارشناسان کاربان تماس می‌گیرند');
      setOrder(null);
      setName('');
      setPhone('');
    } catch {
      toast('ثبت سفارش ناموفق بود؛ با پشتیبانی تماس بگیرید', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div dir="rtl">
      {/* هیرو */}
      <section className="acc-landing-hero">
        <div className="container acc-landing-grid">
          <div>
            <span className="hero-eyebrow"><Sparkles size={13} style={{ display: 'inline', verticalAlign: '-2px', marginLeft: 4 }} /> تازه در کاربان</span>
            <h1 style={{ marginTop: '1rem' }}>نرم‌افزار حسابداری هوشمند کاربان</h1>
            <p className="hero-lead">
              حسابداری کامل و دقیق بر اساس قوانین سازمان امور مالیاتی ایران — به سادگی چند کلیک.
              فاکتور رسمی با ظاهر استاندارد مودیان بزنید، دفترخانه و گزارش‌ها را خودکار بگیرید
              و با لوگو و امضای اختصاصی، برند خودتان را روی اسناد بگذارید.
            </p>
            <div style={{ display: 'flex', gap: '.7rem', flexWrap: 'wrap' }}>
              <a className="button button-green" href="/حسابداری/پنل">شروع رایگان ۱۴ روزه</a>
              <a className="button" href="#acc-plans">مشاهده پلن‌ها</a>
            </div>
            <div style={{ display: 'flex', gap: '1.2rem', marginTop: '1.6rem', flexWrap: 'wrap' }}>
              {['نرخ ارزش افزوده مصوب ۱۴۰۵', 'دفترخانه دوطرفه خودکار', 'بدون نیاز به نصب'].map((t) => (
                <span key={t} style={{ fontSize: '.8rem', color: 'var(--muted)', display: 'inline-flex', gap: '.35rem', alignItems: 'center' }}>
                  <CheckCircle2 size={14} color="var(--gold)" />{t}
                </span>
              ))}
            </div>
          </div>
          <div className="acc-landing-mock" aria-hidden="true">
            <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '0 .4rem .8rem', borderBottom: '1px solid var(--line)', marginBottom: '.5rem' }}>
              <BarChart3 size={16} color="var(--gold)" />
              <strong style={{ fontSize: '.85rem', color: 'var(--text)' }}>داشبورد فروش — نمونه</strong>
            </div>
            {[
              ['فروش این ماه', '۴۸٬۲۰۰٬۰۰۰ ریال'],
              ['دریافتی این ماه', '۳۹٬۵۰۰٬۰۰۰ ریال'],
              ['مطالبات از مشتریان', '۱۲٬۷۰۰٬۰۰۰ ریال'],
              ['مالیات ارزش افزوده دوره', '۴٬۸۲۰٬۰۰۰ ریال'],
              ['سود خالص فصل', '۹٬۱۴۰٬۰۰۰ ریال'],
            ].map(([k, v]) => (
              <div className="mock-row" key={k}><b>{k}</b><span>{v}</span></div>
            ))}
          </div>
        </div>
      </section>

      {/* امکانات */}
      <section style={{ background: 'var(--bg2)' }}>
        <div className="container" style={{ padding: '3.5rem 1.5rem 1rem' }}>
          <div className="lux-heading"><span className="line" /><h2>هر چیزی که یک کسب‌وکار ایرانی لازم دارد</h2><span className="line" /></div>
        </div>
        <div className="container acc-features">
          {FEATURES.map((f) => (
            <div className="acc-feature" key={f.title}>
              <f.icon size={22} />
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* پلن‌ها */}
      <section id="acc-plans" style={{ paddingTop: '3.5rem' }}>
        <div className="container">
          <div className="lux-heading"><span className="line" /><h2>پلن‌های اشتراک</h2><span className="line" /></div>
          <p style={{ textAlign: 'center', maxWidth: 640, margin: '-1rem auto 2.2rem', fontSize: '.9rem' }}>
            با نسخه معمولی (آزمایشی) شروع کنید و ابزارهای پایه فروش را رایگان استفاده کنید؛ نسخه پیشرفته {PRO_FEATURES.length} امکان حرفه‌ای اضافه دارد — دفترخانه، گزارش مالیاتی، چک‌ها، انبار، خروجی چندفرمتی و… همه مبالغ به ریال.
          </p>
          <div className="acc-plans">
            {plans.map((p) => (
              <div className={`acc-plan${p.featured ? ' is-featured' : ''}`} key={p.key}>
                {p.featured ? <span className="plan-tag">پیشنهاد کاربان</span> : null}
                <h3>{p.name}</h3>
                <div className="price">{p.price}</div>
                <div className="price-note">{p.note}</div>
                <ul>{p.items.map((it) => <li key={it}>{it}</li>)}</ul>
                {p.href
                  ? <a className="button button-green full-button" href={p.href}>{p.cta}</a>
                  : <button className="button button-green full-button" onClick={() => setOrder({ plan: p.key, label: p.name })}>{p.cta}</button>}
              </div>
            ))}
          </div>

          {/* جدول مقایسه امکانات */}
          <div className="acc-compare">
            <table>
              <thead>
                <tr>
                  <th>امکانات</th>
                  <th>نسخه آزمایشی</th>
                  <th>اشتراک ماهانه</th>
                  <th>اشتراک سالانه</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td className={row.trial === '—' ? 'cmp-off' : 'cmp-on'}>{row.trial}</td>
                    <td className="cmp-on">{row.monthly}</td>
                    <td className="cmp-on">{row.yearly}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* سوالات متداول */}
      <section>
        <div className="container">
          <div className="lux-heading"><span className="line" /><h2>سوالات متداول</h2><span className="line" /></div>
          <div className="acc-faq">
            {FAQ.map((f) => (
              <div className="acc-faq-item" key={f.q}>
                <h3>{f.q}</h3>
                <p>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Modal open={!!order} onClose={() => setOrder(null)} title={`خرید ${order?.label || ''}`}>
        <div style={{ display: 'grid', gap: '.8rem' }}>
          <p style={{ fontSize: '.86rem', lineHeight: 1.9 }}>
            شماره تماس خود را ثبت کنید؛ کارشناس کاربان برای فعال‌سازی اشتراک و انتقال اطلاعات اولیه با شما تماس می‌گیرد.
          </p>
          <div className="acc-form-grid">
            <Field label="نام و نام خانوادگی"><input className="acc-input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="شماره تماس *"><input className="acc-input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          </div>
          <button className="acc-btn acc-btn-primary" disabled={busy} onClick={submitOrder}>{busy ? 'در حال ثبت…' : 'ثبت درخواست خرید'}</button>
        </div>
      </Modal>
    </div>
  );
}
