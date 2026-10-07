/* ═════════════════════════════════════════════════════════════════════
   کاربان — دستیار حقوقی چت‌بات (نسخه نهایی — فوق بهینه)
   فقط ۱ درخواست احراز هویت + ۱ درخواست Gemini = زیر ۶ ثانیه
   ═════════════════════════════════════════════════════════════════════ */

const SUPA_URL = 'https://rocjeanizzhfvhnuhnms.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvY2plYW5penpoZnZobnVobm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NDQwMDcsImV4cCI6MjEwMjAyMDAwN30.Br3brGTpjWnI7ilghPka_DyYUQU7e9eYIPv88Ehqy6g';
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_FALLBACK = 'gemini-flash-latest';
const FREE_LIMIT = 5;

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

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }], role: 'user' }],
    generationConfig: { temperature: 0.5, maxOutputTokens: 500 },
    systemInstruction: { parts: [{ text: 'تو دستیار حقوقی کاربان هستی. پاسخ کوتاه و کاربردی به فارسی بده.' }] },
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);

  try {
    let url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    let res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: controller.signal });

    if (res.status === 404) {
      url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_FALLBACK}:generateContent?key=${apiKey}`;
      res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: controller.signal });
    }

    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`Gemini ${res.status}: ${t.slice(0, 200)}`);
    }

    const j = await res.json();
    const content = j.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!content) {
      if (j.promptFeedback?.blockReason) throw new Error(`مسدودشده: ${j.promptFeedback.blockReason}`);
      throw new Error('پاسخ خالی');
    }
    return content;
  } finally {
    clearTimeout(timeoutId);
  }
}

function incrementUsage(userId, authHeader, type) {
  const today = new Date().toISOString().slice(0, 10);
  const field = type === 'chat' ? 'chat_count' : 'analyze_count';
  fetch(`${SUPA_URL}/rest/v1/ai_usage?user_id=eq.${userId}&day=eq.${today}&select=id,${field}`, {
    headers: { apikey: SUPA_ANON, Authorization: authHeader },
  }).then(async (selRes) => {
    const existing = await selRes.json();
    if (existing[0]?.id) {
      await fetch(`${SUPA_URL}/rest/v1/ai_usage?id=eq.${existing[0].id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', apikey: SUPA_ANON, Authorization: authHeader, Prefer: 'return=minimal' },
        body: JSON.stringify({ [field]: (existing[0][field] || 0) + 1 }),
      });
    } else {
      await fetch(`${SUPA_URL}/rest/v1/ai_usage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPA_ANON, Authorization: authHeader, Prefer: 'return=minimal' },
        body: JSON.stringify({ user_id: userId, day: today, chat_count: type === 'chat' ? 1 : 0, analyze_count: type === 'analyze' ? 1 : 0 }),
      });
    }
  }).catch(() => {});
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ ok: false, error: 'برای استفاده از دستیار حقوقی، باید وارد شوید', needLogin: true });

  let userId = null;
  try {
    const userRes = await fetch(`${SUPA_URL}/auth/v1/user`, {
      headers: { apikey: SUPA_ANON, Authorization: authHeader },
    });
    if (userRes.ok) {
      const userData = await userRes.json();
      if (userData.id) userId = userData.id;
    }
  } catch {}

  if (!userId) return res.status(401).json({ ok: false, error: 'نشست منقضی شده. دوباره وارد شوید', needLogin: true });

  const { question } = req.body || {};
  if (!question || typeof question !== 'string' || question.trim().length < 3) {
    return res.status(400).json({ ok: false, error: 'سؤال بسیار کوتاه است' });
  }

  try {
    const citations = searchLaws(question);
    const ctx = citations.length
      ? 'مواد قانونی مرتبط:\n' + citations.map((c) => `- ${c.law_id} ${c.article}: ${c.text}`).join('\n')
      : '';
    const prompt = `تو دستیار حقوقی کاربان هستی. به سؤال کاربر پاسخ بده.

 ${ctx}

سؤال: ${question}

پاسخ کوتاه و کاربردی به فارسی. اگه به ماده قانونی استناد می‌کنی، نام آن را ذکر کن.`;

    const answer = await callGemini(prompt);

    incrementUsage(userId, authHeader, 'chat');

    return res.json({ ok: true, answer, citations });
  } catch (e) {
    console.error('ai-chat failed', e.message);
    if (e.name === 'AbortError') return res.status(504).json({ ok: false, error: 'پاسخ‌گویی طول کشید. دوباره تلاش کنید.' });
    return res.status(502).json({ ok: false, error: 'پاسخ‌گویی ناموفق بود؛ دوباره تلاش کنید', detail: e.message });
  }
}

export const config = { maxDuration: 10 };
