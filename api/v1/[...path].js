/* ═════════════════════════════════════════════════════════════════════
   Karban Public REST API v1 — Phase 5.4
   ─────────────────────────────────────────────────────────────────
   Available endpoints (all require x-api-key header):
     GET  /api/v1/me                  — current key info
     GET  /api/v1/contracts           — list published contracts (?limit, ?industry, ?type)
     GET  /api/v1/contracts/:id       — single contract by ID
     GET  /api/v1/calculators        — list available calculator slugs
     GET  /api/v1/calculators/:slug  — calculator params from app_settings
     POST /api/v1/ai/analyze         — wrapper around AI analyze (scope: ai)

   Authentication: x-api-key header with the API key created in /داشبورد
   Rate limit: per-key daily counter (default 1000 requests/day)
   Response: JSON with { ok, data } or { ok: false, error }
   ═════════════════════════════════════════════════════════════════════ */

import crypto from 'node:crypto';

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function hashCode(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

async function supaSelect(table, qs, headers = {}) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${qs}`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, ...headers },
  });
  if (!res.ok) return [];
  const j = await res.json();
  return j || [];
}

async function supaInsert(table, row) {
  await fetch(`${SUPA_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });
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

async function authenticateKey(req) {
  const key = req.headers['x-api-key'];
  if (!key) return { error: 'missing x-api-key header', status: 401 };
  const keyHash = hashCode(key);

  const rows = await supaSelect('api_keys', `id,user_id,name,scopes,rate_limit_per_day,is_active,expires_at&key_hash=eq.${encodeURIComponent(keyHash)}&limit=1`);
  const apiKey = rows[0];
  if (!apiKey || !apiKey.is_active) {
    return { error: 'invalid or inactive API key', status: 401 };
  }
  if (apiKey.expires_at && new Date(apiKey.expires_at).getTime() < Date.now()) {
    return { error: 'API key expired', status: 401 };
  }

  /* به‌روزرسانی last_used_at (fire-and-forget) */
  supaUpdate('api_keys', { id: `eq.${apiKey.id}` }, { last_used_at: new Date().toISOString() });

  /* بررسی rate limit روزانه */
  const today = new Date().toISOString().slice(0, 10);
  const usage = await supaSelect('api_usage', `count&api_key_id=eq.${apiKey.id}&day=eq.${today}&limit=1`);
  const currentCount = (usage[0]?.count) || 0;
  if (currentCount >= apiKey.rate_limit_per_day) {
    return { error: `rate limit exceeded (${apiKey.rate_limit_per_day}/day)`, status: 429 };
  }
  /* ثبت این درخواست */
  const existing = await supaSelect('api_usage', `id,count&api_key_id=eq.${apiKey.id}&day=eq.${today}&limit=1`);
  if (existing[0]) {
    await supaUpdate('api_usage', { id: `eq.${existing[0].id}` }, { count: existing[0].count + 1 });
  } else {
    await supaInsert('api_usage', { api_key_id: apiKey.id, day: today, count: 1 });
  }

  return { apiKey };
}

function checkScope(apiKey, scope) {
  return Array.isArray(apiKey.scopes) && apiKey.scopes.includes(scope);
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  };
}

