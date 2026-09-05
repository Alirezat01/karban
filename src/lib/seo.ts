import { useEffect } from 'react';

export type JsonLdObject = { [key: string]: unknown };
export type JsonLd = JsonLdObject | JsonLdObject[];

type SEOProps = {
  title: string;
  description: string;
  path: string;
  image?: string;
  jsonLd?: JsonLd;
  noindex?: boolean;
  ogType?: 'website' | 'article';
};

const ORIGIN = 'https://karbanapp.ir';
export const DEFAULT_OG_IMAGE = `${ORIGIN}/images/og-cover.jpg`;

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
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

/**
 * Applies per-page SEO meta tags imperatively.
 * Safe to call from async callbacks (e.g. after fetching an article/contract),
 * in addition to the declarative useSEO hook used by Layout.
 */
export function applySEO({ title, description, path, image, jsonLd, noindex, ogType }: SEOProps) {
  const ogImage = image ? (image.startsWith('http') ? image : `${ORIGIN}${image}`) : DEFAULT_OG_IMAGE;

  document.title = title;
  setMeta('name', 'description', description);
  setMeta('name', 'robots', noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large');
  setMeta('name', 'googlebot', noindex ? 'noindex,follow' : 'index,follow');

  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:url', `${ORIGIN}${path}`);
  setMeta('property', 'og:type', ogType || 'website');
  setMeta('property', 'og:site_name', 'کاربان');
  setMeta('property', 'og:locale', 'fa_IR');
  setMeta('property', 'og:image', ogImage);
  setMeta('property', 'og:image:alt', title);

  setMeta('name', 'twitter:card', 'summary_large_image');
  setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:description', description);
  setMeta('name', 'twitter:image', ogImage);

  setLink('canonical', `${ORIGIN}${path}`);

  const old = document.getElementById('page-jsonld');
  if (old) old.remove();
  if (jsonLd) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'page-jsonld';
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);
  }
}

export function useSEO(props: SEOProps) {
  useEffect(() => {
    applySEO(props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.title, props.description, props.path, props.image, props.noindex, props.ogType, props.jsonLd]);
}
