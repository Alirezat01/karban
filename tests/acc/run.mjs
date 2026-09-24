/* ═══════════════════════════════════════════════════════════════════
   کاربان — اجراکنندهٔ مجموعهٔ تست زندهٔ حسابداری
   اجرا:  npm run test:acc        یا        node tests/acc/run.mjs
   خروجی: جدول نتایج + tests/acc/out/results.json
   ═══════════════════════════════════════════════════════════════════ */
import { makeUser, makeBusiness, client, record, saveResults, summarize, RESULTS, RID, cleanup } from './_harness.mjs';

const TODAY = new Date().toISOString().slice(0, 10);

console.log('══════════════════════════════════════════════════════');
console.log('  تست زندهٔ هستهٔ حسابداری کاربان');
console.log('  دیتابیس: rocjeanizzhfvhnuhnms.supabase.co (واقعی)');
console.log(`  شناسهٔ اجرا: ${RID} — تاریخ: ${TODAY}`);
console.log('══════════════════════════════════════════════════════\n');

/* ── ساخت کاربران و کسب‌وکارهای آزمایشی ── */
let ctx;
try {
  const A = await makeUser('a');
  const B = await makeUser('b');
  let bizA = null, bizB = null;
  /* اگر کاربر قبلاً کسب‌وکار آزمایشی دارد (اجرای مجدد)، همان استفاده می‌شود */
  const existingBiz = async (u) => {
    const { data } = await u.sb.from('acc_access').select('business_id').eq('user_id', u.userId).limit(5);
    return (data || []).map(r => r.business_id).filter(Boolean);
  };
  const exA = await existingBiz(A);
  if (exA.length) {
    bizA = exA[0];
    console.log(`  ╰─ کاربر A کسب‌وکار قبلی دارد — پاک و استفادهٔ مجدد: ${bizA.slice(0, 8)}`);
    const { cleanup } = await import('./_harness.mjs');
    await cleanup(A.sb, [bizA]);
  } else {
    bizA = await makeBusiness(A, `بنگاه تست الف ${RID}`);
  }
  const exB = await existingBiz(B);
  if (exB.length) {
    bizB = exB[0];
    console.log(`  ╰─ کاربر B کسب‌وکار قبلی دارد — پاک و استفادهٔ مجدد: ${bizB.slice(0, 8)}`);
    const { cleanup } = await import('./_harness.mjs');
    await cleanup(B.sb, [bizB]);
  } else {
    bizB = await makeBusiness(B, `بنگاه تست ب ${RID}`);
  }
  ctx = { A, B, bizA, bizB, rpc: false, TODAY, RID, record };
  record('SETUP', 'ساخت ۲ کاربر و ۲ کسب‌وکار آزمایشی', bizA && bizB ? 'PASS' : 'FAIL', `A:${A.email} · B:${B.email}`);
} catch (e) {
  record('SETUP', 'ساخت کاربران/کسب‌وکار آزمایشی', 'FAIL', e.message);
  saveResults('results.json');
  summarize();
  process.exit(1);
}

/* ── تشخیص امکانات: آیا مایگریشن سخت‌سازی اجرا شده؟ ── */
{
  const { error } = await ctx.A.sb.rpc('acc_create_journal', {
    p_business: ctx.bizA, p_date: TODAY, p_description: 'پروب امکانات', p_ref_type: 'manual', p_lines: [],
  });
  const missing = error && /could not find the function|schema cache|PGRST202/i.test(error.message);
  ctx.rpc = !missing;
  record('CAPS', 'تشخیص مایگریشن سخت‌سازی (RPCها)', ctx.rpc ? 'PASS' : 'SKIP',
    ctx.rpc ? 'RPCها موجودند — همهٔ تست‌های دیتابیسی فعال' : 'RPCها نیستند — تست‌های وابسته SKIP و مسیر قدیمی مستند می‌شود',
    error ? { probe: error.message.slice(0, 80) } : null);
}

