/* ═════════════════════════════════════════════════════════════════════
   کاربان — OTP ورود با موبایل (نسخه نهایی)
   برای ساختن نشست، SUPABASE_SERVICE_ROLE_KEY لازم است.
   ═════════════════════════════════════════════════════════════════════ */

import crypto from 'node:crypto';

const TTL_MIN = Number(process.env.OTP_TTL_MINUTES || 5);
const MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);
const IP_WINDOW_MS = 10 * 60 * 1000;
const IP_MAX = 5;
const MOBILE_WINDOW_MS = 60 * 60 * 1000;
const MOBILE_MAX = 3;

const SUPA_URL = 'https://rocjeanizzhfvhnuhnms.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvY2plYW5penpoZnZobnVobm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NDQwMDcsImV4cCI6MjEwMjAyMDAwN30.Br3brGTpjWnI7ilghPka_DyYUQU7e9eYIPv88Ehqy6g';
const SUPA_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getPhonePassword(mobile) {
  const secret = process.env.SMSIR_API_KEY?.slice(0, 16) || 'karban-secret';
  return `kb_${mobile}_${secret}`;
}

const ipHits = new Map();
const mobileHits = new Map();

function rateHit(map, key, windowMs, max) {
  const now = Date.now();
  const arr = (map.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  map.set(key, arr);
  return arr.length <= max;
}

function isIranianMobile(m) { return /^09[0-9]{9}$/.test(m); }
function genCode() { return String(Math.floor(100000 + Math.random() * 900000)); }
function hashCode(code) { return crypto.createHash('sha256').update(code).digest('hex'); }

async function sendSmsIr(mobile, code) {
  const apiKey = process.env.SMSIR_API_KEY;
  const templateId = process.env.SMSIR_OTP_TEMPLATE_ID || '123456';
  const paramName = process.env.SMSIR_OTP_PARAM_NAME || 'Code';
  if (!apiKey) throw new Error('SMSIR_API_KEY not set');

  const body = JSON.stringify({
    mobile,
    templateId: Number(templateId),
    parameters: [{ name: paramName, value: code }],
  });

  const res = await fetch('https://api.sms.ir/v1/send/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/plain', 'x-api-key': apiKey },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let detail = text;
    try { const j = JSON.parse(text); detail = j.message || j.Message || JSON.stringify(j); } catch {}
    const err = new Error(`sms.ir ${res.status}: ${String(detail).slice(0, 300)}`);
    err.code = 'SMS_FAILED'; err.status = res.status; err.detail = detail;
    throw err;
  }

  const json = await res.json().catch(() => ({}));
  if (json && json.status !== undefined && json.status !== 1 && json.status !== 200) {
    const err = new Error(`sms.ir status ${json.status}: ${json.message || ''}`);
    err.code = 'SMS_LOGICAL_ERROR'; err.detail = JSON.stringify(json);
    throw err;
  }
  return json;
}

