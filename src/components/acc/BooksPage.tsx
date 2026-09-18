/* دفترخانه — دفتر روزنامه، دفتر کل، تراز آزمایشی + سند دستی و سرفصل اضافه (نسخه ۵) */

import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Plus, Scale, Trash2 } from 'lucide-react';
import type { AccBusiness, AccChartRow, AccJournalEntry, TrialBalanceRow } from '@/lib/acc/types';
import {
  deleteManualJournal, deleteChartAccount, listChart, listJournal, saveChartAccount,
  saveManualJournal, trialBalance,
} from '@/lib/acc/api';
import { voidJournal as voidJournalV2, deleteJournalFull as deleteJournalFullV2 } from '@/lib/acc/api7';
import { VoidDeleteBtns } from './VoidDeleteBtns';
import AttachButton from './AttachButton';
import { formatMoney } from '@/lib/acc/money';
import { currentJalaliMonthRange, formatJalali, jalaliYearRange, todayJalali, dateToISO } from '@/lib/acc/jalali';
import { CHART_KINDS, SYSTEM_CHART } from '@/lib/acc/constants';
import { Field, JalaliDateInput, Modal, MoneyInput, EmptyState, confirmAction, toast } from './ui';

type Tab = 'journal' | 'ledger' | 'trial' | 'trial4' | 'chart';

interface JLine { key: number; account_code: string; debit: number; credit: number }

const newRowLine = (): JLine => ({ key: Date.now() + Math.random(), account_code: '', debit: 0, credit: 0 });

