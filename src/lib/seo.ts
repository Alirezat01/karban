import { useEffect } from 'react';

type SEOProps = {
  title: string;
  description: string;
  path: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  image?: string;
  type?: 'website' | 'article';
  noindex?: boolean;
};

const ORIGIN = 'https://karbanapp.ir';
const DEFAULT_IMAGE = `${ORIGIN}/assets/images/Gemini_Generated_Image_3xp4kz3xp4kz3xp4-removebg-preview.png`;

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property' in el && attr === 'property' ? 'property' : attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

export function useSEO({ title, description, path, jsonLd, image = DEFAULT_IMAGE, type = 'website', noindex = false }: SEOProps) {
  useEffect(() => {
    const canonicalPath = path || '/';
    const canonicalUrl = `${ORIGIN}${canonicalPath}`;

    document.title = title;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', noindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large');
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', canonicalUrl);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:site_name', 'کاربان');
    setMeta('property', 'og:locale', 'fa_IR');
    setMeta('property', 'og:image', image);
    setMeta('property', 'og:image:alt', title);
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', image);
    setLink('canonical', canonicalUrl);

    const old = document.getElementById('page-jsonld');
    if (old) old.remove();
    if (jsonLd) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = 'page-jsonld';
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }
  }, [title, description, path, jsonLd, image, type, noindex]);
}

export { ORIGIN, DEFAULT_IMAGE };
