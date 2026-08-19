import { useState } from 'react';
import { Menu, X } from 'lucide-react';

const links = [
  ['دانشنامه', '/دانشنامه'],
  ['قراردادها', '/قراردادها'],
  ['درخواست‌های اداری', '/درخواست‌های-اداری'],
  ['خدمات', '/خدمات'],
  ['ابزارهای هوش مصنوعی', '/ابزارهای-هوش-مصنوعی'],
] as const;

export default function SiteHeader() {
  const [open, setOpen] = useState(false);

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
        </nav>
      )}
    </header>
  );
}
