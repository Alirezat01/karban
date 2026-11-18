import { useEffect, useState } from 'react';
import {
  ArrowLeft, BadgeCheck, BookOpen, Brain, Camera, Check, ChevronDown, Coins,
  Database, FileSignature, FileText, Fingerprint, LayoutDashboard, Lock,
  Mic, Receipt, ScrollText, Shield, Smartphone, Sparkles, TrendingUp,
  Wallet, X,
} from 'lucide-react';
import SiteFooter from '@/components/SiteFooter';
import { isIranianMobile } from '@/lib/validation';
import {
  createAccessRequest, fetchSuperAppConfig,
  type SuperAppConfig, type SuperAppPlan,
} from '@/lib/superapp';

/* ════════════════════════════════════════════════════════════════════════════
   کاربان سوپراپ — صفحه معرفی موبایل اپ (نسخه ۳)
   ════════════════════════════════════════════════════════════════════════════
   تغییرات نسخه ۳ (هم‌تراز با فهرست کامل ۲۷ قابلیت):
     - فهرست امکانات هر ۵ بخش دقیقاً با مشخصات اپ هم‌تراز شد (۲۷ قابلیت)
     - قیمت‌ها و پلن‌ها از پنل مدیریت (superapp_settings) خوانده می‌شود
     - دکمه هر پلن «درخواست دسترسی» ثبت می‌کند؛ تایید از پنل ادمین انجام می‌شود
     - لینک «ورود به نسخه وب‌اپ موبایل» از تنظیمات ادمین (appUrl)
     - طراحی، رنگ‌ها و کلاس‌های CSS نسخه ۲ بدون تغییر مانده است
   ════════════════════════════════════════════════════════════════════════════ */

const faNum = (n: number) => n.toLocaleString('fa-IR');
const fmtToman = (n: number) => (n > 0 ? faNum(n) : '۰');

/* ═══ داده‌های ثابت صفحه (متن امکانات — هم‌تراز با فهرست ۲۷ قابلیت اپ) ═══ */

const stats = [
  { value: '۵', label: 'بخش یکپارچه' },
  { value: '۲۷', label: 'قابلیت پیشرفته' },
  { value: '۱۳', label: 'ماشین‌حساب ۱۴۰۵' },
  { value: '۱۰۰٪', label: 'کار آفلاین' },
];

