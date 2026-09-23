/* ═════════════════════════════════════════════════════════════════════
   api7 — ماژول حسابداری حرفه‌ای کاربان (نسخه ۷)
   کدینگ چندسطحی | تفصیلی شناور | سند حرفه‌ای | تنخواه | پیش‌دریافت |
   مغایرت بانکی واقعی | بستن/افتتاح دوره | کارت حساب | تراز چندستونی |
   ضمائم | ابطال/حذف اسناد | بهای تمام‌شده خدمات | دسترسی ریزدانه
   ═════════════════════════════════════════════════════════════════════ */

import { supabase } from '@/lib/supabase';
import { jalaliYearRange, toGregorian } from './jalali';
import type { AccChartRow } from './types';

/* ═══════════ تایپ‌های نسخه ۷ ═══════════ */

export interface ChartNode extends AccChartRow {
  parent_id: string | null;
  level: number;
  is_leaf: boolean;
  nature: 'debit' | 'credit';
  active: boolean;
  children?: ChartNode[];
}

export interface AccDetail {
  id: string;
  business_id: string;
  /** کد یکتای تفصیلی — اتمیک از شمارندهٔ دیتابیس (بند ۷ دستور) */
  detail_code: string | null;
  title: string;
  kind: 'customer' | 'supplier' | 'shareholder' | 'employee' | 'project' | 'bank' | 'cash' | 'cost_center' | 'partner' | 'other';
  ref_id: string | null;
  active: boolean;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface JournalLineV2 {
  account_code: string;
  account_title: string;
  debit: number;
  credit: number;
  detail_id?: string | null;
  cost_center_id?: string | null;
  project_id?: string | null;
  line_desc?: string | null;
}

export interface AccAttachment {
  id: string;
  business_id: string;
  entity_type: string;
  entity_id: string;
  title: string | null;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface AccPetty {
  id: string;
  business_id: string;
  name: string;
  custodian: string | null;
  source_account_id: string | null;
  charge_total: number;
  spent_total: number;
  settled_total: number;
  status: 'open' | 'settled' | 'closed';
  voided_at: string | null;
  void_reason: string | null;
  description: string | null;
  created_at: string;
  acc_petty_ops?: AccPettyOp[];
}

export interface AccPettyOp {
  id: string;
  business_id: string;
  petty_id: string;
  kind: 'charge' | 'spend' | 'settle';
  amount: number;
  date_g: string;
  chart_code: string | null;
  chart_title: string | null;
  description: string | null;
  journal_id: string | null;
  created_at: string;
}

export interface AccPrepayment {
  id: string;
  business_id: string;
  kind: 'advance_received' | 'advance_paid';
  partner_id: string | null;
  account_id: string | null;
  amount: number;
  allocated_amount: number;
  date_g: string;
  status: 'open' | 'allocated' | 'refunded' | 'void';
  invoice_id: string | null;
  expense_id: string | null;
  description: string | null;
  journal_id: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
  partner?: { id: string; name: string } | null;
  account?: { id: string; name: string; kind: string } | null;
}

export interface AccBankLine {
  id: string;
  business_id: string;
  account_id: string;
  date_g: string;
  description: string | null;
  ref_no: string | null;
  amount: number; // + واریز / - برداشت
  match_status: 'unmatched' | 'auto' | 'manual' | 'onbook' | 'needs_doc' | 'ignored';
  match_entity_type: string | null;
  match_entity_id: string | null;
  matched_at: string | null;
  batch_id: string | null;
  created_at: string;
}

export interface AccFiscalYear {
  id: string;
  business_id: string;
  jyear: number;
  status: 'open' | 'closed';
  opening_entry_id: string | null;
  closing_entry_id: string | null;
  closed_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface LedgerRow {
  entry_id: string;
  entry_no: number;
  date_g: string;
  description: string | null;
  line_desc: string | null;
  account_code: string;
  account_title: string;
  detail_title: string | null;
  project_name: string | null;
  debit: number;
  credit: number;
  running: number;
}

export interface AccountCardResult {
  code: string;
  title: string;
  nature: 'debit' | 'credit';
  opening: number;
  rows: LedgerRow[];
  totalDebit: number;
  totalCredit: number;
  closing: number;
}

export interface TrialBalance6Row {
  code: string;
  title: string;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
}

export interface ReconSummary {
  accountId: string;
  bookBalance: number;
  bankBalance: number;
  bankUnmatched: AccBankLine[];
  bookUnmatched: { id: string; date_g: string; description: string | null; amount: number; kind: string }[];
  difference: number;
}

/* کد سرفصل‌های سیستمی مورد نیاز نسخه ۷ */
export const CODE_PETTY = '1104';       // تنخواه‌گردان
export const CODE_ADV_RECV = '2104';    // پیش‌دریافت از مشتریان
export const CODE_ADV_PAID = '1105';    // پیش‌پرداخت به تامین‌کنندگان
export const CODE_AR = '1103';          // حساب‌های دریافتنی
export const CODE_AP = '2101';          // حساب‌های پرداختنی
export const CODE_RETAINED = '3102';    // سود (زیان) انباشته

const DETAIL_KINDS: Record<AccDetail['kind'], string> = {
  customer: 'مشتری', supplier: 'تامین‌کننده', shareholder: 'شریک / سهامدار', employee: 'کارمند',
  project: 'پروژه', bank: 'بانک', cash: 'صندوق', cost_center: 'مرکز هزینه',
  partner: 'طرف‌حساب (قدیمی)', other: 'سایر',
};
export { DETAIL_KINDS as DETAIL_KIND_LABELS };

/* ═══════════════════════ helper های پایه ═══════════════════════ */

import { isMissingRpc, accStoragePathOf } from './rpc';

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function nextEntryNo(businessId: string): Promise<number> {
  const { data } = await supabase
    .from('acc_journal')
    .select('entry_no')
    .eq('business_id', businessId)
    .order('entry_no', { ascending: false })
    .limit(1)
    .maybeSingle();
  return num(data?.entry_no) + 1;
}

/** تضمین وجود یک سرفصل در کدینگ — اگر نبود با مشخصات داده‌شده می‌سازد */
export async function ensureChartCode(
  businessId: string,
  code: string,
  title: string,
  kind: AccChartRow['kind'],
  level = 1,
): Promise<void> {
  const { data: exists } = await supabase
    .from('acc_chart')
    .select('id')
    .eq('code', code)
    .or(`business_id.is.null,business_id.eq.${businessId}`)
    .maybeSingle();
  if (exists) return;
  await supabase.from('acc_chart').insert({
    business_id: businessId, code, title, kind, is_system: false, level, is_leaf: true,
  });
}

/** ثبت سند دوبل (نسخه حرفه‌ای با تفصیلی و پروژه)
 *  مسیر اصلی: RPC اتمیک acc_create_journal — سرِسند + ردیف‌ها + شماره‌گذاری + تراز در یک تراکنش
 *  سازگاری: اگر مایگریشن هنوز اجرا نشده باشد، مسیر دو مرحله‌ای قدیمی استفاده می‌شود */
async function insertEntry(
  businessId: string,
  input: { date_g: string; description: string; ref_type: string; ref_action?: string; ref_id?: string | null; reversal_of?: string | null; attachment_url?: string | null },
  lines: JournalLineV2[],
): Promise<string> {
  if (!lines.some((l) => num(l.debit) > 0 || num(l.credit) > 0)) throw new Error('ردیف سند خالی است');
  const d = lines.reduce((s, l) => s + num(l.debit), 0);
  const c = lines.reduce((s, l) => s + num(l.credit), 0);
  if (d !== c) throw new Error(`سند تراز نیست — بدهکار ${d.toLocaleString('fa-IR')} / بستانکار ${c.toLocaleString('fa-IR')}`);

  const rpcLines = lines
    .filter((l) => l.account_code && (num(l.debit) > 0 || num(l.credit) > 0))
    .map((l) => ({
      account_code: l.account_code,
      account_title: l.account_title || l.account_code,
      debit: num(l.debit), credit: num(l.credit),
      detail_id: l.detail_id ?? null,
      cost_center_id: l.cost_center_id ?? null,
      project_id: l.project_id ?? null,
      line_desc: l.line_desc ?? null,
    }));
  const { data: rpcId, error: rpcErr } = await supabase.rpc('acc_create_journal', {
    p_business: businessId,
    p_date: input.date_g,
    p_description: input.description,
    p_ref_type: input.ref_type,
    p_ref_action: input.ref_action || 'post',
    p_ref_id: input.ref_id ?? null,
    p_reversal_of: input.reversal_of ?? null,
    p_lines: rpcLines,
    p_attachment_url: input.attachment_url ?? null,
  });
  if (!rpcErr) return rpcId as string;
  if (!isMissingRpc(rpcErr)) throw new Error(rpcErr.message);

  /* ── مسیر قدیمی (پیش از اجرای مایگریشن) ── */
  const entryNo = await nextEntryNo(businessId);
  const { data: entry, error } = await supabase
    .from('acc_journal')
    .insert({
      business_id: businessId, entry_no: entryNo, date_g: input.date_g,
      ref_type: input.ref_type, ref_action: input.ref_action || 'post',
      ref_id: input.ref_id ?? null, reversal_of: input.reversal_of ?? null,
      description: input.description,
    })
    .select('id')
    .single();
  if (error) throw error;
  const rows = lines
    .filter((l) => l.account_code && (num(l.debit) > 0 || num(l.credit) > 0))
    .map((l) => ({
      entry_id: entry.id as string,
      business_id: businessId,
      account_code: l.account_code,
      account_title: l.account_title,
      debit: num(l.debit), credit: num(l.credit),
      detail_id: l.detail_id ?? null,
      cost_center_id: l.cost_center_id ?? null,
      project_id: l.project_id ?? null,
      line_desc: l.line_desc ?? null,
    }));
  if (rows.length) {
    const { error: lerr } = await supabase.from('acc_journal_lines').insert(rows);
    if (lerr) throw lerr;
  }
  return entry.id as string;
}

/* ═══════════════════════ ۱) کدینگ چندسطحی ═══════════════════════ */

/** درخت کامل کدینگ (سیستم + کسب‌وکار) با سلسله‌مراتب کل ← معین ← تفصیلی */
export async function listChartTree(businessId: string): Promise<ChartNode[]> {
  const { data, error } = await supabase
    .from('acc_chart')
    .select('*')
    .or(`business_id.is.null,business_id.eq.${businessId}`)
    .order('code');
  if (error) throw error;
  const all = (data || []) as ChartNode[];
  const byId = new Map<string, ChartNode>();
  for (const r of all) { byId.set(r.id, { ...r, children: [] }); }
  const roots: ChartNode[] = [];
  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) byId.get(node.parent_id)!.children!.push(node);
    else roots.push(node);
  }
  const sortTree = (nodes: ChartNode[]) => {
    nodes.sort((a, b) => a.code.localeCompare(b.code));
    for (const n of nodes) if (n.children?.length) sortTree(n.children);
  };
  sortTree(roots);
  return roots;
}

/** افزودن سرفصل زیرمجموعه — سطح خودکار از والد محاسبه می‌شود؛ قوانین تفصیلی اختیاری */
export async function saveChartNode(
  businessId: string,
  input: { id?: string; parent_id?: string | null; code?: string; title: string; kind: AccChartRow['kind']; nature?: 'debit' | 'credit'; requires_detail?: boolean; allowed_detail_types?: string[] },
): Promise<string> {
  let level = 1;
  let code = (input.code || '').trim();
  if (input.parent_id) {
    const { data: parent } = await supabase
      .from('acc_chart').select('code, level, kind').eq('id', input.parent_id).maybeSingle();
    if (parent) {
      level = num(parent.level) + 1;
      if (!code) {
        // کد پیشنهادی: کد والد + شماره ترتیبی
        const { data: kids } = await supabase
          .from('acc_chart').select('code').eq('parent_id', input.parent_id).order('code', { ascending: false }).limit(1);
        const lastKid = kids?.[0]?.code || '';
        const siblingPart = lastKid.slice(String(parent.code).length);
        const nextN = (Number(siblingPart) || 0) + 1;
        code = `${parent.code}${String(nextN).padStart(2, '0')}`;
      }
    }
  } else if (!code) {
    const prefix = input.kind === 'income' ? '41' : input.kind === 'expense' ? '52' : input.kind === 'liability' ? '21' : input.kind === 'equity' ? '31' : '11';
    const { data: siblings } = await supabase
      .from('acc_chart').select('code').eq('business_id', businessId).like('code', `${prefix}%`);
    let maxn = 0;
    for (const s of siblings || []) {
      const n = Number(String(s.code).slice(2));
      if (Number.isFinite(n) && n > maxn) maxn = n;
    }
    code = `${prefix}${String(maxn + 1).padStart(2, '0')}`;
  }
  const { data: dup } = await supabase
    .from('acc_chart').select('id').eq('code', code).or(`business_id.is.null,business_id.eq.${businessId}`).maybeSingle();
  if (dup && dup.id !== input.id) throw new Error(`کد «${code}» از قبل در کدینگ وجود دارد`);
  if (input.id) {
    const { error } = await supabase.from('acc_chart').update({
      title: input.title.trim(), kind: input.kind,
      nature: input.nature || (input.kind === 'liability' || input.kind === 'equity' || input.kind === 'income' ? 'credit' : 'debit'),
      ...(input.requires_detail !== undefined ? { requires_detail: input.requires_detail } : {}),
      ...(input.allowed_detail_types !== undefined ? { allowed_detail_types: input.allowed_detail_types } : {}),
    }).eq('id', input.id).eq('is_system', false);
    if (error) throw error;
    return input.id;
  }
  const { data, error } = await supabase
    .from('acc_chart')
    .insert({
      business_id: businessId, code, title: input.title.trim(), kind: input.kind,
      is_system: false, parent_id: input.parent_id ?? null, level,
      is_leaf: true, nature: input.nature || (input.kind === 'liability' || input.kind === 'equity' || input.kind === 'income' ? 'credit' : 'debit'),
      requires_detail: input.requires_detail ?? false,
      allowed_detail_types: input.allowed_detail_types ?? [],
    })
    .select('id')
    .single();
  if (error) throw error;
  if (input.parent_id) {
    await supabase.from('acc_chart').update({ is_leaf: false }).eq('id', input.parent_id);
  }
  return data.id as string;
}

/** حذف سرفصل — فقط اگر بدون فرزند و بدون گردش باشد */
export async function deleteChartNode(id: string): Promise<void> {
  const { data: kids } = await supabase.from('acc_chart').select('id').eq('parent_id', id).limit(1);
  if (kids && kids.length) throw new Error('این سرفصل زیرمجموعه دارد — اول زیرمجموعه‌ها را حذف کنید');
  const { data: node } = await supabase.from('acc_chart').select('code, is_system, business_id').eq('id', id).maybeSingle();
  if (!node) throw new Error('سرفصل یافت نشد');
  if (node.is_system) throw new Error('سرفصل سیستمی قابل حذف نیست');
  if (node.code) {
    const { data: used } = await supabase
      .from('acc_journal_lines').select('id').eq('account_code', node.code).limit(1);
    if (used && used.length) throw new Error('این سرفصل در اسناد گردش دارد و قابل حذف نیست');
  }
  const { error } = await supabase.from('acc_chart').delete().eq('id', id).eq('is_system', false);
  if (error) throw error;
  const { data: anyNode } = await supabase.from('acc_chart').select('id').eq('id', id).maybeSingle();
  if (anyNode && node.business_id === null) throw new Error('سرفصل سیستمی قابل حذف نیست');
}

/* ═══════════════════════ ۲) تفصیلی شناور ═══════════════════════ */

export async function listDetails(businessId: string, kind?: AccDetail['kind']): Promise<AccDetail[]> {
  let q = supabase.from('acc_details').select('*').eq('business_id', businessId).order('title');
  if (kind) q = q.eq('kind', kind);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as AccDetail[];
}

export async function saveDetail(
  businessId: string,
  input: { id?: string; title: string; kind: AccDetail['kind']; ref_id?: string | null; active?: boolean },
): Promise<string> {
  if (!input.title.trim()) throw new Error('عنوان تفصیلی الزامی است');
  if (input.id) {
    const { error } = await supabase.from('acc_details').update({
      title: input.title.trim(), kind: input.kind,
      ...(input.active !== undefined ? { active: input.active } : {}),
    }).eq('id', input.id);
    if (error) throw error;
    return input.id;
  }
  /* کد تفصیلی را تریگر دیتابیس اتمیک تخصیص می‌دهد — بدون MAX+1 */
  const { error } = await supabase.from('acc_details').insert({
    business_id: businessId, title: input.title.trim(), kind: input.kind,
    ref_id: input.ref_id ?? null,
  });
  if (error) throw error;
  const { data: found } = await supabase
    .from('acc_details')
    .select('id')
    .eq('business_id', businessId)
    .eq('title', input.title.trim())
    .eq('kind', input.kind)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!found) throw new Error('تفصیلی ذخیره شد ولی بازیابی شناسه ناموفق بود');
  return found.id as string;
}

