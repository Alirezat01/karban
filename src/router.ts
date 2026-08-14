import { useEffect, useState } from 'react';

export function useRoute() {
  const [path, setPath] = useState(() => decodeURIComponent(window.location.hash.slice(1) || '/'));

  useEffect(() => {
    const onChange = () => {
      const newHash = decodeURIComponent(window.location.hash.slice(1) || '/');
      setPath(newHash);
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    };
    window.addEventListener('hashchange', onChange);

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || !href.startsWith('/') || href.startsWith('//')) return;
      e.preventDefault();
      window.location.hash = '#' + href;
    };
    document.addEventListener('click', onClick);

    if (!window.location.hash) window.location.hash = '#/';
    return () => {
      window.removeEventListener('hashchange', onChange);
      document.removeEventListener('click', onClick);
    };
  }, []);

  return path;
}

export function navigate(to: string) {
  window.location.hash = `#${to}`;
}
