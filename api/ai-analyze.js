/* ═════════════════════════════════════════════════════════════════════
   کاربان — تحلیل قرارداد با هوش مصنوعی (Phase 3.1)
   از Google Gemini API رایگان استفاده می‌کند.
   متغیر لازم: GEMINI_API_KEY
   دریافت کلید رایگان: https://aistudio.google.com/app/apikey
   مدل: gemini-1.5-flash (رایگان، ۱۵۰۰ درخواست در روز)
   ═════════════════════════════════════════════════════════════════════ */

const MAX_CHARS = 30000;
const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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
    throw new Error('GEMINI_API_KEY env var not set. Get a free key at https://aistudio.google.com/app/apikey');
  }

  const url = `${GEMINI_BASE}?key=${apiKey}`;
  const headers = { 'Content-Type': 'application/json' };
  const body = JSON.stringify({
    contents: [
      {
        parts: [{ text: prompt }],
        role: 'user',
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4000,
      responseMimeType: 'application/json',
    },
    systemInstruction: {
      parts: [{ text: 'تو یک وکیل حقوقی ایرانی هستی. فقط JSON معتبر برگردان.' }],
    },
  });

  const res = await fetch(url, { method: 'POST', headers, body });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Gemini API ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = await res.json();
  const content = j.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!content) {
    if (j.promptFeedback?.blockReason) {
      throw new Error(`محتوای مسدودشده توسط Gemini: ${j.promptFeedback.blockReason}`);
    }
    throw new Error('پاسخ خالی از Gemini');
  }
  return content;
}

async function testConnection() {
  const results = { env: null, fetch: null };
  results.env = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ? `set (${process.env.GEMINI_API_KEY.length} chars)` : 'NOT SET',
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    results.fetch = { ok: false, error: 'GEMINI_API_KEY not set' };
    return results;
  }

  try {
    const url = `${GEMINI_BASE}?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'سلام' }], role: 'user' }],
        generationConfig: { maxOutputTokens: 10 },
      }),
    });
    const t = await res.text().catch(() => '');
    results.fetch = {
      ok: res.ok,
      status: res.status,
