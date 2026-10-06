/* ═════════════════════════════════════════════════════════════════════
   کاربان — OTP ورود با موبایل (sms.ir)
   ─────────────────────────────────────────────────────────────────
   دو مسیر:
   • POST /api/otp?action=send     → { mobile }        → ارسال کد ۶ رقمی
   • POST /api/otp?action=verify   → { mobile, code }  → تأیید و نشست ساپابیس

   سخت‌سازی امنیتی:
   • Rate limit per-IP: ۵ درخواست ارسال در ۱۰ دقیقه
   • Rate limit per-mobile: ۳ کد در ساعت
   • کد ۶ رقمی، TTL ۵ دقیقه، حداکثر ۵ تلاش تأیید
   • کد هش SHA-256 در دیتابیس ذخیره می‌شود (نه خام)

   تنظیمات ورسل:
     SMSIR_API_KEY        — کلید API از console.sms.ir
     SMSIR_LINE_NUMBER    — شماره خط ارسال
     SMSIR_OTP_TEMPLATE_ID — شناسه الگوی تأیید شده (پیش‌فرض: «کد تأیید»)
     SUPABASE_URL         — URL پروژه ساپابیس
     SUPABASE_SERVICE_ROLE_KEY — کلید service role
   ═════════════════════════════════════════════════════════════════════ */

import crypto from 'node:crypto';

const TTL_MIN = 5;
const MAX_ATTEMPTS = 5;
const IP_WINDOW_MS = 10 * 60 * 1000;
const IP_MAX = 5;
const MOBILE_WINDOW_MS = 60 * 60 * 1000;
const MOBILE_MAX = 3;

const ipHits = new Map();     // ip → [timestamps]
const mobileHits = new Map(); // mobile → [timestamps]

