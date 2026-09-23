/* ═══════════ accounting.person-payables.spec ═══════════
   بند ۵ — پرداختنی به اشخاص (کد ۲۱۱۲):
   هزینهٔ پرداخت‌شده توسط شخص ثالث → بستانکار 2112 با تفصیلی شخص
   (هرگز 2110 «مالیات عملکرد» و هرگز 7101) + گزارش مانده + تسویهٔ اتمیک */
import { record } from './_harness.mjs';

export async function run(ctx) {
  const { A, bizA, RID, TODAY } = ctx;
  const TAG = `PAY-${RID}`;

  /* ۱) تفصیلی «شخص» برای صاحبِ ماندهٔ پرداختنی */
  const { data: detail, error: dErr } = await A.sb.from('acc_details')
    .insert({ business_id: bizA, title: `شریک پرداخت‌کننده ${TAG}`, kind: 'shareholder' })
    .select('id').single();
  record('PAY-1', 'ساخت تفصیلی شخص پرداخت‌کننده', !dErr ? 'PASS' : 'FAIL',
    dErr ? dErr.message.slice(0, 70) : `تفصیلی: ${detail?.id?.slice(0, 8)}`);
  if (dErr || !detail) return;

  /* ۲) هزینهٔ پرداخت‌شده توسط شخص ثالث — سند از مسیر موتور:
     DR 5201 (هزینه) / CR 2112 (پرداختنی به اشخاص) با تفصیلی همان شخص */
  const AMOUNT = 6000000;
  const { data: jId, error: jErr } = await A.sb.rpc('acc_create_journal', {
    p_business: bizA, p_date: TODAY, p_description: `هزینه با پول شخص ثالث ${TAG}`, p_ref_type: 'manual',
    p_lines: [
      { account_code: '5201', account_title: 'هزینه‌های اداری و عمومی', debit: AMOUNT, credit: 0, line_desc: 'هزینهٔ شرکت' },
      { account_code: '2112', account_title: 'پرداختنی به اشخاص', debit: 0, credit: AMOUNT, detail_id: detail.id, line_desc: 'بدهی به پرداخت‌کننده' },
    ],
  });
  record('PAY-2', 'ثبت هزینهٔ شخص ثالث ← بستانکار 2112 (نه 2110، نه 7101)', !jErr ? 'PASS' : 'FAIL',
    jErr ? jErr.message.slice(0, 70) : `سند: ${jId?.slice(0, 8)}`);
  if (jErr) return;

  const { data: cr2112 } = await A.sb.from('acc_journal_lines')
    .select('account_code, credit').eq('entry_id', jId).eq('account_code', '2112').maybeSingle();
  record('PAY-3', 'کد بستانکار دقیقاً 2112 است', cr2112?.account_code === '2112' ? 'PASS' : 'FAIL',
    `کد: ${cr2112?.account_code ?? '—'}`);

  /* ۳) گزارش ماندهٔ پرداختنی اشخاص */
  const { data: payables, error: repErr } = await A.sb.rpc('acc_person_payables', { p_business: bizA });
  const row = (payables || []).find(r => r.detail_id === detail.id);
  record('PAY-4', 'گزارش پرداختنی: ماندهٔ شخص = مبلغ هزینه',
    !repErr && row && Number(row.balance) === AMOUNT ? 'PASS' : 'FAIL',
    repErr ? repErr.message.slice(0, 70) : `مانده: ${Number(row?.balance || 0).toLocaleString('fa-IR')}`);

  /* ۴) حساب نقد برای تسویه */
  const { data: cash } = await A.sb.from('acc_accounts')
    .select('id, name, kind').eq('business_id', bizA).eq('kind', 'cash').limit(1).maybeSingle();
  if (!cash) {
    record('PAY-5', 'تسویهٔ اتمیک بدهی', 'SKIP', 'حساب صندوق برای بنگاه آزمون نیست');
    record('PAY-6', 'رد تسویهٔ بیش از مانده', 'SKIP', 'بدون حساب صندوق');
    return;
  }

  /* ۵) تسویهٔ بخشی از بدهی — DR 2112 / CR 1101 اتمیک */
  const { data: settleId, error: sErr } = await A.sb.rpc('acc_settle_person_payable', {
    p_business: bizA, p_detail: detail.id, p_account: cash.id,
    p_amount: 2000000, p_date: TODAY, p_description: `تسویهٔ بخشی ${TAG}`,
  });
  record('PAY-5', 'تسویهٔ اتمیک بخشی از بدهی (DR 2112 / CR صندوق)', !sErr ? 'PASS' : 'FAIL',
    sErr ? sErr.message.slice(0, 70) : `سند تسویه: ${settleId?.slice(0, 8)}`);

  /* مانده پس از تسویه */
  const { data: payables2 } = await A.sb.rpc('acc_person_payables', { p_business: bizA });
  const row2 = (payables2 || []).find(r => r.detail_id === detail.id);
  record('PAY-6', 'مانده پس از تسویه = ۴٬۰۰۰٬۰۰۰',
    row2 && Number(row2.balance) === AMOUNT - 2000000 ? 'PASS' : 'FAIL',
    `مانده: ${Number(row2?.balance || 0).toLocaleString('fa-IR')}`);

  /* ۶) تسویهٔ بیش از مانده → ممنوع */
  const { error: overErr } = await A.sb.rpc('acc_settle_person_payable', {
    p_business: bizA, p_detail: detail.id, p_account: cash.id,
    p_amount: 999999999, p_date: TODAY, p_description: `تسویهٔ اضافه ${TAG}`,
  });
  record('PAY-7', 'تسویهٔ بیش از ماندهٔ بدهی ممنوع', !!overErr ? 'PASS' : 'FAIL',
    overErr ? `رد شد ✓ ${overErr.message.slice(0, 60)}` : '⚠️ پذیرفته شد!');

  /* پاکسازی سطرهای همین تست */
  await A.sb.from('acc_journal_lines').delete().eq('entry_id', jId);
  await A.sb.from('acc_journal').delete().eq('id', jId);
  if (settleId) {
    await A.sb.from('acc_journal_lines').delete().eq('entry_id', settleId);
    await A.sb.from('acc_journal').delete().eq('id', settleId);
  }
  await A.sb.from('acc_details').delete().eq('id', detail.id);
}