/* ── اجرای سناریوها به ترتیب ── */
const SPECS = [
  ['accounting.rls.business-isolation', () => import('./accounting.rls.business-isolation.spec.mjs')],
  ['accounting.permissions', () => import('./accounting.permissions.spec.mjs')],
  ['accounting.master-data', () => import('./accounting.master-data.spec.mjs')],
  ['accounting.subledger', () => import('./accounting.subledger.spec.mjs')],
  ['accounting.journal.concurrent', () => import('./accounting.journal.concurrent.spec.mjs')],
  ['accounting.journal.atomicity', () => import('./accounting.journal.atomicity.spec.mjs')],
  ['accounting.invoice-void', () => import('./accounting.invoice-void.spec.mjs')],
  ['accounting.bank-reconciliation.concurrent', () => import('./accounting.bank-reconciliation.concurrent.spec.mjs')],
  /* بکاپ/ریستور عمداً «قبل از» fiscal-year است: restore، اسناد اختتامیهٔ سال
     بسته را هم بازپخش می‌کند و گارد دورهٔ بسته (رفتار درست محصول) آن را رد می‌کند.
     با پاک‌سازی ابتدای اجرا (purge سال‌های مالی قبلی)، این ترتیب تضمین می‌کند
     فایل بکاپ فقط اسنادِ درون سال باز داشته باشد. */
  ['accounting.backup-restore', () => import('./accounting.backup-restore.spec.mjs')],
  ['accounting.fiscal-year', () => import('./accounting.fiscal-year.spec.mjs')],
  ['accounting.trial-balance', () => import('./accounting.trial-balance.spec.mjs')],
  ['accounting.ledger-integrity', () => import('./accounting.ledger-integrity.spec.mjs')],
  ['accounting.numeric-rounding', () => import('./accounting.numeric-rounding.spec.mjs')],
  ['accounting.e2e.flow', () => import('./accounting.e2e.flow.spec.mjs')],
  ['accounting.checks-sayadi', () => import('./accounting.checks-sayadi.spec.mjs')],
  ['accounting.expense-edit', () => import('./accounting.expense-edit.spec.mjs')],
  ['accounting.shared-catalog', () => import('./accounting.shared-catalog.spec.mjs')],
  ['accounting.person-payables', () => import('./accounting.person-payables.spec.mjs')],
  ['accounting.deletion', () => import('./accounting.deletion.spec.mjs')],
  ['accounting.reports', () => import('./accounting.reports.spec.mjs')],
  ['payments.security', () => import('./payments.security.spec.mjs')],
];

for (const [name, loader] of SPECS) {
  console.log(`\n─── ${name} ───`);
  try {
    const mod = await loader();
    await mod.run(ctx);
  } catch (e) {
    record(name, 'اجرای سناریو', 'FAIL', 'خطای غیرمنتظره: ' + (e?.message || e).toString().slice(0, 120));
  }
}

/* ── پاکسازی نهایی: حذف کامل کسب‌وکارهای آزمایشی (آبشاری) ── */
console.log('\n─── پاکسازی ───');
try {
  const failA = await cleanup(ctx.A.sb, [ctx.bizA]);
  const failB = await cleanup(ctx.B.sb, [ctx.bizB]);
  const all = [...failA, ...failB];
  record('CLEANUP', 'پاکسازی داده‌های تست (لایسنس برای اجرای بعدی حفظ شد)', all.length === 0 ? 'PASS' : 'FAIL',
    all.length === 0 ? 'داده‌های تست پاک شدند' : `جدول‌های باقی‌مانده: ${all.slice(0, 4).join(' · ')}`);
} catch (e) {
  record('CLEANUP', 'حذف کسب‌وکارهای آزمایشی', 'FAIL', e.message);
}

saveResults('results.json');
const s = summarize();
process.exit(s.fail > 0 ? 2 : 0);
