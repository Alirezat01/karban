import { useEffect, useState } from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { applySEO } from '@/lib/seo';
import { renderRichText } from '@/lib/rich-text';
import articleRelated from '@/data/article-related.json';
import KarbanLoader from '@/components/KarbanLoader';
import {
  articleIdFromSegment,
  articleSlugPath,
  categorySlug,
  KNOWLEDGE_CATEGORIES,
} from '@/lib/slug';

/** دسته‌های دانشنامه — منبع واحد در src/lib/slug.ts (React و prerender مشترک) */
export { KNOWLEDGE_CATEGORIES };

/** اختصاصی هر دسته — باید با CATEGORY_INTRO در scripts/prerender-meta.mjs هماهنگ بماند */
export const CATEGORY_INTRO: Record<string, string> = {
  'حقوقی و قانون کار': 'از تعریف قرارداد کار و دوره آزمایشی تا اضافه‌کاری، سنوات و تسویه‌حساب؛ مقاله‌های این دسته مواد کلیدی قانون کار را با مثال عملی و استناد دقیق توضیح می‌دهند تا پیش از امضای هر سند، حق و تکلیف دو طرف را بدانید.',
  'مالیات': 'از اظهارنامه و معافیت‌های سالانه تا ارزش افزوده و مالیات حقوق؛ این دسته مهلت‌ها، نرخ‌ها و مسیرهای قانونی را به زبان ساده مرور می‌کند تا نه جریمه بدهید و نه ریالی بیشتر از موظف بپردازید.',
  'حسابداری': 'اسناد قابل‌قبول، هزینه‌های سازمانی و کنترل‌های پایه؛ مقاله‌های حسابداری کاربان کمک می‌کند پرونده مالیاتی شما مستند و قابل دفاع باشد.',
  'منابع انسانی': 'از هزینه واقعی استخدام و آیین‌نامه انضباطی تا محرمانگی و نگهداشت نیرو؛ راهنماهای عملی برای کارفرمایانی که می‌خواهند تیم پایدار و کم‌دردسر بسازند.',
  'مدیریت': 'تصمیم‌های مدیریتی پرتکرار — از نوع همکاری و قرارداد تا تست سلامت کسب‌وکار — با نگاه حقوقی و مالی، برای رشد مطمئن‌تر.',
};

const articleRelatedMap = articleRelated as Record<string, { href: string; label: string }[]>;

type Article = {
  id: number; category: string; title: string; intro: string; body: string; author: string;
  meta_title?: string | null; meta_description?: string | null;
  created_at?: string | null; updated_at?: string | null;
};

/* نام نویسنده واقعی؟ «کاربان/تیم کاربان» = سازمان؛ بقیه = شخص */
const isOrgAuthor = (name?: string | null) => !name || /کاربان/.test(name);