const sections = [
  {
    id: 'home',
    icon: LayoutDashboard,
    title: 'خانه — داشبورد خزانه‌داری',
    desc: 'رادار مالی موبایل با هشدارهای زنده؛ همه‌چیز در بدو ورود با قفل بیومتریک محفوظ است.',
    features: [
      'قفل بیومتریک (اثرانگشت و تشخیص چهره) + پین اضطراری در بدو ورود',
      'کارت‌های هشدار سررسید اظهارنامه ارزش افزوده و لیست بیمه و حقوق',
      'رادار پیش‌بینی نقدینگی ۳۰ روزه با هشدار کسری چک و مالیات',
      'موتور توصیه‌های هوشمند صرفه‌جویی مالیاتی روزانه',
      'دستیار صوتی فارسی برای دستورهای سریع مالی و ناوبری',
      'تقویم تکالیف مالیاتی و بیمه سال ۱۴۰۵',
      'ویجت کارت فلزی سه‌بعدی نئوبانک در ۳ فینیش + دانلود تصویر کارت',
    ],
  },
  {
    id: 'accounting',
    icon: Receipt,
    title: 'حسابداری جامع و سامانه مودیان',
    desc: 'چرخه کامل مالی از فاکتور مودیان تا تراز آزمایشی — مطابق قانون مالیات‌های مستقیم.',
    features: [
      'صدور صورتحساب‌های رسمی مودیان (فروش، خرید، پیش‌فاکتور، برگشت از فروش) با شناسه یکتا و کد کالا و ۱۰٪ ارزش افزوده',
      'فیلتر بازه زمانی شمسی با تقویم هجری شمسی اختصاصی',
      'مدیریت چک‌های صیادی ۱۶ رقمی با نمایش گرافیکی برگه و استعلام رنگی',
      'ثبت هزینه با اعتبارسنجی مالیاتی مواد ۱۴۷ و ۱۴۸ ق.م.م',
      'بانک‌ها، صندوق نقدی، تنخواه + ثبت سریع دریافت و پرداخت با سند دوطرفه',
      'دفتر روزنامه دوطرفه، دفتر کل و تراز آزمایشی ۴ ستونی + سود و زیان',
      'گزارش ارزش افزوده ۱۰٪ و صورت معاملات فصلی ماده ۱۶۹',
      'مدیریت پروژه‌ها و دارایی ثابت با محاسبه استهلاک',
      'بانک طرف‌حساب‌ها و کاتالوگ کالا/خدمت + پیش‌نمایش چاپ و PDF فاکتور',
    ],
  },
  {
    id: 'ai',
    icon: Brain,
    title: 'استودیو هوش مصنوعی',
    desc: 'دو ابرقابلیت انحصاری موبایل با موتور جمینای + رادار و دستیار صوتی خزانه.',
    features: [
      'اسکنر هوشمند فاکتور کاغذی و چک صیادی با دوربین موبایل (AI OCR) و تبدیل خودکار به سند',
      'تولید لایحه دفاعیه رسمی مالیاتی و اداره کار با پیش‌نمایش چاپ و دانلود PDF',
      'رادار پیش‌بینی نقدینگی و هشدار کسری چک',
      'دستیار صوتی فارسی با ناوبری صوتی بین بخش‌ها',
    ],
  },
  {
    id: 'contracts',
    icon: FileSignature,
    title: 'قراردادساز، امضای لمسی و گاوصندوق',
    desc: 'قرارداد، امضا و بایگانی امن — همه در چند لمس روی صفحه موبایل.',
    features: [
      'تنظیم کامل ۲۳ نوع قرارداد رسمی کاربان ویژه ۲۰ صنف مختلف',
      'بوم امضای دیجیتال لمسی با انگشت و انتخاب رنگ قلم',
      'نامه‌ها و گواهی‌های اداری استاندارد (گواهی اشتغال، تسویه ماده ۲۴، حکم مرخصی و مأموریت)',
      'گاوصندوق رمزنگاری‌شده اسناد با دانلود مستقیم PDF',
    ],
  },
  {
    id: 'tools',
    icon: Coins,
    title: 'محاسبه‌گرهای ۱۴۰۵ و سلامت کسب‌وکار',
    desc: '۱۳ ماشین‌حساب تخصصی، اظهارنامه و چک‌لیست‌های اجرایی — بر اساس LEGAL_CONFIG_1405.',
    features: [
      '۱۳ ماشین‌حساب تخصصی ۱۴۰۵: حقوق، اضافه‌کاری، عیدی، سنوات، مالیات، بیمه و…',
      'دستیار ۳ مرحله‌ای اظهارنامه مالیاتی (ماده ۱۳۱ و اشخاص حقوقی ۲۵٪)',
      'تست جامع ۱۲گانه سنجش سلامت کسب‌وکار در ۳ حوزه',
      '۵ چک‌لیست ۸ مرحله‌ای اجرایی + بانک قوانین کار، مالیات و چک صیادی',
      'نصب‌شدنی به‌صورت PWA روی گوشی با نمایشگر وضعیت آفلاین',
    ],
  },
];

const aiSuper = [
  { icon: Camera, title: 'اسکنر فاکتور و چک صیادی', desc: 'عکس بگیر؛ موتور AI OCR متن فاکتور و بارکد ۱۶ رقمی چک را می‌خواند و سند حسابداری و رکورد چک را خودکار می‌سازد.' },
  { icon: ScrollText, title: 'لایحه دفاعیه خودکار', desc: 'لایحه رسمی مالیاتی و اداره کار، مستند به مواد ۱۶۹، ۲۴۴ و ۲۵۱ مکرر ق.م.م و قانون کار — با پیش‌نمایش چاپ A4 و دانلود PDF.' },
  { icon: Mic, title: 'دستیار صوتی مدیر مالی', desc: 'دستورهای مالی فارسی را می‌فهمد: ثبت هزینه، مرور چک‌ها، پرسش مالیاتی و پرش بین بخش‌های اپ.' },
  { icon: TrendingUp, title: 'رادار نقدینگی ۳۰ روزه', desc: 'پیش‌بینی جریان نقدی، هشدار کسری چک و تداخل سررسید مالیات — قبل از اینکه بحران شود.' },
];

