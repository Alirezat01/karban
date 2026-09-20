/* ═══════════ accounting.journal.concurrent.spec ═══════════
   بخش ۲ درخواست — حداقل ۲۰ درخواست هم‌زمان ثبت سند
   انتظار: هیچ شماره تکراری · هیچ سند بدون ردیف · همه تراز
   (مسیر RPC اتمیک — پیش از اجرای مایگریشن SKIP می‌شود) */
import { record, entrySums } from './_harness.mjs';

export async function run(ctx) {
  const { A, bizA, rpc, TODAY } = ctx;
  if (!rpc) {
    record('JCC-1', '۲۰ درج هم‌زمان از مسیر RPC اتمیک', 'SKIP', 'مایگریشن acc_core_hardening هنوز اجرا نشده (RPC موجود نیست)');
    return;
  }

  /* ۲۰ سند هم‌زمان، هر کدام ۲ ردیف تراز ۱۰۰۰ ریالی */
  const tasks = Array.from({ length: 20 }, (_, i) =>
    A.sb.rpc('acc_create_journal', {
      p_business: bizA, p_date: TODAY, p_description: `تست هم‌زمانی #${i + 1}`,
      p_ref_type: 'manual', p_ref_action: 'post',
      p_lines: [
        { account_code: '1101', account_title: 'صندوق', debit: 1000, credit: 0 },
        { account_code: '4101', account_title: 'درآمد فروش کالا و خدمات', debit: 0, credit: 1000 },
      ],
    }).then(r => ({ i, error: r.error, data: r.data })),
  );
  const results = await Promise.all(tasks);
  const ok = results.filter(r => !r.error);
  const errs = results.filter(r => r.error);

  /* همهٔ شناسه‌ها یکتا */
  const ids = ok.map(r => r.data);
  const uniqueIds = new Set(ids);
  record('JCC-2', 'تعداد اسناد موفق در ۲۰ درخواست هم‌زمان', ok.length === 20 ? 'PASS' : 'FAIL',
    `${ok.length}/20 موفق${errs.length ? ' — خطاها: ' + errs.map(e => e.error.message.slice(0, 50)).join(' | ') : ''}`,
    errs.length ? { sampleError: errs[0].error.message } : null);
  record('JCC-3', 'یکتایی شناسه‌های برگشتی', uniqueIds.size === ok.length ? 'PASS' : 'FAIL', `${uniqueIds.size} یکتا از ${ok.length}`);

  /* شماره‌های سند یکتا */
  const { data: js } = await A.sb.from('acc_journal').select('id, entry_no').eq('business_id', bizA).in('id', ids);
  const nos = (js || []).map(j => Number(j.entry_no));
  const uniqueNos = new Set(nos);
  record('JCC-4', 'یکتایی شمارهٔ سند (entry_no) بعد از ۲۰ درج هم‌زمان', uniqueNos.size === nos.length ? 'PASS' : 'FAIL',
    `${uniqueNos.size} شمارهٔ یکتا از ${nos.length}`);

  /* همه تراز و دارای ردیف */
  let balanced = 0, withLines = 0;
  for (const id of ids) {
    const s = await entrySums(A.sb, id);
    if (s.lines > 0) withLines++;
    if (s.lines > 0 && s.d === s.c && s.d > 0) balanced++;
  }
  record('JCC-5', 'همهٔ اسناد هم‌زمان دارای ردیف و تراز', balanced === ids.length && withLines === ids.length ? 'PASS' : 'FAIL',
    `تراز: ${balanced}/${ids.length} · دارای ردیف: ${withLines}/${ids.length}`);
}
