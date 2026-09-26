/* ═════════════════════════════════════════════════════════════════════
   اعلان کاربان — تلگرام ادمین + ایمیل (Resend)
   ─────────────────────────────────────────────────────────────────
   سخت‌سازی امنیتی (بستن کامل relay باز — ۲۰۲۶-۰۹):
   • توکن اجباری: اگر NOTIFY_TOKEN در ورسل تنظیم نشده باشد endpoint با
     503 رد می‌شود (fail-closed) — دیگر هیچ مسیر «باز پیش‌فرض» وجود ندارد.
   • فراخواننده باید ?key=... یا هدر x-notify-key (مقدار NOTIFY_TOKEN)
     بفرستد؛ فرانت همین مقدار را از VITE_NOTIFY_KEY می‌خواند.
   • سقف روزانهٔ پایدار (جدول site_secrets — در برابر cold start مقاوم):
       - کل: حداکثر ۱۵۰ درخواست موفق در شبانه‌روز (Asia/Tehran)
       - گیرندهٔ ایمیل: حداکثر ۳ ایمیل به یک آدرس در شبانه‌روز
   • لایهٔ اول: محدودیت نرخ per-IP در حافظهٔ نمونه (۸ درخواست در ۱۰ دقیقه)
   • سقف طول متن/موضوع + اعتبارسنجی فرمت ایمیل مقصد
   تنظیمات لازم در Vercel → Settings → Environment Variables:
       NOTIFY_TOKEN   = یک مقدار تصادفی طولانی (مثلاً openssl rand -hex 32)
       VITE_NOTIFY_KEY = همان مقدار (برای بیلد فرانت)
   ═════════════════════════════════════════════════════════════════════ */

const GLOBAL_DAILY_MAX = 150; /* سقف کل شبانه‌روزی */
const PER_RECIPIENT_DAILY_MAX = 3; /* سقف هر ایمیل مقصد در شبانه‌روز */
const COUNTERS_KEY = 'notify_daily_counters';

function tehranDay() {
  /* تاریخ شمسی لازم نیست؛ فقط کلید شبانه‌روزی به وقت تهران کافی است */
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date());
}

function safeParse(s) {
  try { return typeof s === 'string' ? JSON.parse(s) : s; } catch { return null; }
}

