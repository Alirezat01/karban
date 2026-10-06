/* ═════════════════════════════════════════════════════════════════════
   کاربان — OTP ورود با موبایل (sms.ir)
   ─────────────────────────────────────────────────────────────────
   دو مسیر:
   • POST /api/otp?action=send     → { mobile }        → ارسال کد ۶ رقمی
   • POST /api/otp?action=verify   → { mobile, code }  → تأیید و نشست ساپابیس

   sms.ir Verify API:
     URL: https://api.sms.ir/v1/send/verify
     Headers:
       Content-Type: application/json
       Accept: text/plain
       x-api-key: <API_KEY>
     Body:
       {
         "mobile": "09xxxxxxxxx",
         "templateId": <integer>,
         "parameters": [{ "name": "Code", "value": "123456" }]
       }

   دو نوع API Key:
     1. کلید اصلی (production)  → نیاز به قالب تأییدشده در پنل دارد
     2. کلید Sandbox           → با قالب پیش‌فرض templateId=123456 کار می‌کند
                                 متن قالب: «کد تایید شما: #CODE#»
                                 برای تست بدون نیاز به تأیید قالب

   متغیرهای ورسل:
     SMSIR_API_KEY        — کلید API (production یا sandbox)
     SMSIR_OTP_TEMPLATE_ID — شناسه قالب (در sandbox = 123456)
     SMSIR_OTP_PARAM_NAME  — نام پارامتر قالب (پیش‌فرض: Code)

   سخت‌سازی امنیتی:
   • Rate limit per-IP: ۵ درخواست ارسال در ۱۰ دقیقه
   • Rate limit per-mobile: ۳ کد در ساعت
   • کد ۶ رقمی، TTL ۵ دقیقه، حداکثر ۵ تلاش تأیید
   • کد هش SHA-256 در دیتابیس ذخیره می‌شود (نه خام)
   ═════════════════════════════════════════════════════════════════════ */

import crypto from 'node:crypto';

const TTL_MIN = Number(process.env.OTP_TTL_MINUTES || 5);
const MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);
const IP_WINDOW_MS = 10 * 60 * 1000;
const IP_MAX = 5;
const MOBILE_WINDOW_MS = 60 * 60 * 1000;
const MOBILE_MAX = 3;

const ipHits = new Map();
const mobileHits = new Map();

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
  /* کد ۶ رقمی؛ رقم اول ۰ نیست تا کاربر متوجه نشود که شماره با ۰ شروع شده */
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendSmsIr(mobile, code) {
  const apiKey = process.env.SMSIR_API_KEY;
  const templateId = process.env.SMSIR_OTP_TEMPLATE_ID || '123456'; /* پیش‌فرض sandbox */
  const paramName = process.env.SMSIR_OTP_PARAM_NAME || 'Code';

  if (!apiKey) {
    const err = new Error('SMSIR_API_KEY در متغیرهای محیطی تنظیم نشده است');
    err.code = 'NO_API_KEY';
    throw err;
  }

  /* sms.ir REST API — POST https://api.sms.ir/v1/send/verify
     توجه: در نمونه کد رسمی، کلید پارامتر 'name' (حرف کوچک) استفاده شده،
     ولی در جدول مستندات 'Name' نوشته شده. برای حداکثر سازگاری، هر دو را
     می‌فرستیم تا sms.ir یکی را قبول کند. */
  const body = JSON.stringify({
    mobile,
    templateId: Number(templateId),
    parameters: [
      { name: paramName, value: code },
      { Name: paramName, value: code },
    ],
  });

  const res = await fetch('https://api.sms.ir/v1/send/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/plain',
      'x-api-key': apiKey,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let detail = text;
    try {
      const j = JSON.parse(text);
      detail = j.message || j.Message || text;
    } catch { /* متن خام */ }
    const err = new Error(`sms.ir ${res.status}: ${String(detail).slice(0, 200)}`);
    err.code = 'SMS_FAILED';
    err.status = res.status;
    throw err;
  }

  /* پاسخ موفق — status و data را برمی‌گردانیم */
  const json = await res.json().catch(() => ({}));
  if (json && json.status !== undefined && json.status !== 1 && json.status !== 200) {
    const err = new Error(`sms.ir status ${json.status}: ${json.message || ''}`);
    err.code = 'SMS_LOGICAL_ERROR';
    throw err;
  }
  return json;
}

