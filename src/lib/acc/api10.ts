/* ═════════════════════════════════════════════════════════════════════
   api10 — معماری Master Data و زیرحساب‌ها (نسخه ۸)
   Partner Master (کد یکتا) | نقش‌های طرف‌حساب | مراکز هزینه |
   قوانین تفصیلی حساب | گزارش طرف‌حساب/جاری شرکا/مرکز هزینه از Journal واقعی
   ═════════════════════════════════════════════════════════════════════ */

import { supabase } from '@/lib/supabase';
import type { AccPartner, AccCostCenter, PartnerRole } from './types';
import { PARTNER_ROLE_LABELS } from './types';
import { isMissingRpc } from './rpc';

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/* ═══════════ لاگ عملیات مهم (بند ۳۹) ═══════════ */

export async function logActivity(businessId: string, action: string, entity: string, entityId: string | null, detail?: string) {
  try {
    await supabase.from('acc_activity').insert({
      business_id: businessId,
      action,
      entity,
      entity_id: entityId,
      detail: detail ?? null,
    });
  } catch {
    /* لاگ هرگز جریان اصلی را نمی‌شکند */
  }
}

/* ═══════════ ۱) Partner Master (بند ۳ و ۴) ═══════════ */

export interface PartnerWithRoles extends AccPartner {
  roles: PartnerRole[];
}

/** فهرست طرف‌حساب‌ها با کد و نقش‌ها — شامل غیرفعال‌ها (فیلتر سمت UI) */
export async function listPartnersV2(businessId: string, opts?: { activeOnly?: boolean; role?: PartnerRole }): Promise<PartnerWithRoles[]> {
  let q = supabase
    .from('acc_partners')
    .select('*, acc_partner_roles(role)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  if (opts?.activeOnly) q = q.eq('active', true);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data || []) as unknown as (AccPartner & { acc_partner_roles?: { role: PartnerRole }[] })[];
  let out: PartnerWithRoles[] = rows.filter(Boolean).map((r) => ({
    ...r,
    roles: (r.acc_partner_roles || []).map((x) => x.role),
  }));
  if (opts?.role) out = out.filter((p) => p.roles.includes(opts.role!));
  return out;
}

export interface SavePartnerV2Input {
  id?: string;
  name: string;
  legal_name?: string | null;
  kind?: 'customer' | 'supplier' | 'both';
  person_type?: 'real' | 'legal';
  national_id?: string | null;
  shenase_melli?: string | null;
  economic_code?: string | null;
  registration_number?: string | null;
  province?: string | null;
  county?: string | null;
  city?: string | null;
  postal_code?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  fax?: string | null;
  address?: string | null;
  notes?: string | null;
  roles: PartnerRole[];
}

/** ساخت/ویرایش طرف‌حساب با نقش‌ها — کد اتمیک را دیتابیس تخصیص می‌دهد (تریگر)
 *  زنجیرهٔ Partner→Role→Detail هم با تریگر نقش به‌صورت خودکار برقرار می‌شود */
export async function savePartnerV2(businessId: string, input: SavePartnerV2Input): Promise<string> {
  if (!input.name.trim()) throw new Error('نام طرف‌حساب الزامی است');
  const roles = Array.from(new Set(input.roles.filter(Boolean)));
  if (!roles.length) throw new Error('حداقل یک نقش (مشتری/تامین‌کننده/شریک/کارمند) انتخاب کنید');
  const payload = {
    name: input.name.trim(),
    legal_name: input.legal_name?.trim() || null,
    kind: input.kind || (roles.includes('customer') && roles.includes('supplier') ? 'both' : roles.includes('customer') ? 'customer' : 'supplier'),
    person_type: input.person_type || 'legal',
    national_id: input.national_id?.trim() || null,
    shenase_melli: input.shenase_melli?.trim() || null,
    economic_code: input.economic_code?.trim() || null,
    registration_number: input.registration_number?.trim() || null,
    province: input.province?.trim() || null,
    county: input.county?.trim() || null,
    city: input.city?.trim() || null,
    postal_code: input.postal_code?.trim() || null,
    phone: input.phone?.trim() || null,
    mobile: input.mobile?.trim() || null,
    email: input.email?.trim() || null,
    fax: input.fax?.trim() || null,
    address: input.address?.trim() || null,
    notes: input.notes?.trim() || null,
  };

  let partnerId = input.id || '';
  if (input.id) {
    const { error } = await supabase.from('acc_partners').update(payload).eq('id', input.id);
    if (error) throw error;
  } else {
    /* مسیر مقاوم به RLS-RETURNING: بدون select — سپس خواندن مجدد */
    const { error } = await supabase.from('acc_partners').insert({ ...payload, business_id: businessId });
    if (error) throw error;
    const { data: found } = await supabase
      .from('acc_partners')
      .select('id')
      .eq('business_id', businessId)
      .eq('name', payload.name)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!found) throw new Error('طرف‌حساب ذخیره شد ولی بازیابی شناسه ناموفق بود');
    partnerId = found.id as string;
  }

  /* نقش‌ها — فقط نقش‌های جدید درج می‌شوند؛ نقش‌های قبلی حفظ (تاریخچه) */
  const { data: existing } = await supabase
    .from('acc_partner_roles')
    .select('role')
    .eq('partner_id', partnerId);
  const have = new Set((existing || []).map((r) => r.role as string));
  const missing = roles.filter((r) => !have.has(r));
  if (missing.length) {
    const { error: rerr } = await supabase
      .from('acc_partner_roles')
      .insert(missing.map((role) => ({ business_id: businessId, partner_id: partnerId, role })));
    if (rerr) throw rerr;
  }
  await logActivity(businessId, input.id ? 'partner.updated' : 'partner.created', 'partner', partnerId, `نقش‌ها: ${roles.map((r) => PARTNER_ROLE_LABELS[r]).join('، ')}`);
  return partnerId;
}

