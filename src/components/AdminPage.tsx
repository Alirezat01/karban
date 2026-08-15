import React, { useEffect, useState } from 'react';
import { ArrowLeft, ShieldCheck, LogOut, Plus, Save, Trash2, Download, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { legalConfig, contractCatalog, CONTRACT_TYPES, INDUSTRIES } from '@/data/config';
import { formatFa, formatPriceFa } from '@/lib/format';

type Tab = 'services' | 'settings' | 'contracts' | 'leads' | 'orders' | 'consultations';
type Service = { id: string; title: string; price: string; description: string; domain: 'financial' | 'labor'; unit: string; featured: boolean; kind: string | null };
type ContractRow = { id: string; title: string; type: string; industry: string; summary: string; body?: string; pdf_url?: string; };
type LeadRow = { id: string; mobile: string; source: string; created_at: string };
type OrderRow = { id: string; mobile: string; service: string; amount: string; status: string; created_at: string };
type ConsultRow = { id: string; mobile: string; domain: string; service: string; created_at: string };
type SalarySettings = {
  year?: string; baseSalaryDaily?: number; housingAllowanceMonthly?: number;
  foodAllowanceMonthly?: number; insuranceEmployeeRate?: number;
  insuranceEmployerRate?: number; annualTaxFree?: number;
};

const fmtDate = (s: string) => { try { return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(s)); } catch { return s; } };

export default function AdminPage() {
  const [session, setSession] = useState<'loading' | 'unauthenticated' | 'unauthorized' | 'authorized'>('loading');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [tab, setTab] = useState<Tab>('services');

  useEffect(() => {
    let active = true;
    const check = async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (!active) return;
      if (!s) { setSession('unauthenticated'); return; }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', s.user.id).maybeSingle();
      if (!active) return;
      if (profile?.role === 'admin') setSession('authorized'); else setSession('unauthorized');
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => { check(); });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginError(error.message || 'ورود ناموفق بود.');
  };
  const signOut = async () => { await supabase.auth.signOut(); setSession('unauthenticated'); setEmail(''); setPassword(''); };

  if (session === 'loading') return <div className="admin-loading">در حال بررسی…</div>;

  if (session === 'unauthenticated') return (
    <section className="admin-login"><div className="admin-login-card">
      <ShieldCheck size={32} /><h1>ورود به پنل مدیریت</h1><p>برای دسترسی، ایمیل و رمز عبور مدیریت را وارد کنید.</p>
      <form onSubmit={signIn}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ایمیل" aria-label="ایمیل" required />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="رمز عبور" aria-label="رمز عبور" required />
        {loginError && <small className="admin-error">{loginError}</small>}
        <button className="button" type="submit">ورود <ArrowLeft size={16} /></button>
      </form>
    </div></section>
  );

  if (session === 'unauthorized') return (
    <section className="admin-login"><div className="admin-login-card">
      <ShieldCheck size={32} /><h1>دسترسی غیرمجاز</h1><p>حساب شما نقش مدیر ندارد. برای دسترسی، نقش کاربری شما باید به «admin» تغییر کند.</p>
      <button className="button" onClick={signOut}>خروج <LogOut size={16} /></button>
    </div></section>
  );

  const tabs: [Tab, string][] = [['services', 'خدمات'], ['settings', 'تنظیمات'], ['contracts', 'قراردادها'], ['leads', 'لیدها'], ['orders', 'سفارش‌ها'], ['consultations', 'درخواست‌های مشاوره'], ['users', 'مدیریت کاربران']];

  return <section className="admin-panel"><div className="container">
    <div className="admin-header"><div className="admin-title"><ShieldCheck size={22} /><h1>پنل مدیریت کاربان</h1><span className="admin-badge">مدیر</span></div><button className="admin-logout" onClick={signOut}>خروج <LogOut size={15} /></button></div>
    <nav className="admin-tabs">{tabs.map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}</nav>
    <div className="admin-content">
      {tab === 'services' && <ServicesTab />}
      {tab === 'settings' && <SettingsTab />}
      {tab === 'contracts' && <ContractsTab />}
      {tab === 'leads' && <LeadsTab />}
      {tab === 'orders' && <OrdersTab />}
      {tab === 'consultations' && <ConsultationsTab />}
      {tab === 'users' && <UsersTab />}
    </div>
  </div></section>;
}

