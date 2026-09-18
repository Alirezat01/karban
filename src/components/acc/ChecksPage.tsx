/* دفتر چک‌ها — چک‌های دریافتی و پرداختی با سررسید، وضعیت و یادآوری (امکان پیشرفته) */

import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, Landmark, Plus, Receipt, Trash2, XCircle } from 'lucide-react';
import type { AccBusiness, AccCheck, CheckKind, CheckStatus } from '@/lib/acc/types';
import { deleteCheck, listAccounts, listChecks, listPartners, saveCheck, setCheckStatus } from '@/lib/acc/api';
import { voidCheck, deleteCheckFull } from '@/lib/acc/api7';
import { VoidDeleteBtns } from './VoidDeleteBtns';
import AttachButton from './AttachButton';
import { formatMoney } from '@/lib/acc/money';
import { formatJalali, dateToISO, toFaDigits } from '@/lib/acc/jalali';
import { exportExcel, htmlTable, printHtml, exportWord, exportFilename, brandLogoUrl, type BrandAccess } from '@/lib/acc/export';
import { Badge, EmptyState, Field, Modal, MoneyInput, DigitsInput, JalaliDateInput, toast, confirmAction } from './ui';
import { CHECK_STATUS_LABEL } from '@/lib/acc/constants';

interface Row extends Partial<AccCheck> { key: number }

const EMPTY: Row = {
  key: 0, kind: 'received', amount: 0, serial_no: '', bank_name: '', branch: '',
  issue_date_g: null, due_date_g: dateToISO(new Date()), status: 'in_hand',
  partner_id: null, account_id: null, description: '',
};

const STATUSES: CheckStatus[] = ['in_hand', 'deposited', 'cleared', 'bounced', 'returned', 'canceled'];
const STATUS_TONE: Record<CheckStatus, 'ok' | 'warn' | 'bad' | 'draft'> = {
  in_hand: 'draft', deposited: 'warn', cleared: 'ok', bounced: 'bad', returned: 'bad', canceled: 'draft',
};

