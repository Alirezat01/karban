/* ═════════════════════════════════════════════════════════════════════
   کاربان — OTP ورود با موبایل
   ─────────────────────────────────────────────────────────────────
   کلیدها:
     SUPABASE_ANON_KEY       — برای Auth public flow (token endpoint)
     SUPABASE_SERVICE_ROLE_KEY — فقط برای Admin API

   جریان verify:
     1. OTP را بررسی کن (purpose=login, verified=false, expires_at>now)
     2. Auth user را بر اساس phone پیدا کن (Admin API)
     3. اگر نبود، با Admin API بساز (phone_confirm=true, password=set)
     4. اگر بود، password را set کن و phone_confirm=true کن
     5. با SUPABASE_ANON_KEY از token endpoint نشست بگیر
     6. access_token + refresh_token را برگردان
   ═════════════════════════════════════════════════════════════════════ */

import crypto from 'node:crypto';

const TTL_MIN = Number(process.env.OTP_TTL_MINUTES || 5);
const MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);
const IP_WINDOW_MS = 10 * 60 * 1000;
const IP_MAX = 5;
const MOBILE_WINDOW_MS = 60 * 60 * 1000;
const MOBILE_MAX = 3;

/* ─── کلیدها کاملاً جدا ─── */
const SUPA_URL = 'https://rocjeanizzhfvhnuhnms.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvY2plYW5penpoZnZobnVobm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NDQwMDcsImV4cCI6MjEwMjAyMDAwN30.Br3brGTpjWnI7ilghPka_DyYUQU7e9eYIPv88Ehqy6g';
const SUPA_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/* ─── Admin API helper (فقط با service_role) ─── */
const adminHeaders = () => ({
  'Content-Type': 'application/json',
  apikey: SUPA_SERVICE,
  Authorization: `Bearer ${SUPA_SERVICE}`,
});

/* ─── Auth public helper (فقط با anon) ─── */
const anonHeaders = () => ({
  'Content-Type': 'application/json',
  apikey: SUPA_ANON,
  Authorization: `Bearer ${SUPA_ANON}`,
});

/* ─── Service data helper (otp_codes با service_role) ─── */
async function supaInsert(table, row) {
  await fetch(`${SUPA_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...adminHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });
}

async function supaSelect(table, filter, order) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filter)) qs.set(k, String(v));
  if (order) qs.set('order', order);
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${qs}`, {
    headers: { apikey: SUPA_SERVICE, Authorization: `Bearer ${SUPA_SERVICE}` },
  });
  if (!res.ok) return [];
  return (await res.json()) || [];
}

