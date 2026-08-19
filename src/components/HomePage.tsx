import { ArrowLeft, BadgeCheck, BookMarked, ClipboardCheck, Coins, Compass, FileSignature, Gavel, Palette, Sparkles, Users } from 'lucide-react';
import { roleCards } from '@/data/config';

const icons: Record<string, typeof Sparkles> = {
  briefcase: Sparkles,
  shield: BadgeCheck,
  laptop: BookMarked,
};

const mainSections = [
  { img: '/assets/images/sec-services.png', title: 'خدمات', desc: 'مشاوره تخصصی و نگارش اختصاصی', href: '/خدمات' },
  { img: '/assets/images/sec-contracts.png', title: 'قراردادها', desc: 'بانک قرارداد تخصصی به تفکیک صنف', href: '/قراردادها' },
  { img: '/assets/images/sec-requests.png', title: 'درخواست‌های اداری', desc: 'متن رسمی آماده برای هر نیاز', href: '/درخواست‌های-اداری' },
  { img: '/assets/images/sec-knowledge.png', title: 'دانشنامه', desc: 'مقاله‌های حقوقی با استناد قانون', href: '/دانشنامه' },
];

const serviceMenu = [
  { icon: Gavel, title: 'حقوق و قوانین کار', desc: 'مشاوره و حل اختلاف', href: '/خدمات' },
  { icon: FileSignature, title: 'قراردادها', desc: 'تنظیم و بررسی قرارداد', href: '/قراردادها' },
  { icon: ClipboardCheck, title: 'حسابداری و حسابرسی', desc: 'خدمات مالی و گزارش‌گیری', href: '/خدمات' },
  { icon: Coins, title: 'مالیات', desc: 'اظهارنامه، مشاوره و بخشودگی', href: '/ابزارهای-هوش-مصنوعی/مالیات-مشاغل' },
  { icon: Compass, title: 'مدیریت کسب‌وکار', desc: 'طرح کسب‌وکار و مشاوره', href: '/ابزارهای-هوش-مصنوعی/تست-سلامت' },
  { icon: Users, title: 'منابع انسانی', desc: 'قرارداد کار، آیین‌نامه و استخدام', href: '/ابزارهای-هوش-مصنوعی/محاسبه-حقوق' },
  { icon: Palette, title: 'کسب‌وکارهای خلاق', desc: 'حمایت از ایده‌ها و برندها', href: '/قراردادها' },
];

const tools = [
  { img: '/assets/images/tool-contract.png', title: 'ساخت قرارداد هوشمند', desc: 'قرارداد متناسب با نیاز شما، در چند مرحله.', href: '/ابزارهای-هوش-مصنوعی/ساخت-قرارداد' },
  { img: '/assets/images/tool-salary.png', title: 'محاسبه حقوق و دستمزد ۱۴۰۵', desc: 'حقوق، بیمه و مالیات را دقیق برآورد کنید.', href: '/ابزارهای-هوش-مصنوعی/محاسبه-حقوق' },
  { img: '/assets/images/tool-retirement.png', title: 'ماشین‌حساب بازنشستگی', desc: 'تصویری روشن از مسیر بازنشستگی تأمین اجتماعی.', href: '/ابزارهای-هوش-مصنوعی/بازنشستگی' },
  { img: '/assets/images/tool-health.png', title: 'تست سلامت کسب‌وکار', desc: 'نقاط قوت و ریسک کسب‌وکار را بشناسید.', href: '/ابزارهای-هوش-مصنوعی/تست-سلامت' },
];

export default function HomePage() {
  return (
    <div className="home-page">
      {/* ═══ هیرو: متن راست، تصویر بزرگ چپ ═══ */}
      <section className="hero-lux">
        <div className="hero-lux-media" aria-hidden="true">
          <img src="/assets/images/hero-main.png" alt="" />
        </div>
        <div className="container hero-lux-inner">
          <div className="hero-copy">
            <span className="hero-eyebrow">پلتفرم هوشمند قرارداد، حقوق و دانشنامه</span>
            <h1>رشد مطمئن کسب‌وکار شما با کاربان</h1>
            <p className="hero-lead">
              کاربان بانک قرارداد تخصصی، ماشین‌حساب‌های دقیق حقوق و سنوات، و دانشنامه کاربردی حقوق کار را کنار هم آورده تا تصمیم‌های حساس، ساده و مطمئن شوند.
            </p>
          </div>
          <div className="role-grid">
            {roleCards.map((role) => {
              const Icon = icons[role.icon] || Sparkles;
              return (
                <a className="role-card" href={role.href} key={role.title}>
                  <Icon size={22} />
                  <h3>{role.title}</h3>
                  <p>{role.description}</p>
                  <span>ورود به مسیر <ArrowLeft size={14} /></span>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ ۴ بخش اصلی با تصاویر سه‌بعدی ═══ */}
      <section className="sections-strip">
        <div className="container section-cards">
          {mainSections.map((item) => (
            <a className="section-card" href={item.href} key={item.title}>
              <div className="section-card-media">
                <img src={item.img} alt={item.title} loading="lazy" />
              </div>
              <h2>{item.title}</h2>
              <p>{item.desc}</p>
              <span>مشاهده <ArrowLeft size={14} /></span>
            </a>
          ))}
        </div>
      </section>

      {/* ═══ خدمات اصلی کاربان (۷ منو) ═══ */}
      <section className="services-lux">
        <div className="container">
          <div className="lux-heading">
            <span className="line" />
            <h2>خدمات اصلی کاربان</h2>
            <span className="line" />
          </div>
          <div className="services-seven">
            {serviceMenu.map((item) => {
              const Icon = item.icon;
              return (
                <a className="seven-card" href={item.href} key={item.title}>
                  <Icon size={26} strokeWidth={1.5} />
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ ابزارهای هوشمند با تصاویر سه‌بعدی کوچک ═══ */}
      <section className="tools-lux">
        <div className="container">
          <div className="lux-heading">
            <span className="line" />
            <h2>ابزارهای هوشمند کاربان</h2>
            <span className="line" />
          </div>
          <div className="tools-four">
            {tools.map((item) => (
              <a className="tool-lux-card" href={item.href} key={item.title}>
                <div className="tool-lux-media">
                  <img src={item.img} alt={item.title} loading="lazy" />
                </div>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
                <span>ورود به ابزار <ArrowLeft size={14} /></span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
