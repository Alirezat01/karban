/* ═════════════════════════════════════════════════════════════════════
   کاربان سوپراپ — اسکنر هوشمند فاکتور و چک صیادی ۱۶ رقمی (AI OCR)
   ─────────────────────────────────────────────────────────────────
   اندپوینت: POST /api/ai/ocr-scan
   قرارداد دقیقاً مطابق mobile-app/server.ts (نسخه جمینای):
   ورودی JSON: { imageBase64, mimeType, scanMode: 'invoice'|'check', manualHint }
   خروجی JSON: { ok: true, result: {...} }  یا  { ok: false, error }
   ═════════════════════════════════════════════════════════════════════ */
import { callGeminiWithFallback, parseJsonLenient, rateLimit, clientIp, sendError } from './_gemini.js';

const RATE_MAX = 20; /* ۲۰ اسکن در ۱۰ دقیقه از هر IP */
const hitCounter = new Map();

const SYSTEM_INSTRUCTION = `شما موتور هوش مصنوعی اسکن اپتیکال (OCR) سامانه حسابداری و حقوقی «کاربان» (Karban) هستید.
وظیفه شما استخراج دقیق اطلاعات مالی از تصویر یا مشخصات «فاکتور رسمی/کاغذی» یا «چک صیادی ۱۶ رقمی» ایران است.
همواره مبالغ را به ریال، تاریخ را به شمسی (مثلاً ۱۴۰۵/۰۸/۱۵) و شناسه صیادی را ۱۶ رقمی استخراج کنید. اگر تصویر نمونه یا توضیح متنی ارسال شده، اطلاعات کامل، واقع‌گرایانه و منطبق با استاندارد مالیاتی ایران استخراج نمایید.`;

const RESULT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    docType: { type: 'STRING', description: 'invoice or check' },
    title: { type: 'STRING', description: 'عنوان سند یا خلاصه فاکتور/چک' },
    partyName: { type: 'STRING', description: 'نام طرف حساب، فروشنده یا صادرکننده چک' },
    nationalOrEcoId: { type: 'STRING', description: 'کد ملی یا شناسه اقتصادی ۱۰ یا ۱۱ رقمی' },
    dateJalali: { type: 'STRING', description: 'تاریخ صدور یا سررسید به شمسی مثل ۱۴۰۵/۰۸/۲۵' },
    totalAmountRial: { type: 'NUMBER', description: 'مبلغ کل به ریال' },
    vatAmountRial: { type: 'NUMBER', description: 'مبلغ مالیات ارزش افزوده (۱۰ درصد) به ریال' },
    sayadiId: { type: 'STRING', description: 'شناسه ۱۶ رقمی صیادی (در صورت چک بودن)' },
    bankName: { type: 'STRING', description: 'نام بانک صادرکننده چک یا تراکنش' },
    sayadiStatusSummary: { type: 'STRING', description: 'وضعیت پیشنهادی استعلام و اعتبار سند' },
    suggestedDebitAccount: { type: 'STRING', description: 'حساب بدهکار پیشنهادی در دفتر روزنامه' },
    suggestedCreditAccount: { type: 'STRING', description: 'حساب بستانکار پیشنهادی در دفتر روزنامه' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          description: { type: 'STRING' },
          quantity: { type: 'NUMBER' },
          unitPriceRial: { type: 'NUMBER' },
          totalRial: { type: 'NUMBER' },
        },
      },
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  if (!rateLimit(hitCounter, clientIp(req), RATE_MAX)) {
    return res.status(429).json({ ok: false, error: 'تعداد درخواست‌های اسکن زیاد است؛ کمی بعد تلاش کنید.' });
  }

  const { imageBase64, mimeType, scanMode, manualHint } = req.body || {};
  const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
  if (imageBase64) {
    if (!mimeType || !allowedMime.includes(mimeType)) {
      return res.status(400).json({ ok: false, error: 'فرمت تصویر باید JPG، PNG یا WebP باشد.' });
    }
    /* base64 تا ۱۰ مگابایت تصویر خام (~۱۳.۵ مگ کاراکتر) */
    if (imageBase64.length > 14 * 1024 * 1024) {
      return res.status(413).json({ ok: false, error: 'حجم تصویر بیش از حد مجاز است.' });
    }
  }
  if (!imageBase64 && !manualHint) {
    return res.status(400).json({ ok: false, error: 'تصویر یا توضیح متنی سند را ارسال کنید.' });
  }

  const started = Date.now();
  const parts = [];
  if (imageBase64 && mimeType) {
    parts.push({
      inlineData: { mimeType, data: imageBase64.replace(/^data:[^;]+;base64,/, '') },
    });
  }
  parts.push({
    text: `نوع سند: ${scanMode === 'check' ? 'چک صیادی بانکی' : 'فاکتور خرید/فروش یا رسید هزینه'}. ${
      manualHint ? `توضیحات تکمیلی کاربر: ${manualHint}` : 'لطفاً تمام فیلدهای سند را با دقت استخراج کنید.'
    }`,
  });

  try {
    const { text } = await callGeminiWithFallback({
      systemInstruction: SYSTEM_INSTRUCTION,
      parts,
      schema: RESULT_SCHEMA,
      temperature: 0.1,
    });
    const result = parseJsonLenient(text);
    if (!result) {
      console.error('ocr-scan: unparseable output len=' + text.length);
      return res.status(502).json({ ok: false, error: 'خوانش تصویر ناموفق بود؛ عکس واضح‌تر و از نزدیک‌تر بگیرید.' });
    }
    console.log(`ocr-scan: ok ms=${Date.now() - started}`);
    return res.json({ ok: true, result });
  } catch (e) {
    return sendError(res, e, 'خطا در پردازش تصویر توسط هوش مصنوعی');
  }
}

export const config = { maxDuration: 60 };
