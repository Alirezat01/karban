import React, { Suspense, useEffect } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRoute } from '@/router';
import Layout from '@/components/Layout';
import { KNOWLEDGE_CATEGORIES } from '@/components/KnowledgePage';
import { applySEO, type JsonLd } from '@/lib/seo';
import calcSeo from '@/data/calc-seo.json';
import KarbanLoader from '@/components/KarbanLoader';
const ContentPage = React.lazy(() => import('@/components/ContentPage'));
const ServicesPage = React.lazy(() =>
  import('@/components/ContentPage').then((m) => ({ default: m.ServicesPage })),
);
const ArticlesListPage = React.lazy(() =>
  import('@/components/KnowledgePage').then((m) => ({ default: m.ArticlesListPage })),
);
const ArticleViewPage = React.lazy(() =>
  import('@/components/KnowledgePage').then((m) => ({ default: m.ArticleViewPage })),
);

const HomePage = React.lazy(() => import('@/components/HomePage'));
const CalculatorPage = React.lazy(() => import('@/components/CalculatorPage'));
const ArticlePage = React.lazy(() => import('@/components/ArticlePage'));
const RolePage = React.lazy(() => import('@/components/RolePage'));
const AdminPage = React.lazy(() => import('@/components/AdminPage'));
const BusinessHealthPage = React.lazy(() => import('@/components/BusinessHealthPage'));
const OrderPage = React.lazy(() => import('@/components/OrderPage'));
const TermsPage = React.lazy(() => import('@/components/ContractBuilderPage').then(() => import('@/components/TermsPage')));
const ContractBuilderPage = React.lazy(() => import('@/components/ContractBuilderPage'));
const PrivacyPage = React.lazy(() => import('@/components/PrivacyPage'));
const ChecklistsListPage = React.lazy(() =>
  import('@/components/ChecklistsPage').then((m) => ({ default: m.ChecklistsListPage })),
);
const ChecklistViewPage = React.lazy(() =>
  import('@/components/ChecklistsPage').then((m) => ({ default: m.ChecklistViewPage })),
);
const LawLibraryPage = React.lazy(() =>
  import('@/components/LawLibraryPage').then((m) => ({ default: m.LawLibraryPage })),
);
const LoginPage = React.lazy(() => import('@/components/LoginPage'));
const DashboardPage = React.lazy(() => import('@/components/DashboardPage'));
const RequestsListPage = React.lazy(() =>
  import('@/components/RequestsPage').then((m) => ({ default: m.RequestsListPage })),
);
const RequestViewPage = React.lazy(() =>
  import('@/components/RequestsPage').then((m) => ({ default: m.RequestViewPage })),
);

function Page({ title, description, breadcrumb, children, jsonLd, noindex }: { title: string; description: string; breadcrumb?: string[]; children: ReactNode; jsonLd?: JsonLd; noindex?: boolean }) {
  return (
    <Layout title={title} description={description} breadcrumb={breadcrumb} jsonLd={jsonLd} noindex={noindex}>
      <Suspense fallback={<KarbanLoader label="در حال آماده‌سازی…" />}>
        {children}
      </Suspense>
    </Layout>
  );
}

function NotFound() {
  return (
    <section className="inner-page">
      <div className="container narrow-content">
        <span className="eyebrow">خطا ۴۰۴</span>
        <h1>این صفحه پیدا نشد</h1>
        <p className="lead">صفحه‌ای که دنبال آن بودید وجود ندارد یا جابه‌جا شده است.</p>
        <a className="button" href="/">بازگشت به خانه <ArrowLeft size={17} /></a>
      </div>
    </section>
  );
}

