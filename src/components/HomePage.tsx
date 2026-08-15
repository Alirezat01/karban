import React, { useState, useEffect, useRef } from 'react';
import { useSEO } from '@/lib/useSEO';

import { ArrowLeft, BookOpen, Calculator, CheckCircle2, FileText, Sparkles, Scale, HeartHandshake, Zap, Check, ChevronLeft, ShieldCheck, Building2, TrendingUp, HelpCircle } from 'lucide-react';
import { isIranianMobile } from '@/lib/validation';
import { notifyAdmin } from '@/lib/notify';
import { supabase } from '@/lib/supabase';
import { normalizeMobile } from '@/lib/normalize';
import { formatFa } from '@/lib/format';

function useIntersectionObserver() {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.1 });

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}

function Reveal({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  const { ref, isVisible } = useIntersectionObserver();
  return <div ref={ref} className={`reveal-element ${isVisible ? 'visible' : ''} ${className}`}>{children}</div>;
}

export default function HomePage() {
  useSEO('کاربان | مرجع قراردادها و مدیریت کسب‌وکار', 'کاربان؛ دانلود قراردادهای معتبر، محاسبه‌گر حقوق و دستمزد، ابزارهای هوش مصنوعی و آموزش راه‌اندازی کسب‌وکار در ایران.');
  const [mobile, setMobile] = useState('');
  const [briefStatus, setBriefStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const submitBrief = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isIranianMobile(mobile)) { setBriefStatus('error'); return; }
    const { error } = await supabase.from('leads').insert({ mobile: normalizeMobile(mobile), source: 'weekly_brief' });
    if (error) { console.error('weekly brief submission failed', error); setBriefStatus('error'); return; }
    notifyAdmin(`📥 بریف هفتگی: ${normalizeMobile(mobile)}`);
    setBriefStatus('success'); setMobile('');
  };

  const industries = ['پزشکان', 'رستوران‌ها', 'برنامه‌نویسان', 'فروشگاه آنلاین', 'مشاوران املاک', 'آموزشگاه‌ها', 'طلا و جواهر', 'حمل‌ونقل'];

  return <div className="home-redesign">
    <section className="hero-section">
      <div className="girih-pattern"></div>
      <div className="container hero-content">
        <Reveal>
          <h1>رشد مطمئن کسب‌وکار شما با کاربان</h1>
          <p>از قرارداد و قانون کار تا مالیات و حسابداری؛ ابزار و تخصص موردنیاز کسب‌وکار شما، در یک مرجع مطمئن فارسی.</p>
          <div className="hero-ctas">
            <a href="/قراردادها" className="button gold-btn">شروع کنید <ArrowLeft size={16} /></a>
            <a href="/خدمات" className="button outline-gold-btn">مشاوره رایگان</a>
          </div>
        </Reveal>
        <Reveal className="hero-card-container">
          <div className="floating-card">
            <ShieldCheck size={40} className="golden-seal" />
            <div className="fc-lines">
              <div className="fc-line w-3/4"></div>
              <div className="fc-line w-full"></div>
              <div className="fc-line w-5/6"></div>
              <div className="fc-line w-1/2 mt-4"></div>
            </div>
            <div className="fc-signature"></div>
          </div>
        </Reveal>
      </div>
    </section>

    <section className="stats-section">
      <div className="container stats-grid">
        <Reveal className="stat-item"><strong>{formatFa('+۶۰')}</strong><span>قرارداد تخصصی</span></Reveal>
        <Reveal className="stat-item"><strong>{formatFa('۱۴۰۵')}</strong><span>پارامتر حقوق کار</span></Reveal>
        <Reveal className="stat-item"><strong>{formatFa('۷')}</strong><span>ابزار هوشمند</span></Reveal>
      </div>
    </section>

    <div className="marquee-wrapper">
      <div className="marquee-content">
        {[...industries, ...industries, ...industries].map((ind, i) => (
          <span key={i}>{ind} <Sparkles size={12} className="mx-2 inline text-karban-gold" /> </span>
        ))}
      </div>
    </div>

    <section className="services-section container">
      <Reveal><h2 className="section-title">خدمات جامع کاربان</h2></Reveal>
      <div className="services-grid">
        {[
          {title: 'بانک قراردادها', icon: FileText, desc: 'دانلود قراردادهای تخصصی'},
          {title: 'مشاوره روابط کار', icon: Users, desc: 'حل اختلافات کارگر و کارفرما', discount: true},
          {title: 'مشاوره مالی', icon: Calculator, desc: 'مالیات و حسابداری', discount: false},
          {title: 'بسته ثبت شرکت', icon: Building2, desc: 'ثبت و راه‌اندازی قانونی', discount: true}
        ].map((s, i) => (
          <Reveal key={i} className="service-card">
            {s.discount && <div className="discount-ribbon">تخفیف ویژه</div>}
            <s.icon size={30} />
            <h3>{s.title}</h3>
            <p>{s.desc}</p>
            <a href="/خدمات">اطلاعات بیشتر <ChevronLeft size={16} /></a>
          </Reveal>
        ))}
      </div>
    </section>

    <section className="tools-section">
      <div className="container">
        <Reveal><h2 className="section-title text-white">ابزارهای هوشمند</h2></Reveal>
        <div className="tools-grid">
          {[
            {title: 'محاسبه حقوق', href: '/ابزارهای-هوش-مصنوعی/محاسبه-حقوق'},
            {title: 'هزینه استخدام', href: '/ابزارهای-هوش-مصنوعی/هزینه-استخدام'},
            {title: 'سنوات', href: '/ابزارهای-هوش-مصنوعی/سنوات'},
            {title: 'تست سلامت', href: '/ابزارهای-هوش-مصنوعی/تست-سلامت'}
          ].map((t, i) => (
            <Reveal key={i}>
              <a href={t.href} className="tool-tile">
                <h3>{t.title}</h3>
                <ArrowLeft size={18} />
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>

    <section className="timeline-section container">
      <Reveal><h2 className="section-title">چگونه کار می‌کند؟</h2></Reveal>
      <div className="timeline">
        <div className="timeline-line"></div>
        {[
          {title: 'انتخاب نیاز', icon: HelpCircle, desc: 'قرارداد، مشاوره یا محاسبه‌گر موردنیاز خود را پیدا کنید.'},
          {title: 'تکمیل اطلاعات', icon: FileText, desc: 'فرم‌های ساده و هوشمند را تکمیل کنید.'},
          {title: 'رشد پایدار', icon: TrendingUp, desc: 'تصمیم‌های مطمئن بگیرید و کسب‌وکارتان را توسعه دهید.'}
        ].map((step, i) => (
          <Reveal key={i} className="timeline-step">
            <div className="step-icon"><step.icon size={24} /></div>
            <div className="step-content">
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>

    <section className="brief-bar"><div className="container brief-inner"><div><span>بریف هفتگی کاربان</span><p>یک نکته کاربردی برای مدیریت بهتر کسب‌وکار، هر هفته در موبایل شما.</p>{briefStatus === 'success' && <div className="feedback-success"><Check size={16} /> عضویت شما با موفقیت ثبت شد.</div>}{briefStatus === 'error' && <small className="feedback-error">شماره موبایل را به‌صورت ۱۱ رقم و با ۰۹ وارد کنید.</small>}</div><form onSubmit={submitBrief}><input type="tel" inputMode="numeric" value={mobile} onChange={(event) => { setMobile(event.target.value); setBriefStatus('idle'); }} placeholder="شماره موبایل" aria-label="شماره موبایل" /><button className="button gold-btn" type="submit">عضویت <ArrowLeft size={16} /></button></form></div></section>
  </div>;
}
