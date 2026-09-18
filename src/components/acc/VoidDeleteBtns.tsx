/* ابطال (void) و حذف کامل (delete) اسناد — دکمه‌های استاندارد با دلیل ابطال */

import React, { useState } from 'react';
import { Ban, Trash2, X } from 'lucide-react';
import { confirmAction, toast } from './ui';

export function VoidDeleteBtns({
  onVoid, onDelete, voidLabel = 'ابطال', deleteLabel = 'حذف کامل', compact = true, disabled,
}: {
  onVoid: (reason: string) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  voidLabel?: string;
  deleteLabel?: string;
  compact?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function doVoid() {
    setBusy(true);
    try {
      await onVoid(reason.trim());
      toast('سند ابطال شد');
      setOpen(false);
      setReason('');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'خطا در ابطال', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    if (!(await confirmAction(`${deleteLabel}؟ این عمل بازگشت‌پذیر نیست و سند حسابداری مرتبط هم حذف می‌شود.`))) return;
    try {
      await onDelete();
      toast('سند حذف شد');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'خطا در حذف', 'error');
    }
  }

  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <button
        className="acc-icon-btn" title={voidLabel} disabled={disabled}
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
      >
        <Ban size={14} style={{ color: '#d97706' }} />
      </button>
      <button
        className="acc-icon-btn" title={deleteLabel} disabled={disabled}
        onClick={(e) => { e.stopPropagation(); doDelete(); }}
      >
        <Trash2 size={14} style={{ color: '#dc2626' }} />
      </button>
      {open && (
        <div className="acc-modal-overlay" onClick={() => setOpen(false)}>
          <div className="acc-modal" style={{ maxWidth: 420, width: '92%' }} onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-head">
              <h3>{voidLabel} سند</h3>
              <button className="acc-icon-btn" onClick={() => setOpen(false)}><X size={17} /></button>
            </div>
            <div style={{ padding: '1rem', display: 'grid', gap: '.7rem' }}>
              <p style={{ fontSize: '.82rem', opacity: .8, margin: 0 }}>
                سند معکوس در دفترخانه ثبت می‌شود و سند باطل علامت می‌خورد. دلیل ابطال (اختیاری):
              </p>
              <textarea
                className="acc-input" rows={2}
                placeholder="مثلاً: اشتباه در مبلغ / انصراف مشتری"
                value={reason} onChange={(e) => setReason(e.target.value)}
              />
              <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-start' }}>
                <button className="acc-btn acc-btn-primary" disabled={busy} onClick={doVoid}>
                  {busy ? '...' : 'ثبت ابطال'}
                </button>
                <button className="acc-btn acc-btn-outline" onClick={() => setOpen(false)}>انصراف</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