/** پنل مدیریت: بدون تغییر ظاهر، فقط از ایندکس خارج می‌شود */
function AdminShell() {
  useEffect(() => {
    applySEO({
      title: 'پنل مدیریت | کاربان',
      description: 'ورود مدیران کاربان.',
      path: window.location.pathname,
      noindex: true,
    });
  }, []);
  return <AdminPage />;
}
const calcMap: Record<string, { type: 'salary' | 'hire' | 'severance' | 'retirement' | 'overtime' | 'business-tax' | 'vat' | 'salary-tax' | 'eydi' | 'insurance' | 'leave' | 'termination'; title: string; desc: string }> = {
  'محاسبه-حقوق': { type: 'salary', title: 'محاسبه حقوق و دستمزد ۱۴۰۵', desc: 'حقوق خالص، کسورات بیمه و مالیات را برآورد کنید.' },
  'هزینه-استخدام': { type: 'hire', title: 'ماشین‌حساب هزینه استخدام', desc: 'بهای تمام‌شدن واقعی یک کارمند، قلم‌به‌قلم.' },
  'سنوات': { type: 'severance', title: 'ماشین‌حساب سنوات پایان خدمت', desc: 'مبلغ سنوات پایان کار را محاسبه کنید.' },
  'بازنشستگی': { type: 'retirement', title: 'ماشین‌حساب بازنشستگی تأمین اجتماعی', desc: 'وضعیت بازنشستگی و برآورد مستمری را ببینید.' },
  'اضافه-کاری': { type: 'overtime', title: 'ماشین‌حساب اضافه‌کاری', desc: 'مبلغ اضافه‌کاری را بر اساس نرخ قانونی محاسبه کنید.' },
  'مالیات-مشاغل': { type: 'business-tax', title: 'ماشین‌حساب مالیات مشاغل و مغازه', desc: 'محاسبه پلکانی ماده ۱۳۱ با معافیت سالانه.' },
  'ارزش-افزوده': { type: 'vat', title: 'ماشین‌حساب ارزش افزوده', desc: 'محاسبه ۱۰٪ — از پایه یا از داخل فاکتور.' },
  'مالیات-حقوق': { type: 'salary-tax', title: 'ماشین‌حساب مالیات حقوق ۱۴۰۵', desc: 'محاسبه پلکانی مالیات حقوق ۱۴۰۵ بر اساس معافیت سالانه و نرخ‌های ماده ۸۴؛ برآورد دقیق مالیات ماهانه و سالانه هر کارمند.' },
  'عیدی-و-پاداش': { type: 'eydi', title: 'ماشین‌حساب عیدی و پاداش ۱۴۰۵', desc: 'مبلغ عیدی به نسبت ماه‌های کارکرد و پس‌انداز ماهانه آن — مطابق ماده ۱۱۷ قانون کار.' },
  'بیمه-تامین-اجتماعی': { type: 'insurance', title: 'ماشین‌حساب بیمه تأمین اجتماعی', desc: 'تفکیک دقیق سهم ۷٪ کارگر و ۲۳٪ کارفرما (بیمه + بیکاری) از حقوق مشمول.' },
  'مرخصی': { type: 'leave', title: 'ماشین‌حساب مرخصی و ارزش آن', desc: 'مانده مرخصی استحقاقی و ارزش ریالی آن — مطابق مواد ۶۴ و ۶۶ قانون کار.' },
  'مزایای-پایان-همکاری': { type: 'termination', title: 'ماشین‌حساب تسویه حساب و مزایای پایان همکاری', desc: 'سنوات + عیدی پرو‌راتا + مانده مرخصی = خسارت اخراج (ماده ۲۷) یکجا محاسبه می‌شود.' },
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    { '@type': 'Question', name: 'آیا نتایج ماشین‌حساب‌ها مبنای قانونی دارد؟', acceptedAnswer: { '@type': 'Answer', text: 'محاسبات بر اساس قانون کار، قانون تأمین اجتماعی و قانون مالیات‌های مستقیم و مصوبات ۱۴۰۵ است؛ ملاک نهایی، فیش رسمی سازمان‌هاست.' } },
    { '@type': 'Question', name: 'پارامترهای حقوق ۱۴۰۵ از کجا می‌آید؟', acceptedAnswer: { '@type': 'Answer', text: 'مطابق بخشنامه سالانه شورای عالی کار؛ و از پنل مدیریت کاربان قابل به‌روزرسانی است.' } },
    { '@type': 'Question', name: 'سنوات پایان خدمت چگونه محاسبه می‌شود؟', acceptedAnswer: { '@type': 'Answer', text: 'به ازای هر سال سابقه معادل یک ماه آخرین حقوق، مطابق ماده ۲۴ قانون کار.' } },
    { '@type': 'Question', name: 'نرخ ارزش افزوده سال ۱۴۰۵ چقدر است؟', acceptedAnswer: { '@type': 'Answer', text: '۱۰٪؛ هر دو حالت افزودن به پایه و استخراج از داخل فاکتور محاسبه می‌شود.' } },
    { '@type': 'Question', name: 'مالیات مشاغل چند درصد است؟', acceptedAnswer: { '@type': 'Answer', text: 'پلکانی ۱۵ تا ۳۵ درصد مطابق ماده ۱۳۱، پس از کسر معافیت سالانه.' } },
  ],
};
type CalcSeoEntry = { about: string[]; how: string[]; example: string[]; laws: string[]; faqs: [string, string][]; links: { href: string; label: string }[] };
const calcSeoMap = calcSeo as unknown as Record<string, CalcSeoEntry>;