async function supaInsert(table, row) {
  const key = SUPA_SERVICE || SUPA_ANON;
  await fetch(`${SUPA_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });
}

async function supaSelect(table, filter, order) {
  const key = SUPA_SERVICE || SUPA_ANON;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filter)) qs.set(k, String(v));
  if (order) qs.set('order', order);
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${qs}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return [];
  return (await res.json()) || [];
}

async function supaUpdate(table, filter, patch) {
  const key = SUPA_SERVICE || SUPA_ANON;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filter)) qs.set(k, String(v));
  await fetch(`${SUPA_URL}/rest/v1/${table}?${qs}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
}

async function createSession(mobile) {
  const password = getPhonePassword(mobile);

  if (SUPA_SERVICE) {
    const profiles = await supaSelect('profiles', { phone: `eq.${mobile}`, select: 'id' });
    let userId = profiles[0]?.id;

    if (!userId) {
      const adminRes = await fetch(`${SUPA_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPA_SERVICE, Authorization: `Bearer ${SUPA_SERVICE}` },
        body: JSON.stringify({
          phone: mobile, phone_confirm: true, password: password,
          user_metadata: { full_name: `کاربر ${mobile.slice(-4)}` },
        }),
      });
      const adminJ = await adminRes.json().catch(() => ({}));
      userId = adminJ.id;
      if (userId) {
        await supaInsert('profiles', { id: userId, role: 'user', phone: mobile, full_name: `کاربر ${mobile.slice(-4)}` });
      }
    } else {
      await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', apikey: SUPA_SERVICE, Authorization: `Bearer ${SUPA_SERVICE}` },
        body: JSON.stringify({ password: password }),
      });
    }

    const mlRes = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPA_SERVICE, Authorization: `Bearer ${SUPA_SERVICE}` },
      body: JSON.stringify({ phone: mobile, password: password }),
    });
    const mlJ = await mlRes.json().catch(() => ({}));

    if (mlJ.access_token) {
      return { access_token: mlJ.access_token, refresh_token: mlJ.refresh_token, user_id: userId };
    }

    if (userId) {
      const linkRes = await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}/generate_link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPA_SERVICE, Authorization: `Bearer ${SUPA_SERVICE}` },
        body: JSON.stringify({ type: 'magiclink' }),
      });
      const linkJ = await linkRes.json().catch(() => ({}));
      if (linkJ.properties?.action_link) {
        const exRes = await fetch(linkJ.properties.action_link, { method: 'GET', redirect: 'manual' });
        const location = exRes.headers.get('location');
        if (location) {
          const hashMatch = location.match(/#access_token=([^&]+)&.*refresh_token=([^&]+)/);
          if (hashMatch) {
            return { access_token: decodeURIComponent(hashMatch[1]), refresh_token: decodeURIComponent(hashMatch[2]), user_id: userId };
          }
        }
      }
    }
  }

  const email = `${mobile}@karbanapp.ir`;

  const signInRes = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPA_ANON, Authorization: `Bearer ${SUPA_ANON}` },
    body: JSON.stringify({ email, password }),
  });
  const signInJ = await signInRes.json().catch(() => ({}));
  if (signInJ.access_token) {
    return { access_token: signInJ.access_token, refresh_token: signInJ.refresh_token, user_id: signInJ.user?.id };
  }

  const signUpRes = await fetch(`${SUPA_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPA_ANON, Authorization: `Bearer ${SUPA_ANON}` },
    body: JSON.stringify({ email, password, data: { phone: mobile, full_name: `کاربر ${mobile.slice(-4)}` } }),
  });
  const signUpJ = await signUpRes.json().catch(() => ({}));
  if (signUpJ.session?.access_token) {
    if (signUpJ.user?.id) {
      await supaInsert('profiles', { id: signUpJ.user.id, role: 'user', phone: mobile, full_name: `کاربر ${mobile.slice(-4)}` });
    }
    return { access_token: signUpJ.session.access_token, refresh_token: signUpJ.session.refresh_token, user_id: signUpJ.user?.id };
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method === 'GET' && req.query.debug === '1') {
    return res.json({
      ok: true,
      config: {
        SMSIR_API_KEY: process.env.SMSIR_API_KEY ? 'set' : 'NOT SET',
        SMSIR_OTP_TEMPLATE_ID: process.env.SMSIR_OTP_TEMPLATE_ID,
        SUPABASE_SERVICE_ROLE_KEY: SUPA_SERVICE ? 'set' : 'NOT SET',
      },
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').toString().split(',')[0].trim();
  const action = req.query.action;

  if (action === 'send') {
    const { mobile } = req.body || {};
    if (!isIranianMobile(mobile)) return res.status(400).json({ ok: false, error: 'شماره موبایل نامعتبر است' });
    if (!rateHit(ipHits, ip, IP_WINDOW_MS, IP_MAX)) return res.status(429).json({ ok: false, error: 'تعداد درخواست زیاد؛ ۱۰ دقیقه بعد تلاش کنید' });
    if (!rateHit(mobileHits, mobile, MOBILE_WINDOW_MS, MOBILE_MAX)) return res.status(429).json({ ok: false, error: 'برای این شماره در این ساعت کافی کد ارسال شده' });
    if (!process.env.SMSIR_API_KEY) return res.status(503).json({ ok: false, error: 'سرویس پیامک پیکربندی نشده (SMSIR_API_KEY)' });

    const code = genCode();
    const expiresAt = new Date(Date.now() + TTL_MIN * 60 * 1000).toISOString();

    try {
      await supaInsert('otp_codes', { mobile, code, code_hash: hashCode(code), purpose: 'login', expires_at: expiresAt });
      await sendSmsIr(mobile, code);
      return res.json({ ok: true, message: 'کد ارسال شد', ttl_min: TTL_MIN });
    } catch (e) {
      console.error('otp send failed:', e.message);
      return res.status(502).json({ ok: false, error: 'ارسال پیامک ناموفق بود', detail: e.detail || e.message });
    }
  }

  if (action === 'verify') {
    const { mobile, code } = req.body || {};
    if (!isIranianMobile(mobile) || !/^\d{6}$/.test(code)) return res.status(400).json({ ok: false, error: 'شماره یا کد نامعتبر است' });

    try {
      const rows = await supaSelect('otp_codes', { mobile: `eq.${mobile}`, order: 'created_at.desc' });
      const latest = rows[0];
      if (!latest) return res.status(400).json({ ok: false, error: 'کدی برای این شماره ثبت نشده' });
      if (latest.verified) return res.status(400).json({ ok: false, error: 'این کد قبلاً استفاده شده' });
      if (new Date(latest.expires_at).getTime() < Date.now()) return res.status(400).json({ ok: false, error: 'کد منقضی شده؛ کد جدید بگیرید' });
      if (latest.attempts >= MAX_ATTEMPTS) return res.status(400).json({ ok: false, error: 'تعداد تلاش بیش از حد؛ کد جدید بگیرید' });

      if (latest.code_hash !== hashCode(code)) {
        await supaUpdate('otp_codes', { id: `eq.${latest.id}` }, { attempts: latest.attempts + 1 });
        return res.status(400).json({ ok: false, error: `کد اشتباه است — ${(MAX_ATTEMPTS - latest.attempts - 1).toLocaleString('fa-IR')} تلاش باقی است` });
      }

      await supaUpdate('otp_codes', { id: `eq.${latest.id}` }, { verified: true });

      const session = await createSession(mobile);

      if (session?.access_token) {
        return res.json({
          ok: true,
          user_id: session.user_id,
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          message: 'ورود موفق بود',
        });
      }

      return res.json({
        ok: false,
        error: 'کد تأیید شد ولی نشست ساخته نشد. SUPABASE_SERVICE_ROLE_KEY را در Vercel تنظیم کنید.',
        code_verified: true,
        need_service_key: !SUPA_SERVICE,
      });
    } catch (e) {
      console.error('otp verify failed', e.message);
      return res.status(500).json({ ok: false, error: 'تأیید کد ناموفق بود', detail: e.message });
    }
  }

  return res.status(400).json({ ok: false, error: 'action نامعتبر' });
}

export const config = { maxDuration: 15 };
