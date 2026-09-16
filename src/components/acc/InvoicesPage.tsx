/* فهرست صورتحساب‌ها — فروش، پیش‌فاکتور، خرید با عملیات کامل */

import React, { useEffect, useMemo, useState } from 'react';
import { Ban, CheckCircle2, Eye, FileText, Pencil, Plus, Printer, Repeat, Search, Trash2 } from 'lucide-react';
import type { AccBusiness, AccInvoice, InvoiceType } from '@/lib/acc/types';
import { cancelInvoice, deleteDraftInvoice, issueInvoice, listInvoices, nextInvoiceNumber, saveInvoice } from '@/lib/acc/api';
import { INVOICE_STATUSES, INVOICE_TYPES } from '@/lib/acc/constants';
import { formatMoney } from '@/lib/acc/money';
import { formatJalali, toFaDigits } from '@/lib/acc/jalali';
import { featureEnabled } from '@/lib/acc/plan';
import { exportExcel, htmlTable, printHtml, exportWord, exportFilename, brandLogoUrl, type BrandAccess } from '@/lib/acc/export';
import { Badge, EmptyState, confirmAction, toast } from './ui';

const TABS: { key: InvoiceType | 'all'; label: string; pro?: boolean }[] = [
  { key: 'all', label: 'همه' },
  { key: 'sale', label: 'فروش' },
  { key: 'proforma', label: 'پیش‌فاکتور' },
  { key: 'purchase', label: 'خرید', pro: true },
  { key: 'return_sale', label: 'برگشت از فروش', pro: true },
];

