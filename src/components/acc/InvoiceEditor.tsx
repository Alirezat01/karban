/* صدور و ویرایش صورتحساب — فروش / پیش‌فاکتور / خرید */

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Printer, Save, Send, Trash2 } from 'lucide-react';
import type { AccBusiness, AccInvoice, AccInvoiceItem, AccItem, AccAccount, AccPartner, InvoiceType } from '@/lib/acc/types';
import {
  computeInvoiceTotals, getInvoice, issueInvoice, listAccounts, listItems, listPartners,
  nextInvoiceNumber, saveInvoice, savePartner,
} from '@/lib/acc/api';
import { INVOICE_TYPES, UNITS, BUYER_TYPES } from '@/lib/acc/constants';
import { formatMoney, amountToWords } from '@/lib/acc/money';
import { isoToJalaliInput, dateToISO, toFaDigits } from '@/lib/acc/jalali';
import { Field, JalaliDateInput, Modal, MoneyInput, DigitsInput, QtyInput, toast } from './ui';
import { notifyTelegram } from '@/lib/acc/telegram';

interface Row extends Partial<Omit<AccInvoiceItem, 'row_total' | 'position' | 'invoice_id' | 'business_id' | 'id'>> {
  key: number;
  quantity: number;
  unit_price: number;
  discount: number;
  vat_rate: number;
}

const newRow = (vat: number): Row => ({
  key: Date.now() + Math.random(), item_id: null, title: '', unit: 'عدد',
  quantity: 1, unit_price: 0, discount: 0, vat_rate: vat,
});

