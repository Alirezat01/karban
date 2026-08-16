import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BadgeCheck, BookMarked, Calculator, CheckCircle2, Clock, Coins, FileText, Sparkles, Sun, TrendingUp } from 'lucide-react';
import { INDUSTRIES, roleCards, toolItems } from '@/data/config';
import { supabase } from '@/lib/supabase';

const icons: Record<string, typeof Calculator> = {
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
};

type HomeService = { id: string; title: string; description: string };

export default function HomePage() {
  const [services, setServices] = useState<HomeService[]>([]);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    let active = true;
    supabase
      .from('services')
      .select('id,title,description')
      .order('created_at')
      .then(({ data }) => {
        if (active && data) setServices(data as HomeService[]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setRevealed(true);
      },
      { threshold: 0.1 },
    );
    document.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const randomServices = useMemo(() => {
    const pool = [...services];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 3);
  }, [services]);

  return (
    <div className={revealed ? 'home-page is-ready' : 'home-page'}>
      <section className="hero-home hero-animated">
        <div className="container hero-inner">
          <div className="hero-copy">
            <span className="hero-eyebrow">پلتفرم هوشمند قرارداد، حقوق و دانشنامه</span>
            <h1>رشد مطمئن کسب‌وکار شما با کاربان</h1>
            <p className="hero-lead">
              کاربان بانک قرارداد تخصصی، ماشین‌حساب‌های دقیق حقوق و سنوات، و دانشنامه کاربردی حقوق کار را کنار هم آورده تا تصمیم‌های حساس، ساده و مطمئن شوند.
            </p>
            <div className="role-grid">
              {roleCards.map((role) => {
                const Icon = icons[role.icon] || Sparkles;
                return (
                  <a className={`role-card role-${role.accent}`} href={role.href} key={role.title}>
                    <Icon size={22} />
                    <h3>{role.title}</h3>
                    <p>{role.description}</p>
                    <span>ورود به مسیر <ArrowLeft size={14} /></span>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="ticker-home" aria-hidden="true">
        <div className="ticker-track">
          {[...INDUSTRIES, ...INDUSTRIES].map((item, index) => (
            <span key={`${item}-${index}`}>{item}</span>
          ))}
        </div>
      </section>

      <section className="section-services-home" data-reveal>
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">خدمات منتخب</span>
              <h2>مسیر درست را سریع‌تر پیدا کنید</h2>
            </div>
            <a className="text-link" href="/خدمات">مشاهده همه خدمات <ArrowLeft size={16} /></a>
          </div>
          <div className="service-grid-home">
            {randomServices.map((item) => (
              <a className="service-card-home" href={`/سفارش/${item.id}`} key={item.id}>
                <div className="service-icon"><TrendingUp size={22} /></div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <span>مشاهده و سفارش <ArrowLeft size={14} /></span>
              </a>
            ))}
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
            <a className="text-link text-link-light" href="/ابزارهای-هوش-مصنوعی">همه ابزارها <ArrowLeft size={16} /></a>
          </div>
          <div className="tool-grid-home">
            {toolItems.map((tool) => {
              const Icon = icons[tool.icon] || Calculator;
              return (
                <a className="tool-card-gold" href={tool.href} key={tool.title}>
                  <div className="tool-icon"><Icon size={22} /></div>
                  <h3>{tool.title}</h3>
                  <p>{tool.description}</p>
                  <span>ورود به ابزار <ArrowLeft size={15} /></span>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      <section className="how-home" data-reveal>
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">چگونه کار می‌کند</span>
              <h2>سه قدم تا آرامش کاری</h2>
            </div>
          </div>
          <div className="how-steps">
            <div className="how-step"><strong>۱</strong><h3>مسیرت را انتخاب کن</h3><p>کارفرما، کارمند یا فریلنسر؛ هر مسیر، ابزار و قراردادهای خودش را دارد.</p></div>
            <div className="how-step"><strong>۲</strong><h3>بساز و محاسبه کن</h3><p>قرارداد ببند، حقوق و مالیات را دقیق محاسبه کن، سلامت کسب‌وکار را بسنج.</p></div>
            <div className="how-step"><strong>۳</strong><h3>با خیال راحت رشد کن</h3><p>متن محکم، عدد دقیق و مشاوره تخصصی؛ از قرارداد تا آرامش.</p></div>
          </div>
        </div>
      </section>
    </div>
  );
}
