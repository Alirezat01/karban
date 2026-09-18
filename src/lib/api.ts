/* لایه داده ماژول حسابداری — همه کوئری‌ها از همین فایل */

import { supabase } from '@/lib/supabase';
import type {
  AccAccount, AccBusiness, AccChartRow, AccExpense, AccInvoice,
  AccJournalEntry, AccPartner, AccItem, AccTransaction, InvoiceType, ProfitAndLoss,
  TrialBalanceRow, VatReport, PlRow, InvoiceStatus, AccStuffCatalogRow,
  AccCheck, CheckKind, CheckStatus, PartnerStatement,
  AccExpenseCategory, AccJournalLine, ProductProfitRow,
} from './types';
import { SYSTEM_CHART } from './constants';
import { jalaliMonthLength, toGregorian, todayJalali, dateToISO } from './jalali';
import { roundVat } from './money';

/* ═══════════════════════ محاسبات فاکتور ═══════════════════════ */

export interface DraftItem {
  item_id: string | null;
  stuff_id?: string | null;
  title: string;
  unit: string;
  quantity: number;
  unit_price: number;
  discount: number;
  vat_rate: number;
}

export function computeInvoiceTotals(items: DraftItem[]) {
  let subtotal = 0;
  let discountTotal = 0;
  let vatTotal = 0;
  for (const it of items) {
    const base = Math.round(it.quantity * it.unit_price) - (it.discount || 0);
    subtotal += Math.round(it.quantity * it.unit_price);
    discountTotal += it.discount || 0;
    vatTotal += roundVat(base, it.vat_rate);
  }
  return { subtotal, discountTotal, vatTotal, total: subtotal - discountTotal + vatTotal };
}

/* ═══════════════════════ کسب‌وکار و لایسنس ═══════════════════════ */

export async function fetchMyAccess() {
  const { data, error } = await supabase
    .from('acc_access')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as import('./types').AccAccess[];
}

export async function fetchMyBusinesses() {
  const { data, error } = await supabase
    .from('acc_businesses')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as AccBusiness[];
}

export async function createBusiness(input: Partial<AccBusiness> & { contact_name?: string; contact_phone?: string }) {
  const { data, error } = await supabase.rpc('acc_create_business', { p_form: input as unknown as Record<string, unknown> });
  if (error) throw error;
  const { data: biz, error: bizErr } = await supabase
    .from('acc_businesses')
    .select('*')
    .eq('id', data as string)
    .single();
  if (bizErr) throw bizErr;
  return biz as AccBusiness;
}

/* شروع خودکار نسخه آزمایشی ۱۴ روزه — یک‌بار برای هر کاربر، بدون تایید ادمین */
export async function startTrial(input: Partial<AccBusiness> & { contact_name?: string; contact_phone?: string }) {
  const { data, error } = await supabase.rpc('acc_start_trial', { p_form: input as unknown as Record<string, unknown> });
  if (error) throw error;
  const { data: biz, error: bizErr } = await supabase
    .from('acc_businesses')
    .select('*')
    .eq('id', data as string)
    .single();
  if (bizErr) throw bizErr;
  return biz as AccBusiness;
}

export async function updateBusiness(id: string, patch: Partial<AccBusiness>) {
  const { error } = await supabase.from('acc_businesses').update(patch).eq('id', id);
  if (error) throw error;
}

export async function submitTrialRequest(input: { name?: string; phone?: string; email?: string; business_name?: string; message?: string; plan?: string }) {
  const { data: user } = await supabase.auth.getUser();
  const { error } = await supabase.from('acc_trial_requests').insert({ ...input, user_id: user.user?.id ?? null });
  if (error) throw error;
  try {
    const { notifyTelegram } = await import('./telegram');
    void notifyTelegram(
      `✨ درخواست تریال/تماس حسابداری کاربان\nنام: ${input.name || '—'}\nتماس: ${input.phone || input.email || '—'}\nکسب‌وکار: ${input.business_name || '—'}`,
      'trial',
    );
  } catch {
    /* اعلان هرگز جریان اصلی را نمی‌شکند */
  }
}

/* ═══════════════════════ طرف‌حساب‌ها ═══════════════════════ */

export async function listPartners(businessId: string) {
  const { data, error } = await supabase
    .from('acc_partners')
    .select('*')
    .eq('business_id', businessId)
    .order('name');
  if (error) throw error;
  return (data || []) as AccPartner[];
}

/**
 * درج/به‌روزرسانی مقاوم در برابر ناهم‌خوانی اسکیمای دیتابیس.
 * اگر دیتابیس ستونی را که ارسال شده نداشته باشد (PGRST204)، آن ستون کنار گذاشته
 * می‌شود و دوباره تلاش می‌کنیم — تا ذخیره هرگز به‌خاطر یک ستون جامان بشکند.
 */
async function mutateSafe(
  table: string,
  row: Record<string, unknown>,
  run: (cleanRow: Record<string, unknown>) => Promise<{ error: { message: string } | null }>,
): Promise<void> {
  let clean = { ...row };
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { error } = await run(clean);
    if (!error) return;
    const m = error.message || '';
    const hit = m.match(/Could not find the '([^']+)' column/) || m.match(/column ["']?([\w.]+)["']? does not exist/i);
    const col = hit ? (hit[1].split('.').pop() as string) : null;
    if (col && col in clean) {
      delete clean[col];
      continue; // ستون جامان را کنار بگذار و دوباره تلاش کن
    }
    throw error;
  }
}

export async function savePartner(businessId: string, row: Partial<AccPartner>) {
  if (row.id) {
    await mutateSafe('acc_partners', row as Record<string, unknown>, (clean) =>
      supabase.from('acc_partners').update(clean).eq('id', row.id!),
    );
    return row.id;
  }
  let savedId = '';
  await mutateSafe('acc_partners', { ...row, business_id: businessId } as Record<string, unknown>, async (clean) => {
    const { data, error } = await supabase.from('acc_partners').insert(clean).select('id').single();
    if (!error && data) savedId = data.id as string;
    return { error };
  });
  return savedId;
}

