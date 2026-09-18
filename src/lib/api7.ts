/* ═════════════════════════════════════════════════════════════════════
   api7 — ماژول حسابداری حرفه‌ای کاربان (نسخه ۷)
   کدینگ چندسطحی | تفصیلی شناور | سند حرفه‌ای | تنخواه | پیش‌دریافت |
   مغایرت بانکی واقعی | بستن/افتتاح دوره | کارت حساب | تراز چندستونی |
   ضمائم | ابطال/حذف اسناد | بهای تمام‌شده خدمات | دسترسی ریزدانه
   ═════════════════════════════════════════════════════════════════════ */

import { supabase } from '@/lib/supabase';
import { SYSTEM_CHART } from './constants';
import { jalaliYearRange, todayJalali, toGregorian } from './jalali';
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
  code: string | null;
  title: string;
  kind: 'customer' | 'supplier' | 'employee' | 'project' | 'bank' | 'partner' | 'other';
  ref_id: string | null;
  active: boolean;
  created_at: string;
}

export interface JournalLineV2 {
  account_code: string;
  account_title: string;
  debit: number;
  credit: number;
  detail_id?: string | null;
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
  match_status: 'unmatched' | 'auto' | 'manual' | 'onbook';
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
  customer: 'مشتری', supplier: 'تامین‌کننده', employee: 'کارمند',
  project: 'پروژه', bank: 'بانک', partner: 'طرف‌حساب', other: 'سایر',
};
export { DETAIL_KINDS as DETAIL_KIND_LABELS };

/* ═══════════════════════ helper های پایه ═══════════════════════ */

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

/** ثبت سند دوبل (نسخه حرفه‌ای با تفصیلی و پروژه) */
async function insertEntry(
  businessId: string,
  input: { date_g: string; description: string; ref_type: string; ref_action?: string; ref_id?: string | null; reversal_of?: string | null },
  lines: JournalLineV2[],
): Promise<string> {
  if (!lines.some((l) => num(l.debit) > 0 || num(l.credit) > 0)) throw new Error('ردیف سند خالی است');
  const d = lines.reduce((s, l) => s + num(l.debit), 0);
  const c = lines.reduce((s, l) => s + num(l.credit), 0);
  if (Math.abs(d - c) > 1) throw new Error(`سند تراز نیست — بدهکار ${d.toLocaleString('fa-IR')} / بستانکار ${c.toLocaleString('fa-IR')}`);
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

/** افزودن سرفصل زیرمجموعه — سطح خودکار از والد محاسبه می‌شود */
export async function saveChartNode(
  businessId: string,
  input: { id?: string; parent_id?: string | null; code?: string; title: string; kind: AccChartRow['kind']; nature?: 'debit' | 'credit' },
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
  input: { id?: string; title: string; kind: AccDetail['kind']; code?: string | null; ref_id?: string | null },
): Promise<string> {
  if (!input.title.trim()) throw new Error('عنوان تفصیلی الزامی است');
  if (input.id) {
    const { error } = await supabase.from('acc_details').update({
      title: input.title.trim(), kind: input.kind, code: input.code ?? null,
    }).eq('id', input.id);
    if (error) throw error;
    return input.id;
  }
  const { data, error } = await supabase.from('acc_details').insert({
    business_id: businessId, title: input.title.trim(), kind: input.kind,
    code: input.code || null, ref_id: input.ref_id ?? null,
  }).select('id').single();
  if (error) throw error;
  return data.id as string;
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
  const id = await insertEntry(businessId, { date_g: input.date_g, description: input.description, ref_type: 'manual' }, input.lines);
  if (input.attachment_url) {
    await supabase.from('acc_journal').update({ attachment_url: input.attachment_url }).eq('id', id);
  }
  return id;
}

/** برگشت سند (ابطال) — سند معکوس با ارجاع متقابل ثبت می‌شود */
export async function voidJournal(businessId: string, entryId: string, reason: string): Promise<string> {
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
  const revId = await insertEntry(
    businessId,
    { date_g: new Date().toISOString().slice(0, 10), description: `برگشت سند ${e.description || ''}${reason ? ` — علت: ${reason}` : ''}`, ref_type: 'manual', ref_action: 'reverse', reversal_of: entryId },
    revLines,
  );
  const { error: uerr } = await supabase.from('acc_journal').update({
    voided_at: new Date().toISOString(), void_reason: reason || null,
  }).eq('id', entryId);
  if (uerr) throw uerr;
  return revId;
}

/** حذف کامل سند — فقط سندهای دستی یا برگشتی؛ سندهای سیستمی از مسیر ابطال سند مادر */
export async function deleteJournalFull(entryId: string, refType: string): Promise<void> {
  if (refType !== 'manual') throw new Error('سندهای سیستمی را از طریق ابطال سند مادر حذف کنید');
  const { error: lerr } = await supabase.from('acc_journal_lines').delete().eq('entry_id', entryId);
  if (lerr) throw lerr;
  const { error } = await supabase.from('acc_journal').delete().eq('id', entryId);
  if (error) throw error;
}

/* ═══════════════════════ ۴) کارت حساب (گردش هر حساب) ═══════════════════════ */

const natureOf = (code: string, tree: Map<string, { kind: string; nature: string | null }>): 'debit' | 'credit' => {
  const n = tree.get(code)?.nature;
  if (n === 'credit') return 'credit';
  if (n === 'debit') return 'debit';
  const kind = tree.get(code)?.kind || (code.startsWith('4') ? 'income' : code.startsWith('5') ? 'expense' : code.startsWith('2') || code.startsWith('3') ? 'liability' : 'asset');
  return kind === 'liability' || kind === 'equity' || kind === 'income' ? 'credit' : 'debit';
};

const signed = (debit: number, credit: number, nature: 'debit' | 'credit'): number =>
  nature === 'debit' ? debit - credit : credit - debit;

/** کارت حساب برای هر کد (کل/معین/تفصیلی) — گردش با کد یا پیشوند کد */
export async function accountCard(
  businessId: string,
  codePrefix: string,
  from?: string,
  to?: string,
  detailId?: string | null,
  projectId?: string | null,
): Promise<AccountCardResult> {
  const { data: chart } = await supabase
    .from('acc_chart').select('code, title, kind, nature')
    .or(`business_id.is.null,business_id.eq.${businessId}`);
  const tree = new Map<string, { kind: string; nature: string | null }>();
  for (const c of chart || []) tree.set(c.code as string, { kind: c.kind as string, nature: c.nature as string | null });
  const title = tree.get(codePrefix)?.title || codePrefix;
  const nature = natureOf(codePrefix, tree);

  let q = supabase
    .from('acc_journal_lines')
    .select('entry_id, account_code, account_title, debit, credit, line_desc, detail_id, project_id, acc_journal!inner(id, entry_no, date_g, description, voided_at, ref_action), acc_details(title), acc_projects(name)')
    .eq('business_id', businessId)
    .like('account_code', `${codePrefix}%`);
  if (detailId) q = q.eq('detail_id', detailId);
  if (projectId) q = q.eq('project_id', projectId);
  if (from) q = q.gte('acc_journal.date_g', from);
  if (to) q = q.lte('acc_journal.date_g', to);
  const { data, error } = await q;
  if (error) throw error;

  type RawLine = {
    entry_id: string; account_code: string; account_title: string;
    debit: number | null; credit: number | null; line_desc: string | null;
    detail_id: string | null; project_id: string | null;
    acc_journal: {
      id: string; entry_no: number; date_g: string; description: string | null;
      voided_at: string | null; ref_action: string;
    } | null;
    acc_details: { title: string } | null;
    acc_projects: { name: string } | null;
  };
  const raw = (data || []) as unknown as RawLine[];
  const rows: LedgerRow[] = raw
    .filter((l) => l.acc_journal && !l.acc_journal.voided_at && l.acc_journal.ref_action !== 'reverse')
    .sort((a, b) => (a.acc_journal!.date_g < b.acc_journal!.date_g ? -1 : a.acc_journal!.date_g > b.acc_journal!.date_g ? 1 : a.acc_journal!.entry_no - b.acc_journal!.entry_no))
    .map((l) => ({
      entry_id: l.entry_id,
      entry_no: num(l.acc_journal!.entry_no),
      date_g: l.acc_journal!.date_g,
      description: l.acc_journal!.description,
      line_desc: l.line_desc,
      account_code: l.account_code,
      account_title: l.account_title,
      detail_title: l.acc_details?.title || null,
      project_name: l.acc_projects?.name || null,
      debit: num(l.debit), credit: num(l.credit),
      running: 0,
    }));

  /* مانده افتتاحیه = گردش قبل از from */
  let opening = 0;
  if (from) {
    let q0 = supabase
      .from('acc_journal_lines')
      .select('debit, credit, acc_journal!inner(date_g, voided_at, ref_action)')
      .eq('business_id', businessId)
      .like('account_code', `${codePrefix}%`)
      .lt('acc_journal.date_g', from);
    if (detailId) q0 = q0.eq('detail_id', detailId);
    if (projectId) q0 = q0.eq('project_id', projectId);
    const { data: pre } = await q0;
    for (const l of (pre || []) as unknown as { debit: number | null; credit: number | null; acc_journal: { voided_at: string | null; ref_action: string } }[]) {
      if (l.acc_journal.voided_at || l.acc_journal.ref_action === 'reverse') continue;
      opening += signed(num(l.debit), num(l.credit), nature);
    }
  }

  let running = opening;
  let td = 0; let tc = 0;
  for (const r of rows) {
    running += signed(r.debit, r.credit, nature);
    r.running = running;
    td += r.debit; tc += r.credit;
  }
  return { code: codePrefix, title, nature, opening, rows, totalDebit: td, totalCredit: tc, closing: running };
}

/* ═══════════════════════ ۵) تراز آزمایشی ۲/۴/۶ ستونی + دفتر معین/تفصیلی ═══════════════════════ */

/** تراز آزمایشی چندستونی — aggregation تا سطح دلخواه کدینگ */
export async function trialBalanceMulti(
  businessId: string,
  from?: string,
  to?: string,
  level = 1,
): Promise<TrialBalance6Row[]> {
  const { data: chart } = await supabase
    .from('acc_chart').select('id, code, title, kind, nature, level, parent_id')
    .or(`business_id.is.null,business_id.eq.${businessId}`);
  const chartRows = (chart || []) as { id: string; code: string; title: string; kind: string; nature: string | null; level: number | null; parent_id: string | null }[];
  const byCode = new Map(chartRows.map((c) => [c.code, c]));
  const byId = new Map(chartRows.map((c) => [c.id, c]));

  /* نقشه roll-up: هر کد → کدِ نماینده در سطح هدف (پیمایش زنجیره والد) */
  const rollTo = new Map<string, string>();
  for (const c of chartRows) {
    let node = c;
    while (num(node.level) > level && node.parent_id) {
      const p = byId.get(node.parent_id);
      if (!p) break;
      node = p;
    }
    rollTo.set(c.code, num(node.level) > level ? c.code : node.code);
  }

  let q = supabase
    .from('acc_journal_lines')
    .select('account_code, debit, credit, acc_journal!inner(date_g, voided_at, ref_action)')
    .eq('business_id', businessId);
  if (from) q = q.gte('acc_journal.date_g', from);
  if (to) q = q.lte('acc_journal.date_g', to);
  const { data, error } = await q;
  if (error) throw error;
  type Raw = { account_code: string; debit: number | null; credit: number | null; acc_journal: { date_g: string; voided_at: string | null; ref_action: string } };
  const raw = ((data || []) as unknown as Raw[]).filter((l) => !l.acc_journal.voided_at && l.acc_journal.ref_action !== 'reverse');

  const agg = new Map<string, { title: string; kind: string; oD: number; oC: number; pD: number; pC: number }>();
  const bucket = (code: string) => {
    const target = rollTo.get(code) || code;
    if (!agg.has(target)) {
      const meta = byCode.get(target);
      agg.set(target, { title: meta?.title || target, kind: meta?.kind || (target.startsWith('4') ? 'income' : target.startsWith('5') ? 'expense' : 'asset'), oD: 0, oC: 0, pD: 0, pC: 0 });
    }
    return agg.get(target)!;
  };

  /* گردش قبل از from → افتتاحیه */
  if (from) {
    let q0 = supabase
      .from('acc_journal_lines')
      .select('account_code, debit, credit, acc_journal!inner(date_g, voided_at, ref_action)')
      .eq('business_id', businessId)
      .lt('acc_journal.date_g', from);
    const { data: pre } = await q0;
    for (const l of ((pre || []) as unknown as Raw[])) {
      if (l.acc_journal.voided_at || l.acc_journal.ref_action === 'reverse') continue;
      const b = bucket(l.account_code);
      b.oD += num(l.debit); b.oC += num(l.credit);
    }
  }
  for (const l of raw) {
    const b = bucket(l.account_code);
    b.pD += num(l.debit); b.pC += num(l.credit);
  }

  const rows: TrialBalance6Row[] = [];
  for (const [code, v] of [...agg.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const kind = v.kind;
    const debitLike = kind === 'asset' || kind === 'expense';
    const oNet = v.oD - v.oC;
    const cNet = v.oD + v.pD - (v.oC + v.pC);
    rows.push({
      code, title: v.title,
      openingDebit: oNet > 0 && debitLike ? oNet : 0,
      openingCredit: oNet < 0 && !debitLike ? -oNet : 0,
      periodDebit: v.pD, periodCredit: v.pC,
      closingDebit: cNet > 0 ? cNet : 0,
      closingCredit: cNet < 0 ? -cNet : 0,
    });
  }
  return rows;
}

/** دفتر معین — کارت گردش زیرمجموعه‌های یک سرفصل */
export async function moyanLedger(businessId: string, parentCode: string, from?: string, to?: string) {
  const { data: kids } = await supabase
    .from('acc_chart').select('code, title')
    .or(`business_id.is.null,business_id.eq.${businessId}`)
    .like('code', `${parentCode}%`).neq('code', parentCode);
  const cards = [];
  for (const k of kids || []) {
    const card = await accountCard(businessId, k.code as string, from, to);
    if (card.rows.length || card.opening !== 0) cards.push(card);
  }
  return cards;
}

/** دفتر تفصیلی — گردش یک حساب با تفصیلی شناور مشخص */
export async function tafsilLedger(businessId: string, detailId: string, codePrefix?: string, from?: string, to?: string) {
  const { data: det } = await supabase.from('acc_details').select('title, kind').eq('id', detailId).maybeSingle();
  const card = await accountCard(businessId, codePrefix || '', from, to, detailId);
  return { detail: det, card };
}

/* ═══════════════════════ ۶) تنخواه‌گردان ═══════════════════════ */

export async function listPetty(businessId: string): Promise<AccPetty[]> {
  const { data, error } = await supabase
    .from('acc_petty')
    .select('*, acc_petty_ops(*)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data || []) as AccPetty[]).map((p) => ({
    ...p,
    charge_total: num(p.charge_total), spent_total: num(p.spent_total), settled_total: num(p.settled_total),
  }));
}

