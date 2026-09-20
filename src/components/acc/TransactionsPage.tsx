/* دریافت و پرداخت و انتقال — تسویه فاکتورها، گردش نقدی و حواله بین حساب‌ها */

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Pencil, Trash2 } from 'lucide-react';
import type { AccBusiness, AccInvoice, AccTransaction } from '@/lib/acc/types';
import { deleteTransaction, listAccounts, listInvoices, listPartners, listTransactions, saveTransaction } from '@/lib/acc/api';
import { voidTransaction, deleteTransactionFull } from '@/lib/acc/api7';
import { VoidDeleteBtns } from './VoidDeleteBtns';
import AttachButton from './AttachButton';
import { PAYMENT_METHODS } from '@/lib/acc/constants';
import { formatMoney } from '@/lib/acc/money';
import { formatJalali, dateToISO } from '@/lib/acc/jalali';
import { Field, JalaliDateInput, Modal, MoneyInput, confirmAction, toast, EmptyState } from './ui';

interface AccountLite { id: string; name: string; kind: string; balance?: number }

export default function TransactionsPage({ business }: { business: AccBusiness }) {
  const [rows, setRows] = useState<AccTransaction[]>([]);
  const [accounts, setAccounts] = useState<AccountLite[]>([]);
  const [partners, setPartners] = useState<{ id: string; name: string }[]>([]);
  const [openInvoices, setOpenInvoices] = useState<AccInvoice[]>([]);
  const [tab, setTab] = useState<'all' | 'receipt' | 'payment' | 'transfer'>('all');
  const [editing, setEditing] = useState<Partial<AccTransaction> | null>(null);
  const [transfer, setTransfer] = useState<{ from_account: string; to_account: string; amount: number; date_g: string; description: string } | null>(null);
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
    } catch (e) {
      toast(e instanceof Error ? e.message : 'ثبت ناموفق بود', 'error');
    }
  }

  /* انتقال بانک/صندوق — یک سند واحد kind=transfer (بند ۲۸):
     بانک مقصد بدهکار، بانک مبدا بستانکار — هیچ درآمد یا هزینه‌ای ساخته نمی‌شود */
  async function saveTransfer() {
    if (!transfer) return;
    if (!transfer.from_account || !transfer.to_account) { toast('هر دو حساب را انتخاب کنید', 'error'); return; }
    if (transfer.from_account === transfer.to_account) { toast('حساب مبدا و مقصد نباید یکی باشد', 'error'); return; }
    if ((transfer.amount || 0) <= 0) { toast('مبلغ را وارد کنید', 'error'); return; }
    const fromName = accounts.find((a) => a.id === transfer.from_account)?.name || '';
    const toName = accounts.find((a) => a.id === transfer.to_account)?.name || '';
    const desc = transfer.description?.trim() || `انتقال وجه از ${fromName} به ${toName}`;
    try {
      await saveTransaction(business.id, {
        kind: 'transfer', amount: transfer.amount, date_g: transfer.date_g,
        method: 'transfer', account_id: transfer.from_account, to_account_id: transfer.to_account,
        description: desc,
      } as AccTransaction & { kind: 'transfer'; amount: number });
      toast('انتقال ثبت شد — سند: حساب مقصد بدهکار / مبدا بستانکار');
      setTransfer(null);
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'ثبت انتقال ناموفق بود', 'error');
    }
  }

  async function remove(row: AccTransaction) {
    if (!(await confirmAction(`سند ${row.kind === 'receipt' ? 'دریافت' : row.kind === 'payment' ? 'پرداخت' : 'انتقال'} به مبلغ ${formatMoney(row.amount)} حذف شود؟`))) return;
    try {
      await deleteTransaction({ id: row.id, invoice_id: row.invoice_id });
      toast('حذف شد');
      load();
    } catch {
      toast('حذف ناموفق بود', 'error');
    }
  }

  async function voidTx(row: AccTransaction, reason: string) {
    await voidTransaction(business.id, row.id, reason);
    load();
  }
  async function deleteTxFull(row: AccTransaction) {
    await deleteTransactionFull(business.id, row.id);
    load();
  }

  const totalReceipt = filtered.filter((r) => r.kind === 'receipt').reduce((s, r) => s + r.amount, 0);
  const totalPayment = filtered.filter((r) => r.kind === 'payment').reduce((s, r) => s + r.amount, 0);
  const totalTransfer = filtered.filter((r) => r.kind === 'transfer').reduce((s, r) => s + r.amount, 0);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '.35rem', flex: 1, flexWrap: 'wrap' }}>
          {([['all', 'همه'], ['receipt', 'دریافت‌ها'], ['payment', 'پرداخت‌ها'], ['transfer', 'انتقال‌ها']] as const).map(([k, label]) => (
            <button key={k} className={`acc-btn ${tab === k ? 'acc-btn-primary' : 'acc-btn-outline'}`} style={{ minHeight: 40, padding: '.35rem .9rem', fontSize: '.8rem' }} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>
        <button className="acc-btn acc-btn-outline" onClick={() => setTransfer({ from_account: '', to_account: '', amount: 0, date_g: dateToISO(new Date()), description: '' })}><ArrowLeftRight size={15} /> حواله بین حساب‌ها</button>
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
                  : r.kind === 'transfer'
                    ? <span className="acc-badge" style={{ background: 'rgba(59,130,246,.12)', color: '#2563eb' }}>انتقال</span>
                    : <span className="acc-badge bad">پرداخت</span>}</td>
                <td className="num" style={{ fontWeight: 700 }}>{formatMoney(r.amount)}</td>
                <td>{r.partner?.name || '—'}</td>
                <td className="num">{r.invoice?.number || '—'}</td>
                <td>{r.kind === 'transfer' ? `${r.account?.name || '—'} → ${r.to_account?.name || '—'}` : (r.account?.name || '—')}</td>
                <td>{PAYMENT_METHODS[r.method] || r.method}</td>
                <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description || '—'}</td>
                <td>
                  <div className="row-actions">
                    <button className="acc-icon-btn" onClick={() => { setOpenInvoices([]); setEditing(r); }}><Pencil size={14} /></button>
                    <button className="acc-icon-btn danger" onClick={() => remove(r)}><Trash2 size={14} /></button>
                    <VoidDeleteBtns
                      voidLabel="ابطال دریافت/پرداخت"
                      deleteLabel="حذف کامل"
                      onVoid={(reason) => voidTx(r, reason)}
                      onDelete={() => deleteTxFull(r)}
                    />
                    <AttachButton business={business} entityType="transaction" entityId={r.id} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={2}>جمع</td>
                <td className="num">دریافت {formatMoney(totalReceipt)} — پرداخت {formatMoney(totalPayment)} — انتقال {formatMoney(totalTransfer)}</td>
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
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} — مانده {formatMoney(a.balance || 0)}</option>)}
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

      {/* مودال حواله بین حساب‌ها */}
      <Modal open={!!transfer} onClose={() => setTransfer(null)} title="حواله بین حساب‌ها (انتقال وجه داخلی)">
        {transfer && (
          <div style={{ display: 'grid', gap: '.8rem' }}>
            <p className="acc-hint" style={{ fontSize: '.78rem', lineHeight: 1.9 }}>
              انتقال وجه بین بانک/صندوق‌های خودتان — یک سند واحد ثبت می‌شود: حساب مقصد بدهکار، حساب مبدا بستانکار.
              هیچ درآمد یا هزینه‌ای در این انتقال ساخته نمی‌شود.
            </p>
            <div className="acc-form-grid">
              <Field label="از حساب *">
                <select className="acc-select" value={transfer.from_account} onChange={(e) => setTransfer({ ...transfer, from_account: e.target.value })}>
                  <option value="">— انتخاب کنید —</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} — مانده {formatMoney(a.balance || 0)}</option>)}
                </select>
              </Field>
              <Field label="به حساب *">
                <select className="acc-select" value={transfer.to_account} onChange={(e) => setTransfer({ ...transfer, to_account: e.target.value })}>
                  <option value="">— انتخاب کنید —</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Field>
            </div>
            <div className="acc-form-grid">
              <Field label="مبلغ (ریال) *"><MoneyInput value={transfer.amount} onChange={(n) => setTransfer({ ...transfer, amount: n })} /></Field>
              <Field label="تاریخ"><JalaliDateInput value={transfer.date_g} onChange={(iso) => setTransfer({ ...transfer, date_g: iso })} /></Field>
            </div>
            <Field label="توضیح (اختیاری)"><input className="acc-input" value={transfer.description} onChange={(e) => setTransfer({ ...transfer, description: e.target.value })} placeholder="خالی = توضیح خودکار" /></Field>
            <div style={{ display: 'flex', gap: '.6rem' }}>
              <button className="acc-btn acc-btn-primary" onClick={saveTransfer}>ثبت حواله</button>
              <button className="acc-btn acc-btn-outline" onClick={() => setTransfer(null)}>انصراف</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