const faDate = (v?: string | null) =>
  v ? new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(v)) : null;

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
        {CATEGORY_INTRO[category] && <p className="category-intro">{CATEGORY_INTRO[category]}</p>}
        {loading ? (
          <KarbanLoader label="در حال دریافت مقاله‌ها…" />
        ) : (
          <div className="article-list">
            {items.map((a) => (
              <a className="article-list-item" href={articleSlugPath(a.title, a.id)} key={a.id}>
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

  /* id از انتهای segment (الگوی «عنوان-42» یا «42» قدیمی) */
  const id = articleIdFromSegment(articleId);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let active = true;
    /* زنجیره fallback: اگر ستون updated_at هنوز اضافه نشده باشد، بدون آن بخوان
       (وگرنه 400 کل صفحه مقاله را می‌شکند) */
    (async () => {
      let data: unknown = null;
      let error: { message: string } | null = null;
      for (const select of ['id,category,title,intro,body,author,meta_title,meta_description,created_at,updated_at', 'id,category,title,intro,body,author,meta_title,meta_description,created_at']) {
        const res = await supabase.from('articles').select(select).eq('id', id).maybeSingle();
        if (!res.error) { data = res.data; error = null; break; }
        error = res.error as unknown as { message: string };
        if (!/updated_at|column/i.test(res.error.message || '')) break; /* خطای غیر از ستون → ادامه نده */
      }
      if (!active) return;
          const a = (data as Article | null) || null;
          setArticle(a);
          if (a) {
            const catIndex = KNOWLEDGE_CATEGORIES.indexOf(a.category) + 1;
            const catSlug = categorySlug(a.category);
            /* URL استاندارد = اسلاگ؛ اگر با URL عددی قدیمی آمده بود، آدرس و canonical به اسلاگ می‌رود */
            const canonicalPath = articleSlugPath(a.title, a.id);
            const u = (p: string) => `https://karbanapp.ir${encodeURI(p)}`;
            const modified = a.updated_at || a.created_at || null;
            applySEO({
              title: a.meta_title || `${a.title} | کاربان`,
              description: a.meta_description || a.intro,
              path: canonicalPath,
              image: '/images/og-knowledge.png',
              ogType: 'article',
              jsonLd: [
                {
                  '@context': 'https://schema.org',
                  '@type': 'Article',
                  headline: a.title,
                  description: a.meta_description || a.intro,
                  image: ['https://karbanapp.ir/images/og-knowledge.png'],
                  author: isOrgAuthor(a.author)
                    ? { '@type': 'Organization', name: 'کاربان', '@id': 'https://karbanapp.ir/#organization' }
                    : { '@type': 'Person', name: a.author },
                  publisher: { '@id': 'https://karbanapp.ir/#organization' },
                  mainEntityOfPage: u(canonicalPath),
                  inLanguage: 'fa-IR',
                  ...(a.created_at ? { datePublished: a.created_at } : {}),
                  ...(modified ? { dateModified: modified } : {}),
                },
                {
                  '@context': 'https://schema.org',
                  '@type': 'BreadcrumbList',
                  itemListElement: [
                    { '@type': 'ListItem', position: 1, name: 'خانه', item: u('/') },
                    { '@type': 'ListItem', position: 2, name: 'دانشنامه', item: u('/دانشنامه') },
                    ...(catIndex
                      ? [{ '@type': 'ListItem', position: 3, name: a.category, item: u(`/دانشنامه/${catSlug}`) }]
                      : []),
                    { '@type': 'ListItem', position: catIndex ? 4 : 3, name: a.title, item: u(canonicalPath) },
                  ],
                },
              ],
            });
            /* آدرس نوار مرورگر هم به URL اسلاگ استاندارد می‌رود (بدون رفرش) */
            if (window.location.pathname !== canonicalPath) {
              try { window.history.replaceState({}, '', canonicalPath); } catch { /* noop */ }
            }
          } else if (!error) {
            /* مقاله وجود ندارد: از ایندکس خارج شود (با ۴۰۴ واقعی سرور هم پوشش دارد) */
            applySEO({
              title: 'مقاله پیدا نشد | کاربان',
              description: 'صفحه‌ای که دنبال آن بودید وجود ندارد.',
              path: window.location.pathname,
              noindex: true,
            });
          }
          setLoading(false);
      })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId]);

  if (loading) {
    return (
      <section className="inner-page">
        <div className="container narrow-content">
          <KarbanLoader label="در حال بازکردن مقاله…" />
        </div>
      </section>
    );
  }

  if (!article) {
    return (
      <section className="inner-page">
        <div className="container narrow-content">
          <h1>مقاله پیدا نشد</h1>
          <p className="lead">مقاله‌ای که دنبال آن بودید حذف شده یا آدرس اشتباه است.</p>
          <a className="button" href="/دانشنامه">بازگشت به دانشنامه</a>
        </div>
      </section>
    );
  }

  const modified = article.updated_at || article.created_at || null;

  const links = articleRelatedMap[article.category] || [
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
        <div className="article-meta">
          <small className="article-author">{article.author || 'تیم کاربان'}</small>
          {modified && <small className="article-updated">آخرین به‌روزرسانی: {faDate(modified)}</small>}
          <small className="article-source">منبع: مواد قانونی ذکرشده در متن (قانون کار، تأمین اجتماعی، مالیات‌های مستقیم)</small>
        </div>
        <div className="article-body">
          {renderRichText(article.body)}
        </div>

        {links.length > 0 && (
          <div className="related-box">
            <FileText size={18} />
            <div>
              <strong>ابزارها و صفحات مرتبط</strong>
              <div className="related-links">
                {links.map((l) => (
                  <a key={l.href} href={l.href}>
                    {l.label} <ArrowLeft size={14} />
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        <a className="button" href="/دانشنامه">بازگشت به دانشنامه</a>
      </div>
    </section>
  );
}
