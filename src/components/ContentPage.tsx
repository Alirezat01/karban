import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Calculator, Clock, Coins, FileText, HeartHandshake, Scale, Sun, BriefcaseBusiness, TrendingUp } from 'lucide-react';
import { contractCatalog, calculatorItems, CONTRACT_TYPES, INDUSTRIES } from '@/data/config';
import { supabase } from '@/lib/supabase';
import { formatRial, toNumericValue } from '@/lib/format';

const icons = [Scale, FileText, BriefcaseBusiness, Calculator, Sun, HeartHandshake];
const toolIcons: Record<string, typeof Calculator> = { file: FileText, calculator: Calculator, sun: Sun, heart: HeartHandshake, briefcase: BriefcaseBusiness, scale: Scale, clock: Clock, chart: TrendingUp, coins: Coins };

type Props = { kind: 'knowledge' | 'contracts' | 'tools' | 'simple'; title: string; description: string; eyebrow?: string };
type Service = { id: string; title: string; price: string; description: string; domain: 'financial' | 'labor'; unit: string; featured: boolean; kind: string | null; discount_percent?: number | null };

type ContractItem = {
  id: string;
  type?: string;
  industry?: string;
  title: string;
  description?: string;
  icon?: number;
  body?: string;
};

const priceText = (value: string, discountPercent?: number | null) => {
  const base = toNumericValue(value);
  if (!base) return value;
  if (!discountPercent || discountPercent <= 0) return formatRial(base);
  const discounted = Math.max(0, Math.round(base * (1 - discountPercent / 100)));
  return { base: formatRial(base), discounted: formatRial(discounted) };
};

