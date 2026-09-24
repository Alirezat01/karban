/* چاپ صورتحساب — ۱۰ مدل فاکتور
   • دو مدل رایگان (رسمی مالیاتی + مینیمال کاربان) همیشه با لوگوی کاربان
   • هشت مدل پیشرفته (با ارتقا) — لوگوی کسب‌وکار اگر آپلود شده باشد
   • مدل رسمی: بازسازی دقیق فرم «صورتحساب فروش کالا و خدمات» سازمان مالیاتی
   • بقیه مدل‌ها: رندر مدرن با تم‌های رنگی مختلف
   + شناسه‌های مودیان روی چاپ: نوع صورتحساب (۱/۲)، شناسه یکتای پرداخت، خروجی JSON */

import React, { useEffect, useState } from 'react';
import { ArrowRight, Braces, Layers, Lock, Printer } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { AccBusiness, AccInvoice, AccPartner } from '@/lib/acc/types';
import { getInvoice } from '@/lib/acc/api';
import { amountToWords, formatMoney } from '@/lib/acc/money';
import { formatJalali, toFaDigits } from '@/lib/acc/jalali';
import { INVOICE_TEMPLATES, BUYER_TYPES, INVOICE_TYPES, type InvoiceTemplateInfo } from '@/lib/acc/constants';
import { KARBAN_LOGO_URL, exportMoadianJson, type MoadianInvoiceInput } from '@/lib/acc/export';
import { featureEnabled, isProPlan } from '@/lib/acc/plan';
import { EmptyState, toast } from './ui';

const DASH = '—';

function Cell({ label, value, span }: { label: string; value: string | null | undefined; span?: number }) {
  return (
    <td className="fr-cell" colSpan={span}>
      <span className="fr-cell-label">{label}</span>
      <span className="fr-cell-value">{value || DASH}</span>
    </td>
  );
}

/* عرض ستون‌های پایه فرم مشخصات (۶ ستون) — نزدیک به چیدمان فرم کاغذی */
const FR_COLGROUP = (
  <colgroup>
    <col style={{ width: '23%' }} /><col style={{ width: '15%' }} /><col style={{ width: '15%' }} />
    <col style={{ width: '16%' }} /><col style={{ width: '15%' }} /><col style={{ width: '16%' }} />
  </colgroup>
);

