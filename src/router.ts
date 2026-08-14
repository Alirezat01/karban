import { useEffect, useState } from 'react';

export function useRoute() {
  const [path, setPath] = useState(() => window.location.pathname || '/');

  useEffect(() => {
    const onChange = () => {
      setPath(window.location.pathname || '/');
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    };

    window.addEventListener('popstate', onChange);

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || !href.startsWith('/') || href.startsWith('//')) return;
      if (anchor.hasAttribute('download')) return;
      e.preventDefault();
      window.history.pushState({}, '', href);
      onChange();
    };
    document.addEventListener('click', onClick);

    return () => {
      window.removeEventListener('popstate', onChange);
      document.removeEventListener('click', onClick);
    };
  }, []);

  return path;
}

export function navigate(to: string) {
  window.history.pushState({}, '', to);
  window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
}
