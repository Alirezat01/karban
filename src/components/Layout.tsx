import { ReactNode } from 'react';
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

  return (
    <>
      <SiteHeader />
      {breadcrumb && (
        <div className="container breadcrumb" aria-label="مسیر صفحه">
          <a href="/">خانه</a>
          {breadcrumb.map((item) => (
            <span key={item}>/ {item}</span>
          ))}
        </div>
      )}
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}

