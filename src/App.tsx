import React, { Suspense, useEffect } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRoute } from '@/router';
import Layout from '@/components/Layout';
import { applySEO, type JsonLd } from '@/lib/seo';
import calcSeo from '@/data/calc-seo.json';
import routeMeta from '@/data/route-meta.json';
import { checklistCatalog } from '@/data/config';
import { lawCategoryBySlug } from '@/data/laws';
import { categoryFromSegment, categorySlug, KNOWLEDGE_CATEGORIES } from '@/lib/slug';
import KarbanLoader from '@/components/KarbanLoader';

/* منبع واحد متای صفحات ثابت — مشترک با scripts/prerender-meta.mjs و api/sitemap.xml.ts */
const META_HOME = routeMeta.home as { title: string; description: string; priority?: string };
const META_ROUTES = routeMeta.routes as Record<string, { title: string; description: string; image?: string; priority?: string }>;
const META_TOOLS = routeMeta.tools as Record<string, { title: string; description: string; priority?: string }>;
/* عنوان نمایشی بدون پسوند | کاربان (برای h1 و breadcrumb) */
const display = (t: string) => t.replace(/ \| کاربان$/, '');
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
const ProfilePage = React.lazy(() => import('@/components/ProfilePage'));
const RequestsListPage = React.lazy(() =>
  import('@/components/RequestsPage').then((m) => ({ default: m.RequestsListPage })),
);
const RequestViewPage = React.lazy(() =>
  import('@/components/RequestsPage').then((m) => ({ default: m.RequestViewPage })),
);
const AccLanding = React.lazy(() => import('@/components/acc/AccLanding'));
const AccPanel = React.lazy(() => import('@/components/acc/AccPanel'));

