/* تنخواه‌گردان — تعریف، شارژ، هزینه‌کرد، تسویه با سند دوبل خودکار */

import React, { useEffect, useState } from 'react';
import { Coins, HandCoins, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import type { AccBusiness } from '@/lib/acc/types';
import { listPetty, savePetty, pettyCharge, pettySpend, pettySettle, deletePetty, voidJournal, AccPetty } from '@/lib/acc/api7';
import { listAccounts, trialBalance } from '@/lib/acc/api';
import { formatMoney } from '@/lib/acc/money';
import { formatJalali, dateToISO } from '@/lib/acc/jalali';
import { Field, JalaliDateInput, Modal, MoneyInput, confirmAction, toast, EmptyState, Badge } from './ui';
import { VoidDeleteBtns } from './VoidDeleteBtns';

const PETTY_STATUS: Record<string, { label: string; tone: 'ok' | 'warn' | 'bad' }> = {
  open: { label: 'فعال', tone: 'ok' },
  settled: { label: 'تسویه شده', tone: 'warn' },
  closed: { label: 'بسته', tone: 'bad' },
};

interface AccountLite { id: string; name: string; kind: string }

export default function PettyCashPage({ business }: { business: AccBusiness }) {
  const [rows, setRows] = useState<AccPetty[]>([]);
  const [accounts, setAccounts] = useState<AccountLite[]>([]);
  const [chart, setChart] = useState<{ code: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AccPetty | null>(null);
  const [form, setForm] = useState({ name: '', custodian: '', source_account_id: '', description: '' });
  const [opOpen, setOpOpen] = useState<{ petty: AccPetty; kind: 'charge' | 'spend' | 'settle' } | null>(null);
  const [opForm, setOpForm] = useState<{ amount: number; date_g: string; chart_code: string; description: string }>({ amount: 0, date_g: dateToISO(new Date()), chart_code: '5201', description: '' });

  async function load() {
    setLoading(true);
    try {
      const [p, a, tb] = await Promise.all([listPetty(business.id), listAccounts(business.id), trialBalance(business.id)]);
      setRows(p);
      setAccounts(a);
      setChart(tb.filter((r) => r.kind === 'expense').map((r) => ({ code: r.code, title: r.title })));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [business.id]);

  function openForm(p?: AccPetty) {
    setEditing(p || null);
    setForm(p ? { name: p.name, custodian: p.custodian || '', source_account_id: p.source_account_id || '', description: p.description || '' } : { name: '', custodian: '', source_account_id: '', description: '' });
    setFormOpen(true);
  }

  async function submitForm() {
    if (!form.name.trim()) { toast('نام تنخواه الزامی است', 'error'); return; }
    try {
      await savePetty(business.id, {
        id: editing?.id, name: form.name, custodian: form.custodian || null,
        source_account_id: form.source_account_id || null, description: form.description || null,
      });
      toast('تنخواه ذخیره شد');
      setFormOpen(false);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'خطا', 'error');
    }
  }

  function openOp(petty: AccPetty, kind: 'charge' | 'spend' | 'settle') {
    setOpOpen({ petty, kind });
    setOpForm({ amount: 0, date_g: dateToISO(new Date()), chart_code: chart[0]?.code || '5201', description: '' });
  }

  async function submitOp() {
    if (!opOpen) return;
    if (!((opForm.amount || 0) > 0)) { toast('مبلغ را وارد کنید', 'error'); return; }
    try {
      if (opOpen.kind === 'charge') {
        await pettyCharge(business.id, opOpen.petty.id, { amount: opForm.amount, date_g: opForm.date_g, description: opForm.description });
        toast('شارژ تنخواه ثبت و سند صادر شد');
      } else if (opOpen.kind === 'spend') {
        const t = chart.find((c) => c.code === opForm.chart_code);
        await pettySpend(business.id, opOpen.petty.id, {
          amount: opForm.amount, date_g: opForm.date_g,
          chart_code: opForm.chart_code, chart_title: t?.title || opForm.chart_code,
          description: opForm.description || 'هزینه‌کرد تنخواه',
        });
        toast('هزینه‌کرد ثبت و سند صادر شد');
      } else {
        await pettySettle(business.id, opOpen.petty.id, { returned_amount: opForm.amount, date_g: opForm.date_g, description: opForm.description });
        toast('تسویه تنخواه ثبت شد');
      }
      setOpOpen(null);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'خطا', 'error');
    }
  }

  async function remove(p: AccPetty) {
    if (!(await confirmAction(`تنخواه «${p.name}» حذف شود؟`))) return;
    try {
      await deletePetty(p.id);
      toast('حذف شد');
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'خطا', 'error');
    }
  }

  const remaining = (p: AccPetty) => p.charge_total - p.spent_total - p.settled_total;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.6rem', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>تنخواه‌گردان</h2>
          <p style={{ margin: '.2rem 0 0', fontSize: '.78rem', opacity: .65 }}>تعریف تنخواه، شارژ، هزینه‌کرد و تسویه — هر عمل با سند حسابداری خودکار</p>
        </div>
        <button className="acc-btn acc-btn-primary" onClick={() => openForm()}><Plus size={15} /> تنخواه جدید</button>
      </div>

      {loading ? <p style={{ opacity: .6 }}>در حال بارگذاری…</p> : rows.length === 0 ? (
        <EmptyState title="هنوز تنخواهی تعریف نشده" hint="تنخواه یعنی پول نقدی که در اختیار یک نفر برای خرج‌های جاری گذاشته می‌شود" />
      ) : (
        <div style={{ display: 'grid', gap: '.7rem' }}>
          {rows.map((p) => (
            <div key={p.id} className="acc-card" style={{ padding: '.8rem 1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', flexWrap: 'wrap', marginBottom: '.5rem' }}>
                <Wallet size={16} style={{ opacity: .6 }} />
                <strong style={{ flex: 1 }}>{p.name}</strong>
                {p.custodian && <span style={{ fontSize: '.74rem', opacity: .7 }}>تنخواه‌دار: {p.custodian}</span>}
                <Badge tone={PETTY_STATUS[p.status]?.tone || 'warn'}>{PETTY_STATUS[p.status]?.label || p.status}</Badge>
                <button className="acc-icon-btn" onClick={() => openForm(p)}><Pencil size={13} /></button>
                {!p.acc_petty_ops?.length && <button className="acc-icon-btn" onClick={() => remove(p)}><Trash2 size={13} style={{ color: '#dc2626' }} /></button>}
              </div>
              <div className="acc-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', marginBottom: '.6rem' }}>
                <div className="acc-kpi"><span>جمع شارژ</span><strong>{formatMoney(p.charge_total)}</strong></div>
                <div className="acc-kpi"><span>هزینه‌کرد</span><strong>{formatMoney(p.spent_total)}</strong></div>
                <div className="acc-kpi"><span>برگشتی</span><strong>{formatMoney(p.settled_total)}</strong></div>
                <div className="acc-kpi"><span>مانده در صندوق</span><strong>{formatMoney(remaining(p))}</strong></div>
              </div>
              <div style={{ display: 'flex', gap: '.45rem', flexWrap: 'wrap' }}>
                <button className="acc-btn acc-btn-outline" style={{ fontSize: '.75rem' }} disabled={p.status !== 'open'} onClick={() => openOp(p, 'charge')}><Coins size={14} /> شارژ</button>
                <button className="acc-btn acc-btn-outline" style={{ fontSize: '.75rem' }} disabled={p.status !== 'open'} onClick={() => openOp(p, 'spend')}><HandCoins size={14} /> هزینه‌کرد</button>
                <button className="acc-btn acc-btn-outline" style={{ fontSize: '.75rem' }} disabled={p.status !== 'open'} onClick={() => openOp(p, 'settle')}>تسویه و بستن</button>
              </div>
              {p.acc_petty_ops && p.acc_petty_ops.length > 0 && (
                <details style={{ marginTop: '.6rem' }}>
                  <summary style={{ cursor: 'pointer', fontSize: '.76rem', opacity: .7 }}>گردش تنخواه ({p.acc_petty_ops.length} عمل)</summary>
                  <div style={{ marginTop: '.4rem', display: 'grid', gap: 3 }}>
                    {p.acc_petty_ops.map((o) => (
                      <div key={o.id} style={{ display: 'flex', gap: '.5rem', fontSize: '.74rem', padding: '.3rem .5rem', background: 'rgba(148,163,184,.08)', borderRadius: 6, flexWrap: 'wrap' }}>
                        <span className="acc-chip" style={{ fontSize: '.62rem' }}>{o.kind === 'charge' ? 'شارژ' : o.kind === 'spend' ? 'هزینه' : 'تسویه'}</span>
                        <span>{formatJalali(o.date_g)}</span>
                        <span style={{ flex: 1, opacity: .8 }}>{o.description}</span>
                        {o.chart_title && <span style={{ opacity: .6 }}>{o.chart_title}</span>}
                        <strong>{o.amount >= 0 ? '' : '-'}{formatMoney(Math.abs(o.amount))}</strong>
                        {o.journal_id && (
                          <VoidDeleteBtns
                            voidLabel="ابطال عمل" deleteLabel="حذف عمل"
                            onVoid={async () => { await voidJournal(business.id, o.journal_id as string, 'ابطال عمل تنخواه'); toast('سند معکوس ثبت شد'); }}
                            onDelete={async () => { toast('حذف عمل از طریق ابطال سند انجام می‌شود', 'error'); throw new Error('از ابطال استفاده کنید'); }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      {/* مودال تعریف تنخواه */}
      {formOpen && (
        <Modal open onClose={() => setFormOpen(false)} title={editing ? `ویرایش «${editing.name}»` : 'تنخواه جدید'}>
          <div style={{ display: 'grid', gap: '.7rem' }}>
            <Field label="نام تنخواه" required><input className="acc-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="مثلاً: تنخواه دفتر مرکزی" /></Field>
            <Field label="تنخواه‌دار"><input className="acc-input" value={form.custodian} onChange={(e) => setForm((f) => ({ ...f, custodian: e.target.value }))} /></Field>
            <Field label="حساب منبع شارژ">
              <select className="acc-select" value={form.source_account_id} onChange={(e) => setForm((f) => ({ ...f, source_account_id: e.target.value }))}>
                <option value="">— انتخاب بانک/صندوق —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
            <Field label="توضیح"><input className="acc-input" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <button className="acc-btn acc-btn-primary" onClick={submitForm}>ذخیره</button>
              <button className="acc-btn acc-btn-outline" onClick={() => setFormOpen(false)}>انصراف</button>
            </div>
          </div>
        </Modal>
      )}

      {/* مودال عملیات شارژ/هزینه/تسویه */}
      {opOpen && (
        <Modal open onClose={() => setOpOpen(null)} title={opOpen.kind === 'charge' ? `شارژ «${opOpen.petty.name}»` : opOpen.kind === 'spend' ? `هزینه‌کرد از «${opOpen.petty.name}»` : `تسویه «${opOpen.petty.name}»`}>
          <div style={{ display: 'grid', gap: '.7rem' }}>
            <Field label="مبلغ (ریال)" required>
              <MoneyInput value={opForm.amount} onChange={(n) => setOpForm((f) => ({ ...f, amount: n }))} />
            </Field>
            <Field label="تاریخ">
              <JalaliDateInput value={opForm.date_g} onChange={(iso) => setOpForm((f) => ({ ...f, date_g: iso }))} />
            </Field>
            {opOpen.kind === 'spend' && (
              <Field label="سرفصل هزینه">
                <select className="acc-select" value={opForm.chart_code} onChange={(e) => setOpForm((f) => ({ ...f, chart_code: e.target.value }))}>
                  {chart.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.title}</option>)}
                </select>
              </Field>
            )}
            <Field label="شرح">
              <input className="acc-input" value={opForm.description} onChange={(e) => setOpForm((f) => ({ ...f, description: e.target.value }))} />
            </Field>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <button className="acc-btn acc-btn-primary" onClick={submitOp}>ثبت و صدور سند</button>
              <button className="acc-btn acc-btn-outline" onClick={() => setOpOpen(null)}>انصراف</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
