import { ReactNode, useEffect } from 'react';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';

type Props = { children: ReactNode; title: string; description: string; breadcrumb?: string[] };

export default function Layout({ children, title, description, breadcrumb }: Props) {
  useEffect(() => { document.title = title.includes('کاربان') ? title : `${title} | کاربان`; const meta = document.querySelector('meta[name="description"]'); if (meta) meta.setAttribute('content', description); }, [title, description]);
  return <><SiteHeader />{breadcrumb && <div className="container breadcrumb"><a href="/">خانه</a>{breadcrumb.map((item) => <span key={item}>/ {item}</span>)}</div>}<main>{children}</main><SiteFooter /></>;
}
