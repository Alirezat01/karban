/* ═══════════ accounting.expense-edit.spec ═══════════
   M220000 — ویرایش قابل‌اعتماد هزینه:
   • گارد: هزینهٔ سندخوردهٔ «فعال» از آپدیت مستقیم مالی رد می‌شود (رفتار درست)
   • RPC acc_edit_expense: تغییر غیرمالی سند را دست نمی‌زند
   • RPC acc_edit_expense: تغییر مالی → ابطال سند فعال + صدور سند جدید اتمیک
   • project_id روی هزینه و ردیف سند ذخیره می‌شود (باگ ۳ کاربر)
   • چک صیادی: شناسهٔ ۱۶رقمی یگانه + قید فرمت (باگ ۲ کاربر) */
import { record } from './_harness.mjs';

export async function run(ctx) {
  const { A, bizA, RID, TODAY } = ctx;
  const TAG = `EXE-${RID}`;

  /* ۰۰) سنجش قابلیت — اگر M220000 هنوز اجرا نشده، وابسته‌ها SKIP می‌شوند */
  const { error: capErr } = await A.sb.rpc('acc_edit_expense', { p_expense_id: '00000000-0000-0000-0000-000000000000', p_patch: {} });
  const hasRpc = !capErr || !/could not find|does not exist|schema cache|not found/i.test(capErr.message || '');
  if (!hasRpc) {
    record('EXE-CAP', 'RPC acc_edit_expense (M220000)', 'SKIP', 'M220000 هنوز اجرا نشده — پس از اجرا دوباره اجرا کنید');
    return;
  }

  /* ۰) حساب بانکی برای بنگاه آزمون */
  const { data: bank } = await A.sb.from('acc_accounts')
    .insert({ business_id: bizA, name: `بانک آزمون ${TAG}`, kind: 'bank' })
    .select('id').single();
  if (!bank) { record('EXE-0', 'ساخت حساب بانکی', 'FAIL', 'حساب بانکی ساخته نشد'); return; }

  const AMT1 = 100000, AMT2 = 250000;
  const { data: expId, error: eExp } = await A.sb.from('acc_expenses').insert({
    business_id: bizA, category: 'اداری و عمومی', title: `هزینهٔ اولیه ${TAG}`,
    amount: AMT1, vat_amount: 0, date_g: TODAY, account_id: bank.id,
    is_paid: true, paid_by_kind: 'company', tax_status: 'complete',
  }).select('id').single();
  record('EXE-1', 'ثبت هزینهٔ پرداخت‌شدهٔ شرکت ← سند خودکار', !eExp ? 'PASS' : 'FAIL',
    eExp ? eExp.message.slice(0, 70) : `هزینه: ${expId?.id?.slice(0, 8)}`);
  if (eExp || !expId) return;

  const activeJournal = async () => {
    const { data } = await A.sb.from('acc_journal')
      .select('id, voided_at').eq('business_id', bizA).eq('ref_type', 'expense')
      .eq('ref_id', expId.id).eq('ref_action', 'post');
    return (data || []).filter((j) => !j.voided_at);
  };
  const first = (await activeJournal())[0];
  record('EXE-2', 'سند post فعال دقیقاً یکی است', first && (await activeJournal()).length === 1 ? 'PASS' : 'FAIL',
    `سند فعال: ${(await activeJournal()).length} — ${first?.id?.slice(0, 8) || '—'}`);

  /* ۱) آپدیت مستقیم مالی از مسیر اپ — گارد باید رد کند */
  const { error: gErr } = await A.sb.from('acc_expenses').update({ amount: AMT2 }).eq('id', expId.id);
  record('EXE-3', 'آپدیت مستقیم هزینهٔ سندخورده رد می‌شود (گارد)', gErr ? 'PASS' : 'FAIL',
    gErr ? 'رد شد: ' + gErr.message.slice(0, 60) : 'آپدیت مستقیم پذیرفته شد!');

  /* ۲) ویرایش غیرمالی — سند دست نمی‌خورد */
  const { data: r2, error: e2 } = await A.sb.rpc('acc_edit_expense', {
    p_expense_id: expId.id, p_patch: { title: `عنوان ویرایش‌شده ${TAG}`, vendor_name: 'فروشندهٔ آزمون' },
  });
  const sameJournal = r2 && !r2.financial_changed && r2.active_journal_id === first.id;
  record('EXE-4', 'ویرایش غیرمالی (عنوان/فروشنده) بدون تغییر سند', !e2 && sameJournal ? 'PASS' : 'FAIL',
    e2 ? e2.message.slice(0, 70) : `financial_changed: ${r2?.financial_changed} — سند همان: ${r2?.active_journal_id === first.id}`);

  /* ۳) ویرایش مالی + پروژه — ابطال + صدور مجدد اتمیک */
  const { data: proj } = await A.sb.from('acc_projects')
    .insert({ business_id: bizA, name: `پروژهٔ آزمون ${TAG}` }).select('id').single();
  const { data: r3, error: e3 } = await A.sb.rpc('acc_edit_expense', {
    p_expense_id: expId.id, p_patch: { amount: AMT2, project_id: proj?.id || null },
  });
  const activesAfter = await activeJournal();
  const newJournal = activesAfter.find((j) => j.id !== first.id);
  record('EXE-5', 'ویرایش مالی ← سند قبلی ابطال و سند جدید صادر شد',
    !e3 && r3?.financial_changed === true && activesAfter.length === 1 && !!newJournal ? 'PASS' : 'FAIL',
    e3 ? e3.message.slice(0, 70) : `سندهای فعال: ${activesAfter.length} — سند جدید: ${newJournal?.id?.slice(0, 8) || '—'}`);

  /* ۴) مبلغ سند جدید + project_id روی ردیف سند */
  const { data: line } = await A.sb.from('acc_journal_lines')
    .select('debit, project_id').eq('entry_id', newJournal?.id || '').gt('debit', 0).maybeSingle();
  const { data: expRow } = await A.sb.from('acc_expenses')
    .select('amount, project_id').eq('id', expId.id).maybeSingle();
  record('EXE-6', 'سند جدید با مبلغ جدید + project_id روی ردیف و رکورد',
    Number(line?.debit) === AMT2 && line?.project_id === proj?.id && expRow?.project_id === proj?.id ? 'PASS' : 'FAIL',
    `بدهکار سند: ${Number(line?.debit || 0).toLocaleString('fa-IR')} — پروژهٔ ردیف: ${line?.project_id === proj?.id ? 'درست' : '—'}`);

  /* ۵) ویرایش هزینهٔ ابطال‌شده رد می‌شود */
  const { error: voidUpd } = await A.sb.from('acc_expenses')
    .update({ voided_at: new Date().toISOString(), void_reason: 'آزمون ابطال' })
    .eq('id', expId.id);
  if (voidUpd) {
    record('EXE-7', 'ویرایش هزینهٔ ابطال‌شده رد می‌شود', 'SKIP', 'ابطال مستقیم ممکن نشد: ' + voidUpd.message.slice(0, 50));
  } else {
    const { data: r5, error: e5 } = await A.sb.rpc('acc_edit_expense', {
      p_expense_id: expId.id, p_patch: { title: 'تغییر روی ابطال‌شده' },
    });
    record('EXE-7', 'ویرایش هزینهٔ ابطال‌شده رد می‌شود', (e5 && !r5) ? 'PASS' : 'FAIL',
      e5 ? 'رد شد: ' + e5.message.slice(0, 60) : 'ویرایش ابطال‌شده پذیرفته شد!');
  }

  /* ۶) چک صیادی — فرمت و یگانگی */
  const SAY = '1234567890123456';
  const { data: chk, error: cErr } = await A.sb.from('acc_checks').insert({
    business_id: bizA, kind: 'received', amount: 9000000, due_date_g: TODAY, status: 'in_hand',
    sayadi_id: SAY, cheque_type: 'guaranteed', issuer_name: 'صادرکنندهٔ آزمون', payee_name: 'گیرندهٔ آزمون',
  }).select('id, sayadi_id, cheque_type').single();
  record('EXE-8', 'چک با شناسهٔ صیادی ۱۶رقمی ثبت می‌شود', !cErr && chk?.sayadi_id === SAY && chk?.cheque_type === 'guaranteed' ? 'PASS' : 'FAIL',
    cErr ? cErr.message.slice(0, 70) : `نوع: ${chk?.cheque_type}`);

  const { error: dupErr } = await A.sb.from('acc_checks').insert({
    business_id: bizA, kind: 'received', amount: 1000000, due_date_g: TODAY, sayadi_id: SAY,
  });
  record('EXE-9', 'شناسهٔ صیادی تکراری در همان بنگاه رد می‌شود', dupErr ? 'PASS' : 'FAIL',
    dupErr ? 'رد شد (یگانگی)' : 'تکراری پذیرفته شد!');

  const { error: fmtErr } = await A.sb.from('acc_checks').insert({
    business_id: bizA, kind: 'received', amount: 1000000, due_date_g: TODAY, sayadi_id: '123456789012345',
  });
  record('EXE-10', 'شناسهٔ صیادی ۱۵رقمی رد می‌شود (قید فرمت)', fmtErr ? 'PASS' : 'FAIL',
    fmtErr ? 'رد شد (فرمت)' : 'فرمت غلط پذیرفته شد!');
}
