/* ═════════════════════════════════════════════════════════════════════
   کاربان — دستیار حقوقی چت‌بات
   FIX v2: مدل gemini-3.8-flash وجود ندارد → gemini-2.0-flash پایدار.
   ═════════════════════════════════════════════════════════════════════ */

const SUPA_URL = 'https://rocjeanizzhfvhnuhnms.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvY2plYW5penpoZnZobnVobm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NDQwMDcsImV4cCI6MjEwMjAyMDAwN30.Br3brGTpjWnI7ilghPka_DyYUQU7e9eYIPv88Ehqy6g';
/* استفاده از مدل پایدار gemini-2.0-flash (مدل gemini-3.8-flash وجود ندارد) */
const GEMINI_MODEL = 'gemini-2.0-flash';
const FREE_LIMIT = 5;
const MAX_DURATION = 20;
const RESPONSE_BUFFER_MS = 3000;

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

async function callGemini(prompt, requestStartMs) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }], role: 'user' }],
    generationConfig: { maxOutputTokens: 500 },
    systemInstruction: { parts: [{ text: 'تو دستیار حقوقی کاربان هستی. پاسخ کوتاه و کاربردی به فارسی بده.' }] },
  });

  const elapsed = Date.now() - requestStartMs;
  const remainingBudgetMs = (MAX_DURATION * 1000) - elapsed - RESPONSE_BUFFER_MS;
  const geminiTimeoutMs = Math.max(5000, Math.min(remainingBudgetMs, 15000));
  console.log('gemini: model=' + GEMINI_MODEL + ' timeout_ms=' + geminiTimeoutMs + ' elapsed=' + elapsed + 'ms');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), geminiTimeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body, signal: controller.signal,
    });
    const geminiMs = Date.now() - requestStartMs - elapsed;

    if (!res.ok) {
      const rawBody = await res.text().catch(() => '');
      console.error('gemini: provider error status=' + res.status + ' ms=' + geminiMs + ' body=' + rawBody.slice(0, 300));
      let errMsg;
      if (res.status === 401 || res.status === 403) errMsg = 'کلید API نامعتبر یا دسترسی ندارید';
      else if (res.status === 429) errMsg = 'محدودیت درخواست — کمی بعد تلاش کنید';
      else if (res.status === 400) errMsg = 'درخواست نامعتبر به Gemini';
      else if (res.status === 404) errMsg = `مدل ${GEMINI_MODEL} یافت نشد`;
      else if (res.status === 503) errMsg = 'سرویس Gemini موقتاً در دسترس نیست. دوباره تلاش کنید.';
      else errMsg = `خطای Gemini (${res.status})`;
      const err = new Error(errMsg); err.errorType = 'provider'; throw err;
    }

    const j = await res.json();
    const content = j.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!content) {
      console.error('gemini: empty response ms=' + geminiMs, JSON.stringify(j).slice(0, 300));
      if (j.promptFeedback?.blockReason) { const err = new Error(`مسدودشده: ${j.promptFeedback.blockReason}`); err.errorType = 'blocked'; throw err; }
      const err = new Error('پاسخ خالی از Gemini'); err.errorType = 'empty'; throw err;
    }
    console.log('gemini: success ms=' + geminiMs);
    return content;
  } catch (e) {
    if (e.name === 'AbortError') { const err = new Error('پاسخ‌گویی طول کشید. دوباره تلاش کنید.'); err.errorType = 'timeout'; throw err; }
    if (e.cause?.code === 'ECONNREFUSED' || e.cause?.code === 'ENOTFOUND' || e.cause?.code === 'ECONNRESET') { const err = new Error('خطای شبکه در اتصال به Gemini.'); err.errorType = 'network'; throw err; }
    if (!e.errorType) e.errorType = 'unknown';
    throw e;
  } finally { clearTimeout(timeoutId); }
}

function incrementUsage(userId, authHeader) {
  const today = new Date().toISOString().slice(0, 10);
  fetch(`${SUPA_URL}/rest/v1/ai_usage?user_id=eq.${userId}&day=eq.${today}&select=id,chat_count`, {
    headers: { apikey: SUPA_ANON, Authorization: authHeader },
  }).then(async (selRes) => {
    const existing = await selRes.json();
    if (existing[0]?.id) {
      await fetch(`${SUPA_URL}/rest/v1/ai_usage?id=eq.${existing[0].id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', apikey: SUPA_ANON, Authorization: authHeader, Prefer: 'return=minimal' },
        body: JSON.stringify({ chat_count: (existing[0].chat_count || 0) + 1 }),
      });
    } else {
      await fetch(`${SUPA_URL}/rest/v1/ai_usage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPA_ANON, Authorization: authHeader, Prefer: 'return=minimal' },
        body: JSON.stringify({ user_id: userId, day: today, chat_count: 1, analyze_count: 0 }),
      });
    }
  }).catch(() => {});
}

