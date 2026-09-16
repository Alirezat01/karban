/* داشبورد حسابداری — KPI، نمودار فروش، آخرین اسناد */

import React, { useEffect, useState } from 'react';
import {
  ArrowDownLeft, ArrowUpRight, BarChart3, FileText, Plus, Receipt, TrendingUp,
} from 'lucide-react';
import type { AccBusiness, AccInvoice } from '@/lib/acc/types';
import { formatMoney, formatMoneyUnit } from '@/lib/acc/money';
import { formatJalali, currentJalaliMonthRange } from '@/lib/acc/jalali';
import { INVOICE_STATUSES, INVOICE_TYPES } from '@/lib/acc/constants';
import { listInvoices, listTransactions, salesSeries6Months, vatReport } from '@/lib/acc/api';
import { Badge, EmptyState } from './ui';

function SalesChart({ data }: { data: { label: string; total: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  const W = 640;
  const H = 210;
  const pad = 34;
  const bw = (W - pad * 2) / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} aria-label="نمودار فروش ۶ ماه اخیر">
      <defs>
        <linearGradient id="accBarGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8c476" />
          <stop offset="100%" stopColor="#c9962e" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={pad} x2={W - pad} y1={H - 30 - f * (H - 62)} y2={H - 30 - f * (H - 62)} stroke="rgba(31,42,68,.7)" strokeDasharray="3 5" />
      ))}
      {data.map((d, i) => {
        const h = (d.total / max) * (H - 62);
        const x = pad + i * bw + bw * 0.22;
        const y = H - 30 - h;
        return (
          <g key={d.label + i}>
            <title>{`${d.label}: ${formatMoney(d.total)} ریال`}</title>
            <rect className="acc-chart-bar" x={x} y={h > 0 ? y : H - 31} width={bw * 0.56} height={Math.max(h, 2)} rx={7} opacity={d.total ? 1 : 0.25} />
            <text className="acc-chart-label" x={x + bw * 0.28} y={H - 12} textAnchor="middle">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="acc-kpi">
      <div className="k-label">{icon}{label}</div>
      <div className="k-value">{value}</div>
      {sub ? <div className="k-sub">{sub}</div> : null}
    </div>
  );
}

export default function Dashboard({ business }: { business: AccBusiness }) {
  const [series, setSeries] = useState<{ label: string; total: number }[]>([]);
  const [recent, setRecent] = useState<AccInvoice[]>([]);
  const [receivable, setReceivable] = useState(0);
  const [monthReceipts, setMonthReceipts] = useState(0);
  const [monthVat, setMonthVat] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, invs] = await Promise.all([
          salesSeries6Months(business.id),
          listInvoices(business.id, { type: 'sale' }),
        ]);
        setSeries(s);
        setRecent(invs.slice(0, 6));
        setReceivable(
          invs
            .filter((i) => i.status === 'issued' || i.status === 'partial')
            .reduce((sum, i) => sum + (i.total - i.paid_total), 0),
        );
        const range = currentJalaliMonthRange();
        const [txs, vat] = await Promise.all([
          listTransactions(business.id, { kind: 'receipt', from: range.from, to: range.to }),
          vatReport(business.id, range.from, range.to),
        ]);
        setMonthReceipts(txs.reduce((sum, t) => sum + t.amount, 0));
        setMonthVat(vat.payable);
      } finally {
        setLoading(false);
      }
    })();
  }, [business.id]);

  const monthSales = series.length ? series[series.length - 1].total : 0;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div className="acc-kpi-grid">
        <Kpi icon={<TrendingUp size={15} />} label="فروش این ماه" value={formatMoneyUnit(monthSales, business.currency)} sub={`تا ${formatJalali(new Date(), 'short-month')}`} />
        <Kpi icon={<ArrowDownLeft size={15} />} label="دریافتی این ماه" value={formatMoneyUnit(monthReceipts, business.currency)} />
        <Kpi icon={<FileText size={15} />} label="مطالبات از مشتریان" value={formatMoneyUnit(receivable, business.currency)} sub="جمع مانده فاکتورهای تسویه‌نشده" />
        <Kpi icon={<Receipt size={15} />} label="مالیات ارزش افزوده قابل پرداخت (این ماه)" value={formatMoneyUnit(monthVat, business.currency)} sub="فروش منهای اعتبار خرید و هزینه" />
      </div>

      <div className="acc-grid-2">
        <div className="acc-card">
          <h3><BarChart3 size={16} /> فروش ۶ ماه اخیر</h3>
          {loading ? <p style={{ color: 'var(--muted)', fontSize: '.85rem' }}>در حال محاسبه…</p> : <SalesChart data={series} />}
        </div>

        <div className="acc-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3><FileText size={16} /> آخرین صورتحساب‌ها</h3>
          {recent.length === 0 && !loading ? (
            <EmptyState title="هنوز صورتحسابی صادر نکرده‌اید" hint="اولین فاکتور رسمی خود را صادر کنید" />
          ) : (
            <div style={{ display: 'grid', gap: '.5rem', alignContent: 'start', flex: 1 }}>
              {recent.map((i) => (
                <a
                  key={i.id}
                  href={i.type === 'proforma' || i.status === 'draft' ? `/حسابداری/پنل/فاکتور/${i.id}` : `/حسابداری/پنل/چاپ/${i.id}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '.6rem', padding: '.55rem .7rem', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--bg2)' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '.82rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {INVOICE_TYPES[i.type].short} {i.number} — {i.partner?.name || 'متفرقه'}
                    </div>
                    <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginTop: 2 }}>{formatJalali(i.date_g)}</div>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div className="num" style={{ fontSize: '.78rem', color: 'var(--gold2)' }}>{formatMoney(i.total)}</div>
                    <Badge tone={INVOICE_STATUSES[i.status].tone}>{INVOICE_STATUSES[i.status].label}</Badge>
                  </div>
                </a>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <a className="acc-btn acc-btn-primary" href="/حسابداری/پنل/فاکتور-جدید/فروش"><Plus size={15} /> صدور صورتحساب فروش</a>
            <a className="acc-btn acc-btn-outline" href="/حسابداری/پنل/فاکتور-جدید/خرید">ثبت خرید</a>
            <a className="acc-btn acc-btn-outline" href="/حسابداری/پنل/گزارش‌ها"><ArrowUpRight size={14} /> گزارش‌ها</a>
          </div>
        </div>
      </div>
    </div>
  );
}
