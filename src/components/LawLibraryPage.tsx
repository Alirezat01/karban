import { useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, Scale, Search } from 'lucide-react';
import { LAWS, LAW_CATEGORIES, lawCategoryBySlug, lawSlug, searchLaws } from '@/data/laws';

const CATEGORY_INTRO: Record<string, string> = {
  'همه': 'گزیده مواد پرکاربرد قانون کار، تأمین اجتماعی، مالیات‌های مستقیم و آیین‌نامه‌های اجرایی — با زبان ساده و برچسب‌های کاربردی.',
  'قانون کار': 'روابط کارفرما و کارمند: از انعقاد قرارداد و حقوق و مزایا تا مرخصی، اخراج، سنوات و حل اختلاف (قانون کار ۱۳۶۹).',
  'تأمین اجتماعی': 'بیمه، بازنشستگی، بیمه بیکاری و غرامت‌ها؛ نرخ‌ها و شرایطی که هر کارفرما و کارگر باید بداند.',
  'مالیات‌های مستقیم': 'مالیات حقوق، مشاغل و معافیت‌ها؛ پلکانی‌ها و مهلت‌هایی که جریمه‌سازند.',
  'آیین‌نامه‌ها': 'بخشنامه‌ها و آیین‌نامه‌های اجرایی: بن و مسکن، عیدی، حق بیمه، ساعت کار و ایمنی.',
};

export function LawLibraryPage({ category }: { category?: string }) {
  const activeCategory = (category && lawCategoryBySlug(category)) || 'همه';
  const [query, setQuery] = useState('');

  const results = useMemo(() => searchLaws(query, activeCategory), [query, activeCategory]);

  return (
    <section className="inner-page">
      <div className="container article-shell">
        <span className="eyebrow"><Scale size={14} /> کتابخانه قوانین کاربان</span>
        <h1>کتابخانه قوانین — به زبان ساده</h1>
        <p className="lead">{CATEGORY_INTRO[activeCategory]}</p>

        <div className="law-search">
          <Search size={18} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جست‌وجو بین مواد: مثلاً «سنوات»، «عیدی»، «بیمه بیکاری» یا «ماده ۲۴»…"
            aria-label="جست‌وجوی سریع بین مواد قانونی"
          />
        </div>

        <nav className="law-tabs" aria-label="دسته‌بندی قوانین">
          {['همه', ...LAW_CATEGORIES].map((c) => (
            <a key={c} href={c === 'همه' ? '/کتابخانه-قوانین' : `/کتابخانه-قوانین/${lawSlug(c)}`} className={c === activeCategory ? 'active' : ''}>
              {c}
            </a>
          ))}
        </nav>

        <p className="muted-note" style={{ margin: '0 0 1rem' }}>
          {results.length.toLocaleString('fa-IR')} مورد یافت شد
        </p>

        <div className="law-list">
          {results.map((l) => (
            <article className="law-card" key={l.id}>
              <header>
                <span className="law-badge">{l.law}</span>
                <strong>{l.num} — {l.title}</strong>
              </header>
              <p>{l.text}</p>
              <footer>
                {l.tags.map((t) => (
                  <button key={t} className="law-tag" onClick={() => setQuery(t)}>#{t}</button>
                ))}
              </footer>
            </article>
          ))}
          {results.length === 0 && (
            <p className="muted-note">چیزی پیدا نشد؛ عبارت دیگری را امتحان کن یا دسته را عوض کن.</p>
          )}
        </div>

        <div className="related-box" style={{ marginTop: '2rem' }}>
          <BookOpen />
          <div>
            <strong>راهنماها و ابزارهای مرتبط</strong>
            <div className="related-links">
              <a href="/دانشنامه">دانشنامه حقوقی <ArrowLeft size={14} /></a>
              <a href="/ابزارهای-هوش-مصنوعی/محاسبه-حقوق">ماشین‌حساب حقوق <ArrowLeft size={14} /></a>
              <a href="/درخواست‌های-اداری">درخواست‌های اداری آماده <ArrowLeft size={14} /></a>
            </div>
          </div>
        </div>
        <p className="muted-note" style={{ marginTop: '1rem' }}>
          متن‌ها خلاصه کاربردی مواد قانونی است و جایگزین مشاوره حقوقی موردی نیست؛ در پرونده‌های حساس به متن رسمی قانون مراجعه کنید.
        </p>
      </div>
    </section>
  );
}
