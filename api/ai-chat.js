/* ═════════════════════════════════════════════════════════════════════
   کاربان — دستیار حقوقی چت‌بات (Phase 3.2)
   ─────────────────────────────────────────────────────────────────
   از Google Gemini API رایگان استفاده می‌کند.
   متغیر لازم: GEMINI_API_KEY

   محدودیت:
   - نیاز به لاگین
   - کاربر رایگان: ۵ سوال در روز
   - کاربر پولی (پرو): ۲۰ سوال در روز
   - بنیان‌گذار: نامحدود
   ═════════════════════════════════════════════════════════════════════ */

const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash-lite', 'gemini-1.5-flash-002'];

/* Supabase config — هاردکد شده (همان مقادیر src/lib/supabase.ts) */
const SUPA_URL = 'https://rocjeanizzhfvhnuhnms.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvY2plYW5penpoZnZobnVobm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NDQwMDcsImV4cCI6MjEwMjAyMDAwN30.Br3brGTpjWnI7ilghPka_DyYUQU7e9eYIPv88Ehqy6g';

const SUPA_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function getAuthUser(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const res = await fetch(`${SUPA_URL}/auth/v1/user`, {
      headers: { apikey: SUPA_ANON, Authorization: authHeader },
    });
    if (!res.ok) return null;
    const j = await res.json();
    return j.id ? { id: j.id, email: j.email } : null;
  } catch (e) {
    console.error('getAuthUser error:', e.message);
    return null;
  }
}

async function getUserPlan(userId) {
  try {
    if (SUPA_SERVICE) {
      const res = await fetch(`${SUPA_URL}/rest/v1/acc_access?user_id=eq.${userId}&status=eq.active&select=plan,expires_at`, {
        headers: { apikey: SUPA_SERVICE, Authorization: `Bearer ${SUPA_SERVICE}` },
      });
      const data = await res.json();
      if (!data || data.length === 0) return 'free';
      if (data.some((r) => r.plan === 'founder')) return 'founder';
      const active = data.find((r) => {
        if (!['monthly', 'yearly', 'founder'].includes(r.plan)) return false;
        if (!r.expires_at) return true;
        return new Date(r.expires_at).getTime() > Date.now();
      });
      return active ? (active.plan === 'founder' ? 'founder' : 'pro') : 'free';
    }
    return 'free';
  } catch {
    return 'free';
  }
}

function getPlanLimit(plan) {
  switch (plan) {
    case 'founder': return -1;
    case 'pro': return 20;
    default: return 5;
  }
}

async function checkAndIncrement(userId, authHeader, type) {
  const today = new Date().toISOString().slice(0, 10);
  const field = type === 'chat' ? 'chat_count' : 'analyze_count';

  const selRes = await fetch(`${SUPA_URL}/rest/v1/ai_usage?user_id=eq.${userId}&day=eq.${today}&select=id,${field}`, {
    headers: { apikey: SUPA_ANON, Authorization: authHeader },
  });
  const existing = await selRes.json();
  const currentCount = existing[0]?.[field] || 0;

  if (existing[0]?.id) {
    await fetch(`${SUPA_URL}/rest/v1/ai_usage?id=eq.${existing[0].id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', apikey: SUPA_ANON, Authorization: authHeader, Prefer: 'return=minimal' },
      body: JSON.stringify({ [field]: currentCount + 1 }),
    });
  } else {
    await fetch(`${SUPA_URL}/rest/v1/ai_usage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPA_ANON, Authorization: authHeader, Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: userId, day: today, chat_count: type === 'chat' ? 1 : 0, analyze_count: type === 'analyze' ? 1 : 0 }),
    });
  }
  return currentCount;
}

const LAWS = {
  'قانون کار': [
    { article: 'ماده ۷', text: 'قرارداد کار ممکن است برای کار غیرمحدود یا محدود منعقد شود.' },
    { article: 'ماده ۱۰', text: 'قرارداد کار باید کتبی منعقد شود.' },
    { article: 'ماده ۲۴', text: 'قرارداد کار ممکن است با رضایت طرفین فسخ شود.' },
    { article: 'ماده ۲۷', text: 'کارفرما حق ندارد بدون اسباب موجه قرارداد را فسخ کند.' },
    { article: 'ماده ۳۴', text: 'مزد کارگر باید قبل از عمل تعیین شود.' },
    { article: 'ماده ۴۱', text: 'حداقل مزد سالانه توسط شورای عالی کار تعیین می‌شود.' },
    { article: 'ماده ۵۱', text: 'بیمه تأمین اجتماعی از روز اول استخدام الزامی است.' },
    { article: 'ماده ۵۹', text: 'سنوات خدمت به ازای هر سال معادل یک ماه آخرین حقوق است.' },
  ],
  'تأمین اجتماعی': [
    { article: 'ماده ۳', text: 'بیمه تأمین اجتماعی شامل بازنشستگی، ازکارافتادگی و درمان است.' },
    { article: 'ماده ۳۸', text: 'حق بیمه سهم کارگر ۷٪ و سهم کارفرما ۲۳٪ مزد است.' },
    { article: 'ماده ۷۷', text: 'بازنشستگی پس از ۳۰ سال سابقه برای مردان ممکن است.' },
  ],
  'مالیات': [
    { article: 'ماده ۱۳۱', text: 'مالیات مشاغل پلکانی ۱۵ تا ۳۵ درصد است.' },
    { article: 'ماده ۸۴', text: 'مالیات بر ارزش افزوده ۱۰ درصد است.' },
    { article: 'ماده ۱۶۹', text: 'صاحبان مشاغل موظف به ارائه معاملات فصلی هستند.' },
  ],
};

