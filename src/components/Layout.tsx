import type { ReactNode } from 'react';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { useSEO, type JsonLd } from '@/lib/seo';
import {
  breadcrumbJsonLd,
  crumbsFor,
  hasBreadcrumbLd,
  type Crumb,
} from '@/lib/breadcrumbs';

type Props = {
  children: ReactNode;
  title: string;
  description: string;
  /** هر آیتم: رشته (آدرس از segmentهای مسیر ساخته می‌شود) یا {name,href} صریح — UI و Schema همیشه یکی می‌شوند */
  breadcrumb?: (string | Crumb)[];
  jsonLd?: JsonLd;
  noindex?: boolean;
  image?: string;
};

/* نرمال‌سازی آیتم‌های breadcrumb به Crumb با href قطعی */
function toCrumbs(trail: (string | Crumb)[], pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean);
  let consumed = 0;
  return trail.map((item) => {
    if (typeof item !== 'string') return item;
    consumed += 1;
    return { name: item, href: '/' + segments.slice(0, consumed).join('/') };
  });
}

export default function Layout({ children, title, description, breadcrumb, jsonLd, noindex, image }: Props) {
  /* مسیر decode‌شده — window.location.pathname انکد‌شده است و encodeURI مجدد در
     applySEO آن را %25… می‌کرد (canonical دوبار-انکد = ناسازگار با prerender و sitemap) */
  let decodedPath = window.location.pathname;
  try { decodedPath = decodeURIComponent(decodedPath); } catch { /* خام */ }
  const path = decodedPath;

  /* منبع واحد breadcrumb: اگر صفحه BreadcrumbList اختصاصی در jsonLd دارد
     (صفحات دیتابیسی با عنوان واقعی، هماهنگ با prerender) همان ملاک است؛
     وگرنه از همان trail ظاهری ساخته می‌شود تا متن/ترتیب/URL در UI و
     Schema همیشه یکی باشد. */
  const trailCrumbs = breadcrumb
    ? toCrumbs(breadcrumb, path)
    : crumbsFor([], path);
  const crumbJsonLd = hasBreadcrumbLd(jsonLd)
    ? undefined
    : breadcrumbJsonLd(trailCrumbs);
  const effectiveJsonLd = hasBreadcrumbLd(jsonLd)
    ? jsonLd
    : crumbJsonLd && jsonLd
      ? [...(Array.isArray(jsonLd) ? jsonLd : [jsonLd]), crumbJsonLd]
      : crumbJsonLd || jsonLd;

  useSEO({ title, description, path, image, jsonLd: effectiveJsonLd, noindex });

  return (
    <>
      <SiteHeader path={path} />
      {trailCrumbs.length > 0 && (
        <div className="container breadcrumb" aria-label="مسیر صفحه">
          <a href="/">خانه</a>
          {trailCrumbs.map((item, index) => {
            const last = index === trailCrumbs.length - 1;
            return last
              ? <span key={`${item.name}-${index}`}>/ {item.name}</span>
              : <a key={`${item.name}-${index}`} href={item.href}>/ {item.name}</a>;
          })}
        </div>
      )}
      {/* جابه‌جایی سریع صفحات: با هر تغییر مسیر، fade کوتاه ۲۰۰ms پخش می‌شود */}
      <main key={path} className="page-fade">{children}</main>
      <SiteFooter />
    </>
  );
}
