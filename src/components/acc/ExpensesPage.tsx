/* هزینه‌های روزانه — ثبت، پیوست سند، اعتبارسنجی مالیاتی و خروجی
   نسخه ۳: هزینه واقعی یعنی هزینه مستند — بر اساس مواد ۱۴۷/۱۴۸/۱۶۹ ق.م.م */

import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck, CalendarDays, FileSpreadsheet, FileText, Image as ImageIcon,
  Link2, Loader2, Pencil, Plus, Receipt, Search, Settings2, Trash2, Upload, Users, X,
} from 'lucide-react';
import type { AccBusiness, AccExpense, AccExpenseCategory, ExpenseTaxStatus } from '@/lib/acc/types';
import { listProjects } from '@/lib/acc/api6';
import {
  computeExpenseTax, deleteExpense, deleteExpenseCategory, ensureExpenseCategories,
  listAccounts, listExpenses, listPartners, saveExpense, saveExpenseCategory,
  TAX_STATUS_LABEL, uploadAccMedia,
} from '@/lib/acc/api';
import { listChartTree, listDetails } from '@/lib/acc/api7';
import { listCostCenters } from '@/lib/acc/api10';
import type { AccDetail } from '@/lib/acc/api7';
import { EXPENSE_CATEGORIES } from '@/lib/acc/constants';
import { formatMoney } from '@/lib/acc/money';
import { formatJalali, jalaliMonthLength, toGregorian, todayJalali, dateToISO, toFaDigits, JALALI_MONTHS } from '@/lib/acc/jalali';
import { Field, JalaliDateInput, Modal, MoneyInput, DigitsInput, confirmAction, toast, toastError, EmptyState } from './ui';
import { voidExpense, deleteExpenseFull } from '@/lib/acc/api7';
import { personPayables, settlePersonPayable, type PersonPayableRow } from '@/lib/acc/api6';
import { VoidDeleteBtns } from './VoidDeleteBtns';
import AttachButton from './AttachButton';
import { exportExcel, exportFilename, exportWord, htmlTable, printHtml, brandLogoUrl } from '@/lib/acc/export';
import { featureEnabled } from '@/lib/acc/plan';
import { Lock } from 'lucide-react';
import { resolveAccFileUrl } from '@/lib/acc/rpc';
import { supabase } from '@/lib/supabase';

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
  const [receiptUrls, setReceiptUrls] = useState<Record<string, string>>({});
  const [accounts, setAccounts] = useState<AccountLite[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<CategoryLite[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<{ id: string; label: string }[]>([]);
  const [details, setDetails] = useState<AccDetail[]>([]);
  const [partners, setPartners] = useState<{ id: string; name: string }[]>([]);
  const [payables, setPayables] = useState<PersonPayableRow[]>([]);
  /* پرداخت‌کنندهٔ هزینه (بند ۵ و ۱۳): شرکت | شخص ثالث | نسیه */
  const [payerKind, setPayerKind] = useState<'company' | 'person' | 'unpaid'>('company');
  const [settleRow, setSettleRow] = useState<PersonPayableRow | null>(null);
  const [settleForm, setSettleForm] = useState<{ account_id: string; amount: number; date_g: string; description: string }>({ account_id: '', amount: 0, date_g: '', description: '' });
  const [costCenters, setCostCenters] = useState<{ id: string; code: string; name: string }[]>([]);
  const [catManager, setCatManager] = useState(false);
  const [catEditing, setCatEditing] = useState<Partial<AccExpenseCategory> | null>(null);
  const [query, setQuery] = useState('');
  const [taxFilter, setTaxFilter] = useState<'all' | ExpenseTaxStatus>('all');
  const [monthIdx, setMonthIdx] = useState(-1);
  const [editing, setEditing] = useState<Partial<AccExpense> | null>(null);
  const [postedIds, setPostedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const months = useMemo(() => monthOptions(), []);

  /* شناسهٔ هزینه‌های سندخورده (سند فعال) — برای پیام ویرایش شفاف (M220000) */
  async function loadPosted() {
    try {
      const { data } = await supabase
        .from('acc_journal')
        .select('ref_id')
        .eq('business_id', business.id)
        .eq('ref_type', 'expense')
        .eq('ref_action', 'post')
        .is('voided_at', null);
      setPostedIds(new Set((data || []).map((r: { ref_id: string }) => r.ref_id)));
    } catch { setPostedIds(new Set()); }
  }

  /* تفکیک پلن: ثبت هزینه پایه برای همه؛ سند مالیاتی و خروجی‌ها پیشرفته */
  const canTax = featureEnabled(access?.plan, 'expense_tax_validation');
  const canExport = featureEnabled(access?.plan, 'export_multiformat');

  async function load() {
    setLoading(true);
    try {
      const [e, a] = await Promise.all([listExpenses(business.id), listAccounts(business.id)]);
      setRows(e);
      /* URL امن امضاشده برای اسناد هزینه (باکت خصوصی acc-attach) */
      const urlMap: Record<string, string> = {};
      await Promise.all(e.filter((r) => r.receipt_url).map(async (r) => {
        urlMap[r.id] = await resolveAccFileUrl(r.receipt_url);
      }));
      setReceiptUrls(urlMap);
      setAccounts(a);
      listProjects(business.id).then((p) => setProjects(p.map((x) => ({ id: x.id, name: x.name })))).catch(() => setProjects([]));
      /* حساب‌های هزینه/بهای تمام‌شده از کدینگ واقعی (بند ۲۰) */
      listChartTree(business.id).then((tree) => {
        const accs: { id: string; label: string }[] = [];
        const walk = (nodes: typeof tree) => {
          for (const n of nodes) {
            if (n.kind === 'expense' && n.is_leaf) accs.push({ id: n.id, label: `${n.code} — ${n.title}` });
            if (n.children?.length) walk(n.children);
          }
        };
        walk(tree);
        setExpenseAccounts(accs);
      }).catch(() => setExpenseAccounts([]));
      listDetails(business.id).then((d) => setDetails(d.filter((x) => x.active !== false))).catch(() => setDetails([]));
      listPartners(business.id).then((p) => setPartners(p.filter((x) => x.active !== false).map((x) => ({ id: x.id, name: x.name })))).catch(() => setPartners([]));
      personPayables(business.id).then((pp) => setPayables(pp.filter((x) => Number(x.balance) > 0))).catch(() => setPayables([]));
      listCostCenters(business.id, true).then((cc) => setCostCenters(cc.map((x) => ({ id: x.id, code: x.code, name: x.name })))).catch(() => setCostCenters([]));
      await loadPosted();
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [business.id]);

  /* ───────────── پرداخت‌کنندهٔ هزینه (بند ۵ و ۱۳) ───────────── */
  const PERSON_DETAIL_KINDS = ['shareholder', 'employee', 'customer', 'supplier', 'other', 'partner'];
  const DETAIL_KIND_FA: Record<string, string> = {
    shareholder: 'شریک/سهامدار', employee: 'کارمند', customer: 'مشتری',
    supplier: 'تامین‌کننده', other: 'شخص', partner: 'شریک',
  };
  const personDetails = details.filter((d) => PERSON_DETAIL_KINDS.includes(d.kind));
  const detailTitleMap = useMemo(() => new Map(details.map((d) => [d.id, d.title])), [details]);

  /** برچسب ستون «پرداخت از» — شخص ثالث/نسیه/حساب */
  function payerLabel(r: AccExpense): string {
    if (r.paid_by_kind && ['partner', 'employee', 'shareholder', 'other_person'].includes(r.paid_by_kind)) {
      const name = (r.paid_by_detail_id && detailTitleMap.get(r.paid_by_detail_id)) || 'شخص ثالث';
      return `شخص ثالث — ${name}`;
    }
    if (r.paid_by_kind === 'unpaid') return 'نسیه (پرداختنی)';
    if (r.paid_by_kind === 'company') return r.account?.name || 'شرکت (بدون حساب)';
    /* ردیف‌های قدیمی قبل از paid_by_kind */
    return r.is_paid ? (r.account?.name || 'نسیه (پرداختنی)') : 'ثبت نشده';
  }

  /** باز کردن ادیتور — استخراج پرداخت‌کننده از ردیف موجود */
  function openEditor(row?: Partial<AccExpense>) {
    if (row?.id) {
      const k = row.paid_by_kind || (row.is_paid ? 'company' : 'unpaid');
      setPayerKind(['partner', 'employee', 'shareholder', 'other_person'].includes(k) ? 'person' : (k === 'unpaid' ? 'unpaid' : 'company'));
      setEditing({ ...row });
    } else {
      setPayerKind('company');
      setEditing({ category: 'اداری و عمومی', is_paid: true, date_g: summary.todayIso, tax_status: 'incomplete' });
    }
  }

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
      if (editing?.id) {
        const view = await resolveAccFileUrl(url);
        setReceiptUrls((m) => ({ ...m, [editing.id as string]: view }));
      }
      toast('سند پیوست شد');
    } catch {
      toast('آپلود سند ناموفق بود', 'error');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!editing?.title?.trim()) { toast('عنوان هزینه الزامی است', 'error'); return; }
    if (!((editing.amount || 0) > 0)) { toast('مبلغ خالص هزینه را وارد کنید', 'error'); return; }
    /* قواعد پرداخت‌کننده (موتور M120000 بند ۱۳):
       company → حساب بانک/صندوق لازم است | شخص ثالث → تفصیلی شخص لازم است | نسیه → طرف‌حساب لازم است */
    if (payerKind === 'company' && !editing.account_id) {
      toast('حساب پرداخت را انتخاب کنید — یا پرداخت‌کننده را «شخص ثالث» یا «نسیه» بگذارید', 'error'); return;
    }
    if (payerKind === 'person' && !editing.paid_by_detail_id) {
      toast('شخص پرداخت‌کننده را انتخاب کنید', 'error'); return;
    }
    if (payerKind === 'unpaid' && !editing.partner_id) {
      toast('برای هزینهٔ نسیه، طرف‌حساب را انتخاب کنید', 'error'); return;
    }
    const paidByKind = payerKind === 'company'
      ? 'company'
      : payerKind === 'unpaid'
        ? 'unpaid'
        : (() => {
            const d = personDetails.find((x) => x.id === editing?.paid_by_detail_id);
            return d?.kind === 'shareholder' ? 'shareholder' : d?.kind === 'employee' ? 'employee' : 'other_person';
          })();
    const tax = computeExpenseTax(editing);
    const wasPosted = editing.id ? postedIds.has(editing.id) : false;
    try {
      await saveExpense(business.id, {
        ...editing,
        is_paid: payerKind !== 'unpaid',
        paid_by_kind: paidByKind,
        account_id: payerKind === 'company' ? editing.account_id : null,
        tax_status: tax.status,
      });
      if (wasPosted) toast('هزینه ویرایش شد — سند قبلی ابطال و سند جدید صادر شد');
      else toast(tax.status === 'valid' ? 'هزینه ثبت شد — از نظر مالیاتی قابل قبول' : 'هزینه ثبت شد — برای اعتبار مالیاتی سند را کامل کنید');
      setEditing(null);
      load();
    } catch (e) {
      toastError(e, 'ثبت ناموفق بود');
    }
  }

  /** تسویهٔ بدهی به شخص — اتمیک از مسیر RPC (DR 2112 / CR بانک یا صندوق) */
  async function doSettle() {
    if (!settleRow) return;
    if (!settleForm.account_id) { toast('حساب بازپرداخت را انتخاب کنید', 'error'); return; }
    if (!settleForm.amount || settleForm.amount <= 0) { toast('مبلغ تسویه را وارد کنید', 'error'); return; }
    if (settleForm.amount > Number(settleRow.balance)) { toast('مبلغ از ماندهٔ بدهی بیشتر است', 'error'); return; }
    try {
      await settlePersonPayable(business.id, settleRow.detail_id, settleForm.account_id, settleForm.amount, settleForm.date_g, settleForm.description);
      toast('تسویه ثبت شد — سند بازپرداخت صادر شد');
      setSettleRow(null);
      load();
    } catch (e) {
      toastError(e, 'تسویه ناموفق بود');
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

      {/* پرداختنی به اشخاص — پولی که شخص ثالث (مثلاً خود کاربر با حساب شخصی) برای شرکت پرداخت کرده */}
      {payables.length > 0 && (
        <div className="acc-card" style={{ borderColor: 'rgba(216,165,63,.45)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '.45rem' }}>
            <Users size={16} color="var(--gold)" /> پرداختنی به اشخاص — بازپرداخت به کسانی که برای شرکت پرداخت کرده‌اند
          </h3>
          <div className="acc-table-wrap" style={{ marginTop: '.6rem' }}>
            <table className="acc-table">
              <thead>
                <tr><th>شخص</th><th>نقش</th><th>جمع پرداخت‌ها</th><th>تسویه‌شده</th><th>ماندهٔ بدهی (ریال)</th><th></th></tr>
              </thead>
              <tbody>
                {payables.map((p) => (
                  <tr key={p.detail_id}>
                    <td style={{ fontWeight: 600 }}>{p.title}{p.partner_name && p.partner_name !== p.title ? <small style={{ color: 'var(--muted)' }}> ({p.partner_name})</small> : null}</td>
                    <td>{DETAIL_KIND_FA[p.kind || 'other'] || 'شخص'}</td>
                    <td className="num">{formatMoney(Number(p.total_paid))}</td>
                    <td className="num">{formatMoney(Number(p.total_settled))}</td>
                    <td className="num" style={{ color: 'var(--gold2)', fontWeight: 700 }}>{formatMoney(Number(p.balance))}</td>
                    <td>
                      <button
                        className="acc-btn acc-btn-outline"
                        style={{ minHeight: 34, fontSize: '.78rem' }}
                        onClick={() => {
                          setSettleRow(p);
                          setSettleForm({
                            account_id: accounts[0]?.id || '',
                            amount: Number(p.balance),
                            date_g: summary.todayIso,
                            description: '',
                          });
                        }}
                      >تسویه</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="acc-hint" style={{ marginTop: '.5rem' }}>
            این مانده‌ها در حساب «۲۱۱۲ پرداختنی به اشخاص» نگهداری می‌شوند — با «تسویه»، بازپرداخت از بانک/صندوق به شخص سند می‌شود.
          </div>
        </div>
      )}

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
        <button className="acc-btn acc-btn-primary" onClick={() => openEditor()}><Plus size={15} /> ثبت هزینه امروز</button>
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
                      ? <a href={receiptUrls[r.id] || r.receipt_url} target="_blank" rel="noreferrer" className="acc-icon-btn" title="مشاهده سند پیوست"><Link2 size={14} /></a>
                      : <span style={{ color: 'var(--muted)', fontSize: '.75rem' }}>ندارد</span>}
                  </td>
                  <td>{payerLabel(r)}</td>
                  <td>
                    <div className="row-actions">
                      {!r.voided_at && <button className="acc-icon-btn" title="ویرایش هزینه" onClick={() => openEditor(r)}><Pencil size={14} /></button>}
                      {!r.voided_at && <button className="acc-icon-btn danger" title="حذف هزینه" onClick={() => remove(r)}><Trash2 size={14} /></button>}
                      {!r.voided_at && (
                        <VoidDeleteBtns
                          voidLabel="ابطال هزینه"
                          deleteLabel="حذف کامل هزینه"
                          onVoid={async (reason) => { await voidExpense(business.id, r.id, reason); load(); }}
                          onDelete={async () => { await deleteExpenseFull(business.id, r.id); load(); }}
                        />
                      )}
                      {r.voided_at && (
                        <button className="acc-icon-btn danger" title="حذف کامل هزینهٔ ابطال‌شده" onClick={async () => { await deleteExpenseFull(business.id, r.id); load(); }}><Trash2 size={14} /></button>
                      )}
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
            {editing.id && postedIds.has(editing.id) && (
              <div style={{ background: 'rgba(232,196,118,.14)', border: '1px solid rgba(232,196,118,.45)', borderRadius: 12, padding: '.65rem .8rem', fontSize: '.8rem', lineHeight: 1.9 }}>
                این هزینه سند حسابداری فعال دارد. با ذخیره، اگر <b>مبلغ، تاریخ، دسته، حساب‌ها، طرف‌حساب یا پروژه</b> تغییر کرده باشد، سند فعلی به‌صورت اتمیک ابطال و سند جدید با مقادیر جدید صادر می‌شود (تاریخچهٔ سند قبلی حفظ می‌ماند). تغییر عنوان/توضیحات/فروشنده بدون دست‌زدن به سند اعمال می‌شود.
              </div>
            )}
            <div className="acc-form-grid">
              <Field label="عنوان هزینه" required><input className="acc-input" value={editing.title || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
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
              <Field label="مبلغ خالص (ریال)" required><MoneyInput value={editing.amount || 0} onChange={(n) => setEditing({ ...editing, amount: n })} /></Field>
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
              <Field
                label="پرداخت‌کننده"
                hint={payerKind === 'person'
                  ? 'مبلغ از جیب شخص ثبت می‌شود و در «پرداختنی به اشخاص» برای بازپرداخت می‌ماند'
                  : payerKind === 'unpaid'
                    ? 'هزینه ثبت می‌شود اما هنوز پولی پرداخت نشده — در حساب‌های پرداختنی می‌ماند'
                    : 'از حساب بانکی/صندوق شرکت پرداخت می‌شود'}
              >
                <select
                  className="acc-select"
                  value={payerKind}
                  onChange={(e) => {
                    const k = e.target.value as 'company' | 'person' | 'unpaid';
                    setPayerKind(k);
                    setEditing({
                      ...editing,
                      account_id: k === 'company' ? editing.account_id : null,
                      paid_by_detail_id: k === 'person' ? editing.paid_by_detail_id : null,
                    });
                  }}
                >
                  <option value="company">شرکت — از حساب بانکی/صندوق</option>
                  <option value="person">شخص ثالث پرداخت کرده (حساب شخصی خودم یا دیگران)</option>
                  <option value="unpaid">پرداخت نشده — نسیه (پرداختنی)</option>
                </select>
              </Field>
            </div>
            {payerKind === 'company' && (
              <Field label="از حساب" required={payerKind === "company"} hint="ماندهٔ این حساب کم می‌شود">
                <select className="acc-select" value={editing.account_id || ''} onChange={(e) => setEditing({ ...editing, account_id: e.target.value || null })}>
                  <option value="">— انتخاب حساب —</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} — مانده {formatMoney(a.balance || 0)}</option>)}
                </select>
              </Field>
            )}
            {payerKind === 'person' && (
              <Field
                label="شخص پرداخت‌کننده" required={payerKind === "person"}
                hint={personDetails.length === 0 ? 'هنوز شخصی ثبت نکرده‌اید — از صفحهٔ «مشتریان و طرف‌حساب‌ها» اضافه کنید' : 'نزد اسم هر شخص، نقش او آمده است'}
              >
                <select className="acc-select" value={editing.paid_by_detail_id || ''} onChange={(e) => setEditing({ ...editing, paid_by_detail_id: e.target.value || null })}>
                  <option value="">— انتخاب شخص —</option>
                  {personDetails.map((d) => (
                    <option key={d.id} value={d.id}>{d.title}{DETAIL_KIND_FA[d.kind] ? ` — ${DETAIL_KIND_FA[d.kind]}` : ''}</option>
                  ))}
                </select>
              </Field>
            )}
            {payerKind === 'unpaid' && (
              <Field label="طرف‌حساب بستانکار" required={payerKind === "unpaid"} hint="سهامدار → جاری شرکا | کارمند → جاری کارکنان | سایر → پرداختنی تجاری">
                <select className="acc-select" value={editing.partner_id || ''} onChange={(e) => setEditing({ ...editing, partner_id: e.target.value || null })}>
                  <option value="">— انتخاب طرف‌حساب —</option>
                  {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
            )}
            {projects.length > 0 && (
              <Field label="پروژه مرتبط" hint="هزینه به پروژه اضافه می‌شود و در گزارش عملکرد پروژه‌ها دیده می‌شود">
                <select className="acc-select" value={editing.project_id || ''} onChange={(e) => setEditing({ ...editing, project_id: e.target.value || null })}>
                  <option value="">— بدون پروژه —</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
            )}

            {/* اتصال هزینه به کدینگ حسابداری (بند ۲۰): حساب واقعی، تفصیلی، مرکز هزینه */}
            <div className="acc-form-grid-3">
              <Field label="حساب هزینه (کدینگ)" hint="حساب واقعی در سند حسابداری — پیش‌فرض از دسته انتخاب می‌شود">
                <select className="acc-select" value={editing.expense_account_id || ''} onChange={(e) => setEditing({ ...editing, expense_account_id: e.target.value || null })}>
                  <option value="">— خودکار از دسته —</option>
                  {expenseAccounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
              </Field>
              <Field label="مرکز هزینه">
                <select className="acc-select" value={editing.cost_center_id || ''} onChange={(e) => setEditing({ ...editing, cost_center_id: e.target.value || null })}>
                  <option value="">— بدون مرکز هزینه —</option>
                  {costCenters.map((cc) => <option key={cc.id} value={cc.id}>{cc.code} {cc.name}</option>)}
                </select>
              </Field>
              <Field label="تفصیلی (طرف‌حساب)">
                <select className="acc-select" value={editing.detail_id || ''} onChange={(e) => setEditing({ ...editing, detail_id: e.target.value || null })}>
                  <option value="">— خودکار از فروشنده —</option>
                  {details.map((d) => <option key={d.id} value={d.id}>{d.detail_code ? `${d.detail_code} — ` : ''}{d.title}</option>)}
                </select>
              </Field>
            </div>

            {/* پیوست سند + اعتبارسنجی — پیشرفته */}
            {canTax ? (
              <>
                <Field label="پیوست سند (عکس فاکتور / رسید)" hint="با پیوست سند، هزینه از نظر ممیز مالیاتی قابل قبول می‌شود">
                  {editing.receipt_url ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.7rem' }}>
                      {isImage(editing.receipt_url)
                        ? <img src={receiptUrls[editing.id || ''] || editing.receipt_url} alt="سند هزینه" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--line)' }} />
                        : <div className="acc-icon-btn" style={{ width: 84, height: 84, display: 'grid', placeItems: 'center' }}><ImageIcon size={26} /></div>}
                      <div style={{ display: 'grid', gap: '.4rem' }}>
                        <a className="acc-btn acc-btn-outline" href={receiptUrls[editing.id || ''] || editing.receipt_url} target="_blank" rel="noreferrer"><Link2 size={14} /> مشاهده سند</a>
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

            <div className="acc-hint" style={{ fontSize: '.78rem' }}>
              سند حسابداری بر اساس «پرداخت‌کننده» ثبت می‌شود — بستانکار: {payerKind === 'company' ? 'حساب بانک/صندوق' : payerKind === 'person' ? '۲۱۱۲ پرداختنی به اشخاص (به نام همان شخص)' : 'حساب پرداختنی طرف‌حساب'}
            </div>
            <div style={{ display: 'flex', gap: '.6rem' }}>
              <button className="acc-btn acc-btn-primary" onClick={save}>ذخیره</button>
              <button className="acc-btn acc-btn-outline" onClick={() => setEditing(null)}>انصراف</button>
            </div>
          </div>
        )}
      </Modal>

      {/* مودال تسویهٔ پرداختنی شخص */}
      <Modal open={!!settleRow} onClose={() => setSettleRow(null)} title={`تسویهٔ بدهی به «${settleRow?.title || ''}»`}>
        {settleRow && (
          <div style={{ display: 'grid', gap: '.8rem' }}>
            <div className="acc-kpi" style={{ display: 'grid', gap: '.2rem' }}>
              <div className="k-label">ماندهٔ بدهی (پرداخت‌های شخص منهای بازپرداخت‌ها)</div>
              <div className="k-value">{formatMoney(Number(settleRow.balance))} <small>ریال</small></div>
            </div>
            <Field label="بازپرداخت از حساب" required hint="مبلغ از این حساب کم می‌شود (۱۱۰۲ بانک / ۱۱۰۱ صندوق)">
              <select className="acc-select" value={settleForm.account_id} onChange={(e) => setSettleForm({ ...settleForm, account_id: e.target.value })}>
                <option value="">— انتخاب حساب —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} — مانده {formatMoney(a.balance || 0)}</option>)}
              </select>
            </Field>
            <div className="acc-form-grid">
              <Field label="مبلغ تسویه (ریال)">
                <MoneyInput value={settleForm.amount} onChange={(n) => setSettleForm({ ...settleForm, amount: n })} />
              </Field>
              <Field label="تاریخ">
                <JalaliDateInput value={settleForm.date_g} onChange={(iso) => setSettleForm({ ...settleForm, date_g: iso })} />
              </Field>
            </div>
            <Field label="شرح (اختیاری)">
              <input className="acc-input" placeholder="مثلاً: بازپرداخت هزینهٔ آبان ماه" value={settleForm.description} onChange={(e) => setSettleForm({ ...settleForm, description: e.target.value })} />
            </Field>
            <div style={{ display: 'flex', gap: '.6rem' }}>
              <button className="acc-btn acc-btn-primary" onClick={doSettle}>ثبت تسویه</button>
              <button className="acc-btn acc-btn-outline" onClick={() => setSettleRow(null)}>انصراف</button>
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
                <Field label="عنوان دسته" required>
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
