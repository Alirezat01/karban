import type { ReactNode } from 'react';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { useSEO } from '@/lib/seo';

type Props = {
  children: ReactNode;
  title: string;
  description: string;
  breadcrumb?: string[];
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

export default function Layout({ children, title, description, breadcrumb, jsonLd }: Props) {
  useSEO({ title, description, path: window.location.pathname, jsonLd });

  const pathSegments = window.location.pathname.split('/').filter(Boolean);

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