/** غیرفعال‌سازی طرف‌حساب — حذف دارای گردش در دیتابیس ممنوع است (بند ۳۰) */
export async function deactivatePartner(businessId: string, partnerId: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('acc_partners').update({ active }).eq('id', partnerId).eq('business_id', businessId);
  if (error) throw error;
  await logActivity(businessId, active ? 'partner.activated' : 'partner.deactivated', 'partner', partnerId);
}

/** حذف فقط برای طرف‌حساب بدون گردش — دیتابیس هم گارد دارد */
export async function deletePartnerV2(partnerId: string): Promise<void> {
  const { error } = await supabase.from('acc_partners').delete().eq('id', partnerId);
  if (error) throw new Error(
    /foreign key|violates|guard/i.test(error.message)
      ? 'این طرف‌حساب گردش دارد و قابل حذف نیست — از غیرفعال‌سازی استفاده کنید'
      : error.message,
  );
}

/* ═══════════ ۲) نقش‌ها (بند ۵ و ۶) ═══════════ */

export async function addPartnerRole(businessId: string, partnerId: string, role: PartnerRole): Promise<void> {
  const { error } = await supabase
    .from('acc_partner_roles')
    .insert({ business_id: businessId, partner_id: partnerId, role });
  if (error) {
    if (/duplicate key|unique/i.test(error.message)) throw new Error('این نقش از قبل برای این طرف‌حساب ثبت شده است');
    throw error;
  }
  await logActivity(businessId, 'partner.role_added', 'partner_role', partnerId, PARTNER_ROLE_LABELS[role]);
}

export async function removePartnerRole(businessId: string, partnerId: string, role: PartnerRole): Promise<void> {
  const { error } = await supabase
    .from('acc_partner_roles')
    .delete()
    .eq('partner_id', partnerId)
    .eq('role', role)
    .eq('business_id', businessId);
  if (error) throw error;
  await logActivity(businessId, 'partner.role_removed', 'partner_role', partnerId, PARTNER_ROLE_LABELS[role]);
}

/* ═══════════ ۳) مراکز هزینه (بند ۲۲) ═══════════ */

