/* دفترخانه — دفتر روزنامه، دفتر کل و تراز آزمایشی (اسناد خودکار سیستم) */

import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Scale } from 'lucide-react';
import type { AccBusiness, AccJournalEntry, TrialBalanceRow } from '@/lib/acc/types';
import { listJournal, trialBalance } from '@/lib/acc/api';
import { formatMoney } from '@/lib/acc/money';
import { currentJalaliMonthRange, formatJalali, jalaliYearRange, todayJalali } from '@/lib/acc/jalali';
import { CHART_KINDS } from '@/lib/acc/constants';
import { JalaliDateInput, EmptyState } from './ui';

type Tab = 'journal' | 'ledger' | 'trial' | 'trial4';

export default function BooksPage({ business }: { business: AccBusiness }) {
  const [tab, setTab] = useState<Tab>('journal');
  const jy = todayJalali().jy;
  const [from, setFrom] = useState(jalaliYearRange(jy).from);
  const [to, setTo] = useState(jalaliYearRange(jy).to);
  const [entries, setEntries] = useState<AccJournalEntry[]>([]);
  const [trial, setTrial] = useState<TrialBalanceRow[]>([]);
  const [ledgerCode, setLedgerCode] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [j, t] = await Promise.all([listJournal(business.id, from, to), trialBalance(business.id, from, to)]);
        setEntries(j);
        setTrial(t);
      } finally {
        setLoading(false);
      }
    })();
  }, [business.id, from, to]);

  const accountCodes = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of entries) for (const l of e.acc_journal_lines || []) map.set(l.account_code, l.account_title);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [entries]);

  const ledgerRows = useMemo(() => {
    if (!ledgerCode) return [];
    const rows: { date: string; desc: string; debit: number; credit: number; balance: number }[] = [];
    let balance = 0;
    const kind = trial.find((t) => t.code === ledgerCode)?.kind || 'asset';
    const debitLike = kind === 'asset' || kind === 'expense';
    const sorted = [...entries].sort((a, b) => (a.date_g < b.date_g ? -1 : 1));
    for (const e of sorted) {
      for (const l of e.acc_journal_lines || []) {
        if (l.account_code !== ledgerCode) continue;
        balance += debitLike ? l.debit - l.credit : l.credit - l.debit;
        rows.push({ date: e.date_g, desc: e.description || '', debit: l.debit, credit: l.credit, balance });
      }
    }
    return rows.reverse();
  }, [entries, ledgerCode, trial]);

  const trialTotals = trial.reduce(
    (acc, r) => ({ debit: acc.debit + r.debit, credit: acc.credit + r.credit, balance: acc.balance + r.balance }),
    { debit: 0, credit: 0, balance: 0 },
  );

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '.35rem', flex: 1, flexWrap: 'wrap' }}>
          {([['journal', 'دفتر روزنامه'], ['ledger', 'دفتر کل'], ['trial', 'تراز آزمایشی'], ['trial4', 'تراز چهارستونی']] as const).map(([k, label]) => (
            <button key={k} className={`acc-btn ${tab === k ? 'acc-btn-primary' : 'acc-btn-outline'}`} style={{ minHeight: 40, padding: '.35rem .9rem', fontSize: '.8rem' }} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
          <div style={{ width: 150 }}><JalaliDateInput value={from} onChange={setFrom} /></div>
          <span className="acc-hint">تا</span>
          <div style={{ width: 150 }}><JalaliDateInput value={to} onChange={setTo} /></div>
          <button className="acc-btn acc-btn-ghost" onClick={() => { const r = currentJalaliMonthRange(); setFrom(r.from); setTo(r.to); }}>این ماه</button>
        </div>
      </div>

      {tab === 'journal' && (
        <div style={{ display: 'grid', gap: '.8rem' }}>
          {entries.map((e) => {
            const sumD = (e.acc_journal_lines || []).reduce((s, l) => s + l.debit, 0);
            return (
              <div className="acc-card" key={e.id} style={{ padding: '1rem 1.1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', flexWrap: 'wrap', marginBottom: '.7rem' }}>
                  <span className="acc-badge warn">سند {e.entry_no}</span>
                  <span className="num acc-hint">{formatJalali(e.date_g)}</span>
                  <span style={{ fontSize: '.88rem', fontWeight: 600, color: 'var(--text)' }}>{e.description}</span>
                  {e.ref_action === 'reverse' && <span className="acc-badge bad">برگشتی</span>}
                  <span style={{ marginRight: 'auto', fontSize: '.78rem', color: 'var(--gold2)' }} className="num">{formatMoney(sumD)} ریال</span>
                </div>
                <div className="acc-table-wrap">
                  <table className="acc-table" style={{ minWidth: 520 }}>
                    <thead>
                      <tr><th style={{ width: 80 }}>کد</th><th>سرفصل</th><th style={{ width: 130 }}>بدهکار</th><th style={{ width: 130 }}>بستانکار</th></tr>
                    </thead>
                    <tbody>
                      {(e.acc_journal_lines || []).map((l) => (
                        <tr key={l.id}>
                          <td className="num">{l.account_code}</td>
                          <td>{l.account_title}</td>
                          <td className="num" style={{ color: l.debit ? 'var(--text)' : 'var(--muted)' }}>{l.debit ? formatMoney(l.debit) : '—'}</td>
                          <td className="num" style={{ color: l.credit ? 'var(--text)' : 'var(--muted)' }}>{l.credit ? formatMoney(l.credit) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          {!loading && entries.length === 0 && (
            <EmptyState icon={<BookOpen size={34} />} title="سندی در این بازه نیست" hint="اسناد با صدور فاکتور، ثبت هزینه و دریافت/پرداخت به‌صورت خودکار ساخته می‌شوند" />
          )}
        </div>
      )}

      {tab === 'ledger' && (
        <div style={{ display: 'grid', gap: '.8rem' }}>
          <div className="acc-card" style={{ paddingBottom: '.4rem' }}>
            <div className="acc-form-grid">
              <label className="acc-field">
                <label>سرفصل حساب</label>
                <select className="acc-select" value={ledgerCode} onChange={(e) => setLedgerCode(e.target.value)}>
                  <option value="">— انتخاب سرفصل —</option>
                  {accountCodes.map(([code, title]) => <option key={code} value={code}>{code} — {title}</option>)}
                </select>
              </label>
            </div>
          </div>
          {ledgerCode && (
            <div className="acc-table-wrap">
              <table className="acc-table">
                <thead>
                  <tr><th>تاریخ</th><th>شرح</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th></tr>
                </thead>
                <tbody>
                  {ledgerRows.map((r, i) => (
                    <tr key={i}>
                      <td className="num">{formatJalali(r.date)}</td>
                      <td>{r.desc}</td>
                      <td className="num">{r.debit ? formatMoney(r.debit) : '—'}</td>
                      <td className="num">{r.credit ? formatMoney(r.credit) : '—'}</td>
                      <td className="num" style={{ color: 'var(--gold2)', fontWeight: 700 }}>{formatMoney(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!ledgerCode && <EmptyState icon={<BookOpen size={34} />} title="یک سرفصل انتخاب کنید" hint="گردش و مانده تدریجی هر حساب در دفتر کل نمایش داده می‌شود" />}
        </div>
      )}

      {tab === 'trial4' && (
        <div className="acc-table-wrap">
          <p className="acc-hint" style={{ marginBottom: '.6rem' }}>
            تراز آزمایشی چهارستونی — گردش بدهکار و بستانکار هر سرفصل به همراه مانده دوطرفه؛ مطابق فرم استاندارد حسابداری ایران.
          </p>
          <table className="acc-table">
            <thead>
              <tr>
                <th>کد</th><th>سرفصل</th>
                <th>گردش بدهکار</th><th>گردش بستانکار</th>
                <th>مانده بدهکار</th><th>مانده بستانکار</th>
              </tr>
            </thead>
            <tbody>
              {trial.map((r) => (
                <tr key={r.code}>
                  <td className="num">{r.code}</td>
                  <td>{r.title}</td>
                  <td className="num">{r.debit ? formatMoney(r.debit) : '—'}</td>
                  <td className="num">{r.credit ? formatMoney(r.credit) : '—'}</td>
                  <td className="num" style={r.balance > 0 ? { color: 'var(--gold2)', fontWeight: 700 } : undefined}>{r.balance > 0 ? formatMoney(r.balance) : '—'}</td>
                  <td className="num" style={r.balance < 0 ? { color: '#ef9a94', fontWeight: 700 } : undefined}>{r.balance < 0 ? formatMoney(-r.balance) : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}><Scale size={13} style={{ display: 'inline', verticalAlign: '-2px' }} /> جمع کل</td>
                <td className="num">{formatMoney(trialTotals.debit)}</td>
                <td className="num">{formatMoney(trialTotals.credit)}</td>
                <td className="num">{formatMoney(trial.filter((r) => r.balance > 0).reduce((s, r) => s + r.balance, 0))}</td>
                <td className="num">{formatMoney(trial.filter((r) => r.balance < 0).reduce((s, r) => s - r.balance, 0))}</td>
              </tr>
            </tfoot>
          </table>
          {!loading && trial.length === 0 && <EmptyState title="ترازی برای این بازه وجود ندارد" />}
        </div>
      )}

      {tab === 'trial' && (
        <div className="acc-table-wrap">
          <table className="acc-table">
            <thead>
              <tr><th>کد</th><th>سرفصل</th><th>نوع</th><th>جمع بدهکار</th><th>جمع بستانکار</th><th>مانده</th></tr>
            </thead>
            <tbody>
              {trial.map((r) => (
                <tr key={r.code}>
                  <td className="num">{r.code}</td>
                  <td>{r.title}</td>
                  <td><span className="acc-badge draft">{CHART_KINDS[r.kind]}</span></td>
                  <td className="num">{r.debit ? formatMoney(r.debit) : '—'}</td>
                  <td className="num">{r.credit ? formatMoney(r.credit) : '—'}</td>
                  <td className="num" style={{ fontWeight: 700, color: r.balance >= 0 ? 'var(--gold2)' : '#ef9a94' }}>{formatMoney(r.balance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}><Scale size={13} style={{ display: 'inline', verticalAlign: '-2px' }} /> جمع کل</td>
                <td className="num">{formatMoney(trialTotals.debit)}</td>
                <td className="num">{formatMoney(trialTotals.credit)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
          {!loading && trial.length === 0 && <EmptyState title="ترازی برای این بازه وجود ندارد" />}
        </div>
      )}
    </div>
  );
}