export default function ContentPage({ kind, title, description, eyebrow = 'کاربان' }: Props) {
  const [typeFilter, setTypeFilter] = useState('همه انواع قرارداد');
  const [searchQuery, setSearchQuery] = useState('');
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
      .select('id,title,type,industry,summary,body,pdf_url')
      .order('id')
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data || data.length === 0) {
          setDbContracts(contractCatalog as ContractItem[]);
        } else {
          setDbContracts(
            data.map((item, index) => ({
              id: item.id,
              title: item.title,
              type: item.type || '',
              industry: item.industry || '',
              description: item.summary || item.description || '',
              body: item.body || '',
              icon: index % icons.length,
            })),
          );
        }
        setLoadingContracts(false);
      });

    return () => {
      active = false;
    };
  }, [kind]);

  const filteredContracts = useMemo(
    () =>
      dbContracts.filter((item) => {
        const matchType = typeFilter === 'همه انواع قرارداد' || item.type === typeFilter;
        const matchInd = industryFilter === 'همه صنف‌ها' || item.industry === industryFilter;
        const term = searchQuery.trim().toLowerCase();
        const matchSearch =
          term === '' ||
          item.title.toLowerCase().includes(term) ||
          (item.description || '').toLowerCase().includes(term) ||
          (item.body || '').toLowerCase().includes(term);
        return matchType && matchInd && matchSearch;
      }),
    [dbContracts, typeFilter, industryFilter, searchQuery],
  );

  return (
    <section className={`inner-page ${kind === 'tools' ? 'tools-page' : ''}`}>
      <div className={`container ${kind === 'contracts' || kind === 'tools' ? '' : 'narrow-content'}`}>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p className="lead">{description}</p>

        {kind === 'knowledge' && (
          <div className="category-grid">
            {['حقوقی و قانون کار', 'مالیات', 'حسابداری', 'منابع انسانی', 'مدیریت'].map((item, index) => {
              const Icon = icons[index];
              return (
                <a href={`/دانشنامه/${index + 1}`} className="category-card" key={item}>
                  <Icon />
                  <h2>{item}</h2>
                  <p>راهنماها و مقاله‌های کاربردی برای تصمیم‌های مطمئن‌تر.</p>
                  <ArrowLeft size={16} />
                </a>
              );
            })}
          </div>
        )}

        {kind === 'contracts' && (
          <>
            <div className="filter-panel">
              <strong>جست‌وجو و فیلتر قراردادها</strong>
              <div className="filter-row">
                <input type="text" placeholder="جست‌وجو در قراردادها..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ flex: 1 }} />
                <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="نوع قرارداد">
                  <option>همه انواع قرارداد</option>
                  {CONTRACT_TYPES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
                <select value={industryFilter} onChange={(event) => setIndustryFilter(event.target.value)} aria-label="صنف یا شغل">
                  <option>همه صنف‌ها</option>
                  {INDUSTRIES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
              <small>{filteredContracts.length} قرارداد متناسب با انتخاب شما</small>
            </div>

            {loadingContracts ? (
              <p style={{ textAlign: 'center', marginTop: '2rem' }}>در حال بارگذاری قراردادها...</p>
            ) : (
              <div className="contract-grid">
                {filteredContracts.map((item) => {
                  const Icon = icons[item.icon || 0];
                  return (
                    <article className="contract-card" key={item.id}>
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
                      <a className="button button-small" href={`/قراردادها/${item.id}`}>
                        مشاهده <ArrowLeft size={15} />
                      </a>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}

        {kind === 'tools' && (
          <>
           
            <div className="tool-grid">
              {calculatorItems.map((item) => {
                const Icon = toolIcons[item.icon] || Calculator;
                return (
                  <a className="tool-card" href={item.href} key={item.title}>
                    <div className="tool-icon"><Icon size={22} /></div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <span>ورود به ابزار <ArrowLeft size={15} /></span>
                  </a>
                );
              })}
                        </div>

            <div className="faq-section">
              <h2>پرسش‌های پرتکرار</h2>
              <details><summary>آیا نتایج ماشین‌حساب‌ها مبنای قانونی دارد؟</summary><p>محاسبات بر اساس قانون کار، قانون تأمین اجتماعی و قانون مالیات‌های مستقیم و مصوبات ۱۴۰۵ است؛ برای موارد اختلافی، ملاک نهایی فیش رسمی سازمان‌هاست.</p></details>
              <details><summary>پارامترهای حقوق ۱۴۵ از کجا می‌آید؟</summary><p>اعداد پایه، بن و مسکن مطابق بخشنامه سالانه شورای عالی کار است و از پنل مدیریت کاربان قابل به‌روزرسانی است.</p></details>
              <details><summary>سنوات پایان خدمت چگونه محاسبه می‌شود؟</summary><p>به ازای هر سال سابقه، معادل یک ماه آخرین حقوق، مطابق ماده ۲۴ قانون کار؛ برای کمتر از سال، به نسبت ماه‌ها.</p></details>
              <details><summary>نرخ ارزش افزوده سال ۱۴۰۵ چقدر است؟</summary><p>۱۰٪؛ ماشین‌حساب کاربان هر دو حالت «افزودن به پایه» و «استخراج از داخل فاکتور» را محاسبه می‌کند.</p></details>
              <details><summary>مالیات مشاغل چند درصد است؟</summary><p>پلکانی از ۱۵٪ تا ۳۵٪ مطابق ماده ۱۳۱، پس از کسر معافیت سالانه که هر سال در قانون بودجه اعلام می‌شود.</p></details>
            </div>
          </>
        )}

        {kind === 'simple' && (
          <div className="simple-panels">
            <h2>همه‌چیز برای یک تصمیم بهتر</h2>
            <p>{description}</p>
            <a className="button" href="/تماس-با-ما">با ما در تماس باشید <ArrowLeft size={17} /></a>
          </div>
        )}
      </div>
    </section>
  );
}

export function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    let active = true;
    supabase
      .from('services')
      .select('id,title,price,description,domain,unit,featured,kind,discount_percent')
      .order('created_at')
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('services load failed', error);
          return;
        }
        setServices((data || []) as Service[]);
      });
    return () => {
      active = false;
    };
  }, []);

  const consultationServices = services.filter((s) => !s.kind);
  const laborItems = consultationServices.filter((s) => s.domain === 'labor');
  const financialItems = consultationServices.filter((s) => s.domain === 'financial');
  const contractItems = services.filter((s) => s.kind);

  const renderPrice = (value: string, discountPercent?: number | null) => {
    const result = priceText(value, discountPercent);
    if (typeof result === 'string') {
      return <strong>{result}</strong>;
    }
    return (
      <div className="service-price-group">
        <del>{result.base}</del>
        <strong>{result.discounted}</strong>
      </div>
    );
  };

  const renderServiceCard = (plan: Service) => {
    const discounted = plan.discount_percent || 0;
    return (
      <a className={`plan-card plan-link ${plan.featured ? 'plan-featured' : ''}`} href={`/سفارش/${plan.id}`} key={plan.id}>
        {plan.featured && <span className="plan-badge">پیشنهاد کاربان</span>}
        {discounted > 0 && <span className="discount-ribbon">تخفیف ویژه</span>}
        <h2>{plan.title}</h2>
        <p>{plan.description}</p>
        {renderPrice(plan.price, discounted)}
        <small>{plan.unit}</small>
        <span className="plan-cta">ثبت سفارش <ArrowLeft size={15} /></span>
      </a>
    );
  };

  return (
    <section className="inner-page">
      <div className="container">
        <div className="narrow-content">
          <span className="eyebrow">خدمات تخصصی کاربان</span>
          <h1>خدمات قراردادی و تخصصی</h1>
          <p className="lead">روی هر خدمت بزنید تا توضیح کامل را ببینید و همان‌جا سفارش بدهید.</p>
        </div>

        {laborItems.length > 0 && (
          <section>
            <h2>مشاوره روابط کار</h2>
            <div className="plans-grid">{laborItems.map(renderServiceCard)}</div>
          </section>
        )}

        {financialItems.length > 0 && (
          <section>
            <h2>مشاوره مالی، مالیاتی و حسابرسی</h2>
            <div className="plans-grid">{financialItems.map(renderServiceCard)}</div>
          </section>
        )}

        {contractItems.length > 0 && (
          <section>
            <h2>خدمات قراردادی</h2>
            <div className="plans-grid">{contractItems.map(renderServiceCard)}</div>
          </section>
        )}

        <div className="guarantee">
          <Scale size={23} />
          <span><strong>پیش از هر سفارش،</strong> قوانین و شرایط کاربان را در صفحه «قوانین» بخوانید؛ شفافیت، اصل اول ماست.</span>
        </div>
      </div>
    </section>
  );
}
