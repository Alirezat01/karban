/**
 * Karban — build-time meta prerenderer
 * ------------------------------------
 * The app is a client-rendered React SPA. Crawlers that don't execute JS
 * used to see the homepage <title>/<meta>/<canonical> for EVERY route.
 * This script runs AFTER `vite build` and writes, for each known route,
 * a dist/<route>/index.html with route-specific:
 *   - <title>, meta description, canonical, Open Graph & Twitter tags
 *   - route JSON-LD (FAQ for tools hub, Article for knowledge articles,
 *     BreadcrumbList for contract details)
 *
 * It does NOT change the app itself — the SPA still takes over on load.
 * Dynamic routes (articles/contracts) are read from Supabase via the
 * public anon key; if Supabase is unreachable, only static routes are
 * prerendered and the build still succeeds.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ORIGIN = 'https://karbanapp.ir';
const SUPABASE_URL = 'https://rocjeanizzhfvhnuhnms.supabase.co';
const SUPABASE_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvY2plYW5penpoZnZobm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NDQwMDcsImV4cCI6MjEwMjAyMDAwN30.Br3brGTpjWnI7ilghPka_DyYUQU7e9eYIPv88Ehqy6g';

const HOME_TITLE = 'کاربان | بانک قرارداد تخصصی و ماشین‌حساب حقوق ۱۴۰۵';
const HOME_DESC =
  'بیش از ۹۰ قرارداد تخصصی کارفرمایی و فریلنسر، ۱۰ ماشین‌حساب دقیق حقوق، سنوات و مالیات ۱۴۰۵، و دانشنامه حقوق کار با استناد قانون کار و قانون مدنی.';

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Static route manifest (kept in sync with src/App.tsx). */
const STATIC_ROUTES = [
  { path: '/', title: HOME_TITLE, description: HOME_DESC },
  { path: '/قراردادها', title: 'بیش از ۸۰ قرارداد تخصصی به تفکیک صنف؛ متن کامل و PDF', description: 'بانک قرارداد کاربان؛ بیش از ۹۰ نمونه قرارداد استاندارد به تفکیک نوع و صنف با متن کامل و دانلود PDF.' },
  { path: '/دانشنامه', title: 'دانشنامه حقوقی و مالیاتی کسب‌وکار | کاربان', description: 'مقالات کاربردی حقوق کار، بیمه و مالیات به زبان ساده و با استناد به مواد قانونی.' },
  { path: '/خدمات', title: 'مشاوره و قرارداد اختصاصی برای هر صنف | کاربان', description: 'مشاوره حقوقی، مالی و قرارداد اختصاصی برای هر صنف؛ از پزشکان تا فروشگاه آنلاین.' },
  { path: '/ابزارهای-هوش-مصنوعی', title: 'ماشین‌حساب‌های حقوق، سنوات و مالیات مطابق مقررات ۱۴۰۵', description: 'ماشین‌حساب آنلاین حقوق و دستمزد، سنوات، بازنشستگی، هزینه استخدام، اضافه‌کاری و مالیات مطابق مقررات ۱۴۰۵.' },
  { path: '/درباره-ما', title: 'درباره کاربان | از قرارداد تا آرامش', description: 'کاربان پلتفرم هوشمند قرارداد و همراه حقوق کار برای کارفرمایان، کارمندان و فریلنسرها.' },
  { path: '/تماس-با-ما', title: 'تماس با کاربان', description: 'تهران، خیابان کریمخان، خیابان سنایی، پلاک ۶۱، طبقه سوم | تلفن: ۰۲۱-۸۸۳۴۲۶۷۹ | hello@karbanapp.ir' },
  { path: '/قوانین', title: 'قوانین و شرایط استفاده از کاربان', description: 'شرایط شفاف استفاده از خدمات و ابزارهای کاربان؛ پیش از ثبت سفارش بخوانید.' },
  { path: '/حریم-خصوصی', title: 'حریم خصوصی کاربان', description: 'سیاست حریم خصوصی کاربان؛ چه داده‌هایی جمع می‌شود و چگونه محافظت می‌شود.' },
  { path: '/درخواست‌های-اداری', title: 'درخواست‌های اداری آماده — استعفا، وام، مرخصی و…', description: 'متن رسمی و آماده درخواست‌های اداری پرتکرار؛ کپی کنید، جاهای خالی را پر کنید و امضا کنید.' },
];

