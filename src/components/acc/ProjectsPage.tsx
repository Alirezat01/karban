/* پروژه‌ها و مراکز درآمد/هزینه — نسخه ۶
   تعریف پروژه، اتصال فاکتور و هزینه، گزارش سود هر پروژه نسبت به بودجه */

import { useEffect, useState } from 'react';
import { Briefcase, Pencil, Plus, Trash2, TrendingUp } from 'lucide-react';
import type { AccBusiness, AccProject } from '@/lib/acc/types';
import { deleteProject, listProjects, projectPerformance, saveProject, type ProjectPerformance } from '@/lib/acc/api6';
import { listPartners } from '@/lib/acc/api';
import { formatMoneyUnit } from '@/lib/acc/money';
import { formatJalali, toFaDigits } from '@/lib/acc/jalali';
import { Field, Modal, MoneyInput, confirmAction, toast, EmptyState } from './ui';

const STATUS_LABEL: Record<string, string> = { active: 'فعال', done: 'پایان‌یافته', archived: 'بایگانی' };

export default function ProjectsPage({ business }: { business: AccBusiness }) {
  const [perf, setPerf] = useState<ProjectPerformance[]>([]);
  const [partners, setPartners] = useState<{ id: string; name: string }[]>([]);
  const [editing, setEditing] = useState<Partial<AccProject> | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [p, pr] = await Promise.all([projectPerformance(business.id), listPartners(business.id)]);
      setPerf(p);
      setPartners(pr.map((x) => ({ id: x.id, name: x.name })));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [business.id]);

  async function save() {
    if (!editing?.name?.trim()) { toast('نام پروژه الزامی است', 'error'); return; }
    try {
      await saveProject(business.id, editing);
      toast('ذخیره شد');
      setEditing(null);
      load();
    } catch {
      toast('ذخیره ناموفق بود', 'error');
    }
  }

  async function remove(row: AccProject) {
    if (!(await confirmAction(`پروژه «${row.name}» حذف شود؟`))) return;
    try {
      await deleteProject(row.id);
      toast('حذف شد');
      load();
    } catch {
      toast('حذف ناموفق بود', 'error');
    }
  }

  const totalIncome = perf.reduce((s, r) => s + r.income, 0);
  const totalExpense = perf.reduce((s, r) => s + r.expense, 0);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div className="acc-kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="acc-kpi">
          <div className="k-label"><Briefcase size={15} /> پروژه‌های فعال</div>
          <div className="k-value">{toFaDigits(perf.filter((r) => r.project.status === 'active').length)}</div>
        </div>
        <div className="acc-kpi">
          <div className="k-label"><TrendingUp size={15} /> درآمد کل پروژه‌ها</div>
          <div className="k-value">{formatMoneyUnit(totalIncome, business.currency)}</div>
        </div>
        <div className="acc-kpi">
          <div className="k-label">هزینه کل پروژه‌ها</div>
          <div className="k-value">{formatMoneyUnit(totalExpense, business.currency)}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <button className="acc-btn acc-btn-primary" onClick={() => setEditing({ status: 'active', budget: 0 })}><Plus size={15} /> پروژه جدید</button>
      </div>

      <div className="acc-table-wrap">
        <table className="acc-table">
          <thead>
            <tr>
              <th>پروژه</th><th>مشتری</th><th>وضعیت</th><th>بودجه</th>
              <th>درآمد</th><th>هزینه</th><th>سود</th><th>مصرف بودجه</th><th>پایان</th><th></th>
            </tr>
          </thead>
          <tbody>
            {perf.map(({ project: r, income, expense, profit, budgetUsage }) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.name}{r.code ? <small style={{ display: 'block', opacity: .6 }}>{r.code}</small> : null}</td>
                <td>{r.partner?.name || '—'}</td>
                <td>{STATUS_LABEL[r.status]}</td>
                <td className="num">{r.budget ? formatMoneyUnit(r.budget, business.currency) : '—'}</td>
                <td className="num">{formatMoneyUnit(income, business.currency)}</td>
                <td className="num" style={{ color: expense > income ? '#ef9a94' : undefined }}>{formatMoneyUnit(expense, business.currency)}</td>
                <td className="num" style={{ color: profit >= 0 ? 'var(--gold2)' : '#ef9a94', fontWeight: 700 }}>{formatMoneyUnit(profit, business.currency)}</td>
                <td className="num">{r.budget > 0 ? `${toFaDigits(budgetUsage)}٪` : '—'}</td>
                <td className="num">{r.end_date_g ? formatJalali(r.end_date_g) : '—'}</td>
                <td>
                  <div className="row-actions">
                    <button className="acc-icon-btn" onClick={() => setEditing(r)}><Pencil size={14} /></button>
                    <button className="acc-icon-btn danger" onClick={() => remove(r)}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && perf.length === 0 && (
          <EmptyState icon={<Briefcase size={34} />} title="پروژه‌ای ثبت نشده" hint="برای هر کار بزرگ یا قرارداد، یک پروژه بسازید تا درآمد و هزینه‌اش جدا دیده شود" />
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'ویرایش پروژه' : 'پروژه جدید'}>
        {editing && (
          <div style={{ display: 'grid', gap: '.8rem' }}>
            <div className="acc-form-grid">
              <Field label="نام پروژه *"><input className="acc-input" placeholder="مثلاً: پروژه ساخت اپ موبایل" value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="کد پروژه"><input className="acc-input" value={editing.code || ''} onChange={(e) => setEditing({ ...editing, code: e.target.value })} /></Field>
            </div>
            <div className="acc-form-grid">
              <Field label="مشتری / کارفرما">
                <select className="acc-select" value={editing.partner_id || ''} onChange={(e) => setEditing({ ...editing, partner_id: e.target.value || null })}>
                  <option value="">— انتخاب کنید —</option>
                  {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="وضعیت">
                <select className="acc-select" value={editing.status || 'active'} onChange={(e) => setEditing({ ...editing, status: e.target.value as AccProject['status'] })}>
                  <option value="active">فعال</option>
                  <option value="done">پایان‌یافته</option>
                  <option value="archived">بایگانی</option>
                </select>
              </Field>
            </div>
            <div className="acc-form-grid">
              <Field label="بودجه (ریال)"><MoneyInput value={editing.budget || 0} onChange={(n) => setEditing({ ...editing, budget: n })} /></Field>
              <Field label="تاریخ پایان" hint="اختیاری">
                <input className="acc-input num" placeholder="۱۴۰۵/۱۲/۲۹" value={editing.end_date_g || ''} onChange={(e) => setEditing({ ...editing, end_date_g: e.target.value })} />
              </Field>
            </div>
            <Field label="توضیح"><textarea className="acc-input" rows={2} value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            <div style={{ display: 'flex', gap: '.6rem' }}>
              <button className="acc-btn acc-btn-primary" onClick={save}>ذخیره</button>
              <button className="acc-btn acc-btn-outline" onClick={() => setEditing(null)}>انصراف</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
