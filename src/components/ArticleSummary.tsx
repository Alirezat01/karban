/* ────────────────────────────────────────────────────────────
   ArticleSummary — دکمه «خلاصه AI» روی مقالات دانشنامه.
   متن مقاله را به /api/ai-chat می‌فرستد و خلاصه ۳ نکته‌ای می‌گیرد.
   ──────────────────────────────────────────────────────────── */
import { useState } from 'react';
import { Loader2, Sparkles, Zap } from 'lucide-react';

type Props = { text: string; title: string };

export default function ArticleSummary({ text, title }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const fetchSummary = async () => {
    if (open && summary) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (summary) return; /* کش */

    setBusy(true);
    setErr('');
    try {
      /* پرامپت اختصاصی برای خلاصه‌سازی */
      const prompt = `این مقاله حقوقی را در ۳ نکته کلیدی خلاصه کن. هر نکته یک خط باشد.

عنوان: ${title}
متن مقاله:
${text.slice(0, 4000)}

خروجی را به این فرمت بده:
نکته ۱: ...
نکته ۲: ...
نکته ۳: ...

فقط همین، بدون مقدمه.`;
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: prompt }),
      });
      const j = await res.json();
      if (!j.ok) {
        setErr(j.error || 'خطا در تولید خلاصه');
        return;
      }
      setSummary(j.answer);
    } catch (e) {
      setErr('خطای شبکه: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="article-summary">
      <button className="button button-small" onClick={fetchSummary} disabled={busy}>
        {busy ? <><Loader2 size={14} className="spin" /> در حال خلاصه‌سازی…</> : <><Sparkles size={14} /> خلاصه AI</>}
      </button>

      {open && (
        <div className="article-summary-box">
          {err ? (
            <p className="admin-error">{err}</p>
          ) : busy ? (
            <p className="muted-note">در حال پردازش با هوش مصنوعی…</p>
          ) : summary ? (
            <div>
              <h4><Zap size={14} /> ۳ نکته کلیدی</h4>
              <pre className="summary-text">{summary}</pre>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
