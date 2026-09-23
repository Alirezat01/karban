/* ═══════════ accounting.trial-balance.spec (بازنویسی کامل) ═══════════
   بخش ۱۱ و ۱۴ درخواست — تراز آزمایشی با گردش واقعی سازگار باشد (دلتا-محور) */
import { record, insertJournalLegacy } from './_harness.mjs';

async function activeSums(sb, bizId, prefix = null) {
  let q = sb.from('acc_journal_lines')
    .select('account_code, debit, credit, acc_journal!inner(voided_at, ref_action' + (prefix ? ', description' : '') + ')')
    .eq('business_id', bizId);
  if (prefix) q = q.like('acc_journal.description', `${prefix}%`);
  const { data, error } = await q;
  if (error) throw error;
  const active = (data || []).filter(l => !l.acc_journal.voided_at && l.acc_journal.ref_action !== 'reverse');
  const m = new Map();
  let td = 0, tc = 0;
  for (const l of active) {
    const cur = m.get(l.account_code) || { d: 0, c: 0 };
    cur.d += Number(l.debit) || 0; cur.c += Number(l.credit) || 0;
    m.set(l.account_code, cur);
    td += Number(l.debit) || 0; tc += Number(l.credit) || 0;
  }
  return { m, td, tc, active };
}

export async function run(ctx) {
  const { A, bizA, TODAY, RID } = ctx;
  const P = `TB-${RID}`;

  /* سندهای شناخته‌شدهٔ این سناریو (با پیشوند یکتا — مستقل از بقیهٔ داده‌ها) */
  await insertJournalLegacy(A.sb, bizA, {
    date_g: TODAY, description: `${P}-الف`, lines: [{ code: '1101', debit: 1200 }, { code: '4101', credit: 1200 }],
  });
  await insertJournalLegacy(A.sb, bizA, {
    date_g: TODAY, description: `${P}-ب`, lines: [{ code: '1101', debit: 300 }, { code: '5201', credit: 300 }],
  });
  await insertJournalLegacy(A.sb, bizA, {
    date_g: TODAY, description: `${P}-پ`, lines: [{ code: '2109', debit: 500 }, { code: '1201', credit: 500 }],
  });
  const voidedId = await insertJournalLegacy(A.sb, bizA, {
    date_g: TODAY, description: `${P}-ابطالی`, lines: [{ code: '1101', debit: 99999 }, { code: '4101', credit: 99999 }],
  });
  /* ابطال فقط از مسیر قرارداد جدید (RPC اتمیک M120000) — نوشتن مستقیم acc_journal با M150000 بسته است */
  const { error: voidErr } = await A.sb.rpc('acc_void_journal', { p_business: bizA, p_entry: voidedId, p_reason: 'تست تراز' });
  if (voidErr) { record('TB-0', 'ابطال سند برای تست تراز', 'FAIL', voidErr.message); return; }

  /* گردش فعال فقط از سندهای این سناریو */
  const { m: sums, active, td, tc } = await activeSums(A.sb, bizA, P);

  const expect = { '1101': { d: 1500, c: 0 }, '4101': { d: 0, c: 1200 }, '5201': { d: 0, c: 300 }, '2109': { d: 500, c: 0 }, '1201': { d: 0, c: 500 } };
  let exact = true;
  for (const [code, want] of Object.entries(expect)) {
    const got = sums.get(code) || { d: 0, c: 0 };
    if (got.d !== want.d || got.c !== want.c) {
      exact = false;
      record(`TB-${code}`, `گردش حساب ${code}`, 'FAIL', `دریافت ${got.d}/${got.c} — انتظار ${want.d}/${want.c}`);
    }
  }
  record('TB-1', 'گردش هر حساب در تراز آزمایشی با سندهای ثبت‌شده برابر است', exact ? 'PASS' : 'FAIL', exact ? 'هر ۵ حساب دقیق' : 'بالاتر');

  /* سند ابطالی از تراز حذف شده؟ (۹۹٬۹۹۹ نباید در گردش فعال باشد) */
  const voidedLeak = active.some(l => Number(l.debit) === 99999 || Number(l.credit) === 99999);
  record('TB-2', 'سند باطل‌شده از تراز آزمایشی حذف می‌شود', !voidedLeak ? 'PASS' : 'FAIL',
    voidedLeak ? '⚠️ ردیف ۹۹٬۹۹۹ داخل گردش فعال است' : 'حذف شد ✓');

  /* تراز کل سناریو */
  record('TB-3', 'جمع بدهکار = جمع بستانکار در بازهٔ سناریو', td === tc ? 'PASS' : 'FAIL', `${td.toLocaleString('fa-IR')} / ${tc.toLocaleString('fa-IR')}`);
}
