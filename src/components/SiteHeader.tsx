/* هدر حرفه‌ای کاربان — منوی dropdown گروهی، دکمه CTA درخشان، نوار پیشرفت
   نسخه ۳: بازطراحی کامل منوی بالای سایت */

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Calculator, ChevronDown, FileSignature, FileText, LayoutDashboard, ListChecks, LogIn, LogOut, Menu, Receipt, Scale, Sparkles, UserRound, Wrench, X, Zap } from 'lucide-react';
import { useAuth, signOutUser } from '@/lib/auth';
import NotificationBell from '@/components/NotificationBell';

type NavItem = { label: string; href: string; icon?: typeof BookOpen; desc?: string };
type NavGroup = { label: string; href?: string; badge?: string; items?: NavItem[] };

/* ساختار منو: لینک‌های پرتکرار مستقیم، بقیه در دو dropdown مرتبط */
const MENU: NavGroup[] = [
  { label: 'حسابداری', href: '/حسابداری', badge: 'جدید' },
  { label: 'خدمات', href: '/خدمات' },
  {
    label: 'ابزارهای رایگان',
    items: [
      { label: 'فاکتورساز آنلاین', href: '/فاکتورساز', icon: Receipt, desc: 'فاکتور سریع با محاسبه خودکار مالیات' },
      { label: 'ماشین‌حساب‌های هوشمند', href: '/ابزارهای-هوش-مصنوعی', icon: Calculator, desc: 'حقوق، بیمه، مالیات، سنوات و…' },
      { label: 'سازنده قرارداد', href: '/قراردادها', icon: FileSignature, desc: '۹۴ نمونه قرارداد آماده ویرایشی' },
    ],
  },
  {
    label: 'منابع',
    items: [
      { label: 'دانشنامه', href: '/دانشنامه', icon: BookOpen, desc: 'مقالات تخصصی مالی و قانون کار' },
      { label: 'چک‌لیست‌های طلایی', href: '/چک-لیست‌ها', icon: ListChecks, desc: 'گام‌به‌گام استخدام و انحلال' },
      { label: 'کتابخانه قوانین', href: '/کتابخانه-قوانین', icon: Scale, desc: 'متن کامل قوانین و آیین‌نامه‌ها' },
      { label: 'درخواست‌های اداری', href: '/درخواست‌های-اداری', icon: FileText, desc: 'فرم‌های اداری آماده دانلود' },
    ],
  },
];

