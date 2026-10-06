/* ────────────────────────────────────────────────────────────
   VaultPage — personal document vault.
   Upload, tag, search, download and delete documents.
   ──────────────────────────────────────────────────────────── */
import { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Search, Tag, Trash2, UploadCloud } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  DOC_TYPES,
  listVault,
  uploadVaultFile,
  saveVaultDoc,
  getVaultUrl,
  deleteVaultDoc,
  type VaultDoc,
} from '@/lib/vault';
import KarbanLoader from '@/components/KarbanLoader';

export default function VaultPage() {
  const { userId, loading: authLoading } = useAuth();
  const [docs, setDocs] = useState<VaultDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    setLoading(true);
    setDocs(await listVault());
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!userId) { setLoading(false); return; }
    load();
  }, [userId, authLoading]);

  const filtered = useMemo(() => {
    return docs.filter((d) => {
      if (filterType && d.doc_type !== filterType) return false;
      if (!search.trim()) return true;
      const q = search.trim();
      return d.title.includes(q) || d.tags.some((t) => t.includes(q)) || (d.notes || '').includes(q);
    });
  }, [docs, search, filterType]);

  if (authLoading) return <KarbanLoader label="در حال بررسی نشست…" />;
  if (!userId) {
    return (
      <div className="contact-card calc-card" style={{ textAlign: 'center', padding: '2rem' }}>
        <h2>برای استفاده از گاوصندوق، وارد شوید</h2>
        <p className="muted-note">گاوصندوق اسناد حقوقی، قراردادها و مدارک مهم شماست — همه با دسترسی امن و خصوصی.</p>
        <a className="button" href="/ورود">ورود به حساب</a>
      </div>
    );
  }

  const handleUpload = async (file: File) => {
    setBusy(true);
    setErr('');
    try {
      const up = await uploadVaultFile(file);
      if (!up) { setErr('آپلود فایل ناموفق بود'); return; }
      const title = file.name.replace(/\.[^.]+$/, '');
      const docType = title.match(/قرارداد|contract/i) ? 'contract'
        : title.match(/کارت|ملی|شناسنامه/i) ? 'id'
        : title.match(/فاکتور|رسید|invoice/i) ? 'invoice'
        : 'other';
      const saved = await saveVaultDoc({
        title, doc_type: docType, file_url: up.path, file_name: file.name, file_size: up.size, tags: [],
      });
      if (!saved) { setErr('ذخیره در دیتابیس ناموفق بود'); return; }
      await load();
      setUploadOpen(false);
    } catch (e) {
      setErr('خطا: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="vault-page">
      <div className="vault-toolbar">
        <div className="vault-search">
          <Search size={16} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جست‌وجو در عنوان، تگ یا یادداشت…" />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">همه انواع</option>
          {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button className="button" onClick={() => setUploadOpen((v) => !v)} disabled={busy}>
          <UploadCloud size={16} /> {busy ? 'در حال آپلود…' : 'آپلود سند'}
        </button>
      </div>

      {uploadOpen && (
        <div className="contact-card calc-card" style={{ marginBottom: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>آپلود سند جدید</h3>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
            }}
            style={{ color: 'var(--muted)', fontSize: '.9rem' }}
          />
          <p className="muted-note">حداکثر حجم: ۱۰ مگابایت. فرمت‌های مجاز: PDF, DOC, DOCX, JPG, PNG, TXT. سند به‌صورت خصوصی و فقط برای شما ذخیره می‌شود.</p>
        </div>
      )}

      {err && <small className="admin-error" style={{ display: 'block', marginBottom: '.8rem' }}>{err}</small>}

      {loading ? (
        <KarbanLoader label="در حال بارگیری اسناد…" />
      ) : filtered.length === 0 ? (
        <div className="contact-card calc-card" style={{ textAlign: 'center', padding: '2.5rem' }}>
          <FileText size={42} style={{ opacity: .3, marginBottom: '.8rem' }} />
          <h2 style={{ justifyContent: 'center' }}>{docs.length === 0 ? 'گاوصندوق خالی است' : 'سندی با این فیلتر پیدا نشد'}</h2>
          <p className="muted-note">{docs.length === 0 ? 'اولین سند مهمت — قرارداد، کارت ملی، فاکتور — رو آپلود کن.' : 'فیلتر رو تغییر بده یا جست‌وجو رو پاک کن.'}</p>
        </div>
      ) : (
        <div className="vault-grid">
          {filtered.map((d) => (
            <article key={d.id} className="vault-card">
              <div className="vault-card-head">
                <FileText size={20} className="vault-icon" />
                <strong className="vault-title">{d.title}</strong>
              </div>
              <div className="vault-meta">
                <span className="badge">{DOC_TYPES.find((t) => t.value === d.doc_type)?.label || d.doc_type}</span>
                <small>{new Date(d.created_at).toLocaleDateString('fa-IR')}</small>
              </div>
              {d.tags.length > 0 && (
                <div className="vault-tags">
                  {d.tags.map((t, i) => <span key={i} className="vault-tag"><Tag size={10} /> {t}</span>)}
                </div>
              )}
              {d.notes && <p className="vault-notes">{d.notes}</p>}
              {d.expires_at && <small className="vault-expiry">انقضا: {new Date(d.expires_at).toLocaleDateString('fa-IR')}</small>}
              <div className="vault-actions">
                <button className="button button-outline button-small" onClick={async () => {
                  const url = await getVaultUrl(d.file_url);
                  if (url) window.open(url, '_blank');
                }}>
                  <Download size={14} /> دانلود
                </button>
                <button className="button button-outline button-small" onClick={async () => {
                  if (confirm('این سند حذف شود؟ قابل بازگشت نیست.')) {
                    if (await deleteVaultDoc(d)) await load();
                  }
                }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
