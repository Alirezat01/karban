/* حقوق و دستمزد + بیمه کارکنان — نسخه ۶
   مدیریت کارکنان، فیش حقوقی ماهانه با محاسبه خودکار:
   بیمه سهم کارگر ۷٪ / کارفرما ۲۳٪، مالیات پله‌ای حقوق، اضافه‌کاری قانونی */

import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Banknote, Pencil, Plus, Trash2, Users, Wallet } from 'lucide-react';
import type { AccBusiness, AccEmployee, AccPayroll } from '@/lib/acc/types';
import {
  computePayroll, deleteEmployee, deletePayroll, fetchPayrollParams, listEmployees,
  listPayrolls, payPayroll, saveEmployee, savePayroll, type PayrollParams,
} from '@/lib/acc/api6';
import { listAccounts } from '@/lib/acc/api';
import { formatMoney, formatMoneyUnit } from '@/lib/acc/money';
import { JALALI_MONTHS, toFaDigits, todayJalali } from '@/lib/acc/jalali';
import { Field, Modal, MoneyInput, QtyInput, DigitsInput, JalaliDateInput, confirmAction, toast, EmptyState } from './ui';

export default function PayrollPage({ business }: { business: AccBusiness }) {
  const today = todayJalali();
  const [tab, setTab] = useState<'list' | 'month'>('list');
  const [employees, setEmployees] = useState<AccEmployee[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [params, setParams] = useState<PayrollParams | null>(null);
  const [editing, setEditing] = useState<Partial<AccEmployee> | null>(null);
  const [loading, setLoading] = useState(true);

  const [py, setPy] = useState(today.jy);
  const [pm, setPm] = useState(today.jm);
  const [rows, setRows] = useState<AccPayroll[]>([]);
  const [monthLoading, setMonthLoading] = useState(false);
  /* پیش‌نویس محاسبات در ماه جاری: employee_id → ساعت اضافه‌کاری و کسورات */
  const [overtime, setOvertime] = useState<Record<string, number>>({});
  const [deductions, setDeductions] = useState<Record<string, number>>({});

  async function load() {
    setLoading(true);
    try {
      const [em, ac, pr] = await Promise.all([listEmployees(business.id), listAccounts(business.id), fetchPayrollParams()]);
      setEmployees(em);
      setAccounts(ac.filter((a) => a.active).map((a) => ({ id: a.id, name: a.name })));
      setParams(pr);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [business.id]);

  async function loadMonth() {
    setMonthLoading(true);
    try {
      const r = await listPayrolls(business.id, py, pm);
      setRows(r);
      const ot: Record<string, number> = {};
      const de: Record<string, number> = {};
      for (const row of r) {
        ot[row.employee_id] = row.overtime_hours;
        de[row.employee_id] = row.other_deductions;
      }
      setOvertime(ot);
      setDeductions(de);
    } finally {
      setMonthLoading(false);
    }
  }
  useEffect(() => { loadMonth(); }, [business.id, py, pm]);

  async function submitEmployee() {
    if (!editing?.name?.trim()) { toast('نام کارمند الزامی است', 'error'); return; }
    try {
      await saveEmployee(business.id, editing);
      toast('ذخیره شد');
      setEditing(null);
      load();
    } catch {
      toast('ذخیره ناموفق بود', 'error');
    }
  }

  async function removeEmployee(row: AccEmployee) {
    if (!(await confirmAction(`کارمند «${row.name}» و همه فیش‌های حقوقی‌اش حذف شود؟`))) return;
    try {
      await deleteEmployee(row.id);
      toast('حذف شد');
      load();
    } catch {
      toast('حذف ناموفق بود', 'error');
    }
  }

  /* محاسبه زنده هر کارمند در ماه انتخابی */
  const calcFor = useMemo(() => {
    if (!params) return () => null;
    return (emp: AccEmployee) =>
      computePayroll(emp, { overtimeHours: overtime[emp.id] || 0, workDays: 30, otherDeductions: deductions[emp.id] || 0 }, params);
  }, [params, overtime, deductions]);

  async function saveAll() {
    if (!params) return;
    try {
      for (const emp of employees) {
        const c = computePayroll(emp, { overtimeHours: overtime[emp.id] || 0, workDays: 30, otherDeductions: deductions[emp.id] || 0 }, params);
        const existing = rows.find((r) => r.employee_id === emp.id);
        const payload: Partial<AccPayroll> = {
          employee_id: emp.id,
          jyear: py,
          jmonth: pm,
          work_days: 30,
          overtime_hours: overtime[emp.id] || 0,
          base_salary: emp.base_salary,
          food_allowance: emp.food_allowance,
          housing_allowance: emp.housing_allowance,
          family_allowance: emp.child_count > 0 ? emp.child_allowance : 0,
          overtime_pay: c.overtimePay,
          gross: c.gross,
          insurance_employee: c.insurance,
          tax: c.tax,
          other_deductions: deductions[emp.id] || 0,
          net: c.net,
        };
        if (existing) payload.id = existing.id;
        await savePayroll(business.id, payload);
      }
      toast('فیش حقوقی همه کارکنان ذخیره شد');
      loadMonth();
    } catch {
      toast('ذخیره ناموفق بود — شاید این ماه قفل شده باشد', 'error');
    }
  }

  async function pay(row: AccPayroll) {
    if (!(await confirmAction(`حقوق ${row.employee?.name} به مبلغ ${formatMoney(row.net)} ریال پرداخت و در هزینه‌ها ثبت شود؟`, false))) return;
    try {
      await payPayroll(business.id, row, row.account_id);
      toast('پرداخت ثبت شد و به هزینه‌های ماه اضافه شد');
      loadMonth();
    } catch {
      toast('ثبت پرداخت ناموفق بود', 'error');
    }
  }

  async function removePayroll(row: AccPayroll) {
    if (!(await confirmAction('این فیش حقوقی حذف شود؟'))) return;
    try {
      await deletePayroll(row.id);
      toast('حذف شد');
      loadMonth();
    } catch {
      toast('حذف ناموفق بود', 'error');
    }
  }

  const totalNet = employees.reduce((s, emp) => s + (calcFor(emp)?.net || 0), 0);
  const totalEmployer = employees.reduce((s, emp) => s + (calcFor(emp)?.employerInsurance || 0), 0);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div className="acc-tabs">
        <button className={tab === 'list' ? 'is-active' : ''} onClick={() => setTab('list')}>کارکنان</button>
        <button className={tab === 'month' ? 'is-active' : ''} onClick={() => setTab('month')}>لیست حقوق ماهانه</button>
      </div>

      {tab === 'list' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <button className="acc-btn acc-btn-primary" onClick={() => setEditing({ active: true, base_salary: 0, child_count: 0 })}><Plus size={15} /> کارمند جدید</button>
          </div>
          <div className="acc-table-wrap">
            <table className="acc-table">
              <thead>
                <tr><th>نام</th><th>کد ملی</th><th>سمت</th><th>حقوق پایه (ریال)</th><th>بن و کمک‌ها</th><th>تعداد فرزند</th><th>وضعیت</th><th></th></tr>
              </thead>
              <tbody>
                {employees.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td className="num">{r.national_id ? toFaDigits(r.national_id) : '—'}</td>
                    <td>{r.position || '—'}</td>
                    <td className="num">{formatMoney(r.base_salary)}</td>
                    <td className="num">{formatMoney(r.food_allowance + r.housing_allowance + r.child_allowance)}</td>
                    <td className="num">{toFaDigits(r.child_count)}</td>
                    <td>{r.active ? 'فعال' : 'غیرفعال'}</td>
                    <td>
                      <div className="row-actions">
                        <button className="acc-icon-btn" onClick={() => setEditing(r)}><Pencil size={14} /></button>
                        <button className="acc-icon-btn danger" onClick={() => removeEmployee(r)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && employees.length === 0 && (
              <EmptyState icon={<Users size={34} />} title="کارمندی ثبت نشده" hint="مشخصات کارکنان را ثبت کنید تا لیست حقوق و بیمه خودکار محاسبه شود" />
            )}
          </div>
        </>
      )}

      {tab === 'month' && (
        <>
          <div className="acc-form-grid" style={{ alignItems: 'end' }}>
            <Field label="سال"><QtyInput value={py} onChange={(n) => setPy(Math.round(n) || today.jy)} /></Field>
            <Field label="ماه">
              <select className="acc-select" value={pm} onChange={(e) => setPm(Number(e.target.value))}>
                {JALALI_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </Field>
            <button className="acc-btn acc-btn-primary" onClick={saveAll} disabled={!employees.length}>ذخیره لیست حقوق</button>
          </div>

          <div className="acc-kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="acc-kpi">
              <div className="k-label"><Wallet size={15} /> خالص پرداختی ماه</div>
              <div className="k-value">{formatMoneyUnit(totalNet, business.currency)}</div>
            </div>
            <div className="acc-kpi">
              <div className="k-label"><Banknote size={15} /> بیمه سهم کارفرما (۲۳٪)</div>
              <div className="k-value">{formatMoneyUnit(totalEmployer, business.currency)}</div>
            </div>
            <div className="acc-kpi">
              <div className="k-label"><Users size={15} /> تعداد کارکنان</div>
              <div className="k-value">{toFaDigits(employees.length)}</div>
            </div>
          </div>

          <div className="acc-table-wrap">
            <table className="acc-table">
              <thead>
                <tr>
                  <th>کارمند</th><th>اضافه‌کاری (ساعت)</th><th>حقوق پایه</th><th>اضافه‌کاری</th>
                  <th>جمع ناخالص</th><th>بیمه ۷٪</th><th>مالیات</th><th>کسور دیگر</th><th>خالص</th><th>وضعیت</th><th></th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const c = calcFor(emp);
                  const existing = rows.find((r) => r.employee_id === emp.id);
                  if (!c) return null;
                  return (
                    <tr key={emp.id}>
                      <td style={{ fontWeight: 600 }}>{emp.name}</td>
                      <td><QtyInput value={overtime[emp.id] || 0} onChange={(n) => setOvertime({ ...overtime, [emp.id]: n })} /></td>
                      <td className="num">{formatMoney(c.gross - c.overtimePay - (emp.child_count > 0 ? emp.child_allowance : 0))}</td>
                      <td className="num">{formatMoney(c.overtimePay)}</td>
                      <td className="num">{formatMoney(c.gross)}</td>
                      <td className="num">{formatMoney(c.insurance)}</td>
                      <td className="num">{formatMoney(c.tax)}</td>
                      <td><MoneyInput value={deductions[emp.id] || 0} onChange={(n) => setDeductions({ ...deductions, [emp.id]: n })} /></td>
                      <td className="num" style={{ fontWeight: 700, color: 'var(--gold2)' }}>{formatMoney(c.net)}</td>
                      <td>{existing?.paid ? <span style={{ color: 'var(--gold2)', display: 'flex', alignItems: 'center', gap: '.3rem' }}><BadgeCheck size={14} /> پرداخت شد</span> : 'پرداخت نشده'}</td>
                      <td>
                        <div className="row-actions">
                          {existing && !existing.paid && <button className="acc-btn acc-btn-primary" style={{ padding: '.3rem .7rem', fontSize: '.75rem' }} onClick={() => pay(existing)}>پرداخت</button>}
                          {existing && <button className="acc-icon-btn danger" onClick={() => removePayroll(existing)}><Trash2 size={14} /></button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!monthLoading && employees.length === 0 && (
              <EmptyState icon={<Users size={34} />} title="ابتدا کارکنان را ثبت کنید" hint="در تب «کارکنان» مشخصات و حقوق پایه هر نفر را وارد کنید" />
            )}
          </div>
          <p className="acc-hint">محاسبات بر اساس پارامترهای قانونی پنل ادمین انجام می‌شود: بیمه سهم کارگر ۷٪ و کارفرما ۲۳٪، معافیت مالیاتی ماهانه و پله‌های ۱۰/۱۵/۲۰/۳۰٪. پرداخت هر فیش به‌صورت خودکار سند هزینه «حقوق و دستمزد» می‌سازد.</p>
        </>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'ویرایش کارمند' : 'کارمند جدید'}>
        {editing && (
          <div style={{ display: 'grid', gap: '.8rem' }}>
            <div className="acc-form-grid">
              <Field label="نام و نام خانوادگی *"><input className="acc-input" value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="کد ملی"><DigitsInput value={editing.national_id || ''} onChange={(v) => setEditing({ ...editing, national_id: v })} maxLength={10} /></Field>
            </div>
            <div className="acc-form-grid">
              <Field label="کد پرسنلی"><input className="acc-input" value={editing.personnel_code || ''} onChange={(e) => setEditing({ ...editing, personnel_code: e.target.value })} /></Field>
              <Field label="سمت"><input className="acc-input" value={editing.position || ''} onChange={(e) => setEditing({ ...editing, position: e.target.value })} /></Field>
            </div>
            <div className="acc-form-grid">
              <Field label="حقوق پایه ماهانه (ریال)"><MoneyInput value={editing.base_salary || 0} onChange={(n) => setEditing({ ...editing, base_salary: n })} /></Field>
              <Field label="تاریخ استخدام"><JalaliDateInput value={editing.hire_date_g || ''} onChange={(iso) => setEditing({ ...editing, hire_date_g: iso })} /></Field>
            </div>
            <div className="acc-form-grid">
              <Field label="بن خواروبار (ریال)"><MoneyInput value={editing.food_allowance || 0} onChange={(n) => setEditing({ ...editing, food_allowance: n })} /></Field>
              <Field label="کمک مسکن (ریال)"><MoneyInput value={editing.housing_allowance || 0} onChange={(n) => setEditing({ ...editing, housing_allowance: n })} /></Field>
            </div>
            <div className="acc-form-grid">
              <Field label="حق اولاد هر فرزند (ریال)"><MoneyInput value={editing.child_allowance || 0} onChange={(n) => setEditing({ ...editing, child_allowance: n })} /></Field>
              <Field label="تعداد فرزند مشمول"><QtyInput value={editing.child_count || 0} onChange={(n) => setEditing({ ...editing, child_count: Math.round(n) })} /></Field>
            </div>
            <div className="acc-form-grid">
              <Field label="شماره بیمه تأمین اجتماعی"><DigitsInput value={editing.insurance_number || ''} onChange={(v) => setEditing({ ...editing, insurance_number: v })} maxLength={20} /></Field>
              <Field label="شماره حساب یا شبا"><input className="acc-input num" value={editing.bank_account || ''} onChange={(e) => setEditing({ ...editing, bank_account: e.target.value })} /></Field>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.85rem' }}>
              <input type="checkbox" checked={editing.active ?? true} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
              کارمند فعال است
            </label>
            <div style={{ display: 'flex', gap: '.6rem' }}>
              <button className="acc-btn acc-btn-primary" onClick={submitEmployee}>ذخیره</button>
              <button className="acc-btn acc-btn-outline" onClick={() => setEditing(null)}>انصراف</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
