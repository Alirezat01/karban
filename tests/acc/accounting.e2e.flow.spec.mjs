/* ═══════════ accounting.e2e.flow.spec ═══════════
   بخش ۱۱ درخواست — سناریوی سرتاسری واقعی کسب‌وکار خدماتی:
   مشتری/تامین‌کننده/بانک/صندوق/خدمت/دسته هزینه → فروش ۱۰۰M + مالیات → دریافت ۵۰M
   → هزینه ۲۰M → خرید → چک → تنخواه → پیش‌دریافت → پیش‌پرداخت → سند دستی ۱۰M/۱۰M
   سپس سازگاری دفتر کل، تراز آزمایشی، مانده‌ها، درآمد، هزینه و سود/زیان */
import { record, entrySums } from './_harness.mjs';

const roundVat = (base, rate) => Math.round((base * (rate || 0)) / 100);

export async function run(ctx) {
  const { B, bizB, rpc, TODAY, RID } = ctx;
  const E2E = `E2E-${RID}`;

  /* ── موجودیت‌های پایه ── */
  const { data: customer } = await B.sb.from('acc_partners').insert({ business_id: bizB, kind: 'customer', person_type: 'legal', name: `شرکت مشتری ${E2E}` }).select('id').single();
  const { data: supplier } = await B.sb.from('acc_partners').insert({ business_id: bizB, kind: 'supplier', person_type: 'legal', name: `تامین‌کننده ${E2E}` }).select('id').single();
  const { data: bank } = await B.sb.from('acc_accounts').insert({ business_id: bizB, name: `بانک ${E2E}`, kind: 'bank', initial_balance: 0, active: true }).select('id').single();
  const { data: cash } = await B.sb.from('acc_accounts').insert({ business_id: bizB, name: `صندوق ${E2E}`, kind: 'cash', initial_balance: 0, active: true }).select('id').single();
  const { data: service } = await B.sb.from('acc_items').insert({
    business_id: bizB, name: `خدمت مشاوره ${E2E}`, unit: 'ساعت', kind: 'service',
    sale_price: 10000000, purchase_price: 0, vat_rate: 10, vat_exempt: false, track_stock: false, active: true,
  }).select('id').single();
  const { data: cat } = await B.sb.from('acc_expense_categories').insert({ business_id: bizB, title: `اجاره ${E2E}`, code: '5203', position: 99 }).select('id').single();
  record('E2E-0', 'ایجاد کسب‌وکار، مشتری، تامین‌کننده، بانک، صندوق، خدمت، دستهٔ هزینه', customer && supplier && bank && cash && service && cat ? 'PASS' : 'FAIL');

  /* ── ۱) فروش خدمت ۱۰٬۰۰۰٬۰۰۰×۱۰ + مالیات ۱۰٪ = ۱۱۰٬۰۰۰٬۰۰۰ ── */
  const saleSub = 100000000, saleVat = roundVat(saleSub, 10), saleTotal = saleSub + saleVat;
  const { data: saleInv } = await B.sb.from('acc_invoices').insert({
    business_id: bizB, number: `${E2E}-S1`, type: 'sale', status: 'draft', partner_id: customer.id,
    date_g: TODAY, subtotal: saleSub, discount_total: 0, vat_total: saleVat, total: saleTotal, paid_total: 0,
  }).select('id').single();
  await B.sb.from('acc_invoice_items').insert({
    invoice_id: saleInv.id, business_id: bizB, item_id: service.id, title: service.name, unit: 'ساعت',
    quantity: 10, unit_price: 10000000, discount: 0, vat_rate: 10, vat_amount: saleVat, row_total: saleTotal, position: 0,
  });

  /* ── ۲) صدور رسمی فاکتور فروش (سند آینه‌ای دوبل می‌سازد) ── */
  let issErr = null;
  if (rpc) {
    ({ error: issErr } = await B.sb.rpc('acc_issue_invoice', { p_invoice: saleInv.id }));
    record('E2E-I', 'صدور رسمی فاکتور فروش از مسیر RPC', !issErr ? 'PASS' : 'FAIL', issErr ? issErr.message.slice(0, 70) : 'صادر شد');
  } else {
    await B.sb.from('acc_invoices').update({ status: 'issued' }).eq('id', saleInv.id);
  }

  /* ── ۳) دریافت ۵۰٬۰۰۰٬۰۰۰ ── */
  const receiptAmt = 50000000;
  const { data: receipt } = await B.sb.from('acc_transactions').insert({
    business_id: bizB, kind: 'receipt', amount: receiptAmt, date_g: TODAY, method: 'transfer',
    account_id: bank.id, invoice_id: saleInv.id, partner_id: customer.id, description: `دریافت قسمتی ${E2E}`,
  }).select('id').single();
  await B.sb.from('acc_invoices').update({ paid_total: receiptAmt, status: 'partial' }).eq('id', saleInv.id);
  if (rpc) {
    const { error: txPostErr } = await B.sb.rpc('acc_post_document', { p_kind: 'transaction', p_ref_id: receipt.id });
    record('E2E-T', 'سند آینه‌ای دریافت ثبت شد', !txPostErr ? 'PASS' : 'FAIL', txPostErr ? txPostErr.message.slice(0, 70) : 'ثبت شد');
  }

  /* ── ۳) هزینه ۲۰٬۰۰۰٬۰۰۰ و پرداخت آن از بانک ── */
  const expAmt = 20000000;
  const { data: expense } = await B.sb.from('acc_expenses').insert({
    business_id: bizB, category: cat.title, title: `اجاره دفتر ${E2E}`, amount: expAmt, vat_amount: 0,
    date_g: TODAY, account_id: bank.id, partner_id: null, is_paid: true, tax_status: 'valid',
    description: `هزینهٔ آزمون ${E2E}`,
  }).select('id').single();

  /* ── ۴) خرید ۳۰٬۰۰۰٬۰۰۰ نسیه از تامین‌کننده ── */
  const purSub = 30000000, purVat = roundVat(purSub, 10), purTotal = purSub + purVat;
  const { data: purchaseInv } = await B.sb.from('acc_invoices').insert({
    business_id: bizB, number: `${E2E}-P1`, type: 'purchase', status: 'draft', partner_id: supplier.id,
    date_g: TODAY, subtotal: purSub, discount_total: 0, vat_total: purVat, total: purTotal, paid_total: 0,
  }).select('id').single();
  await B.sb.from('acc_invoice_items').insert({
    invoice_id: purchaseInv.id, business_id: bizB, title: 'خرید تجهیزات', unit: 'عدد',
    quantity: 3, unit_price: 10000000, discount: 0, vat_rate: 10, vat_amount: purVat, row_total: purTotal, position: 0,
  });

  /* ── ۵) چک دریافتی ۱۵٬۰۰۰٬۰۰۰ ── */
  const { data: check } = await B.sb.from('acc_checks').insert({
    business_id: bizB, kind: 'received', partner_id: customer.id, invoice_id: saleInv.id,
    amount: 15000000, serial_no: `CH-${RID}`, bank_name: 'بانک تست', due_date_g: TODAY,
    status: 'in_hand', description: `چک فروش ${E2E}`,
  }).select('id').single();

  /* ── ۶) تنخواه ۵٬۰۰۰٬۰۰۰ شارژ از صندوق ── */
  const { data: petty } = await B.sb.from('acc_petty').insert({
    business_id: bizB, name: `تنخواه ${E2E}`, custodian: 'آزمون', source_account_id: cash.id,
    charge_total: 5000000, status: 'open',
  }).select('id').single();
  await B.sb.from('acc_petty_ops').insert({
    business_id: bizB, petty_id: petty.id, kind: 'charge', amount: 5000000, date_g: TODAY, description: 'شارژ تنخواه',
  });

  /* ── ۷) پیش‌دریافت و پیش‌پرداخت ۳٬۰۰۰٬۰۰۰ ── */
  const { data: advR } = await B.sb.from('acc_prepayments').insert({
    business_id: bizB, kind: 'advance_received', partner_id: customer.id, account_id: bank.id,
    amount: 3000000, date_g: TODAY, status: 'open', description: `پیش‌دریافت ${E2E}`,
  }).select('id').single();
  const { data: advP } = await B.sb.from('acc_prepayments').insert({
    business_id: bizB, kind: 'advance_paid', partner_id: supplier.id, account_id: bank.id,
    amount: 3000000, date_g: TODAY, status: 'open', description: `پیش‌پرداخت ${E2E}`,
  }).select('id').single();

  /* ── ۸) سند دستی ۱۰٬۰۰۰٬۰۰۰ بدهکار / ۱۰٬۰۰۰٬۰۰۰ بستانکار ── */
  const manualD = 10000000;
  let manualId = null;
  if (rpc) {
    const { data, error } = await B.sb.rpc('acc_create_journal', {
      p_business: bizB, p_date: TODAY, p_description: `سند دستی تسویه ${E2E}`, p_ref_type: 'manual',
      p_lines: [
        { account_code: '1201', account_title: 'موجودی کالا و خرید', debit: manualD, credit: 0 },
        { account_code: '1101', account_title: 'موجودی نقد و بانک — صندوق', debit: 0, credit: manualD },
      ],
    });
    manualId = error ? null : data;
    record('E2E-1', 'سند دستی ۱۰M/۱۰M ثبت شد', manualId ? 'PASS' : 'FAIL', error ? error.message.slice(0, 60) : manualId);
  } else {
    const { data: mj } = await B.sb.from('acc_journal').insert({
      business_id: bizB, entry_no: 9700, date_g: TODAY, ref_type: 'manual', ref_action: 'post', description: `سند دستی تسویه ${E2E}`,
    }).select('id').single();
    await B.sb.from('acc_journal_lines').insert([
      { entry_id: mj.id, business_id: bizB, account_code: '1201', account_title: 'موجودی کالا', debit: manualD, credit: 0 },
      { entry_id: mj.id, business_id: bizB, account_code: '1101', account_title: 'صندوق', debit: 0, credit: manualD },
    ]);
    manualId = mj.id;
  }

  /* ══ بررسی‌های سازگاری ══ */

  /* مانده مشتری از دید گردش فاکتور/دریافت (منبع: جداول عملیاتی — مثل partnerStatement اپ) */
  const { data: custInv } = await B.sb.from('acc_invoices').select('total, paid_total, status').eq('business_id', bizB).eq('partner_id', customer.id);
  const invoiced = (custInv || []).filter(i => !['cancelled', 'draft'].includes(i.status)).reduce((s, i) => s + i.total, 0);
  const settledInv = (custInv || []).filter(i => !['cancelled', 'draft'].includes(i.status)).reduce((s, i) => s + i.paid_total, 0);
  const { data: custTx } = await B.sb.from('acc_transactions').select('kind, amount, invoice_id').eq('business_id', bizB).eq('partner_id', customer.id);
  const directReceipt = (custTx || []).filter(t => !t.invoice_id && t.kind === 'receipt').reduce((s, t) => s + t.amount, 0);
  record('E2E-2', 'مانده مشتری = فاکتورها − تسویه‌شده (۱۱۰M − ۵۰M = ۶۰M)',
    invoiced === 110000000 && settledInv === 50000000 ? 'PASS' : 'FAIL',
    `فاکتور: ${invoiced.toLocaleString('fa-IR')} · تسویه: ${settledInv.toLocaleString('fa-IR')} · دریافت مستقیم: ${directReceipt.toLocaleString('fa-IR')}`);

  /* تراز آزمایشی */
  const { data: lines } = await B.sb.from('acc_journal_lines')
    .select('account_code, debit, credit, acc_journal!inner(date_g, voided_at, ref_action)')
    .eq('business_id', bizB);
  const active = (lines || []).filter(l => !l.acc_journal.voided_at && l.acc_journal.ref_action !== 'reverse');
  const totalD = active.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalC = active.reduce((s, l) => s + Number(l.credit || 0), 0);
  record('E2E-3', 'تراز آزمایشی سرتاسری: جمع بدهکار = جمع بستانکار', totalD === totalC ? 'PASS' : 'FAIL',
    `${totalD.toLocaleString('fa-IR')} / ${totalC.toLocaleString('fa-IR')}`);

  /* درآمد و هزینه در دفتر (بعد از مایگریشن: سند آینه‌ای فروش/هزینه ثبت شده) */
  const rev = active.filter(l => l.account_code === '4101').reduce((s, l) => s + Number(l.credit || 0) - Number(l.debit || 0), 0);
  const exp = active.filter(l => l.account_code === '5203' || l.account_code === '5201').reduce((s, l) => s + Number(l.debit || 0) - Number(l.credit || 0), 0);
  if (rpc) {
    /* ثبت سند آینه‌ای خرید و هزینه */
    const { error: purErr } = await B.sb.rpc('acc_post_document', { p_kind: 'invoice', p_ref_id: purchaseInv.id }).then(r => ({ error: r.error }));
    const { error: expErr } = await B.sb.rpc('acc_post_document', { p_kind: 'expense', p_ref_id: expense.id }).then(r => ({ error: r.error }));
    record('E2E-4', 'ثبت سند آینه‌ای خرید/هزینه', !purErr && !expErr ? 'PASS' : 'FAIL',
      [purErr, expErr].filter(Boolean).map(e => e.message.slice(0, 40)).join(' | ') || 'سندها ثبت شدند');

    const { data: lines2 } = await B.sb.from('acc_journal_lines')
      .select('account_code, debit, credit, acc_journal!inner(date_g, voided_at, ref_action)')
      .eq('business_id', bizB);
    const active2 = (lines2 || []).filter(l => !l.acc_journal.voided_at && l.acc_journal.ref_action !== 'reverse');
    const rev2 = active2.filter(l => l.account_code === '4101').reduce((s, l) => s + Number(l.credit || 0) - Number(l.debit || 0), 0);
    const exp2 = active2.filter(l => l.account_code === '5203').reduce((s, l) => s + Number(l.debit || 0) - Number(l.credit || 0), 0);
    const vatPay = active2.filter(l => l.account_code === '2102').reduce((s, l) => s + Number(l.credit || 0) - Number(l.debit || 0), 0);
    const receivable = active2.filter(l => l.account_code === '1103').reduce((s, l) => s + Number(l.debit || 0) - Number(l.credit || 0), 0);
    record('E2E-5', 'درآمد شناسایی‌شده در دفتر = ۱۰۰٬۰۰۰٬۰۰۰', rev2 === 100000000 ? 'PASS' : 'FAIL', rev2.toLocaleString('fa-IR'));
    record('E2E-6', 'هزینه شناسایی‌شده در دفتر = ۲۰٬۰۰۰٬۰۰۰', exp2 === 20000000 ? 'PASS' : 'FAIL', exp2.toLocaleString('fa-IR'));
    record('E2E-7', 'سود خالص دفتر = ۸۰٬۰۰۰٬۰۰۰', rev2 - exp2 === 80000000 ? 'PASS' : 'FAIL', (rev2 - exp2).toLocaleString('fa-IR'));
    record('E2E-8', 'مالیات فروش در حساب ۲۱۰۲ = ۱۰٬۰۰۰٬۰۰۰', vatPay === 10000000 ? 'PASS' : 'FAIL', vatPay.toLocaleString('fa-IR'));
    record('E2E-9', 'دریافتنی (۱۱۰۳) بعد از دریافت ۵۰M = ۶۰M', receivable === 60000000 ? 'PASS' : 'FAIL', receivable.toLocaleString('fa-IR'));

    /* سند آینه‌ای فروش تراز؟ */
    const { data: sj } = await B.sb.from('acc_journal').select('id').eq('business_id', bizB).eq('ref_type', 'invoice').eq('ref_id', saleInv.id).maybeSingle();
    if (sj) {
      const s2 = await entrySums(B.sb, sj.id);
      record('E2E-10', 'سند آینه‌ای فاکتور فروش تراز و کامل', s2.d === s2.c && s2.d === 110000000 && s2.lines >= 3 ? 'PASS' : 'FAIL', `${s2.d}/${s2.c} (${s2.lines} ردیف)`);
    }
  } else {
    record('E2E-4', 'سند آینه‌ای فروش/خرید/هزینه', 'SKIP', 'مایگریشن هنوز اجرا نشده — درآمد/هزینه/دریافتنیِ دفتری بعد از اجرا سنجیده می‌شود');
  }

  /* ظرفیت مانده حساب‌ها (بانک/صندوق از جداول عملیاتی) */
  const { data: txs } = await B.sb.from('acc_transactions').select('kind, amount, account_id').eq('business_id', bizB).eq('account_id', bank.id);
  const bankNet = (txs || []).reduce((s, t) => s + (t.kind === 'receipt' ? t.amount : -t.amount), 0);
  record('E2E-11', 'گردش خالص بانک از تراکنش‌ها = ۵۰٬۰۰۰٬۰۰۰', bankNet === 50000000 ? 'PASS' : 'FAIL', bankNet.toLocaleString('fa-IR'));

  /* چک و تنخواه و پیش‌پرداخت ثبت‌شده‌اند */
  const { count: chk } = await B.sb.from('acc_checks').select('id', { count: 'exact', head: true }).eq('business_id', bizB).eq('id', check.id);
  const { data: pr } = await B.sb.from('acc_prepayments').select('kind, status').eq('business_id', bizB).in('id', [advR.id, advP.id]);
  const { data: po } = await B.sb.from('acc_petty_ops').select('id').eq('business_id', bizB).eq('petty_id', petty.id);
  record('E2E-12', 'چک، تنخواه و پیش‌دریافت/پیش‌پرداخت ثبت شدند', chk === 1 && (pr || []).length === 2 && (po || []).length === 1 ? 'PASS' : 'FAIL',
    `چک:${chk} پیش‌ها:${(pr || []).length} تنخواه:${(po || []).length}`);
}
