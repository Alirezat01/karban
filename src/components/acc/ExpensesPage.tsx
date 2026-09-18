/* هزینه‌های روزانه — ثبت، پیوست سند، اعتبارسنجی مالیاتی و خروجی
   نسخه ۳: هزینه واقعی یعنی هزینه مستند — بر اساس مواد ۱۴۷/۱۴۸/۱۶۹ ق.م.م */

import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck, CalendarDays, FileSpreadsheet, FileText, Image as ImageIcon,
  Link2, Loader2, Pencil, Plus, Receipt, Search, Settings2, Trash2, Upload, X,
} from 'lucide-react';
import type { AccBusiness, AccExpense, AccExpenseCategory, ExpenseTaxStatus } from '@/lib/acc/types';
import { listProjects } from '@/lib/acc/api6';
import {
  computeExpenseTax, deleteExpense, deleteExpenseCategory, ensureExpenseCategories,
  listAccounts, listExpenses, saveExpense, saveExpenseCategory,
  TAX_STATUS_LABEL, uploadAccMedia,
} from '@/lib/acc/api';
import { EXPENSE_CATEGORIES } from '@/lib/acc/constants';
import { formatMoney } from '@/lib/acc/money';
import { formatJalali, jalaliMonthLength, toGregorian, todayJalali, dateToISO, toFaDigits, JALALI_MONTHS } from '@/lib/acc/jalali';
import { Field, JalaliDateInput, Modal, MoneyInput, DigitsInput, confirmAction, toast, EmptyState } from './ui';
import { voidExpense, deleteExpenseFull } from '@/lib/acc/api7';
import { VoidDeleteBtns } from './VoidDeleteBtns';
import AttachButton from './AttachButton';
import { exportExcel, exportFilename, exportWord, htmlTable, printHtml, brandLogoUrl } from '@/lib/acc/export';
import { featureEnabled } from '@/lib/acc/plan';
import { Lock } from 'lucide-react';

interface AccountLite { id: string; name: string; kind: string; balance?: number }

interface CategoryLite { id: string; title: string; code?: string | null }

const TAX_BADGE: Record<ExpenseTaxStatus, { tone: string; icon: React.ReactNode }> = {
  valid: { tone: 'ok', icon: <BadgeCheck size={12} /> },
  incomplete: { tone: 'warn', icon: <CalendarDays size={12} /> },
  invalid: { tone: 'bad', icon: <X size={12} /> },
};

/* گزینه‌های ماه شمسی برای فیلتر (جدید → قدیم؛ months[0] = ماه جاری) */
function monthOptions(): { label: string; from: string; to: string }[] {
  const t = todayJalali();
  const out: { label: string; from: string; to: string }[] = [];
  for (const y of [t.jy - 1, t.jy]) {
    const maxMonth = y === t.jy ? t.jm : 12;
    for (let m = 1; m <= maxMonth; m++) {
      const gF = toGregorian(y, m, 1);
      const gT = toGregorian(y, m, jalaliMonthLength(y, m));
      out.push({
        label: `${JALALI_MONTHS[m - 1]} ${toFaDigits(String(y))}`,
        from: dateToISO(new Date(gF.gy, gF.gm - 1, gF.gd)),
        to: dateToISO(new Date(gT.gy, gT.gm - 1, gT.gd)),
      });
    }
  }
  return out.reverse();
}

