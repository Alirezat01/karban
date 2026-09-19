/* ═════════════════════════════════════════════════════════════════════
   اعلان کاربان — تلگرام ادمین + ایمیل (Resend)
   ─────────────────────────────────────────────────────────────────
   سخت‌سازی امنیتی (رفع ریسک relay باز):
   • محدودیت نرخ درخواست به‌ازای هر IP (حافظه نمونه سرور — لایه اول دفاع)
   • سقف طول متن/موضوع + اعتبارسنجی فرمت ایمیل مقصد
   • اختیاری: با تنظیم NOTIFY_TOKEN در ورسل، فراخواننده باید
     ?key=... یا هدر x-notify-key بفرستد (اگر تنظیم نشود، باز است
     ولی با rate-limit و سقف حجم محافظت می‌شود)
   ═════════════════════════════════════════════════════════════════════ */

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  /* ── توکن اختیاری ── */
  const NOTIFY_TOKEN = process.env.NOTIFY_TOKEN || '';
  if (NOTIFY_TOKEN) {
    const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const provided = u.searchParams.get('key') || req.headers['x-notify-key'] || '';
    if (provided !== NOTIFY_TOKEN) return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  /* ── محدودیت نرخ per-IP (بافر نمونه — هر آنی لامبدا ریست می‌شود ولی جلوی بمباران ساده را می‌گیرد) ── */
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

  /* ── مسیر ۲: ایمیل مستقیم به کاربر (to + subject) ── */
  if (resendKey && emailOk(to) && safeSubject) {
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

  res.status(200).json({ ok: true, results });
}
