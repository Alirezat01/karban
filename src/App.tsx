import React, { Suspense, useEffect } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRoute } from '@/router';
import Layout from '@/components/Layout';
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
const RequestsListPage = React.lazy(() =>
  import('@/components/RequestsPage').then((m) => ({ default: m.RequestsListPage })),
);
const RequestViewPage = React.lazy(() =>
  import('@/components/RequestsPage').then((m) => ({ default: m.RequestViewPage })),
);

function Page({ title, description, breadcrumb, children }: { title: string; description: string; breadcrumb?: string[]; children: ReactNode }) {
  return (
    <Layout title={title} description={description} breadcrumb={breadcrumb}>
      <Suspense fallback={<div style={{ textAlign: 'center', padding: '3rem' }}>در حال بارگذاری...</div>}>
        {children}
      </Suspense>
    </Layout>
  );
}

function NotFound() {
  return (
    <section className="inner-page">
      <div className="container narrow-content">
        <span className="eyebrow">خطا ۴۰</span>
        <h1>این صفحه پیدا نشد</h1>
        <p className="lead">صفحه‌ای که دنبال آن بودید وجود ندارد یا جابه‌جا شده است.</p>
        <a className="button" href="/">بازگشت به خانه <ArrowLeft size={17} /></a>
      </div>
    </section>
  );
}
const calcMap: Record<string, { type: 'salary' | 'hire' | 'severance' | 'retirement' | 'overtime' | 'business-tax' | 'vat' | 'salary-tax'; title: string; desc: string }> = {
  'محاسبه-حقوق': { type: 'salary', title: 'محاسبه حقوق و دستمزد ۱۴۰', desc: 'حقوق خالص، کسورات بیمه و مالیات را برآورد کنید.' },
  'هزینه-استخدام': { type: 'hire', title: 'ماشین‌حساب هزینه استخدام', desc: 'بهای تمام‌شدن واقعی یک کارمند، قلم‌به‌قلم.' },
  'سنوات': { type: 'severance', title: 'ماشین‌حساب سنوات پایان خدمت', desc: 'مبلغ سنوات پایان کار را محاسبه کنید.' },
  'بازنشستگی': { type: 'retirement', title: 'ماشین‌حساب بازنشستگی تأمین اجتماعی', desc: 'وضعیت بازنشستگی و برآورد مستمری را ببینید.' },
  'اضافه-کاری': { type: 'overtime', title: 'ماشین‌حساب اضافه‌کاری', desc: 'مبلغ اضافه‌کاری را بر اساس نرخ قانونی محاسبه کنید.' },
  'مالیات-مشاغل': { type: 'business-tax', title: 'ماشین‌حساب مالیات مشاغل و مغازه', desc: 'محاسبه پلکانی ماده ۱۳۱ با معافیت سالانه.' },
  'ارزش-افزوده': { type: 'vat', title: 'ماشین‌حساب ارزش افزوده', desc: 'محاسبه ۱۰٪ — از پایه یا از داخل فاکتور.' },
  'مالیات-حقوق': { type: 'salary-tax', title: 'ماشین‌حساب مالیات حقوق', desc: 'پلکانی مالیات حقوق با معافیت ماهانه ۱۴۵.' },
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    { '@type': 'Question', name: 'آیا نتایج ماشین‌حساب‌ها مبنای قانونی دارد؟', acceptedAnswer: { '@type': 'Answer', text: 'محاسبات بر اساس قانون کار، قانون تأمین اجتماعی و قانون مالیات‌های مستقیم و مصوبات ۱۴۵ است؛ ملاک نهایی، فیش رسمی سازمان‌هاست.' } },
    { '@type': 'Question', name: 'پارامترهای حقوق ۱۴۰۵ از کجا می‌آید؟', acceptedAnswer: { '@type': 'Answer', text: 'مطابق بخشنامه سالانه شورای عالی کار؛ و از پنل مدیریت کاربان قابل به‌روزرسانی است.' } },
    { '@type': 'Question', name: 'سنوات پایان خدمت چگونه محاسبه می‌شود؟', acceptedAnswer: { '@type': 'Answer', text: 'به ازای هر سال سابقه معادل یک ماه آخرین حقوق، مطابق ماده ۲۴ قانون کار.' } },
    { '@type': 'Question', name: 'نرخ ارزش افزوده سال ۱۴۰ چقدر است؟', acceptedAnswer: { '@type': 'Answer', text: '۱۰٪؛ هر دو حالت افزودن به پایه و استخراج از داخل فاکتور محاسبه می‌شود.' } },
    { '@type': 'Question', name: 'مالیات مشاغل چند درصد است؟', acceptedAnswer: { '@type': 'Answer', text: 'پلکانی ۱۵ تا ۳۵ درصد مطابق ماده ۱۳۱، پس از کسر معافیت سالانه.' } },
  ],
};
export default function App() {
  const route = useRoute();
  const segments = route.split('/').filter(Boolean);
  
  useEffect(() => {
    const w = window as unknown as { gtag?: (...args: unknown[]) => void };
    if (w.gtag) w.gtag('event', 'page_view', { page_path: route });
  }, [route]);

  if (route === '/' || segments.length === 0) {
    return (
      <Page title="کاربان؛ بانک قرارداد تخصصی، ماشین‌حساب حقوق ۱۴۰۵ و دانشنامه حقوق کار برای کارفرمایان و فریلنسرها" description="بیش از ۸۰ قرارداد تخصصی، ۸ ماشین‌حساب دقیق حقوق و مالیات، و ۲۵ مقاله حقوقی با استناد قانون کار و قانون مدنی.">
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
        <Page title="دانشنامه حقوقی و مالیاتی کسب‌وکار | کاربان" description="مقالات کاربردی حقوق کار، بیمه و مالیات به زبان ساده." breadcrumb={['دانشنامه']}>
          <ContentPage kind="knowledge" title="راهنمای قانون کار و تأمین اجتماعی، به زبان ساده اما مستند" description="راهنمای مستند قانون کار، تأمین اجتماعی و مالیات به زبان ساده با ذکر ماده قانون؛ همیشه به‌روز." eyebrow="دانشنامه" />
        </Page>
      );
    }

    if (segments[1] === 'مقاله' && segments[2]) {
      return (
        <Page title="مقاله دانشنامه کاربان" description="مقاله تخصصی با استناد قانونی." breadcrumb={['دانشنامه', 'مقاله']}>
          <ArticleViewPage articleId={segments[2]} />
        </Page>
      );
    }

    return (
      <Page title="دانشنامه کاربان" description="مقاله‌های تخصصی کسب‌وکار با استناد قانونی." breadcrumb={['دانشنامه']}>
        <ArticlesListPage categoryIndex={Number(segments[1]) || 1} />
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
      <Page title={`قرارداد ${segments.slice(1).join(' ')}`} description="متن کامل قرارداد و فایل PDF." breadcrumb={['قراردادها', segments.slice(1).join(' ')]}>
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

    const calc = segments[1] ? calcMap[segments[1]] : undefined;
    if (calc) {
      return (
        <Page title={calc.title} description={calc.desc} breadcrumb={['ابزارهای هوش مصنوعی', calc.title]}>
          <CalculatorPage type={calc.type} title={calc.title} description={calc.desc} />
        </Page>
      );
    }

    return (
           <Page title="ماشین‌حساب‌های دقیق حقوق، سنوات، اضافه‌کاری و مالیات مطابق مقررات ۱۴۵" description="ماشین‌حساب‌های دقیق حقوق، سنوات، اضافه‌کاری و مالیات مطابق مقررات ۱۴۰۵." breadcrumb={['ابزارهای هوش مصنوعی']} jsonLd={faqJsonLd}>
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
            <p className="article-intro">کاربان پلتفرم هوشمند قرارداد و همراه حقوق کار است: بانک قرارداد تخصصی به تفکیک صنف، ماشین‌حساب‌های دقیق مطابق مقررات ۱۴۰، و دانشنامه کاربردی برای کارفرمایان، کارمندان و فریلنسرها. کاربان؛ از قرارداد تا آرامش.</p>
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
        <AdminPage />
      </div>
    );
  }

  return (
    <Page title="پیدا نشد" description="صفحه پیدا نشد." breadcrumb={['خطا ۴۰۴']}>
      <NotFound />
    </Page>
  );
}
