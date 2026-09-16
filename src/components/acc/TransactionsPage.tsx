/* دریافت و پرداخت — تسویه فاکتورها و گردش نقدی */

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Pencil, Trash2 } from 'lucide-react';
import type { AccBusiness, AccInvoice, AccTransaction } from '@/lib/acc/types';
import { deleteTransaction, listAccounts, listInvoices, listPartners, listTransactions, saveTransaction } from '@/lib/acc/api';
import { PAYMENT_METHODS } from '@/lib/acc/constants';
import { formatMoney } from '@/lib/acc/money';
import { formatJalali } from '@/lib/acc/jalali';
import { Field, JalaliDateInput, Modal, MoneyInput, confirmAction, toast, EmptyState } from './ui';

interface AccountLite { id: string; name: string; kind: string }

export default function TransactionsPage({ business }: { business: AccBusiness }) {
  const [rows, setRows] = useState<AccTransaction[]>([]);
  const [accounts, setAccounts] = useState<AccountLite[]>([]);
  const [partners, setPartners] = useState<{ id: string; name: string }[]>([]);
  const [openInvoices, setOpenInvoices] = useState<AccInvoice[]>([]);
  const [tab, setTab] = useState<'all' | 'receipt' | 'payment'>('all');
  const [editing, setEditing] = useState<Partial<AccTransaction> | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [t, a, p] = await Promise.all([
        listTransactions(business.id), listAccounts(business.id), listPartners(business.id),
      ]);
      setRows(t);
      setAccounts(a);
      setPartners(p);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [business.id]);

  const filtered = useMemo(() => rows.filter((r) => tab === 'all' || r.kind === tab), [rows, tab]);

  async function openForm(kind: 'receipt' | 'payment') {
    // فاکتورهای تسویه‌نشده برای انتخاب سریع
    const type = kind === 'receipt' ? 'sale' : 'purchase';
    const invs = (await listInvoices(business.id, { type })).filter((i) => i.status === 'issued' || i.status === 'partial');
    setOpenInvoices(invs);
    setEditing({ kind, amount: 0, date_g: new Date().toISOString().slice(0, 10), method: 'transfer' });
  }

  function pickInvoice(invoiceId: string) {
    const inv = openInvoices.find((i) => i.id === invoiceId);
    if (!inv) { setEditing((e) => ({ ...e, invoice_id: null })); return; }
    setEditing((e) => ({
      ...e,
      invoice_id: invoiceId,
      partner_id: inv.partner_id,
      amount: Math.max(0, inv.total - inv.paid_total),
      description: e?.description || `تسویه صورتحساب ${inv.number}`,
    }));
  }

  async function save() {
    if (!editing?.kind || (editing.amount || 0) <= 0) { toast('مبلغ را وارد کنید', 'error'); return; }
    try {
      await saveTransaction(business.id, editing as AccTransaction & { kind: 'receipt' | 'payment'; amount: number });
      toast('ثبت شد و سند حسابداری ثبت گردید');
      setEditing(null);
      load();
    } catch {
      toast('ثبت ناموفق بود', 'error');
    }
  }

  async function remove(row: AccTransaction) {
    if (!(await confirmAction(`سند ${row.kind === 'receipt' ? 'دریافت' : 'پرداخت'} به مبلغ ${formatMoney(row.amount)} حذف شود؟`))) return;
    try {
      await deleteTransaction({ id: row.id, invoice_id: row.invoice_id });
      toast('حذف شد');
      load();
    } catch {
      toast('حذف ناموفق بود', 'error');
    }
  }

  const totalReceipt = filtered.filter((r) => r.kind === 'receipt').reduce((s, r) => s + r.amount, 0);
  const totalPayment = filtered.filter((r) => r.kind === 'payment').reduce((s, r) => s + r.amount, 0);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '.35rem', flex: 1, flexWrap: 'wrap' }}>
          {([['all', 'همه'], ['receipt', 'دریافت‌ها'], ['payment', 'پرداخت‌ها']] as const).map(([k, label]) => (
            <button key={k} className={`acc-btn ${tab === k ? 'acc-btn-primary' : 'acc-btn-outline'}`} style={{ minHeight: 40, padding: '.35rem .9rem', fontSize: '.8rem' }} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>
        <button className="acc-btn acc-btn-primary" onClick={() => openForm('receipt')}><ArrowDownLeft size={15} /> ثبت دریافت</button>
        <button className="acc-btn acc-btn-outline" onClick={() => openForm('payment')}><ArrowUpRight size={15} /> ثبت پرداخت</button>
      </div>

      <div className="acc-table-wrap">
        <table className="acc-table">
          <thead>
            <tr><th>تاریخ</th><th>نوع</th><th>مبلغ (ریال)</th><th>طرف‌حساب</th><th>فاکتور</th><th>حساب</th><th>روش</th><th>توضیح</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className="num">{formatJalali(r.date_g)}</td>
                <td>{r.kind === 'receipt'
                  ? <span className="acc-badge ok">دریافت</span>
                  : <span className="acc-badge bad">پرداخت</span>}</td>
                <td className="num" style={{ fontWeight: 700 }}>{formatMoney(r.amount)}</td>
                <td>{r.partner?.name || '—'}</td>
                <td className="num">{r.invoice?.number || '—'}</td>
                <td>{r.account?.name || '—'}</td>
                <td>{PAYMENT_METHODS[r.method] || r.method}</td>
                <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description || '—'}</td>
                <td>
                  <div className="row-actions">
                    <button className="acc-icon-btn" onClick={() => { setOpenInvoices([]); setEditing(r); }}><Pencil size={14} /></button>
                    <button className="acc-icon-btn danger" onClick={() => remove(r)}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={2}>جمع</td>
                <td className="num">دریافت {formatMoney(totalReceipt)} — پرداخت {formatMoney(totalPayment)}</td>
                <td colSpan={6}></td>
              </tr>
            </tfoot>
          )}
        </table>
        {!loading && filtered.length === 0 && (
          <EmptyState title="سندی ثبت نشده" hint="دریافت‌ها و پرداخت‌ها را ثبت کنید تا مانده حساب‌ها و مطالبات به‌روز شود" />
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.kind === 'payment' ? 'ثبت پرداخت' : 'ثبت دریافت'}>
        {editing && (
          <div style={{ display: 'grid', gap: '.8rem' }}>
            <div className="acc-form-grid">
              <Field label="مبلغ (ریال) *"><MoneyInput value={editing.amount || 0} onChange={(n) => setEditing({ ...editing, amount: n })} /></Field>
              <Field label="تاریخ"><JalaliDateInput value={editing.date_g || ''} onChange={(iso) => setEditing({ ...editing, date_g: iso })} /></Field>
            </div>
            <div className="acc-form-grid">
              <Field label="حساب" hint="پول از کدام حساب خارج/داخل شد">
                <select className="acc-select" value={editing.account_id || ''} onChange={(e) => setEditing({ ...editing, account_id: e.target.value || null })}>
                  <option value="">— انتخاب کنید —</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Field>
              <Field label="روش">
                <select className="acc-select" value={editing.method || 'transfer'} onChange={(e) => setEditing({ ...editing, method: e.target.value as AccTransaction['method'] })}>
                  {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
            </div>
            <div className="acc-form-grid">
              <Field label="مرتبط با صورتحساب (اختیاری)" hint="با انتخاب، مانده فاکتور به‌روزرسانی می‌شود">
                <select className="acc-select" value={editing.invoice_id || ''} onChange={(e) => pickInvoice(e.target.value)}>
                  <option value="">— بدون فاکتور —</option>
                  {openInvoices.map((i) => (
                    <option key={i.id} value={i.id}>{i.number} — {i.partner?.name || 'متفرقه'} — مانده {formatMoney(i.total - i.paid_total)}</option>
                  ))}
                </select>
              </Field>
              <Field label="طرف‌حساب">
                <select className="acc-select" value={editing.partner_id || ''} onChange={(e) => setEditing({ ...editing, partner_id: e.target.value || null })}>
                  <option value="">— بدون طرف‌حساب —</option>
                  {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="توضیح"><input className="acc-input" value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            <div style={{ display: 'flex', gap: '.6rem' }}>
              <button className="acc-btn acc-btn-primary" onClick={save}>ثبت</button>
              <button className="acc-btn acc-btn-outline" onClick={() => setEditing(null)}>انصراف</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
