/* ────────────────────────────────────────────────────────────
   FloatingCTA — a small "free consultation" button that sticks
   to the bottom-right corner on public pages. Hidden on:
     - dashboard / profile / acc panel / admin / login / sign pages
     - when the hero CTA is still in view
   ──────────────────────────────────────────────────────────── */
import { useEffect, useState } from 'react';
import { Headset } from 'lucide-react';

const HIDDEN_PREFIXES = [
  '/داشبورد',
  '/پروفایل',
  '/ورود',
  '/حسابداری/پنل',
  '/admin',
  '/auth/callback',
  '/امضای-قرارداد',
];

function shouldHide(path: string): boolean {
  return HIDDEN_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(p));
}

export default function FloatingCTA() {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (shouldHide(window.location.pathname)) return;
    const onScroll = () => {
      setVisible(window.scrollY > 600);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div className={`fab-wrap${open ? ' is-open' : ''}`}>
      {open && (
        <div className="fab-popover" role="dialog" aria-label="مشاوره رایگان">
          <strong>مشاوره رایگان ۱۵ دقیقه‌ای</strong>
          <p>سؤال حقوقی، قراردادی یا مالیاتی داری؟ با کارشناس کاربان صحبت کن.</p>
          <div className="fab-actions">
            <a className="button button-small" href="/سفارش/3">ثبت درخواست مشاوره</a>
            <a className="button button-outline button-small" href="tel:02188342679">تماس تلفنی</a>
          </div>
          <a className="button button-outline button-small fab-whatsapp" href="https://karbanapp.ir/تماس-با-ما" target="_blank" rel="noopener noreferrer">
            سایر راه‌های ارتباطی
          </a>
        </div>
      )}
      <button
        type="button"
        className="fab-button"
        onClick={() => setOpen((v) => !v)}
        aria-label="مشاوره رایگان"
        aria-expanded={open}
      >
        <Headset size={22} />
      </button>
    </div>
  );
}
