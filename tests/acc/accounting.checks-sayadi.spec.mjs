/* ═══════════ accounting.checks-sayadi.spec ═══════════
   بند ۴ — چک صیادی: شناسهٔ ۱۶رقمی یگانه + نوع چک + صادرکننده/گیرنده
   + گارد چرخهٔ عمر (ماتریس گذار وضعیت) + گزارش یکپارچهٔ چک‌ها */
import { record } from './_harness.mjs';

export async function run(ctx) {
  const { A, bizA, RID, TODAY } = ctx;

  const SAYADI_A = '1234567812345678'; // ۱۶ رقم معتبر
  const base = {
    business_id: bizA, kind: 'received', amount: 25000000,
    serial_no: `SAY-${RID}`, bank_name: 'بانک آزمون صیادی', due_date_g: TODAY,
    status: 'in_hand', description: `چک صیادی ${RID}`,
    sayadi_id: SAYADI_A, cheque_type: 'ordinary',
    issuer_name: 'صادرکنندهٔ آزمون', payee_name: 'بنگاه آزمون',
  };

  /* ۱) درج چک با شناسهٔ صیادی معتبر */
  const { data: chk, error: insErr } = await A.sb.from('acc_checks').insert(base).select('id').single();
  record('SAY-1', 'درج چک با شناسهٔ صیادی ۱۶رقمی + نوع + صادرکننده/گیرنده', !insErr ? 'PASS' : 'FAIL',
    insErr ? insErr.message.slice(0, 70) : `چک: ${chk?.id?.slice(0, 8)}`);

  /* ۲) شناسهٔ صیادی تکراری در همان کسب‌وکار → ممنوع (ایندکس یگانه) */
  const { error: dupErr } = await A.sb.from('acc_checks').insert({ ...base, serial_no: `SAY-DUP-${RID}` });
  record('SAY-2', 'شناسهٔ صیادی تکراری در همان کسب‌وکار ممنوع', !!dupErr ? 'PASS' : 'FAIL',
    dupErr ? 'رد شد (unique) ✓' : '⚠️ پذیرفته شد!');

  /* ۳) شناسهٔ صیادی همان عدد در کسب‌وکار دیگر → مجاز (یگانگی per-business) */
  const { B, bizB } = ctx;
  const { error: otherBizErr } = await B.sb.from('acc_checks').insert({
    ...base, business_id: bizB, serial_no: `SAY-B-${RID}`,
  });
  record('SAY-3', 'شناسهٔ صیادی یکسان در کسب‌وکار دیگر مجاز است', !otherBizErr ? 'PASS' : 'FAIL',
    otherBizErr ? otherBizErr.message.slice(0, 70) : 'یگانکی per-business برقرار');

  /* ۴) فرمت نامعتبر (۱۵ رقم) → ممنوع (CHECK دیتابیس) */
  const { error: fmtErr } = await A.sb.from('acc_checks').insert({
    ...base, serial_no: `SAY-FMT-${RID}`, sayadi_id: '123456781234567',
  });
  record('SAY-4', 'شناسهٔ صیادی غیر۱۶رقمی ممنوع (CHECK)', !!fmtErr ? 'PASS' : 'FAIL',
    fmtErr ? 'رد شد (format) ✓' : '⚠️ پذیرفته شد!');

  /* ۵) گذار نامعتبر: cleared → in_hand → ممنوع (وضعیت نهایی) */
  const { error: finErr } = await A.sb.from('acc_checks').update({ status: 'cleared' }).eq('id', chk.id);
  if (finErr) { record('SAY-5', 'آماده‌سازی وصول چک', 'FAIL', finErr.message.slice(0, 70)); }
  else {
    const { error: backErr } = await A.sb.from('acc_checks').update({ status: 'in_hand' }).eq('id', chk.id);
    record('SAY-5', 'گذار برگشتی از وضعیت نهایی (cleared→in_hand) ممنوع', !!backErr ? 'PASS' : 'FAIL',
      backErr ? 'رد شد ✓' : '⚠️ پذیرفته شد!');
  }

  /* ۶) گذار مجاز در چک دوم: in_hand → deposited → bounced → deposited */
  const { data: chk2 } = await A.sb.from('acc_checks').insert({
    ...base, serial_no: `SAY-2-${RID}`, sayadi_id: '8765432187654321', amount: 9000000,
  }).select('id').single();
  const t1 = await A.sb.from('acc_checks').update({ status: 'deposited' }).eq('id', chk2.id);
  const t2 = await A.sb.from('acc_checks').update({ status: 'bounced' }).eq('id', chk2.id);
  const t3 = await A.sb.from('acc_checks').update({ status: 'deposited' }).eq('id', chk2.id);
  record('SAY-6', 'گذارهای مجاز چرخهٔ عمر (in_hand→deposited→bounced→deposited)',
    !t1.error && !t2.error && !t3.error ? 'PASS' : 'FAIL',
    [t1, t2, t3].find(x => x.error)?.error?.message?.slice(0, 70) || 'زنجیره پذیرفته شد');

  /* ۷) گذار غیرمجاز: returned → cleared → ممنوع (ماتریس) */
  const { data: chk3 } = await A.sb.from('acc_checks').insert({
    ...base, serial_no: `SAY-3-${RID}`, sayadi_id: '1111222233334444', amount: 1000000,
  }).select('id').single();
  await A.sb.from('acc_checks').update({ status: 'returned' }).eq('id', chk3.id);
  const { error: matrixErr } = await A.sb.from('acc_checks').update({ status: 'cleared' }).eq('id', chk3.id);
  record('SAY-7', 'گذار غیرمجاز (returned→cleared) ممنوع', !!matrixErr ? 'PASS' : 'FAIL',
    matrixErr ? matrixErr.message.slice(0, 70) : '⚠️ پذیرفته شد!');

  /* ۸) گزارش یکپارچهٔ چک‌ها (acc_checks_overview) */
  const { data: overview, error: ovErr } = await A.sb.rpc('acc_checks_overview', { p_business: bizA });
  const mine = (overview || []).filter(r => ['SAY-' + RID, `SAY-2-${RID}`, `SAY-3-${RID}`].includes(r.serial_no));
  record('SAY-8', 'گزارش یکپارچهٔ چک‌ها (صیادی + نوع + طرف‌حساب + سند مرتبط)',
    !ovErr && mine.length >= 3 ? 'PASS' : 'FAIL',
    ovErr ? ovErr.message.slice(0, 70) : `${mine.length} چک آزمون در گزارش · sayadi: ${mine[0]?.sayadi_id || '—'}`);

  /* ۹) نوع چک تضمینی پذیرفته می‌شود */
  const { error: guarErr } = await A.sb.from('acc_checks').insert({
    ...base, serial_no: `SAY-G-${RID}`, sayadi_id: '9999888877776666', cheque_type: 'guaranteed', amount: 3000000,
  });
  record('SAY-9', 'نوع چک «تضمینی» پذیرفته می‌شود', !guarErr ? 'PASS' : 'FAIL',
    guarErr ? guarErr.message.slice(0, 70) : 'ثبت شد');

  /* پاکسازی ردیف‌های همین تست */
  for (const id of [chk?.id, chk2?.id, chk3?.id]) {
    if (id) await A.sb.from('acc_checks').delete().eq('id', id);
  }
  await B.sb.from('acc_checks').delete().eq('business_id', bizB).like('serial_no', `SAY-B-${RID}`);
  await A.sb.from('acc_checks').delete().eq('business_id', bizA).like('serial_no', `SAY-G-${RID}`);
}
