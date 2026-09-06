import type { ReactNode } from 'react';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { useSEO, type JsonLd } from '@/lib/seo';
import {
  breadcrumbJsonLd,
  crumbsFor,
  hasBreadcrumbLd,
} from '@/lib/breadcrumbs';

type Props = {
  children: ReactNode;
  title: string;
  description: string;
  breadcrumb?: string[];
  jsonLd?: JsonLd;
  noindex?: boolean;
};

export default function Layout({ children, title, description, breadcrumb, jsonLd, noindex }: Props) {
  const pathSegments = window.location.pathname.split('/').filter(Boolean);

  /* منبع واحد breadcrumb: اگر صفحه BreadcrumbList اختصاصی در jsonLd دارد
     (صفحات دیتابیسی با عنوان واقعی، هماهنگ با prerender) همان ملاک است؛
     وگرنه از همان trail ظاهری ساخته می‌شود تا متن/ترتیب/URL در UI و
     Schema همیشه یکی باشد. */
  const crumbJsonLd = hasBreadcrumbLd(jsonLd)
    ? undefined
    : breadcrumbJsonLd(crumbsFor(breadcrumb || [], window.location.pathname));
  const effectiveJsonLd = hasBreadcrumbLd(jsonLd)
    ? jsonLd
    : crumbJsonLd && jsonLd
      ? [...(Array.isArray(jsonLd) ? jsonLd : [jsonLd]), crumbJsonLd]
      : crumbJsonLd || jsonLd;

  useSEO({ title, description, path: window.location.pathname, jsonLd: effectiveJsonLd, noindex });

  return (
    <>
      <SiteHeader />
      {breadcrumb && breadcrumb.length > 0 && (
        <div className="container breadcrumb" aria-label="مسیر صفحه">
          <a href="/">خانه</a>
          {breadcrumb.map((item, index) => {
            const last = index === breadcrumb.length - 1;
            const href = '/' + pathSegments.slice(0, index + 1).join('/');
            return last ? <span key={item}>/ {item}</span> : <a key={item} href={href}>/ {item}</a>;
          })}
        </div>
      )}
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