export default function InvoicesPage({ business, plan }: { business: AccBusiness; plan?: string }) {
  const [rows, setRows] = useState<AccInvoice[]>([]);
  const [tab, setTab] = useState<InvoiceType | 'all'>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { setRows(await listInvoices(business.id)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [business.id]);

  const filtered = useMemo(
    () => rows.filter((r) => (tab === 'all' || r.type === tab) && ((r.number + ' ' + (r.partner?.name || '')).includes(query))),
    [rows, tab, query],
  );

  async function doIssue(row: AccInvoice) {
    if (!(await confirmAction(`صورتحساب ${row.number} صادر شود؟ پس از صدور، سند حسابداری ثبت و ویرایش آن مسدود می‌شود.`, false))) return;
    try {
      await issueInvoice(row.id);
      toast('صورتحساب صادر و سند حسابداری ثبت شد');
      load();
    } catch {
      toast('صدور ناموفق بود', 'error');
    }
  }

  async function doCancel(row: AccInvoice) {
    if (!(await confirmAction(`صورتحساب ${row.number} ابطال شود؟ قید حسابداری عکس آن ثبت خواهد شد.`))) return;
    try {
      await cancelInvoice(row.id);
      toast('ابطال شد و قید برگشتی ثبت گردید');
      load();
    } catch {
      toast('ابطال ناموفق بود', 'error');
    }
  }

  async function doDelete(row: AccInvoice) {
    if (!(await confirmAction(`پیش‌نویس ${row.number} حذف شود؟`))) return;
    try {
      await deleteDraftInvoice(row.id);
      toast('حذف شد');
      load();
    } catch {
      toast('حذف ناموفق بود', 'error');
    }
  }

  async function convertProforma(row: AccInvoice) {
    if (!(await confirmAction('پیش‌فاکتور به صورتحساب فروش تبدیل شود؟ پیش‌فاکتور حفظ می‌شود.', false))) return;
    try {
      const number = await nextInvoiceNumber(business.id, 'sale');
      const full = await import('@/lib/acc/api').then((m) => m.getInvoice(row.id));
      if (!full?.acc_invoice_items) throw new Error();
      await saveInvoice(business.id, {
        number,
        type: 'sale',
        status: 'draft',
        partner_id: row.partner_id,
        date_g: row.date_g,
        due_date_g: row.due_date_g,
        description: `تبدیل از پیش‌فاکتور ${row.number}`,
        payment_terms: row.payment_terms,
        is_cash_sale: row.is_cash_sale !== false,
        items: full.acc_invoice_items.map((it) => ({
          item_id: it.item_id, title: it.title, unit: it.unit, quantity: Number(it.quantity),
          unit_price: it.unit_price, discount: it.discount, vat_rate: it.vat_rate,
        })),
      });
      toast(`صورتحساب فروش ${number} ساخته شد`);
      window.location.href = '/حسابداری/پنل/فاکتورها';
    } catch {
      toast('تبدیل ناموفق بود', 'error');
    }
  }

  const canExport = featureEnabled(plan, 'export_multiformat');

  function doExport(kind: 'xlsx' | 'doc' | 'print') {
    const headers = ['شماره', 'نوع', 'تاریخ', 'طرف‌حساب', 'جمع کل', 'مالیات', 'تسویه شده', 'وضعیت'];
    const rowsOut = filtered.map((r) => [
      r.number, INVOICE_TYPES[r.type].label, formatJalali(r.date_g),
      r.partner?.name || 'متفرقه', r.total, r.vat_total, r.paid_total,
      INVOICE_STATUSES[r.status].label,
    ]);
    const title = 'صورتحساب‌ها';
    if (kind === 'xlsx') {
      void exportExcel(exportFilename('invoices', undefined, 'xlsx'), [{ name: 'صورتحساب‌ها', headers, rows: rowsOut }], { business: business.brand || business.name, title });
      return;
    }
    const html = `<h2>${title} — ${business.brand || business.name}</h2>${htmlTable(headers, rowsOut)}`;
    if (kind === 'doc') exportWord(exportFilename('invoices', undefined, 'doc'), title, html, brandLogoUrl(business, { status: plan } as BrandAccess));
    else printHtml(title, html, { logoUrl: brandLogoUrl(business, { status: plan } as BrandAccess) });
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap', flex: 1 }}>
          {TABS.filter((t) => !t.pro || featureEnabled(plan, 'invoice_purchase')).map((t) => (
            <button
              key={t.key}
              className={`acc-btn ${tab === t.key ? 'acc-btn-primary' : 'acc-btn-outline'}`}
              style={{ minHeight: 40, padding: '.35rem .9rem', fontSize: '.8rem' }}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', minWidth: 200 }}>
          <Search size={15} style={{ position: 'absolute', top: 13, right: 12, color: 'var(--muted)' }} />
          <input className="acc-input" placeholder="شماره یا مشتری…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ paddingRight: '2.3rem', minHeight: 42 }} />
        </div>
        {canExport && (
          <>
            <button className="acc-btn acc-btn-outline" onClick={() => doExport('xlsx')}>اکسل</button>
            <button className="acc-btn acc-btn-outline" onClick={() => doExport('doc')}>ورد</button>
            <button className="acc-btn acc-btn-outline" onClick={() => doExport('print')}>چاپ</button>
          </>
        )}
        <a className="acc-btn acc-btn-primary" href="/حسابداری/پنل/فاکتور-جدید/فروش"><Plus size={15} /> صورتحساب جدید</a>
      </div>

      <div className="acc-table-wrap">
        <table className="acc-table">
          <thead>
            <tr>
              <th>شماره</th><th>نوع</th><th>تاریخ</th><th>طرف‌حساب</th><th>جمع کل (ریال)</th><th>مالیات</th><th>تسویه</th><th>وضعیت</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className="num" style={{ fontWeight: 700, color: 'var(--gold2)' }}>{toFaDigits(r.number)}</td>
                <td>{INVOICE_TYPES[r.type].short}</td>
                <td className="num">{formatJalali(r.date_g)}</td>
                <td>{r.partner?.name || 'متفرقه'}</td>
                <td className="num">{formatMoney(r.total)}</td>
                <td className="num">{formatMoney(r.vat_total)}</td>
                <td className="num">
                  {r.type === 'sale' && r.status !== 'draft' && r.status !== 'cancelled'
                    ? `${formatMoney(r.paid_total)} از ${formatMoney(r.total)}`
                    : '—'}
                </td>
                <td><Badge tone={INVOICE_STATUSES[r.status].tone}>{INVOICE_STATUSES[r.status].label}</Badge></td>
                <td>
                  <div className="row-actions">
                    {(r.status === 'issued' || r.status === 'partial' || r.status === 'paid' || r.status === 'cancelled') && (
                      <a className="acc-icon-btn" title="چاپ" href={`/حسابداری/پنل/چاپ/${r.id}`}><Printer size={14} /></a>
                    )}
                    {r.status === 'draft' && <button className="acc-icon-btn" title="ویرایش" onClick={() => { window.location.href = `/حسابداری/پنل/فاکتور/${r.id}`; }}><Pencil size={14} /></button>}
                    {r.status === 'draft' && r.type !== 'proforma' && <button className="acc-icon-btn" title="صدور نهایی" onClick={() => doIssue(r)}><CheckCircle2 size={14} /></button>}
                    {r.status === 'draft' && <button className="acc-icon-btn danger" title="حذف پیش‌نویس" onClick={() => doDelete(r)}><Trash2 size={14} /></button>}
                    {(r.status === 'issued' || r.status === 'partial') && <button className="acc-icon-btn danger" title="ابطال" onClick={() => doCancel(r)}><Ban size={14} /></button>}
                    {r.type === 'proforma' && r.status !== 'cancelled' && <button className="acc-icon-btn" title="تبدیل به فاکتور فروش" onClick={() => convertProforma(r)}><Repeat size={14} /></button>}
                    <a className="acc-icon-btn" title="مشاهده" href={r.status === 'draft' || r.type === 'proforma' ? `/حسابداری/پنل/فاکتور/${r.id}` : `/حسابداری/پنل/چاپ/${r.id}`}><Eye size={14} /></a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && (
          <EmptyState icon={<FileText size={34} />} title="صورتحسابی یافت نشد" hint="با دکمه «صورتحساب جدید» اولین فاکتور رسمی خود را صادر کنید" />
        )}
      </div>

      <p className="acc-hint">
        پس از «صدور نهایی»، سند حسابداری دوطرفه در دفتر روزنامه ثبت و ویرایش فاکتور مسدود می‌شود؛ اصلاح فقط با ابطال و صدور فاکتور جدید ممکن است (اصل حسابداری رسمی).
      </p>
    </div>
  );
}
