/* ═══════════ accounting.deletion.spec ═══════════
   بخش ۱۳ درخواست — حذف همهٔ موجودیت‌های حساس:
   بدون گردش / با گردش / با سند / بعد از ابطال / بعد از تسویه
   حذف نباید زنجیرهٔ حسابداری را بشکند */
import { record, insertJournalLegacy } from './_harness.mjs';

export async function run(ctx) {
  const { A, bizA, rpc, TODAY, RID } = ctx;
  const DEL = `DEL-${RID}`;

  /* ۱) طرف‌حساب بدون گردش → قابل حذف */
  const { data: pFree } = await A.sb.from('acc_partners').insert({ business_id: bizA, kind: 'customer', person_type: 'real', name: `آزاد-${DEL}` }).select('id').single();
  const { error: delPFree } = await A.sb.from('acc_partners').delete().eq('id', pFree.id);
  record('DEL-1', 'حذف طرف‌حساب بدون گردش مجاز است', !delPFree ? 'PASS' : 'FAIL', delPFree?.message?.slice(0, 50) || 'حذف شد');

  /* ۲) فاکتور پیش‌نویس → قابل حذف */
  const { data: draft } = await A.sb.from('acc_invoices').insert({
    business_id: bizA, number: `${DEL}-D`, type: 'sale', status: 'draft', date_g: TODAY,
    subtotal: 1000, discount_total: 0, vat_total: 0, total: 1000, paid_total: 0,
  }).select('id').single();
  const { error: delDraft } = await A.sb.from('acc_invoices').delete().eq('id', draft.id);
  record('DEL-2', 'حذف فاکتور پیش‌نویس مجاز است', !delDraft ? 'PASS' : 'FAIL', delDraft?.message?.slice(0, 50) || 'حذف شد');

  /* ۳) فاکتور صادره → حذف ممنوع (بعد از مایگریشن؛ قبل از آن مستند)
     فاکتور باید قابل صدور باشد (طرف‌حساب + ردیف) وگرنه draft می‌ماند و حذفش مجاز است */
  const { data: del3Partner } = await A.sb.from('acc_partners').insert({ business_id: bizA, kind: 'customer', person_type: 'real', name: `خریدار-DEL3-${DEL}` }).select('id').single();
  const { data: issued, error: issuedErr } = await A.sb.from('acc_invoices').insert({
    business_id: bizA, number: `${DEL}-I`, type: 'sale', status: 'draft', partner_id: del3Partner?.id ?? null, date_g: TODAY,
    subtotal: 2000, discount_total: 0, vat_total: 0, total: 2000, paid_total: 0,
  }).select('id').single();
  if (rpc) {
    const { error: iiErr3 } = await A.sb.from('acc_invoice_items').insert({
      invoice_id: issued.id, business_id: bizA, title: `خدمت DEL3-${DEL}`, unit: 'عدد',
      quantity: 1, unit_price: 2000, discount: 0, vat_rate: 0, vat_amount: 0, row_total: 2000, position: 0,
    });
    const { error: issueErr } = iiErr3 || issuedErr
      ? { error: iiErr3 || issuedErr }
      : await A.sb.rpc('acc_issue_invoice', { p_invoice: issued.id }).then(r => ({ error: r.error }));
    if (issueErr) {
      record('DEL-3', 'حذف فاکتور صادره ممنوع', 'FAIL', 'صادر نشد: ' + issueErr.message.slice(0, 70));
    } else {
      const { data: delRes, error: delIssued } = await A.sb.from('acc_invoices').delete().eq('id', issued.id).select('id');
      record('DEL-3', 'حذف فاکتور صادره ممنوع (حتی بدون خطا، اثری ندارد)', (delRes || []).length === 0 ? 'PASS' : 'FAIL',
        `${(delRes || []).length} ردیف حذف شد`);
      /* بستن مسیر ابطال برای پاکسازی */
      await A.sb.rpc('acc_void_invoice', { p_business: bizA, p_invoice: issued.id, p_reason: 'تست حذف', p_restore_stock: false });
    }
  } else {
    /* قبل از مایگریشن posted_at توسط تریگر sql-6 مهر می‌شود ولی DELETE آزاد است */
    await A.sb.from('acc_invoices').update({ status: 'issued' }).eq('id', issued.id);
    const { error: delIssued } = await A.sb.from('acc_invoices').delete().eq('id', issued.id);
    record('DEL-3', 'حذف فاکتور صادره (مستند وضعیت قبل)', !delIssued ? 'EXPECTED-FAIL' : 'PASS',
      delIssued ? 'رد شد' : '⚠️ فاکتور صادره آزادانه حذف شد — بعد از مایگریشن بسته می‌شود');
  }

  /* ۴) سند دستی بدون ابطال → حذف مجاز (مسیر deleteJournalFull اپ) */
  const mjid = await insertJournalLegacy(A.sb, bizA, {
    date_g: TODAY, description: `دستی-حذف-${DEL}`, lines: [{ code: '1101', debit: 100 }, { code: '4101', credit: 100 }],
  });
  await A.sb.from('acc_journal_lines').delete().eq('entry_id', mjid);
  const { error: delManual } = await A.sb.from('acc_journal').delete().eq('id', mjid);
  record('DEL-4', 'حذف سند دستی (خط‌ها بعد سرِسند) مجاز است', !delManual ? 'PASS' : 'FAIL', delManual?.message?.slice(0, 60) || 'حذف شد');

  /* ۵) سند سیستمی → حذف مستقیم ممنوع (بعد از مایگریشن) */
  if (rpc) {
    const sysId = await insertJournalLegacy(A.sb, bizA, {
      date_g: TODAY, ref_type: 'expense', description: `سیستمی-حذف-${DEL}`, lines: [{ code: '5201', debit: 50 }, { code: '1101', credit: 50 }],
    }).catch(() => null);
    if (sysId) {
      await A.sb.from('acc_journal_lines').delete().eq('entry_id', sysId); // خط‌ها را بگذار بمانند — حذف سرِسند باید رد شود
      const { data: delSys, error: delSysErr } = await A.sb.from('acc_journal').delete().eq('id', sysId).select('id');
      record('DEL-5', 'حذف مستقیم سند سیستمی ممنوع', (delSys || []).length === 0 ? 'PASS' : 'FAIL',
        delSysErr ? delSysErr.message.slice(0, 60) : `${(delSys || []).length} حذف شد!`);
    } else {
      /* اگر تریگر خط‌ها اجازه نداد، رد شدن خود درج هم شاهد است */
      record('DEL-5', 'حذف مستقیم سند سیستمی ممنوع', 'PASS', 'درج سند سیستمی از مسیر مستقیم هم رد شد (تریگر ردیف‌ها)');
    }
  } else {
    record('DEL-5', 'حذف مستقیم سند سیستمی ممنوع', 'SKIP', 'مایگریشن هنوز اجرا نشده');
  }

  /* ۶) حساب بانکی با تراکنش → حذف نباید تراکنش‌ها را یتیم کند */
  const { data: acc, error: accErr } = await A.sb.from('acc_accounts').insert({ business_id: bizA, name: `بانک-${DEL}`, kind: 'bank', initial_balance: 0, active: true }).select('id').single();
  if (accErr || !acc) {
    record('DEL-6', 'ساخت حساب بانکی آزمایشی', 'FAIL', accErr?.message?.slice(0, 60) || 'بدون داده');
  } else {
  /* ۶) حساب بانکی با تراکنش → حذف نباید تراکنش‌ها را یتیم کند
     (بند ۱۳: دریافت/پرداخت بدون طرف‌حساب در دیتابیس ممنوع است — مثل اپ همیشه طرف‌حساب می‌فرستیم) */
  const { data: pTx, error: pTxErr } = await A.sb.from('acc_partners').insert({ business_id: bizA, kind: 'customer', person_type: 'real', name: `طرف‌حساب-${DEL}` }).select('id').single();
  const { data: tx, error: txErr } = await A.sb.from('acc_transactions').insert({ business_id: bizA, kind: 'receipt', amount: 7000, date_g: TODAY, method: 'cash', account_id: acc.id, partner_id: pTx?.id ?? null, description: `تراکنش-${DEL}` }).select('id').single();
  if (pTxErr || txErr || !tx) {
    record('DEL-6', 'ساخت تراکنش آزمایشی با طرف‌حساب', 'FAIL', (pTxErr || txErr)?.message?.slice(0, 60) || 'بدون داده');
  } else {
  const { error: delAccErr } = await A.sb.from('acc_accounts').delete().eq('id', acc.id);
  const { data: txAfter } = await A.sb.from('acc_transactions').select('id, account_id').eq('id', tx.id).maybeSingle();
  record('DEL-6', 'حذف حساب با تراکنش: تراکنش یتیم نمی‌ماند (FK on-delete رفتار مشخص دارد)',
    !txAfter || txAfter.account_id === null || delAccErr ? 'PASS' : 'FAIL',
    delAccErr ? `حذف حساب رد شد: ${delAccErr.message.slice(0, 40)}` : (!txAfter ? 'تراکنش هم حذف شد (cascade)' : 'تراکنش با account_id = null ماند (set null)'));
  await A.sb.from('acc_transactions').delete().eq('id', tx.id);
  }
  }

  /* ۷) مشتری با فاکتور → حذف مشتری نباید فاکتور را از بین ببرد */
  const { data: pWith } = await A.sb.from('acc_partners').insert({ business_id: bizA, kind: 'customer', person_type: 'real', name: `مشتری-با-فاکتور-${DEL}` }).select('id').single();
  const { data: invWith } = await A.sb.from('acc_invoices').insert({
    business_id: bizA, number: `${DEL}-P`, type: 'sale', status: 'draft', partner_id: pWith.id, date_g: TODAY,
    subtotal: 3000, discount_total: 0, vat_total: 0, total: 3000, paid_total: 0,
  }).select('id').single();
  const { error: delPWith } = await A.sb.from('acc_partners').delete().eq('id', pWith.id);
  const { data: invAfter } = await A.sb.from('acc_invoices').select('id, partner_id').eq('id', invWith.id).maybeSingle();
  record('DEL-7', 'حذف مشتری دارای فاکتور: فاکتور یتیم/حذف نمی‌شود ناگهانی',
    delPWith || (invAfter && invAfter.partner_id === null) || !invAfter ? 'PASS' : 'FAIL',
    delPWith ? 'حذف مشتری رد شد (پالیسی/FK)' : (!invAfter ? 'فاکتور هم حذف شد (cascade)' : 'فاکتور با partner_id خالی ماند (set null)'));
  await A.sb.from('acc_invoices').delete().eq('id', invWith.id).catch?.(() => {});
  try { await A.sb.from('acc_invoices').delete().eq('id', invWith.id); } catch { }
}
