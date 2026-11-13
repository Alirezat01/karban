import { useEffect, useState } from 'react';
import {
  ArrowLeft, ArrowRight, BadgeCheck, Bell, BookOpen, Brain, Camera, Check, ChevronDown,
  Coins, Database, FileSignature, FileText, Fingerprint, Gavel, LayoutDashboard,
  Lock, MessageSquare, Mic, Moon, Receipt, ScrollText, Shield, Smartphone,
  Sparkles, Star, Sun, TrendingUp, Wallet, Zap,
} from 'lucide-react';
import { useRevealGroup } from '@/lib/reveal';
import SiteFooter from '@/components/SiteFooter';

/* ════════════════════════════════════════════════════════════════════════════
   کاربان سوپراپ — صفحه معرفی موبایل اپ
   ════════════════════════════════════════════════════════════════════════════ */

const PWA_INSTALL_HINT = 'karban-superapp-pwa-install';

/* ═════ داده‌ها ═════ */

const trustBadges = [
  { icon: BadgeCheck, label: 'مطابق قوانین ۱۴۰۵' },
  { icon: Receipt, label: 'سامانه مودیان' },
  { icon: Shield, label: 'صیاد بانک مرکزی' },
  { icon: Lock, label: 'رمزنگاری ابری' },
];

const stats = [
  { value: '۵', label: 'بخش یکپارچه سوپراپ' },
  { value: '۲۱', label: 'قابلیت پیشرفته' },
  { value: '۱۰۰٪', label: 'کار آفلاین' },
  { value: '۴۳۰px', label: 'طراحی موبایل‌محور' },
];

const sections = [
  {
    id: 'home',
    icon: LayoutDashboard,
    title: 'خانه — داشبورد خزانه',
    color: '#6D28D9',
    desc: 'نمایش خالص نقدینگی، فروش، خرید و چک‌های دریافتنی/پرداختنی در یک نگاه.',
    features: [
      'پیش‌بینی نقدینگی ۹۰ روزه با نمودار D3.js',
      'توصیه صرفه‌جویی مالیاتی روزانه بر اساس تقویم شمسی',
      'تقویم تکالیف مالیاتی و بیمه‌ای ۱۴۰۵',
      'دفتر چک صیادی و دفتر روزنامه',
      'ویجت کارت سه‌بعدی خزانه',
    ],
  },
  {
    id: 'accounting',
    icon: Receipt,
    title: 'حسابداری و سامانه مودیان',
    color: '#F59E0B',
    desc: 'صدور صورتحساب الکترونیکی فروش، خرید، پیش‌فاکتور و برگشت از فروش مطابق مودیان.',
    features: [
      'شناسه یکتای ۲۲ رقمی مودیان و ۱۳ رقمی کالا/خدمات',
      'محاسبه خودکار ۱۰٪ ارزش افزوده و حروف فارسی مبلغ',
      'مدیریت چک‌های صیادی ۱۶ رقمی با استعلام رنگ',
      'دفتر روزنامه دوطرفه خودکار و تراز ۴ ستونی',
      'گزارش معاملات فصلی ماده ۱۶۹',
      'خروجی مستقیم PDF با مهر کاربان و امضای دیجیتال',
    ],
  },
  {
    id: 'ai',
    icon: Brain,
    title: 'استودیو هوش مصنوعی (Gemini)',
    color: '#A78BFA',
    desc: 'قدرت Gemini سمت سرور در ۴ ابرقابلیت اختصاصی موبایل.',
    features: [
      'اسکنر AI OCR فاکتور و چک با دوربین',
      'اسکنر زنده QR Code چک صیادی با jsQR',
      'تولید خودکار لایحه دفاعیه مالیاتی (مواد ۹۷، ۱۶۹، ۲۱۶، ۲۳۸)',
      'تحلیل‌گر ریسک قراردادها با امتیاز ۰ تا ۱۰۰',
      'رادار پیش‌بینی نقدینگی ۳۰ روزه (AI CFO)',
      'دستیار صوتی با ۳ شخصیت: CFO، مشاور مالیاتی، وکیل قراردادها',
    ],
  },
  {
    id: 'contracts',
    icon: FileSignature,
    title: 'قراردادها و گاوصندوق اسناد',
    color: '#6D28D9',
    desc: 'قراردادساز استاندارد + نامه‌نگار اداری + گاوصندوق امن اسناد.',
    features: [
      'قرارداد کار، پیمانکاری ماده ۳۸، فریلنسری، NDA',
      'نامه‌نگار اداری و منابع انسانی',
      'پد امضای دیجیتال لمسی روی صفحه موبایل',
      'گاوصندوق اسناد برای بایگانی قراردادها و لوایح',
      'خروجی PDF رسمی با مهر و امضا',
    ],
  },
  {
    id: 'tools',
    icon: Calculator,
    title: 'محاسبه‌گرها و بانک قوانین',
    color: '#F59E0B',
    desc: 'ماشین‌حساب جامع حقوق، سنوات، عیدی + بانک مواد قانونی کاربردی.',
    features: [
      'محاسبه حقوق، دستمزد و بیمه ۱۴۰۵',
      'محاسبه سنوات، عیدی و بازخرید مرخصی',
      'سنجش سلامت مالیاتی و بیمه‌ای',
      'بانک مواد قانونی (کار، مودیان، ماده ۳۸، صیادی)',
      'چک‌لیست‌های اجرایی',
    ],
  },
];