export default async function handler(req, res) {
  const requestStartMs = Date.now();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ ok: false, error: 'برای استفاده از دستیار حقوقی، باید وارد شوید', needLogin: true });

  let userId = null;
  try {
    const userRes = await fetch(`${SUPA_URL}/auth/v1/user`, { headers: { apikey: SUPA_ANON, Authorization: authHeader } });
    if (userRes.ok) { const userData = await userRes.json(); if (userData.id) userId = userData.id; }
  } catch {}
  console.log('ai-chat: auth_ms=' + (Date.now() - requestStartMs) + ' userId=' + (userId ? 'found' : 'null'));
  if (!userId) return res.status(401).json({ ok: false, error: 'نشست منقضی شده. دوباره وارد شوید', needLogin: true });

  const usageStartMs = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  let used = 0;
  try {
    const usageRes = await fetch(`${SUPA_URL}/rest/v1/ai_usage?user_id=eq.${userId}&day=eq.${today}&select=chat_count`, { headers: { apikey: SUPA_ANON, Authorization: authHeader } });
    if (usageRes.ok) { const usageData = await usageRes.json(); used = usageData[0]?.chat_count || 0; }
  } catch {}
  console.log('ai-chat: usage_ms=' + (Date.now() - usageStartMs) + ' used=' + used);

  if (used >= FREE_LIMIT) {
    return res.status(429).json({ ok: false, error: `سقف روزانه سؤال (${FREE_LIMIT.toLocaleString('fa-IR')} در روز) تکمیل شده. فردا دوباره تلاش کنید یا ارتقا دهید.`, limitReached: true, used, limit: FREE_LIMIT, remaining: 0, plan: 'free' });
  }

  const { question } = req.body || {};
  if (!question || typeof question !== 'string' || question.trim().length < 3) return res.status(400).json({ ok: false, error: 'سؤال بسیار کوتاه است' });

  try {
    const citations = searchLaws(question);
    const ctx = citations.length ? 'مواد قانونی مرتبط:\n' + citations.map((c) => `- ${c.law_id} ${c.article}: ${c.text}`).join('\n') : '';
    const prompt = `تو دستیار حقوقی کاربان هستی. به سؤال کاربر پاسخ بده.\n\n${ctx}\n\nسؤال: ${question}\n\nپاسخ کوتاه و کاربردی به فارسی. اگه به ماده قانونی استناد می‌کنی، نام آن را ذکر کن.`;
    const answer = await callGemini(prompt, requestStartMs);
    incrementUsage(userId, authHeader);
    console.log('ai-chat: total_ms=' + (Date.now() - requestStartMs));
    return res.json({ ok: true, answer, citations, usage: { used: used + 1, limit: FREE_LIMIT, remaining: Math.max(0, FREE_LIMIT - used - 1), plan: 'free' } });
  } catch (e) {
    console.error('ai-chat: failed type=' + (e.errorType || 'unknown') + ' total_ms=' + (Date.now() - requestStartMs) + ' msg=' + e.message);
    if (e.errorType === 'timeout') return res.status(504).json({ ok: false, error: 'پاسخ‌گویی طول کشید. دوباره تلاش کنید.' });
    if (e.errorType === 'network') return res.status(502).json({ ok: false, error: 'خطای شبکه در اتصال به سرویس هوش مصنوعی.' });
    if (e.errorType === 'provider') return res.status(502).json({ ok: false, error: e.message });
    if (e.errorType === 'blocked') return res.status(502).json({ ok: false, error: e.message });
    if (e.errorType === 'empty') return res.status(502).json({ ok: false, error: 'پاسخ خالی از هوش مصنوعی دریافت شد.' });
    return res.status(502).json({ ok: false, error: e.message || 'پاسخ‌گویی ناموفق بود؛ دوباره تلاش کنید' });
  }
}
export const config = { maxDuration: 20 };
