import { useEffect, useState } from 'react';
import { ArrowLeft, Copy, FileText } from 'lucide-react';
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
      <div className="container narrow-content">
        <span className="eyebrow">ابزارهای اداری</span>
        <h1>درخواست‌های اداری آماده</h1>
        <p className="lead">متن رسمی و آماده برای درخواست‌های پرتکرار؛ کپی کن، جاهای خالی را پر کن و امضا کن.</p>
        <div className="filter-row" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '1.5rem 0' }}>
          {['همه', ...REQUEST_CATEGORIES].map((c) => (
            <button key={c} className={`button button-small ${cat === c ? 'plan-featured' : ''}`} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
        {loading ? (
          <p>در حال بارگذاری…</p>
        ) : (
          <div className="article-list">
            {filtered.map((r) => (
              <a className="article-list-item" href={`/درخواست‌های-اداری/${r.id}`} key={r.id}>
                <FileText size={18} />
                <div>
                  <h2>{r.title}</h2>
                  <p>{r.intro}</p>
                  <small>{r.category}</small>
                </div>
                <ArrowLeft size={16} />
              </a>
            ))}
            {filtered.length === 0 && <p>به‌زودی درخواست‌های این دسته اضافه می‌شود.</p>}
          </div>
        )}
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
        <span className="eyebrow">{item.category}</span>
        <h1>{item.title}</h1>
        <p className="article-intro">{item.intro}</p>
        <div className="contract-body" style={{ whiteSpace: 'pre-wrap', lineHeight: '2', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1.5rem' }}>
          {item.body}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
          <button className="button" onClick={copy}>
            <Copy size={16} /> {copied ? 'کپی شد ✓' : 'کپی متن'}
          </button>
          <a className="button" href="/درخواست‌های-اداری">بازگشت به فهرست</a>
        </div>
      </div>
    </section>
  );
}