/** ItemList JSON-LD for list/hub pages */
function listJsonLd(path: string, items: { name: string; href: string }[]): JsonLd {
  const u = (p: string) => `https://karbanapp.ir${encodeURI(p)}`;
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'کاربان',
      itemListElement: items.map((it, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: it.name,
        url: u(it.href),
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'خانه', item: 'https://karbanapp.ir/' },
        { '@type': 'ListItem', position: 2, name: items.length ? path.replace('/', '') : 'فهرست', item: u(path) },
      ],
    },
  ];
}

/** JSON-LD for calculator pages — mirrors the bundle written by prerender-meta.mjs */
function calcJsonLd(slug: string, title: string, description: string): JsonLd {
  const path = `/ابزارهای-هوش-مصنوعی/${slug}`;
  const u = (p: string) => `https://karbanapp.ir${encodeURI(p)}`;
  const webApp = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: title,
    description,
    url: u(path),
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    inLanguage: 'fa-IR',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'IRR' },
    publisher: { '@id': 'https://karbanapp.ir/#organization' },
  };
  const crumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'خانه', item: 'https://karbanapp.ir/' },
      { '@type': 'ListItem', position: 2, name: 'ابزارهای هوش مصنوعی', item: u('/ابزارهای-هوش-مصنوعی') },
      { '@type': 'ListItem', position: 3, name: title, item: u(path) },
    ],
  };
  const faqs = calcSeoMap[slug]?.faqs || [];
  const faq = faqs.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
      }
    : null;
  return faq ? [webApp, crumb, faq] : [webApp, crumb];
}

