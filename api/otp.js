/* ═════════════════════════════════════════════════════════════════════
   کاربان — OTP ورود با موبایل
   FIX: Don't overwrite existing email on Google OAuth users.
   FIX: Use existing email for password grant when available.
   FIX: Only set OTP email for users who don't have one.
   FIX: Separate new-user path from existing-user path.
   FIX: Better diagnostic logging at every step.
   ═════════════════════════════════════════════════════════════════════ */

import crypto from 'node:crypto';

const TTL_MIN = Number(process.env.OTP_TTL_MINUTES || 5);
const MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);
const IP_WINDOW_MS = 10 * 60 * 1000;
const IP_MAX = 5;
const MOBILE_WINDOW_MS = 60 * 60 * 1000;
const MOBILE_MAX = 3;

const SUPA_URL = 'https://rocjeanizzhfvhnuhnms.supabase.co';
const SUPA_ANON = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvY2plYW5penpoZnZobnVobm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NDQwMDcsImV4cCI6MjEwMjAyMDAwN30.Br3brGTpjWnI7ilghPka_DyYUQU7e9eYIPv88Ehqy6g';
const SUPA_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const adminHeaders = () => ({
  'Content-Type': 'application/json',
  apikey: SUPA_SERVICE,
  Authorization: `Bearer ${SUPA_SERVICE}`,
});

const anonHeaders = () => ({
  'Content-Type': 'application/json',
  apikey: SUPA_ANON,
  Authorization: `Bearer ${SUPA_ANON}`,
});

function toE164(localMobile) {
  if (!localMobile || typeof localMobile !== 'string') return null;
  const cleaned = localMobile.replace(/[\s\-()]/g, '');
  if (/^09[0-9]{9}$/.test(cleaned)) return '+98' + cleaned.slice(1);
  if (/^\+989[0-9]{9}$/.test(cleaned)) return cleaned;
  if (/^989[0-9]{9}$/.test(cleaned)) return '+' + cleaned;
  return null;
}

async function supaInsert(table, row) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...adminHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('supaInsert failed:', table, res.status, body.slice(0, 300));
    throw new Error(`DB insert failed: ${res.status}`);
  }
}

async function supaSelect(table, filter, order) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filter)) qs.set(k, String(v));
  if (order) qs.set('order', order);
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${qs}`, {
    headers: { apikey: SUPA_SERVICE, Authorization: `Bearer ${SUPA_SERVICE}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('supaSelect failed:', table, res.status, body.slice(0, 300));
    throw new Error(`DB select failed: ${res.status}`);
  }
  return (await res.json()) || [];
}

async function supaUpdate(table, filter, patch) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filter)) qs.set(k, String(v));
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${qs}`, {
    method: 'PATCH',
    headers: { ...adminHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('supaUpdate failed:', table, res.status, body.slice(0, 300));
    throw new Error(`DB update failed: ${res.status}`);
  }
}

/* Returns { user, error, status } — distinguishes API failure from not-found */
async function findAuthUserByPhone(authPhone) {
  let page = 1;
  const perPage = 1000;
  while (true) {
    const res = await fetch(
      `${SUPA_URL}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
      { headers: adminHeaders() }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('findAuthUserByPhone: admin list page=' + page + ' status=' + res.status + ' body=' + body.slice(0, 200));
      return { user: null, error: 'admin_list_failed', status: res.status };
    }
    const data = await res.json();
    const users = data.users || data || [];
    if (users.length === 0) return { user: null, error: null, status: 0 };
    const found = users.find((u) => u.phone === authPhone);
    if (found) return { user: found, error: null, status: 0 };
    if (users.length < perPage) return { user: null, error: null, status: 0 };
    page++;
  }
}

function verifyPhoneMatch(authUser, authPhone) {
  if (!authUser || !authUser.phone) return false;
  return authUser.phone === authPhone;
}

async function ensureProfile(userId, localMobile) {
  let existing;
  try {
    existing = await supaSelect('profiles', { id: `eq.${userId}`, select: 'id' });
  } catch (e) {
    console.error('ensureProfile: select failed:', e.message);
    return;
  }
  if (existing.length > 0) return;
  try {
    await supaInsert('profiles', {
      id: userId,
      phone: localMobile,
      full_name: `کاربر ${localMobile.slice(-4)}`,
    });
  } catch (e) {
    console.error('ensureProfile: insert failed:', e.message);
  }
}

function isIranianMobile(m) { return /^09[0-9]{9}$/.test(m); }
function genCode() { return String(Math.floor(100000 + Math.random() * 900000)); }
function hashCode(code) { return crypto.createHash('sha256').update(code).digest('hex'); }

function getPhonePassword(mobile) {
  const secret = process.env.SMSIR_API_KEY?.slice(0, 16) || 'karban-secret';
  return `kb_${mobile}_${secret}`;
}

