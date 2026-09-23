/* ═══════════ accounting.invoice-void.spec ═══════════
   بخش ۷ و ۱۲ درخواست — صدور → یافتن سند → ابطال اتمیک → بررسی همهٔ پیامدها
   Invoice=Cancelled · Journal=Voided/Reversed · موجودی برگشته · ویرایش/حذف/ابطال مجدد بسته */
import { record, entrySums } from './_harness.mjs';

const M = (x) => Number(x || 0);

export async function run(ctx) {
  const { A, bizA, rpc, TODAY, RID } = ctx;

  /* کالا با موجودی و مشتری */
  const { data: item } = await A.sb.from('acc_items').insert({
    business_id: bizA, name: `کالا-ابطال-${RID}`, unit: 'عدد', kind: 'goods',
    sale_price: 100000, purchase_price: 60000, vat_rate: 10, track_stock: true, stock: 50, active: true,
  }).select('id, name').single();
  const { data: partner } = await A.sb.from('acc_partners').insert({ business_id: bizA, kind: 'customer', person_type: 'real', name: `خریدار-${RID}` }).select('id').single();

  /* فاکتور فروش ۲×۱۰۰٬۰۰۰ + ۱۰٪ مالیات = ۲۲۰٬۰۰۰ */
  const { data: inv, error: invErr } = await A.sb.from('acc_invoices').insert({
    business_id: bizA, number: `VOID-${RID}`, type: 'sale', status: 'draft', partner_id: partner.id,
    date_g: TODAY, subtotal: 200000, discount_total: 0, vat_total: 20000, total: 220000, paid_total: 0,
  }).select('id').single();
  if (invErr) { record('IVD-0', 'ساخت فاکتور آزمایشی', 'FAIL', invErr.message); return; }
  const { error: iiErr } = await A.sb.from('acc_invoice_items').insert({
    invoice_id: inv.id, business_id: bizA, item_id: item.id, title: item.name, unit: 'عدد',
    quantity: 2, unit_price: 100000, discount: 0, vat_rate: 10, vat_amount: 20000, row_total: 220000, position: 0,
  });
  if (iiErr) { record('IVD-0b', 'درج ردیف فاکتور آزمایشی', 'FAIL', iiErr.message.slice(0, 80)); return; }

  if (!rpc) {
    /* مسیر قدیمی: صدور فقط status — نه سند، نه موجودی اتمیک */
    const { error: issErr } = await A.sb.from('acc_invoices').update({ status: 'issued' }).eq('id', inv.id);
    const { data: itemAfter } = await A.sb.from('acc_items').select('stock').eq('id', item.id).single();
    record('IVD-LEG', 'مسیر قدیمی: صدور بدون سند آینه‌ای (مستند وضعیت قبل)', issErr ? 'SKIP' : 'EXPECTED-FAIL',
      issErr ? 'خطا: ' + issErr.message : `موجودی پس از صدور (مسیر قدیمی حلقه‌ای): ${itemAfter.stock}`);

    /* قفل ویرایش فاکتور صادره (تریگر موجود از sql-6) */
    const { error: editErr } = await A.sb.from('acc_invoices').update({ total: 999999999 }).eq('id', inv.id);
    record('IVD-LEG2', 'مسیر قدیمی: ویرایش فاکتور صادره بسته است؟', editErr ? 'PASS' : 'FAIL', editErr ? editErr.message.slice(0, 60) : '⚠️ ویرایش شد!');

    /* ابطال مسیر قدیمی */
    const { error: voidErr } = await A.sb.from('acc_invoices').update({ status: 'cancelled', voided_at: new Date().toISOString(), void_reason: 'تست قدیمی' }).eq('id', inv.id);
    record('IVD-LEG3', 'مسیر قدیمی: ابطال مستقیم', !voidErr ? 'PASS' : 'FAIL', voidErr?.message?.slice(0, 60) || 'ابطال شد');
    await A.sb.from('acc_invoice_items').delete().eq('invoice_id', inv.id);
    await A.sb.from('acc_invoices').delete().eq('id', inv.id);
    await A.sb.from('acc_items').delete().eq('id', item.id);
    await A.sb.from('acc_partners').delete().eq('id', partner.id);
    return;
  }

  /* ══ مسیر جدید (بعد از مایگریشن) ══ */

  /* ۱) صدور اتمیک */
  const { data: issued, error: issErr2 } = await A.sb.rpc('acc_issue_invoice', { p_invoice: inv.id });
  const { data: itemAfter2 } = await A.sb.from('acc_items').select('stock').eq('id', item.id).single();
  record('IVD-1', 'صدور اتمیک فاکتور (RPC)', !issErr2 && issued?.journal_id ? 'PASS' : 'FAIL',
    issErr2 ? issErr2.message.slice(0, 60) : `سند آینه‌ای: ${issued?.journal_id ? 'ساخته شد' : 'نیست'} · موجودی: 50 → ${itemAfter2.stock}`,
    { journalId: issued?.journal_id });

  /* ۲) موجودی کسر شده؟ */
  record('IVD-2', 'کسر موجودی هنگام صدور (۵۰ → ۴۸)', Number(itemAfter2?.stock) === 48 ? 'PASS' : 'FAIL', `موجودی: ${itemAfter2?.stock}`);

  /* ۳) سند آینه‌ای تراز و درست — فروش ۲۲۰٬۰۰۰ + بهای تمام‌شدهٔ کالای فروخته (COGS) ۲×۶۰٬۰۰۰=۱۲۰٬۰۰۰
     DR 1103: 220000 / CR 4101: 200000 / CR 2102: 20000 / DR 5103: 120000 / CR 1301: 120000 → جمع ۳۴۰٬۰۰۰ */
  const jid = issued?.journal_id;
  const { data: jl3 } = jid ? await A.sb.from('acc_journal_lines').select('account_code, debit, credit').eq('entry_id', jid) : { data: [] };
  const d3 = (jl3 || []).reduce((x, l) => x + M(l.debit), 0);
  const c3 = (jl3 || []).reduce((x, l) => x + M(l.credit), 0);
  const L3 = (code) => (jl3 || []).find((l) => l.account_code === code);
  const ok3 = jid && d3 === c3 && d3 === 340000
    && M(L3('1103')?.debit) === 220000
    && M(L3('4101')?.credit) === 200000 && M(L3('2102')?.credit) === 20000
    && M(L3('5101')?.debit) === 120000 && M(L3('1201')?.credit) === 120000;
  record('IVD-3', 'سند آینه‌ای فاکتور تراز و کامل (فروش + COGS)', ok3 ? 'PASS' : 'FAIL',
    jid ? `بدهکار ${d3} / بستانکار ${c3} · 1103=${L3('1103')?.debit} · 4101=${L3('4101')?.credit} · 2102=${L3('2102')?.credit} · 5101=${L3('5101')?.debit} · 1201=${L3('1201')?.credit}` : 'سند یافت نشد');

  /* ۴) ابطال اتمیک */
  const { data: voidRes, error: voidErr2 } = await A.sb.rpc('acc_void_invoice', {
    p_business: bizA, p_invoice: inv.id, p_reason: 'تست ابطال حسابداری', p_restore_stock: true,
  });
  record('IVD-4', 'ابطال اتمیک فاکتور (RPC)', !voidErr2 ? 'PASS' : 'FAIL', voidErr2 ? voidErr2.message.slice(0, 60) : `سندهای معکوس: ${voidRes?.reversed_journals}`);

  /* ۵) وضعیت فاکتور */
  const { data: invAfter } = await A.sb.from('acc_invoices').select('status, voided_at, void_reason').eq('id', inv.id).single();
  record('IVD-5', 'فاکتور بعد از ابطال = cancelled + مهر زمانی', invAfter?.status === 'cancelled' && !!invAfter?.voided_at ? 'PASS' : 'FAIL',
    `status=${invAfter?.status} voided=${!!invAfter?.voided_at}`);

  /* ۶) موجودی برگشته؟ */
  const { data: itemAfter3 } = await A.sb.from('acc_items').select('stock').eq('id', item.id).single();
  record('IVD-6', 'برگشت موجودی هنگام ابطال (۴۸ → ۵۰)', Number(itemAfter3?.stock) === 50 ? 'PASS' : 'FAIL', `موجودی: ${itemAfter3?.stock}`);

  /* ۷) سند اصلی باطل + سند معکوس ساخته شده؟ */
  const { data: jAfter } = await A.sb.from('acc_journal').select('voided_at').eq('id', jid).single();
  const { data: revJ } = await A.sb.from('acc_journal').select('id, entry_no').eq('business_id', bizA).eq('reversal_of', jid);
  record('IVD-7', 'سند اصلی voided + سند معکوس با ارجاع متقابل', !!jAfter?.voided_at && (revJ || []).length >= 1 ? 'PASS' : 'FAIL',
    `voided=${!!jAfter?.voided_at} · معکوس‌ها: ${(revJ || []).length}`);

  /* ۸) سند معکوس هم تراز و قرینهٔ کامل است؟ (شامل برگشت COGS) */
  if (revJ?.length) {
    const { data: jl8 } = await A.sb.from('acc_journal_lines').select('account_code, debit, credit').eq('entry_id', revJ[0].id);
    const rd = (jl8 || []).reduce((x, l) => x + M(l.debit), 0);
    const rc = (jl8 || []).reduce((x, l) => x + M(l.credit), 0);
    record('IVD-8', 'سند معکوس تراز و قرینهٔ کامل است', rd === rc && rd === 340000 ? 'PASS' : 'FAIL', `${rd}/${rc} (${(jl8 || []).length} ردیف)`);
  }

  /* ۹) ابطال مجدد ممنوع */
  const { error: reVoidErr } = await A.sb.rpc('acc_void_invoice', { p_business: bizA, p_invoice: inv.id, p_reason: 'دوباره', p_restore_stock: false });
  record('IVD-9', 'ابطال مجدد فاکتور ممنوع', !!reVoidErr ? 'PASS' : 'FAIL', reVoidErr ? reVoidErr.message.slice(0, 60) : '⚠️ پذیرفته شد!');

  /* ۱۰) صدور مجدد ممنوع */
  const { error: reIssErr } = await A.sb.rpc('acc_issue_invoice', { p_invoice: inv.id });
  record('IVD-10', 'صدور مجدد فاکتور ابطال‌شده ممنوع', !!reIssErr ? 'PASS' : 'FAIL', reIssErr ? reIssErr.message.slice(0, 60) : '⚠️ پذیرفته شد!');

  /* ۱۱) حذف فاکتور ابطال‌شده ممنوع */
  const { data: delRes, error: delErr } = await A.sb.from('acc_invoices').delete().eq('id', inv.id).select('id');
  record('IVD-11', 'حذف فاکتور صادره/ابطال‌شده ممنوع (DELETE guard)', !delErr && (delRes || []).length === 0 ? 'FAIL' : 'PASS',
    delErr ? delErr.message.slice(0, 60) : (delRes || []).length ? '⚠️ حذف شد!' : 'حذف بلااثر ماند (RLS)');

  /* ۱۲) ویرایش فاکتور ابطال‌شده ممنوع */
  const { data: editRes } = await A.sb.from('acc_invoices').update({ description: 'خرابکاری' }).eq('id', inv.id).select('id');
  record('IVD-12', 'ویرایش فاکتور ابطال‌شده ممنوع', (editRes || []).length === 0 ? 'PASS' : 'FAIL', `${(editRes || []).length} ردیف`);

  /* پاکسازی این سناریو */
  await A.sb.from('acc_journal').delete().eq('reversal_of', jid);
  await A.sb.from('acc_journal').delete().eq('id', jid);
  await A.sb.from('acc_invoice_items').delete().eq('invoice_id', inv.id);
  await A.sb.from('acc_invoices').delete().eq('id', inv.id);
  await A.sb.from('acc_items').delete().eq('id', item.id);
  await A.sb.from('acc_partners').delete().eq('id', partner.id);
}
