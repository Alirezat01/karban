/* کالا و خدمات — قیمت فروش/خرید، نرخ مالیات، موجودی */

import React, { useEffect, useMemo, useState } from 'react';
import { Package, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { AccBusiness, AccItem } from '@/lib/acc/types';
import { deleteItem, listItems, saveItem } from '@/lib/acc/api';
import { UNITS, VAT_DEFAULT_RATE } from '@/lib/acc/constants';
import { Field, Modal, MoneyInput, confirmAction, toast, EmptyState } from './ui';
import { formatMoney } from '@/lib/acc/money';

export default function ItemsPage({ business }: { business: AccBusiness }) {
  const [rows, setRows] = useState<AccItem[]>([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Partial<AccItem> | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { setRows(await listItems(business.id)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [business.id]);

  const filtered = useMemo(
    () => rows.filter((r) => (r.name + (r.code || '') + (r.category || '')).includes(query)),
    [rows, query],
  );

  async function save() {
    if (!editing?.name?.trim()) { toast('نام کالا/خدمت الزامی است', 'error'); return; }
    try {
      await saveItem(business.id, {
        ...editing,
        vat_exempt: !!editing.vat_exempt,
        vat_rate: editing.vat_exempt ? 0 : (editing.vat_rate ?? business.default_vat_rate),
      });
      toast('ذخیره شد');
      setEditing(null);
      load();
    } catch {
      toast('ذخیره ناموفق بود', 'error');
    }
  }

  async function remove(row: AccItem) {
    if (!(await confirmAction(`«${row.name}» حذف شود؟`))) return;
    try {
      await deleteItem(row.id);
      toast('حذف شد');
      load();
    } catch {
      toast('حذف ناموفق بود', 'error');
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={15} style={{ position: 'absolute', top: 14, right: 12, color: 'var(--muted)' }} />
          <input className="acc-input" placeholder="جست‌وجوی کالا یا خدمت…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ paddingRight: '2.3rem' }} />
        </div>
        <button className="acc-btn acc-btn-primary" onClick={() => setEditing({ kind: 'service', unit: 'عدد', vat_rate: business.default_vat_rate ?? VAT_DEFAULT_RATE })}><Plus size={15} /> کالا / خدمت جدید</button>
      </div>

      <div className="acc-table-wrap">
        <table className="acc-table">
          <thead>
            <tr>
              <th>نام</th><th>نوع</th><th>کد</th><th>واحد</th><th>قیمت فروش (ریال)</th><th>قیمت خرید (ریال)</th><th>مالیات</th><th>موجودی</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.name}</td>
                <td>{r.kind === 'goods' ? 'کالا' : 'خدمت'}</td>
                <td className="num">{r.code || '—'}</td>
                <td>{r.unit}</td>
                <td className="num">{formatMoney(r.sale_price)}</td>
                <td className="num">{formatMoney(r.purchase_price)}</td>
                <td>{r.vat_exempt ? <span className="acc-badge draft">معاف</span> : `${r.vat_rate}٪`}</td>
                <td className="num">{r.track_stock ? formatMoney(r.stock) : '—'}</td>
                <td>
                  <div className="row-actions">
                    <button className="acc-icon-btn" title="ویرایش" onClick={() => setEditing(r)}><Pencil size={14} /></button>
                    <button className="acc-icon-btn danger" title="حذف" onClick={() => remove(r)}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && (
          <EmptyState icon={<Package size={34} />} title="کالا یا خدمتی ثبت نشده" hint="خدمات یا محصولات پرتکرار خود را ثبت کنید تا در فاکتور سریع انتخاب شوند" />
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'ویرایش کالا / خدمت' : 'کالا / خدمت جدید'}>
        {editing && (
          <div style={{ display: 'grid', gap: '.8rem' }}>
            <div className="acc-form-grid">
              <Field label="نام *"><input className="acc-input" value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="نوع">
                <select className="acc-select" value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value as AccItem['kind'] })}>
                  <option value="service">خدمت</option>
                  <option value="goods">کالا</option>
                </select>
              </Field>
            </div>
            <div className="acc-form-grid">
              <Field label="کد کالا (اختیاری)" hint="به‌عنوان شناسه کالا روی فاکتور چاپ می‌شود"><input className="acc-input" value={editing.code || ''} onChange={(e) => setEditing({ ...editing, code: e.target.value })} /></Field>
              <Field label="واحد شمارش">
                <select className="acc-select" value={editing.unit || 'عدد'} onChange={(e) => setEditing({ ...editing, unit: e.target.value })}>
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </Field>
            </div>
            <div className="acc-form-grid">
              <Field label="قیمت فروش (ریال)">
                <MoneyInput value={editing.sale_price || 0} onChange={(n) => setEditing({ ...editing, sale_price: n })} />
              </Field>
              <Field label="قیمت خرید (ریال)">
                <MoneyInput value={editing.purchase_price || 0} onChange={(n) => setEditing({ ...editing, purchase_price: n })} />
              </Field>
            </div>
            <div className="acc-form-grid">
              <Field label="مالیات ارزش افزوده">
                {editing.vat_exempt
                  ? <input className="acc-input" value="معاف" disabled />
                  : (
                    <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
                      <input className="acc-input" inputMode="numeric" value={editing.vat_rate ?? business.default_vat_rate} onChange={(e) => setEditing({ ...editing, vat_rate: Number(e.target.value) || 0 })} />
                      <span style={{ color: 'var(--muted)' }}>٪</span>
                    </div>
                  )}
              </Field>
              <Field label=" ">
                <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.84rem', color: 'var(--text)', minHeight: 46 }}>
                  <input type="checkbox" checked={!!editing.vat_exempt} onChange={(e) => setEditing({ ...editing, vat_exempt: e.target.checked })} />
                  معاف از مالیات ارزش افزوده
                </label>
              </Field>
            </div>
            <div className="acc-form-grid">
              <Field label="مدیریت موجودی انبار">
                <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.84rem', color: 'var(--text)', minHeight: 46 }}>
                  <input type="checkbox" checked={!!editing.track_stock} onChange={(e) => setEditing({ ...editing, track_stock: e.target.checked })} />
                  موجودی به‌صورت خودکار با فروش کم شود
                </label>
              </Field>
              {editing.track_stock ? (
                <Field label="موجودی فعلی">
                  <input className="acc-input" inputMode="numeric" value={editing.stock ?? 0} onChange={(e) => setEditing({ ...editing, stock: Number(e.target.value) || 0 })} />
                </Field>
              ) : null}
            </div>
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