export default function ExpensesPage({ business, access }: {
  business: AccBusiness;
  access: { status: string; plan: string };
}) {
  const [rows, setRows] = useState<AccExpense[]>([]);
  const [accounts, setAccounts] = useState<AccountLite[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<CategoryLite[]>([]);
  const [catManager, setCatManager] = useState(false);
  const [catEditing, setCatEditing] = useState<Partial<AccExpenseCategory> | null>(null);
  const [query, setQuery] = useState('');
  const [taxFilter, setTaxFilter] = useState<'all' | ExpenseTaxStatus>('all');
  const [monthIdx, setMonthIdx] = useState(-1);
  const [editing, setEditing] = useState<Partial<AccExpense> | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const months = useMemo(() => monthOptions(), []);

  /* تفکیک پلن: ثبت هزینه پایه برای همه؛ سند مالیاتی و خروجی‌ها پیشرفته */
  const canTax = featureEnabled(access?.plan, 'expense_tax_validation');
  const canExport = featureEnabled(access?.plan, 'export_multiformat');

  async function load() {
    setLoading(true);
    try {
      const [e, a] = await Promise.all([listExpenses(business.id), listAccounts(business.id)]);
      setRows(e);
      setAccounts(a);
      listProjects(business.id).then((p) => setProjects(p.map((x) => ({ id: x.id, name: x.name })))).catch(() => setProjects([]));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [business.id]);

  /* دسته‌بندی‌ها از دیتابیس (seed خودکار ۲۲ دسته پیش‌فرض) — خطا = لیست ثابت */
  useEffect(() => {
    (async () => {
      try {
        const cats = await ensureExpenseCategories(business.id);
        setCategories(cats.map((c) => ({ id: c.id, title: c.title, code: c.code })));
      } catch {
        setCategories(EXPENSE_CATEGORIES.map((t, i) => ({ id: `c${i}`, title: t })));
      }
    })();
  }, [business.id]);

  async function saveCategory() {
    if (!catEditing?.title?.trim()) { toast('عنوان دسته را وارد کنید', 'error'); return; }
    try {
      await saveExpenseCategory(business.id, catEditing);
      const cats = await ensureExpenseCategories(business.id);
      setCategories(cats.map((c) => ({ id: c.id, title: c.title, code: c.code })));
      setCatEditing(null);
      toast('دسته‌بندی ذخیره شد');
    } catch {
      toast('ذخیره دسته ناموفق بود — عنوان تکراری است؟', 'error');
    }
  }

  async function removeCategory(row: AccExpenseCategory) {
    if (!(await confirmAction(`دسته «${row.title}» حذف شود؟ هزینه‌های ثبت‌شده با این دسته حفظ می‌شوند.`))) return;
    try {
      await deleteExpenseCategory(row.id);
      const cats = await ensureExpenseCategories(business.id);
      setCategories(cats.map((c) => ({ id: c.id, title: c.title, code: c.code })));
      toast('دسته حذف شد');
    } catch {
      toast('حذف ناموفق بود', 'error');
    }
  }

  const filtered = useMemo(() => {
    const month = monthIdx >= 0 ? months[monthIdx] : null;
    return rows.filter((r) => {
      if (taxFilter !== 'all' && (r.tax_status || 'incomplete') !== taxFilter) return false;
      if (month && (r.date_g < month.from || r.date_g > month.to)) return false;
      if (query && !(r.title + r.category + (r.vendor_name || '') + (r.receipt_no || '')).includes(query)) return false;
      return true;
    });
  }, [rows, query, taxFilter, monthIdx, months]);

  /* ───────────── خلاصه‌ها ───────────── */
  const summary = useMemo(() => {
    const t = todayJalali();
    const gToday = toGregorian(t.jy, t.jm, t.jd);
    const todayIso = dateToISO(new Date(gToday.gy, gToday.gm - 1, gToday.gd));
    const month = monthIdx >= 0 ? months[monthIdx] : months[0];
    const inMonth = rows.filter((r) => r.date_g >= month.from && r.date_g <= month.to);
    const validIn = (list: AccExpense[]) => list.filter((r) => r.tax_status === 'valid');
    return {
      todayTotal: rows.filter((r) => r.date_g === todayIso).reduce((s, r) => s + r.amount, 0),
      todayIso,
      monthTotal: inMonth.reduce((s, r) => s + r.amount, 0),
      monthValid: validIn(inMonth).reduce((s, r) => s + r.amount, 0),
      monthVatCredit: validIn(inMonth).reduce((s, r) => s + r.vat_amount, 0),
      monthLabel: month.label,
    };
  }, [rows, months, monthIdx]);

  /* ───────────── اعتبارسنجی زنده فرم ───────────── */
  const liveTax = editing ? computeExpenseTax(editing) : null;

  async function uploadReceipt(file: File) {
    setUploading(true);
    try {
      const url = await uploadAccMedia(business.id, file, 'expense');
      setEditing((prev) => (prev ? { ...prev, receipt_url: url } : prev));
      toast('سند پیوست شد');
    } catch {
      toast('آپلود سند ناموفق بود', 'error');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!editing?.title?.trim()) { toast('عنوان هزینه الزامی است', 'error'); return; }
    const tax = computeExpenseTax(editing);
    try {
      await saveExpense(business.id, { ...editing, tax_status: tax.status });
      toast(tax.status === 'valid' ? 'هزینه ثبت شد — از نظر مالیاتی قابل قبول' : 'هزینه ثبت شد — برای اعتبار مالیاتی سند را کامل کنید');
      setEditing(null);
      load();
    } catch {
      toast('ثبت ناموفق بود', 'error');
    }
  }

  async function remove(row: AccExpense) {
    if (!(await confirmAction(`هزینه «${row.title}» حذف شود؟ سند حسابداری آن نیز حذف می‌شود.`))) return;
    try {
      await deleteExpense(row.id);
      toast('حذف شد');
      load();
    } catch {
      toast('حذف ناموفق بود', 'error');
    }
  }

  /* ───────────── خروجی‌ها ───────────── */
  const exportTitle = 'گزارش هزینه‌های روزانه';
  const logoUrl = brandLogoUrl(business, access);

  const exportRows = (): (string | number)[][] => filtered.map((r, i) => [
    i + 1,
    formatJalali(r.date_g),
    r.title,
    r.category,
    r.vendor_name || '—',
    r.receipt_no || '—',
    r.amount,
    r.vat_amount,
    TAX_STATUS_LABEL[r.tax_status || 'incomplete'],
    r.is_paid ? (r.account?.name || 'نسیه') : 'تعهدی',
  ]);
  const exportHeaders = ['#', 'تاریخ', 'عنوان', 'دسته', 'فروشنده', 'شماره سند', 'مبلغ (ریال)', 'ارزش افزوده', 'اعتبار مالیاتی', 'پرداخت'];
  const totalRow = ['جمع', '', '', '', '', '', filtered.reduce((s, r) => s + r.amount, 0), filtered.reduce((s, r) => s + r.vat_amount, 0), '', ''];

  function summaryBoxes(): string {
    return `<div class="summary">
      <div class="box">جمع هزینه‌ها: <b>${formatMoney(filtered.reduce((s, r) => s + r.amount, 0))} ریال</b></div>
      <div class="box">قابل قبول مالیاتی: <b>${formatMoney(filtered.filter((r) => r.tax_status === 'valid').reduce((s, r) => s + r.amount, 0))} ریال</b></div>
      <div class="box">اعتبار ارزش افزوده: <b>${formatMoney(filtered.filter((r) => r.tax_status === 'valid').reduce((s, r) => s + r.vat_amount, 0))} ریال</b></div>
    </div>`;
  }

  async function doExcel() {
    await exportExcel(exportFilename('expenses', business.name), [{ name: 'هزینه‌ها', headers: exportHeaders, rows: exportRows(), footerRows: [totalRow] }], { business: business.name, title: exportTitle });
  }
  function doWord() {
    exportWord(exportFilename('expenses', business.name, 'doc'), exportTitle, summaryBoxes() + htmlTable(exportHeaders, exportRows(), totalRow), logoUrl);
  }
  function doPdf() {
    printHtml(exportTitle, summaryBoxes() + htmlTable(exportHeaders, exportRows(), totalRow), { logoUrl });
  }

  const isImage = (url: string) => /\.(png|jpe?g|webp|gif|bmp|heic)$/i.test(url);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* خلاصه روزانه/ماهانه */}
      <div className="acc-summary-grid">
        <div className="acc-summary-card">
          <span>هزینه امروز ({formatJalali(summary.todayIso)})</span>
          <strong>{formatMoney(summary.todayTotal)} <small>ریال</small></strong>
        </div>
        <div className="acc-summary-card">
          <span>هزینه {summary.monthLabel}</span>
          <strong>{formatMoney(summary.monthTotal)} <small>ریال</small></strong>
        </div>
        <div className="acc-summary-card good">
          <span>قابل قبول مالیاتی ({summary.monthLabel})</span>
          <strong>{formatMoney(summary.monthValid)} <small>ریال</small></strong>
        </div>
        <div className="acc-summary-card good">
          <span>اعتبار ارزش افزوده</span>
          <strong>{formatMoney(summary.monthVatCredit)} <small>ریال</small></strong>
        </div>
      </div>

      {/* نوار ابزار */}
      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ position: 'absolute', top: 14, right: 12, color: 'var(--muted)' }} />
          <input className="acc-input" placeholder="جست‌وجو در عنوان، فروشنده، شماره سند…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ paddingRight: '2.3rem' }} />
        </div>
        <select className="acc-select" style={{ minWidth: 150 }} value={monthIdx} onChange={(e) => setMonthIdx(Number(e.target.value))}>
          <option value={-1}>همه ماه‌ها</option>
          {months.map((m, i) => <option key={m.label} value={i}>{m.label}</option>)}
        </select>
        <button className="acc-btn acc-btn-primary" onClick={() => setEditing({ category: 'اداری و عمومی', is_paid: true, date_g: summary.todayIso, tax_status: 'incomplete' })}><Plus size={15} /> ثبت هزینه امروز</button>
        <button className="acc-btn acc-btn-outline" onClick={() => setCatManager(true)}><Settings2 size={15} /> دسته‌ها</button>
      </div>

      <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {(['all', 'valid', 'incomplete', 'invalid'] as const).map((k) => (
          <button
            key={k}
            className={`acc-chip${taxFilter === k ? ' active' : ''}`}
            onClick={() => setTaxFilter(k)}
          >
            {k === 'all' ? 'همه' : TAX_STATUS_LABEL[k]}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {canExport ? (
          <div style={{ display: 'flex', gap: '.4rem' }}>
            <button className="acc-btn acc-btn-outline" onClick={doExcel} title="خروجی اکسل"><FileSpreadsheet size={15} /> اکسل</button>
            <button className="acc-btn acc-btn-outline" onClick={doWord} title="خروجی ورد"><FileText size={15} /> ورد</button>
            <button className="acc-btn acc-btn-outline" onClick={doPdf} title="چاپ / PDF"><Receipt size={15} /> PDF</button>
          </div>
        ) : (
          <span className="acc-badge draft" style={{ display: 'inline-flex', alignItems: 'center', gap: '.3rem' }}><Lock size={12} /> خروجی اکسل/ورد/PDF — پیشرفته</span>
        )}
      </div>

      {/* جدول */}
      <div className="acc-table-wrap">
        <table className="acc-table">
          <thead>
            <tr><th>تاریخ</th><th>عنوان</th><th>فروشنده</th><th>مبلغ (ریال)</th><th>ارزش افزوده</th><th>اعتبار مالیاتی</th><th>سند</th><th>پرداخت از</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const badge = TAX_BADGE[r.tax_status || 'incomplete'];
              return (
                <tr key={r.id}>
                  <td className="num">{formatJalali(r.date_g)}</td>
                  <td style={{ fontWeight: 600 }}>{r.title}<br /><small style={{ color: 'var(--muted)' }}>{r.category}</small></td>
                  <td>{r.vendor_name || '—'}</td>
                  <td className="num">{formatMoney(r.amount)}</td>
                  <td className="num">{formatMoney(r.vat_amount)}</td>
                  <td><span className={`acc-badge ${badge.tone}`}>{badge.icon} {TAX_STATUS_LABEL[r.tax_status || 'incomplete']}</span></td>
                  <td>
                    {r.receipt_url
                      ? <a href={r.receipt_url} target="_blank" rel="noreferrer" className="acc-icon-btn" title="مشاهده سند پیوست"><Link2 size={14} /></a>
                      : <span style={{ color: 'var(--muted)', fontSize: '.75rem' }}>ندارد</span>}
                  </td>
                  <td>{r.is_paid ? (r.account?.name || 'نسیه (پرداختنی)') : 'ثبت نشده'}</td>
                  <td>
                    <div className="row-actions">
                      <button className="acc-icon-btn" onClick={() => setEditing(r)}><Pencil size={14} /></button>
                      <button className="acc-icon-btn danger" onClick={() => remove(r)}><Trash2 size={14} /></button>
                      <VoidDeleteBtns
                        voidLabel="ابطال هزینه"
                        deleteLabel="حذف کامل هزینه"
                        onVoid={async (reason) => { await voidExpense(business.id, r.id, reason); load(); }}
                        onDelete={async () => { await deleteExpenseFull(business.id, r.id); load(); }}
                      />
                      <AttachButton business={business} entityType="expense" entityId={r.id} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={3}>جمع کل</td>
                <td className="num">{formatMoney(filtered.reduce((s, r) => s + r.amount, 0))}</td>
                <td className="num">{formatMoney(filtered.reduce((s, r) => s + r.vat_amount, 0))}</td>
                <td colSpan={4}></td>
              </tr>
            </tfoot>
          )}
        </table>
        {!loading && filtered.length === 0 && (
          <EmptyState icon={<Receipt size={34} />} title="هزینه‌ای ثبت نشده" hint="هزینه‌های روزانه را با سند (عکس فاکتور) ثبت کنید تا مالیات درست محاسبه شود" />
        )}
      </div>

      {/* مودال ثبت/ویرایش */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'ویرایش هزینه' : 'ثبت هزینه جدید'} wide>
        {editing && (
          <div style={{ display: 'grid', gap: '.8rem' }}>
            <div className="acc-form-grid">
              <Field label="عنوان هزینه *"><input className="acc-input" value={editing.title || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
              <Field label="دسته" hint="سرفصل حسابداری هزینه — قابل ویرایش">
                <div style={{ display: 'flex', gap: '.4rem' }}>
                  <select className="acc-select" value={editing.category || 'اداری و عمومی'} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                    {(categories.length ? categories.map((c) => c.title) : EXPENSE_CATEGORIES).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button type="button" className="acc-icon-btn" title="مدیریت دسته‌ها" onClick={() => setCatManager(true)}><Settings2 size={15} /></button>
                </div>
              </Field>
            </div>
            <div className="acc-form-grid">
              <Field label="مبلغ خالص (ریال)"><MoneyInput value={editing.amount || 0} onChange={(n) => setEditing({ ...editing, amount: n })} /></Field>
              <Field label="مالیات ارزش افزوده (ریال)" hint="اعتبار مالیاتی — فقط با فاکتور رسمی">
                <MoneyInput value={editing.vat_amount || 0} onChange={(n) => setEditing({ ...editing, vat_amount: n })} />
              </Field>
            </div>
            <div className="acc-form-grid">
              <Field label="فروشنده / محل خرید"><input className="acc-input" value={editing.vendor_name || ''} onChange={(e) => setEditing({ ...editing, vendor_name: e.target.value })} placeholder="مثلاً: هایپر رفاه" /></Field>
              <Field label="شماره فاکتور / سند"><DigitsInput value={editing.receipt_no || ''} onChange={(v) => setEditing({ ...editing, receipt_no: v })} allow="-/" /></Field>
            </div>
            <div className="acc-form-grid">
              <Field label="تاریخ"><JalaliDateInput value={editing.date_g || ''} onChange={(iso) => setEditing({ ...editing, date_g: iso })} /></Field>
              <Field label="پرداخت از حساب" hint="«نسیه» یعنی در حساب‌های پرداختنی">
                <select className="acc-select" value={editing.account_id || ''} onChange={(e) => setEditing({ ...editing, account_id: e.target.value || null })}>
                  <option value="">نسیه (پرداختنی)</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} — مانده {formatMoney(a.balance || 0)}</option>)}
                </select>
              </Field>
            </div>
            {projects.length > 0 && (
              <Field label="پروژه مرتبط" hint="هزینه به پروژه اضافه می‌شود و در گزارش عملکرد پروژه‌ها دیده می‌شود">
                <select className="acc-select" value={editing.project_id || ''} onChange={(e) => setEditing({ ...editing, project_id: e.target.value || null })}>
                  <option value="">— بدون پروژه —</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
            )}

            {/* پیوست سند + اعتبارسنجی — پیشرفته */}
            {canTax ? (
              <>
                <Field label="پیوست سند (عکس فاکتور / رسید)" hint="با پیوست سند، هزینه از نظر ممیز مالیاتی قابل قبول می‌شود">
                  {editing.receipt_url ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.7rem' }}>
                      {isImage(editing.receipt_url)
                        ? <img src={editing.receipt_url} alt="سند هزینه" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--line)' }} />
                        : <div className="acc-icon-btn" style={{ width: 84, height: 84, display: 'grid', placeItems: 'center' }}><ImageIcon size={26} /></div>}
                      <div style={{ display: 'grid', gap: '.4rem' }}>
                        <a className="acc-btn acc-btn-outline" href={editing.receipt_url} target="_blank" rel="noreferrer"><Link2 size={14} /> مشاهده سند</a>
                        <button className="acc-btn acc-btn-outline" onClick={() => setEditing({ ...editing, receipt_url: null })}><X size={14} /> حذف پیوست</button>
                      </div>
                    </div>
                  ) : (
                    <label className="acc-btn acc-btn-outline" style={{ justifyContent: 'center', cursor: uploading ? 'wait' : 'pointer' }}>
                      {uploading ? <><Loader2 size={15} className="acc-spin" /> در حال آپلود…</> : <><Upload size={15} /> آپلود عکس/فایل سند</>}
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        style={{ display: 'none' }}
                        disabled={uploading}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void uploadReceipt(f);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                </Field>

                <Field label="توضیحات"><textarea className="acc-input" rows={2} value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>

                {liveTax && (
                  <div className={`acc-tax-panel is-${liveTax.status}`}>
                    <strong style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                      {TAX_BADGE[liveTax.status].icon} وضعیت مالیاتی: {TAX_STATUS_LABEL[liveTax.status]}
                    </strong>
                    {liveTax.notes.length > 0 && (
                      <ul style={{ margin: '.4rem 0 0', paddingRight: '1.1rem', lineHeight: 1.9 }}>
                        {liveTax.notes.map((note, i) => <li key={i}>{note}</li>)}
                      </ul>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <Field label="توضیحات"><textarea className="acc-input" rows={2} value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
                <div className="acc-upsell" style={{ margin: 0 }}>
                  <Lock size={16} />
                  <div>
                    <b>اعتبارسنجی مالیاتی و آپلود سند — پیشرفته</b>
                    <p>کنترل هزینه طبق مواد ۱۴۷، ۱۴۸ و ۱۶۹ ق.م.م + آپلود عکس فاکتور برای قبولی هزینه نزد ممیز، با ارتقا فعال می‌شود.</p>
                  </div>
                </div>
              </>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.84rem', color: 'var(--text)' }}>
              <input type="checkbox" checked={editing.is_paid ?? true} onChange={(e) => setEditing({ ...editing, is_paid: e.target.checked })} />
              این هزینه قطعی شده است (سند حسابداری ثبت شود)
            </label>
            <div style={{ display: 'flex', gap: '.6rem' }}>
              <button className="acc-btn acc-btn-primary" onClick={save}>ذخیره</button>
              <button className="acc-btn acc-btn-outline" onClick={() => setEditing(null)}>انصراف</button>
            </div>
          </div>
        )}
      </Modal>

      {/* مودال مدیریت دسته‌بندی‌ها */}
      <Modal open={catManager} onClose={() => setCatManager(false)} title="مدیریت دسته‌بندی هزینه‌ها">
        <div style={{ display: 'grid', gap: '.9rem' }}>
          <p className="acc-hint" style={{ fontSize: '.78rem', lineHeight: 1.9 }}>
            دسته‌های شما روی همه فرم‌های ثبت هزینه اعمال می‌شود. عنوان و کد سرفصل هر دسته قابل ویرایش است.
          </p>
          {catEditing ? (
            <div className="acc-card" style={{ padding: '.9rem', display: 'grid', gap: '.7rem' }}>
              <b style={{ fontSize: '.86rem' }}>{catEditing.id ? 'ویرایش دسته' : 'دسته جدید'}</b>
              <div className="acc-form-grid">
                <Field label="عنوان دسته *">
                  <input className="acc-input" value={catEditing.title || ''} onChange={(e) => setCatEditing({ ...catEditing, title: e.target.value })} placeholder="مثلاً: هزینه نرم‌افزار" />
                </Field>
                <Field label="کد سرفصل (اختیاری)">
                  <DigitsInput value={catEditing.code || ''} onChange={(v) => setCatEditing({ ...catEditing, code: v })} maxLength={6} placeholder="52xx" />
                </Field>
              </div>
              <div style={{ display: 'flex', gap: '.5rem' }}>
                <button className="acc-btn acc-btn-primary" onClick={saveCategory}>ذخیره دسته</button>
                <button className="acc-btn acc-btn-outline" onClick={() => setCatEditing(null)}>انصراف</button>
              </div>
            </div>
          ) : (
            <button className="acc-btn acc-btn-primary" onClick={() => setCatEditing({ title: '' })}><Plus size={14} /> دسته جدید</button>
          )}
          <div className="acc-table-wrap" style={{ maxHeight: 320 }}>
            <table className="acc-table">
              <thead><tr><th>دسته</th><th>کد</th><th style={{ width: 80 }}></th></tr></thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.title}</td>
                    <td className="num">{c.code ? toFaDigits(c.code) : '—'}</td>
                    <td>
                      <div className="row-actions">
                        <button className="acc-icon-btn" title="ویرایش" onClick={() => setCatEditing({ id: c.id, title: c.title, code: c.code || '' })}><Pencil size={14} /></button>
                        {!c.id.startsWith('c') && (
                          <button className="acc-icon-btn danger" title="حذف" onClick={() => { void removeCategory({ ...(c as AccExpenseCategory), business_id: business.id, position: 0, created_at: '' }); }}><Trash2 size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </div>
  );
}
