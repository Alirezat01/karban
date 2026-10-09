/* ═════════════════════════════════════════════════════════════════════
   کاربان — OTP ورود با موبایل
   Diagnostic v3 — fixes the email_exists bug:
   - Lookup now tries EMAIL first (most reliable — we control OTP email),
     then E.164 phone, then local phone format.
   - STEP 3 handles BOTH `phone_exists` AND `email_exists` (re-lookup by email).
   - All previous OTP-tagged diagnostics preserved.

   LOG SEARCH HINT (Vercel):
   - Search `OTP`           → all log lines from this function
   - Search `OTP_VERIFY`    → outer verify-flow logs only
   - Search `OTP_VERIFY_DONE` → final result + duration for every verify call
   - Search `OTP_CREATE_SESSION_DONE` → final result of createSession
   - Search `STEP N`        → per-step traces (N = 1..5)
   - Search `findAuthUserByEmail` → email-lookup traces
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

/* ─── Logging helpers ─── */
function logTag(rid) { return `[OTP ${rid}]`; }
function logInfo(rid, msg) { console.log(`${logTag(rid)} ${msg}`); }
function logErr(rid, msg) { console.error(`${logTag(rid)} ${msg}`); }

function maskPhone(m) { return '****' + m.slice(-4); }
function reqId() { return crypto.randomBytes(4).toString('hex'); }
function ms(t0) { return `${Date.now() - t0}ms`; }

async function supaInsert(table, row, rid) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...adminHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    logErr(rid, `supaInsert failed: table=${table} status=${res.status} body=${body.slice(0, 200)}`);
    throw new Error(`DB insert failed: ${res.status}`);
  }
}

async function supaSelect(table, filter, order, rid) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filter)) qs.set(k, String(v));
  if (order) qs.set('order', order);
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${qs}`, {
    headers: { apikey: SUPA_SERVICE, Authorization: `Bearer ${SUPA_SERVICE}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    logErr(rid, `supaSelect failed: table=${table} status=${res.status} body=${body.slice(0, 200)}`);
    throw new Error(`DB select failed: ${res.status}`);
  }
  return (await res.json()) || [];
}

async function supaUpdate(table, filter, patch, rid) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filter)) qs.set(k, String(v));
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${qs}`, {
    method: 'PATCH',
    headers: { ...adminHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    logErr(rid, `supaUpdate failed: table=${table} status=${res.status} body=${body.slice(0, 200)}`);
    throw new Error(`DB update failed: ${res.status}`);
  }
}

async function findAuthUserByPhone(authPhone, rid) {
  const t0 = Date.now();
  let page = 1;
  const perPage = 1000;
  while (true) {
    const res = await fetch(
      `${SUPA_URL}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
      { headers: adminHeaders() }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logErr(rid, `STEP 1 findAuthUserByPhone: admin_list_failed page=${page} status=${res.status} body=${body.slice(0, 200)}`);
      return { user: null, error: 'admin_list_failed', status: res.status };
    }
    const data = await res.json();
    const users = data.users || data || [];
    if (users.length === 0) {
      logInfo(rid, `STEP 1 findAuthUserByPhone: not_found scanned_pages=${page - 1} elapsed=${ms(t0)}`);
      return { user: null, error: null, status: 0 };
    }
    const found = users.find((u) => u.phone === authPhone);
    if (found) {
      logInfo(rid, `STEP 1 findAuthUserByPhone: FOUND id=${found.id} has_email=${!!found.email} has_phone=${!!found.phone} email_confirmed=${found.email_confirmed_at ? 'yes' : 'no'} phone_confirmed=${found.phone_confirmed_at ? 'yes' : 'no'} providers=${JSON.stringify(found.app_metadata?.providers || [])} elapsed=${ms(t0)}`);
      return { user: found, error: null, status: 0 };
    }
    if (users.length < perPage) {
      logInfo(rid, `STEP 1 findAuthUserByPhone: not_found scanned_pages=${page} elapsed=${ms(t0)}`);
      return { user: null, error: null, status: 0 };
    }
    page++;
  }
}

