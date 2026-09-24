/* کارت حساب و دفاتر — گردش هر سرفصل (کل/معین/تفصیلی)، دفتر معین، دفتر تفصیلی، تراز ۲/۴/۶ ستونی */

import React, { useEffect, useMemo, useState } from 'react';
import { Download, Printer, Search } from 'lucide-react';
import type { AccBusiness } from '@/lib/acc/types';
import { listChartTree, listDetails, accountCard, moyanLedger, tafsilLedger, trialBalanceMulti, ChartNode, AccountCardResult, TrialBalance6Row, AccDetail } from '@/lib/acc/api7';
import { formatMoney } from '@/lib/acc/money';
import { formatJalali, isoToJalaliInput, jalaliInputToISO } from '@/lib/acc/jalali';
import { Field, toast, EmptyState } from './ui';
import { downloadCsv } from '@/lib/acc/api';

type Tab = 'card' | 'moyan' | 'tafsil' | 'tb';
const LEVELS = ['', 'سطح کل', 'سطح معین', 'سطح تفصیلی'];

function flattenTree(nodes: ChartNode[], depth = 0): { node: ChartNode; depth: number }[] {
  const out: { node: ChartNode; depth: number }[] = [];
  for (const n of nodes) {
    out.push({ node: n, depth });
    if (n.children?.length) out.push(...flattenTree(n.children, depth + 1));
  }
  return out;
}