const aiSuper = [
  { icon: Camera, title: 'اسکنر چک صیادی', desc: 'خواندن مستقیم بارکد روی برگه چک صیادی با دوربین و پر کردن خودکار فیلدها.' },
  { icon: ScrollText, title: 'لایحه دفاعیه خودکار', desc: 'نگارش لایحه رسمی مستند به مواد ۹۷، ۱۶۹، ۲۱۶، ۲۳۸، ۲۴۴ و ۲۵۱ مکرر + درصد شانس موفقیت.' },
  { icon: Mic, title: 'دستیار صوتی CFO', desc: 'چت‌بات حقوقی-مالیاتی چندنوبته با ۳ شخصیت حرفه‌ای و هدایت صوتی.' },
  { icon: TrendingUp, title: 'رادار نقدینگی D3.js', desc: 'تحلیل ریسک کسری نقدینگی ۳۰ روزه، سررسید چک و بدهی مالیاتی.' },
];

const plans = [
  {
    name: 'تست رایگان',
    price: '۰',
    period: '۱۰ روز',
    badge: null,
    features: ['۲۵ فاکتور', '۱۵ چت AI', '۵ تحلیل هوشمند', '۱ کسب‌وکار'],
    cta: 'شروع رایگان',
    highlight: false,
  },
  {
    name: 'ماهانه پیشرفته',
    price: '۴۹۰٬۰۰۰',
    period: 'ماه',
    badge: null,
    features: ['۳ کسب‌وکار', 'فاکتور نامحدود', '۲۰ چت روزانه', '۱۰ تحلیل روزانه', 'اسکنر OCR', 'لایحه مالیاتی'],
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
    name: 'بنیان‌گذار VIP',
    price: '۹٬۸۰۰٬۰۰۰',
    period: 'یک‌باره',
    badge: 'محدود',
    features: ['۱۰ شرکت هم‌زمان', 'AI و اسکنر نامحدود ∞', 'مشاور اختصاصی', 'راه‌اندازی مالیاتی'],
    cta: 'همکاری ویژه',
    highlight: false,
  },
];