/** غیرفعال‌سازی تفصیلی — حذف دارای گردش در دیتابیس ممنوع است */
export async function setDetailActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('acc_details').update({ active }).eq('id', id);
  if (error) throw error;
}

export async function deleteDetail(id: string): Promise<void> {
  const { data: used } = await supabase.from('acc_journal_lines').select('id').eq('detail_id', id).limit(1);
  if (used && used.length) throw new Error('این تفصیلی در اسناد استفاده شده و قابل حذف نیست');
  const { error } = await supabase.from('acc_details').delete().eq('id', id);
  if (error) throw error;
}

/** تفصیلی خودکار برای طرف‌حساب/پروژه/کارمند — اگر نبود می‌سازد */
export async function ensureDetail(businessId: string, kind: AccDetail['kind'], title: string, refId?: string): Promise<string | null> {
  if (!title) return null;
  const q = supabase.from('acc_details').select('id').eq('business_id', businessId).eq('title', title).eq('kind', kind);
  const { data } = await q.maybeSingle();
  if (data) return data.id as string;
  const { data: created, error } = await supabase
    .from('acc_details')
    .insert({ business_id: businessId, title, kind, ref_id: refId ?? null })
    .select('id').single();
  if (error) return null;
  return created.id as string;
}

/* ═══════════════════════ ۳) سند دستی حرفه‌ای + ابطال/برگشت ═══════════════════════ */

