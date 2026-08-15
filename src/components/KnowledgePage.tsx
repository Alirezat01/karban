import { useEffect, useState } from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const KNOWLEDGE_CATEGORIES = ['حقوقی و قانون کار', 'مالیات', 'حسابداری', 'منابع انسانی', 'مدیریت'];

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
          setArticle((data as Article) || null);
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
        <a className="button" href="/دانشنامه">بازگشت به دانشنامه</a>
      </div>
    </section>
  );
}
