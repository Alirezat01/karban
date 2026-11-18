/* ═════════════════════════════════════════════════════════════════════
   کاربان سوپراپ — دستیار صوتی چندمرحله‌ای مدیر مالی (CFO Copilot)
   ─────────────────────────────────────────────────────────────────
   اندپوینت: POST /api/ai/voice-assistant
   قرارداد دقیقاً مطابق mobile-app/server.ts (نسخه جمینای):
   ورودی JSON: { message, history[], personaRole: 'cfo'|'tax'|'legal', fastMode, financialContext }
   خروجی JSON: { ok: true, result: { replyText, navigationAction, actionLabel, highlightedMetric }, modelUsed }
   نکته: fastMode=true → مدل سبک برای پاسخ‌گویی سریع صوتی
   ═════════════════════════════════════════════════════════════════════ */
import { callGemini, parseJsonLenient, rateLimit, clientIp, sendError, MODEL_PRIMARY } from './_gemini.js';

const RATE_MAX = 60; /* گفت‌وگوی صوتی — درخواست‌های بیشتر */
const MODEL_FAST = 'gemini-3.1-flash-lite';
const hitCounter = new Map();

const ROLE_DESCRIPTIONS = {
  cfo: 'شما «مدیر مالی هوشمند (AI CFO) و دستیار صوتی نئوبانک کاربان» هستید. وظیفه شما پاسخگویی سریع، دقیق و محترمانه به سوالات مالی، موجودی خزانه، چک‌های صیادی، سود و زیان و هدایت صوتی کاربر به بخش‌های مختلف اپلیکیشن است.',
  tax: 'شما «مشاور ارشد مالیاتی و متخصص سامانه مودیان و ارزش افزوده ۱۴۰۵ کاربان» هستید. به سوالات مالیاتی، نرخ ۱۰٪ ارزش افزوده، جرایم ماده ۱۶۹ و لوایح دفاعیه پاسخ دقیق بدهید.',
  legal: 'شما «وکیل پایه یک قراردادها و کارشناس روابط کار و تامین اجتماعی ۱۴۰۵ کاربان» هستید. به سوالات حقوقی، حق بیمه ۳۰٪، عیدی و سنوات و قراردادها پاسخ دقیق بدهید.',
};

const RESULT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    replyText: {
      type: 'STRING',
      description: 'پاسخ فارسی، دقیق و خوش‌آهنگ جهت نمایش در چت و خوانش صوتی',
    },
    navigationAction: {
      type: 'STRING',
      description: 'یکی از مقادیر: none, dashboard, accounting, ai_studio, contracts, signpad, tools, lock_app, upgrade_modal',
    },
    actionLabel: {
      type: 'STRING',
      description: 'عنوان کوتاه عملیات انجام‌شده، مثلاً: انتقال به بخش حسابداری و مودیان',
    },
    highlightedMetric: {
      type: 'STRING',
      description: 'در صورت پرسش مالی، عدد یا شاخص کلیدی استخراج‌شده به فارسی (اختیاری)',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  if (!rateLimit(hitCounter, clientIp(req), RATE_MAX)) {
    return res.status(429).json({ ok: false, error: 'سقف درخواست‌های دستیار صوتی پر شده؛ کمی بعد تلاش کنید.' });
  }

  const { message, history, personaRole, fastMode, financialContext } = req.body || {};
  if (!message || typeof message !== 'string' || message.trim().length < 2) {
    return res.status(400).json({ ok: false, error: 'فرمان صوتی یا پرسش خالی است.' });
  }

  const selectedModel = fastMode ? MODEL_FAST : MODEL_PRIMARY;

  const systemInstruction = `${ROLE_DESCRIPTIONS[personaRole] || ROLE_DESCRIPTIONS.cfo}
اطلاعات مالی زنده کسب‌وکار کاربر در حال حاضر:
${JSON.stringify(financialContext || {}, null, 2)}

قوانین مهم پاسخگویی:
۱. تمام اعداد و مبالغ را به فارسی و با جداکننده سه‌رقمی (مثلاً ۳۷۴٬۵۵۰٬۰۰۰ تومان) بیان کنید.
۲. اگر کاربر دستور رفتن یا باز کردن یکی از بخش‌های برنامه را داد (مثلاً «برو به حسابداری»، «فاکتور صادر کن»، «چک‌های صیادی رو نشون بده»، «امضای دیجیتال»، «ماشین‌حساب حقوق»، «هوش مصنوعی»، «قفل برنامه»)، فیلد navigationAction را دقیق تنظیم کنید و در پاسخ صوتی اعلام کنید که آن بخش باز شد.
۳. پاسخ باید روان، مختصر (۲ تا ۴ جمله مفید برای خوانش صوتی) و کاملاً کاربردی باشد.`;

  const formattedHistory = Array.isArray(history)
    ? history
        .slice(-10)
        .map((m) => `${m && m.role === 'user' ? 'کاربر' : 'دستیار صوتی کاربان'}: ${(m && m.text) || ''}`)
        .join('\n')
    : '';

  const prompt = `${formattedHistory ? `سابقه مکالمه چندمرحله‌ای:\n${formattedHistory}\n\n` : ''}فرمان صوتی یا پرسش جدید کاربر: ${message}`;

  const started = Date.now();
  try {
    const text = await callGemini({
      model: selectedModel,
      systemInstruction,
      prompt,
      schema: RESULT_SCHEMA,
      temperature: 0.5,
      maxOutputTokens: 2048,
    }, fastMode ? 20000 : 55000);
    const result = parseJsonLenient(text);
    if (!result || !result.replyText) {
      console.error('voice-assistant: unparseable output len=' + text.length);
      return res.status(502).json({ ok: false, error: 'پردازش فرمان صوتی ناموفق بود؛ دوباره تلاش کنید.' });
    }
    console.log(`voice-assistant: ok ms=${Date.now() - started} model=${selectedModel}`);
    return res.json({ ok: true, result, modelUsed: selectedModel });
  } catch (e) {
    return sendError(res, e, 'خطا در پردازش فرمان صوتی');
  }
}

export const config = { maxDuration: 60 };