function ServicesTab() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', price: '', description: '', domain: 'financial' as 'financial' | 'labor', unit: '', featured: false, kind: '', discount_percent: 0 });
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => { setLoading(true); const { data } = await supabase.from('services').select('id,title,price,description,domain,unit,featured,kind,discount_percent').order('id'); setServices((data || []) as Service[]); setLoading(false); };
  useEffect(() => { load(); }, []);

  const save = async (id: string) => {
    const s = services.find((x) => x.id === id); if (!s) return;
    await supabase.from('services').update({ title: s.title, price: s.price, description: s.description, domain: s.domain, unit: s.unit, featured: s.featured, discount_percent: s.discount_percent }).eq('id', id);
    setEditing(null); load();
  };
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>, setter: Function) => {
    const rawValue = e.target.value.replace(/,/g, '');
    if (!isNaN(Number(rawValue)) && rawValue !== '') {
      setter(Number(rawValue).toLocaleString('en-US'));
    } else if (rawValue === '') {
      setter('');
    }
  };
  const add = async () => {
    if (!form.title) return;
    await supabase.from('services').insert({ title: form.title, price: form.price, description: form.description, domain: form.domain, unit: form.unit, featured: form.featured, kind: form.kind || null, discount_percent: form.discount_percent });
    setForm({ title: '', price: '', description: '', domain: 'financial', unit: '', featured: false, kind: '', discount_percent: 0 }); setShowAdd(false); load();
  };
  const remove = async (id: string) => { await supabase.from('services').delete().eq('id', id); load(); };

  if (loading) return <p>در حال بارگذاری…</p>;
  return <div className="admin-table-wrap">
    <div className="admin-toolbar"><h2>مدیریت خدمات</h2><button className="button button-small" onClick={() => setShowAdd(!showAdd)}><Plus size={15} /> افزودن خدمت</button></div>
    {showAdd && <div className="admin-form">
      <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="عنوان خدمت" />
      <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="قیمت (ریال)" />
      <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="واحد (مثلاً هر درخواست)" />
      <input type="number" min="0" max="90" value={form.discount_percent || ''} onChange={(e) => setForm({ ...form, discount_percent: Number(e.target.value) })} placeholder="درصد تخفیف (۰-۹۰)" />
      <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="توضیح" />
      <select value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value as 'financial' | 'labor' })}><option value="financial">مالی</option><option value="labor">روابط کار</option></select>
      <input value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} placeholder="نوع kind (خالی = مشاوره)" />
      <label><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> پیشنهاد ویژه</label>
      <button className="button button-small" onClick={add}><Save size={15} /> ذخیره</button>
    </div>}
    <table className="admin-table">
      <thead><tr><th>عنوان</th><th>قیمت</th><th>حوزه</th><th>واحد</th><th>تخفیف٪</th><th>ویژه</th><th></th></tr></thead>
      <tbody>
        {services.map((s) => <tr key={s.id}>
          <td>{editing === s.id ? <input value={s.title} onChange={(e) => setServices(services.map((x) => x.id === s.id ? { ...x, title: e.target.value } : x))} /> : s.title}</td>
          <td>{editing === s.id ? <input value={s.price} onChange={(e) => setServices(services.map((x) => x.id === s.id ? { ...x, price: e.target.value } : x))} /> : formatPriceFa(s.price)}</td>
          <td>{editing === s.id ? <select value={s.domain} onChange={(e) => setServices(services.map((x) => x.id === s.id ? { ...x, domain: e.target.value as 'financial' | 'labor' } : x))}><option value="financial">مالی</option><option value="labor">روابط کار</option></select> : (s.domain === 'financial' ? 'مالی' : 'روابط کار')}</td>
          <td>{editing === s.id ? <input value={s.unit} onChange={(e) => setServices(services.map((x) => x.id === s.id ? { ...x, unit: e.target.value } : x))} /> : s.unit}</td>
          <td>{editing === s.id ? <input type="number" min="0" max="90" value={s.discount_percent || 0} onChange={(e) => setServices(services.map((x) => x.id === s.id ? { ...x, discount_percent: Number(e.target.value) } : x))} /> : (s.discount_percent ? s.discount_percent + '%' : '—')}</td>
          <td>{editing === s.id ? <input type="checkbox" checked={s.featured} onChange={(e) => setServices(services.map((x) => x.id === s.id ? { ...x, featured: e.target.checked } : x))} /> : (s.featured ? 'بله' : '—')}</td>
          <td className="admin-actions">
            {editing === s.id ? <button className="button button-small" onClick={() => save(s.id)}><Save size={14} /></button> : <button className="button button-small" onClick={() => setEditing(s.id)}>ویرایش</button>}
            <button className="admin-delete" onClick={() => remove(s.id)}><Trash2 size={14} /></button>
          </td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}

function SettingsTab() {
  const [settings, setSettings] = useState<SalarySettings>({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.from('settings').select('value').eq('key', 'salary_1405').maybeSingle().then(({ data }) => {
      if (!active) return;
      if (data?.value) setSettings(data.value as SalarySettings); else setSettings({ year: legalConfig.year, baseSalaryDaily: legalConfig.baseSalaryDaily, housingAllowanceMonthly: legalConfig.housingAllowanceMonthly, foodAllowanceMonthly: legalConfig.foodAllowanceMonthly, insuranceEmployeeRate: legalConfig.insuranceEmployeeRate, insuranceEmployerRate: legalConfig.insuranceEmployerRate, annualTaxFree: legalConfig.annualTaxFree, familyAllowanceMonthly: 5000000, childAllowanceMonthly: legalConfig.baseSalaryDaily * 3, overtimeRate: 1.4 });
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const save = async () => {
    await supabase.from('settings').upsert({ key: 'salary_1405', value: settings, updated_at: new Date().toISOString() });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <p>در حال بارگذاری…</p>;
  const numField = (label: string, key: keyof SalarySettings) => (
    <label className="settings-field">{label}<input type="number" step="any" value={settings[key] as number ?? 0} onChange={(e) => setSettings({ ...settings, [key]: Number(e.target.value) })} /></label>
  );
  return <div className="admin-settings">
    <h2>تنظیمات پارامترهای حقوق</h2>
    <p>این اعداد در ماشین‌حساب‌های حقوق و دستمزد استفاده می‌شوند.</p>
    <div className="settings-grid">
      <label className="settings-field">سال<input value={settings.year ?? ''} onChange={(e) => setSettings({ ...settings, year: e.target.value })} /></label>
      {numField('پایه حقوق روزانه (ریال)', 'baseSalaryDaily')}
      {numField('بن کارگری ماهانه (ریال)', 'foodAllowanceMonthly')}
      {numField('حق مسکن ماهانه (ریال)', 'housingAllowanceMonthly')}
      {numField('عائله‌مندی (ریال)', 'familyAllowanceMonthly')}
      {numField('اولاد (ریال)', 'childAllowanceMonthly')}
      {numField('ضریب اضافه‌کاری', 'overtimeRate')}
      {numField('سهم بیمه کارگر (نسبت)', 'insuranceEmployeeRate')}
      {numField('سهم بیمه کارفرما (نسبت)', 'insuranceEmployerRate')}
      {numField('سقف معافیت مالیاتی سالانه (ریال)', 'annualTaxFree')}
    </div>
    <button className="button" onClick={save}><Save size={16} /> ذخیره تنظیمات</button>
    {saved && <div className="feedback-success"><Check size={16} /> تنظیمات ذخیره شد.</div>}
  </div>;
}

function ContractsTab() {
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: '', type: '', industry: '', summary: '' });
  const [showAdd, setShowAdd] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{title: string, type: string, industry: string, summary: string, body: string, pdf_url: string}>({ title: '', type: '', industry: '', summary: '', body: '', pdf_url: '' });

  const load = async () => { setLoading(true); const { data } = await supabase.from('contracts').select('id,title,type,industry,summary,body,pdf_url').order('id'); setContracts((data || []) as ContractRow[]); setLoading(false); };
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!form.title) return;
    await supabase.from('contracts').insert({ title: form.title, type: form.type, industry: form.industry, summary: form.summary });
    setForm({ title: '', type: '', industry: '', summary: '' }); setShowAdd(false); load();
  };
  const remove = async (id: string) => { await supabase.from('contracts').delete().eq('id', id); load(); };
  const migrateLegacy = async () => {
    setMigrating(true);
    const rows = contractCatalog.map((c) => ({ title: c.title, type: c.type, industry: c.industry, summary: c.description }));
    const { error } = await supabase.from('contracts').insert(rows);
    setMigrating(false);
    if (!error) load();
  };

  useEffect(() => {
    if (form.type && form.industry) {
      setForm(prev => ({ ...prev, title: `قرارداد ${prev.type} ${prev.industry}` }));
    }
  }, [form.type, form.industry]);

  useEffect(() => {
    if (editForm.type && editForm.industry && editing) {
      if (!editForm.title || editForm.title.startsWith('قرارداد ')) {
        setEditForm(prev => ({ ...prev, title: `قرارداد ${prev.type} ${prev.industry}` }));
      }
    }
  }, [editForm.type, editForm.industry]);

  const startEdit = (c: ContractRow) => {
    setEditing(c.id);
    setEditForm({
      title: c.title || '',
      type: c.type || '',
      industry: c.industry || '',
      summary: c.summary || '',
      body: c.body || '',
      pdf_url: c.pdf_url || ''
    });
  };

  const saveEdit = async (id: string) => {
    await supabase.from('contracts').update({
      title: editForm.title,
      type: editForm.type,
      industry: editForm.industry,
      summary: editForm.summary,
      body: editForm.body,
      pdf_url: editForm.pdf_url
    }).eq('id', id);
    setEditing(null);
    load();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, id: string) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const timestamp = Date.now();
    const fileName = `contract-${id}-${timestamp}.pdf`;
    const { error } = await supabase.storage.from('contracts').upload(fileName, file);
    if (error) {
      console.error('Upload failed:', error);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from('contracts').getPublicUrl(fileName);
    setEditForm(prev => ({ ...prev, pdf_url: publicUrl }));
  };

  if (loading) return <p>در حال بارگذاری…</p>;
  return <div className="admin-table-wrap">
    <div className="admin-toolbar"><h2>قراردادها</h2><button className="button button-small" onClick={() => setShowAdd(!showAdd)}><Plus size={15} /> افزودن قرارداد</button></div>
    {showAdd && <div className="admin-form">
      <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} aria-label="نوع">
        <option value="">انتخاب نوع</option>
        {CONTRACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <select value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} aria-label="صنف">
        <option value="">انتخاب صنف</option>
        {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
      </select>
      <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="عنوان (به‌طور خودکار ساخته می‌شود)" />
      <textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="خلاصه" rows={3} style={{ width: '100%', resize: 'vertical' }} />
      <button className="button button-small" onClick={add}><Save size={15} /> ذخیره</button>
    </div>}
    <table className="admin-table">
      <thead><tr><th>عنوان</th><th>نوع</th><th>صنف</th><th>خلاصه</th><th></th></tr></thead>
      <tbody>
        {contracts.map((c) => (
          <React.Fragment key={c.id}>
            <tr>
              <td>{c.title}</td>
              <td>{c.type || '—'}</td>
              <td>{c.industry || '—'}</td>
              <td>{c.summary || '—'}</td>
              <td className="admin-actions">
                <button className="button button-small" onClick={() => editing === c.id ? setEditing(null) : startEdit(c)}>{editing === c.id ? 'لغو' : 'ویرایش'}</button>
                <button className="admin-delete" onClick={() => remove(c.id)}><Trash2 size={14} /></button>
              </td>
            </tr>
            {editing === c.id && (
              <tr>
                <td colSpan={5}>
                  <div className="admin-form" style={{ marginTop: '10px', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}>
                    <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} aria-label="نوع">
                      <option value="">انتخاب نوع</option>
                      {CONTRACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <select value={editForm.industry} onChange={(e) => setEditForm({ ...editForm, industry: e.target.value })} aria-label="صنف">
                      <option value="">انتخاب صنف</option>
                      {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                    <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} placeholder="عنوان" />
                    <textarea value={editForm.summary} onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })} placeholder="خلاصه" rows={3} style={{ width: '100%', resize: 'vertical' }} />
                    <textarea
                      value={editForm.body}
                      onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                      placeholder="متن قرارداد (پشتیبانی از پاراگراف)"
                      rows={10}
                      style={{ width: '100%', resize: 'vertical' }}
                    />
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input type="file" accept="application/pdf" onChange={(e) => handleFileUpload(e, c.id)} />
                      {editForm.pdf_url && <a href={editForm.pdf_url} target="_blank" rel="noreferrer">مشاهده PDF فعلی</a>}
                    </div>
                    <button className="button button-small" onClick={() => saveEdit(c.id)} style={{ alignSelf: 'flex-start' }}><Save size={15} /> ذخیره</button>
                  </div>
                </td>
              </tr>
            )}
          </React.Fragment>
        ))}
        {contracts.length === 0 && <tr><td colSpan={5}><div className="admin-empty"><p>هیچ قراردادی ثبت نشده است.</p><button className="button button-small" onClick={migrateLegacy} disabled={migrating}><ArrowLeft size={15} /> {migrating ? 'در حال انتقال…' : 'انتقال ۶۰ قرارداد از نسخه قدیمی'}</button></div></td></tr>}
      </tbody>
    </table>
  </div>;
}

