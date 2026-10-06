/* ═════════════════════════════════════════════════════════════════════
   کاربان — تحلیل قرارداد با هوش مصنوعی (Phase 3.1)
   از API عمومی Z.ai (open.bigmodel.cn) استفاده می‌کند.
   متغیر لازم: ZAI_API_KEY
   مدل‌ها به ترتیب امتحان می‌شوند تا یکی جواب بدهد.
   ═════════════════════════════════════════════════════════════════════ */

const MAX_CHARS = 30000;
const ZAI_BASE = 'https://open.bigmodel.cn/api/paas/v4';
const ZAI_MODELS = ['glm-4-flash', 'glm-4-flashx', 'glm-4-air', 'glm-4-airx', 'glm-4', 'glm-3-turbo'];

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
  const apiKey = process.env.ZAI_API_KEY;
  if (!apiKey) {
    throw new Error('ZAI_API_KEY env var not set. Get a free key at https://z.ai');
  }

  const url = `${ZAI_BASE}/chat/completions`;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
  const baseBody = {
    messages: [
      { role: 'system', content: 'تو یک وکیل حقوقی ایرانی هستی. فقط JSON معتبر برگردان.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 4000,
  };

  /* مدل‌ها رو به‌ترتیب امتحان می‌کنیم تا یکی جواب بده */
  let lastError = '';
  for (const model of ZAI_MODELS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...baseBody, model }),
      });
      if (res.ok) {
        const j = await res.json();
        const content = j.choices?.[0]?.message?.content || '';
        if (content) {
          console.log('AI model used:', model);
          return { content, model };
        }
      } else {
        const t = await res.text().catch(() => '');
        lastError = `${model}: ${res.status} ${t.slice(0, 100)}`;
        /* اگه 401 (کلید نامعتبر) بود، بقیه مدل‌ها هم همین مشکل رو دارن */
        if (res.status === 401) {
          throw new Error(`Z.ai API 401: کلید API نامعتبر است — ${t.slice(0, 200)}`);
        }
        /* اگه 1211 (مدل وجود ندارد) یا 400 بود، مدل بعدی رو امتحان کن */
        continue;
      }
    } catch (e) {
      /* اگه 401 بود، break کن */
      if (e.message.includes('401')) throw e;
      lastError = `${model}: ${e.message.slice(0, 100)}`;
      continue;
    }
  }
  throw new Error(`هیچ مدلی کار نکرد. آخرین خطا: ${lastError}`);
}

/* تابع کمکی برای دیباگ: تست اتصال به Z.ai و امتحان همه مدل‌ها */
async function testConnection() {
  const results = { env: null, models: [] };
  results.env = {
    ZAI_API_KEY: process.env.ZAI_API_KEY ? `set (${process.env.ZAI_API_KEY.length} chars)` : 'NOT SET',
  };

  const apiKey = process.env.ZAI_API_KEY;
  if (!apiKey) {
    results.fetch = { ok: false, error: 'ZAI_API_KEY not set' };
    return results;
  }

  const url = `${ZAI_BASE}/chat/completions`;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  /* تست هر مدل با درخواست ساده */
  let workingModel = null;
  for (const model of ZAI_MODELS) {
    try {
      const testRes = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 5,
        }),
      });
      const t = await testRes.text().catch(() => '');
      const entry = {
        model,
        ok: testRes.ok,
        status: testRes.status,
        body: t.slice(0, 200),
      };
      results.models.push(entry);
      if (testRes.ok) {
        workingModel = model;
        break;
      }
    } catch (e) {
      results.models.push({
        model,
        ok: false,
        error: e.message.slice(0, 100),
      });
    }
  }

  results.fetch = workingModel
    ? { ok: true, working_model: workingModel }
    : { ok: false, error: 'No model worked', tested: ZAI_MODELS };
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
    const { content: raw, model } = await callZai(prompt);
    const parsed = extractJson(raw);
    if (!parsed) {
      return res.status(502).json({ ok: false, error: 'پاسخ هوش مصنوعی قابل parse نبود؛ دوباره تلاش کنید', raw: raw.slice(0, 300) });
    }
    return res.json({
      ok: true,
      summary: parsed.summary || '',
      risk_level: parsed.risk_level || 'medium',
      clauses: Array.isArray(parsed.clauses) ? parsed.clauses : [],
      model,
    });
  } catch (e) {
    console.error('ai-analyze failed', e.message);
    return res.status(502).json({ ok: false, error: 'تحلیل ناموفق بود؛ دوباره تلاش کنید', detail: e.message });
  }
}

export const config = { maxDuration: 60 };
