/* ═════════════════════════════════════════════════════════════════════
   کاربان — تحلیل قرارداد با هوش مصنوعی (Phase 3.1)
   از Z.ai API مستقیم استفاده می‌کند (بدون SDK).
   متغیرهای لازم در Vercel: ZAI_TOKEN, ZAI_USER_ID, ZAI_CHAT_ID
   ═════════════════════════════════════════════════════════════════════ */

const MAX_CHARS = 30000;
const ZAI_BASE = 'https://internal-api.z.ai/v1';
const ZAI_API_KEY = 'Z.ai';

function buildPrompt(text, title) {
  return `تو یک وکیل حقوقی ایرانی هستی. قرارداد زیر را تحلیل کن و خروجی را به‌صورت JSON معتبر برگردان.

قرارداد: ${title || 'بدون عنوان'}

متن قرارداد:
"""
 ${text.slice(0, MAX_CHARS)}
"""

خروجی باید دقیقاً این ساختار JSON باشد (بدون متن اضافه قبل یا بعد):
{
  "summary": "خلاصه ۲-۳ جمله‌ای کلی قرارداد",
  "risk_level": "low" | "medium" | "high" | "critical",
  "clauses": [
    {
      "index": 0,
      "title": "عنوان بند",
      "text": "متن کوتاه بند",
      "risk": "low" | "medium" | "high",
      "reason": "چرا این بند ریسک دارد یا ایمن است",
      "suggestion": "پیشنهاد بهبود (اگر ریسک دارد) یا خالی"
    }
  ]
}

نکات:
- ریسک‌ها را بر اساس قانون کار، قانون مدنی و قانون تجارت ایران ارزیابی کن.
- بندهای پرخطر: محرومیت از حقوق، فسخ یک‌طرفه، جریمه نامتناسب، عدم تعیین مدت، محرمانگی بیش از حد.
- بندهای ایمن: مبنای قانونی روشن، تعهدات متقابل، حل اختلاف مشخص.
- فقط JSON برگردان، هیچ متن دیگری قبل یا بعد نگذار.`;
}

function extractJson(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < 0) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function callZai(prompt) {
  const token = process.env.ZAI_TOKEN;
  const userId = process.env.ZAI_USER_ID;
  const chatId = process.env.ZAI_CHAT_ID;

  if (!token || !userId || !chatId) {
    throw new Error('ZAI_TOKEN, ZAI_USER_ID, ZAI_CHAT_ID env vars not set');
  }

  /* هدرها دقیقاً مطابق z-ai-web-dev-sdk:
     - Authorization: Bearer Z.ai
     - X-Chat-Id, X-User-Id, X-Token
  */
  const url = `${ZAI_BASE}/chat/completions`;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${ZAI_API_KEY}`,
    'X-Z-AI-From': 'Z',
    'X-Chat-Id': chatId,
    'X-User-Id': userId,
    'X-Token': token,
  };
  const body = JSON.stringify({
    messages: [
      { role: 'assistant', content: 'تو یک وکیل حقوقی ایرانی هستی. فقط JSON معتبر برگردان.' },
      { role: 'user', content: prompt },
    ],
    thinking: { type: 'disabled' },
  });

  const res = await fetch(url, { method: 'POST', headers, body });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Z.ai HTTP ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = await res.json();
  return j.choices?.[0]?.message?.content || '';
}

/* تابع کمکی برای دیباگ: تست اتصال به Z.ai */
async function testConnection() {
  const results = { env: null, fetch: null };
  results.env = {
    ZAI_TOKEN: process.env.ZAI_TOKEN ? `set (${process.env.ZAI_TOKEN.length} chars)` : 'NOT SET',
    ZAI_USER_ID: process.env.ZAI_USER_ID ? 'set' : 'NOT SET',
    ZAI_CHAT_ID: process.env.ZAI_CHAT_ID ? 'set' : 'NOT SET',
  };
  try {
    const testRes = await fetch('https://internal-api.z.ai/v1/', { method: 'GET' });
    results.fetch = { ok: true, status: testRes.status, statusText: testRes.statusText };
  } catch (e) {
    results.fetch = { ok: false, error: e.message, code: e.code, cause: e.cause?.message || 'no cause' };
  }
  return results;
}

export default async function handler(req, res) {
  /* مسیر دیباگ: GET /api/ai-analyze?debug=1 */
  if (req.method === 'GET' && req.query.debug === '1') {
    const diag = await testConnection();
    return res.json({ ok: true, diagnostic: diag, time: new Date().toISOString() });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }
  const { text, title } = req.body || {};
  if (!text || typeof text !== 'string' || text.trim().length < 50) {
    return res.status(400).json({ ok: false, error: 'متن قرارداد بسیار کوتاه است (حداقل ۵۰ کاراکتر)' });
  }

  try {
    const prompt = buildPrompt(text, title);
    const raw = await callZai(prompt);
    const parsed = extractJson(raw);
    if (!parsed) {
      return res.status(502).json({ ok: false, error: 'پاسخ هوش مصنوعی قابل parse نبود؛ دوباره تلاش کنید', raw: raw.slice(0, 300) });
    }
    return res.json({
      ok: true,
      summary: parsed.summary || '',
      risk_level: parsed.risk_level || 'medium',
      clauses: Array.isArray(parsed.clauses) ? parsed.clauses : [],
      model: 'glm-zai-direct',
    });
  } catch (e) {
    console.error('ai-analyze failed', e.message);
    return res.status(502).json({ ok: false, error: 'تحلیل ناموفق بود؛ دوباره تلاش کنید', detail: e.message });
  }
}

export const config = { maxDuration: 60 };
