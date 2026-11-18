/* ═════════════════════════════════════════════════════════════════════
   کاربان سوپراپ — مشاور هوشمند حقوقی، مالیاتی و حسابداری (چت چندمرحله‌ای)
   ─────────────────────────────────────────────────────────────────
   اندپوینت: POST /api/ai/legal-chat
   قرارداد دقیقاً مطابق mobile-app/server.ts (نسخه جمینای):
   ورودی JSON: { message, history: [{role, text}] }
   خروجی JSON: { ok: true, reply }  — کلاینت reply یا error را می‌خواند
   ═════════════════════════════════════════════════════════════════════ */
import { callGeminiWithFallback, rateLimit, clientIp, sendError } from './_gemini.js';

const RATE_MAX = 40; /* چت روزانه — سقف نرم ۱۰ دقیقه‌ای */
const hitCounter = new Map();

const SYSTEM_INSTRUCTION = `شما دستیار هوشمند حقوقی، مالیاتی، بیمه تأمین اجتماعی و حسابداری «کاربان» (KarbanApp.ir) هستید.
پاسخ‌های شما باید کاملاً دقیق، مستند به قوانین جاری ایران (نرخ‌های مصوب ۱۴۰۵، ارزش افزوده ۱۰٪، قوانین سامانه مودیان، قانون کار و تأمین اجتماعی)، کاربردی و مختصر و مفید باشد.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  if (!rateLimit(hitCounter, clientIp(req), RATE_MAX)) {
    return res.status(429).json({ ok: false, error: 'سقف درخواست‌ها پر شده؛ کمی بعد تلاش کنید.' });
  }

  const { message, history } = req.body || {};
  if (!message || typeof message !== 'string' || message.trim().length < 2) {
    return res.status(400).json({ ok: false, error: 'پرسش بسیار کوتاه است.' });
  }

  const started = Date.now();
  const contextText = Array.isArray(history)
    ? history
        .slice(-10)
        .map((m) => `${m && m.role === 'user' ? 'کاربر' : 'کاربان'}: ${(m && m.text) || ''}`)
        .join('\n')
    : '';

  const prompt = `${contextText ? `سابقه گفتگو:\n${contextText}\n\n` : ''}پرسش جدید کاربر: ${message}`;

  try {
    const { text } = await callGeminiWithFallback({
      systemInstruction: SYSTEM_INSTRUCTION,
      prompt,
      temperature: 0.5,
      maxOutputTokens: 2048,
    });
    console.log(`legal-chat: ok ms=${Date.now() - started}`);
    return res.json({ ok: true, reply: text });
  } catch (e) {
    return sendError(res, e, 'خطا در ارتباط با مشاور هوشمند');
  }
}

export const config = { maxDuration: 60 };
