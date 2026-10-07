/* ────────────────────────────────────────────────────────────
   LegalChatbot — RAG-based legal Q&A (Phase 3.2)
   با المان‌های بصری Gemini: انیمیشن glow، particles، typing
   ──────────────────────────────────────────────────────────── */
import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Bot, Crown, Loader2, Scale, Send, Sparkles, User, Zap } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type Msg = {
  role: 'user' | 'assistant';
  content: string;
  citations?: { law_id: string; article: string; text: string }[];
};

type Usage = {
  used: number;
  limit: number;
  remaining: number;
  plan: string;
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
  const { userId, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [usage, setUsage] = useState<Usage | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (authLoading) return;
    if (userId) {
      setMessages([{
        role: 'assistant',
        content: 'سلام! من دستیار حقوقی کاربان هستم. هر سؤال حقوقی، کاری یا مالیاتی داری بپرس — با استناد به قانون پاسخ می‌دم.',
      }]);
    } else {
      setMessages([]);
    }
  }, [userId, authLoading]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput('');
    setErr('');

    if (!userId) {
      setErr('برای استفاده از دستیار حقوقی، ابتدا وارد شوید');
      return;
    }

    /* گرفتن توکن از ساپابیس — اگه منقضی شده، تلاش به‌روزرسانی */
    const { data: sessionData } = await supabase.auth.getSession();
    let accessToken = sessionData.session?.access_token;

    /* اگه نشست نیست یا منقضی شده، تلاش refresh */
    if (!accessToken) {
      const { data: refreshData } = await supabase.auth.refreshSession();
      accessToken = refreshData.session?.access_token;
    }

    if (!accessToken) {
      setErr('نشست شما منقضی شده است. در حال انتقال به صفحه ورود…');
      setTimeout(() => { window.location.href = '/ورود?next=/دستیار-حقوقی'; }, 1500);
      return;
    }

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: 'user', content: q }]);
    setBusy(true);
    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ question: q, history }),
      });

      /* بررسی اینکه آیا پاسخ JSON هست یا نه — جلوی خطای Unexpected token را می‌گیرد */
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text().catch(() => '');
        console.error('Non-JSON response:', res.status, text.slice(0, 200));
        if (res.status === 502 || res.status === 500) {
          setErr('سرور هوش مصنوعی موقتاً در دسترس نیست. چند ثانیه بعد دوباره تلاش کنید.');
        } else if (res.status === 429) {
          setErr('درخواست‌های زیاد. یک دقیقه صبر کنید و دوباره تلاش کنید.');
        } else {
          setErr(`خطای سرور (${res.status}). دوباره تلاش کنید.`);
        }
        return;
      }

      const j = await res.json();

      if (res.status === 401 && j.needLogin) {
        setErr(j.error);
        setTimeout(() => { window.location.href = '/ورود?next=/دستیار-حقوقی'; }, 1500);
        return;
      }
      if (res.status === 429 && j.limitReached) {
        setUsage({ used: j.used, limit: j.limit, remaining: 0, plan: j.plan });
        setShowLimitModal(true);
        setErr(j.error);
        return;
      }
      if (!j.ok) {
        setErr(j.error || 'خطا');
        return;
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: j.answer, citations: j.citations }]);
      if (j.usage) setUsage(j.usage);
    } catch (e) {
      setErr('خطای شبکه: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) {
    return (
      <section className="inner-page">
        <div className="container narrow-content">
          <div className="ai-loading-screen">
            <div className="gemini-orb-loader" />
            <p>در حال آماده‌سازی دستیار حقوقی…</p>
          </div>
        </div>
      </section>
    );
  }

  if (!userId) {
    return (
      <section className="inner-page">
        <div className="container narrow-content">
          <div className="ai-login-gate">
            <div className="gemini-orb-large" />
            <span className="eyebrow"><Sparkles size={14} /> دستیار حقوقی کاربان</span>
            <h1>دستیار هوش مصنوعی حقوق کار</h1>
            <p className="lead">
              هر سؤال حقوقی، کاری یا مالیاتی داری بپرس. دستیار هوش مصنوعی کاربان با استناد به قانون کار، تأمین اجتماعی و مالیات پاسخ می‌دهد.
            </p>
            <div className="ai-login-features">
              <div className="ai-login-feature"><Scale size={20} /> استناد به مواد قانونی</div>
              <div className="ai-login-feature"><Zap size={20} /> پاسخ فوری و دقیق</div>
              <div className="ai-login-feature"><Crown size={20} /> ۵ سؤال رایگان در روز</div>
            </div>
            <a className="button ai-cta-button" href="/ورود?next=/دستیار-حقوقی">
              ورود برای شروع گفتگو
              <Send size={15} />
            </a>
            <p className="muted-note">کاربران رایگان: ۵ سؤال در روز · کاربران پلن پیشرفته: ۲۰ سؤال</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="inner-page">
      <div className="container narrow-content">
        <div className="ai-chat-header">
          <div className="ai-chat-orb-wrap">
            <div className="gemini-orb-chat" />
          </div>
          <div className="ai-chat-header-text">
            <span className="eyebrow"><Sparkles size={14} /> ابزار هوش مصنوعی · دستیار حقوقی</span>
            <h1>دستیار حقوقی کاربان</h1>
            {usage && (
              <div className="ai-usage-badge">
                <Zap size={13} />
                {usage.limit === -1
                  ? `نامحدود (پلن بنیان‌گذار)`
                  : `${usage.remaining.toLocaleString('fa-IR')} سؤال باقی‌مانده از ${usage.limit.toLocaleString('fa-IR')}`}
              </div>
            )}
          </div>
        </div>

        <div className="chatbot-page">
          <div className="chat-window ai-glow-window">
            <div className="chat-messages" ref={scrollRef}>
              {messages.map((m, i) => (
                <div key={i} className={`chat-msg is-${m.role === 'user' ? 'user' : 'bot'} ai-msg-glow`}>
                  {m.role === 'user'
                    ? <User size={14} className="msg-icon" />
                    : <Bot size={14} className="msg-icon" />}
                  <div className="msg-content">
                    {m.content}
                    {m.citations && m.citations.length > 0 && (
                      <div className="citations">
                        <strong>📚 استناد به:</strong>{' '}
                        {m.citations.map((c, j) => (
                          <span key={j}>{j > 0 ? ' · ' : ''}{c.law_id} {c.article}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="chat-msg is-bot">
                  <div className="ai-typing-indicator">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              )}
            </div>

            {messages.length <= 1 && (
              <div className="chat-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="chat-suggestion ai-suggestion-glow" onClick={() => send(s)} disabled={busy}>{s}</button>
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
              <button className="button ai-send-button" onClick={() => send(input)} disabled={busy || !input.trim()}>
                {busy ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
              </button>
            </div>
            {err && (
              <div className="chat-error-banner">
                <AlertCircle size={14} /> {err}
                {err.includes('ارتقا') && (
                  <a className="text-link" href="/حسابداری" style={{ marginInlineStart: '.5rem' }}>ارتقا به پلن پیشرفته</a>
                )}
              </div>
            )}
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
