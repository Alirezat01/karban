/* پنل حسابداری هوشمند کاربان — گیت دسترسی، چیدمان و روتر داخلی
   نسخه ۲: شروع خودکار تریال ۱۴روزه + کسب‌وکار دوم/سوم فقط با پلن */

import React, { useEffect, useState } from 'react';
import {
  ArrowLeftRight, BarChart3, BookOpen, Building2, CheckCircle2, Crown, FileText,
  Landmark, LayoutDashboard, LogOut, Lock, Menu, Package, Plus, Receipt, Settings,
  ShieldAlert, Sparkles, Users, Wallet, X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAccAccess } from '@/lib/acc/access';
import { createBusiness, startTrial, submitTrialRequest } from '@/lib/acc/api';
import { featureEnabled, PLAN_TIER_LABEL, planTier, type FeatureKey } from '@/lib/acc/plan';
import { Field, ToastHost, ConfirmHost, Modal, DigitsInput, QtyInput, toast } from "./ui";
import Dashboard from './Dashboard';
import PartnersPage from './PartnersPage';
import ItemsPage from './ItemsPage';
import InvoicesPage from './InvoicesPage';
import InvoiceEditor from './InvoiceEditor';
import InvoicePrint from './InvoicePrint';
import ExpensesPage from './ExpensesPage';
import AccountsPage from './AccountsPage';
import TransactionsPage from './TransactionsPage';
import BooksPage from './BooksPage';
import ReportsPage from './ReportsPage';
import SettingsPage from './SettingsPage';
import ChecksPage from './ChecksPage';
import ProGate from './ProGate';
import KarbanLoader from '@/components/KarbanLoader';
import type { AccBusiness, InvoiceType } from '@/lib/acc/types';

export const PAGE_TITLES: Record<string, string> = {
  '': 'داشبورد',
  'داشبورد': 'داشبورد',
  'فاکتورها': 'صورتحساب‌ها',
  'فاکتور-جدید': 'صدور صورتحساب',
  'فاکتور': 'ویرایش صورتحساب',
  'چاپ': 'چاپ صورتحساب',
  'مشتریان': 'مشتریان و طرف‌حساب‌ها',
  'کالا-و-خدمات': 'کالا و خدمات',
  'حساب‌ها': 'بانک و صندوق',
  'دریافت-و-پرداخت': 'دریافت و پرداخت',
  'هزینه‌ها': 'هزینه‌ها',
  'چک‌ها': 'دفتر چک‌ها',
  'دفترخانه': 'دفترخانه',
  'گزارش‌ها': 'گزارش‌ها',
  'تنظیمات': 'تنظیمات کسب‌وکار',
};

/* آیتم‌های سایدبار — پیشرفته: فقط با پلن پولی در دسترس است */
const NAV = [
  { label: 'نمای کلی', items: [
    { seg: 'داشبورد', title: 'داشبورد', icon: LayoutDashboard, pro: false },
  ] },
  { label: 'عملیات روزانه', items: [
    { seg: 'فاکتورها', title: 'صورتحساب‌ها', icon: FileText, pro: false },
    { seg: 'مشتریان', title: 'مشتریان و طرف‌حساب‌ها', icon: Users, pro: false },
    { seg: 'کالا-و-خدمات', title: 'کالا و خدمات', icon: Package, pro: false },
    { seg: 'دریافت-و-پرداخت', title: 'دریافت و پرداخت', icon: ArrowLeftRight, pro: false },
    { seg: 'هزینه‌ها', title: 'هزینه‌ها', icon: Receipt, pro: false },
    { seg: 'حساب‌ها', title: 'بانک و صندوق', icon: Wallet, pro: false },
    { seg: 'چک‌ها', title: 'دفتر چک‌ها', icon: Landmark, pro: true },
  ] },
  { label: 'حسابداری و تحلیل', items: [
    { seg: 'دفترخانه', title: 'دفترخانه (روزنامه و کل)', icon: BookOpen, pro: true },
    { seg: 'گزارش‌ها', title: 'گزارش‌ها و مالیات', icon: BarChart3, pro: true },
  ] },
  { label: 'سیستم', items: [
    { seg: 'تنظیمات', title: 'تنظیمات کسب‌وکار', icon: Settings, pro: false },
  ] },
];

