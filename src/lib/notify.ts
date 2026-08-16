const token = import.meta.env.VITE_TELEGRAM_BOT_TOKEN as string | undefined;
const chatId = import.meta.env.VITE_TELEGRAM_CHAT_ID as string | undefined;

export async function notifyAdmin(message: string) {
  if (!token || !chatId) {
    console.warn('telegram env missing');
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });
    const json = await res.json();
    if (!json.ok) console.warn('telegram error', json.description);
    return !!json.ok;
  } catch (err) {
    console.warn('telegram send failed', err);
    return false;
  }
}