export async function deletePartner(id: string) {
  const { error } = await supabase.from('acc_partners').delete().eq('id', id);
  if (error) throw error;
}

/* ═══════════════════════ کالا و خدمات ═══════════════════════ */

export async function listItems(businessId: string) {
  const { data, error } = await supabase
    .from('acc_items')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as AccItem[];
}

export async function saveItem(businessId: string, row: Partial<AccItem>) {
  if (row.id) {
    const { error } = await supabase.from('acc_items').update(row).eq('id', row.id);
    if (error) throw error;
    return row.id;
  }
  const { data, error } = await supabase
    .from('acc_items')
    .insert({ ...row, business_id: businessId })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteItem(id: string) {
  const { error } = await supabase.from('acc_items').delete().eq('id', id);
  if (error) throw error;
}

/* ═══════════════════════ حساب‌های بانک/صندوق ═══════════════════════ */

export async function listAccounts(businessId: string) {
  const { data, error } = await supabase
    .from('acc_accounts')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at');
  if (error) throw error;
  const accounts = (data || []) as AccAccount[];
  // مانده هر حساب = مانده اولیه + دریافت‌ها − پرداخت‌ها
  const { data: txs, error: txErr } = await supabase
    .from('acc_transactions')
    .select('account_id, kind, amount')
    .eq('business_id', businessId);
  if (txErr) throw txErr;
  const balances = new Map<string, number>();
  for (const a of accounts) balances.set(a.id, a.initial_balance || 0);
  for (const t of txs || []) {
    if (!t.account_id) continue;
    const cur = balances.get(t.account_id) || 0;
    balances.set(t.account_id, cur + (t.kind === 'receipt' ? t.amount : -t.amount));
  }
  return accounts.map((a) => ({ ...a, balance: balances.get(a.id) || 0 }));
}

export async function saveAccount(businessId: string, row: Partial<AccAccount>) {
  if (row.id) {
    const { error } = await supabase.from('acc_accounts').update(row).eq('id', row.id);
    if (error) throw error;
    return row.id;
  }
  const { data, error } = await supabase
    .from('acc_accounts')
    .insert({ ...row, business_id: businessId })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteAccount(id: string) {
  const { error } = await supabase.from('acc_accounts').delete().eq('id', id);
  if (error) throw error;
}

/* ═══════════════════════ صورتحساب‌ها ═══════════════════════ */

export async function nextInvoiceNumber(businessId: string, type: InvoiceType): Promise<string> {
  const jy = todayJalali().jy;
  const { count, error } = await supabase
    .from('acc_invoices')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('type', type)
    .like('number', `${jy}-%`);
  if (error) throw error;
  const seq = (count || 0) + 1;
  return `${jy}-${String(seq).padStart(3, '0')}`;
}

export async function listInvoices(businessId: string, opts: { type?: InvoiceType; from?: string; to?: string } = {}) {
  let q = supabase
    .from('acc_invoices')
    .select('*, partner:acc_partners(id, name, national_id, economic_code, person_type, postal_code, address)')
    .eq('business_id', businessId)
    .order('date_g', { ascending: false })
    .order('created_at', { ascending: false });
  if (opts.type) q = q.eq('type', opts.type);
  if (opts.from) q = q.gte('date_g', opts.from);
  if (opts.to) q = q.lte('date_g', opts.to);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as AccInvoice[];
}

export async function getInvoice(id: string) {
  const { data, error } = await supabase
    .from('acc_invoices')
    .select('*, partner:acc_partners(*), account:acc_accounts(id, name, kind), acc_invoice_items(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const inv = data as AccInvoice;
  inv.acc_invoice_items = (inv.acc_invoice_items || []).sort((a, b) => a.position - b.position);
  return inv;
}

export interface InvoicePayload {
  id?: string;
  number: string;
  type: InvoiceType;
  status: InvoiceStatus;
  partner_id: string | null;
  date_g: string;
  due_date_g: string | null;
  description: string | null;
  payment_terms: string | null;
  is_cash_sale: boolean | null;
  /** نوع خریدار مودیان (نوع ۱ بنگاه / نوع ۲ مصرف‌کننده نهایی) */
  buyer_type?: 'business' | 'final' | null;
  /** شناسه یکتای پرداخت مودیان */
  pay_id?: string | null;
  /** حساب بانکی/صندوق مرتبط با تسویه */
  account_id?: string | null;
  items: DraftItem[];
}

export async function saveInvoice(businessId: string, payload: InvoicePayload) {
  const totals = computeInvoiceTotals(payload.items);
  const row = {
    number: payload.number,
    type: payload.type,
    status: payload.status,
    partner_id: payload.partner_id,
    date_g: payload.date_g,
    due_date_g: payload.due_date_g,
    description: payload.description,
    payment_terms: payload.payment_terms,
    is_cash_sale: payload.is_cash_sale ?? true,
    buyer_type: payload.buyer_type ?? 'business',
    pay_id: payload.pay_id ?? null,
    account_id: payload.account_id ?? null,
    subtotal: totals.subtotal,
    discount_total: totals.discountTotal,
    vat_total: totals.vatTotal,
    total: totals.total,
  };

  let invoiceId = payload.id;
  if (invoiceId) {
    const { error } = await supabase.from('acc_invoices').update(row).eq('id', invoiceId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from('acc_invoices')
      .insert({ ...row, business_id: businessId })
      .select('id')
      .single();
    if (error) throw error;
    invoiceId = data.id as string;
  }

  // بازنویسی ردیف‌ها (فقط برای پیش‌نویس — تریگر دیتابیس صادره‌شده‌ها را قفل می‌کند)
  const { error: delErr } = await supabase.from('acc_invoice_items').delete().eq('invoice_id', invoiceId);
  if (delErr) throw delErr;
  if (payload.items.length) {
    const rows = payload.items.map((it, i) => {
      const base = Math.round(it.quantity * it.unit_price) - (it.discount || 0);
      return {
        invoice_id: invoiceId,
        business_id: businessId,
        item_id: it.item_id,
        stuff_id: it.stuff_id ?? null,
        title: it.title,
        unit: it.unit,
        quantity: it.quantity,
        unit_price: it.unit_price,
        discount: it.discount || 0,
        vat_rate: it.vat_rate,
        vat_amount: roundVat(base, it.vat_rate),
        row_total: base + roundVat(base, it.vat_rate),
        position: i,
      };
    });
    const { error: insErr } = await supabase.from('acc_invoice_items').insert(rows);
    if (insErr) throw insErr;
  }
  return invoiceId;
}

export async function setInvoiceStatus(invoiceId: string, status: InvoiceStatus) {
  const { error } = await supabase.from('acc_invoices').update({ status }).eq('id', invoiceId);
  if (error) throw error;
}

export async function issueInvoice(invoiceId: string) {
  await setInvoiceStatus(invoiceId, 'issued');
  await adjustStockForInvoice(invoiceId, -1);
}

export async function cancelInvoice(invoiceId: string) {
  await adjustStockForInvoice(invoiceId, +1);
  await setInvoiceStatus(invoiceId, 'cancelled');
}

/** کسر/بازگرداندن موجودی کالا هنگام صدور و ابطال */
export async function adjustStockForInvoice(invoiceId: string, sign: 1 | -1) {
  const inv = await getInvoice(invoiceId);
  if (!inv || inv.type !== 'sale') return;
  for (const line of inv.acc_invoice_items || []) {
    if (!line.item_id) continue;
    const { data: item } = await supabase
      .from('acc_items')
      .select('track_stock, stock')
      .eq('id', line.item_id)
      .maybeSingle();
    if (!item || !item.track_stock) continue;
    const delta = sign < 0 ? Number(line.quantity) : -Number(line.quantity);
    await supabase
      .from('acc_items')
      .update({ stock: Number(item.stock || 0) + delta })
      .eq('id', line.item_id);
  }
}

export async function deleteDraftInvoice(invoiceId: string) {
  const { error } = await supabase.from('acc_invoices').delete().eq('id', invoiceId);
  if (error) throw error;
}

/** محاسبه مجدد مبلغ تسویه‌شده فاکتور بر اساس دریافت/پرداخت‌های مرتبط */
export async function recomputeInvoicePaid(invoiceId: string) {
  const { data: inv } = await supabase
    .from('acc_invoices')
    .select('total, type, status')
    .eq('id', invoiceId)
    .maybeSingle();
  if (!inv) return;
  if (inv.status === 'draft' || inv.status === 'cancelled') return;
  const wantKind = inv.type === 'purchase' ? 'payment' : 'receipt';
  const { data: txs } = await supabase
    .from('acc_transactions')
    .select('kind, amount')
    .eq('invoice_id', invoiceId);
  const paid = (txs || []).filter((t) => t.kind === wantKind).reduce((s, t) => s + (t.amount || 0), 0);
  const status: InvoiceStatus = paid <= 0 ? 'issued' : paid >= (inv.total || 0) ? 'paid' : 'partial';
  await supabase.from('acc_invoices').update({ paid_total: paid, status }).eq('id', invoiceId);
}

/* ═══════════════════════ هزینه‌ها ═══════════════════════ */

export async function listExpenses(businessId: string, from?: string, to?: string) {
  let q = supabase
    .from('acc_expenses')
    .select('*, account:acc_accounts(id, name, kind)')
    .eq('business_id', businessId)
    .order('date_g', { ascending: false })
    .order('created_at', { ascending: false });
  if (from) q = q.gte('date_g', from);
  if (to) q = q.lte('date_g', to);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as AccExpense[];
}

export async function saveExpense(businessId: string, row: Partial<AccExpense>) {
  const payload = {
    category: row.category || 'اداری و عمومی',
    title: row.title,
    amount: row.amount || 0,
    vat_amount: row.vat_amount || 0,
    date_g: row.date_g,
    account_id: row.account_id,
    partner_id: row.partner_id,
    is_paid: row.is_paid ?? true,
    description: row.description,
    vendor_name: row.vendor_name ?? null,
    receipt_no: row.receipt_no ?? null,
    receipt_url: row.receipt_url ?? null,
    tax_status: row.tax_status || 'incomplete',
    tax_note: row.tax_note ?? null,
  };
  if (row.id) {
    const { error } = await supabase.from('acc_expenses').update(payload).eq('id', row.id);
    if (error) throw error;
    return row.id;
  }
  const { data, error } = await supabase
    .from('acc_expenses')
    .insert({ ...payload, business_id: businessId })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteExpense(id: string) {
  const { error } = await supabase.from('acc_expenses').delete().eq('id', id);
  if (error) throw error;
}

/* ═══════════════════════ دریافت / پرداخت ═══════════════════════ */

export async function listTransactions(businessId: string, opts: { kind?: 'receipt' | 'payment'; from?: string; to?: string } = {}) {
  let q = supabase
    .from('acc_transactions')
    .select('*, account:acc_accounts(id, name, kind), partner:acc_partners(id, name), invoice:acc_invoices(id, number, type)')
    .eq('business_id', businessId)
    .order('date_g', { ascending: false })
    .order('created_at', { ascending: false });
  if (opts.kind) q = q.eq('kind', opts.kind);
  if (opts.from) q = q.gte('date_g', opts.from);
  if (opts.to) q = q.lte('date_g', opts.to);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as AccTransaction[];
}

export async function saveTransaction(businessId: string, row: Partial<AccTransaction> & { kind: 'receipt' | 'payment'; amount: number }) {
  const payload = {
    kind: row.kind,
    amount: row.amount,
    date_g: row.date_g,
    method: row.method || 'transfer',
    account_id: row.account_id,
    invoice_id: row.invoice_id,
    partner_id: row.partner_id,
    description: row.description,
  };
  let id = row.id;
  if (id) {
    const { error } = await supabase.from('acc_transactions').update(payload).eq('id', id);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from('acc_transactions')
      .insert({ ...payload, business_id: businessId })
      .select('id')
      .single();
    if (error) throw error;
    id = data.id as string;
  }
  if (payload.invoice_id) await recomputeInvoicePaid(payload.invoice_id);
  return id;
}

export async function deleteTransaction(row: Pick<AccTransaction, 'id' | 'invoice_id'>) {
  const { error } = await supabase.from('acc_transactions').delete().eq('id', row.id);
  if (error) throw error;
  if (row.invoice_id) await recomputeInvoicePaid(row.invoice_id);
}

/* ═══════════════════════ دفترخانه ═══════════════════════ */

export async function listJournal(businessId: string, from?: string, to?: string) {
  let q = supabase
    .from('acc_journal')
    .select('*, acc_journal_lines(*)')
    .eq('business_id', businessId)
    .order('date_g', { ascending: false })
    .order('entry_no', { ascending: false });
  if (from) q = q.gte('date_g', from);
  if (to) q = q.lte('date_g', to);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as AccJournalEntry[];
}

export async function listChart(businessId: string) {
  const { data, error } = await supabase
    .from('acc_chart')
    .select('*')
    .or(`business_id.is.null,business_id.eq.${businessId}`)
    .order('code');
  if (error) throw error;
  return (data || []) as AccChartRow[];
}

/* ═══════════════════════ گزارش‌ها ═══════════════════════ */

interface RawLine { account_code: string; account_title: string; debit: number; credit: number }

async function fetchLinesInRange(businessId: string, from?: string, to?: string): Promise<RawLine[]> {
  let q = supabase
    .from('acc_journal_lines')
    .select('account_code, account_title, debit, credit, acc_journal!inner(date_g)')
    .eq('business_id', businessId);
  if (from) q = q.gte('acc_journal.date_g', from);
  if (to) q = q.lte('acc_journal.date_g', to);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as unknown as RawLine[];
}

const chartKind = (code: string): AccChartRow['kind'] =>
  SYSTEM_CHART.find((c) => c.code === code)?.kind || (code.startsWith('4') ? 'income' : code.startsWith('5') ? 'expense' : 'asset');

export async function trialBalance(businessId: string, from?: string, to?: string): Promise<TrialBalanceRow[]> {
  const lines = await fetchLinesInRange(businessId, from, to);
  const map = new Map<string, { title: string; debit: number; credit: number }>();
  for (const l of lines) {
    const cur = map.get(l.account_code) || { title: l.account_title, debit: 0, credit: 0 };
    cur.debit += l.debit || 0;
    cur.credit += l.credit || 0;
    map.set(l.account_code, cur);
  }
  const rows: TrialBalanceRow[] = [];
  for (const [code, v] of [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const kind = chartKind(code);
    const debitLike = kind === 'asset' || kind === 'expense';
    const balance = debitLike ? v.debit - v.credit : v.credit - v.debit;
    rows.push({ code, title: v.title, kind, debit: v.debit, credit: v.credit, balance });
  }
  return rows;
}

export async function profitAndLoss(businessId: string, from: string, to: string): Promise<ProfitAndLoss> {
  const lines = await fetchLinesInRange(businessId, from, to);
  const revMap = new Map<string, number>();
  const expMap = new Map<string, number>();
  for (const l of lines) {
    const kind = chartKind(l.account_code);
    if (kind === 'income') {
      revMap.set(l.account_code, (revMap.get(l.account_code) || 0) + (l.credit - l.debit));
    } else if (kind === 'expense') {
      expMap.set(l.account_code, (expMap.get(l.account_code) || 0) + (l.debit - l.credit));
    }
  }
  const title = (code: string) => SYSTEM_CHART.find((c) => c.code === code)?.title || code;
  const revenues: PlRow[] = [...revMap.entries()].filter(([, v]) => v !== 0).map(([code, v]) => ({ code, title: title(code), amount: v }));
  const expenses: PlRow[] = [...expMap.entries()].filter(([, v]) => v !== 0).map(([code, v]) => ({ code, title: title(code), amount: v }));
  const totalRevenue = revenues.reduce((s, r) => s + r.amount, 0);
  const totalExpense = expenses.reduce((s, r) => s + r.amount, 0);
  return { revenues, totalRevenue, expenses, totalExpense, netProfit: totalRevenue - totalExpense };
}

export async function vatReport(businessId: string, from: string, to: string): Promise<VatReport> {
  const invoices = await listInvoices(businessId, { from, to });
  const partners = await listPartners(businessId);
  const partnerName = (id: string | null) => partners.find((p) => p.id === id)?.name || '—';
  const sales = invoices.filter((i) => i.type === 'sale' && i.status === 'issued');
  const purchases = invoices.filter((i) => i.type === 'purchase' && i.status === 'issued');
  const { data: exps } = await supabase
    .from('acc_expenses')
    .select('vat_amount')
    .eq('business_id', businessId)
    .eq('is_paid', true)
    .gte('date_g', from)
    .lte('date_g', to);
  const expensesVat = (exps || []).reduce((s, e) => s + (e.vat_amount || 0), 0);
  const salesBase = sales.reduce((s, i) => s + (i.subtotal - i.discount_total), 0);
  const salesVat = sales.reduce((s, i) => s + i.vat_total, 0);
  const purchasesBase = purchases.reduce((s, i) => s + (i.subtotal - i.discount_total), 0);
  const purchasesVat = purchases.reduce((s, i) => s + i.vat_total, 0);
  return {
    salesBase,
    salesVat,
    purchasesBase,
    purchasesVat,
    expensesVat,
    totalCredit: purchasesVat + expensesVat,
    payable: Math.max(0, salesVat - purchasesVat - expensesVat),
    saleRows: sales.map((i) => ({ number: i.number, date: i.date_g, partner: partnerName(i.partner_id), base: i.subtotal - i.discount_total, vat: i.vat_total })),
    purchaseRows: purchases.map((i) => ({ number: i.number, date: i.date_g, partner: partnerName(i.partner_id), base: i.subtotal - i.discount_total, vat: i.vat_total })),
  };
}

export interface SeasonalRow {
  date: string;
  number: string;
  partner: string;
  personType: string;
  nationalId: string;
  economicCode: string;
  postalCode: string;
  total: number;
  vat: number;
}

/** فهرست معاملات فصلی (ماده ۱۶۹ ق.م.م) — فروش و خرید با مشخصات کامل طرف‌حساب */
export async function seasonalReport(businessId: string, from: string, to: string): Promise<{ sales: SeasonalRow[]; purchases: SeasonalRow[] }> {
  const invoices = await listInvoices(businessId, { from, to });
  const mapRow = (i: AccInvoice): SeasonalRow => ({
    date: i.date_g,
    number: i.number,
    partner: i.partner?.name || '—',
    personType: i.partner?.person_type || 'real',
    nationalId: i.partner?.national_id || '',
    economicCode: i.partner?.economic_code || '',
    postalCode: i.partner?.postal_code || '',
    total: i.total,
    vat: i.vat_total,
  });
  return {
    sales: invoices.filter((i) => i.type === 'sale' && i.status === 'issued').map(mapRow),
    purchases: invoices.filter((i) => i.type === 'purchase' && i.status === 'issued').map(mapRow),
  };
}

export async function salesByPartner(businessId: string, from: string, to: string) {
  const invoices = await listInvoices(businessId, { type: 'sale', from, to });
  const map = new Map<string, { name: string; count: number; total: number }>();
  for (const i of invoices) {
    if (i.status === 'cancelled' || i.status === 'draft') continue;
    const key = i.partner_id || '—';
    const cur = map.get(key) || { name: i.partner?.name || 'متفرقه', count: 0, total: 0 };
    cur.count += 1;
    cur.total += i.total;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export async function salesByItem(businessId: string, from: string, to: string) {
  const { data, error } = await supabase
    .from('acc_invoice_items')
    .select('title, quantity, row_total, acc_invoices!inner(type, status, date_g, business_id)')
    .eq('acc_invoices.business_id', businessId)
    .eq('acc_invoices.type', 'sale')
    .eq('acc_invoices.status', 'issued')
    .gte('acc_invoices.date_g', from)
    .lte('acc_invoices.date_g', to);
  if (error) throw error;
  const map = new Map<string, { title: string; qty: number; total: number }>();
  for (const r of (data || []) as unknown as { title: string; quantity: number; row_total: number }[]) {
    const cur = map.get(r.title) || { title: r.title, qty: 0, total: 0 };
    cur.qty += Number(r.quantity);
    cur.total += Number(r.row_total);
    map.set(r.title, cur);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

/** مجموع ۶ ماه اخیر فروش صادره — برای نمودار داشبورد */
export async function salesSeries6Months(businessId: string): Promise<{ label: string; total: number }[]> {
  const t = todayJalali();
  const froms: string[] = [];
  const labels: string[] = [];
  const spans: { from: string; to: string }[] = [];
  for (let back = 5; back >= 0; back -= 1) {
    let jm = t.jm - back;
    let jy = t.jy;
    while (jm <= 0) { jm += 12; jy -= 1; }
    const gF = toGregorian(jy, jm, 1);
    const gT = toGregorian(jy, jm, jalaliMonthLength(jy, jm));
    spans.push({ from: dateToISO(new Date(gF.gy, gF.gm - 1, gF.gd)), to: dateToISO(new Date(gT.gy, gT.gm - 1, gT.gd)) });
    froms.push(spans[spans.length - 1].from);
    labels.push(['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'][jm - 1]);
  }
  const { data, error } = await supabase
    .from('acc_invoices')
    .select('date_g, total')
    .eq('business_id', businessId)
    .eq('type', 'sale')
    .eq('status', 'issued')
    .gte('date_g', spans[0].from);
  if (error) throw error;
  return spans.map((s, idx) => ({
    label: labels[idx],
    total: (data || [])
      .filter((r: { date_g: string }) => r.date_g >= s.from && r.date_g <= s.to)
      .reduce((sum: number, r: { total: number }) => sum + (r.total || 0), 0),
  }));
}

/* ═══════════════════════ کاتالوگ شناسه کالا و خدمات (مودیان) ═══════════════════════
   منبع رسمی: فایل XML سامانه stuffid.tax.gov.ir — یک‌بار توسط کاربر وارد می‌شود
   و برای همه کسب‌وکارها قابل استفاده است. */

export async function searchStuffCatalog(query: string, limit = 25): Promise<AccStuffCatalogRow[]> {
  const q = query.trim();
  if (!q) return [];
  const digits = q.replace(/[^0-9]/g, '');
  let req = supabase.from('acc_stuff_catalog').select('*').limit(limit);
  if (digits.length >= 4 && /^\d+$/.test(q.replace(/\s/g, ''))) {
    /* جست‌وجوی عددی → شناسه */
    req = req.ilike('id', `%${digits}%`);
  } else {
    req = req.ilike('description', `%${q}%`);
  }
  const { data, error } = await req.order('id', { ascending: true });
  if (error) throw error;
  return (data || []) as AccStuffCatalogRow[];
}

export async function stuffCatalogCount(): Promise<number> {
  const { count, error } = await supabase
    .from('acc_stuff_catalog')
    .select('id', { count: 'exact', head: true });
  if (error) return 0;
  return count || 0;
}

/** درج دسته‌ای شناسه‌ها (چانک ۵۰۰تایی، upsert روی id) */
export async function importStuffCatalog(rows: AccStuffCatalogRow[]): Promise<number> {
  const CHUNK = 500;
  let done = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK).map((r) => ({
      id: r.id,
      description: r.description,
      type_name: r.type_name ?? null,
      vat: r.vat ?? 0,
      taxable: r.taxable ?? true,
      is_general: r.is_general ?? true,
      shamsi_date: r.shamsi_date ?? null,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase
      .from('acc_stuff_catalog')
      .upsert(chunk, { onConflict: 'id' });
    if (error) throw error;
    done += chunk.length;
  }
  return done;
}

/* ═══════════════════════ اعتبارسنجی مالیاتی هزینه ═══════════════════════
   مبنای قواعد: مواد ۱۴۷ و ۱۴۸ و ۱۶۹ قانون مالیات‌های مستقیم —
   هزینه باید واقعی، مربوط به کسب‌وکار و مستند به سند معتبر باشد. */

export const TAX_STATUS_LABEL: Record<AccExpense['tax_status'], string> = {
  valid: 'قابل قبول',
  incomplete: 'نیازمند سند',
  invalid: 'غیرقابل قبول',
};

export function computeExpenseTax(row: Partial<AccExpense>): {
  status: AccExpense['tax_status'];
  notes: string[];
} {
  const notes: string[] = [];
  const hasReceipt = !!row.receipt_url;
  const hasNo = !!row.receipt_no?.trim();
  const hasVendor = !!row.vendor_name?.trim();
  const amount = row.amount || 0;

  if (!hasReceipt && !hasNo && !hasVendor) {
    notes.push('هیچ سند و مدرکی ثبت نشده — این هزینه در مالیات قابل قبول نیست.');
    return { status: 'invalid', notes };
  }

  let score = 0;
  if (hasReceipt) score += 2;
  if (hasNo) score += 1;
  if (hasVendor) score += 1;

  if (!hasReceipt) notes.push('عکس/فایل فاکتور پیوست نشده — بدون سند، هزینه از نظر ممیز مالیاتی مشکوک تلقی می‌شود.');
  if (!hasNo) notes.push('شماره فاکتور/سند هزینه ثبت نشده است.');
  if (!hasVendor) notes.push('فروشنده / طرف‌حساب مشخص نشده است.');
  if ((row.vat_amount || 0) > 0 && !hasReceipt) {
    notes.push('اعتبار ارزش افزوده بدون فاکتور رسمی قابل استفاده نیست.');
  }
  if (amount > 50_000_000 && !row.account_id) {
    notes.push('پرداخت‌های بزرگ بهتر است از طریق بانک/کارت‌خوان باشد (ماده ۱۶۹ ق.م.م).');
  }

  return { status: score >= 3 ? 'valid' : 'incomplete', notes };
}



export async function uploadAccMedia(businessId: string, file: File, kind: 'logo' | 'signature' | 'stamp' | 'expense'): Promise<string> {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${businessId}/${kind}-${Date.now()}.${ext || 'png'}`;
  const { error } = await supabase.storage.from('acc-media').upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from('acc-media').getPublicUrl(path);
  return data.publicUrl;
}

/* ═══════════════════════ خروجی CSV (معاملات فصلی) ═══════════════════════ */

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const content = '\uFEFF' + [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ═══════════════════════ نسخه ۴: دفتر چک‌ها ═══════════════════════ */

export async function listChecks(businessId: string, opts: { kind?: CheckKind; status?: CheckStatus } = {}): Promise<AccCheck[]> {
  let q = supabase
    .from('acc_checks')
    .select('*, partner:acc_partners(id,name), account:acc_accounts(id,name)')
    .eq('business_id', businessId)
    .order('due_date_g', { ascending: true });
  if (opts.kind) q = q.eq('kind', opts.kind);
  if (opts.status) q = q.eq('status', opts.status);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as unknown as AccCheck[];
}

export async function saveCheck(businessId: string, row: Partial<AccCheck> & { kind: CheckKind; amount: number; due_date_g: string }): Promise<string> {
  const payload = {
    kind: row.kind,
    partner_id: row.partner_id || null,
    account_id: row.account_id || null,
    invoice_id: row.invoice_id || null,
    amount: Math.max(0, Math.round(row.amount || 0)),
    serial_no: row.serial_no || null,
    bank_name: row.bank_name || null,
    branch: row.branch || null,
    issue_date_g: row.issue_date_g || null,
    due_date_g: row.due_date_g,
    status: row.status || 'in_hand',
    description: row.description || null,
  };
  if (row.id) {
    const { error } = await supabase.from('acc_checks').update(payload).eq('id', row.id);
    if (error) throw error;
    return row.id;
  }
  const { data, error } = await supabase
    .from('acc_checks')
    .insert({ ...payload, business_id: businessId })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function setCheckStatus(id: string, status: CheckStatus) {
  const { error } = await supabase.from('acc_checks').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function deleteCheck(id: string) {
  const { error } = await supabase.from('acc_checks').delete().eq('id', id);
  if (error) throw error;
}

/* ═══════════════ صورت‌حساب طرف‌حساب (گردش + سررسید) ═══════════════ */

export async function partnerStatement(businessId: string, partnerId: string): Promise<PartnerStatement> {
  const [partners, invoices, txs] = await Promise.all([
    listPartners(businessId),
    listInvoices(businessId, {}),
    listTransactions(businessId, {}),
  ]);
  const partner = partners.find((p) => p.id === partnerId);
  if (!partner) throw new Error('طرف‌حساب یافت نشد');
  const relInv = invoices.filter((i) => i.partner_id === partnerId && i.status !== 'cancelled' && i.status !== 'draft');
  const relTx = txs.filter((t) => t.partner_id === partnerId);
  /* فاکتور فروش/برگشت بستانکار، خرید بدهکارِ تامین‌کننده — مانده از دید کسب‌وکار */
  const sign = (t: InvoiceType) => (t === 'purchase' ? -1 : 1);
  const totalInvoiced = relInv.reduce((s, i) => s + sign(i.type) * i.total, 0);
  const totalSettled = relTx.reduce((s, t) => s + (t.kind === 'receipt' ? t.amount : -t.amount), 0);
  const balance = totalInvoiced - totalSettled;
  /* تحلیل سررسید: فاکتورهای وصول‌نشده بر اساس روزهای گذشته از سررسید */
  const now = Date.now();
  const buckets = [
    { label: 'سررسید نرسیده', amount: 0 },
    { label: '۱ تا ۳۰ روز گذشته', amount: 0 },
    { label: '۳۱ تا ۹۰ روز گذشته', amount: 0 },
    { label: 'بیش از ۹۰ روز', amount: 0 },
  ];
  for (const i of relInv) {
    const remain = i.total - i.paid_total;
    if (remain <= 0) continue;
    const due = i.due_date_g ? new Date(i.due_date_g).getTime() : new Date(i.date_g).getTime();
    const days = Math.floor((now - due) / 86_400_000);
    const idx = days <= 0 ? 0 : days <= 30 ? 1 : days <= 90 ? 2 : 3;
    buckets[idx].amount += remain;
  }
  return { partner, invoices: relInv, transactions: relTx, totalInvoiced, totalSettled, balance, agingBuckets: buckets };
}

/* یادآوری‌ها: فاکتورهای سررسیدگذشته، چک‌های نزدیک، کالای رو به اتمام */
export async function gatherReminders(businessId: string) {
  const today = dateToISO(new Date());
  const in7 = dateToISO(new Date(Date.now() + 7 * 86_400_000));
  const [invs, checks, items] = await Promise.all([
    listInvoices(businessId, {}),
    listChecks(businessId, {}).catch(() => [] as AccCheck[]),
    listItems(businessId),
  ]);
  const dueInvoices = invs
    .filter((i) => ['issued', 'partial'].includes(i.status) && i.total - i.paid_total > 0)
    .map((i) => ({
      id: i.id, number: i.number, partner: i.partner?.name || 'متفرقه',
      remain: i.total - i.paid_total,
      due: i.due_date_g || i.date_g,
      overdue: (i.due_date_g || i.date_g) < today,
    }))
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, 8);
  const dueChecks = checks
    .filter((c) => !['cleared', 'canceled', 'returned'].includes(c.status) && c.due_date_g <= in7)
    .map((c) => ({ id: c.id, kind: c.kind, amount: c.amount, due: c.due_date_g, bank: c.bank_name, serial: c.serial_no, partner: c.partner?.name || '' }))
    .slice(0, 8);
  const lowStock = items.filter((i) => i.track_stock && i.stock <= 3).map((i) => ({ id: i.id, name: i.name, stock: i.stock, unit: i.unit })).slice(0, 8);
  return { dueInvoices, dueChecks, lowStock };
}

/* کمک‌گیرنده فصل شمسی جاری */
export function currentSeasonRange(): { from: string; to: string; season: number } {
  const t = todayJalali();
  const season = Math.ceil(t.jm / 3);
  const startMonth = (season - 1) * 3 + 1;
  const gF = toGregorian(t.jy, startMonth, 1);
  const gT = toGregorian(t.jy, startMonth + 2, jalaliMonthLength(t.jy, startMonth + 2));
  return {
    from: dateToISO(new Date(gF.gy, gF.gm - 1, gF.gd)),
    to: dateToISO(new Date(gT.gy, gT.gm - 1, gT.gd)),
    season,
  };
}

/* ═══════════════ نسخه ۵: دسته‌بندی‌های قابل ویرایش هزینه‌ها ═══════════════ */

import { EXPENSE_CATEGORY_DEFAULTS } from './constants';

export async function listExpenseCategories(businessId: string): Promise<AccExpenseCategory[]> {
  const { data, error } = await supabase
    .from('acc_expense_categories')
    .select('*')
    .eq('business_id', businessId)
    .order('position')
    .order('created_at');
  if (error) throw error;
  return (data || []) as AccExpenseCategory[];
}

/** اگر کسب‌وکار هنوز دسته‌بندی ندارد، ۲۲ دسته پیش‌فرض را seed می‌کند */
export async function ensureExpenseCategories(businessId: string): Promise<AccExpenseCategory[]> {
  const rows = await listExpenseCategories(businessId);
  if (rows.length > 0) return rows;
  const { error } = await supabase.from('acc_expense_categories').insert(
    EXPENSE_CATEGORY_DEFAULTS.map((c, i) => ({ business_id: businessId, title: c.title, code: c.code, position: i })),
  );
  if (error) {
    // اگر همزمان seed شده باشد خطای unique می‌دهیم — بی‌اهمیت
    return listExpenseCategories(businessId);
  }
  return listExpenseCategories(businessId);
}

export async function saveExpenseCategory(businessId: string, row: Partial<AccExpenseCategory>): Promise<string> {
  if (row.id) {
    const { error } = await supabase
      .from('acc_expense_categories')
      .update({ title: row.title, code: row.code ?? null, position: row.position })
      .eq('id', row.id);
    if (error) throw error;
    return row.id;
  }
  const { data: maxRow } = await supabase
    .from('acc_expense_categories')
    .select('position')
    .eq('business_id', businessId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from('acc_expense_categories')
    .insert({
      business_id: businessId,
      title: (row.title || '').trim(),
      code: row.code ?? null,
      position: (maxRow?.position ?? -1) + 1,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteExpenseCategory(id: string) {
  const { error } = await supabase.from('acc_expense_categories').delete().eq('id', id);
  if (error) throw error;
}

/* ═══════════════ نسخه ۵: سند حسابداری دستی + سرفصل اضافه ═══════════════ */

export interface ManualJournalLine { account_code: string; account_title: string; debit: number; credit: number }

/** شماره سند بعدی (بیشترین entry_no + ۱) */
export async function nextEntryNo(businessId: string): Promise<number> {
  const { data } = await supabase
    .from('acc_journal')
    .select('entry_no')
    .eq('business_id', businessId)
    .order('entry_no', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.entry_no || 0) + 1;
}

/** ثبت سند دستی — بدهکار و بستانکار باید تراز باشند (کنترل در UI هم انجام می‌شود) */
export async function saveManualJournal(
  businessId: string,
  input: { date_g: string; description: string; lines: ManualJournalLine[] },
): Promise<string> {
  const totalD = input.lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalC = input.lines.reduce((s, l) => s + (l.credit || 0), 0);
  if (totalD <= 0) throw new Error('جمع بدهکار باید بزرگ‌تر از صفر باشد');
  if (totalD !== totalC) throw new Error('سند تراز نیست — جمع بدهکار و بستانکار باید برابر شود');
  const entryNo = await nextEntryNo(businessId);
  const { data: entry, error } = await supabase
    .from('acc_journal')
    .insert({
      business_id: businessId,
      entry_no: entryNo,
      date_g: input.date_g,
      ref_type: 'manual',
      ref_action: 'post',
      description: input.description || `سند دستی شماره ${entryNo}`,
    })
    .select('id')
    .single();
  if (error) throw error;
  const lines = input.lines
    .filter((l) => l.account_code && (l.debit > 0 || l.credit > 0))
    .map((l) => ({
      entry_id: entry.id as string,
      business_id: businessId,
      account_code: l.account_code,
      account_title: l.account_title,
      debit: l.debit || 0,
      credit: l.credit || 0,
    }));
  if (lines.length) {
    const { error: lineErr } = await supabase.from('acc_journal_lines').insert(lines);
    if (lineErr) throw lineErr;
  }
  return entry.id as string;
}

/** حذف سند دستی (فقط ref_type = manual) */
export async function deleteManualJournal(entryId: string) {
  const { error: lineErr } = await supabase.from('acc_journal_lines').delete().eq('entry_id', entryId);
  if (lineErr) throw lineErr;
  const { error } = await supabase.from('acc_journal').delete().eq('id', entryId).eq('ref_type', 'manual');
  if (error) throw error;
}

/** ساخت سرفصل اضافه (کد خودکار بر اساس نوع) */
export async function saveChartAccount(
  businessId: string,
  row: { code?: string; title: string; kind: AccChartRow['kind'] },
): Promise<string> {
  let code = (row.code || '').trim();
  if (!code) {
    const prefix = row.kind === 'income' ? '41' : row.kind === 'expense' ? '52' : row.kind === 'liability' ? '21' : row.kind === 'equity' ? '31' : '11';
    const { data: siblings } = await supabase
      .from('acc_chart')
      .select('code')
      .eq('business_id', businessId)
      .like('code', `${prefix}%`);
    let maxn = 0;
    for (const s of siblings || []) {
      const n = Number(String(s.code).slice(2));
      if (Number.isFinite(n) && n > maxn) maxn = n;
    }
    code = `${prefix}${String(maxn + 1).padStart(2, '0')}`;
  }
  const { data, error } = await supabase
    .from('acc_chart')
    .insert({ business_id: businessId, code, title: row.title.trim(), kind: row.kind, is_system: false })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteChartAccount(id: string) {
  const { error } = await supabase.from('acc_chart').delete().eq('id', id).eq('is_system', false);
  if (error) throw error;
}

/* ═══════════════ نسخه ۵: گزارش سود محصولات ═══════════════ */

export async function productProfitability(businessId: string, from: string, to: string): Promise<ProductProfitRow[]> {
  const { data, error } = await supabase
    .from('acc_invoice_items')
    .select('title, item_id, quantity, unit_price, discount, invoice:acc_invoices!inner(id, type, status, date_g)')
    .eq('business_id', businessId)
    .eq('invoice.type', 'sale')
    .neq('invoice.status', 'cancelled')
    .neq('invoice.status', 'draft')
    .gte('invoice.date_g', from)
    .lte('invoice.date_g', to);
  if (error) throw error;
  const items = await listItems(businessId);
  const costMap = new Map<string, number>();
  for (const it of items) costMap.set(it.id, Number(it.purchase_price) || 0);

  type Acc = { key: string; item_id: string | null; title: string; quantity: number; revenue: number; cost: number };
  const map = new Map<string, Acc>();
  for (const raw of data || []) {
    const r = raw as { title: string; item_id: string | null; quantity: number; unit_price: number; discount: number };
    const key = r.item_id || `t:${r.title}`;
    let acc = map.get(key);
    if (!acc) {
      acc = { key, item_id: r.item_id, title: r.title, quantity: 0, revenue: 0, cost: 0 };
      map.set(key, acc);
    }
    const qty = Number(r.quantity) || 0;
    acc.quantity += qty;
    const lineRevenue = Math.round(qty * (Number(r.unit_price) || 0)) - (Number(r.discount) || 0);
    acc.revenue += lineRevenue;
    acc.cost += Math.round(qty * (costMap.get(r.item_id || '') || 0));
  }
  const rows = [...map.values()].map((a) => ({
    ...a,
    profit: a.revenue - a.cost,
    margin: a.revenue > 0 ? Math.round(((a.revenue - a.cost) / a.revenue) * 100) : 0,
  }));
  rows.sort((x, y) => y.profit - x.profit);
  return rows;
}

/** حذف سند دستی — خطوط کمکی */
export type { AccJournalLine };
