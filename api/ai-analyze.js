/* ═════════════════════════════════════════════════════════════════════
   کاربان — تحلیل قرارداد با هوش مصنوعی (Phase 3.1)
   ─────────────────────────────────────────────────────────────────
   POST /api/ai-analyze
     body: { text: string, title?: string }
     → { ok, summary, risk_level, clauses: [{index, title, text, risk, reason, suggestion}] }

   از Z.ai GLM (همان z-ai-web-dev-sdk) استفاده می‌کند — رایگان و در دسترس.
   برای production روی Vercel، ZAI_API_KEY را در env ست کنید.
   ═════════════════════════════════════════════════════════════════════ */

const MAX_CHARS = 30000;

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

async function callZai(prompt) {
  const apiKey = process.env.ZAI_API_KEY;
  if (!apiKey) throw new Error('ZAI_API_KEY not set');

  const res = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'glm-4-flash',
      messages: [
        { role: 'system', content: 'تو یک وکیل حقوقی ایرانی هستی. فقط JSON معتبر برگردان.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Z.ai ${res.status}: ${t.slice(0, 200)}`);
  }
  const j = await res.json();
  return j.choices?.[0]?.message?.content || '';
}

function extractJson(text) {
  /* پیدا کردن JSON در پاسخ LLM (گاهی با ```json ... ``` می‌آید) */
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

export default async function handler(req, res) {
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
      return res.status(502).json({ ok: false, error: 'پاسخ هوش مصنوعی قابل parse نبود؛ دوباره تلاش کنید' });
    }
    return res.json({
      ok: true,
      summary: parsed.summary || '',
      risk_level: parsed.risk_level || 'medium',
      clauses: Array.isArray(parsed.clauses) ? parsed.clauses : [],
      model: 'glm-4-flash',
    });
  } catch (e) {
    console.error('ai-analyze failed', e.message);
    return res.status(502).json({ ok: false, error: 'تحلیل ناموفق بود؛ دوباره تلاش کنید' });
  }
}

export const config = { maxDuration: 60 };