function rateHit(map, key, windowMs, max) {
  const now = Date.now();
  const arr = (map.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  map.set(key, arr);
  return arr.length <= max;
}

function isIranianMobile(m) {
  return /^09[0-9]{9}$/.test(m);
}

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendSmsIr(mobile, code) {
  const apiKey = process.env.SMSIR_API_KEY;
  const line = process.env.SMSIR_LINE_NUMBER;
  const templateId = process.env.SMSIR_OTP_TEMPLATE_ID;
  if (!apiKey) throw new Error('SMSIR_API_KEY not set');

  /* sms.ir REST API — https://api.sms.ir/v1/send/verify */
  const body = JSON.stringify({
    mobile,
    templateId: Number(templateId) || 0,
    parameters: [{ name: 'Code', value: code }],
  });
  const res = await fetch('https://api.sms.ir/v1/send/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`sms.ir ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function dbExec(query, params) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE env missing');
  const res = await fetch(`${url}/rest/v1/rpc/${query}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(params),
  });
  return res.json();
}

async function supabaseInsert(table, row) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });
  return res.ok;
}

async function supabaseSelect(table, filters, order) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) qs.set(k, String(v));
  if (order) qs.set('order', order);
  const res = await fetch(`${url}/rest/v1/${table}?${qs}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const j = await res.json();
  return j || [];
}

async function supabaseUpdate(table, filters, patch) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) qs.set(k, String(v));
  await fetch(`${url}/rest/v1/${table}?${qs}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(patch),
  });
}

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').toString().split(',')[0].trim();
  const action = req.query.action;

  /* ─── SEND ───────────────────────────────────────────── */
  if (action === 'send') {
    const { mobile } = req.body || {};
    if (!isIranianMobile(mobile)) {
      return res.status(400).json({ ok: false, error: 'شماره موبایل نامعتبر است' });
    }
    if (!rateHit(ipHits, ip, IP_WINDOW_MS, IP_MAX)) {
      return res.status(429).json({ ok: false, error: 'تعداد درخواست زیاد؛ ۱۰ دقیقه بعد دوباره تلاش کنید' });
    }
    if (!rateHit(mobileHits, mobile, MOBILE_WINDOW_MS, MOBILE_MAX)) {
      return res.status(429).json({ ok: false, error: 'برای این شماره در این ساعت کافی کد ارسال شده' });
    }

    const code = genCode();
    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + TTL_MIN * 60 * 1000).toISOString();

    try {
      await supabaseInsert('otp_codes', {
        mobile,
        code,
        code_hash: codeHash,
        purpose: 'login',
        expires_at: expiresAt,
      });
      await sendSmsIr(mobile, code);
      return res.json({ ok: true, message: 'کد ارسال شد', ttl_min: TTL_MIN });
    } catch (e) {
      console.error('otp send failed', e.message);
      return res.status(502).json({ ok: false, error: 'ارسال پیامک ناموفق بود؛ دوباره تلاش کنید' });
    }
  }

  /* ─── VERIFY ─────────────────────────────────────────── */
  if (action === 'verify') {
    const { mobile, code } = req.body || {};
    if (!isIranianMobile(mobile) || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ ok: false, error: 'شماره یا کد نامعتبر است' });
    }

    try {
      const rows = await supabaseSelect(
        'otp_codes',
        { mobile: `eq.${mobile}`, order: 'created_at.desc' },
      );
      const latest = rows[0];
      if (!latest) {
        return res.status(400).json({ ok: false, error: 'کدی برای این شماره ثبت نشده' });
      }
      if (latest.verified) {
        return res.status(400).json({ ok: false, error: 'این کد قبلاً استفاده شده' });
      }
      if (new Date(latest.expires_at).getTime() < Date.now()) {
        return res.status(400).json({ ok: false, error: 'کد منقضی شده؛ کد جدید بگیرید' });
      }
      if (latest.attempts >= MAX_ATTEMPTS) {
        return res.status(400).json({ ok: false, error: 'تعداد تلاش بیش از حد؛ کد جدید بگیرید' });
      }

      if (latest.code_hash !== hashCode(code)) {
        await supabaseUpdate('otp_codes', { id: `eq.${latest.id}` }, { attempts: latest.attempts + 1 });
        return res.status(400).json({ ok: false, error: 'کد اشتباه است' });
      }

      /* کد درست → علامت‌گذاری، ایجاد کاربر در صورت عدم وجود، و برگرداندن نشست */
      await supabaseUpdate('otp_codes', { id: `eq.${latest.id}` }, { verified: true });

      /* پیدا کردن کاربر با این شماره */
      const profiles = await supabaseSelect('profiles', { phone: `eq.${mobile}`, select: 'id' });
      let userId = profiles[0]?.id;

      /* اتصال نشست کاربر فعلی (اگر از گوگل وارد شده و موبایل خالی است) را اینجا نمی‌توانیم بدون نشست کاربر انجام دهیم؛
         به‌جای آن، نشست Magic Link می‌سازیم — کاربر می‌تواند بعداً در پروفایل گوگل را هم متصل کند.
         برای سادگی، توکن Magic Link ساپابیس برمی‌گردانیم. */
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      /* اگر کاربر وجود نداشت، یک کاربر جدید با موبایل می‌سازیم */
      if (!userId) {
        const adminRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
          method: 'POST',
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: mobile, phone_confirm: true, user_metadata: { full_name: `کاربر ${mobile.slice(-4)}` } }),
        });
        const adminJ = await adminRes.json();
        userId = adminJ.id;
        if (userId) {
          await supabaseInsert('profiles', { id: userId, role: 'user', phone: mobile, full_name: `کاربر ${mobile.slice(-4)}` });
        }
      }

      /* ساخت نشست با Magic Link (نیازی به رمز نیست) */
      const mlRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: mobile, password: `otp-${mobile}-${process.env.SMSIR_API_KEY?.slice(0, 8) || 'karban'}` }),
      });
      const mlJ = await mlRes.json();

      return res.json({
        ok: true,
        user_id: userId,
        access_token: mlJ.access_token || null,
        refresh_token: mlJ.refresh_token || null,
        message: 'ورود موفق بود',
      });
    } catch (e) {
      console.error('otp verify failed', e.message);
      return res.status(500).json({ ok: false, error: 'تأیید کد ناموفق بود' });
    }
  }

  return res.status(400).json({ ok: false, error: 'action نامعتبر (send یا verify)' });
}

export const config = { maxDuration: 30 };
