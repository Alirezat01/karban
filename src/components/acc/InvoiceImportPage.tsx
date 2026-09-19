/* ═════════════════════════════════════════════════════════════════════
   واردات فاکتور از Word / PDF / Excel — ویزارد ۳ مرحله‌ای
   ۱) آپلود (چند فایل هم‌زمان)  ۲) پیش‌نمایش و ویرایش  ۳) ثبت گروهی
   موتور پارس: src/lib/acc/api9.ts
   ═════════════════════════════════════════════════════════════════════ */

import React, { useRef, useState } from 'react';
import { FileText, FileUp, Trash2, Wand2, FileSpreadsheet, ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { AccBusiness } from '@/lib/acc/types';
import type { ParsedInvoice } from '@/lib/acc/api9';
import { parseInvoiceFile, downloadTemplateDocx, downloadTemplateXlsx } from '@/lib/acc/api9';
import { listPartners, savePartner, saveInvoice, type InvoicePayload, type DraftItem } from '@/lib/acc/api';
import { formatMoney } from '@/lib/acc/money';
import { toFaDigits } from '@/lib/acc/jalali';
import { confirmAction } from './ui';

type Importable = { file: File; parsed: ParsedInvoice | null; error: string | null };

const INVOICE_TYPE_LABEL: Record<ParsedInvoice['type'], string> = { sale: 'فاکتور فروش', proforma: 'پیش‌فاکتور', purchase: 'فاکتور خرید' };

export default function InvoiceImportPage({ business }: { business: AccBusiness }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [files, setFiles] = useState<Importable[]>([]);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<ParsedInvoice | null>(null);
  const [results, setResults] = useState<{ ok: number; fail: number; messages: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFiles(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    const incoming: Importable[] = [];
    for (const f of Array.from(list)) {
      try {
        const parsed = await parseInvoiceFile(f);
        incoming.push({ file: f, parsed, error: null });
      } catch (e) {
        incoming.push({ file: f, parsed: null, error: String((e as Error)?.message || e) });
      }
    }
    setFiles((prev) => [...prev, ...incoming]);
    setBusy(false);
    setStep(2);
  }

  /* ── مرحله ۳: ثبت گروهی ── */
  async function createAll() {
    const valid = files.filter((f) => f.parsed);
    if (!valid.length) return;
    if (!(await confirmAction(`${toFaDigits(valid.length)} فاکتور از پیش‌نمایش ثبت شود؟`))) return;
    setBusy(true);
    let ok = 0, fail = 0;
    const messages: string[] = [];
    const partners = await listPartners(business.id).catch(() => []);
    for (const { parsed, file } of valid) {
      const inv = parsed!;
      try {
        if (!inv.items.length) throw new Error('هیچ ردیف قابل معامله‌ای وجود ندارد');
        /* طرف‌حساب: یافتن با نام یا ساخت جدید */
        let partnerId: string | null = null;
        if (inv.buyer) {
          const found = partners.find((p) => p.name.trim() === inv.buyer.trim());
          if (found) partnerId = found.id;
          else {
            const legal = /\b(شرکت|سهامی|مسئولیت|موسسه|مؤسسه|تعاونی|گروه)\b/.test(inv.buyer);
            const newId = await savePartner(business.id, {
              name: inv.buyer.trim(),
              person_type: legal ? 'legal' : 'real',
              kind: inv.type === 'purchase' ? 'supplier' : 'customer',
              ...(legal ? { shenase_melli: inv.buyer_national || null } : { national_id: inv.buyer_national || null }),
            } as never);
            partnerId = newId;
            partners.push({ id: newId, name: inv.buyer.trim() } as never);
            messages.push(`طرف‌حساب جدید ساخته شد: ${inv.buyer}`);
          }
        }
        const items: DraftItem[] = inv.items.map((it) => ({
          item_id: null,
          title: it.title,
          unit: it.unit,
          quantity: it.quantity,
          unit_price: it.unit_price,
          discount: it.discount,
          vat_rate: it.vat_rate,
        }));
        const payload: InvoicePayload = {
          number: inv.number || '',
          type: inv.type,
          status: inv.type === 'proforma' ? 'issued' : 'draft',
          partner_id: partnerId,
          date_g: inv.date_g || new Date().toISOString().slice(0, 10),
          due_date_g: null,
          description: inv.notes || null,
          payment_terms: null,
          is_cash_sale: false,
          items,
        };
        await saveInvoice(business.id, payload);
        ok += 1;
      } catch (e) {
        fail += 1;
        messages.push(`❌ ${file.name}: ${String((e as Error)?.message || e)}`);
      }
    }
    setBusy(false);
    setResults({ ok, fail, messages });
    setStep(3);
  }

  /* ═══ رندر ═══ */
  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div className="acc-card">
        <h3><Wand2 size={16} /> واردات فاکتور از فایل (Word / PDF / Excel)</h3>
        <p className="acc-hint" style={{ margin: 0, maxWidth: 720 }}>
          فاکتورهایی که طبق قالب استاندارد در Word، Excel یا PDF پر شده‌اند را بدهید تا به‌صورت گروهی وارد سیستم شوند.
          برای بهترین نتیجه از قالب‌های آماده زیر شروع کنید — هر فایل = یک فاکتور. فایل PDF بدون لایه متنی قابل خواندن نیست.
        </p>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.8rem' }}>
          <button className="acc-btn acc-btn-outline" onClick={() => downloadTemplateDocx()}><FileText size={15} /> دانلود قالب Word</button>
          <button className="acc-btn acc-btn-outline" onClick={() => downloadTemplateXlsx()}><FileSpreadsheet size={15} /> دانلود قالب Excel</button>
        </div>
      </div>

      {step >= 1 && (
        <div className="acc-card">
          <h3><FileUp size={16} /> ۱) آپلود فایل‌ها</h3>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}
            style={{ border: '2px dashed rgba(216,165,63,.4)', borderRadius: 14, padding: '2rem', textAlign: 'center', cursor: 'pointer', color: 'var(--muted)' }}
          >
            <FileUp size={30} style={{ margin: '0 auto .6rem', display: 'block', color: 'var(--gold)' }} />
            فایل‌های .docx / .xlsx / .pdf را اینجا بکشید یا کلیک کنید — چند فایل هم‌زمان مجاز است
            <input ref={fileRef} type="file" accept=".docx,.xlsx,.xls,.csv,.pdf" multiple hidden onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />
          </div>
          {busy && <p className="acc-hint">در حال پارس…</p>}
        </div>
      )}

      {step >= 2 && files.length > 0 && (
        <div className="acc-card">
          <h3>۲) پیش‌نمایش و ویرایش ({toFaDigits(files.length)} فایل)</h3>
          <div style={{ display: 'grid', gap: '.7rem' }}>
            {files.map((f, idx) => (
              <div key={idx} className="acc-card" style={{ padding: '.9rem 1rem', borderStyle: f.error ? 'dashed' : 'solid' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                  <FileText size={15} style={{ color: 'var(--gold)' }} />
                  <b style={{ fontSize: '.85rem' }}>{f.file.name}</b>
                  {f.parsed ? (
                    <>
                      <span className="acc-badge ok">{INVOICE_TYPE_LABEL[f.parsed.type]}</span>
                      <span className="acc-badge draft">{toFaDigits(f.parsed.items.length)} ردیف</span>
                      {f.parsed.warnings.length > 0 && <span className="acc-badge warn" title={f.parsed.warnings.join('\n')}><AlertTriangle size={11} /> {toFaDigits(f.parsed.warnings.length)} هشدار</span>}
                    </>
                  ) : (
                    <span className="acc-badge bad">خطا: {f.error}</span>
                  )}
                  <span style={{ flex: 1 }} />
                  {f.parsed && (
                    <>
                      <button className="acc-btn acc-btn-ghost" style={{ minHeight: 34 }} onClick={() => setEdit(edit === f.parsed ? null : f.parsed)}>{edit === f.parsed ? 'بستن' : 'ویرایش'}</button>
                      <button className="acc-icon-btn danger" title="حذف از فهرست" onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}><Trash2 size={14} /></button>
                    </>
                  )}
                </div>
                {f.parsed && (
                  <div style={{ fontSize: '.78rem', color: 'var(--muted)', marginTop: '.45rem', display: 'grid', gap: '.15rem' }}>
                    <span>شماره: {f.parsed.number || '—'} | تاریخ: {f.parsed.date_j || '—'} | خریدار: {f.parsed.buyer || '—'}</span>
                    {f.parsed.warnings.slice(0, 3).map((w, i) => <span key={i} style={{ color: 'var(--gold2)' }}>• {w}</span>)}
                  </div>
                )}
                {edit === f.parsed && f.parsed && (
                  <div style={{ marginTop: '.7rem', display: 'grid', gap: '.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '.5rem' }}>
                      <label className="acc-hint">شماره<input className="acc-input" style={{ minHeight: 38 }} value={f.parsed.number} onChange={(e) => { f.parsed!.number = e.target.value; setEdit({ ...f.parsed! }); }} /></label>
                      <label className="acc-hint">تاریخ (۱۴۰۴/۰۷/۰۱)<input className="acc-input" style={{ minHeight: 38 }} value={f.parsed.date_j} onChange={(e) => { f.parsed!.date_j = e.target.value; setEdit({ ...f.parsed! }); }} /></label>
                      <label className="acc-hint">خریدار<input className="acc-input" style={{ minHeight: 38 }} value={f.parsed.buyer} onChange={(e) => { f.parsed!.buyer = e.target.value; setEdit({ ...f.parsed! }); }} /></label>
                      <label className="acc-hint">نوع<select className="acc-select" style={{ minHeight: 38 }} value={f.parsed.type} onChange={(e) => { f.parsed!.type = e.target.value as ParsedInvoice['type']; setEdit({ ...f.parsed! }); }}>
                        <option value="sale">فاکتور فروش</option><option value="proforma">پیش‌فاکتور</option><option value="purchase">فاکتور خرید</option>
                      </select></label>
                    </div>
                    <div className="acc-table-wrap">
                      <table className="acc-table" style={{ minWidth: 640 }}>
                        <thead><tr><th>شرح</th><th style={{ width: 80 }}>مقدار</th><th style={{ width: 130 }}>مبلغ واحد</th><th style={{ width: 110 }}>تخفیف</th><th style={{ width: 80 }}>مالیات ٪</th><th style={{ width: 40 }}></th></tr></thead>
                        <tbody>
                          {f.parsed.items.map((it, ri) => (
                            <tr key={ri}>
                              <td><input className="acc-input" style={{ minHeight: 36 }} value={it.title} onChange={(e) => { it.title = e.target.value; setEdit({ ...f.parsed! }); }} /></td>
                              <td><input className="acc-input num" dir="ltr" style={{ minHeight: 36 }} value={it.quantity} onChange={(e) => { it.quantity = Number(e.target.value) || 0; setEdit({ ...f.parsed! }); }} /></td>
                              <td><input className="acc-input num" dir="ltr" style={{ minHeight: 36 }} value={it.unit_price} onChange={(e) => { it.unit_price = Number(e.target.value.replace(/[^\d]/g, '')) || 0; setEdit({ ...f.parsed! }); }} /></td>
                              <td><input className="acc-input num" dir="ltr" style={{ minHeight: 36 }} value={it.discount} onChange={(e) => { it.discount = Number(e.target.value.replace(/[^\d]/g, '')) || 0; setEdit({ ...f.parsed! }); }} /></td>
                              <td><input className="acc-input num" dir="ltr" style={{ minHeight: 36 }} value={it.vat_rate} onChange={(e) => { it.vat_rate = Number(e.target.value) || 0; setEdit({ ...f.parsed! }); }} /></td>
                              <td><button className="acc-icon-btn danger" onClick={() => { f.parsed!.items.splice(ri, 1); setEdit({ ...f.parsed! }); }}><Trash2 size={13} /></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button className="acc-btn acc-btn-ghost" style={{ minHeight: 34, justifySelf: 'start' }} onClick={() => { f.parsed!.items.push({ title: '', quantity: 1, unit: 'عدد', unit_price: 0, discount: 0, vat_rate: 10 }); setEdit({ ...f.parsed! }); }}>+ افزودن ردیف</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button className="acc-btn acc-btn-primary" disabled={busy || !files.some((f) => f.parsed)} onClick={createAll}><CheckCircle2 size={15} /> ثبت گروهی فاکتورها</button>
            <button className="acc-btn acc-btn-outline" onClick={() => { setFiles([]); setStep(1); }} disabled={busy}>شروع دوباره</button>
          </div>
        </div>
      )}

      {step === 3 && results && (
        <div className="acc-card">
          <h3>۳) نتیجه ثبت</h3>
          <div className="acc-kpi-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div className="acc-kpi"><div className="k-label">ثبت موفق</div><div className="k-value" style={{ color: '#6fdca0' }}>{toFaDigits(results.ok)}</div></div>
            <div className="acc-kpi"><div className="k-label">ناموفق</div><div className="k-value" style={{ color: results.fail ? '#ef9a94' : 'var(--text)' }}>{toFaDigits(results.fail)}</div></div>
          </div>
          {results.messages.length > 0 && (
            <div style={{ marginTop: '.7rem', display: 'grid', gap: '.25rem', fontSize: '.78rem', color: 'var(--muted)' }}>
              {results.messages.map((m, i) => <span key={i}>• {m}</span>)}
            </div>
          )}
          <p className="acc-hint" style={{ marginTop: '.6rem' }}>فاکتورها در حالت پیش‌نویس (به‌جز پیش‌فاکتور که صادر می‌شود) ثبت شدند — از بخش «فاکتورها» بررسی و صدور نهایی کنید.</p>
          <button className="acc-btn acc-btn-outline" style={{ marginTop: '.6rem' }} onClick={() => { setFiles([]); setResults(null); setStep(1); }}><ArrowLeft size={15} /> واردات جدید</button>
        </div>
      )}
    </div>
  );
}
