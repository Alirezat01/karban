/* اتصال تلگرام ادمین — تنظیم و ارسال از سمت کلاینت
   معماری:
   • توکن ربات و chat_id در جدول site_secrets ذخیره می‌شود (RLS فقط ادمین)
   • ادمین می‌تواند از پنل، پیام تست بفرستد (Telegram Bot API مستقیم از مرورگر — CORS مجاز است)
   • رویدادهای کاربران (سفارش، تریال، تیکت…) در telegram_queue صف می‌شوند؛
     پنل ادمین موقع باز شدن صف را می‌کشد و ارسال می‌کند (بدون نیاز به سرور اضافه)
   • رویدادهای مهم سمت ادمین (یادآور سررسیدها) مستقیم ارسال می‌شوند */

import { supabase } from '@/lib/supabase';

export interface TelegramConfig {
  bot_token: string;
  chat_id: string;
  /** کدام رویدادها پیام بدهند */
  notify_orders: boolean;
  notify_trials: boolean;
  notify_tickets: boolean;
  notify_invoices: boolean;
  notify_users: boolean;
  enabled: boolean;
}

export const DEFAULT_TELEGRAM_CONFIG: TelegramConfig = {
  bot_token: '',
  chat_id: '',
  notify_orders: true,
  notify_trials: true,
  notify_tickets: true,
  notify_invoices: true,
  notify_users: true,
  enabled: false,
};

const SECRET_KEY = 'telegram_admin';

export async function fetchTelegramConfig(): Promise<TelegramConfig> {
  try {
    const { data } = await supabase.from('site_secrets').select('value').eq('key', SECRET_KEY).maybeSingle();
    if (!data?.value) return { ...DEFAULT_TELEGRAM_CONFIG };
    return { ...DEFAULT_TELEGRAM_CONFIG, ...(data.value as Partial<TelegramConfig>) };
  } catch {
    return { ...DEFAULT_TELEGRAM_CONFIG };
  }
}

export async function saveTelegramConfig(cfg: TelegramConfig): Promise<void> {
  const { error } = await supabase
    .from('site_secrets')
    .upsert({ key: SECRET_KEY, value: cfg, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/* ارسال مستقیم از مرورگر به Bot API (ادمین) */
export async function sendTelegramDirect(cfg: TelegramConfig, text: string): Promise<{ ok: boolean; error?: string }> {
  if (!cfg.bot_token || !cfg.chat_id) return { ok: false, error: 'توکن ربات یا شناسه چت تنظیم نشده است' };
  try {
    const res = await fetch(`https://api.telegram.org/bot${cfg.bot_token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: cfg.chat_id, text, parse_mode: 'HTML' }),
    });
    const json = await res.json();
    return json.ok ? { ok: true } : { ok: false, error: json.description || 'ارسال ناموفق بود' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطای شبکه' };
  }
}

/* صف پیام برای رویدادهای کاربران — بدون توکن، امن */
export async function enqueueTelegram(text: string, kind = 'event'): Promise<void> {
  try {
    const { error } = await supabase.from('telegram_queue').insert({ text, kind });
    if (error) console.warn('telegram queue failed', error.message);
  } catch {
    /* صف هرگز جریان اصلی را نمی‌شکند */
  }
}

/* اعلان رویداد ادمین: اول کانال سروری (Resend/env)، اگر کار نکرد صف کلاینتی */
export async function notifyTelegram(text: string, kind = 'event'): Promise<void> {
  try {
    const { notifyAdmin } = await import('@/lib/notify');
    const ok = await notifyAdmin(text);
    if (!ok) await enqueueTelegram(text, kind);
  } catch {
    await enqueueTelegram(text, kind);
  }
}

/* کشیدن صف توسط ادمین: پیام‌های مجاز (طبق سوییچ‌ها) ارسال و حذف می‌شوند */
export async function drainTelegramQueue(cfg: TelegramConfig): Promise<number> {
  if (!cfg.enabled || !cfg.bot_token || !cfg.chat_id) return 0;
  const allowed = (kind: string) => {
    switch (kind) {
      case 'order': return cfg.notify_orders;
      case 'trial': return cfg.notify_trials;
      case 'ticket': return cfg.notify_tickets;
      case 'invoice': return cfg.notify_invoices;
      case 'user': return cfg.notify_users;
      default: return true;
    }
  };
  const { data: rows } = await supabase.from('telegram_queue').select('id,text,kind').order('created_at').limit(30);
  if (!rows?.length) return 0;
  let sent = 0;
  for (const row of rows) {
    /* رویدادهای غیرفعال: بدون ارسال حذف می‌شوند تا صف انباشته نشود */
    if (!allowed(row.kind || 'event')) {
      await supabase.from('telegram_queue').delete().eq('id', row.id);
      continue;
    }
    const r = await sendTelegramDirect(cfg, row.text);
    if (r.ok) {
      await supabase.from('telegram_queue').delete().eq('id', row.id);
      sent += 1;
    } else {
      break; /* خطا → دفعه بعد دوباره تلاش می‌شود */
    }
  }
  return sent;
}

/* یادآور سررسیدها به تلگرام ادمین — با کنترل تکرار روزانه در localStorage */
export async function sendDueDateDigestIfDue(cfg: TelegramConfig, digestText: string): Promise<boolean> {
  if (!cfg.enabled || !cfg.bot_token) return false;
  const key = `karban-tg-digest:${cfg.chat_id}`;
  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem(key) === today) return false;
  const r = await sendTelegramDirect(cfg, digestText);
  if (r.ok) localStorage.setItem(key, today);
  return r.ok;
}
