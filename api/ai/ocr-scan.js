/* ═════════════════════════════════════════════════════════════════════
   کاربان سوپراپ — اسکنر هوشمند فاکتور و چک صیادی (AI OCR)
   ─────────────────────────────────────────────────────────────────
   اندپوینت: POST /api/ai/ocr-scan
   ورودی JSON:
     {
       "image":   "data:image/jpeg;base64,..."  یا base64 خالص,
       "docType": "invoice" | "check"          (پیش‌فرض invoice)
     }
   خروجی JSON:
     { ok: true, docType, data: {...}, model, ms }
   • کلید GEMINI_API_KEY فقط سمت سرور خوانده می‌شود و هرگز به کلاینت
     نمی‌رود — دقیقاً مثل api/ai-chat.js.
   • سقف حجم تصویر ۱۰ مگابایت؛ محدودساز per-IP در حافظه نمونه.
   • مدل اصلی با fallback مطابق قرارداد بقیه توابع AI کاربان.
   ═════════════════════════════════════════════════════════════════════ */

const GEMINI_PRIMARY = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const GEMINI_FALLBACK = 'gemini-3.5-flash-lite';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; /* ۱۰ مگابایت */
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 20; /* ۲۰ اسکن در ۱۰ دقیقه از هر IP */

const hitCounter = new Map();

function rateLimit(ip) {
  const now = Date.now();
  const arr = (hitCounter.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) return false;
  arr.push(now);
  hitCounter.set(ip, arr);
  if (hitCounter.size > 5000) hitCounter.clear(); /* پاک‌سازی دوره‌ای حافظه */
  return true;
}

function parseImagePayload(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const match = raw.match(/^data:([^;]+);base64,(.+)$/s);
  if (match) return { mime: match[1], data: match[2] };
  return { mime: 'image/jpeg', data: raw };
}

const INVOICE_PROMPT = `تو موتور OCR حسابداری کاربان هستی. این تصویر یک فاکتور یا صورتحساب کاغذی ایرانی است.
همه متن‌های فارسی را با دقت بخوان و اطلاعات را در قالب JSON زیر برگردان (اگر فیلدی در تصویر نیست، null بگذار):
{
  "vendor_name": "نام فروشنده",
  "vendor_national_id": "شناسه ملی یا کد اقتصادی یا null",
  "invoice_number": "شماره فاکتور یا null",
  "date_jalali": "تاریخ به شمسی مثل ۱۴۰۵/۰۸/۲۷ یا null",
  "items": [{ "description": "شرح کالا/خدمت", "quantity": 1, "unit_price": 0, "total": 0 }],
  "subtotal": 0,
  "discount": 0,
  "vat_amount": 0,
  "vat_percent": 10,
  "grand_total": 0,
  "total_in_words": "مبلغ به حروف فارسی یا null",
  "confidence": "high | medium | low"
}
فقط و فقط JSON معتبر برگردان؛ هیچ توضیح اضافه‌ای ننویس. اعداد را به‌صورت عدد (بدون جداکننده) برگردان.`;

const CHECK_PROMPT = `تو موتور OCR کاربان هستی. این تصویر یک برگه چک صیادی ایرانی است.
فیلدهای چک را با دقت بخوان و در قالب JSON زیر برگردان (اگر فیلدی خوانا نیست، null بگذار):
{
  "sayadi_id": "شناسه ۱۶ رقمی صیادی",
  "amount": 0,
  "amount_in_words": "مبلغ به حروف فارسی",
  "due_date_jalali": "تاریخ سررسید شمسی مثل ۱۴۰۵/۰۹/۱۵ یا null",
  "issue_date_jalali": "تاریخ صدور شمسی یا null",
  "bank_name": "نام بانک",
  "branch": "شعبه یا null",
  "drawer_name": "نام صادرکننده",
  "payee_name": "در وجهِ",
  "status_color": "white | yellow | red | null",
  "confidence": "high | medium | low"
}
فقط و فقط JSON معتبر برگردان؛ هیچ توضیح اضافه‌ای ننویس. مبلغ را به‌صورت عدد (ریال یا تومان همان‌طور که روی چک است) برگردان.`;

async function callGeminiVision(modelName, prompt, image, timeoutMs) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const body = JSON.stringify({
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { inline_data: { mime_type: image.mime, data: image.data } },
      ],
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
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
    return res.status(429).json({ ok: false, error: 'تعداد درخواست‌های اسکن زیاد است؛ کمی بعد تلاش کنید.' });
  }

  const { image, docType } = req.body || {};
  const type = docType === 'check' ? 'check' : 'invoice';

  const parsed = parseImagePayload(image);
  if (!parsed || !parsed.data) {
    return res.status(400).json({ ok: false, error: 'تصویری ارسال نشده است.' });
  }
  if (!ALLOWED_MIME.includes(parsed.mime)) {
    return res.status(400).json({ ok: false, error: 'فرمت تصویر باید JPG، PNG یا WebP باشد.' });
  }
  if (parsed.data.length > MAX_IMAGE_BYTES) {
    return res.status(413).json({ ok: false, error: 'حجم تصویر بیش از ۱۰ مگابایت است.' });
  }

  const prompt = type === 'check' ? CHECK_PROMPT : INVOICE_PROMPT;
  const base64Bytes = Math.floor(parsed.data.length * 0.75);
  console.log(`ocr-scan: type=${type} ip_hash=${ip.slice(0, 8)} bytes=${base64Bytes}`);

  try {
    let text = null;
    try {
      text = await callGeminiVision(GEMINI_PRIMARY, prompt, parsed, 55000);
    } catch (e) {
      console.error('ocr-scan: primary failed status=' + (e.status || 'none') + ' msg=' + e.message);
      if (e.empty) throw e;
      text = await callGeminiVision(GEMINI_FALLBACK, prompt, parsed, 55000);
    }

    const data = parseJsonLenient(text);
    if (!data) {
      console.error('ocr-scan: unparseable model output len=' + text.length);
      return res.status(502).json({ ok: false, error: 'خوانش تصویر ناموفق بود؛ عکس واضح‌تر و از نزدیک‌تر بگیرید.' });
    }

    console.log(`ocr-scan: ok ms=${Date.now() - started}`);
    return res.json({ ok: true, docType: type, data, model: GEMINI_PRIMARY, ms: Date.now() - started });
  } catch (e) {
    console.error('ocr-scan: failed ms=' + (Date.now() - started) + ' msg=' + e.message);
    if (e.name === 'AbortError') return res.status(504).json({ ok: false, error: 'خوانش طول کشید؛ دوباره تلاش کنید.' });
    if (e.empty) return res.status(502).json({ ok: false, error: 'پاسخ خالی از هوش مصنوعی؛ عکس را واضح‌تر بگیرید.' });
    if (e.status === 401 || e.status === 403) return res.status(502).json({ ok: false, error: 'سرویس اسکن موقتاً در دسترس نیست.' });
    if (e.status === 429) return res.status(429).json({ ok: false, error: 'محدودیت سرویس هوش مصنوعی — کمی بعد تلاش کنید.' });
    return res.status(502).json({ ok: false, error: 'خوانش تصویر ناموفق بود؛ دوباره تلاش کنید.' });
  }
}

export const config = { maxDuration: 60 };
