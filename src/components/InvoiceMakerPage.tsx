/* فاکتورساز آنلاین کاربان — ابزار رایگان عمومی (بدون نیاز به ورود)
   یک فاکتور ساده با لوگوی کاربان تولید می‌کند؛ خروجی چاپ/PDF، اکسل و ورد.
   پیش‌نویس در همین مرورگر ذخیره می‌شود. */

import { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, FileText, Plus, Printer, Trash2 } from 'lucide-react';
import { formatMoney, numberToWords } from '@/lib/acc/money';
import { exportExcel, exportFilename, exportWord, htmlTable, printHtml, KARBAN_LOGO_URL, escapeHtml } from '@/lib/acc/export';
import { todayJalali, toFaDigits, JALALI_MONTHS } from '@/lib/acc/jalali';
import KarbanLoader from '@/components/KarbanLoader';

interface Party { name: string; economic_code: string; national_id: string; address: string; phone: string }
interface Row { key: number; title: string; unit: string; qty: number; price: number; discount: number }

const EMPTY_PARTY: Party = { name: '', economic_code: '', national_id: '', address: '', phone: '' };
const UNITS = ['عدد', 'دستگاه', 'بسته', 'کارتن', 'کیلوگرم', 'متر', 'متر مربع', 'لیتر', 'ساعت', 'خدمت', 'پروژه'];
const DRAFT_KEY = 'karban-invoicemaker-draft';

const newRow = (): Row => ({ key: Date.now() + Math.random(), title: '', unit: 'عدد', qty: 1, price: 0, discount: 0 });

function todayJalaliText(): string {
  const t = todayJalali();
  return `${toFaDigits(String(t.jd))} ${JALALI_MONTHS[t.jm - 1]} ${toFaDigits(String(t.jy))}`;
}