export default function BooksPage({ business }: { business: AccBusiness }) {
  const [tab, setTab] = useState<Tab>('journal');
  const jy = todayJalali().jy;
  const [from, setFrom] = useState(jalaliYearRange(jy).from);
  const [to, setTo] = useState(jalaliYearRange(jy).to);
  const [entries, setEntries] = useState<AccJournalEntry[]>([]);
  const [trial, setTrial] = useState<TrialBalanceRow[]>([]);
  const [chart, setChart] = useState<AccChartRow[]>([]);
  const [ledgerCode, setLedgerCode] = useState('');
  const [loading, setLoading] = useState(true);

  /* سند دستی */
  const [manualOpen, setManualOpen] = useState(false);
  const [manualDate, setManualDate] = useState(dateToISO(new Date()));
  const [manualDesc, setManualDesc] = useState('');
  const [manualLines, setManualLines] = useState<JLine[]>([newRowLine(), newRowLine()]);
  const [savingManual, setSavingManual] = useState(false);

  /* سرفصل اضافه */
  const [chartModal, setChartModal] = useState(false);
  const [newChart, setNewChart] = useState<{ title: string; kind: AccChartRow['kind']; code: string }>({ title: '', kind: 'expense', code: '' });

  async function load() {
    setLoading(true);
    try {
      const [j, t, c] = await Promise.all([
        listJournal(business.id, from, to),
        trialBalance(business.id, from, to),
        listChart(business.id).catch(() => [] as AccChartRow[]),
      ]);
      setEntries(j);
      setTrial(t);
      setChart(c);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [business.id, from, to]);

  /* فهرست سرفصل‌های قابل انتخاب: سیستم + اضافه‌ها + کدهای دیده‌شده در اسناد */
  const chartOptions = useMemo(() => {
    const map = new Map<string, string>();
    const base = chart.length ? chart : SYSTEM_CHART.map((c) => ({ ...c, id: `sys-${c.code}`, business_id: null, is_system: true })) as AccChartRow[];
    for (const c of base) map.set(c.code, c.title);
    for (const e of entries) for (const l of e.acc_journal_lines || []) if (!map.has(l.account_code)) map.set(l.account_code, l.account_title);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [chart, entries]);

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

  /* ── سند دستی ── */
  const manualTotalD = manualLines.reduce((s, l) => s + (l.debit || 0), 0);
  const manualTotalC = manualLines.reduce((s, l) => s + (l.credit || 0), 0);
  const manualBalanced = manualTotalD > 0 && manualTotalD === manualTotalC;

  async function saveManual() {
    const lines = manualLines
      .filter((l) => l.account_code && (l.debit > 0 || l.credit > 0))
      .map((l) => ({ account_code: l.account_code, account_title: chartOptions.find(([c]) => c === l.account_code)?.[1] || '', debit: l.debit, credit: l.credit }));
    if (lines.length < 2) { toast('حداقل دو ردیف با سرفصل و مبلغ کامل کنید', 'error'); return; }
    setSavingManual(true);
    try {
      await saveManualJournal(business.id, { date_g: manualDate, description: manualDesc, lines });
      toast('سند دستی ثبت شد');
      setManualOpen(false);
      setManualDesc('');
      setManualLines([newRowLine(), newRowLine()]);
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'ثبت سند ناموفق بود', 'error');
    } finally {
      setSavingManual(false);
    }
  }

  async function removeManual(entry: AccJournalEntry) {
    if (!(await confirmAction(`سند دستی شماره ${entry.entry_no} حذف شود؟`))) return;
    try {
      await deleteManualJournal(entry.id);
      toast('سند حذف شد');
      load();
    } catch {
      toast('حذف ناموفق بود — فقط اسناد دستی قابل حذف‌اند', 'error');
    }
  }

  async function voidManual(entry: AccJournalEntry, reason: string) {
    try {
      await voidJournalV2(business.id, entry.id, reason);
      toast('سند معکوس ثبت و سند ابطال شد');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'ابطال ناموفق بود', 'error');
    }
  }
  async function deleteManualFull(entry: AccJournalEntry) {
    try {
      await deleteJournalFullV2(entry.id, entry.ref_type);
      toast('سند حذف شد');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'حذف ناموفق بود', 'error');
    }
  }

  /* ── سرفصل اضافه ── */
  const customChart = chart.filter((c) => !c.is_system);

  async function addChartAccount() {
    if (!newChart.title.trim()) { toast('عنوان سرفصل را وارد کنید', 'error'); return; }
    try {
      await saveChartAccount(business.id, newChart);
      toast('سرفصل اضافه شد و در همه اسناد قابل انتخاب است');
      setNewChart({ title: '', kind: 'expense', code: '' });
      setChartModal(false);
      load();
    } catch {
      toast('ثبت سرفصل ناموفق بود — کد تکراری است؟', 'error');
    }
  }

  async function removeChart(row: AccChartRow) {
    if (!(await confirmAction(`سرفصل «${row.title}» حذف شود؟`))) return;
    try {
      await deleteChartAccount(row.id);
      toast('حذف شد');
      load();
    } catch {
      toast('حذف ناموفق بود', 'error');
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '.35rem', flex: 1, flexWrap: 'wrap' }}>
          {([['journal', 'دفتر روزنامه'], ['ledger', 'دفتر کل'], ['trial', 'تراز آزمایشی'], ['trial4', 'تراز چهارستونی'], ['chart', 'سرفصل‌ها']] as const).map(([k, label]) => (
            <button key={k} className={`acc-btn ${tab === k ? 'acc-btn-primary' : 'acc-btn-outline'}`} style={{ minHeight: 40, padding: '.35rem .9rem', fontSize: '.8rem' }} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>
        {tab === 'journal' && (
          <button className="acc-btn acc-btn-primary" onClick={() => setManualOpen(true)}><Plus size={15} /> سند دستی</button>
        )}
        {tab !== 'journal' && tab !== 'chart' && (
          <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
            <div style={{ width: 150 }}><JalaliDateInput value={from} onChange={setFrom} /></div>
            <span className="acc-hint">تا</span>
            <div style={{ width: 150 }}><JalaliDateInput value={to} onChange={setTo} /></div>
            <button className="acc-btn acc-btn-ghost" onClick={() => { const r = currentJalaliMonthRange(); setFrom(r.from); setTo(r.to); }}>این ماه</button>
          </div>
        )}
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
                  {e.ref_type === 'manual' && <span className="acc-badge draft">دستی</span>}
                  {e.ref_action === 'reverse' && <span className="acc-badge bad">برگشتی</span>}
                  <span style={{ marginRight: 'auto', fontSize: '.78rem', color: 'var(--gold2)' }} className="num">{formatMoney(sumD)} ریال</span>
                  {e.ref_type === 'manual' && (
                    <>
                      <button className="acc-icon-btn danger" title="حذف سند دستی" onClick={() => removeManual(e)}><Trash2 size={14} /></button>
                      <VoidDeleteBtns voidLabel="ابطال سند (برگشت)" deleteLabel="حذف کامل سند" onVoid={(reason) => voidManual(e, reason)} onDelete={() => deleteManualFull(e)} />
                    </>
                  )}
                  <AttachButton business={business} entityType="journal" entityId={e.id} />
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
            <EmptyState icon={<BookOpen size={34} />} title="سندی در این بازه نیست" hint="اسناد با صدور فاکتور، ثبت هزینه و دریافت/پرداخت به‌صورت خودکار ساخته می‌شوند — یا با «سند دستی» ثبت کنید" />
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
                  {chartOptions.map(([code, title]) => <option key={code} value={code}>{code} — {title}</option>)}
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

      {tab === 'chart' && (
        <div style={{ display: 'grid', gap: '.8rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '.6rem' }}>
            <p className="acc-hint" style={{ margin: 0 }}>
              سرفصل‌های سیستم + سرفصل‌های اختصاصی شما. سرفصل‌های اضافه در همه اسناد دستی و گزارش‌ها قابل انتخاب‌اند.
            </p>
            <button className="acc-btn acc-btn-primary" onClick={() => setChartModal(true)}><Plus size={15} /> سرفصل اضافه</button>
          </div>
          <div className="acc-table-wrap">
            <table className="acc-table">
              <thead><tr><th style={{ width: 90 }}>کد</th><th>عنوان سرفصل</th><th style={{ width: 150 }}>نوع</th><th style={{ width: 120 }}>منبع</th><th style={{ width: 60 }}></th></tr></thead>
              <tbody>
                {(chart.length ? chart : SYSTEM_CHART.map((c) => ({ ...c, id: `sys-${c.code}`, business_id: null, is_system: true })) as AccChartRow[]).map((c) => (
                  <tr key={c.id}>
                    <td className="num" style={{ fontWeight: 700 }}>{c.code}</td>
                    <td>{c.title}</td>
                    <td><span className="acc-badge draft">{CHART_KINDS[c.kind]}</span></td>
                    <td>{c.is_system ? <span className="acc-badge ok">سیستم</span> : <span className="acc-badge warn">اختصاصی</span>}</td>
                    <td>
                      {!c.is_system && (
                        <button className="acc-icon-btn danger" onClick={() => removeChart(c)}><Trash2 size={14} /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {customChart.length === 0 && (
              <p className="acc-hint" style={{ padding: '.6rem .9rem' }}>
                هنوز سرفصل اختصاصی نساخته‌اید — مثلاً «هزینه پارکینگ» یا «درآمد مشاوره» را اضافه کنید.
              </p>
            )}
          </div>
        </div>
      )}

      {/* مودال سند دستی */}
      <Modal open={manualOpen} onClose={() => setManualOpen(false)} title="ثبت سند حسابداری دستی" wide>
        <div style={{ display: 'grid', gap: '.8rem' }}>
          <div className="acc-form-grid">
            <Field label="تاریخ سند"><JalaliDateInput value={manualDate} onChange={setManualDate} /></Field>
            <Field label="شرح سند"><input className="acc-input" placeholder="مثلاً: اصلاحیه مالیاتی، ثبت استهلاک…" value={manualDesc} onChange={(e) => setManualDesc(e.target.value)} /></Field>
          </div>
          <div className="acc-table-wrap">
            <table className="acc-table" style={{ minWidth: 560 }}>
              <thead>
                <tr><th style={{ width: 36 }}>#</th><th style={{ minWidth: 220 }}>سرفصل حساب</th><th style={{ width: 140 }}>بدهکار (ریال)</th><th style={{ width: 140 }}>بستانکار (ریال)</th><th style={{ width: 44 }}></th></tr>
              </thead>
              <tbody>
                {manualLines.map((l, i) => (
                  <tr key={l.key}>
                    <td className="num">{i + 1}</td>
                    <td>
                      <select className="acc-select" value={l.account_code} onChange={(e) => setManualLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, account_code: e.target.value } : x)))}>
                        <option value="">— انتخاب سرفصل —</option>
                        {chartOptions.map(([code, title]) => <option key={code} value={code}>{code} — {title}</option>)}
                      </select>
                    </td>
                    <td><MoneyInput value={l.debit} onChange={(n) => setManualLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, debit: n, credit: n > 0 ? 0 : x.credit } : x)))} /></td>
                    <td><MoneyInput value={l.credit} onChange={(n) => setManualLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, credit: n, debit: n > 0 ? 0 : x.debit } : x)))} /></td>
                    <td>
                      <button className="acc-icon-btn danger" onClick={() => setManualLines((ls) => (ls.length > 2 ? ls.filter((x) => x.key !== l.key) : ls))}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>جمع</td>
                  <td className="num" style={{ color: 'var(--gold2)' }}>{formatMoney(manualTotalD)}</td>
                  <td className="num" style={{ color: manualBalanced ? 'var(--gold2)' : '#ef9a94' }}>{formatMoney(manualTotalC)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="acc-btn acc-btn-outline" onClick={() => setManualLines((ls) => [...ls, newRowLine()])}><Plus size={14} /> افزودن ردیف</button>
            <span className="acc-hint" style={{ color: manualBalanced ? '#2f9e6e' : '#ef9a94' }}>
              {manualBalanced ? '✓ سند تراز است' : manualTotalD === manualTotalC ? 'سند باید تراز شود' : `عدم تراز: ${formatMoney(Math.abs(manualTotalD - manualTotalC))} ریال`}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '.6rem' }}>
            <button className="acc-btn acc-btn-primary" disabled={!manualBalanced || savingManual} onClick={saveManual}>ثبت سند</button>
            <button className="acc-btn acc-btn-outline" onClick={() => setManualOpen(false)}>انصراف</button>
          </div>
        </div>
      </Modal>

      {/* مودال سرفصل اضافه */}
      <Modal open={chartModal} onClose={() => setChartModal(false)} title="افزودن سرفصل حسابداری">
        <div style={{ display: 'grid', gap: '.8rem' }}>
          <Field label="عنوان سرفصل *">
            <input className="acc-input" value={newChart.title} onChange={(e) => setNewChart({ ...newChart, title: e.target.value })} placeholder="مثلاً: هزینه پارکینگ" />
          </Field>
          <div className="acc-form-grid">
            <Field label="نوع سرفصل">
              <select className="acc-select" value={newChart.kind} onChange={(e) => setNewChart({ ...newChart, kind: e.target.value as AccChartRow['kind'] })}>
                {Object.entries(CHART_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="کد (اختیاری)" hint="خالی بگذارید تا خودکار داده شود">
              <input className="acc-input num" dir="ltr" inputMode="numeric" value={newChart.code} onChange={(e) => setNewChart({ ...newChart, code: e.target.value.replace(/[^0-9]/g, '').slice(0, 6) })} placeholder="5220" />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: '.6rem' }}>
            <button className="acc-btn acc-btn-primary" onClick={addChartAccount}>ثبت سرفصل</button>
            <button className="acc-btn acc-btn-outline" onClick={() => setChartModal(false)}>انصراف</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