function Page({ title, description, breadcrumb, children, jsonLd, noindex, image }: { title: string; description: string; breadcrumb?: (string | { name: string; href: string })[]; children: ReactNode; jsonLd?: JsonLd; noindex?: boolean; image?: string }) {
  return (
    <Layout title={title} description={description} breadcrumb={breadcrumb} jsonLd={jsonLd} noindex={noindex} image={image}>
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

/** پنل حسابداری: بدون هدر/فوتر سایت و از ایندکس خارج */
function AccPanelShell({ sub }: { sub: string[] }) {
  useEffect(() => {
    applySEO({
      title: 'پنل حسابداری | کاربان',
      description: 'حسابداری هوشمند کاربان.',
      path: window.location.pathname,
      noindex: true,
    });
  }, []);
  return <AccPanel sub={sub} />;
}

/* هشدار: AccPanel و AdminPage هر دو React.lazy هستند؛ بدون مرز Suspense،
   ناوبری SPA (کلیک داخلی) حین suspend خطای React #426 می‌دهد و صفحه کاملاً سیاه می‌شود. */
const calcMap: Record<string, { type: 'salary' | 'hire' | 'severance' | 'retirement' | 'overtime' | 'business-tax' | 'vat' | 'salary-tax' | 'eydi' | 'insurance' | 'leave' | 'termination'; title: string; desc: string }> = {
  'محاسبه-حقوق': { type: 'salary', title: META_TOOLS['محاسبه-حقوق'].title, desc: META_TOOLS['محاسبه-حقوق'].description },
  'هزینه-استخدام': { type: 'hire', title: META_TOOLS['هزینه-استخدام'].title, desc: META_TOOLS['هزینه-استخدام'].description },
  'سنوات': { type: 'severance', title: META_TOOLS['سنوات'].title, desc: META_TOOLS['سنوات'].description },
  'بازنشستگی': { type: 'retirement', title: META_TOOLS['بازنشستگی'].title, desc: META_TOOLS['بازنشستگی'].description },
  'اضافه-کاری': { type: 'overtime', title: META_TOOLS['اضافه-کاری'].title, desc: META_TOOLS['اضافه-کاری'].description },
  'مالیات-مشاغل': { type: 'business-tax', title: META_TOOLS['مالیات-مشاغل'].title, desc: META_TOOLS['مالیات-مشاغل'].description },
  'ارزش-افزوده': { type: 'vat', title: META_TOOLS['ارزش-افزوده'].title, desc: META_TOOLS['ارزش-افزوده'].description },
  'مالیات-حقوق': { type: 'salary-tax', title: META_TOOLS['مالیات-حقوق'].title, desc: META_TOOLS['مالیات-حقوق'].description },
  'عیدی-و-پاداش': { type: 'eydi', title: META_TOOLS['عیدی-و-پاداش'].title, desc: META_TOOLS['عیدی-و-پاداش'].description },
  'بیمه-تامین-اجتماعی': { type: 'insurance', title: META_TOOLS['بیمه-تامین-اجتماعی'].title, desc: META_TOOLS['بیمه-تامین-اجتماعی'].description },
  'مرخصی': { type: 'leave', title: META_TOOLS['مرخصی'].title, desc: META_TOOLS['مرخصی'].description },
  'مزایای-پایان-همکاری': { type: 'termination', title: META_TOOLS['مزایای-پایان-همکاری'].title, desc: META_TOOLS['مزایای-پایان-همکاری'].description },
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
      <Page title={META_HOME.title} description={META_HOME.description}>
        <HomePage />
      </Page>
    );
  }
  if (segments[0] === 'درخواست‌های-اداری') {
    if (segments.length === 1) {
      return (
        <Page title={META_ROUTES['/درخواست‌های-اداری'].title} description={META_ROUTES['/درخواست‌های-اداری'].description} image={META_ROUTES['/درخواست‌های-اداری'].image} breadcrumb={[{ name: 'درخواست‌های اداری', href: '/درخواست‌های-اداری' }]}>
          <RequestsListPage />
        </Page>
      );
    }
    if (segments[1]) {
      return (
        <Page title="درخواست اداری" description="متن کامل درخواست اداری." breadcrumb={[{ name: 'درخواست‌های اداری', href: '/درخواست‌های-اداری' }]}>
          <RequestViewPage requestId={segments[1]} />
        </Page>
      );
    }
  }

    if (segments[0] === 'چک-لیست‌ها') {
    const checklist = segments[1] ? checklistCatalog.find((c) => c.slug === segments[1]) : undefined;
    if (segments.length === 1) {
      return (
        <Page title={META_ROUTES['/چک-لیست‌ها'].title} description={META_ROUTES['/چک-لیست‌ها'].description} image={META_ROUTES['/چک-لیست‌ها'].image} breadcrumb={[{ name: 'چک‌لیست‌های طلایی', href: '/چک-لیست‌ها' }]} jsonLd={listJsonLd('/چک-لیست‌ها', checklistCatalog.map((c) => ({ name: c.title, href: `/چک-لیست‌ها/${c.slug}` })))}>
          <ChecklistsListPage />
        </Page>
      );
    }
    return (
      <Page
        title={checklist ? `${checklist.title} | کاربان` : 'چک‌لیست | کاربان'}
        description={checklist ? `${checklist.description} — ${checklist.items.length} گام عملی با ذخیره پیشرفت و خروجی PDF.` : 'چک‌لیست گام‌به‌گام کاربان با ذخیره پیشرفت.'}
        image={META_ROUTES['/چک-لیست‌ها'].image}
        breadcrumb={[{ name: 'چک‌لیست‌های طلایی', href: '/چک-لیست‌ها' }, ...(checklist ? [{ name: checklist.title, href: `/چک-لیست‌ها/${checklist.slug}` }] : [])]}
      >
        <ChecklistViewPage slug={segments[1]} />
      </Page>
    );
  }

  if (segments[0] === 'کتابخانه-قوانین') {
    if (segments.length === 1) {
      return (
        <Page title={META_ROUTES['/کتابخانه-قوانین'].title} description={META_ROUTES['/کتابخانه-قوانین'].description} image={META_ROUTES['/کتابخانه-قوانین'].image} breadcrumb={[{ name: 'کتابخانه قوانین', href: '/کتابخانه-قوانین' }]} jsonLd={listJsonLd('/کتابخانه-قوانین', [
          { name: 'قانون کار', href: '/کتابخانه-قوانین/قانون-کار' },
          { name: 'تأمین اجتماعی', href: '/کتابخانه-قوانین/تأمین-اجتماعی' },
          { name: 'مالیات‌های مستقیم', href: '/کتابخانه-قوانین/مالیات‌های-مستقیم' },
          { name: 'آیین‌نامه‌ها', href: '/کتابخانه-قوانین/آیین‌نامه‌ها' },
        ])}>
          <LawLibraryPage />
        </Page>
      );
    }
    const lawCat = segments[1] ? lawCategoryBySlug(segments[1]) : undefined;
    return (
      <Page title={`${lawCat || segments[1]} — گزیده مواد پرکاربرد به زبان ساده | کاربان`} description={`گزیده مواد پرکاربرد ${lawCat || segments[1]} با زبان ساده و برچسب موضوعی؛ بخشی از کتابخانه قوانین کاربان.`} image={META_ROUTES['/کتابخانه-قوانین'].image} breadcrumb={[{ name: 'کتابخانه قوانین', href: '/کتابخانه-قوانین' }, { name: lawCat || segments[1] || '', href: `/کتابخانه-قوانین/${segments[1]}` }]}>
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

  if (segments[0] === 'پروفایل') {
    return (
      <Page title="پروفایل کاربری | کاربان" description="ویرایش نام، شماره تماس و نقش کاری حساب کاربری کاربان." breadcrumb={['پروفایل']} noindex>
        <ProfilePage />
      </Page>
    );
  }

  if (segments[0] === 'حریم-خصوصی') {
    return (
           <Page title={META_ROUTES['/حریم-خصوصی'].title} description={META_ROUTES['/حریم-خصوصی'].description} breadcrumb={[{ name: 'حریم خصوصی', href: '/حریم-خصوصی' }]}>
        <PrivacyPage />
      </Page>
    );
  }

  if (segments[0] === 'قوانین') {
    return (
      <Page title={META_ROUTES['/قوانین'].title} description={META_ROUTES['/قوانین'].description} breadcrumb={[{ name: 'قوانین', href: '/قوانین' }]}>
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
        <Page title={META_ROUTES['/دانشنامه'].title} description={META_ROUTES['/دانشنامه'].description} image={META_ROUTES['/دانشنامه'].image} breadcrumb={[{ name: 'دانشنامه', href: '/دانشنامه' }]}>
          <ContentPage kind="knowledge" title="راهنمای قانون کار و تأمین اجتماعی، به زبان ساده اما مستند" description="راهنمای مستند قانون کار، تأمین اجتماعی و مالیات به زبان ساده با ذکر ماده قانون؛ همیشه به‌روز." eyebrow="دانشنامه" />
        </Page>
      );
    }

    if (segments[1] === 'مقاله' && segments[2]) {
      return (
        <Page title="مقاله دانشنامه کاربان" description="مقاله تخصصی با استناد قانونی." breadcrumb={[{ name: 'دانشنامه', href: '/دانشنامه' }]}>
          <ArticleViewPage articleId={segments[2]} />
        </Page>
      );
    }

    /* دسته با URL اسلاگ (/دانشنامه/حقوقی-و-قانون-کار) یا عددی قدیمی (/دانشنامه/1) */
    const bySlug = categoryFromSegment(segments[1] || '');
    const categoryIndex = bySlug ? KNOWLEDGE_CATEGORIES.indexOf(bySlug) + 1 : Number(segments[1]) || 1;
    const categoryName = KNOWLEDGE_CATEGORIES[categoryIndex - 1] || 'دانشنامه';
    return (
      <Page
        title={`مقالات ${categoryName} | دانشنامه کاربان`}
        description={`مقاله‌های تخصصی ${categoryName} برای کسب‌وکارها، با استناد به مواد قانونی.`}
        image={META_ROUTES['/دانشنامه'].image}
        breadcrumb={[{ name: 'دانشنامه', href: '/دانشنامه' }, { name: categoryName, href: `/دانشنامه/${categorySlug(categoryName)}` }]}
      >
        <ArticlesListPage categoryIndex={categoryIndex} />
      </Page>
    );
  }

  if (segments[0] === 'قراردادها') {
    if (segments.length === 1) {
      return (
        <Page title={META_ROUTES['/قراردادها'].title} description={META_ROUTES['/قراردادها'].description} image={META_ROUTES['/قراردادها'].image} breadcrumb={[{ name: 'قراردادها', href: '/قراردادها' }]}>
          <ContentPage kind="contracts" title="بانک قراردادهای کاربان — دانلود نمونه قرارداد آماده" description="بیش از ۹۰ نمونه قرارداد استاندارد در ۵ نوع و اصناف مختلف؛ دانلود رایگان با موبایل، نسخه تخصصی صنف یا نگارش اختصاصی." eyebrow="قراردادها" />
        </Page>
      );
    }

    return (
      <Page title={`قرارداد ${segments.slice(1).join(' ')}`} description="متن کامل قرارداد و فایل PDF." breadcrumb={[{ name: 'قراردادها', href: '/قراردادها' }]}>
        <ArticlePage title={`جزئیات قرارداد ${segments.slice(1).join(' ')}`} category="قراردادهای کاربان" contractId={segments[1]} />
      </Page>
    );
  }

  if (segments[0] === 'خدمات') {
    return (
      <Page title={META_ROUTES['/خدمات'].title} description={META_ROUTES['/خدمات'].description} image={META_ROUTES['/خدمات'].image} breadcrumb={[{ name: 'خدمات', href: '/خدمات' }]}>
        <ServicesPage />
      </Page>
    );
  }

  if (segments[0] === 'ابزارهای-هوش-مصنوعی') {
    if (segments[1] === 'تست-سلامت') {
      return (
        <Page title={META_TOOLS['تست-سلامت'].title} description={META_TOOLS['تست-سلامت'].description} image={META_ROUTES['/ابزارهای-هوش-مصنوعی'].image} breadcrumb={['ابزارهای هوش مصنوعی', display(META_TOOLS['تست-سلامت'].title)]}>
          <BusinessHealthPage />
        </Page>
      );
    }

    if (segments[1] === 'ساخت-قرارداد') {
      return (
        <Page title={META_TOOLS['ساخت-قرارداد'].title} description={META_TOOLS['ساخت-قرارداد'].description} image={META_ROUTES['/ابزارهای-هوش-مصنوعی'].image} breadcrumb={['ابزارهای هوش مصنوعی', display(META_TOOLS['ساخت-قرارداد'].title)]}>
          <ContractBuilderPage />
        </Page>
      );
    }

    const calcSlug = segments[1] as string;
    const calc = calcSlug ? calcMap[calcSlug] : undefined;
    if (calc) {
      return (
        <Page title={calc.title} description={calc.desc} breadcrumb={['ابزارهای هوش مصنوعی', display(calc.title)]} jsonLd={calcJsonLd(calcSlug, calc.title, calc.desc)}>
          <CalculatorPage type={calc.type} title={display(calc.title)} description={calc.desc} />
        </Page>
      );
    }

    return (
           <Page title={META_ROUTES['/ابزارهای-هوش-مصنوعی'].title} description={META_ROUTES['/ابزارهای-هوش-مصنوعی'].description} image={META_ROUTES['/ابزارهای-هوش-مصنوعی'].image} breadcrumb={[{ name: 'ابزارهای هوش مصنوعی', href: '/ابزارهای-هوش-مصنوعی' }]} jsonLd={faqJsonLd}>
        <ContentPage kind="tools" title="ابزارهای هوش مصنوعی کاربان" description="ماشین‌حساب آنلاین حقوق و دستمزد، سنوات، بازنشستگی، هزینه استخدام، اضافه‌کاری و مالیات مطابق مقررات ۱۴۰۵." eyebrow="ابزارهای هوش مصنوعی" />
      </Page>
    );
  }

  if (segments[0] === 'درباره-ما') {
    return (
      <Page title={META_ROUTES['/درباره-ما'].title} description={META_ROUTES['/درباره-ما'].description} breadcrumb={[{ name: 'درباره ما', href: '/درباره-ما' }]}>
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
      <Page title={META_ROUTES['/تماس-با-ما'].title} description={META_ROUTES['/تماس-با-ما'].description} breadcrumb={[{ name: 'تماس با ما', href: '/تماس-با-ما' }]}>
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

  if (segments[0] === 'حسابداری') {
    if (segments[1] === 'پنل') {
      return (
        <div dir="rtl" className="app-root">
          <Suspense fallback={<div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)' }}><KarbanLoader label="در حال باز کردن پنل حسابداری…" /></div>}>
            <AccPanelShell sub={segments.slice(2)} />
          </Suspense>
        </div>
      );
    }
    return (
      <Page title={META_ROUTES['/حسابداری'].title} description={META_ROUTES['/حسابداری'].description} image={META_ROUTES['/حسابداری'].image} breadcrumb={[{ name: 'حسابداری', href: '/حسابداری' }]}>
        <AccLanding />
      </Page>
    );
  }

  if (segments[0] === 'admin') {
    return (
      <div dir="rtl" className="app-root">
        <Suspense fallback={<div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)' }}><KarbanLoader label="در حال باز کردن پنل مدیریت…" /></div>}>
          <AdminShell />
        </Suspense>
      </div>
    );
  }

  return (
    <Page title="صفحه پیدا نشد | کاربان" description="صفحه‌ای که دنبال آن بودید وجود ندارد." breadcrumb={['خطا ۴۰۴']} noindex>
      <NotFound />
    </Page>
  );
}
