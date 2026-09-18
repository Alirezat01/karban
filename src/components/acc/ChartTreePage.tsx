/* کدینگ حسابداری چندسطحی — کل ← معین ← تفصیلی + مدیریت تفصیلی شناور */

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, Folder, FolderOpen, Pencil, Plus, Trash2, Hash, Layers } from 'lucide-react';
import type { AccBusiness, AccChartRow } from '@/lib/acc/types';
import { ChartNode, AccDetail, listChartTree, saveChartNode, deleteChartNode, listDetails, saveDetail, deleteDetail, DETAIL_KIND_LABELS } from '@/lib/acc/api7';
import { Field, Modal, confirmAction, toast, EmptyState } from './ui';

const KIND_LABELS: Record<AccChartRow['kind'], string> = {
  asset: 'دارایی', liability: 'بدهی', equity: 'سرمایه', income: 'درآمد', expense: 'هزینه',
};
const KIND_COLORS: Record<AccChartRow['kind'], string> = {
  asset: '#0e7490', liability: '#b45309', equity: '#7c3aed', income: '#15803d', expense: '#dc2626',
};
const LEVEL_LABELS = ['', 'کل', 'معین', 'تفصیلی'];

export default function ChartTreePage({ business }: { business: AccBusiness }) {
  const [tab, setTab] = useState<'tree' | 'details'>('tree');
  const [tree, setTree] = useState<ChartNode[]>([]);
  const [details, setDetails] = useState<AccDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ parent: ChartNode | null; node: ChartNode | null } | null>(null);
  const [form, setForm] = useState({ code: '', title: '', kind: 'asset' as AccChartRow['kind'] });
  const [detEditing, setDetEditing] = useState<AccDetail | null>(null);
  const [detOpen, setDetOpen] = useState(false);
  const [detForm, setDetForm] = useState<{ title: string; kind: AccDetail['kind']; code: string }>({ title: '', kind: 'other', code: '' });

  async function load() {
    setLoading(true);
    try {
      const [t, d] = await Promise.all([listChartTree(business.id), listDetails(business.id)]);
      setTree(t);
      setDetails(d);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [business.id]);

  const flatCount = useMemo(() => {
    let n = 0;
    const walk = (nodes: ChartNode[]) => { for (const x of nodes) { n++; if (x.children?.length) walk(x.children); } };
    walk(tree);
    return n;
  }, [tree]);

  function openAdd(parent: ChartNode | null) {
    const kind = parent?.kind || 'asset';
    setForm({ code: '', title: '', kind });
    setEditing({ parent, node: null });
  }
  function openEdit(node: ChartNode) {
    if (node.is_system) { toast('سرفصل سیستمی فقط قابل مشاهده است', 'error'); return; }
    setForm({ code: node.code, title: node.title, kind: node.kind });
    setEditing({ parent: null, node });
  }

  async function submitNode() {
    if (!form.title.trim()) { toast('عنوان سرفصل الزامی است', 'error'); return; }
    try {
      await saveChartNode(business.id, {
        id: editing?.node?.id,
        parent_id: editing?.parent?.id ?? editing?.node?.parent_id ?? null,
        code: editing?.node ? undefined : form.code || undefined,
        title: form.title, kind: form.kind,
      });
      toast('سرفصل ذخیره شد');
      setEditing(null);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'خطا', 'error');
    }
  }

  async function removeNode(node: ChartNode) {
    if (!(await confirmAction(`سرفصل «${node.title}» حذف شود؟`))) return;
    try {
      await deleteChartNode(node.id);
      toast('سرفصل حذف شد');
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'خطا', 'error');
    }
  }

  async function submitDetail() {
    if (!detForm.title.trim()) { toast('عنوان الزامی است', 'error'); return; }
    try {
      await saveDetail(business.id, {
        id: detEditing?.id, title: detForm.title, kind: detForm.kind,
        code: detForm.code || null, ref_id: detEditing?.ref_id ?? null,
      });
      toast('تفصیلی ذخیره شد');
      setDetEditing(null);
      setDetOpen(false);
      setDetForm({ title: '', kind: 'other', code: '' });
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'خطا', 'error');
    }
  }

  async function removeDetail(d: AccDetail) {
    if (!(await confirmAction(`تفصیلی «${d.title}» حذف شود؟`))) return;
    try {
      await deleteDetail(d.id);
      toast('حذف شد');
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'خطا', 'error');
    }
  }

  const toggle = (id: string) => setExpanded((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  function renderNode(node: ChartNode, depth: number): React.ReactNode {
    const hasKids = !!node.children?.length;
    const open = expanded.has(node.id);
    return (
      <div key={node.id}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '.45rem',
            padding: '.38rem .55rem', borderRadius: 8, marginBottom: 2,
            background: open ? 'rgba(59,130,246,.07)' : undefined,
            paddingRight: `${0.55 + depth * 1.3}rem`,
          }}
        >
          <button className="acc-icon-btn" style={{ minHeight: 0, padding: 2 }} onClick={() => hasKids && toggle(node.id)}>
            {hasKids ? (open ? <ChevronDown size={14} /> : <ChevronLeft size={14} />) : <span style={{ width: 14 }} />}
          </button>
          {hasKids ? (open ? <FolderOpen size={14} style={{ color: KIND_COLORS[node.kind] }} /> : <Folder size={14} style={{ color: KIND_COLORS[node.kind] }} />) : <Hash size={13} style={{ opacity: .45 }} />}
          <span className="acc-chip" style={{ fontSize: '.68rem', fontFamily: 'monospace' }}>{node.code}</span>
          <span style={{ fontSize: '.84rem', fontWeight: node.level === 1 ? 700 : 500, flex: 1 }}>{node.title}</span>
          <span style={{ fontSize: '.64rem', opacity: .55 }}>{LEVEL_LABELS[node.level] || ''}</span>
          <span style={{ fontSize: '.62rem', color: KIND_COLORS[node.kind], fontWeight: 700 }}>{KIND_LABELS[node.kind]}</span>
          <button className="acc-icon-btn" style={{ minHeight: 0, padding: 2 }} title="افزودن زیرمجموعه" onClick={() => openAdd(node)}><Plus size={13} /></button>
          {!node.is_system && (
            <>
              <button className="acc-icon-btn" style={{ minHeight: 0, padding: 2 }} title="ویرایش" onClick={() => openEdit(node)}><Pencil size={12} /></button>
              <button className="acc-icon-btn" style={{ minHeight: 0, padding: 2 }} title="حذف" onClick={() => removeNode(node)}><Trash2 size={12} style={{ color: '#dc2626' }} /></button>
            </>
          )}
        </div>
        {open && node.children?.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.6rem', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>کدینگ حسابداری چندسطحی</h2>
          <p style={{ margin: '.2rem 0 0', fontSize: '.78rem', opacity: .65 }}>
            ساختار کل ← معین ← تفصیلی با تفصیلی شناور — {flatCount} سرفصل، {details.length} تفصیلی
          </p>
        </div>
        <div style={{ display: 'flex', gap: '.45rem', flexWrap: 'wrap' }}>
          <button className={`acc-btn ${tab === 'tree' ? 'acc-btn-primary' : 'acc-btn-outline'}`} onClick={() => setTab('tree')}><Layers size={15} /> کدینگ</button>
          <button className={`acc-btn ${tab === 'details' ? 'acc-btn-primary' : 'acc-btn-outline'}`} onClick={() => setTab('details')}>تفصیلی شناور ({details.length})</button>
          {tab === 'tree' && <button className="acc-btn acc-btn-primary" onClick={() => openAdd(null)}><Plus size={15} /> سرفصل جدید</button>}
          {tab === 'details' && (
            <button className="acc-btn acc-btn-primary" onClick={() => { setDetEditing(null); setDetForm({ title: '', kind: 'customer', code: '' }); setDetOpen(true); }}>
              <Plus size={15} /> تفصیلی جدید
            </button>
          )}
        </div>
      </div>

      {loading ? <p style={{ opacity: .6 }}>در حال بارگذاری…</p> : tab === 'tree' ? (
        <div className="acc-card" style={{ padding: '.7rem' }}>
          {tree.length === 0 ? <EmptyState title="کدینگ خالی است" /> : tree.map((n) => renderNode(n, 0))}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '.5rem' }}>
          {details.length === 0 ? (
            <EmptyState title="تفصیلی شناوری ثبت نشده" hint="تفصیلی شناور یعنی طرف‌حساب آزاد روی ردیف سند — مثل نام پروژه، شماره قرارداد یا هر مرکز هزینه دلخواه" />
          ) : details.map((d) => (
            <div key={d.id} className="acc-card" style={{ padding: '.6rem .8rem', display: 'flex', alignItems: 'center', gap: '.6rem', flexWrap: 'wrap' }}>
              <span className="acc-chip" style={{ fontSize: '.68rem' }}>{DETAIL_KIND_LABELS[d.kind]}</span>
              <span style={{ fontWeight: 600, fontSize: '.86rem', flex: 1 }}>{d.title}</span>
              {d.code && <span style={{ fontFamily: 'monospace', fontSize: '.72rem', opacity: .6 }}>{d.code}</span>}
              <button className="acc-icon-btn" onClick={() => { setDetEditing(d); setDetForm({ title: d.title, kind: d.kind, code: d.code || '' }); setDetOpen(true); }}><Pencil size={13} /></button>
              <button className="acc-icon-btn" onClick={() => removeDetail(d)}><Trash2 size={13} style={{ color: '#dc2626' }} /></button>
            </div>
          ))}
        </div>
      )}

      {/* مودال سرفصل */}
      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.node ? `ویرایش «${editing.node.title}»` : editing.parent ? `سرفصل زیرمجموعه «${editing.parent.title}»` : 'سرفصل سطح کل'}>
          <div style={{ display: 'grid', gap: '.7rem' }}>
            <Field label="عنوان سرفصل">
              <input className="acc-input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </Field>
            {!editing.node && (
              <>
                <Field label="کد (خالی = خودکار)" hint={editing.parent ? `پیشنهاد از کد والد ${editing.parent.code}` : 'مثال: 1106'}>
                  <input className="acc-input" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} style={{ fontFamily: 'monospace' }} />
                </Field>
                <Field label="ماهیت">
                  <select className="acc-select" value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as AccChartRow['kind'] }))}>
                    {Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
              </>
            )}
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <button className="acc-btn acc-btn-primary" onClick={submitNode}>ذخیره</button>
              <button className="acc-btn acc-btn-outline" onClick={() => setEditing(null)}>انصراف</button>
            </div>
          </div>
        </Modal>
      )}

      {/* مودال تفصیلی — افزودن/ویرایش */}
      {detOpen && (
        <Modal open onClose={() => { setDetOpen(false); setDetEditing(null); }} title={detEditing ? 'ویرایش تفصیلی شناور' : 'تفصیلی شناور جدید'}>
          <div style={{ display: 'grid', gap: '.7rem' }}>
            <Field label="عنوان">
              <input className="acc-input" value={detForm.title} onChange={(e) => setDetForm((f) => ({ ...f, title: e.target.value }))} />
            </Field>
            <Field label="نوع">
              <select className="acc-select" value={detForm.kind} onChange={(e) => setDetForm((f) => ({ ...f, kind: e.target.value as AccDetail['kind'] }))}>
                {Object.entries(DETAIL_KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="کد (اختیاری)">
              <input className="acc-input" value={detForm.code} onChange={(e) => setDetForm((f) => ({ ...f, code: e.target.value }))} />
            </Field>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <button className="acc-btn acc-btn-primary" onClick={submitDetail}>ذخیره</button>
              <button className="acc-btn acc-btn-outline" onClick={() => { setDetOpen(false); setDetEditing(null); }}>انصراف</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