/** ایجاد تنخواه + سند شارژ اولیه (اختیاری) */
export async function savePetty(
  businessId: string,
  input: { id?: string; name: string; custodian?: string | null; source_account_id?: string | null; description?: string | null },
): Promise<string> {
  if (input.id) {
    const { error } = await supabase.from('acc_petty').update({
      name: input.name.trim(), custodian: input.custodian ?? null,
      source_account_id: input.source_account_id ?? null, description: input.description ?? null,
    }).eq('id', input.id);
    if (error) throw error;
    return input.id;
  }
  await ensureChartCode(businessId, CODE_PETTY, 'تنخواه‌گردان', 'asset', 1);
  const { data, error } = await supabase.from('acc_petty').insert({
    business_id: businessId, name: input.name.trim(),
    custodian: input.custodian || null, source_account_id: input.source_account_id ?? null,
    description: input.description || null,
  }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

async function accountTitle(businessId: string, accountId: string): Promise<string> {
  const { data } = await supabase.from('acc_accounts').select('name').eq('id', accountId).maybeSingle();
  return data?.name || 'صندوق/بانک';
}

/** شارژ تنخواه: بدهکار تنخواه‌گردان / بستانکار بانک یا صندوق */
export async function pettyCharge(
  businessId: string,
  pettyId: string,
  input: { amount: number; date_g: string; description?: string },
): Promise<string> {
  if (input.amount <= 0) throw new Error('مبلغ شارژ باید مثبت باشد');
  const { data: petty } = await supabase.from('acc_petty').select('*').eq('id', pettyId).maybeSingle();
  if (!petty) throw new Error('تنخواه یافت نشد');
  if (petty.status !== 'open') throw new Error('تنخواه بسته شده است');
  const srcTitle = petty.source_account_id ? await accountTitle(businessId, petty.source_account_id) : 'موجودی نقد و بانک — بانک';
  const journalId = await insertEntry(businessId, {
    date_g: input.date_g,
    description: input.description || `شارژ تنخواه‌گردان «${petty.name}»`,
    ref_type: 'petty', ref_id: pettyId,
  }, [
    { account_code: CODE_PETTY, account_title: 'تنخواه‌گردان', debit: input.amount, credit: 0, line_desc: `شارژ تنخواه ${petty.name}` },
    { account_code: petty.source_account_id ? '1102' : '1102', account_title: srcTitle, debit: 0, credit: input.amount, line_desc: `پرداخت از ${srcTitle}` },
  ]);
  const { error: opErr } = await supabase.from('acc_petty_ops').insert({
    business_id: businessId, petty_id: pettyId, kind: 'charge',
    amount: input.amount, date_g: input.date_g,
    description: input.description || 'شارژ تنخواه', journal_id: journalId,
  });
  if (opErr) throw opErr;
  const { error: upErr } = await supabase.from('acc_petty').update({
    charge_total: num(petty.charge_total) + input.amount,
  }).eq('id', pettyId);
  if (upErr) throw upErr;
  return journalId;
}

/** هزینه‌کرد از تنخواه: بدهکار سرفصل هزینه / بستانکار تنخواه‌گردان */
export async function pettySpend(
  businessId: string,
  pettyId: string,
  input: { amount: number; date_g: string; chart_code: string; chart_title: string; description: string; project_id?: string | null; detail_id?: string | null },
): Promise<string> {
  if (input.amount <= 0) throw new Error('مبلغ هزینه باید مثبت باشد');
  const { data: petty } = await supabase.from('acc_petty').select('*').eq('id', pettyId).maybeSingle();
  if (!petty) throw new Error('تنخواه یافت نشد');
  const journalId = await insertEntry(businessId, {
    date_g: input.date_g,
    description: input.description || `هزینه‌کرد تنخواه «${petty.name}»`,
    ref_type: 'petty', ref_id: pettyId,
  }, [
    { account_code: input.chart_code, account_title: input.chart_title, debit: input.amount, credit: 0, project_id: input.project_id ?? null, detail_id: input.detail_id ?? null, line_desc: input.description },
    { account_code: CODE_PETTY, account_title: 'تنخواه‌گردان', debit: 0, credit: input.amount, line_desc: `هزینه‌کرد از تنخواه ${petty.name}` },
  ]);
  const { error: opErr } = await supabase.from('acc_petty_ops').insert({
    business_id: businessId, petty_id: pettyId, kind: 'spend',
    amount: input.amount, date_g: input.date_g,
    chart_code: input.chart_code, chart_title: input.chart_title,
    description: input.description, journal_id: journalId,
  });
  if (opErr) throw opErr;
  const { error: upErr } = await supabase.from('acc_petty').update({
    spent_total: num(petty.spent_total) + input.amount,
  }).eq('id', pettyId);
  if (upErr) throw upErr;
  return journalId;
}

/** تسویه تنخواه: برگشت باقیمانده به بانک/صندوق و بستن دوره تنخواه */
export async function pettySettle(
  businessId: string,
  pettyId: string,
  input: { returned_amount: number; date_g: string; description?: string },
): Promise<string> {
  const { data: petty } = await supabase.from('acc_petty').select('*').eq('id', pettyId).maybeSingle();
  if (!petty) throw new Error('تنخواه یافت نشد');
  if (input.returned_amount < 0) throw new Error('مبلغ برگشتی نامعتبر است');
  const srcTitle = petty.source_account_id ? await accountTitle(businessId, petty.source_account_id) : 'موجودی نقد و بانک — بانک';
  let journalId: string | null = null;
  if (input.returned_amount > 0) {
    journalId = await insertEntry(businessId, {
      date_g: input.date_g,
      description: input.description || `تسویه تنخواه‌گردان «${petty.name}»`,
      ref_type: 'petty', ref_id: pettyId,
    }, [
      { account_code: '1102', account_title: srcTitle, debit: input.returned_amount, credit: 0, line_desc: `برگشت مازاد تنخواه ${petty.name}` },
      { account_code: CODE_PETTY, account_title: 'تنخواه‌گردان', debit: 0, credit: input.returned_amount, line_desc: `تسویه تنخواه ${petty.name}` },
    ]);
  }
  const { error: opErr } = await supabase.from('acc_petty_ops').insert({
    business_id: businessId, petty_id: pettyId, kind: 'settle',
    amount: input.returned_amount, date_g: input.date_g,
    description: input.description || 'تسویه و بستن تنخواه', journal_id: journalId,
  });
  if (opErr) throw opErr;
  const { error: upErr } = await supabase.from('acc_petty').update({
    settled_total: num(petty.settled_total) + input.returned_amount,
    status: 'settled',
  }).eq('id', pettyId);
  if (upErr) throw upErr;
  return journalId || 'no-journal';
}

export async function deletePetty(pettyId: string): Promise<void> {
  const { data: ops } = await supabase.from('acc_petty_ops').select('id').eq('petty_id', pettyId).limit(1);
  if (ops && ops.length) throw new Error('تنخواه با گردش قابل حذف نیست — ابتدا ابطال کنید');
  const { error } = await supabase.from('acc_petty').delete().eq('id', pettyId);
  if (error) throw error;
}

/* ═══════════════════════ ۷) پیش‌دریافت و پیش‌پرداخت ═══════════════════════ */

export async function listPrepay(businessId: string): Promise<AccPrepayment[]> {
  const { data, error } = await supabase
    .from('acc_prepayments')
    .select('*, partner:acc_partners(id, name), account:acc_accounts(id, name, kind)')
    .eq('business_id', businessId)
    .order('date_g', { ascending: false });
  if (error) throw error;
  return ((data || []) as AccPrepayment[]).map((p) => ({
    ...p, amount: num(p.amount), allocated_amount: num(p.allocated_amount),
  }));
}

/** ثبت پیش‌دریافت/پیش‌پرداخت + سند دوبل جدا از بدهی/طلب عادی */
export async function savePrepay(
  businessId: string,
  input: { kind: 'advance_received' | 'advance_paid'; partner_id: string | null; account_id: string | null; amount: number; date_g: string; description?: string },
): Promise<string> {
  if (input.amount <= 0) throw new Error('مبلغ باید مثبت باشد');
  await ensureChartCode(businessId, CODE_ADV_RECV, 'پیش‌دریافت از مشتریان', 'liability', 1);
  await ensureChartCode(businessId, CODE_ADV_PAID, 'پیش‌پرداخت به تامین‌کنندگان', 'asset', 1);
  const accTitle = await accountTitle(businessId, input.account_id || '');
  const isRecv = input.kind === 'advance_received';
  const partnerName = input.partner_id ? (await supabase.from('acc_partners').select('name').eq('id', input.partner_id).maybeSingle()).data?.name || '' : '';
  const desc = input.description || (isRecv ? `پیش‌دریافت از ${partnerName || 'مشتری'}` : `پیش‌پرداخت به ${partnerName || 'تامین‌کننده'}`);
  const journalId = await insertEntry(businessId, { date_g: input.date_g, description: desc, ref_type: 'prepay' }, isRecv ? [
    { account_code: '1102', account_title: accTitle, debit: input.amount, credit: 0, detail_id: null, line_desc: desc },
    { account_code: CODE_ADV_RECV, account_title: 'پیش‌دریافت از مشتریان', debit: 0, credit: input.amount, detail_id: null, line_desc: desc },
  ] : [
    { account_code: CODE_ADV_PAID, account_title: 'پیش‌پرداخت به تامین‌کنندگان', debit: input.amount, credit: 0, detail_id: null, line_desc: desc },
    { account_code: '1102', account_title: accTitle, debit: 0, credit: input.amount, detail_id: null, line_desc: desc },
  ]);
  const { data, error } = await supabase.from('acc_prepayments').insert({
    business_id: businessId, kind: input.kind,
    partner_id: input.partner_id ?? null, account_id: input.account_id ?? null,
    amount: input.amount, date_g: input.date_g,
    description: desc, journal_id: journalId,
  }).select('id').single();
  if ( error) throw error;
  return data.id as string;
}

/** تخصیص پیش‌دریافت به فاکتور / پیش‌پرداخت به هزینه — با سند تسویه */
export async function allocatePrepay(
  businessId: string,
  prepayId: string,
  target: { invoice_id?: string; expense_id?: string },
): Promise<void> {
  const { data: pre } = await supabase.from('acc_prepayments').select('*').eq('id', prepayId).maybeSingle();
  if (!pre) throw new Error('پیش‌دریافت/پیش‌پرداخت یافت نشد');
  if (pre.status !== 'open') throw new Error('این ردیف قبلاً تخصیص یافته یا بسته شده است');
  const remaining = num(pre.amount) - num(pre.allocated_amount);
  if (remaining <= 0) throw new Error('مبلغ قابل تخصیص باقی نمانده است');

  let settleAmount = remaining;
  let desc = '';
  let lines: JournalLineV2[];
  const patch: Record<string, unknown> = { allocated_amount: num(pre.allocated_amount) + settleAmount, status: 'allocated' };

  if (target.invoice_id) {
    const { data: inv } = await supabase.from('acc_invoices').select('number, total, paid_total').eq('id', target.invoice_id).maybeSingle();
    if (!inv) throw new Error('فاکتور یافت نشد');
    settleAmount = Math.min(remaining, Math.max(0, num(inv.total) - num(inv.paid_total)));
    if (settleAmount <= 0) throw new Error('این فاکتور تسویه کامل شده است');
    desc = `تسویه فاکتور ${inv.number} از پیش‌دریافت`;
    /* بدهکار پیش‌دریافت / بستانکار حساب‌های دریافتنی */
    lines = [
      { account_code: CODE_ADV_RECV, account_title: 'پیش‌دریافت از مشتریان', debit: settleAmount, credit: 0, line_desc: desc },
      { account_code: CODE_AR, account_title: 'حساب‌های دریافتنی تجاری', debit: 0, credit: settleAmount, line_desc: desc },
    ];
    /* افزایش paid_total فاکتور */
    await supabase.from('acc_invoices').update({ paid_total: num(inv.paid_total) + settleAmount }).eq('id', target.invoice_id);
    patch.invoice_id = target.invoice_id;
  } else if (target.expense_id) {
    const { data: exp } = await supabase.from('acc_expenses').select('title, amount, is_paid').eq('id', target.expense_id).maybeSingle();
    if (!exp) throw new Error('هزینه یافت نشد');
    settleAmount = Math.min(remaining, num(exp.amount));
    desc = `تسویه هزینه «${exp.title}» از پیش‌پرداخت`;
    /* بدهکار حساب‌های پرداختنی / بستانکار پیش‌پرداخت */
    lines = [
      { account_code: CODE_AP, account_title: 'حساب‌های پرداختنی تجاری', debit: settleAmount, credit: 0, line_desc: desc },
      { account_code: CODE_ADV_PAID, account_title: 'پیش‌پرداخت به تامین‌کنندگان', debit: 0, credit: settleAmount, line_desc: desc },
    ];
    patch.expense_id = target.expense_id;
  } else {
    throw new Error('مقصد تخصیص مشخص نیست');
  }
  const journalId = await insertEntry(businessId, { date_g: new Date().toISOString().slice(0, 10), description: desc, ref_type: 'prepay', ref_id: prepayId }, lines);
  patch.journal_id = journalId;
  const { error } = await supabase.from('acc_prepayments').update(patch).eq('id', prepayId);
  if (error) throw error;
}

export async function voidPrepay(businessId: string, prepayId: string, reason: string): Promise<void> {
  const { data: pre } = await supabase.from('acc_prepayments').select('*').eq('id', prepayId).maybeSingle();
  if (!pre) throw new Error('یافت نشد');
  if (pre.voided_at) return;
  if (num(pre.allocated_amount) > 0) throw new Error('اول تخصیص را لغو کنید');
  if (pre.journal_id) await voidJournal(businessId, pre.journal_id, reason || 'ابطال پیش‌دریافت');
  const { error } = await supabase.from('acc_prepayments').update({
    voided_at: new Date().toISOString(), void_reason: reason || null, status: 'void',
  }).eq('id', prepayId);
  if (error) throw error;
}

export async function deletePrepayFull(prepayId: string): Promise<void> {
  const { data: pre } = await supabase.from('acc_prepayments').select('allocated_amount, journal_id').eq('id', prepayId).maybeSingle();
  if (!pre) return;
  if (num(pre.allocated_amount) > 0) throw new Error('پیش‌دریافت تخصیص‌یافته قابل حذف نیست — ابطال کنید');
  if (pre.journal_id) {
    await supabase.from('acc_journal_lines').delete().eq('entry_id', pre.journal_id);
    await supabase.from('acc_journal').delete().eq('id', pre.journal_id);
  }
  const { error } = await supabase.from('acc_prepayments').delete().eq('id', prepayId);
  if (error) throw error;
}

/* ═══════════════════════ ۸) مغایرت بانکی واقعی ═══════════════════════ */

export async function listBankLines(businessId: string, accountId: string): Promise<AccBankLine[]> {
  const { data, error } = await supabase
    .from('acc_bank_lines')
    .select('*')
    .eq('business_id', businessId).eq('account_id', accountId)
    .order('date_g');
  if (error) throw error;
  return ((data || []) as AccBankLine[]).map((l) => ({ ...l, amount: num(l.amount) }));
}

export async function deleteBankLine(lineId: string): Promise<void> {
  const { error } = await supabase.from('acc_bank_lines').delete().eq('id', lineId);
  if (error) throw error;
}

/**
 * ورود گروهی خطوط صورت‌حساب بانک — هر خط: تاریخ | شرح | مبلغ
 * مبلغ منفی = برداشت، مثبت = واریز. جداکننده‌ها: | یا ; یا Tab
 */
export async function importBankLines(
  businessId: string,
  accountId: string,
  text: string,
): Promise<{ inserted: number; skipped: number }> {
  const batchId = crypto.randomUUID();
  const rows: Record<string, unknown>[] = [];
  let skipped = 0;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/\t|\||;/).map((s) => s.trim()).filter(Boolean);
    if (parts.length < 2) { skipped++; continue; }
    /* قالب: تاریخ شرح مبلغ | یا تاریخ مبلغ */
    let dateG = ''; let desc = ''; let amount = NaN;
    if (parts.length >= 3) { dateG = parts[0]; desc = parts[1]; amount = toAmount(parts[2]); }
    else { dateG = parts[0]; amount = toAmount(parts[1]); }
    if (!dateG || !Number.isFinite(amount)) { skipped++; continue; }
    const iso = normalizeDate(dateG);
    if (!iso) { skipped++; continue; }
    rows.push({
      business_id: businessId, account_id: accountId, date_g: iso,
      description: desc || null, amount: Math.round(amount),
      match_status: 'unmatched', batch_id: batchId,
    });
  }
  if (!rows.length) return { inserted: 0, skipped };
  const { error } = await supabase.from('acc_bank_lines').insert(rows);
  if (error) throw error;
  return { inserted: rows.length, skipped };
}

