import React, { useEffect, useState } from 'react';
import { ArrowLeft, Download, LogOut, Plus, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { contractCatalog, CONTRACT_TYPES, INDUSTRIES, legalConfig } from '@/data/config';
import { formatEditableAmount, formatFaDate, formatFaNumber, formatRial } from '@/lib/format';

type Tab = 'services' | 'settings' | 'contracts' | 'leads' | 'orders' | 'consultations' | 'users';
type Service = {
  id: string;
  title: string;
  price: string;
  description: string;
  domain: 'financial' | 'labor';
  unit: string;
  featured: boolean;
  kind: string | null;
  discount_percent?: number | null;
};
type ContractRow = { id: string; title: string; type: string; industry: string; summary: string; body: string; pdf_url: string };
type LeadRow = { id: string; mobile: string; source: string; created_at: string };
type OrderRow = { id: string; mobile: string; service: string; amount: string; status: string; created_at: string };
type ConsultRow = { id: string; mobile: string; domain: string; service: string; created_at: string };
type SalarySettings = {
  year?: string;
  baseSalaryDaily?: number;
  foodAllowanceMonthly?: number;
  housingAllowanceMonthly?: number;
  familyAllowanceMonthly?: number;
  childAllowanceMonthly?: number;
  overtimeMultiplier?: number;
  insuranceRate?: number;
  insuranceEmployeeRate?: number;
  insuranceEmployerRate?: number;
  annualTaxFree?: number;
  taxExemptionMonthly?: number;
};

const fmtDate = (value: string) => formatFaDate(value);
const loginLockKey = (email: string) => `karban-login-lock:${email.trim().toLowerCase()}`;
const loginFailKey = (email: string) => `karban-login-fails:${email.trim().toLowerCase()}`;
const sessionKey = 'karban-admin-session-start';

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function readLock(email: string) {
  const raw = localStorage.getItem(loginLockKey(email));
  if (!raw) return 0;
  const until = Number(raw);
  return Number.isFinite(until) ? until : 0;
}

function readFails(email: string) {
  return Number(localStorage.getItem(loginFailKey(email)) || '0') || 0;
}

function resetLoginState(email: string) {
  localStorage.removeItem(loginLockKey(email));
  localStorage.removeItem(loginFailKey(email));
}

export default function AdminPage() {
  const [session, setSession] = useState<'loading' | 'unauthenticated' | 'unauthorized' | 'authorized'>('loading');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [tab, setTab] = useState<Tab>('services');
  const [sessionTimer, setSessionTimer] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const check = async () => {
      const storedSessionStarted = Number(localStorage.getItem(sessionKey) || '0');
      if (storedSessionStarted && Date.now() - storedSessionStarted > 24 * 60 * 60 * 1000) {
        await supabase.auth.signOut();
        localStorage.removeItem(sessionKey);
      }

      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      if (!active) return;
      if (!currentSession) {
        setSession('unauthenticated');
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', currentSession.user.id).maybeSingle();
      if (!active) return;
      if (profile?.role === 'admin') {
        setSession('authorized');
        localStorage.setItem(sessionKey, String(storedSessionStarted || Date.now()));
      } else {
        setSession('unauthorized');
      }
    };

    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      check();
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
      if (sessionTimer) window.clearTimeout(sessionTimer);
    };
  }, [sessionTimer]);

  useEffect(() => {
    if (session !== 'authorized') return;
    if (sessionTimer) window.clearTimeout(sessionTimer);
    const timer = window.setTimeout(async () => {
      await supabase.auth.signOut();
      localStorage.removeItem(sessionKey);
      setSession('unauthenticated');
    }, 24 * 60 * 60 * 1000);
    setSessionTimer(timer);
    return () => window.clearTimeout(timer);
  }, [session]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const lockUntil = readLock(email);
    if (lockUntil && Date.now() < lockUntil) {
      setLoginError(`ورود برای این حساب تا ${formatFaDate(new Date(lockUntil))} قفل است.`);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const fails = readFails(email) + 1;
      localStorage.setItem(loginFailKey(email), String(fails));
      if (fails >= 5) {
        localStorage.setItem(loginLockKey(email), String(Date.now() + 5 * 60 * 1000));
        localStorage.setItem(loginFailKey(email), '0');
        setLoginError('۵ بار ورود ناموفق بود. دسترسی برای ۵ دقیقه قفل شد.');
      } else {
        setLoginError(error.message || 'ورود ناموفق بود.');
      }
      return;
    }

    resetLoginState(email);
    localStorage.setItem(sessionKey, String(Date.now()));
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(sessionKey);
    setSession('unauthenticated');
    setEmail('');
    setPassword('');
  };

  if (session === 'loading') return <div className="admin-loading">در حال بررسی...</div>;

  if (session === 'unauthenticated') {
    return (
      <section className="admin-login">
        <div className="admin-login-card">
          <ShieldCheck size={32} />
          <h1>ورود به پنل مدیریت</h1>
          <p>برای دسترسی، ایمیل و رمز عبور مدیریت را وارد کنید.</p>
          <form onSubmit={signIn}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ایمیل" aria-label="ایمیل" required />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="رمز عبور" aria-label="رمز عبور" required />
            {loginError && <small className="admin-error">{loginError}</small>}
            <button className="button" type="submit">
              ورود <ArrowLeft size={16} />
            </button>
          </form>
        </div>
      </section>
    );
  }

  if (session === 'unauthorized') {
    return (
      <section className="admin-login">
        <div className="admin-login-card">
          <ShieldCheck size={32} />
          <h1>دسترسی غیرمجاز</h1>
          <p>این حساب نقش مدیر ندارد. نقش کاربری باید در جدول profiles به admin تغییر کند.</p>
          <button className="button" onClick={signOut}>
            خروج <LogOut size={16} />
          </button>
        </div>
      </section>
    );
  }

  const tabs: [Tab, string][] = [
    ['services', 'خدمات'],
    ['settings', 'تنظیمات'],
    ['contracts', 'قراردادها'],
    ['leads', 'لیدها'],
    ['orders', 'سفارش‌ها'],
    ['consultations', 'درخواست‌های مشاوره'],
    ['users', 'مدیریت کاربران'],
  ];

  return (
    <section className="admin-panel">
      <div className="container">
        <div className="admin-header">
          <div className="admin-title">
            <ShieldCheck size={22} />
            <h1>پنل مدیریت کاربان</h1>
            <span className="admin-badge">مدیر</span>
          </div>
          <button className="admin-logout" onClick={signOut}>
            خروج <LogOut size={15} />
          </button>
        </div>

        <nav className="admin-tabs">
          {tabs.map(([key, label]) => (
            <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </nav>

        <div className="admin-content">
          {tab === 'services' && <ServicesTab />}
          {tab === 'settings' && <SettingsTab />}
          {tab === 'contracts' && <ContractsTab />}
          {tab === 'leads' && <LeadsTab />}
          {tab === 'orders' && <OrdersTab />}
          {tab === 'consultations' && <ConsultationsTab />}
          {tab === 'users' && <UsersTab />}
        </div>
      </div>
    </section>
  );
}

function ServicesTab() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', price: '', description: '', domain: 'financial' as 'financial' | 'labor', unit: '', featured: false, kind: '', discount_percent: 0 });
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('services').select('id,title,price,description,domain,unit,featured,kind,discount_percent').order('id');
    setServices((data || []) as Service[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (id: string) => {
    const current = services.find((service) => service.id === id);
    if (!current) return;
    await supabase.from('services').update(current).eq('id', id);
    setEditing(null);
    load();
  };

  const add = async () => {
    if (!form.title) return;
    await supabase.from('services').insert({
      title: form.title,
      price: form.price,
      description: form.description,
      domain: form.domain,
      unit: form.unit,
      featured: form.featured,
      kind: form.kind || null,
      discount_percent: form.discount_percent || 0,
    });
    setForm({ title: '', price: '', description: '', domain: 'financial', unit: '', featured: false, kind: '', discount_percent: 0 });
    setShowAdd(false);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from('services').delete().eq('id', id);
    load();
  };

  const updateField = (id: string, field: keyof Service, value: string | boolean | number | null) => {
    setServices((current) => current.map((service) => (service.id === id ? { ...service, [field]: value } : service)));
  };

  if (loading) return <p>در حال بارگذاری...</p>;
  return (
    <div className="admin-table-wrap">
      <div className="admin-toolbar">
        <h2>مدیریت خدمات</h2>
        <button className="button button-small" onClick={() => setShowAdd(!showAdd)}>
          <Plus size={15} /> افزودن خدمت
        </button>
      </div>

      {showAdd && (
        <div className="admin-form">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="عنوان خدمت" />
          <input value={form.price} onChange={(e) => setForm({ ...form, price: formatEditableAmount(e.target.value) })} placeholder="قیمت" />
          <input value={form.discount_percent} onChange={(e) => setForm({ ...form, discount_percent: Number(e.target.value) })} type="number" min={0} max={90} placeholder="درصد تخفیف" />
          <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="واحد" />
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="توضیح" />
          <select value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value as 'financial' | 'labor' })}>
            <option value="financial">مالی</option>
            <option value="labor">روابط کار</option>
          </select>
          <input value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} placeholder="نوع kind (خالی = مشاوره)" />
          <label>
            <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> پیشنهاد ویژه
          </label>
          <button className="button button-small" onClick={add}>
            <Save size={15} /> ذخیره
          </button>
        </div>
      )}

      <table className="admin-table">
        <thead>
          <tr>
            <th>عنوان</th>
            <th>قیمت</th>
            <th>تخفیف</th>
            <th>حوزه</th>
            <th>واحد</th>
            <th>ویژه</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {services.map((service) => (
            <tr key={service.id}>
              <td>
                {editing === service.id ? (
                  <input value={service.title} onChange={(e) => updateField(service.id, 'title', e.target.value)} />
                ) : (
                  service.title
                )}
              </td>
              <td>
                {editing === service.id ? (
                  <input value={service.price} onChange={(e) => updateField(service.id, 'price', formatEditableAmount(e.target.value))} />
                ) : (
                  service.price
                )}
              </td>
              <td>
                {editing === service.id ? (
                  <input
                    type="number"
                    min={0}
                    max={90}
                    value={service.discount_percent || 0}
                    onChange={(e) => updateField(service.id, 'discount_percent', Number(e.target.value))}
                  />
                ) : (
                  `${service.discount_percent || 0}%`
                )}
              </td>
              <td>
                {editing === service.id ? (
                  <select value={service.domain} onChange={(e) => updateField(service.id, 'domain', e.target.value)}>
                    <option value="financial">مالی</option>
                    <option value="labor">روابط کار</option>
                  </select>
                ) : service.domain === 'financial' ? (
                  'مالی'
                ) : (
                  'روابط کار'
                )}
              </td>
              <td>{editing === service.id ? <input value={service.unit} onChange={(e) => updateField(service.id, 'unit', e.target.value)} /> : service.unit}</td>
              <td>{editing === service.id ? <input type="checkbox" checked={service.featured} onChange={(e) => updateField(service.id, 'featured', e.target.checked)} /> : service.featured ? 'بله' : '—'}</td>
              <td className="admin-actions">
                {editing === service.id ? (
                  <button className="button button-small" onClick={() => save(service.id)}>
                    <Save size={14} />
                  </button>
                ) : (
                  <button className="button button-small" onClick={() => setEditing(service.id)}>
                    ویرایش
                  </button>
                )}
                <button className="admin-delete" onClick={() => remove(service.id)}>
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SettingsTab() {
  const [settings, setSettings] = useState<SalarySettings>({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    supabase
      .from('settings')
      .select('value')
      .eq('key', 'salary_1405')
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (data?.value) {
          setSettings(data.value as SalarySettings);
        } else {
          setSettings({
            year: legalConfig.year,
            baseSalaryDaily: legalConfig.baseSalaryDaily,
            foodAllowanceMonthly: legalConfig.foodAllowanceMonthly,
            housingAllowanceMonthly: legalConfig.housingAllowanceMonthly,
            familyAllowanceMonthly: legalConfig.familyAllowanceMonthly,
            childAllowanceMonthly: legalConfig.childAllowanceMonthly,
            overtimeMultiplier: legalConfig.overtimeMultiplier,
            insuranceRate: legalConfig.insuranceRate,
            annualTaxFree: legalConfig.annualTaxFree,
            taxExemptionMonthly: legalConfig.taxExemptionMonthly,
          });
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const save = async () => {
    await supabase.from('settings').upsert({ key: 'salary_1405', value: settings, updated_at: new Date().toISOString() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <p>در حال بارگذاری...</p>;

  const numField = (label: string, key: keyof SalarySettings) => (
    <label className="settings-field">
      {label}
      <input type="number" value={settings[key] as number ?? 0} onChange={(e) => setSettings({ ...settings, [key]: Number(e.target.value) })} />
    </label>
  );

  return (
    <div className="admin-settings">
      <h2>تنظیمات پارامترهای ۱۴۰۵</h2>
      <p>این اعداد در ماشین‌حساب‌های حقوق و دستمزد استفاده می‌شوند.</p>
      <div className="settings-grid">
        <label className="settings-field">
          سال
          <input value={settings.year ?? ''} onChange={(e) => setSettings({ ...settings, year: e.target.value })} />
        </label>
        {numField('پایه حقوق روزانه (تومان)', 'baseSalaryDaily')}
        {numField('بن کارگری ماهانه (تومان)', 'foodAllowanceMonthly')}
        {numField('حق مسکن ماهانه (تومان)', 'housingAllowanceMonthly')}
        {numField('عائله‌مندی ماهانه (تومان)', 'familyAllowanceMonthly')}
        {numField('اولاد به ازای هر فرزند (تومان)', 'childAllowanceMonthly')}
        {numField('ضریب اضافه‌کاری', 'overtimeMultiplier')}
        {numField('سهم بیمه کارگر', 'insuranceRate')}
        {numField('معافیت مالیاتی سالانه (تومان)', 'annualTaxFree')}
        {numField('معافیت مالیاتی ماهانه (تومان)', 'taxExemptionMonthly')}
      </div>
      <button className="button button-green" onClick={save}>
        <Save size={16} /> ذخیره تنظیمات
      </button>
      {saved && <small className="admin-success">✓ تنظیمات ذخیره شد.</small>}
    </div>
  );
}

function ContractsTab() {
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: '', type: '', industry: '', summary: '' });
  const [showAdd, setShowAdd] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', type: '', industry: '', summary: '', body: '', pdf_url: '' });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('contracts').select('id,title,type,industry,summary,body,pdf_url').order('id');
    setContracts((data || []) as ContractRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!form.title) return;
    await supabase.from('contracts').insert({ title: form.title, type: form.type, industry: form.industry, summary: form.summary });
    setForm({ title: '', type: '', industry: '', summary: '' });
    setShowAdd(false);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from('contracts').delete().eq('id', id);
    load();
  };

  const migrateLegacy = async () => {
    setMigrating(true);
    const rows = contractCatalog.map((contract) => ({ title: contract.title, type: contract.type, industry: contract.industry, summary: contract.description }));
    const { error } = await supabase.from('contracts').insert(rows);
    setMigrating(false);
    if (!error) load();
  };

  const startEdit = (contract: ContractRow) => {
    setEditing(contract.id);
    setEditForm({
      title: contract.title || '',
      type: contract.type || '',
      industry: contract.industry || '',
      summary: contract.summary || '',
      body: contract.body || '',
      pdf_url: contract.pdf_url || '',
    });
  };

  const saveEdit = async (id: string) => {
    await supabase.from('contracts').update(editForm).eq('id', id);
    setEditing(null);
    load();
  };

  if (loading) return <p>در حال بارگذاری...</p>;

  return (
    <div className="admin-table-wrap">
      <div className="admin-toolbar">
        <h2>قراردادها</h2>
        <button className="button button-small" onClick={() => setShowAdd(!showAdd)}>
          <Plus size={15} /> افزودن قرارداد
        </button>
      </div>
      {showAdd && (
        <div className="admin-form">
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} aria-label="نوع">
            <option value="">انتخاب نوع</option>
            {CONTRACT_TYPES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} aria-label="صنف">
            <option value="">انتخاب صنف</option>
            {INDUSTRIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="عنوان" />
          <textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="خلاصه" rows={3} style={{ width: '100%', resize: 'vertical' }} />
          <button className="button button-small" onClick={add}>
            <Save size={15} /> ذخیره
          </button>
        </div>
      )}
      <table className="admin-table">
        <thead>
          <tr>
            <th>عنوان</th>
            <th>نوع</th>
            <th>صنف</th>
            <th>خلاصه</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((contract) => (
            <React.Fragment key={contract.id}>
              <tr>
                <td>{contract.title}</td>
                <td>{contract.type || '—'}</td>
                <td>{contract.industry || '—'}</td>
                <td>{contract.summary || '—'}</td>
                <td className="admin-actions">
                  <button className="button button-small" onClick={() => (editing === contract.id ? setEditing(null) : startEdit(contract))}>
                    {editing === contract.id ? 'لغو' : 'ویرایش'}
                  </button>
                  <button className="admin-delete" onClick={() => remove(contract.id)}>
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
              {editing === contract.id && (
                <tr>
                  <td colSpan={5}>
                    <div className="admin-form admin-form-block">
                      <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}>
                        <option value="">انتخاب نوع</option>
                        {CONTRACT_TYPES.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                      <select value={editForm.industry} onChange={(e) => setEditForm({ ...editForm, industry: e.target.value })}>
                        <option value="">انتخاب صنف</option>
                        {INDUSTRIES.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                      <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} placeholder="عنوان" />
                      <textarea value={editForm.summary} onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })} placeholder="خلاصه" rows={3} style={{ width: '100%', resize: 'vertical' }} />
                      <textarea value={editForm.body} onChange={(e) => setEditForm({ ...editForm, body: e.target.value })} placeholder="متن قرارداد" rows={8} style={{ width: '100%', resize: 'vertical' }} />
                      <input value={editForm.pdf_url} onChange={(e) => setEditForm({ ...editForm, pdf_url: e.target.value })} placeholder="آدرس PDF" />
                      <button className="button button-small" onClick={() => saveEdit(contract.id)}>
                        <Save size={15} /> ذخیره
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
          {contracts.length === 0 && (
            <tr>
              <td colSpan={5}>
                <div className="admin-empty">
                  <p>هیچ قراردادی ثبت نشده است.</p>
                  <button className="button button-small" onClick={migrateLegacy} disabled={migrating}>
                    <ArrowLeft size={15} /> {migrating ? 'در حال انتقال...' : 'انتقال ۶۰ قرارداد از نسخه قدیمی'}
                  </button>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function LeadsTab() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from('leads')
      .select('id,mobile,source,created_at')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (active) {
          setLeads((data || []) as LeadRow[]);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const exportCSV = () => {
    const rows = ['موبایل,منبع,تاریخ', ...leads.map((lead) => `${lead.mobile},${lead.source},${fmtDate(lead.created_at)}`)];
    const blob = new Blob(['\ufeff' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'leads.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <p>در حال بارگذاری...</p>;
  return (
    <div className="admin-table-wrap">
      <div className="admin-toolbar">
        <h2>لیدها</h2>
        <button className="button button-small" onClick={exportCSV}>
          <Download size={15} /> صادرات CSV
        </button>
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>موبایل</th>
            <th>منبع</th>
            <th>تاریخ</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id}>
              <td>{lead.mobile}</td>
              <td>{lead.source}</td>
              <td>{fmtDate(lead.created_at)}</td>
            </tr>
          ))}
          {leads.length === 0 && (
            <tr>
              <td colSpan={3}>هیچ لیدی ثبت نشده است.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function OrdersTab() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('orders').select('id,mobile,service,amount,status,created_at').order('created_at', { ascending: false });
    setOrders((data || []) as OrderRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('orders').update({ status }).eq('id', id);
    load();
  };

  const statusLabels: Record<string, string> = { pending: 'در انتظار', processing: 'در حال انجام', completed: 'تکمیل شد', cancelled: 'لغو شد' };

  if (loading) return <p>در حال بارگذاری...</p>;
  return (
    <div className="admin-table-wrap">
      <h2>سفارش‌ها</h2>
      <table className="admin-table">
        <thead>
          <tr>
            <th>موبایل</th>
            <th>خدمت</th>
            <th>مبلغ</th>
            <th>وضعیت</th>
            <th>تاریخ</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>{order.mobile || '—'}</td>
              <td>{order.service || '—'}</td>
              <td>{order.amount ? formatRial(order.amount) : '—'}</td>
              <td>
                <select value={order.status} onChange={(e) => updateStatus(order.id, e.target.value)}>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </td>
              <td>{fmtDate(order.created_at)}</td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr>
              <td colSpan={5}>هیچ سفارشی ثبت نشده است.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ConsultationsTab() {
  const [items, setItems] = useState<ConsultRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from('consultation_requests')
      .select('id,mobile,domain,service,created_at')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (active) {
          setItems((data || []) as ConsultRow[]);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <p>در حال بارگذاری...</p>;
  return (
    <div className="admin-table-wrap">
      <h2>درخواست‌های مشاوره</h2>
      <table className="admin-table">
        <thead>
          <tr>
            <th>موبایل</th>
            <th>حوزه</th>
            <th>خدمت</th>
            <th>تاریخ</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.mobile}</td>
              <td>{item.domain === 'financial' ? 'مالی' : 'روابط کار'}</td>
              <td>{item.service}</td>
              <td>{fmtDate(item.created_at)}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={4}>هیچ درخواستی ثبت نشده است.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<{ id: string; role: string; password_sha256?: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [changePassword, setChangePassword] = useState('');
  const [status, setStatus] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('id,role,password_sha256').order('created_at', { ascending: false });
    setUsers((data || []) as { id: string; role: string; password_sha256?: string | null }[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const promoteToAdmin = async (userId: string) => {
    await supabase.from('profiles').update({ role: 'admin' }).eq('id', userId);
    load();
  };

  const addAdmin = async () => {
    if (!createEmail || !createPassword) return;
    setStatus('در حال ایجاد مدیر جدید...');
    const currentSession = await supabase.auth.getSession();
    const { data, error } = await supabase.auth.signUp({ email: createEmail, password: createPassword });
    if (error) {
      setStatus(error.message);
      return;
    }
    const newUserId = data.user?.id;
    if (newUserId) {
      await supabase.from('profiles').update({ role: 'admin', password_sha256: await sha256(createPassword) }).eq('id', newUserId);
    }
    if (currentSession.data.session) {
      await supabase.auth.setSession(currentSession.data.session);
    }
    setCreateEmail('');
    setCreatePassword('');
    setStatus('مدیر جدید اضافه شد.');
    load();
  };

  const changeOwnPassword = async () => {
    if (!changePassword) return;
    const { error } = await supabase.auth.updateUser({ password: changePassword });
    if (error) {
      setStatus(error.message);
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({ password_sha256: await sha256(changePassword) }).eq('id', user.id);
    }
    setChangePassword('');
    setStatus('رمز عبور به‌روزرسانی شد.');
    load();
  };

  if (loading) return <p>در حال بارگذاری...</p>;
  return (
    <div className="admin-settings">
      <h2>مدیریت کاربران</h2>
      <p>برای امنیت، رمزها با SHA-256 ذخیره می‌شوند و ورود ناموفق ۵ باره، ۵ دقیقه قفل ایجاد می‌کند.</p>
      <div className="settings-grid">
        <label className="settings-field">
          ایمیل مدیر جدید
          <input value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} />
        </label>
        <label className="settings-field">
          رمز مدیر جدید
          <input type="password" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} />
        </label>
        <label className="settings-field">
          رمز جدید حساب فعلی
          <input type="password" value={changePassword} onChange={(e) => setChangePassword(e.target.value)} />
        </label>
      </div>
      <div className="admin-actions-row">
        <button className="button button-green" onClick={addAdmin}>
          <Plus size={15} /> افزودن مدیر
        </button>
        <button className="button button-green" onClick={changeOwnPassword}>
          <Save size={15} /> تغییر رمز
        </button>
      </div>
      {status && <small className="admin-success">{status}</small>}
      <table className="admin-table" style={{ marginTop: '1rem' }}>
        <thead>
          <tr>
            <th>شناسه</th>
            <th>نقش</th>
            <th>SHA-256</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.id}</td>
              <td>{user.role}</td>
              <td className="mono">{user.password_sha256 || '—'}</td>
              <td>
                {user.role !== 'admin' && (
                  <button className="button button-small" onClick={() => promoteToAdmin(user.id)}>
                    مدیر کن
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

