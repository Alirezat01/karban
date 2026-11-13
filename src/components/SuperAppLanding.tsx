import { useEffect, useState } from 'react';
import {
  ArrowLeft, BadgeCheck, BookOpen, Brain, Camera, Check, ChevronDown, Coins,
  Database, FileSignature, FileText, Fingerprint, LayoutDashboard, Lock,
  Mic, Receipt, ScrollText, Shield, Smartphone, Sparkles, TrendingUp,
  Wallet,
} from 'lucide-react';
import SiteFooter from '@/components/SiteFooter';

/* ════════════════════════════════════════════════════════════════════════════
   کاربان سوپراپ — صفحه معرفی موبایل اپ (نسخه ۲)
   ════════════════════════════════════════════════════════════════════════════
   تغییرات نسخه ۲:
     - هماهنگ با رنگ‌های اصلی سایت کاربان (سرمه‌ای-طلایی)
     - حالت روز و شب کامل
     - حذف انیمیشن‌های مشکل‌ساز
     - حذف کلمات انگلیسی
     - طراحی فشرده‌تر و شیک‌تر
     - اضافه‌شدن توضیحات کامل زیر هر بخش
   ════════════════════════════════════════════════════════════════════════════ */

/* ═══ داده‌ها ═══ */

const stats = [
  { value: '۵', label: 'بخش یکپارچه' },
  { value: '۲۱', label: 'قابلیت پیشرفته' },
  { value: '۱۰۰٪', label: 'کار آفلاین' },
  { value: '۴۳۰', label: 'پیکسل استاندارد موبایل' },
];

const sections = [
  {
    id: 'home',
    icon: LayoutDashboard,
    title: 'خانه — داشبورد خزانه',
    desc: 'نمای کلی از نقدینگی، فروش، خرید و چک‌ها در یک نگاه.',
    features: [
      'پیش‌بینی نقدینگی ۹۰ روزه با نمودار تعاملی',
      'توصیه صرفه‌جویی مالیاتی روزانه بر اساس تقویم شمسی',
      'تقویم تکالیف مالیاتی و بیمه‌ای سال ۱۴۰۵',
      'دفتر چک صیادی و دفتر روزنامه',
      'ویجت کارت سه‌بعدی خزانه',
    ],
  },
  {
    id: 'accounting',
    icon: Receipt,
    title: 'حسابداری و سامانه مودیان',
    desc: 'صدور صورتحساب الکترونیکی مطابق سامانه مودیان.',
    features: [
      'شناسه یکتای ۲۲ رقمی مودیان و ۱۳ رقمی کالا و خدمات',
      'محاسبه خودکار مالیات بر ارزش افزوده و درج حروف فارسی مبلغ',
      'مدیریت چک‌های صیادی ۱۶ رقمی با استعلام رنگ',
      'دفتر روزنامه دوطرفه خودکار و تراز آزمایشی',
      'گزارش معاملات فصلی ماده ۱۶۹',
      'خروجی فایل چاپی با مهر کاربان و امضای دیجیتال',
    ],
  },
  {
    id: 'ai',
    icon: Brain,
    title: 'استودیو هوش مصنوعی',
    desc: 'چهار ابرقابلیت اختصاصی با موتور هوش مصنوعی جمینای.',
    features: [
      'اسکنر هوشمند فاکتور و چک با دوربین موبایل',
      'اسکنر زنده بارکد چک صیادی',
      'تولید خودکار لایحه دفاعیه مالیاتی مستند به مواد قانونی',
      'تحلیل‌گر ریسک قراردادها با امتیاز صفر تا صد',
      'رادار پیش‌بینی نقدینگی ۳۰ روزه',
      'دستیار صوتی با سه شخصیت: مدیر مالی، مشاور مالیاتی، وکیل قراردادها',
    ],
  },
  {
    id: 'contracts',
    icon: FileSignature,
    title: 'قراردادها و گاوصندوق اسناد',
    desc: 'قراردادساز استاندارد + نامه‌نگار اداری + گاوصندوق امن.',
    features: [
      'قرارداد کار، پیمانکاری ماده ۳۸، فریلنسری و محرمانگی',
      'نامه‌نگار اداری و منابع انسانی',
      'امضای دیجیتال لمسی روی صفحه موبایل',
      'گاوصندوق اسناد برای بایگانی قراردادها و لوایح',
      'خروجی فایل چاپی رسمی با مهر و امضا',
    ],
  },
  {
    id: 'tools',
    icon: Coins,
    title: 'محاسبه‌گرها و بانک قوانین',
    desc: 'ماشین‌حساب جامع حقوق، سنوات، عیدی + بانک مواد قانونی.',
    features: [
      'محاسبه حقوق، دستمزد و بیمه سال ۱۴۰۵',
      'محاسبه سنوات، عیدی و بازخرید مرخصی',
      'سنجش سلامت مالیاتی و بیمه‌ای کسب‌وکار',
      'بانک مواد قانونی: قانون کار، مودیان، ماده ۳۸، صیادی',
      'چک‌لیست‌های اجرایی',
    ],
  },
];

