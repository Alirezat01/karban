/* ═════════════════════════════════════════════════════════════════════
   حسابرسی خودکار حسابداری کاربان — اجرا روی Vercel (توکن‌ها همان‌جاست)
   ─────────────────────────────────────────────────────────────────
   فراخوانی:
     • GET  /api/acc-audit        → Vercel Cron (روزانه) + مرورگر
     • POST /api/acc-audit        → GitHub Actions / دستی
   احراز هویت (اختیاری ولی توصیه‌شده):
     • env ورسل: AUDIT_TOKEN → فراخواننده باید ?key=... یا هدر x-audit-key بفرستد
     • env ورسل: CRON_SECRET  → Vercel Cron خودش «Authorization: Bearer» می‌فرستد
     • اگر هیچ‌کدام تنظیم نشده باشد: اجرای آزاد با محدودیت زمانی (هر ۱۰ دقیقه یک‌بار)
       و پاسخ فقط نسخه عمومی (بدون داده‌های واقعی مشتریان)
   ذخیره گزارش کامل: site_secrets.key = 'acc_audit_report'
   اعلان: تلگرام ادمین با TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (از env ورسل)
   نکته: موتور حسابرسی در lib-audit/audit-core.js است (خارج از api/ تا ورسل
   آن را در باندل تابع قرار دهد — پوشه‌های _دار داخل api/ از باندل حذف می‌شوند)
   ═════════════════════════════════════════════════════════════════════ */
import { resolveConfig, runAudit, publicReport, buildMd } from '../lib-audit/audit-core.js';

export const maxDuration = 60;

const RATE_LIMIT_MS = 10 * 60 * 1000; // ۱۰ دقیقه
const KEY_LAST = 'acc_audit_last_run';
const KEY_REPORT = 'acc_audit_report';

function json(res, status, obj) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

function safeParse(s) {
  try { return typeof s === 'string' ? JSON.parse(s) : s; } catch { return null; }
}

