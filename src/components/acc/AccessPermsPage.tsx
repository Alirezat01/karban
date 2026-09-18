/* کنترل دسترسی ریزدانه — مجوز عملیاتی برای هر کاربر (فقط مالک) */

import React, { useEffect, useState } from 'react';
import { ShieldCheck, Users } from 'lucide-react';
import type { AccBusiness } from '@/lib/acc/types';
import { listBusinessAccess, saveAccessPerms, myPerms, PERM_KEYS, AccessRow } from '@/lib/acc/api7';
import { Badge, toast } from './ui';

const GROUPS = [...new Set(PERM_KEYS.map((p) => p.group))];

export default function AccessPermsPage({ business, role }: { business: AccBusiness; role: string }) {
  const [rows, setRows] = useState<AccessRow[]>([]);
  const [permsOfRole, setPermsOfRole] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AccessRow | null>(null);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([listBusinessAccess(business.id), myPerms(business.id, role)]);
      setRows(r);
      setPermsOfRole(p);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [business.id]);

  function openEdit(r: AccessRow) {
    if (role !== 'owner') { toast('فقط مالک کسب‌وکار می‌تواند دسترسی‌ها را تغییر دهد', 'error'); return; }
    setEditing(r);
    setDraft({ ...(r.perms || {}) });
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    try {
      await saveAccessPerms(role, editing.id, draft);
      toast('دسترسی‌ها ذخیره شد');
      setEditing(null);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'خطا', 'error');
    } finally {
      setBusy(false);
    }
  }

  const activeCount = (r: AccessRow) => Object.values(r.perms || {}).filter(Boolean).length;
  const has = (key: string) => role === 'owner' || !!permsOfRole[key];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.6rem', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>کنترل دسترسی ریزدانه</h2>
          <p style={{ margin: '.2rem 0 0', fontSize: '.78rem', opacity: .65 }}>
            تعیین اینکه هر کاربر در حد عملیات چه کاری می‌تواند بکند — {role === 'owner' ? 'شما مالک هستید و همه مجوزها را دارید' : 'نقش شما: حسابدار/ناظر'}
          </p>
        </div>
        <span className="acc-chip"><Users size={13} /> {rows.length} کاربر</span>
      </div>

      {loading ? <p style={{ opacity: .6 }}>در حال بارگذاری…</p> : (
        <div style={{ display: 'grid', gap: '.5rem' }}>
          {rows.map((r) => (
            <div key={r.id} className="acc-card" style={{ padding: '.65rem .9rem', display: 'flex', alignItems: 'center', gap: '.6rem', flexWrap: 'wrap' }}>
              <ShieldCheck size={15} style={{ opacity: .5 }} />
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontWeight: 600, fontSize: '.84rem' }}>{r.email || '—'}</div>
                <div style={{ fontSize: '.68rem', opacity: .6 }}>
                  {r.role === 'owner' ? 'مالک' : r.role === 'accountant' ? 'حسابدار' : 'ناظر'}
                  {r.plan ? ` • پلن ${r.plan}` : ''} • {r.status === 'active' ? 'فعال' : r.status === 'trial' ? 'آزمایشی' : 'تعلیق'}
                </div>
              </div>
              {r.role === 'owner'
                ? <Badge tone="ok">دسترسی کامل</Badge>
                : <Badge tone={activeCount(r) > 0 ? 'warn' : 'draft'}>{activeCount(r)} مجوز فعال</Badge>}
              {r.role !== 'owner' && (
                <button className="acc-btn acc-btn-outline" style={{ fontSize: '.72rem' }} onClick={() => openEdit(r)}>
                  تنظیم مجوزها
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* مودال مجوزها */}
      {editing && (
        <div className="acc-modal-overlay" onClick={() => setEditing(null)}>
          <div className="acc-modal acc-modal-wide" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-head">
              <h3>مجوزهای {editing.email}</h3>
            </div>
            <div style={{ padding: '1rem', maxHeight: '60vh', overflowY: 'auto', display: 'grid', gap: '.9rem' }}>
              {GROUPS.map((g) => (
                <div key={g}>
                  <h4 style={{ margin: '0 0 .4rem', fontSize: '.8rem', opacity: .7 }}>{g}</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '.3rem' }}>
                    {PERM_KEYS.filter((p) => p.group === g).map((p) => (
                      <label key={p.key} style={{ display: 'flex', gap: '.4rem', alignItems: 'center', fontSize: '.78rem', cursor: 'pointer', padding: '.25rem .4rem', borderRadius: 6, background: draft[p.key] ? 'rgba(59,130,246,.1)' : undefined }}>
                        <input
                          type="checkbox"
                          checked={!!draft[p.key]}
                          onChange={(e) => setDraft((d) => ({ ...d, [p.key]: e.target.checked }))}
                        />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '.5rem' }}>
                <button className="acc-btn acc-btn-primary" disabled={busy} onClick={save}>ذخیره مجوزها</button>
                <button className="acc-btn acc-btn-outline" onClick={() => setEditing(null)}>انصراف</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