async function sendSmsIr(mobile, code) {
  const apiKey = process.env.SMSIR_API_KEY;
  const templateId = process.env.SMSIR_OTP_TEMPLATE_ID || '123456';
  const paramName = process.env.SMSIR_OTP_PARAM_NAME || 'Code';
  if (!apiKey) throw new Error('SMSIR_API_KEY not set');
  const body = JSON.stringify({ mobile, templateId: Number(templateId), parameters: [{ name: paramName, value: code }] });
  const res = await fetch('https://api.sms.ir/v1/send/verify', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/plain', 'x-api-key': apiKey }, body,
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

/* ════════════════════════════════════════════════════════════════
   createSession
   ════════════════════════════════════════════════════════════════ */
async function createSession(localMobile) {
  const password = getPhonePassword(localMobile);
  const authPhone = toE164(localMobile);
  const otpEmail = `${localMobile}@karbanapp.ir`;

  if (!authPhone) { console.error('createSession: invalid E.164'); return null; }
  if (!SUPA_SERVICE) { console.error('createSession: service key not set'); return null; }

  let userId = null;
  let grantEmail = null;

  /* ─── PATH 1: Find existing Auth user ─── */
  const lookup = await findAuthUserByPhone(authPhone);

  if (lookup.error) {
    console.error('createSession: lookup failed:', lookup.error, 'status:', lookup.status);
    return null;
  }

  if (lookup.user) {
    if (!verifyPhoneMatch(lookup.user, authPhone)) {
      console.error('createSession: phone mismatch');
      return null;
    }
    userId = lookup.user.id;

    /* CRITICAL: Use the user's EXISTING email if they have one.
       Do NOT overwrite a Google OAuth user's email. */
    if (lookup.user.email) {
      grantEmail = lookup.user.email;
      console.log('createSession: existing user id=' + userId + ' using existing email');

      /* Only set password — DO NOT touch email */
      const updateRes = await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: adminHeaders(),
        body: JSON.stringify({ password: password }),
      });
      if (!updateRes.ok) {
        const errBody = await updateRes.text().catch(() => '');
        console.error('createSession: password set failed: status=' + updateRes.status + ' body=' + errBody.slice(0, 300));
        return null;
      }
    } else {
      /* User has no email — set one */
      grantEmail = otpEmail;
      console.log('createSession: existing user id=' + userId + ' setting new email');

      const updateRes = await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: adminHeaders(),
        body: JSON.stringify({
          password: password,
          email: grantEmail,
          email_confirm: true,
        }),
      });
      if (!updateRes.ok) {
        const errBody = await updateRes.text().catch(() => '');
        console.error('createSession: password+email set failed: status=' + updateRes.status + ' body=' + errBody.slice(0, 300));
        return null;
      }
    }
  }

  /* ─── PATH 2: Create new user ─── */
  if (!userId) {
    grantEmail = otpEmail;

    const createRes = await fetch(`${SUPA_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({
        phone: authPhone,
        phone_confirm: true,
        password: password,
        email: grantEmail,
        email_confirm: true,
        user_metadata: { full_name: `کاربر ${localMobile.slice(-4)}` },
      }),
    });
    const createJ = await createRes.json().catch(() => ({}));

    if (createRes.ok) {
      userId = createJ.id;
      console.log('createSession: new user created id=' + userId);
    } else if (createRes.status === 422 && createJ.error_code === 'phone_exists') {
      console.log('createSession: phone_exists, re-looking up');
      const reLookup = await findAuthUserByPhone(authPhone);
      if (reLookup.error) {
        console.error('createSession: re-lookup failed:', reLookup.error, reLookup.status);
        return null;
      }
      if (reLookup.user && verifyPhoneMatch(reLookup.user, authPhone)) {
        userId = reLookup.user.id;

        /* Use existing email or set new one */
        if (reLookup.user.email) {
          grantEmail = reLookup.user.email;
          console.log('createSession: using existing email after phone_exists');

          const upd = await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, {
            method: 'PUT', headers: adminHeaders(),
            body: JSON.stringify({ password: password }),
          });
          if (!upd.ok) {
            const b = await upd.text().catch(() => '');
            console.error('createSession: password set after phone_exists failed: status=' + upd.status + ' body=' + b.slice(0, 300));
            return null;
          }
        } else {
          grantEmail = otpEmail;
          const upd = await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, {
            method: 'PUT', headers: adminHeaders(),
            body: JSON.stringify({ password: password, email: grantEmail, email_confirm: true }),
          });
          if (!upd.ok) {
            const b = await upd.text().catch(() => '');
            console.error('createSession: password+email after phone_exists failed: status=' + upd.status + ' body=' + b.slice(0, 300));
            return null;
          }
        }
      } else {
        console.error('createSession: phone_exists but user not found or mismatch');
        return null;
      }
    } else {
      console.error('createSession: create failed: status=' + createRes.status + ' code=' + (createJ.error_code || 'none') + ' msg=' + (createJ.msg || createJ.message || '').slice(0, 300));
      return null;
    }
  }

  if (!userId || !grantEmail) {
    console.error('createSession: missing userId or grantEmail');
    return null;
  }

  /* ─── Token grant with anon key + email ─── */
  const tokenRes = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: anonHeaders(),
    body: JSON.stringify({ email: grantEmail, password: password }),
  });
  const tokenJ = await tokenRes.json().catch(() => ({}));

  if (tokenRes.ok && tokenJ.access_token && tokenJ.refresh_token) {
    console.log('createSession: SUCCESS token grant for user ' + userId);
    await ensureProfile(userId, localMobile);
    return { access_token: tokenJ.access_token, refresh_token: tokenJ.refresh_token, user_id: userId };
  }

  console.error('createSession: token grant FAILED: status=' + tokenRes.status + ' error_code=' + (tokenJ.error_code || 'none') + ' msg=' + (tokenJ.msg || tokenJ.message || '').slice(0, 300));

  /* Fallback: magic link */
  const linkRes = await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}/generate_link`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({ type: 'magiclink' }),
  });
  const linkJ = await linkRes.json().catch(() => ({}));
  if (linkJ.properties?.action_link) {
    const exRes = await fetch(linkJ.properties.action_link, { method: 'GET', redirect: 'manual' });
    const location = exRes.headers.get('location');
    if (location) {
      const m = location.match(/#access_token=([^&]+)&.*refresh_token=([^&]+)/);
      if (m) {
        console.log('createSession: magic link SUCCESS for user ' + userId);
        await ensureProfile(userId, localMobile);
        return { access_token: decodeURIComponent(m[1]), refresh_token: decodeURIComponent(m[2]), user_id: userId };
      }
    }
  }

  console.error('createSession: ALL methods failed for user ' + userId);
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

    const ipHits = (globalThis._ipHits || new Map());
    const mobileHits = (globalThis._mobileHits || new Map());
    globalThis._ipHits = ipHits;
    globalThis._mobileHits = mobileHits;

    const now = Date.now();
    const ipArr = (ipHits.get(ip) || []).filter((t) => now - t < IP_WINDOW_MS);
    if (ipArr.length >= IP_MAX) return res.status(429).json({ ok: false, error: 'تعداد درخواست زیاد؛ ۱۰ دقیقه بعد تلاش کنید' });
    ipArr.push(now); ipHits.set(ip, ipArr);

    const mobArr = (mobileHits.get(mobile) || []).filter((t) => now - t < MOBILE_WINDOW_MS);
    if (mobArr.length >= MOBILE_MAX) return res.status(429).json({ ok: false, error: 'برای این شماره در این ساعت کافی کد ارسال شده' });
    mobArr.push(now); mobileHits.set(mobile, mobArr);

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
      const rows = await supaSelect('otp_codes', {
        mobile: `eq.${mobile}`,
        purpose: `eq.login`,
        verified: `eq.false`,
        order: 'created_at.desc',
      });

      const now = Date.now();
      const latest = rows.find((r) => new Date(r.expires_at).getTime() > now);

      if (!latest) return res.status(400).json({ ok: false, error: 'کد معتبر نیست یا منقضی شده؛ کد جدید بگیرید' });
      if (latest.attempts >= MAX_ATTEMPTS) return res.status(400).json({ ok: false, error: 'تعداد تلاش بیش از حد؛ کد جدید بگیرید' });

      if (latest.code_hash !== hashCode(code)) {
        await supaUpdate('otp_codes', { id: `eq.${latest.id}` }, { attempts: latest.attempts + 1 });
        return res.status(400).json({ ok: false, error: `کد اشتباه است — ${(MAX_ATTEMPTS - latest.attempts - 1).toLocaleString('fa-IR')} تلاش باقی است` });
      }

      const session = await createSession(mobile);

      if (session?.access_token && session?.refresh_token) {
        await supaUpdate('otp_codes', { id: `eq.${latest.id}` }, { verified: true });
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
        error: 'کد تأیید شد اما نشست ساخته نشد. لطفاً دوباره تلاش کنید یا با گوگل وارد شوید.',
        code_verified: true,
      });
    } catch (e) {
      console.error('otp verify failed', e.message);
      return res.status(500).json({ ok: false, error: 'تأیید کد ناموفق بود', detail: e.message });
    }
  }

  return res.status(400).json({ ok: false, error: 'action نامعتبر' });
}

export const config = { maxDuration: 15 };
