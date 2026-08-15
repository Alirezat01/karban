import { useEffect, useMemo, useState } from 'react';
import { useSEO } from '@/lib/useSEO';

import { ArrowLeft, BriefcaseBusiness, Calculator, Clock, FileText, HeartHandshake, Scale, Sun, Users, WalletCards, Check } from 'lucide-react';
import { contractCatalog, contractTypes, industries, calculatorItems } from '@/data/config';
import { supabase } from '@/lib/supabase';
import { isIranianMobile } from '@/lib/validation';
import { notifyAdmin } from '@/lib/notify';
import { formatFa, formatPriceFa } from '@/lib/format';
import { normalizeMobile } from '@/lib/normalize';

const icons = [Scale, FileText, WalletCards, Calculator, Users, BriefcaseBusiness];
const toolIcons: Record<string, typeof Calculator> = { file: FileText, calculator: Calculator, sun: Sun, heart: HeartHandshake, briefcase: BriefcaseBusiness, scale: Scale, clock: Clock };
type Props = { kind: 'knowledge' | 'contracts' | 'tools' | 'simple'; title: string; description: string; eyebrow?: string };
type Service = { id: string; title: string; price: string; description: string; domain: 'financial' | 'labor'; unit: string; featured: boolean; kind: string | null; discount_percent?: number };

export default function ContentPage({
  useSEO('کاربان | صفحه محتوا', 'مطالب تخصصی حوزه مدیریت، منابع انسانی و حقوقی در پلتفرم کاربان'); kind, title, description, eyebrow = 'کاربان' }: Props) {
  const [type, setType] = useState('همه انواع قرارداد'); const [industry, setIndustry] = useState('همه صنف‌ها');
  const filteredContracts = useMemo(() => contractCatalog.filter((item) => (type === 'همه انواع قرارداد' || item.type === type) && (industry === 'همه صنف‌ها' || item.industry === industry)), [type, industry]);
  return <section className={`inner-page ${kind === 'tools' ? 'tools-page' : ''}`}><div className={`container ${kind === 'contracts' || kind === 'tools' ? '' : 'narrow-content'}`}><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p className="lead">{description}</p>
    {kind === 'knowledge' && <div className="category-grid">{['حقوقی و قانون کار', 'مالیات', 'حسابداری', 'منابع انسانی', 'مدیریت'].map((item, index) => { const Icon = icons[index]; return <a href={`/دانشنامه/${index + 1}`} className="category-card" key={item}><Icon /><h2>{item}</h2><p>راهنماها و مقاله‌های کاربردی برای تصمیم‌های مطمئن‌تر.</p><ArrowLeft size={16} /></a>; })}</div>}
    {kind === 'contracts' && <><div className="filter-panel"><strong>فیلتر دو بعدی قراردادها</strong><div className="filter-row"><select value={type} onChange={(event) => setType(event.target.value)} aria-label="نوع قرارداد"><option>همه انواع قرارداد</option>{contractTypes.map((item) => <option key={item}>{item}</option>)}</select><select value={industry} onChange={(event) => setIndustry(event.target.value)} aria-label="صنف یا شغل"><option>همه صنف‌ها</option>{industries.map((item) => <option key={item}>{item}</option>)}</select></div><small>{formatFa(filteredContracts.length)} قرارداد متناسب با انتخاب شما</small></div><div className="contract-grid">{filteredContracts.map((item) => { const Icon = icons[item.icon]; return <article className="contract-card" key={item.id}><div className="contract-card-top"><Icon /><div><small>{item.industry}</small><h2>{item.title}</h2><p>{item.description}</p></div></div><div className="contract-tiers"><span>عمومی <b>رایگان</b></span><span>تخصصی <b>قیمت ثابت</b></span><span>اختصاصی <b>متخصص</b></span></div><a className="button button-small" href={`/قراردادها/${item.id}`}>مشاهده <ArrowLeft size={15} /></a></article>; })}</div></>}
    {kind === 'tools' && <><div className="tools-hero-card"><div><h2>ابزارهای هوش مصنوعی کاربان</h2><p>با چند عدد ساده، تصویر روشن‌تری از حقوق، بیمه، مالیات و سلامت کسب‌وکار خود بسازید.</p></div><img src="/images/og-tools.png" alt="تصویر ماشین‌حساب کاربان" /></div><div className="tool-grid">{calculatorItems.map((item) => { const Icon = toolIcons[item.icon] || Calculator; return <a className="tool-card" href={item.href} key={item.title}><div className="tool-icon"><Icon size={22} /></div><h3>{item.title}</h3><p>{item.description}</p><span>ورود به ابزار <ArrowLeft size={15} /></span></a>; })}</div></>}
    {kind === 'simple' && <div className="simple-panels"><h2>همه‌چیز برای یک تصمیم بهتر</h2><p>کاربان با ترکیب آموزش، ابزار و خدمات تخصصی، مسیر مدیریت کسب‌وکار را برای شما ساده‌تر می‌کند. محتوای این بخش به‌صورت منظم به‌روز می‌شود.</p><a className="button" href="/تماس">با ما در تماس باشید <ArrowLeft size={17} /></a></div>}
  </div></section>;
}

