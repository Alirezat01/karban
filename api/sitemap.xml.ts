import { createClient } from '@supabase/supabase-js';

const BASE = 'https://karbanapp.ir';

type Row = { path: string; priority: string; lastmod?: string };

/* مسیرهای استاتیک عمومی (هاب‌ها، ابزارها، چک‌لیست‌ها، کتابخانه قوانین) */
const STATIC_ROWS: Row[] = [
  { path: '/', priority: '1.0' },
  { path: '/خدمات', priority: '0.9' },
  { path: '/قراردادها', priority: '0.9' },
  { path: '/دانشنامه', priority: '0.9' },
  { path: '/ابزارهای-هوش-مصنوعی', priority: '0.9' },
  { path: '/درخواست‌های-اداری', priority: '0.8' },
  { path: '/چک-لیست‌ها', priority: '0.7' },
  { path: '/کتابخانه-قوانین', priority: '0.7' },
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
  { path: '/ابزارهای-هوش-مصنوعی/عیدی-و-پاداش', priority: '0.8' },
  { path: '/ابزارهای-هوش-مصنوعی/بیمه-تامین-اجتماعی', priority: '0.8' },
  { path: '/ابزارهای-هوش-مصنوعی/مرخصی', priority: '0.8' },
  { path: '/ابزارهای-هوش-مصنوعی/مزایای-پایان-همکاری', priority: '0.8' },
  { path: '/ابزارهای-هوش-مصنوعی/تست-سلامت', priority: '0.8' },
  { path: '/ابزارهای-هوش-مصنوعی/ساخت-قرارداد', priority: '0.8' },
  { path: '/چک-لیست‌ها/چک-لیست-استخدام', priority: '0.6' },
  { path: '/چک-لیست‌ها/چک-لیست-اخراج-و-فسخ', priority: '0.6' },
  { path: '/چک-لیست‌ها/چک-لیست-تنظیم-قرارداد', priority: '0.6' },
  { path: '/چک-لیست‌ها/چک-لیست-پایان-همکاری', priority: '0.6' },
  { path: '/چک-لیست‌ها/چک-لیست-مالیاتی-کسب-و-کار', priority: '0.6' },
  { path: '/کتابخانه-قوانین/قانون-کار', priority: '0.6' },
  { path: '/کتابخانه-قوانین/تأمین-اجتماعی', priority: '0.6' },
  { path: '/کتابخانه-قوانین/مالیات‌های-مستقیم', priority: '0.6' },
  { path: '/کتابخانه-قوانین/آیین‌نامه‌ها', priority: '0.6' },
  { path: '/دانشنامه/1', priority: '0.7' },
  { path: '/دانشنامه/2', priority: '0.7' },
  { path: '/دانشنامه/3', priority: '0.7' },
  { path: '/دانشنامه/4', priority: '0.7' },
  { path: '/دانشنامه/5', priority: '0.7' },
];

const day = (v: unknown): string | undefined => {
  if (!v) return undefined;
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : undefined;
};

type VercelReq = { method?: string };
type VercelRes = { setHeader: (k: string, v: string) => void; status: (c: number) => { send: (b: string) => void } };

export default async function handler(req: VercelReq, res: VercelRes) {
  const supabase = createClient(
    'https://rocjeanizzhfvhnuhnms.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvY2plYW5penpoZnZobnVobm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NDQwMDcsImV4cCI6MjEwMjAyMDAwN30.Br3brGTpjWnI7ilghPka_DyYUQU7e9eYIPv88Ehqy6g',
  );

  /* lastmod از updated_at؛ نبود ستون/مقدار → fallback منطقی: created_at */
  async function fetchRows(
    table: string,
    pathPrefix: string,
    priority: string,
    publishedOnly = false,
  ): Promise<Row[]> {
    for (const select of ['id,updated_at,created_at', 'id,created_at', 'id']) {
      let q = supabase.from(table).select(select).order('id');
      if (publishedOnly) q = q.eq('is_published', true);
      const { data, error } = await q;
      if (error) {
        console.error(`[sitemap] ${table} select(${select}) failed:`, error.message);
        continue; /* ستون بعدی را امتحان کن */
      }
      return ((data || []) as Record<string, unknown>[]).map((r) => ({
        path: `${pathPrefix}${r.id}`,
        priority,
        lastmod: day(r.updated_at) || day(r.created_at),
      }));
    }
    /* هیچ کوئری‌ای جواب نداد → خطای صریح، نه سایلنت ناقص */
    throw new Error(`[sitemap] Supabase query failed for ${table}`);
  }

  try {
    /* فقط قراردادهای منتشرشده؛ ستون is_published نبود → کل جدول */
    const contracts = await fetchRows('contracts', '/قراردادها/', '0.8', true).catch(() =>
      fetchRows('contracts', '/قراردادها/', '0.8'),
    );

    const articles = await fetchRows('articles', '/دانشنامه/مقاله/', '0.7');
    const requests = await fetchRows('admin_requests', '/درخواست‌های-اداری/', '0.6');

    const rows = [...STATIC_ROWS, ...contracts, ...articles, ...requests];

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