export async function listCostCenters(businessId: string, activeOnly = false): Promise<AccCostCenter[]> {
  let q = supabase.from('acc_cost_centers').select('*').eq('business_id', businessId).order('code');
  if (activeOnly) q = q.eq('active', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as AccCostCenter[];
}

export async function saveCostCenter(
  businessId: string,
  input: { id?: string; name: string; description?: string | null; code?: string | null },
): Promise<string> {
  if (!input.name.trim()) throw new Error('نام مرکز هزینه الزامی است');
  const payload = {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    /* کد فقط هنگام ساخت و توسط شمارندهٔ اتمیک دیتابیس تخصیص می‌شود */
  };
  if (input.id) {
    const { error } = await supabase.from('acc_cost_centers').update(payload).eq('id', input.id).eq('business_id', businessId);
    if (error) throw error;
    await logActivity(businessId, 'cost_center.updated', 'cost_center', input.id, payload.name);
    return input.id;
  }
  /* درج بدون select (مقاوم به RLS-RETURNING) + بازیابی با کد شمارنده */
  const { data: nextCode, error: codeErr } = await supabase.rpc('acc_next_cost_center_code', { p_business: businessId });
  if (codeErr && !isMissingRpc(codeErr)) throw codeErr;
  const code = typeof nextCode === 'string' && nextCode ? nextCode : null;
  if (!code) throw new Error('تخصیص کد مرکز هزینه ناموفق بود — مایگریشن v8 را اجرا کنید');
  const { error } = await supabase.from('acc_cost_centers').insert({ ...payload, code, business_id: businessId });
  if (error) throw error;
  const { data: found } = await supabase
    .from('acc_cost_centers')
    .select('id')
    .eq('business_id', businessId)
    .eq('code', code)
    .maybeSingle();
  if (!found) throw new Error('مرکز هزینه ذخیره شد ولی بازیابی شناسه ناموفق بود');
  await logActivity(businessId, 'cost_center.created', 'cost_center', found.id as string, `${code} — ${payload.name}`);
  return found.id as string;
}

export async function deactivateCostCenter(businessId: string, ccId: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('acc_cost_centers').update({ active }).eq('id', ccId).eq('business_id', businessId);
  if (error) throw error;
  await logActivity(businessId, active ? 'cost_center.activated' : 'cost_center.deactivated', 'cost_center', ccId);
}

/* ═══════════ ۴) گزارش‌ها از Journal واقعی (بند ۳۱، ۳۲، ۳۳، ۸۰) ═══════════ */

export interface StatementRow {
  entry_id: string;
  entry_no: number;
  date_g: string;
  description: string | null;
  line_desc: string | null;
  account_code: string;
  account_title: string;
  detail_title: string | null;
  detail_code: string | null;
  cost_center: string | null;
  project: string | null;
  debit: number;
  credit: number;
  running: number;
}

export interface StatementResult {
  opening: number; /* مثبت = بستانکار */
  rows: StatementRow[];
  totalDebit: number;
  totalCredit: number;
  closing: number; /* مثبت = بستانکار */
}

/** صورت‌حساب یک تفصیلی از Journal واقعی — مانده اول دوره + گردش + مانده پایان */
export async function detailStatement(
  businessId: string,
  detailId: string,
  from?: string,
  to?: string,
): Promise<StatementResult> {
  let base = supabase
    .from('acc_journal_lines')
    .select(`
      entry_id, account_code, account_title, debit, credit, line_desc,
      acc_cost_centers(name), acc_projects(name), acc_details(title, detail_code),
      acc_journal!inner(entry_no, date_g, description, voided_at, ref_action)
    `)
    .eq('business_id', businessId)
    .eq('detail_id', detailId);
  if (from) base = base.gte('acc_journal.date_g', from);
  if (to) base = base.lte('acc_journal.date_g', to);
  const { data, error } = await base.order('acc_journal.date_g').order('acc_journal.entry_no');
  if (error) throw error;
  type Raw = {
    entry_id: string; account_code: string; account_title: string; debit: number | string; credit: number | string; line_desc: string | null;
    acc_cost_centers: { name: string } | null;
    acc_projects: { name: string } | null;
    acc_details: { title: string; detail_code: string | null } | null;
    acc_journal: { entry_no: number; date_g: string; description: string | null; voided_at: string | null; ref_action: string };
  };
  const raws = (data || []) as unknown as Raw[];
  const rows: StatementRow[] = [];
  let totalDebit = 0, totalCredit = 0;
  let running = 0; /* بستانکار مثبت */
  for (const r of raws) {
    if (r.acc_journal.voided_at || r.acc_journal.ref_action === 'reverse') continue;
    const d = num(r.debit), c = num(r.credit);
    totalDebit += d; totalCredit += c;
    running += c - d;
    rows.push({
      entry_id: r.entry_id,
      entry_no: num(r.acc_journal.entry_no),
      date_g: r.acc_journal.date_g,
      description: r.acc_journal.description,
      line_desc: r.line_desc,
      account_code: r.account_code,
      account_title: r.account_title,
      detail_title: r.acc_details?.title ?? null,
      detail_code: r.acc_details?.detail_code ?? null,
      cost_center: r.acc_cost_centers?.name ?? null,
      project: r.acc_projects?.name ?? null,
      debit: d,
      credit: c,
      running,
    });
  }
  /* مانده اول دوره: گردش قبل از «از تاریخ» */
  let opening = 0;
  if (from) {
    const { data: pre } = await supabase
      .from('acc_journal_lines')
      .select('debit, credit, acc_journal!inner(date_g, voided_at, ref_action)')
      .eq('business_id', businessId)
      .eq('detail_id', detailId)
      .lt('acc_journal.date_g', from);
    for (const p of (pre || []) as unknown as { debit: number; credit: number; acc_journal: { voided_at: string | null; ref_action: string } }[]) {
      if (p.acc_journal.voided_at || p.acc_journal.ref_action === 'reverse') continue;
      opening += num(p.credit) - num(p.debit);
    }
  }
  return { opening, rows, totalDebit, totalCredit, closing: opening + totalCredit - totalDebit };
}

/** مانده هر تفصیلی در یک کد حساب (برای گزارش جاری شرکا — بند ۳۲) */
export async function detailBalanceByCode(businessId: string, detailId: string, code: string): Promise<{ opening: number; debit: number; credit: number; closing: number }> {
  const { data, error } = await supabase
    .from('acc_journal_lines')
    .select('debit, credit, acc_journal!inner(voided_at, ref_action)')
    .eq('business_id', businessId)
    .eq('detail_id', detailId)
    .eq('account_code', code);
  if (error) throw error;
  let debit = 0, credit = 0;
  for (const r of (data || []) as unknown as { debit: number; credit: number; acc_journal: { voided_at: string | null; ref_action: string } }[]) {
    if (r.acc_journal.voided_at || r.acc_journal.ref_action === 'reverse') continue;
    debit += num(r.debit); credit += num(r.credit);
  }
  return { opening: 0, debit, credit, closing: credit - debit };
}

export interface PartnerLedgerRow {
  partner: PartnerWithRoles;
  detail_code: string | null;
  detail_title: string | null;
  opening: number;
  debit: number;
  credit: number;
  closing: number; /* مثبت = بستانکار */
}

/** گزارش همهٔ طرف‌حساب‌ها (بند ۳۱): کد طرف‌حساب، کد تفصیلی، نقش‌ها، مانده اول/گردش/مانده نهایی */
export async function partnersLedger(businessId: string, from?: string, to?: string, detailKind?: string): Promise<PartnerLedgerRow[]> {
  const partners = await listPartnersV2(businessId);
  const { data: details } = await supabase
    .from('acc_details')
    .select('id, ref_id, detail_code, title, kind')
    .eq('business_id', businessId)
    .in('kind', detailKind ? [detailKind] : ['customer', 'supplier', 'shareholder', 'employee']);
  const byPartner = new Map<string, { id: string; detail_code: string | null; title: string }[]>();
  for (const d of (details || []) as unknown as { id: string; ref_id: string | null; detail_code: string | null; title: string }[]) {
    if (!d.ref_id) continue;
    if (!byPartner.has(d.ref_id)) byPartner.set(d.ref_id, []);
    byPartner.get(d.ref_id)!.push({ id: d.id, detail_code: d.detail_code, title: d.title });
  }
  const out: PartnerLedgerRow[] = [];
  for (const p of partners) {
    for (const det of byPartner.get(p.id) || []) {
      const st = await detailStatement(businessId, det.id, from, to);
      out.push({
        partner: p,
        detail_code: det.detail_code,
        detail_title: det.title,
        opening: st.opening,
        debit: st.totalDebit,
        credit: st.totalCredit,
        closing: st.closing,
      });
    }
  }
  return out;
}

export interface CostCenterReportRow {
  code: string;
  name: string;
  byAccount: { account_code: string; account_title: string; amount: number }[];
  total: number;
}

/** گزارش مرکز هزینه از Journal واقعی (بند ۳۳ و ۸۰) */
export async function costCenterReport(businessId: string, from?: string, to?: string): Promise<CostCenterReportRow[]> {
  let q = supabase
    .from('acc_journal_lines')
    .select('debit, credit, account_code, account_title, acc_cost_centers!inner(id, code, name), acc_journal!inner(voided_at, ref_action)')
    .eq('business_id', businessId);
  if (from) q = q.gte('acc_journal.date_g', from);
  if (to) q = q.lte('acc_journal.date_g', to);
  const { data, error } = await q;
  if (error) throw error;
  type Raw = {
    debit: number; credit: number; account_code: string; account_title: string;
    acc_cost_centers: { id: string; code: string; name: string };
    acc_journal: { voided_at: string | null; ref_action: string };
  };
  const map = new Map<string, CostCenterReportRow>();
  for (const r of (data || []) as unknown as Raw[]) {
    if (r.acc_journal.voided_at || r.acc_journal.ref_action === 'reverse') continue;
    const amt = num(r.debit) - num(r.credit);
    if (amt === 0) continue;
    const key = r.acc_cost_centers.id;
    if (!map.has(key)) map.set(key, { code: r.acc_cost_centers.code, name: r.acc_cost_centers.name, byAccount: [], total: 0 });
    const row = map.get(key)!;
    const acc = row.byAccount.find((a) => a.account_code === r.account_code);
    if (acc) acc.amount += amt;
    else row.byAccount.push({ account_code: r.account_code, account_title: r.account_title, amount: amt });
    row.total += amt;
  }
  const rows = Array.from(map.values());
  for (const r of rows) r.byAccount.sort((a, b) => a.account_code.localeCompare(b.account_code));
  rows.sort((a, b) => a.code.localeCompare(b.code));
  return rows;
}

/** گزارش پروژه از Journal واقعی — همان ساختار مرکز هزینه */
export async function projectReport(businessId: string, from?: string, to?: string): Promise<CostCenterReportRow[]> {
  let q = supabase
    .from('acc_journal_lines')
    .select('debit, credit, account_code, account_title, acc_projects!inner(id, code, name), acc_journal!inner(voided_at, ref_action)')
    .eq('business_id', businessId);
  if (from) q = q.gte('acc_journal.date_g', from);
  if (to) q = q.lte('acc_journal.date_g', to);
  const { data, error } = await q;
  if (error) throw error;
  type Raw = {
    debit: number; credit: number; account_code: string; account_title: string;
    acc_projects: { id: string; code: string | null; name: string };
    acc_journal: { voided_at: string | null; ref_action: string };
  };
  const map = new Map<string, CostCenterReportRow>();
  for (const r of (data || []) as unknown as Raw[]) {
    if (r.acc_journal.voided_at || r.acc_journal.ref_action === 'reverse') continue;
    const amt = num(r.debit) - num(r.credit);
    if (amt === 0) continue;
    const key = r.acc_projects.id;
    if (!map.has(key)) map.set(key, { code: r.acc_projects.code || '—', name: r.acc_projects.name, byAccount: [], total: 0 });
    const row = map.get(key)!;
    const acc = row.byAccount.find((a) => a.account_code === r.account_code);
    if (acc) acc.amount += amt;
    else row.byAccount.push({ account_code: r.account_code, account_title: r.account_title, amount: amt });
    row.total += amt;
  }
  const rows = Array.from(map.values());
  for (const r of rows) r.byAccount.sort((a, b) => a.account_code.localeCompare(b.account_code));
  rows.sort((a, b) => a.code.localeCompare(b.code));
  return rows;
}

/** صورت‌حساب جاری شرکا (بند ۳۲): واریز/برداشت/هزینه پرداخت‌شده توسط شریک/بازپرداخت */
export interface ShareholderRow {
  partner: PartnerWithRoles;
  deposit: number;      /* واریز شریک */
  withdraw: number;     /* برداشت شریک */
  paidForCompany: number; /* هزینه پرداخت‌شده توسط شریک */
  repaid: number;       /* پرداخت شرکت به شریک */
  other: number;        /* سایر گردش‌ها */
  balance: number;      /* مانده نهایی بستانکار */
}

export async function shareholderCurrentAccounts(businessId: string): Promise<ShareholderRow[]> {
  const partners = await listPartnersV2(businessId, { role: 'shareholder' });
  const out: ShareholderRow[] = [];
  for (const p of partners) {
    const { data: det } = await supabase
      .from('acc_details')
      .select('id')
      .eq('business_id', businessId)
      .eq('ref_id', p.id)
      .eq('kind', 'shareholder')
      .maybeSingle();
    const detId = det?.id as string | undefined;
    if (!detId) continue;
    const st = await detailStatement(businessId, detId);
    /* تفکیک گردش‌های جاری شریک از شرح خط سند (که موتور سند می‌نویسد) */
    const isDeposit = (r: StatementRow) => /واریز|آورده/.test(`${r.line_desc || ''}`);
    const isWithdraw = (r: StatementRow) => /برداشت/.test(`${r.line_desc || ''}${r.description || ''}`);
    const isPaidForCompany = (r: StatementRow) => /پرداخت توسط/.test(`${r.line_desc || ''}${r.description || ''}`);
    const isRepaid = (r: StatementRow) => /بازپرداخت/.test(`${r.line_desc || ''}${r.description || ''}`);
    const on3103 = st.rows.filter((r) => r.account_code === '3103');
    const sumC = (rows: StatementRow[]) => rows.reduce((s, r) => s + r.credit - r.debit, 0); /* بستانکار */
    const sumD = (rows: StatementRow[]) => rows.reduce((s, r) => s + r.debit - r.credit, 0);
    const classified = on3103.filter((r) => isDeposit(r) || isWithdraw(r) || isPaidForCompany(r) || isRepaid(r));
    const otherRows = on3103.filter((r) => !classified.includes(r));
    out.push({
      partner: p,
      deposit: sumC(on3103.filter(isDeposit)),
      withdraw: sumD(on3103.filter(isWithdraw)),
      paidForCompany: sumC(on3103.filter(isPaidForCompany)),
      repaid: sumD(on3103.filter(isRepaid)),
      other: sumC(otherRows),
      balance: st.closing,
    });
  }
  return out;
}

/* ═══════════ ۵) کدینگ — قوانین تفصیلی (بند ۲۵ و ۶۴) ═══════════ */

export interface ChartRulesPatch {
  requires_detail?: boolean;
  allowed_detail_types?: string[];
  active?: boolean;
  title?: string;
}

/** به‌روزرسانی قوانین تفصیلی/فعال‌سازی سرفصل — فقط سرفصل‌های کسب‌وکار؛ سیستمی‌ها فقط قوانین */
export async function updateChartRules(code: string, businessId: string, patch: ChartRulesPatch): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (patch.requires_detail !== undefined) payload.requires_detail = patch.requires_detail;
  if (patch.allowed_detail_types !== undefined) payload.allowed_detail_types = patch.allowed_detail_types;
  if (patch.title !== undefined) payload.title = patch.title;
  if (patch.active !== undefined) payload.active = patch.active;
  if (!Object.keys(payload).length) return;
  const { error } = await supabase
    .from('acc_chart')
    .update(payload)
    .eq('code', code)
    .or(`business_id.is.null,business_id.eq.${businessId}`);
  if (error) throw error;
  await logActivity(businessId, 'account.updated', 'chart', code, JSON.stringify(patch));
}