function PartyTable({ title, p, isSeller }: { title: string; p: Partial<AccPartner> | AccBusiness | null; isSeller: boolean }) {
  const personLegal = isSeller
    ? (p as AccBusiness)?.person_type !== 'real'
    : (p as AccPartner)?.person_type === 'legal';
  const idLabel = personLegal ? 'شناسه ملی' : 'کد ملی';
  const idValue = personLegal ? ((p as AccBusiness)?.shenase_melli || (p as AccPartner)?.shenase_melli) : ((p as AccBusiness)?.national_id || (p as AccPartner)?.national_id);
  return (
    <div className="fr-section">
      <div className="fr-section-head">{title}</div>
      <table className="fr-grid">
        {FR_COLGROUP}
        <tbody>
        <tr className="fr-row">
          <Cell label="نام شخص حقیقی / حقوقی:" value={isSeller ? ((p as AccBusiness)?.brand || (p as AccBusiness)?.name) : (p as AccPartner)?.name} span={3} />
          <Cell label="شماره اقتصادی:" value={(p as AccBusiness)?.economic_code || (p as AccPartner)?.economic_code} span={2} />
          <Cell label="شماره ثبت:" value={(p as AccBusiness)?.registration_number || (p as AccPartner)?.registration_number} />
        </tr>
        <tr className="fr-row">
          <Cell label="استان:" value={(p as AccBusiness)?.province || (p as AccPartner)?.province} span={2} />
          <Cell label="شهرستان:" value={(p as AccBusiness)?.county || (p as AccPartner)?.county} />
          <Cell label="کد پستی ۱۰ رقمی:" value={(p as AccBusiness)?.postal_code || (p as AccPartner)?.postal_code} span={2} />
          <Cell label="شهر:" value={(p as AccBusiness)?.city || (p as AccPartner)?.city} />
        </tr>
        <tr className="fr-row">
          <Cell label="نشانی:" value={(p as AccBusiness)?.address || (p as AccPartner)?.address} span={3} />
          <Cell label={idLabel + ':'} value={idValue} />
          <Cell label="تلفن:" value={(p as AccBusiness)?.phone || (p as AccPartner)?.phone} />
          <Cell label="نمابر:" value={(p as AccBusiness)?.fax || (p as AccPartner)?.fax} />
        </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ───────────────── مشخصات مشترک تمپلیت‌های مدرن ───────────────── */

interface TplProps {
  tpl: InvoiceTemplateInfo;
  inv: AccInvoice;
  biz: AccBusiness | null;
  buyer: Partial<AccPartner> | null;
  title: string;
  isCash: boolean;
  notes: string;
  logoUrl: string;
  accountName?: string;
}

function partyLines(p: Partial<AccPartner> | AccBusiness | null): [string, string][] {
  if (!p) return [];
  const b = p as AccBusiness;
  const x = p as AccPartner;
  return [
    ['نام', (b.brand as string) || b.name || x.name || ''],
    ['شماره اقتصادی', b.economic_code || x.economic_code || ''],
    [(b.person_type === 'real' || x.person_type === 'real') ? 'کد ملی' : 'شناسه ملی', b.shenase_melli || b.national_id || x.shenase_melli || x.national_id || ''],
    ['تلفن', b.phone || x.phone || ''],
    ['نشانی', b.address || x.address || ''],
    ['کد پستی', b.postal_code || x.postal_code || ''],
  ].map(([k, v]) => [k, v || '']) as [string, string][];
}

function PartyCard({ title, p }: { title: string; p: Partial<AccPartner> | AccBusiness | null }) {
  const lines = partyLines(p).filter(([, v]) => v);
  return (
    <div className="tpl-party">
      <h4>{title}</h4>
      {lines.length === 0 ? <p className="tpl-party-empty">ثبت نشده</p> : lines.map(([k, v]) => (
        <div key={k} className="tpl-party-row"><span>{k}:</span><b>{toFaDigits(v)}</b></div>
      ))}
    </div>
  );
}

function TemplateSheet({ tpl, inv, biz, buyer, title, isCash, notes, logoUrl, accountName, accountNumber, accountSheba }: TplProps & { accountNumber?: string | null; accountSheba?: string | null }) {
  const items = inv.acc_invoice_items || [];
  const isProforma = inv.type === 'proforma';
  const buyerTypeLabel = BUYER_TYPES[inv.buyer_type === 'final' ? 'final' : 'business'];
  const grossAll = items.reduce((s, it) => s + Math.round(Number(it.quantity) * it.unit_price), 0);
  return (
    <div className={`tpl-sheet tpl-${tpl.id}`} dir="rtl">
      {inv.status === 'cancelled' && (
        <div className="tpl-watermark">ابطال شده</div>
      )}
      <header className="tpl-head">
        <img className="tpl-logo" src={logoUrl} alt="لوگو" />
        <div className="tpl-head-mid">
          <div className="tpl-title">{title}</div>
          <div className="tpl-sub">
            شماره: <b>{toFaDigits(inv.number)}</b> · تاریخ: <b>{formatJalali(inv.date_g, 'long')}</b>
          </div>
          <div className="tpl-sub">{isProforma ? 'این سند پیش‌فاکتور است و سند حسابداری ثبت نمی‌کند' : `نوع صورتحساب: ${buyerTypeLabel}`}</div>
        </div>
        <div className="tpl-head-side">
          <span className="tpl-badge">{INVOICE_TYPES[inv.type].short}</span>
          <div className="tpl-big-total">{formatMoney(inv.total)}</div>
          <div className="tpl-sub">مبلغ قابل پرداخت (ریال)</div>
        </div>
      </header>

      <section className="tpl-parties">
        <PartyCard title="مشخصات فروشنده" p={biz} />
        <PartyCard title={inv.type === 'purchase' ? 'مشخصات تامین‌کننده' : 'مشخصات خریدار'} p={buyer} />
      </section>

      <table className="tpl-items">
        <thead>
          <tr>
            <th style={{ width: 30 }}>#</th>
            <th>شرح کالا یا خدمات</th>
            <th style={{ width: 52 }}>مقدار</th>
            <th style={{ width: 52 }}>واحد</th>
            <th style={{ width: 84 }}>مبلغ واحد</th>
            <th style={{ width: 70 }}>تخفیف</th>
            <th style={{ width: 78 }}>مالیات</th>
            <th style={{ width: 92 }}>جمع کل</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={it.id}>
              <td>{toFaDigits(i + 1)}</td>
              <td className="right">{it.title}{it.stuff_id ? <small className="tpl-stuff"> — شناسه کالا: {toFaDigits(it.stuff_id)}</small> : null}</td>
              <td>{formatMoney(it.quantity)}</td>
              <td>{it.unit}</td>
              <td>{formatMoney(it.unit_price)}</td>
              <td>{formatMoney(it.discount)}</td>
              <td>{formatMoney(it.vat_amount)}{it.vat_rate ? <small> ({toFaDigits(it.vat_rate)}٪)</small> : null}</td>
              <td className="tpl-row-total">{formatMoney(Math.round(Number(it.quantity) * it.unit_price) - it.discount + it.vat_amount)}</td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: '1rem' }}>بدون ردیف</td></tr>}
        </tbody>
      </table>

      <div className="tpl-totals">
        <div><span>جمع کل (ریال)</span><b>{formatMoney(grossAll)}</b></div>
        <div><span>تخفیف (ریال)</span><b>{formatMoney(inv.discount_total)}</b></div>
        <div><span>مالیات و عوارض ارزش افزوده (ریال)</span><b>{formatMoney(inv.vat_total)}</b></div>
        <div className="tpl-grand"><span>مبلغ قابل پرداخت</span><b>{formatMoney(inv.total)} ریال</b></div>
        <div className="tpl-words">به حروف: {amountToWords(inv.total)}</div>
      </div>

      <section className="tpl-terms">
        <div className="tpl-terms-row">
          <b>نحوه فروش:</b>
          <span className={isCash ? 'on' : ''}>{isCash ? '☑' : '☐'} نقدی</span>
          <span className={!isCash ? 'on' : ''}>{!isCash ? '☑' : '☐'} غیر نقدی</span>
          {accountName ? <span style={{ marginRight: 'auto' }}>حساب تسویه: <b>{accountName}</b></span> : null}
        </div>
        {(accountNumber || accountSheba) ? (
          <div className="tpl-terms-row" style={{ display: 'block', lineHeight: 1.9 }}>
            <b>اطلاعات پرداخت:</b>
            <span style={{ display: 'block' }}>
              {accountNumber ? <>شماره حساب: <b style={{ fontVariantNumeric: 'tabular-nums' }}>{toFaDigits(accountNumber)}</b>{accountSheba ? ' — ' : null}</> : null}
              {accountSheba ? <>شماره شبا: <b style={{ direction: 'ltr', unicodeBidi: 'isolate', fontVariantNumeric: 'tabular-nums' }}>{toFaDigits(accountSheba)}</b></> : null}
            </span>
          </div>
        ) : null}
        {inv.pay_id ? (
          <div className="tpl-terms-row">شناسه یکتای پرداخت (payId): <b>{toFaDigits(inv.pay_id)}</b></div>
        ) : null}
        {notes ? <div className="tpl-terms-notes"><b>توضیحات:</b><span style={{ whiteSpace: 'pre-line' }}>{notes}</span></div> : null}
      </section>

      {tpl.id === 'ticket' && (
        <div className="tpl-stub">
          <div className="tpl-stub-line">کوپن مشتری — {title} شماره {toFaDigits(inv.number)}</div>
          <div className="tpl-stub-line">مبلغ: <b>{formatMoney(inv.total)} ریال</b> · تاریخ: <b>{formatJalali(inv.date_g)}</b></div>
        </div>
      )}

      <div className="tpl-signs">
        <div className="tpl-sign"><div className="tpl-sign-line">مهر و امضاء فروشنده</div></div>
        <div className="tpl-sign"><div className="tpl-sign-line">مهر و امضاء خریدار</div></div>
      </div>

      <footer className="tpl-foot">صادرشده توسط «نرم‌افزار حسابداری هوشمند کاربان» — karbanapp.ir</footer>
    </div>
  );
}

