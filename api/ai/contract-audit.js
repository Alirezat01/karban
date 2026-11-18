/* ═════════════════════════════════════════════════════════════════════
   کاربان سوپراپ — تحلیل‌گر هوشمند ریسک قرارداد (بند به بند)
   ─────────────────────────────────────────────────────────────────
   اندپوینت: POST /api/ai/contract-audit
   قرارداد دقیقاً مطابق mobile-app/server.ts (نسخه جمینای):
   ورودی JSON: { contractText, userRole }
   خروجی JSON: { ok: true, result: { safetyScore, overallSummary, riskyClauses[], missingClauses[] } }
   ═════════════════════════════════════════════════════════════════════ */
import { callGeminiWithFallback, parseJsonLenient, rateLimit, clientIp, sendError } from './_gemini.js';

const RATE_MAX = 15;
const MAX_CONTRACT_CHARS = 20000;
const hitCounter = new Map();

function systemInstruction(userRole) {
  return `شما تحلیل‌گر ارشد قراردادهای تجاری، کار و پیمانکاری در پلتفرم «کاربان» هستید.
متن قرارداد ارسالی را از دیدگاه حفظ منافع «${userRole || 'کارفرما / طرف اول'}» بر اساس قانون مدنی، قانون کار و قانون تجارت ایران کالبدشکافی کنید.`;
}

const RESULT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    safetyScore: { type: 'NUMBER', description: 'امتیاز امنیت حقوقی قرارداد از ۰ تا ۱۰۰' },
    overallSummary: { type: 'STRING', description: 'جمع‌بندی کلی وضعیت حقوقی قرارداد' },
    riskyClauses: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          clauseTitle: { type: 'STRING' },
          severity: { type: 'STRING', description: 'high, medium, low' },
          riskExplanation: { type: 'STRING' },
          suggestedRewrite: { type: 'STRING', description: 'متن جایگزین ایمن و استاندارد' },
        },
      },
    },
    missingClauses: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'بندهای مهمی که در قرارداد جا افتاده‌اند (مثل فورس‌ماژور، محرمانگی، شرط داوری و...)',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  if (!rateLimit(hitCounter, clientIp(req), RATE_MAX)) {
    return res.status(429).json({ ok: false, error: 'تعداد درخواست‌ها زیاد است؛ کمی بعد تلاش کنید.' });
  }

  const { contractText, userRole } = req.body || {};
  if (!contractText || typeof contractText !== 'string' || contractText.trim().length < 30) {
    return res.status(400).json({ ok: false, error: 'متن قرارداد برای تحلیل کوتاه است.' });
  }

  const started = Date.now();
  const prompt = `متن قرارداد جهت تحلیل ریسک:\n${contractText.slice(0, MAX_CONTRACT_CHARS)}`;

  try {
    const { text } = await callGeminiWithFallback({
      systemInstruction: systemInstruction(userRole),
      prompt,
      schema: RESULT_SCHEMA,
      temperature: 0.3,
    });
    const result = parseJsonLenient(text);
    if (!result || typeof result.safetyScore === 'undefined') {
      console.error('contract-audit: unparseable output len=' + text.length);
      return res.status(502).json({ ok: false, error: 'تحلیل قرارداد ناموفق بود؛ دوباره تلاش کنید.' });
    }
    console.log(`contract-audit: ok ms=${Date.now() - started}`);
    return res.json({ ok: true, result });
  } catch (e) {
    return sendError(res, e, 'خطا در تحلیل هوشمند قرارداد');
  }
}

export const config = { maxDuration: 60 };
