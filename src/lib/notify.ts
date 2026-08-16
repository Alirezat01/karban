export async function notifyAdmin(message: string) {
  try {
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, text }),
    });
    const json = await res.json();
    return !!json.ok;
  } catch (err) {
    console.warn('email failed', err);
    return false;
  }
}
