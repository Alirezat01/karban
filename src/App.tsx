import { useRoute } from '@/router';
import Layout from '@/components/Layout';
import HomePage from '@/components/HomePage';
import ContentPage, { ServicesPage } from '@/components/ContentPage';
import CalculatorPage from '@/components/CalculatorPage';
import ArticlePage from '@/components/ArticlePage';
import RolePage from '@/components/RolePage';
import AdminPage from '@/components/AdminPage';
import { ArrowLeft } from 'lucide-react';

function NotFound() { return <section className="inner-page"><div className="container narrow-content"><span className="eyebrow">خطا ۴۰۴</span><h1>این صفحه پیدا نشد</h1><p className="lead">صفحه‌ای که دنبال آن بودید وجود ندارد یا جابه‌جا شده است.</p><a className="button" href="/">بازگشت به خانه <ArrowLeft size={17} /></a></div></section>; }
function Page({ title, description, breadcrumb, children }: { title: string; description: string; breadcrumb?: string[]; children: React.ReactNode }) { return <Layout title={title} description={description} breadcrumb={breadcrumb}>{children}</Layout>; }
const calcMap: Record<string, { type: 'salary' | 'hire' | 'severance' | 'retirement' | 'overtime'; title: string; desc: string }> = {
  'محاسبه-حقوق': { type: 'salary', title: 'محاسبه حقوق و دستمزد ۱۴۰۵', desc: 'حقوق ناخالص، کسورات بیمه و مالیات را برآورد کنید.' },
  'هزینه-استخدام': { type: 'hire', title: 'ماشین‌حساب هزینه استخدام', desc: 'هزینه کل استخدام یک کارمند را برآورد کنید.' },
  'سنوات': { type: 'severance', title: 'ماشین‌حساب سنوات پایان خدمت', desc: 'مبلغ سنوات پایان کار را محاسبه کنید.' },
  'بازنشستگی': { type: 'retirement', title: 'ماشین‌حساب بازنشستگی تأمین اجتماعی', desc: 'برآورد حقوق بازنشستگی تأمین اجتماعی.' },
  'اضافه-کاری': { type: 'overtime', title: 'ماشین‌حساب اضافه‌کاری', desc: 'مبلغ اضافه‌کاری را بر اساس نرخ قانونی محاسبه کنید.' },
};
export default function App() {
  const route = useRoute(); const segments = route.split('/').filter(Boolean); let content: React.ReactNode; let title = 'کاربان'; let description = 'کاربان، پلتفرم هوشمند مدیریت کسب‌وکار برای کاربران ایرانی.'; let breadcrumb: string[] | undefined;
  if (route === '/' || segments.length === 0) { content = <HomePage />; title = 'کاربان | پلتفرم هوشمند مدیریت کسب‌وکار؛ قرارداد، مالیات، روابط کار'; description = 'کاربان؛ بانک قرارداد تخصصی، ماشین‌حساب حقوق ۱۴۰۵ و دانشنامه حقوق کار برای کارفرمایان و فریلنسرها.'; }
  else if (['کارفرما', 'کارمند', 'فریلنسر'].includes(segments[0])) { const role = segments[0] as 'کارفرما' | 'کارمند' | 'فریلنسر'; content = <RolePage role={role} />; title = role; description = `مسیر ${role} در کاربان: قرارداد، حقوق، قانون کار و رشد.`; breadcrumb = [role]; }
  else if (segments[0] === 'دانشنامه') { content = segments.length === 1 ? <ContentPage kind="knowledge" title="راهنمای قانون کار و تأمین اجتماعی، به زبان ساده اما مستند" description="راهنمای مستند قانون کار، تأمین اجتماعی و مالیات به زبان ساده با ذکر ماده قانون؛ همیشه به‌روز." eyebrow="دانشنامه" /> : <ArticlePage title={`مقاله ${segments[1]}`} category="دانشنامه کاربان" />; title = segments.length === 1 ? 'دانشنامه حقوقی و مالیاتی کسب‌وکار | کاربان' : `مقاله ${segments[1]}`; description = 'راهنمای مستند قانون کار، تأمین اجتماعی و مالیات به زبان ساده با ذکر ماده قانون؛ همیشه به‌روز.'; breadcrumb = ['دانشنامه', ...(segments.length > 1 ? [`مقاله ${segments[1]}`] : [])]; }
  else if (segments[0] === 'قراردادها') { content = segments.length === 1 ? <ContentPage kind="contracts" title="بانک قراردادهای کاربان — دانلود نمونه قرارداد آماده" description="بیش از ۶۰ نمونه قرارداد استاندارد در ۵ نوع و اصناف مختلف؛ دانلود رایگان با موبایل، نسخه تخصصی صنف یا نگارش اختصاصی." eyebrow="قراردادها" /> : <ArticlePage title={`جزئیات قرارداد ${segments.slice(1).join(' ')}`} category="قراردادهای کاربان" contractId={segments[1]} />; title = segments.length === 1 ? 'بانک نمونه قرارداد | دانلود قرارداد کار، همکاری، پیمانکاری | کاربان' : `قرارداد ${segments.slice(1).join(' ')}`; description = 'بیش از ۶۰ نمونه قرارداد استاندارد در ۵ نوع و اصناف مختلف؛ دانلود رایگان با موبایل، نسخه تخصصی صنف یا نگارش اختصاصی.'; breadcrumb = ['قراردادها', ...(segments.length > 1 ? [segments.slice(1).join(' ')] : [])]; }
  else if (segments[0] === 'خدمات') { content = <ServicesPage />; title = 'مشاوره مالی، مالیاتی و روابط کار | خدمات تخصصی کاربان'; description = 'مشاوره متنی، تلفنی و حضوری + انجام اظهارنامه، بازبینی و تنظیم قرارداد؛ با ضمانت بازگشت وجه ۷ روزه و متخصص تأییدشده.'; breadcrumb = ['خدمات']; }
  else if (segments[0] === 'ابزارهای-هوش-مصنوعی') { const calc = calcMap[segments[1]]; content = segments.length === 1 ? <ContentPage kind="tools" title="ابزارهای هوش مصنوعی کاربان" description="ماشین‌حساب آنلاین حقوق و دستمزد، سنوات، بازنشستگی، هزینه استخدام و اضافه‌کاری مطابق پارامترهای رسمی ۱۴۰." eyebrow="ابزارهای هوش مصنوعی" /> : calc ? <CalculatorPage type={calc.type} title={calc.title} description={calc.desc} /> : segments[1] === 'ساخت-قرارداد' || segments[1] === 'تست-سلامت' ? <ContentPage kind="simple" title={segments[1] === 'ساخت-قرارداد' ? 'ساخت قرارداد هوشمند' : 'تست سلامت کسب‌وکار'} description="با چند پاسخ کوتاه، مسیر مناسب تصمیم‌گیری را پیدا کنید." eyebrow="ابزار هوشمند" /> : <NotFound />; title = calc?.title || (segments.length === 1 ? 'ابزارهای هوش مصنوعی کاربان | محاسبه حقوق، سنوات، بازنشستگی ۱۴۰۵' : 'ابزار هوشمند'); description = calc?.desc || 'ماشین‌حساب آنلاین حقوق و دستمزد، سنوات، بازنشستگی، هزینه استخدام و اضافه‌کاری مطابق پارامترهای رسمی ۱۴۰.'; breadcrumb = ['ابزارهای هوش مصنوعی', ...(segments.length > 1 ? [title] : [])]; }

  else if (['درباره-ما', 'تماس', 'ورود'].includes(segments[0])) { const labels: Record<string, string> = { 'درباره-ما': 'درباره کاربان', تماس: 'تماس با کاربان', ورود: 'ورود به کاربان' }; title = labels[segments[0]]; description = 'اطلاعات و خدمات کاربان برای مدیریت بهتر کسب‌وکار.'; content = <ContentPage kind="simple" title={title} description={description} eyebrow={title} />; breadcrumb = [title]; }
  else if (segments[0] === 'admin') { return <div dir="rtl" className="app-root"><AdminPage /></div>; }
  else { content = <NotFound />; title = 'پیدا نشد'; description = 'صفحه پیدا نشد.'; }
  return <div dir="rtl" className="app-root"><Page title={title} description={description} breadcrumb={breadcrumb}>{content}</Page></div>;
}