const faqs = [
  {
    q: 'آیا کاربان سوپراپ نیاز به نصب دارد؟',
    a: 'خیر، کاربان یک PWA است و می‌توانید مستقیماً از مرورگر موبایل استفاده کنید. در Android می‌توانید «افزودن به صفحه اصلی» را بزنید و در iOS Safari گزینه «افزودن به صفحه اصلی» را انتخاب کنید. نصب کامل APK/AAB و IPA از طریق Capacitor هم در راه است.',
  },
  {
    q: 'آیا بدون اینترنت هم کار می‌کند؟',
    a: 'بله، کاربان Offline-First است. تمام داده‌ها روی حافظه دستگاه شما ذخیره می‌شوند و وقتی اینترنت وصل شد، با دیتابیس ابری Supabase همگام‌سازی می‌شوند. می‌توانید از منوی تنظیمات پشتیبان‌گیری کامل JSON بگیرید.',
  },
  {
    q: 'آیا صورتحساب‌های صادرشده مطابق سامانه مودیان هستند؟',
    a: 'بله، کاربان صدور صورتحساب الکترونیک فروش، خرید، پیش‌فاکتور و برگشت از فروش را با شناسه یکتای ۲۲ رقمی مودیان و شناسه ۱۳ رقمی کالا/خدمات انجام می‌دهد. ارزش افزوده ۱۰٪ به‌صورت خودکار محاسبه و در حروف فارسی درج می‌شود.',
  },
  {
    q: 'امنیت داده‌های من چگونه تأمین می‌شود؟',
    a: 'کاربان از قفل بیومتریک موبایل (اثر انگشت/Face ID) پشتیبانی می‌کند. تمام داده‌ها با رمزنگاری ابری Supabase ذخیره می‌شوند. همچنین پین‌کد پشتیبان با انیمیشن ورود و خروج نرم در دسترس است.',
  },
  {
    q: 'آیا لایحه دفاعیه مالیاتی واقعاً توسط هوش مصنوعی نوشته می‌شود؟',
    a: 'بله، استودیو هوش مصنوعی کاربان متصل به Gemini API سمت سرور است. لایحه‌ها به مواد ۹۷، ۱۶۹، ۲۱۶، ۲۳۸، ۲۴۴ و ۲۵۱ مکرر مستند می‌شوند، درصد شانس موفقیت نمایش داده می‌شود و خروجی PDF در گاوصندوق اسناد ذخیره می‌شود.',
  },
  {
    q: 'تفاوت پلن سالانه با ماهانه چیست؟',
    a: 'پلن سالانه ۲ ماه هدیه می‌دهد (معادل ۱۷٪ تخفیف)، به‌علاوه رادار پیش‌بینی نقدینگی ۳۰ روزه و پشتیبانی اولویت‌دار. همچنین سقف کسب‌وکار از ۳ به ۵ می‌رسد.',
  },
  {
    q: 'آیا می‌توانم قبل از خرید تست کنم؟',
    a: 'بله، تست ۱۰ روزه رایگان بدون نیاز به کارت بانکی در دسترس است. تا ۲۵ فاکتور، ۱۵ چت AI و ۵ تحلیل هوشمند می‌توانید استفاده کنید. ضمانت بازگشت وجه ۷ روزه هم برای پلن‌های پولی وجود دارد.',
  },
];

/* ═════ کامپوننت‌های فرعی ═════ */