function toAmount(s: string): number {
  const cleaned = s.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[,،\s]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function normalizeDate(s: string): string | null {
  /* ISO مستقیم */
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  /* جلالی ۱۴۰۵/۰۶/۲۷ یا ۱۴۰۵-۰۶-۲۷ یا 14050627 */
  const m = s.match(/^(1[34]\d{2})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (m) {
    try {
      const g = toGregorian(Number(m[1]), Number(m[2]), Number(m[3]));
      return `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
    } catch { return null; }
  }
  return null;
}

/**
 * تطبیق خودکار: هر خط بانک با دریافت/پرداخت دفتر (هم‌مبلغ در بازه ±۷ روز) جور می‌شود
 * خطوط بدون جفت → unmatched (واریز/برداشت شناسایی‌نشده)
 */
export async function autoMatchBankLines(businessId: string, accountId: string): Promise<{ matched: number; remaining: number }> {
  const lines = await listBankLines(businessId, accountId).then((ls) => ls.filter((l) => l.match_status === 'unmatched'));
  const { data: txs } = await supabase
    .from('acc_transactions')
    .select('id, kind, amount, date_g, description, voided_at')
    .eq('business_id', businessId)
    .or(`account_id.eq.${accountId},account_id.is.null`)
    .order('date_g');
  const pool = (txs || [] as { id: string; kind: string; amount: number; date_g: string; voided_at: string | null }[])
    .filter((t) => !t.voided_at)
    .map((t) => ({ ...t, used: false, amount: num(t.amount) }));
  const dayMs = 86400000;
  let matched = 0;
  for (const line of lines) {
    const sign = line.amount >= 0 ? 'receipt' : 'payment';
    const abs = Math.abs(line.amount);
    const lineT = new Date(line.date_g).getTime();
    const cand = pool
      .filter((t) => !t.used && t.kind === sign && t.amount === abs && Math.abs(new Date(t.date_g).getTime() - lineT) <= 7 * dayMs)
      .sort((a, b) => Math.abs(new Date(a.date_g).getTime() - lineT) - Math.abs(new Date(b.date_g).getTime() - lineT))[0];
    if (cand) {
      cand.used = true;
      matched++;
      await supabase.from('acc_bank_lines').update({
        match_status: 'auto', match_entity_type: 'transaction', match_entity_id: cand.id, matched_at: new Date().toISOString(),
      }).eq('id', line.id);
    }
  }
  const { count } = await supabase
    .from('acc_bank_lines')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId).eq('account_id', accountId).eq('match_status', 'unmatched');
  return { matched, remaining: count || 0 };
}

/** تطبیق دستی یک خط بانک با یک سند دفتری */
export async function manualMatchBankLine(lineId: string, entityType: string, entityId: string): Promise<void> {
  const { error } = await supabase.from('acc_bank_lines').update({
    match_status: 'manual', match_entity_type: entityType, match_entity_id: entityId, matched_at: new Date().toISOString(),
  }).eq('id', lineId);
  if (error) throw error;
}

export async function unmatchBankLine(lineId: string): Promise<void> {
  const { error } = await supabase.from('acc_bank_lines').update({
    match_status: 'unmatched', match_entity_type: null, match_entity_id: null, matched_at: null,
  }).eq('id', lineId);
  if (error) throw error;
}

/** خلاصه مغایرت: مانده دفتر vs مانده بانک + فهرست موارد باز از دو طرف */
export async function bankReconSummary(businessId: string, accountId: string, statementOpening = 0): Promise<ReconSummary> {
  const { data: acc } = await supabase.from('acc_accounts').select('*').eq('id', accountId).maybeSingle();
  const { data: txs } = await supabase
    .from('acc_transactions')
    .select('id, kind, amount, date_g, description, voided_at')
    .eq('business_id', businessId).eq('account_id', accountId).order('date_g');
  const lines = await listBankLines(businessId, accountId);

  const bookTxs = (txs || [] as { id: string; kind: string; amount: number; date_g: string; description: string | null; voided_at: string | null }[]).filter((t) => !t.voided_at);
  const matchedIds = new Set(lines.filter((l) => l.match_entity_id).map((l) => l.match_entity_id as string));

  const bookBalance = num(acc?.initial_balance) + bookTxs.reduce((s, t) => s + (t.kind === 'receipt' ? num(t.amount) : -num(t.amount)), 0);
  const bankBalance = statementOpening + lines.reduce((s, l) => s + l.amount, 0);

  const bookUnmatched = bookTxs
    .filter((t) => !matchedIds.has(t.id))
    .map((t) => ({ id: t.id, date_g: t.date_g, description: t.description, amount: t.kind === 'receipt' ? num(t.amount) : -num(t.amount), kind: t.kind }));

  return {
    accountId, bookBalance, bankBalance,
    bankUnmatched: lines.filter((l) => l.match_status === 'unmatched'),
    bookUnmatched,
    difference: bankBalance - bookBalance,
  };
}

/* ═══════════════════════ ۹) دوره مالی — بستن و افتتاح ═══════════════════════ */

export async function listFiscalYears(businessId: string): Promise<AccFiscalYear[]> {
  const { data, error } = await supabase
    .from('acc_fiscal_years')
    .select('*')
    .eq('business_id', businessId)
    .order('jyear', { ascending: false });
  if (error) throw error;
  return (data || []) as AccFiscalYear[];
}

export interface YearCloseResultV2 {
  jyear: number;
  closingEntryNo: number;
  revenueTotal: number;
  expenseTotal: number;
  netProfit: number;
  closedAccounts: number;
}

/** بستن دوره مالی — بستن تک‌تک حساب‌های موقت به سود (زیان) انباشته */
export async function closeFiscalYearV2(businessId: string, jyear: number): Promise<YearCloseResultV2> {
  const range = jalaliYearRange(jyear);
  const { data: journal } = await supabase
    .from('acc_journal')
    .select('acc_journal_lines(account_code, debit, credit)')
    .eq('business_id', businessId)
    .gte('date_g', range.from)
    .lte('date_g', range.to)
    .is('voided_at', null)
    .neq('ref_action', 'reverse');
  type Line = { account_code: string; debit: number | null; credit: number | null };
  const lines = ((journal || []) as { acc_journal_lines: Line[] | null }[]).flatMap((j) => j.acc_journal_lines || []);

  const { data: chart } = await supabase
    .from('acc_chart').select('code, title, kind')
    .or(`business_id.is.null,business_id.eq.${businessId}`);
  const kindOf = new Map((chart || []).map((c) => [c.code as string, c.kind as string]));

  /* گردش هر حساب درآمد/هزینه */
  const revMap = new Map<string, { title: string; net: number }>();
  const expMap = new Map<string, { title: string; net: number }>();
  for (const l of lines) {
    const kind = kindOf.get(l.account_code) || (l.account_code.startsWith('4') ? 'income' : l.account_code.startsWith('5') ? 'expense' : '');
    const net = kindOf.get(l.account_code) === 'income' || (!kindOf.has(l.account_code) && l.account_code.startsWith('4'))
      ? num(l.credit) - num(l.debit)
      : num(l.debit) - num(l.credit);
    if (kind === 'income') {
      const cur = revMap.get(l.account_code) || { title: l.account_code, net: 0 };
      cur.net += net; revMap.set(l.account_code, cur);
    } else if (kind === 'expense') {
      const cur = expMap.get(l.account_code) || { title: l.account_code, net: 0 };
      cur.net += net; expMap.set(l.account_code, cur);
    }
  }
  /* عنوان سرفصل‌ها */
  for (const [code, v] of revMap) v.title = (chart || []).find((c) => c.code === code)?.title || code;
  for (const [code, v] of expMap) v.title = (chart || []).find((c) => c.code === code)?.title || code;

  const revenueTotal = [...revMap.values()].reduce((s, v) => s + v.net, 0);
  const expenseTotal = [...expMap.values()].reduce((s, v) => s + v.net, 0);
  const netProfit = revenueTotal - expenseTotal;
  if (!revMap.size && !expMap.size) throw new Error('در این سال گردش درآمد/هزینه‌ای برای بستن وجود ندارد');

  const closingLines: JournalLineV2[] = [];
  for (const [code, v] of revMap) {
    if (v.net > 0) closingLines.push({ account_code: code, account_title: v.title, debit: v.net, credit: 0, line_desc: 'بستن حساب موقت درآمد' });
  }
  for (const [code, v] of expMap) {
    if (v.net > 0) closingLines.push({ account_code: code, account_title: v.title, debit: 0, credit: v.net, line_desc: 'بستن حساب موقت هزینه' });
  }
  closingLines.push({
    account_code: CODE_RETAINED, account_title: 'سود (زیان) انباشته',
    debit: netProfit >= 0 ? 0 : -netProfit,
    credit: netProfit >= 0 ? netProfit : 0,
    line_desc: `نتیجه عملکرد سال ${jyear}`,
  });

  const entryNo = await nextEntryNo(businessId);
  await ensureChartCode(businessId, CODE_RETAINED, 'سود (زیان) انباشته', 'equity', 1);
  const closingId = await insertEntry(businessId, {
    date_g: range.to, description: `سند اختتامیه سال مالی ${jyear}`, ref_type: 'closing',
  }, closingLines);

  /* قفل همه دوره‌های ماهانه سال */
  for (let m = 1; m <= 12; m++) {
    await supabase.from('acc_periods').upsert(
      { business_id: businessId, jyear, jmonth: m, locked: true },
      { onConflict: 'business_id,jyear,jmonth' },
    );
  }
  /* ثبت/به‌روزرسانی ردیف دوره مالی */
  const { data: fy } = await supabase
    .from('acc_fiscal_years').select('id').eq('business_id', businessId).eq('jyear', jyear).maybeSingle();
  if (fy) {
    await supabase.from('acc_fiscal_years').update({
      status: 'closed', closing_entry_id: closingId, closed_at: new Date().toISOString(),
    }).eq('id', fy.id);
  } else {
    await supabase.from('acc_fiscal_years').insert({
      business_id: businessId, jyear, status: 'closed', closing_entry_id: closingId, closed_at: new Date().toISOString(),
    });
  }
  return { jyear, closingEntryNo: entryNo, revenueTotal, expenseTotal, netProfit, closedAccounts: revMap.size + expMap.size };
}

/** انتقال مانده حساب‌های دائم سال قبل به سال جدید (سند افتتاحیه سال بعد) */
export async function openNextYear(businessId: string, jyear: number): Promise<{ entryNo: number; movedAccounts: number }> {
  const prev = jalaliYearRange(jyear);
  const { data: fy } = await supabase
    .from('acc_fiscal_years').select('id, status').eq('business_id', businessId).eq('jyear', jyear).maybeSingle();
  if (!fy || fy.status !== 'closed') throw new Error('اول باید سال گذشته را ببندید');

  /* مانده هر حساب ترازنامه در پایان سال قبل */
  const { data: lines } = await supabase
    .from('acc_journal_lines')
    .select('account_code, account_title, debit, credit, acc_journal!inner(date_g, voided_at, ref_action)')
    .eq('business_id', businessId)
    .lte('acc_journal.date_g', prev.to);
  const { data: chart } = await supabase
    .from('acc_chart').select('code, title, kind, nature')
    .or(`business_id.is.null,business_id.eq.${businessId}`);
  const chartRows = (chart || []) as { code: string; title: string; kind: string; nature: string | null }[];
  const kindOf = new Map(chartRows.map((c) => [c.code as string, c.kind as string]));

  const balances = new Map<string, { title: string; net: number }>();
  for (const l of (lines || []) as unknown as { account_code: string; account_title: string; debit: number | null; credit: number | null; acc_journal: { voided_at: string | null; ref_action: string } }[]) {
    if (l.acc_journal.voided_at || l.acc_journal.ref_action === 'reverse') continue;
    const kind = kindOf.get(l.account_code) || '';
    if (kind === 'income' || kind === 'expense') continue; /* موقت‌ها بسته شده‌اند */
    const net = num(l.debit) - num(l.credit);
    const cur = balances.get(l.account_code) || { title: l.account_title, net: 0 };
    cur.net += net;
    balances.set(l.account_code, cur);
  }
  const openLines: JournalLineV2[] = [];
  for (const [code, v] of [...balances.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (Math.abs(v.net) < 1) continue;
    openLines.push({
      account_code: code, account_title: v.title,
      debit: v.net > 0 ? v.net : 0, credit: v.net < 0 ? -v.net : 0,
      line_desc: 'انتقال مانده از سال قبل',
    });
  }
  if (!openLines.length) throw new Error('مانده دائمی برای افتتاح وجود ندارد');
  const entryNo = await nextEntryNo(businessId);
  const openingId = await insertEntry(businessId, {
    date_g: jalaliYearRange(jyear + 1).from, description: `سند افتتاحیه سال مالی ${jyear + 1}`, ref_type: 'opening',
  }, openLines);

  const { data: nextFy } = await supabase
    .from('acc_fiscal_years').select('id').eq('business_id', businessId).eq('jyear', jyear + 1).maybeSingle();
  if (nextFy) {
    await supabase.from('acc_fiscal_years').update({ opening_entry_id: openingId }).eq('id', nextFy.id);
  } else {
    await supabase.from('acc_fiscal_years').insert({
      business_id: businessId, jyear: jyear + 1, status: 'open', opening_entry_id: openingId,
    });
  }
  return { entryNo, movedAccounts: openLines.length };
}

/** سند افتتاحیه دستی — ورود مانده‌های ابتدای دوره (بانک، صندوق، مطالبات، بدهی‌ها، سرمایه) */
export async function saveOpeningEntry(
  businessId: string,
  jyear: number,
  rows: { account_code: string; account_title: string; debit: number; credit: number; detail_id?: string | null }[],
): Promise<string> {
  const d = rows.reduce((s, r) => s + num(r.debit), 0);
  const c = rows.reduce((s, r) => s + num(r.credit), 0);
  if (Math.abs(d - c) > 1) throw new Error('مانده‌های افتتاحیه تراز نیستند — بدهکار و بستانکار باید برابر شود');
  if (d <= 0) throw new Error('حداقل یک مانده وارد کنید');
  const entryNo = await nextEntryNo(businessId);
  const id = await insertEntry(businessId, {
    date_g: jalaliYearRange(jyear).from,
    description: `سند افتتاحیه دستی — مانده‌های ابتدای سال ${jyear}`,
    ref_type: 'opening',
  }, rows);
  const { data: fy } = await supabase
    .from('acc_fiscal_years').select('id').eq('business_id', businessId).eq('jyear', jyear).maybeSingle();
  if (fy) await supabase.from('acc_fiscal_years').update({ opening_entry_id: id }).eq('id', fy.id);
  else await supabase.from('acc_fiscal_years').insert({ business_id: businessId, jyear, status: 'open', opening_entry_id: id });
  return id;
}

/* ═══════════════════════ ۱۰) ضمائم همه اسناد ═══════════════════════ */

export const ENTITY_LABELS: Record<string, string> = {
  invoice: 'فاکتور', journal: 'سند حسابداری', transaction: 'دریافت/پرداخت',
  check: 'چک', contract: 'قرارداد', expense: 'هزینه', payroll: 'حقوق',
  asset: 'دارایی', prepay: 'پیش‌دریافت/پرداخت', petty: 'تنخواه', project: 'پروژه',
};

export async function listAttachments(businessId: string, entityType: string, entityId?: string): Promise<AccAttachment[]> {
  let q = supabase.from('acc_attachments').select('*').eq('business_id', businessId).eq('entity_type', entityType);
  if (entityId) q = q.eq('entity_id', entityId);
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as AccAttachment[];
}

/** شمارنده ضمائم برای نمایش badge روی ردیف‌های لیست */
export async function attachmentCounts(businessId: string, entityType: string): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('acc_attachments')
    .select('entity_id')
    .eq('business_id', businessId).eq('entity_type', entityType);
  const m = new Map<string, number>();
  if (!error) for (const r of data || []) m.set(r.entity_id as string, (m.get(r.entity_id as string) || 0) + 1);
  return m;
}

export async function addAttachment(
  businessId: string,
  entityType: string,
  entityId: string,
  file: File,
  title?: string,
): Promise<string> {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${businessId}/att-${entityType}-${entityId.slice(0, 8)}-${Date.now()}.${ext || 'bin'}`;
  const { error: upErr } = await supabase.storage.from('acc-media').upload(path, file, { upsert: true });
  if (upErr) throw upErr;
  const { data: url } = supabase.storage.from('acc-media').getPublicUrl(path);
  const { data: user } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('acc_attachments').insert({
    business_id: businessId, entity_type: entityType, entity_id: entityId,
    title: title || file.name, file_url: url.publicUrl,
    file_name: file.name, file_size: file.size, uploaded_by: user?.user?.id || null,
  }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteAttachment(id: string): Promise<void> {
  const { error } = await supabase.from('acc_attachments').delete().eq('id', id);
  if (error) throw error;
}

/* ═══════════════════════ ۱۱) ابطال و حذف کامل همه اسناد ═══════════════════════ */

/** یافتن سند حسابداری مرتبط با یک سند عملیاتی */
async function findJournalsByRef(businessId: string, refType: string, refId: string): Promise<string[]> {
  const { data } = await supabase
    .from('acc_journal').select('id').eq('business_id', businessId).eq('ref_type', refType).eq('ref_id', refId);
  return ((data || []) as { id: string }[]).map((r) => r.id);
}

/* ── فاکتور ── */
export async function voidInvoice(businessId: string, invoiceId: string, reason: string, restoreStock: boolean): Promise<void> {
  const { data: inv } = await supabase.from('acc_invoices').select('status, voided_at').eq('id', invoiceId).maybeSingle();
  if (!inv) throw new Error('فاکتور یافت نشد');
  if (inv.voided_at) throw new Error('این فاکتور قبلاً ابطال شده است');
  if (restoreStock) {
    const { adjustStockForInvoice } = await import('./api');
    await adjustStockForInvoice(invoiceId, +1);
  }
  const jids = await findJournalsByRef(businessId, 'invoice', invoiceId);
  for (const jid of jids) {
    try { await voidJournal(businessId, jid, reason || 'ابطال فاکتور'); } catch { /* سند بدون گردش */ }
  }
  const { error } = await supabase.from('acc_invoices').update({
    status: 'cancelled', voided_at: new Date().toISOString(), void_reason: reason || null,
  }).eq('id', invoiceId);
  if (error) throw error;
}

export async function deleteInvoiceFull(businessId: string, invoiceId: string): Promise<void> {
  const { data: txs } = await supabase.from('acc_transactions').select('id').eq('invoice_id', invoiceId).limit(1);
  if (txs && txs.length) throw new Error('این فاکتور تسویه دارد — اول دریافت/پرداخت‌های مرتبط را حذف کنید');
  const { data: checks } = await supabase.from('acc_checks').select('id').eq('invoice_id', invoiceId).limit(1);
  if (checks && checks.length) throw new Error('این فاکتور چک مرتبط دارد — اول چک‌ها را حذف کنید');
  const { error: itemErr } = await supabase.from('acc_invoice_items').delete().eq('invoice_id', invoiceId);
  if (itemErr) throw itemErr;
  const jids = await findJournalsByRef(businessId, 'invoice', invoiceId);
  for (const jid of jids) {
    await supabase.from('acc_journal_lines').delete().eq('entry_id', jid);
    await supabase.from('acc_journal').delete().eq('id', jid);
  }
  await supabase.from('acc_attachments').delete().eq('entity_type', 'invoice').eq('entity_id', invoiceId);
  const { error } = await supabase.from('acc_invoices').delete().eq('id', invoiceId);
  if (error) throw error;
}

/* ── هزینه ── */
export async function voidExpense(businessId: string, expenseId: string, reason: string): Promise<void> {
  const { data: exp } = await supabase.from('acc_expenses').select('voided_at').eq('id', expenseId).maybeSingle();
  if (!exp) throw new Error('هزینه یافت نشد');
  if (exp.voided_at) return;
  const jids = await findJournalsByRef(businessId, 'expense', expenseId);
  for (const jid of jids) {
    try { await voidJournal(businessId, jid, reason || 'ابطال هزینه'); } catch { /* */ }
  }
  const { error } = await supabase.from('acc_expenses').update({
    voided_at: new Date().toISOString(), void_reason: reason || null,
  }).eq('id', expenseId);
  if (error) throw error;
}

export async function deleteExpenseFull(businessId: string, expenseId: string): Promise<void> {
  const jids = await findJournalsByRef(businessId, 'expense', expenseId);
  for (const jid of jids) {
    await supabase.from('acc_journal_lines').delete().eq('entry_id', jid);
    await supabase.from('acc_journal').delete().eq('id', jid);
  }
  await supabase.from('acc_attachments').delete().eq('entity_type', 'expense').eq('entity_id', expenseId);
  const { error } = await supabase.from('acc_expenses').delete().eq('id', expenseId);
  if (error) throw error;
}

/* ── دریافت/پرداخت ── */
export async function voidTransaction(businessId: string, txId: string, reason: string): Promise<void> {
  const { data: tx } = await supabase.from('acc_transactions').select('voided_at, invoice_id, invoice:acc_invoices(paid_total)').eq('id', txId).maybeSingle();
  if (!tx) throw new Error('یافت نشد');
  if (tx.voided_at) return;
  const jids = await findJournalsByRef(businessId, 'transaction', txId);
  for (const jid of jids) {
    try { await voidJournal(businessId, jid, reason || 'ابطال دریافت/پرداخت'); } catch { /* */ }
  }
  if (tx.invoice_id) {
    const { data: inv } = await supabase.from('acc_invoices').select('id, paid_total, amount_txs:acc_transactions(amount, kind)').eq('id', tx.invoice_id).maybeSingle();
    if (inv) {
      const total = ((inv.amount_txs || []) as { amount: number; kind: string }[]).reduce((s, t) => s + (t.kind === 'receipt' ? num(t.amount) : -num(t.amount)), 0);
      await supabase.from('acc_invoices').update({ paid_total: Math.max(0, total) }).eq('id', inv.id);
    }
  }
  const { error } = await supabase.from('acc_transactions').update({
    voided_at: new Date().toISOString(), void_reason: reason || null,
  }).eq('id', txId);
  if (error) throw error;
}

export async function deleteTransactionFull(businessId: string, txId: string): Promise<void> {
  const { data: tx } = await supabase.from('acc_transactions').select('invoice_id').eq('id', txId).maybeSingle();
  const jids = await findJournalsByRef(businessId, 'transaction', txId);
  for (const jid of jids) {
    await supabase.from('acc_journal_lines').delete().eq('entry_id', jid);
    await supabase.from('acc_journal').delete().eq('id', jid);
  }
  await supabase.from('acc_attachments').delete().eq('entity_type', 'transaction').eq('entity_id', txId);
  const { error } = await supabase.from('acc_transactions').delete().eq('id', txId);
  if (error) throw error;
  if (tx?.invoice_id) {
    const { recomputeInvoicePaid } = await import('./api');
    await recomputeInvoicePaid(tx.invoice_id);
  }
}

/* ── چک ── */
export async function voidCheck(businessId: string, checkId: string, reason: string): Promise<void> {
  const { error } = await supabase.from('acc_checks').update({
    status: 'canceled', voided_at: new Date().toISOString(), void_reason: reason || null,
  }).eq('id', checkId);
  if (error) throw error;
}

export async function deleteCheckFull(businessId: string, checkId: string): Promise<void> {
  await supabase.from('acc_attachments').delete().eq('entity_type', 'check').eq('entity_id', checkId);
  const { error } = await supabase.from('acc_checks').delete().eq('id', checkId);
  if (error) throw error;
}

/* ── قرارداد ── */
export async function voidContract(contractId: string, reason: string): Promise<void> {
  const { error } = await supabase.from('acc_contracts').update({
    status: 'canceled', voided_at: new Date().toISOString(), void_reason: reason || null,
  }).eq('id', contractId);
  if (error) throw error;
}

export async function deleteContractFull(contractId: string): Promise<void> {
  await supabase.from('acc_attachments').delete().eq('entity_type', 'contract').eq('entity_id', contractId);
  const { error } = await supabase.from('acc_contracts').delete().eq('id', contractId);
  if (error) throw error;
}

/* ═══════════════════════ ۱۲) بهای تمام‌شده خدمات و سود پروژه ═══════════════════════ */

export interface ServiceCostRow {
  projectId: string | null;
  projectName: string;
  revenue: number;
  directCost: number;
  indirectAllocated: number;
  totalCost: number;
  profit: number;
  margin: number;
  budget: number;
  progress: number;
  budgetUsedPct: number;
}

/** بهای تمام‌شده و سود واقعی هر پروژه/خدمت
 *  درآمد = ردیف‌های درآمدی سند با project_id + فاکتورهای فروش آن پروژه
 *  هزینه مستقیم = ردیف‌های هزینه سند با project_id + هزینه‌های ثبت‌شده با project_id
 *  سربار = هزینه‌های بدون پروژه × نرخ overhead_rate هر پروژه
 */
export async function serviceCosting(
  businessId: string,
  from?: string,
  to?: string,
): Promise<{ rows: ServiceCostRow[]; totalRevenue: number; totalDirect: number; totalIndirect: number; unallocatedIndirect: number; totalProfit: number }> {
  const { data: projects } = await supabase
    .from('acc_projects').select('*')
    .eq('business_id', businessId).order('name');
  const projList = (projects || []) as { id: string; name: string; budget: number; overhead_rate: number; progress: number }[];

  let lineQ = supabase
    .from('acc_journal_lines')
    .select('account_code, account_title, debit, credit, project_id, acc_journal!inner(date_g, voided_at, ref_action)')
    .eq('business_id', businessId);
  if (from) lineQ = lineQ.gte('acc_journal.date_g', from);
  if (to) lineQ = lineQ.lte('acc_journal.date_g', to);
  const { data: lines } = await lineQ;
  const { data: chart } = await supabase
    .from('acc_chart').select('code, kind')
    .or(`business_id.is.null,business_id.eq.${businessId}`);
  const kindOf = new Map((chart || []).map((c) => [c.code as string, c.kind as string]));

  const revBy = new Map<string, number>();
  const dirBy = new Map<string, number>();
  let indirectTotal = 0;
  for (const l of (lines || []) as unknown as { account_code: string; debit: number | null; credit: number | null; project_id: string | null; acc_journal: { voided_at: string | null; ref_action: string } }[]) {
    if (l.acc_journal.voided_at || l.acc_journal.ref_action === 'reverse') continue;
    const kind = kindOf.get(l.account_code) || (l.account_code.startsWith('4') ? 'income' : l.account_code.startsWith('5') ? 'expense' : '');
    const netD = num(l.debit) - num(l.credit);
    if (kind === 'income') {
      const key = l.project_id || '_none_';
      revBy.set(key, (revBy.get(key) || 0) + (-netD));
    } else if (kind === 'expense') {
      if (l.project_id) dirBy.set(l.project_id, (dirBy.get(l.project_id) || 0) + netD);
      else indirectTotal += netD;
    }
  }
  /* درآمد فاکتورهای پروژه‌دار بدون سند — از فاکتور */
  let invQ = supabase
    .from('acc_invoices')
    .select('project_id, subtotal, discount_total, vat_total, voided_at, type')
    .eq('business_id', businessId).eq('type', 'sale');
  const { data: invs } = await invQ;
  let invoiceRevenueProject = 0;
  for (const inv of (invs || []) as { project_id: string | null; subtotal: number; discount_total: number; voided_at: string | null }[]) {
    if (inv.voided_at || !inv.project_id) continue;
    invoiceRevenueProject += num(inv.subtotal) - num(inv.discount_total);
    revBy.set(inv.project_id, (revBy.get(inv.project_id) || 0) + num(inv.subtotal) - num(inv.discount_total));
  }

  const rows: ServiceCostRow[] = [];
  const allKeys = new Set([...revBy.keys(), ...dirBy.keys(), ...projList.map((p) => p.id)]);
  let totalRevenue = 0; let totalDirect = 0; let totalIndirectAlloc = 0; let totalProfit = 0;
  for (const key of allKeys) {
    if (key === '_none_') continue;
    const p = projList.find((x) => x.id === key);
    const revenue = revBy.get(key) || 0;
    const direct = dirBy.get(key) || 0;
    const overheadRate = num(p?.overhead_rate);
    const indirectAlloc = revenue > 0 || direct > 0 ? Math.round(indirectTotal * (overheadRate / 100)) : 0;
    const cost = direct + indirectAlloc;
    const profit = revenue - cost;
    const budget = num(p?.budget);
    rows.push({
      projectId: key === '_none_' ? null : key,
      projectName: p?.name || 'بدون پروژه',
      revenue, directCost: direct, indirectAllocated: indirectAlloc, totalCost: cost,
      profit, margin: revenue > 0 ? Math.round((profit / revenue) * 100) : 0,
      budget, progress: num(p?.progress),
      budgetUsedPct: budget > 0 ? Math.min(999, Math.round((cost / budget) * 100)) : 0,
    });
    totalRevenue += revenue; totalDirect += direct; totalIndirectAlloc += indirectAlloc; totalProfit += profit;
  }
  rows.sort((a, b) => b.profit - a.profit);
  return { rows, totalRevenue, totalDirect, totalIndirect: totalIndirectAlloc, unallocatedIndirect: indirectTotal, totalProfit };
}

/** به‌روزرسانی بودجه/پیشرفت/نرخ سربار پروژه */
export async function updateProjectEconomics(
  projectId: string,
  input: { progress?: number; overhead_rate?: number; budget?: number },
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.progress !== undefined) patch.progress = Math.max(0, Math.min(100, Math.round(input.progress)));
  if (input.overhead_rate !== undefined) patch.overhead_rate = input.overhead_rate;
  if (input.budget !== undefined) patch.budget = input.budget;
  if (!Object.keys(patch).length) return;
  const { error } = await supabase.from('acc_projects').update(patch).eq('id', projectId);
  if (error) throw error;
}

/* ═══════════════════════ ۱۳) کنترل دسترسی ریزدانه ═══════════════════════ */

export interface PermKey { key: string; label: string; group: string }

export const PERM_KEYS: PermKey[] = [
  { key: 'invoices.view', label: 'مشاهده فاکتورها', group: 'فاکتور' },
  { key: 'invoices.manage', label: 'ثبت و ویرایش فاکتور', group: 'فاکتور' },
  { key: 'invoices.issue', label: 'صدور نهایی فاکتور', group: 'فاکتور' },
  { key: 'invoices.void', label: 'ابطال و حذف فاکتور', group: 'فاکتور' },
  { key: 'payments.view', label: 'مشاهده دریافت/پرداخت', group: 'خزانه' },
  { key: 'payments.manage', label: 'ثبت دریافت/پرداخت', group: 'خزانه' },
  { key: 'payments.void', label: 'ابطال و حذف دریافت/پرداخت', group: 'خزانه' },
  { key: 'checks.manage', label: 'مدیریت چک‌ها', group: 'خزانه' },
  { key: 'petty.manage', label: 'مدیریت تنخواه‌گردان', group: 'خزانه' },
  { key: 'prepay.manage', label: 'مدیریت پیش‌دریافت/پرداخت', group: 'خزانه' },
  { key: 'expenses.manage', label: 'ثبت و ویرایش هزینه', group: 'هزینه' },
  { key: 'expenses.void', label: 'ابطال و حذف هزینه', group: 'هزینه' },
  { key: 'journal.view', label: 'مشاهده دفترخانه', group: 'حسابداری' },
  { key: 'journal.manage', label: 'ثبت سند دستی', group: 'حسابداری' },
  { key: 'journal.void', label: 'ابطال و حذف سند', group: 'حسابداری' },
  { key: 'chart.manage', label: 'مدیریت کدینگ حسابداری', group: 'حسابداری' },
  { key: 'recon.manage', label: 'مغایرت‌گیری بانکی', group: 'حسابداری' },
  { key: 'fiscal.close', label: 'بستن و افتتاح دوره مالی', group: 'حسابداری' },
  { key: 'reports.view', label: 'مشاهده گزارش‌ها', group: 'گزارش' },
  { key: 'attachments.manage', label: 'مدیریت ضمائم', group: 'گزارش' },
  { key: 'settings.manage', label: 'تنظیمات کسب‌وکار و کاربران', group: 'سیستم' },
];

export interface AccessRow {
  id: string;
  business_id: string | null;
  user_id: string | null;
  email: string | null;
  role: string;
  status: string;
  plan: string | null;
  perms: Record<string, boolean>;
  expires_at: string | null;
}

export async function listBusinessAccess(businessId: string): Promise<AccessRow[]> {
  const { data, error } = await supabase
    .from('acc_access')
    .select('id, business_id, user_id, email, role, status, plan, perms, expires_at')
    .eq('business_id', businessId)
    .order('created_at');
  if (error) throw error;
  return ((data || []) as AccessRow[]).map((r) => ({ ...r, perms: (r.perms || {}) as Record<string, boolean> }));
}

export async function myPerms(businessId: string | null, role: string): Promise<Record<string, boolean>> {
  if (role === 'owner') {
    /* بنیان‌گذار/مالک همه مجوزها */
    return Object.fromEntries(PERM_KEYS.map((p) => [p.key, true]));
  }
  if (!businessId) return {};
  const { data } = await supabase
    .from('acc_access')
    .select('perms, role, status')
    .eq('business_id', businessId)
    .eq('role', role)
    .limit(1)
    .maybeSingle();
  return ((data?.perms || {}) as Record<string, boolean>) || {};
}

/** فقط مالک می‌تواند مجوزها را تغییر دهد */
export async function saveAccessPerms(ownerRole: string, accessId: string, perms: Record<string, boolean>): Promise<void> {
  if (ownerRole !== 'owner') throw new Error('فقط مالک کسب‌وکار می‌تواند دسترسی‌ها را تغییر دهد');
  const { error } = await supabase.from('acc_access').update({ perms }).eq('id', accessId);
  if (error) throw error;
}

/* ═══════════════════════ ۱۴) حذف کامل همه‌ی اسناد — کمکی‌های اضافه ═══════════════════════ */

/** حذف کامل پیش‌نویس فاکتور با ردیف‌ها و ضمائم (بهبود نسخه قبلی) */
export async function deleteDraftInvoiceFull(businessId: string, invoiceId: string): Promise<void> {
  await deleteInvoiceFull(businessId, invoiceId);
}

/* استرداد فاکتور — فاکتور برگشت از فروش مرتبط با فاکتور اصلی */
export async function createReturnInvoiceLink(businessId: string, returnInvoiceId: string, originalInvoiceId: string): Promise<void> {
  const { error } = await supabase.from('acc_invoices').update({ return_of: originalInvoiceId }).eq('id', returnInvoiceId);
  if (error) throw error;
}

/** فاکتورهای برگشتیِ یک فاکتور اصلی */
export async function listReturnsOf(businessId: string, originalInvoiceId: string): Promise<{ id: string; number: string; total: number; date_g: string }[]> {
  const { data, error } = await supabase
    .from('acc_invoices')
    .select('id, number, total, date_g')
    .eq('business_id', businessId).eq('return_of', originalInvoiceId);
  if (error) throw error;
  return (data || []) as { id: string; number: string; total: number; date_g: string }[];
}