/* ───────────────── صفحه اصلی چاپ ───────────────── */

export default function InvoicePrint({ invoiceId }: { invoiceId: string }) {
  const [inv, setInv] = useState<AccInvoice | null>(null);
  const [biz, setBiz] = useState<AccBusiness | null>(null);
  const [itemMap, setItemMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<string>('trial');
  const [tpl, setTpl] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const data = await getInvoice(invoiceId);
        setInv(data);
        if (data) {
          const [{ data: b }, { data: items }, { data: acc }] = await Promise.all([
            supabase.from('acc_businesses').select('*').eq('id', data.business_id).maybeSingle(),
            supabase.from('acc_items').select('id, code').eq('business_id', data.business_id),
            supabase.from('acc_access').select('plan, status').eq('business_id', data.business_id).limit(1).maybeSingle(),
          ]);
          setBiz((b as AccBusiness) || null);
          setItemMap(Object.fromEntries((items || []).map((i: { id: string; code: string | null }) => [i.id, i.code || DASH])));
          setPlan((acc as { plan?: string } | null)?.plan || 'trial');

          /* مدل اولیه: انتخاب ذخیره‌شده کاربر ← تنظیمات ادمین ← رسمی */
          const cfgMod = await import('@/lib/acc/config');
          const saved = localStorage.getItem(`karban_tpl_${data.business_id}`);
          let initial = saved || cfgMod.DEFAULT_ACC_CONFIG.default_template || 'official';
          try {
            const conf = await cfgMod.fetchAccConfig();
            if (!saved) initial = conf.default_template || initial;
          } catch { /* پیش‌فرض */ }
          setTpl(initial);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [invoiceId]);

  /* صفحه عمودی برای تمپلیت‌های غیررسمی */
  useEffect(() => {
    if (!tpl || tpl === 'official') return;
    const st = document.createElement('style');
    st.id = 'tpl-page-style';
    st.textContent = '@media print { @page { size: A4 portrait; margin: 9mm; } .tpl-sheet { box-shadow: none; border-radius: 0; max-width: none; } }';
    document.head.appendChild(st);
    return () => { st.remove(); };
  }, [tpl]);

  if (loading) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#eceef1', color: '#556' }}>در حال آماده‌سازی…</div>;
  if (!inv) {
    return (
      <div className="acc-print-page" style={{ display: 'grid', placeItems: 'center' }}>
        <div style={{ background: '#fff', padding: '2rem', borderRadius: 12 }}>
          <EmptyState title="صورتحساب یافت نشد" />
          <a className="acc-btn acc-btn-outline" href="/حسابداری/پنل/فاکتورها" style={{ margin: '0 auto', display: 'table' }}>بازگشت</a>
        </div>
      </div>
    );
  }

  const pro = isProPlan(plan);
  const tplInfo = INVOICE_TEMPLATES.find((t) => t.id === tpl) || INVOICE_TEMPLATES[0];

  function pickTemplate(id: string) {
    const t = INVOICE_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    if (!t.free && !pro) {
      toast('این مدل مخصوص نسخه پیشرفته است — با ارتقای پلن فعال می‌شود', 'error');
      return;
    }
    setTpl(id);
    if (inv) localStorage.setItem(`karban_tpl_${inv.business_id}`, id);
  }

  /* لوگو: مدل‌های رایگان همیشه لوگوی کاربان؛ پیشرفته: لوگوی کسب‌وکار با بازگشت به کاربان */
  const logoUrl = !tplInfo.free && pro && biz?.logo_url ? biz.logo_url : KARBAN_LOGO_URL;

  const items = inv.acc_invoice_items || [];
  const isProforma = inv.type === 'proforma';
  const title = isProforma
    ? 'پیش‌فاکتور فروش کالا و خدمات'
    : inv.type === 'purchase'
      ? 'صورتحساب خرید کالا و خدمات'
      : inv.type === 'return_sale'
        ? 'صورتحساب برگشت از فروش کالا و خدمات'
        : 'صورتحساب فروش کالا و خدمات';
  const buyer: Partial<AccPartner> | null = inv.partner || null;
  const isCash = inv.is_cash_sale !== false;
  const notes = [inv.description, inv.payment_terms ? `شرایط پرداخت: ${inv.payment_terms}` : ''].filter(Boolean).join('\n');
  const pad = Math.max(0, 8 - items.length);
  const canMoadianJson = featureEnabled(plan, 'moadian_json');

  function doMoadianJson() {
    if (!canMoadianJson) { toast('خروجی مودیان مخصوص نسخه پیشرفته است', 'error'); return; }
    const payload: MoadianInvoiceInput = {
      id: inv!.id, number: inv!.number, type: inv!.type, date_g: inv!.date_g,
      is_cash_sale: inv!.is_cash_sale, buyer_type: inv!.buyer_type, pay_id: inv!.pay_id,
      total: inv!.total, vat_total: inv!.vat_total, discount_total: inv!.discount_total,
      description: inv!.description, partner: inv!.partner,
      items: (inv!.acc_invoice_items || []).map((it) => ({
        title: it.title, unit: it.unit, quantity: Number(it.quantity), unit_price: it.unit_price,
        discount: it.discount, vat_rate: it.vat_rate, vat_amount: it.vat_amount,
        row_total: it.row_total, stuff_id: it.stuff_id,
      })),
    };
    exportMoadianJson(payload, {
      name: biz?.brand || biz?.name, shenase_melli: biz?.shenase_melli, national_id: biz?.national_id,
      economic_code: biz?.economic_code, postal_code: biz?.postal_code,
    });
    toast('بسته JSON مودیان دانلود شد');
  }

  return (
    <div className="acc-print-page" dir="rtl">
      {/* نوار ابزار + انتخابگر مدل */}
      <div className="inv-toolbar" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '.5rem' }}>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="acc-btn acc-btn-outline" onClick={() => window.print()}><Printer size={15} /> چاپ / ذخیره PDF</button>
          <button className="acc-btn acc-btn-outline" onClick={doMoadianJson} title={canMoadianJson ? 'بسته JSON آماده ارسال مودیان' : 'مخصوص نسخه پیشرفته'}>
            <Braces size={15} /> خروجی مودیان (JSON)
          </button>
          <a className="acc-btn acc-btn-outline" href="/حسابداری/پنل/فاکتورها"><ArrowRight size={15} /> بازگشت</a>
        </div>
        <div className="tpl-picker">
          <span className="tpl-picker-label"><Layers size={13} /> مدل فاکتور:</span>
          {INVOICE_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.desc}
              className={`tpl-chip${tpl === t.id ? ' active' : ''}${!t.free && !pro ? ' locked' : ''}`}
              onClick={() => pickTemplate(t.id)}
            >
              {!t.free && <Lock size={10} />}
              {t.name}
              <em>{t.free ? 'رایگان' : 'پیشرفته'}</em>
            </button>
          ))}
        </div>
      </div>

      {/* مدل رسمی مالیاتی — فرم کاغذی */}
      {tplInfo.id === 'official' ? (
        <div className="fr-sheet" style={{ position: 'relative' }}>
          {/* مدل رایگان رسمی: همیشه لوگوی کاربان */}
          <img className="fr-logo" src={KARBAN_LOGO_URL} alt="لوگوی کاربان" />

          <table className="fr-head"><tbody>
            <tr>
              <td className="fr-head-side">
                {isProforma ? 'اعتبار پیش‌فاکتور:' : 'شماره سریال:'} <b>{isProforma ? (inv.due_date_g ? formatJalali(inv.due_date_g, 'long') : '۱۰ روز') : toFaDigits(inv.number)}</b>
                {!isProforma && <><br />نوع صورتحساب: <b>{BUYER_TYPES[inv.buyer_type === 'final' ? 'final' : 'business']}</b></>}
              </td>
              <td className="fr-head-title">{title}</td>
              <td className="fr-head-side">
                تاریخ: <b>{formatJalali(inv.date_g, 'long')}</b>
                {inv.pay_id ? <><br />payId: <b>{toFaDigits(inv.pay_id)}</b></> : null}
              </td>
            </tr>
          </tbody></table>

          <PartyTable title="مشخصات فروشنده" p={biz} isSeller />
          <PartyTable title="مشخصات خریدار" p={buyer} isSeller={false} />

          <div className="fr-section">
            <div className="fr-section-head">مشخصات کالا یا خدمات</div>
            <table className="fr-items">
              <thead>
                <tr>
                  <th style={{ width: 32 }}>ردیف</th>
                  <th style={{ width: 62 }}>کد کالا</th>
                  <th>شرح کالا یا خدمات</th>
                  <th style={{ width: 48 }}>مقدار</th>
                  <th style={{ width: 48 }}>واحد</th>
                  <th style={{ width: 78 }}>مبلغ واحد (ریال)</th>
                  <th style={{ width: 74 }}>مبلغ کل (ریال)</th>
                  <th style={{ width: 62 }}>مبلغ تخفیف</th>
                  <th style={{ width: 74 }}>مبلغ کل پس از تخفیف (ریال)</th>
                  <th style={{ width: 74 }}>جمع مالیات و عوارض (ریال)</th>
                  <th style={{ width: 84 }}>جمع کل بعلاوه مالیات و عوارض (ریال)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => {
                  const gross = Math.round(Number(it.quantity) * it.unit_price);
                  const afterDiscount = gross - it.discount;
                  return (
                    <tr key={it.id}>
                      <td>{toFaDigits(i + 1)}</td>
                      <td className="fr-code">{toFaDigits(it.stuff_id || (it.item_id ? (itemMap[it.item_id] || DASH) : DASH))}</td>
                      <td className="right">{it.title}</td>
                      <td>{formatMoney(it.quantity)}</td>
                      <td>{it.unit}</td>
                      <td>{formatMoney(it.unit_price)}</td>
                      <td>{formatMoney(gross)}</td>
                      <td>{formatMoney(it.discount)}</td>
                      <td>{formatMoney(afterDiscount)}</td>
                      <td>{formatMoney(it.vat_amount)}{it.vat_rate ? <span className="fr-vat-rate"> ({toFaDigits(it.vat_rate)}٪)</span> : null}</td>
                      <td>{formatMoney(afterDiscount + it.vat_amount)}</td>
                    </tr>
                  );
                })}
                {Array.from({ length: pad }).map((_, i) => (
                  <tr key={`pad-${i}`} className="fr-pad-row">
                    {Array.from({ length: 11 }).map((__, j) => <td key={j}>&nbsp;</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="fr-grand">
              <div className="fr-grand-words">
                <b>جمع کل قابل پرداخت:</b> {amountToWords(inv.total)} ریال
              </div>
              <div className="fr-grand-amount">{formatMoney(inv.total)} ریال</div>
            </div>
          </div>

          <div className="fr-terms">
            <div className="fr-terms-right">
              <b>شرایط و نحوه فروش:</b>
              <span className={`fr-check${isCash ? ' on' : ''}`}>{isCash ? '☑' : '☐'} نقدی</span>
              <span className={`fr-check${!isCash ? ' on' : ''}`}>{!isCash ? '☑' : '☐'} غیر نقدی</span>
            </div>
            {(inv.account?.account_number || inv.account?.sheba) ? (
              <div style={{ flexBasis: '100%', width: '100%', border: '1.5px solid #232a35', padding: '.5rem .9rem', fontSize: '.76rem', color: '#333', lineHeight: 1.9 }}>
                <b style={{ color: '#10151d' }}>اطلاعات پرداخت:</b>
                {inv.account?.name ? <> حساب تسویه: <b style={{ color: '#10151d' }}>{inv.account.name}</b> —</> : null}
                {inv.account?.account_number ? <> شماره حساب: <b style={{ color: '#10151d', fontVariantNumeric: 'tabular-nums' }}>{toFaDigits(inv.account.account_number)}</b> —</> : null}
                {inv.account?.sheba ? <> شماره شبا: <b style={{ color: '#10151d', direction: 'ltr', unicodeBidi: 'isolate', fontVariantNumeric: 'tabular-nums' }}>{toFaDigits(inv.account.sheba)}</b></> : null}
              </div>
            ) : null}
            <div className="fr-terms-notes">
              <b>توضیحات:</b>
              {notes ? <span style={{ whiteSpace: 'pre-line' }}>{notes}</span> : null}
              {isProforma ? <span>این سند پیش‌فاکتور است و سند حسابداری ثبت نمی‌کند.</span> : null}
            </div>
          </div>

          <div className="fr-sign-row">
            <div className="fr-sign">
              <div className="fr-sign-imgs">
                {biz?.signature_url ? <img src={biz.signature_url} alt="امضای فروشنده" /> : null}
                {biz?.stamp_url ? <img className="fr-stamp" src={biz.stamp_url} alt="مهر فروشنده" /> : null}
              </div>
              <div className="fr-sign-line">مهر و امضاء فروشنده</div>
            </div>
            <div className="fr-sign">
              <div className="fr-sign-imgs" />
              <div className="fr-sign-line">مهر و امضاء خریدار</div>
            </div>
          </div>

          <div className="fr-foot">
            صادرشده توسط «نرم‌افزار حسابداری هوشمند کاربان» — karbanapp.ir
            {' '}| شماره صورتحساب: {toFaDigits(inv.number)}
          </div>

          {inv.status === 'cancelled' && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
              <div style={{
                transform: 'rotate(-18deg)', fontSize: '4rem', fontWeight: 900, color: 'rgba(179,38,30,.16)',
                border: '6px solid rgba(179,38,30,.16)', borderRadius: 24, padding: '.5rem 3rem',
              }}>ابطال شده</div>
            </div>
          )}
        </div>
      ) : (
        <TemplateSheet
          tpl={tplInfo}
          inv={inv}
          biz={biz}
          buyer={buyer}
          title={title}
          isCash={isCash}
          notes={notes}
          logoUrl={logoUrl}
          accountName={inv.account?.name || undefined}
          accountNumber={inv.account?.account_number || undefined}
          accountSheba={inv.account?.sheba || undefined}
        />
      )}
    </div>
  );
}