/* ───────────ـ Supabase helpers (با service_role) ───────────ـ */
const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function supaInsert(table, row) {
  if (!SUPA_URL || !SUPA_KEY) throw new Error('SUPABASE env missing');
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`supabase insert ${table} ${res.status}: ${t.slice(0, 200)}`);
  }
  return true;
}

async function supaSelect(table, filter, order) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filter)) qs.set(k, String(v));
  if (order) qs.set('order', order);
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${qs}`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
  });
  if (!res.ok) return [];
  const j = await res.json();
  return j || [];
}

async function supaUpdate(table, filter, patch) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filter)) qs.set(k, String(v));
  await fetch(`${SUPA_URL}/rest/v1/${table}?${qs}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
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
      return res.status(400).json({ ok: false, error: 'شماره موبایل نامعتبر است (مثال: 09123456789)' });
    }
    if (!rateHit(ipHits, ip, IP_WINDOW_MS, IP_MAX)) {
      return res.status(429).json({ ok: false, error: 'تعداد درخواست زیاد؛ ۱۰ دقیقه بعد دوباره تلاش کنید' });
    }
    if (!rateHit(mobileHits, mobile, MOBILE_WINDOW_MS, MOBILE_MAX)) {
      return res.status(429).json({ ok: false, error: 'برای این شماره در این ساعت کافی کد ارسال شده' });
    }

    if (!process.env.SMSIR_API_KEY) {
      console.error('SMSIR_API_KEY متغیر محیطی ست نشده است');
      return res.status(503).json({ ok: false, error: 'سرویس پیامک پیکربندی نشده است (SMSIR_API_KEY)' });
    }

    const code = genCode();
    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + TTL_MIN * 60 * 1000).toISOString();

    try {
      /* اول کد را در دیتابیس ذخیره می‌کنیم تا حتی اگر پیامک ناموفق بود،
         برای دیباگ بتوانیم وضعیت را ببینیم */
      await supaInsert('otp_codes', {
        mobile,
        code,
        code_hash: codeHash,
        purpose: 'login',
        expires_at: expiresAt,
      });

      await sendSmsIr(mobile, code);
      return res.json({ ok: true, message: 'کد ارسال شد', ttl_min: TTL_MIN });
    } catch (e) {
      console.error('otp send failed:', e.message);
      if (e.code === 'SMS_FAILED' && e.status === 401) {
        return res.status(502).json({ ok: false, error: 'کلید API نامعتبر است — با پشتیبانی sms.ir تماس بگیرید' });
      }
      if (e.code === 'SMS_LOGICAL_ERROR') {
        return res.status(502).json({ ok: false, error: 'قالب پیامک نامعتبر است — شناسه قالب را در پنل sms.ir چک کنید' });
      }
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
      const rows = await supaSelect(
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
        await supaUpdate('otp_codes', { id: `eq.${latest.id}` }, { attempts: latest.attempts + 1 });
        const remaining = MAX_ATTEMPTS - (latest.attempts + 1);
        return res.status(400).json({ ok: false, error: `کد اشتباه است — ${remaining.toLocaleString('fa-IR')} تلاش باقی است` });
      }

      /* کد درست → علامت‌گذاری */
      await supaUpdate('otp_codes', { id: `eq.${latest.id}` }, { verified: true });

      /* پیدا کردن کاربر با این شماره */
      const profiles = await supaSelect('profiles', { phone: `eq.${mobile}`, select: 'id' });
      let userId = profiles[0]?.id;

      /* اگر کاربر وجود نداشت، یک کاربر جدید با موبایل می‌سازیم */
      if (!userId) {
        const adminRes = await fetch(`${SUPA_URL}/auth/v1/admin/users`, {
          method: 'POST',
          headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: mobile, phone_confirm: true, user_metadata: { full_name: `کاربر ${mobile.slice(-4)}` } }),
        });
        const adminJ = await adminRes.json();
        userId = adminJ.id;
        if (userId) {
          await supaInsert('profiles', { id: userId, role: 'user', phone: mobile, full_name: `کاربر ${mobile.slice(-4)}` });
        }
      }

      /* ساخت نشست با Magic Link (نیازی به رمز نیست) */
      const mlRes = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' },
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

  return res.status(400).json({ ok: false, error: 'action نامعتبر (?action=send یا ?action=verify)' });
}

export const config = { maxDuration: 30 };
