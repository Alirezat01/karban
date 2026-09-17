/* هزینه‌های تکرارشونده — نسخه ۶
   اجاره، قسط، حق اشتراک… یک‌بار تعریف می‌شود و سررسیدش خودکار سند هزینه می‌سازد */

import { useEffect, useState } from 'react';
import { Pencil, Play, Plus, RefreshCcw, Trash2 } from 'lucide-react';
import type { AccBusiness, AccRecurring } from '@/lib/acc/types';
import { deleteRecurring, listRecurring, runDueRecurring, saveRecurring } from '@/lib/acc/api6';
import { listAccounts, listPartners, listExpenseCategories, ensureExpenseCategories } from '@/lib/acc/api';
import { formatMoney, formatMoneyUnit } from '@/lib/acc/money';
import { formatJalali, toFaDigits } from '@/lib/acc/jalali';
import { Field, Modal, MoneyInput, JalaliDateInput, confirmAction, toast, EmptyState } from './ui';

const FREQ_LABEL: Record<string, string> = { monthly: 'ماهانه', quarterly: 'فصلی', yearly: 'سالانه' };

export default function RecurringPage({ business }: { business: AccBusiness }) {
  const [rows, setRows] = useState<AccRecurring[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [partners, setPartners] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [editing, setEditing] = useState<Partial<AccRecurring> | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const cats = await ensureExpenseCategories(business.id);
      setCategories(cats.map((c) => c.title));
      const [r, ac, pr] = await Promise.all([listRecurring(business.id), listAccounts(business.id), listPartners(business.id)]);
      setRows(r);
      setAccounts(ac.filter((a) => a.active).map((a) => ({ id: a.id, name: a.name })));
      setPartners(pr.map((p) => ({ id: p.id, name: p.name })));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [business.id]);

  async function save() {
    if (!editing?.title?.trim()) { toast('عنوان الزامی است', 'error'); return; }
    if (!editing?.next_date_g) { toast('تاریخ سررسید بعدی را انتخاب کنید', 'error'); return; }
    try {
      await saveRecurring(business.id, editing);
      toast('ذخیره شد');
      setEditing(null);
      load();
    } catch {
      toast('ذخیره ناموفق بود', 'error');
    }
  }

  async function remove(row: AccRecurring) {
    if (!(await confirmAction(`هزینه تکرارشونده «${row.title}» حذف شود؟`))) return;
    try {
      await deleteRecurring(row.id);
      toast('حذف شد');
      load();
    } catch {
      toast('حذف ناموفق بود', 'error');
    }
  }

  async function runDue() {
    setRunning(true);
    try {
      const n = await runDueRecurring(business.id);
      toast(n > 0 ? `${toFaDigits(n)} سند هزینه برای سررسیدهای گذشته ساخته شد` : 'سررسید گذشته‌ای برای اجرا نبود');
      load();
    } catch {
      toast('اجرا ناموفق بود', 'error');
    } finally {
      setRunning(false);
    }
  }

  const monthlyTotal = rows.filter((r) => r.active && r.frequency === 'monthly').reduce((s, r) => s + r.amount, 0);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div className="acc-kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="acc-kpi">
          <div className="k-label"><RefreshCcw size={15} /> تعهد ماهانه</div>
          <div className="k-value">{formatMoneyUnit(monthlyTotal, business.currency)}</div>
        </div>
        <div className="acc-kpi">
          <div className="k-label">موارد فعال</div>
          <div className="k-value">{toFaDigits(rows.filter((r) => r.active).length)}</div>
        </div>
        <div className="acc-kpi">
          <div className="k-label">سررسید گذشته</div>
          <div className="k-value">{toFaDigits(rows.filter((r) => r.active && r.next_date_g <= today).length)}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '.6rem', justifyContent: 'flex-start' }}>
        <button className="acc-btn acc-btn-primary" onClick={() => setEditing({ frequency: 'monthly', amount: 0, vat_amount: 0, auto_create: true, active: true, next_date_g: new Date().toISOString().slice(0, 10) })}><Plus size={15} /> هزینه تکرارشونده جدید</button>
        <button className="acc-btn acc-btn-outline" onClick={runDue} disabled={running}><Play size={15} /> {running ? 'در حال اجرا…' : 'اجرای سررسیدهای گذشته'}</button>
      </div>

      <div className="acc-table-wrap">
        <table className="acc-table">
          <thead>
            <tr><th>عنوان</th><th>دسته</th><th>مبلغ (ریال)</th><th>دوره</th><th>سررسید بعدی</th><th>حساب</th><th>وضعیت</th><th>آخرین اجرا</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.title}</td>
                <td>{r.category || '—'}</td>
                <td className="num">{formatMoney(r.amount)}</td>
                <td>{FREQ_LABEL[r.frequency]}</td>
                <td className="num">{formatJalali(r.next_date_g)}</td>
                <td>{r.account?.name || '—'}</td>
                <td>{r.active ? 'فعال' : 'متوقف'}</td>
                <td className="num">{r.last_created_date_g ? formatJalali(r.last_created_date_g) : '—'}</td>
                <td>
                  <div className="row-actions">
                    <button className="acc-icon-btn" onClick={() => setEditing(r)}><Pencil size={14} /></button>
                    <button className="acc-icon-btn danger" onClick={() => remove(r)}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && (
          <EmptyState icon={<RefreshCcw size={34} />} title="هزینه تکرارشونده‌ای ثبت نشده" hint="اجاره‌بها، قسط وام، اینترنت و… را یک‌بار ثبت کنید تا خودکار تکرار شوند" />
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'ویرایش هزینه تکرارشونده' : 'هزینه تکرارشونده جدید'}>
        {editing && (
          <div style={{ display: 'grid', gap: '.8rem' }}>
            <div className="acc-form-grid">
              <Field label="عنوان *"><input className="acc-input" placeholder="مثلاً: اجاره دفتر" value={editing.title || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
              <Field label="دسته هزینه">
                <select className="acc-select" value={editing.category || ''} onChange={(e) => setEditing({ ...editing, category: e.target.value || null })}>
                  <option value="">— انتخاب کنید —</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <div className="acc-form-grid">
              <Field label="مبلغ (ریال)"><MoneyInput value={editing.amount || 0} onChange={(n) => setEditing({ ...editing, amount: n })} /></Field>
              <Field label="مالیات ارزش افزوده (ریال)"><MoneyInput value={editing.vat_amount || 0} onChange={(n) => setEditing({ ...editing, vat_amount: n })} /></Field>
            </div>
            <div className="acc-form-grid">
              <Field label="دوره تکرار">
                <select className="acc-select" value={editing.frequency || 'monthly'} onChange={(e) => setEditing({ ...editing, frequency: e.target.value as AccRecurring['frequency'] })}>
                  <option value="monthly">ماهانه</option>
                  <option value="quarterly">فصلی</option>
                  <option value="yearly">سالانه</option>
                </select>
              </Field>
              <Field label="سررسید بعدی"><JalaliDateInput value={editing.next_date_g || ''} onChange={(iso) => setEditing({ ...editing, next_date_g: iso })} /></Field>
            </div>
            <div className="acc-form-grid">
              <Field label="حساب پرداخت">
                <select className="acc-select" value={editing.account_id || ''} onChange={(e) => setEditing({ ...editing, account_id: e.target.value || null })}>
                  <option value="">— انتخاب کنید —</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Field>
              <Field label="طرف‌حساب">
                <select className="acc-select" value={editing.partner_id || ''} onChange={(e) => setEditing({ ...editing, partner_id: e.target.value || null })}>
                  <option value="">— بدون طرف‌حساب —</option>
                  {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.85rem' }}>
              <input type="checkbox" checked={editing.active ?? true} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
              فعال (در اجراهای خودکار ثبت شود)
            </label>
            <div style={{ display: 'flex', gap: '.6rem' }}>
              <button className="acc-btn acc-btn-primary" onClick={save}>ذخیره</button>
              <button className="acc-btn acc-btn-outline" onClick={() => setEditing(null)}>انصراف</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
