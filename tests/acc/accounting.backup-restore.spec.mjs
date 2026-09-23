/* ═══════════ accounting.backup-restore.spec ═══════════
   بند ۱ — Backup/Restore تراکنشی (قرارداد M170000):
   خروجی کانونیکال → Preview بدون نوشتن → Restore اتمیک با ممنوعیت
   دادهٔ Business دیگر و بدون Duplicate و Rollback کامل در خطا */
import { record, insertJournalLegacy } from './_harness.mjs';

export async function run(ctx) {
  const { A, B, bizA, bizB, RID, TODAY } = ctx;
  const TAG = `BKP-${RID}`;

  /* دادهٔ شناخته‌شده برای پشتیبان */
  const { data: partner } = await A.sb.from('acc_partners')
    .insert({ business_id: bizA, kind: 'customer', person_type: 'real', name: `مشتری ${TAG}` })
    .select('id').single();
  await insertJournalLegacy(A.sb, bizA, {
    date_g: TODAY, description: `سند پشتیبان ${TAG}`,
    lines: [{ code: '1101', debit: 70000 }, { code: '4101', credit: 70000 }],
  });

  /* ۱) خروجی کانونیکال — format/version/counts */
  const { data: payload, error: expErr } = await A.sb.rpc('acc_backup_export', { p_business: bizA });
  record('BKP-1', 'خروجی Backup کانونیکال (format + counts)', !expErr && payload?.format === 'karban-acc-backup' ? 'PASS' : 'FAIL',
    expErr ? expErr.message.slice(0, 70) : `format=${payload?.format} · rows=${payload?.counts?.rows}`);
  if (expErr || !payload) return;

  /* ۲) Preview روی فایل خودش — valid و بدون هیچ درج جدید (بدون Duplicate) */
  const { data: prev, error: prevErr } = await A.sb.rpc('acc_restore_preview', { p_payload: payload });
  const prevInsert = Object.values(prev?.tables || {}).reduce((s, t) => s + t.insert, 0);
  record('BKP-2', 'Preview فایل خودش: valid + صفر درج جدید (بدون Duplicate)',
    !prevErr && prev?.valid === true && prevInsert === 0 ? 'PASS' : 'FAIL',
    prevErr ? prevErr.message.slice(0, 70) : `valid=${prev?.valid} · درج جدید=${prevInsert}`);

  /* ۳) Preview فایل خراب (format نامعتبر) → رد */
  const { data: badFmt } = await A.sb.rpc('acc_restore_preview', {
    p_payload: { ...payload, format: 'not-karban' },
  });
  record('BKP-3', 'فایل با format نامعتبر رد می‌شود', badFmt?.valid === false ? 'PASS' : 'FAIL',
    `valid=${badFmt?.valid} · خطاها: ${(badFmt?.errors || []).length}`);

  /* ۴) ممنوعیت دادهٔ Business دیگر — یک سطر با business_id بیگانه → رد کل فایل */
  const tampered = JSON.parse(JSON.stringify(payload));
  tampered.data.acc_partners = [
    ...(tampered.data.acc_partners || []),
    { id: '00000000-0000-0000-0000-00000000beef', business_id: bizB, kind: 'customer', person_type: 'real', name: 'نفوذ' },
  ];
  const { data: foreign } = await A.sb.rpc('acc_restore_preview', { p_payload: tampered });
  record('BKP-4', 'سطر متعلق به Business دیگر → رد کل بازیابی',
    foreign?.valid === false && (foreign?.errors || []).some(e => /acc_partners/.test(e)) ? 'PASS' : 'FAIL',
    `valid=${foreign?.valid} · خطاها: ${(foreign?.errors || []).join(' | ').slice(0, 80)}`);

  /* ۵) Restore اتمیک فایل سالم — idempotent روی همان بنگاه */
  const { data: restored, error: resErr } = await A.sb.rpc('acc_restore_business', { p_payload: payload });
  record('BKP-5', 'Restore اتمیک فایل سالم (idempotent — همه Duplicate)',
    !resErr && restored?.restored === true ? 'PASS' : 'FAIL',
    resErr ? resErr.message.slice(0, 70) : `inserted=${restored?.inserted_rows}`);

  /* ۶) مالکیت: B نمی‌تواند فایل A را در بنگاه خودش بازیابی کند */
  const { error: ownerErr } = await B.sb.rpc('acc_restore_business', { p_payload: payload });
  record('BKP-6', 'بازیابی فایل بنگاه دیگر توسط غیرمالک ممنوع', !!ownerErr ? 'PASS' : 'FAIL',
    ownerErr ? `رد شد ✓ ${ownerErr.message.slice(0, 60)}` : '⚠️ پذیرفته شد!');

  /* ۷) سازگاری فرانت: restorePreview/restoreBusiness روی payload خام JSON */
  const clientPayload = JSON.parse(JSON.stringify(payload));
  clientPayload.exported_at = new Date().toISOString(); // مثل فایل دانلودشدهٔ واقعی
  const { data: prev2 } = await A.sb.rpc('acc_restore_preview', { p_payload: clientPayload });
  record('BKP-7', 'Preview فایل بازخوانده‌شده از JSON (مسیر فرانت) سالم است',
    prev2?.valid === true ? 'PASS' : 'FAIL', `valid=${prev2?.valid}`);

  /* پاکسازی سطرهای ساخته‌شدهٔ همین تست */
  if (partner?.id) await A.sb.from('acc_partners').delete().eq('id', partner.id);
  const { data: bkRows } = await A.sb.from('acc_journal').select('id').eq('business_id', bizA).like('description', `سند پشتیبان ${TAG}`);
  for (const r of (bkRows || [])) {
    await A.sb.from('acc_journal_lines').delete().eq('entry_id', r.id);
    await A.sb.from('acc_journal').delete().eq('id', r.id);
  }
}
