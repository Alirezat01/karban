import React, { useEffect, useState } from 'react';
import {
  ArrowLeft, Bell, Calculator, FileSignature, FileText, Layers, LayoutDashboard, LifeBuoy, LogOut,
  Mail, MessagesSquare, Newspaper, Phone, Plus, Save, Send, ShieldCheck, ShoppingCart, SlidersHorizontal,
  Star, Trash2, Users, Wrench, KeyRound, CreditCard,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { contractCatalog, CONTRACT_TYPES, INDUSTRIES, legalConfig } from '@/data/config';
import { formatFaDate, formatRial, formatFaNumber } from '@/lib/format';
import { DEFAULT_ACC_CONFIG, type AccConfig } from '@/lib/acc/config';
import { INVOICE_TEMPLATES } from '@/lib/acc/constants';
import { fetchTelegramConfig, saveTelegramConfig, sendTelegramDirect, drainTelegramQueue, type TelegramConfig, DEFAULT_TELEGRAM_CONFIG } from '@/lib/acc/telegram';
import { useCountUp } from '@/lib/reveal';
import KarbanLoader from '@/components/KarbanLoader';
import FaNumberInput from '@/components/FaNumberInput';

type Tab = 'overview' | 'services' | 'settings' | 'accounting' | 'licenses' | 'telegram' | 'contracts' | 'articles' | 'requests' | 'leads' | 'orders' | 'consultations' | 'users' | 'newsletter' | 'tickets' | 'feedback' | 'notifs';
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
type ArticleRow = { id: number; category: string; title: string; intro: string; body: string; author: string };
type RequestRow = { id: number; category: string; title: string; intro: string; body: string };
type LeadRow = { id: number; mobile: string; source: string; created_at: string };
type OrderRow = { id: string; full_name: string; mobile: string; service_title: string; amount: number; status: string; created_at: string };

const ARTICLE_CATEGORIES = ['حقوقی و قانون کار', 'مالیات', 'حسابداری', 'منابع انسانی', 'مدیریت'];
const REQUEST_CATEGORIES = ['روابط کار', 'مالی و بانکی', 'اداری و عمومی'];

const fmtDate = (value: string) => formatFaDate(value);
/* قیمت خدمات رشته است — اگر عددی باشد با ارقام فارسی و «ریال» نمایش داده می‌شود */
const displayPrice = (price: string) => {
  const numeric = Number(price);
  return price && Number.isFinite(numeric) && numeric > 0 ? formatRial(price) : price || '—';
};
const loginLockKey = (email: string) => `karban-login-lock:${email.trim().toLowerCase()}`;
const loginFailKey = (email: string) => `karban-login-fails:${email.trim().toLowerCase()}`;
const sessionKey = 'karban-admin-session-start';

const safeAmount = (raw: string) => {
  const digits = raw
    .replace(/[^0-9۰-۹]/g, '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  return digits;
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
  const [tab, setTab] = useState<Tab>('overview');
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

  if (session === 'loading') return <div className="admin-loading"><KarbanLoader label="در حال بررسی نشست…" /></div>;

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
          <button type="button" className="button" onClick={signOut}>
            خروج <LogOut size={16} />
          </button>
        </div>
      </section>
    );
  }

  /* منوی گروه‌بندی‌شده — هر بخش چند آیتم مرتبط */
  const menu: { group: string; items: [Tab, string, typeof ShieldCheck][] }[] = [
    { group: 'کلی', items: [['overview', 'نمای کلی', LayoutDashboard]] },
    { group: 'فروش و مشتریان', items: [
      ['orders', 'سفارش‌ها', ShoppingCart],
      ['services', 'خدمات', Wrench],
      ['consultations', 'مشاوره‌ها', MessagesSquare],
      ['leads', 'شماره‌های دانلود', Phone],
    ] },
    { group: 'محتوا', items: [
      ['contracts', 'قراردادها', FileSignature],
      ['articles', 'مقاله‌ها', Newspaper],
      ['requests', 'درخواست‌های اداری', FileText],
    ] },
    { group: 'مالی و حسابداری', items: [
      ['accounting', 'تنظیمات حسابداری', Calculator],
      ['licenses', 'لایسنس‌های اشتراک', CreditCard],
      ['telegram', 'اتصال تلگرام', Send],
    ] },
    { group: 'پشتیبانی', items: [
      ['tickets', 'تیکت‌ها', LifeBuoy],
      ['feedback', 'بازخوردها', Star],
      ['notifs', 'اعلان همگانی', Bell],
    ] },
    { group: 'سیستم', items: [
      ['settings', 'پارامترهای محاسبات', SlidersHorizontal],
      ['users', 'کاربران و مدیران', Users],
      ['newsletter', 'خبرنامه', Mail],
    ] },
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
          <button type="button" className="admin-logout" onClick={signOut}>
            خروج <LogOut size={15} />
          </button>
        </div>

        <div className="admin-shell">
          <aside className="admin-side">
            {menu.map((g) => (
              <div className="admin-side-group" key={g.group}>
                <div className="admin-side-label">{g.group}</div>
                {g.items.map(([key, label, Icon]) => (
                  <button type="button" key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
                    <Icon size={15} aria-hidden /> {label}
                  </button>
                ))}
              </div>
            ))}
          </aside>

          <div className="admin-content">
            {tab === 'overview' && <OverviewTab go={setTab} />}
            {tab === 'services' && <ServicesTab />}
            {tab === 'settings' && <SettingsTab />}
            {tab === 'accounting' && <AccountingTab />}
            {tab === 'licenses' && <LicensesTab />}
            {tab === 'telegram' && <TelegramTab />}
            {tab === 'contracts' && <ContractsTab />}
            {tab === 'articles' && <ArticlesTab />}
            {tab === 'requests' && <RequestsTab />}
            {tab === 'leads' && <LeadsTab />}
            {tab === 'orders' && <OrdersTab />}
            {tab === 'consultations' && <ConsultationsTab />}
            {tab === 'tickets' && <TicketsTab />}
            {tab === 'feedback' && <FeedbackTab />}
            {tab === 'notifs' && <NotifsTab />}
            {tab === 'users' && <UsersTab />}
            {tab === 'newsletter' && <NewsletterTab />}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── نمای کلی: آمار زنده + آخرین رویدادها ── */
function AdminStat({ icon: Icon, label, value, ready }: { icon: typeof ShieldCheck; label: string; value: number; ready: boolean }) {
  const { ref, value: shown } = useCountUp(ready ? value : 0);
  return (
    <div className="admin-stat">
      <span className="admin-stat-icon"><Icon size={20} aria-hidden /></span>
      <div>
        <b ref={ref}>{shown.toLocaleString('fa-IR')}</b>
        <span>{label}</span>
      </div>
    </div>
  );
}

function OverviewTab({ go }: { go: (tab: Tab) => void }) {
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [recentOrders, setRecentOrders] = useState<OrderRow[]>([]);
  const [openTickets, setOpenTickets] = useState<{ id: string; subject: string; status: string; created_at: string }[]>([]);

  useEffect(() => {
    let alive = true;
    const cnt = async (p: PromiseLike<{ count: number | null }>) => {
      try { return (await p).count || 0; } catch { return 0; }
    };
    (async () => {
      const [services, contracts, articles, requests, leads, orders, consults, tickets, feedback, users, subs] = await Promise.all([
        cnt(supabase.from('services').select('id', { count: 'exact', head: true })),
        cnt(supabase.from('contracts').select('id', { count: 'exact', head: true })),
        cnt(supabase.from('articles').select('id', { count: 'exact', head: true })),
        cnt(supabase.from('admin_requests').select('id', { count: 'exact', head: true })),
        cnt(supabase.from('leads').select('id', { count: 'exact', head: true })),
        cnt(supabase.from('orders').select('id', { count: 'exact', head: true })),
        cnt(supabase.from('consultation_requests').select('id', { count: 'exact', head: true }).eq('status', 'new')),
        cnt(supabase.from('tickets').select('id', { count: 'exact', head: true }).in('status', ['open', 'answered'])),
        cnt(supabase.from('feedback').select('id', { count: 'exact', head: true })),
        cnt(supabase.from('profiles').select('id', { count: 'exact', head: true })),
        cnt(supabase.from('newsletter').select('id', { count: 'exact', head: true })),
      ]);
      if (alive) setStats({ services, contracts, articles, requests, leads, orders, consults, tickets, feedback, users, subs });
    })();
    (async () => {
      const [o, t] = await Promise.all([
        supabase.from('orders').select('id,full_name,service_title,amount,status,created_at').order('created_at', { ascending: false }).limit(4),
        supabase.from('tickets').select('id,subject,status,created_at').in('status', ['open', 'answered']).order('created_at', { ascending: false }).limit(4),
      ]);
      if (alive) {
        setRecentOrders((o.data || []) as OrderRow[]);
        setOpenTickets((t.data || []) as { id: string; subject: string; status: string; created_at: string }[]);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <>
      <div className="admin-toolbar"><h2>نمای کلی</h2></div>
      <div className="admin-stat-grid">
        <AdminStat icon={Layers} label="خدمات" value={stats?.services ?? 0} ready={!!stats} />
        <AdminStat icon={FileSignature} label="قراردادها" value={stats?.contracts ?? 0} ready={!!stats} />
        <AdminStat icon={Newspaper} label="مقاله‌ها" value={stats?.articles ?? 0} ready={!!stats} />
        <AdminStat icon={FileText} label="درخواست‌های اداری" value={stats?.requests ?? 0} ready={!!stats} />
        <AdminStat icon={Phone} label="شماره‌های دانلود" value={stats?.leads ?? 0} ready={!!stats} />
        <AdminStat icon={ShoppingCart} label="سفارش‌ها" value={stats?.orders ?? 0} ready={!!stats} />
        <AdminStat icon={MessagesSquare} label="مشاوره‌های جدید" value={stats?.consults ?? 0} ready={!!stats} />
        <AdminStat icon={LifeBuoy} label="تیکت در جریان" value={stats?.tickets ?? 0} ready={!!stats} />
        <AdminStat icon={Star} label="بازخوردها" value={stats?.feedback ?? 0} ready={!!stats} />
        <AdminStat icon={Users} label="کاربران" value={stats?.users ?? 0} ready={!!stats} />
        <AdminStat icon={Mail} label="مشترکان خبرنامه" value={stats?.subs ?? 0} ready={!!stats} />
      </div>

      <div className="admin-cols">
        <div className="admin-mini">
          <h3><ShoppingCart size={15} /> آخرین سفارش‌ها</h3>
          {recentOrders.length === 0 ? (
            <p className="admin-empty">هنوز سفارشی ثبت نشده است.</p>
          ) : (
            recentOrders.map((o) => (
              <div className="admin-mini-row" key={o.id}>
                <span>{o.service_title} — {o.full_name}</span>
                <small>{fmtDate(o.created_at)}</small>
              </div>
            ))
          )}
          <button type="button" className="button button-small" style={{ marginTop: '.7rem' }} onClick={() => go('orders')}>مدیریت سفارش‌ها</button>
        </div>

        <div className="admin-mini">
          <h3><LifeBuoy size={15} /> تیکت‌های در جریان</h3>
          {openTickets.length === 0 ? (
            <p className="admin-empty">تیکت بازی وجود ندارد.</p>
          ) : (
            openTickets.map((t) => (
              <div className="admin-mini-row" key={t.id}>
                <span>{t.subject}</span>
                <small>{fmtDate(t.created_at)}</small>
              </div>
            ))
          )}
          <button type="button" className="button button-small" style={{ marginTop: '.7rem' }} onClick={() => go('tickets')}>مدیریت تیکت‌ها</button>
        </div>
      </div>
    </>
  );
}

/* فیلد عددی ادمین — ارقام فارسی + جداکننده سه‌رقمی زنده (decimal برای ضرایب و نرخ‌ها) */
function NumField({ label, value, onChange, decimal }: { label: string; value: number; onChange: (n: number) => void; decimal?: boolean }) {
  return (
    <label className="settings-field">
      {label}
      <FaNumberInput value={value ?? 0} onChange={onChange} decimal={decimal} />
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
    const { data } = await supabase.from('services').select('id,title,price,description,domain,unit,featured,kind,discount_percent').order('id', { ascending: false });
    setServices((data || []) as Service[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (id: string) => {
    const current = services.find((service) => service.id === id);
    if (!current) return;
    const payload: Record<string, unknown> = { ...current };
    delete payload.id;
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

  if (loading) return <KarbanLoader label="در حال بارگذاری…" />;
  return (
    <div className="admin-table-wrap">
      <div className="admin-toolbar">
        <h2>مدیریت خدمات</h2>
        <button type="button" className="button button-small" onClick={() => setShowAdd(!showAdd)}>
          <Plus size={15} /> افزودن خدمت
        </button>
      </div>

      {showAdd && (
        <div className="admin-form">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="عنوان خدمت" />
          <input value={form.price} onChange={(e) => setForm({ ...form, price: safeAmount(e.target.value) })} placeholder="قیمت" />
          <FaNumberInput value={form.discount_percent} onChange={(n) => setForm({ ...form, discount_percent: Math.max(0, Math.min(90, n)) })} placeholder="درصد تخفیف" />
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
          <button type="button" className="button button-small" onClick={add}>
            <Save size={15} /> ذخیره
          </button>
        </div>
      )}

      <table className="admin-table">
        <thead>
          <tr>
            <th>#</th>
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
          {services.map((service, index) => (
            <tr key={service.id}>
              <td>{(index + 1).toLocaleString('fa-IR')}</td>
              <td>
                {editing === service.id ? (
                  <input value={service.title} onChange={(e) => updateField(service.id, 'title', e.target.value)} />
                ) : (
                  service.title
                )}
              </td>
              <td>
                {editing === service.id ? (
                  <input value={service.price} onChange={(e) => updateField(service.id, 'price', safeAmount(e.target.value))} placeholder="قیمت" style={{ minWidth: 130 }} />
                ) : (
                  displayPrice(service.price)
                )}
              </td>
              <td>
                {editing === service.id ? (
                  <FaNumberInput
                    value={service.discount_percent || 0}
                    onChange={(n) => updateField(service.id, 'discount_percent', Math.max(0, Math.min(90, n)))}
                    style={{ minWidth: 90 }}
                  />
                ) : (
                  `${(service.discount_percent || 0).toLocaleString('fa-IR')}٪`
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
                  <button type="button" className="button button-small" onClick={() => save(service.id)}>
                    <Save size={14} />
                  </button>
                ) : (
                  <button type="button" className="button button-small" onClick={() => setEditing(service.id)}>
                    ویرایش
                  </button>
                )}
                <button type="button" className="admin-delete" onClick={() => remove(service.id)}>
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

  if (loading) return <KarbanLoader label="در حال بارگذاری…" />;

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
        <NumField label="ضریب اضافه‌کاری" decimal value={p.salary.overtime_coef} onChange={(n) => setP({ ...p, salary: { ...p.salary, overtime_coef: n } })} />
        <NumField label="سهم بیمه کارگر (مثلاً ۰٫۰۷)" decimal value={p.salary.insurance_employee} onChange={(n) => setP({ ...p, salary: { ...p.salary, insurance_employee: n } })} />
        <NumField label="معافیت مالیات حقوق ماهانه (ریال)" value={p.salary.tax_exempt_monthly} onChange={(n) => setP({ ...p, salary: { ...p.salary, tax_exempt_monthly: n } })} />
      </div>

      <h3>هزینه استخدام</h3>
      <div className="settings-grid">
        <NumField label="سهم بیمه کارفرما (مثلاً ۰٫۲۳)" decimal value={p.hiring.insurance_employer} onChange={(n) => setP({ ...p, hiring: { ...p.hiring, insurance_employer: n } })} />
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

      <button type="button" className="button button-green" onClick={save}>
        <Save size={16} /> ذخیره تنظیمات
      </button>
      {saved && <small className="admin-success">✓ تنظیمات ذخیره شد و در همه ماشین‌حساب‌ها اعمال می‌شود.</small>}
    </div>
  );
}

/* ── تب حسابداری: تنظیمات ماژول + آمار زنده ── */
function AccountingTab() {
  const [cfg, setCfg] = useState<AccConfig>(DEFAULT_ACC_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [stats, setStats] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    let active = true;
    const cnt = async (p: PromiseLike<{ count: number | null }>) => {
      try { return (await p).count || 0; } catch { return 0; }
    };
    (async () => {
      const [conf, businesses, licenses, trials, invoices, expenses, checks, stuff] = await Promise.all([
        supabase.from('app_settings').select('value').eq('key', 'acc_config').maybeSingle(),
        cnt(supabase.from('acc_businesses').select('id', { count: 'exact', head: true })),
        cnt(supabase.from('acc_access').select('id', { count: 'exact', head: true }).in('status', ['active', 'trial'])),
        cnt(supabase.from('acc_trial_requests').select('id', { count: 'exact', head: true })),
        cnt(supabase.from('acc_invoices').select('id', { count: 'exact', head: true })),
        cnt(supabase.from('acc_expenses').select('id', { count: 'exact', head: true })),
        cnt(supabase.from('acc_checks').select('id', { count: 'exact', head: true })),
        cnt(supabase.from('acc_stuff_catalog').select('id', { count: 'exact', head: true })),
      ]);
      if (!active) return;
      if (conf.data?.value) setCfg({ ...DEFAULT_ACC_CONFIG, ...(conf.data.value as Partial<AccConfig>) });
      setStats({
        businesses: businesses || 0, licenses: licenses || 0, trials: trials || 0,
        invoices: invoices || 0, expenses: expenses || 0, checks: checks || 0, stuff: stuff || 0,
      });
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const save = async () => {
    await supabase.from('app_settings').upsert({ key: 'acc_config', value: cfg, updated_at: new Date().toISOString() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <KarbanLoader label="در حال بارگذاری تنظیمات حسابداری…" />;

  return (
    <div className="admin-settings">
      <h2>نرم‌افزار حسابداری هوشمند کاربان</h2>
      <p>تنظیمات سراسری ماژول حسابداری — بلافاصله در پنل کاربران و صفحه فرود اعمال می‌شود. همه مبالغ به <b>ریال</b> است.</p>

      <h3>وضعیت ماژول</h3>
      <div className="admin-stat-grid">
        <AdminStat icon={Layers} label="کسب‌وکارهای ثبت‌شده" value={stats?.businesses ?? 0} ready={!!stats} />
        <AdminStat icon={ShieldCheck} label="لایسنس فعال/آزمایشی" value={stats?.licenses ?? 0} ready={!!stats} />
        <AdminStat icon={Users} label="درخواست‌های تریال" value={stats?.trials ?? 0} ready={!!stats} />
        <AdminStat icon={FileText} label="صورتحساب‌ها" value={stats?.invoices ?? 0} ready={!!stats} />
        <AdminStat icon={Wrench} label="هزینه‌های ثبت‌شده" value={stats?.expenses ?? 0} ready={!!stats} />
        <AdminStat icon={FileSignature} label="چک‌های ثبت‌شده" value={stats?.checks ?? 0} ready={!!stats} />
      </div>

      <h3>مالیات و دوره آزمایشی</h3>
      <div className="settings-grid">
        <NumField label="نرخ پیش‌فرض ارزش افزوده (٪)" value={cfg.vat_rate} onChange={(n) => setCfg({ ...cfg, vat_rate: n })} />
        <NumField label="روزهای تریال رایگان" value={cfg.trial_days} onChange={(n) => setCfg({ ...cfg, trial_days: n })} />
        <NumField label="سقف صورتحساب تریال" value={cfg.trial_invoice_limit} onChange={(n) => setCfg({ ...cfg, trial_invoice_limit: n })} />
        <NumField label="ردیف‌های کاتالوگ شناسه مودیان (نمایش)" value={stats?.stuff ?? 0} onChange={() => { /* فقط نمایش */ }} />
      </div>

      <h3>قیمت پلن‌ها (ریال)</h3>
      <div className="settings-grid">
        <NumField label="اشتراک ماهانه (ریال)" value={cfg.price_monthly} onChange={(n) => setCfg({ ...cfg, price_monthly: n })} />
        <NumField label="اشتراک سالانه (ریال)" value={cfg.price_yearly} onChange={(n) => setCfg({ ...cfg, price_yearly: n })} />
        <NumField label="سقف کسب‌وکار — تریال" value={cfg.business_limit_trial} onChange={(n) => setCfg({ ...cfg, business_limit_trial: n })} />
        <NumField label="سقف کسب‌وکار — ماهانه" value={cfg.business_limit_monthly} onChange={(n) => setCfg({ ...cfg, business_limit_monthly: n })} />
        <NumField label="سقف کسب‌وکار — سالانه" value={cfg.business_limit_yearly} onChange={(n) => setCfg({ ...cfg, business_limit_yearly: n })} />
        <NumField label="سقف کسب‌وکار — بنیان‌گذار" value={cfg.business_limit_founder} onChange={(n) => setCfg({ ...cfg, business_limit_founder: n })} />
      </div>

      <h3>سایر</h3>
      <div className="settings-grid">
        <label className="settings-field" style={{ gridColumn: 'span 2' }}>
          پیام برند زیر فاکتورهای بدون لوگو
          <input value={cfg.brand_tagline} onChange={(e) => setCfg({ ...cfg, brand_tagline: e.target.value })} />
        </label>
        <label className="settings-field">
          مدل پیش‌فرض چاپ فاکتور
          <select value={cfg.default_template} onChange={(e) => setCfg({ ...cfg, default_template: e.target.value })}>
            {INVOICE_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.free ? 'رایگان' : 'پیشرفته'}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.9rem' }}>
          <input type="checkbox" checked={cfg.public_invoice_maker} onChange={(e) => setCfg({ ...cfg, public_invoice_maker: e.target.checked })} />
          فاکتورساز عمومی سایت فعال باشد
        </label>
      </div>

      <button type="button" className="button button-green" onClick={save}>
        <Save size={16} /> ذخیره تنظیمات حسابداری
      </button>
      {saved && <small className="admin-success">✓ ذخیره شد — در پنل کاربران و صفحه فرود حسابداری اعمال می‌شود.</small>}
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
    const { data } = await supabase.from('contracts').select('id,title,type,industry,summary,body,pdf_url').order('id', { ascending: false });
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

  if (loading) return <KarbanLoader label="در حال بارگذاری…" />;

  return (
    <div className="admin-table-wrap">
      <div className="admin-toolbar">
        <h2>قراردادها</h2>
        <button type="button" className="button button-small" onClick={() => setShowAdd(!showAdd)}>
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
          <button type="button" className="button button-small" onClick={add}>
            <Save size={15} /> ذخیره
          </button>
        </div>
      )}
      <table className="admin-table">
        <thead>
          <tr>
            <th>#</th>
            <th>عنوان</th>
            <th>نوع</th>
            <th>صنف</th>
            <th>خلاصه</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((contract, index) => (
            <React.Fragment key={contract.id}>
              <tr>
                <td>{(index + 1).toLocaleString('fa-IR')}</td>
                <td>{contract.title}</td>
                <td>{contract.type || '—'}</td>
                <td>{contract.industry || '—'}</td>
                <td>{contract.summary || '—'}</td>
                <td className="admin-actions">
                  <button type="button" className="button button-small" onClick={() => (editing === contract.id ? setEditing(null) : startEdit(contract))}>
                    {editing === contract.id ? 'لغو' : 'ویرایش'}
                  </button>
                  <button type="button" className="admin-delete" onClick={() => remove(contract.id)}>
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
              {editing === contract.id && (
                <tr>
                  <td colSpan={6}>
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
                      <button type="button" className="button button-small" onClick={() => saveEdit(contract.id)}>
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
              <td colSpan={6}>
                <div className="admin-empty">
                  <p>هیچ قراردادی ثبت نشده است.</p>
                  <button type="button" className="button button-small" onClick={migrateLegacy} disabled={migrating}>
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

function ArticlesTab() {
  const [items, setItems] = useState<ArticleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ category: ARTICLE_CATEGORIES[0], title: '', intro: '', author: 'تیم کاربان', body: '' });
  const [status, setStatus] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('articles').select('id,category,title,intro,body,author').order('id', { ascending: false });
    setItems((data || []) as ArticleRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm({ category: ARTICLE_CATEGORIES[0], title: '', intro: '', author: 'تیم کاربان', body: '' });
    setStatus('');
    setShowForm(true);
  };

  const openEdit = (article: ArticleRow) => {
    setEditingId(article.id);
    setForm({ category: article.category, title: article.title, intro: article.intro, author: article.author, body: article.body });
    setStatus('');
    setShowForm(true);
  };

  const save = async () => {
    if (!form.title || !form.body) {
      setStatus('عنوان و متن مقاله الزامی است.');
      return;
    }
    const payload = { category: form.category, title: form.title, intro: form.intro, author: form.author, body: form.body };
    const { error } = editingId
      ? await supabase.from('articles').update(payload).eq('id', editingId)
      : await supabase.from('articles').insert(payload);
    if (error) {
      setStatus('ذخیره نشد: ' + error.message);
      return;
    }
    setStatus(editingId ? '✓ مقاله به‌روزرسانی شد.' : '✓ مقاله منتشر شد.');
    setShowForm(false);
    load();
  };

  const remove = async (id: number) => {
    if (!window.confirm('این مقاله حذف شود؟')) return;
    await supabase.from('articles').delete().eq('id', id);
    load();
  };

  if (loading) return <KarbanLoader label="در حال بارگذاری…" />;
  return (
    <div className="admin-table-wrap">
      <div className="admin-toolbar">
        <h2>مدیریت مقاله‌های دانشنامه</h2>
        <button type="button" className="button button-small" onClick={() => (showForm ? setShowForm(false) : openAdd())}>
          <Plus size={15} /> {showForm ? 'بستن فرم' : 'افزودن مقاله'}
        </button>
      </div>

      {showForm && (
        <div className="admin-form admin-form-block">
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} aria-label="دسته">
            {ARTICLE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="عنوان مقاله" />
          <textarea value={form.intro} onChange={(e) => setForm({ ...form, intro: e.target.value })} placeholder="چکیده (۱–۲ خط)" rows={2} style={{ width: '100%', resize: 'vertical' }} />
          <input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} placeholder="نویسنده" />
          <textarea
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder={'متن مقاله — پاراگراف‌ها را با یک خط خالی جدا کن؛ برای سرتیتر، اول خط بنویس: ## '}
            rows={14}
            style={{ width: '100%', resize: 'vertical' }}
          />
          <button type="button" className="button button-small" onClick={save}>
            <Save size={15} /> {editingId ? 'به‌روزرسانی' : 'انتشار مقاله'}
          </button>
          {status && <small className="admin-success">{status}</small>}
        </div>
      )}

      <table className="admin-table">
        <thead>
          <tr>
            <th>#</th>
            <th>عنوان</th>
            <th>دسته</th>
            <th>نویسنده</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((article, index) => (
            <tr key={article.id}>
              <td>{(index + 1).toLocaleString('fa-IR')}</td>
              <td>{article.title}</td>
              <td>{article.category}</td>
              <td>{article.author}</td>
              <td className="admin-actions">
                <button type="button" className="button button-small" onClick={() => openEdit(article)}>
                  ویرایش
                </button>
                <button type="button" className="admin-delete" onClick={() => remove(article.id)}>
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={5}>هیچ مقاله‌ای ثبت نشده است.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function RequestsTab() {
  const [items, setItems] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ category: REQUEST_CATEGORIES[0], title: '', intro: '', body: '' });
  const [status, setStatus] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('admin_requests').select('id,category,title,intro,body').order('id', { ascending: false });
    setItems((data || []) as RequestRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm({ category: REQUEST_CATEGORIES[0], title: '', intro: '', body: '' });
    setStatus('');
    setShowForm(true);
  };

  const openEdit = (item: RequestRow) => {
    setEditingId(item.id);
    setForm({ category: item.category, title: item.title, intro: item.intro, body: item.body });
    setStatus('');
    setShowForm(true);
  };

  const save = async () => {
    if (!form.title || !form.body) {
      setStatus('عنوان و متن درخواست الزامی است.');
      return;
    }
    const { error } = editingId
      ? await supabase.from('admin_requests').update(form).eq('id', editingId)
      : await supabase.from('admin_requests').insert(form);
    if (error) {
      setStatus('ذخیره نشد: ' + error.message);
      return;
    }
    setStatus('✓ ذخیره شد و در سایت نمایش داده می‌شود.');
    setShowForm(false);
    load();
  };

  const remove = async (id: number) => {
    if (!window.confirm('این درخواست حذف شود؟')) return;
    await supabase.from('admin_requests').delete().eq('id', id);
    load();
  };

  if (loading) return <KarbanLoader label="در حال بارگذاری…" />;
  return (
    <div className="admin-table-wrap">
      <div className="admin-toolbar">
        <h2>مدیریت درخواست‌های اداری</h2>
        <button type="button" className="button button-small" onClick={() => (showForm ? setShowForm(false) : openAdd())}>
          <Plus size={15} /> {showForm ? 'بستن فرم' : 'افزودن درخواست'}
        </button>
      </div>

      {showForm && (
        <div className="admin-form admin-form-block">
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} aria-label="دسته">
            {REQUEST_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="عنوان درخواست (مثلاً استعفانامه)" />
          <textarea value={form.intro} onChange={(e) => setForm({ ...form, intro: e.target.value })} placeholder="توضیح کوتاه برای کارت" rows={2} style={{ width: '100%', resize: 'vertical' }} />
          <textarea
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder={'متن کامل درخواست — جاهای خالی را با ……… بگذار'}
            rows={12}
            style={{ width: '100%', resize: 'vertical' }}
          />
          <button type="button" className="button button-small" onClick={save}>
            <Save size={15} /> {editingId ? 'به‌روزرسانی' : 'انتشار درخواست'}
          </button>
          {status && <small className="admin-success">{status}</small>}
        </div>
      )}

      <table className="admin-table">
        <thead>
          <tr>
            <th>#</th>
            <th>عنوان</th>
            <th>دسته</th>
            <th>توضیح</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id}>
              <td>{(index + 1).toLocaleString('fa-IR')}</td>
              <td>{item.title}</td>
              <td>{item.category}</td>
              <td>{item.intro || '—'}</td>
              <td className="admin-actions">
                <button type="button" className="button button-small" onClick={() => openEdit(item)}>
                  ویرایش
                </button>
                <button type="button" className="admin-delete" onClick={() => remove(item.id)}>
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={5}>هیچ درخواستی ثبت نشده است.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function LeadsTab() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [ordered, setOrdered] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from('leads').select('id,mobile,source,created_at').order('created_at', { ascending: false }),
      supabase.from('orders').select('mobile'),
    ]).then(([leadsRes, ordersRes]) => {
      if (!active) return;
      setLeads((leadsRes.data || []) as LeadRow[]);
      setOrdered(new Set(((ordersRes.data || []) as { mobile: string }[]).map((o) => o.mobile)));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const remove = async (id: number) => {
    if (!window.confirm('این شماره حذف شود؟')) return;
    await supabase.from('leads').delete().eq('id', id);
    const { data } = await supabase.from('leads').select('id,mobile,source,created_at').order('created_at', { ascending: false });
    setLeads((data || []) as LeadRow[]);
  };

  const sourceLabel = (source: string) => (source === 'contract_download' ? 'دانلود قرارداد' : source);

  if (loading) return <KarbanLoader label="در حال بارگذاری…" />;
  return (
    <div className="admin-table-wrap">
      <h2>شماره‌های دانلود (کسانی که قرارداد/درخواست دانلود کرده‌اند)</h2>
      <p>این شماره‌ها هنگام دانلود ثبت شده‌اند؛ ستون «وضعیت» نشان می‌دهد کدام‌ها بعداً سفارش داده‌اند — فرصت‌های فروش تو این‌ها هستند.</p>
      <table className="admin-table">
        <thead>
          <tr>
            <th>#</th>
            <th>شماره موبایل</th>
            <th>محل ثبت</th>
            <th>تاریخ</th>
            <th>وضعیت</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead, index) => (
            <tr key={lead.id}>
              <td>{(index + 1).toLocaleString('fa-IR')}</td>
              <td className="mono">{lead.mobile}</td>
              <td>{sourceLabel(lead.source)}</td>
              <td>{fmtDate(lead.created_at)}</td>
              <td>{ordered.has(lead.mobile) ? <small className="admin-success">سفارش داده ✓</small> : <small className="admin-error">هنوز سفارش نداده</small>}</td>
              <td>
                <button type="button" className="admin-delete" onClick={() => remove(lead.id)}>
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
          {leads.length === 0 && (
            <tr>
              <td colSpan={6}>هنوز شماره‌ای ثبت نشده است.</td>
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

  const remove = async (id: string) => {
    if (!window.confirm('این سفارش حذف شود؟')) return;
    await supabase.from('orders').delete().eq('id', id);
    load();
  };

  const statusLabels: Record<string, string> = { pending: 'در انتظار', processing: 'در حال انجام', completed: 'تکمیل شد', cancelled: 'لغو شد' };

  if (loading) return <KarbanLoader label="در حال بارگذاری…" />;
  return (
    <div className="admin-table-wrap">
      <h2>سفارش‌ها</h2>
      <table className="admin-table">
        <thead>
          <tr>
            <th>#</th>
            <th>نام</th>
            <th>موبایل</th>
            <th>خدمت</th>
            <th>مبلغ</th>
            <th>وضعیت</th>
            <th>تاریخ</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order, index) => (
            <tr key={order.id}>
              <td>{(index + 1).toLocaleString('fa-IR')}</td>
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
              <td>
                <button type="button" className="admin-delete" onClick={() => remove(order.id)}>
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr>
              <td colSpan={8}>هیچ سفارشی ثبت نشده است.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ConsultationsTab() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('consultation_requests').select('*').order('created_at', { ascending: false }).limit(100);
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: string) => {
    await supabase.from('consultation_requests').update({ status }).eq('id', id);
    load();
  };

  const reply = async (item: Record<string, unknown>) => {
    const text = (note[item.id as string] || '').trim();
    if (!text) return;
    await supabase.from('consultation_requests').update({ status: 'in_progress', admin_note: text }).eq('id', item.id as string);
    if (item.user_id) {
      await supabase.from('notifications').insert({
        user_id: item.user_id,
        title: 'پاسخ مشاور کاربان',
        body: text.slice(0, 300),
        href: '/داشبورد',
      });
    }
    setNote({ ...note, [item.id as string]: '' });
    load();
  };

  if (loading) return <KarbanLoader label="در حال بارگذاری…" />;
  const hasDetail = items.some((i) => 'topic' in i || 'description' in i);
  return (
    <div className="admin-table-wrap">
      <h2>درخواست‌های مشاوره</h2>
      {!hasDetail && (
        <p className="muted-note">
          برای نمایش کامل (موضوع، توضیح، اولویت و پاسخ‌دهی)، ابتدا اسکریپت «phase12.sql» را در SQL Editor اجرا کن.
        </p>
      )}
      <table className="admin-table">
        <thead>
          <tr>
            <th>#</th>
            <th>موبایل</th>
            <th>موضوع / خدمت</th>
            {hasDetail && <th>توضیح</th>}
            {hasDetail && <th>اولویت</th>}
            {hasDetail && <th>وضعیت</th>}
            <th>تاریخ</th>
            {hasDetail && <th>پاسخ</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const id = String(item.id);
            return (
              <tr key={id}>
                <td>{(index + 1).toLocaleString('fa-IR')}</td>
                <td>{String(item.mobile || '—')}</td>
                <td>{String(item.topic || item.service || '—')}</td>
                {hasDetail && <td style={{ maxWidth: 260, whiteSpace: 'pre-wrap' }}>{String(item.description || '—')}</td>}
                {hasDetail && <td>{String(item.priority || 'معمولی')}</td>}
                {hasDetail && (
                  <td>
                    <select value={String(item.status || 'new')} onChange={(e) => setStatus(id, e.target.value)}>
                      <option value="new">جدید</option>
                      <option value="in_progress">در حال انجام</option>
                      <option value="done">انجام شد</option>
                      <option value="rejected">رد شد</option>
                    </select>
                  </td>
                )}
                <td>{fmtDate(String(item.created_at || ''))}</td>
                {hasDetail && (
                  <td>
                    <div style={{ display: 'flex', gap: '.3rem' }}>
                      <input
                        value={note[id] || ''}
                        onChange={(e) => setNote({ ...note, [id]: e.target.value })}
                        placeholder="پاسخ به کاربر…"
                        style={{ minWidth: 140 }}
                      />
                      <button type="button" className="button button-small" onClick={() => reply(item)}>ارسال</button>
                    </div>
                    {item.admin_note ? <small style={{ display: 'block', marginTop: '.3rem' }}>قبلی: {String(item.admin_note)}</small> : null}
                  </td>
                )}
              </tr>
            );
          })}
          {items.length === 0 && (
            <tr><td colSpan={8}>هیچ درخواستی ثبت نشده است.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ── تیکت‌ها ───────────────────────────────────────────────── */
type AdminTicket = { id: string; user_id: string; subject: string; status: string; priority: string; created_at: string };
type AdminTicketMsg = { id: string; ticket_id: string; sender: 'user' | 'admin'; body: string; attachment_path: string | null; created_at: string };

function TicketsTab() {
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AdminTicketMsg[]>([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('tickets').select('id,user_id,subject,status,priority,created_at').order('created_at', { ascending: false }).limit(100);
    setTickets((data || []) as AdminTicket[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openTicket = async (id: string) => {
    setOpenId(id);
    const { data } = await supabase.from('ticket_messages').select('id,ticket_id,sender,body,attachment_path,created_at').eq('ticket_id', id).order('created_at', { ascending: true });
    setMessages((data || []) as AdminTicketMsg[]);
  };

  const send = async () => {
    if (!openId || !reply.trim()) return;
    await supabase.from('ticket_messages').insert({ ticket_id: openId, sender: 'admin', body: reply.trim() });
    const ticket = tickets.find((t) => t.id === openId);
    await supabase.from('tickets').update({ status: 'answered' }).eq('id', openId);
    if (ticket?.user_id) {
      await supabase.from('notifications').insert({
        user_id: ticket.user_id,
        title: 'پاسخ پشتیبانی کاربان',
        body: reply.trim().slice(0, 300),
        href: '/داشبورد',
      });
    }
    setReply('');
    openTicket(openId);
    load();
  };

  const setStatus = async (id: string, status: string) => {
    await supabase.from('tickets').update({ status }).eq('id', id);
    load();
  };

  const openFile = async (path: string) => {
    const { data } = await supabase.storage.from('ticket-files').createSignedUrl(path, 120);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
  };

  if (loading) return <KarbanLoader label="در حال بارگذاری…" />;
  return (
    <div>
      <h2>تیکت‌های پشتیبانی</h2>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>موضوع</th><th>اولویت</th><th>وضعیت</th><th>تاریخ</th><th>گفت‌وگو</th></tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id}>
                <td>{t.subject}</td>
                <td>{t.priority}</td>
                <td>
                  <select value={t.status} onChange={(e) => setStatus(t.id, e.target.value)}>
                    <option value="open">باز</option>
                    <option value="answered">پاسخ داده شد</option>
                    <option value="closed">بسته شد</option>
                  </select>
                </td>
                <td>{fmtDate(t.created_at)}</td>
                <td><button type="button" className="button button-small" onClick={() => openTicket(t.id)}>{openId === t.id ? 'باز است' : 'نمایش'}</button></td>
              </tr>
            ))}
            {tickets.length === 0 && <tr><td colSpan={5}>تیکتی ثبت نشده است.</td></tr>}
          </tbody>
        </table>
      </div>

      {openId && (
        <div className="contact-card calc-card" style={{ marginTop: '1rem' }}>
          <h3>گفت‌وگوی تیکت</h3>
          {messages.map((m) => (
            <div key={m.id} className={`dash-msg ${m.sender === 'admin' ? 'is-admin' : ''}`}>
              <header><strong>{m.sender === 'admin' ? 'پشتیبانی' : 'کاربر'}</strong> <small>{fmtDate(m.created_at)}</small></header>
              <p>{m.body}</p>
              {m.attachment_path && (
                <button type="button" className="text-link" onClick={() => openFile(m.attachment_path!)}>فایل پیوست</button>
              )}
            </div>
          ))}
          <div style={{ display: 'flex', gap: '.5rem', marginTop: '.8rem', flexWrap: 'wrap' }}>
            <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="پاسخ پشتیبانی…" style={{ flex: 1, minWidth: 200 }} />
            <button type="button" className="button button-small" onClick={send}>ارسال پاسخ + اعلان</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── بازخوردها ─────────────────────────────────────────────── */
function FeedbackTab() {
  const [items, setItems] = useState<{ id: string; target_type: string; target_id: string; rating: number; comment: string | null; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('feedback').select('id,target_type,target_id,rating,comment,created_at').order('created_at', { ascending: false }).limit(200);
    setItems((data || []) as typeof items);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    await supabase.from('feedback').delete().eq('id', id);
    load();
  };

  if (loading) return <KarbanLoader label="در حال بارگذاری…" />;
  const avg = items.length ? (items.reduce((s, i) => s + i.rating, 0) / items.length).toFixed(1) : '—';
  return (
    <div className="admin-table-wrap">
      <h2>بازخورد کاربران — میانگین {formatFaNumber(Number(avg))} از ۵ ({formatFaNumber(items.length)} نظر)</h2>
      <table className="admin-table">
        <thead><tr><th>نوع</th><th>مقصد</th><th>امتیاز</th><th>نظر</th><th>تاریخ</th><th></th></tr></thead>
        <tbody>
          {items.map((f) => (
            <tr key={f.id}>
              <td>{f.target_type}</td>
              <td style={{ maxWidth: 240, overflowWrap: 'anywhere' }}>{f.target_id}</td>
              <td>{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</td>
              <td style={{ maxWidth: 300 }}>{f.comment || '—'}</td>
              <td>{fmtDate(f.created_at)}</td>
              <td><button type="button" className="button button-small button-outline" onClick={() => remove(f.id)}>حذف</button></td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={6}>بازخوردی ثبت نشده است.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ── اعلان‌ها ───────────────────────────────────────────────── */
function NotifsTab() {
  const [form, setForm] = useState({ title: '', body: '', href: '/داشبورد' });
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  const broadcast = async () => {
    if (!form.title.trim()) { setState('error'); return; }
    setState('sending');
    const { data: profiles } = await supabase.from('profiles').select('id');
    const rows = (profiles || []).map((p) => ({
      user_id: p.id,
      title: form.title.trim(),
      body: form.body.trim() || null,
      href: form.href || '/داشبورد',
    }));
    if (rows.length) await supabase.from('notifications').insert(rows);
    setState('done');
    setForm({ title: '', body: '', href: '/داشبورد' });
    setTimeout(() => setState('idle'), 2500);
  };

  return (
    <div className="contact-card calc-card" style={{ maxWidth: 560 }}>
      <h2>ارسال اعلان به همه کاربران</h2>
      <label>عنوان
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثلاً: تغییر قوانین بیمه ۱۴۰۵" />
      </label>
      <label>متن اعلان
        <textarea rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="خلاصه خبر…" />
      </label>
      <label>لینک (اختیاری)
        <input value={form.href} onChange={(e) => setForm({ ...form, href: e.target.value })} placeholder="/داشبورد" />
      </label>
      <button type="button" className="button" onClick={broadcast} disabled={state === 'sending'}>
        {state === 'sending' ? 'در حال ارسال…' : 'ارسال به همه'}
      </button>
      {state === 'done' && <small className="admin-success">اعلان برای همه کاربران ثبت شد.</small>}
      {state === 'error' && <small className="admin-error">عنوان را بنویس.</small>}
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

  if (loading) return <KarbanLoader label="در حال بارگذاری…" />;
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
        <button type="button" className="button button-green" onClick={addAdmin}>
          <Plus size={15} /> افزودن مدیر
        </button>
        <button type="button" className="button button-green" onClick={changeOwnPassword}>
          <Save size={15} /> تغییر رمز
        </button>
      </div>
      {status && <small className="admin-success">{status}</small>}
      <table className="admin-table" style={{ marginTop: '1rem' }}>
        <thead>
          <tr>
            <th>#</th>
            <th>شناسه</th>
            <th>نقش</th>
            <th>SHA-256</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, index) => (
            <tr key={user.id}>
              <td>{(index + 1).toLocaleString('fa-IR')}</td>
              <td>{user.id}</td>
              <td>{user.role}</td>
              <td className="mono">{user.password_sha256 || '—'}</td>
              <td>
                {user.role !== 'admin' && (
                  <button type="button" className="button button-small" onClick={() => promoteToAdmin(user.id)}>
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

  if (loading) return <KarbanLoader label="در حال بارگذاری…" />;
  return (
    <div className="admin-table-wrap">
      <h2>اعضای خبرنامه</h2>
      <table className="admin-table">
        <thead>
          <tr>
            <th>#</th>
            <th>موبایل</th>
            <th>تاریخ</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id}>
              <td>{(index + 1).toLocaleString('fa-IR')}</td>
              <td>{item.mobile}</td>
              <td>{fmtDate(item.created_at)}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={3}>هنوز عضوی ثبت نشده است.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/* ── لایسنس‌های اشتراک حسابداری: فعال‌سازی، تمدید، تغییر پلن ── */
type AccessRow = {
  id: string;
  business_id: string | null;
  user_id: string | null;
  email: string | null;
  role: string;
  status: string;
  plan: string | null;
  expires_at: string | null;
  created_at: string;
};

const PLAN_LABELS: Record<string, string> = {
  trial: 'آزمایشی', monthly: 'ماهانه', yearly: 'سالانه', founder: 'بنیان‌گذار', active: 'قدیمی',
};

function LicensesTab() {
  const [rows, setRows] = useState<AccessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'trial' | 'suspended'>('all');
  const [grantEmail, setGrantEmail] = useState('');
  const [grantPlan, setGrantPlan] = useState('yearly');
  const [grantMonths, setGrantMonths] = useState(12);
  const [status, setStatus] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('acc_access').select('*').order('created_at', { ascending: false }).limit(200);
    setRows((data || []) as AccessRow[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = rows.filter((r) => filter === 'all' || r.status === filter);

  /* فعال‌سازی/تمدید لایسنس برای یک ایمیل — اگر رکورد نبود، از acc_trial_requests یا auth پیدا می‌کنیم */
  const grant = async () => {
    const email = grantEmail.trim().toLowerCase();
    if (!email) { setStatus('ایمیل کاربر را وارد کنید.'); return; }
    setStatus('در حال پردازش…');
    const expires = new Date(Date.now() + grantMonths * 30 * 24 * 60 * 60 * 1000).toISOString();
    const existing = rows.find((r) => (r.email || '').toLowerCase() === email);
    if (existing) {
      const { error } = await supabase
        .from('acc_access')
        .update({ plan: grantPlan, status: 'active', expires_at: expires })
        .eq('id', existing.id);
      if (error) { setStatus('خطا: ' + error.message); return; }
      setStatus(`لایسنس ${PLAN_LABELS[grantPlan]} برای ${email} تا ${formatFaDate(expires)} فعال شد.`);
    } else {
      /* رکورد جدید: user_id از profiles با ایمیل */
      const { data: prof } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
      if (!prof?.id) {
        setStatus('کاربری با این ایمیل پیدا نشد. کاربر باید یک‌بار وارد سایت شود.');
        return;
      }
      const { error } = await supabase.from('acc_access').insert({
        user_id: prof.id,
        email,
        role: 'owner',
        status: 'active',
        plan: grantPlan,
        expires_at: expires,
      });
      if (error) { setStatus('خطا: ' + error.message); return; }
      setStatus(`لایسنس ${PLAN_LABELS[grantPlan]} برای ${email} ساخته شد تا ${formatFaDate(expires)}.`);
    }
    setGrantEmail('');
    load();
  };

  const setRowStatus = async (id: string, newStatus: string) => {
    await supabase.from('acc_access').update({ status: newStatus }).eq('id', id);
    load();
  };

  const extend = async (row: AccessRow) => {
    const months = window.prompt('چند ماه تمدید شود؟ (عدد)', '12');
    const m = Number(months);
    if (!m || m <= 0) return;
    const base = row.expires_at && new Date(row.expires_at) > new Date() ? new Date(row.expires_at) : new Date();
    const expires = new Date(base.getTime() + m * 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('acc_access').update({ expires_at: expires, status: 'active' }).eq('id', row.id);
    load();
  };

  if (loading) return <KarbanLoader label="در حال بارگذاری لایسنس‌ها…" />;
  return (
    <div className="admin-settings">
      <h2>لایسنس‌های نرم‌افزار حسابداری</h2>
      <p>فعال‌سازی اشتراک پس از خرید، تمدید و تعلیق لایسنس کاربران.</p>

      <div className="admin-form" style={{ alignItems: 'end' }}>
        <label className="settings-field" style={{ minWidth: 220 }}>
          ایمیل کاربر
          <input value={grantEmail} onChange={(e) => setGrantEmail(e.target.value)} placeholder="user@example.com" dir="ltr" />
        </label>
        <label className="settings-field">
          پلن
          <select value={grantPlan} onChange={(e) => setGrantPlan(e.target.value)}>
            <option value="monthly">ماهانه</option>
            <option value="yearly">سالانه</option>
            <option value="founder">بنیان‌گذار</option>
          </select>
        </label>
        <label className="settings-field">
          مدت (ماه)
          <FaNumberInput value={grantMonths} onChange={(n) => setGrantMonths(Math.max(1, Math.round(n)))} style={{ minWidth: 90 }} />
        </label>
        <button type="button" className="button button-green" onClick={grant}><KeyRound size={15} /> فعال‌سازی / تمدید</button>
      </div>
      {status && <small className="admin-success">{status}</small>}

      <div style={{ display: 'flex', gap: '.4rem', margin: '1rem 0 .6rem' }}>
        {([['all', 'همه'], ['active', 'فعال'], ['trial', 'آزمایشی'], ['suspended', 'معلق']] as const).map(([k, l]) => (
          <button type="button" key={k} className={`button button-small ${filter === k ? 'button-green' : 'button-outline'}`} onClick={() => setFilter(k)}>
            {l} {formatFaNumber(rows.filter((r) => k === 'all' || r.status === k).length)}
          </button>
        ))}
      </div>

      <table className="admin-table">
        <thead>
          <tr><th>#</th><th>ایمیل</th><th>پلن</th><th>وضعیت</th><th>انقضا</th><th>ایجاد</th><th></th></tr>
        </thead>
        <tbody>
          {filtered.map((row, index) => (
            <tr key={row.id}>
              <td>{(index + 1).toLocaleString('fa-IR')}</td>
              <td dir="ltr" style={{ textAlign: 'right' }}>{row.email || row.user_id?.slice(0, 8) || '—'}</td>
              <td>{PLAN_LABELS[row.plan || ''] || row.plan || '—'}</td>
              <td>
                <select value={row.status} onChange={(e) => setRowStatus(row.id, e.target.value)}>
                  <option value="active">فعال</option>
                  <option value="trial">آزمایشی</option>
                  <option value="suspended">معلق</option>
                </select>
              </td>
              <td>{row.expires_at ? fmtDate(row.expires_at) : '—'}</td>
              <td>{fmtDate(row.created_at)}</td>
              <td className="admin-actions">
                <button type="button" className="button button-small" onClick={() => extend(row)}>تمدید</button>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && <tr><td colSpan={7}>لایسنسی در این فهرست نیست.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/* ── اتصال تلگرام ادمین: تنظیم ربات، پیام تست، صف رویدادها ── */

function TelegramTab() {
  const [cfg, setCfg] = useState<TelegramConfig>(DEFAULT_TELEGRAM_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testMsg] = useState('');
  const [testResult, setTestResult] = useState('');
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    (async () => {
      const c = await fetchTelegramConfig();
      setCfg(c);
      try {
        const { count } = await supabase.from('telegram_queue').select('id', { count: 'exact', head: true });
        setQueueCount(count || 0);
      } catch { setQueueCount(0); }
      setLoading(false);
      /* کشیدن صف پیام‌های کاربران — خودکار در باز شدن تب */
      drainTelegramQueue(c).then((sent) => {
        if (sent > 0) {
          setQueueCount(0);
          setTestResult(`${sent} پیام صف‌شده به تلگرام ارسال شد.`);
        }
      });
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await saveTelegramConfig(cfg);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTestResult('در حال ارسال…');
    const r = await sendTelegramDirect(cfg, testMsg.trim() || '✅ اتصال کاربان به تلگرام برقرار شد.');
    setTestResult(r.ok ? '✅ پیام به تلگرام ارسال شد — چک کنید.' : `❌ ${r.error}`);
  };

  if (loading) return <KarbanLoader label="در حال بارگذاری تنظیمات تلگرام…" />;
  return (
    <div className="admin-settings">
      <h2>اتصال تلگرام ادمین</h2>
      <p>رویدادهای مهم سایت (سفارش جدید، درخواست تریال، تیکت، فاکتور رسمی، ثبت‌نام کاربر) به تلگرام شما پیام می‌دهند. برای ساخت ربات، در تلگرام به <b dir="ltr">@BotFather</b> پیام <b dir="ltr">/newbot</b> بدهید و برای گرفتن شناسه چت، به <b dir="ltr">@userinfobot</b> پیام بدهید.</p>

      <div className="settings-grid">
        <label className="settings-field" style={{ gridColumn: 'span 2' }}>
          توکن ربات (BotFather)
          <input value={cfg.bot_token} onChange={(e) => setCfg({ ...cfg, bot_token: e.target.value.trim() })} placeholder="1234567890:AAE…" dir="ltr" />
        </label>
        <label className="settings-field">
          شناسه چت (Chat ID)
          <input value={cfg.chat_id} onChange={(e) => setCfg({ ...cfg, chat_id: e.target.value.trim() })} placeholder="123456789" dir="ltr" />
        </label>
      </div>

      <h3>رویدادهای اطلاع‌رسانی</h3>
      <div className="settings-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {([
          ['notify_orders', 'سفارش خدمات جدید'],
          ['notify_trials', 'درخواست تریال / کسب‌وکار جدید حسابداری'],
          ['notify_tickets', 'تیکت پشتیبانی جدید'],
          ['notify_invoices', 'صدور فاکتور رسمی توسط کاربران'],
          ['notify_users', 'ثبت‌نام کاربر جدید'],
        ] as const).map(([key, label]) => (
          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.9rem' }}>
            <input type="checkbox" checked={cfg[key]} onChange={(e) => setCfg({ ...cfg, [key]: e.target.checked })} />
            {label}
          </label>
        ))}
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.95rem', margin: '.6rem 0' }}>
        <input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} />
        <b>اتصال فعال باشد</b>
      </label>

      <div className="admin-actions-row">
        <button type="button" className="button button-green" onClick={save} disabled={saving}><Save size={15} /> {saving ? 'در حال ذخیره…' : 'ذخیره تنظیمات'}</button>
        <button type="button" className="button" onClick={sendTest}><Send size={15} /> ارسال پیام تست</button>
      </div>
      {saved && <small className="admin-success">✓ تنظیمات ذخیره شد (به‌صورت امن در site_secrets — فقط ادمین).</small>}
      {testResult && <small className="admin-success">{testResult}</small>}

      <div style={{ marginTop: '1rem', padding: '.8rem 1rem', borderRadius: 12, border: '1px solid var(--line)', background: 'rgba(255,255,255,.03)' }}>
        <b style={{ fontSize: '.9rem' }}>صف پیام‌های ارسالی کاربران: {formatFaNumber(queueCount)}</b>
        <p style={{ fontSize: '.8rem', color: 'var(--muted)', marginTop: '.3rem' }}>
          پیام‌های رویدادهای کاربران ابتدا در صف امن ذخیره می‌شوند و هر بار که این تب را باز کنید، خودکار به تلگرام ارسال و از صف حذف می‌شوند.
        </p>
        <button type="button" className="button button-small" onClick={() => drainTelegramQueue(cfg).then((n) => { setTestResult(`${n} پیام ارسال شد.`); setQueueCount(0); })}>
          ارسال صف الان
        </button>
      </div>
    </div>
  );
}
