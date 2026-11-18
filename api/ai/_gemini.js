/* ═════════════════════════════════════════════════════════════════════
   هسته مشترک فراخوانی Gemini برای توابع اپ موبایل کاربان
   ─────────────────────────────────────────────────────────────────
   • این فایل اندپوینت نیست (پیشوند _) — فقط ماژول مشترک است.
   • قرارداد درخواست/پاسخ هر اندپوینت دقیقاً مطابق mobile-app/server.ts
     (نسخه جمینای) بازسازی شده تا اپ بدون هیچ تغییری کار کند.
   • کلید GEMINI_API_KEY فقط سمت سرور خوانده می‌شود.
   ═════════════════════════════════════════════════════════════════════ */

export const MODEL_PRIMARY = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
export const MODEL_FALLBACK = 'gemini-3.5-flash-lite';

/* محدودساز per-IP در حافظه نمونه — هر اندپوینت Map خودش را می‌سازد */
export function rateLimit(map, ip, max, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const arr = (map.get(ip) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) return false;
  arr.push(now);
  map.set(ip, arr);
  if (map.size > 5000) map.clear(); /* پاک‌سازی دوره‌ای حافظه */
  return true;
}

export function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
}

/**
 * یک فراخوانی Gemini REST — خروجی: متن پاسخ
 * schema  → اگر داده شود، responseMimeType=application/json فعال می‌شود
 * parts   → برای ورودی چندبخشی (مثل تصویر base64 + متن)
 * prompt  → ورودی متنی ساده
 */
export async function callGemini({ model, systemInstruction, prompt, parts, schema, temperature = 0.2, maxOutputTokens = 4096 }, timeoutMs = 55000) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const e = new Error('GEMINI_API_KEY not set');
    e.noKey = true;
    throw e;
  }

  const generationConfig = { temperature, maxOutputTokens };
  if (schema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = schema;
  }

  const body = {
    contents: [{ role: 'user', parts: parts || [{ text: prompt }] }],
    generationConfig,
    ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
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

/* مدل اصلی را امتحان می‌کند؛ در خطای سرویس به مدل سبک fallback می‌کند */
export async function callGeminiWithFallback(options) {
  try {
    return { text: await callGemini({ ...options, model: options.model || MODEL_PRIMARY }), model: options.model || MODEL_PRIMARY };
  } catch (e) {
    if (e.noKey || e.empty || e.name === 'AbortError') throw e;
    console.error(`gemini: primary (${options.model || MODEL_PRIMARY}) failed — fallback to ${MODEL_FALLBACK}: ${e.message}`);
    return { text: await callGemini({ ...options, model: MODEL_FALLBACK }), model: MODEL_FALLBACK };
  }
}

/* JSON مدل را حتی وقتی با متن اضافه آمده، تلاش می‌کند بخواند */
export function parseJsonLenient(text) {
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

/* نگاشت یکسان خطاها به پاسخ HTTP — پیام‌ها مطابق پیام‌های server.ts اپ */
export function sendError(res, e, fallbackMessage) {
  console.error('gemini endpoint failed: ' + (e.message || e));
  if (e.name === 'AbortError') return res.status(504).json({ ok: false, error: 'پاسخ‌گویی طول کشید؛ دوباره تلاش کنید.' });
  if (e.empty) return res.status(502).json({ ok: false, error: 'پاسخ خالی از هوش مصنوعی؛ دوباره تلاش کنید.' });
  if (e.noKey) return res.status(502).json({ ok: false, error: 'سرویس هوش مصنوعی پیکربندی نشده است.' });
  if (e.status === 429) return res.status(429).json({ ok: false, error: 'محدودیت سرویس هوش مصنوعی — کمی بعد تلاش کنید.' });
  return res.status(502).json({ ok: false, error: fallbackMessage });
}
