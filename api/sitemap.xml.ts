import { createClient } from '@supabase/supabase-js';
import routeMeta from '../src/data/route-meta.json';
import checklists from '../src/data/checklists.json';
import lawsData from '../src/data/laws.json';

const BASE = 'https://karbanapp.ir';

/* ── منبع واحد متا: صفحات ثابت از route-meta.json (مشترک با App و prerender) ── */
type MetaRoute = { title?: string; description?: string; image?: string; priority?: string };
const META_ROUTES = routeMeta.routes as Record<string, MetaRoute>;
const META_TOOLS = routeMeta.tools as Record<string, MetaRoute>;
const KNOWLEDGE_CATEGORIES = (routeMeta as { knowledgeCategories?: string[] }).knowledgeCategories || [];

type Row = { path: string; priority: string; lastmod?: string };

/* صفحات ثابت: هاب‌ها + ابزارها + دسته‌های دانشنامه + چک‌لیست‌ها + کتابخانه قوانین —
   همه از همان JSONهایی که prerender صفحه می‌سازد تا هیچ‌وقت از بیلد عقب نیفتد */
const STATIC_ROWS: Row[] = [
  { path: '/', priority: routeMeta.home.priority || '1.0' },
  ...Object.entries(META_ROUTES).map(([path, m]) => ({ path, priority: m.priority || '0.6' })),
  ...Object.entries(META_TOOLS).map(([key, m]) => ({ path: `/ابزارهای-هوش-مصنوعی/${key}`, priority: m.priority || '0.8' })),
  ...KNOWLEDGE_CATEGORIES.map((c) => ({ path: `/دانشنامه/${c.replace(/ /g, '-')}`, priority: '0.7' })),
  ...(checklists as { slug: string }[]).map((c) => ({ path: `/چک-لیست‌ها/${c.slug}`, priority: '0.6' })),
  ...(lawsData.categories as string[]).map((c) => ({ path: `/کتابخانه-قوانین/${c.replace(/ /g, '-')}`, priority: '0.6' })),
];

/* دسته‌های دانشنامه از route-meta (منبع واحد) — اسلاگ = نام با خط تیره */