/* ───────────────── گیت‌های دسترسی ───────────────── */

function GateShell({ children }: { children: React.ReactNode }) {
  return <div className="acc-gate"><div className="acc-gate-card">{children}</div></div>;
}

function AnonGate() {
  return (
    <GateShell>
      <div className="gate-icon"><ShieldAlert size={26} /></div>
      <h2>برای ورود به پنل حسابداری، ابتدا وارد شوید</h2>
      <p>دسترسی به حسابداری هوشمند کاربان فقط برای حساب‌های دارای اشتراک فعال یا نسخه آزمایشی فراهم است. ثبت‌نام ساده به‌تنهایی دسترسی نمی‌دهد.</p>
      <div style={{ display: 'flex', gap: '.6rem', justifyContent: 'center', marginTop: '1.2rem', flexWrap: 'wrap' }}>
        <a className="acc-btn acc-btn-primary" href="/ورود?next=/حسابداری/پنل">ورود به کاربان</a>
        <a className="acc-btn acc-btn-outline" href="/حسابداری">معرفی و پلن‌ها <Sparkles size={15} /></a>
      </div>
    </GateShell>
  );
}

/* ── فرم کامل راه‌اندازی کسب‌وکار (تریال و پلن‌دار) ── */

interface BizForm {
  name: string; brand: string; person_type: 'real' | 'legal';
  shenase_melli: string; national_id: string; economic_code: string; registration_number: string;
  province: string; county: string; city: string; address: string; postal_code: string;
  phone: string; fax: string; default_vat_rate: number;
  contact_name: string; contact_phone: string;
}

const EMPTY_BIZ: BizForm = {
  name: '', brand: '', person_type: 'legal', shenase_melli: '', national_id: '',
  economic_code: '', registration_number: '', province: '', county: '', city: '',
  address: '', postal_code: '', phone: '', fax: '', default_vat_rate: 10,
  contact_name: '', contact_phone: '',
};

