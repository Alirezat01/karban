/* ────────────────────────────────────────────────────────────
   Theme (light/dark) — persisted in localStorage, respects
   prefers-color-scheme on first visit. Sets `data-theme` on <html>.
   ──────────────────────────────────────────────────────────── */
import { useEffect, useState } from 'react';

const KEY = 'karban-theme';
type Theme = 'dark' | 'light';

function readStored(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    if (t === 'light' || t === 'dark') return t;
  } catch { /* noop */ }
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark'; /* karban default */
}

function apply(theme: Theme) {
  try {
    document.documentElement.setAttribute('data-theme', theme);
  } catch { /* noop */ }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => (typeof window !== 'undefined' ? readStored() : 'dark'));

  useEffect(() => {
    apply(theme);
    try { localStorage.setItem(KEY, theme); } catch { /* noop */ }
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  return { theme, toggle };
}

/* Initialize on first import (so SSR / pre-hydration flash is avoided) */
if (typeof window !== 'undefined') {
  apply(readStored());
}