export default function ChecksPage({ business, access }: { business: AccBusiness; access: BrandAccess }) {
  const [rows, setRows] = useState<AccCheck[]>([]);
  const [partners, setPartners] = useState<{ id: string; name: string }[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterKind, setFilterKind] = useState<'' | CheckKind>('');
  const [filterStatus, setFilterStatus] = useState<'' | CheckStatus>('');
  const [editing, setEditing] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [c, p, a] = await Promise.all([listChecks(business.id), listPartners(business.id), listAccounts(business.id)]);
        setRows(c);
        setPartners(p.map((x) => ({ id: x.id, name: x.name })));
        setAccounts(a.map((x) => ({ id: x.id, name: x.name })));
      } finally {
        setLoading(false);
      }
    })();
  }, [business.id]);

  const view = useMemo(
    () => rows.filter((r) => (!filterKind || r.kind === filterKind) && (!filterStatus || r.status === filterStatus)),
    [rows, filterKind, filterStatus],
  );

  const sums = useMemo(() => {
    const received = view.filter((r) => r.kind === 'received');
    const issued = view.filter((r) => r.kind === 'issued');
    const open = (list: AccCheck[]) => list.filter((r) => !['cleared', 'canceled'].includes(r.status));
    return {
      receivedTotal: received.reduce((s, r) => s + r.amount, 0),
      issuedTotal: issued.reduce((s, r) => s + r.amount, 0),
      openReceived: open(received).reduce((s, r) => s + r.amount, 0),
      openIssued: open(issued).reduce((s, r) => s + r.amount, 0),
    };
  }, [view]);

  async function refresh() {
    setRows(await listChecks(business.id));
  }

  async function submit() {
    if (!editing) return;
    if (!((editing.amount || 0) > 0)) { toast('مبلغ چک را وارد کنید', 'error'); return; }
    if (!editing.due_date_g) { toast('تاریخ سررسید را وارد کنید', 'error'); return; }
    setBusy(true);
    try {
      await saveCheck(business.id, {
        id: editing.id,
        kind: editing.kind || 'received',
        partner_id: editing.partner_id || null,
        account_id: editing.account_id || null,
        amount: editing.amount || 0,
        serial_no: editing.serial_no || null,
        bank_name: editing.bank_name || null,
        branch: editing.branch || null,
        issue_date_g: editing.issue_date_g || null,
        due_date_g: editing.due_date_g,
        status: editing.status || 'in_hand',
        description: editing.description || null,
      });
      toast('چک ثبت شد');
      setEditing(null);
      await refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'ثبت چک ناموفق بود', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(c: AccCheck, status: CheckStatus) {
    try {
      await setCheckStatus(c.id, status);
      await refresh();
      toast(`وضعیت چک ${CHECK_STATUS_LABEL[status]} شد`);
    } catch {
      toast('تغییر وضعیت ناموفق بود', 'error');
    }
  }

  async function remove(c: AccCheck) {
    const ok = await confirmAction(`چک ${c.serial_no || ''} به مبلغ ${formatMoney(c.amount)} ریال حذف شود؟`);
    if (!ok) return;
    try {
      await deleteCheck(c.id);
      await refresh();
      toast('چک حذف شد');
    } catch {
      toast('حذف ناموفق بود', 'error');
    }
  }

  async function voidChk(c: AccCheck, reason: string) {
    await voidCheck(business.id, c.id, reason);
    await refresh();
  }
  async function deleteChkFull(c: AccCheck) {
    await deleteCheckFull(business.id, c.id);
    await refresh();
  }

  const tableHeaders = ['نوع', 'طرف‌حساب', 'مبلغ (ریال)', 'شماره چک', 'بانک', 'تاریخ صدور', 'سررسید', 'وضعیت'];

  function tableRows() {
    return view.map((r) => [
      r.kind === 'received' ? 'دریافتی' : 'پرداختی',
      r.partner?.name || '—',
      r.amount,
      r.serial_no || '—',
      r.bank_name || '—',
      r.issue_date_g ? formatJalali(r.issue_date_g) : '—',
      formatJalali(r.due_date_g),
      CHECK_STATUS_LABEL[r.status],
    ]);
  }

  function doExport(kind: 'xlsx' | 'doc' | 'print') {
    const title = 'دفتر چک‌ها';
    if (kind === 'xlsx') {
      void exportExcel(exportFilename('checks', undefined, 'xlsx'), [
        { name: 'چک‌ها', headers: tableHeaders, rows: tableRows() },
      ], { business: business.brand || business.name, title });
      return;
    }
    const html = `<h2>${title} — ${business.brand || business.name}</h2>${htmlTable(tableHeaders, tableRows())}`;
    if (kind === 'doc') exportWord(exportFilename('checks', undefined, 'doc'), title, html, brandLogoUrl(business, access));
    else printHtml(title, html, { logoUrl: brandLogoUrl(business, access) });
  }

  const today = dateToISO(new Date());

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div className="acc-kpi-grid">
        <div className="acc-kpi"><div className="k-label"><Receipt size={14} />چک‌های دریافتی (جمع)</div><div className="k-value">{formatMoney(sums.receivedTotal)}</div><div className="k-sub">در جریان: {formatMoney(sums.openReceived)} ریال</div></div>
        <div className="acc-kpi"><div className="k-label"><Landmark size={14} />چک‌های پرداختی (جمع)</div><div className="k-value">{formatMoney(sums.issuedTotal)}</div><div className="k-sub">در جریان: {formatMoney(sums.openIssued)} ریال</div></div>
      </div>

      <div className="acc-card">
        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>دفتر چک‌ها</h3>
          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="acc-select" style={{ width: 130 }} value={filterKind} onChange={(e) => setFilterKind(e.target.value as CheckKind | '')}>
              <option value="">همه انواع</option>
              <option value="received">دریافتی</option>
              <option value="issued">پرداختی</option>
            </select>
            <select className="acc-select" style={{ width: 140 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as CheckStatus | '')}>
              <option value="">همه وضعیت‌ها</option>
              {STATUSES.map((s) => <option key={s} value={s}>{CHECK_STATUS_LABEL[s]}</option>)}
            </select>
            <button className="acc-btn acc-btn-outline" onClick={() => doExport('xlsx')}><Download size={14} /> اکسل</button>
            <button className="acc-btn acc-btn-outline" onClick={() => doExport('doc')}>ورد</button>
            <button className="acc-btn acc-btn-outline" onClick={() => doExport('print')}>چاپ PDF</button>
            <button className="acc-btn acc-btn-primary" onClick={() => setEditing({ ...EMPTY, key: Date.now() })}><Plus size={14} /> ثبت چک</button>
          </div>
        </div>

        {loading ? <p style={{ color: 'var(--muted)', fontSize: '.85rem' }}>در حال بارگذاری…</p> : view.length === 0 ? (
          <EmptyState icon={<Landmark size={22} />} title="هنوز چکی ثبت نشده" hint="چک‌های دریافتی و پرداختی خود را ثبت کنید تا سررسیدشان یادآوری شود" />
        ) : (
          <div className="acc-table-wrap" style={{ marginTop: '.8rem' }}>
            <table className="acc-table">
              <thead>
                <tr>
                  <th>نوع</th><th>طرف‌حساب</th><th>مبلغ (ریال)</th><th>شماره</th><th>بانک</th>
                  <th>صدور</th><th>سررسید</th><th>وضعیت</th><th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {view.map((r) => {
                  const overdue = !['cleared', 'canceled', 'bounced', 'returned'].includes(r.status) && r.due_date_g < today;
                  return (
                    <tr key={r.id} style={overdue ? { background: 'rgba(239,68,68,.06)' } : undefined}>
                      <td>{r.kind === 'received' ? <Badge tone="ok">دریافتی</Badge> : <Badge tone="warn">پرداختی</Badge>}</td>
                      <td>{r.partner?.name || '—'}</td>
                      <td className="num" style={{ color: 'var(--gold2)', fontWeight: 700 }}>{formatMoney(r.amount)}</td>
                      <td className="num">{toFaDigits(r.serial_no || '—')}</td>
                      <td>{r.bank_name || '—'}</td>
                      <td>{r.issue_date_g ? formatJalali(r.issue_date_g) : '—'}</td>
                      <td>{formatJalali(r.due_date_g)}{overdue ? <Badge tone="bad">گذشته</Badge> : null}</td>
                      <td><Badge tone={STATUS_TONE[r.status]}>{CHECK_STATUS_LABEL[r.status]}</Badge></td>
                      <td>
                        <div style={{ display: 'flex', gap: '.3rem' }}>
                          {r.status === 'deposited' && <button className="acc-icon-btn" title="وصول شد" onClick={() => changeStatus(r, 'cleared')}><CheckCircle2 size={15} /></button>}
                          {r.status === 'in_hand' && <button className="acc-icon-btn" title="به بانک برده شد" onClick={() => changeStatus(r, 'deposited')}>→</button>}
                          {(r.status === 'deposited' || r.status === 'in_hand') && <button className="acc-icon-btn danger" title="برگشت خورد" onClick={() => changeStatus(r, 'bounced')}><XCircle size={15} /></button>}
                          <button className="acc-icon-btn" title="ویرایش" onClick={() => setEditing({ ...r, key: Date.now() })}>✎</button>
                          <button className="acc-icon-btn danger" title="حذف" onClick={() => remove(r)}><Trash2 size={14} /></button>
                          <VoidDeleteBtns voidLabel="ابطال چک" deleteLabel="حذف کامل چک" onVoid={(reason) => voidChk(r, reason)} onDelete={() => deleteChkFull(r)} />
                          <AttachButton business={business} entityType="check" entityId={r.id} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="ثبت / ویرایش چک" wide>
        {editing && (
          <div style={{ display: 'grid', gap: '.8rem' }}>
            <div className="acc-form-grid-3">
              <Field label="نوع چک">
                <select className="acc-select" value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value as CheckKind })}>
                  <option value="received">دریافتی (از مشتری)</option>
                  <option value="issued">پرداختی (به تامین‌کننده)</option>
                </select>
              </Field>
              <Field label="مبلغ چک (ریال) *">
                <MoneyInput value={editing.amount || 0} onChange={(n) => setEditing({ ...editing, amount: n })} />
              </Field>
              <Field label="وضعیت">
                <select className="acc-select" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as CheckStatus })}>
                  {STATUSES.map((s) => <option key={s} value={s}>{CHECK_STATUS_LABEL[s]}</option>)}
                </select>
              </Field>
            </div>
            <div className="acc-form-grid-3">
              <Field label="طرف‌حساب">
                <select className="acc-select" value={editing.partner_id || ''} onChange={(e) => setEditing({ ...editing, partner_id: e.target.value || null })}>
                  <option value="">— بدون —</option>
                  {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="حساب بانکی مرتبط">
                <select className="acc-select" value={editing.account_id || ''} onChange={(e) => setEditing({ ...editing, account_id: e.target.value || null })}>
                  <option value="">— بدون —</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Field>
              <Field label="شماره چک"><DigitsInput value={editing.serial_no || ''} onChange={(v) => setEditing({ ...editing, serial_no: v })} maxLength={20} /></Field>
            </div>
            <div className="acc-form-grid-3">
              <Field label="بانک"><input className="acc-input" value={editing.bank_name || ''} onChange={(e) => setEditing({ ...editing, bank_name: e.target.value })} placeholder="مثلاً: ملت" /></Field>
              <Field label="تاریخ صدور">
                <JalaliDateInput value={editing.issue_date_g || ''} onChange={(iso) => setEditing({ ...editing, issue_date_g: iso })} />
              </Field>
              <Field label="تاریخ سررسید *">
                <JalaliDateInput value={editing.due_date_g || ''} onChange={(iso) => setEditing({ ...editing, due_date_g: iso })} />
              </Field>
            </div>
            <Field label="توضیحات"><input className="acc-input" value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            <button className="acc-btn acc-btn-primary" disabled={busy} onClick={submit}>{busy ? 'در حال ثبت…' : 'ثبت چک'}</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