async function supaUpdate(table, filter, patch) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filter)) qs.set(k, String(v));
  await fetch(`${SUPA_URL}/rest/v1/${table}?${qs}`, {
    method: 'PATCH',
    headers: { ...adminHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
}

function isIranianMobile(m) { return /^09[0-9]{9}$/.test(m); }
function genCode() { return String(Math.floor(100000 + Math.random() * 900000)); }
function hashCode(code) { return crypto.createHash('sha256').update(code).digest('hex'); }

/* ─── password موقت برای هر موبایل ─── */
function getPhonePassword(mobile) {
  const secret = process.env.SMSIR_API_KEY?.slice(0, 16) || 'karban-secret';
  return `kb_${mobile}_${secret}`;
}

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

/* ════════════════════════════════════════════════════════════════
   createSession — جریان صحیح:
   1. Auth user را بر اساس phone پیدا کن (Admin API)
   2. اگر نبود، بساز با phone_confirm=true + password
   3. اگر بود، password را set کن + phone_confirm=true
   4. با SUPABASE_ANON_KEY از token endpoint نشست بگیر
   5. access_token + refresh_token را برگردان
   ════════════════════════════════════════════════════════════════ */
async function createSession(mobile) {
  const password = getPhonePassword(mobile);

  if (!SUPA_SERVICE) {
    console.error('createSession: SUPABASE_SERVICE_ROLE_KEY not set');
    return null;
  }

  /* ۱. جستجوی Auth user بر اساس phone — از Admin API استفاده می‌کنیم */
  /* Admin API: GET /auth/v1/admin/users → فیلتر با phone */
  let userId = null;

  /* روش: تمام کاربران را لیست کن و فیلتر کن بر اساس phone */
  /* Supabase Admin API از فیلتر مستقیم phone پشتیبانی نمی‌کند، پس از profiles استفاده می‌کنیم */
  const profiles = await supaSelect('profiles', { phone: `eq.${mobile}`, select: 'id' });
  userId = profiles[0]?.id;

  /* اگر در profiles نبود، در Auth users جستجو کن */
  if (!userId) {
    /* GET /auth/v1/admin/users — لیست همه کاربران */
    const listRes = await fetch(`${SUPA_URL}/auth/v1/admin/users?per_page=1000`, {
      headers: adminHeaders(),
    });
    if (listRes.ok) {
      const listData = await listRes.json();
      const users = listData.users || listData || [];
      const found = users.find((u) => u.phone === mobile);
      if (found) userId = found.id;
    }
  }

  /* ۲. اگر کاربر وجود ندارد → بساز */
  if (!userId) {
    const createRes = await fetch(`${SUPA_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({
        phone: mobile,
        phone_confirm: true,
        password: password,
        user_metadata: { full_name: `کاربر ${mobile.slice(-4)}` },
      }),
    });
    const createJ = await createRes.json().catch(() => ({}));
    if (!createRes.ok) {
      console.error('createSession: admin create failed:', createRes.status, JSON.stringify(createJ).slice(0, 500));
      return null;
    }
    userId = createJ.id;
    if (userId) {
      await supaInsert('profiles', { id: userId, role: 'user', phone: mobile, full_name: `کاربر ${mobile.slice(-4)}` });
    }
  } else {
    /* ۳. کاربر وجود دارد → password را set کن + phone_confirm=true */
    const updateRes = await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: adminHeaders(),
      body: JSON.stringify({
        password: password,
        phone_confirm: true,
      }),
    });
    if (!updateRes.ok) {
      const errBody = await updateRes.text().catch(() => '');
      console.error('createSession: admin update failed:', updateRes.status, errBody.slice(0, 500));
    }
  }

  if (!userId) {
    console.error('createSession: no userId after create/find');
    return null;
  }

  /* ۴. نشست بگیر با SUPABASE_ANON_KEY (نه service_role!) */
  const tokenRes = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: anonHeaders(),
    body: JSON.stringify({ phone: mobile, password: password }),
  });

  const tokenJ = await tokenRes.json().catch(() => ({}));

  if (tokenRes.ok && tokenJ.access_token) {
    return {
      access_token: tokenJ.access_token,
      refresh_token: tokenJ.refresh_token,
      user_id: userId,
    };
  }

  /* ۵. اگر password grant شکست خورد — خطای واقعی را log کن */
  console.error('createSession: token endpoint failed:', tokenRes.status, JSON.stringify(tokenJ).slice(0, 500));

  /* fallback: magic link */
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
      const hashMatch = location.match(/#access_token=([^&]+)&.*refresh_token=([^&]+)/);
      if (hashMatch) {
        return {
          access_token: decodeURIComponent(hashMatch[1]),
          refresh_token: decodeURIComponent(hashMatch[2]),
          user_id: userId,
        };
      }
    }
  }

  console.error('createSession: all methods failed for', mobile);
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

  /* ─── SEND ─── */
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

  /* ─── VERIFY ─── */
  if (action === 'verify') {
    const { mobile, code } = req.body || {};
    if (!isIranianMobile(mobile) || !/^\d{6}$/.test(code)) return res.status(400).json({ ok: false, error: 'شماره یا کد نامعتبر است' });

    try {
      /* فقط OTP معتبر: purpose=login, verified=false, expires_at > now */
      const rows = await supaSelect('otp_codes', {
        mobile: `eq.${mobile}`,
        purpose: `eq.login`,
        verified: `eq.false`,
        order: 'created_at.desc',
      });

      /* فیلتر expires_at در JavaScript چون Supabase REST ممکنه timestamp را متفاوت parse کنه */
      const now = Date.now();
      const latest = rows.find((r) => new Date(r.expires_at).getTime() > now);

      if (!latest) return res.status(400).json({ ok: false, error: 'کد معتبر نیست یا منقضی شده؛ کد جدید بگیرید' });
      if (latest.attempts >= MAX_ATTEMPTS) return res.status(400).json({ ok: false, error: 'تعداد تلاش بیش از حد؛ کد جدید بگیرید' });

      /* بررسی کد */
      if (latest.code_hash !== hashCode(code)) {
        await supaUpdate('otp_codes', { id: `eq.${latest.id}` }, { attempts: latest.attempts + 1 });
        return res.status(400).json({ ok: false, error: `کد اشتباه است — ${(MAX_ATTEMPTS - latest.attempts - 1).toLocaleString('fa-IR')} تلاش باقی است` });
      }

      /* کد درست است — اما هنوز verified=true نکن چون ممکنه session ساخته نشه */
      const session = await createSession(mobile);

      if (session?.access_token) {
        /* session ساخته شد → حالا verified=true کن */
        await supaUpdate('otp_codes', { id: `eq.${latest.id}` }, { verified: true });
        return res.json({
          ok: true,
          user_id: session.user_id,
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          message: 'ورود موفق بود',
        });
      }

      /* session ساخته نشد — OTP را verified=true نکن تا کاربر بتواند دوباره تلاش کند */
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