const aiSuper = [
  { icon: Camera, title: 'اسکنر چک صیادی', desc: 'خواندن مستقیم بارکد روی برگه چک صیادی با دوربین موبایل و پر کردن خودکار فیلدها.' },
  { icon: ScrollText, title: 'لایحه دفاعیه خودکار', desc: 'نگارش لایحه رسمی مستند به مواد ۹۷، ۱۶۹، ۲۱۶، ۲۳۸، ۲۴۴ و ۲۵۱ مکرر با نمایش درصد شانس موفقیت.' },
  { icon: Mic, title: 'دستیار صوتی مدیر مالی', desc: 'چت‌بات حقوقی-مالیاتی چندنوبته با سه شخصیت حرفه‌ای و قابلیت هدایت صوتی کاربر.' },
  { icon: TrendingUp, title: 'رادار نقدینگی', desc: 'تحلیل ریسک کسری نقدینگی ۳۰ روزه، سررسید چک و بدهی مالیاتی.' },
];

const plans = [
  {
    name: 'تست رایگان',
    price: '۰',
    period: '۱۰ روز',
    badge: null,
    features: ['۲۵ فاکتور', '۱۵ گفت‌وگوی هوش مصنوعی', '۵ تحلیل هوشمند', '۱ کسب‌وکار'],
    cta: 'شروع رایگان',
    highlight: false,
  },
  {
    name: 'ماهانه پیشرفته',
    price: '۴۹۰٬۰۰۰',
    period: 'ماه',
    badge: null,
    features: ['۳ کسب‌وکار', 'فاکتور نامحدود', '۲۰ گفت‌وگو در روز', '۱۰ تحلیل در روز', 'اسکنر هوشمند', 'لایحه مالیاتی'],
    cta: 'انتخاب پلن',
    highlight: false,
  },
  {
    name: 'سالانه پیشرفته',
    price: '۴٬۹۰۰٬۰۰۰',
    period: 'سال',
    badge: '۲ ماه هدیه',
    features: ['۵ کسب‌وکار', 'تمام امکانات ماهانه', 'رادار نقدینگی', 'پشتیبانی اولویت‌دار'],
    cta: 'بهترین انتخاب',
    highlight: true,
  },
  {
    name: 'بنیان‌گذار ویژه',
    price: '۹٬۸۰۰٬۰۰۰',
    period: 'یک‌باره',
    badge: 'محدود',
    features: ['۱۰ شرکت هم‌زمان', 'هوش مصنوعی نامحدود', 'مشاور اختصاصی', 'راه‌اندازی مالیاتی'],
    cta: 'همکاری ویژه',
    highlight: false,
  },
];

