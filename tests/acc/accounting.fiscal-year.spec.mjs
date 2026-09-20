/* ═══════════ accounting.fiscal-year.spec ═══════════
   بخش ۱۰ درخواست — چرخهٔ کامل دورهٔ مالی:
   عملیات → بستن → اختتامیه → سال بعد → افتتاحیه
   نگهبان‌ها: ثبت در دورهٔ بسته ممنوع · بستن مجدد ممنوع · اختتامیه/افتتاحیه تکراری ممنوع */
import { record, insertJournalLegacy, entrySums } from './_harness.mjs';

const YEAR = 1403; // سال مالی آزمایشی (بازهٔ میلادی 2024-03-20 تا 2025-03-20)

export async function run(ctx) {
  const { A, bizA, rpc, RID } = ctx;

  /* گردش درآمد/هزینه در سال ۱۴۰۳ */
  await insertJournalLegacy(A.sb, bizA, {
    date_g: '2025-01-15', description: `گردش فروش ۱۴۰۳-${RID}`,
    lines: [{ code: '1101', debit: 800000 }, { code: '4101', credit: 800000 }],
  });
  await insertJournalLegacy(A.sb, bizA, {
    date_g: '2025-02-10', description: `گردش هزینه ۱۴۰۳-${RID}`,
    lines: [{ code: '5201', debit: 300000 }, { code: '1101', credit: 300000 }],
  });

  if (!rpc) {
    /* مستند وضعیت قبل: بستن فقط کلاینتی است — درج سند در سال بسته باید الان هم ممکن باشد */
    const { data: fy } = await A.sb.from('acc_fiscal_years').insert({ business_id: bizA, jyear: YEAR, status: 'closed' }).select('id').single();
    let legacyAccepted = false;
    try {
      await insertJournalLegacy(A.sb, bizA, { date_g: '2025-01-20', description: `سند در سال بسته (قبل)-${RID}`, lines: [{ code: '1101', debit: 5 }, { code: '4101', credit: 5 }] });
      legacyAccepted = true;
    } catch { /* بسته */ }
    record('FIS-LEG', 'مسیر قدیمی: درج سند در سال بسته (مستند وضعیت قبل)', legacyAccepted ? 'EXPECTED-FAIL' : 'PASS',
      legacyAccepted ? '⚠️ سند در سال بسته پذیرفته شد — نگهبان دیتابیسی نداریم' : 'رد شد');
    await A.sb.from('acc_fiscal_years').delete().eq('id', fy.id);
    record('FIS-1', 'چرخهٔ کامل بستن/افتتاح با RPC', 'SKIP', 'مایگریشن هنوز اجرا نشده');
    return;
  }

  /* ══ چرخهٔ کامل (بعد از مایگریشن) ══ */

  /* ۱) سند اختتامیه — از مسیر RPC اتمیک (مثل closeFiscalYearV2) */
  const closingLines = [
    { account_code: '4101', account_title: 'درآمد فروش کالا و خدمات', debit: 800000, credit: 0, line_desc: 'بستن حساب درآمد' },
    { account_code: '5201', account_title: 'هزینه‌های اداری و عمومی', debit: 0, credit: 300000, line_desc: 'بستن حساب هزینه' },
    { account_code: '3102', account_title: 'سود (زیان) انباشته', debit: 0, credit: 500000, line_desc: 'نتیجهٔ عملکرد سال' },
  ];
  const { data: closingId, error: closeErr } = await A.sb.rpc('acc_create_journal', {
    p_business: bizA, p_date: '2025-03-20', p_description: `سند اختتامیهٔ سال مالی ${YEAR}`,
    p_ref_type: 'closing', p_lines: closingLines,
  });
  record('FIS-1', 'ثبت سند اختتامیهٔ تراز', !closeErr ? 'PASS' : 'FAIL', closeErr ? closeErr.message.slice(0, 70) : `سند: ${closingId}`);

  const cs = closingId ? await entrySums(A.sb, closingId) : { d: 0, c: 0 };
  record('FIS-2', 'اختتامیه تراز است (۸۰۰٬۰۰۰ = ۳۰۰٬۰۰۰ + ۵۰۰٬۰۰۰)', cs.d === cs.c && cs.d === 800000 ? 'PASS' : 'FAIL', `${cs.d}/${cs.c}`);

  /* ۲) ثبت ردیف دورهٔ بسته + قفل ماه‌ها (همان کاری که اپ می‌کند) */
  const { data: fyRow } = await A.sb.from('acc_fiscal_years').upsert(
    { business_id: bizA, jyear: YEAR, status: 'closed', closing_entry_id: closingId, closed_at: new Date().toISOString() },
    { onConflict: 'business_id,jyear' },
  ).select('id').single();
  await A.sb.from('acc_periods').upsert({ business_id: bizA, jyear: YEAR, jmonth: 11, locked: true }, { onConflict: 'business_id,jyear,jmonth' });

  /* ۳) ثبت سند در سال بسته → ممنوع (تریگر دیتابیس) */
  const { error: closedErr } = await A.sb.rpc('acc_create_journal', {
    p_business: bizA, p_date: '2025-01-20', p_description: `سند در سال بسته-${RID}`, p_ref_type: 'manual',
    p_lines: [{ account_code: '1101', debit: 100, credit: 0 }, { account_code: '4101', debit: 0, credit: 100 }],
  });
  record('FIS-3', 'ثبت سند در سال مالی بسته ممنوع (enforce دیتابیس)', !!closedErr ? 'PASS' : 'FAIL', closedErr ? closedErr.message.slice(0, 70) : '⚠️ پذیرفته شد!');

  /* ۴) درج مستقیم در سال بسته هم ممنوع */
  let directBlocked = false;
  try {
    await insertJournalLegacy(A.sb, bizA, { date_g: '2025-01-21', description: `درج مستقیم در سال بسته-${RID}`, lines: [{ code: '1101', debit: 3 }, { code: '4101', credit: 3 }] });
  } catch { directBlocked = true; }
  record('FIS-4', 'درج مستقیم در سال بسته ممنوع (تریگر)', directBlocked ? 'PASS' : 'FAIL', directBlocked ? 'رد شد ✓' : '⚠️ پذیرفته شد!');

  /* ۵) اختتامیهٔ دوم ممنوع */
  const { error: reCloseErr } = await A.sb.rpc('acc_create_journal', {
    p_business: bizA, p_date: '2025-03-20', p_description: `اختتامیهٔ دوم-${RID}`, p_ref_type: 'closing', p_lines: closingLines,
  });
  record('FIS-5', 'بستن مجدد (اختتامیهٔ دوم) ممنوع', !!reCloseErr ? 'PASS' : 'FAIL', reCloseErr ? reCloseErr.message.slice(0, 70) : '⚠️ پذیرفته شد!');

  /* ۶) سند در ماه قفل‌شدهٔ سال باز ممنوع (۱۱ بهمن — از سال جاری به‌عنوان ماه قفل تستی) */
  const { error: monthErr } = await A.sb.rpc('acc_create_journal', {
    p_business: bizA, p_date: '2026-01-30', p_description: `سند در ماه قفل-${RID}`, p_ref_type: 'manual',
    p_lines: [{ account_code: '1101', debit: 100, credit: 0 }, { account_code: '4101', debit: 0, credit: 100 }],
  });
  record('FIS-6', 'ثبت سند در ماه قفل‌شده ممنوع', !!monthErr ? 'PASS' : 'FAIL', monthErr ? monthErr.message.slice(0, 70) : '⚠️ پذیرفته شد!');

  /* ۷) سند افتتاحیهٔ سال بعد */
  const openingLines = [
    { account_code: '1101', account_title: 'موجودی نقد و بانک — صندوق', debit: 500000, credit: 0, line_desc: 'انتقال مانده از سال قبل' },
    { account_code: '3102', account_title: 'سود (زیان) انباشته', debit: 0, credit: 500000, line_desc: 'انتقال نتیجهٔ سال قبل' },
  ];
  const { data: openingId, error: openErr } = await A.sb.rpc('acc_create_journal', {
    p_business: bizA, p_date: '2025-03-21', p_description: `سند افتتاحیهٔ سال مالی ${YEAR + 1}`,
    p_ref_type: 'opening', p_lines: openingLines,
  });
  record('FIS-7', 'ثبت سند افتتاحیهٔ سال بعد', !openErr ? 'PASS' : 'FAIL', openErr ? openErr.message.slice(0, 70) : `سند: ${openingId}`);

  /* ۸) افتتاحیهٔ دوم ممنوع */
  const { error: reOpenErr } = await A.sb.rpc('acc_create_journal', {
    p_business: bizA, p_date: '2025-03-21', p_description: `افتتاحیهٔ دوم-${RID}`, p_ref_type: 'opening', p_lines: openingLines,
  });
  record('FIS-8', 'افتتاحیهٔ دوم برای همان سال ممنوع', !!reOpenErr ? 'PASS' : 'FAIL', reOpenErr ? reOpenErr.message.slice(0, 70) : '⚠️ پذیرفته شد!');

  /* ۹) سند معکوس حتی در دورهٔ بسته مجاز است (مسیر اصلاح) */
  const jid = await insertJournalLegacy(A.sb, bizA, {
    date_g: '2026-01-05', description: `قابل ابطال برای تست-${RID}`, lines: [{ code: '1101', debit: 44 }, { code: '4101', credit: 44 }],
  });
  const { data: revId, error: revErr } = await A.sb.rpc('acc_void_journal', { p_business: bizA, p_entry: jid, p_reason: 'تست برگشت' });
  record('FIS-9', 'ابطال سند (سند معکوس) از مسیر RPC کار می‌کند', !revErr ? 'PASS' : 'FAIL', revErr ? revErr.message.slice(0, 70) : `معکوس: ${revId}`);

  /* ثبت ردیف‌های نگهبان برای گزارش نهایی */
  record('FIS-CTX', `دورهٔ ${YEAR} بسته شد + اختتامیه/افتتاحیه ثبت شد`, fyRow ? 'PASS' : 'FAIL', fyRow ? 'ok' : 'ردیف دوره ساخته نشد');
}
