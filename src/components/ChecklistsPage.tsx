import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, ClipboardCheck } from 'lucide-react';
import { checklistCatalog } from '@/data/config';

const storageKey = (slug: string) => `karban-checklist:${slug}`;

function loadProgress(slug: string): boolean[] {
  try {
    const raw = localStorage.getItem(storageKey(slug));
    return raw ? (JSON.parse(raw) as boolean[]) : [];
  } catch {
    return [];
  }
}

export function ChecklistsListPage() {
  return (
    <section className="inner-page">
      <div className="container">
        <div className="narrow-content">
          <span className="eyebrow"><ClipboardCheck size={14} /> راهنماهای اجرایی کاربان</span>
          <h1>چک‌لیست‌های طلایی مدیریت کسب‌وکار</h1>
          <p className="lead">
            پنج مسیر گام‌به‌گام برای لحظه‌های حساس مدیریت: استخدام، اخراج، تنظیم قرارداد، تسویه و مالیات؛
            هر گام را تیک بزن، پیشرفتت ذخیره می‌شود و دفعه بعد از همان‌جا ادامه می‌دهی.
          </p>
        </div>

        <div className="check-grid">
          {checklistCatalog.map((c) => (
            <article className="check-card" key={c.slug}>
              <div className="check-card-head">
                <ClipboardCheck aria-hidden />
                <h2>{c.title}</h2>
              </div>
              <p>{c.description}</p>
              <div className="check-card-meta">
                <small>
                  <ClipboardCheck size={13} aria-hidden />
                  {c.items.length.toLocaleString('fa-IR')} گام اجرایی
                </small>
                <a className="text-link" href={`/چک-لیست‌ها/${c.slug}`}>
                  شروع <ArrowLeft size={14} />
                </a>
              </div>
            </article>
          ))}
        </div>

        <div className="related-box" style={{ marginTop: '2rem' }}>
          <ClipboardCheck />
          <div>
            <strong>ابزارهای مرتبط کاربان</strong>
            <div className="related-links">
              <a href="/قراردادها">بانک قراردادها <ArrowLeft size={14} /></a>
              <a href="/ابزارهای-هوش-مصنوعی">ماشین‌حساب‌ها <ArrowLeft size={14} /></a>
              <a href="/کتابخانه-قوانین">کتابخانه قوانین <ArrowLeft size={14} /></a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ChecklistViewPage({ slug }: { slug: string }) {
  const checklist = checklistCatalog.find((c) => c.slug === slug);
  const [done, setDone] = useState<boolean[]>([]);

  useEffect(() => {
    if (!checklist) return;
    const saved = loadProgress(checklist.slug);
    setDone(Array.from({ length: checklist.items.length }, (_, i) => saved[i] === true));
  }, [checklist]);

  const items = checklist?.items as readonly string[] | undefined;

  const progress = useMemo(() => {
    if (!items || items.length === 0) return 0;
    return Math.round((done.filter(Boolean).length / items.length) * 100);
  }, [done, items]);

  const toggle = (index: number) => {
    if (!checklist) return;
    setDone((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      try {
        localStorage.setItem(storageKey(checklist.slug), JSON.stringify(next));
      } catch { /* private mode */ }
      return next;
    });
  };

  if (!checklist || !items) {
    return (
      <section className="inner-page">
        <div className="container narrow-content">
          <h1>چک‌لیست پیدا نشد</h1>
          <a className="button" href="/چک-لیست‌ها">بازگشت به فهرست</a>
        </div>
      </section>
    );
  }

  return (
    <section className="inner-page">
      <div className="container narrow-content">
        <span className="eyebrow"><ClipboardCheck size={14} /> چک‌لیست طلایی کاربان</span>
        <h1>{checklist.title}</h1>
        <p className="lead">{checklist.description}</p>

        <div className="checklist-progress" role="status">
          <div className="checklist-progress-bar">
            <span style={{ width: `${progress}%` }} />
          </div>
          <strong>{progress.toLocaleString('fa-IR')}٪ انجام شده</strong>
        </div>

        <div className="contact-card calc-card checklist-box">
          {items.map((item, i) => (
            <label key={i} className={`checklist-item ${done[i] ? 'is-done' : ''}`}>
              <input type="checkbox" checked={!!done[i]} onChange={() => toggle(i)} />
              <CheckCircle2 size={17} className="checklist-tick" aria-hidden />
              <span>{item}</span>
            </label>
          ))}
          <button className="button button-outline" onClick={() => window.print()}>
            چاپ / PDF این چک‌لیست
          </button>
          <p className="muted-note">تیک‌ها روی همین مرورگر ذخیره می‌شوند؛ برای استفاده تیمی، نسخه PDF را چاپ و پخش کنید.</p>
        </div>

        <div className="related-box">
          <ClipboardCheck />
          <div>
            <strong>چک‌لیست‌های طلایی دیگر</strong>
            <div className="related-links">
              {checklistCatalog.filter((c) => c.slug !== slug).map((c) => (
                <a key={c.slug} href={`/چک-لیست‌ها/${c.slug}`}>{c.title} <ArrowLeft size={14} /></a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
