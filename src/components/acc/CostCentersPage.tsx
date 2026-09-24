/* مراکز هزینه — Master مستقل + گزارش مرکز هزینه/جاری شرکا از Journal واقعی (بند ۲۲، ۳۱، ۳۲، ۳۳) */

import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Building2, Pencil, Plus, Power, Users } from 'lucide-react';
import type { AccBusiness, AccCostCenter } from '@/lib/acc/types';
import { listCostCenters, saveCostCenter, deactivateCostCenter, costCenterReport, projectReport, shareholderCurrentAccounts, partnersLedger, type CostCenterReportRow, type ShareholderRow, type PartnerLedgerRow } from '@/lib/acc/api10';
import { formatMoney } from '@/lib/acc/money';
import { Field, Modal, confirmAction, toast, EmptyState } from './ui';

type Tab = 'master' | 'report' | 'partners' | 'shareholders';

export default function CostCentersPage({ business }: { business: AccBusiness }) {
  const [tab, setTab] = useState<Tab>('master');
  const [rows, setRows] = useState<AccCostCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ id?: string; name: string; description: string } | null>(null);
  const [ccReport, setCcReport] = useState<CostCenterReportRow[]>([]);
  const [prReport, setPrReport] = useState<CostCenterReportRow[]>([]);
  const [shareholders, setShareholders] = useState<ShareholderRow[]>([]);
  const [ledger, setLedger] = useState<PartnerLedgerRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setRows(await listCostCenters(business.id));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [business.id]);

  const active = useMemo(() => rows.filter((r) => r.active !== false), [rows]);

  async function save() {
    if (!editing?.name?.trim()) { toast('نام مرکز هزینه الزامی است', 'error'); return; }
    try {
      await saveCostCenter(business.id, editing);
      toast('مرکز هزینه ذخیره شد — کد اتمیک تخصیص یافت');
      setEditing(null);
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'خطا', 'error');
    }
  }

  async function toggle(row: AccCostCenter) {
    if (!(await confirmAction(`مرکز هزینه «${row.name}» ${row.active === false ? 'فعال' : 'غیرفعال'} شود؟`))) return;
    try {
      await deactivateCostCenter(business.id, row.id, row.active === false);
      toast('انجام شد');
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'خطا', 'error');
    }
  }

  async function loadReports() {
    setReportLoading(true);
    try {
      const [cc, pr, sh, pl] = await Promise.all([
        costCenterReport(business.id),
        projectReport(business.id).catch(() => []),
        shareholderCurrentAccounts(business.id).catch(() => []),
        partnersLedger(business.id).catch(() => []),
      ]);
      setCcReport(cc);
      setPrReport(pr);
      setShareholders(sh);
      setLedger(pl);
    } finally {
      setReportLoading(false);
    }
  }
  useEffect(() => { if (tab !== 'master') loadReports(); /* eslint-disable-next-line */ }, [tab, business.id]);

  const reportTable = (title: string, data: CostCenterReportRow[]) => (
    <div style={{ display: 'grid', gap: '.7rem' }}>
      <h3 style={{ margin: 0, fontSize: '.95rem' }}>{title}</h3>
      {data.length === 0 ? (
        <EmptyState icon={<BarChart3 size={30} />} title="گردشی ثبت نشده" hint="هزینه‌های دارای مرکز هزینه / پروژه این‌جا گزارش می‌شود" />
      ) : data.map((cc) => (
        <div key={cc.code + cc.name} className="acc-card" style={{ padding: '.8rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.5rem' }}>
            <b style={{ fontSize: '.88rem' }}>{cc.code} — {cc.name}</b>
            <b style={{ color: '#b45309' }}>{formatMoney(cc.total)} ریال</b>
          </div>
          <table className="acc-table">
            <thead><tr><th>حساب</th><th>عنوان</th><th>مبلغ (ریال)</th></tr></thead>
            <tbody>
              {cc.byAccount.map((a) => (
                <tr key={a.account_code}>
                  <td><span className="acc-chip" style={{ fontFamily: 'monospace', fontSize: '.68rem' }}>{a.account_code}</span></td>
                  <td>{a.account_title}</td>
                  <td className="num">{formatMoney(a.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '.35rem', flex: 1, flexWrap: 'wrap' }}>
          {([
            ['master', 'فهرست مراکز'],
            ['report', 'گزارش مرکز هزینه / پروژه'],
            ['partners', 'گزارش طرف‌حساب‌ها'],
            ['shareholders', 'جاری شرکا'],
          ] as const).map(([k, label]) => (
            <button key={k} className={`acc-btn ${tab === k ? 'acc-btn-primary' : 'acc-btn-outline'}`} style={{ minHeight: 40, padding: '.35rem .9rem', fontSize: '.8rem' }} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>
        {tab === 'master' && (
          <button className="acc-btn acc-btn-primary" onClick={() => setEditing({ name: '', description: '' })}><Plus size={15} /> مرکز هزینه جدید</button>
        )}
      </div>

      {tab === 'master' && (
        <div className="acc-table-wrap">
          <table className="acc-table">
            <thead><tr><th>کد</th><th>نام</th><th>توضیح</th><th>وضعیت</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ opacity: r.active === false ? .5 : 1 }}>
                  <td><span className="acc-chip" style={{ fontFamily: 'monospace', fontSize: '.7rem' }}>{r.code}</span></td>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td style={{ fontSize: '.78rem', opacity: .7 }}>{r.description || '—'}</td>
                  <td>{r.active === false
                    ? <span className="acc-chip" style={{ fontSize: '.62rem', background: 'rgba(220,38,38,.1)', color: '#dc2626' }}>غیرفعال</span>
                    : <span className="acc-chip" style={{ fontSize: '.62rem' }}>فعال ({active.length} فعال)</span>}</td>
                  <td>
                    <div className="row-actions">
                      <button className="acc-icon-btn" title="ویرایش" onClick={() => setEditing({ id: r.id, name: r.name, description: r.description || '' })}><Pencil size={14} /></button>
                      <button className="acc-icon-btn" title={r.active === false ? 'فعال‌سازی' : 'غیرفعال‌سازی'} onClick={() => toggle(r)}><Power size={14} style={{ color: r.active === false ? '#15803d' : '#b45309' }} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && rows.length === 0 && (
            <EmptyState icon={<Building2 size={34} />} title="مرکز هزینه‌ای ثبت نشده" hint="مراکز استاندارد (اداری، فروش، بازاریابی، مالی، منابع انسانی) برای کسب‌وکار جدید خودکار ساخته می‌شوند" />
          )}
        </div>
      )}

      {tab === 'report' && (
        reportLoading ? <p style={{ opacity: .6 }}>در حال محاسبه از Journal واقعی…</p> : (
          <div style={{ display: 'grid', gap: '1.2rem' }}>
            {reportTable('گزارش مراکز هزینه (از ردیف‌های سند)', ccReport)}
            {prReport.length > 0 && reportTable('گزارش پروژه‌ها (از ردیف‌های سند)', prReport)}
          </div>
        )
      )}

      {tab === 'partners' && (
        reportLoading ? <p style={{ opacity: .6 }}>در حال محاسبه…</p> : (
          <div className="acc-table-wrap">
            <table className="acc-table">
              <thead>
                <tr><th>کد طرف‌حساب</th><th>کد تفصیلی</th><th>نام</th><th>نقش‌ها</th><th>مانده اول</th><th>بدهکار</th><th>بستانکار</th><th>مانده نهایی</th></tr>
              </thead>
              <tbody>
                {ledger.map((r, i) => (
                  <tr key={`${r.partner.id}-${r.detail_code}-${i}`}>
                    <td><span className="acc-chip" style={{ fontFamily: 'monospace', fontSize: '.68rem' }}>{r.partner.partner_code || '—'}</span></td>
                    <td className="num">{r.detail_code || '—'}</td>
                    <td style={{ fontWeight: 600 }}>{r.detail_title}</td>
                    <td style={{ fontSize: '.7rem' }}>{r.partner.roles.map((role) => ({ customer: 'مشتری', supplier: 'تامین‌کننده', shareholder: 'شریک', employee: 'کارمند', other: 'سایر' }[role])).join('، ')}</td>
                    <td className="num">{formatMoney(Math.abs(r.opening))}{r.opening !== 0 ? (r.opening > 0 ? ' بستانکار' : ' بدهکار') : ''}</td>
                    <td className="num">{formatMoney(r.debit)}</td>
                    <td className="num">{formatMoney(r.credit)}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{formatMoney(Math.abs(r.closing))}{r.closing !== 0 ? (r.closing > 0 ? ' بستانکار' : ' بدهکار') : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!reportLoading && ledger.length === 0 && (
              <EmptyState icon={<Users size={34} />} title="گردشی یافت نشد" hint="طرف‌حساب‌های دارای تفصیلی و گردش سند این‌جا نمایش داده می‌شوند" />
            )}
          </div>
        )
      )}

      {tab === 'shareholders' && (
        reportLoading ? <p style={{ opacity: .6 }}>در حال محاسبه…</p> : (
          <div style={{ display: 'grid', gap: '.7rem' }}>
            {shareholders.length === 0 ? (
              <EmptyState icon={<Users size={34} />} title="شریکی ثبت نشده" hint="به طرف‌حساب نقش «شریک / سهامدار» بدهید تا دفتر جاری او فعال شود" />
            ) : shareholders.map((s) => (
              <div key={s.partner.id} className="acc-card" style={{ padding: '.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '.4rem', marginBottom: '.5rem' }}>
                  <b style={{ fontSize: '.9rem' }}>{s.partner.partner_code ? `${s.partner.partner_code} — ` : ''}{s.partner.name}</b>
                  <b style={{ color: '#7c3aed' }}>مانده جاری: {formatMoney(Math.abs(s.balance))} {s.balance >= 0 ? 'بستانکار' : 'بدهکار'}</b>
                </div>
                <table className="acc-table">
                  <thead><tr><th>واریز شریک</th><th>برداشت</th><th>هزینه پرداخت‌شده توسط شریک</th><th>بازپرداخت شرکت به شریک</th><th>سایر گردش‌ها</th></tr></thead>
                  <tbody>
                    <tr>
                      <td className="num">{formatMoney(s.deposit)}</td>
                      <td className="num">{formatMoney(s.withdraw)}</td>
                      <td className="num">{formatMoney(s.paidForCompany)}</td>
                      <td className="num">{formatMoney(s.repaid)}</td>
                      <td className="num">{formatMoney(Math.abs(s.other))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'ویرایش مرکز هزینه' : 'مرکز هزینه جدید'}>
        {editing && (
          <div style={{ display: 'grid', gap: '.7rem' }}>
            <Field label="نام" required><input className="acc-input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="مثلاً: بازاریابی" /></Field>
            <Field label="توضیح"><input className="acc-input" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            <p style={{ margin: 0, fontSize: '.72rem', opacity: .6 }}>کد CC-### به‌صورت اتمیک تخصیص می‌یابد و پس از غیرفعال‌شدن هرگز تکرار نمی‌شود.</p>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <button className="acc-btn acc-btn-primary" onClick={save}>ذخیره</button>
              <button className="acc-btn acc-btn-outline" onClick={() => setEditing(null)}>انصراف</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
