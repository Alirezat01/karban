/* قراردادهای خدماتی درون حسابداری — نسخه ۶
   ثبت مبلغ، طرف‌حساب، پروژه و وضعیت قرارداد + اتصال به عملکرد پروژه */

import { useEffect, useState } from 'react';
import { FileSignature, Pencil, Plus, Trash2 } from 'lucide-react';
import type { AccBusiness, AccContract } from '@/lib/acc/types';
import { deleteContract, listContracts, saveContract } from '@/lib/acc/api6';
import { voidContract, deleteContractFull } from '@/lib/acc/api7';
import { VoidDeleteBtns } from './VoidDeleteBtns';
import AttachButton from './AttachButton';
import { listPartners } from '@/lib/acc/api';
import { listProjects } from '@/lib/acc/api6';
import { formatMoneyUnit, roundVat } from '@/lib/acc/money';
import { formatJalali, toFaDigits } from '@/lib/acc/jalali';
import { Field, Modal, MoneyInput, confirmAction, toast, EmptyState } from './ui';

const STATUS_LABEL: Record<string, string> = {
  draft: 'پیش‌نویس', signed: 'امضاشده', active: 'در حال اجرا', done: 'تسویه/پایان', canceled: 'فسخ‌شده',
};

export default function ContractsAccPage({ business }: { business: AccBusiness }) {
  const [rows, setRows] = useState<AccContract[]>([]);
  const [partners, setPartners] = useState<{ id: string; name: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [editing, setEditing] = useState<Partial<AccContract> | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [c, pr, pj] = await Promise.all([listContracts(business.id), listPartners(business.id), listProjects(business.id)]);
      setRows(c);
      setPartners(pr.map((x) => ({ id: x.id, name: x.name })));
      setProjects(pj.map((x) => ({ id: x.id, name: x.name })));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [business.id]);

  async function save() {
    if (!editing?.title?.trim()) { toast('عنوان قرارداد الزامی است', 'error'); return; }
    try {
      await saveContract(business.id, editing);
      toast('ذخیره شد');
      setEditing(null);
      load();
    } catch {
      toast('ذخیره ناموفق بود', 'error');
    }
  }

  async function remove(row: AccContract) {
    if (!(await confirmAction(`قرارداد «${row.title}» حذف شود؟`))) return;
    try {
      await deleteContract(row.id);
      toast('حذف شد');
      load();
    } catch {
      toast('حذف ناموفق بود', 'error');
    }
  }

  async function voidCtr(row: AccContract, reason: string) {
    await voidContract(row.id, reason);
    load();
  }
  async function deleteCtrFull(row: AccContract) {
    await deleteContractFull(row.id);
    load();
  }

  const totalValue = rows.filter((r) => r.status !== 'canceled').reduce((s, r) => s + r.amount + roundVat(r.amount, r.vat_rate), 0);
  const activeCount = rows.filter((r) => r.status === 'active' || r.status === 'signed').length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div className="acc-kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="acc-kpi">
          <div className="k-label"><FileSignature size={15} /> قراردادهای جاری</div>
          <div className="k-value">{toFaDigits(activeCount)}</div>
        </div>
        <div className="acc-kpi">
          <div className="k-label">ارزش کل (با مالیات)</div>
          <div className="k-value">{formatMoneyUnit(totalValue, business.currency)}</div>
        </div>
        <div className="acc-kpi">
          <div className="k-label">همه قراردادها</div>
          <div className="k-value">{toFaDigits(rows.length)}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <button className="acc-btn acc-btn-primary" onClick={() => setEditing({ status: 'draft', vat_rate: 10, amount: 0 })}><Plus size={15} /> قرارداد جدید</button>
      </div>

      <div className="acc-table-wrap">
        <table className="acc-table">
          <thead>
            <tr><th>عنوان</th><th>طرف‌حساب</th><th>پروژه</th><th>مبلغ (ریال)</th><th>با مالیات</th><th>وضعیت</th><th>شروع</th><th>پایان</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.title}</td>
                <td>{r.partner?.name || '—'}</td>
                <td>{projects.find((p) => p.id === r.project_id)?.name || '—'}</td>
                <td className="num">{formatMoneyUnit(r.amount, business.currency)}</td>
                <td className="num">{formatMoneyUnit(r.amount + roundVat(r.amount, r.vat_rate), business.currency)}</td>
                <td>{STATUS_LABEL[r.status]}</td>
                <td className="num">{r.start_date_g ? formatJalali(r.start_date_g) : '—'}</td>
                <td className="num">{r.end_date_g ? formatJalali(r.end_date_g) : '—'}</td>
                <td>
                  <div className="row-actions">
                    <button className="acc-icon-btn" onClick={() => setEditing(r)}><Pencil size={14} /></button>
                    <button className="acc-icon-btn danger" onClick={() => remove(r)}><Trash2 size={14} /></button>
                    <VoidDeleteBtns voidLabel="ابطال قرارداد" deleteLabel="حذف کامل قرارداد" onVoid={(reason) => voidCtr(r, reason)} onDelete={() => deleteCtrFull(r)} />
                    <AttachButton business={business} entityType="contract" entityId={r.id} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && (
          <EmptyState icon={<FileSignature size={34} />} title="قراردادی ثبت نشده" hint="قراردادهای خدماتی با مبلغ و سررسید را ثبت کنید و به پروژه وصل کنید" />
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'ویرایش قرارداد' : 'قرارداد جدید'}>
        {editing && (
          <div style={{ display: 'grid', gap: '.8rem' }}>
            <Field label="عنوان قرارداد *"><input className="acc-input" placeholder="مثلاً: قرارداد مشاوره مالی ۱۴۰۵" value={editing.title || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
            <div className="acc-form-grid">
              <Field label="طرف‌حساب">
                <select className="acc-select" value={editing.partner_id || ''} onChange={(e) => setEditing({ ...editing, partner_id: e.target.value || null })}>
                  <option value="">— انتخاب کنید —</option>
                  {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="پروژه مرتبط">
                <select className="acc-select" value={editing.project_id || ''} onChange={(e) => setEditing({ ...editing, project_id: e.target.value || null })}>
                  <option value="">— بدون پروژه —</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
            </div>
            <div className="acc-form-grid">
              <Field label="مبلغ قرارداد (ریال)"><MoneyInput value={editing.amount || 0} onChange={(n) => setEditing({ ...editing, amount: n })} /></Field>
              <Field label="وضعیت">
                <select className="acc-select" value={editing.status || 'draft'} onChange={(e) => setEditing({ ...editing, status: e.target.value as AccContract['status'] })}>
                  {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
            </div>
            <div className="acc-form-grid">
              <Field label="تاریخ شروع"><input className="acc-input num" placeholder="۱۴۰۵/۰۶/۰۱" value={editing.start_date_g || ''} onChange={(e) => setEditing({ ...editing, start_date_g: e.target.value })} /></Field>
              <Field label="تاریخ پایان"><input className="acc-input num" placeholder="۱۴۰۵/۱۲/۲۹" value={editing.end_date_g || ''} onChange={(e) => setEditing({ ...editing, end_date_g: e.target.value })} /></Field>
            </div>
            <Field label="توضیح"><textarea className="acc-input" rows={2} value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            <div style={{ display: 'flex', gap: '.6rem' }}>
              <button className="acc-btn acc-btn-primary" onClick={save}>ذخیره</button>
              <button className="acc-btn acc-btn-outline" onClick={() => setEditing(null)}>انصراف</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
