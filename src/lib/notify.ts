/* کلید فراخوانی /api/notify — همان مقدار NOTIFY_TOKEN در ورسل.
   در زمان بیلد از VITE_NOTIFY_KEY خوانده می‌شود؛ اگر تنظیم نشده باشد
   سرور درخواست را با 401 رد می‌کند و توابع false برمی‌گردانند
   (فراخوانی‌ها همگی fire-and-forget هستند و جریان اصلی را نمی‌شکنند). */
const NOTIFY_KEY = String(import.meta.env.VITE_NOTIFY_KEY || '');
const authHeaders: Record<string, string> = NOTIFY_KEY ? { 'x-notify-key': NOTIFY_KEY } : {};

export async function notifyAdmin(message: string) {
  try {
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ text: message }),
    });
    const json = await res.json();
    return !!json.ok;
  } catch (err) {
    console.warn('notify failed', err);
    return false;
  }
}

export async function sendEmail(to: string, subject: string, text: string) {
  try {
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ to, subject, text }),
    });
    const json = await res.json();
    return !!json.ok;
  } catch (err) {
    console.warn('email failed', err);
    return false;
  }
}