function PhoneMockup({ activeTab = 0 }: { activeTab?: number }) {
  const tabs = [
    { icon: LayoutDashboard, label: 'خانه' },
    { icon: Receipt, label: 'حسابداری' },
    { icon: Brain, label: 'AI' },
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
            {activeTab === 0 && <PhoneScreenHome />}
            {activeTab === 1 && <PhoneScreenAccounting />}
            {activeTab === 2 && <PhoneScreenAI />}
            {activeTab === 3 && <PhoneScreenContracts />}
            {activeTab === 4 && <PhoneScreenTools />}
          </div>
          <div className="superapp-phone-tabbar">
            {tabs.map((t, i) => {
              const Icon = t.icon;
              return (
                <div key={i} className={`superapp-phone-tab ${i === activeTab ? 'active' : ''}`}>
                  <Icon size={18} />
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

function PhoneScreenHome() {
  return (
    <div className="superapp-screen">
      <div className="superapp-screen-header">
        <div>
          <small>سلام امیر</small>
          <h3>داشبورد خزانه</h3>
        </div>
        <div className="superapp-avatar">ام</div>
      </div>
      <div className="superapp-card superapp-card-treasury">
        <small>خالص نقدینگی</small>
        <h2>۲٬۸۴۰٬۰۰۰٬۰۰۰</h2>
        <span className="superapp-trend">▲ ۱۲٪ این ماه</span>
      </div>
      <div className="superapp-grid-2">
        <div className="superapp-mini-card">
          <Receipt size={14} />
          <small>فروش</small>
          <b>۸۹۰ م</b>
        </div>
        <div className="superapp-mini-card">
          <Wallet size={14} />
          <small>خرید</small>
          <b>۳۲۰ م</b>
        </div>
        <div className="superapp-mini-card">
          <Check size={14} />
          <small>چک دریافتی</small>
          <b>۱۲ عدد</b>
        </div>
        <div className="superapp-mini-card">
          <TrendingUp size={14} />
          <small>پیش‌بینی</small>
          <b>+۸٪</b>
        </div>
      </div>
      <div className="superapp-card superapp-card-ai">
        <Sparkles size={16} />
        <p>توصیه AI: «سررسید ارزش افزوده سه‌شنبه است. ۲۴ ساعت قبل ثبت کنید تا جریمه نشود.»</p>
      </div>
    </div>
  );
}

function PhoneScreenAccounting() {
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
          <span>ارزش افزوده (۱۰٪)</span>
          <b>۲۳٬۰۰۰٬۰۰۰ ت</b>
        </div>
        <div className="superapp-invoice-total">
          <span>جمع کل</span>
          <b>۲۵۳٬۰۰۰٬۰۰۰ ت</b>
        </div>
      </div>
      <button className="superapp-action-btn">
        <FileText size={16} /> صدور فاکتور رسمی
      </button>
      <button className="superapp-action-btn superapp-action-btn-secondary">
        <Receipt size={16} /> خروجی PDF با مهر کاربان
      </button>
    </div>
  );
}

function PhoneScreenAI() {
  return (
    <div className="superapp-screen">
      <div className="superapp-screen-header">
        <h3>استودیو هوش مصنوعی</h3>
      </div>
      <div className="superapp-ai-feature">
        <Camera size={20} />
        <div>
          <b>اسکنر فاکتور</b>
          <small>عکس بگیرید، فاکتور می‌سازیم</small>
        </div>
      </div>
      <div className="superapp-ai-feature">
        <ScrollText size={20} />
        <div>
          <b>لایحه دفاعیه</b>
          <small>مواد ۹۷، ۱۶۹، ۲۱۶، ۲۳۸...</small>
        </div>
      </div>
      <div className="superapp-ai-feature">
        <Mic size={20} />
        <div>
          <b>دستیار صوتی CFO</b>
          <small>۳ شخصیت حرفه‌ای</small>
        </div>
      </div>
      <div className="superapp-ai-feature">
        <TrendingUp size={20} />
        <div>
          <b>رادار نقدینگی</b>
          <small>پیش‌بینی ۳۰ روزه</small>
        </div>
      </div>
    </div>
  );
}

function PhoneScreenContracts() {
  return (
    <div className="superapp-screen">
      <div className="superapp-screen-header">
        <h3>قراردادساز</h3>
      </div>
      <div className="superapp-contract-item">
        <FileSignature size={16} />
        <span>قرارداد کار قانون کار</span>
      </div>
      <div className="superapp-contract-item">
        <FileSignature size={16} />
        <span>پیمانکاری ماده ۳۸</span>
      </div>
      <div className="superapp-contract-item">
        <FileSignature size={16} />
        <span>فریلنسری</span>
      </div>
      <div className="superapp-contract-item">
        <FileSignature size={16} />
        <span>NDA محرمانگی</span>
      </div>
      <div className="superapp-signature-pad">
        <small>امضای دیجیتال لمسی</small>
        <div className="superapp-signature-line" />
      </div>
    </div>
  );
}

function PhoneScreenTools() {
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
      <div className="superapp-calc-row">
        <span>بیمه سهم کارگر (۷٪)</span>
        <b>۱٬۶۳۸٬۰۰۰</b>
      </div>
      <div className="superapp-calc-row">
        <span>مالیات</span>
        <b>۱٬۲۰۰٬۰۰۰</b>
      </div>
      <div className="superapp-calc-row">
        <span>حق اولاد</span>
        <b>۱٬۶۸۰٬۰۰۰</b>
      </div>
      <div className="superapp-calc-total">
        <span>خالص پرداختی</span>
        <b>۲۲٬۸۸۲٬۰۰۰ ت</b>
      </div>
    </div>
  );
}

/* ═════ کامپوننت اصلی ═════ */

export default function SuperAppLanding() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [activeTab, setActiveTab] = useState(0);
  const heroRef = useRevealGroup('.superapp-reveal');

  /* تب‌های موکاپ موبایل هر ۳ ثانیه عوض می‌شن */
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => {
      setActiveTab((t) => (t + 1) % 5);
    }, 3500);
    return () => clearInterval(id);
  }, []);

  /* نصب PWA */
  const [canInstall, setCanInstall] = useState(false);
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      window.localStorage.setItem(PWA_INSTALL_HINT, 'available');
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    const already = window.localStorage.getItem(PWA_INSTALL_HINT) === 'available';
    setCanInstall(already);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = () => {
    const ev = new Event('beforeinstallprompt');
    window.dispatchEvent(ev);
    const evt = window as unknown as { promptEvent?: { prompt: () => void } };
    if (evt.promptEvent) evt.promptEvent.prompt();
  };

  return (
    <div className="superapp-page">
      {/* ═════ ۱. Hero ═════ */}
      <section className="superapp-hero" ref={heroRef as React.RefObject<HTMLDivElement>}>
        <div className="superapp-hero-bg" aria-hidden>
          <div className="superapp-blob superapp-blob-1" />
          <div className="superapp-blob superapp-blob-2" />
          <div className="superapp-blob superapp-blob-3" />
        </div>

        <div className="container superapp-hero-inner">
          <div className="superapp-hero-copy superapp-reveal">
            <span className="superapp-hero-eyebrow">
              <Sparkles size={14} /> کاربان سوپراپ — نسخه موبایل
            </span>
            <h1>
              دستیار هوشمند حسابداری ابری، سامانه مودیان، قراردادساز و مشاور حقوقی-مالیاتی ۱۴۰۵
              <br />
              <span className="superapp-hero-h1-accent">در جیب شما.</span>
            </h1>
            <p className="superapp-hero-lead">
              یک سوپراپ موبایل‌محور با ۵ بخش یکپارچه، ۲۱ قابلیت پیشرفته و ۴ ابرقابلیت هوش مصنوعی. کار آفلاین، نصب به‌عنوان PWA، خروجی APK/AAB و IPA آماده.
            </p>
            <div className="superapp-hero-cta">
              <a href="#plans" className="superapp-btn superapp-btn-primary">
                شروع تست ۱۰ روزه رایگان <ArrowLeft size={16} />
              </a>
              {canInstall ? (
                <button onClick={handleInstall} className="superapp-btn superapp-btn-secondary">
                  <Smartphone size={16} /> نصب روی موبایل
                </button>
              ) : (
                <span className="superapp-btn superapp-btn-ghost">
                  <Smartphone size={16} /> Android · iOS · وب
                </span>
              )}
            </div>
            <div className="superapp-platforms">
              <BadgeCheck size={14} /> نصب فوری به‌عنوان PWA
              <span>·</span>
              خروجی بومی APK/AAB و IPA با Capacitor
              <span>·</span>
              شناسه ir.karbanapp.mobile
            </div>
          </div>

          <div className="superapp-hero-phone superapp-reveal">
            <PhoneMockup activeTab={activeTab} />
            <div className="superapp-tab-switcher" aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => (
                <button
                  key={i}
                  className={i === activeTab ? 'active' : ''}
                  onClick={() => setActiveTab(i)}
                  aria-label={`تب ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═════ ۲. نوار اعتماد ═════ */}
      <section className="superapp-trust">
        <div className="container">
          <div className="superapp-trust-grid">
            {trustBadges.map((b, i) => {
              const Icon = b.icon;
              return (
                <div key={i} className="superapp-trust-item superapp-reveal">
                  <Icon size={18} />
                  <span>{b.label}</span>
                </div>
              );
            })}
          </div>
          <div className="superapp-stats-row">
            {stats.map((s, i) => (
              <div key={i} className="superapp-stat superapp-reveal">
                <b>{s.value}</b>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═════ ۳. نمایش ۵ بخش سوپراپ ═════ */}
      <section className="superapp-sections">
        <div className="container">
          <div className="superapp-section-head superapp-reveal">
            <span className="superapp-eyebrow">۵ بخش یکپارچه</span>
            <h2>یک سوپراپ، همه‌چیز در جیب شما</h2>
            <p>هر بخش به‌صورت کشوی پایین صفحه (Bottom Sheet) باز می‌شود و تجربه‌ای روان و موبایل‌محور ارائه می‌دهد.</p>
          </div>

          <div className="superapp-sections-grid">
            {sections.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.id} className="superapp-section-card superapp-reveal" style={{ '--accent': s.color } as React.CSSProperties}>
                  <div className="superapp-section-icon">
                    <Icon size={20} />
                  </div>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                  <ul>
                    {s.features.map((f, j) => (
                      <li key={j}>
                        <Check size={12} /> {f}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═════ ۴. ۴ ابرقابلیت AI ═════ */}
      <section className="superapp-ai-section">
        <div className="container">
          <div className="superapp-section-head superapp-reveal">
            <span className="superapp-eyebrow superapp-eyebrow-ai">۴ ابرقابلیت اختصاصی موبایل</span>
            <h2>استودیو هوش مصنوعی کاربان</h2>
            <p>قدرت Gemini API سمت سرور در ۴ ابرقابلیت مخصوص کاربران موبایل کاربان.</p>
          </div>
          <div className="superapp-ai-grid">
            {aiSuper.map((a, i) => {
              const Icon = a.icon;
              return (
                <div key={i} className="superapp-ai-card superapp-reveal">
                  <div className="superapp-ai-icon">
                    <Icon size={24} />
                  </div>
                  <h3>{a.title}</h3>
                  <p>{a.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═════ ۵. امنیت و کار آفلاین ═════ */}
      <section className="superapp-security">
        <div className="container superapp-security-inner">
          <div className="superapp-security-content superapp-reveal">
            <span className="superapp-eyebrow">امنیت و آفلاین</span>
            <h2>امنیت بانکی، کار آفلاین کامل</h2>
            <ul className="superapp-security-list">
              <li>
                <Fingerprint size={18} />
                <div>
                  <b>قفل بیومتریک موبایل</b>
                  <p>اثر انگشت / Face ID بومی موبایل + پین‌کد پشتیبان با انیمیشن نرم.</p>
                </div>
              </li>
              <li>
                <Database size={18} />
                <div>
                  <b>Offline-First</b>
                  <p>داده‌ها روی حافظه دستگاه + همگام‌سازی ابری Supabase + پشتیبان‌گیری JSON.</p>
                </div>
              </li>
              <li>
                <FileText size={18} />
                <div>
                  <b>خروجی PDF رسمی</b>
                  <p>چاپ استاندارد A4 با مهر کاربان، امضای دیجیتال لمسی و خروجی مستقیم فایل.</p>
                </div>
              </li>
              <li>
                <Lock size={18} />
                <div>
                  <b>رمزنگاری ابری</b>
                  <p>تمام داده‌ها با رمزنگاری Supabase ذخیره می‌شوند.</p>
                </div>
              </li>
            </ul>
          </div>
          <div className="superapp-security-phone superapp-reveal">
            <PhoneMockup activeTab={0} />
          </div>
        </div>
      </section>

      {/* ═════ ۶. تعرفه‌ها ═════ */}
      <section className="superapp-plans" id="plans">
        <div className="container">
          <div className="superapp-section-head superapp-reveal">
            <span className="superapp-eyebrow">تعرفه‌ها</span>
            <h2>پلن متناسب با کسب‌وکار شما</h2>
            <p>تست رایگان ۱۰ روزه بدون کارت بانکی. ضمانت بازگشت وجه ۷ روزه.</p>
          </div>

          <div className="superapp-billing-toggle superapp-reveal">
            <button
              className={billing === 'monthly' ? 'active' : ''}
              onClick={() => setBilling('monthly')}
            >
              ماهانه
            </button>
            <button
              className={billing === 'yearly' ? 'active' : ''}
              onClick={() => setBilling('yearly')}
            >
              سالانه <span className="superapp-billing-badge">۲ ماه هدیه</span>
            </button>
          </div>

          <div className="superapp-plans-grid">
            {plans.map((p, i) => (
              <div
                key={p.name}
                className={`superapp-plan superapp-reveal ${p.highlight ? 'superapp-plan-highlight' : ''}`}
              >
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

          <div className="superapp-promo superapp-reveal">
            <Sparkles size={16} /> کد تخفیف <code>کاربان۱۴۰۵</code> — ۲۵٪ تخفیف روی همه پلن‌ها
          </div>
        </div>
      </section>

      {/* ═════ ۷. FAQ ═════ */}
      <section className="superapp-faq">
        <div className="container">
          <div className="superapp-section-head superapp-reveal">
            <span className="superapp-eyebrow">سوالات متداول</span>
            <h2>هر آنچه باید بدانید</h2>
            <p>مخصوص مدیران، حسابداران و صاحبان مشاغل ایرانی.</p>
          </div>
          <div className="superapp-faq-list">
            {faqs.map((f, i) => (
              <div key={i} className={`superapp-faq-item superapp-reveal ${openFaq === i ? 'open' : ''}`}>
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

      {/* ═════ ۸. CTA نهایی ═════ */}
      <section className="superapp-cta-final">
        <div className="container">
          <div className="superapp-cta-card superapp-reveal">
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
