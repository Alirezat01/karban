/* ═══════════ accounting.rls.business-isolation.spec ═══════════
   بخش ۵ درخواست — جداسازی کسب‌وکارها در سطح دیتابیس (RLS)
   User A (کسب‌وکار A) نباید هیچ داده‌ای از کسب‌وکار B را ببیند یا تغییر دهد */
import { record } from './_harness.mjs';

export async function run(ctx) {
  const { A, B, bizA, bizB, TODAY, RID } = ctx;

  /* داده در هر دو کسب‌وکار */
  const { data: pa } = await A.sb.from('acc_partners').insert({ business_id: bizA, kind: 'customer', person_type: 'real', name: `مشتری-الف-${RID}` }).select('id').single();
  const { data: pb } = await B.sb.from('acc_partners').insert({ business_id: bizB, kind: 'customer', person_type: 'real', name: `مشتری-ب-${RID}` }).select('id').single();
  /* سندهای آزمایشی از مسیر موتور (نوشتن مستقیم دفتر با M150000 بسته است) */
  const seedJ = (sb, biz, desc) => sb.rpc('acc_create_journal', {
    p_business: biz, p_date: TODAY, p_description: desc, p_ref_type: 'manual',
    p_lines: [{ account_code: '1101', debit: 10, credit: 0 }, { account_code: '4101', debit: 0, credit: 10 }],
  }).then(r => { if (r.error) throw new Error(r.error.message); return { id: r.data }; });
  const ja = await seedJ(A.sb, bizA, `RLS-A-${RID}`);
  const jb = await seedJ(B.sb, bizB, `RLS-B-${RID}`);
  const { data: ia } = await A.sb.from('acc_invoices').insert({ business_id: bizA, number: `RLS-${RID}`, type: 'sale', status: 'draft', date_g: TODAY, subtotal: 1, discount_total: 0, vat_total: 0, total: 1, paid_total: 0 }).select('id').single();

  /* ۱) SELECT مستقیم با business_id دیگری */
  const { data: crossP } = await A.sb.from('acc_partners').select('id').eq('business_id', bizB);
  record('BIS-1', 'SELECT طرف‌حساب کسب‌وکار دیگر → خالی', (crossP || []).length === 0 ? 'PASS' : 'FAIL', `${(crossP || []).length} ردیف نشت کرد`);

  /* ۲) SELECT بدون فیلتر business_id */
  const { data: allP } = await A.sb.from('acc_partners').select('id');
  const leak = (allP || []).some(r => r.id === pb.id);
  record('BIS-2', 'SELECT بدون فیلتر → ردیف B دیده نمی‌شود', !leak ? 'PASS' : 'FAIL', leak ? '⚠️ ردیف B داخل نتایج A بود' : 'ایزوله');

  /* ۳) SELECT سند حسابداری B */
  const { data: crossJ } = await A.sb.from('acc_journal').select('id').eq('id', jb.id);
  record('BIS-3', 'SELECT سند حسابداری کسب‌وکار دیگر', (crossJ || []).length === 0 ? 'PASS' : 'FAIL', `${(crossJ || []).length} ردیف`);

  /* ۴) UPDATE ردیف B */
  const { data: upd, error: updErr } = await A.sb.from('acc_partners').update({ name: 'هک‌شده' }).eq('id', pb.id).select('id');
  record('BIS-4', 'UPDATE طرف‌حساب کسب‌وکار دیگر → صفر ردیف', (upd || []).length === 0 && !updErr ? 'PASS' : 'FAIL', `${(upd || []).length} ردیف تغییر کرد`);

  /* ۵) DELETE ردیف B */
  const { data: del, error: delErr } = await A.sb.from('acc_partners').delete().eq('id', pb.id).select('id');
  record('BIS-5', 'DELETE طرف‌حساب کسب‌وکار دیگر → صفر ردیف', (del || []).length === 0 && !delErr ? 'PASS' : 'FAIL', `${(del || []).length} ردیف حذف شد`);

  /* ۶) INSERT با business_id دیگری */
  const { data: ins, error: insErr } = await A.sb.from('acc_partners').insert({ business_id: bizB, kind: 'customer', person_type: 'real', name: 'نفوذ' }).select('id');
  record('BIS-6', 'INSERT با business_id کسب‌وکار دیگر', !ins && !!insErr ? 'PASS' : 'FAIL', ins ? '⚠️ ردیف در B ساخته شد!' : (insErr?.message || '').slice(0, 60));

  /* ۷) INSERT سند حسابداری با business_id دیگری */
  const { data: insJ, error: insJErr } = await A.sb.from('acc_journal').insert({ business_id: bizB, entry_no: 9999, date_g: TODAY, ref_type: 'manual', ref_action: 'post', description: 'نفوذ سند' }).select('id');
  record('BIS-7', 'INSERT سند با business_id دیگر', !insJ && !!insJErr ? 'PASS' : 'FAIL', insJ ? '⚠️ سند در B ساخته شد!' : (insJErr?.message || '').slice(0, 60));

  /* ۸) خودکار بودن (RLS به‌صورت خودکار تزریق نمی‌شود) */
  const { data: mineP } = await A.sb.from('acc_partners').select('id').eq('business_id', bizA);
  record('BIS-8', 'دسترسی عادی مالک به دادهٔ خودش سالم است', (mineP || []).some(r => r.id === pa.id) ? 'PASS' : 'FAIL', `${(mineP || []).length} ردیف خودی`);

  /* پاکسازی ردیف‌های همین تست */
  for (const id of [pa?.id, ia?.id, ja?.id]) {
    if (id && pa?.id === id) await A.sb.from('acc_partners').delete().eq('id', id);
    if (id === ia?.id) await A.sb.from('acc_invoices').delete().eq('id', id);
    if (id === ja?.id) { await A.sb.from('acc_journal_lines').delete().eq('entry_id', id); await A.sb.from('acc_journal').delete().eq('id', id); }
  }
  await B.sb.from('acc_partners').delete().eq('id', pb.id);
  await B.sb.from('acc_journal_lines').delete().eq('entry_id', jb.id);
  await B.sb.from('acc_journal').delete().eq('id', jb.id);
}