function BusinessWizard({
  mode, onCreated, onCancel,
}: { mode: 'trial' | 'licensed'; onCreated: () => void; onCancel?: () => void }) {
  const [form, setForm] = useState<BizForm>(EMPTY_BIZ);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof BizForm, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    if (!form.name.trim()) { toast('نام کسب‌وکار را وارد کنید', 'error'); return; }
    setBusy(true);
    try {
      if (mode === 'trial') await startTrial(form);
      else await createBusiness(form);
      toast(mode === 'trial' ? 'نسخه آزمایشی شما فعال شد 🎉' : 'کسب‌وکار جدید ساخته شد');
      onCreated();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'عملیات ناموفق بود؛ دوباره تلاش کنید', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ display: 'grid', gap: '.7rem', marginTop: '1rem' }}>
        <div className="acc-form-grid">
          <Field label="نام کسب‌وکار / شرکت *">
            <input className="acc-input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="مثلاً: شرکت بازرگانی نمونه" />
          </Field>
          <Field label="نام نمایشی / برند" hint="روی سربرگ فاکتور چاپ می‌شود">
            <input className="acc-input" value={form.brand} onChange={(e) => set('brand', e.target.value)} />
          </Field>
        </div>
        <div className="acc-form-grid">
          <Field label="نوع شخصیت">
            <select className="acc-select" value={form.person_type} onChange={(e) => set('person_type', e.target.value)}>
              <option value="legal">حقوقی (شرکت)</option>
              <option value="real">حقیقی</option>
            </select>
          </Field>
          <Field label="نرخ مالیات ارزش افزوده (٪)" hint="نرخ مصوب ۱۴۰۵: ۱۰٪">
            <QtyInput value={form.default_vat_rate} onChange={(n) => set('default_vat_rate', n)} />
          </Field>
        </div>
        <div className="acc-form-grid">
          {form.person_type === 'legal'
            ? <Field label="شناسه ملی"><DigitsInput value={form.shenase_melli} onChange={(v) => set('shenase_melli', v)} maxLength={12} /></Field>
            : <Field label="کد ملی"><DigitsInput value={form.national_id} onChange={(v) => set('national_id', v)} maxLength={12} /></Field>}
          <Field label="شماره اقتصادی"><DigitsInput value={form.economic_code} onChange={(v) => set('economic_code', v)} maxLength={14} /></Field>
        </div>
        <div className="acc-form-grid">
          <Field label="شماره ثبت"><input className="acc-input" value={form.registration_number} onChange={(e) => set('registration_number', e.target.value)} /></Field>
          <Field label="کد پستی (۱۰ رقمی)"><DigitsInput value={form.postal_code} onChange={(v) => set('postal_code', v)} maxLength={10} /></Field>
        </div>
        <div className="acc-form-grid-3">
          <Field label="استان"><input className="acc-input" value={form.province} onChange={(e) => set('province', e.target.value)} /></Field>
          <Field label="شهرستان"><input className="acc-input" value={form.county} onChange={(e) => set('county', e.target.value)} /></Field>
          <Field label="شهر"><input className="acc-input" value={form.city} onChange={(e) => set('city', e.target.value)} /></Field>
        </div>
        <Field label="نشانی کامل"><input className="acc-input" value={form.address} onChange={(e) => set('address', e.target.value)} /></Field>
        <div className="acc-form-grid">
          <Field label="تلفن"><DigitsInput value={form.phone} onChange={(v) => set('phone', v)} maxLength={14} /></Field>
          <Field label="نمابر"><input className="acc-input" value={form.fax} onChange={(e) => set('fax', e.target.value)} /></Field>
        </div>
        {mode === 'trial' && (
          <div className="acc-form-grid">
            <Field label="نام و نام خانوادگی"><input className="acc-input" value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)} /></Field>
            <Field label="شماره تماس پیگیری"><DigitsInput value={form.contact_phone} onChange={(v) => set('contact_phone', v)} maxLength={14} /></Field>
          </div>
        )}
        <div style={{ display: 'flex', gap: '.6rem', marginTop: '.4rem' }}>
          <button className="acc-btn acc-btn-primary" disabled={busy} onClick={submit} style={{ flex: 1 }}>
            {busy ? 'در حال انجام…' : mode === 'trial' ? 'فعال‌سازی رایگان ۱۴ روزه' : 'ساخت کسب‌وکار'}
          </button>
          {onCancel && <button className="acc-btn acc-btn-outline" onClick={onCancel} disabled={busy}>انصراف</button>}
        </div>
      </div>
    </div>
  );
}

/* ── گیت بدون دسترسی: پیشنهاد فعال‌سازی سلف‌سرویس تریال ── */