export default function SiteHeader({ path }: { path?: string }) {
  const [open, setOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null); /* dropdown دسکتاپ */
  const [mobileExpand, setMobileExpand] = useState<string | null>(null); /* آکاردئون موبایل */
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const ticking = useRef(false);
  const userWrapRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { loading, userId, email, displayName } = useAuth();
  /* مسیر فعلی برای خط طلایی زیر آیتم فعال منو */
  const current = path || (typeof window !== 'undefined' ? window.location.pathname : '');

  /* بستن منوی کاربر با کلیک بیرون یا Escape */
  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (userWrapRef.current && !userWrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  useEffect(() => { setMenuOpen(false); }, [current]);

  /* هدر هنگام اسکرول + نوار پیشرفت — با rAF برای پرفورمنس */
  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        ticking.current = false;
        setScrolled(window.scrollY > 24);
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setProgress(max > 40 ? Math.min(100, (window.scrollY / max) * 100) : 0);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isActive = (href: string) => current === href || current.startsWith(`${href}/`);

  const doSignOut = async () => {
    setMenuOpen(false);
    setOpen(false);
    await signOutUser();
    window.location.assign('/');
  };

  const initial = displayName.trim().charAt(0) || 'ک';

  /* ناحیه احراز هویت در منوی دسکتاپ: زنگ + چیپ کاربر با منوی کشویی */
  const authArea = loading ? (
    <span className="header-auth is-skeleton" aria-hidden="true" />
  ) : userId ? (
    <div className="header-user-wrap" ref={userWrapRef}>
      <NotificationBell userId={userId} />
      <button
        type="button"
        className={`header-user${menuOpen ? ' is-open' : ''}`}
        onClick={() => setMenuOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={`حساب کاربری ${displayName}`}
      >
        <span className="header-user-avatar" aria-hidden="true">{initial}</span>
        <span className="header-user-name">{displayName}</span>
        <ChevronDown size={14} aria-hidden="true" className="header-user-caret" />
      </button>
      {menuOpen && (
        <div className="header-user-menu" role="menu" aria-label="منوی حساب کاربری">
          <div className="header-user-menu-head">
            <strong>{displayName}</strong>
            {email && <small>{email}</small>}
          </div>
          <a role="menuitem" href="/داشبورد"><LayoutDashboard size={15} /> داشبورد</a>
          <a role="menuitem" href="/پروفایل"><UserRound size={15} /> پروفایل من</a>
          <button type="button" role="menuitem" onClick={doSignOut}><LogOut size={15} /> خروج از حساب</button>
        </div>
      )}
    </div>
  ) : (
    <a className="header-auth" href="/ورود"><LogIn size={16} /> ورود</a>
  );

  /* ناحیه احراز هویت در منوی موبایل: بدون کشویی، لینک‌های مستقیم */
  const mobileAuthArea = loading ? null : userId ? (
    <>
      <div className="mobile-nav-user">
        <span className="header-user-avatar" aria-hidden="true">{initial}</span>
        <span>{displayName}</span>
      </div>
      <a href="/داشبورد" onClick={() => setOpen(false)}><LayoutDashboard size={16} /> داشبورد</a>
      <a href="/پروفایل" onClick={() => setOpen(false)}><UserRound size={16} /> پروفایل من</a>
      <button type="button" className="mobile-nav-logout" onClick={doSignOut}>
        <LogOut size={16} /> خروج از حساب
      </button>
    </>
  ) : (
    <a href="/ورود" onClick={() => setOpen(false)}><LogIn size={16} /> ورود</a>
  );

  return (
    <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
      <div className="container header-inner">
        <a className="brand" href="/" aria-label="کاربان">
          <picture>
            <source type="image/webp" srcSet="/assets/images/Gemini_Generated_Image_3xp4kz3xp4kz3xp4-removebg-preview.webp" />
            <img src="/assets/images/Gemini_Generated_Image_3xp4kz3xp4kz3xp4-removebg-preview.png" alt="لوگوی کاربان" width={669} height={373} />
          </picture>
        </a>

        {/* منوی دسکتاپ */}
        <nav className="desktop-nav" aria-label="منوی اصلی" onMouseLeave={() => setOpenGroup(null)}>
          {MENU.map((group) => (
            <div
              key={group.label}
              className="nav-item-wrap"
              onMouseEnter={() => setOpenGroup(group.items ? group.label : null)}
            >
              {group.href ? (
                <a
                  href={group.href}
                  className={`nav-link${isActive(group.href) ? ' is-active' : ''}${group.badge ? ' has-badge' : ''}`}
                  aria-current={isActive(group.href) ? 'page' : undefined}
                >
                  {group.label}
                  {group.badge && <span className="nav-badge">{group.badge}</span>}
                </a>
              ) : (
                <button
                  type="button"
                  className={`nav-link nav-link-btn${openGroup === group.label ? ' is-open' : ''}${group.items?.some((i) => isActive(i.href)) ? ' is-active' : ''}`}
                  aria-haspopup="true"
                  aria-expanded={openGroup === group.label}
                  onClick={() => setOpenGroup(openGroup === group.label ? null : group.label)}
                >
                  {group.label}
                  <ChevronDown size={13} className="nav-caret" aria-hidden="true" />
                </button>
              )}
              {group.items && openGroup === group.label && (
                <div className="nav-dropdown" role="menu">
                  {group.items.map((item) => (
                    <a key={item.href} href={item.href} role="menuitem" className={`nav-dropdown-item${isActive(item.href) ? ' is-active' : ''}`}>
                      {item.icon && <item.icon size={17} aria-hidden="true" />}
                      <span>
                        <b>{item.label}</b>
                        {item.desc && <small>{item.desc}</small>}
                      </span>
                      <ArrowLeft size={13} className="nav-dropdown-arrow" aria-hidden="true" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
          {authArea}
          {/* دکمه CTA درخشان — قلب بازاریابی هدر */}
          <a className={`header-cta${userId ? ' is-member' : ''}`} href={userId ? '/حسابداری/پنل' : '/حسابداری'}>
            <Zap size={15} aria-hidden="true" />
            {userId ? 'پنل حسابداری' : 'شروع رایگان'}
          </a>
        </nav>

        <button type="button" className="mobile-menu-button" onClick={() => setOpen((value) => !value)} aria-label="باز و بسته کردن منو">
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {/* منوی موبایل: آکاردئونی */}
      {open && (
        <nav className="mobile-nav">
          <a className="mobile-cta" href={userId ? '/حسابداری/پنل' : '/حسابداری'} onClick={() => setOpen(false)}>
            <Sparkles size={16} /> {userId ? 'ورود به پنل حسابداری' : 'شروع رایگان حسابداری'}
          </a>
          {MENU.map((group) =>
            group.href ? (
              <a key={group.label} href={group.href} onClick={() => setOpen(false)} className={isActive(group.href) ? 'is-active' : ''}>
                {group.label}
              </a>
            ) : (
              <div key={group.label} className="mobile-nav-group">
                <button
                  type="button"
                  className={`mobile-nav-toggle${mobileExpand === group.label ? ' is-open' : ''}`}
                  onClick={() => setMobileExpand(mobileExpand === group.label ? null : group.label)}
                  aria-expanded={mobileExpand === group.label}
                >
                  {group.label}
                  <ChevronDown size={15} aria-hidden="true" />
                </button>
                {mobileExpand === group.label && (
                  <div className="mobile-nav-sub">
                    {group.items!.map((item) => (
                      <a key={item.href} href={item.href} onClick={() => setOpen(false)}>
                        {item.icon && <item.icon size={15} />}
                        {item.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ),
          )}
          <a href="/تماس-با-ما" onClick={() => setOpen(false)}><Wrench size={15} /> تماس و مشاوره</a>
          {mobileAuthArea}
        </nav>
      )}
      <span className="scroll-progress" style={{ width: `${progress}%` }} aria-hidden="true" />
    </header>
  );
}
