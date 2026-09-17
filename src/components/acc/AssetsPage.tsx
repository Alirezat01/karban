/* دارایی‌های ثابت شرکت — نسخه ۶
   ثبت دارایی، محاسبه خودکار استهلاک خط مستقیم (ماهانه/انباشته) و ارزش دفتری */

import { useEffect, useState } from 'react';
import { Building2, Pencil, Plus, Trash2 } from 'lucide-react';
import type { AccBusiness, AccAsset } from '@/lib/acc/types';
import { assetDepreciation, deleteAsset, listAssets, saveAsset } from '@/lib/acc/api6';
import { listAccounts } from '@/lib/acc/api';
import { formatMoney, formatMoneyUnit } from '@/lib/acc/money';
import { formatJalali, toFaDigits } from '@/lib/acc/jalali';
import { Field, Modal, MoneyInput, QtyInput, JalaliDateInput, confirmAction, toast, EmptyState } from './ui';

export default function AssetsPage({ business }: { business: AccBusiness }) {
  const [rows, setRows] = useState<AccAsset[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [editing, setEditing] = useState<Partial<AccAsset> | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [a, ac] = await Promise.all([listAssets(business.id), listAccounts(business.id)]);
      setRows(a);
      setAccounts(ac.filter((x) => x.active).map((x) => ({ id: x.id, name: x.name })));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [business.id]);

  async function save() {
    if (!editing?.name?.trim()) { toast('نام دارایی الزامی است', 'error'); return; }
    try {
      await saveAsset(business.id, editing);
      toast('ذخیره شد');
      setEditing(null);
      load();
    } catch {
      toast('ذخیره ناموفق بود', 'error');
    }
  }

  async function remove(row: AccAsset) {
    if (!(await confirmAction(`دارایی «${row.name}» حذف شود؟`))) return;
    try {
      await deleteAsset(row.id);
      toast('حذف شد');
      load();
    } catch {
      toast('حذف ناموفق بود', 'error');
    }
  }

  const active = rows.filter((r) => r.status === 'active');
  const totalPurchase = active.reduce((s, r) => s + r.purchase_amount, 0);
  const totalBook = active.reduce((s, r) => s + assetDepreciation(r).bookValue, 0);
  const totalMonthlyDep = active.reduce((s, r) => s + assetDepreciation(r).monthly, 0);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div className="acc-kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="acc-kpi">
          <div className="k-label"><Building2 size={15} /> بهای خرید دارایی‌ها</div>
          <div className="k-value">{formatMoneyUnit(totalPurchase, business.currency)}</div>
        </div>
        <div className="acc-kpi">
          <div className="k-label">ارزش دفتری فعلی</div>
          <div className="k-value">{formatMoneyUnit(totalBook, business.currency)}</div>
        </div>
        <div className="acc-kpi">
          <div className="k-label">استهلاک ماهانه</div>
          <div className="k-value">{formatMoneyUnit(totalMonthlyDep, business.currency)}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <button className="acc-btn acc-btn-primary" onClick={() => setEditing({ status: 'active', purchase_amount: 0, useful_life_years: 5, salvage_value: 0 })}><Plus size={15} /> دارایی جدید</button>
      </div>

      <div className="acc-table-wrap">
        <table className="acc-table">
          <thead>
            <tr><th>دارایی</th><th>دسته</th><th>تاریخ خرید</th><th>بهای خرید</th><th>عمر مفید</th><th>استهلاک ماهانه</th><th>استهلاک انباشته</th><th>ارزش دفتری</th><th>وضعیت</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const dep = assetDepreciation(r);
              return (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td>{r.category || '—'}</td>
                  <td className="num">{r.purchase_date_g ? formatJalali(r.purchase_date_g) : '—'}</td>
                  <td className="num">{formatMoney(r.purchase_amount)}</td>
                  <td className="num">{toFaDigits(r.useful_life_years)} سال</td>
                  <td className="num">{formatMoney(dep.monthly)}</td>
                  <td className="num">{formatMoney(dep.accumulated)}</td>
                  <td className="num" style={{ fontWeight: 700, color: 'var(--gold2)' }}>{formatMoney(dep.bookValue)}</td>
                  <td>{r.status === 'active' ? 'فعال' : r.status === 'sold' ? 'فروخته‌شده' : 'از رده خارج'}</td>
                  <td>
                    <div className="row-actions">
                      <button className="acc-icon-btn" onClick={() => setEditing(r)}><Pencil size={14} /></button>
                      <button className="acc-icon-btn danger" onClick={() => remove(r)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && rows.length === 0 && (
          <EmptyState icon={<Building2 size={34} />} title="دارایی‌ای ثبت نشده" hint="ساختمان، خودرو، تجهیزات و همه دارایی‌های باکیفیت بالای یک سال را ثبت کنید" />
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'ویرایش دارایی' : 'دارایی جدید'}>
        {editing && (
          <div style={{ display: 'grid', gap: '.8rem' }}>
            <div className="acc-form-grid">
              <Field label="نام دارایی *"><input className="acc-input" placeholder="مثلاً: خودرو پژو پارس" value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="دسته">
                <select className="acc-select" value={editing.category || ''} onChange={(e) => setEditing({ ...editing, category: e.target.value || null })}>
                  <option value="">— انتخاب کنید —</option>
                  <option value="ساختمان">ساختمان</option>
                  <option value="خودرو">خودرو</option>
                  <option value="تجهیزات اداری">تجهیزات اداری</option>
                  <option value="تجهیزات تولید">تجهیزات تولید</option>
                  <option value="نرم‌افزار">نرم‌افزار</option>
                  <option value="سایر">سایر</option>
                </select>
              </Field>
            </div>
            <div className="acc-form-grid">
              <Field label="بهای خرید (ریال)"><MoneyInput value={editing.purchase_amount || 0} onChange={(n) => setEditing({ ...editing, purchase_amount: n })} /></Field>
              <Field label="تاریخ خرید"><JalaliDateInput value={editing.purchase_date_g || ''} onChange={(iso) => setEditing({ ...editing, purchase_date_g: iso })} /></Field>
            </div>
            <div className="acc-form-grid">
              <Field label="عمر مفید (سال)" hint="استهلاک خط مستقیم"><QtyInput value={editing.useful_life_years || 5} onChange={(n) => setEditing({ ...editing, useful_life_years: n })} /></Field>
              <Field label="ارزش اسقاط (ریال)"><MoneyInput value={editing.salvage_value || 0} onChange={(n) => setEditing({ ...editing, salvage_value: n })} /></Field>
            </div>
            <div className="acc-form-grid">
              <Field label="حساب پرداخت مرتبط">
                <select className="acc-select" value={editing.account_id || ''} onChange={(e) => setEditing({ ...editing, account_id: e.target.value || null })}>
                  <option value="">— انتخاب کنید —</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Field>
              <Field label="وضعیت">
                <select className="acc-select" value={editing.status || 'active'} onChange={(e) => setEditing({ ...editing, status: e.target.value as AccAsset['status'] })}>
                  <option value="active">فعال</option>
                  <option value="sold">فروخته‌شده</option>
                  <option value="disposed">از رده خارج</option>
                </select>
              </Field>
            </div>
            <Field label="توضیح"><textarea className="acc-input" rows={2} value={editing.notes || ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></Field>
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
