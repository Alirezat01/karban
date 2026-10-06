/* ────────────────────────────────────────────────────────────
   LegalChatbot — RAG-based legal Q&A (Phase 3.2)
   Asks questions, gets answers with legal citations.
   ──────────────────────────────────────────────────────────── */
import { useEffect, useRef, useState } from 'react';
import { Bot, Loader2, Scale, Send, User } from 'lucide-react';

type Msg = {
  role: 'user' | 'assistant';
  content: string;
  citations?: { law_id: string; article: string; text: string }[];
};

const SUGGESTIONS = [
  'بیمه کارگر چند درصد است؟',
  'حق سنوات چطور محاسبه می‌شود؟',
  'دوره آزمایشی قانون کار چقدر است؟',
  'مالیات مشاغل چند درصد است؟',
  'چطور قرارداد فسخ کنم؟',
  'اضافه‌کاری نرمال چقدر است؟',
];

export default function LegalChatbot() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    /* پیام خوش‌آمد */
    setMessages([{
      role: 'assistant',
      content: 'سلام! من دستیار حقوقی کاربان هستم. هر سؤالی درباره قانون کار، بیمه، مالیات یا قراردادها داری بپرس — با استناد به قانون پاسخ می‌دم.',
    }]);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput('');
    setErr('');
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: 'user', content: q }]);
    setBusy(true);
    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, history }),
      });
      const j = await res.json();
      if (!j.ok) { setErr(j.error || 'خطا'); return; }
      setMessages((prev) => [...prev, { role: 'assistant', content: j.answer, citations: j.citations }]);
    } catch (e) {
      setErr('خطای شبکه: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="inner-page">
      <div className="container narrow-content">
        <span className="eyebrow"><Scale size={14} /> ابزار هوش مصنوعی · دستیار حقوقی</span>
        <h1>دستیار حقوقی کاربان</h1>
        <p className="lead">
          هر سؤال حقوقی، کاری یا مالیاتی داری بپرس. دستیار هوش مصنوعی کاربان با استناد به قانون کار، تأمین اجتماعی و مالیات پاسخ می‌دهد.
        </p>

        <div className="chatbot-page">
          <div className="chat-window">
            <div className="chat-messages" ref={scrollRef}>
              {messages.map((m, i) => (
                <div key={i} className={`chat-msg is-${m.role === 'user' ? 'user' : 'bot'}`}>
                  {m.role === 'user' ? <User size={14} style={{ display: 'inline', marginInlineEnd: '.3rem' }} /> : <Bot size={14} style={{ display: 'inline', marginInlineEnd: '.3rem' }} />}
                  {m.content}
                  {m.citations && m.citations.length > 0 && (
                    <div className="citations">
                      <strong>استناد به:</strong>{' '}
                      {m.citations.map((c, j) => (
                        <span key={j}>{j > 0 ? ' · ' : ''}{c.law_id} {c.article}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {busy && (
                <div className="chat-msg is-bot">
                  <Loader2 size={14} className="spin" style={{ display: 'inline', marginInlineEnd: '.3rem' }} /> در حال تفکر…
                </div>
              )}
            </div>

            {messages.length <= 1 && (
              <div className="chat-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="chat-suggestion" onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            )}

            <div className="chat-input-row">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
                placeholder="سؤالت را بنویس…"
                rows={1}
                disabled={busy}
              />
              <button className="button" onClick={() => send(input)} disabled={busy || !input.trim()}>
                {busy ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
              </button>
            </div>
            {err && <small className="admin-error" style={{ padding: '0 1.2rem .5rem', display: 'block' }}>{err}</small>}
          </div>
        </div>

        <div className="legal-box" style={{ marginTop: '1rem' }}>
          <h2>نکته</h2>
          <p>پاسخ‌های دستیار حقوقی جنبه عمومی دارد و جایگزین مشاوره تخصصی نیست. برای پرونده‌های خاص از خدمات مشاوره کاربان استفاده کنید.</p>
        </div>
      </div>
    </section>
  );
}
