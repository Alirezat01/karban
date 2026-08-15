import { useMemo, useState } from 'react';
import { ArrowLeft, HeartPulse, ShieldCheck } from 'lucide-react';
import { healthQuestions, legalNotes } from '@/data/config';

type Answer = boolean | null;

const areas = ['قراردادها', 'حقوق و بیمه', 'مالی و مالیات', 'عملیات'] as const;

const areaAdvice: Record<string, string> = {
  'قراردادها': 'قراردادهای نانوشته بزرگ‌ترین منبع اختلاف‌اند؛ از بانک قراردادهای کاربان، نسخه مکتوب هر توافق را همین هفته ببندید.',
  'حقوق و بیمه': 'جریمه‌های بیمه و اداره کار از هر هزینه‌ای سنگین‌تر است؛ بیمه همه کارکنان و پرداخت به‌موقع را در اولویت بگذارید.',
  'مالی و مالیات': 'جریمه‌های مالیاتی معمولاً قابل بخشش نیستند؛ ثبت منظم درآمد/هزینه و اظهارنامه به‌موقع، ریسک را نزدیک صفر می‌کند.',
  'عملیات': 'وابستگی به یک نفر یعنی ریسک توقف کسب‌وکار؛ وظایف را مستند و جانشین‌پروری کنید.',
};

export default function BusinessHealthPage() {
  const [answers, setAnswers] = useState<Answer[]>(() => healthQuestions.map(() => null));
  const [showResult, setShowResult] = useState(false);
  const [warn, setWarn] = useState(false);

  const answeredCount = answers.filter((a) => a !== null).length;
  const allAnswered = answeredCount === healthQuestions.length;

  const result = useMemo(() => {
    if (!allAnswered) return null;
    const byArea = areas.map((area) => {
      const idx = healthQuestions.map((q, i) => ({ q, i })).filter((x) => x.q.area === area).map((x) => x.i);
      const yes = idx.filter((i) => answers[i] === true).length;
      const score = Math.round((yes / idx.length) * 100);
      return { area, score, yes, total: idx.length };
    });
    const overall = Math.round(byArea.reduce((s, b) => s + b.score, 0) / byArea.length);
    const level = overall >= 80 ? 'سالم' : overall >= 50 ? 'نیازمند اصلاح' : 'بحرانی';
    const weak = byArea.filter((b) => b.score < 70);
    return { byArea, overall, level, weak };
  }, [answers, allAnswered]);

  const setAnswer = (i: number, value: boolean) => {
    setAnswers((prev) => prev.map((a, idx) => (idx === i ? value : a)));
  };

  const levelColor = result?.level === 'سالم' ? '#1f7a4d' : result?.level === 'نیازمند اصلاح' ? '#b9770e' : '#b3261e';

  return (
    <section className="inner-page">
      <div className="container narrow-content">
        <span className="eyebrow">ابزار هوشمند · خودارزیابی</span>
        <h1>تست سلامت کسب‌وکار</h1>
        <p className="lead">با ۱۶ پاسخ بله/خیر، تصویر فوری از سلامت حقوقی و مالی کسب‌وکار خود بگیرید. صادقانه جواب بدهید و در پایان دکمه «نمایش نتیجه» را بزنید.</p>

        {!showResult && (
          <>
            <div className="health-grid">
              {healthQuestions.map((q, i) => (
                <div className="health-q" key={i}>
                  <span className="health-area">{q.area}</span>
                  <p>{q.q}</p>
                  <div className="health-btns">
                    <button type="button" className={answers[i] === true ? 'yes on' : 'yes'} onClick={() => setAnswer(i, true)}>بله</button>
                    <button type="button" className={answers[i] === false ? 'no on' : 'no'} onClick={() => setAnswer(i, false)}>خیر</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="health-actions">
              <p className="muted-note">{answeredCount} از {healthQuestions.length} سؤال پاسخ داده شد</p>
              <button
                type="button"
                className="button"
                onClick={() => {
                  if (!allAnswered) {
                    setWarn(true);
                    return;
                  }
                  setShowResult(true);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                نمایش نتیجه <ArrowLeft size={16} />
              </button>
              {warn && !allAnswered && <small className="news-err">ابتدا به همه سؤال‌ها پاسخ بله یا خیر بدهید.</small>}
            </div>
          </>
        )}

        {showResult && result && (
          <div className="health-result">
            <div className="health-gauge" style={{ background: `conic-gradient(${levelColor} ${result.overall * 3.6}deg, #e8e8e8 0deg)` }}>
              <div className="health-gauge-inner">
                <strong>{result.overall}٪</strong>
                <span>{result.level}</span>
              </div>
            </div>

            <h2><HeartPulse size={20} /> کارنامه سلامت کسب‌وکار شما</h2>

            <div className="health-bars">
              {result.byArea.map((b) => (
                <div className="health-bar-row" key={b.area}>
                  <span>{b.area}</span>
                  <div className="health-bar">
                    <div className="health-bar-fill" style={{ width: `${b.score}%`, background: b.score >= 80 ? '#1f7a4d' : b.score >= 50 ? '#b9770e' : '#b3261e' }} />
                  </div>
                  <strong>{b.score}٪</strong>
                </div>
              ))}
            </div>

            {result.weak.length > 0 ? (
              <div className="legal-box">
                <h2>چرا این وضعیت؟ و چه باید کرد؟</h2>
                <ul>
                  {result.weak.map((w) => (
                    <li key={w.area}>
                      <strong>{w.area} ({w.score}٪):</strong> {areaAdvice[w.area]}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="feedback-success">
                <ShieldCheck size={24} /> کسب‌وکار شما از نظر حقوقی و مالی در وضعیت سالمی است؛ همین مسیر را ادامه دهید و سالانه بازبینی کنید.
              </div>
            )}

            <div className="health-cta">
              <a className="button" href="/قراردادها">بستن قراردادهای محکم <ArrowLeft size={16} /></a>
              <a className="button button-outline" href="/خدمات">مشاوره تخصصی <ArrowLeft size={16} /></a>
              <button
                type="button"
                className="button button-outline"
                onClick={() => {
                  setAnswers(healthQuestions.map(() => null));
                  setShowResult(false);
                  setWarn(false);
                }}
              >
                پاسخ دوباره
              </button>
            </div>
          </div>
        )}

        <div className="legal-box">
          <h2><ShieldCheck size={18} /> مبنای سؤالات</h2>
          <ul>
            {(legalNotes['تست-سلامت'] || []).map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
