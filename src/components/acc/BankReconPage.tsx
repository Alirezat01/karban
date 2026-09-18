/* مغایرت بانکی واقعی — ورود صورت‌حساب بانک، تطبیق خودکار/دستی، گزارش اختلاف دو طرف */

import React, { useEffect, useState } from 'react';
import { CheckCheck, ClipboardPaste, Link2, Plus, RefreshCcw, Trash2, Unlink, Upload } from 'lucide-react';
import type { AccBusiness } from '@/lib/acc/types';
import { listBankLines, importBankLines, autoMatchBankLines, manualMatchBankLine, unmatchBankLine, deleteBankLine, bankReconSummary, AccBankLine, ReconSummary } from '@/lib/acc/api7';
import { listAccounts, listTransactions } from '@/lib/acc/api';
import { formatMoney } from '@/lib/acc/money';
import { formatJalali } from '@/lib/acc/jalali';
import { Field, Modal, MoneyInput, JalaliDateInput, toast, EmptyState, Badge } from './ui';
import { dateToISO } from '@/lib/acc/jalali';

interface AccountLite { id: string; name: string; kind: string; initial_balance: number }

export default function BankReconPage({ business }: { business: AccBusiness }) {
  const [accounts, setAccounts] = useState<AccountLite[]>([]);
  const [accountId, setAccountId] = useState('');
  const [lines, setLines] = useState<AccBankLine[]>([]);
  const [summary, setSummary] = useState<ReconSummary | null>(null);
  const [txs, setTxs] = useState<{ id: string; kind: string; amount: number; date_g: string; description: string | null }[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [manualOpen, setManualOpen] = useState<{ line: AccBankLine } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<{ date_g: string; description: string; ref_no: string; amount: number }>({ date_g: dateToISO(new Date()), description: '', ref_no: '', amount: 0 });
  const [statementOpening, setStatementOpening] = useState(0);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!accountId) return;
    setBusy(true);
    try {
      const [ls, sm, tx] = await Promise.all([
        listBankLines(business.id, accountId),
        bankReconSummary(business.id, accountId, statementOpening),
        listTransactions(business.id),
      ]);
      setLines(ls);
      setSummary(sm);
      setTxs(tx.filter((t) => !t.voided_at).map((t) => ({ id: t.id, kind: t.kind, amount: t.amount, date_g: t.date_g, description: t.description })));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => { listAccounts(business.id).then((a) => { setAccounts(a); if (a.length && !accountId) setAccountId(a[0].id); }); /* eslint-disable-next-line */ }, [business.id]);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [business.id, accountId, statementOpening]);

  async function doImport() {
    try {
      const r = await importBankLines(business.id, accountId, importText);
      toast(`${r.inserted} خط وارد شد، ${r.skipped} خط نامعتبر رد شد`);
      setImportOpen(false);
      setImportText('');
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'خطا', 'error');
    }
  }

  async function doAuto() {
    try {
      const r = await autoMatchBankLines(business.id, accountId);
      toast(`${r.matched} خط خودکار تطبیق یافت — ${r.remaining} خط باز ماند`);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'خطا', 'error');
    }
  }

  async function addLine() {
    try {
      await importBankLines(business.id, accountId, `${addForm.date_g}\t${addForm.description || 'برداشت/واریز'}\t${addForm.amount}`);
      toast('خط اضافه شد');
      setAddOpen(false);
      setAddForm({ date_g: dateToISO(new Date()), description: '', ref_no: '', amount: 0 });
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'خطا', 'error');
    }
  }

  const st = (l: AccBankLine) => l.match_status === 'unmatched'
    ? <Badge tone="bad">تطبیق‌نشده</Badge>
    : l.match_status === 'auto' ? <Badge tone="ok">خودکار</Badge>
      : <Badge tone="warn">دستی</Badge>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.6rem', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>مغایرت‌گیری بانکی واقعی</h2>
          <p style={{ margin: '.2rem 0 0', fontSize: '.78rem', opacity: .65 }}>صورت‌حساب بانک را وارد کنید؛ تراکنش‌های دفتر با بانک تطبیق داده می‌شوند — نه فقط ثبت عدد</p>
        </div>
        <div style={{ display: 'flex', gap: '.45rem', flexWrap: 'wrap' }}>
          <select className="acc-select" style={{ minWidth: 180 }} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button className="acc-btn acc-btn-outline" disabled={!accountId} onClick={() => setImportOpen(true)}><ClipboardPaste size={15} /> ورود صورت‌حساب</button>
          <button className="acc-btn acc-btn-outline" disabled={!accountId} onClick={() => setAddOpen(true)}><Plus size={15} /> خط تکی</button>
          <button className="acc-btn acc-btn-primary" disabled={!accountId || busy} onClick={doAuto}><CheckCheck size={15} /> تطبیق خودکار</button>
        </div>
      </div>

      {!accountId ? <EmptyState title="اول یک حساب بانکی از «بانک و صندوق» بسازید" /> : (
        <>
          {/* خلاصه وضعیت */}
          {summary && (
            <div className="acc-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: '1rem' }}>
              <div className="acc-kpi"><span>مانده دفتر</span><strong>{formatMoney(summary.bookBalance)}</strong></div>
              <div className="acc-kpi"><span>مانده بانک (صورت‌حساب)</span><strong>{formatMoney(summary.bankBalance)}</strong></div>
              <div className="acc-kpi"><span>اختلاف</span><strong style={{ color: summary.difference === 0 ? '#15803d' : '#dc2626' }}>{formatMoney(summary.difference)}</strong></div>
              <div className="acc-kpi"><span>باز بانک</span><strong>{summary.bankUnmatched.length} خط</strong></div>
              <div className="acc-kpi"><span>باز دفتر</span><strong>{summary.bookUnmatched.length} مورد</strong></div>
            </div>
          )}

          <div style={{ marginBottom: '.8rem', display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Field label="مانده افتتاحیه صورت‌حساب بانک (ریال)">
              <MoneyInput value={statementOpening} onChange={setStatementOpening} />
            </Field>
            <button className="acc-btn acc-btn-outline" style={{ marginTop: '1.1rem' }} disabled={busy} onClick={load}><RefreshCcw size={14} /> به‌روزرسانی</button>
          </div>

          {/* خطوط بانک */}
          <div className="acc-card" style={{ padding: 0, overflowX: 'auto', marginBottom: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.78rem' }}>
              <thead>
                <tr style={{ textAlign: 'right', borderBottom: '1px solid rgba(148,163,184,.25)' }}>
                  <th style={{ padding: '.5rem .6rem' }}>تاریخ</th>
                  <th style={{ padding: '.5rem .6rem' }}>شرح</th>
                  <th style={{ padding: '.5rem .6rem' }}>واریز</th>
                  <th style={{ padding: '.5rem .6rem' }}>برداشت</th>
                  <th style={{ padding: '.5rem .6rem' }}>وضعیت</th>
                  <th style={{ padding: '.5rem .6rem' }}></th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: '1rem', textAlign: 'center', opacity: .6 }}>خطی از صورت‌حساب بانک وارد نشده — دکمه «ورود صورت‌حساب» را بزنید</td></tr>
                )}
                {lines.map((l) => (
                  <tr key={l.id} style={{ borderBottom: '1px solid rgba(148,163,184,.1)', background: l.match_status === 'unmatched' ? 'rgba(239,68,68,.05)' : undefined }}>
                    <td style={{ padding: '.4rem .6rem', whiteSpace: 'nowrap' }}>{formatJalali(l.date_g)}</td>
                    <td style={{ padding: '.4rem .6rem' }}>{l.description || '—'}</td>
                    <td style={{ padding: '.4rem .6rem', color: l.amount >= 0 ? '#15803d' : undefined }}>{l.amount >= 0 ? formatMoney(l.amount) : ''}</td>
                    <td style={{ padding: '.4rem .6rem', color: l.amount < 0 ? '#dc2626' : undefined }}>{l.amount < 0 ? formatMoney(-l.amount) : ''}</td>
                    <td style={{ padding: '.4rem .6rem' }}>{st(l)}</td>
                    <td style={{ padding: '.4rem .6rem' }}>
                      <div style={{ display: 'flex', gap: 3 }}>
                        {l.match_status === 'unmatched'
                          ? <button className="acc-icon-btn" title="تطبیق دستی" onClick={() => setManualOpen({ line: l })}><Link2 size={13} /></button>
                          : <button className="acc-icon-btn" title="لغو تطبیق" onClick={async () => { await unmatchBankLine(l.id); await load(); }}><Unlink size={13} /></button>}
                        <button className="acc-icon-btn" title="حذف خط" onClick={async () => { await deleteBankLine(l.id); await load(); }}><Trash2 size={13} style={{ color: '#dc2626' }} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* موارد باز دفتر */}
          {summary && summary.bookUnmatched.length > 0 && (
            <div className="acc-card" style={{ padding: '.8rem 1rem' }}>
              <h3 style={{ margin: '0 0 .5rem', fontSize: '.9rem' }}>دریافت/پرداخت‌های دفتر که در صورت‌حساب بانک دیده نشدند ({summary.bookUnmatched.length})</h3>
              <div style={{ display: 'grid', gap: 3, fontSize: '.76rem' }}>
                {summary.bookUnmatched.slice(0, 12).map((b) => (
                  <div key={b.id} style={{ display: 'flex', gap: '.5rem', padding: '.25rem .4rem', background: 'rgba(245,158,11,.08)', borderRadius: 6, flexWrap: 'wrap' }}>
                    <span>{formatJalali(b.date_g)}</span>
                    <span style={{ flex: 1, opacity: .8 }}>{b.description || (b.kind === 'receipt' ? 'دریافت' : 'پرداخت')}</span>
                    <strong style={{ color: b.amount >= 0 ? '#15803d' : '#dc2626' }}>{formatMoney(Math.abs(b.amount))}</strong>
                  </div>
                ))}
              </div>
              {summary.bookUnmatched.length > 12 && <p style={{ fontSize: '.7rem', opacity: .6, marginTop: '.4rem' }}>و {summary.bookUnmatched.length - 12} مورد دیگر…</p>}
            </div>
          )}
        </>
      )}

      {/* مودال ورود گروهی */}
      {importOpen && (
        <Modal open onClose={() => setImportOpen(false)} title="ورود صورت‌حساب بانک" wide>
          <div style={{ display: 'grid', gap: '.7rem' }}>
            <p style={{ fontSize: '.8rem', opacity: .75, margin: 0 }}>
              هر خط به شکل <code>تاریخ | شرح | مبلغ</code> — مبلغ منفی یعنی برداشت. مثال:
              <br /><code dir="ltr">1405/06/01|واریز مشتری آریا|250000000</code>
              <br /><code dir="ltr">1405/06/05|انتقال به کارت|12000000-</code>
              <br />تاریخ جلالی یا میلادی هر دو پذیرفته می‌شود.
            </p>
            <textarea className="acc-input" rows={9} dir="auto" value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={'1405/06/01|واریز مشتری|250000000\n1405/06/05|کارمزد بانک|85000-'} />
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <button className="acc-btn acc-btn-primary" onClick={doImport}><Upload size={15} /> وارد کردن</button>
              <button className="acc-btn acc-btn-outline" onClick={() => setImportOpen(false)}>انصراف</button>
            </div>
          </div>
        </Modal>
      )}

      {/* مودال خط تکی */}
      {addOpen && (
        <Modal open onClose={() => setAddOpen(false)} title="افزودن خط صورت‌حساب بانک">
          <div style={{ display: 'grid', gap: '.7rem' }}>
            <Field label="تاریخ"><JalaliDateInput value={addForm.date_g} onChange={(iso) => setAddForm((f) => ({ ...f, date_g: iso }))} /></Field>
            <Field label="شرح"><input className="acc-input" value={addForm.description} onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))} /></Field>
            <Field label="مبلغ (واریز + / برداشت −)"><MoneyInput value={addForm.amount} onChange={(n) => setAddForm((f) => ({ ...f, amount: n }))} /></Field>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <button className="acc-btn acc-btn-primary" onClick={addLine}>افزودن</button>
              <button className="acc-btn acc-btn-outline" onClick={() => setAddOpen(false)}>انصراف</button>
            </div>
          </div>
        </Modal>
      )}

      {/* مودال تطبیق دستی */}
      {manualOpen && (
        <Modal open onClose={() => setManualOpen(null)} title="تطبیق دستی با سند دفتر" wide>
          <p style={{ fontSize: '.8rem', opacity: .7, margin: '0 0 .6rem' }}>
            خط بانک: <strong>{formatJalali(manualOpen.line.date_g)}</strong> — {formatMoney(Math.abs(manualOpen.line.amount))}
          </p>
          <div style={{ display: 'grid', gap: '.4rem', maxHeight: 380, overflowY: 'auto' }}>
            {txs
              .filter((t) => (manualOpen.line.amount >= 0 ? t.kind === 'receipt' : t.kind === 'payment') && Math.abs(t.amount) === Math.abs(manualOpen.line.amount))
              .concat(txs.filter((t) => (manualOpen.line.amount >= 0 ? t.kind === 'receipt' : t.kind === 'payment') && Math.abs(t.amount) !== Math.abs(manualOpen.line.amount)))
              .slice(0, 40)
              .map((t) => (
                <div key={t.id} className="acc-card" style={{ padding: '.45rem .7rem', display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '.74rem' }}>{formatJalali(t.date_g)}</span>
                  <span style={{ flex: 1, fontSize: '.76rem', opacity: .85 }}>{t.description || (t.kind === 'receipt' ? 'دریافت' : 'پرداخت')}</span>
                  <strong style={{ fontSize: '.76rem' }}>{formatMoney(t.amount)}</strong>
                  <button className="acc-btn acc-btn-outline" style={{ fontSize: '.68rem', padding: '.15rem .5rem' }} onClick={async () => {
                    await manualMatchBankLine(manualOpen.line.id, 'transaction', t.id);
                    toast('تطبیق شد');
                    setManualOpen(null);
                    await load();
                  }}>تطبیق</button>
                </div>
              ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
