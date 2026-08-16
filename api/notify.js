export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const { text, to, subject } = req.body || {};
  const results = {};

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (token && chatId && text) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
      results.telegram = await r.json();
    } catch (e) {
      results.telegram = { ok: false, error: String(e) };
    }
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && to && subject) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Karban <onboarding@resend.dev>',
          to: [to],
          subject,
          text: text || subject,
        }),
      });
      results.email = await r.json();
    } catch (e) {
      results.email = { ok: false, error: String(e) };
    }
  }

  res.status(200).json({ ok: true, results });
}
