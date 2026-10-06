/* ────────────────────────────────────────────────────────────
   ContractAnalyzerPage — AI contract risk analysis (Phase 3.1)
   Upload PDF/DOCX/TXT → extract text → call /api/ai-analyze
   → display clause-by-clause risk with color highlighting.
   ──────────────────────────────────────────────────────────── */
import { useEffect, useState } from 'react';
import { AlertTriangle, FileSearch, Loader2, ShieldAlert, ShieldCheck, UploadCloud } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import KarbanLoader from '@/components/KarbanLoader';

type Clause = {
  index: number;
  title: string;
  text: string;
  risk: 'low' | 'medium' | 'high';
  reason: string;
  suggestion?: string;
};

type Analysis = {
  summary: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  clauses: Clause[];
};

const RISK_LABEL: Record<string, string> = {
  low: 'ایمن', medium: 'متوسط', high: 'پرخطر', critical: 'بحرانی',
};
const RISK_COLOR: Record<string, string> = {
  low: 'risk-low', medium: 'risk-medium', high: 'risk-high', critical: 'risk-critical',
};

/* استخراج متن از PDF با pdfjs-dist (client-side) */
async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.txt')) return await file.text();
  if (name.endsWith('.pdf')) {
    const pdfjs = await import('pdfjs-dist' as any);
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs`;
    const buf = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buf }).promise;
    let out = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      out += content.items.map((it: any) => it.str).join(' ') + '\n\n';
    }
    return out;
  }
  if (name.endsWith('.docx')) {
    const JSZip = (await import('jszip' as any)).default;
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const xml = await zip.file('word/document.xml')?.async('string');
    if (!xml) return '';
    return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  throw new Error('فرمت فایل پشتیبانی نمی‌شود: PDF, DOCX, TXT');
}

export default function ContractAnalyzerPage() {
  const { userId, loading: authLoading } = useAuth();
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Analysis | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    /* اگر متن از روی متن قراردادِ موجود آمده باشد */
    const restore = localStorage.getItem('karban-analyze-text');
    if (restore) {
      setText(restore);
      localStorage.removeItem('karban-analyze-text');
    }
  }, []);

  const handleFile = async (file: File) => {
    setBusy(true);
    setErr('');
    try {
      const t = await extractText(file);
      setText(t);
      setTitle(file.name.replace(/\.[^.]+$/, ''));
    } catch (e) {
      setErr('استخراج متن ناموفق: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const analyze = async () => {
    if (text.trim().length < 50) {
      setErr('متن قرارداد کافی نیست (حداقل ۵۰ کاراکتر)');
      return;
    }
    setBusy(true);
    setErr('');
    setResult(null);
    try {
      const res = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, title }),
      });
      const j = await res.json();
      if (!j.ok) { setErr(j.error || 'تحلیل ناموفق بود'); return; }
      setResult({ summary: j.summary, risk_level: j.risk_level, clauses: j.clauses });
      /* ذخیره تحلیل برای کاربر واردشده */
      if (userId) {
        await supabase.from('ai_analyses').insert({
          user_id: userId,
          contract_text: text.slice(0, 30000),
          contract_title: title || null,
          summary: j.summary,
          risk_level: j.risk_level,
          clauses: j.clauses,
          model: j.model,
        });
      }
    } catch (e) {
      setErr('خطای شبکه: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) return <KarbanLoader label="در حال بررسی نشست…" />;

  return (
    <section className="inner-page">
      <div className="container narrow-content">
        <span className="eyebrow"><FileSearch size={14} /> ابزار هوش مصنوعی · تحلیل قرارداد</span>
        <h1>تحلیل هوشمند قرارداد با AI</h1>
        <p className="lead">
          قراردادت را آپلود کن یا متنش را پیست کن. هوش مصنوعی کاربان بندها را یکی‌یکی بررسی می‌کند، ریسک‌ها را علامت‌گذاری می‌کند و پیشنهاد بهبود می‌دهد — همه با استناد به قانون کار و قانون مدنی ایران.
        </p>

        <div className="contact-card calc-card">
          <label>آپلود فایل قرارداد (PDF, DOCX, TXT)
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              disabled={busy}
              style={{ color: 'var(--muted)', fontSize: '.9rem' }}
            />
          </label>
          <small className="muted-note">یا متن را مستقیم در کادر زیر پیست کن. حداکثر ۳۰٬۰۰۰ کاراکتر.</small>
          <label>عنوان قرارداد (اختیاری)
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً: قرارداد کار آقای …" />
          </label>
          <label>متن قرارداد
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder="متن کامل قرارداد را اینجا بگذار…"
              style={{ fontFamily: 'inherit', fontSize: '.9rem', lineHeight: 1.7 }}
            />
          </label>
          <small className="muted-note">{text.length.toLocaleString('fa-IR')} کاراکتر</small>
          <button className="button" onClick={analyze} disabled={busy || text.trim().length < 50}>
            {busy ? <><Loader2 size={15} className="spin" /> در حال تحلیل…</> : <><FileSearch size={15} /> تحلیل با هوش مصنوعی</>}
          </button>
          {err && <small className="admin-error" style={{ display: 'block', marginTop: '.5rem' }}>{err}</small>}
        </div>

        {result && (
          <div className="analysis-result">
            <div className={`risk-banner ${RISK_COLOR[result.risk_level]}`}>
              <ShieldAlert size={22} />
              <div>
                <strong>سطح ریسک کلی: {RISK_LABEL[result.risk_level]}</strong>
                <p>{result.summary}</p>
              </div>
            </div>

            <h2>تحلیل بندها ({result.clauses.length.toLocaleString('fa-IR')} بند)</h2>
            <div className="clauses-list">
              {result.clauses.map((c) => (
                <article key={c.index} className={`clause-card ${RISK_COLOR[c.risk]}`}>
                  <header>
                    <span className="clause-num">{(c.index + 1).toLocaleString('fa-IR')}</span>
                    <strong className="clause-title">{c.title}</strong>
                    <span className={`clause-risk-badge ${RISK_COLOR[c.risk]}`}>{RISK_LABEL[c.risk]}</span>
                  </header>
                  <p className="clause-text">{c.text}</p>
                  <div className="clause-reason">
                    <AlertTriangle size={13} /> {c.reason}
                  </div>
                  {c.suggestion && (
                    <div className="clause-suggestion">
                      <ShieldCheck size={13} /> پیشنهاد: {c.suggestion}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        )}

        <div className="legal-box">
          <h2>نکته مهم</h2>
          <p>این تحلیل توسط هوش مصنوعی انجام می‌شود و جنبه مشاوره‌ای دارد، نه جایگزین مشاوره حقوقی تخصصی. برای تصمیم‌های حساس، از خدمات «بازبینی قرارداد» کاربان استفاده کنید.</p>
        </div>
      </div>
    </section>
  );
}
