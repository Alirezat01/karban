/* تنظیمات کسب‌وکار — اطلاعات رسمی برای فاکتور، لوگو/امضا/مهر، دسترسی کاربران */

import React, { useEffect, useRef, useState } from 'react';
import { Building2, Image as ImageIcon, PenTool, Shield, Stamp, Trash2, UserPlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { AccBusiness } from '@/lib/acc/types';
import { updateBusiness, uploadAccMedia } from '@/lib/acc/api';
import { Field, Modal, confirmAction, toast } from './ui';
import { featureEnabled } from '@/lib/acc/plan';
import { Lock } from 'lucide-react';

export default function SettingsPage({ business, role, plan, reloadAccess }: { business: AccBusiness; role: string; plan?: string; reloadAccess: () => Promise<void> | void }) {
  const [form, setForm] = useState<AccBusiness>(business);
  const [busy, setBusy] = useState(false);
  const [accesses, setAccesses] = useState<{ id: string; email: string | null; role: string; status: string; user_id: string | null }[]>([]);
  const [invite, setInvite] = useState<{ email: string; role: 'accountant' | 'viewer' } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const uploadKind = useRef<'logo' | 'signature' | 'stamp'>('logo');
  const isOwner = role === 'owner';

  useEffect(() => { setForm(business); }, [business]);

  useEffect(() => {
    if (!isOwner) return;
    (async () => {
      const { data } = await supabase.from('acc_access').select('*').eq('business_id', business.id);
      setAccesses(data || []);
    })();
  }, [business.id, isOwner]);

  const set = (k: keyof AccBusiness, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  async function pickFile(kind: 'logo' | 'signature' | 'stamp') {
    uploadKind.current = kind;
    fileRef.current?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast('حجم فایل باید کمتر از ۲ مگابایت باشد', 'error'); return; }
    setBusy(true);
    try {
      const url = await uploadAccMedia(business.id, file, uploadKind.current);
      const patch = uploadKind.current === 'logo' ? { logo_url: url } : uploadKind.current === 'signature' ? { signature_url: url } : { stamp_url: url };
      await updateBusiness(business.id, patch);
      setForm((f) => ({ ...f, ...patch }));
      toast('آپلود شد و روی فاکتور اعمال گردید');
    } catch {
      toast('آپلود ناموفق بود', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!form.name.trim()) { toast('نام کسب‌وکار الزامی است', 'error'); return; }
    setBusy(true);
    try {
      await updateBusiness(business.id, {
        name: form.name, brand: form.brand, person_type: form.person_type,
        shenase_melli: form.shenase_melli, national_id: form.national_id,
        economic_code: form.economic_code, registration_number: form.registration_number,
        province: form.province, county: form.county, city: form.city, address: form.address,
        postal_code: form.postal_code, phone: form.phone, fax: form.fax,
        default_vat_rate: form.default_vat_rate, currency: form.currency, invoice_prefix: form.invoice_prefix,
      });
      toast('تنظیمات ذخیره شد');
      reloadAccess();
    } catch {
      toast('ذخیره ناموفق بود', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function sendInvite() {
    if (!invite?.email.trim()) { toast('ایمیل را وارد کنید', 'error'); return; }
    try {
      const { error } = await supabase.from('acc_access').insert({
        business_id: business.id,
        email: invite.email.trim(),
        role: invite.role,
        status: 'active',
      });
      if (error) throw error;
      toast('دسترسی ایجاد شد؛ کاربر با همان ایمیل وارد شود');
      setInvite(null);
      const { data } = await supabase.from('acc_access').select('*').eq('business_id', business.id);
      setAccesses(data || []);
    } catch {
      toast('ایجاد دسترسی ناموفق بود', 'error');
    }
  }

  async function revoke(id: string) {
    if (!(await confirmAction('دسترسی این کاربر لغو شود؟'))) return;
    try {
      await supabase.from('acc_access').delete().eq('id', id);
      setAccesses((a) => a.filter((x) => x.id !== id));
      toast('دسترسی لغو شد');
    } catch {
      toast('لغو دسترسی ناموفق بود', 'error');
    }
  }

  const media = [
    { key: 'logo' as const, label: 'لوگوی شرکت', icon: ImageIcon, url: form.logo_url, hint: 'بالای فاکتور چاپ می‌شود' },
    { key: 'signature' as const, label: 'امضای مجاز امضاکننده', icon: PenTool, url: form.signature_url, hint: 'پایین فاکتور' },
    { key: 'stamp' as const, label: 'مهر شرکت', icon: Stamp, url: form.stamp_url, hint: 'کنار امضا' },
  ];

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div className="acc-card">
        <h3><Building2 size={16} /> اطلاعات رسمی کسب‌وکار</h3>
        <div className="acc-form-grid">
          <Field label="نام رسمی *"><input className="acc-input" value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="نام نمایشی / برند" hint="روی فاکتور و هدر پنل"><input className="acc-input" value={form.brand || ''} onChange={(e) => set('brand', e.target.value)} /></Field>
        </div>
        <div className="acc-form-grid" style={{ marginTop: '.8rem' }}>
          <Field label="شخصیت">
            <select className="acc-select" value={form.person_type} onChange={(e) => set('person_type', e.target.value)}>
              <option value="legal">حقوقی (شرکت)</option>
              <option value="real">حقیقی</option>
            </select>
          </Field>
          <Field label="شماره اقتصادی"><input className="acc-input" value={form.economic_code || ''} onChange={(e) => set('economic_code', e.target.value)} /></Field>
        </div>
        <div className="acc-form-grid" style={{ marginTop: '.8rem' }}>
          {form.person_type === 'legal'
            ? <Field label="شناسه ملی"><input className="acc-input" value={form.shenase_melli || ''} onChange={(e) => set('shenase_melli', e.target.value)} /></Field>
            : <Field label="کد ملی"><input className="acc-input" value={form.national_id || ''} onChange={(e) => set('national_id', e.target.value)} /></Field>}
          <Field label="شماره ثبت"><input className="acc-input" value={form.registration_number || ''} onChange={(e) => set('registration_number', e.target.value)} /></Field>
        </div>
        <div className="acc-form-grid" style={{ marginTop: '.8rem' }}>
          <Field label="استان"><input className="acc-input" value={form.province || ''} onChange={(e) => set('province', e.target.value)} /></Field>
          <Field label="شهرستان"><input className="acc-input" value={form.county || ''} onChange={(e) => set('county', e.target.value)} /></Field>
        </div>
        <div className="acc-form-grid" style={{ marginTop: '.8rem' }}>
          <Field label="شهر"><input className="acc-input" value={form.city || ''} onChange={(e) => set('city', e.target.value)} /></Field>
          <Field label="کد پستی (۱۰ رقمی)"><input className="acc-input" inputMode="numeric" value={form.postal_code || ''} onChange={(e) => set('postal_code', e.target.value)} /></Field>
        </div>
        <div className="acc-form-grid" style={{ marginTop: '.8rem' }}>
          <Field label="آدرس کامل"><input className="acc-input" value={form.address || ''} onChange={(e) => set('address', e.target.value)} /></Field>
        </div>
        <div className="acc-form-grid" style={{ marginTop: '.8rem' }}>
          <Field label="تلفن"><input className="acc-input" value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} /></Field>
          <Field label="نمابر"><input className="acc-input" value={form.fax || ''} onChange={(e) => set('fax', e.target.value)} /></Field>
        </div>
        <div className="acc-form-grid" style={{ marginTop: '.8rem' }}>
          <Field label="نرخ پیش‌فرض مالیات ارزش افزوده (٪)" hint="نرخ مصوب ۱۴۰۵: ۱۰٪ — خودکار روی هر ردیف فاکتور اعمال می‌شود">
            <input className="acc-input" inputMode="numeric" value={form.default_vat_rate} onChange={(e) => set('default_vat_rate', Number(e.target.value) || 0)} />
          </Field>
          <Field label="پیشوند شماره فاکتور"><input className="acc-input" value={form.invoice_prefix || ''} onChange={(e) => set('invoice_prefix', e.target.value)} /></Field>
        </div>
        <div style={{ marginTop: '.9rem' }}>
          <button className="acc-btn acc-btn-primary" disabled={busy} onClick={save}>ذخیره تنظیمات</button>
        </div>
      </div>

      <div className="acc-card">
        <h3><Stamp size={16} /> لوگو، امضا و مهر</h3>
        <div className="acc-grid-2-eq">
          {media.map((m) => (
            <div key={m.key} style={{ display: 'flex', gap: '.8rem', alignItems: 'center', padding: '.8rem', border: '1px solid var(--line)', borderRadius: 14, background: 'var(--bg2)' }}>
              <div style={{ width: 76, height: 76, borderRadius: 12, background: '#fff', display: 'grid', placeItems: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {m.url ? <img src={m.url} alt={m.label} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <m.icon size={24} color="var(--muted)" />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '.88rem', color: 'var(--text)' }}>{m.label}</div>
                <div className="acc-hint" style={{ margin: '.2rem 0 .5rem' }}>{m.hint} — PNG یا JPG تا ۲MB</div>
                <div style={{ display: 'flex', gap: '.4rem' }}>
                  <button className="acc-btn acc-btn-outline" style={{ minHeight: 36, fontSize: '.78rem' }} disabled={busy} onClick={() => pickFile(m.key)}>{m.url ? 'تغییر' : 'آپلود'}</button>
                  {m.url ? (
                    <button className="acc-btn acc-btn-danger" style={{ minHeight: 36, fontSize: '.78rem' }} onClick={async () => {
                      await updateBusiness(business.id, m.key === 'logo' ? { logo_url: null } : m.key === 'signature' ? { signature_url: null } : { stamp_url: null });
                      setForm((f) => ({ ...f, [m.key === 'logo' ? 'logo_url' : m.key === 'signature' ? 'signature_url' : 'stamp_url']: null }));
                      toast('حذف شد');
                    }}><Trash2 size={13} /></button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style={{ display: 'none' }}
          onChange={onFile}
        />
      </div>

      {isOwner && featureEnabled(plan, 'accountant_access') && (
        <div className="acc-card">
          <h3><Shield size={16} /> دسترسی کاربران</h3>
          <p className="acc-hint" style={{ marginBottom: '.8rem' }}>حسابدار یا مشاور مالیاتی خود را دعوت کنید؛ فقط با ایمیل کاربری که در کاربان ثبت‌نام کرده است.</p>
          <div className="acc-table-wrap">
            <table className="acc-table" style={{ minWidth: 480 }}>
              <thead><tr><th>ایمیل</th><th>نقش</th><th>وضعیت</th><th></th></tr></thead>
              <tbody>
                {accesses.map((a) => (
                  <tr key={a.id}>
                    <td>{a.email || a.user_id || '—'}</td>
                    <td>{a.role === 'owner' ? 'مالک' : a.role === 'accountant' ? 'حسابدار' : 'مشاهده'}</td>
                    <td><span className={`acc-badge ${a.status === 'active' ? 'ok' : a.status === 'trial' ? 'warn' : 'draft'}`}>{a.status === 'active' ? 'فعال' : a.status === 'trial' ? 'آزمایشی' : 'تعلیق'}</span></td>
                    <td>{a.role !== 'owner' && <button className="acc-icon-btn danger" onClick={() => revoke(a.id)}><Trash2 size={14} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="acc-btn acc-btn-outline" style={{ marginTop: '.8rem' }} onClick={() => setInvite({ email: '', role: 'accountant' })}><UserPlus size={15} /> دعوت حسابدار</button>
        </div>
      )}

      {isOwner && !featureEnabled(plan, 'accountant_access') && (
        <div className="acc-card">
          <h3><Lock size={16} /> دسترسی کاربران — پیشرفته</h3>
          <p className="acc-hint">دعوت حسابدار و مدیریت نقش‌ها مخصوص نسخه پیشرفته است؛ با ارتقای پلن فعال می‌شود.</p>
          <a className="acc-btn acc-btn-primary" href="/حسابداری">مشاهده و ارتقای پلن</a>
        </div>
      )}

      <Modal open={!!invite} onClose={() => setInvite(null)} title="دعوت کاربر جدید">
        {invite && (
          <div style={{ display: 'grid', gap: '.8rem' }}>
            <Field label="ایمیل کاربر *"><input className="acc-input" dir="ltr" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} /></Field>
            <Field label="نقش">
              <select className="acc-select" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value as 'accountant' | 'viewer' })}>
                <option value="accountant">حسابدار (دسترسی کامل عملیات)</option>
                <option value="viewer">فقط مشاهده</option>
              </select>
            </Field>
            <button className="acc-btn acc-btn-primary" onClick={sendInvite}>ایجاد دسترسی</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
