import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRoute } from '@/router';
import Layout from '@/components/Layout';
import HomePage from '@/components/HomePage';
import ContentPage, { ServicesPage } from '@/components/ContentPage';
import CalculatorPage from '@/components/CalculatorPage';
import ArticlePage from '@/components/ArticlePage';
import RolePage from '@/components/RolePage';
import AdminPage from '@/components/AdminPage';
import BusinessHealthPage from '@/components/BusinessHealthPage';

function Page({
  title,
  description,
  breadcrumb,
  children,
}: {
  title: string;
  description: string;
  breadcrumb?: string[];
  children: ReactNode;
}) {
  return (
    <Layout title={title} description={description} breadcrumb={breadcrumb}>
      {children}
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
        <a className="button" href="/">
          بازگشت به خانه <ArrowLeft size={17} />
        </a>
      </div>
    </section>
  );
}

const calcMap: Record<string, { type: 'salary' | 'hire' | 'severance' | 'retirement' | 'overtime'; title: string; desc: string }> = {
  'محاسبه-حقوق': {
    type: 'salary',
    title: 'محاسبه حقوق و دستمزد ۱۴۰۵',
    desc: 'حقوق خالص، کسورات بیمه و مالیات را برآورد کنید.',
  },
  'هزینه-استخدام': {
    type: 'hire',
    title: 'ماشین‌حساب هزینه استخدام',
    desc: 'هزینه کل استخدام یک کارمند را برآورد کنید.',
  },
  'سنوات': {
    type: 'severance',
    title: 'ماشین‌حساب سنوات پایان خدمت',
    desc: 'مبلغ سنوات پایان کار را محاسبه کنید.',
  },
  'بازنشستگی': {
    type: 'retirement',
    title: 'ماشین‌حساب بازنشستگی تأمین اجتماعی',
    desc: 'وضعیت بازنشستگی و برآورد مستمری را ببینید.',
  },
  'اضافه-کاری': {
    type: 'overtime',
    title: 'ماشین‌حساب اضافه‌کاری',
    desc: 'مبلغ اضافه‌کاری را بر اساس نرخ قانونی محاسبه کنید.',
  },
};

function TrustAboutPage() {
  return (
    <Page
      title="درباره کاربان"
      description="کاربان از یک مشاهده ساده متولد شد: هزاران رابطه کاری، همکاری و قرارداد در کشور بدون نوشته درست، یا با نمونه‌های ناقص کپی‌شده از اینترنت بسته می‌شود — و حاصل آن اختلاف، جریمه و اتلاف وقت هر دو طرف است. کاربان پلتفرم هوشمند قرارداد و همراه حقوق کار است: بانک قرارداد تخصصی به تفکیک صنف، ماشین‌حساب‌های دقیق حقوق و سنوات مطابق مقررات ۱۴۵، و دانشنامه کاربردی برای کارفرمایان، کارمندان و فریلنسرها. روش ما ساده است: متن حقوقی دقیق، به‌روز و در دسترس برای همه، به‌همراه ابزارهای هوشمندی که محاسبه‌های پیچیده را به یک کلیک تبدیل می‌کنند. کاربان؛ از قرارداد تا آرامش."
      breadcrumb={['درباره ما']}
    >
      <section className="inner-page">
        <div className="container narrow-content">
          <span className="eyebrow">درباره ما</span>
          <h1>درباره کاربان</h1>
          <p className="article-intro">
            کاربان از یک مشاهده ساده متولد شد: هزاران رابطه کاری، همکاری و قرارداد در کشور بدون نوشته درست، یا با نمونه‌های ناقص کپی‌شده از اینترنت بسته می‌شود — و حاصل آن اختلاف، جریمه و اتلاف وقت هر دو طرف است. کاربان پلتفرم هوشمند قرارداد و همراه حقوق کار است: بانک قرارداد تخصصی به تفکیک صنف، ماشین‌حساب‌های دقیق حقوق و سنوات مطابق مقررات ۱۴۵، و دانشنامه کاربردی برای کارفرمایان، کارمندان و فریلنسرها. روش ما ساده است: متن حقوقی دقیق، به‌روز و در دسترس برای همه، به‌همراه ابزارهای هوشمندی که محاسبه‌های پیچیده را به یک کلیک تبدیل می‌کنند. کاربان؛ از قرارداد تا آرامش.
          </p>
        </div>
      </section>
    </Page>
  );
}