export default function InvoiceMakerPage() {
  const [ready, setReady] = useState(false);
  const [seller, setSeller] = useState<Party>(EMPTY_PARTY);
  const [buyer, setBuyer] = useState<Party>(EMPTY_PARTY);
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [vatOn, setVatOn] = useState(true);
  const [vatRate, setVatRate] = useState(10);
  const [notes, setNotes] = useState('');
  const [dateText, setDateText] = useState(todayJalaliText());
  const [number, setNumber] = useState('');

  /* بازیابی پیش‌نویس */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.seller) setSeller({ ...EMPTY_PARTY, ...d.seller });
        if (d.buyer) setBuyer({ ...EMPTY_PARTY, ...d.buyer });
        if (Array.isArray(d.rows) && d.rows.length) setRows(d.rows);
        if (typeof d.vatOn === 'boolean') setVatOn(d.vatOn);
        if (typeof d.vatRate === 'number') setVatRate(d.vatRate);
        if (typeof d.notes === 'string') setNotes(d.notes);
        if (typeof d.dateText === 'string') setDateText(d.dateText);
        if (typeof d.number === 'string') setNumber(d.number);
      }
    } catch { /* پیش‌نویس خراب — نادیده */ }
    setReady(true);
  }, []);

  /* ذخیره خودکار */
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ seller, buyer, rows, vatOn, vatRate, notes, dateText, number }));
    } catch { /* حافظه پر — بی‌خطر */ }
  }, [ready, seller, buyer, rows, vatOn, vatRate, notes, dateText, number]);

  const totals = useMemo(() => {
    let subtotal = 0;
    let discountTotal = 0;
    for (const r of rows) {
      const gross = (Number(r.qty) || 0) * (Number(r.price) || 0);
      const disc = Math.min(Number(r.discount) || 0, gross);
      subtotal += gross;
      discountTotal += disc;
    }
    const base = subtotal - discountTotal;
    const vat = vatOn ? Math.round((base * (Number(vatRate) || 0)) / 100) : 0;
    return { subtotal, discountTotal, base, vat, total: base + vat };
  }, [rows, vatOn, vatRate]);

  const partyValid = (p: Party) => p.name.trim();
  const canExport = rows.some((r) => r.title.trim() && Number(r.qty) > 0);

  /* ───────────── خروجی‌ها ───────────── */
  function invoiceBodyHtml(): string {
    const party = (title: string, p: Party) => `<table style="margin-bottom:10px">
      <thead><tr><th colspan="2">${escapeHtml(title)}</th></tr></thead>
      <tbody>
        <tr><td style="width:32%">نام:</td><td><b>${escapeHtml(p.name) || '—'}</b></td></tr>
        <tr><td>کد اقتصادی:</td><td>${escapeHtml(p.economic_code) || '—'}</td></tr>
        <tr><td>شناسه ملی / کد ملی:</td><td>${escapeHtml(p.national_id) || '—'}</td></tr>
        <tr><td>نشانی:</td><td>${escapeHtml(p.address) || '—'}</td></tr>
        <tr><td>تلفن:</td><td>${escapeHtml(p.phone) || '—'}</td></tr>
      </tbody></table>`;
    const itemRows = rows.filter((r) => r.title.trim()).map((r, i) => {
      const gross = (Number(r.qty) || 0) * (Number(r.price) || 0);
      const disc = Math.min(Number(r.discount) || 0, gross);
      const baseRow = gross - disc;
      const vatRow = vatOn ? Math.round((baseRow * (Number(vatRate) || 0)) / 100) : 0;
      return [
        i + 1, r.title.trim(), r.unit, r.qty, formatMoney(r.price), formatMoney(gross),
        formatMoney(disc), formatMoney(baseRow), vatOn ? `${formatMoney(vatRow)} (${vatRate}٪)` : 'معاف', formatMoney(baseRow + vatRow),
      ];
    });
    const headers = ['#', 'شرح کالا / خدمات', 'واحد', 'مقدار', 'مبلغ واحد', 'مبلغ کل', 'تخفیف', 'پس از تخفیف', 'مالیات ارزش افزوده', 'جمع کل'];
    const body = `
      <div style="display:flex;justify-content:space-between;margin:6px 0 12px">
        <b>شماره فاکتور: ${escapeHtml(number) || '—'}</b>
        <b>تاریخ: ${escapeHtml(dateText)}</b>
      </div>
      ${party('فروشنده', seller)}
      ${party('خریدار', buyer)}
      ${htmlTable(headers, itemRows, ['جمع', '', '', '', '', formatMoney(totals.subtotal), formatMoney(totals.discountTotal), formatMoney(totals.base), formatMoney(totals.vat), formatMoney(totals.total)])}
      <p><b>مبلغ قابل پرداخت به حروف:</b> ${numberToWords(totals.total)} ریال</p>
      ${notes ? `<p><b>توضیحات:</b> ${escapeHtml(notes).replace(/\n/g, '<br/>')}</p>` : ''}
    `;
    return body;
  }

  function doPrint() {
    printHtml('فاکتور فروش', invoiceBodyHtml(), { logoUrl: KARBAN_LOGO_URL });
  }
  function doExcel() {
    const itemRows = rows.filter((r) => r.title.trim()).map((r, i) => {
      const gross = (Number(r.qty) || 0) * (Number(r.price) || 0);
      const baseRow = gross - Math.min(Number(r.discount) || 0, gross);
      const vatRow = vatOn ? Math.round((baseRow * (Number(vatRate) || 0)) / 100) : 0;
      return [i + 1, r.title.trim(), r.unit, r.qty, r.price, gross, r.discount || 0, baseRow, vatRow, baseRow + vatRow];
    });
    void exportExcel(exportFilename('invoice'), [{
      name: 'فاکتور',
      headers: ['#', 'شرح', 'واحد', 'مقدار', 'مبلغ واحد', 'مبلغ کل', 'تخفیف', 'پس از تخفیف', 'مالیات', 'جمع'],
      rows: itemRows,
      footerRows: [['', '', '', '', '', '', '', '', 'قابل پرداخت:', totals.total]],
    }], { title: `فاکتور فروش ${number ? `شماره ${number}` : ''} — ${dateText}` });
  }
  function doWord() {
    exportWord(exportFilename('invoice', undefined, 'doc'), 'فاکتور فروش', invoiceBodyHtml(), KARBAN_LOGO_URL);
  }

  const setRow = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const partyForm = (title: string, p: Party, onChange: (patch: Partial<Party>) => void) => (
    <div className="contact-card calc-card" style={{ flex: 1, minWidth: 260 }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <label>نام {title === 'فروشنده' ? 'فروشنده' : 'خریدار'} {title === 'فروشنده' ? '' : ''} *
        <input value={p.name} onChange={(e) => onChange({ name: e.target.value })} placeholder={title === 'فروشنده' ? 'نام کسب‌وکار شما' : 'نام خریدار'} />
      </label>
      <label>کد اقتصادی
        <input value={p.economic_code} onChange={(e) => onChange({ economic_code: e.target.value })} inputMode="numeric" />
      </label>
      <label>شناسه ملی / کد ملی
        <input value={p.national_id} onChange={(e) => onChange({ national_id: e.target.value })} inputMode="numeric" />
      </label>
      <label>نشانی
        <input value={p.address} onChange={(e) => onChange({ address: e.target.value })} />
      </label>
      <label>تلفن
        <input value={p.phone} onChange={(e) => onChange({ phone: e.target.value })} inputMode="tel" />
      </label>
    </div>
  );

  return (
    <section className="inner-page">
      <div className="container">
        <span className="eyebrow">ابزار رایگان کاربان</span>
        <h1>فاکتورساز آنلاین</h1>
        <p className="lead">
          فاکتور ساده فروش را همین‌جا بساز: مشخصات طرفین، ردیف کالاها، تخفیف و مالیات ارزش افزوده (۱۰٪) خودکار محاسبه می‌شود.
          خروجی چاپ/PDF با سربرگ لوگوی کاربان، به‌همراه فایل اکسل و ورد. ثبت‌نام لازم نیست و پیش‌نویس در همین مرورگر می‌ماند.
        </p>

        {!ready ? <KarbanLoader label="در حال آماده‌سازی فاکتورساز…" /> : (
          <>
            {/* طرفین */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1.4rem' }}>
              {partyForm('فروشنده', seller, (patch) => setSeller({ ...seller, ...patch }))}
              {partyForm('خریدار', buyer, (patch) => setBuyer({ ...buyer, ...patch }))}
            </div>

            {/* مشخصات سند */}
            <div className="contact-card calc-card" style={{ marginTop: '1rem' }}>
              <h3 style={{ marginTop: 0 }}>مشخصات فاکتور</h3>
              <div style={{ display: 'flex', gap: '.8rem', flexWrap: 'wrap' }}>
                <label>شماره فاکتور
                  <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="مثلاً ۱۰۲" />
                </label>
                <label>تاریخ
                  <input value={dateText} onChange={(e) => setDateText(e.target.value)} />
                </label>
                <label style={{ maxWidth: 130 }}>ارزش افزوده
                  <select value={vatOn ? String(vatRate) : 'off'} onChange={(e) => {
                    if (e.target.value === 'off') setVatOn(false);
                    else { setVatOn(true); setVatRate(Number(e.target.value) || 10); }
                  }}>
                    <option value="10">۱۰٪ (۱۴۰۵)</option>
                    <option value="9">۹٪</option>
                    <option value="off">بدون مالیات</option>
                  </select>
                </label>
              </div>
            </div>

            {/* ردیف‌ها */}
            <div className="contact-card calc-card" style={{ marginTop: '1rem', overflowX: 'auto' }}>
              <h3 style={{ marginTop: 0 }}>کالاها و خدمات</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                <thead>
                  <tr style={{ textAlign: 'right', fontSize: '.8rem', color: 'var(--muted)' }}>
                    <th style={{ padding: '.4rem' }}>شرح *</th>
                    <th style={{ padding: '.4rem', width: 110 }}>واحد</th>
                    <th style={{ padding: '.4rem', width: 80 }}>مقدار</th>
                    <th style={{ padding: '.4rem', width: 130 }}>مبلغ واحد (ریال)</th>
                    <th style={{ padding: '.4rem', width: 120 }}>تخفیف (ریال)</th>
                    <th style={{ padding: '.4rem', width: 44 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key}>
                      <td style={{ padding: '.25rem' }}><input value={r.title} onChange={(e) => setRow(r.key, { title: e.target.value })} placeholder="مثلاً: طراحی سایت" /></td>
                      <td style={{ padding: '.25rem' }}>
                        <select value={r.unit} onChange={(e) => setRow(r.key, { unit: e.target.value })}>
                          {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '.25rem' }}><input inputMode="decimal" value={r.qty} onChange={(e) => setRow(r.key, { qty: Number(e.target.value.replace(/[^\d.]/g, '')) || 0 })} /></td>
                      <td style={{ padding: '.25rem' }}><input inputMode="numeric" value={r.price ? r.price.toLocaleString('fa-IR') : ''} onChange={(e) => setRow(r.key, { price: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })} placeholder="۰" /></td>
                      <td style={{ padding: '.25rem' }}><input inputMode="numeric" value={r.discount ? r.discount.toLocaleString('fa-IR') : ''} onChange={(e) => setRow(r.key, { discount: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })} placeholder="۰" /></td>
                      <td style={{ padding: '.25rem' }}>
                        <button type="button" className="button button-outline" style={{ padding: '.4rem .55rem' }} title="حذف ردیف"
                          onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : [newRow()]))}>
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="button button-outline" style={{ marginTop: '.7rem' }} onClick={() => setRows((rs) => [...rs, newRow()])}><Plus size={15} /> افزودن ردیف</button>
            </div>

            {/* جمع‌بندی + توضیحات */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem', alignItems: 'stretch' }}>
              <div className="contact-card calc-card" style={{ flex: 1, minWidth: 260 }}>
                <h3 style={{ marginTop: 0 }}>توضیحات فاکتور</h3>
                <textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="مثلاً: شرایط پرداخت، شماره پیگیری واریز…" />
              </div>
              <div className="contact-card calc-card" style={{ flex: 1, minWidth: 260 }}>
                <h3 style={{ marginTop: 0 }}>جمع‌بندی</h3>
                <div style={{ display: 'grid', gap: '.45rem', fontSize: '.92rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>جمع کل</span><span className="num">{formatMoney(totals.subtotal)} ریال</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>تخفیف</span><span className="num">− {formatMoney(totals.discountTotal)} ریال</span></div>
                  {vatOn && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>مالیات ارزش افزوده ({toFaDigits(String(vatRate))}٪)</span><span className="num">{formatMoney(totals.vat)} ریال</span></div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--line)', paddingTop: '.5rem', fontWeight: 800 }}>
                    <span>قابل پرداخت</span><span className="num">{formatMoney(totals.total)} ریال</span>
                  </div>
                  <small style={{ color: 'var(--muted)' }}>به حروف: {numberToWords(totals.total)} ریال</small>
                </div>
                <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                  <button className="button" disabled={!canExport} onClick={doPrint} title="چاپ یا ذخیره PDF"><Printer size={15} /> چاپ / PDF</button>
                  <button className="button button-outline" disabled={!canExport} onClick={doExcel}><FileSpreadsheet size={15} /> اکسل</button>
                  <button className="button button-outline" disabled={!canExport} onClick={doWord}><FileText size={15} /> ورد</button>
                </div>
                {!canExport && <small style={{ color: 'var(--muted)', display: 'block', marginTop: '.5rem' }}>برای خروجی، حداقل یک ردیف با شرح و مقدار کامل کنید.</small>}
                {!partyValid(seller) && <small style={{ color: 'var(--muted)', display: 'block', marginTop: '.3rem' }}>پیشنهاد: نام فروشنده را کامل کنید تا روی فاکتور درج شود.</small>}
              </div>
            </div>

            <div className="contact-card" style={{ marginTop: '1rem', fontSize: '.85rem' }}>
              نکته: برای فاکتور رسمی مطابق فرم مالیات با شناسه کالا و خدمات، مدیریت چند کسب‌وکار و گزارش مالیاتی،
              <a href="/حسابداری" style={{ color: 'var(--gold)', margin: '0 .3rem' }}>حسابداری هوشمند کاربان</a>
              را ببینید.
            </div>
          </>
        )}
      </div>
    </section>
  );
}
