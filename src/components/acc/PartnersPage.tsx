/* مشتریان و طرف‌حساب‌ها (مشتری/تامین‌کننده) */

import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import type { AccBusiness, AccPartner } from '@/lib/acc/types';
import { deletePartner, listPartners, savePartner } from '@/lib/acc/api';
import { Field, Modal, confirmAction, toast, EmptyState } from './ui';

const empty: Partial<AccPartner> = { kind: 'customer', person_type: 'real', name: '' };

export default function PartnersPage({ business }: { business: AccBusiness }) {
  const [rows, setRows] = useState<AccPartner[]>([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Partial<AccPartner> | null>(null);
  const [loading, setLoading] = useState(true);

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
                <input className="acc-input" value={editing.person_type === 'legal' ? editing.shenase_melli || '' : editing.national_id || ''} onChange={(e) => setEditing(editing.person_type === 'legal' ? { ...editing, shenase_melli: e.target.value } : { ...editing, national_id: e.target.value })} />
              </Field>
            </div>
            <div className="acc-form-grid">
              <Field label="شماره اقتصادی طرف‌حساب"><input className="acc-input" value={editing.economic_code || ''} onChange={(e) => setEditing({ ...editing, economic_code: e.target.value })} /></Field>
              <Field label="کد پستی"><input className="acc-input" value={editing.postal_code || ''} onChange={(e) => setEditing({ ...editing, postal_code: e.target.value })} /></Field>
            </div>
            <div className="acc-form-grid">
              <Field label="تلفن"><input className="acc-input" value={editing.phone || ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></Field>
              <Field label="آدرس"><input className="acc-input" value={editing.address || ''} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></Field>
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