const CALCULATORS = [
  { path: '/ابزارهای-هوش-مصنوعی/محاسبه-حقوق', title: 'محاسبه حقوق و دستمزد ۱۴۰۵', description: 'محاسبه آنلاین حقوق خالص، کسورات بیمه و مالیات حقوق ۱۴۰۵ با استناد ماده ۴۱ قانون کار.' },
  { path: '/ابزارهای-هوش-مصنوعی/هزینه-استخدام', title: 'ماشین‌حساب هزینه استخدام کارمند', description: 'بهای تمام‌شدن واقعی استخدام یک کارمند؛ حقوق، بیمه سهم کارفرما، عیدی و سنوات، قلم‌به‌قلم.' },
  { path: '/ابزارهای-هوش-مصنوعی/سنوات', title: 'ماشین‌حساب سنوات پایان خدمت', description: 'محاسبه سنوات پایان خدمت به ازای هر سال سابقه، مطابق ماده ۲۴ قانون کار.' },
  { path: '/ابزارهای-هوش-مصنوعی/بازنشستگی', title: 'ماشین‌حساب بازنشستگی تأمین اجتماعی', description: 'بررسی شرایط بازنشستگی و برآورد مستمری مطابق قانون تأمین اجتماعی.' },
  { path: '/ابزارهای-هوش-مصنوعی/اضافه-کاری', title: 'ماشین‌حساب اضافه‌کاری ۱۴۰۵', description: 'محاسبه مبلغ اضافه‌کاری با نرخ قانونی ۴۰٪ بالاتر، مطابق ماده ۵۹ قانون کار.' },
  { path: '/ابزارهای-هوش-مصنوعی/مالیات-مشاغل', title: 'ماشین‌حساب مالیات مشاغل و مغازه', description: 'محاسبه پلکانی مالیات مشاغل مطابق ماده ۱۳۱ با کسر معافیت سالانه.' },
  { path: '/ابزارهای-هوش-مصنوعی/ارزش-افزوده', title: 'ماشین‌حساب ارزش افزوده', description: 'محاسبه مالیات بر ارزش افزوده با نرخ ۱۰٪ — هم افزودن به پایه و هم استخراج از داخل فاکتور.' },
  { path: '/ابزارهای-هوش-مصنوعی/مالیات-حقوق', title: 'ماشین‌حساب مالیات حقوق ۱۴۰۵', description: 'محاسبه پلکانی مالیات حقوق بر اساس معافیت سال ۱۴۰۵.' },
  { path: '/ابزارهای-هوش-مصنوعی/تست-سلامت', title: 'تست سلامت کسب‌وکار', description: 'نقاط قوت و ریسک‌های حقوقی، مالی و عملیاتی کسب‌وکار خود را بشناسید.' },
  { path: '/ابزارهای-هوش-مصنوعی/ساخت-قرارداد', title: 'ساخت قرارداد هوشمند', description: 'قرارداد متناسب با نوع همکاری و صنف شما، در چند مرحله و با مبنای قانونی.' },
];

const KNOWLEDGE_CATEGORIES = ['حقوقی و قانون کار', 'مالیات', 'حسابداری', 'منابع انسانی', 'مدیریت'];
KNOWLEDGE_CATEGORIES.forEach((c, i) => {
  STATIC_ROUTES.push({
    path: `/دانشنامه/${i + 1}`,
    title: `مقالات ${c} | دانشنامه کاربان`,
    description: `مقاله‌های تخصصی ${c} برای کسب‌وکارها، با استناد به مواد قانونی.`,
  });
});

const TOOLS_FAQ_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    { '@type': 'Question', name: 'آیا نتایج ماشین‌حساب‌ها مبنای قانونی دارد؟', acceptedAnswer: { '@type': 'Answer', text: 'محاسبات بر اساس قانون کار، قانون تأمین اجتماعی و قانون مالیات‌های مستقیم و مصوبات ۱۴۰۵ است؛ ملاک نهایی، فیش رسمی سازمان‌هاست.' } },
    { '@type': 'Question', name: 'پارامترهای حقوق ۱۴۰۵ از کجا می‌آید؟', acceptedAnswer: { '@type': 'Answer', text: 'مطابق بخشنامه سالانه شورای عالی کار؛ و از پنل مدیریت کاربان قابل به‌روزرسانی است.' } },
    { '@type': 'Question', name: 'سنوات پایان خدمت چگونه محاسبه می‌شود؟', acceptedAnswer: { '@type': 'Answer', text: 'به ازای هر سال سابقه معادل یک ماه آخرین حقوق، مطابق ماده ۲۴ قانون کار.' } },
    { '@type': 'Question', name: 'نرخ ارزش افزوده سال ۱۴۰۵ چقدر است؟', acceptedAnswer: { '@type': 'Answer', text: '۱۰٪؛ هر دو حالت افزودن به پایه و استخراج از داخل فاکتور محاسبه می‌شود.' } },
    { '@type': 'Question', name: 'مالیات مشاغل چند درصد است؟', acceptedAnswer: { '@type': 'Answer', text: 'پلکانی ۱۵ تا ۳۵ درصد مطابق ماده ۱۳۱، پس از کسر معافیت سالانه.' } },
  ],
};