async function srFetch(URL, SRK, path, method = 'GET', body = null) {
  const r = await fetch(`${URL}/${path}`, {
    method,
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* noop */ }
  return { status: r.status, json, text };
}

async function readSecret(URL, SRK, key) {
  const r = await srFetch(URL, SRK, `rest/v1/site_secrets?key=eq.${encodeURIComponent(key)}&select=value`);
  return Array.isArray(r.json) && r.json[0] ? r.json[0].value : null;
}

/* upsert بدون تکیه بر on_conflict: اول PATCH، اگر نبود POST */
async function writeSecret(URL, SRK, key, value) {
  const p = await srFetch(URL, SRK, `rest/v1/site_secrets?key=eq.${encodeURIComponent(key)}`, 'PATCH', { value, updated_at: new Date().toISOString() });
  if (p.status === 204) return true;
  const ins = await srFetch(URL, SRK, 'rest/v1/site_secrets', 'POST', { key, value, updated_at: new Date().toISOString() });
  return ins.status === 201;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  /* ── توکن اجباری (fail-closed) ── */
  const NOTIFY_TOKEN = process.env.NOTIFY_TOKEN || '';
  if (!NOTIFY_TOKEN) return res.status(503).json({ ok: false, error: 'service_not_configured' });
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const provided = u.searchParams.get('key') || req.headers['x-notify-key'] || '';
  if (provided !== NOTIFY_TOKEN) return res.status(401).json({ ok: false, error: 'unauthorized' });

  /* ── لایهٔ اول: محدودیت نرخ per-IP (حافظه نمونه) ── */
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  if (!globalThis.__notifyHits) globalThis.__notifyHits = new Map();
  const hits = globalThis.__notifyHits;
  const WINDOW = 10 * 60 * 1000, MAX_HITS = 8;
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW);
  if (recent.length >= MAX_HITS) {
    return res.status(429).json({ ok: false, error: 'rate_limited', retry_after_sec: Math.ceil((WINDOW - (now - recent[0])) / 1000) });
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) { /* جلوگیری از رشد بی‌رویه حافظه */
    for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW)) hits.delete(k);
  }

  /* ── اعتبارسنجی ورودی ── */
  const { text, to, subject } = req.body || {};
  const safeText = typeof text === 'string' ? text.slice(0, 3000) : '';
  const safeSubject = typeof subject === 'string' ? subject.slice(0, 200) : '';
  const emailOk = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 254;

  const results = {};

  /* ── سقف روزانهٔ پایدار (site_secrets — در برابر cold start مقاوم) ── */
  const SUPA_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://rocjeanizzhfvhnuhnms.supabase.co').replace(/\/+$/, '');
  const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_ROLE_KEY || '';
  const day = tehranDay();
  let counters = null;
  if (SRK) {
    const raw = await readSecret(SUPA_URL, SRK, COUNTERS_KEY);
    const parsed = safeParse(raw);
    counters = parsed && parsed.date === day ? parsed : { date: day, total: 0, recipients: {} };
    if (!counters.recipients || typeof counters.recipients !== 'object') counters.recipients = {};
    if (counters.total >= GLOBAL_DAILY_MAX) {
      return res.status(429).json({ ok: false, error: 'daily_global_cap_reached', cap: GLOBAL_DAILY_MAX });
    }
    if (emailOk(to) && (counters.recipients?.[to] || 0) >= PER_RECIPIENT_DAILY_MAX) {
      return res.status(429).json({ ok: false, error: 'daily_recipient_cap_reached', cap: PER_RECIPIENT_DAILY_MAX });
    }
  }
  /* اگر SRK در دسترس نبود، لایهٔ حافظه‌ای per-IP تنها دفاع است — ولی توکن اجباری همچنان برقرار است */

  const resendKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM || 'Karban <onboarding@resend.dev>';

  /* ── مسیر ۱: اعلان ادمین (فقط متن، بدون to) → تلگرام + کپی ایمیلی ── */
  if (safeText && !to) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (token && chatId) {
      try {
        const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: safeText }),
        });
        results.telegram = await r.json();
        if (!results.telegram.ok) {
          console.warn('[notify] telegram failed:', JSON.stringify(results.telegram));
        }
      } catch (e) {
        results.telegram = { ok: false, error: String(e) };
        console.warn('[notify] telegram exception:', String(e));
      }
    } else {
      results.telegram = { ok: false, skipped: true, reason: 'TELEGRAM_BOT_TOKEN یا TELEGRAM_CHAT_ID در Vercel تنظیم نشده' };
      console.warn('[notify] telegram skipped: env missing');
    }

    const adminEmail = process.env.ADMIN_NOTIFY_EMAIL;
    if (resendKey && emailOk(adminEmail)) {
      const firstLine = (safeText.split('\n')[0] || 'اطلاع‌رسانی').slice(0, 80);
      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: resendFrom,
            to: [adminEmail],
            subject: `کاربان: ${firstLine}`,
            text: safeText,
          }),
        });
        results.adminEmail = await r.json();
        if (results.adminEmail.statusCode || results.adminEmail.error) {
          console.warn('[notify] admin email failed:', JSON.stringify(results.adminEmail));
        }
      } catch (e) {
        results.adminEmail = { ok: false, error: String(e) };
        console.warn('[notify] admin email exception:', String(e));
      }
    }
  }

  /* ── مسیر ۲: ایمیل مستقیم به کاربر (to + subject) ──
     گارد ضد relay: موضوع باید با پیشوند برند شروع شود + سقف per-recipient
     بالاتر اعمال شد. الگوی مصرف واقعی: تأیید سفارش با قالب ثابت. */
  if (resendKey && emailOk(to) && safeSubject) {
    if (!safeSubject.startsWith('کاربان:')) {
      results.email = { ok: false, error: 'subject_prefix_required' };
      console.warn('[notify] user email rejected: subject must start with brand prefix');
    } else {
      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: resendFrom,
            to: [to],
            subject: safeSubject,
            text: safeText || safeSubject,
          }),
        });
        results.email = await r.json();
        if (results.email.statusCode || results.email.error) {
          console.warn('[notify] user email failed:', JSON.stringify(results.email));
        }
      } catch (e) {
        results.email = { ok: false, error: String(e) };
        console.warn('[notify] user email exception:', String(e));
      }
    }
  }

  /* ── ثبت شمارنده‌های روزانه (فقط درخواست‌های رسیده‌به‌اینجا) ── */
  if (SRK && counters) {
    counters.total += 1;
    if (emailOk(to)) counters.recipients[to] = (counters.recipients[to] || 0) + 1;
    /* خروجی‌های کانتینر value ممکن است رشته یا آبجکت ذخیره شوند — JSON رشته‌ای امن‌تر است */
    await writeSecret(SUPA_URL, SRK, COUNTERS_KEY, JSON.stringify(counters));
  }

  res.status(200).json({ ok: true, results });
}
