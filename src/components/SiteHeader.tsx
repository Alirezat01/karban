import { Menu, X, ArrowLeft } from 'lucide-react';
import { useState } from 'react';

const links = [['دانشنامه', '/دانشنامه'], ['قراردادها', '/قراردادها'], ['خدمات', '/خدمات'], ['ابزارهای هوش مصنوعی', '/ابزارهای-هوش-مصنوعی']] as const;

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  return <header className="site-header"><div className="container header-inner">
    <a className="brand" href="/" aria-label="کاربان، صفحه اصلی"><img src="/assets/images/Gemini_Generated_Image_3xp4kz3xp4kz3xp4-removebg-preview.png" alt="لوگوی کاربان" /></a>
    <nav className="desktop-nav" aria-label="منوی اصلی">{links.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</nav>
    <div className="header-actions"><a className="login-link" href="/ورود">ورود <ArrowLeft size={15} /></a></div>
    <button className="mobile-menu-button" onClick={() => setOpen(!open)} aria-label="باز کردن منو">{open ? <X /> : <Menu />}</button>
  </div>{open && <nav className="mobile-nav">{links.map(([label, href]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>)}<a className="login-link" href="/ورود" onClick={() => setOpen(false)}>ورود</a></nav>}</header>;
}
