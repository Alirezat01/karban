import type { JsonLd, JsonLdObject } from '@/lib/seo';

export type Crumb = { name: string; href: string };

export const ORIGIN = 'https://karbanapp.ir';

export const absoluteUrl = (path: string) => `${ORIGIN}${encodeURI(path)}`;

/**
 * ساخت BreadcrumbList JSON-LD از همان آیتم‌هایی که در UI نمایش داده می‌شوند.
 * منبع واحد: متن، ترتیب و URL در breadcrumb ظاهری و schema همیشه یکسان است.
 */
export function breadcrumbJsonLd(crumbs: Crumb[]): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.href),
    })),
  };
}

/** خانه + دنباله؛ قراردادی که Layout برای صفحات هاب استفاده می‌کند */
export function crumbsFor(trail: string[], pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean);
  return [
    { name: 'خانه', href: '/' },
    ...trail.map((name, i) => ({ name, href: '/' + segments.slice(0, i + 1).join('/') })),
  ];
}

/** تشخیص اینکه jsonLd صفحه از قبل BreadcrumbList دارد (صفحات دیتیل) */
export function hasBreadcrumbLd(jsonLd?: JsonLd): boolean {
  if (!jsonLd) return false;
  const arr = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
  return arr.some((o) => (o as JsonLdObject)['@type'] === 'BreadcrumbList');
}

/** حذف BreadcrumbList از باندل (برای جلوگیری از تکرار) */
export function stripBreadcrumbLd(jsonLd: JsonLd): JsonLd {
  const arr = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
  return arr.filter((o) => (o as JsonLdObject)['@type'] !== 'BreadcrumbList');
}