function LeadsTab() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; supabase.from('leads').select('id,mobile,source,created_at').order('created_at', { ascending: false }).then(({ data }) => { if (active) { setLeads((data || []) as LeadRow[]); setLoading(false); } }); return () => { active = false; }; }, []);

  const exportCSV = () => {
    const csv = ['موبایل,منبع,تاریخ', ...leads.map((l) => `${l.mobile},${l.source},${fmtDate(l.created_at)}`)].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'leads.csv'; a.click(); URL.revokeObjectURL(url);
  };

  if (loading) return <p>در حال بارگذاری…</p>;
  return <div className="admin-table-wrap">
    <div className="admin-toolbar"><h2>لیدها</h2><button className="button button-small" onClick={exportCSV}><Download size={15} /> صادرات CSV</button></div>
    <table className="admin-table">
      <thead><tr><th>موبایل</th><th>منبع</th><th>تاریخ</th></tr></thead>
      <tbody>
        {leads.map((l) => <tr key={l.id}><td>{l.mobile}</td><td>{l.source}</td><td>{fmtDate(l.created_at)}</td></tr>)}
        {leads.length === 0 && <tr><td colSpan={3}>هیچ لیدی ثبت نشده است.</td></tr>}
      </tbody>
    </table>
  </div>;
}

