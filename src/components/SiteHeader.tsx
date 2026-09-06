import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LayoutDashboard, LogIn, LogOut, Menu, UserRound, X } from 'lucide-react';
import { useAuth, signOutUser } from '@/lib/auth';
import NotificationBell from '@/components/NotificationBell';

const links = [
  ['دانشنامه', '/دانشنامه'],
  ['قراردادها', '/قراردادها'],
  ['درخواست‌های اداری', '/درخواست‌های-اداری'],
  ['چک‌لیست‌های طلایی', '/چک-لیست‌ها'],
  ['خدمات', '/خدمات'],
  ['ابزارهای هوش مصنوعی', '/ابزارهای-هوش-مصنوعی'],
] as const;

export default function SiteHeader({ path }: { path?: string }) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const ticking = useRef(false);
  const userWrapRef = useRef<HTMLDivElement>(null);
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

  /* ناحیه احراز هویت در منوی دسکتاپ: ورود | زنگ + چیپ کاربر با منوی کشویی */
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
          <img src="/assets/images/Gemini_Generated_Image_3xp4kz3xp4kz3xp4-removebg-preview.png" alt="لوگوی کاربان" />
        </a>
        <nav className="desktop-nav" aria-label="منوی اصلی">
          {links.map(([label, href]) => (
            <a key={href} href={href} className={isActive(href) ? 'is-active' : ''} aria-current={isActive(href) ? 'page' : undefined}>
              {label}
            </a>
          ))}
          {authArea}
        </nav>
        <button className="mobile-menu-button" onClick={() => setOpen((value) => !value)} aria-label="باز و بسته کردن منو">
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <nav className="mobile-nav">
          {links.map(([label, href]) => (
            <a key={href} href={href} onClick={() => setOpen(false)}>
              {label}
            </a>
          ))}
          {mobileAuthArea}
        </nav>
      )}
      <span className="scroll-progress" style={{ width: `${progress}%` }} aria-hidden="true" />
    </header>
  );
}
