import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BriefcaseBusiness, Calculator, Clock, FileText, HeartHandshake, Scale, Sun, Users, WalletCards } from 'lucide-react';
import { contractCatalog, calculatorItems } from '@/data/config';
import { supabase } from '@/lib/supabase';
import { isIranianMobile } from '@/lib/validation';
import { normalizeMobile } from '@/lib/normalize';

const icons = [Scale, FileText, WalletCards, Calculator, Users, BriefcaseBusiness];
const toolIcons: Record<string, typeof Calculator> = { file: FileText, calculator: Calculator, sun: Sun, heart: HeartHandshake, briefcase: BriefcaseBusiness, scale: Scale, clock: Clock };
type Props = { kind: 'knowledge' | 'contracts' | 'tools' | 'simple'; title: string; description: string; eyebrow?: string };
type Service = { id: string; title: string; price: string; description: string; domain: 'financial' | 'labor'; unit: string; featured: boolean; kind: string | null };

// We need an interface for the contract object so we can combine DB records and fallbacks
interface ContractItem {
  id: string;
  type?: string;
  industry?: string;
  title: string;
  description?: string;
  icon?: number;
}

export default function ContentPage({ kind, title, description, eyebrow = 'کاربان' }: Props) {
  const [typeFilter, setTypeFilter] = useState('همه انواع قرارداد');
  const [industryFilter, setIndustryFilter] = useState('همه صنف‌ها');

  const [dbContracts, setDbContracts] = useState<ContractItem[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(true);

  useEffect(() => {
    if (kind !== 'contracts') {
      setLoadingContracts(false);
      return;
    }
    let active = true;
    supabase
      .from('contracts')
      .select('id,title,type,industry,summary,description,body,pdf_url')
      .order('id')
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data || data.length === 0) {
          // fallback to config.ts contractCatalog
          setDbContracts(contractCatalog as ContractItem[]);
        } else {
          const mapped = data.map((item, index) => ({
            id: item.id,
            title: item.title,
            type: item.type || '',
            industry: item.industry || '',
            description: item.summary || item.description || '',
            icon: index % icons.length
          }));
          setDbContracts(mapped);
        }
        setLoadingContracts(false);
      });
    return () => { active = false; };
  }, [kind]);

  const contractTypesOptions = useMemo(() => {
    const types = new Set(dbContracts.map(c => c.type).filter(Boolean));
    return Array.from(types);
  }, [dbContracts]);

  const industriesOptions = useMemo(() => {
    const inds = new Set(dbContracts.map(c => c.industry).filter(Boolean));
    return Array.from(inds);
  }, [dbContracts]);

  const filteredContracts = useMemo(() => {
    return dbContracts.filter((item) =>
      (typeFilter === 'همه انواع قرارداد' || item.type === typeFilter) &&
      (industryFilter === 'همه صنف‌ها' || item.industry === industryFilter)
    );
  }, [dbContracts, typeFilter, industryFilter]);

  return <section className={`inner-page ${kind === 'tools' ? 'tools-page' : ''}`}><div className={`container ${kind === 'contracts' || kind === 'tools' ? '' : 'narrow-content'}`}><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p className="lead">{description}</p>
    {kind === 'knowledge' && <div className="category-grid">{['حقوقی و قانون کار', 'مالیات', 'حسابداری', 'منابع انسانی', 'مدیریت'].map((item, index) => { const Icon = icons[index]; return <a href={`/دانشنامه/${index + 1}`} className="category-card" key={item}><Icon /><h2>{item}</h2><p>راهنماها و مقاله‌های کاربردی برای تصمیم‌های مطمئن‌تر.</p><ArrowLeft size={16} /></a>; })}</div>}

    {kind === 'contracts' && <>
      <div className="filter-panel">
        <strong>فیلتر دو بعدی قراردادها</strong>
        <div className="filter-row">
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="نوع قرارداد">
            <option>همه انواع قرارداد</option>
            {contractTypesOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={industryFilter} onChange={(event) => setIndustryFilter(event.target.value)} aria-label="صنف یا شغل">
            <option>همه صنف‌ها</option>
            {industriesOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        <small>{filteredContracts.length} قرارداد متناسب با انتخاب شما</small>
      </div>

      {loadingContracts ? <p style={{textAlign: 'center', marginTop: '2rem'}}>در حال بارگذاری قراردادها...</p> :
      <div className="contract-grid">
        {filteredContracts.map((item) => {
          const Icon = icons[item.icon || 0];
          return <article className="contract-card" key={item.id}>
            <div className="contract-card-top">
              <Icon />
              <div>
                <small>{item.industry}</small>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
              </div>
            </div>
            <div className="contract-tiers">
              <span>عمومی <b>رایگان</b></span>
              <span>تخصصی <b>قیمت ثابت</b></span>
              <span>اختصاصی <b>متخصص</b></span>
            </div>
            <a className="button button-small" href={`/قراردادها/${item.id}`}>مشاهده <ArrowLeft size={15} /></a>
          </article>;
        })}
      </div>}
    </>}

    {kind === 'tools' && <><div className="tools-hero-card"><div><h2>ابزارهای هوش مصنوعی کاربان</h2><p>با چند عدد ساده، تصویر روشن‌تری از حقوق، بیمه، مالیات و سلامت کسب‌وکار خود بسازید.</p></div><img src="/images/og-tools.png" alt="تصویر ماشین‌حساب کاربان" /></div><div className="tool-grid">{calculatorItems.map((item) => { const Icon = toolIcons[item.icon] || Calculator; return <a className="tool-card" href={item.href} key={item.title}><div className="tool-icon"><Icon size={22} /></div><h3>{item.title}</h3><p>{item.description}</p><span>ورود به ابزار <ArrowLeft size={15} /></span></a>; })}</div></>}
    {kind === 'simple' && <div className="simple-panels"><h2>همه‌چیز برای یک تصمیم بهتر</h2><p>کاربان با ترکیب آموزش، ابزار و خدمات تخصصی، مسیر مدیریت کسب‌وکار را برای شما ساده‌تر می‌کند. محتوای این بخش به‌صورت منظم به‌روز می‌شود.</p><a className="button" href="/تماس">با ما در تماس باشید <ArrowLeft size={17} /></a></div>}
  </div></section>;
}

export function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]); const [mobile, setMobile] = useState(''); const [domain, setDomain] = useState<'financial' | 'labor'>('financial'); const [service, setService] = useState(''); const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  useEffect(() => { let active = true; supabase.from('services').select('id,title,price,description,domain,unit,featured,kind').order('created_at').then(({ data, error }) => { if (!active) return; if (error) { console.error('services load failed', error); return; } setServices((data || []) as Service[]); }); return () => { active = false; }; }, []);
  const consultationServices = services.filter((s) => !s.kind);
  const visibleServices = consultationServices.filter((item) => item.domain === domain);
  useEffect(() => { if (visibleServices.length && !visibleServices.some((item) => item.title === service)) setService(visibleServices[0].title); }, [domain, services, service, visibleServices]);
  const submitConsultation = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!isIranianMobile(mobile) || !service) { setStatus('error'); return; } setStatus('loading'); const { error } = await supabase.from('consultation_requests').insert({ mobile: normalizeMobile(mobile), domain, service }); if (error) { console.error('consultation request failed', error); setStatus('error'); return; } setStatus('success'); setMobile(''); };
  const laborItems = consultationServices.filter((s) => s.domain === 'labor');
  const financialItems = consultationServices.filter((s) => s.domain === 'financial');
  const contractItems = services.filter((s) => s.kind);
  return <section className="inner-page"><div className="container"><div className="narrow-content"><span className="eyebrow">خدمات تخصصی کاربان</span><h1>خدمات تخصصی کاربان — از پرسش متنی تا همراهی کامل</h1><p className="lead">دو مسیر هم‌وزن برای امور مالی و روابط کار؛ از یک پرسش کوتاه تا همراهی کامل سازمانی.</p></div>
    {laborItems.length > 0 && <section><h2>مشاوره روابط کار</h2><div className="plans-grid">{laborItems.map((plan) => <article className={`plan-card ${plan.featured ? 'plan-featured' : ''}`} key={plan.id}>{plan.featured && <span className="plan-badge">پیشنهاد کاربان</span>}<h2>{plan.title}</h2><p>{plan.description}</p><strong>{plan.price}</strong><small>{plan.unit}</small></article>)}</div></section>}
    {financialItems.length > 0 && <section><h2>مشاوره مالی، مالیاتی و حسابرسی</h2><div className="plans-grid">{financialItems.map((plan) => <article className={`plan-card ${plan.featured ? 'plan-featured' : ''}`} key={plan.id}>{plan.featured && <span className="plan-badge">پیشنهاد کاربان</span>}<h2>{plan.title}</h2><p>{plan.description}</p><strong>{plan.price}</strong><small>{plan.unit}</small></article>)}</div></section>}
    {contractItems.length > 0 && <section><h2>خدمات قراردادی و انجام‌کردنی <span className="plan-badge" style={{ position: 'static', display: 'inline-block', marginRight: '0.5rem' }}>انجام کار توسط متخصص</span></h2><div className="plans-grid">{contractItems.map((plan) => <article className="plan-card" key={plan.id}><h2>{plan.title}</h2><p>{plan.description}</p><strong>{plan.price}</strong><small>{plan.unit}</small></article>)}</div></section>}
    <div className="guarantee"><Scale size={23} /><span><strong>درخواست مشاوره</strong> — شماره موبایل، حوزه و خدمت موردنظر را ثبت کنید.</span></div><form className="filter-panel" onSubmit={submitConsultation}><strong>فرم درخواست مشاوره</strong><div className="filter-row"><input type="tel" inputMode="numeric" value={mobile} onChange={(event) => { setMobile(event.target.value); setStatus('idle'); }} placeholder="شماره موبایل" aria-label="شماره موبایل" /><select value={domain} onChange={(event) => setDomain(event.target.value as 'financial' | 'labor')} aria-label="حوزه"><option value="financial">مالی و مالیاتی</option><option value="labor">روابط کار</option></select><select value={service} onChange={(event) => setService(event.target.value)} aria-label="خدمت">{visibleServices.map((item) => <option value={item.title} key={item.id}>{item.title}</option>)}</select><button className="button" type="submit" disabled={status === 'loading'}>ثبت درخواست <ArrowLeft size={15} /></button></div>{status === 'success' && <small>درخواست شما ثبت شد؛ با شما تماس می‌گیریم.</small>}{status === 'error' && <small>شماره موبایل معتبر و یک خدمت را انتخاب کنید.</small>}</form></div></section>;
}
