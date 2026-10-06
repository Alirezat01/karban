/* ═════════════════════════════════════════════════════════════════════
   کاربان — تحلیل قرارداد با هوش مصنوعی (Phase 3.1)
   ─────────────────────────────────────────────────────────────────
   POST /api/ai-analyze
     body: { text: string, title?: string }
     → { ok, summary, risk_level, clauses: [{index, title, text, risk, reason, suggestion}] }

   دو راه برای کانفیگ:
   ۱. اگر متغیرهای محیطی ZAI_TOKEN و ZAI_USER_ID و ZAI_CHAT_ID ست شده باشند،
      از آن‌ها استفاده می‌کند (پایدار روی Vercel).
   ۲. در غیر این صورت، از z-ai-web-dev-sdk پیش‌فرض استفاده می‌کند
      (که نیاز به .z-ai-config دارد — روی محیط dev کار می‌کند).
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

let _zai = null;
async function getZai() {
  if (_zai) return _zai;
  const ZAI = (await import('z-ai-web-dev-sdk')).default;

  /* راه ۱: کانفیگ از env vars (پایدار روی Vercel) */
  const token = process.env.ZAI_TOKEN;
  const userId = process.env.ZAI_USER_ID;
  const chatId = process.env.ZAI_CHAT_ID;
  if (token && userId && chatId) {
    _zai = new ZAI({ baseUrl: ZAI_BASE, apiKey: ZAI_API_KEY, token, userId, chatId });
    return _zai;
  }

  /* راه ۲: SDK پیش‌فرض (نیاز به .z-ai-config دارد) */
  _zai = await ZAI.create();
  return _zai;
}

async function callZai(prompt) {
  const zai = await getZai();
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: 'تو یک وکیل حقوقی ایرانی هستی. فقط JSON معتبر برگردان.' },
      { role: 'user', content: prompt },
    ],
    thinking: { type: 'disabled' },
  });
  return completion.choices?.[0]?.message?.content || '';
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
      return res.status(502).json({ ok: false, error: 'پاسخ هوش مصنوعی قابل parse نبود؛ دوباره تلاش کنید', raw: raw.slice(0, 300) });
    }
    return res.json({
      ok: true,
      summary: parsed.summary || '',
      risk_level: parsed.risk_level || 'medium',
      clauses: Array.isArray(parsed.clauses) ? parsed.clauses : [],
      model: 'glm-zai',
    });
  } catch (e) {
    console.error('ai-analyze failed', e.message);
    return res.status(502).json({ ok: false, error: 'تحلیل ناموفق بود؛ دوباره تلاش کنید', detail: e.message });
  }
}

export const config = { maxDuration: 60 };
