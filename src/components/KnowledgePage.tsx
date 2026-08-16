import { useEffect, useState } from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const KNOWLEDGE_CATEGORIES = ['حقوقی و قانون کار', 'مالیات', 'حسابداری', 'منابع انسانی', 'مدیریت'];

const relatedLinks: Record<string, { href: string; label: string }[]> = {
  'حقوقی و قانون کار': [
    { href: '/ابزارهای-هوش-مصنوعی/محاسبه-حقوق', label: 'ماشین‌حساب حقوق ۱۴۰۵' },
    { href: '/ابزارهای-هوش-مصنوعی/سنوات', label: 'ماشین‌حساب سنوات' },
    { href: '/قراردادها', label: 'بانک قراردادها' },
  ],
  'مالیات': [
    { href: '/ابزارهای-هوش-مصنوعی/مالیات-مشاغل', label: 'ماشین‌حساب مالیات مشاغل' },
    { href: '/ابزارهای-هوش-مصنوعی/ارزش-افزوده', label: 'ماشین‌حساب ارزش افزوده' },
    { href: '/ابزارهای-هوش-مصنوعی/مالیات-حقوق', label: 'ماشین‌حساب مالیات حقوق' },
  ],
  'حسابداری': [
    { href: '/ابزارهای-هوش-مصنوعی/هزینه-استخدام', label: 'ماشین‌حساب هزینه استخدام' },
    { href: '/ابزارهای-هوش-مصنوعی/محاسبه-حقوق', label: 'ماشین‌حساب حقوق' },
  ],
  'منابع انسانی': [
    { href: '/ابزارهای-هوش-مصنوعی/هزینه-استخدام', label: 'ماشین‌حساب هزینه استخدام' },
    { href: '/ابزارهای-هوش-مصنوعی/سنوات', label: 'ماشین‌حساب سنوات' },
    { href: '/ابزارهای-هوش-مصنوعی/تست-سلامت', label: 'تست سلامت کسب‌وکار' },
  ],
  'مدیریت': [
    { href: '/ابزارهای-هوش-مصنوعی/تست-سلامت', label: 'تست سلامت کسب‌وکار' },
    { href: '/ابزارهای-هوش-مصنوعی/ساخت-قرارداد', label: 'ساخت قرارداد هوشمند' },
    { href: '/خدمات', label: 'خدمات تخصصی کاربان' },
  ],
};

type Article = { id: number; category: string; title: string; intro: string; body: string; author: string };

export function ArticlesListPage({ categoryIndex }: { categoryIndex: number }) {
  const category = KNOWLEDGE_CATEGORIES[categoryIndex - 1] || KNOWLEDGE_CATEGORIES[0];
  const [items, setItems] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from('articles')
      .select('id,category,title,intro,author')
      .eq('category', category)
      .order('id')
      .then(({ data }) => {
        if (active) {
          setItems((data || []) as Article[]);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [category]);

  return (
    <section className="inner-page">
      <div className="container narrow-content">
        <span className="eyebrow">دانشنامه</span>
        <h1>{category}</h1>
        <p className="lead">مقاله‌های تخصصی این دسته، نوشته‌شده با استناد به مواد قانونی.</p>
        {loading ? (
          <p>در حال بارگذاری…</p>
        ) : (
          <div className="article-list">
            {items.map((a) => (
              <a className="article-list-item" href={`/دانشنامه/مقاله/${a.id}`} key={a.id}>
                <FileText size={18} />
                <div>
                  <h2>{a.title}</h2>
                  <p>{a.intro}</p>
                  <small>{a.author}</small>
                </div>
                <ArrowLeft size={16} />
              </a>
            ))}
            {items.length === 0 && <p>به‌زودی مقاله‌های این دسته منتشر می‌شود.</p>}
          </div>
        )}
      </div>
    </section>
  );
}

export function ArticleViewPage({ articleId }: { articleId: string }) {
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from('articles')
      .select('*')
      .eq('id', Number(articleId))
      .maybeSingle()
      .then(({ data }) => {
        if (active) {
          const a = (data as Article) || null;
          setArticle(a);
          if (a) document.title = `${a.title} | کاربان`;
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [articleId]);

  if (loading) {
    return (
      <section className="inner-page">
        <div className="container narrow-content">
          <p>در حال بارگذاری…</p>
        </div>
      </section>
    );
  }

  if (!article) {
    return (
      <section className="inner-page">
        <div className="container narrow-content">
          <h1>مقاله پیدا نشد</h1>
          <a className="button" href="/دانشنامه">بازگشت به دانشنامه</a>
        </div>
      </section>
    );
  }

    const links = relatedLinks[article.category] || [
    { href: '/ابزارهای-هوش-مصنوعی', label: 'ابزارهای هوش مصنوعی کاربان' },
    { href: '/قراردادها', label: 'بانک قراردادها' },
    { href: '/خدمات', label: 'خدمات تخصصی' },
  ];

  return (
    <section className="inner-page">
      <div className="container narrow-content">
        <span className="eyebrow">{article.category}</span>
        <h1>{article.title}</h1>
        <p className="article-intro">{article.intro}</p>
        <small className="article-author">{article.author}</small>
        <div className="article-body">
          {article.body.split('\n\n').map((p, i) =>
            p.startsWith('## ') ? <h2 key={i}>{p.replace('## ', '')}</h2> : <p key={i}>{p}</p>,
          )}
        </div>

        {links.length > 0 && (
          <div className="related-box">
            <h2>ابزارهای مرتبط</h2>
            <div className="related-links">
              {links.map((l) => (
                <a key={l.href} href={l.href}>
                  {l.label} <ArrowLeft size={14} />
                </a>
              ))}
            </div>
          </div>
        )}

        <a className="button" href="/دانشنامه">بازگشت به دانشنامه</a>
      </div>
    </section>
  );
}
