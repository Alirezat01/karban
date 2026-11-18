/* ═════════════════════════════════════════════════════════════════════
   کاربان سوپراپ — رادار پیش‌بینی نقدینگی و هشدار کسری چک/مالیات
   ─────────────────────────────────────────────────────────────────
   اندپوینت: POST /api/ai/cashflow-radar
   قرارداد دقیقاً مطابق mobile-app/server.ts (نسخه جمینای):
   ورودی JSON: { financialSnapshot: {...} }
   خروجی JSON: { ok: true, result: { liquidityStatus, projected30DayNetRial, riskAlerts[], actionableRecommendations[] } }
   ═════════════════════════════════════════════════════════════════════ */
import { callGeminiWithFallback, parseJsonLenient, rateLimit, clientIp, sendError } from './_gemini.js';

const RATE_MAX = 20;
const hitCounter = new Map();

const SYSTEM_INSTRUCTION = `شما مدیر مالی هوشمند (AI CFO) پلتفرم «کاربان» هستید. بر اساس داده‌های نقدینگی، فاکتورهای فروش/خرید و چک‌های صیادی در جریان کسب‌وکار، پیش‌بینی ۳۰ روز آینده، ریسک برگشت چک یا کسری نقدینگی و راهکار عملیاتی ارائه دهید.`;

const RESULT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    liquidityStatus: { type: 'STRING', description: 'وضعیت نقدینگی: ایمن، نیازمند مراقبت، یا بحرانی' },
    projected30DayNetRial: { type: 'NUMBER', description: 'تراز خالص پیش‌بینی‌شده ۳۰ روز آینده به ریال' },
    riskAlerts: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'هشدارهای سررسید چک، مالیات ارزش افزوده و کسری احتمالی',
    },
    actionableRecommendations: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'اقدامات پیشنهادی فوری برای بهبود جریان نقدینگی و کاهش مالیات قانونی',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  if (!rateLimit(hitCounter, clientIp(req), RATE_MAX)) {
    return res.status(429).json({ ok: false, error: 'تعداد درخواست‌ها زیاد است؛ کمی بعد تلاش کنید.' });
  }

  const { financialSnapshot } = req.body || {};
  if (!financialSnapshot || typeof financialSnapshot !== 'object') {
    return res.status(400).json({ ok: false, error: 'داده‌های مالی ارسال نشده است.' });
  }

  const started = Date.now();
  const prompt = `داده‌های مالی زنده کسب‌وکار:\n${JSON.stringify(financialSnapshot, null, 2)}`;

  try {
    const { text } = await callGeminiWithFallback({
      systemInstruction: SYSTEM_INSTRUCTION,
      prompt,
      schema: RESULT_SCHEMA,
      temperature: 0.3,
    });
    const result = parseJsonLenient(text);
    if (!result || !result.liquidityStatus) {
      console.error('cashflow-radar: unparseable output len=' + text.length);
      return res.status(502).json({ ok: false, error: 'تحلیل رادار نقدینگی ناموفق بود؛ دوباره تلاش کنید.' });
    }
    console.log(`cashflow-radar: ok ms=${Date.now() - started}`);
    return res.json({ ok: true, result });
  } catch (e) {
    return sendError(res, e, 'خطا در تحلیل رادار نقدینگی');
  }
}

export const config = { maxDuration: 60 };