function NoAccessGate() {
  const [showWizard, setShowWizard] = useState(false);
  const [contactMode, setContactMode] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  async function submitRequest() {
    if (!phone.trim()) { toast('شماره تماس را وارد کنید', 'error'); return; }
    setBusy(true);
    try {
      await submitTrialRequest({ name: name.trim(), phone: phone.trim(), plan: 'contact' });
      toast('درخواست شما ثبت شد؛ کارشناسان کاربان تماس می‌گیرند');
      setContactMode(false);
    } catch {
      toast('ثبت درخواست ناموفق بود؛ دوباره تلاش کنید', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <GateShell>
      <div className="gate-icon"><Sparkles size={26} /></div>
      {showWizard ? (
        <>
          <h2>فعال‌سازی نسخه آزمایشی رایگان</h2>
          <p>۱۴ روز کامل، بدون نیاز به کارت بانکی — ۱ کسب‌وکار و تا ۲۰ صورتحساب رسمی. فقط مشخصات کسب‌وکارتان را وارد کنید تا فاکتور رسمی آماده باشد.</p>
          <BusinessWizard mode="trial" onCreated={() => window.location.reload()} />
        </>
      ) : (
        <>
          <h2>حسابداری کاربان را رایگان امتحان کنید</h2>
          <p>حساب شما هنوز اشتراک فعال ندارد. همین حالا نسخه آزمایشی ۱۴ روزه را بدون کارت بانکی فعال کنید یا پلن‌های اشتراک را ببینید.</p>
          <div className="gate-perks">
            <span><CheckCircle2 size={14} /> ۱۴ روز کامل و رایگان</span>
            <span><CheckCircle2 size={14} /> فاکتور رسمی با استاندارد مالیاتی</span>
            <span><CheckCircle2 size={14} /> دفترخانه و گزارش خودکار</span>
          </div>
          <div style={{ display: 'grid', gap: '.6rem', marginTop: '1.2rem' }}>
            <button className="acc-btn acc-btn-primary" onClick={() => setShowWizard(true)}>شروع رایگان ۱۴ روزه</button>
            <a className="acc-btn acc-btn-outline" href="/حسابداری">مشاهده پلن‌های اشتراک</a>
            {contactMode ? (
              <div style={{ display: 'grid', gap: '.6rem', textAlign: 'right', marginTop: '.4rem' }}>
                <Field label="نام و نام خانوادگی"><input className="acc-input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
                <Field label="شماره تماس *"><DigitsInput value={phone} onChange={setPhone} maxLength={14} /></Field>
                <button className="acc-btn acc-btn-outline" disabled={busy} onClick={submitRequest}>{busy ? 'در حال ثبت…' : 'ثبت درخواست مشاوره خرید'}</button>
              </div>
            ) : (
              <button className="acc-btn-plain" onClick={() => setContactMode(true)}>ترجیح می‌دهم کارشناسان تماس بگیرند</button>
            )}
          </div>
        </>
      )}
    </GateShell>
  );
}

/* ── راه‌اندازی کسب‌وکار برای کاربر پلن‌دار (کسب‌وکار اول) ── */

function FirstBusinessGate() {
  return (
    <GateShell>
      <div className="gate-icon"><Building2 size={26} /></div>
      <h2>کسب‌وکار خود را راه‌اندازی کنید</h2>
      <p>لایسنس حسابداری شما فعال است؛ فقط مشخصات رسمی کسب‌وکار را برای صدور صورتحساب کامل کنید. همه فیلدها روی فاکتور رسمی چاپ می‌شوند.</p>
      <BusinessWizard mode="licensed" onCreated={() => window.location.reload()} />
    </GateShell>
  );
}

/* ───────────────── چیدمان پنل ───────────────── */

function Sidebar({ path, open, onClose }: { path: string; open: boolean; onClose: () => void }) {
  return (
    <aside className={`acc-sidebar${open ? ' is-open' : ''}`}>
      <div className="acc-sidebar-brand">
        <div className="logo-dot"><BarChart3 size={19} /></div>
        <div>
          <strong>حسابداری کاربان</strong>
          <span>نسخه هوشمند تحت وب</span>
        </div>
        <button className="acc-icon-btn" style={{ marginRight: 'auto', display: 'flex' }} onClick={onClose} aria-label="بستن منو"><X size={15} /></button>
      </div>
      <nav className="acc-nav">
        {NAV.map((group) => (
          <React.Fragment key={group.label}>
            <div className="acc-nav-label">{group.label}</div>
            {group.items.map((it) => {
              const href = it.seg === 'داشبورد' ? '/حسابداری/پنل' : `/حسابداری/پنل/${it.seg}`;
              const active = path === it.seg || (it.seg === 'فاکتورها' && ['فاکتور-جدید', 'فاکتور'].includes(path));
              return (
                <a key={it.seg} href={href} className={active ? 'is-active' : ''} onClick={onClose}>
                  <it.icon size={17} />
                  {it.title}
                  {it.pro ? <Lock size={11} style={{ marginInlineStart: 'auto', opacity: .55 }} aria-label="امکان پیشرفته" /> : null}
                </a>
              );
            })}
          </React.Fragment>
        ))}
      </nav>
      <div className="acc-sidebar-foot">قوانین مالیاتی ایران — نرخ ارزش افزوده ۱۴۰۵: ۱۰٪</div>
    </aside>
  );
}

const PLAN_LABEL: Record<string, string> = {
  founder: 'بنیان‌گذار', yearly: 'اشتراک سالانه', monthly: 'اشتراک ماهانه', trial: 'نسخه آزمایشی',
};

function Layout({
  business, businesses, plan, businessLimit, path, onSelect, onAddBusiness, children,
}: {
  business: AccBusiness;
  businesses: AccBusiness[];
  plan: string;
  businessLimit: number;
  path: string;
  onSelect: (id: string) => void;
  onAddBusiness: () => void;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { setMenuOpen(false); }, [path]);
  const trialBadge = plan === 'trial';
  return (
    <div className="acc-shell">
      <Sidebar path={path} open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="acc-main">
        <header className="acc-topbar">
          <button className="acc-icon-btn acc-menu-btn" onClick={() => setMenuOpen(true)} aria-label="منو"><Menu size={17} /></button>
          <h1>{PAGE_TITLES[path] || 'پنل حسابداری'}</h1>
          <div className="spacer" />
          {businesses.length > 1 ? (
            <select
              className="acc-select acc-biz-switcher"
              value={business.id}
              onChange={(e) => onSelect(e.target.value)}
              aria-label="انتخاب کسب‌وکار"
            >
              {businesses.map((b) => <option key={b.id} value={b.id}>{b.brand || b.name}</option>)}
            </select>
          ) : (
            <span className="acc-biz-chip"><Building2 size={13} />{business.brand || business.name}</span>
          )}
          <button className="acc-icon-btn" title="کسب‌وکار جدید" onClick={onAddBusiness}><Plus size={16} /></button>
          <span className={`acc-plan-chip${trialBadge ? ' is-trial' : ''}`} title={`پلن فعلی: ${PLAN_LABEL[plan] || plan} — نسخه ${PLAN_TIER_LABEL[planTier(plan)]} — سقف ${businessLimit} کسب‌وکار`}>
            {trialBadge ? <Sparkles size={12} /> : <Crown size={12} />}
            {PLAN_LABEL[plan] || plan}
            <span style={{ opacity: .65 }}>· {PLAN_TIER_LABEL[planTier(plan)]}</span>
          </span>
          <a className="acc-btn acc-btn-ghost" href="/" title="بازگشت به سایت">سایت کاربان</a>
          <button
            className="acc-icon-btn"
            title="خروج از حساب"
            onClick={async () => { await supabase.auth.signOut(); window.location.href = '/'; }}
          >
            <LogOut size={15} />
          </button>
        </header>
        <main className="acc-content" key={path}>
          {children}
        </main>
      </div>
    </div>
  );
}

/* ───────────────── روت اصلی پنل ───────────────── */

export default function AccPanel({ sub }: { sub: string[] }) {
  const { state, reload, selectBusiness } = useAccAccess();
  const [addOpen, setAddOpen] = useState(false);
  const seg = sub[0] || 'داشبورد';

  if (seg === 'چاپ') {
    return (
      <>
        <InvoicePrint invoiceId={sub[1] || ''} />
        <ToastHost />
        <ConfirmHost />
      </>
    );
  }

  if (state.phase === 'loading') {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)' }}><KarbanLoader label="در حال بررسی دسترسی…" /></div>;
  }
  if (state.phase === 'anon') return (<><AnonGate /><ToastHost /><ConfirmHost /></>);
  if (state.phase === 'no-access') return (<><NoAccessGate /><ToastHost /><ConfirmHost /></>);
  if (state.phase === 'needs-business') return (<><FirstBusinessGate /><ToastHost /><ConfirmHost /></>);

  const { business, role, businesses, plan, businessLimit, status } = state;

  const page = (() => {
    /* گیت امکانات پیشرفته — نسخه معمولی (آزمایشی) فقط ابزار پایه دارد */
    const proBlocked = (key: FeatureKey, title: string, hint?: string) =>
      featureEnabled(plan, key) ? null : <ProGate feature={key} plan={plan} title={title} hint={hint} />;

    switch (seg) {
      case 'داشبورد': return <Dashboard business={business} plan={plan} />;
      case 'فاکتورها': return <InvoicesPage business={business} plan={plan} />;
      case 'فاکتور-جدید': {
        const typeMap: Record<string, InvoiceType> = { 'فروش': 'sale', 'پیش-فاکتور': 'proforma', 'خرید': 'purchase' };
        const t = typeMap[sub[1] || ''] || 'sale';
        if (t === 'purchase') {
          const gate = proBlocked('invoice_purchase', 'صورتحساب خرید', 'ثبت خرید از تامین‌کننده‌ها و برگشت از فروش، مخصوص نسخه پیشرفته است.');
          if (gate) return gate;
        }
        return <InvoiceEditor business={business} invoiceId={null} presetType={t} />;
      }
      case 'فاکتور': return <InvoiceEditor business={business} invoiceId={sub[1] || null} />;
      case 'مشتریان': return <PartnersPage business={business} plan={plan} />;
      case 'کالا-و-خدمات': return <ItemsPage business={business} plan={plan} />;
      case 'هزینه‌ها': return <ExpensesPage business={business} access={{ status, plan }} />;
      case 'حساب‌ها': return <AccountsPage business={business} />;
      case 'دریافت-و-پرداخت': return <TransactionsPage business={business} />;
      case 'چک‌ها': {
        const gate = proBlocked('checks', 'دفتر چک‌ها', 'ثبت و پیگیری چک‌های دریافتی و پرداختی با یادآوری سررسید، مخصوص نسخه پیشرفته است.');
        if (gate) return gate;
        return <ChecksPage business={business} access={{ status, plan }} />;
      }
      case 'دفترخانه': {
        const gate = proBlocked('books', 'دفترخانه (روزنامه، کل و تراز)', 'دفترنامه دوطرفه خودکار مطابق اصول حسابداری، مخصوص نسخه پیشرفته است.');
        if (gate) return gate;
        return <BooksPage business={business} />;
      }
      case 'گزارش‌ها': {
        const gate = proBlocked('report_pl', 'گزارش‌ها و مالیات', 'سود و زیان، ارزش افزوده، معاملات فصلی و تحلیل فروش، مخصوص نسخه پیشرفته است.');
        if (gate) return gate;
        return <ReportsPage business={business} />;
      }
      case 'تنظیمات': return <SettingsPage business={business} role={role} plan={plan} reloadAccess={reload} />;
      default: return <Dashboard business={business} plan={plan} />;
    }
  })();

  return (
    <>
      <Layout
        business={business}
        businesses={businesses}
        plan={plan}
        businessLimit={businessLimit}
        path={seg}
        onSelect={selectBusiness}
        onAddBusiness={() => setAddOpen(true)}
      >
        {page}
      </Layout>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="افزودن کسب‌وکار جدید">
        <div style={{ display: 'grid', gap: '.9rem' }}>
          <p className="acc-hint" style={{ fontSize: '.8rem', lineHeight: 1.9 }}>
            پلن فعلی شما: <b style={{ color: 'var(--gold2)' }}>{PLAN_LABEL[plan] || plan}</b> — سقف {businessLimit} کسب‌وکار.
            {businesses.length >= businessLimit
              ? ' سقف پلن شما تکمیل است؛ برای کسب‌وکار بیشتر، پلن بالاتر را تهیه کنید.'
              : ` می‌توانید ${businessLimit - businesses.length} کسب‌وکار دیگر بسازید.`}
          </p>
          {businesses.length >= businessLimit ? (
            <div style={{ display: 'grid', gap: '.6rem' }}>
              <div className="acc-upsell">
                <Crown size={18} />
                <div>
                  <b>ارتقای پلن</b>
                  <p>اشتراک ماهانه: ۳ کسب‌وکار — اشتراک سالانه: ۵ کسب‌وکار. با ارتقا، همه امکانات پلن روی کسب‌وکارهای جدید فعال می‌شود.</p>
                </div>
              </div>
              <a className="acc-btn acc-btn-primary" href="/حسابداری" onClick={() => setAddOpen(false)}>مشاهده و ارتقای پلن</a>
            </div>
          ) : (
            <BusinessWizard mode="licensed" onCreated={() => { setAddOpen(false); reload(); }} onCancel={() => setAddOpen(false)} />
          )}
        </div>
      </Modal>

      <ToastHost />
      <ConfirmHost />
    </>
  );
}
