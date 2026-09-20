/* ═══════════════════════════════════════════════════════════════════════════
   نسخه ۸ — واردات صورت‌حساب بانک از اکسل + گردش‌کار طبقه‌بندی تراکنش‌ها
   ─────────────────────────────────────────────────────────────────────────
   ۱) پارس فایل اکسل بانک‌ها (قالب تجارت‌بانک + قالب عمومی) با تشخیص خودکار هدر
   ۲) اعتبارسنجی چندلایه بدون خطا:
      - تطابق تعداد تراکنش با خلاصه دوره
      - تطابق جمع واریز/برداشت با بستانکار/بدهکار خلاصه
      - تطابق مانده ابتدایی/انتهایی
      - زنجیره موجودی (هر گروه سند: مانده قبلی + واریز − برداشت = مانده بعد)
   ۳) تشخیص ردیف تکراری (اثر انگشت) تا آپلود دوباره همان فایل دوبل نزند
   ۴) طبقه‌بندی هر خط: دریافت/پرداخت (سند خزانه) | هزینه | نیاز به سند | صرف‌نظر
   نکته فنی: INSERT در ساپابیس ممکن است به‌دلیل RLS ردیف برنگرداند؛ بنابراین
   بعد از درج، شناسه‌ها با خواندن (که برای کاربر مجاز است) برمی‌گردانیم.
   ═══════════════════════════════════════════════════════════════════════════ */

import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { toEnDigits, toGregorian } from '@/lib/acc/jalali';
import { listBankLines, type AccBankLine } from '@/lib/acc/api7';
import { saveTransaction, saveExpense, deleteExpense, deleteTransaction } from '@/lib/acc/api';
import type { AccBusiness } from '@/lib/acc/types';

/* ───────────────────────── انواع ───────────────────────── */

export interface StatementRow {
  rowIdx: number;          // شماره ردیف در اکسل (برای ردیابی خطا)
  date_g: string;          // ISO
  time: string;            // HH:MM:SS یا ''
  deposit: number;         // واریز (مثبت)
  withdrawal: number;      // برداشت (مثبت)
  amount: number;          // امضادار: deposit − withdrawal
  balance: number | null;  // موجودی پس از تراکنش (اگر در فایل باشد)
  docNo: string;           // شماره سند بانک
  ref: string;             // RRN / کد رهگیری / شناسه پرداخت
  desc: string;            // شرح نهایی (قطعی — برای اثر انگشت تکراری)
  fingerprint: string;     // کلید تشخیص تکرار
  accountNo?: string;      // شماره حساب ردیف (اگر ستون باشد)
  chainIssue?: string;     // توضیح مشکل زنجیره موجودی (پر شدن هنگام اعتبارسنجی)
}

export interface StatementMeta {
  bank: string;                 // tejarat | generic
  accountNo: string | null;     // شماره حساب از خلاصه یا ستون
  count: number | null;         // تعداد تراکنش (خلاصه)
  totalDeposit: number | null;  // بستانکار (خلاصه)
  totalWithdrawal: number | null; // بدهکار (خلاصه)
  opening: number | null;       // مانده ابتدایی دوره
  closing: number | null;       // مانده انتهایی دوره
  customer: string | null;
  fromJalali: string | null;    // از تاریخ اعلامی فایل
}

export interface ParseCheck { label: string; ok: boolean; detail: string; warnOnly?: boolean }

export interface ParseResult {
  meta: StatementMeta;
  rows: StatementRow[];
  checks: ParseCheck[];
  headerRow: number;        // شماره ردیف هدر در اکسل
  colMap: Record<string, number>;
}

/* ───────────────────────── ابزارهای عدد و تاریخ ───────────────────────── */

