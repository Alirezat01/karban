/* ═════════════════════════════════════════════════════════════════════
   کاربان — OTP ورود با موبایل (sms.ir)
   ─────────────────────────────────────────────────────────────────
   دو مسیر:
   • POST /api/otp?action=send     → { mobile }        → ارسال کد ۶ رقمی
   • POST /api/otp?action=verify   → { mobile, code }  → تأیید و نشست ساپابیس
   • GET  /api/otp?debug=1         → تست اتصال و خطای دقیق sms.ir

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

   متغیرهای ورسل:
     SMSIR_API_KEY        — کلید API (production یا sandbox)
     SMSIR_OTP_TEMPLATE_ID — شناسه قالب (در sandbox = 123456)
     SMSIR_OTP_PARAM_NAME  — نام پارامتر قالب (پیش‌فرض: Code)
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
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendSmsIr(mobile, code) {
  const apiKey = process.env.SMSIR_API_KEY;
  const templateId = process.env.SMSIR_OTP_TEMPLATE_ID || '123456';
  const paramName = process.env.SMSIR_OTP_PARAM_NAME || 'Code';

  if (!apiKey) {
    const err = new Error('SMSIR_API_KEY در متغیرهای محیطی تنظیم نشده است');
    err.code = 'NO_API_KEY';
    throw err;
  }

  const body = JSON.stringify({
    mobile,
    templateId: Number(templateId),
    parameters: [
      { name: paramName, value: code },
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
      detail = j.message || j.Message || JSON.stringify(j);
    } catch { /* متن خام */ }
    const err = new Error(`sms.ir ${res.status}: ${String(detail).slice(0, 300)}`);
    err.code = 'SMS_FAILED';
    err.status = res.status;
    err.detail = detail;
    throw err;
  }

  const json = await res.json().catch(() => ({}));
  if (json && json.status !== undefined && json.status !== 1 && json.status !== 200) {
    const err = new Error(`sms.ir status ${json.status}: ${json.message || ''}`);
    err.code = 'SMS_LOGICAL_ERROR';
    err.detail = JSON.stringify(json);
    throw err;
  }
  return json;
}

const SUPA_URL = 'https://rocjeanizzhfvhnuhnms.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvY2plYW5penpoZnZobnVobm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NDQwMDcsImV4cCI6MjEwMjAyMDAwN30.Br3brGTpjWnI7ilghPka_DyYUQU7e9eYIPv88Ehqy6g';
const SUPA_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function supaInsert(table, row) {
  const key = SUPA_SERVICE || SUPA_KEY;
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
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
  const key = SUPA_SERVICE || SUPA_KEY;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filter)) qs.set(k, String(v));
  if (order) qs.set('order', order);
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${qs}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return [];
  const j = await res.json();
  return j || [];
}

async function supaUpdate(table, filter, patch) {
  const key = SUPA_SERVICE || SUPA_KEY;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filter)) qs.set(k, String(v));
  await fetch(`${SUPA_URL}/rest/v1/${table}?${qs}`, {
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
  /* مسیر دیباگ: GET /api/otp?debug=1 */
  if (req.method === 'GET' && req.query.debug === '1') {
    const apiKey = process.env.SMSIR_API_KEY;
    const templateId = process.env.SMSIR_OTP_TEMPLATE_ID;
    const paramName = process.env.SMSIR_OTP_PARAM_NAME;

    if (!apiKey) {
      return res.json({
        ok: false,
        error: 'SMSIR_API_KEY در Vercel ست نشده',
        env: { SMSIR_API_KEY: 'NOT SET', SMSIR_OTP_TEMPLATE_ID: templateId || 'NOT SET', SMSIR_OTP_PARAM_NAME: paramName || 'NOT SET (default: Code)' },
      });
    }

    const testMobile = '09120000000';
    const testCode = '123456';
    const body = JSON.stringify({
      mobile: testMobile,
      templateId: Number(templateId) || 123456,
      parameters: [{ name: paramName || 'Code', value: testCode }],
    });

    try {
      const smsRes = await fetch('https://api.sms.ir/v1/send/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/plain',
          'x-api-key': apiKey,
        },
        body,
      });
      const smsText = await smsRes.text().catch(() => '');
      let smsJson = null;
      try { smsJson = JSON.parse(smsText); } catch {}

      return res.json({
        ok: true,
        config: {
          SMSIR_API_KEY: apiKey.slice(0, 10) + '...',
          SMSIR_OTP_TEMPLATE_ID: templateId,
          SMSIR_OTP_PARAM_NAME: paramName || 'Code (default)',
          test_mobile: testMobile,
        },
        sms_response: {
          status: smsRes.status,
          statusText: smsRes.statusText,
          ok: smsRes.ok,
          body: smsText.slice(0, 500),
          parsed: smsJson,
        },
        diagnosis: smsRes.ok ? 'اتصال موفق — sms.ir جواب داد' : 'اتصال برقرار ولی sms.ir خطا داد',
      });
    } catch (e) {
      return res.json({
        ok: false,
        error: 'خطای شبکه به sms.ir: ' + e.message,
        cause: e.cause?.message || 'no cause',
      });
    }
  }

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
      return res.status(503).json({ ok: false, error: 'سرویس پیامک پیکربندی نشده است (SMSIR_API_KEY)' });
    }

    const code = genCode();
    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + TTL_MIN * 60 * 1000).toISOString();

    try {
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
      console.error('otp send failed:', e.message, e.detail || '', e.status || '');
      const detail = e.detail || e.message;
      if (e.code === 'SMS_FAILED' && e.status === 401) {
        return res.status(502).json({ ok: false, error: 'کلید API sms.ir نامعتبر است', detail, status: e.status });
      }
      if (e.code === 'SMS_FAILED' && e.status === 400) {
        return res.status(502).json({ ok: false, error: 'درخواست نامعتبر به sms.ir', detail, status: e.status });
      }
      if (e.code === 'SMS_LOGICAL_ERROR') {
        return res.status(502).json({ ok: false, error: 'قالب پیامک نامعتبر است — شناسه قالب را در پنل sms.ir چک کنید', detail });
      }
      return res.status(502).json({ ok: false, error: 'ارسال پیامک ناموفق بود', detail, fullError: e.message });
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

      await supaUpdate('otp_codes', { id: `eq.${latest.id}` }, { verified: true });

      const profiles = await supaSelect('profiles', { phone: `eq.${mobile}`, select: 'id' });
      let userId = profiles[0]?.id;

      if (!userId) {
        const adminRes = await fetch(`${SUPA_URL}/auth/v1/admin/users`, {
          method: 'POST',
          headers: { apikey: SUPA_SERVICE || SUPA_KEY, Authorization: `Bearer ${SUPA_SERVICE || SUPA_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: mobile, phone_confirm: true, user_metadata: { full_name: `کاربر ${mobile.slice(-4)}` } }),
        });
        const adminJ = await adminRes.json();
        userId = adminJ.id;
        if (userId) {
          await supaInsert('profiles', { id: userId, role: 'user', phone: mobile, full_name: `کاربر ${mobile.slice(-4)}` });
        }
      }

      const mlRes = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: SUPA_SERVICE || SUPA_KEY, Authorization: `Bearer ${SUPA_SERVICE || SUPA_KEY}`, 'Content-Type': 'application/json' },
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
      return res.status(500).json({ ok: false, error: 'تأیید کد ناموفق بود', detail: e.message });
    }
  }

  return res.status(400).json({ ok: false, error: 'action نامعتبر (?action=send یا ?action=verify)' });
}

export const config = { maxDuration: 30 };
