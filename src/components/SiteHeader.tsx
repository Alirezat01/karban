import { useEffect, useState } from 'react';
import { LayoutDashboard, LogIn, Menu, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import NotificationBell from '@/components/NotificationBell';

const links = [
  ['دانشنامه', '/دانشنامه'],
  ['قراردادها', '/قراردادها'],
  ['درخواست‌های اداری', '/درخواست‌های-اداری'],
  ['چک‌لیست‌ها', '/چک-لیست‌ها'],
  ['خدمات', '/خدمات'],
  ['ابزارهای هوش مصنوعی', '/ابزارهای-هوش-مصنوعی'],
] as const;

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUserId(session?.user?.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const authArea = userId ? (
    <>
      <NotificationBell userId={userId} />
      <a className="header-auth" href="/داشبورد"><LayoutDashboard size={16} /> داشبورد</a>
    </>
  ) : (
    <a className="header-auth" href="/ورود"><LogIn size={16} /> ورود</a>
  );

  return (
    <header className="site-header">
      <div className="container header-inner">
        <a className="brand" href="/" aria-label="کاربان">
          <img src="/assets/images/Gemini_Generated_Image_3xp4kz3xp4kz3xp4-removebg-preview.png" alt="لوگوی کاربان" />
        </a>
        <nav className="desktop-nav" aria-label="منوی اصلی">
          {links.map(([label, href]) => (
            <a key={href} href={href}>
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
    </header>
  );
}
