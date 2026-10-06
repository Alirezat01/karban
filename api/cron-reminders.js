/* ═════════════════════════════════════════════════════════════════════
   کاربان — یادآور خودکار ضرب‌الاجل (Phase 4.1 — Vercel Cron)
   ─────────────────────────────────────────────────────────────────
   اجرای روزانه ساعت ۸ صبح به وقت تهران.
   ۱. سررسید چک‌های ۷ روز آینده (از acc_checks)
   ۲. پایان قراردادها در ۱۴ روز آینده (از acc_contracts)
   ۳. موعد اظهارنامه فصلی (هر فصل)
   ۴. انقضای اشتراک حسابداری (از acc_access)
   ۵. اسناد گاوصندوق با expires_at در ۷ روز آینده

   برای هر مورد، یک ردیف در جدول notifications برای کاربر می‌سازد.
   ═════════════════════════════════════════════════════════════════════ */

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const cronSecret = process.env.CRON_SECRET;

async function supabaseSelect(table, qs) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${qs}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  return res.json();
}

async function supabaseInsert(table, row) {
  await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });
}

async function notifyUser(userId, title, body, href) {
  await supabaseInsert('notifications', { user_id: userId, title, body, href });
}

function tehranNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tehran' }));
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function dateStr(d) {
  return d.toISOString().slice(0, 10);
}

async function runChecksReminders(now) {
  const sevenDays = dateStr(addDays(now, 7));
  const today = dateStr(now);
  const rows = await supabaseSelect(
    'acc_checks',
    `select=id,business_id,due_date_g,amount,partner_id&due_date_g=gte.${today}&due_date_g=lte.${sevenDays}&status=eq.in_hand`,
  );
  for (const c of rows || []) {
    /* owner of business */
    const access = await supabaseSelect('acc_access', `select=user_id,business_id&business_id=eq.${c.business_id}&role=eq.owner&limit=1`);
    const uid = access[0]?.user_id;
    if (uid) {
      await notifyUser(uid, ' یادآور سررسید چک', `چک به مبلغ ${c.amount} ریال سررسید نزدیک است.`, '/حسابداری/پنل/چک‌ها');
    }
  }
}

async function runContractReminders(now) {
  const fourteenDays = dateStr(addDays(now, 14));
  const today = dateStr(now);
  const rows = await supabaseSelect(
    'acc_contracts',
    `select=id,business_id,title,end_date_g&end_date_g=gte.${today}&end_date_g=lte.${fourteenDays}&status=eq.active`,
  );
  for (const c of rows || []) {
    const access = await supabaseSelect('acc_access', `select=user_id&business_id=eq.${c.business_id}&role=eq.owner&limit=1`);
    const uid = access[0]?.user_id;
    if (uid) {
      await notifyUser(uid, 'پایان نزدیک قرارداد', `قرارداد «${c.title}» در دو هفته آینده پایان می‌یابد.`, '/حسابداری/پنل/قراردادها');
    }
  }
}

async function runVaultExpiryReminders(now) {
  const sevenDays = dateStr(addDays(now, 7));
  const today = dateStr(now);
  const rows = await supabaseSelect(
    'vault_documents',
    `select=id,user_id,title,expires_at&expires_at=gte.${today}T00:00:00Z&expires_at=lte.${sevenDays}T23:59:59Z`,
  );
  for (const v of rows || []) {
    await notifyUser(v.user_id, 'انقضای سند', `سند «${v.title}» در گاوصندوق در ۷ روز آینده منقضی می‌شود.`, '/گاوصندوق');
  }
}

async function runSubscriptionReminders(now) {
  const fourteenDays = dateStr(addDays(now, 14));
  const today = dateStr(now);
  const rows = await supabaseSelect(
    'acc_access',
    `select=user_id,plan,expires_at&expires_at=gte.${today}T00:00:00Z&expires_at=lte.${fourteenDays}T23:59:59Z`,
  );
  for (const a of rows || []) {
    await notifyUser(a.user_id, 'انقضای اشتراک حسابداری', `اشتراک ${a.plan} شما در دو هفته آینده منقضی می‌شود.`, '/حسابداری');
  }
}

async function runTaxReminders(now) {
  /* اظهارنامه معاملات فصلی: آخرین روز فصل */
  const month = now.getMonth() + 1;
  const day = now.getDate();
  /* ۱۵ روز قبل از پایان فصل (۳۱/۳، ۳۰/۶، ۳۰/۹، ۳۰/۱۲ شمسی — تقریبی میلادی) */
  const taxQuarterEnd = {
    3: { m: 6, d: 15 }, 6: { m: 9, d: 15 }, 9: { m: 12, d: 15 }, 12: { m: 3, d: 15 },
  };
  const end = taxQuarterEnd[Math.ceil(month / 3) * 3];
  if (end && month === end.m && day === end.d) {
    /* همه کارفرمایان */
    const users = await supabaseSelect('profiles', 'select=id&user_role=eq.employer');
    for (const u of users || []) {
      await notifyUser(u.id, 'یادآوری اظهارنامه فصلی', 'مهلت ارائه اظهارنامه معاملات فصلی نزدیک است.', '/حسابداری/پنل/گزارش‌ها');
    }
  }
}

export default async function handler(req, res) {
  /* احراز هویت: CRON_SECRET یا توکن دستی */
  const authHeader = req.headers['authorization'];
  const queryKey = req.query.key;
  const valid = (authHeader === `Bearer ${cronSecret}`) || (queryKey && queryKey === cronSecret);
  if (!valid) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const now = tehranNow();
  const summary = { checks: 0, contracts: 0, vault: 0, subs: 0, tax: 0, error: null };

  try {
    await runChecksReminders(now);
    await runContractReminders(now);
    await runVaultExpiryReminders(now);
    await runSubscriptionReminders(now);
    await runTaxReminders(now);
    return res.json({ ok: true, ran_at: now.toISOString(), summary });
  } catch (e) {
    console.error('cron-reminders failed', e.message);
    summary.error = e.message;
    return res.status(500).json({ ok: false, error: e.message, summary });
  }
}

export const config = { maxDuration: 60 };
