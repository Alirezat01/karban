/* کالا و خدمات — قیمت فروش/خرید، نرخ مالیات، موجودی
   نسخه ۳: شناسه کالا و خدمات سامانه مودیان (انتخابگر جست‌وجودار + واردات فایل رسمی XML) */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileUp, Loader2, Package, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { AccBusiness, AccItem, AccStuffCatalogRow } from '@/lib/acc/types';
import {
  deleteItem, importStuffCatalog, listItems, saveItem,
  searchStuffCatalog, stuffCatalogCount,
} from '@/lib/acc/api';
import { parseStuffFile } from '@/lib/acc/stuff-file';
import { UNITS, VAT_DEFAULT_RATE } from '@/lib/acc/constants';
import { Field, Modal, MoneyInput, confirmAction, toast, EmptyState } from './ui';
import { formatMoney } from '@/lib/acc/money';

/* ───────────── انتخابگر شناسه کالا و خدمات ───────────── */
function StuffPicker({ value, onPick }: {
  value: string | null;
  onPick: (row: AccStuffCatalogRow | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AccStuffCatalogRow[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!query.trim()) { setResults([]); return; }
    setBusy(true);
    timer.current = setTimeout(async () => {
      try { setResults(await searchStuffCatalog(query, 20)); }
      catch { setResults([]); }
      finally { setBusy(false); }
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <input
        className="acc-input"
        placeholder="جست‌وجو: شرح کالا یا شماره شناسه…"
        value={open ? query : value || ''}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => { setOpen(true); setQuery(''); }}
        style={{ paddingLeft: busy ? '2rem' : undefined }}
      />
      {busy && <Loader2 size={15} style={{ position: 'absolute', left: 10, top: 14, animation: 'spin 1s linear infinite', color: 'var(--muted)' }} />}
      {value && !open && (
        <button
          type="button"
          onClick={() => onPick(null)}
          title="حذف شناسه"
          style={{ position: 'absolute', left: 8, top: 9, fontSize: '.7rem', background: 'transparent', border: 'none', color: 'var(--danger, #c0392b)', cursor: 'pointer' }}
        >✕</button>
      )}
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0, left: 0, zIndex: 30,
          background: 'var(--surface, #fff)', border: '1px solid var(--line, #ddd)', borderRadius: 12,
          maxHeight: 260, overflowY: 'auto', boxShadow: '0 12px 30px rgba(0,0,0,.18)',
        }}>
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              className="stuff-option"
              onClick={() => { onPick(r); setOpen(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'right', padding: '.55rem .8rem',
                background: 'transparent', border: 'none', borderBottom: '1px solid var(--line, #eee)',
                cursor: 'pointer', fontSize: '.8rem', color: 'var(--text)',
              }}
            >
              <strong style={{ fontFamily: 'monospace' }}>{r.id}</strong> — {r.description}
              {r.vat ? <span style={{ color: 'var(--muted)' }}> ({r.vat}٪)</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────── مودال واردات فایل رسمی ───────────── */
function ImportCatalogModal({ open, onClose, onDone }: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string>('');

  async function handleFile(file: File) {
    setBusy(true);
    setResult('');
    try {
      const rows = await parseStuffFile(file);
      const count = await importStuffCatalog(rows);
      setResult(`✓ ${count.toLocaleString('fa-IR')} شناسه با موفقیت وارد شد.`);
      toast('کاتالوگ شناسه‌ها به‌روزرسانی شد');
      onDone();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'واردات ناموفق بود';
      setResult(msg);
      toast(msg, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="واردات شناسه‌های رسمی کالا و خدمات">
      <div style={{ display: 'grid', gap: '.9rem', fontSize: '.86rem' }}>
        <p style={{ color: 'var(--muted)', lineHeight: 1.9 }}>
          فایل رسمی «شناسه کالا و خدمات» را از سامانه
          <a href="https://stuffid.tax.gov.ir/" target="_blank" rel="noreferrer" style={{ color: 'var(--gold)', margin: '0 .3rem' }}>stuffid.tax.gov.ir</a>
          دانلود کنید (فرمت XML) و همین‌جا بارگذاری کنید. شناسه‌ها برای همه کسب‌وکارهای شما مشترک می‌شود و هنگام ثبت کالا قابل جست‌وجو خواهد بود.
        </p>
        <label className="acc-btn acc-btn-primary" style={{ justifyContent: 'center', cursor: busy ? 'wait' : 'pointer' }}>
          {busy ? <><Loader2 size={15} className="spin" /> در حال واردات…</> : <><FileUp size={15} /> انتخاب فایل XML یا CSV</>}
          <input
            type="file"
            accept=".xml,.csv,.txt,text/xml,application/xml,text/csv"
            style={{ display: 'none' }}
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = '';
            }}
          />
        </label>
        {result && <div style={{ background: 'var(--surface2, #f7f8fa)', borderRadius: 10, padding: '.7rem .9rem' }}>{result}</div>}
        <small style={{ color: 'var(--muted)' }}>نکته: واردات مجدد همان فایل بی‌خطر است — شناسه‌های تکراری به‌روزرسانی می‌شوند.</small>
      </div>
    </Modal>
  );
}

/* ───────────── صفحه اصلی ───────────── */
export default function ItemsPage({ business }: { business: AccBusiness }) {
  const [rows, setRows] = useState<AccItem[]>([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Partial<AccItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [catalogCount, setCatalogCount] = useState(0);

  async function load() {
    setLoading(true);
    try {
      const [items, count] = await Promise.all([listItems(business.id), stuffCatalogCount()]);
      setRows(items);
      setCatalogCount(count);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [business.id]);

  const filtered = useMemo(
    () => rows.filter((r) => (r.name + (r.code || '') + (r.category || '') + (r.stuff_id || '')).includes(query)),
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
        <button className="acc-btn acc-btn-outline" onClick={() => setImportOpen(true)} title="واردات شناسه‌های رسمی مالیات">
          <FileUp size={15} /> شناسه‌های مودیان
          {catalogCount > 0 ? <span className="acc-badge ok">{catalogCount.toLocaleString('fa-IR')}</span> : null}
        </button>
        <button className="acc-btn acc-btn-primary" onClick={() => setEditing({ kind: 'service', unit: 'عدد', vat_rate: business.default_vat_rate ?? VAT_DEFAULT_RATE })}><Plus size={15} /> کالا / خدمت جدید</button>
      </div>

      {catalogCount === 0 && !loading && (
        <div className="acc-tax-hint" style={{ display: 'flex', gap: '.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Download size={15} />
          <span>هنوز شناسه رسمی «کالا و خدمات» وارد نشده — با دکمه «شناسه‌های مودیان» فایل رسمی مالیات را وارد کنید تا هنگام ثبت کالا قابل انتخاب باشد.</span>
        </div>
      )}

      <div className="acc-table-wrap">
        <table className="acc-table">
          <thead>
            <tr>
              <th>نام</th><th>نوع</th><th>شناسه مودیان</th><th>واحد</th><th>قیمت فروش (ریال)</th><th>قیمت خرید (ریال)</th><th>مالیات</th><th>موجودی</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.name}</td>
                <td>{r.kind === 'goods' ? 'کالا' : 'خدمت'}</td>
                <td className="num" style={{ fontFamily: 'monospace', fontSize: '.72rem' }}>{r.stuff_id || '—'}</td>
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

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'ویرایش کالا / خدمت' : 'کالا / خدمت جدید'} wide>
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
            <Field label="شناسه کالا و خدمات (سامانه مودیان)" hint="از فهرست رسمی مالیات جست‌وجو و انتخاب کنید — روی صورتحساب رسمی چاپ می‌شود">
              <StuffPicker
                value={editing.stuff_id || null}
                onPick={(row) => {
                  if (!row) { setEditing({ ...editing, stuff_id: null }); return; }
                  const patch: Partial<AccItem> = { ...editing, stuff_id: row.id };
                  /* اگر کالا معاف نیست و نرخ رسمی دارد، پیشنهاد بده */
                  if (!editing.vat_exempt && row.vat && row.vat > 0) patch.vat_rate = row.vat;
                  if (!editing.name?.trim()) patch.name = row.description.slice(0, 60);
                  setEditing(patch);
                }}
              />
            </Field>
            <div className="acc-form-grid">
              <Field label="کد کالای داخلی (اختیاری)" hint="کد دلخواه خودتان — جدا از شناسه مودیان"><input className="acc-input" value={editing.code || ''} onChange={(e) => setEditing({ ...editing, code: e.target.value })} /></Field>
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

      <ImportCatalogModal open={importOpen} onClose={() => setImportOpen(false)} onDone={load} />
    </div>
  );
}
