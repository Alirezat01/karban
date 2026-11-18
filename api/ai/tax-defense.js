/* ═════════════════════════════════════════════════════════════════════
   کاربان سوپراپ — تولید لایحه دفاعیه مالیاتی و اداره کار
   ─────────────────────────────────────────────────────────────────
   اندپوینت: POST /api/ai/tax-defense
   ورودی JSON:
     {
       "kind": "tax" | "labor",          (پیش‌فرض tax)
       "facts": "...",                    الزامی — شرح پرونده توسط کاربر
       "taxpayerName": "نام مودی/شرکت",
       "targetBody": "مثلاً اداره مالیات / اداره کار",
       "documents": "توضیح مدارک موجود",
       "claimedAmount": 0                 مبلغ مورد اختلاف (اختیاری)
     }
   خروجی JSON:
     { ok: true, letter: { title, body }, model, ms }
   • مستندسازی به مواد قانونی: مالیات → ۱۶۹، ۱۷۳، ۲۴۴، ۲۵۱ مکرر، ۱۴۷ و ۱۴۸
     ق.م.م؛ کار → مواد مرتبط قانون کار و تأمین اجتماعی.
   • کلید GEMINI_API_KEY فقط سمت سرور؛ سقف درخواست per-IP.
   • خروجی فقط متن لایحه است؛ تصمیم نهایی با کارشناس انسانی — در پاسخ هم
     یادداشت سلب مسئولیت برگردانده می‌شود.
   ═════════════════════════════════════════════════════════════════════ */

const GEMINI_PRIMARY = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const GEMINI_FALLBACK = 'gemini-3.5-flash-lite';
const MAX_FACTS_CHARS = 8000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 10; /* ۱۰ لایحه در ۱۰ دقیقه از هر IP */

const hitCounter = new Map();

function rateLimit(ip) {
  const now = Date.now();
  const arr = (hitCounter.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) return false;
  arr.push(now);
  hitCounter.set(ip, arr);
  if (hitCounter.size > 5000) hitCounter.clear();
  return true;
}

const DISCLAIMER = 'این متن با هوش مصنوعی کاربان تولید شده و جنبه راهنما و پیش‌نویس دارد؛ پیش از ثبت رسمی، آن را با کارشناس مالیاتی یا حقوقی بازبینی کنید.';

function buildPrompt(input) {
  const isTax = input.kind !== 'labor';
  const laws = isTax
    ? '- ماده ۱۶۹ ق.م.م: تکلیف صورت معاملات فصلی و جرائم مرتبط\n- ماده ۱۴۷ و ۱۴۸ ق.م.م: هزینه‌های قابل قبول و مستندات آن\n- ماده ۱۷۳ ق.م.م: مالیات ارزانی‌شده مازاد بر ۱۵ درصد\n- ماده ۲۴۴ ق.م.م: تجدیدنظرخواهی مالیاتی\n- ماده ۲۵۱ مکرر ق.م.م: اعتراض به هیئت حل اختلاف مالیاتی\n- ماده ۹۷ ق.م.م: رسیدگی به پرونده بدون رعایت تشریفات'
    : '- ماده ۷ و ۱۰ قانون کار: الزامات قرارداد کتبی کار\n- ماده ۲۴ و ۲۷ قانون کار: فسخ قرارداد و شرایط موجه\n- ماده ۳۸ قانون تأمین اجتماعی: نرخ حق بیمه سهم کارگر و کارفرما\n- ماده ۱۵۸ و ۱۶۵ قانون کار: حق مرجع و رسیدگی اختلافات\n- ماده ۱۶۶ قانون کار: مراجع حل اختلاف';

  const target = input.targetBody || (isTax ? 'هیئت حل اختلاف مالیاتی' : 'اداره کار / مراجع حل اختلاف');
  const taxpayer = input.taxpayerName || 'ماتٌ‌به';
  const amount = input.claimedAmount && input.claimedAmount > 0
    ? `مبلغ مورد اختلاف: ${input.claimedAmount.toLocaleString('fa-IR')} ریال\n`
    : '';

  return `تو مشاور ارشد حقوقی-مالیاتی کاربان هستی و باید یک لایحه دفاعیه رسمی اداری به زبان فارسی بنویسی.

نوع پرونده: ${isTax ? 'مالیاتی' : 'اداره کار و تأمین اجتماعی'}
مقصد لایحه: ${target}
نام مودی/طرف: ${taxpayer}
${amount}مدارک موجود: ${input.documents || 'اعلام نشده'}

شرح وقایع از زبان کاربر:
"""
${input.facts}
"""

مواد قانونی قابل استناد:
${laws}

ساختار الزامی خروجی:
۱) عنوان لایحه (شامل نام مقصد و موضوع)
۲) مقدمه و معرفی ماتٌ‌به
۳) خلاصه وقایع به ترتیب زمانی
۴) استدلال‌های دفاعی با استناد صریح به مواد قانونی بالا (شماره ماده در متن بیاید)
۵) نتیجه و خواسته نهایی (صریح و قابل درج در بخشنامه)
۶) بند امضا و مکان

قواعد: لحن کاملاً رسمی اداری فارسی؛ هیچ ادعایی بدون پشتوانه از شرح وقایع ساخته نشود؛ جاهای خالی با علامت 【】 مشخص شود؛ طول متن بین ۵۰۰ تا ۹۰۰ کلمه.

خروجی را فقط به‌صورت JSON زیر برگردان (بدون هیچ متن اضافه):
{ "title": "عنوان لایحه", "body": "متن کامل لایحه با پاراگراف‌بندی" }`;
}

