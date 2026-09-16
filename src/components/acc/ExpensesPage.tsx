/* هزینه‌ها — با قید خودکار حسابداری و اعتبار مالیاتی ارزش افزوده */

import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Receipt, Search, Trash2 } from 'lucide-react';
import type { AccBusiness, AccExpense } from '@/lib/acc/types';
import { deleteExpense, listAccounts, listExpenses, saveExpense } from '@/lib/acc/api';
import { EXPENSE_CATEGORIES } from '@/lib/acc/constants';
import { formatMoney } from '@/lib/acc/money';
import { formatJalali } from '@/lib/acc/jalali';
import { Field, JalaliDateInput, Modal, MoneyInput, confirmAction, toast, EmptyState } from './ui';

interface AccountLite { id: string; name: string; kind: string; balance?: number }

export default function ExpensesPage({ business }: { business: AccBusiness }) {
  const [rows, setRows] = useState<AccExpense[]>([]);
  const [accounts, setAccounts] = useState<AccountLite[]>([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Partial<AccExpense> | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [e, a] = await Promise.all([listExpenses(business.id), listAccounts(business.id)]);
      setRows(e);
      setAccounts(a);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [business.id]);

  const filtered = useMemo(
    () => rows.filter((r) => (r.title + r.category).includes(query)),
    [rows, query],
  );

  async function save() {
    if (!editing?.title?.trim()) { toast('عنوان هزینه الزامی است', 'error'); return; }
    try {
      await saveExpense(business.id, editing);
      toast('هزینه ثبت و سند حسابداری آن ثبت شد');
      setEditing(null);
      load();
    } catch {
      toast('ثبت ناموفق بود', 'error');
    }
  }

  async function remove(row: AccExpense) {
    if (!(await confirmAction(`هزینه «${row.title}» حذف شود؟ سند حسابداری آن نیز حذف می‌شود.`))) return;
    try {
      await deleteExpense(row.id);
      toast('حذف شد');
      load();
    } catch {
      toast('حذف ناموفق بود', 'error');
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={15} style={{ position: 'absolute', top: 14, right: 12, color: 'var(--muted)' }} />
          <input className="acc-input" placeholder="جست‌وجو…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ paddingRight: '2.3rem' }} />
        </div>
        <button className="acc-btn acc-btn-primary" onClick={() => setEditing({ category: 'اداری و عمومی', is_paid: true, date_g: new Date().toISOString().slice(0, 10) })}><Plus size={15} /> ثبت هزینه</button>
      </div>

      <div className="acc-table-wrap">
        <table className="acc-table">
          <thead>
            <tr><th>تاریخ</th><th>عنوان</th><th>دسته</th><th>مبلغ (ریال)</th><th>مالیات (اعتبار)</th><th>پرداخت از</th><th>وضعیت</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className="num">{formatJalali(r.date_g)}</td>
                <td style={{ fontWeight: 600 }}>{r.title}</td>
                <td>{r.category}</td>
                <td className="num">{formatMoney(r.amount)}</td>
                <td className="num">{formatMoney(r.vat_amount)}</td>
                <td>{r.is_paid ? (r.account?.name || 'نسیه (پرداختنی)') : 'ثبت نشده'}</td>
                <td>{r.is_paid ? <span className="acc-badge ok">ثبت شده</span> : <span className="acc-badge draft">تعهدی</span>}</td>
                <td>
                  <div className="row-actions">
                    <button className="acc-icon-btn" onClick={() => setEditing(r)}><Pencil size={14} /></button>
                    <button className="acc-icon-btn danger" onClick={() => remove(r)}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={3}>جمع کل</td>
                <td className="num">{formatMoney(filtered.reduce((s, r) => s + r.amount, 0))}</td>
                <td className="num">{formatMoney(filtered.reduce((s, r) => s + r.vat_amount, 0))}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          )}
        </table>
        {!loading && filtered.length === 0 && (
          <EmptyState icon={<Receipt size={34} />} title="هزینه‌ای ثبت نشده" hint="هزینه‌های عملیاتی را ثبت کنید تا سود واقعی و مالیات صحیح محاسبه شود" />
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'ویرایش هزینه' : 'ثبت هزینه جدید'}>
        {editing && (
          <div style={{ display: 'grid', gap: '.8rem' }}>
            <div className="acc-form-grid">
              <Field label="عنوان هزینه *"><input className="acc-input" value={editing.title || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
              <Field label="دسته" hint="دسته، سرفصل حسابداری هزینه را تعیین می‌کند">
                <select className="acc-select" value={editing.category || 'اداری و عمومی'} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                  {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <div className="acc-form-grid">
              <Field label="مبلغ خالص (ریال)"><MoneyInput value={editing.amount || 0} onChange={(n) => setEditing({ ...editing, amount: n })} /></Field>
              <Field label="مالیات ارزش افزوده (ریال)" hint="اعتبار مالیاتی خرید — از مالیات فروش کسر می‌شود">
                <MoneyInput value={editing.vat_amount || 0} onChange={(n) => setEditing({ ...editing, vat_amount: n })} />
              </Field>
            </div>
            <div className="acc-form-grid">
              <Field label="تاریخ"><JalaliDateInput value={editing.date_g || ''} onChange={(iso) => setEditing({ ...editing, date_g: iso })} /></Field>
              <Field label="پرداخت از حساب" hint="«نسیه» یعنی در حساب‌های پرداختنی ثبت می‌شود">
                <select className="acc-select" value={editing.account_id || ''} onChange={(e) => setEditing({ ...editing, account_id: e.target.value || null })}>
                  <option value="">نسیه (پرداختنی)</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label=" ">
              <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.84rem', color: 'var(--text)' }}>
                <input type="checkbox" checked={editing.is_paid ?? true} onChange={(e) => setEditing({ ...editing, is_paid: e.target.checked })} />
                این هزینه قطعی شده است (سند حسابداری ثبت شود)
              </label>
            </Field>
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
