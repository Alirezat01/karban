/* سیستم و ابزارهای پیشرفته — نسخه ۶
   چهار بخش: (۱) قفل دوره‌ها و بستن سال مالی (۲) مغایرت‌گیری بانکی
   (۳) پشتیبان‌گیری و بازیابی (۴) لاگ فعالیت کاربران */

import { useEffect, useState } from 'react';
import { AlertTriangle, Download, FileJson, History, Landmark, Lock, Save, Upload } from 'lucide-react';
import type { AccBusiness, AccPeriod, AccReconciliation, AccActivityRow } from '@/lib/acc/types';
import {
  closeFiscalYear, deleteReconciliation, exportBackup, listActivity,
  listPeriods, listReconciliations, restoreBackup, saveReconciliation, setPeriodLock,
  type RestoreReport, type YearCloseResult,
} from '@/lib/acc/api6';
import { listAccounts } from '@/lib/acc/api';
import { formatMoney, formatMoneyUnit } from '@/lib/acc/money';
import { JALALI_MONTHS, formatJalali, toFaDigits, todayJalali } from '@/lib/acc/jalali';
import { Field, Modal, MoneyInput, JalaliDateInput, confirmAction, toast } from './ui';

type Section = 'periods' | 'reconcile' | 'backup' | 'activity';

export default function SystemPage({ business }: { business: AccBusiness }) {
  const today = todayJalali();
  const [section, setSection] = useState<Section>('periods');

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div className="acc-tabs">
        <button className={section === 'periods' ? 'is-active' : ''} onClick={() => setSection('periods')}>قفل دوره و بستن سال</button>
        <button className={section === 'reconcile' ? 'is-active' : ''} onClick={() => setSection('reconcile')}>مغایرت‌گیری بانکی</button>
        <button className={section === 'backup' ? 'is-active' : ''} onClick={() => setSection('backup')}>پشتیبان‌گیری</button>
        <button className={section === 'activity' ? 'is-active' : ''} onClick={() => setSection('activity')}>لاگ فعالیت</button>
      </div>

      {section === 'periods' && <PeriodsSection business={business} jy={today.jy} />}
      {section === 'reconcile' && <ReconcileSection business={business} />}
      {section === 'backup' && <BackupSection business={business} />}
      {section === 'activity' && <ActivitySection business={business} />}
    </div>
  );
}

