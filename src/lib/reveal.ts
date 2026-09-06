import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

/* ────────────────────────────────────────────────────────────
   میکرو-اینترکشن‌های مشترک کاربان — ظریف، یک‌باره، بدون افکت گیمینگ
   همه به prefers-reduced-motion احترام می‌گذارند.
   ──────────────────────────────────────────────────────────── */

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * ورود تدریجی گروهی کارت‌ها هنگام اسکرول (Fade + Slide خیلی کوتاه، یک‌باره).
 * روی عنصر والد سکشن نصب می‌شود و فرزندهایی که با selector داده می‌شوند
 * را با تاخیر پلکانی ظاهر می‌کند. کلاس «reveal» را خودش اضافه می‌کند.
 */
export function useRevealGroup<T extends HTMLElement = HTMLDivElement>(
  selector: string,
): RefObject<T> {
  const ref = useRef<T>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>(selector));
    if (targets.length === 0) return;

    if (reducedMotion() || typeof IntersectionObserver === 'undefined') {
      targets.forEach((t) => t.classList.add('is-visible'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          const index = Number(el.dataset.revealIndex || 0);
          el.style.transitionDelay = `${Math.min(index * 55, 330)}ms`;
          el.classList.add('is-visible');
          io.unobserve(el);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    );

    targets.forEach((t, i) => {
      t.dataset.revealIndex = String(i % 8);
      t.classList.add('reveal');
      io.observe(t);
    });
    return () => io.disconnect();
  }, [selector]);

  return ref;
}

/**
 * شمارش تدریجی اعداد هنگام ورود به viewport (Count-up یک‌باره با easing نرم).
 * خروجی عدد خام است؛ قالب‌بندی فارسی با فراخواننده.
 */
export function useCountUp(target: number, duration = 900) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducedMotion() || typeof IntersectionObserver === 'undefined') {
      setValue(target);
      return;
    }
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          setValue(Math.round(target * eased));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [target, duration]);

  return { ref, value };
}