const MAX_SLUG_CHARS = 40;
function slugifyTitle(title: string): string {
  let s = String(title || '').trim()
    .replace(/[\s\u200c]+/g, '-')
    .replace(/[?؟!:؛،«»"'.()\[\]{}+*&%=#$@_|~^<>,؛]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (s.length > MAX_SLUG_CHARS) {
    s = s.slice(0, MAX_SLUG_CHARS);
    const cut = s.lastIndexOf('-');
    if (cut > 15) s = s.slice(0, cut);
  }
  return s || 'مقاله';
}
const articleSlugPath = (title: string, id: unknown) => `/دانشنامه/مقاله/${slugifyTitle(title)}-${String(id)}`;

const day = (v: unknown): string | undefined => {
  if (!v) return undefined;
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : undefined;
};

type VercelReq = { method?: string };
type VercelRes = { setHeader: (k: string, v: string) => void; status: (c: number) => { send: (b: string) => void } };

/**
 * مسیرهای prerender‌شده از manifest بیلد — تنها منبع حقیقت برای «کدام URL فایل استاتیک دارد».
 * اگر manifest در دسترس نبود (deploy خیلی قدیم)، null برمی‌گردد و فیلتر غیرفعال می‌شود.
 */
async function fetchPrerendered(): Promise<Set<string> | null> {
  try {
    const res = await fetch(`${BASE}/prerender-manifest.json`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = (await res.json()) as { routes?: string[] };
    return json.routes ? new Set(json.routes) : null;
  } catch {
    return null;
  }
}

export default async function handler(req: VercelReq, res: VercelRes) {
  const supabase = createClient(
    'https://rocjeanizzhfvhnuhnms.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvY2plYW5penpoZnZobnVobm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NDQwMDcsImV4cCI6MjEwMjAyMDAwN30.Br3brGTpjWnI7ilghPka_DyYUQU7e9eYIPv88Ehqy6g',
  );

  const prerendered = await fetchPrerendered();
  /* فقط URLهایی که فایل prerender دارند → هماهنگی کامل sitemap با بیلد */
  const inBuild = (path: string) => !prerendered || prerendered.has(path);

  /* قراردادها: فقط منتشرشده‌ها (وقتی ستون is_published موجود است).
     زنجیره fallback برای نبودن ستون‌های اختیاری (updated_at/is_published)؛
     خطای واقعی دیتابیس ⇒ خروجی خالی — هیچ‌وقت انتشار کورکورانه */
  async function fetchContracts(): Promise<Row[]> {
    for (const select of ['id,updated_at,created_at,is_published', 'id,created_at,is_published', 'id,created_at']) {
      const { data, error } = await supabase.from('contracts').select(select).order('id');
      if (error) {
        console.error(`[sitemap] contracts select(${select}) failed:`, error.message);
        continue;
      }
      return ((data || []) as Record<string, unknown>[]) /* اگر ستون باشد: فقط منتشرشده */
        .filter((r) => r.is_published === undefined ? true : r.is_published !== false)
        .map((r) => ({ path: `/قراردادها/${r.id}`, priority: '0.8', lastmod: day(r.updated_at) || day(r.created_at) }));
    }
    return [];
  }

  /* مقاله‌ها: URL اسلاگ (عنوان-شناسه)؛ زنجیره fallback برای نبود ستون‌های اختیاری */
  async function fetchArticles(): Promise<Row[]> {
    for (const select of ['id,title,updated_at,created_at', 'id,title,created_at']) {
      const { data, error } = await supabase.from('articles').select(select).order('id');
      if (error) {
        console.error(`[sitemap] articles select(${select}) failed:`, error.message);
        continue;
      }
      return ((data || []) as Record<string, unknown>[]).map((r) => ({
        path: r.title ? articleSlugPath(String(r.title), r.id as string) : `/دانشنامه/مقاله/${r.id}`,
        priority: '0.7',
        lastmod: day(r.updated_at) || day(r.created_at),
      }));
    }
    return [];
  }

  async function fetchRequests(): Promise<Row[]> {
    for (const select of ['id,updated_at,created_at', 'id,created_at', 'id']) {
      const { data, error } = await supabase.from('admin_requests').select(select).order('id');
      if (error) {
        console.error(`[sitemap] admin_requests select(${select}) failed:`, error.message);
        continue;
      }
      return ((data || []) as Record<string, unknown>[]).map((r) => ({
        path: `/درخواست‌های-اداری/${r.id}`,
        priority: '0.6',
        lastmod: day(r.updated_at) || day(r.created_at),
      }));
    }
    return [];
  }

  try {
    const [contracts, articles, requests] = await Promise.all([fetchContracts(), fetchArticles(), fetchRequests()]);

    const rows = [...STATIC_ROWS, ...contracts, ...articles, ...requests].filter((r) => inBuild(r.path));

    /* dedupe بر اساس مسیر (حفظ آخرین = با lastmod) */
    const byPath = new Map<string, Row>();
    for (const r of rows) byPath.set(r.path, r);

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      [...byPath.values()]
        .map(
          (r) =>
            `  <url><loc>${BASE}${encodeURI(r.path)}</loc>${
              r.lastmod ? `<lastmod>${r.lastmod}</lastmod>` : ''
            }<priority>${r.priority}</priority></url>`,
        )
        .join('\n') +
      `\n</urlset>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).send(xml);
  } catch (e) {
    /* خطای دیتابیس: سایلنت ناقص ممنوع — 500 صریح تا گوگل بعداً دوباره بیاید */
    console.error('[sitemap] fatal:', String(e));
    res.status(500).send('sitemap temporarily unavailable');
  }
}