const faqsStatic = [
  {
    q: 'آیا کاربان نیاز به نصب دارد؟',
    a: 'خیر، نسخه وب‌اپ موبایل مستقیماً از مرورگر اجرا می‌شود؛ در اندروید و iOS هم گزینه «افزودن به صفحه اصلی» را می‌زنید و کاربان مثل یک اپ واقعی تمام‌صفحه باز می‌شود. خروجی بومی اندروید و iOS نیز در راه است.',
  },
  {
    q: 'آیا بدون اینترنت هم کار می‌کند؟',
    a: 'بله، کاربان آفلاین‌محور است. تمام داده‌ها روی حافظه دستگاه ذخیره می‌شوند و با وصل‌شدن اینترنت، با دیتابیس ابری همگام می‌شود. از تنظیمات هم می‌توانید پشتیبان‌گیری کامل بگیرید.',
  },
  {
    q: 'آیا صورتحساب‌های صادرشده مطابق سامانه مودیان هستند؟',
    a: 'بله، صدور صورتحساب الکترونیک فروش، خرید رسمی، پیش‌فاکتور و برگشت از فروش با شناسه یکتای مودیان و کد کالا/خدمت انجام می‌شود؛ مالیات بر ارزش افزوده ۱۰٪ خودکار محاسبه و مبلغ به حروف فارسی درج می‌گردد.',
  },
  {
    q: 'امنیت داده‌های من چگونه تأمین می‌شود؟',
    a: 'اپ در بدو ورود با اثرانگشت یا تشخیص چهره قفل می‌شود و پین اضطراری هم دارد. گاوصندوق اسناد رمزنگاری‌شده است و بایگانی قراردادها و لوایح با پیش‌نمایش چاپ و دانلود مستقیم PDF در دسترس است.',
  },
  {
    q: 'اسکنر فاکتور و چک صیادی دقیقاً چه می‌کند؟',
    a: 'دوربین موبایل را روی فاکتور کاغذی یا برگه چک صیادی می‌گیرید؛ موتور هوش مصنوعی جمینای متن و بارکد را می‌خواند، مبلغ به رقم و حروف، شناسه ۱۶ رقمی، سررسید و نام بانک را استخراج و به‌صورت خودکار به سند حسابداری و رکورد چک تبدیل می‌کند.',
  },
  {
    q: 'تفاوت پلن سالانه با ماهانه چیست؟',
    a: 'پلن سالانه ۲ ماه هدیه می‌دهد (معادل ۱۷٪ تخفیف) و به‌همراه رادار پیش‌بینی نقدینگی ۳۰ روزه، دستیار صوتی و پشتیبانی اولویت‌دار، سقف کسب‌وکار از ۳ به ۵ می‌رسد. برای مؤسسین، پلن بنیان‌گذار با ۱۰ شرکت هم‌زمان و مشاور اختصاصی هم وجود دارد.',
  },
  {
    q: 'چطور پلن را فعال کنم؟',
    a: 'روی دکمه پلن موردنظر بزنید و فرم درخواست را پر کنید؛ همکاران کاربان پس از بررسی و هماهنگی، دسترسی شما را فعال و از طریق تماس یا پیامک خبر می‌دهند. تست رایگان ۱۰ روزه بدون نیاز به کارت بانکی است.',
  },
];

const trustBadges = [
  { icon: BadgeCheck, label: 'مطابق قوانین ۱۴۰۵' },
  { icon: Receipt, label: 'سامانه مودیان' },
  { icon: Shield, label: 'چک صیادی بانک مرکزی' },
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
        <div><b>دستیار صوتی</b><small>دستور مالی فارسی</small></div>
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
      <div className="superapp-contract-item"><FileSignature size={16} /><span>قرارداد کار ماده ۷ و ۱۰</span></div>
      <div className="superapp-contract-item"><FileSignature size={16} /><span>پیمانکاری</span></div>
      <div className="superapp-contract-item"><FileSignature size={16} /><span>محرمانگی (NDA)</span></div>
      <div className="superapp-contract-item"><FileSignature size={16} /><span>مبایعه‌نامه</span></div>
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

/* ═══ مودال درخواست دسترسی ═══ */

const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '.35rem', fontSize: '.88rem', margin: '.7rem 0', fontWeight: 600 };
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '.65rem .8rem', borderRadius: 12, fontSize: '.95rem', fontWeight: 400,
  background: 'rgba(255,255,255,.05)', border: '1px solid var(--line, rgba(255,255,255,.14))', color: 'inherit', boxSizing: 'border-box',
};