function TrustContactPage() {
  return (
    <Page
      title="تماس با کاربان"
      description="تهران، خیابان کریمخان، خیابان سنایی، پلاک ۶۱، طبقه سوم | تلفن گویا: ۰۲-۸۸۳۴۲۶۷۹ | شنبه تا چهارشنبه ۹ تا ۱۷ | hello@karbanapp.ir"
      breadcrumb={['تماس با ما']}
    >
      <section className="inner-page">
        <div className="container narrow-content">
          <span className="eyebrow">تماس با ما</span>
          <h1>تماس با کاربان</h1>
          <div className="contact-card">
            <p>تهران، خیابان کریمخان، خیابان سنایی، پلاک ۶۱، طبقه سوم</p>
            <p>تلفن گویا: ۰۲-۸۸۳۴۲۶۷۹</p>
            <p>شنبه تا چهارشنبه ۹ تا ۱۷</p>
            <p>hello@karbanapp.ir</p>
          </div>
        </div>
      </section>
    </Page>
  );
}

export default function App() {
  const route = useRoute();
  const segments = route.split('/').filter(Boolean);

  if (route === '/' || segments.length === 0) {
    return (
      <Page
        title="کاربان؛ بانک قرارداد تخصصی، ماشین‌حساب حقوق ۱۴۰۵ و دانشنامه حقوق کار برای کارفرمایان و فریلنسرها."
        description="کاربان؛ بانک قرارداد تخصصی، ماشین‌حساب حقوق ۱۴۰۵ و دانشنامه حقوق کار برای کارفرمایان و فریلنسرها."
      >
        <HomePage />
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
        <Page
          title="دانشنامه حقوقی و مالیاتی کسب‌وکار | کاربان"
          description="مقالات کاربردی حقوق کار، بیمه و مالیات به زبان ساده."
          breadcrumb={['دانشنامه']}
        >
          <ContentPage kind="knowledge" title="راهنمای قانون کار و تأمین اجتماعی، به زبان ساده اما مستند" description="راهنمای مستند قانون کار، تأمین اجتماعی و مالیات به زبان ساده با ذکر ماده قانون؛ همیشه به‌روز." eyebrow="دانشنامه" />
        </Page>
      );
    }

    return (
      <Page title={`مقاله ${segments[1]}`} description="مقاله‌ای از دانشنامه کاربان." breadcrumb={['دانشنامه', `مقاله ${segments[1]}`]}>
        <ArticlePage title={`مقاله ${segments[1]}`} category="دانشنامه کاربان" />
      </Page>
    );
  }

  if (segments[0] === 'قراردادها') {
    if (segments.length === 1) {
      return (
        <Page
          title="بیش از ۶۰ قرارداد تخصصی به تفکیک صنف؛ متن کامل و PDF."
          description="بیش از ۶۰ قرارداد تخصصی به تفکیک صنف؛ متن کامل و PDF."
          breadcrumb={['قراردادها']}
        >
          <ContentPage
            kind="contracts"
            title="بانک قراردادهای کاربان — دانلود نمونه قرارداد آماده"
            description="بیش از ۶۰ نمونه قرارداد استاندارد در ۵ نوع و اصناف مختلف؛ دانلود رایگان با موبایل، نسخه تخصصی صنف یا نگارش اختصاصی."
            eyebrow="قراردادها"
          />
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
      <Page
        title="مشاوره و قرارداد اختصاصی برای هر صنف؛ از پزشکان تا فروشگاه آنلاین."
        description="مشاوره و قرارداد اختصاصی برای هر صنف؛ از پزشکان تا فروشگاه آنلاین."
        breadcrumb={['خدمات']}
      >
        <ServicesPage />
      </Page>
    );
  }

  if (segments[0] === 'ابزارهای-هوش-مصنوعی') {
    if (segments[1] === 'تست-سلامت') {
      return (
        <Page
          title="تست سلامت کسب‌وکار"
          description="نقاط قوت و ریسک‌های کسب‌وکار را بشناسید."
          breadcrumb={['ابزارهای هوش مصنوعی', 'تست سلامت']}
        >
          <BusinessHealthPage />
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
      <Page
        title="ماشین‌حساب‌های دقیق حقوق، سنوات، اضافه‌کاری و مالیات مطابق مقررات ۱۴۰۵."
        description="ماشین‌حساب‌های دقیق حقوق، سنوات، اضافه‌کاری و مالیات مطابق مقررات ۱۴۰۵."
        breadcrumb={['ابزارهای هوش مصنوعی']}
      >
        <ContentPage
          kind="tools"
          title="ابزارهای هوش مصنوعی کاربان"
          description="ماشین‌حساب آنلاین حقوق و دستمزد، سنوات، بازنشستگی، هزینه استخدام و اضافه‌کاری مطابق پارامترهای رسمی ۱۴۰۵."
          eyebrow="ابزارهای هوش مصنوعی"
        />
      </Page>
    );
  }

  if (segments[0] === 'درباره-ما') {
    return <TrustAboutPage />;
  }

  if (segments[0] === 'تماس-با-ما') {
    return <TrustContactPage />;
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

