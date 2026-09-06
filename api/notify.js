export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const { text, to, subject } = req.body || {};
  const results = {};

  const resendKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM || 'Karban <onboarding@resend.dev>';

  /* ── مسیر ۱: اعلان ادمین (فقط متن، بدون to) → تلگرام + کپی ایمیلی ── */
  if (text && !to) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (token && chatId) {
      try {
        const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text }),
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
    if (resendKey && adminEmail) {
      const firstLine = (text.split('\n')[0] || 'اطلاع‌رسانی').slice(0, 80);
      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: resendFrom,
            to: [adminEmail],
            subject: `کاربان: ${firstLine}`,
            text,
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
  if (resendKey && to && subject) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: resendFrom,
          to: [to],
          subject,
          text: text || subject,
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