async function srFetch(URL, SRK, path, method = 'GET', body = null) {
  const r = await fetch(`${URL}/${path}`, {
    method,
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* noop */ }
  return { status: r.status, json, text };
}

async function readSecret(URL, SRK, key) {
  const r = await srFetch(URL, SRK, `rest/v1/site_secrets?key=eq.${encodeURIComponent(key)}&select=value,updated_at`);
  return Array.isArray(r.json) && r.json[0] ? r.json[0] : null;
}

/* upsert بدون تکیه بر on_conflict: اول PATCH، اگر نبود POST */
async function writeSecret(URL, SRK, key, value) {
  const p = await srFetch(URL, SRK, `rest/v1/site_secrets?key=eq.${encodeURIComponent(key)}`, 'PATCH', { value, updated_at: new Date().toISOString() });
  if (p.status === 204) return true;
  const ins = await srFetch(URL, SRK, 'rest/v1/site_secrets', 'POST', { key, value, updated_at: new Date().toISOString() });
  return ins.status === 201;
}

async function sendTelegram(summary, findings) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { skipped: true };
  const d = new Date();
  const date = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  const lines = [];
  lines.push(`🧾 حسابرسی خودکار حسابداری کاربان — ${date}`);
  lines.push(`✅ ${summary.pass} موفق | ❌ ${summary.fail} ناموفق`);
  if (findings?.length) {
    lines.push('');
    lines.push('یافته‌ها:');
    for (const f of findings.slice(0, 8)) {
      const icon = f.severity === 'critical' ? '🔴' : f.severity === 'high' ? '🟠' : f.severity === 'medium' ? '🟡' : '🔵';
      lines.push(`${icon} [${f.id}] ${String(f.title).slice(0, 90)}`);
    }
    if (findings.length > 8) lines.push(`… و ${findings.length - 8} یافته دیگر`);
  } else {
    lines.push('هیچ یافته بحرانی وجود ندارد 🎉');
  }
  lines.push('');
  lines.push('📊 گزارش کامل: site_secrets.acc_audit_report');
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: lines.join('\n').slice(0, 3900) }),
    });
    return await r.json();
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export default async function handler(req, res) {
  /* کل هندلر در try/catch — هرگز صفحه «FUNCTION_INVOCATION_FAILED» نمی‌بینید */
  try {
    if (req.method !== 'GET' && req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });

    const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const q = u.searchParams;
    const AUDIT_TOKEN = process.env.AUDIT_TOKEN || '';
    const CRON_SECRET = process.env.CRON_SECRET || '';
    const authHeader = req.headers.authorization || '';
    const providedKey = q.get('key') || req.headers['x-audit-key'] || '';

    const authorized = AUDIT_TOKEN
      ? (providedKey === AUDIT_TOKEN || (CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`))
      : !!(CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`); /* بدون AUDIT_TOKEN: فقط کرون مجاز شناخته می‌شود؛ بقیه مهمان هستند */

    /* ── پیکربندی ساپابیس از env ورسل ──
       نکته: نباید «URL» نام‌گذاری شود — سایه‌اندازی روی URL جهانی باعث
       «Cannot access 'URL' before initialization» در new URL بالا می‌شود (TDZ) */
    const { URL: SUPA_URL, SRK } = resolveConfig(process.env);
    if (!SRK) {
      return json(res, 500, {
        ok: false,
        error: 'missing_service_role_key',
        hint: 'متغیر محیطی SUPABASE_SERVICE_ROLE_KEY در Vercel تنظیم نشده است. در Vercel → Settings → Environment Variables آن را اضافه کنید و redeploy کنید.',
      });
    }

    /* ── محدودیت زمانی: هر ۱۰ دقیقه یک اجرا (مگر force با توکن معتبر) ── */
    const force = q.get('force') === '1' && authorized;
    if (!force) {
      const last = await readSecret(SUPA_URL, SRK, KEY_LAST);
      const lastAt = last?.value ? new Date(String(typeof last.value === 'string' ? last.value.replace(/^"|"$/g, '') : last.value)) : null;
      if (lastAt && !Number.isNaN(lastAt.getTime()) && Date.now() - lastAt.getTime() < RATE_LIMIT_MS) {
        const cachedFull = await readSecret(SUPA_URL, SRK, KEY_REPORT);
        const cached = cachedFull?.value ? safeParse(cachedFull.value) : null;
        if (cached) {
          const pub = publicReport(cached);
          return json(res, 200, {
            ok: true, cached: true, authorized,
            generated_at: cached.generated_at,
            summary: cached.summary, report: pub, md: buildMd(pub),
          });
        }
        return json(res, 429, { ok: false, error: 'rate_limited', retry_after_sec: Math.ceil((RATE_LIMIT_MS - (Date.now() - lastAt.getTime())) / 1000) });
      }
    }

    /* ── اجرای حسابرسی ── */
    const keep = q.get('keep') === '1';
    let full;
    try {
      full = await runAudit({ URL: SUPA_URL, SRK, cleanup: !keep });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'audit_failed', detail: String(e?.stack || e).slice(0, 600) });
    }

    /* ── ذخیره گزارش کامل + زمان آخرین اجرا ── */
    const save1 = await writeSecret(SUPA_URL, SRK, KEY_REPORT, full);
    const save2 = await writeSecret(SUPA_URL, SRK, KEY_LAST, new Date().toISOString());

    /* ── تلگرام ادمین ── */
    const tg = await sendTelegram(full.summary, full.findings);

    const pub = publicReport(full);
    return json(res, 200, {
      ok: true, cached: false, authorized,
      saved_to_db: save1 && save2,
      telegram: tg?.ok !== undefined ? (tg.ok ? 'sent' : 'failed') : 'skipped',
      summary: full.summary,
      report: pub,
      md: buildMd(pub),
      ...(authorized ? { full } : {}),
    });
  } catch (e) {
    return json(res, 500, { ok: false, error: 'handler_crash', detail: String(e?.stack || e).slice(0, 600) });
  }
}
