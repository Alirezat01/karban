/* ضمائم همه اسناد — دکمه + مودال مدیریت پیوست */

import React, { useEffect, useRef, useState } from 'react';
import { Paperclip, Trash2, Upload, X, ExternalLink } from 'lucide-react';
import type { AccBusiness, AccAttachment } from '@/lib/acc/types';
import { addAttachment, deleteAttachment, listAttachments, ENTITY_LABELS } from '@/lib/acc/api7';
import { formatJalali } from '@/lib/acc/jalali';
import { confirmAction, toast } from './ui';

export default function AttachButton({
  business, entityType, entityId, count, onChange,
}: {
  business: AccBusiness;
  entityType: string;
  entityId: string;
  count?: number;
  onChange?: (n: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<AccAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');

  async function load() {
    setLoading(true);
    try {
      const r = await listAttachments(business.id, entityType, entityId);
      setRows(r);
      onChange?.(r.length);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { if (open) load(); /* eslint-disable-next-line */ }, [open]);

  async function pick(f: File | null) {
    if (!f) return;
    setBusy(true);
    try {
      await addAttachment(business.id, entityType, entityId, f, title || undefined);
      setTitle('');
      toast('پیوست ذخیره شد');
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'خطا در بارگذاری', 'error');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function remove(id: string) {
    if (!(await confirmAction('این پیوست حذف شود؟'))) return;
    try {
      await deleteAttachment(id);
      toast('پیوست حذف شد');
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'خطا', 'error');
    }
  }

  return (
    <>
      <button
        className="acc-btn acc-btn-ghost"
        style={{ padding: '.25rem .45rem', minHeight: 0, gap: 3, fontSize: '.72rem' }}
        title={`ضمائم ${ENTITY_LABELS[entityType] || entityType}`}
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
      >
        <Paperclip size={13} />
        {count ? <span style={{ fontWeight: 700 }}>{count}</span> : null}
      </button>
      {open && (
        <div className="acc-modal-overlay" onClick={() => setOpen(false)}>
          <div className="acc-modal" style={{ maxWidth: 560, width: '94%' }} onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-head">
              <h3>ضمائم — {ENTITY_LABELS[entityType] || entityType}</h3>
              <button className="acc-icon-btn" onClick={() => setOpen(false)}><X size={17} /></button>
            </div>
            <div style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', gap: '.5rem', marginBottom: '.8rem' }}>
                <input
                  className="acc-input" style={{ flex: 1 }}
                  placeholder="عنوان پیوست (اختیاری)"
                  value={title} onChange={(e) => setTitle(e.target.value)}
                />
                <button className="acc-btn acc-btn-primary" disabled={busy} onClick={() => fileRef.current?.click()}>
                  <Upload size={15} /> {busy ? '...' : 'افزودن فایل'}
                </button>
                <input ref={fileRef} type="file" hidden onChange={(e) => pick(e.target.files?.[0] || null)} />
              </div>
              {loading ? <p style={{ textAlign: 'center', opacity: .6 }}>در حال بارگذاری…</p>
                : rows.length === 0 ? <p style={{ textAlign: 'center', opacity: .6, padding: '1rem 0' }}>هنوز پیوستی ثبت نشده است</p>
                  : (
                    <div style={{ display: 'grid', gap: '.45rem' }}>
                      {rows.map((a) => (
                        <div key={a.id} className="acc-card" style={{ padding: '.55rem .7rem', display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                          <Paperclip size={14} style={{ opacity: .5, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title || a.file_name}</div>
                            <div style={{ fontSize: '.68rem', opacity: .55 }}>
                              {formatJalali(a.created_at)}{a.file_size ? ` • ${(a.file_size / 1024).toFixed(0)} کیلوبایت` : ''}
                            </div>
                          </div>
                          <a className="acc-icon-btn" href={a.file_url} target="_blank" rel="noreferrer" title="مشاهده"><ExternalLink size={14} /></a>
                          <button className="acc-icon-btn" onClick={() => remove(a.id)} title="حذف"><Trash2 size={14} style={{ color: '#dc2626' }} /></button>
                        </div>
                      ))}
                    </div>
                  )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