/* ─── ۱) قفل دوره‌ها + بستن سال مالی ─── */
function PeriodsSection({ business, jy }: { business: AccBusiness; jy: number }) {
  const [periods, setPeriods] = useState<AccPeriod[]>([]);
  const [year, setYear] = useState(jy);
  const [busy, setBusy] = useState(false);
  const [closeResult, setCloseResult] = useState<YearCloseResult | null>(null);

  useEffect(() => { listPeriods(business.id).then(setPeriods).catch(() => setPeriods([])); }, [business.id]);

  const isLocked = (m: number) => periods.find((p) => p.jyear === year && p.jmonth === m)?.locked || false;

  async function toggle(m: number) {
    const lock = !isLocked(m);
    if (!(await confirmAction(lock ? `دوره ${JALALI_MONTHS[m - 1]} ${year} قفل شود؟ بعد از قفل، تغییر اسناد این دوره مسدود است.` : `قفل دوره ${JALALI_MONTHS[m - 1]} باز شود؟`))) return;
    try {
      await setPeriodLock(business.id, year, m, lock);
      toast(lock ? 'دوره قفل شد' : 'دوره باز شد');
      setPeriods(await listPeriods(business.id));
    } catch {
      toast('عملیات ناموفق بود', 'error');
    }
  }

  async function closeYear() {
    if (!(await confirmAction(`سال مالی ${year} بسته شود؟ سند اختتامیه ساخته می‌شود و هر ۱۲ ماه این سال قفل خواهد شد. این عمل قابل بازگشت خودکار نیست.`, true))) return;
    setBusy(true);
    try {
      const r = await closeFiscalYear(business.id, year);
      setCloseResult(r);
      setPeriods(await listPeriods(business.id));
      toast(`سال ${year} بسته شد — سند اختتامیه شماره ${toFaDigits(r.entryNo)} ثبت شد`);
    } catch {
      toast('بستن سال ناموفق بود', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div className="acc-upsell" style={{ background: 'rgba(212,175,55,.06)' }}>
        <Lock size={18} />
        <div>
          <b>کنترل دوره‌های مالی</b>
          <p>با قفل هر ماه، ویرایش و حذف اسناد همان دوره در پنل‌های دیگر مسدود در نظر گرفته می‌شود. بستن سال مالی، سند اختتامیه (انتقال درآمد و هزینه به سود انباشته) می‌سازد.</p>
        </div>
      </div>
      <div className="acc-form-grid" style={{ alignItems: 'end' }}>
        <Field label="سال مالی">
          <select className="acc-select" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[year - 2, year - 1, year, year + 1].map((y) => <option key={y} value={y}>{toFaDigits(y)}</option>)}
          </select>
        </Field>
        <button className="acc-btn acc-btn-danger" onClick={closeYear} disabled={busy}>
          <AlertTriangle size={15} /> {busy ? 'در حال اجرا…' : `بستن سال مالی ${toFaDigits(year)}`}
        </button>
      </div>

      <div className="acc-grid-12" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '.6rem' }}>
        {JALALI_MONTHS.map((m, i) => {
          const locked = isLocked(i + 1);
          return (
            <button
              key={m}
              className={`acc-btn ${locked ? 'acc-btn-danger' : 'acc-btn-outline'}`}
              style={{ justifyContent: 'center', fontSize: '.8rem' }}
              onClick={() => toggle(i + 1)}
            >
              <Lock size={13} /> {m} {locked ? 'قفل' : ''}
            </button>
          );
        })}
      </div>

      {closeResult && (
        <div className="contact-card calc-card" style={{ padding: '1rem' }}>
          <b>نتیجه بستن سال {toFaDigits(year)}</b>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '.5rem', marginTop: '.6rem', fontSize: '.85rem' }}>
            <span>درآمد دوره: <b>{formatMoney(closeResult.revenueTotal)} ریال</b></span>
            <span>هزینه دوره: <b>{formatMoney(closeResult.expenseTotal)} ریال</b></span>
            <span>سود خالص: <b style={{ color: 'var(--gold2)' }}>{formatMoney(closeResult.netProfit)} ریال</b></span>
            <span>دوره‌های قفل‌شده: <b>{toFaDigits(closeResult.lockedPeriods)}</b></span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── ۲) مغایرت‌گیری بانکی ─── */
