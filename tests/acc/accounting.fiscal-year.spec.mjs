/* ═══════════ accounting.fiscal-year.spec ═══════════
   بند ۱۶ — چرخهٔ اتمیک دورهٔ مالی (قرارداد M150000/M180000):
   بستن اتمیک (اختتامیه + بستن سال + قفل ۱۲ ماه در یک تراکنش) → ثبت در سال
   بسته ممنوع → بستن دوباره ممنوع → افتتاح اتمیک سال بعد → افتتاحیهٔ تکراری
   ممنوع → بازکردن دورهٔ سال بسته ممنوع → ابطال سند در دورهٔ قفل (مسیر اصلاح) */
import { record, insertJournalLegacy, entrySums } from './_harness.mjs';

const YEAR = 1403; // بازهٔ میلادی 2024-03-20 تا 2025-03-20

export async function run(ctx) {
  const { A, bizA, RID, TODAY } = ctx;

  /* گردش درآمد/هزینه در سال ۱۴۰۳ — از مسیر موتور */
  await insertJournalLegacy(A.sb, bizA, {
    date_g: '2025-01-15', description: `گردش فروش ۱۴۰۳-${RID}`,
    lines: [{ code: '1101', debit: 800000 }, { code: '4101', credit: 800000 }],
  });
  await insertJournalLegacy(A.sb, bizA, {
    date_g: '2025-02-10', description: `گردش هزینه ۱۴۰۳-${RID}`,
    lines: [{ code: '5201', debit: 300000 }, { code: '1101', credit: 300000 }],
  });

  /* ══ ۱) بستن اتمیک سال — سند اختتامیه + بستن + قفل ۱۲ ماه، یک تراکنش ══ */
  const closingLines = [
    { account_code: '4101', account_title: 'درآمد فروش کالا و خدمات', debit: 800000, credit: 0, line_desc: 'بستن حساب درآمد' },
    { account_code: '5201', account_title: 'هزینه‌های اداری و عمومی', debit: 0, credit: 300000, line_desc: 'بستن حساب هزینه' },
    { account_code: '3102', account_title: 'سود (زیان) انباشته', debit: 0, credit: 500000, line_desc: 'نتیجهٔ عملکرد سال' },
  ];
  const { data: closingId, error: closeErr } = await A.sb.rpc('acc_close_fiscal_year', {
    p_business: bizA, p_jyear: YEAR, p_date: '2025-03-20',
    p_description: `سند اختتامیهٔ سال مالی ${YEAR}`, p_lines: closingLines,
  });
  record('FIS-1', 'بستن اتمیک سال (اختتامیه + قفل ۱۲ ماه در یک تراکنش)', !closeErr ? 'PASS' : 'FAIL',
    closeErr ? closeErr.message.slice(0, 70) : `سند: ${closingId}`);

  const cs = closingId ? await entrySums(A.sb, closingId) : { d: 0, c: 0 };
  record('FIS-2', 'اختتامیه تراز است (۸۰۰٬۰۰۰ = ۳۰۰٬۰۰۰ + ۵۰۰٬۰۰۰)', cs.d === cs.c && cs.d === 800000 ? 'PASS' : 'FAIL', `${cs.d}/${cs.c}`);

  /* ردیف دورهٔ مالی بسته شد و هر ۱۲ ماه قفل شدند (خواندنی) */
  const { data: fyRow } = await A.sb.from('acc_fiscal_years').select('status, closing_entry_id')
    .eq('business_id', bizA).eq('jyear', YEAR).maybeSingle();
  const { count: lockedCount } = await A.sb.from('acc_periods')
    .select('jmonth', { count: 'exact', head: true })
    .eq('business_id', bizA).eq('jyear', YEAR).eq('locked', true);
  record('FIS-CTX', 'سال بسته + هر ۱۲ ماه قفل شد (اتمیک)',
    fyRow?.status === 'closed' && fyRow?.closing_entry_id === closingId && lockedCount === 12 ? 'PASS' : 'FAIL',
    `status=${fyRow?.status} · ماه‌های قفل=${lockedCount ?? 0}`);

  /* ══ ۲) ثبت سند در سال بسته → ممنوع ══ */
  const { error: closedErr } = await A.sb.rpc('acc_create_journal', {
    p_business: bizA, p_date: '2025-01-20', p_description: `سند در سال بسته-${RID}`, p_ref_type: 'manual',
    p_lines: [{ account_code: '1101', debit: 100, credit: 0 }, { account_code: '4101', debit: 0, credit: 100 }],
  });
  record('FIS-3', 'ثبت سند در سال مالی بسته ممنوع (enforce دیتابیس)', !!closedErr ? 'PASS' : 'FAIL',
    closedErr ? closedErr.message.slice(0, 70) : '⚠️ پذیرفته شد!');

  /* ══ ۳) نوشتن مستقیم کلاینتی روی دوره‌ها/سال مالی → ممنوع (قفل M150000) ══ */
  const { error: directErr } = await A.sb.from('acc_periods')
    .upsert({ business_id: bizA, jyear: YEAR, jmonth: 3, locked: false }, { onConflict: 'business_id,jyear,jmonth' });
  record('FIS-4', 'نوشتن مستقیم کلاینتی روی acc_periods ممنوع (قفل M150000)', !!directErr ? 'PASS' : 'FAIL',
    directErr ? `رد شد: ${directErr.message.slice(0, 60)}` : '⚠️ پذیرفته شد!');

  /* ══ ۴) بستن دوباره → ممنوع (سند اختتامیهٔ تکراری) ══ */
  const { error: reCloseErr } = await A.sb.rpc('acc_close_fiscal_year', {
    p_business: bizA, p_jyear: YEAR, p_date: '2025-03-20',
    p_description: `اختتامیهٔ دوم-${RID}`, p_lines: closingLines,
  });
  record('FIS-5', 'بستن مجدد سال (اختتامیهٔ دوم) ممنوع', !!reCloseErr ? 'PASS' : 'FAIL',
    reCloseErr ? reCloseErr.message.slice(0, 70) : '⚠️ پذیرفته شد!');

  /* ══ ۵) بازکردن دورهٔ سال بسته از RPC → ممنوع (گارد M180000) ══ */
  const { error: unlockErr } = await A.sb.rpc('acc_period_lock_set', {
    p_business: bizA, p_jyear: YEAR, p_jmonth: 5, p_locked: false,
  });
  record('FIS-6', 'بازکردن دورهٔ سال بسته ممنوع (acc_period_lock_set)', !!unlockErr ? 'PASS' : 'FAIL',
    unlockErr ? unlockErr.message.slice(0, 70) : '⚠️ پذیرفته شد!');

  /* ══ ۶) افتتاح اتمیک سال بعد ══ */
  const openingLines = [
    { account_code: '1101', account_title: 'موجودی نقد و بانک — صندوق', debit: 500000, credit: 0, line_desc: 'انتقال مانده از سال قبل' },
    { account_code: '3102', account_title: 'سود (زیان) انباشته', debit: 0, credit: 500000, line_desc: 'انتقال نتیجهٔ سال قبل' },
  ];
  const { data: openingId, error: openErr } = await A.sb.rpc('acc_open_next_year', {
    p_business: bizA, p_jyear: YEAR + 1, p_date: '2025-03-21',
    p_description: `سند افتتاحیهٔ سال مالی ${YEAR + 1}`, p_lines: openingLines,
  });
  record('FIS-7', 'افتتاح اتمیک سال بعد (سند + ثبت سال در یک تراکنش)', !openErr ? 'PASS' : 'FAIL',
    openErr ? openErr.message.slice(0, 70) : `سند: ${openingId}`);

  /* ══ ۷) افتتاحیهٔ دوم → ممنوع ══ */
  const { error: reOpenErr } = await A.sb.rpc('acc_open_next_year', {
    p_business: bizA, p_jyear: YEAR + 1, p_date: '2025-03-21',
    p_description: `افتتاحیهٔ دوم-${RID}`, p_lines: openingLines,
  });
  record('FIS-8', 'افتتاحیهٔ دوم برای همان سال ممنوع', !!reOpenErr ? 'PASS' : 'FAIL',
    reOpenErr ? reOpenErr.message.slice(0, 70) : '⚠️ پذیرفته شد!');

  /* ══ ۸) ابطال سند (مسیر اصلاح) در سال جاری باز کار می‌کند ══ */
  const jid = await insertJournalLegacy(A.sb, bizA, {
    date_g: TODAY, description: `قابل ابطال برای تست-${RID}`, lines: [{ code: '1101', debit: 44 }, { code: '4101', credit: 44 }],
  });
  const { data: revId, error: revErr } = await A.sb.rpc('acc_void_journal', { p_business: bizA, p_entry: jid, p_reason: 'تست برگشت' });
  record('FIS-9', 'ابطال سند (سند معکوس) از مسیر RPC کار می‌کند', !revErr ? 'PASS' : 'FAIL',
    revErr ? revErr.message.slice(0, 70) : `معکوس: ${revId}`);
}