/** گزارش گردش یک حساب معین بر اساس تفصیلی‌ها (بند ۷۶) — مانده/گردش هر تفصیلی زیر حساب */
export interface MoinTafsilRow {
  detail_id: string;
  detail_code: string | null;
  detail_title: string;
  detail_kind: string;
  debit: number;
  credit: number;
  balance: number;
}

export async function moinTafsilBreakdown(businessId: string, code: string, from?: string, to?: string): Promise<MoinTafsilRow[]> {
  let q = supabase
    .from('acc_journal_lines')
    .select(`
      debit, credit, detail_id,
      acc_details(detail_code, title, kind),
      acc_journal!inner(voided_at, ref_action, date_g)
    `)
    .eq('business_id', businessId)
    .like('account_code', `${code}%`)
    .not('detail_id', 'is', null);
  if (from) q = q.gte('acc_journal.date_g', from);
  if (to) q = q.lte('acc_journal.date_g', to);
  const { data, error } = await q;
  if (error) throw error;
  type Raw = {
    debit: number; credit: number; detail_id: string;
    acc_details: { detail_code: string | null; title: string; kind: string } | null;
    acc_journal: { voided_at: string | null; ref_action: string };
  };
  const map = new Map<string, MoinTafsilRow>();
  for (const r of (data || []) as unknown as Raw[]) {
    if (r.acc_journal.voided_at || r.acc_journal.ref_action === 'reverse' || !r.detail_id || !r.acc_details) continue;
    if (!map.has(r.detail_id)) {
      map.set(r.detail_id, {
        detail_id: r.detail_id,
        detail_code: r.acc_details.detail_code,
        detail_title: r.acc_details.title,
        detail_kind: r.acc_details.kind,
        debit: 0, credit: 0, balance: 0,
      });
    }
    const row = map.get(r.detail_id)!;
    row.debit += num(r.debit);
    row.credit += num(r.credit);
    row.balance = row.credit - row.debit;
  }
  return Array.from(map.values()).sort((a, b) => (a.detail_code || '').localeCompare(b.detail_code || ''));
}
