import React, { useEffect, useState } from 'react';
import { ArrowLeft, LogOut, Plus, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { contractCatalog, CONTRACT_TYPES, INDUSTRIES, legalConfig } from '@/data/config';
import { formatFaDate, formatRial } from '@/lib/format';

type Tab = 'services' | 'settings' | 'contracts' | 'orders' | 'consultations' | 'users' | 'newsletter';
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
type OrderRow = { id: string; full_name: string; mobile: string; service_title: string; amount: number; status: string; created_at: string };
type ConsultRow = { id: string; mobile: string; domain: string; service: string; created_at: string };

const fmtDate = (value: string) => formatFaDate(value);
const loginLockKey = (email: string) => `karban-login-lock:${email.trim().toLowerCase()}`;
const loginFailKey = (email: string) => `karban-login-fails:${email.trim().toLowerCase()}`;
const sessionKey = 'karban-admin-session-start';

const safeAmount = (raw: string) => {
  const digits = raw
    .replace(/[^0-9۰-۹]/g, '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۴۵۶۸۹'.indexOf(d)));
  if (!digits) return '';
  return Number(digits).toLocaleString('en-US');
};

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

type CalcParams = {
  salary: { base: number; bon: number; housing: number; family: number; child_per: number; overtime_coef: number; insurance_employee: number; tax_exempt_monthly: number };
  hiring: { insurance_employer: number; severance_months: number; eydi_months: number; leave_days: number };
  tax_brackets: number[];
  business_exempt: number;
  bracket_caps: number[];
  vat_rate: number;
  retirement: { min_years: number; min_age: number; alt_years: number; alt_age: number; max_years: number };
};