async function supabaseFetch(table, select) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON);
  const { data, error } = await client.from(table).select(select).order('id');
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

/** Fallback when direct Supabase access fails at build time:
 *  parse route IDs from the live dynamic sitemap. */
async function liveSitemapIds(kind) {
  const res = await fetch(`${ORIGIN}/api/sitemap.xml`);
  if (!res.ok) throw new Error(`live sitemap: HTTP ${res.status}`);
  const xml = await res.text();
  const prefix = kind === 'articles' ? '/دانشنامه/مقاله/' : '/قراردادها/';
  const ids = [];
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const loc = decodeURIComponent(m[1].replace(ORIGIN, ''));
    const rest = loc.startsWith(prefix) ? loc.slice(prefix.length) : null;
    if (rest && /^\d+$/.test(rest)) ids.push(Number(rest));
  }
  return [...new Set(ids)].sort((a, b) => a - b);
}

function transformHtml(html, { title, description, path, jsonLd }) {
  const url = `${ORIGIN}${encodeURI(path)}`;
  let out = html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(description)}" />`)
    .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(title)}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(description)}" />`)
    .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${esc(title)}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${esc(description)}" />`);

  if (jsonLd) {
    const payload = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
    const tags = payload
      .map((obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`)
      .join('\n');
    out = out.replace('</head>', `${tags}\n  </head>`);
  }
  return out;
}

async function writeRoute(distDir, html, routePath) {
  const segments = routePath.split('/').filter(Boolean);
  const dir = resolve(distDir, ...segments.map((s) => encodeURIComponent(s)));
  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, 'index.html'), html, 'utf8');
  return dir;
}

async function main() {
  const distDir = resolve(process.cwd(), 'dist');
  const template = await readFile(resolve(distDir, 'index.html'), 'utf8');
  let count = 0;

  // 1) Static + calculator routes
  for (const route of [...STATIC_ROUTES, ...CALCULATORS]) {
    const jsonLd = route.path === '/ابزارهای-هوش-مصنوعی' ? TOOLS_FAQ_JSONLD : undefined;
    await writeRoute(distDir, transformHtml(template, { ...route, jsonLd }), route.path);
    count++;
  }

  // 2) Dynamic routes — best effort (Supabase first, live sitemap as fallback)
  try {
    let articles;
    try {
      articles = await supabaseFetch('articles', 'id,title,intro,meta_title,meta_description');
    } catch {
      articles = [];
    }
    if (!articles.length) articles = (await liveSitemapIds('articles')).map((id) => ({ id, title: `مقاله دانشنامه`, intro: '', meta_title: null, meta_description: null }));
    for (const a of articles) {
      const path = `/دانشنامه/مقاله/${a.id}`;
      const title = a.meta_title || `${a.title} | کاربان`;
      const description = a.meta_description || a.intro || title;
      const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: a.title,
        description,
        mainEntityOfPage: `${ORIGIN}${encodeURI(path)}`,
        publisher: { '@type': 'Organization', name: 'کاربان', url: `${ORIGIN}/` },
        inLanguage: 'fa-IR',
      };
      await writeRoute(distDir, transformHtml(template, { title, description, path, jsonLd }), path);
      count++;
    }
    console.log(`prerender-meta: ${articles.length} articles done.`);
  } catch (e) {
    console.warn(`prerender-meta: articles skipped (${String(e).slice(0, 120)})`);
  }

  try {
    let contracts;
    try {
      contracts = await supabaseFetch('contracts', 'id,title,summary');
    } catch {
      contracts = [];
    }
    if (!contracts.length) contracts = (await liveSitemapIds('contracts')).map((id) => ({ id, title: 'قرارداد کاربان', summary: '' }));
    for (const c of contracts) {
      const path = `/قراردادها/${c.id}`;
      const title = `${c.title} | کاربان`;
      const description = c.summary || `متن کامل و دانلود PDF «${c.title}» — نسخه استاندارد کاربان.`;
      const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'خانه', item: `${ORIGIN}/` },
          { '@type': 'ListItem', position: 2, name: 'قراردادها', item: `${ORIGIN}/قراردادها` },
          { '@type': 'ListItem', position: 3, name: c.title, item: `${ORIGIN}${encodeURI(path)}` },
        ],
      };
      await writeRoute(distDir, transformHtml(template, { title, description, path, jsonLd }), path);
      count++;
    }
    console.log(`prerender-meta: ${contracts.length} contracts done.`);
  } catch (e) {
    console.warn(`prerender-meta: contracts skipped (${String(e).slice(0, 120)})`);
  }

  console.log(`prerender-meta: ${count} route HTML files written.`);
}

main().catch((e) => {
  // Never break the deploy because of prerendering.
  console.error('prerender-meta failed (build continues with SPA fallback):', e);
});
