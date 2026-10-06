/* ═════════════════════════════════════════════════════════════════════
   کاربان — تحلیل قرارداد با هوش مصنوعی (Phase 3.1)
   ─────────────────────────────────────────────────────────────────
   از Google Gemini API رایگان استفاده می‌کند.
   متغیر لازم: GEMINI_API_KEY

   محدودیت:
   - نیاز به لاگین
   - کاربر رایگان: ۳ تحلیل در روز
   - کاربر پولی (پرو): ۱۰ تحلیل در روز
   - بنیان‌گذار: نامحدود
   ═════════════════════════════════════════════════════════════════════ */

import { createClient } from '@supabase/supabase-js';

const MAX_CHARS = 30000;
const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash-lite', 'gemini-1.5-flash-002'];

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPA_ANON = process.env.VITE_SUPABASE_ANON_KEY;

/* ساخت کلاینت ساپابیس با توکن کاربر */
function getUserClient(authHeader) {
  if (!SUPA_URL || !SUPA_ANON) return null;
  return createClient(SUPA_URL, SUPA_ANON, {
    global: { headers: { Authorization: authHeader } },
  });
}

/* بررسی کاربر از روی توکن */
async function getAuthUser(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const res = await fetch(`${SUPA_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPA_ANON,
        Authorization: authHeader,
      },
    });
    if (!res.ok) return null;
    const j = await res.json();
    return j.id ? { id: j.id, email: j.email } : null;
  } catch {
    return null;
  }
}

/* دریافت پلن کاربر */
async function getUserPlan(userId) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = await fetch(`${SUPA_URL}/rest/v1/acc_access?user_id=eq.${userId}&status=eq.active&select=plan,expires_at`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
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
  } catch {
    return 'free';
  }
}

function getPlanLimit(plan) {
  switch (plan) {
    case 'founder': return -1;  // نامحدود
    case 'pro': return 10;
    default: return 3;
  }
}

/* بررسی و افزایش مصرف امروز */
async function checkAndIncrement(userId, type) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const today = new Date().toISOString().slice(0, 10);
  const field = type === 'chat' ? 'chat_count' : 'analyze_count';

  /* پیدا کردن ردیف امروز */
  const selRes = await fetch(`${SUPA_URL}/rest/v1/ai_usage?user_id=eq.${userId}&day=eq.${today}&select=id,${field}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  const existing = await selRes.json();

  const currentCount = existing[0]?.[field] || 0;

  /* افزایش */
  if (existing[0]?.id) {
    await fetch(`${SUPA_URL}/rest/v1/ai_usage?id=eq.${existing[0].id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ [field]: currentCount + 1 }),
    });
  } else {
    await fetch(`${SUPA_URL}/rest/v1/ai_usage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        user_id: userId,
        day: today,
        chat_count: type === 'chat' ? 1 : 0,
        analyze_count: type === 'analyze' ? 1 : 0,
      }),
    });
  }

  return currentCount;
}

function buildPrompt(text, title) {
  return `تو یک وکیل حقوقی ایرانی هستی. قرارداد زیر را تحلیل کن و خروجی را به‌صورت JSON معتبر برگردان.

قرارداد: ${title || 'بدون عنوان'}

متن قرارداد:
"""
${text.slice(0, MAX_CHARS)}
"""

خروجی باید دقیقاً این ساختار JSON باشد (بدون متن اضافه قبل یا بعد، بدون \`\`\`json):
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

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY env var not set');
  }

  const headers = { 'Content-Type': 'application/json' };
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }], role: 'user' }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4000,
      responseMimeType: 'application/json',
    },
    systemInstruction: { parts: [{ text: 'تو یک وکیل حقوقی ایرانی هستی. فقط JSON معتبر برگردان.' }] },
  });

  let lastError = '';
  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const res = await fetch(url, { method: 'POST', headers, body });
      if (res.ok) {
        const j = await res.json();
        const content = j.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (content) return { content, model };
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
  if (req.method === 'GET' && req.query.debug === '1') {
    return res.json({
      ok: true,
      diagnostic: {
        env: { GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'set' : 'NOT SET' },
        models: GEMINI_MODELS,
      },
      time: new Date().toISOString(),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  /* ─── احراز هویت ─── */
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({
      ok: false,
      error: 'برای استفاده از تحلیل هوشمند قرارداد، باید وارد حساب کاربری شوید',
      needLogin: true,
    });
  }
  const user = await getAuthUser(authHeader);
  if (!user) {
    return res.status(401).json({
      ok: false,
      error: 'نشست شما منقضی شده است. دوباره وارد شوید',
      needLogin: true,
    });
  }

  /* ─── بررسی محدودیت روزانه ─── */
  const plan = await getUserPlan(user.id);
  const limit = getPlanLimit(plan);

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const today = new Date().toISOString().slice(0, 10);
  const selRes = await fetch(`${SUPA_URL}/rest/v1/ai_usage?user_id=eq.${user.id}&day=eq.${today}&select=analyze_count`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  const usage = await selRes.json();
  const used = usage[0]?.analyze_count || 0;

  if (limit !== -1 && used >= limit) {
    const planLabel = plan === 'founder' ? 'بنیان‌گذار' : plan === 'pro' ? 'پیشرفته' : 'رایگان';
    return res.status(429).json({
      ok: false,
      error: `سقف روزانه تحلیل قرارداد (${limit.toLocaleString('fa-IR')} در روز برای پلن ${planLabel}) تکمیل شده است. فردا دوباره تلاش کنید یا به پلن بالاتر ارتقا دهید.`,
      limitReached: true,
      used,
      limit,
      plan,
    });
  }

  const { text, title } = req.body || {};
  if (!text || typeof text !== 'string' || text.trim().length < 50) {
    return res.status(400).json({ ok: false, error: 'متن قرارداد بسیار کوتاه است (حداقل ۵۰ کاراکتر)' });
  }

  try {
    const prompt = buildPrompt(text, title);
    const { content: raw, model } = await callGemini(prompt);
    const parsed = extractJson(raw);
    if (!parsed) {
      return res.status(502).json({ ok: false, error: 'پاسخ هوش مصنوعی قابل parse نبود؛ دوباره تلاش کنید' });
    }

    /* ─── افزایش شمارنده ─── */
    await checkAndIncrement(user.id, 'analyze');

    return res.json({
      ok: true,
      summary: parsed.summary || '',
      risk_level: parsed.risk_level || 'medium',
      clauses: Array.isArray(parsed.clauses) ? parsed.clauses : [],
      model,
      usage: {
        used: used + 1,
        limit,
        remaining: limit === -1 ? -1 : Math.max(0, limit - used - 1),
        plan,
      },
    });
  } catch (e) {
    console.error('ai-analyze failed', e.message);
    return res.status(502).json({ ok: false, error: 'تحلیل ناموفق بود؛ دوباره تلاش کنید', detail: e.message });
  }
}

export const config = { maxDuration: 60 };
