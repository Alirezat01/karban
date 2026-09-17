/* مشتریان و طرف‌حساب‌ها (مشتری/تامین‌کننده) + صورت‌حساب طرف‌حساب (پیشرفته) */

import React, { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, Pencil, Plus, Printer, Search, Trash2, Users } from 'lucide-react';
import type { AccBusiness, AccPartner, PartnerStatement } from '@/lib/acc/types';
import { deletePartner, listPartners, partnerStatement, savePartner } from '@/lib/acc/api';
import { formatMoney } from '@/lib/acc/money';
import { formatJalali, toFaDigits } from '@/lib/acc/jalali';
import { featureEnabled } from '@/lib/acc/plan';
import { exportExcel, htmlTable, printHtml, exportWord, exportFilename, brandLogoUrl, type BrandAccess } from '@/lib/acc/export';
import { Field, Modal, DigitsInput, confirmAction, toast, EmptyState } from './ui';

const empty: Partial<AccPartner> = { kind: 'customer', person_type: 'real', name: '' };

export default function PartnersPage({ business, plan }: { business: AccBusiness; plan?: string }) {
  const [rows, setRows] = useState<AccPartner[]>([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Partial<AccPartner> | null>(null);
  const [loading, setLoading] = useState(true);
  const [statement, setStatement] = useState<PartnerStatement | null>(null);
  const [statementLoading, setStatementLoading] = useState(false);

  const canStatement = featureEnabled(plan, 'partner_statement');

  async function load() {
    setLoading(true);
    try { setRows(await listPartners(business.id)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [business.id]);

  const filtered = useMemo(
    () => rows.filter((r) => (r.name + (r.phone || '') + (r.national_id || '')).includes(query)),
    [rows, query],
  );

  async function save() {
    if (!editing?.name?.trim()) { toast('نام طرف‌حساب الزامی است', 'error'); return; }
    try {
      await savePartner(business.id, editing);
      toast('ذخیره شد');
      setEditing(null);
      load();
    } catch {
      toast('ذخیره ناموفق بود', 'error');
    }
  }

  async function openStatement(row: AccPartner) {
    setStatementLoading(true);
    try {
      setStatement(await partnerStatement(business.id, row.id));
    } catch {
      toast('دریافت صورت‌حساب ناموفق بود', 'error');
    } finally {
      setStatementLoading(false);
    }
  }

  function exportStatement(kind: 'xlsx' | 'doc' | 'print') {
    if (!statement) return;
    const headers = ['تاریخ', 'شرح', 'بدهکار (ریال)', 'بستانکار (ریال)'];
    const rowsOut: (string | number)[][] = [];
    for (const i of statement.invoices) {
      const isPurchase = i.type === 'purchase';
      rowsOut.push([
        formatJalali(i.date_g),
        `${i.type === 'purchase' ? 'صورتحساب خرید' : 'صورتحساب فروش'} ${i.number}`,
        isPurchase ? i.total : 0,
        isPurchase ? 0 : i.total,
      ]);
    }
    for (const t of statement.transactions) {
      rowsOut.push([formatJalali(t.date_g), t.kind === 'receipt' ? 'دریافت' : 'پرداخت', t.kind === 'payment' ? t.amount : 0, t.kind === 'receipt' ? t.amount : 0]);
    }
    rowsOut.push(['—', 'مانده نهایی', statement.balance < 0 ? -statement.balance : 0, statement.balance > 0 ? statement.balance : 0]);
    const title = `صورت‌حساب ${statement.partner.name}`;
    if (kind === 'xlsx') {
      void exportExcel(exportFilename('statement', undefined, 'xlsx'), [{ name: 'صورت‌حساب', headers, rows: rowsOut }], { business: business.brand || business.name, title });
      return;
    }
    const html = `<h2>${title} — ${business.brand || business.name}</h2>${htmlTable(headers, rowsOut)}`;
    if (kind === 'doc') exportWord(exportFilename('statement', undefined, 'doc'), title, html, brandLogoUrl(business, { status: plan } as BrandAccess));
    else printHtml(title, html, { logoUrl: brandLogoUrl(business, { status: plan } as BrandAccess) });
  }

  async function remove(row: AccPartner) {
    if (!(await confirmAction(`«${row.name}» حذف شود؟ این عمل قابل بازگشت نیست.`))) return;
    try {
      await deletePartner(row.id);
      toast('حذف شد');
      load();
    } catch {
      toast('حذف ناموفق (احتمالاً در اسناد استفاده شده است)', 'error');
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={15} style={{ position: 'absolute', top: 14, right: 12, color: 'var(--muted)' }} />
          <input className="acc-input" placeholder="جست‌وجوی نام، تلفن یا کد ملی…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ paddingRight: '2.3rem' }} />
        </div>
        <button className="acc-btn acc-btn-primary" onClick={() => setEditing({ ...empty })}><Plus size={15} /> طرف‌حساب جدید</button>
      </div>

      <div className="acc-table-wrap">
        <table className="acc-table">
          <thead>
            <tr>
              <th>نام</th><th>نوع</th><th>شخصیت</th><th>کد/شناسه ملی</th><th>شماره اقتصادی</th><th>تلفن</th><th>کد پستی</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.name}</td>
                <td>{r.kind === 'customer' ? 'مشتری' : r.kind === 'supplier' ? 'تامین‌کننده' : 'دوطرفه'}</td>
                <td>{r.person_type === 'legal' ? 'حقوقی' : 'حقیقی'}</td>
                <td className="num">{r.person_type === 'legal' ? r.shenase_melli || '—' : r.national_id || '—'}</td>
                <td className="num">{r.economic_code || '—'}</td>
                <td className="num">{r.phone || '—'}</td>
                <td className="num">{r.postal_code || '—'}</td>
                <td>
                  <div className="row-actions">
                    {canStatement && (
                      <button className="acc-icon-btn" title="صورت‌حساب و گردش" onClick={() => openStatement(r)}><FileSpreadsheet size={14} /></button>
                    )}
                    <button className="acc-icon-btn" title="ویرایش" onClick={() => setEditing(r)}><Pencil size={14} /></button>
                    <button className="acc-icon-btn danger" title="حذف" onClick={() => remove(r)}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && (
          <EmptyState icon={<Users size={34} />} title="طرف‌حسابی ثبت نشده" hint="مشتریان و تامین‌کنندگان را برای صدور فاکتور رسمی ثبت کنید" />
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'ویرایش طرف‌حساب' : 'طرف‌حساب جدید'}>
        {editing && (
          <div style={{ display: 'grid', gap: '.8rem' }}>
            <div className="acc-form-grid">
              <Field label="نام *">
                <input className="acc-input" value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </Field>
              <Field label="نوع">
                <select className="acc-select" value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value as AccPartner['kind'] })}>
                  <option value="customer">مشتری</option>
                  <option value="supplier">تامین‌کننده</option>
                  <option value="both">دوطرفه</option>
                </select>
              </Field>
            </div>
            <div className="acc-form-grid">
              <Field label="شخصیت">
                <select className="acc-select" value={editing.person_type} onChange={(e) => setEditing({ ...editing, person_type: e.target.value as AccPartner['person_type'] })}>
                  <option value="real">حقیقی</option>
                  <option value="legal">حقوقی (شرکت)</option>
                </select>
              </Field>
              <Field label={editing.person_type === 'legal' ? 'شناسه ملی' : 'کد ملی'} hint="در فهرست معاملات فصلی ماده ۱۶۹ لازم است">
                <DigitsInput value={editing.person_type === 'legal' ? (editing.shenase_melli || '') : (editing.national_id || '')} onChange={(v) => setEditing(editing.person_type === 'legal' ? { ...editing, shenase_melli: v } : { ...editing, national_id: v })} maxLength={12} />
              </Field>
            </div>
            <div className="acc-form-grid">
              <Field label="شماره اقتصادی طرف‌حساب"><DigitsInput value={editing.economic_code || ''} onChange={(v) => setEditing({ ...editing, economic_code: v })} maxLength={14} /></Field>
              <Field label="شماره ثبت (حقوقی)"><DigitsInput value={editing.registration_number || ''} onChange={(v) => setEditing({ ...editing, registration_number: v })} allow="-/" /></Field>
            </div>
            <div className="acc-form-grid-3">
              <Field label="استان"><input className="acc-input" value={editing.province || ''} onChange={(e) => setEditing({ ...editing, province: e.target.value })} /></Field>
              <Field label="شهرستان"><input className="acc-input" value={editing.county || ''} onChange={(e) => setEditing({ ...editing, county: e.target.value })} /></Field>
              <Field label="شهر"><input className="acc-input" value={editing.city || ''} onChange={(e) => setEditing({ ...editing, city: e.target.value })} /></Field>
            </div>
            <div className="acc-form-grid">
              <Field label="کد پستی"><DigitsInput value={editing.postal_code || ''} onChange={(v) => setEditing({ ...editing, postal_code: v })} maxLength={10} /></Field>
              <Field label="تلفن"><DigitsInput value={editing.phone || ''} onChange={(v) => setEditing({ ...editing, phone: v })} maxLength={14} /></Field>
            </div>
            <div className="acc-form-grid">
              <Field label="نمابر"><DigitsInput value={editing.fax || ''} onChange={(v) => setEditing({ ...editing, fax: v })} maxLength={14} /></Field>
              <Field label="آدرس"><input className="acc-input" value={editing.address || ''} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></Field>
            </div>
            <div style={{ display: 'flex', gap: '.6rem' }}>
              <button className="acc-btn acc-btn-primary" onClick={save}>ذخیره</button>
              <button className="acc-btn acc-btn-outline" onClick={() => setEditing(null)}>انصراف</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!statement || statementLoading} onClose={() => setStatement(null)} title={statement ? `صورت‌حساب ${statement.partner.name}` : 'در حال دریافت…'} wide>
        {statement && (
          <div style={{ display: 'grid', gap: '.9rem' }}>
            <div className="acc-kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <div className="acc-kpi"><div className="k-label">جمع صورتحساب‌ها</div><div className="k-value">{formatMoney(statement.totalInvoiced)}</div></div>
              <div className="acc-kpi"><div className="k-label">جمع تسویه</div><div className="k-value">{formatMoney(statement.totalSettled)}</div></div>
              <div className="acc-kpi"><div className="k-label">مانده</div><div className="k-value" style={{ color: statement.balance > 0 ? 'var(--gold2)' : 'var(--muted)' }}>{formatMoney(Math.abs(statement.balance))}</div><div className="k-sub">{statement.balance > 0 ? 'بدهکار به ما (باقی‌مانده)' : statement.balance < 0 ? 'بستانکار (پیش‌پرداخت)' : 'تسویه کامل'}</div></div>
            </div>
            <div>
              <b style={{ fontSize: '.8rem' }}>تحلیل سررسید مطالبات:</b>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem', marginTop: '.4rem' }}>
                {statement.agingBuckets.map((b) => (
                  <span key={b.label} style={{ fontSize: '.72rem', border: b.amount > 0 ? '1px solid rgba(216,165,63,.4)' : '1px solid var(--line)', borderRadius: 999, padding: '.25rem .7rem', color: b.amount > 0 ? 'var(--gold2)' : 'var(--muted)' }}>
                    {b.label}: {formatMoney(b.amount)} ریال
                  </span>
                ))}
              </div>
            </div>
            <div className="acc-table-wrap" style={{ maxHeight: 320 }}>
              <table className="acc-table">
                <thead><tr><th>تاریخ</th><th>شرح</th><th>بدهکار (ریال)</th><th>بستانکار (ریال)</th></tr></thead>
                <tbody>
                  {statement.invoices.map((i) => {
                    const isPurchase = i.type === 'purchase';
                    return (
                      <tr key={i.id}>
                        <td className="num">{formatJalali(i.date_g)}</td>
                        <td>{isPurchase ? 'خرید' : 'فروش'} {toFaDigits(i.number)}</td>
                        <td className="num">{isPurchase ? formatMoney(i.total) : '—'}</td>
                        <td className="num">{!isPurchase ? formatMoney(i.total) : '—'}</td>
                      </tr>
                    );
                  })}
                  {statement.transactions.map((t) => (
                    <tr key={t.id}>
                      <td className="num">{formatJalali(t.date_g)}</td>
                      <td>{t.kind === 'receipt' ? 'دریافت' : 'پرداخت'} {t.method === 'cheque' ? '(چک)' : ''}</td>
                      <td className="num">{t.kind === 'payment' ? formatMoney(t.amount) : '—'}</td>
                      <td className="num">{t.kind === 'receipt' ? formatMoney(t.amount) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
              <button className="acc-btn acc-btn-outline" onClick={() => exportStatement('xlsx')}><Printer size={14} /> اکسل</button>
              <button className="acc-btn acc-btn-outline" onClick={() => exportStatement('doc')}>ورد</button>
              <button className="acc-btn acc-btn-primary" onClick={() => exportStatement('print')}>چاپ PDF</button>
            </div>
          </div>
        )}
        {statementLoading && <p style={{ color: 'var(--muted)' }}>در حال محاسبه گردش حساب…</p>}
      </Modal>
    </div>
  );
}
