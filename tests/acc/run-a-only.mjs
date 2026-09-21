/* ═══════════════════════════════════════════════════════════════════
   کاربان — اجرای زیرمجموعهٔ A-only (وقتی کاربر دوم در دسترس نیست)
   هیچ منطق تستی تغییر نمی‌کند؛ فقط ۹ سناریویی که به کاربر B نیاز
   ندارند اجرا می‌شوند. ۵ سناریوی بین‌کاربری NOT RUN اعلام می‌شود.
   اجرا: ACC_TEST_USER_1=... ACC_TEST_PASS_1=... node tests/acc/run-a-only.mjs
   ═══════════════════════════════════════════════════════════════════ */
import { makeUser, makeBusiness, record, saveResults, summarize, RID, cleanup } from './_harness.mjs';

const TODAY = new Date().toISOString().slice(0, 10);

/* ۹ سناریوی مستقل از کاربر B */
const A_ONLY_SPECS = [
  ['accounting.journal.concurrent', () => import('./accounting.journal.concurrent.spec.mjs')],
  ['accounting.journal.atomicity', () => import('./accounting.journal.atomicity.spec.mjs')],
  ['accounting.subledger', () => import('./accounting.subledger.spec.mjs')],
  ['accounting.invoice-void', () => import('./accounting.invoice-void.spec.mjs')],
  ['accounting.bank-reconciliation.concurrent', () => import('./accounting.bank-reconciliation.concurrent.spec.mjs')],
  ['accounting.fiscal-year', () => import('./accounting.fiscal-year.spec.mjs')],
  ['accounting.trial-balance', () => import('./accounting.trial-balance.spec.mjs')],
  ['accounting.deletion', () => import('./accounting.deletion.spec.mjs')],
  ['accounting.numeric-rounding', () => import('./accounting.numeric-rounding.spec.mjs')],
];

/* سناریوهایی که به کاربر دوم نیاز دارند — NOT RUN با دلیل */
const B_REQUIRED = [
  ['accounting.master-data', 'چک ایزوله‌سازی بین‌کاربری'],
  ['accounting.rls.business-isolation', 'هستهٔ تست RLS بین دو کاربر'],
  ['accounting.permissions', 'نقش‌های viewer/writer با دو کاربر'],
  ['accounting.ledger-integrity', 'صحت دفتر در هر دو کسب‌وکار'],
  ['accounting.reports', 'درج legacy در کسب‌وکار B'],
  ['accounting.e2e.flow', 'جریان کامل با دو کاربر'],
];

console.log('══════════════════════════════════════════════════════');
console.log('  تست زندهٔ حسابداری — زیرمجموعهٔ A-only');
console.log(`  شناسهٔ اجرا: ${RID}`);
console.log('══════════════════════════════════════════════════════\n');

let ctx;
try {
  const A = await makeUser('a');
  let bizA;
  const { data: acc } = await A.sb.from('acc_access').select('business_id').eq('user_id', A.userId).limit(5);
  const exA = (acc || []).map(r => r.business_id).filter(Boolean);
  if (exA.length) {
    bizA = exA[0];
    console.log(`  ╰─ کاربر A کسب‌وکار قبلی دارد — پاک و استفادهٔ مجدد: ${bizA.slice(0, 8)}`);
    await cleanup(A.sb, [bizA]);
  }
  bizA = bizA || (await makeBusiness(A, `بنگاه تست الف ${RID}`));
  ctx = { A, B: null, bizA, bizB: null, rpc: false, TODAY, RID, record };
  record('SETUP', 'ساخت کاربر و کسب‌وکار آزمایشی (A-only)', 'PASS', `A:${A.email} · biz:${bizA.slice(0, 8)}`);
} catch (e) {
  record('SETUP', 'ساخت کاربر/کسب‌وکار آزمایشی', 'FAIL', e.message);
  saveResults('results-a-only.json');
  summarize();
  process.exit(1);
}

/* پروب RPC — مثل run.mjs */
{
  const { error } = await ctx.A.sb.rpc('acc_create_journal', {
    p_business: ctx.bizA, p_date: TODAY, p_description: 'پروب امکانات', p_ref_type: 'manual', p_lines: [],
  });
  const missing = error && /could not find the function|schema cache|PGRST202/i.test(error.message);
  ctx.rpc = !missing;
  record('CAPS', 'تشخیص مایگریشن (RPCها)', ctx.rpc ? 'PASS' : 'SKIP',
    ctx.rpc ? 'RPCها موجودند' : 'RPCها نیستند: ' + (error?.message || '').slice(0, 80));
}

for (const [name, loader] of A_ONLY_SPECS) {
  console.log(`\n─── ${name} ───`);
  try {
    const mod = await loader();
    await mod.run(ctx);
  } catch (e) {
    record(name, 'اجرای سناریو', 'FAIL', 'خطای غیرمنتظره: ' + (e?.message || e).toString().slice(0, 120));
  }
}

for (const [name, why] of B_REQUIRED) {
  record(name, 'سناریوی بین‌کاربری', 'SKIP', `NOT RUN — کاربر دوم آزمایشی در دسترس نیست (${why})`);
}

console.log('\n─── پاکسازی ───');
try {
  const rA = await cleanup(ctx.A.sb, [ctx.bizA]);
  record('CLEANUP', 'پاکسازی داده‌های تست', rA.failed.length === 0 ? 'PASS' : 'FAIL',
    rA.failed.length === 0
      ? (rA.blocked.length ? `سابقهٔ قطعی‌شده طبق گارد تاریخچه حفظ شد: ${[...new Set(rA.blocked)].slice(0, 4).join(' · ')}` : 'داده‌های تست پاک شدند')
      : `خطای واقعی: ${rA.failed.slice(0, 4).join(' · ')}`);
} catch (e) {
  record('CLEANUP', 'حذف کسب‌وکار آزمایشی', 'FAIL', e.message);
}

saveResults('results-a-only.json');
const s = summarize();
process.exit(s.fail > 0 ? 2 : 0);
