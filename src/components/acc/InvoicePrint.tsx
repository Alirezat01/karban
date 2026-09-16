/* چاپ صورتحساب رسمی — بازسازی دقیق فرم «صورتحساب فروش کالا و خدمات»
   (پیش‌نویس رسمی درگاه مالیاتی) با فونت و هویت سایت کاربان:
   سه بخش مشخصات فروشنده / مشخصات خریدار / مشخصات کالا یا خدمات
   + جدول ۱۱ ستونه استاندارد + جمع کل قابل پرداخت + نحوه فروش + مهر و امضا */

import React, { useEffect, useState } from 'react';
import { ArrowRight, Printer } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { AccBusiness, AccInvoice, AccPartner } from '@/lib/acc/types';
import { getInvoice } from '@/lib/acc/api';
import { amountToWords, formatMoney } from '@/lib/acc/money';
import { formatJalali } from '@/lib/acc/jalali';
import { KARBAN_LOGO_URL } from '@/lib/acc/export';
import { EmptyState } from './ui';

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

export default function InvoicePrint({ invoiceId }: { invoiceId: string }) {
  const [inv, setInv] = useState<AccInvoice | null>(null);
  const [biz, setBiz] = useState<AccBusiness | null>(null);
  const [itemMap, setItemMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await getInvoice(invoiceId);
        setInv(data);
        if (data) {
          const [{ data: b }, { data: items }] = await Promise.all([
            supabase.from('acc_businesses').select('*').eq('id', data.business_id).maybeSingle(),
            supabase.from('acc_items').select('id, code').eq('business_id', data.business_id),
          ]);
          setBiz((b as AccBusiness) || null);
          setItemMap(Object.fromEntries((items || []).map((i: { id: string; code: string | null }) => [i.id, i.code || DASH])));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [invoiceId]);

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

  const items = inv.acc_invoice_items || [];
  const isProforma = inv.type === 'proforma';
  const isPurchase = inv.type === 'purchase';
  const isReturn = inv.type === 'return_sale';
  const cancelled = inv.status === 'cancelled';
  const title = isProforma
    ? 'پیش‌فاکتور فروش کالا و خدمات'
    : isPurchase
      ? 'صورتحساب خرید کالا و خدمات'
      : isReturn
        ? 'صورتحساب برگشت از فروش کالا و خدمات'
        : 'صورتحساب فروش کالا و خدمات';
  const buyer: Partial<AccPartner> | null = inv.partner
    ? inv.partner
    : null;
  const isCash = inv.is_cash_sale !== false;
  const notes = [inv.description, inv.payment_terms ? `شرایط پرداخت: ${inv.payment_terms}` : ''].filter(Boolean).join('\n');
  /* ردیف‌های خالی تا حداقل ۸ ردیف — مطابق فرم کاغذی */
  const pad = Math.max(0, 8 - items.length);

  return (
    <div className="acc-print-page" dir="rtl">
      <div className="inv-toolbar">
        <button className="acc-btn acc-btn-outline" onClick={() => window.print()}><Printer size={15} /> چاپ / ذخیره PDF</button>
        <a className="acc-btn acc-btn-outline" href="/حسابداری/پنل/فاکتورها"><ArrowRight size={15} /> بازگشت</a>
      </div>

      <div className="fr-sheet" style={{ position: 'relative' }}>
        {/* لوگو: لوگوی کسب‌وکار؛ اگر آپلود نشده باشد لوگوی کاربان */}
        <img className="fr-logo" src={biz?.logo_url || KARBAN_LOGO_URL} alt={biz?.logo_url ? 'لوگوی فروشنده' : 'لوگوی کاربان'} />

        {/* سربرگ فرم: عنوان + شماره سریال + تاریخ */}
        <table className="fr-head"><tbody>
          <tr>
            <td className="fr-head-side">{isProforma ? 'اعتبار پیش‌فاکتور:' : 'شماره سریال:'} <b>{isProforma ? (inv.due_date_g ? formatJalali(inv.due_date_g, 'long') : '۱۰ روز') : inv.number}</b></td>
            <td className="fr-head-title">{title}</td>
            <td className="fr-head-side">تاریخ: <b>{formatJalali(inv.date_g, 'long')}</b></td>
          </tr>
        </tbody></table>

        <PartyTable title="مشخصات فروشنده" p={biz} isSeller />
        <PartyTable title="مشخصات خریدار" p={buyer} isSeller={false} />

        {/* جدول کالا یا خدمات */}
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
                    <td>{i + 1}</td>
                    <td className="fr-code">{it.stuff_id || (it.item_id ? (itemMap[it.item_id] || DASH) : DASH)}</td>
                    <td className="right">{it.title}</td>
                    <td>{formatMoney(it.quantity)}</td>
                    <td>{it.unit}</td>
                    <td>{formatMoney(it.unit_price)}</td>
                    <td>{formatMoney(gross)}</td>
                    <td>{formatMoney(it.discount)}</td>
                    <td>{formatMoney(afterDiscount)}</td>
                    <td>{formatMoney(it.vat_amount)}{it.vat_rate ? <span className="fr-vat-rate"> ({it.vat_rate}٪)</span> : null}</td>
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
          {/* جمع کل قابل پرداخت */}
          <div className="fr-grand">
            <div className="fr-grand-words">
              <b>جمع کل قابل پرداخت:</b> {amountToWords(inv.total)} ریال
            </div>
            <div className="fr-grand-amount">{formatMoney(inv.total)} ریال</div>
          </div>
        </div>

        {/* نحوه فروش + توضیحات */}
        <div className="fr-terms">
          <div className="fr-terms-right">
            <b>شرایط و نحوه فروش:</b>
            <span className={`fr-check${isCash ? ' on' : ''}`}>{isCash ? '☑' : '☐'} نقدی</span>
            <span className={`fr-check${!isCash ? ' on' : ''}`}>{!isCash ? '☑' : '☐'} غیر نقدی</span>
          </div>
          <div className="fr-terms-notes">
            <b>توضیحات:</b>
            {notes ? <span style={{ whiteSpace: 'pre-line' }}>{notes}</span> : null}
            {isProforma ? <span>این سند پیش‌فاکتور است و سند حسابداری ثبت نمی‌کند.</span> : null}
          </div>
        </div>

        {/* مهر و امضا */}
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
          {' '}| شماره صورتحساب: {inv.number}
        </div>

        {cancelled && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
            <div style={{
              transform: 'rotate(-18deg)', fontSize: '4rem', fontWeight: 900, color: 'rgba(179,38,30,.16)',
              border: '6px solid rgba(179,38,30,.16)', borderRadius: 24, padding: '.5rem 3rem',
            }}>ابطال شده</div>
          </div>
        )}
      </div>
    </div>
  );
}
