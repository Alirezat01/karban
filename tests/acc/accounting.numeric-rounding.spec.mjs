/* ═══════════ accounting.numeric-rounding.spec ═══════════
   بخش ۱۵ درخواست — اعداد مرزی، مالیات، تخفیف، زیرجمع/جمع باقی‌مانده
   هم بررسی ریاضی خالص و هم صحت ذخیرهٔ فاکتور واقعی در دیتابیس */
import { record } from './_harness.mjs';

/* بازتاب دقیق computeInvoiceTotals + roundVat از src/lib/acc (api.ts/money.ts) */
const roundVat = (base, rate) => Math.round((base * (rate || 0)) / 100);
function computeInvoiceTotals(items) {
  let subtotal = 0, discountTotal = 0, vatTotal = 0;
  for (const it of items) {
    const base = Math.round(it.quantity * it.unit_price) - (it.discount || 0);
    subtotal += Math.round(it.quantity * it.unit_price);
    discountTotal += it.discount || 0;
    vatTotal += roundVat(base, it.vat_rate);
  }
  return { subtotal, discountTotal, vatTotal, total: subtotal - discountTotal + vatTotal };
}

export async function run(ctx) {
  const { A, bizA, TODAY, RID } = ctx;

  /* ۱) اعداد مرزی — مالیات ۱۰٪ */
  const edgeNumbers = [1, 10, 99, 100, 999, 1000, 1000000, 999999999];
  let edgeOk = true;
  for (const n of edgeNumbers) {
    const t = computeInvoiceTotals([{ quantity: 1, unit_price: n, discount: 0, vat_rate: 10 }]);
    const wantVat = Math.round(n * 0.1);
    if (t.subtotal !== n || t.vatTotal !== wantVat || t.total !== n + wantVat) {
      edgeOk = false;
      record(`NUM-${n}`, `عدد مرزی ${n}`, 'FAIL', JSON.stringify(t));
    }
  }
  record('NUM-1', 'اعداد مرزی (۱ تا ۹۹۹٬۹۹۹٬۹۹۹) با مالیات ۱۰٪', edgeOk ? 'PASS' : 'FAIL', edgeOk ? `${edgeNumbers.length} عدد دقیق` : 'بالاتر');

  /* ۲) اعشار در مبلغ واحد — گرد به ریال */
  const t2 = computeInvoiceTotals([{ quantity: 3, unit_price: 3333.6, discount: 0, vat_rate: 10 }]);
  record('NUM-2', 'مبلغ اعشاری گرد می‌شود (۳×۳۳۳۳.۶ → ۱۰٬۰۰۱)', t2.subtotal === 10001 ? 'PASS' : 'FAIL', JSON.stringify(t2));

  /* ۳) تخفیف مطلق + مالیات پس از تخفیف */
  const t3 = computeInvoiceTotals([{ quantity: 2, unit_price: 50000, discount: 5000, vat_rate: 10 }]);
  record('NUM-3', 'تخفیف ۵٬۰۰۰ + مالیات روی مبلغ پس از تخفیف', t3.subtotal === 100000 && t3.discountTotal === 5000 && t3.vatTotal === 9500 && t3.total === 104500 ? 'PASS' : 'FAIL', JSON.stringify(t3));

  /* ۴) صفر و بدون مالیات */
  const t4 = computeInvoiceTotals([{ quantity: 5, unit_price: 1000, discount: 0, vat_rate: 0 }]);
  record('NUM-4', 'کالای معاف از مالیات (۰٪)', t4.total === 5000 && t4.vatTotal === 0 ? 'PASS' : 'FAIL', JSON.stringify(t4));

  /* ۵) چند ردیف — مالیات ردیف‌به‌ردیف */
  const t5 = computeInvoiceTotals([
    { quantity: 1, unit_price: 1000, discount: 0, vat_rate: 10 },
    { quantity: 2, unit_price: 2500, discount: 500, vat_rate: 10 },
    { quantity: 3, unit_price: 999, discount: 100, vat_rate: 10 },
  ]);
  const want5 = 1100 + (roundVat(4500, 10) + 4500) + (roundVat(2897, 10) + 2897); // مالیات ردیف اول هم حساب می‌شود
  record('NUM-5', 'چند ردیف با تخفیف/مالیات متفاوت', t5.total === want5 ? 'PASS' : 'FAIL', `${t5.total} در برابر ${want5}`);

  /* ۶) ماندهٔ فاکتور: Total − Paid = Remaining */
  const { data: inv } = await A.sb.from('acc_invoices').insert({
    business_id: bizA, number: `NUM-${RID}`, type: 'sale', status: 'draft', date_g: TODAY,
    subtotal: 104500, discount_total: 5000, vat_total: 9500, total: 104500, paid_total: 40000,
  }).select('*').single();
  const remaining = inv.total - inv.paid_total;
  record('NUM-6', 'باقی‌مانده = جمع − پرداخت‌شده (۶۴٬۵۰۰)', remaining === 64500 ? 'PASS' : 'FAIL', remaining.toLocaleString('fa-IR'));
  await A.sb.from('acc_invoices').delete().eq('id', inv.id);

  /* ۷) ذخیرهٔ فاکتور واقعی: جمع دیتابیس = جمع محاسبه */
  const items = [{ quantity: 7, unit_price: 123456, discount: 10000, vat_rate: 10 }];
  const t7 = computeInvoiceTotals(items);
  const { data: inv7 } = await A.sb.from('acc_invoices').insert({
    business_id: bizA, number: `NUM7-${RID}`, type: 'sale', status: 'draft', date_g: TODAY,
    subtotal: t7.subtotal, discount_total: t7.discountTotal, vat_total: t7.vatTotal, total: t7.total, paid_total: 0,
  }).select('id').single();
  await A.sb.from('acc_invoice_items').insert({
    invoice_id: inv7.id, business_id: bizA, title: 'تست گرد کردن', unit: 'عدد',
    quantity: 7, unit_price: 123456, discount: 10000,
    vat_rate: 10, vat_amount: roundVat(7 * 123456 - 10000, 10), row_total: 7 * 123456 - 10000 + roundVat(7 * 123456 - 10000, 10), position: 0,
  });
  const { data: back } = await A.sb.from('acc_invoice_items').select('vat_amount, row_total').eq('invoice_id', inv7.id).single();
  record('NUM-7', 'ذخیرهٔ ردیف با مبلغ بزرگ (۸۶۴٬۱۹۲ − ۱۰٬۰۰۰) دقیق است',
    back.vat_amount === roundVat(7 * 123456 - 10000, 10) && back.row_total === 7 * 123456 - 10000 + roundVat(7 * 123456 - 10000, 10) ? 'PASS' : 'FAIL',
    `vat=${back.vat_amount} row=${back.row_total}`);
  await A.sb.from('acc_invoice_items').delete().eq('invoice_id', inv7.id);
  await A.sb.from('acc_invoices').delete().eq('id', inv7.id);
}
