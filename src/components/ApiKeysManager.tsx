/* ────────────────────────────────────────────────────────────
   ApiKeysManager — Phase 5.4
   مدیریت کلیدهای API در داشبورد کاربر. کلید کامل فقط یک‌بار نمایش داده می‌شود.
   ──────────────────────────────────────────────────────────── */
import { useEffect, useState } from 'react';
import { Check, Copy, Key, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  listApiKeys, createApiKey, revokeApiKey, deleteApiKey,
  AVAILABLE_SCOPES, type ApiKey,
} from '@/lib/api-keys';
import KarbanLoader from '@/components/KarbanLoader';

export default function ApiKeysManager() {
  const { userId, loading: authLoading } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newScopes, setNewScopes] = useState<string[]>(['contracts', 'calculators']);
  const [newRate, setNewRate] = useState(1000);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [newFullKey, setNewFullKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    setKeys(await listApiKeys());
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!userId) { setLoading(false); return; }
    load();
  }, [userId, authLoading]);

  const toggleScope = (scope: string) => {
    setNewScopes((prev) => prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]);
  };

  const create = async () => {
    if (!newName.trim() || newScopes.length === 0) {
      setErr('نام و حداقل یک دسترسی لازم است');
      return;
    }
    setBusy(true);
    setErr('');
    const result = await createApiKey(newName.trim(), newScopes, newRate);
    if (!result) {
      setErr('ساخت کلید ناموفق بود');
      setBusy(false);
      return;
    }
    setNewFullKey(result.fullKey);
    setNewName('');
    setNewScopes(['contracts', 'calculators']);
    setNewRate(1000);
    setShowCreate(false);
    await load();
    setBusy(false);
  };

  const copyKey = async () => {
    if (!newFullKey) return;
    await navigator.clipboard.writeText(newFullKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (authLoading) return <KarbanLoader label="در حال بررسی نشست…" />;
  if (!userId) {
    return (
      <div className="contact-card calc-card" style={{ textAlign: 'center', padding: '2rem' }}>
        <Key size={36} style={{ opacity: .3, margin: '0 auto .8rem' }} />
        <h3>برای ساخت کلید API، وارد شو</h3>
        <a className="button" href="/ورود">ورود به حساب</a>
      </div>
    );
  }

  return (
    <div className="api-keys-page">
      <div className="api-keys-head">
        <div>
          <h2><Key size={20} /> کلیدهای API</h2>
          <p className="muted-note">برای اتصال اپ‌های خارجی، CRM یا وب‌سایت‌های دیگر به کاربان، یک کلید API بساز.</p>
        </div>
        <button className="button" onClick={() => setShowCreate((v) => !v)}>
          <Plus size={16} /> کلید جدید
        </button>
      </div>

      {newFullKey && (
        <div className="contact-card calc-card" style={{ borderColor: 'rgba(76,175,80,.5)', background: 'rgba(76,175,80,.05)' }}>
          <h3 style={{ marginTop: 0, color: '#66bb6a' }}>✓ کلید ساخته شد</h3>
          <p className="muted-note"><strong>این کلید فقط یک‌بار نمایش داده می‌شود.</strong> آن را همین حالا کپی و در جای امن ذخیره کن:</p>
          <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
            <code style={{ flex: 1, background: 'var(--surface2)', padding: '.7rem .9rem', borderRadius: 8, fontFamily: 'monospace', fontSize: '.82rem', wordBreak: 'break-all' }} dir="ltr">{newFullKey}</code>
            <button className="button button-outline" onClick={copyKey}>
              {copied ? <><Check size={15} /> کپی شد</> : <><Copy size={15} /> کپی</>}
            </button>
          </div>
          <button className="text-link" onClick={() => setNewFullKey(null)} style={{ marginTop: '.6rem' }}>
            بستن
          </button>
        </div>
      )}

      {showCreate && (
        <div className="contact-card calc-card">
          <h3 style={{ marginTop: 0 }}>ساخت کلید جدید</h3>
          <label>نام (برای تشخیص خودت)
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="مثلاً: اپ موبایل، CRM شرکت" />
          </label>
          <div>
            <strong style={{ display: 'block', marginBottom: '.5rem', fontSize: '.9rem' }}>دسترسی‌ها</strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
              {AVAILABLE_SCOPES.map((s) => (
                <label key={s.value} className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={newScopes.includes(s.value)}
                    onChange={() => toggleScope(s.value)}
                  />
                  <span><strong>{s.value}</strong> — {s.label}</span>
                </label>
              ))}
            </div>
          </div>
          <label>سقف درخواست روزانه
            <input
              type="number"
              value={newRate}
              onChange={(e) => setNewRate(Number(e.target.value) || 1000)}
              min={1}
              max={10000}
              style={{ maxWidth: 200 }}
            />
          </label>
          <div style={{ display: 'flex', gap: '.5rem' }}>
            <button className="button" onClick={create} disabled={busy}>
              {busy ? 'در حال ساخت…' : 'ساخت کلید'}
            </button>
            <button className="button button-outline" onClick={() => setShowCreate(false)}>انصراف</button>
          </div>
          {err && <small className="admin-error" style={{ display: 'block', marginTop: '.5rem' }}>{err}</small>}
        </div>
      )}

      {loading ? (
        <KarbanLoader label="در حال بارگیری کلیدها…" />
      ) : keys.length === 0 ? (
        <div className="contact-card calc-card" style={{ textAlign: 'center', padding: '2rem' }}>
          <Key size={36} style={{ opacity: .3, margin: '0 auto .8rem' }} />
          <h3 style={{ justifyContent: 'center' }}>هنوز کلیدی ساخته نشده</h3>
          <p className="muted-note">اولین کلید APIت رو بساز تا بتونی به کاربان از اپ‌های دیگه وصل بشی.</p>
        </div>
      ) : (
        <div className="api-keys-list">
          {keys.map((k) => (
            <div key={k.id} className={`api-key-card${k.is_active ? '' : ' is-disabled'}`}>
              <div className="api-key-head">
                <div>
                  <strong>{k.name}</strong>
                  <code className="api-key-prefix" dir="ltr">{k.key_prefix}…</code>
                </div>
                <span className={`api-key-status ${k.is_active ? 'is-active' : ''}`}>
                  {k.is_active ? 'فعال' : 'غیرفعال'}
                </span>
              </div>
              <div className="api-key-meta">
                <div className="api-key-scopes">
                  {k.scopes.map((s) => <span key={s} className="badge">{s}</span>)}
                </div>
                <small>سقف روزانه: {k.rate_limit_per_day.toLocaleString('fa-IR')}</small>
                {k.last_used_at && <small>آخرین استفاده: {new Date(k.last_used_at).toLocaleDateString('fa-IR')}</small>}
              </div>
              <div className="api-key-actions">
                {k.is_active && (
                  <button className="button button-outline button-small" onClick={async () => {
                    if (await revokeApiKey(k.id)) await load();
                  }}>
                    غیرفعال کردن
                  </button>
                )}
                <button className="button button-outline button-small" onClick={async () => {
                  if (confirm('این کلید حذف شود؟ قابل بازگشت نیست.')) {
                    if (await deleteApiKey(k.id)) await load();
                  }
                }}>
                  <Trash2 size={13} /> حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="legal-box" style={{ marginTop: '1.2rem' }}>
        <h3>چطور از API استفاده کنم؟</h3>
        <p className="muted-note">بعد از ساخت کلید، درخواست‌های HTTP به آدرس <code dir="ltr">https://karbanapp.ir/api/v1/*</code> بفرست و کلید را در هدر <code dir="ltr">x-api-key</code> قرار بده:</p>
        <pre className="code-block" dir="ltr">{`curl -H "x-api-key: kb_live_xxxxx" \\
  https://karbanapp.ir/api/v1/contracts?limit=10`}</pre>
        <p className="muted-note" style={{ marginTop: '.6rem' }}>مستندات کامل در <a href="/api-docs" className="text-link">صفحه مستندات API</a>.</p>
      </div>
    </div>
  );
}
