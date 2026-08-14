import { useState } from 'react';
import { ArrowLeft, BarChart3, BriefcaseBusiness, Calculator, CheckCircle2, Coins, FileText, HeartHandshake, Laptop, LockKeyhole, Scale, ShieldCheck, Sparkles, Sprout, Sun, TrendingUp } from 'lucide-react';
import { roleCards, serviceItems, specialistServices, toolItems } from '@/data/config';
import { supabase } from '@/lib/supabase';
import { isIranianMobile } from '@/lib/validation';
import { notifyAdmin } from '@/lib/notify';
import { normalizeMobile } from '@/lib/normalize';

const icons = { briefcase: BriefcaseBusiness, shield: ShieldCheck, laptop: Laptop, file: FileText, calculator: Calculator, sun: Sun, chart: BarChart3, coins: Coins, scale: Scale, heart: HeartHandshake } as const;
const values = [[LockKeyhole, 'اعتماد', 'اطلاعات و تصمیم‌های شما با دقت محافظت می‌شوند.'], [Scale, 'تخصص', 'دانش حقوقی و مالی را به زبان قابل استفاده ارائه می‌کنیم.'], [ShieldCheck, 'امنیت', 'مسیرهای امن برای قرارداد، داده و تعامل با متخصص.'], [HeartHandshake, 'همراهی', 'از سؤال اول تا اجرای تصمیم کنار شما می‌مانیم.'], [Sprout, 'رشد', 'ابزارهای ساده برای ساختن آینده‌ای بهتر.']] as const;

export default function HomePage() {
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

  return <>
    <section className="hero-home"><div className="hero-orb hero-orb-one" /><div className="hero-orb hero-orb-two" /><div className="container hero-grid">
      <div className="hero-copy"><span className="eyebrow"><Sparkles size={15} /> پلتفرم هوشمند مدیریت کسب‌وکار ایران</span><h1>کاربان، همراه مطمئن <span>رشد کسب‌وکار</span> شما</h1><p>از قرارداد و قانون کار تا مالیات و حسابداری؛ ابزار و تخصص موردنیاز کسب‌وکار شما، در یک مرجع مطمئن فارسی.</p><div className="hero-note"><CheckCircle2 size={17} /> محتوای کاربردی، ابزار واقعی، متخصصان تأییدشده</div></div>
      <div className="role-panel"><div className="role-panel-heading"><span>از کجا شروع می‌کنید؟</span><small>مسیر مناسب خود را انتخاب کنید</small></div><div className="role-cards">{roleCards.map((role) => { const Icon = icons[role.icon]; return <a className={`role-card role-${role.accent}`} href={role.href} key={role.title}><div className="role-icon"><Icon size={24} /></div><div><h2>{role.title}</h2><p>{role.description}</p></div><ArrowLeft size={18} className="role-arrow" /></a>; })}</div><a className="expert-link" href="/تماس">متخصص هستی؟ به شبکه متخصصان بپیوند <ArrowLeft size={15} /></a></div>
    </div><div className="container"><div className="hero-floats"><div className="hero-arrow"><span /></div><div className="float-card float-contract"><FileText size={17} /><span>قرارداد امن</span></div><div className="float-card float-growth"><TrendingUp size={17} /><span>رشد پایدار</span></div><div className="float-card float-coin"><Coins size={17} /><span>مدیریت مالی</span></div></div></div></section>

    <section className="section section-services"><div className="container"><div className="section-heading"><div><span className="eyebrow">یک مرجع، دو مسیر اصلی</span><h2>برای هر تصمیم مهم، کنار شما هستیم</h2></div><a className="text-link" href="/خدمات">مشاهده همه خدمات <ArrowLeft size={16} /></a></div><div className="service-grid service-grid-two">{serviceItems.map((item) => { const Icon = icons[item.icon]; return <a className="service-card service-card-large" href={item.href} key={item.title}><div className="service-icon"><Icon size={25} /></div><h3>{item.title}</h3><p>{item.description}</p><span>انتخاب این مسیر <ArrowLeft size={14} /></span><div className="service-ladder"><small>نردبان خدمات</small><b>مشاوره متنی · ۲۹۰ هزار</b><b>تلفنی ۳۰ دقیقه · ۸۹۰ هزار</b><b>حضوری ۱ ساعت · ۲,۹۰۰,۰۰۰</b><b>پکیج ماهانه · ۱۲,۹۰۰,۰۰۰</b></div></a>; })}<div className="service-card specialist-card"><span className="plan-badge">انجام کار توسط متخصص</span><div className="service-icon"><Sparkles size={25} /></div><h3>خدمات تخصصی برای سازمان شما</h3><p>وقتی یک کار باید دقیق، سریع و با مسئولیت‌پذیری انجام شود.</p><div className="specialist-list">{specialistServices.map(([title, price]) => <a href="/تماس" key={title}><span>{title}</span><b>{price}</b></a>)}</div></div></div></div></section>

    <section className="section tools-strip"><div className="container tools-cover"><div className="section-heading"><div><span className="eyebrow eyebrow-dark">ابزارهای هوشمند و تعاملی</span><h2>کمتر جست‌وجو کنید، بیشتر پیش بروید</h2></div><a className="text-link text-link-light" href="/ابزارهای-هوش-مصنوعی">همه ابزارها <ArrowLeft size={16} /></a></div><div className="tool-grid">{toolItems.map((tool) => { const Icon = icons[tool.icon]; return <a className="tool-card" href={tool.href} key={tool.title}><div className="tool-icon"><Icon size={22} /></div><h3>{tool.title}</h3><p>{tool.description}</p><span>ورود به ابزار <ArrowLeft size={15} /></span></a>; })}</div></div></section>

    <section className="section values-section"><div className="container"><div className="center-heading"><span className="eyebrow">چرا کاربان؟</span><h2>برای رشد، به یک همراه قابل اتکا نیاز دارید</h2></div><div className="values-grid">{values.map(([Icon, title, text]) => <div className="value-item" key={title}><Icon size={22} /><h3>{title}</h3><p>{text}</p></div>)}</div></div></section>
    <section className="brief-bar"><div className="container brief-inner"><div><span>بریف هفتگی کاربان</span><p>یک نکته کاربردی برای مدیریت بهتر کسب‌وکار، هر هفته در موبایل شما.</p>{briefStatus === 'success' && <div className="feedback-success"><Check size={16} /> عضویت شما با موفقیت ثبت شد.</div>}{briefStatus === 'error' && <small className="feedback-error">شماره موبایل را به‌صورت ۱۱ رقم و با ۰۹ وارد کنید.</small>}</div><form onSubmit={submitBrief}><input type="tel" inputMode="numeric" value={mobile} onChange={(event) => { setMobile(event.target.value); setBriefStatus('idle'); }} placeholder="شماره موبایل" aria-label="شماره موبایل" /><button className="button" type="submit">عضویت <ArrowLeft size={16} /></button></form></div></section>
  </>;
}
