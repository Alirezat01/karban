/* ═══════════ accounting.bank-reconciliation.concurrent.spec ═══════════
   بخش ۸ درخواست — classifyBankLine نباید با جست‌وجوی مجدد (مبلغ/تاریخ/حساب)
   شناسه را پیدا کند؛ شناسهٔ واقعی از خود درج برگردد.
   دو خط بانکی مشابه + دو درخواست هم‌زمان → هر خط به سند درست خودش وصل شود */
import { record } from './_harness.mjs';

/* همان منطق classifyBankLine اپ (بعد از اصلاح) — شناسه از خود درج */
async function classifyLikeApp(sb, business, line, kind) {
  const abs = Math.abs(line.amount);
  const txId = await (async () => {
    const { data, error } = await sb.from('acc_transactions').insert({
      business_id: business.id, kind, amount: abs, date_g: line.date_g, method: 'transfer',
      account_id: line.account_id, partner_id: null,
      description: line.description || 'تراکنش بانکی',
    }).select('id').single();
    if (error) throw error;
    return data.id;
  })();
  const { error } = await sb.from('acc_bank_lines').update({
    match_status: 'manual', match_entity_type: 'transaction', match_entity_id: txId,
    matched_at: new Date().toISOString(),
  }).eq('id', line.id);
  if (error) throw error;
  return txId;
}

export async function run(ctx) {
  const { A, bizA, TODAY, RID } = ctx;

  const { data: account } = await A.sb.from('acc_accounts').insert({
    business_id: bizA, name: `بانک-مغایرت-${RID}`, kind: 'bank', initial_balance: 0, active: true,
  }).select('id').single();

  /* دو خط بانکی دقیقاً مشابه: همان مبلغ، همان روز، همان حساب */
  const mkLine = async (n) => A.sb.from('acc_bank_lines').insert({
    business_id: bizA, account_id: account.id, date_g: TODAY, amount: 500000,
    description: `واریز مشابه ${n} (${RID})`, ref_no: `RF-${RID}-${n}`,
  }).select('*').single();
  const [{ data: line1 }, { data: line2 }] = [await mkLine(1), await mkLine(2)];

  /* درخواست‌های هم‌زمان طبقه‌بندی */
  const [r1, r2] = await Promise.allSettled([
    classifyLikeApp(A.sb, { id: bizA }, line1, 'receipt'),
    classifyLikeApp(A.sb, { id: bizA }, line2, 'receipt'),
  ]);
  const id1 = r1.status === 'fulfilled' ? r1.value : null;
  const id2 = r2.status === 'fulfilled' ? r2.value : null;

  record('BRC-1', 'هر دو طبقه‌بندی هم‌زمان موفق', !!id1 && !!id2 ? 'PASS' : 'FAIL',
    `خطاها: ${r1.status === 'rejected' ? r1.reason?.message?.slice(0, 50) : '-'} / ${r2.status === 'rejected' ? r2.reason?.message?.slice(0, 50) : '-'}`);

  /* دو تراکنش متمایز ساخته شد؟ */
  const distinct = id1 && id2 && id1 !== id2;
  record('BRC-2', 'دو سند خزانهٔ متمایز برای دو خط (بدون دوبل)', distinct ? 'PASS' : 'FAIL', `${id1} / ${id2}`);

  /* هر خط به سند درست خودش وصل است؟ */
  const { data: l1 } = await A.sb.from('acc_bank_lines').select('match_entity_id, match_status').eq('id', line1.id).single();
  const { data: l2 } = await A.sb.from('acc_bank_lines').select('match_entity_id, match_status').eq('id', line2.id).single();
  const linkedRight = l1?.match_entity_id === id1 && l2?.match_entity_id === id2;
  record('BRC-3', 'هر خط بانکی به سند صحیح خودش متصل است', linkedRight ? 'PASS' : 'FAIL',
    `خط۱→${l1?.match_entity_id?.slice(0, 8)} / خط۲→${l2?.match_entity_id?.slice(0, 8)}`);

  /* تعداد واقعی تراکنش‌های ساخته‌شده برای این مبلغ/روز = ۲ (بدون دوبل) */
  const { count: txCount } = await A.sb.from('acc_transactions').select('id', { count: 'exact', head: true })
    .eq('business_id', bizA).eq('amount', 500000).eq('date_g', TODAY).eq('account_id', account.id);
  record('BRC-4', 'تعداد تراکنش‌های ساخته‌شده = ۲ (بدون تکرار)', txCount === 2 ? 'PASS' : 'FAIL', `${txCount} تراکنش`);

  /* پاکسازی */
  await A.sb.from('acc_transactions').delete().eq('business_id', bizA).eq('account_id', account.id);
  await A.sb.from('acc_bank_lines').delete().eq('business_id', bizA).eq('account_id', account.id);
  await A.sb.from('acc_accounts').delete().eq('id', account.id);
}