const defaultCalcParams: CalcParams = {
  salary: {
    base: legalConfig.baseSalaryDaily * 30,
    bon: legalConfig.foodAllowanceMonthly,
    housing: legalConfig.housingAllowanceMonthly,
    family: legalConfig.familyAllowanceMonthly,
    child_per: legalConfig.childAllowanceMonthly,
    overtime_coef: legalConfig.overtimeMultiplier,
    insurance_employee: legalConfig.insuranceEmployeeRate,
    tax_exempt_monthly: legalConfig.taxExemptionMonthly,
  },
  hiring: { insurance_employer: legalConfig.insuranceEmployerRate, severance_months: 1, eydi_months: 2, leave_days: 26 },
  tax_brackets: [15, 20, 25, 30, 35],
  business_exempt: 400000000,
  bracket_caps: [2000000000, 4000000000, 10000000000, 50000000000],
  vat_rate: 10,
  retirement: { min_years: 20, min_age: 60, alt_years: 30, alt_age: 50, max_years: 42 },
};

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
    ['orders', 'سفارش‌ها'],
    ['consultations', 'درخواست‌های مشاوره'],
    ['users', 'مدیریت کاربران'],
    ['newsletter', 'خبرنامه'],
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
          {tab === 'orders' && <OrdersTab />}
          {tab === 'consultations' && <ConsultationsTab />}
          {tab === 'users' && <UsersTab />}
          {tab === 'newsletter' && <NewsletterTab />}
        </div>
      </div>
    </section>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="settings-field">
      {label}
      <input type="number" value={value ?? 0} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </label>
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
    const { id: _skip, ...payload } = current;
    const { error } = await supabase.from('services').update(payload).eq('id', id);
    if (error) {
      alert('ذخیره نشد: ' + error.message);
      return;
    }
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
          <input value={form.price} onChange={(e) => setForm({ ...form, price: safeAmount(e.target.value) })} placeholder="قیمت" />
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
                  <input value={service.price} onChange={(e) => updateField(service.id, 'price', safeAmount(e.target.value))} placeholder="قیمت" />
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
  const [p, setP] = useState<CalcParams>(defaultCalcParams);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'calc_1405')
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (data?.value) {
          const v = data.value as Record<string, unknown>;
          setP((prev) => ({
            ...prev,
            salary: { ...prev.salary, ...((v.salary as object) || {}) },
            hiring: { ...prev.hiring, ...((v.hiring as object) || {}) },
            tax_brackets: (v.tax_brackets as number[]) || prev.tax_brackets,
            business_exempt: (v.business_exempt as number) || prev.business_exempt,
            bracket_caps: (v.bracket_caps as number[]) || prev.bracket_caps,
            vat_rate: (v.vat_rate as number) || prev.vat_rate,
            retirement: { ...prev.retirement, ...((v.retirement as object) || {}) },
          }));
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const save = async () => {
    await supabase.from('app_settings').upsert({ key: 'calc_1405', value: p, updated_at: new Date().toISOString() });
    await supabase.from('settings').upsert({
      key: 'salary_1405',
      value: {
        year: legalConfig.year,
        baseSalaryDaily: Math.round(p.salary.base / 30),
        foodAllowanceMonthly: p.salary.bon,
        housingAllowanceMonthly: p.salary.housing,
        familyAllowanceMonthly: p.salary.family,
        childAllowanceMonthly: p.salary.child_per,
        overtimeMultiplier: p.salary.overtime_coef,
        insuranceRate: p.salary.insurance_employee,
        insuranceEmployeeRate: p.salary.insurance_employee,
        insuranceEmployerRate: p.hiring.insurance_employer,
        annualTaxFree: p.salary.tax_exempt_monthly * 12,
        taxExemptionMonthly: p.salary.tax_exempt_monthly,
      },
      updated_at: new Date().toISOString(),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <p>در حال بارگذاری...</p>;

  return (
    <div className="admin-settings">
      <h2>تنظیمات پارامترهای سالانه همه ماشین‌حساب‌ها</h2>
      <p>این اعداد بلافاصله در همه ابزارهای هوشمند سایت اعمال می‌شوند.</p>

      <h3>حقوق و دستمزد</h3>
      <div className="settings-grid">
        <NumField label="حقوق پایه ماهانه (ریال)" value={p.salary.base} onChange={(n) => setP({ ...p, salary: { ...p.salary, base: n } })} />
        <NumField label="بن کارگری ماهانه (ریال)" value={p.salary.bon} onChange={(n) => setP({ ...p, salary: { ...p.salary, bon: n } })} />
        <NumField label="کمک مسکن ماهانه (ریال)" value={p.salary.housing} onChange={(n) => setP({ ...p, salary: { ...p.salary, housing: n } })} />
        <NumField label="عائله‌مندی ماهانه (ریال)" value={p.salary.family} onChange={(n) => setP({ ...p, salary: { ...p.salary, family: n } })} />
        <NumField label="اولاد هر فرزند (ریال)" value={p.salary.child_per} onChange={(n) => setP({ ...p, salary: { ...p.salary, child_per: n } })} />
        <NumField label="ضریب اضافه‌کاری" value={p.salary.overtime_coef} onChange={(n) => setP({ ...p, salary: { ...p.salary, overtime_coef: n } })} />
        <NumField label="سهم بیمه کارگر (مثلاً 0.07)" value={p.salary.insurance_employee} onChange={(n) => setP({ ...p, salary: { ...p.salary, insurance_employee: n } })} />
        <NumField label="معافیت مالیات حقوق ماهانه (ریال)" value={p.salary.tax_exempt_monthly} onChange={(n) => setP({ ...p, salary: { ...p.salary, tax_exempt_monthly: n } })} />
      </div>

      <h3>هزینه استخدام</h3>
      <div className="settings-grid">
        <NumField label="سهم بیمه کارفرما (مثلاً 0.23)" value={p.hiring.insurance_employer} onChange={(n) => setP({ ...p, hiring: { ...p.hiring, insurance_employer: n } })} />
        <NumField label="سنوات (ماه به ازای هر سال)" value={p.hiring.severance_months} onChange={(n) => setP({ ...p, hiring: { ...p.hiring, severance_months: n } })} />
        <NumField label="عیدی (ماه)" value={p.hiring.eydi_months} onChange={(n) => setP({ ...p, hiring: { ...p.hiring, eydi_months: n } })} />
        <NumField label="مرخصی سالانه (روز)" value={p.hiring.leave_days} onChange={(n) => setP({ ...p, hiring: { ...p.hiring, leave_days: n } })} />
      </div>

      <h3>مالیات</h3>
      <div className="settings-grid">
        <NumField label="نرخ ارزش افزوده (٪)" value={p.vat_rate} onChange={(n) => setP({ ...p, vat_rate: n })} />
        <NumField label="معافیت سالانه مشاغل (ریال)" value={p.business_exempt} onChange={(n) => setP({ ...p, business_exempt: n })} />
        <label className="settings-field">
          پله‌های مالیات مشاغل (٪، با ویرگول)
          <input value={p.tax_brackets.join(',')} onChange={(e) => setP({ ...p, tax_brackets: e.target.value.split(',').map((x) => Number(x.trim()) || 0).filter((x) => x > 0) })} />
        </label>
        <label className="settings-field">
          سقف پله‌ها (ریال، با ویرگول)
          <input value={p.bracket_caps.join(',')} onChange={(e) => setP({ ...p, bracket_caps: e.target.value.split(',').map((x) => Number(x.trim()) || 0).filter((x) => x > 0) })} />
        </label>
      </div>

      <h3>بازنشستگی</h3>
      <div className="settings-grid">
        <NumField label="سن بازنشستگی عادی" value={p.retirement.min_age} onChange={(n) => setP({ ...p, retirement: { ...p.retirement, min_age: n } })} />
        <NumField label="حداقل سابقه عادی (سال)" value={p.retirement.min_years} onChange={(n) => setP({ ...p, retirement: { ...p.retirement, min_years: n } })} />
        <NumField label="سن حالت جایگزین" value={p.retirement.alt_age} onChange={(n) => setP({ ...p, retirement: { ...p.retirement, alt_age: n } })} />
        <NumField label="سابقه حالت جایگزین (سال)" value={p.retirement.alt_years} onChange={(n) => setP({ ...p, retirement: { ...p.retirement, alt_years: n } })} />
        <NumField label="سابقه بدون شرط سن (سال)" value={p.retirement.max_years} onChange={(n) => setP({ ...p, retirement: { ...p.retirement, max_years: n } })} />
      </div>

      <button className="button button-green" onClick={save}>
        <Save size={16} /> ذخیره تنظیمات
      </button>
      {saved && <small className="admin-success">✓ تنظیمات ذخیره شد و در همه ماشین‌حساب‌ها اعمال می‌شود.</small>}
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

function OrdersTab() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('orders').select('id,full_name,mobile,service_title,amount,status,created_at').order('created_at', { ascending: false });
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
            <th>نام</th>
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
              <td>{order.full_name || '—'}</td>
              <td>{order.mobile || '—'}</td>
              <td>{order.service_title || '—'}</td>
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
              <td colSpan={6}>هیچ سفارشی ثبت نشده است.</td>
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

function NewsletterTab() {
  const [items, setItems] = useState<{ id: number; mobile: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from('newsletter')
      .select('id,mobile,created_at')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (active) {
          setItems((data || []) as { id: number; mobile: string; created_at: string }[]);
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
      <h2>اعضای خبرنامه</h2>
      <table className="admin-table">
        <thead>
          <tr>
            <th>موبایل</th>
            <th>تاریخ</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.mobile}</td>
              <td>{fmtDate(item.created_at)}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={2}>هنوز عضوی ثبت نشده است.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
