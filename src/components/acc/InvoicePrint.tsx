/* چاپ صورتحساب — ساختار و ظاهر مطابق صورتحساب الکترونیکی سامانه مودیان
   (سه بخش: مشخصات فروشنده، مشخصات خریدار، جدول کالا/خدمات) */

import React, { useEffect, useState } from 'react';
import { ArrowRight, Printer } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { AccBusiness, AccInvoice } from '@/lib/acc/types';
import { getInvoice } from '@/lib/acc/api';
import { amountToWords, formatMoney } from '@/lib/acc/money';
import { formatJalali } from '@/lib/acc/jalali';
import { INVOICE_TYPES } from '@/lib/acc/constants';
import { EmptyState } from './ui';

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
          setItemMap(Object.fromEntries((items || []).map((i: { id: string; code: string | null }) => [i.id, i.code || '—'])));
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
  const base = inv.subtotal - inv.discount_total;
  const cancelled = inv.status === 'cancelled';
  const sellerName = biz ? (biz.brand || biz.name) : '—';

  return (
    <div className="acc-print-page" dir="rtl">
      <div className="inv-toolbar">
        <button className="acc-btn acc-btn-outline" onClick={() => window.print()}><Printer size={15} /> چاپ / ذخیره PDF</button>
        <a className="acc-btn acc-btn-outline" href="/حسابداری/پنل/فاکتورها"><ArrowRight size={15} /> بازگشت</a>
      </div>

      <div className="inv-sheet" style={{ position: 'relative' }}>
        {biz?.logo_url ? <img className="inv-logo" src={biz.logo_url} alt="لوگوی فروشنده" /> : null}

        <div className="inv-besmellah">به نام خدا</div>
        <div className="inv-title">
          {isProforma ? 'پیش‌فاکتور فروش کالا و خدمات' : isPurchase ? 'صورتحساب خرید کالا و خدمات' : 'صورتحساب فروش کالا و خدمات'}
        </div>
        <div className="inv-subtitle">
          ساختار مطابق صورتحساب الکترونیکی سازمان امور مالیاتی — {INVOICE_TYPES[inv.type].label}
          {' '}شماره {inv.number} — تاریخ {formatJalali(inv.date_g, 'long')}
          {inv.due_date_g ? ` — مهلت تسویه ${formatJalali(inv.due_date_g, 'long')}` : ''}
        </div>

        <div className="inv-parties">
          <div className="inv-party">
            <div className="inv-party-head">مشخصات فروشنده</div>
            <div className="inv-party-body">
              <div style={{ gridColumn: 'span 2' }}><b>نام:</b>{sellerName}</div>
              <div><b>{biz?.person_type === 'real' ? 'کد ملی' : 'شناسه ملی'}:</b>{biz?.person_type === 'real' ? (biz?.national_id || '—') : (biz?.shenase_melli || '—')}</div>
              <div><b>شماره اقتصادی:</b>{biz?.economic_code || '—'}</div>
              <div style={{ gridColumn: 'span 2' }}><b>آدرس:</b>{[biz?.province, biz?.city, biz?.address].filter(Boolean).join('، ') || '—'}</div>
              <div><b>کد پستی:</b>{biz?.postal_code || '—'}</div>
              <div><b>تلفن:</b>{biz?.phone || '—'}</div>
            </div>
          </div>
          <div className="inv-party">
            <div className="inv-party-head">مشخصات خریدار</div>
            <div className="inv-party-body">
              <div style={{ gridColumn: 'span 2' }}><b>نام:</b>{inv.partner?.name || 'متفرقه'}</div>
              <div><b>{inv.partner?.person_type === 'legal' ? 'شناسه ملی' : 'کد ملی'}:</b>{inv.partner ? (inv.partner.person_type === 'legal' ? (inv.partner.shenase_melli || '—') : (inv.partner.national_id || '—')) : '—'}</div>
              <div><b>شماره اقتصادی:</b>{inv.partner?.economic_code || '—'}</div>
              <div style={{ gridColumn: 'span 2' }}><b>آدرس:</b>{inv.partner?.address || '—'}</div>
              <div><b>کد پستی:</b>{inv.partner?.postal_code || '—'}</div>
              <div><b>تلفن:</b>{inv.partner?.phone || '—'}</div>
            </div>
          </div>
        </div>

        <table className="inv-table">
          <thead>
            <tr>
              <th style={{ width: 30 }}>ردیف</th>
              <th>شرح کالا / خدمت</th>
              <th style={{ width: 80 }}>شناسه کالا</th>
              <th style={{ width: 55 }}>مقدار</th>
              <th style={{ width: 55 }}>واحد</th>
              <th style={{ width: 90 }}>مبلغ واحد</th>
              <th style={{ width: 75 }}>تخفیف</th>
              <th style={{ width: 95 }}>مبلغ کل</th>
              <th style={{ width: 85 }}>مالیات و عوارض</th>
              <th style={{ width: 100 }}>جمع کل با مالیات</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => {
              const rowBase = Math.round(Number(it.quantity) * it.unit_price) - it.discount;
              return (
                <tr key={it.id}>
                  <td>{i + 1}</td>
                  <td className="right">{it.title}</td>
                  <td>{it.item_id ? (itemMap[it.item_id] || '—') : '—'}</td>
                  <td>{formatMoney(it.quantity)}</td>
                  <td>{it.unit}</td>
                  <td>{formatMoney(it.unit_price)}</td>
                  <td>{formatMoney(it.discount)}</td>
                  <td>{formatMoney(rowBase)}</td>
                  <td>{formatMoney(it.vat_amount)}{it.vat_rate ? ` (${it.vat_rate}٪)` : ''}</td>
                  <td>{formatMoney(rowBase + it.vat_amount)}</td>
                </tr>
              );
            })}
            {items.length === 0 && <tr><td colSpan={10}>ردیفی ثبت نشده</td></tr>}
          </tbody>
        </table>

        <div className="inv-totals">
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="inv-words">
              <b>مبلغ به حروف:</b> {amountToWords(inv.total)}
            </div>
            {inv.description || inv.payment_terms ? (
              <div className="inv-notes">
                {inv.description}
                {inv.payment_terms ? `\nشرایط پرداخت: ${inv.payment_terms}` : ''}
              </div>
            ) : null}
            <div className="inv-meta">
              این صورتحساب توسط «نرم‌افزار حسابداری هوشمند کاربان» صادر شده است — karbanapp.ir
              {isProforma ? ` — اعتبار پیش‌فاکتور: ${inv.due_date_g ? formatJalali(inv.due_date_g, 'long') : '۱۰ روز'}` : ''}
            </div>
          </div>
          <div className="inv-totals-table">
            <div><span>جمع کل</span><span className="num">{formatMoney(inv.subtotal)} ریال</span></div>
            <div><span>تخفیف</span><span className="num">{formatMoney(inv.discount_total)} ریال</span></div>
            <div><span>مبلغ پس از تخفیف</span><span className="num">{formatMoney(base)} ریال</span></div>
            <div><span>مالیات و عوارض ارزش افزوده</span><span className="num">{formatMoney(inv.vat_total)} ریال</span></div>
            <div className="grand"><span>مبلغ قابل پرداخت</span><span className="num">{formatMoney(inv.total)} ریال</span></div>
            {inv.status === 'partial' || inv.status === 'paid' ? (
              <div><span>تسویه‌شده</span><span className="num">{formatMoney(inv.paid_total)} ریال</span></div>
            ) : null}
          </div>
        </div>

        <div className="inv-sign-row">
          <div className="inv-sign">
            {biz?.signature_url ? <img className="sign-img" src={biz.signature_url} alt="امضای فروشنده" /> : null}
            {biz?.stamp_url ? <img className="sign-img inv-stamp" style={{ maxHeight: 76 }} src={biz.stamp_url} alt="مهر فروشنده" /> : null}
            <div className="sign-line">امضا و مهر فروشنده</div>
          </div>
          <div className="inv-sign">
            <div className="sign-line" style={{ marginTop: '2.2rem' }}>امضای خریدار</div>
          </div>
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