function parseAmount(v: unknown): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : 0;
  const s = toEnDigits(String(v)).replace(/[,،\s]/g, '').replace(/[^\d.\-]/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function parseTime(v: unknown): string {
  if (v == null || v === '') return '';
  if (typeof v === 'number' && v >= 0 && v < 1) {
    /* کسر زمان اکسل */
    const total = Math.round(v * 86400);
    const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  const s = toEnDigits(String(v).trim());
  return /^\d{1,2}:\d{2}(:\d{2})?$/.test(s) ? (s.split(':').length === 2 ? s + ':00' : s) : '';
}

function excelSerialToISO(n: number): string | null {
  if (!Number.isFinite(n) || n < 20000 || n > 80000) return null;
  const d = new Date(Math.round((n - 25569) * 86400000));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** تاریخ جلالی رشته‌ای (۱۴۰۵/۰۶/۲۵ یا 1405-6-25 یا 14050625) یا سریال اکسل → ISO */
export function parseStatementDate(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return excelSerialToISO(v);
  const s = toEnDigits(String(v).trim()).replace(/\s+/g, '');
  let m = s.match(/^(1[34]\d{2})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (m) {
    const g = toGregorian(Number(m[1]), Number(m[2]), Number(m[3]));
    return `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
  }
  m = s.match(/^(1[34]\d{2})(\d{2})(\d{2})$/);
  if (m) {
    const g = toGregorian(Number(m[1]), Number(m[2]), Number(m[3]));
    return `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; /* ISO مستقیم */
  return null;
}

/* ───────────────────────── پارس فایل ───────────────────────── */

const COL_ALIASES: Record<string, string[]> = {
  date: ['تاریخ', 'تاریخ ارزش', 'تاریخ تراکنش', 'تاریخ ثبت'],
  time: ['زمان', 'ساعت'],
  deposit: ['واریز', 'واریزی', 'بستانکار', 'مبلغ واریز', 'اعتبار'],
  withdrawal: ['برداشت', 'برداتی', 'بدهکار', 'مبلغ برداشت', 'بدهکار (هزینه)'],
  balance: ['موجودی حساب', 'موجودی', 'مانده', 'مانده حساب'],
  desc: ['شرح تراکنش', 'شرح عملیات', 'شرح', 'شرح سند', 'توضیحات'],
  docNo: ['شماره سند', 'سند', 'شماره پیگیری'],
  rrn: ['RRN', 'rrn', 'کد رهگیری', 'شناسه پیگیری'],
  payId: ['شناسه پرداخت اول', 'شناسه پرداخت دوم', 'شناسه پرداخت'],
  accountNo: ['شماره حساب', 'حساب'],
};

function normHeader(h: unknown): string {
  return toEnDigits(String(h ?? '')).replace(/\s+/g, ' ').trim();
}

function mapColumns(header: unknown[]): Record<string, number> {
  const map: Record<string, number> = {};
  header.forEach((raw, i) => {
    const h = normHeader(raw);
    if (!h) return;
    for (const [key, aliases] of Object.entries(COL_ALIASES)) {
      if (map[key] !== undefined) continue;
      if (aliases.some((a) => h === a || h.includes(a))) { map[key] = i; break; }
    }
  });
  /* شرح: اگر فقط «شرح سند» بود و شرح اصلی نبود، خودش گرفته شده — اولویت با ایندکس اول پیدا شده */
  return map;
}

/** خلاصه وضعیت دوره تجارت‌بانک: ردیف هدر خلاصه + ردیف مقادیر زیر آن */
function extractSummary(rows: unknown[][], headerRowIdx: number): Partial<StatementMeta> {
  const meta: Partial<StatementMeta> = {};
  for (let i = 0; i < Math.min(headerRowIdx, rows.length); i++) {
    const r = (rows[i] || []).map(normHeader);
    if (r.some((c) => c.includes('مانده ابتدایی')) && r.some((c) => c.includes('بستانکار') || c.includes('واریز'))) {
      const vals = (rows[i + 1] || []).map((v) => (typeof v === 'number' ? v : parseAmount(v)));
      r.forEach((c, j) => {
        const v = vals[j];
        if (c.includes('مانده انتهایی')) meta.closing = v;
        else if (c.includes('مانده ابتدایی')) meta.opening = v;
        else if (c.includes('بستانکار') || c === 'واریز') meta.totalDeposit = v;
        else if (c.includes('بدهکار') || c === 'برداشت') meta.totalWithdrawal = v;
        else if (c.includes('تعداد')) meta.count = v;
        else if (c.includes('شماره حساب')) meta.accountNo = String(rows[i + 1]?.[j] ?? '') || null;
      });
      /* خط‌های کناری: مشتری/از تاریخ */
      for (let k = 0; k < Math.min(headerRowIdx, rows.length); k++) {
        const rr = rows[k] || [];
        rr.forEach((cell, j) => {
          const cs = normHeader(cell);
          if (cs === 'مشتری:' || cs.includes('مشتری:')) meta.customer = String(rr[j - 1] ?? '').trim() || null;
          if (cs.includes('از تاریخ')) meta.fromJalali = toEnDigits(cs).match(/1[34]\d{2}[/\-.]?\d{1,2}[/\-.]?\d{1,2}/)?.[0] ?? null;
        });
      }
      meta.bank = 'tejarat';
      break;
    }
  }
  return meta;
}

/** زنجیره موجودی: گروه‌بندی بر اساس (سند|زمان|تاریخ) — جفت کارمزد+اصلی یک گروه است */
function validateChain(rows: StatementRow[], meta: StatementMeta): { checks: ParseCheck[]; impliedOpening: number | null } {
  const groups = new Map<string, StatementRow[]>();
  for (const r of rows) {
    const key = `${r.docNo}|${r.time}|${r.date_g}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  /* مرتب‌سازی قدیمی→جدید */
  const sorted = [...groups.values()].sort((a, b) =>
    (a[0].date_g + a[0].time).localeCompare(b[0].date_g + b[0].time));

  let prevAfter: number | null = null;
  let impliedOpening: number | null = null;
  let issueCount = 0;
  for (const g of sorted) {
    const net = g.reduce((s, r) => s + r.amount, 0);
    /* مانده اعلام‌شده گروه = مانده اولین ردیف گروه در فایل (جدیدترین زیرتراکنش) */
    const stated = g.find((r) => r.balance != null)?.balance ?? null;
    for (const r of g) r.chainIssue = undefined;
    if (stated == null) continue;
    const before = stated - net;
    if (impliedOpening === null) impliedOpening = before;
    if (prevAfter !== null && before !== prevAfter) {
      issueCount++;
      const msg = `مانده پس از تراکنش قبلی باید ${prevAfter.toLocaleString('en')} باشد ولی مانده قبل از این ردیف ${before.toLocaleString('en')} است`;
      for (const r of g) if (r.chainIssue === undefined) r.chainIssue = msg;
    }
    prevAfter = stated;
  }

  const sumDep = rows.reduce((s, r) => s + r.deposit, 0);
  const sumWd = rows.reduce((s, r) => s + r.withdrawal, 0);
  const checks: ParseCheck[] = [
    { label: 'خواندن ردیف‌های تراکنش', ok: rows.length > 0, detail: `${rows.length} تراکنش از فایل خوانده شد` },
  ];
  if (meta.count != null) checks.push({ label: 'تطابق تعداد تراکنش با خلاصه دوره', ok: rows.length === meta.count, detail: `فایل: ${meta.count} — خوانده‌شده: ${rows.length}` });
  if (meta.totalDeposit != null) checks.push({ label: 'تطابق جمع واریز با بستانکار خلاصه', ok: sumDep === meta.totalDeposit, detail: `فایل: ${meta.totalDeposit.toLocaleString('en')} — محاسبه: ${sumDep.toLocaleString('en')}` });
  if (meta.totalWithdrawal != null) checks.push({ label: 'تطابق جمع برداشت با بدهکار خلاصه', ok: sumWd === meta.totalWithdrawal, detail: `فایل: ${meta.totalWithdrawal.toLocaleString('en')} — محاسبه: ${sumWd.toLocaleString('en')}` });
  if (meta.opening != null) checks.push({ label: 'تطابق مانده ابتدایی دوره', ok: impliedOpening !== null && Math.abs(impliedOpening - meta.opening) < 2, detail: impliedOpening === null ? 'امکان محاسبه نبود' : `فایل: ${meta.opening.toLocaleString('en')} — محاسبه از زنجیره: ${impliedOpening.toLocaleString('en')}` });
  if (meta.closing != null && prevAfter !== null) checks.push({ label: 'تطابق مانده انتهایی دوره', ok: Math.abs(prevAfter - meta.closing) < 2, detail: `فایل: ${meta.closing.toLocaleString('en')} — آخرین مانده زنجیره: ${prevAfter.toLocaleString('en')}` });
  checks.push({ label: 'پیوستگی زنجیره موجودی (بدون ردیف جاافتاده)', ok: issueCount === 0, detail: issueCount === 0 ? 'همه مانده‌ها پیوسته و صحیح‌اند' : `${issueCount} نقطه ناپیوستگی پیدا شد — ردیف‌های علامت‌دار را بررسی کنید`, warnOnly: true });
  return { checks, impliedOpening };
}

/** پارس کامل فایل اکسل/CSV صورت‌حساب بانک */
export async function parseBankStatement(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });

  /* یافتن هدر: ردیفی که هم ستون مبلغ (واریز/برداشت) هم تاریخ دارد */
  let headerRow = -1;
  let colMap: Record<string, number> = {};
  for (let i = 0; i < Math.min(rows.length, 60); i++) {
    const cells = (rows[i] || []).map(normHeader);
    const hasAmount = cells.some((c) => COL_ALIASES.deposit.some((a) => c === a || c.includes(a))) && cells.some((c) => COL_ALIASES.withdrawal.some((a) => c === a || c.includes(a)));
    const hasDate = cells.some((c) => COL_ALIASES.date.some((a) => c === a || c.includes(a)));
    if (hasAmount && hasDate) { headerRow = i; colMap = mapColumns(rows[i] || []); break; }
  }
  if (headerRow < 0 || colMap.date === undefined || (colMap.deposit === undefined && colMap.withdrawal === undefined)) {
    throw new Error('ساختار فایل شناخته نشد — ستون‌های «تاریخ» و «واریز/برداشت» پیدا نشد. این قالب فقط برای خروجی اکسل بانک‌ها (تجارت، ملت، ...) است.');
  }

  const meta: StatementMeta = {
    bank: 'generic', accountNo: null, count: null, totalDeposit: null, totalWithdrawal: null,
    opening: null, closing: null, customer: null, fromJalali: null,
    ...extractSummary(rows, headerRow),
  };

  const out: StatementRow[] = [];
  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const dateG = parseStatementDate(r[colMap.date]);
    if (!dateG) continue; /* ردیف‌های متادیتا/تهیه بدون تاریخ */
    const deposit = colMap.deposit !== undefined ? parseAmount(r[colMap.deposit]) : 0;
    const withdrawal = colMap.withdrawal !== undefined ? parseAmount(r[colMap.withdrawal]) : 0;
    if (deposit === 0 && withdrawal === 0) continue; /* ردیف بدون مبلغ */
    const time = colMap.time !== undefined ? parseTime(r[colMap.time]) : '';
    const balance = colMap.balance !== undefined && r[colMap.balance] != null && r[colMap.balance] !== '' ? parseAmount(r[colMap.balance]) : null;
    const docNo = colMap.docNo !== undefined ? toEnDigits(String(r[colMap.docNo] ?? '')).trim() : '';
    const ref = [colMap.rrn, colMap.payId].map((c) => (c !== undefined ? toEnDigits(String(r[c] ?? '')).trim() : '')).filter(Boolean).find((s) => s && s !== '۰' && s !== '0') || '';
    const descParts = (colMap.desc !== undefined ? [String(r[colMap.desc] ?? '').trim()] : []).filter(Boolean);
    const desc = descParts.join(' — ').replace(/\s+/g, ' ').slice(0, 300) || 'تراکنش بانکی';
    const accountNo = colMap.accountNo !== undefined ? toEnDigits(String(r[colMap.accountNo] ?? '')).trim() : '';

    const signed = deposit - withdrawal;
    const descFull = (time ? `[${time}] ` : '') + desc + (docNo && docNo !== '0' ? ` (سند ${docNo})` : '') + (ref ? ` [${ref}]` : '');
    out.push({
      rowIdx: i + 1, date_g: dateG, time, deposit, withdrawal, amount: signed, balance,
      docNo: docNo !== '0' ? docNo : '', ref,
      desc: descFull,
      fingerprint: `${dateG}|${signed}|${docNo !== '0' ? docNo : ''}|${ref}|${desc}`,
      accountNo,
    });
  }
  if (!out.length) throw new Error('هیچ ردیف تراکنشی با تاریخ و مبلغ معتبر در فایل پیدا نشد');
  if (meta.accountNo == null) {
    const fromCol = out.find((r) => r.accountNo)?.accountNo;
    if (fromCol) meta.accountNo = fromCol;
  }

  const { checks, impliedOpening } = validateChain(out, meta);
  return { meta, rows: out, checks, headerRow: headerRow + 1, colMap };
}

/* ───────────────────────── واردات به سیستم ───────────────────────── */

export interface ImportOutcome { inserted: number; duplicates: number; batchId: string }

/** درج ردیف‌های جدید با تشخیص تکرار — بازگشت شناسه‌ها با خواندن batch (مقاوم به RLS) */
export async function importStatement(
  businessId: string, accountId: string, parsed: ParseResult,
): Promise<ImportOutcome> {
  const existing = await listBankLines(businessId, accountId);
  const seen = new Set((existing || []).map((l) => `${l.date_g}|${l.amount}|${l.ref_no || ''}|${l.description || ''}`));
  const fresh = parsed.rows.filter((r) => !seen.has(r.fingerprint));
  if (!fresh.length) return { inserted: 0, duplicates: parsed.rows.length, batchId: '' };

  const batchId = crypto.randomUUID();
  const payload = fresh.map((r) => ({
    business_id: businessId, account_id: accountId,
    date_g: r.date_g, description: r.desc, ref_no: (r.docNo || r.ref || null),
    amount: r.amount, match_status: 'unmatched', batch_id: batchId,
  }));
  const CHUNK = 200;
  for (let i = 0; i < payload.length; i += CHUNK) {
    const { error } = await supabase.from('acc_bank_lines').insert(payload.slice(i, i + CHUNK));
    if (error) throw error;
  }
  return { inserted: payload.length, duplicates: parsed.rows.length - fresh.length, batchId };
}

/* ───────────────────────── طبقه‌بندی خطوط ───────────────────────── */

export type ClassifyAction = 'receipt' | 'payment' | 'expense' | 'needs_doc' | 'ignore';

export interface ClassifyOptions { category?: string; title?: string; partnerId?: string | null }

/** طبقه‌بندی یک خط صورت‌حساب بانک — سند خزانه یا هزینه می‌سازد و خط را قفل می‌کند
 *  شناسهٔ سند ساخته‌شده مستقیماً از خود درج برمی‌گردد (fetchBackId حذف شد — جست‌وجوی مجدد
 *  بر اساس مبلغ/تاریخ در درج هم‌زمان می‌توانست خط را به سند اشتباه وصل کند) */
export async function classifyBankLine(
  business: AccBusiness, line: AccBankLine, action: ClassifyAction, opts: ClassifyOptions = {},
): Promise<void> {
  /* idempotency: خطِ قبلاً طبقه‌بندی‌شده دوباره سند نمی‌سازد (دوبل ممنوع) */
  if (action !== 'needs_doc' && action !== 'ignore' && line.match_entity_id && line.match_status === 'manual') {
    return;
  }
  const abs = Math.abs(line.amount);
  if (action === 'receipt' || action === 'payment') {
    const txId = await saveTransaction(business.id, {
      kind: action, amount: abs, date_g: line.date_g, method: 'transfer',
      account_id: line.account_id, partner_id: opts.partnerId || null,
      description: line.description || line.ref_no || 'تراکنش بانکی',
    });
    const { error } = await supabase.from('acc_bank_lines').update({
      match_status: 'manual', match_entity_type: 'transaction', match_entity_id: txId,
      matched_at: new Date().toISOString(),
    }).eq('id', line.id);
    if (error) throw error;
    return;
  }
  if (action === 'expense') {
    const exId = await saveExpense(business.id, {
      category: opts.category || 'اداری و عمومی',
      title: (opts.title || line.description || 'هزینه بانکی').slice(0, 120),
      amount: abs, vat_amount: 0, date_g: line.date_g, account_id: line.account_id,
      partner_id: opts.partnerId || null, is_paid: true, tax_status: 'incomplete',
      description: line.description || null,
    });
    const { error } = await supabase.from('acc_bank_lines').update({
      match_status: 'manual', match_entity_type: 'expense', match_entity_id: exId,
      matched_at: new Date().toISOString(),
    }).eq('id', line.id);
    if (error) throw error;
    return;
  }
  if (action === 'needs_doc') {
    const { error } = await supabase.from('acc_bank_lines').update({
      match_status: 'needs_doc', match_entity_type: null, match_entity_id: null, matched_at: null,
    }).eq('id', line.id);
    if (error) throw error;
    return;
  }
  /* ignore */
  const { error } = await supabase.from('acc_bank_lines').update({
    match_status: 'ignored', match_entity_type: null, match_entity_id: null, matched_at: null,
  }).eq('id', line.id);
  if (error) throw error;
}

/** بازگشت خط به حالت جدید — سند/هزینه ساخته‌شده مرتبط حذف می‌شود (تا دوبل نشود) */
export async function revertBankLine(businessId: string, line: AccBankLine): Promise<void> {
  if (line.match_entity_type === 'transaction' && line.match_entity_id) {
    await deleteTransaction({ id: line.match_entity_id, invoice_id: null });
  } else if (line.match_entity_type === 'expense' && line.match_entity_id) {
    await deleteExpense(line.match_entity_id);
  }
  const { error } = await supabase.from('acc_bank_lines').update({
    match_status: 'unmatched', match_entity_type: null, match_entity_id: null, matched_at: null,
  }).eq('id', line.id);
  if (error) throw error;
}

/** خلاصه وضعیت طبقه‌بندی یک دسته واردات */
export function summarizeLines(lines: AccBankLine[]): { state: string; count: number; total: number }[] {
  const by = (s: string) => lines.filter((l) => l.match_status === s);
  return [
    { state: 'unmatched', count: by('unmatched').length, total: by('unmatched').reduce((s, l) => s + l.amount, 0) },
    { state: 'needs_doc', count: by('needs_doc').length, total: by('needs_doc').reduce((s, l) => s + l.amount, 0) },
    { state: 'manual', count: by('manual').length, total: by('manual').reduce((s, l) => s + l.amount, 0) },
    { state: 'ignored', count: by('ignored').length, total: by('ignored').reduce((s, l) => s + l.amount, 0) },
  ];
}

export type { AccBankLine };
