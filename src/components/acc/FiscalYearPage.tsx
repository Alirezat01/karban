/* بستن و افتتاح دوره مالی — بستن حساب‌های موقت، سند افتتاحیه، افتتاحیه دستی */

import React, { useEffect, useState } from 'react';
import { CalendarCheck, DoorOpen, Lock, Plus, Trash2 } from 'lucide-react';
import type { AccBusiness } from '@/lib/acc/types';
import { listFiscalYears, closeFiscalYearV2, openNextYear, saveOpeningEntry, trialBalanceMulti, AccFiscalYear } from '@/lib/acc/api7';
import { trialBalance } from '@/lib/acc/api';
import { formatMoney } from '@/lib/acc/money';
import { todayJalali } from '@/lib/acc/jalali';
import { Field, Modal, MoneyInput, confirmAction, toast, EmptyState, Badge } from './ui';

interface OpeningRow { account_code: string; account_title: string; debit: number; credit: number }

export default function FiscalYearPage({ business }: { business: AccBusiness }) {
  const [rows, setRows] = useState<AccFiscalYear[]>([]);
  const [tb, setTb] = useState<{ code: string; title: string; kind: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [openOpen, setOpenOpen] = useState(false);
  const [openRows, setOpenRows] = useState<OpeningRow[]>([]);
  const [openYear, setOpenYear] = useState<number>(todayJalali().jy);

  async function load() {
    setLoading(true);
    try {
      const [f, t] = await Promise.all([listFiscalYears(business.id), trialBalance(business.id)]);
      setRows(f);
      setTb(t);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [business.id]);

  async function doClose(jyear: number) {
    if (!(await confirmAction(`سال مالی ${jyear} بسته شود؟ همه دوره‌های ماهانه آن قفل می‌شوند و حساب‌های درآمد/هزینه به سود (زیان) انباشته منتقل می‌شود.`))) return;
    setBusy(true);
    try {
      const r = await closeFiscalYearV2(business.id, jyear);
      toast(`سال ${jyear} بسته شد — سود خالص: ${formatMoney(r.netProfit)} ریال`);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'خطا', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function doOpen(jyear: number) {
    if (!(await confirmAction(`سند افتتاحیه سال ${jyear + 1} ساخته شود؟ مانده حساب‌های دائم سال ${jyear} به سال جدید منتقل می‌شود.`))) return;
    setBusy(true);
    try {
      const r = await openNextYear(business.id, jyear);
      toast(`افتتاحیه ${jyear + 1} ثبت شد — ${r.movedAccounts} حساب منتقل شد`);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'خطا', 'error');
    } finally {
      setBusy(false);
    }
  }

  function addOpenRow() {
    setOpenRows((r) => [...r, { account_code: '', account_title: '', debit: 0, credit: 0 }]);
  }
  function pickAccount(i: number, code: string) {
    const t = tb.find((x) => x.code === code);
    setOpenRows((r) => r.map((row, k) => k === i ? { ...row, account_code: code, account_title: t?.title || code } : row));
  }

  async function submitOpening() {
    const filled = openRows.filter((r) => r.account_code && (r.debit > 0 || r.credit > 0));
    if (!filled.length) { toast('حداقل یک ردیف با مبلغ پر کنید', 'error'); return; }
    try {
      await saveOpeningEntry(business.id, openYear, filled);
      toast('سند افتتاحیه ثبت شد');
      setOpenOpen(false);
      setOpenRows([]);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'خطا', 'error');
    }
  }

  const currentYear = todayJalali().jy;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.6rem', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>دوره مالی — بستن و افتتاح</h2>
          <p style={{ margin: '.2rem 0 0', fontSize: '.78rem', opacity: .65 }}>بستن حساب‌های موقت به سود انباشته، انتقال مانده دائمی و سند افتتاحیه دستی</p>
        </div>
        <div style={{ display: 'flex', gap: '.45rem', flexWrap: 'wrap' }}>
          <button className="acc-btn acc-btn-outline" onClick={() => { setOpenOpen(true); addOpenRow(); }}><Plus size={15} /> سند افتتاحیه دستی</button>
        </div>
      </div>

      {loading ? <p style={{ opacity: .6 }}>در حال بارگذاری…</p> : (
        <div className="acc-card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.8rem' }}>
            <thead>
              <tr style={{ textAlign: 'right', borderBottom: '1px solid rgba(148,163,184,.25)' }}>
                <th style={{ padding: '.55rem .7rem' }}>سال مالی</th>
                <th style={{ padding: '.55rem .7rem' }}>وضعیت</th>
                <th style={{ padding: '.55rem .7rem' }}>سند اختتامیه</th>
                <th style={{ padding: '.55rem .7rem' }}>سند افتتاحیه</th>
                <th style={{ padding: '.55rem .7rem' }}>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '1.2rem', textAlign: 'center', opacity: .65 }}>
                  هنوز دوره‌ای ثبت نشده — برای سال جاری ({currentYear}) دکمه «بستن دوره» را بزنید یا با افتتاحیه دستی شروع کنید
                </td></tr>
              )}
              {rows.map((f) => (
                <tr key={f.id} style={{ borderBottom: '1px solid rgba(148,163,184,.12)' }}>
                  <td style={{ padding: '.5rem .7rem', fontWeight: 700 }}>{f.jyear}</td>
                  <td style={{ padding: '.5rem .7rem' }}>
                    <Badge tone={f.status === 'closed' ? 'warn' : 'ok'}>{f.status === 'closed' ? 'بسته' : 'باز'}</Badge>
                  </td>
                  <td style={{ padding: '.5rem .7rem', fontSize: '.72rem', opacity: .7 }}>{f.closing_entry_id ? 'ثبت شده' : '—'}</td>
                  <td style={{ padding: '.5rem .7rem', fontSize: '.72rem', opacity: .7 }}>{f.opening_entry_id ? 'ثبت شده' : '—'}</td>
                  <td style={{ padding: '.5rem .7rem' }}>
                    <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                      {f.status === 'open' && (
                        <button className="acc-btn acc-btn-outline" style={{ fontSize: '.72rem' }} disabled={busy} onClick={() => doClose(f.jyear)}>
                          <Lock size={13} /> بستن دوره
                        </button>
                      )}
                      {f.status === 'closed' && (
                        <button className="acc-btn acc-btn-outline" style={{ fontSize: '.72rem' }} disabled={busy} onClick={() => doOpen(f.jyear)}>
                          <DoorOpen size={13} /> افتتاح سال {f.jyear + 1}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="acc-card" style={{ padding: '.8rem 1rem', marginTop: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '.88rem' }}><CalendarCheck size={14} style={{ verticalAlign: 'middle', marginLeft: 4 }} /> راهنما</h3>
        <p style={{ fontSize: '.78rem', opacity: .7, margin: '.4rem 0 0', lineHeight: 1.9 }}>
          ۱) <strong>بستن دوره:</strong> حساب‌های موقت (درآمد و هزینه) بسته و به «سود (زیان) انباشته» منتقل می‌شوند و همه ماه‌های سال قفل می‌شوند.
          <br />۲) <strong>افتتاح سال بعد:</strong> مانده حساب‌های دائم (بانک، صندوق، مطالبات، بدهی‌ها، سرمایه) به سال جدید با سند افتتاحیه منتقل می‌شود.
          <br />۳) <strong>افتتاحیه دستی:</strong> اگر در ابتدای همکاری با کاربان مانده اول دوره دارید، با همین گزینه وارد کنید — باید تراز باشد.
        </p>
      </div>

      {/* مودال افتتاحیه دستی */}
      {openOpen && (
        <Modal open onClose={() => setOpenOpen(false)} title="سند افتتاحیه دستی" wide>
          <div style={{ display: 'grid', gap: '.7rem' }}>
            <Field label="سال مالی (ابتدای دوره)">
              <input
                className="acc-input" type="number" style={{ maxWidth: 140 }}
                value={openYear} onChange={(e) => setOpenYear(Number(e.target.value) || currentYear)}
              />
            </Field>
            <div style={{ display: 'grid', gap: '.45rem' }}>
              {openRows.map((r, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '.4rem', alignItems: 'end' }}>
                  <Field label="حساب">
                    <select className="acc-select" value={r.account_code} onChange={(e) => pickAccount(i, e.target.value)}>
                      <option value="">— انتخاب سرفصل —</option>
                      {tb.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.title}</option>)}
                    </select>
                  </Field>
                  <Field label="بدهکار"><MoneyInput value={r.debit} onChange={(n) => setOpenRows((rs) => rs.map((x, k) => k === i ? { ...x, debit: n, credit: n > 0 ? 0 : x.credit } : x))} /></Field>
                  <Field label="بستانکار"><MoneyInput value={r.credit} onChange={(n) => setOpenRows((rs) => rs.map((x, k) => k === i ? { ...x, credit: n, debit: n > 0 ? 0 : x.debit } : x))} /></Field>
                  <button className="acc-icon-btn" style={{ marginBottom: 4 }} onClick={() => setOpenRows((rs) => rs.filter((_, k) => k !== i))}><Trash2 size={14} style={{ color: '#dc2626' }} /></button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="acc-btn acc-btn-outline" onClick={addOpenRow}><Plus size={14} /> ردیف</button>
              <strong style={{ fontSize: '.8rem' }}>
                جمع بدهکار: {formatMoney(openRows.reduce((s, r) => s + r.debit, 0))}
                {' | '}
                جمع بستانکار: {formatMoney(openRows.reduce((s, r) => s + r.credit, 0))}
              </strong>
              <span style={{ flex: 1 }} />
              <button className="acc-btn acc-btn-primary" onClick={submitOpening}>ثبت سند افتتاحیه</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
