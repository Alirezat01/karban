import { createClient } from '@supabase/supabase-js';

const BASE = 'https://karbanapp.ir';

export default async function handler(req: any, res: any) {
  const today = new Date().toISOString().slice(0, 10);

  const rows: { path: string; priority: string; lastmod?: string }[] = [
    { path: '/', priority: '1.0', lastmod: today },
    { path: '/خدمات', priority: '0.9', lastmod: today },
    { path: '/قراردادها', priority: '0.9', lastmod: today },
    { path: '/دانشنامه', priority: '0.9', lastmod: today },
    { path: '/ابزارهای-هوش-مصنوعی', priority: '0.9', lastmod: today },
    { path: '/درباره-ما', priority: '0.5' },
    { path: '/تماس-با-ما', priority: '0.5' },
    { path: '/قوانین', priority: '0.4' },
    { path: '/حریم-خصوصی', priority: '0.4' },
    { path: '/ابزارهای-هوش-مصنوعی/محاسبه-حقوق', priority: '0.8' },
    { path: '/ابزارهای-هوش-مصنوعی/هزینه-استخدام', priority: '0.8' },
    { path: '/ابزارهای-هوش-مصنوعی/سنوات', priority: '0.8' },
    { path: '/ابزارهای-هوش-مصنوعی/بازنشستگی', priority: '0.8' },
    { path: '/ابزارهای-هوش-مصنوعی/اضافه-کاری', priority: '0.8' },
    { path: '/ابزارهای-هوش-مصنوعی/مالیات-مشاغل', priority: '0.8' },
    { path: '/ابزارهای-هوش-مصنوعی/ارزش-افزوده', priority: '0.8' },
    { path: '/ابزارهای-هوش-مصنوعی/مالیات-حقوق', priority: '0.8' },
    { path: '/ابزارهای-هوش-مصنوعی/تست-سلامت', priority: '0.8' },
    { path: '/ابزارهای-هوش-مصنوعی/ساخت-قرارداد', priority: '0.8' },
    { path: '/دانشنامه/1', priority: '0.7' },
    { path: '/دانشنامه/2', priority: '0.7' },
    { path: '/دانشنامه/3', priority: '0.7' },
    { path: '/دانشنامه/4', priority: '0.7' },
    { path: '/دانشنامه/5', priority: '0.7' },
  ];

  const supabase = createClient(
    'https://rocjeanizzhfvhnuhnms.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvY2plYW5penpoZnZobm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NDQwMDcsImV4cCI6MjEwMjAyMDAwN30.Br3brGTpjWnI7ilghPka_DyYUQU7e9eYIPv88Ehqy6g',
  );

  try {
    const a = await supabase.from('articles').select('id').order('id');
    (a.data || []).forEach((r: any) => rows.push({ path: `/دانشنامه/مقاله/${r.id}`, priority: '0.7' }));
  } catch {
    // If Supabase is unreachable, the sitemap still lists static routes.
  }

  try {
    const c = await supabase.from('contracts').select('id').order('id');
    (c.data || []).forEach((r: any) => rows.push({ path: `/قراردادها/${r.id}`, priority: '0.8' }));
  } catch {
    // Same graceful fallback for contracts.
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    rows
      .map(
        (r) =>
          `  <url><loc>${BASE}${encodeURI(r.path)}</loc>${r.lastmod ? `<lastmod>${r.lastmod}</lastmod>` : ''}<priority>${r.priority}</priority></url>`,
      )
      .join('\n') +
    `\n</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).send(xml);
}