export default async function handler(req, res) {
  /* CORS preflight */
  if (req.method === 'OPTIONS') {
    return res.status(204).setHeader('Access-Control-Allow-Origin', '*').end();
  }
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  /* احراز هویت */
  const auth = await authenticateKey(req);
  if (auth.error) {
    return res.status(auth.status).json({ ok: false, error: auth.error });
  }
  const { apiKey } = auth;

  /* مسیر را از query string جدا می‌کنیم.
     در Vercel، با catch-all route، req.query.path آرایه‌ای از بخش‌های مسیر است. */
  const pathParts = Array.isArray(req.query.path) ? req.query.path : (req.query.path ? [req.query.path] : []);
  const route = pathParts.join('/');

  /* GET /api/v1/me */
  if (route === 'me' && req.method === 'GET') {
    return res.json({
      ok: true,
      data: {
        name: apiKey.name,
        scopes: apiKey.scopes,
        rate_limit_per_day: apiKey.rate_limit_per_day,
        expires_at: apiKey.expires_at,
      },
    });
  }

  /* GET /api/v1/contracts */
  if (route === 'contracts' && req.method === 'GET') {
    if (!checkScope(apiKey, 'contracts')) {
      return res.status(403).json({ ok: false, error: 'scope "contracts" not allowed' });
    }
    const limit = Math.min(100, Number(req.query.limit) || 50);
    const filters = ['is_published=eq.true'];
    if (req.query.industry) filters.push(`industry=eq.${encodeURIComponent(req.query.industry)}`);
    if (req.query.type) filters.push(`type=eq.${encodeURIComponent(req.query.type)}`);
    filters.push(`limit=${limit}`);
    filters.push('select=id,title,type,industry,summary,pdf_url');
    const data = await supaSelect('contracts', filters.join('&'));
    return res.json({ ok: true, data, count: data.length });
  }

  /* GET /api/v1/contracts/:id */
  const contractMatch = route.match(/^contracts\/(.+)$/);
  if (contractMatch && req.method === 'GET') {
    if (!checkScope(apiKey, 'contracts')) {
      return res.status(403).json({ ok: false, error: 'scope "contracts" not allowed' });
    }
    const id = contractMatch[1];
    const rows = await supaSelect('contracts', `id,title,type,industry,summary,body,pdf_url&is_published=eq.true&id=eq.${encodeURIComponent(id)}&limit=1`);
    if (!rows[0]) return res.status(404).json({ ok: false, error: 'contract not found' });
    return res.json({ ok: true, data: rows[0] });
  }

  /* GET /api/v1/calculators */
  if (route === 'calculators' && req.method === 'GET') {
    if (!checkScope(apiKey, 'calculators')) {
      return res.status(403).json({ ok: false, error: 'scope "calculators" not allowed' });
    }
    const rows = await supaSelect('app_settings', `key,value&key=eq.calc_1405&limit=1`);
    return res.json({
      ok: true,
      data: {
        slugs: ['محاسبه-حقوق', 'هزینه-استخدام', 'سنوات', 'بازنشستگی', 'اضافه-کاری', 'مالیات-مشخص', 'ارزش-افزوده', 'مالیات-حقوق', 'عیدی-و-پاداش', 'بیمه-تامین-اجتماعی', 'مرخصی', 'مزایای-پایان-همکاری', 'ثبت-شرکت'],
        params: rows[0]?.value || null,
      },
    });
  }

  /* GET /api/v1/calculators/:slug */
  const calcMatch = route.match(/^calculators\/(.+)$/);
  if (calcMatch && req.method === 'GET') {
    if (!checkScope(apiKey, 'calculators')) {
      return res.status(403).json({ ok: false, error: 'scope "calculators" not allowed' });
    }
    const slug = calcMatch[1];
    const rows = await supaSelect('app_settings', `key,value&key=eq.calc_1405&limit=1`);
    if (!rows[0]?.value) return res.status(404).json({ ok: false, error: 'params not configured' });
    return res.json({ ok: true, data: { slug, params: rows[0].value } });
  }

  /* POST /api/v1/ai/analyze */
  if (route === 'ai/analyze' && req.method === 'POST') {
    if (!checkScope(apiKey, 'ai')) {
      return res.status(403).json({ ok: false, error: 'scope "ai" not allowed' });
    }
    /* proxy به api/ai-analyze */
    try {
      const analyzeRes = await fetch(`https://${req.headers.host}/api/ai-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body || {}),
      });
      const j = await analyzeRes.json();
      return res.status(analyzeRes.status).json(j);
    } catch (e) {
      return res.status(502).json({ ok: false, error: 'AI analyze failed', detail: e.message });
    }
  }

  return res.status(404).json({ ok: false, error: `endpoint not found: ${req.method} /api/v1/${route}` });
}

export const config = { maxDuration: 30 };