/* ─── findAuthUserByEmail — lookup by exact email match.
   Used as a SECOND lookup if phone lookup fails, since we control the
   OTP email format (`<localmobile>@karbanapp.ir`) and email is unique
   in Supabase Auth. Catches the case where the user has an OTP email
   but their phone field is null or in a different format. */
async function findAuthUserByEmail(email, rid) {
  const t0 = Date.now();
  let page = 1;
  const perPage = 1000;
  while (true) {
    const res = await fetch(
      `${SUPA_URL}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
      { headers: adminHeaders() }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logErr(rid, `findAuthUserByEmail: admin_list_failed page=${page} status=${res.status} body=${body.slice(0, 200)}`);
      return { user: null, error: 'admin_list_failed', status: res.status };
    }
    const data = await res.json();
    const users = data.users || data || [];
    if (users.length === 0) {
      logInfo(rid, `findAuthUserByEmail: not_found scanned_pages=${page - 1} elapsed=${ms(t0)}`);
      return { user: null, error: null, status: 0 };
    }
    const found = users.find((u) => u.email === email);
    if (found) {
      logInfo(rid, `findAuthUserByEmail: FOUND id=${found.id} email=${found.email} has_phone=${!!found.phone} phone=${found.phone || 'null'} email_confirmed=${found.email_confirmed_at ? 'yes' : 'no'} providers=${JSON.stringify(found.app_metadata?.providers || [])} elapsed=${ms(t0)}`);
      return { user: found, error: null, status: 0 };
    }
    if (users.length < perPage) {
      logInfo(rid, `findAuthUserByEmail: not_found scanned_pages=${page} elapsed=${ms(t0)}`);
      return { user: null, error: null, status: 0 };
    }
    page++;
  }
}

function verifyPhoneMatch(authUser, authPhone) {
  if (!authUser || !authUser.phone) return false;
  return authUser.phone === authPhone;
}

async function ensureProfile(userId, localMobile, rid) {
  let existing;
  try {
    existing = await supaSelect('profiles', { id: `eq.${userId}`, select: 'id' }, null, rid);
  } catch (e) {
    logErr(rid, `ensureProfile: select failed: ${e.message}`);
    return;
  }
  if (existing.length > 0) { logInfo(rid, `ensureProfile: exists user=${userId}`); return; }
  try {
    await supaInsert('profiles', { id: userId, phone: localMobile, full_name: `کاربر ${localMobile.slice(-4)}` }, rid);
    logInfo(rid, `ensureProfile: created user=${userId}`);
  } catch (e) {
    logErr(rid, `ensureProfile: insert failed: ${e.message}`);
  }
}

function isIranianMobile(m) { return /^09[0-9]{9}$/.test(m); }
function genCode() { return String(Math.floor(100000 + Math.random() * 900000)); }
function hashCode(code) { return crypto.createHash('sha256').update(code).digest('hex'); }

function getPhonePassword(mobile) {
  const secret = process.env.SMSIR_API_KEY?.slice(0, 16) || 'karban-secret';
  return `kb_${mobile}_${secret}`;
}

async function sendSmsIr(mobile, code, rid) {
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
   createSession — same architecture, unified OTP-tagged diagnostics.
   Every step logs elapsed ms; every exit point logs a final summary.
   ════════════════════════════════════════════════════════════════ */
async function createSession(localMobile, rid) {
  const t0 = Date.now();
  const password = getPhonePassword(localMobile);
  const authPhone = toE164(localMobile);
  const otpEmail = `${localMobile}@karbanapp.ir`;

  logInfo(rid, `OTP_CREATE_SESSION: START phone=${maskPhone(localMobile)} authPhone=${maskPhone(authPhone || '')} otpEmail=${otpEmail}`);

  if (!authPhone) {
    logErr(rid, `OTP_CREATE_SESSION_DONE result=null reason=invalid_e164 elapsed=${ms(t0)}`);
    return null;
  }
  if (!SUPA_SERVICE) {
    logErr(rid, `OTP_CREATE_SESSION_DONE result=null reason=service_key_not_set elapsed=${ms(t0)}`);
    return null;
  }

  let userId = null;
  let grantEmail = null;
  let failureReason = null;

  /* ─── STEP 1: Find existing Auth user ─── */
  /* Strategy: try by EMAIL first (most reliable — we control the OTP email format),
     then by E.164 phone (fallback for phone_confirm users),
     then by local phone (fallback for legacy users). */
  logInfo(rid, `STEP 1: findAuthUserByEmail start email=${otpEmail}`);
  const lookupByEmail = await findAuthUserByEmail(otpEmail, rid);

  let lookup = lookupByEmail;

  if (!lookup.user && !lookup.error) {
    logInfo(rid, `STEP 1: email_lookup_failed_now_trying_phone_e164 phone=${authPhone}`);
    lookup = await findAuthUserByPhone(authPhone, rid);
  }

  if (!lookup.user && !lookup.error) {
    logInfo(rid, `STEP 1: e164_lookup_failed_now_trying_local_phone phone=${localMobile}`);
    /* Try local format (e.g., 09xxxxxxxxx) as last resort */
    lookup = await findAuthUserByPhone(localMobile, rid);
  }

  if (lookup.error) {
    failureReason = `step1_lookup_${lookup.error}_${lookup.status}`;
    logErr(rid, `STEP 1 FAILED: error=${lookup.error} status=${lookup.status} elapsed=${ms(t0)}`);
    logErr(rid, `OTP_CREATE_SESSION_DONE result=null reason=${failureReason} elapsed=${ms(t0)}`);
    return null;
  }

  if (lookup.user) {
    /* Found a user (by email OR by phone in any format).
       Use their stored email as grantEmail (preserve existing email). */
    userId = lookup.user.id;

    if (lookup.user.email) {
      grantEmail = lookup.user.email;
      logInfo(rid, `STEP 1: user_found id=${userId} via_email_or_phone grant_email=${grantEmail} stored_phone=${lookup.user.phone || 'null'}`);
      /* STEP 2a: Set password only — DO NOT touch email */
      logInfo(rid, `STEP 2a: set_password_only preserving_email`);
      const updT0 = Date.now();
      const updateRes = await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, {
        method: 'PUT', headers: adminHeaders(),
        body: JSON.stringify({ password: password }),
      });
      if (!updateRes.ok) {
        const errBody = await updateRes.text().catch(() => '');
        failureReason = `step2a_password_set_${updateRes.status}`;
        logErr(rid, `STEP 2a FAILED: status=${updateRes.status} body=${errBody.slice(0, 300)} elapsed=${ms(updT0)}`);
        logErr(rid, `OTP_CREATE_SESSION_DONE result=null reason=${failureReason} elapsed=${ms(t0)}`);
        return null;
      }
      logInfo(rid, `STEP 2a: password_set OK elapsed=${ms(updT0)}`);
    } else {
      /* User found but has no email — set password + otpEmail */
      grantEmail = otpEmail;
      logInfo(rid, `STEP 1: user_found id=${userId} has_email=false setting_otp_email`);
      logInfo(rid, `STEP 2b: set_password_and_email`);
      const updT0 = Date.now();
      const updateRes = await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, {
        method: 'PUT', headers: adminHeaders(),
        body: JSON.stringify({ password: password, email: grantEmail, email_confirm: true }),
      });
      if (!updateRes.ok) {
        const errBody = await updateRes.text().catch(() => '');
        failureReason = `step2b_password_email_set_${updateRes.status}`;
        logErr(rid, `STEP 2b FAILED: status=${updateRes.status} body=${errBody.slice(0, 300)} elapsed=${ms(updT0)}`);
        logErr(rid, `OTP_CREATE_SESSION_DONE result=null reason=${failureReason} elapsed=${ms(t0)}`);
        return null;
      }
      logInfo(rid, `STEP 2b: password+email_set OK elapsed=${ms(updT0)}`);
    }
  } else {
    logInfo(rid, 'STEP 1: user_not_found proceeding_to_create');
  }

  /* ─── STEP 3: Create new user if not found ─── */
  if (!userId) {
    grantEmail = otpEmail;
    logInfo(rid, 'STEP 3: create_new_user start');
    const crtT0 = Date.now();
    const createRes = await fetch(`${SUPA_URL}/auth/v1/admin/users`, {
      method: 'POST', headers: adminHeaders(),
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
      logInfo(rid, `STEP 3: new_user_created id=${userId} elapsed=${ms(crtT0)}`);
    } else if (createRes.status === 422 && (createJ.error_code === 'phone_exists' || createJ.error_code === 'email_exists')) {
      /* Both `phone_exists` and `email_exists` mean "user already exists".
         Re-lookup by EMAIL (most reliable — we always control the OTP email format). */
      logInfo(rid, `STEP 3: ${createJ.error_code} re-lookup_by_email elapsed=${ms(crtT0)}`);
      const reLookup = await findAuthUserByEmail(otpEmail, rid);
      if (reLookup.error) {
        failureReason = `step3_relookup_${reLookup.error}_${reLookup.status}`;
        logErr(rid, `STEP 3 FAILED: re-lookup error=${reLookup.error} status=${reLookup.status} elapsed=${ms(t0)}`);
        logErr(rid, `OTP_CREATE_SESSION_DONE result=null reason=${failureReason} elapsed=${ms(t0)}`);
        return null;
      }
      if (reLookup.user) {
        userId = reLookup.user.id;
        if (reLookup.user.email) {
          grantEmail = reLookup.user.email;
          logInfo(rid, `STEP 3: found_after_${createJ.error_code} id=${userId} preserving_email grant_email=${grantEmail} stored_phone=${reLookup.user.phone || 'null'}`);
          const upd = await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, {
            method: 'PUT', headers: adminHeaders(),
            body: JSON.stringify({ password: password }),
          });
          if (!upd.ok) {
            const b = await upd.text().catch(() => '');
            failureReason = `step3_password_after_${createJ.error_code}_${upd.status}`;
            logErr(rid, `STEP 3 FAILED: password after ${createJ.error_code} status=${upd.status} body=${b.slice(0, 300)} elapsed=${ms(t0)}`);
            logErr(rid, `OTP_CREATE_SESSION_DONE result=null reason=${failureReason} elapsed=${ms(t0)}`);
            return null;
          }
          logInfo(rid, `STEP 3: password_set OK after ${createJ.error_code}`);
        } else {
          /* Should not happen — email_exists means email is set, but just in case */
          grantEmail = otpEmail;
          logInfo(rid, `STEP 3: found_after_${createJ.error_code} id=${userId} has_email=false setting_otp_email`);
          const upd = await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, {
            method: 'PUT', headers: adminHeaders(),
            body: JSON.stringify({ password: password, email: grantEmail, email_confirm: true }),
          });
          if (!upd.ok) {
            const b = await upd.text().catch(() => '');
            failureReason = `step3_password_email_after_${createJ.error_code}_${upd.status}`;
            logErr(rid, `STEP 3 FAILED: password+email after ${createJ.error_code} status=${upd.status} body=${b.slice(0, 300)} elapsed=${ms(t0)}`);
            logErr(rid, `OTP_CREATE_SESSION_DONE result=null reason=${failureReason} elapsed=${ms(t0)}`);
            return null;
          }
          logInfo(rid, `STEP 3: password+email_set OK after ${createJ.error_code}`);
        }
      } else {
        failureReason = `step3_${createJ.error_code}_but_not_found_by_email`;
        logErr(rid, `STEP 3 FAILED: ${createJ.error_code} but re-lookup by email did not find user elapsed=${ms(t0)}`);
        logErr(rid, `OTP_CREATE_SESSION_DONE result=null reason=${failureReason} elapsed=${ms(t0)}`);
        return null;
      }
    } else {
      failureReason = `step3_create_${createRes.status}_${createJ.error_code || 'none'}`;
      logErr(rid, `STEP 3 FAILED: create status=${createRes.status} error_code=${createJ.error_code || 'none'} msg=${(createJ.msg || createJ.message || '').slice(0, 300)} elapsed=${ms(t0)}`);
      logErr(rid, `OTP_CREATE_SESSION_DONE result=null reason=${failureReason} elapsed=${ms(t0)}`);
      return null;
    }
  }

  if (!userId || !grantEmail) {
    failureReason = 'missing_userid_or_grantemail';
    logErr(rid, `createSession: missing userId or grantEmail after all steps elapsed=${ms(t0)}`);
    logErr(rid, `OTP_CREATE_SESSION_DONE result=null reason=${failureReason} elapsed=${ms(t0)}`);
    return null;
  }

  /* ─── STEP 4: Token grant ─── */
  logInfo(rid, `STEP 4: token_grant start grant_email=${grantEmail} user_id=${userId}`);
  const tokT0 = Date.now();
  const tokenRes = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: anonHeaders(),
    body: JSON.stringify({ email: grantEmail, password: password }),
  });
  const tokenJ = await tokenRes.json().catch(() => ({}));

  if (tokenRes.ok && tokenJ.access_token && tokenJ.refresh_token) {
    logInfo(rid, `STEP 4: SUCCESS token_grant user=${userId} elapsed=${ms(tokT0)} access_token_len=${tokenJ.access_token?.length || 0}`);
    await ensureProfile(userId, localMobile, rid);
    logInfo(rid, `OTP_CREATE_SESSION_DONE result=success method=password_grant user=${userId} elapsed=${ms(t0)}`);
    return { access_token: tokenJ.access_token, refresh_token: tokenJ.refresh_token, user_id: userId };
  }

  failureReason = `step4_token_${tokenRes.status}_${tokenJ.error_code || 'none'}`;
  logErr(rid, `STEP 4 FAILED: token_grant status=${tokenRes.status} error_code=${tokenJ.error_code || 'none'} msg=${(tokenJ.msg || tokenJ.message || '').slice(0, 300)} elapsed=${ms(tokT0)}`);

  /* ─── STEP 5: Fallback magic link ─── */
  logInfo(rid, 'STEP 5: magic_link_fallback start');
  const linkT0 = Date.now();
  const linkRes = await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}/generate_link`, {
    method: 'POST', headers: adminHeaders(),
    body: JSON.stringify({ type: 'magiclink' }),
  });
  const linkJ = await linkRes.json().catch(() => ({}));
  if (!linkRes.ok) {
    failureReason = `step5_generate_link_${linkRes.status}_${linkJ.error_code || 'none'}`;
    logErr(rid, `STEP 5 FAILED: generate_link status=${linkRes.status} error_code=${linkJ.error_code || 'none'} msg=${(linkJ.msg || linkJ.message || '').slice(0, 300)} elapsed=${ms(linkT0)}`);
    logErr(rid, `OTP_CREATE_SESSION_DONE result=null reason=${failureReason} user=${userId} elapsed=${ms(t0)}`);
    return null;
  }
  if (linkJ.properties?.action_link) {
    logInfo(rid, `STEP 5: following magic link redirect elapsed=${ms(linkT0)}`);
    const exRes = await fetch(linkJ.properties.action_link, { method: 'GET', redirect: 'manual' });
    const location = exRes.headers.get('location');
    logInfo(rid, `STEP 5: redirect status=${exRes.status} has_location=${!!location} elapsed=${ms(linkT0)}`);
    if (location) {
      const m = location.match(/#access_token=([^&]+)&.*refresh_token=([^&]+)/);
      if (m) {
        logInfo(rid, `STEP 5: SUCCESS magic_link user=${userId} elapsed=${ms(linkT0)}`);
        await ensureProfile(userId, localMobile, rid);
        logInfo(rid, `OTP_CREATE_SESSION_DONE result=success method=magic_link user=${userId} elapsed=${ms(t0)}`);
        return { access_token: decodeURIComponent(m[1]), refresh_token: decodeURIComponent(m[2]), user_id: userId };
      }
      logErr(rid, `STEP 5 FAILED: location did not contain access_token+refresh_token location=${location.slice(0, 200)}`);
    } else {
      logErr(rid, 'STEP 5 FAILED: no location header');
    }
  } else {
    logErr(rid, 'STEP 5 FAILED: no action_link in response');
  }

  failureReason = failureReason || 'step5_unknown_failure';
  logErr(rid, `OTP_CREATE_SESSION_DONE result=null reason=${failureReason} user=${userId} elapsed=${ms(t0)}`);
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

  const rid = reqId();
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
      await supaInsert('otp_codes', { mobile, code, code_hash: hashCode(code), purpose: 'login', expires_at: expiresAt }, rid);
      await sendSmsIr(mobile, code, rid);
      logInfo(rid, `OTP_SEND: success phone=${maskPhone(mobile)}`);
      return res.json({ ok: true, message: 'کد ارسال شد', ttl_min: TTL_MIN });
    } catch (e) {
      logErr(rid, `OTP_SEND: failed phone=${maskPhone(mobile)} err=${e.message}`);
      return res.status(502).json({ ok: false, error: 'ارسال پیامک ناموفق بود', detail: e.detail || e.message });
    }
  }

  if (action === 'verify') {
    const { mobile, code } = req.body || {};
    if (!isIranianMobile(mobile) || !/^\d{6}$/.test(code)) {
      logInfo(rid, `OTP_VERIFY_DONE result=reject reason=invalid_input phone=${maskPhone(mobile || '')} code_len=${(code || '').length}`);
      return res.status(400).json({ ok: false, error: 'شماره یا کد نامعتبر است' });
    }

    const t0 = Date.now();
    logInfo(rid, `OTP_VERIFY: START phone=${maskPhone(mobile)}`);

    try {
      const rows = await supaSelect('otp_codes', {
        mobile: `eq.${mobile}`,
        purpose: `eq.login`,
        verified: `eq.false`,
        order: 'created_at.desc',
      }, null, rid);

      const now = Date.now();
      const latest = rows.find((r) => new Date(r.expires_at).getTime() > now);

      if (!latest) {
        logInfo(rid, `OTP_VERIFY_DONE result=reject reason=no_valid_otp rows=${rows.length} elapsed=${ms(t0)}`);
        return res.status(400).json({ ok: false, error: 'کد معتبر نیست یا منقضی شده؛ کد جدید بگیرید' });
      }
      if (latest.attempts >= MAX_ATTEMPTS) {
        logInfo(rid, `OTP_VERIFY_DONE result=reject reason=max_attempts attempts=${latest.attempts} elapsed=${ms(t0)}`);
        return res.status(400).json({ ok: false, error: 'تعداد تلاش بیش از حد؛ کد جدید بگیرید' });
      }

      if (latest.code_hash !== hashCode(code)) {
        await supaUpdate('otp_codes', { id: `eq.${latest.id}` }, { attempts: latest.attempts + 1 }, rid);
        logInfo(rid, `OTP_VERIFY_DONE result=reject reason=wrong_code remaining=${MAX_ATTEMPTS - latest.attempts - 1} elapsed=${ms(t0)}`);
        return res.status(400).json({ ok: false, error: `کد اشتباه است — ${(MAX_ATTEMPTS - latest.attempts - 1).toLocaleString('fa-IR')} تلاش باقی است` });
      }

      logInfo(rid, `OTP_VERIFY: code_correct calling_createSession elapsed_so_far=${ms(t0)}`);
      const session = await createSession(mobile, rid);

      if (session?.access_token && session?.refresh_token) {
        await supaUpdate('otp_codes', { id: `eq.${latest.id}` }, { verified: true }, rid);
        logInfo(rid, `OTP_VERIFY_DONE result=success user_id=${session.user_id} has_access_token=true has_refresh_token=true access_token_len=${session.access_token?.length || 0} elapsed=${ms(t0)}`);
        return res.json({
          ok: true,
          user_id: session.user_id,
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          message: 'ورود موفق بود',
        });
      }

      logErr(rid, `OTP_VERIFY_DONE result=partial code_verified=true session_null=true elapsed=${ms(t0)}`);
      return res.json({
        ok: false,
        error: 'کد تأیید شد اما نشست ساخته نشد. لطفاً دوباره تلاش کنید یا با گوگل وارد شوید.',
        code_verified: true,
      });
    } catch (e) {
      logErr(rid, `OTP_VERIFY_DONE result=exception name=${e.name} msg=${e.message} elapsed=${ms(t0)}`);
      return res.status(500).json({ ok: false, error: 'تأیید کد ناموفق بود', detail: e.message });
    }
  }

  return res.status(400).json({ ok: false, error: 'action نامعتبر' });
}

export const config = { maxDuration: 15 };