function OrdersTab() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); const { data } = await supabase.from('orders').select('id,mobile,service,amount,status,created_at').order('created_at', { ascending: false }); setOrders((data || []) as OrderRow[]); setLoading(false); };
  useEffect(() => { load(); }, []);
  const updateStatus = async (id: string, status: string) => { await supabase.from('orders').update({ status }).eq('id', id); load(); };
  const statusLabels: Record<string, string> = { pending: 'در انتظار', processing: 'در حال انجام', completed: 'تکمیل شد', cancelled: 'لغو شد' };

  if (loading) return <p>در حال بارگذاری…</p>;
  return <div className="admin-table-wrap">
    <h2>سفارش‌ها</h2>
    <table className="admin-table">
      <thead><tr><th>موبایل</th><th>خدمت</th><th>مبلغ</th><th>وضعیت</th><th>تاریخ</th></tr></thead>
      <tbody>
        {orders.map((o) => <tr key={o.id}>
          <td>{o.mobile || '—'}</td><td>{o.service || '—'}</td><td>{o.amount ? formatPriceFa(o.amount) : '—'}</td>
          <td><select value={o.status} onChange={(e) => updateStatus(o.id, e.target.value)}>{Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></td>
          <td>{fmtDate(o.created_at)}</td>
        </tr>)}
        {orders.length === 0 && <tr><td colSpan={5}>هیچ سفارشی ثبت نشده است.</td></tr>}
      </tbody>
    </table>
  </div>;
}