const faqs = [
  {
    q: 'آیا کاربان نیاز به نصب دارد؟',
    a: 'خیر، کاربان یک اپلیکیشن وب پیشرفته است و می‌توانید مستقیماً از مرورگر موبایل استفاده کنید. در اندروید می‌توانید «افزودن به صفحه اصلی» را بزنید و در iOS گزینه «افزودن به صفحه اصلی» را انتخاب کنید. نسخه بومی اندروید و iOS نیز در راه است.',
  },
  {
    q: 'آیا بدون اینترنت هم کار می‌کند؟',
    a: 'بله، کاربان آفلاین‌محور است. تمام داده‌ها روی حافظه دستگاه شما ذخیره می‌شوند و وقتی اینترنت وصل شد، با دیتابیس ابری همگام‌سازی می‌شوند. می‌توانید از منوی تنظیمات پشتیبان‌گیری کامل هم بگیرید.',
  },
  {
    q: 'آیا صورتحساب‌های صادرشده مطابق سامانه مودیان هستند؟',
    a: 'بله، کاربان صدور صورتحساب الکترونیک فروش، خرید، پیش‌فاکتور و برگشت از فروش را با شناسه یکتای ۲۲ رقمی مودیان و شناسه ۱۳ رقمی کالا و خدمات انجام می‌دهد. مالیات بر ارزش افزوده به‌صورت خودکار محاسبه و در حروف فارسی درج می‌شود.',
  },
  {
    q: 'امنیت داده‌های من چگونه تأمین می‌شود؟',
    a: 'کاربان از قفل بیومتریک موبایل (اثر انگشت یا تشخیص چهره) پشتیبانی می‌کند. تمام داده‌ها با رمزنگاری ابری ذخیره می‌شوند. همچنین پین‌کد پشتیبان با انیمیشن ورود و خروج نرم در دسترس است.',
  },
  {
    q: 'آیا لایحه دفاعیه مالیاتی واقعاً توسط هوش مصنوعی نوشته می‌شود؟',
    a: 'بله، استودیو هوش مصنوعی کاربان متصل به موتور هوش مصنوعی جمینای است. لایحه‌ها به مواد ۹۷، ۱۶۹، ۲۱۶، ۲۳۸، ۲۴۴ و ۲۵۱ مکرر مستند می‌شوند، درصد شانس موفقیت نمایش داده می‌شود و خروجی در گاوصندوق اسناد ذخیره می‌شود.',
  },
  {
    q: 'تفاوت پلن سالانه با ماهانه چیست؟',
    a: 'پلن سالانه ۲ ماه هدیه می‌دهد (معادل ۱۷٪ تخفیف)، به‌علاوه رادار پیش‌بینی نقدینگی ۳۰ روزه و پشتیبانی اولویت‌دار. همچنین سقف کسب‌وکار از ۳ به ۵ می‌رسد.',
  },
  {
    q: 'آیا می‌توانم قبل از خرید تست کنم؟',
    a: 'بله، تست ۱۰ روزه رایگان بدون نیاز به کارت بانکی در دسترس است. تا ۲۵ فاکتور، ۱۵ گفت‌وگوی هوش مصنوعی و ۵ تحلیل هوشمند می‌توانید استفاده کنید. ضمانت بازگشت وجه ۷ روزه هم برای پلن‌های پولی وجود دارد.',
  },
];

const trustBadges = [
  { icon: BadgeCheck, label: 'مطابق قوانین ۱۴۰۵' },
  { icon: Receipt, label: 'سامانه مودیان' },
  { icon: Shield, label: 'صیاد بانک مرکزی' },
  { icon: Lock, label: 'رمزنگاری ابری' },
];

/* ═══ موکاپ موبایل ═══ */

