import { useEffect, useState } from 'react';
import { ArrowLeft, Copy, FileText, Printer } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const REQUEST_CATEGORIES = ['روابط کار', 'مالی و بانکی', 'اداری و عمومی'];

type Req = { id: number; category: string; title: string; intro: string; body: string };

export function RequestsListPage() {
  const [items, setItems] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState('همه');

  useEffect(() => {
    let active = true;
    supabase
      .from('admin_requests')
      .select('id,category,title,intro')
      .order('id', { ascending: false })
      .then(({ data }) => {
        if (active) {
          setItems((data || []) as Req[]);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = cat === 'همه' ? items : items.filter((i) => i.category === cat);

  return (
    <section className="inner-page">
      <div className="container">
        <div className="narrow-content">
          <span className="eyebrow">ابزارهای اداری</span>
          <h1>درخواست‌های اداری آماده</h1>
          <p className="lead">متن رسمی و آماده برای درخواست‌های پرتکرار؛ مشاهده کن، کپی بگیر یا PDF برنددار دانلود کن، جاهای خالی را پر کن و امضا کن.</p>
        </div>

        <div className="filter-panel">
          <strong>دسته‌بندی درخواست‌ها</strong>
          <div className="filter-row">
            {['همه', ...REQUEST_CATEGORIES].map((c) => (
              <button key={c} className={`button button-small ${cat === c ? 'button-green' : ''}`} onClick={() => setCat(c)}>
                {c}
              </button>
            ))}
          </div>
          <small>{filtered.length} درخواست آماده</small>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', marginTop: '2rem' }}>در حال بارگذاری...</p>
        ) : (
          <div className="contract-grid">
            {filtered.map((r) => (
              <article className="contract-card" key={r.id}>
                <div className="contract-card-top">
                  <FileText />
                  <div>
                    <small>{r.category}</small>
                    <h2>{r.title}</h2>
                    <p>{r.intro}</p>
                  </div>
                </div>
                <a className="button button-small" href={`/درخواست‌های-اداری/${r.id}`}>
                  مشاهده و دانلود <ArrowLeft size={15} />
                </a>
              </article>
            ))}
            {filtered.length === 0 && <p>به‌زودی درخواست‌های این دسته اضافه می‌شود.</p>}
          </div>
        )}

        <div className="related-box" style={{ marginTop: '2rem' }}>
          <FileText />
          <div>
            <strong>ابزارهای مرتبط کاربان</strong>
            <div className="related-links">
              <a href="/قراردادها">بانک قراردادها <ArrowLeft size={14} /></a>
              <a href="/دانشنامه">دانشنامه حقوقی <ArrowLeft size={14} /></a>
              <a href="/ابزارهای-هوش-مصنوعی">ماشین‌حساب‌ها <ArrowLeft size={14} /></a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function RequestViewPage({ requestId }: { requestId: string }) {
  const [item, setItem] = useState<Req | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    supabase
      .from('admin_requests')
      .select('*')
      .eq('id', Number(requestId))
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setItem((data as Req) || null);
        if (data) document.title = `${data.title} | کاربان`;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [requestId]);

  const copy = async () => {
    if (!item) return;
    try {
      await navigator.clipboard.writeText(item.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (loading) {
    return (
      <section className="inner-page">
        <div className="container narrow-content">
          <p>در حال بارگذاری…</p>
        </div>
      </section>
    );
  }

  if (!item) {
    return (
      <section className="inner-page">
        <div className="container narrow-content">
          <h1>درخواست پیدا نشد</h1>
          <a className="button" href="/درخواست‌های-اداری">بازگشت</a>
        </div>
      </section>
    );
  }

  return (
    <section className="inner-page">
      <div className="container narrow-content">
        <div className="print-only print-head">
          <img src="/assets/images/Gemini_Generated_Image_3xp4kz3xp4kz3xp4-removebg-preview.png" alt="کاربان" />
          <div>
            <strong>کاربان | karbanapp.ir</strong>
            <span>{item.title}</span>
          </div>
        </div>

        <span className="eyebrow">{item.category}</span>
        <h1>{item.title}</h1>
        <p className="article-intro">{item.intro}</p>
        <div className="contract-body" style={{ whiteSpace: 'pre-wrap', lineHeight: '2', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1.5rem' }}>
          {item.body}
        </div>
        <div className="print-only print-watermark">کاربان</div>

        <div className="no-print" style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
          <button className="button" onClick={copy}>
            <Copy size={16} /> {copied ? 'کپی شد ✓' : 'کپی متن'}
          </button>
          <button className="button" onClick={() => window.print()}>
            <Printer size={16} /> دانلود PDF
          </button>
          <a className="button" href="/درخواست‌های-اداری">بازگشت به فهرست</a>
        </div>
      </div>
    </section>
  );
}