export function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]); const [mobile, setMobile] = useState(''); const [domain, setDomain] = useState<'financial' | 'labor'>('financial'); const [service, setService] = useState(''); const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  useEffect(() => { let active = true; supabase.from('services').select('id,title,price,description,domain,unit,featured,kind,discount_percent').order('created_at').then(({ data, error }) => { if (!active) return; if (error) { console.error('services load failed', error); return; } setServices((data || []) as Service[]); }); return () => { active = false; }; }, []);
  const consultationServices = services.filter((s) => !s.kind);
  const visibleServices = consultationServices.filter((item) => item.domain === domain);
  useEffect(() => { if (visibleServices.length && !visibleServices.some((item) => item.title === service)) setService(visibleServices[0].title); }, [domain, services, service, visibleServices]);
  const submitConsultation = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!isIranianMobile(mobile) || !service) { setStatus('error'); return; } setStatus('loading'); const { error } = await supabase.from('consultation_requests').insert({ mobile: normalizeMobile(mobile), domain, service }); if (error) { console.error('consultation request failed', error); setStatus('error'); return; } notifyAdmin(`📥 مشاوره: ${service} | ${normalizeMobile(mobile)}`); setStatus('success'); setMobile(''); };
  const laborItems = consultationServices.filter((s) => s.domain === 'labor');
  const financialItems = consultationServices.filter((s) => s.domain === 'financial');
  const contractItems = services.filter((s) => s.kind);

  const renderPrice = (price: string, discount?: number) => {
    if (!discount || discount <= 0) return <strong>{formatPriceFa(price)}</strong>;
    const numPrice = parseFloat(price.replace(/,/g, ''));
    if (isNaN(numPrice)) return <strong>{formatPriceFa(price)}</strong>;
    const discounted = numPrice * (100 - discount) / 100;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ textDecoration: 'line-through', color: '#d93025', fontSize: '0.9rem' }}>{formatPriceFa(price)}</span>
        <strong style={{ color: '#d93025' }}>{formatPriceFa(discounted.toString())}</strong>
      </div>
    );
  };
  const renderRibbon = (discount?: number) => discount && discount > 0 ? <div className="discount-ribbon">تخفیف ویژه</div> : null;

  return <section className="inner-page"><div className="container"><div className="narrow-content"><span className="eyebrow">خدمات تخصصی کاربان</span><h1>خدمات تخصصی کاربان — از پرسش متنی تا همراهی کامل</h1><p className="lead">دو مسیر هم‌وزن برای امور مالی و روابط کار؛ از یک پرسش کوتاه تا همراهی کامل سازمانی.</p></div>
    {laborItems.length > 0 && <section><h2>مشاوره روابط کار</h2><div className="plans-grid">{laborItems.map((plan) => <article className={`plan-card ${plan.featured ? 'plan-featured' : ''}`} style={{position:'relative', overflow:'hidden'}} key={plan.id}>{renderRibbon(plan.discount_percent)}{plan.featured && <span className="plan-badge">پیشنهاد کاربان</span>}<h2>{plan.title}</h2><p>{plan.description}</p>{renderPrice(plan.price, plan.discount_percent)}<small>{plan.unit}</small></article>)}</div></section>}
    {financialItems.length > 0 && <section><h2>مشاوره مالی، مالیاتی و حسابرسی</h2><div className="plans-grid">{financialItems.map((plan) => <article className={`plan-card ${plan.featured ? 'plan-featured' : ''}`} style={{position:'relative', overflow:'hidden'}} key={plan.id}>{renderRibbon(plan.discount_percent)}{plan.featured && <span className="plan-badge">پیشنهاد کاربان</span>}<h2>{plan.title}</h2><p>{plan.description}</p>{renderPrice(plan.price, plan.discount_percent)}<small>{plan.unit}</small></article>)}</div></section>}
    {contractItems.length > 0 && <section><h2>خدمات قراردادی و تخصصی <span className="plan-badge" style={{ position: 'static', display: 'inline-block', marginRight: '0.5rem' }}>انجام کار توسط متخصص</span></h2><div className="plans-grid">{contractItems.map((plan) => <article className="plan-card" style={{position:'relative', overflow:'hidden'}} key={plan.id}>{renderRibbon(plan.discount_percent)}<h2>{plan.title}</h2><p>{plan.description}</p>{renderPrice(plan.price, plan.discount_percent)}<small>{plan.unit}</small></article>)}</div></section>}
    <div className="guarantee"><Scale size={23} /><span><strong>درخواست مشاوره</strong> — شماره موبایل، حوزه و خدمت موردنظر را ثبت کنید.</span></div><form className="filter-panel" onSubmit={submitConsultation}><strong>فرم درخواست مشاوره</strong><div className="filter-row"><input type="tel" inputMode="numeric" value={mobile} onChange={(event) => { setMobile(event.target.value); setStatus('idle'); }} placeholder="شماره موبایل" aria-label="شماره موبایل" /><select value={domain} onChange={(event) => setDomain(event.target.value as 'financial' | 'labor')} aria-label="حوزه"><option value="financial">مالی و مالیاتی</option><option value="labor">روابط کار</option></select><select value={service} onChange={(event) => setService(event.target.value)} aria-label="خدمت">{visibleServices.map((item) => <option value={item.title} key={item.id}>{item.title}</option>)}</select><button className="button" type="submit" disabled={status === 'loading'}>ثبت درخواست <ArrowLeft size={15} /></button></div>{status === 'success' && <div className="feedback-success"><Check size={16} /> درخواست شما ثبت شد؛ با شما تماس می‌گیریم.</div>}{status === 'error' && <small className="feedback-error">شماره موبایل معتبر و یک خدمت را انتخاب کنید.</small>}</form></div></section>;
}