export default function App() {
  const route = useRoute();
  const segments = route.split('/').filter(Boolean);
  
  useEffect(() => {
    const w = window as unknown as { gtag?: (...args: unknown[]) => void };
    if (w.gtag) w.gtag('event', 'page_view', { page_path: route });
  }, [route]);

  if (route === '/' || segments.length === 0) {
    return (
      <Page title="کاربان | بانک قرارداد تخصصی و ماشین‌حساب حقوق ۱۴۰۵" description="بیش از ۹۰ قرارداد تخصصی کارفرمایی و فریلنسر، ۱۰ ماشین‌حساب دقیق حقوق، سنوات و مالیات ۱۴۰۵، و دانشنامه حقوق کار با استناد قانون کار.">
        <HomePage />
      </Page>
    );
  }
  if (segments[0] === 'درخواست‌های-اداری') {
    if (segments.length === 1) {
      return (
        <Page title="درخواست‌های اداری آماده — استعفا، وام، مرخصی و…" description="متن رسمی و آماده برای درخواست‌های پرتکرار؛ کپی کن، جاهای خالی را پر کن و امضا کن." breadcrumb={['درخواست‌های اداری']}>
          <RequestsListPage />
        </Page>
      );
    }
    if (segments[1]) {
      return (
        <Page title="درخواست اداری" description="متن کامل درخواست اداری." breadcrumb={['درخواست‌های اداری']}>
          <RequestViewPage requestId={segments[1]} />
        </Page>
      );
    }
  }

    if (segments[0] === 'چک-لیست‌ها') {
    if (segments.length === 1) {
      return (
        <Page title="چک‌لیست‌های طلایی مدیریت کسب‌وکار | کاربان" description="چک‌لیست استخدام، اخراج، تنظیم قرارداد، پایان همکاری و مالیاتی کسب‌وکار — با ذخیره پیشرفت و خروجی PDF." breadcrumb={['چک‌لیست‌های طلایی']} jsonLd={listJsonLd('/چک-لیست‌ها', [
          { name: 'چک‌لیست استخدام نیروی جدید', href: '/چک-لیست‌ها/چک-لیست-استخدام' },
          { name: 'چک‌لیست اخراج و فسخ', href: '/چک-لیست‌ها/چک-لیست-اخراج-و-فسخ' },
          { name: 'چک‌لیست تنظیم قرارداد', href: '/چک-لیست‌ها/چک-لیست-تنظیم-قرارداد' },
          { name: 'چک‌لیست پایان همکاری', href: '/چک-لیست‌ها/چک-لیست-پایان-همکاری' },
          { name: 'چک‌لیست مالیاتی کسب‌وکار', href: '/چک-لیست‌ها/چک-لیست-مالیاتی-کسب-و-کار' },
        ])}>
          <ChecklistsListPage />
        </Page>
      );
    }
    return (
      <Page title={`چک‌لیست ${segments[1]} | کاربان`} description="چک‌لیست گام‌به‌گام کاربان با ذخیره پیشرفت." breadcrumb={['چک‌لیست‌های طلایی']}>
        <ChecklistViewPage slug={segments[1]} />
      </Page>
    );
  }

  if (segments[0] === 'کتابخانه-قوانین') {
    if (segments.length === 1) {
      return (
        <Page title="کتابخانه قوانین — قانون کار، تأمین اجتماعی و مالیات به زبان ساده | کاربان" description="جست‌وجوی سریع بین مواد قانون کار، تأمین اجتماعی، مالیات‌های مستقیم و آیین‌نامه‌ها؛ خلاصه کاربردی هر ماده با برچسب موضوعی." breadcrumb={['کتابخانه قوانین']} jsonLd={listJsonLd('/کتابخانه-قوانین', [
          { name: 'قانون کار', href: '/کتابخانه-قوانین/قانون-کار' },
          { name: 'تأمین اجتماعی', href: '/کتابخانه-قوانین/تأمین-اجتماعی' },
          { name: 'مالیات‌های مستقیم', href: '/کتابخانه-قوانین/مالیات‌های-مستقیم' },
          { name: 'آیین‌نامه‌ها', href: '/کتابخانه-قوانین/آیین‌نامه‌ها' },
        ])}>
          <LawLibraryPage />
        </Page>
      );
    }
    return (
      <Page title={`${segments[1]} — کتابخانه قوانین کاربان`} description="گزیده مواد پرکاربرد این قانون با زبان ساده و جست‌وجوی سریع." breadcrumb={['کتابخانه قوانین']}>
        <LawLibraryPage category={segments[1]} />
      </Page>
    );
  }

  if (segments[0] === 'ورود') {
    return (
      <Page title="ورود به حساب کاربری کاربان" description="با حساب گوگل وارد کاربان شو؛ قراردادها، درخواست‌ها و اعلان‌هایت در داشبورد می‌ماند." breadcrumb={['ورود']} noindex>
        <LoginPage />
      </Page>
    );
  }

  if (segments[0] === 'داشبورد') {
    return (
      <Page title="داشبورد کاربر | کاربان" description="قراردادهای ذخیره‌شده، درخواست‌های مشاوره، تیکت پشتیبانی و اعلان‌های تو." breadcrumb={['داشبورد']} noindex>
        <DashboardPage />
      </Page>
    );
  }

  if (segments[0] === 'حریم-خصوصی') {
    return (
           <Page title="حریم خصوصی کاربان" description="سیاست حریم خصوصی کاربان؛ چه داده‌هایی جمع می‌شود و چگونه محافظت می‌شود." breadcrumb={['حریم خصوصی']}>
        <PrivacyPage />
      </Page>
    );
  }

  if (segments[0] === 'قوانین') {
    return (
      <Page title="قوانین و شرایط استفاده از کاربان" description="شرایط شفاف استفاده از خدمات و ابزارهای کاربان؛ پیش از ثبت سفارش بخوانید." breadcrumb={['قوانین']}>
        <TermsPage />
      </Page>
    );
  }

  if (segments[0] === 'سفارش' && segments[1]) {
    return (
      <Page title="ثبت سفارش خدمت | کاربان" description="تأیید خدمت، تکمیل مشخصات و ثبت سفارش؛ شفاف و مطمئن." breadcrumb={['خدمات', 'ثبت سفارش']}>
        <OrderPage serviceId={segments[1]} />
      </Page>
    );
  }

  if (segments[0] === 'کارفرما' || segments[0] === 'کارمند' || segments[0] === 'فریلنسر') {
    const role = segments[0] as 'کارفرما' | 'کارمند' | 'فریلنسر';
    return (
      <Page title={role} description={`مسیر ${role} در کاربان: قرارداد، حقوق، قانون کار و رشد.`} breadcrumb={[role]}>
        <RolePage role={role} />
      </Page>
    );
  }

  if (segments[0] === 'دانشنامه') {
    if (segments.length === 1) {
      return (
        <Page title="دانشنامه حقوقی و مالیاتی کسب‌وکار | کاربان" description="مقالات کاربردی حقوق کار، بیمه و مالیات به زبان ساده و با استناد به مواد قانونی." breadcrumb={['دانشنامه']}>
          <ContentPage kind="knowledge" title="راهنمای قانون کار و تأمین اجتماعی، به زبان ساده اما مستند" description="راهنمای مستند قانون کار، تأمین اجتماعی و مالیات به زبان ساده با ذکر ماده قانون؛ همیشه به‌روز." eyebrow="دانشنامه" />
        </Page>
      );
    }

    if (segments[1] === 'مقاله' && segments[2]) {
      return (
        <Page title="مقاله دانشنامه کاربان" description="مقاله تخصصی با استناد قانونی." breadcrumb={['دانشنامه']}>
          <ArticleViewPage articleId={segments[2]} />
        </Page>
      );
    }

    const categoryIndex = Number(segments[1]) || 1;
    const categoryName = KNOWLEDGE_CATEGORIES[categoryIndex - 1] || 'دانشنامه';
    return (
      <Page title={`مقالات ${categoryName} | دانشنامه کاربان`} description={`مقاله‌های تخصصی ${categoryName} برای کسب‌وکارها، با استناد به مواد قانونی.`} breadcrumb={['دانشنامه', categoryName]}>
        <ArticlesListPage categoryIndex={categoryIndex} />
      </Page>
    );
  }

  if (segments[0] === 'قراردادها') {
    if (segments.length === 1) {
      return (
        <Page title="بیش از ۸۰ قرارداد تخصصی به تفکیک صنف؛ متن کامل و PDF" description="بیش از ۸۰ قرارداد تخصصی به تفکیک صنف؛ متن کامل و PDF." breadcrumb={['قراردادها']}>
          <ContentPage kind="contracts" title="بانک قراردادهای کاربان — دانلود نمونه قرارداد آماده" description="بیش از ۸۰ نمونه قرارداد استاندارد در ۵ نوع و اصناف مختلف؛ دانلود رایگان با موبایل، نسخه تخصصی صنف یا نگارش اختصاصی." eyebrow="قراردادها" />
        </Page>
      );
    }

    return (
      <Page title={`قرارداد ${segments.slice(1).join(' ')}`} description="متن کامل قرارداد و فایل PDF." breadcrumb={['قراردادها']}>
        <ArticlePage title={`جزئیات قرارداد ${segments.slice(1).join(' ')}`} category="قراردادهای کاربان" contractId={segments[1]} />
      </Page>
    );
  }

  if (segments[0] === 'خدمات') {
    return (
      <Page title="مشاوره و قرارداد اختصاصی برای هر صنف؛ از پزشکان تا فروشگاه آنلاین" description="مشاوره و قرارداد اختصاصی برای هر صنف؛ از پزشکان تا فروشگاه آنلاین." breadcrumb={['خدمات']}>
        <ServicesPage />
      </Page>
    );
  }

  if (segments[0] === 'ابزارهای-هوش-مصنوعی') {
    if (segments[1] === 'تست-سلامت') {
      return (
        <Page title="تست سلامت کسب‌وکار" description="نقاط قوت و ریسک‌های کسب‌وکار را بشناسید." breadcrumb={['ابزارهای هوش مصنوعی', 'تست سلامت']}>
          <BusinessHealthPage />
        </Page>
      );
    }

    if (segments[1] === 'ساخت-قرارداد') {
      return (
        <Page title="ساخت قرارداد هوشمند" description="قرارداد متناسب با نیاز شما، در چند مرحله." breadcrumb={['ابزارهای هوش مصنوعی', 'ساخت قرارداد']}>
          <ContractBuilderPage />
        </Page>
      );
    }

    const calcSlug = segments[1] as string;
    const calc = calcSlug ? calcMap[calcSlug] : undefined;
    if (calc) {
      return (
        <Page title={calc.title} description={calc.desc} breadcrumb={['ابزارهای هوش مصنوعی', calc.title]} jsonLd={calcJsonLd(calcSlug, calc.title, calc.desc)}>
          <CalculatorPage type={calc.type} title={calc.title} description={calc.desc} />
        </Page>
      );
    }

    return (
           <Page title="ماشین‌حساب‌های دقیق حقوق، سنوات، اضافه‌کاری و مالیات مطابق مقررات ۱۴۰۵" description="ماشین‌حساب‌های دقیق حقوق، سنوات، اضافه‌کاری و مالیات مطابق مقررات ۱۴۰۵." breadcrumb={['ابزارهای هوش مصنوعی']} jsonLd={faqJsonLd}>
        <ContentPage kind="tools" title="ابزارهای هوش مصنوعی کاربان" description="ماشین‌حساب آنلاین حقوق و دستمزد، سنوات، بازنشستگی، هزینه استخدام، اضافه‌کاری و مالیات مطابق مقررات ۱۴۰۵." eyebrow="ابزارهای هوش مصنوعی" />
      </Page>
    );
  }

  if (segments[0] === 'درباره-ما') {
    return (
      <Page title="درباره کاربان" description="کاربان؛ از قرارداد تا آرامش." breadcrumb={['درباره ما']}>
        <section className="inner-page">
          <div className="container narrow-content">
            <span className="eyebrow">درباره ما</span>
            <h1>درباره کاربان</h1>
            <p className="article-intro">کاربان پلتفرم هوشمند قرارداد و همراه حقوق کار است: بانک قرارداد تخصصی به تفکیک صنف، ماشین‌حساب‌های دقیق مطابق مقررات ۱۴۰۵، و دانشنامه کاربردی برای کارفرمایان، کارمندان و فریلنسرها. کاربان؛ از قرارداد تا آرامش.</p>
          </div>
        </section>
      </Page>
    );
  }

  if (segments[0] === 'تماس-با-ما') {
    return (
      <Page title="تماس با کاربان" description="تهران، خیابان کریمخان، خیابان سنایی، پلاک ۶۱، طبقه سوم | hello@karbanapp.ir" breadcrumb={['تماس با ما']}>
        <section className="inner-page">
          <div className="container narrow-content">
            <span className="eyebrow">تماس با ما</span>
            <h1>تماس با کاربان</h1>
            <div className="contact-card">
              <p>تهران، خیابان کریمخان، خیابان سنایی، پلاک ۶۱، طبقه سوم</p>
              <p>تلفن گویا: ۰۲۱-۸۸۳۴۲۶۷۹</p>
              <p>شنبه تا چهارشنبه ۹ تا ۱۷</p>
              <p>hello@karbanapp.ir</p>
            </div>
          </div>
        </section>
      </Page>
    );
  }

  if (segments[0] === 'admin') {
    return (
      <div dir="rtl" className="app-root">
        <AdminShell />
      </div>
    );
  }

  return (
    <Page title="صفحه پیدا نشد | کاربان" description="صفحه‌ای که دنبال آن بودید وجود ندارد." breadcrumb={['خطا ۴۰۴']} noindex>
      <NotFound />
    </Page>
  );
}
