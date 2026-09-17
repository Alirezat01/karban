/* گزارش‌ها — سود و زیان، ارزش افزوده دوره، معاملات فصلی (ماده ۱۶۹)، تحلیل فروش */

import React, { useEffect, useState } from 'react';
import { BarChart3, Download, FileSpreadsheet, TrendingUp } from 'lucide-react';
import type { AccBusiness, ProductProfitRow, ProfitAndLoss, VatReport } from '@/lib/acc/types';
import { currentSeasonRange, downloadCsv, productProfitability, profitAndLoss, salesByItem, salesByPartner, seasonalReport, vatReport, type SeasonalRow } from '@/lib/acc/api';
import { SEASON_NAMES, currentJalaliMonthRange, formatJalali, jalaliSeasonOf, jalaliYearOf, jalaliYearRange, todayJalali } from '@/lib/acc/jalali';
import { formatMoney, formatMoneyUnit } from '@/lib/acc/money';
import { toFaDigits } from '@/lib/acc/jalali';
import { JalaliDateInput, EmptyState } from './ui';

type Tab = 'pl' | 'vat' | 'seasonal' | 'sales' | 'product';

export default function ReportsPage({ business }: { business: AccBusiness }) {
  const [tab, setTab] = useState<Tab>('pl');
  const jy = todayJalali().jy;
  const yearRange = jalaliYearRange(jy);
  const [from, setFrom] = useState(yearRange.from);
  const [to, setTo] = useState(yearRange.to);
  const [pl, setPl] = useState<ProfitAndLoss | null>(null);
  const [vat, setVat] = useState<VatReport | null>(null);
  const [seasonal, setSeasonal] = useState<{ sales: SeasonalRow[]; purchases: SeasonalRow[] } | null>(null);
  const [byPartner, setByPartner] = useState<{ name: string; count: number; total: number }[]>([]);
  const [byItem, setByItem] = useState<{ title: string; qty: number; total: number }[]>([]);
  const [product, setProduct] = useState<ProductProfitRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const tasks: Promise<void>[] = [];
        if (tab === 'pl') tasks.push(profitAndLoss(business.id, from, to).then(setPl));
        if (tab === 'vat') tasks.push(vatReport(business.id, from, to).then(setVat));
        if (tab === 'seasonal') tasks.push(seasonalReport(business.id, from, to).then(setSeasonal));
        if (tab === 'sales') {
          tasks.push(salesByPartner(business.id, from, to).then(setByPartner));
          tasks.push(salesByItem(business.id, from, to).then(setByItem));
        }
        if (tab === 'product') tasks.push(productProfitability(business.id, from, to).then(setProduct));
        await Promise.all(tasks);
      } finally {
        setLoading(false);
      }
    })();
  }, [business.id, tab, from, to]);

  function exportSeasonalCsv() {
    if (!seasonal) return;
    const headers = ['نوع معامله', 'تاریخ', 'شماره صورتحساب', 'نام طرف‌حساب', 'شخصیت', 'کد/شناسه ملی', 'شماره اقتصادی', 'کد پستی', 'مبلغ کل (ریال)', 'مالیات (ریال)'];
    const faDate = (iso: string) => formatJalali(iso);
    const rows: (string | number)[][] = [
      ...seasonal.sales.map((r) => ['فروش', faDate(r.date), r.number, r.partner, r.personType === 'legal' ? 'حقوقی' : 'حقیقی', r.nationalId, r.economicCode, r.postalCode, r.total, r.vat]),
      ...seasonal.purchases.map((r) => ['خرید', faDate(r.date), r.number, r.partner, r.personType === 'legal' ? 'حقوقی' : 'حقیقی', r.nationalId, r.economicCode, r.postalCode, r.total, r.vat]),
    ];
    const season = jalaliSeasonOf(from);
    downloadCsv(`معاملات-فصلی-${jalaliYearOf(from)}-${SEASON_NAMES[season - 1]}.csv`, headers, rows);
  }

  const quick = [
    { label: 'سال ' + jalaliYearOf(from), run: () => { const r = jalaliYearRange(jalaliYearOf(from)); setFrom(r.from); setTo(r.to); } },
    { label: 'این ماه', run: () => { const r = currentJalaliMonthRange(); setFrom(r.from); setTo(r.to); } },
    { label: 'فصل جاری', run: () => { const r = currentSeasonRange(); setFrom(r.from); setTo(r.to); } },
  ];

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '.35rem', flex: 1, flexWrap: 'wrap' }}>
          {([['pl', 'سود و زیان'], ['vat', 'ارزش افزوده'], ['seasonal', 'معاملات فصلی (۱۶۹)'], ['sales', 'تحلیل فروش'], ['product', 'سود محصولات']] as const).map(([k, label]) => (
            <button key={k} className={`acc-btn ${tab === k ? 'acc-btn-primary' : 'acc-btn-outline'}`} style={{ minHeight: 40, padding: '.35rem .9rem', fontSize: '.8rem' }} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
          <div style={{ width: 150 }}><JalaliDateInput value={from} onChange={setFrom} /></div>
          <span className="acc-hint">تا</span>
          <div style={{ width: 150 }}><JalaliDateInput value={to} onChange={setTo} /></div>
          {quick.map((q) => <button key={q.label} className="acc-btn acc-btn-ghost" onClick={q.run}>{q.label}</button>)}
        </div>
      </div>

      {tab === 'pl' && pl && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div className="acc-grid-2-eq">
            <div className="acc-card">
              <h3>درآمدها</h3>
              {pl.revenues.length === 0 ? <EmptyState title="درآمدی در این بازه ثبت نشده" /> : (
                <div className="acc-table-wrap">
                  <table className="acc-table" style={{ minWidth: 300 }}>
                    <thead><tr><th>سرفصل</th><th>مبلغ (ریال)</th></tr></thead>
                    <tbody>{pl.revenues.map((r) => <tr key={r.code}><td>{r.title}</td><td className="num" style={{ color: '#6fdca0' }}>{formatMoney(r.amount)}</td></tr>)}</tbody>
                    <tfoot><tr><td>جمع درآمد</td><td className="num">{formatMoney(pl.totalRevenue)}</td></tr></tfoot>
                  </table>
                </div>
              )}
            </div>
            <div className="acc-card">
              <h3>هزینه‌ها</h3>
              {pl.expenses.length === 0 ? <EmptyState title="هزینه‌ای در این بازه ثبت نشده" /> : (
                <div className="acc-table-wrap">
                  <table className="acc-table" style={{ minWidth: 300 }}>
                    <thead><tr><th>سرفصل</th><th>مبلغ (ریال)</th></tr></thead>
                    <tbody>{pl.expenses.map((r) => <tr key={r.code}><td>{r.title}</td><td className="num" style={{ color: '#ef9a94' }}>{formatMoney(r.amount)}</td></tr>)}</tbody>
                    <tfoot><tr><td>جمع هزینه</td><td className="num">{formatMoney(pl.totalExpense)}</td></tr></tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
          <div className="acc-card" style={{ textAlign: 'center', padding: '1.6rem' }}>
            <div className="acc-hint">سود (زیان) خالص بازه</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: pl.netProfit >= 0 ? '#6fdca0' : '#ef9a94', marginTop: '.4rem' }}>
              {formatMoneyUnit(pl.netProfit, business.currency)}
            </div>
          </div>
        </div>
      )}

      {tab === 'vat' && vat && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div className="acc-kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="acc-kpi"><div className="k-label">فروش خالص دوره</div><div className="k-value">{formatMoney(vat.salesBase)}</div></div>
            <div className="acc-kpi"><div className="k-label">مالیات فروش</div><div className="k-value">{formatMoney(vat.salesVat)}</div></div>
            <div className="acc-kpi"><div className="k-label">اعتبار خرید و هزینه</div><div className="k-value">{formatMoney(vat.totalCredit)}</div></div>
            <div className="acc-kpi" style={{ borderColor: 'rgba(216,165,63,.5)' }}>
              <div className="k-label" style={{ color: 'var(--gold2)' }}>مالیات قابل پرداخت</div>
              <div className="k-value" style={{ color: 'var(--gold2)' }}>{formatMoney(vat.payable)}</div>
              <div className="k-sub">مبنای اظهارنامه ارزش افزوده دوره</div>
            </div>
          </div>
          <div className="acc-grid-2-eq">
            <div className="acc-card">
              <h3>صورتحساب‌های فروش</h3>
              <div className="acc-table-wrap">
                <table className="acc-table" style={{ minWidth: 380 }}>
                  <thead><tr><th>شماره</th><th>تاریخ</th><th>خریدار</th><th>پایه</th><th>مالیات</th></tr></thead>
                  <tbody>{vat.saleRows.map((r) => <tr key={r.number}><td className="num">{r.number}</td><td className="num">{formatJalali(r.date)}</td><td>{r.partner}</td><td className="num">{formatMoney(r.base)}</td><td className="num">{formatMoney(r.vat)}</td></tr>)}</tbody>
                </table>
                {vat.saleRows.length === 0 && <EmptyState title="فروشی در این بازه نیست" />}
              </div>
            </div>
            <div className="acc-card">
              <h3>صورتحساب‌های خرید</h3>
              <div className="acc-table-wrap">
                <table className="acc-table" style={{ minWidth: 380 }}>
                  <thead><tr><th>شماره</th><th>تاریخ</th><th>تامین‌کننده</th><th>پایه</th><th>مالیات</th></tr></thead>
                  <tbody>{vat.purchaseRows.map((r) => <tr key={r.number}><td className="num">{r.number}</td><td className="num">{formatJalali(r.date)}</td><td>{r.partner}</td><td className="num">{formatMoney(r.base)}</td><td className="num">{formatMoney(r.vat)}</td></tr>)}</tbody>
                </table>
                {vat.purchaseRows.length === 0 && <EmptyState title="خریدی در این بازه نیست" />}
              </div>
            </div>
          </div>
          <p className="acc-hint">مطابق قانون مالیات بر ارزش افزوده، اظهارنامه هر دوره مالیاتی تا ۱۵ روز پس از پایان دوره در سامانه tax.gov.ir ارسال می‌شود. مبلغ قابل پرداخت = مالیات فروش − اعتبار خرید و هزینه‌ها.</p>
        </div>
      )}

      {tab === 'seasonal' && seasonal && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.6rem' }}>
            <p className="acc-hint" style={{ maxWidth: 640 }}>
              طبق ماده ۱۶۹ قانون مالیات‌های مستقیم، فهرست معاملات فصلی باید تا ۴۵ روز پس از پایان هر فصل ارسال شود. این جدول با مشخصات کامل طرف‌حساب‌ها آماده ارسال است.
            </p>
            <button className="acc-btn acc-btn-primary" onClick={exportSeasonalCsv}><Download size={15} /> خروجی Excel/CSV</button>
          </div>
          {(['sales', 'purchases'] as const).map((key) => (
            <div className="acc-card" key={key}>
              <h3><FileSpreadsheet size={16} /> {key === 'sales' ? 'فهرست فروش‌ها' : 'فهرست خریدها'} ({(seasonal[key] || []).length} مورد)</h3>
              <div className="acc-table-wrap">
                <table className="acc-table" style={{ minWidth: 700 }}>
                  <thead><tr><th>تاریخ</th><th>شماره</th><th>طرف‌حساب</th><th>کد/شناسه ملی</th><th>شماره اقتصادی</th><th>کد پستی</th><th>مبلغ کل</th></tr></thead>
                  <tbody>
                    {(seasonal[key] || []).map((r, i) => (
                      <tr key={i}>
                        <td className="num">{formatJalali(r.date)}</td>
                        <td className="num">{r.number}</td>
                        <td>{r.partner}</td>
                        <td className="num">{r.nationalId || '—'}</td>
                        <td className="num">{r.economicCode || '—'}</td>
                        <td className="num">{r.postalCode || '—'}</td>
                        <td className="num">{formatMoney(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(seasonal[key] || []).length === 0 && <EmptyState title="موردی در این بازه نیست" />}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'sales' && (
        <div className="acc-grid-2-eq">
          <div className="acc-card">
            <h3><BarChart3 size={16} /> فروش به تفکیک مشتری</h3>
            <div className="acc-table-wrap">
              <table className="acc-table" style={{ minWidth: 320 }}>
                <thead><tr><th>مشتری</th><th>تعداد فاکتور</th><th>جمع فروش</th></tr></thead>
                <tbody>{byPartner.map((r) => <tr key={r.name}><td style={{ fontWeight: 600 }}>{r.name}</td><td className="num">{toFaDigits(r.count)}</td><td className="num" style={{ color: 'var(--gold2)' }}>{formatMoney(r.total)}</td></tr>)}</tbody>
              </table>
              {byPartner.length === 0 && <EmptyState title="داده‌ای نیست" />}
            </div>
          </div>
          <div className="acc-card">
            <h3><BarChart3 size={16} /> فروش به تفکیک کالا / خدمت</h3>
            <div className="acc-table-wrap">
              <table className="acc-table" style={{ minWidth: 320 }}>
                <thead><tr><th>شرح</th><th>مقدار</th><th>جمع فروش</th></tr></thead>
                <tbody>{byItem.map((r) => <tr key={r.title}><td style={{ fontWeight: 600 }}>{r.title}</td><td className="num">{formatMoney(r.qty)}</td><td className="num" style={{ color: 'var(--gold2)' }}>{formatMoney(r.total)}</td></tr>)}</tbody>
              </table>
              {byItem.length === 0 && <EmptyState title="داده‌ای نیست" />}
            </div>
          </div>
        </div>
      )}

      {tab === 'product' && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <p className="acc-hint" style={{ margin: 0 }}>
            سود هر کالا = فروش (پس از تخفیف) منهای بهای تمام‌شده (قیمت خرید ثبت‌شده در کالا). برای دقت بیشتر، قیمت خرید کالاها را در بخش «کالا و خدمات» به‌روز نگه دارید.
          </p>
          <div className="acc-kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="acc-kpi"><div className="k-label">جمع فروش</div><div className="k-value">{formatMoney(product.reduce((s, r) => s + r.revenue, 0))}</div></div>
            <div className="acc-kpi"><div className="k-label">جمع بهای تمام‌شده</div><div className="k-value">{formatMoney(product.reduce((s, r) => s + r.cost, 0))}</div></div>
            <div className="acc-kpi"><div className="k-label">جمع سود ناخالص</div><div className="k-value" style={{ color: 'var(--gold2)' }}>{formatMoney(product.reduce((s, r) => s + r.profit, 0))}</div></div>
          </div>
          <div className="acc-card">
            <h3><TrendingUp size={16} /> رتبه‌بندی سودآوری کالاها</h3>
            <div className="acc-table-wrap">
              <table className="acc-table" style={{ minWidth: 560 }}>
                <thead><tr><th style={{ width: 40 }}>رتبه</th><th>کالا / خدمت</th><th>مقدار فروش</th><th>فروش (ریال)</th><th>بهای تمام‌شده</th><th>سود (ریال)</th><th>حاشیه سود</th></tr></thead>
                <tbody>
                  {product.map((r, i) => (
                    <tr key={r.key}>
                      <td className="num">{toFaDigits(i + 1)}</td>
                      <td style={{ fontWeight: 600 }}>{r.title}</td>
                      <td className="num">{formatMoney(r.quantity)}</td>
                      <td className="num">{formatMoney(r.revenue)}</td>
                      <td className="num" style={{ color: '#ef9a94' }}>{formatMoney(r.cost)}</td>
                      <td className="num" style={{ color: r.profit >= 0 ? '#6fdca0' : '#ef9a94', fontWeight: 700 }}>{formatMoney(r.profit)}</td>
                      <td className="num"><span className={`acc-badge ${r.margin >= 20 ? 'ok' : r.margin >= 0 ? 'warn' : 'bad'}`}>{toFaDigits(r.margin)}٪</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {product.length === 0 && <EmptyState icon={<TrendingUp size={34} />} title="فروشی در این بازه ثبت نشده" hint="پس از صدور فاکتور فروش، سود محصولات اینجا محاسبه می‌شود" />}
            </div>
          </div>
        </div>
      )}

      {loading && <p style={{ color: 'var(--muted)', fontSize: '.85rem' }}>در حال محاسبه…</p>}
    </div>
  );
}