export default function LedgerCardPage({ business }: { business: AccBusiness }) {
  const [tab, setTab] = useState<Tab>('card');
  const [tree, setTree] = useState<ChartNode[]>([]);
  const [details, setDetails] = useState<AccDetail[]>([]);
  const [loading, setLoading] = useState(true);

  /* کارت حساب */
  const [code, setCode] = useState('');
  const [detailId, setDetailId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [card, setCard] = useState<AccountCardResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');

  /* تراز آزمایشی */
  const [level, setLevel] = useState(1);
  const [tbRows, setTbRows] = useState<TrialBalance6Row[]>([]);

  /* دفتر معین */
  const [moyanCards, setMoyanCards] = useState<AccountCardResult[]>([]);
  const [moyanCode, setMoyanCode] = useState('');

  /* دفتر تفصیلی */
  const [tafsilDetail, setTafsilDetail] = useState('');
  const [tafsilCard, setTafsilCard] = useState<AccountCardResult | null>(null);
  const [tafsilTitle, setTafsilTitle] = useState('');

  const flat = useMemo(() => flattenTree(tree), [tree]);
  const filtered = useMemo(() => {
    if (!search.trim()) return flat;
    const q = search.trim();
    return flat.filter((f) => f.node.code.includes(q) || f.node.title.includes(q));
  }, [flat, search]);

  async function load() {
    setLoading(true);
    try {
      const [t, d] = await Promise.all([listChartTree(business.id), listDetails(business.id)]);
      setTree(t);
      setDetails(d);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [business.id]);

  async function runCard() {
    if (!code) { toast('یک سرفصل انتخاب کنید', 'error'); return; }
    setBusy(true);
    try {
      const c = await accountCard(business.id, code, from || undefined, to || undefined, detailId || undefined);
      setCard(c);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'خطا', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function runTb() {
    setBusy(true);
    try {
      setTbRows(await trialBalanceMulti(business.id, from || undefined, to || undefined, level));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'خطا', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function runMoyan() {
    if (!moyanCode) { toast('سرفصل والد را انتخاب کنید', 'error'); return; }
    setBusy(true);
    try {
      const cards = await moyanLedger(business.id, moyanCode, from || undefined, to || undefined);
      setMoyanCards(cards);
      if (!cards.length) toast('زیرمجموعه یا گردشی یافت نشد');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'خطا', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function runTafsil() {
    if (!tafsilDetail) { toast('تفصیلی را انتخاب کنید', 'error'); return; }
    setBusy(true);
    try {
      const r = await tafsilLedger(business.id, tafsilDetail, code || undefined, from || undefined, to || undefined);
      setTafsilCard(r.card);
      setTafsilTitle(r.detail?.title || '');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'خطا', 'error');
    } finally {
      setBusy(false);
    }
  }

  function csvCard(c: AccountCardResult) {
    downloadCsv(`کارت-حساب-${c.code}.csv`, ['تاریخ', 'شماره سند', 'شرح', 'بدهکار', 'بستانکار', 'مانده'], c.rows.map((r) => [formatJalali(r.date_g), r.entry_no, [r.description, r.line_desc, r.detail_title].filter(Boolean).join(' — '), r.debit, r.credit, r.running]));
  }

  function CardTable({ c }: { c: AccountCardResult }) {
    return (
      <div>
        <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '.5rem' }}>
          <strong style={{ fontSize: '.88rem' }}>{c.code} — {c.title}</strong>
          <span style={{ fontSize: '.74rem', opacity: .65 }}>افتتاحیه: {formatMoney(c.opening)}</span>
          <span style={{ fontSize: '.74rem', opacity: .65 }}>بدهکار: {formatMoney(c.totalDebit)}</span>
          <span style={{ fontSize: '.74rem', opacity: .65 }}>بستانکار: {formatMoney(c.totalCredit)}</span>
          <strong style={{ fontSize: '.78rem', color: c.closing >= 0 ? '#15803d' : '#dc2626' }}>مانده: {formatMoney(Math.abs(c.closing))} {c.closing >= 0 ? '(بد)' : '(بس)'}</strong>
          <span style={{ flex: 1 }} />
          <button className="acc-btn acc-btn-ghost" style={{ fontSize: '.7rem' }} onClick={() => csvCard(c)}><Download size={13} /> CSV</button>
          <button className="acc-btn acc-btn-ghost" style={{ fontSize: '.7rem' }} onClick={() => window.print()}><Printer size={13} /> چاپ</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.74rem' }}>
            <thead>
              <tr style={{ textAlign: 'right', borderBottom: '2px solid rgba(148,163,184,.35)' }}>
                <th style={{ padding: '.4rem .5rem' }}>تاریخ</th>
                <th style={{ padding: '.4rem .5rem' }}>سند</th>
                <th style={{ padding: '.4rem .5rem' }}>شرح</th>
                <th style={{ padding: '.4rem .5rem' }}>تفصیلی</th>
                <th style={{ padding: '.4rem .5rem' }}>بدهکار</th>
                <th style={{ padding: '.4rem .5rem' }}>بستانکار</th>
                <th style={{ padding: '.4rem .5rem' }}>مانده</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ background: 'rgba(148,163,184,.08)', fontWeight: 700 }}>
                <td colSpan={6} style={{ padding: '.35rem .5rem' }}>مانده افتتاحیه</td>
                <td style={{ padding: '.35rem .5rem' }}>{formatMoney(c.opening)}</td>
              </tr>
              {c.rows.map((r, i) => (
                <tr key={`${r.entry_id}-${i}`} style={{ borderBottom: '1px solid rgba(148,163,184,.1)' }}>
                  <td style={{ padding: '.35rem .5rem', whiteSpace: 'nowrap' }}>{formatJalali(r.date_g)}</td>
                  <td style={{ padding: '.35rem .5rem' }}>{r.entry_no}</td>
                  <td style={{ padding: '.35rem .5rem' }}>{[r.description, r.line_desc].filter(Boolean).join(' — ') || '—'}</td>
                  <td style={{ padding: '.35rem .5rem', opacity: .7 }}>{r.detail_title || '—'}</td>
                  <td style={{ padding: '.35rem .5rem' }}>{r.debit ? formatMoney(r.debit) : ''}</td>
                  <td style={{ padding: '.35rem .5rem' }}>{r.credit ? formatMoney(r.credit) : ''}</td>
                  <td style={{ padding: '.35rem .5rem', fontWeight: 600 }}>{formatMoney(r.running)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.6rem', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>کارت حساب و دفاتر استاندارد</h2>
          <p style={{ margin: '.2rem 0 0', fontSize: '.78rem', opacity: .65 }}>گردش هر حساب کل/معین/تفصیلی، دفتر معین، دفتر تفصیلی و تراز آزمایشی چندستونی</p>
        </div>
        <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
          {([['card', 'کارت حساب'], ['moyan', 'دفتر معین'], ['tafsil', 'دفتر تفصیلی'], ['tb', 'تراز آزمایشی ۶ ستونی']] as const).map(([k, l]) => (
            <button key={k} className={`acc-btn ${tab === k ? 'acc-btn-primary' : 'acc-btn-outline'}`} style={{ fontSize: '.76rem' }} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
      </div>

      {/* فیلتر مشترک بازه تاریخ */}
      <div className="acc-card" style={{ padding: '.7rem .9rem', marginBottom: '.9rem', display: 'flex', gap: '.8rem', flexWrap: 'wrap', alignItems: 'end' }}>
        <Field label="از تاریخ">
          <input className="acc-input" style={{ maxWidth: 140 }} placeholder="۱۴۰۵/۰۱/۰۱" value={from ? isoToJalaliInput(from) : ''} onChange={(e) => setFrom(e.target.value ? jalaliInputToISO(e.target.value) : '')} />
        </Field>
        <Field label="تا تاریخ">
          <input className="acc-input" style={{ maxWidth: 140 }} placeholder="۱۴۰۵/۰۶/۳۱" value={to ? isoToJalaliInput(to) : ''} onChange={(e) => setTo(e.target.value ? jalaliInputToISO(e.target.value) : '')} />
        </Field>
      </div>

      {loading ? <p style={{ opacity: .6 }}>در حال بارگذاری…</p> : (
        <>
          {tab === 'card' && (
            <div>
              <div className="acc-card" style={{ padding: '.7rem .9rem', marginBottom: '.8rem', display: 'flex', gap: '.8rem', flexWrap: 'wrap', alignItems: 'end' }}>
                <Field label="جستجوی سرفصل">
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', right: 8, top: 9, opacity: .4 }} />
                    <input className="acc-input" style={{ paddingRight: 26, minWidth: 200 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="کد یا نام…" />
                  </div>
                </Field>
                <Field label="سرفصل (کل/معین/تفصیلی)" required>
                  <select className="acc-select" style={{ minWidth: 260 }} value={code} onChange={(e) => setCode(e.target.value)}>
                    <option value="">— انتخاب —</option>
                    {filtered.map((f) => (
                      <option key={f.node.id} value={f.node.code}>{'\u00A0'.repeat(f.depth * 2)}{f.node.code} — {f.node.title} [{LEVELS[f.node.level] || ''}]</option>
                    ))}
                  </select>
                </Field>
                <Field label="تفصیلی شناور (اختیاری)">
                  <select className="acc-select" style={{ minWidth: 160 }} value={detailId} onChange={(e) => setDetailId(e.target.value)}>
                    <option value="">— همه —</option>
                    {details.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                  </select>
                </Field>
                <button className="acc-btn acc-btn-primary" style={{ marginBottom: 2 }} disabled={busy} onClick={runCard}>نمایش گردش</button>
              </div>
              {card ? (card.rows.length || card.opening ? <div className="acc-card" style={{ padding: '.8rem 1rem' }}><CardTable c={card} /></div> : <EmptyState title="گردشی در این بازه یافت نشد" />)
                : <EmptyState title="سرفصل و بازه را انتخاب و «نمایش گردش» را بزنید" />}
            </div>
          )}

          {tab === 'moyan' && (
            <div>
              <div className="acc-card" style={{ padding: '.7rem .9rem', marginBottom: '.8rem', display: 'flex', gap: '.8rem', flexWrap: 'wrap', alignItems: 'end' }}>
                <Field label="سرفصل والد (کل)" required>
                  <select className="acc-select" style={{ minWidth: 260 }} value={moyanCode} onChange={(e) => setMoyanCode(e.target.value)}>
                    <option value="">— انتخاب —</option>
                    {flat.map((f) => <option key={f.node.id} value={f.node.code}>{f.node.code} — {f.node.title}</option>)}
                  </select>
                </Field>
                <button className="acc-btn acc-btn-primary" style={{ marginBottom: 2 }} disabled={busy} onClick={runMoyan}>نمایش دفتر معین</button>
              </div>
              {moyanCards.length > 0 && (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {moyanCards.map((c) => <div key={c.code} className="acc-card" style={{ padding: '.8rem 1rem' }}><CardTable c={c} /></div>)}
                </div>
              )}
            </div>
          )}

          {tab === 'tafsil' && (
            <div>
              <div className="acc-card" style={{ padding: '.7rem .9rem', marginBottom: '.8rem', display: 'flex', gap: '.8rem', flexWrap: 'wrap', alignItems: 'end' }}>
                <Field label="تفصیلی شناور" required>
                  <select className="acc-select" style={{ minWidth: 220 }} value={tafsilDetail} onChange={(e) => setTafsilDetail(e.target.value)}>
                    <option value="">— انتخاب —</option>
                    {details.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                  </select>
                </Field>
                <Field label="محدود به سرفصل (اختیاری)">
                  <select className="acc-select" style={{ minWidth: 220 }} value={code} onChange={(e) => setCode(e.target.value)}>
                    <option value="">— همه سرفصل‌ها —</option>
                    {flat.map((f) => <option key={f.node.id} value={f.node.code}>{f.node.code} — {f.node.title}</option>)}
                  </select>
                </Field>
                <button className="acc-btn acc-btn-primary" style={{ marginBottom: 2 }} disabled={busy} onClick={runTafsil}>نمایش دفتر تفصیلی</button>
              </div>
              {tafsilCard ? (
                tafsilCard.rows.length || tafsilCard.opening
                  ? <div className="acc-card" style={{ padding: '.8rem 1rem' }}><h3 style={{ marginTop: 0, fontSize: '.9rem' }}>دفتر تفصیلی — {tafsilTitle}</h3><CardTable c={tafsilCard} /></div>
                  : <EmptyState title="گردشی برای این تفصیلی ثبت نشده" />
              ) : <EmptyState title="تفصیلی را انتخاب و «نمایش دفتر تفصیلی» را بزنید" hint="تفصیلی شناور را از صفحه کدینگ حسابداری بسازید و روی ردیف سند اعمال کنید" />}
            </div>
          )}

          {tab === 'tb' && (
            <div>
              <div className="acc-card" style={{ padding: '.7rem .9rem', marginBottom: '.8rem', display: 'flex', gap: '.8rem', flexWrap: 'wrap', alignItems: 'end' }}>
                <Field label="سطح تجمیع">
                  <select className="acc-select" value={level} onChange={(e) => setLevel(Number(e.target.value))}>
                    <option value={1}>سطح ۱ — کل</option>
                    <option value={2}>سطح ۲ — معین</option>
                    <option value={3}>سطح ۳ — تفصیلی</option>
                  </select>
                </Field>
                <button className="acc-btn acc-btn-primary" style={{ marginBottom: 2 }} disabled={busy} onClick={runTb}>محاسبه تراز</button>
                <button className="acc-btn acc-btn-ghost" style={{ marginBottom: 2 }} onClick={() => window.print()}><Printer size={13} /> چاپ</button>
              </div>
              {tbRows.length > 0 && (
                <div className="acc-card" style={{ padding: '.8rem 1rem', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.72rem' }}>
                    <thead>
                      <tr style={{ textAlign: 'center', borderBottom: '2px solid rgba(148,163,184,.35)' }}>
                        <th rowSpan={2} style={{ padding: '.4rem', textAlign: 'right' }}>کد</th>
                        <th rowSpan={2} style={{ padding: '.4rem', textAlign: 'right' }}>عنوان</th>
                        <th colSpan={2} style={{ padding: '.4rem', borderBottom: '1px solid rgba(148,163,184,.25)' }}>افتتاحیه</th>
                        <th colSpan={2} style={{ padding: '.4rem', borderBottom: '1px solid rgba(148,163,184,.25)' }}>گردش دوره</th>
                        <th colSpan={2} style={{ padding: '.4rem', borderBottom: '1px solid rgba(148,163,184,.25)' }}>اختتامیه</th>
                      </tr>
                      <tr style={{ textAlign: 'center', borderBottom: '2px solid rgba(148,163,184,.35)' }}>
                        <th style={{ padding: '.3rem' }}>بد</th><th style={{ padding: '.3rem' }}>بس</th>
                        <th style={{ padding: '.3rem' }}>بد</th><th style={{ padding: '.3rem' }}>بس</th>
                        <th style={{ padding: '.3rem' }}>بد</th><th style={{ padding: '.3rem' }}>بس</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tbRows.map((r) => (
                        <tr key={r.code} style={{ borderBottom: '1px solid rgba(148,163,184,.1)', textAlign: 'center' }}>
                          <td style={{ padding: '.3rem', textAlign: 'right', fontFamily: 'monospace' }}>{r.code}</td>
                          <td style={{ padding: '.3rem', textAlign: 'right' }}>{r.title}</td>
                          <td style={{ padding: '.3rem' }}>{r.openingDebit ? formatMoney(r.openingDebit) : '—'}</td>
                          <td style={{ padding: '.3rem' }}>{r.openingCredit ? formatMoney(r.openingCredit) : '—'}</td>
                          <td style={{ padding: '.3rem' }}>{r.periodDebit ? formatMoney(r.periodDebit) : '—'}</td>
                          <td style={{ padding: '.3rem' }}>{r.periodCredit ? formatMoney(r.periodCredit) : '—'}</td>
                          <td style={{ padding: '.3rem', fontWeight: 600 }}>{r.closingDebit ? formatMoney(r.closingDebit) : '—'}</td>
                          <td style={{ padding: '.3rem', fontWeight: 600 }}>{r.closingCredit ? formatMoney(r.closingCredit) : '—'}</td>
                        </tr>
                      ))}
                      <tr style={{ fontWeight: 800, background: 'rgba(148,163,184,.1)', textAlign: 'center' }}>
                        <td colSpan={2} style={{ padding: '.4rem', textAlign: 'right' }}>جمع</td>
                        <td>{formatMoney(tbRows.reduce((s, r) => s + r.openingDebit, 0))}</td>
                        <td>{formatMoney(tbRows.reduce((s, r) => s + r.openingCredit, 0))}</td>
                        <td>{formatMoney(tbRows.reduce((s, r) => s + r.periodDebit, 0))}</td>
                        <td>{formatMoney(tbRows.reduce((s, r) => s + r.periodCredit, 0))}</td>
                        <td>{formatMoney(tbRows.reduce((s, r) => s + r.closingDebit, 0))}</td>
                        <td>{formatMoney(tbRows.reduce((s, r) => s + r.closingCredit, 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