export interface ManualJournalInput {
  date_g: string;
  description: string;
  attachment_url?: string | null;
  lines: JournalLineV2[];
}

/** سند مرکب چندردیفی با تفصیلی شناور و پروژه — کنترل تراز اجباری */
export async function saveJournalV2(businessId: string, input: ManualJournalInput): Promise<string> {
  /* پیوست از همان موتور اتمیک (p_attachment_url) ثبت می‌شود —
     نوشتن مستقیم سند از سمت کلاینت با M150000 بسته شده است */
  const id = await insertEntry(businessId, { date_g: input.date_g, description: input.description, ref_type: 'manual', attachment_url: input.attachment_url ?? null }, input.lines);
  return id;
}

/** برگشت سند (ابطال) — سند معکوس با ارجاع متقابل، اتمیک از مسیر RPC */
export async function voidJournal(businessId: string, entryId: string, reason: string): Promise<string> {
  const { data: revId, error: rpcErr } = await supabase.rpc('acc_void_journal', {
    p_business: businessId, p_entry: entryId, p_reason: reason || '',
  });
  if (!rpcErr) return revId as string;
  if (!isMissingRpc(rpcErr)) throw new Error(rpcErr.message);

  /* ── مسیر قدیمی (پیش از اجرای مایگریشن) ── */
  const { data: entry, error } = await supabase
    .from('acc_journal')
    .select('*, acc_journal_lines(*)')
    .eq('id', entryId)
    .maybeSingle();
  if (error) throw error;
  const e = entry as { id: string; date_g: string; description: string | null; voided_at: string | null; ref_action: string; acc_journal_lines: { account_code: string; account_title: string; debit: number; credit: number; detail_id: string | null; project_id: string | null; line_desc: string | null }[] } | null;
  if (!e) throw new Error('سند یافت نشد');
  if (e.voided_at) throw new Error('این سند قبلاً باطل شده است');
  if (e.ref_action === 'reverse') throw new Error('سند معکوس قابل ابطال نیست');
  const revLines: JournalLineV2[] = (e.acc_journal_lines || []).map((l) => ({
    account_code: l.account_code, account_title: l.account_title,
    debit: num(l.credit), credit: num(l.debit),
    detail_id: l.detail_id, project_id: l.project_id,
    line_desc: l.line_desc ? `برگشت: ${l.line_desc}` : null,
  }));
  const revIdLegacy = await insertEntry(
    businessId,
    { date_g: new Date().toISOString().slice(0, 10), description: `برگشت سند ${e.description || ''}${reason ? ` — علت: ${reason}` : ''}`, ref_type: 'manual', ref_action: 'reverse', reversal_of: entryId },
    revLines,
  );
  const { error: uerr } = await supabase.from('acc_journal').update({
    voided_at: new Date().toISOString(), void_reason: reason || null,
  }).eq('id', entryId);
  if (uerr) throw uerr;
  return revIdLegacy;
}

/** حذف کامل سند — فقط سندهای دستی یا برگشتی؛ سندهای سیستمی از مسیر ابطال سند مادر */
export async function deleteJournalFull(entryId: string, refType: string): Promise<void> {
  if (refType !== 'manual') throw new Error('سندهای سیستمی را از طریق ابطال سند مادر حذف کنید');
  const { error: lerr } = await supabase.from('acc_journal_lines').delete().eq('entry_id', entryId);
  if (lerr) throw lerr;
  const { error } = await supabase.from('acc_journal').delete().eq('id', entryId);
  if (error) throw error;
}
