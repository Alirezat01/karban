/* ═══════════ accounting.journal.atomicity.spec ═══════════
   بخش ۳ درخواست — ثبت سند باید کاملاً تراکنشی باشد:
   یا کل سند ثبت شود یا هیچ بخشی از آن (Failure Injection واقعی) */
import { record, entrySums, insertJournalLegacy } from './_harness.mjs';

export async function run(ctx) {
  const { A, bizA, rpc, TODAY } = ctx;
  if (!rpc) {
    record('JAT-1', 'رد سند غیرتراز در دیتابیس', 'SKIP', 'مایگریشن هنوز اجرا نشده');
    record('JAT-2', 'Rollback کامل با خطای تزریقی (FK نامعتبر)', 'SKIP', 'مایگریشن هنوز اجرا نشده');
  } else {
    /* ۱) سند غیرتراز — باید رد شود و هیچ ردی نماند */
    const { error: balErr } = await A.sb.rpc('acc_create_journal', {
      p_business: bizA, p_date: TODAY, p_description: 'تست غیرتراز JAT', p_ref_type: 'manual',
      p_lines: [
        { account_code: '1101', debit: 5000, credit: 0 },
        { account_code: '4101', debit: 0, credit: 3000 },
      ],
    });
    let leftover = 0;
    if (balErr) {
      const { count } = await A.sb.from('acc_journal').select('id', { count: 'exact', head: true }).eq('business_id', bizA).eq('description', 'تست غیرتراز JAT');
      leftover = count || 0;
    }
    record('JAT-1', 'رد سند غیرتراز + عدم باقی‌ماندن رد', balErr && leftover === 0 ? 'PASS' : 'FAIL',
      balErr ? `رد شد: ${balErr.message.slice(0, 60)} · رد باقی‌مانده: ${leftover}` : '⚠️ سند غیرتراز پذیرفته شد!', { error: balErr?.message });

    /* ۲) تزریق خطا: ردیف با project_id ناموجود (نقض FK) — کل تراکنش باید Rollback شود */
    const fakeProject = '00000000-0000-0000-0000-00000000dead';
    const { error: fkErr } = await A.sb.rpc('acc_create_journal', {
      p_business: bizA, p_date: TODAY, p_description: 'تست تزریق خطا JAT2', p_ref_type: 'manual',
      p_lines: [
        { account_code: '1101', debit: 2000, credit: 0 },
        { account_code: '4101', debit: 0, credit: 2000, project_id: fakeProject },
      ],
    });
    const { count: orphanCount } = await A.sb.from('acc_journal').select('id', { count: 'exact', head: true }).eq('business_id', bizA).eq('description', 'تست تزریق خطا JAT2');
    record('JAT-2', 'Rollback کامل هنگام خطای ردیف (بدون سرِسند یتیم)', fkErr && (orphanCount || 0) === 0 ? 'PASS' : 'FAIL',
      fkErr ? `تراکنش برگشت: ${fkErr.message.slice(0, 60)} · سرِسند یتیم: ${orphanCount || 0}` : '⚠️ درج با FK نامعتبر موفق شد؟!', { error: fkErr?.message });

    /* ۳) سند بدون ردیف */
    const { error: emptyErr } = await A.sb.rpc('acc_create_journal', {
      p_business: bizA, p_date: TODAY, p_description: 'تست خالی JAT3', p_ref_type: 'manual', p_lines: [],
    });
    record('JAT-3', 'رد سند بدون هیچ ردیف', !!emptyErr ? 'PASS' : 'FAIL', emptyErr ? emptyErr.message.slice(0, 60) : 'پذیرفته شد!');

    /* ۴) مبلغ منفی */
    const { error: negErr } = await A.sb.rpc('acc_create_journal', {
      p_business: bizA, p_date: TODAY, p_description: 'تست منفی JAT4', p_ref_type: 'manual',
      p_lines: [{ account_code: '1101', debit: -1000, credit: 0 }, { account_code: '4101', debit: 0, credit: -1000 }],
    });
    record('JAT-4', 'رد مبلغ منفی در ردیف سند', !!negErr ? 'PASS' : 'FAIL', negErr ? negErr.message.slice(0, 60) : 'پذیرفته شد!');
  }

  /* ۵) مسیر قدیمی (پیش از مایگریشن) — مستندسازی رفتار فعلی با درج مستقیم غیرتراز */
  try {
    const jid = await insertJournalLegacy(A.sb, bizA, {
      date_g: TODAY, description: `پروب مسیر قدیمی غیرتراز ${ctx.RID}`,
      lines: [{ code: '1101', debit: 777 }, { code: '4101', credit: 333 }],
    });
    const s = await entrySums(A.sb, jid);
    record('JAT-5', 'رفتار مسیر قدیمی با سند غیرتراز (مستندسازی وضعیت پیش از مایگریشن)',
      s.d !== s.c ? 'EXPECTED-FAIL' : 'PASS',
      s.d !== s.c ? `مسیر قدیمی سند غیرتراز (${s.d}/${s.c}) را پذیرفت — بعد از مایگریشن، تریگر تراز جلوی آن را می‌گیرد` : 'در مسیر قدیمی هم رد شد');
  } catch (e) {
    record('JAT-5', 'رفتار مسیر قدیمی با سند غیرتراز', 'PASS', 'درج مستقیم غیرتراز رد شد: ' + e.message.slice(0, 70));
  }
}