async function callGemini(modelName, prompt, timeoutMs) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
    systemInstruction: { parts: [{ text: 'تو وکیل و مشاور مالیاتی کاربان هستی؛ لوایح رسمی، مستند و بی‌غلط اداری فارسی می‌نویسی.' }] },
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body,
      signal: controller.signal,
    });
    if (!res.ok) {
      const raw = await res.text().catch(() => '');
      const err = new Error(`gemini ${res.status}: ${raw.slice(0, 200)}`);
      err.status = res.status;
      throw err;
    }
    const j = await res.json();
    const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
    if (!text) {
      const err = new Error('پاسخ خالی از Gemini');
      err.empty = true;
      throw err;
    }
    return text;
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseJsonLenient(text) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return JSON.parse(text.slice(start, end + 1)); } catch { /* noop */ }
    }
    return null;
  }
}

export default async function handler(req, res) {
  const started = Date.now();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  if (!rateLimit(ip)) {
    return res.status(429).json({ ok: false, error: 'تعداد درخواست‌ها زیاد است؛ کمی بعد تلاش کنید.' });
  }

  const { kind, facts, taxpayerName, targetBody, documents, claimedAmount } = req.body || {};
  const caseKind = kind === 'labor' ? 'labor' : 'tax';

  if (!facts || typeof facts !== 'string' || facts.trim().length < 30) {
    return res.status(400).json({ ok: false, error: 'شرح پرونده باید حداقل یک خط کامل باشد.' });
  }
  const factsText = facts.slice(0, MAX_FACTS_CHARS);

  console.log(`tax-defense: kind=${caseKind} ip_hash=${ip.slice(0, 8)} facts_len=${factsText.length}`);

  try {
    const prompt = buildPrompt({ kind: caseKind, facts: factsText, taxpayerName, targetBody, documents, claimedAmount });
    let text = null;
    try {
      text = await callGemini(GEMINI_PRIMARY, prompt, 55000);
    } catch (e) {
      console.error('tax-defense: primary failed status=' + (e.status || 'none') + ' msg=' + e.message);
      if (e.empty) throw e;
      text = await callGemini(GEMINI_FALLBACK, prompt, 55000);
    }

    const parsed = parseJsonLenient(text);
    const letter = parsed && typeof parsed.title === 'string' && typeof parsed.body === 'string'
      ? { title: parsed.title, body: parsed.body }
      : { title: 'لایحه دفاعیه', body: text };

    console.log(`tax-defense: ok ms=${Date.now() - started} body_len=${letter.body.length}`);
    return res.json({
      ok: true,
      letter: { ...letter, disclaimer: DISCLAIMER },
      model: GEMINI_PRIMARY,
      ms: Date.now() - started,
    });
  } catch (e) {
    console.error('tax-defense: failed ms=' + (Date.now() - started) + ' msg=' + e.message);
    if (e.name === 'AbortError') return res.status(504).json({ ok: false, error: 'تولید لایحه طول کشید؛ دوباره تلاش کنید.' });
    if (e.empty) return res.status(502).json({ ok: false, error: 'پاسخ خالی از هوش مصنوعی؛ دوباره تلاش کنید.' });
    if (e.status === 401 || e.status === 403) return res.status(502).json({ ok: false, error: 'سرویس تولید لایحه موقتاً در دسترس نیست.' });
    if (e.status === 429) return res.status(429).json({ ok: false, error: 'محدودیت سرویس هوش مصنوعی — کمی بعد تلاش کنید.' });
    return res.status(502).json({ ok: false, error: 'تولید لایحه ناموفق بود؛ دوباره تلاش کنید.' });
  }
}

export const config = { maxDuration: 60 };
