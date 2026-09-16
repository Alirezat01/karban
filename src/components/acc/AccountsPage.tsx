/* بانک و صندوق — حساب‌های نقدی با مانده زنده */

import React, { useEffect, useState } from 'react';
import { Building, Landmark, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import type { AccBusiness, AccAccount } from '@/lib/acc/types';
import { deleteAccount, listAccounts, saveAccount } from '@/lib/acc/api';
import { formatMoney, formatMoneyUnit } from '@/lib/acc/money';
import { Field, Modal, MoneyInput, confirmAction, toast, EmptyState } from './ui';

type AccountWithBalance = AccAccount & { balance?: number };

const kindIcon = (kind: string) => (kind === 'cash' ? Wallet : kind === 'card' ? Building : Landmark);

export default function AccountsPage({ business }: { business: AccBusiness }) {
  const [rows, setRows] = useState<AccountWithBalance[]>([]);
  const [editing, setEditing] = useState<Partial<AccountWithBalance> | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { setRows(await listAccounts(business.id)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [business.id]);

  async function save() {
    if (!editing?.name?.trim()) { toast('نام حساب الزامی است', 'error'); return; }
    try {
      await saveAccount(business.id, editing);
      toast('ذخیره شد');
      setEditing(null);
      load();
    } catch {
      toast('ذخیره ناموفق بود', 'error');
    }
  }

  async function remove(row: AccountWithBalance) {
    if (!(await confirmAction(`حساب «${row.name}» حذف شود؟ اسناد مرتبط حفظ می‌شوند.`))) return;
    try {
      await deleteAccount(row.id);
      toast('حذف شد');
      load();
    } catch {
      toast('حذف ناموفق بود', 'error');
    }
  }

  const totalBalance = rows.reduce((s, r) => s + (r.balance || 0), 0);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div className="acc-kpi-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <div className="acc-kpi">
          <div className="k-label"><Wallet size={15} /> موجودی کل نقد و بانک</div>
          <div className="k-value">{formatMoneyUnit(totalBalance, business.currency)}</div>
        </div>
        <div className="acc-kpi">
          <div className="k-label"><Landmark size={15} /> تعداد حساب‌ها</div>
          <div className="k-value">{rows.length}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <button className="acc-btn acc-btn-primary" onClick={() => setEditing({ kind: 'bank', initial_balance: 0 })}><Plus size={15} /> حساب جدید</button>
      </div>

      <div className="acc-table-wrap">
        <table className="acc-table">
          <thead>
            <tr><th>نام حساب</th><th>نوع</th><th>شماره حساب/کارت</th><th>مانده اولیه (ریال)</th><th>مانده فعلی (ریال)</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const Icon = kindIcon(r.kind);
              return (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '.5rem' }}><Icon size={15} color="var(--gold)" /> {r.name}</td>
                  <td>{r.kind === 'cash' ? 'صندوق' : r.kind === 'card' ? 'کارت بانکی' : 'حساب بانکی'}</td>
                  <td className="num">{r.account_number || '—'}</td>
                  <td className="num">{formatMoney(r.initial_balance)}</td>
                  <td className="num" style={{ color: (r.balance || 0) >= 0 ? 'var(--gold2)' : '#ef9a94', fontWeight: 700 }}>{formatMoney(r.balance || 0)}</td>
                  <td>
                    <div className="row-actions">
                      <button className="acc-icon-btn" onClick={() => setEditing(r)}><Pencil size={14} /></button>
                      <button className="acc-icon-btn danger" onClick={() => remove(r)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && rows.length === 0 && (
          <EmptyState icon={<Wallet size={34} />} title="حسابی ثبت نشده" hint="حساب‌های بانکی، کارت‌ها و صندوق نقدی خود را اضافه کنید" />
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'ویرایش حساب' : 'حساب جدید'}>
        {editing && (
          <div style={{ display: 'grid', gap: '.8rem' }}>
            <div className="acc-form-grid">
              <Field label="نام حساب *"><input className="acc-input" placeholder="مثلاً: بانک ملت جاری" value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="نوع">
                <select className="acc-select" value={editing.kind || 'bank'} onChange={(e) => setEditing({ ...editing, kind: e.target.value as AccAccount['kind'] })}>
                  <option value="bank">حساب بانکی</option>
                  <option value="card">کارت بانکی</option>
                  <option value="cash">صندوق نقدی</option>
                </select>
              </Field>
            </div>
            <div className="acc-form-grid">
              <Field label="شماره حساب / شماره کارت"><input className="acc-input" value={editing.account_number || ''} onChange={(e) => setEditing({ ...editing, account_number: e.target.value })} /></Field>
              <Field label="مانده اولیه (ریال)" hint="در افتتاحیه، معادل سرمایه ثبت می‌شود">
                <MoneyInput value={editing.initial_balance || 0} onChange={(n) => setEditing({ ...editing, initial_balance: n })} />
              </Field>
            </div>
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