function ReconcileSection({ business }: { business: AccBusiness }) {
  const [rows, setRows] = useState<AccReconciliation[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; name: string; balance: number }[]>([]);
  const [editing, setEditing] = useState<Partial<AccReconciliation> | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [r, ac] = await Promise.all([listReconciliations(business.id), listAccounts(business.id)]);
      setRows(r);
      setAccounts(ac.filter((a) => a.active).map((a) => ({ id: a.id, name: a.name, balance: a.balance || 0 })));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [business.id]);

  async function save() {
    if (!editing?.account_id) { toast('حساب را انتخاب کنید', 'error'); return; }
    try {
      await saveReconciliation(business.id, editing);
      toast('ذخیره شد');
      setEditing(null);
      load();
    } catch {
      toast('ذخیره ناموفق بود', 'error');
    }
  }

  async function remove(row: AccReconciliation) {
    if (!(await confirmAction('این رکورد مغایرت‌گیری حذف شود؟'))) return;
    try {
      await deleteReconciliation(row.id);
      toast('حذف شد');
      load();
    } catch {
      toast('حذف ناموفق بود', 'error');
    }
  }

  const diff = (editing?.statement_balance || 0) - (editing?.book_balance || 0);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <button
          className="acc-btn acc-btn-primary"
          onClick={() => setEditing({ statement_date_g: new Date().toISOString().slice(0, 10), statement_balance: 0, reconciled: false })}
        >
          <Landmark size={15} /> مغایرت‌گیری جدید
        </button>
      </div>
      <div className="acc-table-wrap">
        <table className="acc-table">
          <thead>
            <tr><th>حساب</th><th>تاریخ گردش‌نامه</th><th>مانده بانک</th><th>مانده دفتر</th><th>مغایرت</th><th>وضعیت</th><th>یادداشت</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.account?.name || '—'}</td>
                <td className="num">{formatJalali(r.statement_date_g)}</td>
                <td className="num">{formatMoney(r.statement_balance)}</td>
                <td className="num">{formatMoney(r.book_balance)}</td>
                <td className="num" style={{ color: r.difference === 0 ? 'var(--gold2)' : '#ef9a94', fontWeight: 700 }}>{formatMoney(r.difference)}</td>
                <td>{r.reconciled ? 'تطبیق شد' : 'در بررسی'}</td>
                <td style={{ maxWidth: 160 }}>{r.notes || '—'}</td>
                <td>
                  <div className="row-actions">
                    <button className="acc-icon-btn" onClick={() => setEditing(r)}>✎</button>
                    <button className="acc-icon-btn danger" onClick={() => remove(r)}>🗑</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && (
          <div className="acc-empty"><Landmark size={34} /><p style={{ fontWeight: 600 }}>مغایرت‌گیری‌ای ثبت نشده</p><p style={{ fontSize: '.8rem' }}>مانده گردش‌نامه بانک را با مانده دفتر مقایسه کنید</p></div>
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'ویرایش مغایرت‌گیری' : 'مغایرت‌گیری جدید'}>
        {editing && (
          <div style={{ display: 'grid', gap: '.8rem' }}>
            <div className="acc-form-grid">
              <Field label="حساب بانکی/صندوق *">
                <select
                  className="acc-select"
                  value={editing.account_id || ''}
                  onChange={(e) => {
                    const acc = accounts.find((a) => a.id === e.target.value);
                    setEditing({ ...editing, account_id: e.target.value || '', book_balance: acc ? Math.round(acc.balance) : editing.book_balance });
                  }}
                >
                  <option value="">— انتخاب کنید —</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Field>
              <Field label="تاریخ گردش‌نامه"><JalaliDateInput value={editing.statement_date_g || ''} onChange={(iso) => setEditing({ ...editing, statement_date_g: iso })} /></Field>
            </div>
            <div className="acc-form-grid">
              <Field label="مانده طبق گردش‌نامه بانک (ریال)"><MoneyInput value={editing.statement_balance || 0} onChange={(n) => setEditing({ ...editing, statement_balance: n })} /></Field>
              <Field label="مانده طبق دفتر (ریال)" hint="به‌صورت خودکار از مانده حساب پر شد"><MoneyInput value={editing.book_balance || 0} onChange={(n) => setEditing({ ...editing, book_balance: n })} /></Field>
            </div>
            <div className={`acc-kpi ${diff === 0 ? '' : 'is-warn'}`} style={{ padding: '.8rem 1rem' }}>
              <div className="k-label">مغایرت</div>
              <div className="k-value" style={{ color: diff === 0 ? 'var(--gold2)' : '#ef9a94' }}>{formatMoneyUnit(Math.abs(diff), business.currency)} {diff === 0 ? '— بدون مغایرت ✓' : diff > 0 ? 'بیشتر از دفتر' : 'کمتر از دفتر'}</div>
            </div>
            <Field label="یادداشت مغایرت‌ها"><textarea className="acc-input" rows={2} placeholder="مثلاً: کارمزد بانک هنوز در دفتر ثبت نشده…" value={editing.notes || ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></Field>
            <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.85rem' }}>
              <input type="checkbox" checked={editing.reconciled ?? false} onChange={(e) => setEditing({ ...editing, reconciled: e.target.checked })} />
              مغایرت‌ها بررسی و تطبیق شد
            </label>
            <div style={{ display: 'flex', gap: '.6rem' }}>
              <button className="acc-btn acc-btn-primary" onClick={save}><Save size={15} /> ذخیره</button>
              <button className="acc-btn acc-btn-outline" onClick={() => setEditing(null)}>انصراف</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ─── ۳) پشتیبان‌گیری و بازیابی ─── */
function BackupSection({ business }: { business: AccBusiness }) {
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [reports, setReports] = useState<RestoreReport[] | null>(null);

  async function doExport() {
    setBusy('export');
    try {
      const bundle = await exportBackup(business.id);
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `karban-backup-${business.name.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('فایل پشتیبان دانلود شد — آن را در جای امن نگه دارید');
    } catch {
      toast('تهیه پشتیبان ناموفق بود', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function doImport(file: File) {
    if (!(await confirmAction('همه ردیف‌های فایل پشتیبان به‌عنوان ردیف جدید اضافه می‌شوند. ادامه می‌دهید؟', true))) return;
    setBusy('import');
    try {
      const text = await file.text();
      const bundle = JSON.parse(text);
      const r = await restoreBackup(business.id, bundle);
      setReports(r);
      toast('بازیابی انجام شد — جدول‌های زیر را ببینید');
    } catch {
      toast('فایل نامعتبر است یا خطای بازیابی رخ داد', 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div className="acc-upsell">
        <FileJson size={18} />
        <div>
          <b>پشتیبان‌گیری کامل کسب‌وکار</b>
          <p>کل اطلاعات (طرف‌حساب‌ها، فاکتورها، اسناد، چک‌ها، پروژه‌ها، حقوق و…) در یک فایل JSON خروجی می‌گیرید و هر زمان می‌توانید بازیابی کنید.</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
        <button className="acc-btn acc-btn-primary" onClick={doExport} disabled={busy !== null}>
          <Download size={15} /> {busy === 'export' ? 'در حال تهیه…' : 'دانلود فایل پشتیبان'}
        </button>
        <label className="acc-btn acc-btn-outline" style={{ cursor: busy === 'import' ? 'wait' : 'pointer' }}>
          <Upload size={15} /> {busy === 'import' ? 'در حال بازیابی…' : 'بازیابی از فایل'}
          <input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = ''; }} />
        </label>
      </div>
      {reports && (
        <div className="acc-table-wrap">
          <table className="acc-table">
            <thead><tr><th>جدول</th><th>تعداد ردیف بازیابی‌شده</th><th>خطا</th></tr></thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.table}>
                  <td className="num" dir="ltr">{r.table}</td>
                  <td className="num">{toFaDigits(r.inserted)}</td>
                  <td style={{ color: '#ef9a94' }}>{r.error || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── ۴) لاگ فعالیت ─── */
function ActivitySection({ business }: { business: AccBusiness }) {
  const [rows, setRows] = useState<AccActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listActivity(business.id, 150)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [business.id]);

  return (
    <div className="acc-table-wrap">
      <table className="acc-table">
        <thead><tr><th>زمان</th><th>کاربر</th><th>عملیات</th><th>موضوع</th><th>جزئیات</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="num">{formatJalali(r.created_at)}</td>
              <td dir="ltr" style={{ textAlign: 'right' }}>{r.user_email || '—'}</td>
              <td style={{ fontWeight: 600 }}>{r.action}</td>
              <td>{r.entity || '—'}</td>
              <td>{r.detail || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!loading && rows.length === 0 && (
        <div className="acc-empty"><History size={34} /><p style={{ fontWeight: 600 }}>فعالیتی ثبت نشده</p><p style={{ fontSize: '.8rem' }}>از این به بعد عملیات‌های مهم به‌صورت خودکار لاگ می‌شوند</p></div>
      )}
    </div>
  );
}
