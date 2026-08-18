import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { isIranianMobile } from '@/lib/validation';
import { normalizeMobile } from '@/lib/normalize';
import { notifyAdmin } from '@/lib/notify';

type Props = { title: string; category: string; contractId?: string };

export default function ArticlePage({ title, category, contractId }: Props) {
  const [mobile, setMobile] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
   const [contractData, setContractData] = useState<{ title?: string; summary?: string; body?: string; pdf_url?: string } | null>(null);
  const isContract = category.includes('قرارداد');

  useEffect(() => {
    if (!contractId) return;
    supabase
      .from('contracts')
            .select('title, summary, body, pdf_url')
      .eq('id', contractId)
      .maybeSingle()
           .then(({ data }) => {
        if (data) {
          setContractData(data);
          if (data.title) document.title = `${data.title} | کاربان`;
        }
      });
  }, [contractId]);

  const submitDownload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isIranianMobile(mobile)) {
      setStatus('error');
      return;
    }

    setStatus('loading');
    const { error } = await supabase.from('leads').insert({ mobile: normalizeMobile(mobile), source: 'contract_download' });
    if (error) {
      console.error('contract download lead failed', error);
      setStatus('error');
      return;
    }

    notifyAdmin(`📥 دانلود قرارداد: ${title} | ${normalizeMobile(mobile)}`);

    if (contractData?.pdf_url) {
      const anchor = document.createElement('a');
      anchor.href = contractData.pdf_url;
      anchor.target = '_blank';
      anchor.rel = 'noreferrer';
      anchor.click();
    }

    setStatus('success');
    setMobile('');
  };

  const isContractDetail = isContract && title.includes('قرارداد کار');
  const contractFaqs: [string, string][] = [
    ['بیمه برای کارگر الزامی است؟', 'بله، طبق ماده ۱۴۸ قانون کار، بیمه تأمین اجتماعی برای تمام کارکنان الزامی است.'],
    ['دوره آزمایشی چقدر است؟', 'حداکثر ۱ ماه برای کارگران ساده و ۳ ماه برای کارگران متخصص و فنی.'],
    ['سنوات چگونه محاسبه می‌شود؟', 'هر سال سابقه کار معادل یک ماه آخرین مزد پایه است.'],
  ];

  return (
    <section className="inner-page">
      <div className="container article-shell">
        <span className="eyebrow">
          <BookOpen size={15} /> {category}
        </span>
        <h1>{contractData?.title || title}</h1>
               <p className="article-intro">
          {contractData?.summary ||
            (isContractDetail
              ? 'قرارداد کار مهم‌ترین سند حقوقی میان کارگر و کارفرماست؛ حقوق و تعهدات هر دو طرف را تعریف می‌کند و مرجع حل اختلاف است.'
              : 'راهنمای کاربردی کاربان برای صاحبان کسب‌وکار، کارگران و متخصصان ایرانی.'))}
        </p>

        <div className="article-body">
          {contractData?.body && (
            <div className="contract-body" style={{ whiteSpace: 'pre-wrap', lineHeight: '2' }}>
              {contractData.body}
            </div>
          )}

          {isContractDetail && !contractData?.body ? (
            <>
              <p>
                قرارداد کار مهم‌ترین سند حقوقی کارگر و کارفرماست. این قرارداد نوع رابطه کاری، مدت، مزد، ساعات کار، مرخصی و تعهدات هر دو طرف را مشخص می‌کند و در صورت بروز اختلاف، مرجع اصلی استناد است.
              </p>
              <div className="related-box">
                <FileText />
                <div>
                  <strong>مستندات قانونی</strong>
                  <ul>
                    <li>ماده ۳ — لزوم کتبی بودن قرارداد کار</li>
                    <li>ماده ۱۱ — دوره آزمایشی و مدت آن</li>
                    <li>ماده ۴ — منع تبعیض در استخدام</li>
                    <li>ماده ۵ — شرایط کار و ساعات کار</li>
                    <li>ماده ۶ — تعهدات کارفرما</li>
                  </ul>
                </div>
              </div>
              <div className="faq">
                <h2>پرسش‌های متداول</h2>
                {contractFaqs.map(([question, answer]) => (
                  <details key={question}>
                    <summary>{question}</summary>
                    <p>{answer}</p>
                  </details>
                ))}
              </div>
            </>
          ) : !isContractDetail && !contractData?.body ? (
            <>
              <p>
                در مدیریت کسب‌وکار، تصمیم‌های کوچک حقوقی و مالی می‌توانند اثر بزرگی بر آینده داشته باشند. این راهنما با زبان ساده، نکته‌های کلیدی و مسیر اقدام را توضیح می‌دهد.
              </p>
              <h2>از کجا شروع کنیم؟</h2>
              <p>ابتدا اطلاعات و قراردادهای خود را منظم کنید، سپس با استفاده از ابزارهای کاربان وضعیت فعلی را بررسی کنید و برای گام بعدی تصمیم بگیرید.</p>
            </>
          ) : null}

          {contractData?.pdf_url && (
            <div className="related-box">
              <FileText />
              <div>
                <strong>دانلود PDF</strong>
                <p>شماره موبایل خود را وارد کنید تا نسخه قابل دانلود قرارداد برای شما باز شود.</p>
                <form onSubmit={submitDownload}>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={mobile}
                    onChange={(event) => {
                      setMobile(event.target.value);
                      setStatus('idle');
                    }}
                    placeholder="شماره موبایل"
                    aria-label="شماره موبایل"
                  />
                  <button className="button button-small" type="submit" disabled={status === 'loading'}>
                    {status === 'loading' ? 'در حال آماده‌سازی...' : 'فعال‌سازی دانلود'} <ArrowLeft size={15} />
                  </button>
                </form>
                {status === 'success' && <small className="admin-success">دانلود با موفقیت انجام شد.</small>}
                {status === 'error' && <small className="admin-error">شماره موبایل را به‌صورت ۱۱ رقم و با ۰۹ وارد کنید یا خطایی در دریافت فایل رخ داد.</small>}
              </div>
            </div>
          )}

          <div className="related-box">
            <FileText />
            <div>
              <strong>برای تصمیم عملی آماده‌اید؟</strong>
              <p>قراردادها و خدمات مرتبط را بررسی کنید.</p>
              <a className="text-link" href="/قراردادها">
                مشاهده قراردادها <ArrowLeft size={15} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

