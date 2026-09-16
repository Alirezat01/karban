/* پنل حسابداری هوشمند کاربان — گیت دسترسی، چیدمان و روتر داخلی */

import React, { useEffect, useState } from 'react';
import {
  ArrowLeftRight, BarChart3, BookOpen, FileText, LayoutDashboard, LogOut, Menu,
  Package, Receipt, Settings, ShieldAlert, Users, Wallet, X, Building2, Sparkles,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAccAccess } from '@/lib/acc/access';
import { createBusiness, submitTrialRequest } from '@/lib/acc/api';
import { Field, ToastHost, ConfirmHost, toast } from "./ui";
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
  'دفترخانه': 'دفترخانه',
  'گزارش‌ها': 'گزارش‌ها',
  'تنظیمات': 'تنظیمات کسب‌وکار',
};

const NAV = [
  { label: 'نمای کلی', items: [
    { seg: 'داشبورد', title: 'داشبورد', icon: LayoutDashboard },
  ] },
  { label: 'عملیات روزانه', items: [
    { seg: 'فاکتورها', title: 'صورتحساب‌ها', icon: FileText },
    { seg: 'مشتریان', title: 'مشتریان و طرف‌حساب‌ها', icon: Users },
    { seg: 'کالا-و-خدمات', title: 'کالا و خدمات', icon: Package },
    { seg: 'دریافت-و-پرداخت', title: 'دریافت و پرداخت', icon: ArrowLeftRight },
    { seg: 'هزینه‌ها', title: 'هزینه‌ها', icon: Receipt },
    { seg: 'حساب‌ها', title: 'بانک و صندوق', icon: Wallet },
  ] },
  { label: 'حسابداری و تحلیل', items: [
    { seg: 'دفترخانه', title: 'دفترخانه (روزنامه و کل)', icon: BookOpen },
    { seg: 'گزارش‌ها', title: 'گزارش‌ها و مالیات', icon: BarChart3 },
  ] },
  { label: 'سیستم', items: [
    { seg: 'تنظیمات', title: 'تنظیمات کسب‌وکار', icon: Settings },
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
        <a className="acc-btn acc-btn-primary" href="/ورود">ورود به کاربان</a>
        <a className="acc-btn acc-btn-outline" href="/حسابداری">معرفی و پلن‌ها <Sparkles size={15} /></a>
      </div>
    </GateShell>
  );
}

function NoAccessGate({ onRequested }: { onRequested: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [bizName, setBizName] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!phone.trim()) { toast('شماره تماس را وارد کنید', 'error'); return; }
    setBusy(true);
    try {
      await submitTrialRequest({ name: name.trim(), phone: phone.trim(), business_name: bizName.trim(), plan: 'trial' });
      setDone(true);
      onRequested();
    } catch {
      toast('ثبت درخواست ناموفق بود؛ دوباره تلاش کنید', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <GateShell>
        <div className="gate-icon"><Sparkles size={26} /></div>
        <h2>درخواست شما ثبت شد</h2>
        <p>تیم کاربان درخواست نسخه آزمایشی شما را بررسی و فعال می‌کند. پس از فعال‌سازی، همین صفحه پنل شما را باز می‌کند.</p>
        <a className="acc-btn acc-btn-outline" href="/حسابداری" style={{ marginTop: '1rem' }}>بازگشت به صفحه معرفی</a>
      </GateShell>
    );
  }

  return (
    <GateShell>
      <div className="gate-icon"><ShieldAlert size={26} /></div>
      <h2>دسترسی به پنل حسابداری فعال نیست</h2>
      <p>حساب شما اشتراک فعال ندارد. برای فعال‌سازی، اشتراک را از صفحه معرفی تهیه کنید یا درخواست نسخه آزمایشی رایگان بدهید.</p>
      <div style={{ display: 'grid', gap: '.7rem', marginTop: '1.2rem', textAlign: 'right' }}>
        <Field label="نام و نام خانوادگی"><input className="acc-input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="شماره تماس *"><input className="acc-input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <Field label="نام کسب‌وکار"><input className="acc-input" value={bizName} onChange={(e) => setBizName(e.target.value)} /></Field>
        <button className="acc-btn acc-btn-primary" disabled={busy} onClick={submit}>{busy ? 'در حال ثبت…' : 'درخواست نسخه آزمایشی رایگان'}</button>
        <a className="acc-btn acc-btn-outline" href="/حسابداری">مشاهده پلن‌های اشتراک</a>
      </div>
    </GateShell>
  );
}

function BusinessWizard({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '', person_type: 'legal' as 'real' | 'legal', shenase_melli: '', national_id: '',
    economic_code: '', postal_code: '', phone: '', province: '', city: '', address: '', default_vat_rate: 10,
  });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    if (!form.name.trim()) { toast('نام کسب‌وکار را وارد کنید', 'error'); return; }
    setBusy(true);
    try {
      await createBusiness(form);
      toast('کسب‌وکار شما ساخته شد');
      onCreated();
    } catch {
      toast('ساخت کسب‌وکار ناموفق بود', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <GateShell>
      <div className="gate-icon"><Building2 size={26} /></div>
      <h2>کسب‌وکار خود را راه‌اندازی کنید</h2>
      <p>لایسنس حسابداری شما فعال است؛ فقط مشخصات کسب‌وکار را برای صدور صورتحساب رسمی کامل کنید.</p>
      <div style={{ display: 'grid', gap: '.7rem', marginTop: '1.2rem', textAlign: 'right' }}>
        <Field label="نام کسب‌وکار / شرکت *"><input className="acc-input" value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.7rem' }}>
          <Field label="نوع شخصیت">
            <select className="acc-select" value={form.person_type} onChange={(e) => set('person_type', e.target.value)}>
              <option value="legal">حقوقی (شرکت)</option>
              <option value="real">حقیقی</option>
            </select>
          </Field>
          <Field label="نرخ مالیات ارزش افزوده (٪)" hint="نرخ مصوب ۱۴۰۵: ۱۰٪">
            <input className="acc-input" inputMode="numeric" value={form.default_vat_rate} onChange={(e) => set('default_vat_rate', Number(e.target.value) || 0)} />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.7rem' }}>
          {form.person_type === 'legal'
            ? <Field label="شناسه ملی"><input className="acc-input" value={form.shenase_melli} onChange={(e) => set('shenase_melli', e.target.value)} /></Field>
            : <Field label="کد ملی"><input className="acc-input" value={form.national_id} onChange={(e) => set('national_id', e.target.value)} /></Field>}
          <Field label="شماره اقتصادی"><input className="acc-input" value={form.economic_code} onChange={(e) => set('economic_code', e.target.value)} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.7rem' }}>
          <Field label="کد پستی"><input className="acc-input" value={form.postal_code} onChange={(e) => set('postal_code', e.target.value)} /></Field>
          <Field label="تلفن"><input className="acc-input" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        </div>
        <button className="acc-btn acc-btn-primary" disabled={busy} onClick={submit}>{busy ? 'در حال ساخت…' : 'راه‌اندازی کسب‌وکار'}</button>
      </div>
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

function Layout({ business, path, children }: { business: AccBusiness; path: string; children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { setMenuOpen(false); }, [path]);
  return (
    <div className="acc-shell">
      <Sidebar path={path} open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="acc-main">
        <header className="acc-topbar">
          <button className="acc-icon-btn acc-menu-btn" onClick={() => setMenuOpen(true)} aria-label="منو"><Menu size={17} /></button>
          <h1>{PAGE_TITLES[path] || 'پنل حسابداری'}</h1>
          <div className="spacer" />
          <span className="acc-biz-chip"><Building2 size={13} />{business.brand || business.name}</span>
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
  const { state, reload } = useAccAccess();
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
  if (state.phase === 'no-access') return (<><NoAccessGate onRequested={reload} /><ToastHost /><ConfirmHost /></>);
  if (state.phase === 'needs-business') return (<><BusinessWizard onCreated={reload} /><ToastHost /><ConfirmHost /></>);

  const { business, role } = state;

  const page = (() => {
    switch (seg) {
      case 'داشبورد': return <Dashboard business={business} />;
      case 'فاکتورها': return <InvoicesPage business={business} />;
      case 'فاکتور-جدید': {
        const typeMap: Record<string, InvoiceType> = { 'فروش': 'sale', 'پیش-فاکتور': 'proforma', 'خرید': 'purchase' };
        return <InvoiceEditor business={business} invoiceId={null} presetType={typeMap[sub[1] || ''] || 'sale'} />;
      }
      case 'فاکتور': return <InvoiceEditor business={business} invoiceId={sub[1] || null} />;
      case 'مشتریان': return <PartnersPage business={business} />;
      case 'کالا-و-خدمات': return <ItemsPage business={business} />;
      case 'هزینه‌ها': return <ExpensesPage business={business} />;
      case 'حساب‌ها': return <AccountsPage business={business} />;
      case 'دریافت-و-پرداخت': return <TransactionsPage business={business} />;
      case 'دفترخانه': return <BooksPage business={business} />;
      case 'گزارش‌ها': return <ReportsPage business={business} />;
      case 'تنظیمات': return <SettingsPage business={business} role={role} reloadAccess={reload} />;
      default: return <Dashboard business={business} />;
    }
  })();

  return (
    <>
      <Layout business={business} path={seg}>
        {page}
      </Layout>
      <ToastHost />
      <ConfirmHost />
    </>
  );
}