function searchLaws(question) {
  const q = question.toLowerCase();
  const hits = [];
  for (const [lawName, articles] of Object.entries(LAWS)) {
    for (const a of articles) {
      const text = (lawName + ' ' + a.article + ' ' + a.text).toLowerCase();
      let score = 0;
      for (const word of q.split(/\s+/)) {
        if (word.length < 2) continue;
        if (text.includes(word)) score += 2;
        if (lawName.includes(word)) score += 5;
      }
      if (score > 0) hits.push({ law_id: lawName, article: a.article, text: a.text, score });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 4);
}

function buildPrompt(question, citations, history) {
  const ctx = citations.length
    ? 'مواد قانونی مرتبط:\n' + citations.map((c) => `- ${c.law_id} ${c.article}: ${c.text}`).join('\n')
    : '';
  const historyStr = (history || []).slice(-4).map((m) => `${m.role === 'user' ? 'کاربر' : 'دستیار'}: ${m.content}`).join('\n');
  return `تو دستیار حقوقی کاربان هستی. به سؤال کاربر پاسخ بده و به مواد قانونی استناد کن.

 ${ctx}

 ${historyStr ? 'گفت‌وگوی قبلی:\n' + historyStr : ''}

سؤال کاربر: ${question}

پاسخ را به فارسی، روشن و کاربردی بده. اگر به ماده قانونی استناد می‌کنی، نام آن را ذکر کن.
اگر سؤال خارج از حوزه حقوق، کار و مالیات است، مودبانه بگو که فقط در این حوزه‌ها پاسخ می‌دهی.
هرگز توصیه حقوقی قطعی نده — هم بنویس «برای پرونده خاص به مشاور مراجعه کنید».`;
}

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }], role: 'user' }],
    generationConfig: { temperature: 0.5, maxOutputTokens: 800 },
    systemInstruction: { parts: [{ text: 'تو دستیار حقوقی کاربان هستی. پاسخ‌های کوتاه و کاربردی به فارسی بده.' }] },
  });

  let lastError = '';
  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      if (res.ok) {
        const j = await res.json();
        const content = j.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (content) return content;
        lastError = `${model}: empty`;
      } else {
        const t = await res.text().catch(() => '');
        if (res.status === 404 || res.status === 400 || res.status === 403) {
          lastError = `${model}: ${res.status}`;
          continue;
        }
        throw new Error(`Gemini ${res.status}: ${t.slice(0, 200)}`);
      }
    } catch (e) {
      lastError = `${model}: ${e.message.slice(0, 80)}`;
      continue;
    }
  }
  throw new Error(`هیچ مدلی کار نکرد: ${lastError}`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  /* ─── احراز هویت ─── */
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ ok: false, error: 'برای استفاده از دستیار حقوقی، باید وارد حساب کاربری شوید', needLogin: true });
  const user = await getAuthUser(authHeader);
  if (!user) return res.status(401).json({ ok: false, error: 'نشست شما منقضی شده است. دوباره وارد شوید', needLogin: true });

  /* ─── بررسی محدودیت ─── */
  const plan = await getUserPlan(user.id);
  const limit = getPlanLimit(plan);

  const today = new Date().toISOString().slice(0, 10);
  const selRes = await fetch(`${SUPA_URL}/rest/v1/ai_usage?user_id=eq.${user.id}&day=eq.${today}&select=chat_count`, {
    headers: { apikey: SUPA_ANON, Authorization: authHeader },
  });
  const usage = await selRes.json();
  const used = usage[0]?.chat_count || 0;

  if (limit !== -1 && used >= limit) {
    const planLabel = plan === 'founder' ? 'بنیان‌گذار' : plan === 'pro' ? 'پیشرفته' : 'رایگان';
    return res.status(429).json({
      ok: false,
      error: `سقف روزانه سؤال (${limit.toLocaleString('fa-IR')} در روز برای پلن ${planLabel}) تکمیل شده است. فردا دوباره تلاش کنید یا به پلن بالاتر ارتقا دهید.`,
      limitReached: true, used, limit, plan,
    });
  }

  const { question, history } = req.body || {};
  if (!question || typeof question !== 'string' || question.trim().length < 3) {
    return res.status(400).json({ ok: false, error: 'سؤال بسیار کوتاه است' });
  }

  try {
    const citations = searchLaws(question);
    const prompt = buildPrompt(question, citations, history);
    const answer = await callGemini(prompt);
    await checkAndIncrement(user.id, authHeader, 'chat');
    return res.json({
      ok: true, answer, citations,
      usage: { used: used + 1, limit, remaining: limit === -1 ? -1 : Math.max(0, limit - used - 1), plan },
    });
  } catch (e) {
    console.error('ai-chat failed', e.message);
    return res.status(502).json({ ok: false, error: 'پاسخ‌گویی ناموفق بود؛ دوباره تلاش کنید', detail: e.message });
  }
}

export const config = { maxDuration: 30 };
