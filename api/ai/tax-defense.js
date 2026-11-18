/* ═════════════════════════════════════════════════════════════════════
   کاربان سوپراپ — تولید لایحه دفاعیه مالیاتی و اداره کار
   ─────────────────────────────────────────────────────────────────
   اندپوینت: POST /api/ai/tax-defense
   قرارداد دقیقاً مطابق mobile-app/server.ts (نسخه جمینای):
   ورودی JSON: { topicType, targetAuthority, taxpayerName, fiscalYear, claimedAmountRial, issueDescription }
   خروجی JSON: { ok: true, result: { briefTitle, legalCitations[], formalDefenseBody, winProbabilityPercent, requiredAttachments[], strategicTip } }
   ═════════════════════════════════════════════════════════════════════ */
import { callGeminiWithFallback, parseJsonLenient, rateLimit, clientIp, sendError } from './_gemini.js';

const RATE_MAX = 12; /* ۱۲ لایحه در ۱۰ دقیقه از هر IP */
const hitCounter = new Map();

const SYSTEM_INSTRUCTION = `شما وکیل پایه یک دادگستری، مشاور رسمی مالیاتی و کارشناس ارشد روابط کار در سامانه «کاربان» هستید.
وظیفه شما نگارش یک «لایحه دفاعیه رسمی، مستند به مواد قانونی و آماده چاپ» برای ارائه به هیئت‌های حل اختلاف مالیاتی (ماده ۲۴۴، ماده ۲۱۶، ماده ۲۵۱ مکرر، ماده ۱۶۹ و قانون پایانه‌های فروشگاهی و سامانه مودیان) یا هیئت‌های تشخیص و حل اختلاف اداره کار است.
خروجی باید به زبان فارسی رسمی، حقوقی، ساختارمند و با ذکر دقیق مواد قانونی، دلایل شکلی و ماهوی و خواسته نهایی باشد.`;

const RESULT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    briefTitle: { type: 'STRING', description: 'عنوان رسمی لایحه دفاعیه' },
    legalCitations: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'فهرست مواد قانونی و بخشنامه‌های مستند (مثلاً ماده ۹۷ ق.م.م، ماده ۲۳۸ و ...)',
    },
    formalDefenseBody: {
      type: 'STRING',
      description: 'متن کامل و رسمی لایحه دفاعیه با مقدمات، دفاعیات شکلی، دفاعیات ماهوی و نتیجه‌گیری',
    },
    winProbabilityPercent: {
      type: 'NUMBER',
      description: 'درصد شانس موفقیت برآوردی با توجه به مستندات (۰ تا ۱۰۰)',
    },
    requiredAttachments: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'مدارک و پیوست‌های الزامی که باید همراه لایحه تحویل هیئت شود',
    },
    strategicTip: {
      type: 'STRING',
      description: 'نکته کلیدی و استراتژیک برای جلسه دفاع حضوری',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  if (!rateLimit(hitCounter, clientIp(req), RATE_MAX)) {
    return res.status(429).json({ ok: false, error: 'تعداد درخواست‌ها زیاد است؛ کمی بعد تلاش کنید.' });
  }

  const { topicType, targetAuthority, taxpayerName, fiscalYear, claimedAmountRial, issueDescription } = req.body || {};
  if (!issueDescription || typeof issueDescription !== 'string' || issueDescription.trim().length < 20) {
    return res.status(400).json({ ok: false, error: 'شرح ماوقع باید حداقل یک خط کامل باشد.' });
  }

  const started = Date.now();
  const prompt = `درخواست تنظیم لایحه دفاعیه رسمی:
- حوزه پرونده: ${topicType || 'مالیاتی و سامانه مودیان'}
- مرجع رسیدگی: ${targetAuthority || 'هیئت حل اختلاف مالیاتی بدوی (ماده ۲۴۴)'}
- نام مودی / شرکت / کارفرما: ${taxpayerName || 'شرکت تجاری نمونه'}
- سال مالی / دوره مورد اعتراض: ${fiscalYear || '۱۴۰۴-۱۴۰۵'}
- مبلغ مورد اعتراض (ریال): ${claimedAmountRial ? Number(claimedAmountRial).toLocaleString('fa-IR') : 'مشخص نشده'}
- شرح ماوقع و برگ تشخیص / ادعا: ${issueDescription}`;

  try {
    const { text } = await callGeminiWithFallback({
      systemInstruction: SYSTEM_INSTRUCTION,
      prompt,
      schema: RESULT_SCHEMA,
      temperature: 0.4,
    });
    const result = parseJsonLenient(text);
    if (!result || !result.formalDefenseBody) {
      console.error('tax-defense: unparseable output len=' + text.length);
      return res.status(502).json({ ok: false, error: 'تولید لایحه ناموفق بود؛ دوباره تلاش کنید.' });
    }
    console.log(`tax-defense: ok ms=${Date.now() - started} body_len=${result.formalDefenseBody.length}`);
    return res.json({ ok: true, result });
  } catch (e) {
    return sendError(res, e, 'خطا در تولید لایحه دفاعیه');
  }
}

export const config = { maxDuration: 60 };
