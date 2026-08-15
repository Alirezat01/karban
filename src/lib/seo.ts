import { useEffect } from 'react';

type SEOOptions = {
  title: string;
  description: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

const SITE_NAME = 'کاربان';
const SITE_URL = 'https://karban.ir';

const upsertMeta = (selector: string, attributes: Record<string, string>) => {
  let node = document.head.querySelector<HTMLMetaElement | HTMLLinkElement | HTMLScriptElement>(selector);
  if (!node) {
    node = selector.startsWith('link') ? document.createElement('link') : selector.includes('script') ? document.createElement('script') : document.createElement('meta');
    document.head.appendChild(node);
  }
  for (const [key, value] of Object.entries(attributes)) {
    node.setAttribute(key, value);
  }
  return node;
};

export function useSEO({ title, description, path = window.location.pathname, image = '/images/og-tools.png', noIndex = false, jsonLd }: SEOOptions) {
  useEffect(() => {
    document.title = title;

    const canonical = `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
    upsertMeta('link[rel="canonical"]', { rel: 'canonical', href: canonical });
    upsertMeta('meta[name="description"]', { name: 'description', content: description });
    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: SITE_NAME });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical });
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: `${SITE_URL}${image.startsWith('/') ? image : `/${image}`}` });
    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: `${SITE_URL}${image.startsWith('/') ? image : `/${image}`}` });

    let robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.setAttribute('name', 'robots');
      document.head.appendChild(robots);
    }
    robots.setAttribute('content', noIndex ? 'noindex,nofollow' : 'index,follow');

    let jsonLdNode = document.head.querySelector<HTMLScriptElement>('script[data-karban-jsonld="true"]');
    if (!jsonLdNode) {
      jsonLdNode = document.createElement('script');
      jsonLdNode.type = 'application/ld+json';
      jsonLdNode.dataset.karbanJsonld = 'true';
      document.head.appendChild(jsonLdNode);
    }
    jsonLdNode.textContent = JSON.stringify(
      jsonLd ?? {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/assets/images/Gemini_Generated_Image_3xp4kz3xp4kz3xp4-removebg-preview.png`,
      },
    );
  }, [title, description, image, noIndex, path, jsonLd]);
}

