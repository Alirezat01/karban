/* لایه داده نسخه ۶ — پروژه‌ها، قراردادها، حقوق و دستمزد، دارایی‌ها،
   هزینه‌های تکرارشونده، قفل دوره، مغایرت‌گیری بانکی، لاگ فعالیت،
   ترازنامه، جست‌وجوی سراسری، پشتیبان‌گیری و بستن سال مالی */

import { supabase } from '@/lib/supabase';
import type {
  AccActivityRow, AccAsset, AccContract, AccEmployee, AccPayroll, AccPeriod,
  AccProject, AccReconciliation, AccRecurring, BalanceSheet, PayrollCalc,
  AccInvoice, AccExpense, AccPartner, AccItem, AccCheck, AccTransaction,
} from './types';
import { dateToISO, toGregorian, toJalali, todayJalali } from './jalali';

/* ═════════════════ پروژه‌ها و مراکز درآمد/هزینه ═════════════════ */

export async function listProjects(businessId: string): Promise<AccProject[]> {
  const { data, error } = await supabase
    .from('acc_projects')
    .select('*, partner:acc_partners(*)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as AccProject[];
}

export async function saveProject(businessId: string, row: Partial<AccProject>): Promise<string> {
  /* فقط ستون‌های واقعی — آبجکت join شده «partner» هرگز به دیتابیس نمی‌رود */
  const payload = {
    name: row.name,
    code: row.code ?? null,
    partner_id: row.partner_id ?? null,
    status: row.status || 'active',
    budget: Number(row.budget) || 0,
    start_date_g: row.start_date_g ?? null,
    end_date_g: row.end_date_g ?? null,
    description: row.description ?? null,
  };
  if (row.id) {
    const { error } = await supabase.from('acc_projects').update(payload).eq('id', row.id);
    if (error) throw error;
    return row.id;
  }
  const { data, error } = await supabase
    .from('acc_projects')
    .insert({ ...payload, business_id: businessId })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteProject(id: string) {
  const { error } = await supabase.from('acc_projects').delete().eq('id', id);
  if (error) throw error;
}

/* گزارش عملکرد هر پروژه: بودجه، درآمد (فاکتورها)، هزینه */
export interface ProjectPerformance {
  project: AccProject;
  income: number;
  expense: number;
  profit: number;
  budgetUsage: number;
}

export async function projectPerformance(businessId: string): Promise<ProjectPerformance[]> {
  const projects = await listProjects(businessId);
  if (!projects.length) return [];
  const [invoices, expenses] = await Promise.all([
    supabase.from('acc_invoices').select('project_id,total,type,voided_at').eq('business_id', businessId).in('type', ['sale']).in('status', ['issued', 'partial', 'paid']),
    supabase.from('acc_expenses').select('project_id,amount').eq('business_id', businessId),
  ]);
  const invRows = ((invoices.data || []) as { project_id: string | null; total: number; voided_at: string | null }[]).filter((r) => !r.voided_at);
  const expRows = (expenses.data || []) as { project_id: string | null; amount: number }[];
  return projects.map((project) => {
    const income = invRows.filter((r) => r.project_id === project.id).reduce((s, r) => s + (Number(r.total) || 0), 0);
    const expense = expRows.filter((r) => r.project_id === project.id).reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const profit = income - expense;
    const budgetUsage = project.budget > 0 ? Math.round((expense / project.budget) * 100) : 0;
    return { project, income, expense, profit, budgetUsage };
  });
}

/* ═════════════════ قراردادهای خدماتی ═════════════════ */

export async function listContracts(businessId: string): Promise<AccContract[]> {
  const { data, error } = await supabase
    .from('acc_contracts')
    .select('*, partner:acc_partners(*)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as AccContract[];
}

export async function saveContract(businessId: string, row: Partial<AccContract>): Promise<string> {
  /* فقط ستون‌های واقعی — آبجکت join شده «partner» هرگز به دیتابیس نمی‌رود */
  const payload = {
    title: row.title,
    partner_id: row.partner_id ?? null,
    project_id: row.project_id ?? null,
    amount: Number(row.amount) || 0,
    vat_rate: Number(row.vat_rate) || 0,
    status: row.status || 'draft',
    start_date_g: row.start_date_g ?? null,
    end_date_g: row.end_date_g ?? null,
    description: row.description ?? null,
  };
  if (row.id) {
    const { error } = await supabase.from('acc_contracts').update(payload).eq('id', row.id);
    if (error) throw error;
    return row.id;
  }
  const { data, error } = await supabase
    .from('acc_contracts')
    .insert({ ...payload, business_id: businessId })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteContract(id: string) {
  const { error } = await supabase.from('acc_contracts').delete().eq('id', id);
  if (error) throw error;
}

/* ═════════════════ کارکنان و حقوق و دستمزد ═════════════════ */

export async function listEmployees(businessId: string, onlyActive = false): Promise<AccEmployee[]> {
  let q = supabase.from('acc_employees').select('*').eq('business_id', businessId).order('name');
  if (onlyActive) q = q.eq('active', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as AccEmployee[];
}

const EMPLOYEE_COLS = (row: Partial<AccEmployee>) => ({
  name: row.name,
  national_id: row.national_id ?? null,
  personnel_code: row.personnel_code ?? null,
  position: row.position ?? null,
  hire_date_g: row.hire_date_g ?? null,
  base_salary: Number(row.base_salary) || 0,
  housing_allowance: Number(row.housing_allowance) || 0,
  food_allowance: Number(row.food_allowance) || 0,
  child_allowance: Number(row.child_allowance) || 0,
  child_count: Number(row.child_count) || 0,
  insurance_number: row.insurance_number ?? null,
  bank_account: row.bank_account ?? null,
  active: row.active ?? true,
  notes: row.notes ?? null,
});

export async function saveEmployee(businessId: string, row: Partial<AccEmployee>): Promise<string> {
  const payload = EMPLOYEE_COLS(row);
  if (row.id) {
    const { error } = await supabase.from('acc_employees').update(payload).eq('id', row.id);
    if (error) throw error;
    return row.id;
  }
  const { data, error } = await supabase
    .from('acc_employees')
    .insert({ ...payload, business_id: businessId })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteEmployee(id: string) {
  const { error } = await supabase.from('acc_employees').delete().eq('id', id);
  if (error) throw error;
}

/* پارامترهای محاسبه حقوق از تنظیمات ماشین‌حساب‌ها (calc_1405) */
export interface PayrollParams {
  overtime_coef: number;
  insurance_employee: number;
  insurance_employer: number;
  tax_exempt_monthly: number;
}

export async function fetchPayrollParams(): Promise<PayrollParams> {
  const fallback: PayrollParams = {
    overtime_coef: 1.4,
    insurance_employee: 0.07,
    insurance_employer: 0.23,
    tax_exempt_monthly: 100_000_000,
  };
  try {
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'calc_1405').maybeSingle();
    const v = (data?.value ?? {}) as Record<string, unknown>;
    const salary = (v.salary ?? {}) as Record<string, number>;
    const hiring = (v.hiring ?? {}) as Record<string, number>;
    return {
      overtime_coef: typeof salary.overtime_coef === 'number' ? salary.overtime_coef : fallback.overtime_coef,
      insurance_employee: typeof salary.insurance_employee === 'number' ? salary.insurance_employee : fallback.insurance_employee,
      insurance_employer: typeof hiring.insurance_employer === 'number' ? hiring.insurance_employer : fallback.insurance_employer,
      tax_exempt_monthly: typeof salary.tax_exempt_monthly === 'number' ? salary.tax_exempt_monthly : fallback.tax_exempt_monthly,
    };
  } catch {
    return fallback;
  }
}

/* محاسبه حقوق ماهانه یک کارمند — مطابق قانون کار (بیمه ۷٪، مالیات پله‌ای حقوق) */
export function computePayroll(
  emp: Pick<AccEmployee, 'base_salary' | 'housing_allowance' | 'food_allowance' | 'child_allowance' | 'child_count'>,
  opts: { overtimeHours: number; workDays: number; otherDeductions: number },
  params: PayrollParams,
): PayrollCalc {
  const daily = emp.base_salary / 30;
  /* کارکرد ناقص: حقوق پایه به نسبت روزهای کارکرد */
  const base = Math.round(daily * (opts.workDays >= 30 ? 30 : opts.workDays));
  const hourly = daily / 7.33; /* ۴۴ ساعت هفتگی تقریباً ۷٫۳۳ ساعت روزانه */
  const overtimePay = Math.round(hourly * params.overtime_coef * opts.overtimeHours);
  const housing = Math.round(emp.housing_allowance * (opts.workDays / 30));
  const food = Math.round(emp.food_allowance * (opts.workDays / 30));
  const family = emp.child_count > 0 ? emp.child_allowance : 0;
  const gross = base + housing + food + family + overtimePay;
  /* بیمه سهم کارگر فقط روی حقوق و مزایای مشمول (بدون حق اولاد) */
  const insurance = Math.round((base + housing + food) * params.insurance_employee);
  const employerInsurance = Math.round((base + housing + food) * params.insurance_employer);
  /* مالیات حقوق: معافیت ماهانه + پله‌های ۱۰/۱۵/۲۰/۳۰ درصد */
  const taxable = Math.max(0, gross - insurance - params.tax_exempt_monthly);
  let tax = 0;
  if (taxable > 0) {
    const steps = [
      { up: params.tax_exempt_monthly * 0.25, rate: 0.1 },
      { up: params.tax_exempt_monthly * 0.5, rate: 0.15 },
      { up: params.tax_exempt_monthly * 1, rate: 0.2 },
      { up: Infinity, rate: 0.3 },
    ];
    let rest = taxable;
    let prevUp = 0;
    for (const s of steps) {
      const slice = Math.min(rest, s.up - prevUp);
      if (slice > 0) tax += slice * s.rate;
      rest -= slice;
      prevUp = s.up;
      if (rest <= 0) break;
    }
    tax = Math.round(tax);
  }
  const net = gross - insurance - tax - opts.otherDeductions;
  return { hourly, overtimePay, gross, insurance, tax, net, employerInsurance };
}

export async function listPayrolls(businessId: string, jyear: number, jmonth: number): Promise<AccPayroll[]> {
  const { data, error } = await supabase
    .from('acc_payrolls')
    .select('*, employee:acc_employees(*)')
    .eq('business_id', businessId)
    .eq('jyear', jyear)
    .eq('jmonth', jmonth)
    .order('created_at');
  if (error) throw error;
  return (data || []) as unknown as AccPayroll[];
}

export async function savePayroll(businessId: string, row: Partial<AccPayroll>): Promise<string> {
  /* فقط ستون‌های واقعی — آبجکت join شده «employee» هرگز به دیتابیس نمی‌رود */
  const payload = {
    employee_id: row.employee_id ?? null,
    jyear: row.jyear,
    jmonth: row.jmonth,
    work_days: Number(row.work_days) || 0,
    overtime_hours: Number(row.overtime_hours) || 0,
    base_salary: Number(row.base_salary) || 0,
    food_allowance: Number(row.food_allowance) || 0,
    housing_allowance: Number(row.housing_allowance) || 0,
    family_allowance: Number(row.family_allowance) || 0,
    overtime_pay: Number(row.overtime_pay) || 0,
    gross: Number(row.gross) || 0,
    insurance_employee: Number(row.insurance_employee) || 0,
    tax: Number(row.tax) || 0,
    other_deductions: Number(row.other_deductions) || 0,
    net: Number(row.net) || 0,
    paid: row.paid ?? false,
    account_id: row.account_id ?? null,
    pay_date_g: row.pay_date_g ?? null,
  };
  if (row.id) {
    const { error } = await supabase.from('acc_payrolls').update(payload).eq('id', row.id);
    if (error) throw error;
    return row.id;
  }
  const { data, error } = await supabase
    .from('acc_payrolls')
    .insert({ ...payload, business_id: businessId })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deletePayroll(id: string) {
  const { error } = await supabase.from('acc_payrolls').delete().eq('id', id);
  if (error) throw error;
}

/* پرداخت حقوق: ثبت سند هزینه «حقوق و دستمزد» + لاگ */
export async function payPayroll(businessId: string, row: AccPayroll, accountId: string | null): Promise<void> {
  const today = dateToISO(new Date());
  await supabase.from('acc_expenses').insert({
    business_id: businessId,
    category: 'حقوق و دستمزد',
    title: `حقوق ${row.jyear}/${String(row.jmonth).padStart(2, '0')} — ${row.employee?.name || 'کارمند'}`,
    amount: row.gross,
    date_g: today,
    account_id: accountId,
    is_paid: true,
    description: `بیمه سهم کارگر: ${row.insurance_employee.toLocaleString('en-US')} — مالیات: ${row.tax.toLocaleString('en-US')} — خالص: ${row.net.toLocaleString('en-US')}`,
    tax_status: 'valid',
  });
  await supabase.from('acc_payrolls').update({ paid: true, account_id: accountId, pay_date_g: today }).eq('id', row.id);
  await logActivity(businessId, 'پرداخت حقوق', 'payroll', row.id, row.employee?.name || '');
}

/* ═════════════════ دارایی‌های ثابت ═════════════════ */

export async function listAssets(businessId: string): Promise<AccAsset[]> {
  const { data, error } = await supabase
    .from('acc_assets')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as AccAsset[];
}

export async function saveAsset(businessId: string, row: Partial<AccAsset>): Promise<string> {
  /* فقط ستون‌های واقعی جدول */
  const payload = {
    name: row.name,
    category: row.category ?? null,
    purchase_date_g: row.purchase_date_g ?? null,
    purchase_amount: Number(row.purchase_amount) || 0,
    useful_life_years: Number(row.useful_life_years) || 0,
    salvage_value: Number(row.salvage_value) || 0,
    account_id: row.account_id ?? null,
    status: row.status || 'active',
    sell_amount: row.sell_amount ?? null,
    sell_date_g: row.sell_date_g ?? null,
    notes: row.notes ?? null,
  };
  if (row.id) {
    const { error } = await supabase.from('acc_assets').update(payload).eq('id', row.id);
    if (error) throw error;
    return row.id;
  }
  const { data, error } = await supabase
    .from('acc_assets')
    .insert({ ...payload, business_id: businessId })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteAsset(id: string) {
  const { error } = await supabase.from('acc_assets').delete().eq('id', id);
  if (error) throw error;
}

/* استهلاک خط مستقیم: ماهانه و انباشته از تاریخ خرید */
export function assetDepreciation(asset: AccAsset, today = new Date()) {
  const life = asset.useful_life_years > 0 ? asset.useful_life_years : 1;
  const depreciable = Math.max(0, asset.purchase_amount - asset.salvage_value);
  const annual = depreciable / life;
  const monthly = annual / 12;
  let months = 0;
  if (asset.purchase_date_g) {
    const start = new Date(asset.purchase_date_g);
    months = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth());
  }
  const totalMonths = Math.round(life * 12);
  const usedMonths = Math.max(0, Math.min(months, totalMonths));
  const accumulated = Math.min(depreciable, Math.round(monthly * usedMonths));
  const bookValue = asset.purchase_amount - accumulated;
  return { annual, monthly, accumulated, bookValue, usedMonths, totalMonths };
}

/* ═════════════════ هزینه‌های تکرارشونده ═════════════════ */

export async function listRecurring(businessId: string): Promise<AccRecurring[]> {
  const { data, error } = await supabase
    .from('acc_recurring')
    .select('*, partner:acc_partners(*), account:acc_accounts(*)')
    .eq('business_id', businessId)
    .order('next_date_g');
  if (error) throw error;
  return (data || []) as unknown as AccRecurring[];
}

export async function saveRecurring(businessId: string, row: Partial<AccRecurring>): Promise<string> {
  /* فقط ستون‌های واقعی — آبجکت‌های join شده «partner/account» هرگز به دیتابیس نمی‌روند */
  const payload = {
    title: row.title,
    category: row.category ?? null,
    amount: Number(row.amount) || 0,
    vat_amount: Number(row.vat_amount) || 0,
    frequency: row.frequency || 'monthly',
    next_date_g: row.next_date_g,
    account_id: row.account_id ?? null,
    partner_id: row.partner_id ?? null,
    auto_create: row.auto_create ?? true,
    active: row.active ?? true,
    last_created_date_g: row.last_created_date_g ?? null,
    description: row.description ?? null,
  };
  if (row.id) {
    const { error } = await supabase.from('acc_recurring').update(payload).eq('id', row.id);
    if (error) throw error;
    return row.id;
  }
  const { data, error } = await supabase
    .from('acc_recurring')
    .insert({ ...payload, business_id: businessId })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteRecurring(id: string) {
  const { error } = await supabase.from('acc_recurring').delete().eq('id', id);
  if (error) throw error;
}

/* افزودن یک ماه/سه ماه/یک سال به تاریخ (میلادی ISO، محاسبه با تقویم شمسی) */
export function advanceJalali(iso: string, frequency: AccRecurring['frequency']): string {
  const d = new Date(iso);
  const j = toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const add = frequency === 'monthly' ? 1 : frequency === 'quarterly' ? 3 : 12;
  let m = j.jm + add;
  let y = j.jy;
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  const day = Math.min(j.jd, 29);
  const g = toGregorian(y, m, day);
  return dateToISO(new Date(g.gy, g.gm - 1, g.gd));
}

/* اجرای هزینه‌های سررسید‌شده: ساخت سند هزینه + جلو رفتن تاریخ بعدی */
export async function runDueRecurring(businessId: string): Promise<number> {
  const rows = await listRecurring(businessId);
  const today = dateToISO(new Date());
  const due = rows.filter((r) => r.active && r.next_date_g <= today);
  let created = 0;
  for (const r of due) {
    const { error } = await supabase.from('acc_expenses').insert({
      business_id: businessId,
      category: r.category || 'هزینه‌های عمومی',
      title: r.title,
      amount: r.amount,
      vat_amount: r.vat_amount,
      date_g: r.next_date_g,
      account_id: r.account_id,
      partner_id: r.partner_id,
      is_paid: true,
      description: `ثبت خودکار از هزینه تکرارشونده (${r.frequency === 'monthly' ? 'ماهانه' : r.frequency === 'quarterly' ? 'فصلی' : 'سالانه'})`,
      tax_status: r.vat_amount > 0 || r.amount > 0 ? 'valid' : 'incomplete',
    });
    if (!error) {
      created += 1;
      await supabase
        .from('acc_recurring')
        .update({ next_date_g: advanceJalali(r.next_date_g, r.frequency), last_created_date_g: r.next_date_g })
        .eq('id', r.id);
    }
  }
  if (created > 0) await logActivity(businessId, 'اجرای هزینه‌های تکرارشونده', 'recurring', null, `${created} سند`);
  return created;
}

/* ═════════════════ قفل دوره‌های مالی ═════════════════ */

export async function listPeriods(businessId: string): Promise<AccPeriod[]> {
  const { data, error } = await supabase.from('acc_periods').select('*').eq('business_id', businessId);
  if (error) throw error;
  return (data || []) as AccPeriod[];
}

export async function setPeriodLock(businessId: string, jyear: number, jmonth: number, locked: boolean): Promise<void> {
  const { error } = await supabase
    .from('acc_periods')
    .upsert(
      { business_id: businessId, jyear, jmonth, locked, locked_at: locked ? new Date().toISOString() : null },
      { onConflict: 'business_id,jyear,jmonth' },
    );
  if (error) throw error;
  await logActivity(businessId, locked ? 'قفل دوره مالی' : 'بازکردن دوره مالی', 'period', null, `${jyear}/${jmonth}`);
}

export async function isPeriodLocked(businessId: string, jyear: number, jmonth: number): Promise<boolean> {
  const { data } = await supabase
    .from('acc_periods')
    .select('locked')
    .eq('business_id', businessId)
    .eq('jyear', jyear)
    .eq('jmonth', jmonth)
    .maybeSingle();
  return !!data?.locked;
}

/* ═════════════════ مغایرت‌گیری بانکی ═════════════════ */

export async function listReconciliations(businessId: string): Promise<AccReconciliation[]> {
  const { data, error } = await supabase
    .from('acc_reconciliations')
    .select('*, account:acc_accounts(*)')
    .eq('business_id', businessId)
    .order('statement_date_g', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as AccReconciliation[];
}

export async function saveReconciliation(businessId: string, row: Partial<AccReconciliation>): Promise<string> {
  const payload = { ...row, difference: (row.statement_balance || 0) - (row.book_balance || 0) };
  if (row.id) {
    const { error } = await supabase.from('acc_reconciliations').update(payload).eq('id', row.id);
    if (error) throw error;
    return row.id;
  }
  const { data, error } = await supabase
    .from('acc_reconciliations')
    .insert({ ...payload, business_id: businessId })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteReconciliation(id: string) {
  const { error } = await supabase.from('acc_reconciliations').delete().eq('id', id);
  if (error) throw error;
}

/* ═════════════════ لاگ فعالیت کاربران ═════════════════ */

export async function logActivity(
  businessId: string,
  action: string,
  entity?: string | null,
  entityId?: string | null,
  detail?: string | null,
): Promise<void> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    await supabase.from('acc_activity').insert({
      business_id: businessId,
      user_id: auth.user?.id ?? null,
      user_email: auth.user?.email ?? null,
      action,
      entity: entity ?? null,
      entity_id: entityId ?? null,
      detail: detail ?? null,
    });
  } catch {
    /* لاگ هرگز جریان اصلی را نمی‌شکند */
  }
}

export async function listActivity(businessId: string, limit = 100): Promise<AccActivityRow[]> {
  const { data, error } = await supabase
    .from('acc_activity')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as AccActivityRow[];
}

/* ═════════════════ ترازنامه ═════════════════ */

export async function balanceSheet(businessId: string): Promise<BalanceSheet> {
  const { data: chart } = await supabase.from('acc_chart').select('*').or(`business_id.is.null,business_id.eq.${businessId}`);
  const { data: journal } = await supabase
    .from('acc_journal')
    .select('voided_at, ref_action, acc_journal_lines(account_code,debit,credit)')
    .eq('business_id', businessId)
    .is('voided_at', null)
    .neq('ref_action', 'reverse');
  type Line = { account_code: string; debit: number | null; credit: number | null };
  const lines = ((journal || []) as { acc_journal_lines: Line[] | null }[]).flatMap((j) => j.acc_journal_lines || []);
  const balances = new Map<string, { debit: number; credit: number }>();
  for (const l of lines) {
    const cur = balances.get(l.account_code) || { debit: 0, credit: 0 };
    cur.debit += Number(l.debit) || 0;
    cur.credit += Number(l.credit) || 0;
    balances.set(l.account_code, cur);
  }
  const rows = (chart || []) as { code: string; title: string; kind: string }[];
  const pick = (kind: string) =>
    rows
      .filter((c) => c.kind === kind && balances.has(c.code))
      .map((c) => {
        const b = balances.get(c.code)!;
        /* دارایی/هزینه: مانده بدهکار — بدهی/سرمایه/درآمد: مانده بستانکار */
        return { code: c.code, title: c.title, amount: kind === 'asset' || kind === 'expense' ? b.debit - b.credit : b.credit - b.debit };
      })
      .filter((r) => r.amount !== 0);
  /* سود دوره به سرمایه اضافه می‌شود */
  const assets = pick('asset');
  const liabilities = pick('liability');
  const equityRows = pick('equity');
  const income = pick('income');
  const expense = pick('expense');
  const netProfit = income.reduce((s, r) => s + r.amount, 0) - expense.reduce((s, r) => s + r.amount, 0);
  const equity = [...equityRows, { code: '3999', title: 'سود (زیان) انباشته دوره', amount: netProfit }];
  return {
    assets,
    totalAssets: assets.reduce((s, r) => s + r.amount, 0),
    liabilities,
    totalLiabilities: liabilities.reduce((s, r) => s + r.amount, 0),
    equity,
    totalEquity: equity.reduce((s, r) => s + r.amount, 0),
  };
}

/* ═════════════════ گزارش بستانکاران (پرداختنی‌ها) ═════════════════ */

export async function creditorsReport(businessId: string) {
  const { data } = await supabase
    .from('acc_invoices')
    .select('id,number,total,paid_total,due_date_g,partner:acc_partners(*)')
    .eq('business_id', businessId)
    .eq('type', 'purchase')
    .in('status', ['issued', 'partial'])
    .order('due_date_g');
  const rows = (data || []) as unknown as { id: string; number: string; total: number; paid_total: number; due_date_g: string | null; partner: AccPartner | null }[];
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    partner: r.partner?.name || '—',
    remaining: r.total - r.paid_total,
    dueDate: r.due_date_g,
    overdue: r.due_date_g ? r.due_date_g < dateToISO(new Date()) : false,
  }));
}

/* ═════════════════ جست‌وجوی پیشرفته سراسری ═════════════════ */

export interface GlobalSearchResult {
  invoices: AccInvoice[];
  partners: AccPartner[];
  items: AccItem[];
  expenses: AccExpense[];
  checks: AccCheck[];
  transactions: AccTransaction[];
  total: number;
}

export async function globalSearch(businessId: string, query: string): Promise<GlobalSearchResult> {
  const q = query.trim();
  const empty = { invoices: [], partners: [], items: [], expenses: [], checks: [], transactions: [], total: 0 };
  if (!q) return empty;
  const like = `%${q}%`;
  const [inv, part, itm, exp, chk, trx] = await Promise.all([
    supabase.from('acc_invoices').select('*').eq('business_id', businessId).or(`number.ilike.${like},description.ilike.${like}`).limit(10),
    supabase.from('acc_partners').select('*').eq('business_id', businessId).or(`name.ilike.${like},national_id.ilike.${like},economic_code.ilike.${like},phone.ilike.${like}`).limit(10),
    supabase.from('acc_items').select('*').eq('business_id', businessId).or(`name.ilike.${like},code.ilike.${like}`).limit(10),
    supabase.from('acc_expenses').select('*').eq('business_id', businessId).or(`title.ilike.${like},vendor_name.ilike.${like},receipt_no.ilike.${like},description.ilike.${like}`).limit(10),
    supabase.from('acc_checks').select('*').eq('business_id', businessId).or(`serial_no.ilike.${like},bank_name.ilike.${like},description.ilike.${like}`).limit(10),
    supabase.from('acc_transactions').select('*').eq('business_id', businessId).or(`description.ilike.${like}`).limit(10),
  ]);
  const invoices = (inv.data || []) as AccInvoice[];
  const partners = (part.data || []) as AccPartner[];
  const items = (itm.data || []) as AccItem[];
  const expenses = (exp.data || []) as AccExpense[];
  const checks = (chk.data || []) as AccCheck[];
  const transactions = (trx.data || []) as AccTransaction[];
  const total = invoices.length + partners.length + items.length + expenses.length + checks.length + transactions.length;
  return { invoices, partners, items, expenses, checks, transactions, total };
}

/* ═════════════════ پشتیبان‌گیری و بازیابی ═════════════════ */

export const BACKUP_TABLES = [
  'acc_partners', 'acc_items', 'acc_accounts', 'acc_invoices', 'acc_invoice_items',
  'acc_expenses', 'acc_transactions', 'acc_journal', 'acc_journal_lines', 'acc_chart',
  'acc_checks', 'acc_expense_categories', 'acc_projects', 'acc_contracts',
  'acc_employees', 'acc_payrolls', 'acc_assets', 'acc_recurring',
] as const;

export interface BackupBundle {
  version: 6;
  business_id: string;
  exported_at: string;
  tables: Record<string, Record<string, unknown>[]>;
}

export async function exportBackup(businessId: string): Promise<BackupBundle> {
  const tables: BackupBundle['tables'] = {};
  for (const table of BACKUP_TABLES) {
    const { data } = await supabase.from(table).select('*').eq('business_id', businessId);
    tables[table] = data || [];
  }
  await logActivity(businessId, 'تهیه پشتیبان', 'backup', null, 'خروجی JSON');
  return { version: 6, business_id: businessId, exported_at: new Date().toISOString(), tables };
}

export interface RestoreReport {
  table: string;
  inserted: number;
  error?: string;
}

/* بازیابی: ردیف‌های جدید insert می‌شوند (id قبلی حفظ می‌شود اگر ممکن باشد) */
export async function restoreBackup(businessId: string, bundle: BackupBundle): Promise<RestoreReport[]> {
  const reports: RestoreReport[] = [];
  for (const table of BACKUP_TABLES) {
    const rows = bundle.tables?.[table];
    if (!rows || !rows.length) {
      reports.push({ table, inserted: 0 });
      continue;
    }
    const payload = rows.map((r) => ({ ...r, business_id: businessId }));
    const { error, count } = await supabase.from(table).insert(payload as never, { count: 'exact' });
    reports.push({ table, inserted: count || 0, error: error?.message });
  }
  await logActivity(businessId, 'بازیابی پشتیبان', 'backup', null, 'ورودی JSON');
  return reports;
}

/* ═════════════════ بستن سال مالی ═════════════════ */

export interface YearCloseResult {
  entryNo: number;
  netProfit: number;
  revenueTotal: number;
  expenseTotal: number;
  lockedPeriods: number;
}

/* بستن سال مالی: سند اختتامیه (بستن درآمد/هزینه به سود انباشته) + قفل ۱۲ دوره */
export async function closeFiscalYear(businessId: string, jyear: number): Promise<YearCloseResult> {
  const { jalaliYearRange } = await import('./jalali');
  const { nextEntryNo } = await import('./api');
  const range = jalaliYearRange(jyear);
  const { data: journal } = await supabase
    .from('acc_journal')
    .select('acc_journal_lines(account_code,debit,credit)')
    .eq('business_id', businessId)
    .gte('date_g', range.from)
    .lte('date_g', range.to);
  type Line = { account_code: string; debit: number | null; credit: number | null };
  const lines = ((journal || []) as { acc_journal_lines: Line[] | null }[]).flatMap((j) => j.acc_journal_lines || []);
  const { data: chart } = await supabase.from('acc_chart').select('*').or(`business_id.is.null,business_id.eq.${businessId}`);
  const kindOf = (code: string) => ((chart || []) as { code: string; kind: string }[]).find((c) => c.code === code)?.kind;
  let revenueTotal = 0;
  let expenseTotal = 0;
  for (const l of lines) {
    const kind = kindOf(l.account_code);
    if (kind === 'income') revenueTotal += (Number(l.credit) || 0) - (Number(l.debit) || 0);
    if (kind === 'expense') expenseTotal += (Number(l.debit) || 0) - (Number(l.credit) || 0);
  }
  const netProfit = revenueTotal - expenseTotal;
  const entryNo = await nextEntryNo(businessId);
  const closingDate = jalaliYearRange(jyear).to;
  const { data: entry, error: entryErr } = await supabase
    .from('acc_journal')
    .insert({ business_id: businessId, entry_no: entryNo, date_g: closingDate, ref_type: 'manual', ref_action: 'post', description: `سند اختتامیه سال مالی ${jyear}` })
    .select('id')
    .single();
  if (entryErr) throw entryErr;
  const lineRows: Record<string, unknown>[] = [];
  const base = { entry_id: entry.id, business_id: businessId, partner_id: null };
  if (revenueTotal > 0) {
    lineRows.push({ ...base, account_code: '4001', account_title: 'درآمد فروش', debit: revenueTotal, credit: 0 });
  }
  if (expenseTotal > 0) {
    lineRows.push({ ...base, account_code: '3999', account_title: 'سود (زیان) انباشته', debit: 0, credit: expenseTotal });
  }
  lineRows.push({
    ...base,
    account_code: '3999',
    account_title: 'سود (زیان) انباشته',
    debit: revenueTotal > expenseTotal ? 0 : expenseTotal - revenueTotal,
    credit: revenueTotal > expenseTotal ? netProfit : 0,
  });
  const { error: linesErr } = await supabase.from('acc_journal_lines').insert(lineRows as never);
  if (linesErr) throw linesErr;
  /* قفل همه دوره‌های سال */
  let lockedPeriods = 0;
  for (let m = 1; m <= 12; m++) {
    await setPeriodLock(businessId, jyear, m, true);
    lockedPeriods += 1;
  }
  await logActivity(businessId, 'بستن سال مالی', 'journal', entry.id as string, `سال ${jyear} — سود: ${netProfit}`);
  return { entryNo, netProfit, revenueTotal, expenseTotal, lockedPeriods };
}
