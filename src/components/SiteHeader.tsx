import { useEffect, useRef, useState } from 'react';
import { LayoutDashboard, LogIn, Menu, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
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
  const [userId, setUserId] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const ticking = useRef(false);
  /* مسیر فعلی برای خط طلایی زیر آیتم فعال منو */
  const current = path || (typeof window !== 'undefined' ? window.location.pathname : '');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUserId(session?.user?.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

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

  const authArea = userId ? (
    <>
      <NotificationBell userId={userId} />
      <a className="header-auth" href="/داشبورد"><LayoutDashboard size={16} /> داشبورد</a>
    </>
  ) : (
    <a className="header-auth" href="/ورود"><LogIn size={16} /> ورود</a>
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
          {authArea}
        </nav>
      )}
      <span className="scroll-progress" style={{ width: `${progress}%` }} aria-hidden="true" />
    </header>
  );
}