function ConsultationsTab() {
  const [items, setItems] = useState<ConsultRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; supabase.from('consultation_requests').select('id,mobile,domain,service,created_at').order('created_at', { ascending: false }).then(({ data }) => { if (active) { setItems((data || []) as ConsultRow[]); setLoading(false); } }); return () => { active = false; }; }, []);

  if (loading) return <p>در حال بارگذاری…</p>;
  return <div className="admin-table-wrap">
    <h2>درخواست‌های مشاوره</h2>
    <table className="admin-table">
      <thead><tr><th>موبایل</th><th>حوزه</th><th>خدمت</th><th>تاریخ</th></tr></thead>
      <tbody>
        {items.map((c) => <tr key={c.id}><td>{c.mobile}</td><td>{c.domain === 'financial' ? 'مالی' : 'روابط کار'}</td><td>{c.service}</td><td>{fmtDate(c.created_at)}</td></tr>)}
        {items.length === 0 && <tr><td colSpan={4}>هیچ درخواستی ثبت نشده است.</td></tr>}
      </tbody>
    </table>
  </div>;
}


function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ username: '', password: '' });
  const [showAdd, setShowAdd] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  // Basic mock fetch for UI completion since schema isn't provided
  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('admin_users').select('id,username,created_at,is_locked,lock_until').order('created_at');
    setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const hashPassword = async (pwd: string) => {
    const msgUint8 = new TextEncoder().encode(pwd);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const add = async () => {
    if (!form.username || !form.password) return;
    setStatus('loading');
    const hashed = await hashPassword(form.password);
    const { error } = await supabase.from('admin_users').insert({
      username: form.username,
      password_hash: hashed,
      failed_attempts: 0
    });
    if (error) { setStatus('error'); return; }
    setForm({ username: '', password: '' });
    setShowAdd(false);
    setStatus('success');
    load();
  };

  const remove = async (id: string) => {
    await supabase.from('admin_users').delete().eq('id', id);
    load();
  };

  if (loading) return <p>در حال بارگذاری…</p>;
  return <div className="admin-table-wrap">
    <div className="admin-toolbar"><h2>مدیریت کاربران</h2><button className="button button-small" onClick={() => setShowAdd(!showAdd)}><Plus size={15} /> افزودن مدیر</button></div>
    {showAdd && <div className="admin-form">
      <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="نام کاربری" />
      <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="رمز عبور" />
      <button className="button button-small" onClick={add} disabled={status === 'loading'}><Save size={15} /> ذخیره</button>
      {status === 'success' && <div className="feedback-success"><Check size={16} /> مدیر جدید اضافه شد.</div>}
      {status === 'error' && <small className="feedback-error">خطا در ذخیره‌سازی</small>}
    </div>}
    <table className="admin-table">
      <thead><tr><th>نام کاربری</th><th>وضعیت قفل</th><th>تاریخ ایجاد</th><th></th></tr></thead>
      <tbody>
        {users.map((u) => <tr key={u.id}>
          <td>{u.username}</td>
          <td>{u.is_locked ? 'قفل شده' : 'فعال'}</td>
          <td>{new Date(u.created_at).toLocaleDateString('fa-IR')}</td>
          <td><button className="admin-delete" onClick={() => remove(u.id)}><Trash2 size={14} /></button></td>
        </tr>)}
        {users.length === 0 && <tr><td colSpan={4}>هیچ کاربری یافت نشد.</td></tr>}
      </tbody>
    </table>
  </div>;
}