function RequestModal({ plan, plans, onClose }: { plan: string; plans: SuperAppPlan[]; onClose: () => void }) {
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [selectedPlan, setSelectedPlan] = useState(plan);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const selected = plans.find((p) => p.id === selectedPlan);
  const mobileOk = isIranianMobile(mobile);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (fullName.trim().length < 3) { setError('نام و نام خانوادگی را کامل وارد کنید.'); return; }
    if (!mobileOk) { setError('شماره موبایل معتبر نیست؛ نمونه درست: ۰۹۱۲۳۴۵۶۷۸۹'); return; }
    setSending(true);
    const res = await createAccessRequest({ fullName, mobile, businessName, plan: selectedPlan });
    setSending(false);
    if (!res.ok) { setError('ثبت درخواست انجام نشد؛ دوباره تلاش کنید.'); return; }
    setDone(true);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="درخواست دسترسی به کاربان سوپراپ"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center',
        background: 'rgba(4,8,18,.72)', padding: '1rem', backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 'min(430px, 100%)', maxHeight: '90vh', overflowY: 'auto',
        background: 'var(--card, #101828)', color: 'var(--text, #eef2f7)',
        border: '1px solid var(--line, rgba(255,255,255,.12))', borderRadius: 20, padding: '1.4rem',
        boxShadow: '0 24px 60px rgba(0,0,0,.45)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.4rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem' }}>درخواست دسترسی به کاربان سوپراپ</h3>
          <button
            type="button" aria-label="بستن" onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '.3rem', display: 'grid', placeItems: 'center' }}
          >
            <X size={20} />
          </button>
        </div>
        <p style={{ margin: '0 0 1rem', fontSize: '.85rem', color: 'var(--muted, #9aa7b8)' }}>
          فرم را پر کنید؛ همکاران ما پس از بررسی، دسترسی را فعال و از طریق تماس یا پیامک خبر می‌دهند.
        </p>

        {done ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <BadgeCheck size={44} style={{ color: '#4ade80' }} />
            <h4 style={{ margin: '.8rem 0 .4rem' }}>درخواست شما ثبت شد</h4>
            <p style={{ fontSize: '.9rem', color: 'var(--muted, #9aa7b8)' }}>
              پلن «{selected?.name ?? selectedPlan}» ثبت شد؛ پس از تایید مدیر با شما تماس می‌گیریم.
            </p>
            <button type="button" className="superapp-btn superapp-btn-primary" onClick={onClose}>
              بستن
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <label style={fieldStyle}>
              نام و نام خانوادگی *
              <input style={inputStyle} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="مثلاً: علی رضایی" />
            </label>
            <label style={fieldStyle}>
              شماره موبایل *
              <input style={inputStyle} value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="۰۹۱۲…" inputMode="tel" />
            </label>
            {mobile && mobileOk ? <span style={{ fontSize: '.78rem', color: '#4ade80' }}>✓ شماره معتبر است</span> : null}
            <label style={fieldStyle}>
              نام کسب‌وکار (اختیاری)
              <input style={inputStyle} value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="اختیاری" />
            </label>
            <label style={fieldStyle}>
              پلن موردنظر *
              <select style={inputStyle} value={selectedPlan} onChange={(e) => setSelectedPlan(e.target.value)}>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            {selected && (
              <p style={{ fontSize: '.8rem', color: 'var(--muted, #9aa7b8)', margin: '-.3rem 0 .8rem' }}>
                {selected.price > 0 ? `${fmtToman(selected.price)} تومان / ${selected.periodLabel}` : 'رایگان'}
              </p>
            )}
            {error ? <div style={{ color: '#f87171', fontSize: '.85rem', margin: '.5rem 0' }}>{error}</div> : null}
            <button type="submit" className="superapp-btn superapp-btn-primary" disabled={sending} style={{ width: '100%', justifyContent: 'center' }}>
              {sending ? 'در حال ثبت…' : 'ثبت درخواست دسترسی'} <ArrowLeft size={16} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/* ═══ کامپوننت اصلی ═══ */

export default function SuperAppLanding() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [cfg, setCfg] = useState<SuperAppConfig | null>(null);
  const [requestPlan, setRequestPlan] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchSuperAppConfig().then((c) => { if (alive) setCfg(c); });
    return () => { alive = false; };
  }, []);

  const plans = cfg?.plans ?? [];
  const promoActive = !!cfg?.promo.active && !!cfg?.promo.code;
  const appUrl = cfg?.appUrl || '/app';
  const trialLabel = `${faNum(cfg?.trialDays ?? 10)} روزه`;

  const openRequest = (planId: string) => {
    if (cfg && !cfg.requestsOpen) return;
    setRequestPlan(planId);
  };

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
              یک سوپراپ موبایل‌محور با ۵ بخش یکپارچه، ۲۷ قابلیت پیشرفته، ۱۳ ماشین‌حساب تخصصی ۱۴۰۵ و ۴ ابرقابلیت هوش مصنوعی. کار آفلاین، قفل بیومتریک و نصب فوری روی گوشی.
            </p>
            <div className="superapp-hero-cta">
              <a href={appUrl} className="superapp-btn superapp-btn-primary">
                ورود به اپ کاربان <ArrowLeft size={16} />
              </a>
              <button type="button" className="superapp-btn superapp-btn-ghost" onClick={() => openRequest('trial')}>
                شروع تست {trialLabel} رایگان
              </button>
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

      {/* ═══ ۳. بخش‌های سوپراپ (۲۷ قابلیت در ۵ بخش) ═══ */}
      <section className="superapp-sections">
        <div className="container">
          <div className="superapp-section-head">
            <span className="superapp-eyebrow">۵ بخش یکپارچه — ۲۷ قابلیت</span>
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
            <p>قدرت موتور هوش مصنوعی جمینای در اسکن اسناد، لوایح دفاعیه و مدیریت نقدینگی.</p>
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
                  <p>اثر انگشت یا تشخیص چهره بومی موبایل + پین‌کد اضطراری با انیمیشن نرم.</p>
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
                  <p>چاپ استاندارد A4 با مهر کاربان، امضای دیجیتال لمسی و دانلود مستقیم PDF.</p>
                </div>
              </li>
              <li>
                <Lock size={20} />
                <div>
                  <b>گاوصندوق رمزنگاری‌شده</b>
                  <p>قراردادها، لوایح و نامه‌های اداری با رمزنگاری ابری بایگانی می‌شوند.</p>
                </div>
              </li>
            </ul>
          </div>
          <div className="superapp-security-phone">
            <PhoneMockup />
          </div>
        </div>
      </section>

      {/* ═══ ۶. تعرفه‌ها (از پنل مدیریت) ═══ */}
      <section className="superapp-plans" id="plans">
        <div className="container">
          <div className="superapp-section-head">
            <span className="superapp-eyebrow">تعرفه‌ها</span>
            <h2>پلن متناسب با کسب‌وکار شما</h2>
            <p>تست رایگان {trialLabel} بدون کارت بانکی. با ثبت درخواست، پس از تایید مدیر فعال می‌شود.</p>
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
            {plans.map((p) => (
              <div key={p.id} className={`superapp-plan ${p.highlight ? 'superapp-plan-highlight' : ''}`}>
                {p.badge && <span className="superapp-plan-badge">{p.badge}</span>}
                <h3>{p.name}</h3>
                <div className="superapp-plan-price">
                  <b>{fmtToman(p.price)}</b>
                  <span>تومان / {p.periodLabel}</span>
                </div>
                <ul>
                  {p.features.map((f, j) => (
                    <li key={j}>
                      <Check size={12} /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={`superapp-btn ${p.highlight ? 'superapp-btn-primary' : 'superapp-btn-outline'}`}
                  onClick={() => openRequest(p.id)}
                >
                  {p.cta}
                </button>
              </div>
            ))}
            {plans.length === 0 && (
              <div className="superapp-plan"><h3>در حال بارگذاری تعرفه‌ها…</h3></div>
            )}
          </div>

          {promoActive && (
            <div className="superapp-promo">
              <Sparkles size={16} /> کد تخفیف <code>{cfg?.promo.code}</code> — {faNum(cfg?.promo.percent ?? 25)}٪ تخفیف روی همه پلن‌ها
            </div>
          )}
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
            {faqsStatic.map((f, i) => (
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
            <p>تست رایگان {trialLabel} — بدون کارت بانکی. نصب در کمتر از ۳۰ ثانیه.</p>
            <div className="superapp-cta-buttons">
              <a href={appUrl} className="superapp-btn superapp-btn-primary">
                ورود به اپ کاربان <ArrowLeft size={16} />
              </a>
              <button type="button" className="superapp-btn superapp-btn-secondary" onClick={() => openRequest('trial')}>
                <Smartphone size={16} /> شروع رایگان — ثبت درخواست
              </button>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />

      {requestPlan !== null && cfg && (
        <RequestModal plan={requestPlan} plans={cfg.plans} onClose={() => setRequestPlan(null)} />
      )}
    </div>
  );
}
