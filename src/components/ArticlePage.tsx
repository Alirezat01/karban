import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { applySEO } from '@/lib/seo';
import { isIranianMobile } from '@/lib/validation';
import { normalizeMobile } from '@/lib/normalize';
import { notifyAdmin } from '@/lib/notify';
import RatingWidget from '@/components/RatingWidget';
import contractRelated from '@/data/contract-related.json';

const contractRelatedMap = contractRelated as Record<string, { href: string; label: string }[]>;

type Props = { title: string; category: string; contractId?: string };

type ContractData = { title?: string; summary?: string; body?: string; pdf_url?: string; type?: string | null; industry?: string | null; created_at?: string | null; updated_at?: string | null };

export default function ArticlePage({ title, category, contractId }: Props) {
  const [mobile, setMobile] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [contractData, setContractData] = useState<ContractData | null>(null);
  const isContract = category.includes('قرارداد');

  useEffect(() => {
    if (!contractId) return;
    /* زنجیره fallback: ستون updated_at ممکن است هنوز اضافه نشده باشد (۴۰۰ = شکست کل صفحه) */
    (async () => {
      let data: ContractData | null = null;
      let error: { message: string } | null = null;
      for (const select of ['title, summary, body, pdf_url, type, industry, created_at, updated_at', 'title, summary, body, pdf_url, type, industry, created_at']) {
        const res = await supabase.from('contracts').select(select).eq('id', contractId).maybeSingle();
        if (!res.error) { data = (res.data as ContractData | null) ?? null; error = null; break; }
        error = res.error as unknown as { message: string };
        if (!/updated_at|column/i.test(res.error.message || '')) break;
      }
      {
        if (!data && !error) {
          /* قرارداد وجود ندارد: از ایندکس خارج شود (با ۴۰۴ واقعی سرور هم پوشش دارد) */
          applySEO({
            title: 'قرارداد پیدا نشد | کاربان',
            description: 'صفحه‌ای که دنبال آن بودید وجود ندارد.',
            path: window.location.pathname,
            noindex: true,
          });
          return;
        }
        if (data) {
          setContractData(data);
          const contractTitle = (data.title || title).trim();
          const contractPath = `/قراردادها/${contractId}`;
          const summary = (data.summary || '').trim();
          const contractDesc =
            summary.length >= 60
              ? summary
              : `متن کامل «${contractTitle}» با بندهای استاندارد و دانلود رایگان PDF${data.industry ? ` — نسخهٔ مناسب صنف «${data.industry}»` : ''} مطابق مقررات جاری ایران.`;
          const modified = data.updated_at || data.created_at || null;
          const u = (p: string) => `https://karbanapp.ir${encodeURI(p)}`;
          applySEO({
            title: `${contractTitle} | کاربان`,
            description: contractDesc,
            path: contractPath,
            image: '/images/og-contracts.png',
            ogType: 'article',
            published: data.created_at || null,
            modified,
            jsonLd: [
              {
                '@context': 'https://schema.org',
                '@type': 'Article',
                headline: contractTitle,
                description: contractDesc,
                image: ['https://karbanapp.ir/images/og-contracts.png'],
                author: { '@type': 'Organization', name: 'کاربان', '@id': 'https://karbanapp.ir/#organization' },
                publisher: { '@id': 'https://karbanapp.ir/#organization' },
                mainEntityOfPage: u(contractPath),
                inLanguage: 'fa-IR',
                ...(data.created_at ? { datePublished: data.created_at } : {}),
                ...(modified ? { dateModified: modified } : {}),
                ...((data.type || data.industry)
                  ? { about: [data.type, data.industry].filter(Boolean).map((n) => ({ '@type': 'Thing', name: n })) }
                  : {}),
              },
              {
                '@context': 'https://schema.org',
                '@type': 'BreadcrumbList',
                itemListElement: [
                  { '@type': 'ListItem', position: 1, name: 'خانه', item: 'https://karbanapp.ir/' },
                  { '@type': 'ListItem', position: 2, name: 'قراردادها', item: u('/قراردادها') },
                  { '@type': 'ListItem', position: 3, name: contractTitle, item: u(contractPath) },
                ],
              },
            ],
          });
        }
      }
    })();
  }, [contractId, title]);

  const submitDownload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isIranianMobile(mobile)) {
      setStatus('error');
      return;
    }

    setStatus('loading');
    const source = contractData?.pdf_url ? 'contract_download' : 'contract_print';
    const { error } = await supabase.from('leads').insert({ mobile: normalizeMobile(mobile), source });
    if (error) {
      console.error('contract download lead failed', error);
      setStatus('error');
      return;
    }

    notifyAdmin(`📥 دانلود قرارداد: ${contractData?.title || title} | ${normalizeMobile(mobile)}`);

    if (contractData?.pdf_url) {
      const anchor = document.createElement('a');
      anchor.href = contractData.pdf_url;
      anchor.target = '_blank';
      anchor.rel = 'noreferrer';
      anchor.click();
    } else {
      window.print();
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
        <div className="print-only print-head">
          <img src="/assets/images/Gemini_Generated_Image_3xp4kz3xp4kz3xp4-removebg-preview.png" alt="کاربان" />
          <div>
            <strong>کاربان | karbanapp.ir</strong>
            <span>{contractData?.title || title}</span>
          </div>
        </div>

        <a className="button button-small no-print" href="/قراردادها" style={{ marginBottom: '1rem' }}>
          <ArrowRight size={15} /> بازگشت به فهرست
        </a>

        <span className="eyebrow">
          <BookOpen size={15} /> {category}
        </span>
        <h1>{contractData?.title || title}</h1>
        <p className="article-intro">
          {contractData?.summary ||
            (isContractDetail
              ? 'قرارداد کار مهم‌ترین سند حقوقی میان کارگر و کارفرماست؛ حقوق و تعهدات هر دو طرف را تعریف می‌کند و مرجع حل اختلاف است.'
              : 'راهنمای کاربردی کاربان برای صاحبان کسب‌وکار، کارگران و متخصصان ایرانی.')}
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

          <div className="related-box no-print">
            <FileText />
            <div>
              <strong>دانلود PDF برنددار</strong>
              <p>شماره موبایل خود را وارد کنید تا {contractData?.pdf_url ? 'فایل رسمی قرارداد' : 'نسخه PDF برنددار (با سربرگ و واترمارک کاربان)'} برای شما باز شود.</p>
              <form onSubmit={submitDownload} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
                  style={{ flex: 1, minWidth: '180px', padding: '0.65rem 1rem', border: '1.5px solid var(--line)', borderRadius: '12px', background: 'var(--surface2)', color: 'var(--text)' }}
                />
                <button className="button button-small" type="submit" disabled={status === 'loading'}>
                  {status === 'loading' ? 'در حال آماده‌سازی...' : 'فعال‌سازی دانلود PDF'} <ArrowLeft size={15} />
                </button>
              </form>
              {status === 'success' && <small className="admin-success">دانلود با موفقیت انجام شد.</small>}
              {status === 'error' && <small className="admin-error">شماره موبایل را به‌صورت ۱۱ رقم و با ۰۹ وارد کنید یا خطایی در دریافت فایل رخ داد.</small>}
            </div>
          </div>
          <div className="print-only print-watermark">کاربان</div>

          <div className="related-box no-print">
            <FileText />
            <div>
              <strong>برای تصمیم عملی آماده‌اید؟</strong>
              <p>قراردادها و خدمات مرتبط را بررسی کنید.</p>
              <a className="text-link" href="/قراردادها">
                مشاهده قراردادها <ArrowLeft size={15} />
              </a>
            </div>
          </div>

          <div className="related-box no-print">
            <FileText />
            <div>
              <strong>صفحات مرتبط</strong>
              <div className="related-links">
                {(contractRelatedMap[contractData?.type || ''] || contractRelatedMap['_default']).map((l) => (
                  <a key={l.href} href={l.href}>
                    {l.label} <ArrowLeft size={14} />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {isContract && (
            <RatingWidget targetType="contract" targetId={contractId || title} title="این قرارداد چقدر برایت مفید بود؟" />
          )}
        </div>
      </div>
    </section>
  );
}