export default function InvoiceEditor({ business, invoiceId, presetType }: { business: AccBusiness; invoiceId: string | null; presetType?: InvoiceType }) {
  const isEdit = !!invoiceId;
  const [type, setType] = useState<InvoiceType>(presetType || 'sale');
  const [number, setNumber] = useState('');
  const [partnerId, setPartnerId] = useState<string>('');
  const [dateInput, setDateInput] = useState(dateToISO(new Date()));
  const [dueDate, setDueDate] = useState<string>('');
  const [description, setDescription] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [isCash, setIsCash] = useState(true);
  const [buyerType, setBuyerType] = useState<'business' | 'final'>('business');
  const [payId, setPayId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState<(AccAccount & { balance?: number })[]>([]);
  const [rows, setRows] = useState<Row[]>([newRow(business.default_vat_rate ?? 10)]);
  const [partners, setPartners] = useState<AccPartner[]>([]);
  const [items, setItems] = useState<AccItem[]>([]);
  const [posted, setPosted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [quickPartner, setQuickPartner] = useState<{ name: string; phone: string; national_id: string; person_type: 'real' | 'legal'; shenase_melli: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [p, it, ac] = await Promise.all([listPartners(business.id), listItems(business.id), listAccounts(business.id)]);
        setPartners(p);
        setItems(it);
        setAccounts(ac);
        if (invoiceId) {
          const inv = await getInvoice(invoiceId);
          if (!inv) { toast('صورتحساب یافت نشد', 'error'); return; }
          setType(inv.type);
          setNumber(inv.number);
          setPartnerId(inv.partner_id || '');
          setDateInput(inv.date_g);
          setDueDate(inv.due_date_g || '');
          setDescription(inv.description || '');
          setPaymentTerms(inv.payment_terms || '');
          setIsCash(inv.is_cash_sale !== false);
          setBuyerType(inv.buyer_type === 'final' ? 'final' : 'business');
          setPayId(inv.pay_id || '');
          setAccountId(inv.account_id || '');
          setPosted(!!inv.posted_at);
          setRows((inv.acc_invoice_items || []).map((it2) => ({
            key: Date.now() + Math.random(), item_id: it2.item_id, stuff_id: it2.stuff_id, title: it2.title, unit: it2.unit,
            quantity: Number(it2.quantity), unit_price: it2.unit_price, discount: it2.discount,
            vat_rate: it2.vat_rate,
          })));
        } else {
          setNumber(await nextInvoiceNumber(business.id, presetType || 'sale'));
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business.id, invoiceId]);

  const totals = useMemo(
    () => computeInvoiceTotals(rows.map((r) => ({
      item_id: r.item_id || null, title: r.title || '', unit: r.unit || 'عدد',
      quantity: Number(r.quantity) || 0, unit_price: Number(r.unit_price) || 0,
      discount: Number(r.discount) || 0, vat_rate: Number(r.vat_rate) || 0,
    }))),
    [rows],
  );

  const partnerKind = type === 'purchase' ? 'supplier' : 'customer';
  const partnerOptions = partners.filter((p) => p.kind === 'both' || p.kind === partnerKind);

  function patchRow(key: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  /* انتخاب کالا از فهرست (تایپ نام یا انتخاب datalist) → پرکردن خودکار ردیف */
  function onRowTitle(key: number, title: string) {
    const found = items.find((i) => i.name === title);
    if (found) {
      patchRow(key, {
        title,
        item_id: found.id,
        stuff_id: found.stuff_id ?? null,
        unit: found.unit || 'عدد',
        unit_price: found.sale_price || 0,
        vat_rate: found.vat_exempt ? 0 : (found.vat_rate ?? 0),
      });
    } else {
      patchRow(key, { title, item_id: null, stuff_id: null });
    }
  }

  async function quickAddPartner() {
    if (!quickPartner?.name.trim()) { toast('نام را وارد کنید', 'error'); return; }
    try {
      const id = await savePartner(business.id, {
        name: quickPartner.name.trim(),
        phone: quickPartner.phone || null,
        person_type: quickPartner.person_type,
        national_id: quickPartner.person_type === 'real' ? quickPartner.national_id : null,
        shenase_melli: quickPartner.person_type === 'legal' ? quickPartner.shenase_melli : null,
        kind: type === 'purchase' ? 'supplier' : 'customer',
      });
      const fresh = await listPartners(business.id);
      setPartners(fresh);
      setPartnerId(id);
      setQuickPartner(null);
      toast('طرف‌حساب اضافه شد');
    } catch (e) {
      toast('ثبت طرف‌حساب ناموفق بود — ' + (e instanceof Error ? e.message : ''), 'error');
    }
  }

  function buildPayload(saveStatus: AccInvoice['status']) {
    if (!rows.some((r) => r.title?.trim() && (Number(r.quantity) || 0) > 0)) {
      throw new Error('حداقل یک ردیف با شرح و مقدار کامل کنید');
    }
    if (!number.trim()) throw new Error('شماره صورتحساب الزامی است');
    return {
      id: invoiceId || undefined,
      number: number.trim(),
      type,
      status: saveStatus,
      partner_id: partnerId || null,
      date_g: dateInput,
      due_date_g: dueDate || null,
      description: description || null,
      payment_terms: paymentTerms || null,
      is_cash_sale: isCash,
      buyer_type: buyerType,
      pay_id: payId || null,
      account_id: accountId || null,
      items: rows
        .filter((r) => r.title?.trim())
        .map((r) => ({
          item_id: r.item_id || null, stuff_id: r.stuff_id || null, title: r.title!.trim(), unit: r.unit || 'عدد',
          quantity: Number(r.quantity) || 0, unit_price: Number(r.unit_price) || 0,
          discount: Number(r.discount) || 0, vat_rate: Number(r.vat_rate) || 0,
        })),
    };
  }

  async function persist(saveStatus: AccInvoice['status'], thenPrint = false) {
    setBusy(true);
    try {
      const payload = buildPayload(saveStatus);
      const id = await saveInvoice(business.id, payload);
      if (saveStatus === 'issued') {
        await issueInvoice(id);
        const totals = computeInvoiceTotals(
          rows.filter((r) => r.title?.trim()).map((r) => ({ item_id: r.item_id || null, stuff_id: r.stuff_id || null, title: r.title!.trim(), unit: r.unit || 'عدد', quantity: Number(r.quantity) || 0, unit_price: Number(r.unit_price) || 0, discount: Number(r.discount) || 0, vat_rate: Number(r.vat_rate) || 0 })),
        );
        void notifyTelegram(
          `📄 فاکتور رسمی صادر شد\nکسب‌وکار: ${business.brand || business.name}\nشماره: ${number.trim()}\nمبلغ کل: ${formatMoney(totals.total)} ریال`,
          'invoice',
        );
      }
      toast(saveStatus === 'issued' ? 'صورتحساب صادر و سند حسابداری ثبت شد' : 'پیش‌نویس ذخیره شد');
      if (thenPrint && saveStatus === 'issued') {
        window.location.href = `/حسابداری/پنل/چاپ/${id}`;
      } else if (!invoiceId) {
        window.location.href = `/حسابداری/پنل/فاکتور/${id}`;
      } else {
        window.location.href = '/حسابداری/پنل/فاکتورها';
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'ذخیره ناموفق بود', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p style={{ color: 'var(--muted)' }}>در حال بارگذاری…</p>;

  if (posted) {
    return (
      <div className="acc-card" style={{ textAlign: 'center', padding: '2.5rem' }}>
        <h3 style={{ justifyContent: 'center' }}>این صورتحساب صادر شده است</h3>
        <p style={{ color: 'var(--muted)', fontSize: '.88rem', marginBottom: '1.2rem' }}>
          طبق اصول حسابداری، سند صادره‌شده قابل ویرایش نیست. برای اصلاح، فاکتور را ابطال و صورتحساب جدید صادر کنید.
        </p>
        <div style={{ display: 'flex', gap: '.6rem', justifyContent: 'center' }}>
          <a className="acc-btn acc-btn-primary" href={`/حسابداری/پنل/چاپ/${invoiceId}`}>مشاهده و چاپ</a>
          <a className="acc-btn acc-btn-outline" href="/حسابداری/پنل/فاکتورها">بازگشت به فهرست</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div className="acc-card">
        <div className="acc-form-grid-3">
          {!isEdit ? (
            <Field label="نوع سند">
              <select className="acc-select" value={type} onChange={async (e) => {
                const t = e.target.value as InvoiceType;
                setType(t);
                setNumber(await nextInvoiceNumber(business.id, t));
              }}>
                <option value="sale">صورتحساب فروش</option>
                <option value="proforma">پیش‌فاکتور (استعلام قیمت)</option>
                <option value="purchase">صورتحساب خرید</option>
              </select>
            </Field>
          ) : (
            <Field label="نوع سند"><input className="acc-input" value={INVOICE_TYPES[type].label} disabled /></Field>
          )}
          <Field label="شماره صورتحساب"><DigitsInput value={number} onChange={setNumber} allow="-/" /></Field>
          <Field label="تاریخ" hint={isoToJalaliInput(dateInput)}>
            <JalaliDateInput value={dateInput} onChange={setDateInput} />
          </Field>
        </div>

        <div className="acc-form-grid-3" style={{ marginTop: '.9rem' }}>
          <Field label={type === 'purchase' ? 'تامین‌کننده' : 'خریدار / مشتری'}>
            <div style={{ display: 'flex', gap: '.4rem' }}>
              <select className="acc-select" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
                <option value="">متفرقه / بدون ثبت</option>
                {partnerOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button type="button" className="acc-icon-btn" title="طرف‌حساب جدید" onClick={() => setQuickPartner({ name: '', phone: '', national_id: '', person_type: 'real', shenase_melli: '' })}><Plus size={15} /></button>
            </div>
          </Field>
          <Field label="مهلت تسویه (اختیاری)">
            <JalaliDateInput value={dueDate} onChange={setDueDate} />
          </Field>
          <Field label="شرایط پرداخت">
            <input className="acc-input" placeholder="مثلاً: نصف نقد، بقیه تا پایان ماه" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
          </Field>
        </div>
        <div className="acc-form-grid-3" style={{ marginTop: '.9rem' }}>
          <Field label="نوع خریدار (مودیان)" hint="روی چاپ فاکتور درج می‌شود">
            <select className="acc-select" value={buyerType} onChange={(e) => setBuyerType(e.target.value as 'business' | 'final')}>
              {Object.entries(BUYER_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="شناسه یکتای پرداخت (payId)" hint="طبق دستورالعمل مودیان برای پرداخت‌ها">
            <DigitsInput value={payId} onChange={setPayId} maxLength={30} placeholder="مثلاً: ۱۲۳۴۵۶۷۸۹۰۱۲۳۴۵۶۷۸۹۰" />
          </Field>
          <Field label="حساب مرتبط (بانک / صندوق)" hint="محل واریز یا وجه تسویه — در همه حساب‌ها قابل انتخاب است">
            <select className="acc-select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">— انتخاب نشده —</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} — مانده {formatMoney(a.balance || 0)}</option>)}
            </select>
          </Field>
        </div>
        {(() => {
          const selAcc = accounts.find((a) => a.id === accountId);
          if (!selAcc || (!selAcc.account_number && !selAcc.sheba)) return null;
          return (
            <div className="acc-hint" style={{ marginTop: '.5rem', fontSize: '.78rem', lineHeight: 1.9 }}>
              اطلاعات پرداخت این حساب (زیر صورتحساب چاپ می‌شود):
              {selAcc.account_number ? <> شماره حساب <b style={{ fontVariantNumeric: 'tabular-nums' }}>{selAcc.account_number}</b></> : null}
              {selAcc.account_number && selAcc.sheba ? ' —' : null}
              {selAcc.sheba ? <> شبا <b style={{ direction: 'ltr', unicodeBidi: 'isolate', fontVariantNumeric: 'tabular-nums' }}>{selAcc.sheba}</b></> : null}
              {!selAcc.account_number || !selAcc.sheba ? ' — برای تکمیل، از صفحهٔ «بانک و صندوق» ویرایش کنید' : null}
            </div>
          );
        })()}
        <div style={{ marginTop: '.9rem', display: 'flex', alignItems: 'center', gap: '.8rem', flexWrap: 'wrap' }}>
          <span className="acc-hint" style={{ fontSize: '.78rem' }}>نحوه فروش (چاپ در فرم رسمی):</span>
          <div style={{ display: 'flex', gap: '.4rem' }}>
            <button type="button" className={`acc-btn ${isCash ? 'acc-btn-primary' : 'acc-btn-outline'}`} style={{ minHeight: 38, fontSize: '.8rem' }} onClick={() => setIsCash(true)}>نقدی</button>
            <button type="button" className={`acc-btn ${!isCash ? 'acc-btn-primary' : 'acc-btn-outline'}`} style={{ minHeight: 38, fontSize: '.8rem' }} onClick={() => setIsCash(false)}>غیر نقدی</button>
          </div>
        </div>
      </div>

      <div className="acc-card">
        <h3>ردیف‌های صورتحساب</h3>
          <div className="acc-table-wrap">
          <table className="acc-table" style={{ minWidth: 1150 }}>
            <thead>
              <tr>
                <th style={{ width: 34 }}>#</th>
                <th style={{ width: 300 }}>شرح کالا / خدمت</th>
                <th style={{ width: 90 }}>واحد</th>
                <th style={{ width: 86 }}>مقدار</th>
                <th style={{ width: 180 }}>مبلغ واحد (ریال)</th>
                <th style={{ width: 150 }}>تخفیف (ریال)</th>
                <th style={{ width: 84 }}>مالیات ٪</th>
                <th style={{ width: 130 }}>مبلغ مالیات (ریال)</th>
                <th style={{ width: 140 }}>جمع ردیف (ریال)</th>
                <th style={{ width: 48 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const base = Math.round((Number(r.quantity) || 0) * (Number(r.unit_price) || 0)) - (Number(r.discount) || 0);
                const vat = Math.round((base * (Number(r.vat_rate) || 0)) / 100);
                return (
                  <tr key={r.key}>
                    <td className="num">{toFaDigits(idx + 1)}</td>
                    <td>
                      <input className="acc-input" style={{ minHeight: 46, fontSize: '.95rem', width: '100%' }} placeholder="شرح کالا یا خدمت…" value={r.title || ''} onChange={(e) => onRowTitle(r.key, e.target.value)} list="acc-items-list" />
                      <datalist id="acc-items-list">
                        {items.map((i) => <option key={i.id} value={i.name} />)}
                      </datalist>
                    </td>
                    <td>
                      <select className="acc-select" style={{ minHeight: 40 }} value={r.unit || 'عدد'} onChange={(e) => patchRow(r.key, { unit: e.target.value })}>
                        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>
                    <td><QtyInput value={Number(r.quantity) || 0} onChange={(n) => patchRow(r.key, { quantity: n })} /></td>
                    <td><MoneyInput value={Number(r.unit_price) || 0} onChange={(n) => patchRow(r.key, { unit_price: n })} big /></td>
                    <td><MoneyInput value={Number(r.discount) || 0} onChange={(n) => patchRow(r.key, { discount: n })} /></td>
                    <td><QtyInput value={Number(r.vat_rate) || 0} onChange={(n) => patchRow(r.key, { vat_rate: n })} /></td>
                    <td className="num" style={{ color: 'var(--muted)' }}>{formatMoney(vat)}</td>
                    <td className="num" style={{ color: 'var(--gold2)', fontWeight: 700 }}>{formatMoney(base + vat)}</td>
                    <td>
                      <button className="acc-icon-btn danger" title="حذف ردیف" onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : rs))}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '.8rem', flexWrap: 'wrap', gap: '.6rem' }}>
          <button className="acc-btn acc-btn-outline" onClick={() => setRows((rs) => [...rs, newRow(business.default_vat_rate ?? 10)])}><Plus size={14} /> افزودن ردیف</button>
          <div className="acc-hint">کافیست مبلغ را وارد کنید — مالیات و جمع ردیف فوراً و خودکار پر می‌شوند؛ شرح را از فهرست کالاها انتخاب کنید تا قیمت هم خودکار بیاید.</div>
        </div>
      </div>

      <div className="acc-grid-2-eq">
        <div className="acc-card">
          <h3>توضیحات</h3>
          <textarea className="acc-textarea" rows={5} placeholder="توضیحات روی فاکتور…" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="acc-card">
          <h3>جمع‌بندی مالی</h3>
          <div style={{ display: 'grid', gap: '.55rem', fontSize: '.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>جمع کل</span><span className="num">{formatMoney(totals.subtotal)} ریال</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>تخفیف</span><span className="num">− {formatMoney(totals.discountTotal)} ریال</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>مالیات و عوارض ارزش افزوده</span><span className="num">{formatMoney(totals.vatTotal)} ریال</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--line)', paddingTop: '.6rem', fontWeight: 800, fontSize: '1.05rem', color: 'var(--gold2)' }}>
              <span>مبلغ قابل پرداخت</span><span className="num">{formatMoney(totals.total)} ریال</span>
            </div>
            <div style={{ borderTop: '1px dashed var(--line)', paddingTop: '.5rem', fontSize: '.78rem', color: 'var(--muted)', lineHeight: 1.9 }}>
              به حروف: {amountToWords(totals.total)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '.5rem', marginTop: '1.1rem', flexWrap: 'wrap' }}>
            <button className="acc-btn acc-btn-outline" disabled={busy} onClick={() => persist('draft').catch(() => {})}><Save size={14} /> ذخیره پیش‌نویس</button>
            <button className="acc-btn acc-btn-primary" disabled={busy} onClick={() => persist('issued').catch(() => {})}><Send size={14} /> صدور نهایی</button>
            <button className="acc-btn acc-btn-outline" disabled={busy} onClick={() => persist('issued', true).catch(() => {})}><Printer size={14} /> صدور و چاپ</button>
          </div>
          {type === 'proforma' && <p className="acc-hint" style={{ marginTop: '.6rem' }}>پیش‌فاکتور سند حسابداری ثبت نمی‌کند؛ پس از توافق، آن را به فاکتور فروش تبدیل کنید.</p>}
        </div>
      </div>

      <Modal open={!!quickPartner} onClose={() => setQuickPartner(null)} title="ثبت سریع طرف‌حساب">
        {quickPartner && (
          <div style={{ display: 'grid', gap: '.8rem' }}>
            <div className="acc-form-grid">
              <Field label="نام *"><input className="acc-input" value={quickPartner.name} onChange={(e) => setQuickPartner({ ...quickPartner, name: e.target.value })} /></Field>
              <Field label="شخصیت">
                <select className="acc-select" value={quickPartner.person_type} onChange={(e) => setQuickPartner({ ...quickPartner, person_type: e.target.value as 'real' | 'legal' })}>
                  <option value="real">حقیقی</option>
                  <option value="legal">حقوقی</option>
                </select>
              </Field>
            </div>
            <div className="acc-form-grid">
              <Field label={quickPartner.person_type === 'legal' ? 'شناسه ملی' : 'کد ملی'}>
                <input className="acc-input" value={quickPartner.person_type === 'legal' ? quickPartner.shenase_melli : quickPartner.national_id} onChange={(e) => setQuickPartner(quickPartner.person_type === 'legal' ? { ...quickPartner, shenase_melli: e.target.value } : { ...quickPartner, national_id: e.target.value })} />
              </Field>
              <Field label="تلفن"><input className="acc-input" value={quickPartner.phone} onChange={(e) => setQuickPartner({ ...quickPartner, phone: e.target.value })} /></Field>
            </div>
            <button className="acc-btn acc-btn-primary" onClick={quickAddPartner}>ثبت و انتخاب</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
