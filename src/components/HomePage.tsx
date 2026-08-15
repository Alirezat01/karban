import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BadgeCheck, BookMarked, Calculator, CheckCircle2, Clock, Coins, FileText, Sparkles, Sun, TrendingUp } from 'lucide-react';
import { roleCards, serviceItems, specialistServices, toolItems } from '@/data/config';

const icons = {
  briefcase: Sparkles,
  shield: BadgeCheck,
  laptop: BookMarked,
  file: FileText,
  calculator: Calculator,
  chart: TrendingUp,
  coins: Coins,
  scale: CheckCircle2,
  heart: BadgeCheck,
  sun: Sun,
  clock: Clock,
} as const;

const industriesTicker = [
  'پزشکان',
  'فروشگاه آنلاین',
  'رستوران',
  'استارتاپ',
  'فریلنسر',
  'مشاور املاک',
  'ساخت‌وساز',
  'آموزشگاه',
  'شرکت حسابداری',
  'کارخانه',
];

function useCount(target: number) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const duration = 1200;
    const tick = (time: number) => {
      const progress = Math.min(1, (time - start) / duration);
      setValue(Math.round(target * progress));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [target]);
  return value;
}

export default function HomePage() {
  const [visible, setVisible] = useState(false);
  const contractCount = useCount(60);
  const parameterCount = useCount(140);
  const toolCount = useCount(7);

  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>('[data-reveal]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18 },
    );
    nodes.forEach((node) => observer.observe(node));
    setVisible(true);
    return () => observer.disconnect();
  }, []);

  const heroServices = useMemo(() => serviceItems.slice(0, 2), []);

  return (
    <div className={visible ? 'home-page is-ready' : 'home-page'}>
      <section className="hero-home hero-home-navy">
        <div className="hero-girih" />
        <div className="container hero-grid hero-grid-home">
          <div className="hero-copy hero-copy-home" data-reveal>
            <span className="eyebrow eyebrow-gold">پلتفرم هوشمند قرارداد، حقوق و دانشنامه</span>
            <h1>رشد مطمئن کسب‌وکار شما با کاربان</h1>
            <p className="lead">
              کاربان بانک قرارداد تخصصی، ماشین‌حساب‌های دقیق حقوق و سنوات، و دانشنامه کاربردی حقوق کار را کنار هم می‌آورد تا تصمیم‌های حساس، ساده و مطمئن شوند.
            </p>
            <div className="hero-actions">
              <a className="button button-gold" href="/قراردادها">
                شروع کنید <ArrowLeft size={17} />
              </a>
              <a className="button button-outline button-outline-light" href="/تماس-با-ما">
                مشاوره رایگان
              </a>
            </div>
            <div className="hero-stats">
              <div className="stat-card">
                <strong>+{contractCount}</strong>
                <span>قرارداد</span>
              </div>
              <div className="stat-card">
                <strong>{parameterCount}</strong>
                <span>پارامتر</span>
              </div>
              <div className="stat-card">
                <strong>{toolCount}</strong>
                <span>ابزار</span>
              </div>
            </div>
          </div>

          <div className="hero-stack" data-reveal>
            <div className="contract-float-card">
              <div className="contract-seal">کاربان</div>
              <span className="contract-label">نمونه قرارداد هوشمند</span>
              <h2>قرارداد استخدام و همکاری</h2>
              <ul>
                <li>متن حقوقی روشن و قابل ویرایش</li>
                <li>متناسب با صنف و نوع همکاری</li>
                <li>قابل دانلود و ارجاع در چند ثانیه</li>
              </ul>
            </div>
            <div className="hero-side-grid">
              <div className="hero-mini-card">
                <Sparkles size={18} />
                <span>متن دقیق</span>
              </div>
              <div className="hero-mini-card">
                <TrendingUp size={18} />
                <span>رشد پایدار</span>
              </div>
              <div className="hero-mini-card">
                <Coins size={18} />
                <span>مدیریت مالی</span>
              </div>
              <div className="hero-mini-card">
                <FileText size={18} />
                <span>قرارداد امن</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="ticker-strip" data-reveal>
        <div className="ticker-track">
          {[...industriesTicker, ...industriesTicker].map((item, index) => (
            <span key={`${item}-${index}`}>{item}</span>
          ))}
        </div>
      </section>

      <section className="section section-services section-services-home" data-reveal>
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">خدمات منتخب</span>
              <h2>مسیر درست را سریع‌تر پیدا کنید</h2>
            </div>
            <a className="text-link" href="/خدمات">
              مشاهده همه خدمات <ArrowLeft size={16} />
            </a>
          </div>
          <div className="service-grid service-grid-home">
            {heroServices.map((item, index) => {
              const Icon = icons[item.icon];
              return (
                <a className="service-card service-card-home" href={item.href} key={item.title}>
                  <div className="service-ribbon">تخفیف ویژه</div>
                  <div className="service-icon">
                    <Icon size={22} />
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <span>انتخاب این مسیر <ArrowLeft size={14} /></span>
                  <small>{index === 0 ? 'مشاوره و ثبت سفارش سریع' : 'پشتیبانی مستقیم و شفاف'}</small>
                </a>
              );
            })}
            <div className="service-card specialist-card specialist-card-home">
              <span className="plan-badge">انجام کار توسط متخصص</span>
              <div className="service-icon">
                <Sparkles size={22} />
              </div>
              <h3>خدمات تخصصی برای سازمان شما</h3>
              <p>وقتی یک کار باید دقیق، سریع و با مسئولیت‌پذیری انجام شود.</p>
              <div className="specialist-list">
                {specialistServices.map(([title, price]) => (
                  <a href="/تماس-با-ما" key={title}>
                    <span>{title}</span>
                    <b>{price}</b>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="tools-panel-home" data-reveal>
        <div className="container">
          <div className="section-heading section-heading-dark">
            <div>
              <span className="eyebrow eyebrow-dark">ابزارهای هوشمند و تعاملی</span>
              <h2>کمتر جست‌وجو کنید، بیشتر پیش بروید</h2>
            </div>
            <a className="text-link text-link-light" href="/ابزارهای-هوش-مصنوعی">
              همه ابزارها <ArrowLeft size={16} />
            </a>
          </div>
          <div className="tool-grid tool-grid-home">
            {toolItems.map((tool) => {
              const Icon = icons[tool.icon];
              return (
                <a className="tool-card tool-card-gold" href={tool.href} key={tool.title}>
                  <div className="tool-icon">
                    <Icon size={22} />
                  </div>
                  <h3>{tool.title}</h3>
                  <p>{tool.description}</p>
                  <span>ورود به ابزار <ArrowLeft size={15} /></span>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      <section className="how-it-works" data-reveal>
        <div className="container">
          <div className="center-heading">
            <span className="eyebrow">چگونه کار می‌کند</span>
            <h2>سه مرحله تا تصمیمی روشن‌تر</h2>
          </div>
          <div className="timeline-grid">
            <div className="timeline-step">
              <span>۱</span>
              <h3>انتخاب مسیر</h3>
              <p>از میان قراردادها، خدمات یا ابزارها مسیر مناسب را انتخاب کنید.</p>
            </div>
            <div className="timeline-step">
              <span>۲</span>
              <h3>ورود اطلاعات</h3>
              <p>چند پاسخ کوتاه بدهید تا محاسبه یا پیشنهاد مناسب آماده شود.</p>
            </div>
            <div className="timeline-step">
              <span>۳</span>
              <h3>نتیجه و اقدام</h3>
              <p>خروجی دقیق را ببینید و در همان لحظه برای اقدام بعدی تصمیم بگیرید.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section values-section values-section-home" data-reveal>
        <div className="container">
          <div className="center-heading">
            <span className="eyebrow">چرا کاربان؟</span>
            <h2>برای رشد، به یک همراه قابل اتکا نیاز دارید</h2>
          </div>
          <div className="values-grid">
            {[
              ['اعتماد', 'اطلاعات و تصمیم‌ها با دقت محافظت می‌شوند.'],
              ['تخصص', 'دانش حقوقی و مالی را به زبان قابل استفاده ارائه می‌کنیم.'],
              ['امنیت', 'مسیرهای امن برای قرارداد، داده و تعامل با متخصص.'],
              ['همراهی', 'از سؤال اول تا اجرای تصمیم کنار شما می‌مانیم.'],
              ['رشد', 'ابزارهای ساده برای ساختن آینده‌ای بهتر.'],
            ].map(([title, text]) => (
              <div className="value-item" key={title}>
                <BadgeCheck size={22} />
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="brief-bar brief-bar-home" data-reveal>
        <div className="container brief-inner">
          <div>
            <span>هفته‌نامه کاربان</span>
            <p>یک نکته کاربردی برای مدیریت بهتر کسب‌وکار، هر هفته در موبایل شما.</p>
          </div>
          <form onSubmit={(event) => event.preventDefault()}>
            <input type="tel" inputMode="numeric" placeholder="شماره موبایل" aria-label="شماره موبایل" />
            <button className="button button-gold" type="submit">
              عضویت <ArrowLeft size={16} />
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