function PhoneMockup() {
  const [tab, setTab] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setTab((t) => (t + 1) % 5), 3500);
    return () => clearInterval(id);
  }, []);

  const tabs = [
    { icon: LayoutDashboard, label: 'خانه' },
    { icon: Receipt, label: 'حسابداری' },
    { icon: Brain, label: 'هوش مصنوعی' },
    { icon: FileSignature, label: 'قرارداد' },
    { icon: BookOpen, label: 'قوانین' },
  ];

  return (
    <div className="superapp-phone">
      <div className="superapp-phone-frame">
        <div className="superapp-phone-notch" />
        <div className="superapp-phone-screen">
          <div className="superapp-phone-statusbar">
            <span>۹:۴۱</span>
            <span className="superapp-phone-statusbar-right">
              <span className="superapp-phone-signal" />
              <span className="superapp-phone-battery" />
            </span>
          </div>
          <div className="superapp-phone-content">
            {tab === 0 && <PhoneHome />}
            {tab === 1 && <PhoneAccounting />}
            {tab === 2 && <PhoneAI />}
            {tab === 3 && <PhoneContracts />}
            {tab === 4 && <PhoneTools />}
          </div>
          <div className="superapp-phone-tabbar">
            {tabs.map((t, i) => {
              const Icon = t.icon;
              return (
                <div key={i} className={`superapp-phone-tab ${i === tab ? 'active' : ''}`} onClick={() => setTab(i)}>
                  <Icon size={16} />
                  <span>{t.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function PhoneHome() {
  return (
    <div className="superapp-screen">
      <div className="superapp-screen-header">
        <div>
          <small>سلام امیر</small>
          <h3>داشبورد خزانه</h3>
        </div>
        <div className="superapp-avatar">ام</div>
      </div>
      <div className="superapp-card-treasury">
        <small>خالص نقدینگی</small>
        <h2>۲٬۸۴۰٬۰۰۰٬۰۰۰</h2>
        <span className="superapp-trend">▲ ۱۲٪ این ماه</span>
      </div>
      <div className="superapp-grid-2">
        <div className="superapp-mini-card">
          <Receipt size={14} /><small>فروش</small><b>۸۹۰ م</b>
        </div>
        <div className="superapp-mini-card">
          <Wallet size={14} /><small>خرید</small><b>۳۲۰ م</b>
        </div>
        <div className="superapp-mini-card">
          <Check size={14} /><small>چک دریافتی</small><b>۱۲ عدد</b>
        </div>
        <div className="superapp-mini-card">
          <TrendingUp size={14} /><small>پیش‌بینی</small><b>+۸٪</b>
        </div>
      </div>
      <div className="superapp-card-ai">
        <Sparkles size={16} />
        <p>توصیه هوش مصنوعی: «سررسید ارزش افزوده سه‌شنبه است. ۲۴ ساعت قبل ثبت کنید تا جریمه نشود.»</p>
      </div>
    </div>
  );
}

function PhoneAccounting() {
  return (
    <div className="superapp-screen">
      <div className="superapp-screen-header">
        <h3>صورتحساب مودیان</h3>
      </div>
      <div className="superapp-invoice">
        <div className="superapp-invoice-row">
          <span>شناسه یکتا</span>
          <b>۰۰۱۲۳۴۵۶۷۸۹۰۱۲۳۴۵۶۷۸۹</b>
        </div>
        <div className="superapp-invoice-row">
          <span>مشتری</span>
          <b>شرکت آریا</b>
        </div>
        <div className="superapp-invoice-row">
          <span>مبلغ</span>
          <b>۲۳۰٬۰۰۰٬۰۰۰ ت</b>
        </div>
        <div className="superapp-invoice-row">
          <span>ارزش افزوده</span>
          <b>۲۳٬۰۰۰٬۰۰۰ ت</b>
        </div>
        <div className="superapp-invoice-total">
          <span>جمع کل</span>
          <b>۲۵۳٬۰۰۰٬۰۰۰ ت</b>
        </div>
      </div>
      <button className="superapp-action-btn">صدور فاکتور رسمی</button>
      <button className="superapp-action-btn superapp-action-btn-secondary">خروجی چاپی با مهر</button>
    </div>
  );
}

function PhoneAI() {
  return (
    <div className="superapp-screen">
      <div className="superapp-screen-header">
        <h3>استودیو هوش مصنوعی</h3>
      </div>
      <div className="superapp-ai-feature">
        <Camera size={20} />
        <div><b>اسکنر فاکتور</b><small>عکس بگیرید، فاکتور می‌سازیم</small></div>
      </div>
      <div className="superapp-ai-feature">
        <ScrollText size={20} />
        <div><b>لایحه دفاعیه</b><small>مستند به مواد قانونی</small></div>
      </div>
      <div className="superapp-ai-feature">
        <Mic size={20} />
        <div><b>دستیار صوتی</b><small>سه شخصیت حرفه‌ای</small></div>
      </div>
      <div className="superapp-ai-feature">
        <TrendingUp size={20} />
        <div><b>رادار نقدینگی</b><small>پیش‌بینی ۳۰ روزه</small></div>
      </div>
    </div>
  );
}

function PhoneContracts() {
  return (
    <div className="superapp-screen">
      <div className="superapp-screen-header">
        <h3>قراردادساز</h3>
      </div>
      <div className="superapp-contract-item"><FileSignature size={16} /><span>قرارداد کار</span></div>
      <div className="superapp-contract-item"><FileSignature size={16} /><span>پیمانکاری ماده ۳۸</span></div>
      <div className="superapp-contract-item"><FileSignature size={16} /><span>فریلنسری</span></div>
      <div className="superapp-contract-item"><FileSignature size={16} /><span>محرمانگی</span></div>
      <div className="superapp-signature-pad">
        <small>امضای دیجیتال لمسی</small>
        <div className="superapp-signature-line" />
      </div>
    </div>
  );
}

function PhoneTools() {
  return (
    <div className="superapp-screen">
      <div className="superapp-screen-header">
        <h3>محاسبه‌گرها</h3>
      </div>
      <div className="superapp-calc-result">
        <small>حقوق پایه ۱۴۰۵</small>
        <h2>۲۳٬۴۰۰٬۰۰۰</h2>
        <small>تومان</small>
      </div>
      <div className="superapp-calc-row"><span>بیمه سهم کارگر</span><b>۱٬۶۳۸٬۰۰۰</b></div>
      <div className="superapp-calc-row"><span>مالیات</span><b>۱٬۲۰۰٬۰۰۰</b></div>
      <div className="superapp-calc-row"><span>حق اولاد</span><b>۱٬۶۸۰٬۰۰۰</b></div>
      <div className="superapp-calc-total"><span>خالص پرداختی</span><b>۲۲٬۸۸۲٬۰۰۰ ت</b></div>
    </div>
  );
}

/* ═══ کامپوننت اصلی ═══ */

export default function SuperAppLanding() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="superapp-page">
      {/* ═══ ۱. هیرو ═══ */}
      <section className="superapp-hero">
        <div className="superapp-hero-bg" aria-hidden>
          <div className="superapp-blob superapp-blob-1" />
          <div className="superapp-blob superapp-blob-2" />
        </div>

        <div className="container superapp-hero-inner">
          <div className="superapp-hero-copy">
            <span className="superapp-hero-eyebrow">
              <Sparkles size={14} /> کاربان سوپراپ — نسخه موبایل
            </span>
            <h1>
              دستیار هوشمند حسابداری ابری، سامانه مودیان، قراردادساز و مشاور حقوقی-مالیاتی ۱۴۰۵
              <span className="superapp-hero-h1-accent"> در جیب شما.</span>
            </h1>
            <p className="superapp-hero-lead">
              یک سوپراپ موبایل‌محور با ۵ بخش یکپارچه، ۲۱ قابلیت پیشرفته و ۴ ابرقابلیت هوش مصنوعی. کار آفلاین، نصب فوری و خروجی بومی اندروید و iOS.
            </p>
            <div className="superapp-hero-cta">
              <a href="#plans" className="superapp-btn superapp-btn-primary">
                شروع تست ۱۰ روزه رایگان <ArrowLeft size={16} />
              </a>
              <span className="superapp-btn superapp-btn-ghost">
                <Smartphone size={16} /> اندروید · iOS · وب
              </span>
            </div>
            <div className="superapp-hero-trust">
              {trustBadges.map((b, i) => {
                const Icon = b.icon;
                return (
                  <span key={i}>
                    <Icon size={14} /> {b.label}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="superapp-hero-phone">
            <PhoneMockup />
          </div>
        </div>
      </section>

      {/* ═══ ۲. آمار ═══ */}
      <section className="superapp-stats">
        <div className="container">
          <div className="superapp-stats-grid">
            {stats.map((s, i) => (
              <div key={i} className="superapp-stat">
                <b>{s.value}</b>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ ۳. بخش‌های سوپراپ ═══ */}
      <section className="superapp-sections">
        <div className="container">
          <div className="superapp-section-head">
            <span className="superapp-eyebrow">۵ بخش یکپارچه</span>
            <h2>یک سوپراپ، همه‌چیز در جیب شما</h2>
            <p>هر بخش به‌صورت کشوی پایین صفحه باز می‌شود و تجربه‌ای روان و موبایل‌محور ارائه می‌دهد.</p>
          </div>

          <div className="superapp-sections-grid">
            {sections.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.id} className="superapp-section-card">
                  <div className="superapp-section-icon">
                    <Icon size={22} />
                  </div>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                  <ul>
                    {s.features.map((f, j) => (
                      <li key={j}>
                        <Check size={13} /> {f}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ ۴. ابرقابلیت‌های هوش مصنوعی ═══ */}
      <section className="superapp-ai-section">
        <div className="container">
          <div className="superapp-section-head">
            <span className="superapp-eyebrow">۴ ابرقابلیت اختصاصی</span>
            <h2>استودیو هوش مصنوعی کاربان</h2>
            <p>قدرت موتور هوش مصنوعی جمینای در ۴ ابرقابلیت مخصوص کاربران موبایل کاربان.</p>
          </div>
          <div className="superapp-ai-grid">
            {aiSuper.map((a, i) => {
              const Icon = a.icon;
              return (
                <div key={i} className="superapp-ai-card">
                  <div className="superapp-ai-icon">
                    <Icon size={26} />
                  </div>
                  <h3>{a.title}</h3>
                  <p>{a.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ ۵. امنیت و آفلاین ═══ */}
      <section className="superapp-security">
        <div className="container superapp-security-inner">
          <div className="superapp-security-content">
            <span className="superapp-eyebrow">امنیت و آفلاین</span>
            <h2>امنیت بانکی، کار آفلاین کامل</h2>
            <ul className="superapp-security-list">
              <li>
                <Fingerprint size={20} />
                <div>
                  <b>قفل بیومتریک موبایل</b>
                  <p>اثر انگشت یا تشخیص چهره بومی موبایل + پین‌کد پشتیبان با انیمیشن نرم.</p>
                </div>
              </li>
              <li>
                <Database size={20} />
                <div>
                  <b>آفلاین‌محور</b>
                  <p>داده‌ها روی حافظه دستگاه + همگام‌سازی ابری + پشتیبان‌گیری فایل.</p>
                </div>
              </li>
              <li>
                <FileText size={20} />
                <div>
                  <b>خروجی چاپ رسمی</b>
                  <p>چاپ استاندارد با مهر کاربان، امضای دیجیتال لمسی و خروجی فایل.</p>
                </div>
              </li>
              <li>
                <Lock size={20} />
                <div>
                  <b>رمزنگاری ابری</b>
                  <p>تمام داده‌ها با رمزنگاری ابری ذخیره می‌شوند.</p>
                </div>
              </li>
            </ul>
          </div>
          <div className="superapp-security-phone">
            <PhoneMockup />
          </div>
        </div>
      </section>

      {/* ═══ ۶. تعرفه‌ها ═══ */}
      <section className="superapp-plans" id="plans">
        <div className="container">
          <div className="superapp-section-head">
            <span className="superapp-eyebrow">تعرفه‌ها</span>
            <h2>پلن متناسب با کسب‌وکار شما</h2>
            <p>تست رایگان ۱۰ روزه بدون کارت بانکی. ضمانت بازگشت وجه ۷ روزه.</p>
          </div>

          <div className="superapp-billing-toggle">
            <button className={billing === 'monthly' ? 'active' : ''} onClick={() => setBilling('monthly')}>
              ماهانه
            </button>
            <button className={billing === 'yearly' ? 'active' : ''} onClick={() => setBilling('yearly')}>
              سالانه <span className="superapp-billing-badge">۲ ماه هدیه</span>
            </button>
          </div>

          <div className="superapp-plans-grid">
            {plans.map((p, i) => (
              <div key={i} className={`superapp-plan ${p.highlight ? 'superapp-plan-highlight' : ''}`}>
                {p.badge && <span className="superapp-plan-badge">{p.badge}</span>}
                <h3>{p.name}</h3>
                <div className="superapp-plan-price">
                  <b>{p.price}</b>
                  <span>تومان / {p.period}</span>
                </div>
                <ul>
                  {p.features.map((f, j) => (
                    <li key={j}>
                      <Check size={12} /> {f}
                    </li>
                  ))}
                </ul>
                <button className={`superapp-btn ${p.highlight ? 'superapp-btn-primary' : 'superapp-btn-outline'}`}>
                  {p.cta}
                </button>
              </div>
            ))}
          </div>

          <div className="superapp-promo">
            <Sparkles size={16} /> کد تخفیف <code>کاربان۱۴۰۵</code> — ۲۵٪ تخفیف روی همه پلن‌ها
          </div>
        </div>
      </section>

      {/* ═══ ۷. سوالات متداول ═══ */}
      <section className="superapp-faq">
        <div className="container">
          <div className="superapp-section-head">
            <span className="superapp-eyebrow">سوالات متداول</span>
            <h2>هر آنچه باید بدانید</h2>
            <p>مخصوص مدیران، حسابداران و صاحبان مشاغل ایرانی.</p>
          </div>
          <div className="superapp-faq-list">
            {faqs.map((f, i) => (
              <div key={i} className={`superapp-faq-item ${openFaq === i ? 'open' : ''}`}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span>{f.q}</span>
                  <ChevronDown size={18} />
                </button>
                {openFaq === i && <p>{f.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ ۸. فراخوان نهایی ═══ */}
      <section className="superapp-cta-final">
        <div className="container">
          <div className="superapp-cta-card">
            <h2>همین حالا کاربان را در جیب خود داشته باشید</h2>
            <p>تست ۱۰ روزه رایگان — بدون کارت بانکی. نصب در کمتر از ۳۰ ثانیه.</p>
            <div className="superapp-cta-buttons">
              <a href="#plans" className="superapp-btn superapp-btn-primary">
                شروع رایگان <ArrowLeft size={16} />
              </a>
              <a href="https://github.com/Alirezat01/karban" target="_blank" rel="noopener" className="superapp-btn superapp-btn-secondary">
                <FileText size={16} /> مشاهده در گیت‌هاب
              </a>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
