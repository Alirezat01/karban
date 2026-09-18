/* پیش‌دریافت و پیش‌پرداخت — جدا از بدهی/طلب عادی، با تخصیص به فاکتور/هزینه */

import React, { useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Link2, Plus, X } from 'lucide-react';
import type { AccBusiness, AccInvoice, AccExpense, AccPartner } from '@/lib/acc/types';
import { listPrepay, savePrepay, allocatePrepay, voidPrepay, deletePrepayFull, AccPrepayment } from '@/lib/acc/api7';
import { listAccounts, listExpenses, listInvoices, listPartners } from '@/lib/acc/api';
import { formatMoney } from '@/lib/acc/money';
import { formatJalali, dateToISO } from '@/lib/acc/jalali';
import { Field, JalaliDateInput, Modal, MoneyInput, toast, EmptyState, Badge } from './ui';
import { VoidDeleteBtns } from './VoidDeleteBtns';

interface AccountLite { id: string; name: string; kind: string }

export default function PrePayPage({ business }: { business: AccBusiness }) {
  const [rows, setRows] = useState<AccPrepayment[]>([]);
  const [accounts, setAccounts] = useState<AccountLite[]>([]);
  const [partners, setPartners] = useState<AccPartner[]>([]);
  const [openInvoices, setOpenInvoices] = useState<AccInvoice[]>([]);
  const [openExpenses, setOpenExpenses] = useState<AccExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<{ kind: 'advance_received' | 'advance_paid'; partner_id: string; account_id: string; amount: number; date_g: string; description: string }>({ kind: 'advance_received', partner_id: '', account_id: '', amount: 0, date_g: dateToISO(new Date()), description: '' });
  const [alloc, setAlloc] = useState<AccPrepayment | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [p, a, pt] = await Promise.all([listPrepay(business.id), listAccounts(business.id), listPartners(business.id)]);
      setRows(p);
      setAccounts(a);
      setPartners(pt);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [business.id]);

  async function openAlloc(p: AccPrepayment) {
    if (p.kind === 'advance_received') {
      const invs = await listInvoices(business.id, { type: 'sale' });
      setOpenInvoices(invs.filter((i) => i.status === 'issued' || i.status === 'partial'));
    } else {
      const ex = await listExpenses(business.id);
      setOpenExpenses(ex.filter((e) => !e.is_paid && !e.voided_at));
    }
    setAlloc(p);
  }

  async function submitForm() {
    if (!form.amount) { toast('مبلغ را وارد کنید', 'error'); return; }
    try {
      await savePrepay(business.id, {
        kind: form.kind, partner_id: form.partner_id || null,
        account_id: form.account_id || null, amount: form.amount,
        date_g: form.date_g, description: form.description || undefined,
      });
      toast('ثبت شد و سند پیش‌دریافت/پیش‌پرداخت صادر شد');
      setFormOpen(false);
      setForm({ kind: form.kind, partner_id: '', account_id: '', amount: 0, date_g: dateToISO(new Date()), description: '' });
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'خطا', 'error');
    }
  }

  async function doAlloc(invoiceId?: string, expenseId?: string) {
    if (!alloc) return;
    try {
      await allocatePrepay(business.id, alloc.id, invoiceId ? { invoice_id: invoiceId } : { expense_id: expenseId });
      toast('تخصیص انجام و سند تسویه صادر شد');
      setAlloc(null);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'خطا', 'error');
    }
  }

  const remaining = (p: AccPrepayment) => p.amount - p.allocated_amount;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.6rem', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>پیش‌دریافت و پیش‌پرداخت</h2>
          <p style={{ margin: '.2rem 0 0', fontSize: '.78rem', opacity: .65 }}>دریافت/پرداخت قبل از فاکتور یا هزینه — با سرفصل مجزا از بدهی و طلب عادی</p>
        </div>
        <button className="acc-btn acc-btn-primary" onClick={() => setFormOpen(true)}><Plus size={15} /> ثبت جدید</button>
      </div>

      {loading ? <p style={{ opacity: .6 }}>در حال بارگذاری…</p> : rows.length === 0 ? (
        <EmptyState title="ردیفی ثبت نشده" hint="پیش‌دریافت یعنی پولی که مشتری قبل از فاکتور داده؛ پیش‌پرداخت یعنی پولی که قبل از دریافت کالا/خدمت به تامین‌کننده داده‌اید" />
      ) : (
        <div className="acc-card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.8rem' }}>
            <thead>
              <tr style={{ textAlign: 'right', borderBottom: '1px solid rgba(148,163,184,.25)' }}>
                <th style={{ padding: '.55rem .7rem' }}>نوع</th>
                <th style={{ padding: '.55rem .7rem' }}>طرف‌حساب</th>
                <th style={{ padding: '.55rem .7rem' }}>تاریخ</th>
                <th style={{ padding: '.55rem .7rem' }}>مبلغ</th>
                <th style={{ padding: '.55rem .7rem' }}>تخصیص‌یافته</th>
                <th style={{ padding: '.55rem .7rem' }}>مانده</th>
                <th style={{ padding: '.55rem .7rem' }}>وضعیت</th>
                <th style={{ padding: '.55rem .7rem' }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid rgba(148,163,184,.12)' }}>
                  <td style={{ padding: '.5rem .7rem' }}>
                    {p.kind === 'advance_received'
                      ? <span className="acc-chip" style={{ fontSize: '.66rem' }}>پیش‌دریافت</span>
                      : <span className="acc-chip" style={{ fontSize: '.66rem' }}>پیش‌پرداخت</span>}
                  </td>
                  <td style={{ padding: '.5rem .7rem' }}>{p.partner?.name || '—'}</td>
                  <td style={{ padding: '.5rem .7rem' }}>{formatJalali(p.date_g)}</td>
                  <td style={{ padding: '.5rem .7rem', fontWeight: 700 }}>{formatMoney(p.amount)}</td>
                  <td style={{ padding: '.5rem .7rem' }}>{formatMoney(p.allocated_amount)}</td>
                  <td style={{ padding: '.5rem .7rem', fontWeight: 700, color: remaining(p) > 0 ? '#15803d' : undefined }}>{formatMoney(remaining(p))}</td>
                  <td style={{ padding: '.5rem .7rem' }}>
                    <Badge tone={p.voided_at ? 'bad' : p.status === 'open' ? 'ok' : 'draft'}>
                      {p.voided_at ? 'ابطال شده' : p.status === 'open' ? 'باز' : 'تخصیص یافته'}
                    </Badge>
                  </td>
                  <td style={{ padding: '.5rem .7rem' }}>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {p.status === 'open' && !p.voided_at && (
                        <button className="acc-btn acc-btn-outline" style={{ fontSize: '.7rem', padding: '.2rem .5rem' }} onClick={() => openAlloc(p)}>
                          <Link2 size={12} /> تخصیص
                        </button>
                      )}
                      {!p.voided_at && (
                        <VoidDeleteBtns
                          voidLabel="ابطال پیش‌دریافت"
                          deleteLabel="حذف کامل"
                          onVoid={async (reason) => { await voidPrepay(business.id, p.id, reason); }}
                          onDelete={async () => { await deletePrepayFull(p.id); await load(); }}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* مودال ثبت */}
      {formOpen && (
        <Modal open onClose={() => setFormOpen(false)} title="ثبت پیش‌دریافت / پیش‌پرداخت">
          <div style={{ display: 'grid', gap: '.7rem' }}>
            <Field label="نوع">
              <select className="acc-select" value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as typeof f.kind }))}>
                <option value="advance_received">پیش‌دریافت از مشتری (پول گرفتم)</option>
                <option value="advance_paid">پیش‌پرداخت به تامین‌کننده (پول دادم)</option>
              </select>
            </Field>
            <Field label="طرف‌حساب">
              <select className="acc-select" value={form.partner_id} onChange={(e) => setForm((f) => ({ ...f, partner_id: e.target.value }))}>
                <option value="">— انتخاب —</option>
                {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="حساب بانکی/صندوق">
              <select className="acc-select" value={form.account_id} onChange={(e) => setForm((f) => ({ ...f, account_id: e.target.value }))}>
                <option value="">— انتخاب —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
            <Field label="مبلغ (ریال)"><MoneyInput value={form.amount} onChange={(n) => setForm((f) => ({ ...f, amount: n }))} /></Field>
            <Field label="تاریخ"><JalaliDateInput value={form.date_g} onChange={(iso) => setForm((f) => ({ ...f, date_g: iso }))} /></Field>
            <Field label="شرح (اختیاری)"><input className="acc-input" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <button className="acc-btn acc-btn-primary" onClick={submitForm}>ثبت و صدور سند</button>
              <button className="acc-btn acc-btn-outline" onClick={() => setFormOpen(false)}>انصراف</button>
            </div>
          </div>
        </Modal>
      )}

      {/* مودال تخصیص */}
      {alloc && (
        <Modal open onClose={() => setAlloc(null)} title={`تخصیص ${alloc.kind === 'advance_received' ? 'پیش‌دریافت' : 'پیش‌پرداخت'} — مانده ${formatMoney(remaining(alloc))} ریال`} wide>
          {alloc.kind === 'advance_received' ? (
            openInvoices.length === 0
              ? <p style={{ opacity: .6, textAlign: 'center', padding: '1rem' }}>فاکتور فروش بازی نکردنی (باز) وجود ندارد</p>
              : (
                <div style={{ display: 'grid', gap: '.45rem' }}>
                  {openInvoices.map((i) => (
                    <div key={i.id} className="acc-card" style={{ padding: '.55rem .8rem', display: 'flex', alignItems: 'center', gap: '.6rem', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '.82rem' }}>{i.number}</strong>
                      <span style={{ fontSize: '.75rem', opacity: .7 }}>{formatJalali(i.date_g)}</span>
                      <span style={{ flex: 1 }} />
                      <span style={{ fontSize: '.76rem' }}>مانده: <strong>{formatMoney(i.total - i.paid_total)}</strong></span>
                      <button className="acc-btn acc-btn-primary" style={{ fontSize: '.72rem' }} onClick={() => doAlloc(i.id)}>تسویه از پیش‌دریافت</button>
                    </div>
                  ))}
                </div>
              )
          ) : (
            openExpenses.length === 0
              ? <p style={{ opacity: .6, textAlign: 'center', padding: '1rem' }}>هزینه پرداخت‌نشده‌ای وجود ندارد</p>
              : (
                <div style={{ display: 'grid', gap: '.45rem' }}>
                  {openExpenses.map((e) => (
                    <div key={e.id} className="acc-card" style={{ padding: '.55rem .8rem', display: 'flex', alignItems: 'center', gap: '.6rem', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '.82rem' }}>{e.title}</strong>
                      <span style={{ fontSize: '.75rem', opacity: .7 }}>{formatJalali(e.date_g)}</span>
                      <span style={{ flex: 1 }} />
                      <span style={{ fontSize: '.76rem' }}>{formatMoney(e.amount)}</span>
                      <button className="acc-btn acc-btn-primary" style={{ fontSize: '.72rem' }} onClick={() => doAlloc(undefined, e.id)}>تسویه از پیش‌پرداخت</button>
                    </div>
                  ))}
                </div>
              )
          )}
        </Modal>
      )}
    </div>
  );
}
