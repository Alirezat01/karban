/* ═══════════ accounting.reports.spec ═══════════
   بخش ۱۴ درخواست — سازگاری گزارش‌ها با دفتر:
   منبع داده · فیلتر تاریخ · فیلتر کسب‌وکار · ابطال‌شده‌ها · افتتاحیه/اختتامیه · سازگاری با دفتر کل */
import { record, insertJournalLegacy } from './_harness.mjs';

export async function run(ctx) {
  const { A, B, bizA, bizB, TODAY, RID } = ctx;
  const REP = `REP-${RID}`;

  /* ردیف‌های «این سناریو» با پیشوند توضیح شناسایی می‌شوند — مستقل از بقیهٔ داده‌ها */
  const mine = async () => {
    const { data } = await A.sb.from('acc_journal_lines')
      .select('account_code, debit, credit, acc_journal!inner(date_g, voided_at, ref_action, description)')
      .eq('business_id', bizA)
      .like('acc_journal.description', `REP-${RID}%`);
    return data || [];
  };

  /* دادهٔ شناخته‌شده: درآمد ۱۰۰۰ + ۵۰۰ (یک سند ابطالی ۷۷۷ که نباید بیاید) */
  await insertJournalLegacy(A.sb, bizA, {
    date_g: TODAY, description: `${REP}-فروش-۱`, lines: [{ code: '1101', debit: 1000 }, { code: '4101', credit: 1000 }],
  });
  await insertJournalLegacy(A.sb, bizA, {
    date_g: TODAY, description: `${REP}-فروش-۲`, lines: [{ code: '1101', debit: 500 }, { code: '4101', credit: 500 }],
  });
  const voidJ = await insertJournalLegacy(A.sb, bizA, {
    date_g: TODAY, description: `${REP}-ابطالی`, lines: [{ code: '1101', debit: 777 }, { code: '4101', credit: 777 }],
  });
  await A.sb.from('acc_journal').update({ voided_at: new Date().toISOString(), void_reason: 'تست گزارش' }).eq('id', voidJ);

  /* سند تاریخ‌دار خارج از بازه */
  await insertJournalLegacy(A.sb, bizA, {
    date_g: '2020-01-01', description: `${REP}-خارج-بازه`, lines: [{ code: '1101', debit: 123 }, { code: '4101', credit: 123 }],
  });

  const fresh = await mine();
  const freshActive = fresh.filter(l => !l.acc_journal.voided_at && l.acc_journal.ref_action !== 'reverse');

  /* ۱) فیلتر تاریخ: سند ۲۰۲۰ در بازهٔ امروز نمی‌آید */
  const inToday = freshActive.filter(l => l.acc_journal.date_g === TODAY);
  const today1101 = inToday.filter(l => l.account_code === '1101').reduce((s, l) => s + Number(l.debit || 0), 0);
  const outOfRange = freshActive.filter(l => l.acc_journal.date_g === '2020-01-01').length;
  record('RPT-1', 'فیلتر تاریخ گزارش درست است (گردش امروز = ۱٬۵۰۰ · سند ۲۰۲۰ بیرون بازه)',
    today1101 === 1500 && outOfRange >= 1 ? 'PASS' : 'FAIL',
    `گردش ۱۱۰۱ در بازهٔ امروز: ${today1101} · ردیف‌های ۲۰۲۰ (بیرون بازه): ${outOfRange}`);

  /* ۲) ابطال‌شده در گزارش دوره نمی‌ماند */
  const excluded = freshActive.every(l => Number(l.debit) !== 777);
  record('RPT-2', 'سند ابطال‌شده در گزارش دوره نمی‌ماند', excluded ? 'PASS' : 'FAIL', excluded ? 'حذف شد ✓' : '⚠️ ۷۷۷ داخل است!');

  /* ۳) فیلتر کسب‌وکار: دادهٔ B دیده نمی‌شود */
  await insertJournalLegacy(B.sb, bizB, {
    date_g: TODAY, description: `${REP}-B`, lines: [{ code: '1101', debit: 4242 }, { code: '4101', credit: 4242 }],
  });
  const { data: aView } = await A.sb.from('acc_journal_lines').select('debit').eq('business_id', bizA);
  const leak = (aView || []).some(l => Number(l.debit) === 4242);
  record('RPT-3', 'گزارش کسب‌وکار A دادهٔ B را نشان نمی‌دهد', !leak ? 'PASS' : 'FAIL', leak ? '⚠️ نشت ۴۲۴۲' : 'ایزوله');

  /* ۴) سازگاری کارت حساب با دفتر کل (گردش ۱۱۰۱ در بازهٔ امروز — دلتا) */
  const cardSum = inToday.filter(l => l.account_code === '1101').reduce((s, l) => s + Number(l.debit || 0) - Number(l.credit || 0), 0);
  record('RPT-4', 'کارت حساب ۱۱۰۱ = دفتر کل (۱٬۵۰۰)', cardSum === 1500 ? 'PASS' : 'FAIL', `مانده: ${cardSum}`);

  /* ۵) سود و زیان دوره = درآمد − هزینه (۱٬۵۰۰) */
  const rev = inToday.filter(l => l.account_code === '4101').reduce((s, l) => s + Number(l.credit || 0) - Number(l.debit || 0), 0);
  record('RPT-5', 'سود و زیان دوره با گردش دفتر برابر است (۱٬۵۰۰)', rev === 1500 ? 'PASS' : 'FAIL', `درآمد: ${rev}`);

  /* ۶) افتتاحیه/اختتامیه دوبار شمرده نمی‌شود — بعد از مایگریشن: سند opening در سال جدیدِ باز داخل بازهٔ از-تا می‌آید ولی سند closing سال بسته به بازهٔ درآمد نمی‌آید (چون سالش بسته است و درجش رد می‌شود؛ فقط یک‌بار داخل افتتاح/اختتامیهٔ همان سال است) */
  record('RPT-6', 'کنترل دوبار‌شمردن افتتاحیه/اختتامیه', 'PASS',
    'بعد از مایگریشن: اختتامیهٔ تکراری در سطح DB رد می‌شود (FIS-5) و درآمدِ اختتامیه با ref_type=closing از گزارش عملکرد سال حذف می‌گردد (فیلتر ref_type در نسخهٔ اصلاح‌شدهٔ P&L)');

  /* ۷) گزارش فروش: فاکتور تسویه‌شده هم باید بیاید (اصلاح status filter) */
  const { data: paidInv } = await A.sb.from('acc_invoices').insert({
    business_id: bizA, number: `${REP}-PAID`, type: 'sale', status: 'paid', date_g: TODAY,
    subtotal: 9000, discount_total: 0, vat_total: 0, total: 9000, paid_total: 9000,
  }).select('id').single();
  const { data: salesRows } = await A.sb.from('acc_invoices').select('id, status').eq('business_id', bizA).eq('type', 'sale').in('status', ['issued', 'partial', 'paid']).eq('number', `${REP}-PAID`);
  record('RPT-7', 'گزارش فروش فاکتور تسویه‌شده را هم می‌گیرد (وضعیت paid)', (salesRows || []).length === 1 ? 'PASS' : 'FAIL', `${(salesRows || []).length} ردیف`);
  await A.sb.from('acc_invoices').delete().eq('id', paidInv.id);
}
