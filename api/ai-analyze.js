/* ═════════════════════════════════════════════════════════════════════
   کاربان — تحلیل قرارداد (نسخه بهینه‌شده برای Vercel Hobby)
   ═════════════════════════════════════════════════════════════════════ */

const MAX_CHARS = 20000;
const GEMINI_MODEL = 'gemini-2.0-flash';
const SUPA_URL = 'https://rocjeanizzhfvhnuhnms.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvY2plYW5penpoZnZobnVobm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NDQwMDcsImV4cCI6MjEwMjAyMDAwN30.Br3brGTpjWnI7ilghPka_DyYUQU7e9eYIPv88Ehqy6g';

function extractJson(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < 0) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
}

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }], role: 'user' }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 2000, responseMimeType: 'application/json' },
    systemInstruction: { parts: [{ text: 'تو یک وکیل حقوقی ایرانی هستی. فقط JSON معتبر برگردان.' }] },
  });

  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });

  if (!res.ok) {
    if (res.status === 404) {
      const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
      const fallbackRes = await fetch(fallbackUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      if (fallbackRes.ok) {
        const j = await fallbackRes.json();
        return j.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }
      const t = await fallbackRes.text().catch(() => '');
      throw new Error(`Gemini fallback ${fallbackRes.status}: ${t.slice(0, 200)}`);
    }
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
}

export default async function handler(req, res) {
  if (req.method === 'GET' && req.query.debug === '1') {
    return res.json({
      ok: true,
      diagnostic: {
        env: { GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'set' : 'NOT SET' },
        model: GEMINI_MODEL,
        supabase_url: SUPA_URL,
      },
      time: new Date().toISOString(),
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ ok: false, error: 'برای استفاده از تحلیل قرارداد، باید وارد شوید', needLogin: true });

  let user = null;
  try {
    const userRes = await fetch(`${SUPA_URL}/auth/v1/user`, {
      headers: { apikey: SUPA_ANON, Authorization: authHeader },
    });
    if (userRes.ok) {
      const userData = await userRes.json();
      if (userData.id) user = { id: userData.id, email: userData.email };
    }
  } catch {}

  if (!user) return res.status(401).json({ ok: false, error: 'نشست منقضی شده. دوباره وارد شوید', needLogin: true });

  const FREE_LIMIT = 3;
  let used = 0;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const usageRes = await fetch(`${SUPA_URL}/rest/v1/ai_usage?user_id=eq.${user.id}&day=eq.${today}&select=analyze_count`, {
      headers: { apikey: SUPA_ANON, Authorization: authHeader },
    });
    if (usageRes.ok) {
      const usageData = await usageRes.json();
      used = usageData[0]?.analyze_count || 0;
    }
  } catch {}

  if (used >= FREE_LIMIT) {
    return res.status(429).json({
      ok: false,
      error: `سقف روزانه تحلیل (${FREE_LIMIT.toLocaleString('fa-IR')} در روز) تکمیل شده. فردا دوباره تلاش کنید یا ارتقا دهید.`,
      limitReached: true, used, limit: FREE_LIMIT, plan: 'free',
    });
  }

  const { text, title } = req.body || {};
  if (!text || typeof text !== 'string' || text.trim().length < 50) {
    return res.status(400).json({ ok: false, error: 'متن قرارداد کوتاه است (حداقل ۵۰ کاراکتر)' });
  }

  try {
    const prompt = `تو یک وکیل حقوقی ایرانی هستی. قرارداد زیر را تحلیل کن و فقط JSON برگردان.

قرارداد: ${title || 'بدون عنوان'}

متن:
"""
 ${text.slice(0, MAX_CHARS)}
"""

JSON:
{
  "summary": "خلاصه ۲ جمله‌ای",
  "risk_level": "low|medium|high|critical",
  "clauses": [{"index":0,"title":"عنوان","text":"متن","risk":"low|medium|high","reason":"دلیل","suggestion":"پیشنهاد"}]
}

ریسک‌ها را بر اساس قانون کار و مدنی ایران ارزیابی کن. فقط JSON.`;

    const raw = await callGemini(prompt);
    const parsed = extractJson(raw);
    if (!parsed) return res.status(502).json({ ok: false, error: 'پاسخ AI قابل parse نبود', raw: raw.slice(0, 200) });

    const today = new Date().toISOString().slice(0, 10);
    fetch(`${SUPA_URL}/rest/v1/ai_usage?user_id=eq.${user.id}&day=eq.${today}&select=id,analyze_count`, {
      headers: { apikey: SUPA_ANON, Authorization: authHeader },
    }).then(async (selRes) => {
      const existing = await selRes.json();
      if (existing[0]?.id) {
        await fetch(`${SUPA_URL}/rest/v1/ai_usage?id=eq.${existing[0].id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', apikey: SUPA_ANON, Authorization: authHeader, Prefer: 'return=minimal' },
          body: JSON.stringify({ analyze_count: (existing[0].analyze_count || 0) + 1 }),
        });
      } else {
        await fetch(`${SUPA_URL}/rest/v1/ai_usage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: SUPA_ANON, Authorization: authHeader, Prefer: 'return=minimal' },
          body: JSON.stringify({ user_id: user.id, day: today, chat_count: 0, analyze_count: 1 }),
        });
      }
    }).catch(() => {});

    return res.json({
      ok: true,
      summary: parsed.summary || '',
      risk_level: parsed.risk_level || 'medium',
      clauses: Array.isArray(parsed.clauses) ? parsed.clauses : [],
      model: GEMINI_MODEL,
      usage: { used: used + 1, limit: FREE_LIMIT, remaining: Math.max(0, FREE_LIMIT - used - 1), plan: 'free' },
    });
  } catch (e) {
    console.error('ai-analyze failed', e.message);
    return res.status(502).json({ ok: false, error: 'تحلیل ناموفق بود؛ دوباره تلاش کنید', detail: e.message });
  }
}

export const config = { maxDuration: 10 };
