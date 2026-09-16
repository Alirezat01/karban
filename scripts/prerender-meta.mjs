/**
 * Karban — build-time FULL-CONTENT prerenderer (v2)
 * -------------------------------------------------
 * Previously this script only injected meta tags; crawlers that didn't run JS
 * saw an empty #root. Now, for every route, it writes a dist/<route>/index.html
 * that CONTAINS the real page content (H1, intro, body, lists, internal links)
 * using the exact same CSS classes the React app renders. When the SPA boots,
 * React replaces the prerendered tree — users see zero visual difference.
 *
 *   - <title>, description, canonical, Open Graph, Twitter (route-specific)
 *   - single JSON-LD bundle per page (Article / BreadcrumbList / FAQPage /
 *     WebApplication / ItemList) in <script id="page-jsonld">, so the SPA's
 *     applySEO() cleanly replaces it after hydration (no duplicates)
 *   - a crawlable nav/breadcrumb/footer link shell (real <a href>) so every
 *     important URL is discoverable from the source HTML alone
 *
 * Data is read from Supabase with the PUBLIC anon key (same key the browser
 * uses). If Supabase is unreachable, static routes are still written and the
 * deploy never breaks.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import calcSeo from '../src/data/calc-seo.json' with { type: 'json' };
import checklists from '../src/data/checklists.json' with { type: 'json' };
import lawsData from '../src/data/laws.json' with { type: 'json' };
import articleRelated from '../src/data/article-related.json' with { type: 'json' };
import contractRelated from '../src/data/contract-related.json' with { type: 'json' };
import lawRelated from '../src/data/law-related.json' with { type: 'json' };
import routeMeta from '../src/data/route-meta.json' with { type: 'json' };

const articleRelatedMap = /** @type {Record<string, {href:string;label:string}[]>} */ (articleRelated);
const contractRelatedMap = /** @type {Record<string, {href:string;label:string}[]>} */ (contractRelated);
const lawRelatedMap = /** @type {Record<string, {href:string;label:string}[]>} */ (lawRelated);

const ORIGIN = 'https://karbanapp.ir';
const SUPABASE_URL = 'https://rocjeanizzhfvhnuhnms.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvY2plYW5penpoZnZobnVobm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NDQwMDcsImV4cCI6MjEwMjAyMDAwN30.Br3brGTpjWnI7ilghPka_DyYUQU7e9eYIPv88Ehqy6g';
const OG_IMAGE = `${ORIGIN}/images/og-cover.jpg`;

/* ── منبع واحد متا (مشترک با App.tsx و sitemap) ── */
const META_HOME = /** @type {{title:string;description:string}} */ (routeMeta.home);
const META_ROUTES = /** @type {Record<string,{title:string;description:string;image?:string}>} */ (routeMeta.routes);
const META_TOOLS = /** @type {Record<string,{title:string;description:string}>} */ (routeMeta.tools);
const ogFor = (routeKey) => (META_ROUTES[routeKey] && META_ROUTES[routeKey].image ? `${ORIGIN}${META_ROUTES[routeKey].image}` : OG_IMAGE);

/* ── اسلاگ — mirror of src/lib/slug.ts (keep in sync) ── */
const categorySlug = (name) => name.replace(/ /g, '-');
const categoryPath = (name) => `/دانشنامه/${categorySlug(name)}`;
const MAX_SLUG_CHARS = 40;
function slugifyTitle(title) {
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
const articleSlugPath = (title, id) => `/دانشنامه/مقاله/${slugifyTitle(title)}-${id}`;
/* نام نویسنده واقعی؟ «کاربان/تیم کاربان» = سازمان؛ بقیه = شخص */
const isOrgAuthor = (name) => !name || /کاربان/.test(String(name));
/* عنوان نمایشی بدون پسوند | کاربان (برای h1 و breadcrumb و schema name) */
const display = (t) => String(t).replace(/ \| کاربان$/, '');

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* inline rich text: escape then **bold** → <strong> */
const inline = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

/* Mirror of src/lib/rich-text.tsx — keep in sync */
function richTextToHtml(raw) {
  if (!raw) return '';
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\s*###\s+/g, '\n### ').replace(/\s*##\s+/g, '\n## ');
  const blocks = normalized.split(/\n+/).map((b) => b.trim()).filter(Boolean);
  let html = '';
  let list = [];
  const flush = () => {
    if (list.length) {
      html += `<ul>${list.map((i) => `<li>${inline(i)}</li>`).join('')}</ul>`;
      list = [];
    }
  };
  for (const b of blocks) {
    if (b.startsWith('### ')) { flush(); html += `<h3>${inline(b.slice(4))}</h3>`; }
    else if (b.startsWith('## ')) { flush(); html += `<h2>${inline(b.slice(3))}</h2>`; }
    else if (b.startsWith('- ') || b.startsWith('• ')) { list.push(b.replace(/^[-•]\s+/, '')); }
    else { flush(); html += `<p>${inline(b)}</p>`; }
  }
  flush();
  return html;
}

/* Extract visible FAQ pairs from an article body ("## پرسش‌های پرتکرار" section).
   Schema is emitted ONLY because the same Q/A text is visibly rendered. */
function parseFaqs(body) {
  if (!body) return [];
  const norm = body.replace(/\r\n/g, '\n');
  const idx = norm.indexOf('پرسش‌های پرتکرار');
  if (idx < 0) return [];
  const blocks = norm.slice(idx).split(/\n+/).map((b) => b.trim()).filter(Boolean).slice(1);
  const faqs = [];
  for (let i = 0; i < blocks.length; i++) {
    const m = blocks[i].match(/^\*\*(.+?)\*\*$/);
    if (m && blocks[i + 1]) { faqs.push([m[1], blocks[i + 1].replace(/^\*\*|\*\*$/g, '')]); i++; }
  }
  return faqs;
}

const url = (path) => `${ORIGIN}${encodeURI(path)}`;

function breadcrumbHtml(pairs) {
  // mirrors Layout.tsx breadcrumb markup
  const tail = pairs
    .map((p, i) =>
      i === pairs.length - 1
        ? `<span>/ ${esc(p.name)}</span>`
        : `<a href="${url(p.href)}">/ ${esc(p.name)}</a>`)
    .join('');
  return `<div class="container breadcrumb" aria-label="مسیر صفحه"><a href="${ORIGIN}/">خانه</a>${tail}</div>`;
}

const NAV_LINKS = [
  ['/', 'خانه'], ['/قراردادها', 'قراردادها'], ['/ابزارهای-هوش-مصنوعی', 'ابزارهای هوش مصنوعی'],
  ['/دانشنامه', 'دانشنامه'], ['/درخواست‌های-اداری', 'درخواست‌های اداری'], ['/چک-لیست‌ها', 'چک‌لیست‌های طلایی'], ['/خدمات', 'خدمات'], ['/تماس-با-ما', 'تماس با ما'],
];
const FOOTER_LINKS = [
  ['/دانشنامه', 'دانشنامه'], ['/قراردادها', 'قراردادها'], ['/خدمات', 'خدمات'], ['/ابزارهای-هوش-مصنوعی', 'ابزارهای هوش مصنوعی'],
  ['/درخواست‌های-اداری', 'درخواست‌های اداری'], ['/چک-لیست‌ها', 'چک‌لیست‌های طلایی'], ['/کتابخانه-قوانین', 'کتابخانه قوانین'], ['/درباره-ما', 'درباره ما'], ['/تماس-با-ما', 'تماس با ما'],
  ['/قوانین', 'قوانین و شرایط'], ['/حریم-خصوصی', 'حریم خصوصی'],
];

function shell(path, breadcrumbPairs) {
  const nav = `<nav class="pr-nav" aria-label="منوی اصلی">${NAV_LINKS.map(([h, t]) => `<a href="${url(h)}">${esc(t)}</a>`).join('')}</nav>`;
  const crumb = breadcrumbPairs && breadcrumbPairs.length ? breadcrumbHtml(breadcrumbPairs) : '';
  const footer = `<footer class="pr-footer"><nav aria-label="لینک‌های پایانی">${FOOTER_LINKS.map(([h, t]) => `<a href="${url(h)}">${esc(t)}</a>`).join('')}</nav><p>کاربان — بانک قرارداد، ماشین‌حساب حقوق و دانشنامه حقوق کار</p></footer>`;
  const style = `<style>.pr-nav{display:flex;flex-wrap:wrap;gap:.5rem 1.1rem;padding:.9rem 4vw}.pr-nav a,.pr-footer a{color:#8fd6b4;text-decoration:none;font-size:.95rem}.pr-footer{padding:1.4rem 4vw 2.2rem;border-top:1px solid rgba(255,255,255,.08);margin-top:2.5rem}.pr-footer nav{display:flex;flex-wrap:wrap;gap:.5rem 1.1rem}.pr-footer p{opacity:.6;font-size:.85rem;margin-top:.8rem}</style>`;
  return `${style}${nav}${crumb}`;
}

/* Single JSON-LD bundle; the SPA replaces this node on hydration (no dupes) */
function jsonLdScript(objects) {
  if (!objects || !objects.length) return '';
  return `<script type="application/ld+json" id="page-jsonld">${JSON.stringify(
    objects.length === 1 ? objects[0] : objects,
  )}</script>`;
}

const breadcrumbLd = (items) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({
    '@type': 'ListItem', position: i + 1, name: it.name,
    ...(it.href ? { item: url(it.href) } : { item: url(it.path) }),
  })),
});

const faqLd = (faqs) => ({
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
});

const articleLd = ({ title, description, path, author, published, modified }) => ({
  '@context': 'https://schema.org', '@type': 'Article',
  headline: title, description, image: [OG_IMAGE],
  author: isOrgAuthor(author)
    ? { '@type': 'Organization', name: 'کاربان', '@id': `${ORIGIN}/#organization` }
    : { '@type': 'Person', name: String(author) },
  publisher: { '@id': `${ORIGIN}/#organization` },
  mainEntityOfPage: url(path), inLanguage: 'fa-IR',
  ...(published ? { datePublished: published } : {}),
  ...(modified || published ? { dateModified: modified || published } : {}),
});

const itemListLd = (items) => ({
  '@context': 'https://schema.org', '@type': 'ItemList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, url: url(it.href) })),
});

const webAppLd = (title, description, path) => ({
  '@context': 'https://schema.org', '@type': 'WebApplication',
  name: title, description, url: url(path), applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web', inLanguage: 'fa-IR',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'IRR' },
  publisher: { '@id': `${ORIGIN}/#organization` },
});

function transformHtml(template, { title, description, path, ogType = 'website', jsonLd = [], inner = '', published, modified, image }) {
  const canonical = url(path);
  const ogImage = image || OG_IMAGE;
  let out = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(description)}" />`)
    .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${canonical}" />`)
    .replace(/<meta property="og:type" content="[^"]*" \/>/, `<meta property="og:type" content="${ogType}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(title)}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(description)}" />`)
    .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${canonical}" />`)
    .replace(/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${ogImage}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${esc(title)}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${esc(description)}" />`)
    .replace(/<meta name="twitter:image" content="[^"]*" \/>/, `<meta name="twitter:image" content="${ogImage}" />`)
    .replace(/<noscript>[\s\S]*?<\/noscript>/, '');

  if (ogType === 'article') {
    const extras = [];
    if (published) extras.push(`<meta property="article:published_time" content="${esc(published)}" />`);
    if (modified) extras.push(`<meta property="article:modified_time" content="${esc(modified || published)}" />`);
    if (extras.length) out = out.replace('</head>', `${extras.join('\n')}\n  </head>`);
  }

  const ld = [...jsonLd];
  if (ld.length) out = out.replace('</head>', `${jsonLdScript(ld)}\n  </head>`);
  out = out.replace('<div id="root"></div>', `<div id="root">${inner}</div>`);
  return out;
}

async function writeRoute(distDir, html, routePath) {
  const segments = routePath.split('/').filter(Boolean);
  const dir = resolve(distDir, ...segments.map((s) => encodeURIComponent(s)));
  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, 'index.html'), html, 'utf8');
}

/* Supabase with graceful column fallback (updated_at may not exist) */
async function supabaseFetch(table, selectFull, selectSafe) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON);
  let res = await client.from(table).select(selectFull).order('id');
  if (res.error && selectSafe) res = await client.from(table).select(selectSafe).order('id');
  if (res.error) throw new Error(`${table}: ${res.error.message}`);
  return res.data || [];
}

/* ── page-content builders (mirror the React markup/classes) ── */

const pageOpen = (eyebrow, narrow = true) =>
  `<section class="inner-page"><div class="container${narrow ? ' narrow-content' : ''}">` +
  (eyebrow ? `<span class="eyebrow">${esc(eyebrow)}</span>` : '');
const pageClose = () => `</div></section>`;

const relatedBox = (title, links) =>
  `<div class="related-box"><div><strong>${esc(title)}</strong><div class="related-links">` +
  links.map((l) => `<a href="${url(l.href)}">${esc(l.label)} ←</a>`).join('') +
  `</div></div></div>`;

const CALCULATORS = [
  { path: '/ابزارهای-هوش-مصنوعی/محاسبه-حقوق', key: 'محاسبه-حقوق' },
  { path: '/ابزارهای-هوش-مصنوعی/هزینه-استخدام', key: 'هزینه-استخدام' },
  { path: '/ابزارهای-هوش-مصنوعی/سنوات', key: 'سنوات' },
  { path: '/ابزارهای-هوش-مصنوعی/بازنشستگی', key: 'بازنشستگی' },
  { path: '/ابزارهای-هوش-مصنوعی/اضافه-کاری', key: 'اضافه-کاری' },
  { path: '/ابزارهای-هوش-مصنوعی/مالیات-مشاغل', key: 'مالیات-مشاغل' },
  { path: '/ابزارهای-هوش-مصنوعی/ارزش-افزوده', key: 'ارزش-افزوده' },
  { path: '/ابزارهای-هوش-مصنوعی/مالیات-حقوق', key: 'مالیات-حقوق' },
  { path: '/ابزارهای-هوش-مصنوعی/عیدی-و-پاداش', key: 'عیدی-و-پاداش' },
  { path: '/ابزارهای-هوش-مصنوعی/بیمه-تامین-اجتماعی', key: 'بیمه-تامین-اجتماعی' },
  { path: '/ابزارهای-هوش-مصنوعی/مرخصی', key: 'مرخصی' },
  { path: '/ابزارهای-هوش-مصنوعی/مزایای-پایان-همکاری', key: 'مزایای-پایان-همکاری' },
].map((c) => ({ ...c, title: META_TOOLS[c.key].title, description: META_TOOLS[c.key].description }));
const EXTRA_TOOLS = [
  { path: '/ابزارهای-هوش-مصنوعی/تست-سلامت', key: 'تست-سلامت' },
  { path: '/ابزارهای-هوش-مصنوعی/ساخت-قرارداد', key: 'ساخت-قرارداد' },
].map((t) => ({ ...t, title: META_TOOLS[t.key].title, description: META_TOOLS[t.key].description }));
const TOOLS_FAQS = [
  ['آیا نتایج ماشین‌حساب‌ها مبنای قانونی دارد؟', 'محاسبات بر اساس قانون کار، قانون تأمین اجتماعی و قانون مالیات‌های مستقیم و مصوبات ۱۴۰۵ است؛ ملاک نهایی، فیش رسمی سازمان‌هاست.'],
  ['پارامترهای حقوق ۱۴۰۵ از کجا می‌آید؟', 'مطابق بخشنامه سالانه شورای عالی کار؛ و از پنل مدیریت کاربان قابل به‌روزرسانی است.'],
  ['سنوات پایان خدمت چگونه محاسبه می‌شود؟', 'به ازای هر سال سابقه معادل یک ماه آخرین حقوق، مطابق ماده ۲۴ قانون کار.'],
  ['نرخ ارزش افزوده سال ۱۴۰۵ چقدر است؟', '۱۰٪؛ هر دو حالت افزودن به پایه و استخراج از داخل فاکتور محاسبه می‌شود.'],
  ['مالیات مشاغل چند درصد است؟', 'پلکانی ۱۵ تا ۳۵ درصد مطابق ماده ۱۳۱، پس از کسر معافیت سالانه.'],
];
const KNOWLEDGE_CATEGORIES = routeMeta.knowledgeCategories;

/* Mirror of src/data/law-related fallback + LawLibraryPage CATEGORY_INTRO — keep in sync */
const LAW_INTRO = {
  'همه': 'گزیده مواد پرکاربرد قانون کار، تأمین اجتماعی، مالیات‌های مستقیم و آیین‌نامه‌های اجرایی — با زبان ساده و برچسب‌های کاربردی.',
  'قانون کار': 'روابط کارفرما و کارمند: از انعقاد قرارداد و حقوق و مزایا تا مرخصی، اخراج، سنوات و حل اختلاف (قانون کار ۱۳۶۹).',
  'تأمین اجتماعی': 'بیمه، بازنشستگی، بیمه بیکاری و غرامت‌ها؛ نرخ‌ها و شرایطی که هر کارفرما و کارگر باید بداند.',
  'مالیات‌های مستقیم': 'مالیات حقوق، مشاغل و معافیت‌ها؛ پلکانی‌ها و مهلت‌هایی که جریمه‌سازند.',
  'آیین‌نامه‌ها': 'بخشنامه‌ها و آیین‌نامه‌های اجرایی: بن و مسکن، عیدی، حق بیمه، ساعت کار و ایمنی.',
};
const ARTICLE_FALLBACK_LINKS = [
  { href: '/ابزارهای-هوش-مصنوعی', label: 'ابزارهای هوش مصنوعی کاربان' },
  { href: '/قراردادها', label: 'بانک قراردادها' },
  { href: '/خدمات', label: 'خدمات تخصصی' },
];
const CATEGORY_INTRO = {
  'حقوقی و قانون کار': 'از تعریف قرارداد کار و دوره آزمایشی تا اضافه‌کاری، سنوات و تسویه‌حساب؛ مقاله‌های این دسته مواد کلیدی قانون کار را با مثال عملی و استناد دقیق توضیح می‌دهند تا پیش از امضای هر سند، حق و تکلیف دو طرف را بدانید.',
  'مالیات': 'از اظهارنامه و معافیت‌های سالانه تا ارزش افزوده و مالیات حقوق؛ این دسته مهلت‌ها، نرخ‌ها و مسیرهای قانونی را به زبان ساده مرور می‌کند تا نه جریمه بدهید و نه ریالی بیشتر از موظف بپردازید.',
  'حسابداری': 'اسناد قابل‌قبول، هزینه‌های سازمانی و کنترل‌های پایه؛ مقاله‌های حسابداری کاربان کمک می‌کند پرونده مالیاتی شما مستند و قابل دفاع باشد.',
  'منابع انسانی': 'از هزینه واقعی استخدام و آیین‌نامه انضباطی تا محرمانگی و نگهداشت نیرو؛ راهنماهای عملی برای کارفرمایانی که می‌خواهند تیم پایدار و کم‌دردسر بسازند.',
  'مدیریت': 'تصمیم‌های مدیریتی پرتکرار — از نوع همکاری و قرارداد تا تست سلامت کسب‌وکار — با نگاه حقوقی و مالی، برای رشد مطمئن‌تر.',
};

const termsItems = [
  'خدمات کاربان، ابزار و متن‌های آماده، جنبه عمومی و راهنمایی دارد و جایگزین مشاوره حقوقی موردی نمی‌شود.',
  'با ثبت سفارش، مشخصات واردشده (نام، شماره تماس) صحیح و متعلق به خود شما تلقی می‌شود.',
  'پس از پرداخت، سفارش حداکثر در یک روز کاری بررسی و با شما هماهنگ می‌شود.',
  'امکان انصراف تا پیش از شروع انجام کار، با استرداد کامل وجه وجود دارد.',
  'استفاده از خروجی‌ها صرفاً برای کسب‌وکار خود شما مجاز است؛ بازنشر عمومی ممنوع.',
  'کاربان متعهد به محرمانگی اطلاعات واردشده در فرم‌هاست.',
];
const privacySections = [
  ['۱. چه داده‌هایی جمع‌آوری می‌کنیم؟', 'تنها داده‌ای که شما در فرم‌ها وارد می‌کنید؛ مانند شماره موبایل برای دریافت فایل، نام و تماس برای سفارش خدمات.'],
  ['۲. چرا این داده‌ها را جمع می‌کنیم؟', 'برای ارائه همان خدمتی که درخواست کرده‌اید: ارسال فایل، پیگیری سفارش، پاسخ به درخواست مشاوره و اطلاع‌رسانی خبرنامه با رضایت شما.'],
  ['۳. داده‌ها کجا نگهداری می‌شوند؟', 'روی زیرساخت امن Supabase با رمزنگاری درحال‌انتقال و درحال‌سکونت؛ دسترسی مدیریتی محدود و لاگ‌برداری‌شده است.'],
  ['۴. حقوق شما', 'هر زمان می‌توانید درخواست اصلاح یا حذف داده‌هایتان را بدهید: hello@karbanapp.ir'],
  ['۵. کوکی و ابزارهای آماری', 'از Google Analytics برای آمار تجمیعی بازدید استفاده می‌کنیم؛ هیچ داده‌ای به اشخاص ثالث تجاری فروخته نمی‌شود.'],
  ['۶. تماس', 'تهران، کریمخان، خیابان سنایی، پلاک ۶۱ | تلفن: ۰۲۱-۸۸۳۴۲۶۷۹ | hello@karbanapp.ir'],
];

const calcLinksOf = (key) => calcSeo[key]?.links || [];

function calcInner(calc) {
  const key = calc.key;
  const seo = calcSeo[key];
  if (!seo) return `${pageOpen('ابزارهای هوش مصنوعی · قانون کار ۱۴۰۵')}<h1>${esc(display(calc.title))}</h1><p class="lead">${esc(calc.description)}</p>${relatedBox('صفحات مرتبط', calcLinksOf(key))}${pageClose()}`;
  const parts = [];
  parts.push(`<h1>${esc(display(calc.title))}</h1>`);
  parts.push(`<p class="lead">${esc(calc.description)}</p>`);
  parts.push(seo.about.map((p) => `<p>${inline(p)}</p>`).join(''));
  parts.push(`<h2>روش محاسبه</h2><ul>${seo.how.map((s) => `<li>${inline(s)}</li>`).join('')}</ul>`);
  parts.push(`<h2>مثال عملی</h2>${seo.example.map((p) => `<p>${inline(p)}</p>`).join('')}`);
  parts.push(`<div class="legal-box"><h2>مبنای قانونی</h2><ul>${seo.laws.map((n) => `<li>${inline(n)}</li>`).join('')}</ul><p class="muted-note">پارامترها مطابق مقررات ۱۴۰۵ است و با هر مصوبه جدید به‌روزرسانی می‌شود.</p></div>`);
  parts.push(`<div class="faq-section"><h2>پرسش‌های پرتکرار</h2>${seo.faqs.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${inline(a)}</p></details>`).join('')}</div>`);
  parts.push(relatedBox('لینک‌های مرتبط', seo.links));
  return `${pageOpen('ابزارهای هوش مصنوعی · قانون کار ۱۴۰۵')}${parts.join('')}${pageClose()}`;
}

/* main */
async function main() {
  const distDir = resolve(process.cwd(), 'dist');
  const template = await readFile(resolve(distDir, 'index.html'), 'utf8');
  let count = 0;
  const manifestRoutes = new Set();
  const write = async (path, html) => {
    await writeRoute(distDir, html, path);
    manifestRoutes.add(path);
    count++;
  };

  /* 1) HOME */
  {
    const inner =
      `${shell('/', null)}` +
      `${pageOpen(null, false)}` +
      `<h1>رشد مطمئن کسب‌وکار شما با کاربان</h1>` +
      `<p class="lead">کاربان پلتفرم هوشمند مدیریت کسب‌وکار است: بانک قرارداد تخصصی به تفکیک صنف، ماشین‌حساب‌های دقیق حقوق و مالیات مطابق مقررات ۱۴۰۵، و دانشنامه‌ای که قانون را به زبان آدم‌ها ترجمه می‌کند.</p>` +
      `<div class="category-grid">` +
      [['/کارفرما', 'کارفرما هستم', 'قرارداد، استخدام، حقوق و دستمزد'], ['/کارمند', 'کارگر/کارمند هستم', 'درک قرارداد، حقوق، قانون کار'], ['/فریلنسر', 'فریلنسر هستم', 'قرارداد همکاری، پروژه، مالیات']]
        .map(([h, t, d]) => `<a href="${url(h)}" class="category-card"><h2>${esc(t)}</h2><p>${esc(d)}</p></a>`).join('') +
      `</div>` +
      relatedBox('دسترسی سریع', [
        { href: '/قراردادها', label: 'بانک قراردادها (۹۰+ نمونه)' },
        { href: '/ابزارهای-هوش-مصنوعی', label: 'ماشین‌حساب‌های حقوق و مالیات' },
        { href: '/دانشنامه', label: 'دانشنامه حقوق کار' },
        { href: '/درخواست‌های-اداری', label: 'درخواست‌های اداری آماده' },
        { href: '/خدمات', label: 'خدمات تخصصی' },
      ]) +
      `${pageClose()}`;
    await write('/', transformHtml(template, { title: META_HOME.title, description: META_HOME.description, path: '/', inner }));
  }

  /* 2) calculators + extra tools */
  for (const calc of CALCULATORS) {
    const key = calc.key;
    const seo = calcSeo[key];
    const ld = [
      webAppLd(calc.title, calc.description, calc.path),
      breadcrumbLd([{ name: 'خانه', href: '/' }, { name: 'ابزارهای هوش مصنوعی', href: '/ابزارهای-هوش-مصنوعی' }, { name: display(calc.title), path: calc.path }]),
      ...(seo?.faqs?.length ? [faqLd(seo.faqs)] : []),
    ];
    await write(calc.path, transformHtml(template, { title: calc.title, description: calc.description, image: ogFor('/ابزارهای-هوش-مصنوعی'), path: calc.path, jsonLd: ld, inner: shell(calc.path, [{ name: 'ابزارهای هوش مصنوعی', href: '/ابزارهای-هوش-مصنوعی' }, { name: display(calc.title), path: calc.path }]) + calcInner(calc) }));
  }
  for (const t of EXTRA_TOOLS) {
    const inner =
      `${shell(t.path, [{ name: 'ابزارهای هوش مصنوعی', href: '/ابزارهای-هوش-مصنوعی' }, { name: display(t.title), path: t.path }])}` +
      `${pageOpen('ابزارهای هوش مصنوعی')}<h1>${esc(display(t.title))}</h1><p class="lead">${esc(t.description)}</p>` +
      relatedBox('صفحات مرتبط', [{ href: '/ابزارهای-هوش-مصنوعی', label: 'همه ابزارها' }, { href: '/قراردادها', label: 'بانک قراردادها' }, { href: '/دانشنامه', label: 'دانشنامه' }]) +
      `${pageClose()}`;
    await write(t.path, transformHtml(template, { title: t.title, description: t.description, image: ogFor('/ابزارهای-هوش-مصنوعی'), path: t.path, jsonLd: [breadcrumbLd([{ name: 'خانه', href: '/' }, { name: 'ابزارهای هوش مصنوعی', href: '/ابزارهای-هوش-مصنوعی' }, { name: display(t.title), path: t.path }])], inner }));
  }

  /* 3) tools hub — visible FAQ mirrors faqJsonLd in App.tsx */
  {
    const inner =
      `${shell('/ابزارهای-هوش-مصنوعی', [{ name: 'ابزارهای هوش مصنوعی', path: '/ابزارهای-هوش-مصنوعی' }])}` +
      `${pageOpen('ابزارهای هوش مصنوعی', false)}` +
      `<h1>ابزارهای هوش مصنوعی کاربان</h1>` +
      `<p class="lead">ماشین‌حساب آنلاین حقوق و دستمزد، سنوات، بازنشستگی، هزینه استخدام، اضافه‌کاری و مالیات مطابق مقررات ۱۴۰۵.</p>` +
      `<div class="tool-grid">` +
      [...CALCULATORS, ...EXTRA_TOOLS].map((t) => `<a class="tool-card" href="${url(t.path)}"><h3>${esc(t.title)}</h3><p>${esc(t.description)}</p><span>ورود به ابزار ←</span></a>`).join('') +
      `</div>` +
      `<div class="faq-section"><h2>پرسش‌های پرتکرار</h2>${TOOLS_FAQS.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>` +
      `${pageClose()}`;
    await write('/ابزارهای-هوش-مصنوعی', transformHtml(template, {
      title: META_ROUTES['/ابزارهای-هوش-مصنوعی'].title,
      description: META_ROUTES['/ابزارهای-هوش-مصنوعی'].description,
      image: META_ROUTES['/ابزارهای-هوش-مصنوعی'].image,
      path: '/ابزارهای-هوش-مصنوعی',
      jsonLd: [faqLd(TOOLS_FAQS), breadcrumbLd([{ name: 'خانه', href: '/' }, { name: 'ابزارهای هوش مصنوعی', path: '/ابزارهای-هوش-مصنوعی' }])],
      inner,
    }));
  }

  /* 4) static pages */
  {
    const aboutInner = `${shell('/درباره-ما', [{ name: 'درباره ما', path: '/درباره-ما' }])}${pageOpen('درباره ما')}<h1>درباره کاربان</h1><p class="article-intro">کاربان پلتفرم هوشمند قرارداد و همراه حقوق کار است: بانک قرارداد تخصصی به تفکیک صنف، ماشین‌حساب‌های دقیق مطابق مقررات ۱۴۰۵، و دانشنامه کاربردی برای کارفرمایان، کارمندان و فریلنسرها. کاربان؛ از قرارداد تا آرامش.</p>${pageClose()}`;
    await write('/درباره-ما', transformHtml(template, { title: META_ROUTES['/درباره-ما'].title, description: META_ROUTES['/درباره-ما'].description, path: '/درباره-ما', jsonLd: [breadcrumbLd([{ name: 'خانه', href: '/' }, { name: 'درباره ما', path: '/درباره-ما' }])], inner: aboutInner }));

    const contactInner = `${shell('/تماس-با-ما', [{ name: 'تماس با ما', path: '/تماس-با-ما' }])}${pageOpen('تماس با ما')}<h1>تماس با کاربان</h1><div class="contact-card"><p>تهران، خیابان کریمخان، خیابان سنایی، پلاک ۶۱، طبقه سوم</p><p>تلفن گویا: ۰۲۱-۸۸۳۴۲۶۷۹</p><p>شنبه تا چهارشنبه ۹ تا ۱۷</p><p>hello@karbanapp.ir</p></div>${pageClose()}`;
    await write('/تماس-با-ما', transformHtml(template, { title: META_ROUTES['/تماس-با-ما'].title, description: META_ROUTES['/تماس-با-ما'].description, path: '/تماس-با-ما', jsonLd: [breadcrumbLd([{ name: 'خانه', href: '/' }, { name: 'تماس با ما', path: '/تماس-با-ما' }])], inner: contactInner }));

    const termsInner = `${shell('/قوانین', [{ name: 'قوانین', path: '/قوانین' }])}${pageOpen(null)}<h1>قوانین و شرایط استفاده از کاربان</h1><p class="lead">شرایط شفاف استفاده از خدمات و ابزارهای کاربان؛ پیش از ثبت سفارش بخوانید.</p><ul>${termsItems.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>${pageClose()}`;
    await write('/قوانین', transformHtml(template, { title: META_ROUTES['/قوانین'].title, description: META_ROUTES['/قوانین'].description, path: '/قوانین', jsonLd: [breadcrumbLd([{ name: 'خانه', href: '/' }, { name: 'قوانین', path: '/قوانین' }])], inner: termsInner }));

    const privacyInner = `${shell('/حریم-خصوصی', [{ name: 'حریم خصوصی', path: '/حریم-خصوصی' }])}${pageOpen(null)}<h1>سیاست حریم خصوصی کاربان</h1><p class="lead">در کاربان فقط داده‌ای که خودتان وارد می‌کنید ذخیره می‌شود و فقط برای همان خدمت استفاده می‌شود.</p>${privacySections.map(([t, d]) => `<h2>${esc(t)}</h2><p>${esc(d)}</p>`).join('')}${pageClose()}`;
    await write('/حریم-خصوصی', transformHtml(template, { title: META_ROUTES['/حریم-خصوصی'].title, description: META_ROUTES['/حریم-خصوصی'].description, path: '/حریم-خصوصی', jsonLd: [breadcrumbLd([{ name: 'خانه', href: '/' }, { name: 'حریم خصوصی', path: '/حریم-خصوصی' }])], inner: privacyInner }));

    const invoiceMakerInner = `${shell('/فاکتورساز', [{ name: 'فاکتورساز', path: '/فاکتورساز' }])}${pageOpen('فاکتورساز', false)}<h1>فاکتورساز آنلاین</h1><p class="lead">فاکتور فروش ساده را آنلاین بساز؛ محاسبه خودکار تخفیف و ۱۰٪ ارزش افزوده، خروجی چاپ و PDF با لوگوی کاربان، اکسل و ورد — بدون ثبت‌نام. برای فاکتور رسمی مالیاتی، حسابداری هوشمند کاربان را ببینید.</p>${pageClose()}`;
    await write('/فاکتورساز', transformHtml(template, { title: META_ROUTES['/فاکتورساز'].title, description: META_ROUTES['/فاکتورساز'].description, path: '/فاکتورساز', jsonLd: [breadcrumbLd([{ name: 'خانه', href: '/' }, { name: 'فاکتورساز', path: '/فاکتورساز' }])], inner: invoiceMakerInner }));
  }
  console.log(`prerender: static + tools sections done (${count} so far).`);

  /* 5) Supabase-driven routes — best effort */
  try {
    const knowledgeInner = (articlesByCat) =>
      `${shell('/دانشنامه', [{ name: 'دانشنامه', path: '/دانشنامه' }])}` +
      `${pageOpen('دانشنامه', false)}` +
      `<h1>دانشنامه حقوقی و مالیاتی کسب‌وکار</h1>` +
      `<p class="lead">مقالات کاربردی حقوق کار، بیمه و مالیات به زبان ساده و با استناد به مواد قانونی.</p>` +
      `<div class="category-grid">` +
      KNOWLEDGE_CATEGORIES.map((c) => `<a href="${url(categoryPath(c))}" class="category-card"><h2>${esc(c)}</h2><p>${esc(CATEGORY_INTRO[c].slice(0, 80))}…</p></a>`).join('') +
      `</div>` +
      relatedBox('پرمخاطب‌های کاربان', [{ href: '/قراردادها', label: 'بانک قراردادها' }, { href: '/ابزارهای-هوش-مصنوعی', label: 'ماشین‌حساب‌ها' }, { href: '/درخواست‌های-اداری', label: 'درخواست‌های اداری' }]) +
      `${pageClose()}`;

    await write('/دانشنامه', transformHtml(template, {
      title: META_ROUTES['/دانشنامه'].title,
      description: META_ROUTES['/دانشنامه'].description,
      image: META_ROUTES['/دانشنامه'].image,
      path: '/دانشنامه',
      jsonLd: [breadcrumbLd([{ name: 'خانه', href: '/' }, { name: 'دانشنامه', path: '/دانشنامه' }])],
      inner: knowledgeInner(),
    }));

    let articles = [];
    try {
      articles = await supabaseFetch(
        'articles',
        'id,category,title,intro,author,body,meta_title,meta_description,created_at,updated_at',
        'id,category,title,intro,author,body,meta_title,meta_description,created_at',
      );
    } catch (e) {
      console.warn(`prerender: articles fetch failed (${String(e).slice(0, 100)})`);
    }

    /* category pages — URL اسلاگ (استاندارد) + URL عددی قدیمی به‌عنوان کپی با canonical اسلاگ */
    for (let i = 0; i < KNOWLEDGE_CATEGORIES.length; i++) {
      const cat = KNOWLEDGE_CATEGORIES[i];
      const catPath = categoryPath(cat); /* اسلاگ = استاندارد */
      const legacyPath = `/دانشنامه/${i + 1}`;
      const items = articles.filter((a) => a.category === cat);
      const crumb = [{ name: 'خانه', href: '/' }, { name: 'دانشنامه', href: '/دانشنامه' }, { name: cat, path: catPath }];
      const inner =
        `${shell(catPath, crumb.slice(1))}` +
        `${pageOpen('دانشنامه')}<h1>${esc(cat)}</h1><p class="lead">مقاله‌های تخصصی این دسته، نوشته‌شده با استناد به مواد قانونی.</p><p class="category-intro">${esc(CATEGORY_INTRO[cat])}</p>` +
        `<div class="article-list">` +
        items.map((a) => `<a class="article-list-item" href="${url(articleSlugPath(a.title, a.id))}"><div><h2>${esc(a.title)}</h2><p>${esc(a.intro || '')}</p><small>${esc(a.author || 'کاربان')}</small></div></a>`).join('') +
        (items.length === 0 ? '<p>به‌زودی مقاله‌های این دسته منتشر می‌شود.</p>' : '') +
        `</div>${pageClose()}`;
      const catMeta = {
        title: `مقالات ${cat} | دانشنامه کاربان`,
        description: `مقاله‌های تخصصی ${cat} برای کسب‌وکارها، با استناد به مواد قانونی.`,
        image: META_ROUTES['/دانشنامه'].image,
        jsonLd: [
          breadcrumbLd(crumb),
          ...(items.length ? [itemListLd(items.map((a) => ({ name: a.title, href: articleSlugPath(a.title, a.id) })))] : []),
        ],
        inner,
      };
      await write(catPath, transformHtml(template, { ...catMeta, path: catPath }));
      /* URL عددی قدیمی: همان محتوا، canonical → اسلاگ (تا لینک‌های ایندکس‌شده قبلی بی‌هاینف نمانند) */
      await write(legacyPath, transformHtml(template, { ...catMeta, path: catPath, inner }));
    }

    /* article detail pages — URL اسلاگ استاندارد + کپی عددی قدیمی با canonical اسلاگ */
    const faDate = (v) => {
      try { return new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(v)); } catch { return ''; }
    };
    for (const a of articles) {
      const path = articleSlugPath(a.title, a.id); /* اسلاگ = استاندارد */
      const legacyPath = `/دانشنامه/مقاله/${a.id}`;
      const title = a.meta_title || `${a.title} | کاربان`;
      const description = a.meta_description || a.intro || title;
      const catIndex = KNOWLEDGE_CATEGORIES.indexOf(a.category) + 1;
      const modified = a.updated_at || a.created_at || null;
      const faqs = parseFaqs(a.body);
      const metaLine = `<div class="article-meta"><small class="article-author">${esc(a.author || 'تیم کاربان')}</small>${modified ? `<small class="article-updated">آخرین به‌روزرسانی: ${esc(faDate(modified))}</small>` : ''}<small class="article-source">منبع: مواد قانونی ذکرشده در متن (قانون کار، تأمین اجتماعی، مالیات‌های مستقیم)</small></div>`;
      const inner =
        `${shell(path, [{ name: 'دانشنامه', href: '/دانشنامه' }, ...(catIndex ? [{ name: a.category, href: categoryPath(a.category) }] : []), { name: a.title, path }])}` +
        `${pageOpen(a.category)}<h1>${esc(a.title)}</h1><p class="article-intro">${esc(a.intro || '')}</p>${metaLine}` +
        `<div class="article-body">${richTextToHtml(a.body)}</div>` +
        relatedBox('ابزارها و صفحات مرتبط', articleRelatedMap[a.category] || ARTICLE_FALLBACK_LINKS) +
        `<a class="button" href="${url('/دانشنامه')}">بازگشت به دانشنامه</a>${pageClose()}`;
      const ld = [
        articleLd({ title: a.title, description, path, author: a.author, published: a.created_at, modified: a.updated_at }),
        breadcrumbLd([{ name: 'خانه', href: '/' }, { name: 'دانشنامه', href: '/دانشنامه' }, ...(catIndex ? [{ name: a.category, href: categoryPath(a.category) }] : []), { name: a.title, path }]),
        ...(faqs.length ? [faqLd(faqs)] : []),
      ];
      const articleMeta = { title, description, path, ogType: 'article', jsonLd: ld, inner, published: a.created_at, modified: a.updated_at, image: META_ROUTES['/دانشنامه'].image };
      await write(path, transformHtml(template, articleMeta));
      /* URL عددی قدیمی: همان محتوا با canonical → اسلاگ */
      await write(legacyPath, transformHtml(template, { ...articleMeta, path }));
    }
    console.log(`prerender: knowledge done (${articles.length} articles, ${count} total).`);
  } catch (e) {
    console.warn(`prerender: knowledge skipped (${String(e).slice(0, 120)})`);
  }

  /* 6) Contracts — hub with full crawlable list + detail pages with full body */
  try {
    const contracts = (await supabaseFetch(
      'contracts',
      'id,title,type,industry,summary,body,pdf_url,created_at,updated_at,is_published',
      'id,title,type,industry,summary,body,pdf_url,created_at',
    )).filter((c) => c.is_published !== false); /* هماهنگ با sitemap: فقط منتشرشده‌ها */

    const hubInner =
      `${shell('/قراردادها', [{ name: 'قراردادها', path: '/قراردادها' }])}` +
      `${pageOpen('قراردادها', false)}` +
      `<h1>بانک قراردادهای کاربان — دانلود نمونه قرارداد آماده</h1>` +
      `<p class="lead">بیش از ۹۰ نمونه قرارداد استاندارد در ۵ نوع و اصناف مختلف؛ دانلود رایگان با موبایل، نسخه تخصصی صنف یا نگارش اختصاصی.</p>` +
      `<div class="contract-grid">` +
      contracts.map((c) =>
        `<article class="contract-card"><div class="contract-card-top"><div><small>${esc(c.industry || '')}</small><h2>${esc(c.title)}</h2><p>${esc(c.summary || '')}</p></div></div>` +
        `<div class="contract-tiers"><span>عمومی <b>رایگان</b></span><span>تخصصی <b>قیمت ثابت</b></span><span>اختصاصی <b>متخصص</b></span></div>` +
        `<a class="button button-small" href="${url(`/قراردادها/${c.id}`)}">مشاهده ←</a></article>`).join('') +
      `</div>${pageClose()}`;
    await write('/قراردادها', transformHtml(template, {
      title: META_ROUTES['/قراردادها'].title,
      description: META_ROUTES['/قراردادها'].description,
      image: META_ROUTES['/قراردادها'].image,
      path: '/قراردادها',
      jsonLd: [
        breadcrumbLd([{ name: 'خانه', href: '/' }, { name: 'قراردادها', path: '/قراردادها' }]),
        itemListLd(contracts.slice(0, 100).map((c) => ({ name: c.title, href: `/قراردادها/${c.id}` }))),
      ],
      inner: hubInner,
    }));
    console.log(`prerender: contracts hub done (${count} total).`);

    for (const c of contracts) {
      const path = `/قراردادها/${c.id}`;
      const title = `${String(c.title).trim()} | کاربان`;
      const summary = String(c.summary || '').trim();
      const description = summary.length >= 60
        ? summary
        : `متن کامل «${String(c.title).trim()}» با بندهای استاندارد و دانلود رایگان PDF${c.industry ? ` — نسخهٔ مناسب صنف «${c.industry}»` : ''} مطابق مقررات جاری ایران.`;
      const inner =
        `${shell(path, [{ name: 'قراردادها', href: '/قراردادها' }, { name: c.title, path }])}` +
        `${pageOpen('قراردادهای کاربان')}<h1>${esc(String(c.title).trim())}</h1><p class="article-intro">${esc(summary || description)}</p>` +
        (c.body ? `<div class="article-body"><div class="contract-body" style="white-space:pre-wrap;line-height:2">${esc(c.body)}</div></div>` : `<div class="article-body"><p>این قرارداد به‌صورت تخصصی برای صنف «${esc(c.industry || 'عمومی')}» آماده شده است؛ برای دریافت نسخه کامل، از بخش دانلود استفاده کنید.</p></div>`) +
        relatedBox('صفحات مرتبط', contractRelatedMap[c.type] || contractRelatedMap['_default']) +
        `<a class="button" href="${url('/قراردادها')}">بازگشت به فهرست</a>${pageClose()}`;
      const ld = [
        articleLd({ title: String(c.title).trim(), description, path, author: 'کاربان', published: c.created_at, modified: c.updated_at }),
        breadcrumbLd([{ name: 'خانه', href: '/' }, { name: 'قراردادها', href: '/قراردادها' }, { name: String(c.title).trim(), path }]),
      ];
      if (c.type || c.industry) ld[0].about = [c.type, c.industry].filter(Boolean).map((n) => ({ '@type': 'Thing', name: n }));
      await write(path, transformHtml(template, { title, description, path, ogType: 'article', jsonLd: ld, inner, published: c.created_at, modified: c.updated_at, image: META_ROUTES['/قراردادها'].image }));
    }
    console.log(`prerender: contracts done (${contracts.length}, ${count} total).`);
  } catch (e) {
    console.warn(`prerender: contracts skipped (${String(e).slice(0, 120)})`);
  }

  /* 7) Services page — mirror ServicesPage markup */
  try {
    const services = await supabaseFetch(
      'services',
      'id,title,price,description,domain,unit,featured,kind,discount_percent',
      'id,title,price,description,domain,unit,featured,kind',
    );
    const consultation = services.filter((s) => !s.kind);
    const groups = [
      ['مشاوره روابط کار', consultation.filter((s) => s.domain === 'labor')],
      ['مشاوره مالی، مالیاتی و حسابرسی', consultation.filter((s) => s.domain === 'financial')],
      ['خدمات قراردادی', services.filter((s) => s.kind)],
    ];
    const card = (s) => {
      const d = s.discount_percent || 0;
      const base = String(s.price || '');
      const priceHtml = d > 0
        ? `<del>${esc(base)}</del> <strong>${esc(base)}</strong>`
        : `<strong>${esc(base)}</strong>`;
      return `<a class="plan-card plan-link ${s.featured ? 'plan-featured' : ''}" href="${url(`/سفارش/${s.id}`)}"><h2>${esc(s.title)}</h2><p>${esc(s.description || '')}</p>${priceHtml}<small>${esc(s.unit || '')}</small><span class="plan-cta">ثبت سفارش ←</span></a>`;
    };
    const inner =
      `${shell('/خدمات', [{ name: 'خدمات', path: '/خدمات' }])}` +
      `${pageOpen('خدمات تخصصی کاربان', false)}` +
      `<div class="narrow-content"><h1>خدمات قراردادی و تخصصی</h1><p class="lead">روی هر خدمت بزنید تا توضیح کامل را ببینید و همان‌جا سفارش بدهید.</p></div>` +
      `<section><h2>نرم‌افزار حسابداری هوشمند کاربان</h2><div class="plans-grid"><a class="plan-card plan-featured" href="${url('/حسابداری')}"><span class="plan-badge">تازه در کاربان</span><h2>حسابداری هوشمند کاربان — فاکتور رسمی مطابق قوانین مالیاتی</h2><p>صدور فاکتور رسمی با ساختار صورتحساب الکترونیکی مودیان، دفترخانه خودکار، گزارش ارزش افزوده و معاملات فصلی ماده ۱۶۹، لوگو و امضای اختصاصی شرکت. نسخه آزمایشی ۱۴ روزه رایگان.</p><span class="plan-cta">شروع رایگان / مشاهده پلن‌ها ←</span></a></div></section>` +
      groups.filter(([, items]) => items.length).map(([t, items]) => `<section><h2>${esc(t)}</h2><div class="plans-grid">${items.map(card).join('')}</div></section>`).join('') +
      `<div class="guarantee"><span><strong>پیش از هر سفارش،</strong> قوانین و شرایط کاربان را در صفحه «قوانین» بخوانید؛ شفافیت، اصل اول ماست.</span></div>` +
      relatedBox('صفحات مرتبط', [
        { href: '/قراردادها', label: 'بانک قراردادها' },
        { href: '/ابزارهای-هوش-مصنوعی/ساخت-قرارداد', label: 'ساخت قرارداد هوشمند' },
        { href: '/دانشنامه', label: 'دانشنامه حقوقی' },
      ]) +
      `${pageClose()}`;
    await write('/خدمات', transformHtml(template, {
      title: META_ROUTES['/خدمات'].title,
      description: META_ROUTES['/خدمات'].description,
      image: META_ROUTES['/خدمات'].image,
      path: '/خدمات',
      jsonLd: [
        breadcrumbLd([{ name: 'خانه', href: '/' }, { name: 'خدمات', path: '/خدمات' }]),
        {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'خدمات تخصصی کاربان',
          itemListElement: services.map((s, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            item: {
              '@type': 'Service',
              name: s.title,
              description: s.description || '',
              url: url(`/سفارش/${s.id}`),
              provider: { '@type': 'Organization', '@id': `${ORIGIN}/#organization`, name: 'کاربان' },
            },
          })),
        },
      ],
      inner,
    }));
  } catch (e) {
    console.warn(`prerender: services skipped (${String(e).slice(0, 120)})`);
  }

  /* 7.5) Accounting landing — نرم‌افزار حسابداری هوشمند کاربان */
  try {
    const accFeatures = [
      ['صدور فاکتور رسمی', 'فاکتور فروش، پیش‌فاکتور، خرید و برگشت از فروش با شماره‌گذاری خودکار سالانه و مبلغ به حروف.'],
      ['خروجی استاندارد مودیان', 'چاپ و PDF با ساختار و ظاهر صورتحساب الکترونیکی سازمان امور مالیاتی.'],
      ['دفترخانه خودکار', 'هر سند، قید دوطرفه در دفتر روزنامه؛ دفتر کل و تراز آزمایشی بدون دانش حسابداری.'],
      ['گزارش مالیاتی دقیق', 'اظهارنامه ارزش افزوده دوره، صورت معاملات فصلی ماده ۱۶۹ با خروجی Excel و نرخ مصوب ۱۴۰۵.'],
      ['لوگو، امضا و مهر', 'آپلود لوگوی شرکت، امضای مجاز و مهر؛ فاکتور کاملاً شخصی‌سازی‌شده با برند خودتان.'],
      ['مشتریان و بدهی‌ها', 'پرونده کامل طرف‌حساب‌ها با کد ملی و شماره اقتصادی؛ پیگیری مانده و تسویه هر مشتری.'],
      ['نقدینگی و هزینه', 'بانک، صندوق، دریافت و پرداخت با مانده زنده؛ ثبت هزینه با اعتبار مالیاتی ارزش افزوده.'],
      ['دسترسی کنترل‌شده', 'دعوت حسابدار با نقش محدود، ثبت امن در دیتابیس ابری و گزارش کامل عملکرد مالی.'],
    ];
    const accPlans = [
      ['نسخه آزمایشی', 'رایگان', '۱۴ روز کامل، بدون نیاز به کارت', ['تمام امکانات نسخه کامل', 'تا ۲۰ صورتحساب', 'بدون تعهد خرید']],
      ['اشتراک ماهانه', '۲۹۰٬۰۰۰', 'تومان در ماه', ['صورتحساب نامحدود', 'دفترخانه و گزارش‌های کامل', 'لوگو، امضا و مهر اختصاصی', 'دعوت حسابدار']],
      ['اشتراک سالانه', '۲٬۹۰۰٬۰۰۰', 'تومان در سال — ۲ ماه هدیه', ['همه امکانات پلن ماهانه', '۲ ماه رایگان', 'اولویت پشتیبانی']],
    ];
    const accFaq = [
      ['فاکتورهای این سیستم از نظر مالیاتی معتبرند؟', 'سیستم فاکتور را دقیقاً با ساختار و ظاهر صورتحساب الکترونیکی سازمان امور مالیاتی صادر می‌کند و اطلاعات رسمی (شناسه ملی، شماره اقتصادی، کد پستی) را استاندارد نگه می‌دارد؛ اتصال مستقیم به سامانه مودیان در نقشه راه نسخه بعدی است.'],
      ['برای استفاده باید حسابداری بلد باشم؟', 'خیر. شما فقط فاکتور بزنید و هزینه و دریافتی‌ها را ثبت کنید؛ قیدهای دوطرفه، دفتر روزنامه، دفتر کل، تراز آزمایشی و گزارش سود و زیان به‌صورت خودکار ساخته می‌شود.'],
      ['داده‌های مالی من کجا ذخیره می‌شود؟', 'روی زیرساخت ابری Supabase با قوانین دسترسی سطح ردیف (RLS)؛ هیچ کاربر دیگری به کسب‌وکار شما دسترسی ندارد و تنها حساب‌هایی که خودتان مجاز می‌کنید وارد می‌شوند.'],
      ['نرخ مالیات ارزش افزوده چقدر است؟', 'نرخ مصوب سال ۱۴۰۵ برای عموم کالاها و خدمات ۱۰ درصد است؛ کالاهای معاف یا با نرخ خاص به‌تفکیک قابل تنظیم‌اند.'],
    ];
    const accInner =
      `${shell('/حسابداری', [{ name: 'حسابداری', path: '/حسابداری' }])}` +
      `<section class="acc-landing-hero"><div class="container acc-landing-grid"><div>` +
      `<h1>نرم‌افزار حسابداری هوشمند کاربان</h1>` +
      `<p class="lead">حسابداری کامل و دقیق بر اساس قوانین سازمان امور مالیاتی ایران — به سادگی چند کلیک. فاکتور رسمی با ظاهر استاندارد مودیان بزنید، دفترخانه و گزارش‌ها را خودکار بگیرید و با لوگو و امضای اختصاصی، برند خودتان را روی اسناد بگذارید.</p>` +
      `<a class="button button-green" href="${url('/حسابداری/پنل')}">شروع رایگان ۱۴ روزه</a> <a class="button" href="#acc-plans">مشاهده پلن‌ها</a>` +
      `</div><div class="acc-landing-mock">` +
      [['فروش این ماه', '۴۸٬۲۰۰٬۰۰۰ ریال'], ['دریافتی این ماه', '۳۹٬۵۰۰٬۰۰۰ ریال'], ['مطالبات از مشتریان', '۱۲٬۷۰۰٬۰۰۰ ریال'], ['مالیات ارزش افزوده دوره', '۴٬۸۲۰٬۰۰۰ ریال'], ['سود خالص فصل', '۹٬۱۴۰٬۰۰۰ ریال']]
        .map(([k, v]) => `<div class="mock-row"><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join('') +
      `</div></div></section>` +
      `<section style="background: var(--bg2)"><div class="container acc-features">` +
      accFeatures.map(([t, d]) => `<div class="acc-feature"><h3>${esc(t)}</h3><p>${esc(d)}</p></div>`).join('') +
      `</div></section>` +
      `<section id="acc-plans" style="padding-top: 3.5rem"><div class="container"><div class="lux-heading"><span class="line"></span><h2>پلن‌های اشتراک</h2><span class="line"></span></div><div class="acc-plans">` +
      accPlans.map(([n, price, note, items], i) =>
        `<div class="acc-plan${i === 1 ? ' is-featured' : ''}">${i === 1 ? '<span class="plan-tag">پیشنهاد کاربان</span>' : ''}<h3>${esc(n)}</h3><div class="price">${esc(price)}</div><div class="price-note">${esc(note)}</div><ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul><a class="button button-green full-button" href="${url('/حسابداری/پنل')}">${i === 0 ? 'شروع رایگان' : 'خرید اشتراک'}</a></div>`
      ).join('') +
      `</div></div></section>` +
      `<section><div class="container"><div class="lux-heading"><span class="line"></span><h2>سوالات متداول</h2><span class="line"></span></div><div class="acc-faq">` +
      accFaq.map(([q, a]) => `<div class="acc-faq-item"><h3>${esc(q)}</h3><p>${esc(a)}</p></div>`).join('') +
      `</div></div></section>` +
      `${pageClose()}`;
    await write('/حسابداری', transformHtml(template, {
      title: META_ROUTES['/حسابداری'].title,
      description: META_ROUTES['/حسابداری'].description,
      image: META_ROUTES['/حسابداری'].image,
      path: '/حسابداری',
      jsonLd: [
        breadcrumbLd([{ name: 'خانه', href: `${ORIGIN}/` }, { name: 'حسابداری', path: '/حسابداری' }]),
        {
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'نرم‌افزار حسابداری هوشمند کاربان',
          applicationCategory: 'FinanceApplication',
          operatingSystem: 'Web',
          inLanguage: 'fa-IR',
          url: url('/حسابداری'),
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'IRR' },
          publisher: { '@id': `${ORIGIN}/#organization` },
        },
      ],
      inner: accInner,
    }));
  } catch (e) {
    console.warn(`prerender: accounting landing skipped (${String(e).slice(0, 120)})`);
  }

  /* 8) Administrative requests — hub + detail pages */
  try {
    const requests = await supabaseFetch('admin_requests', 'id,category,title,intro,body');

    const hubInner =
      `${shell('/درخواست‌های-اداری', [{ name: 'درخواست‌های اداری', path: '/درخواست‌های-اداری' }])}` +
      `${pageOpen('ابزارهای اداری', false)}` +
      `<h1>درخواست‌های اداری آماده</h1>` +
      `<p class="lead">متن رسمی و آماده برای درخواست‌های پرتکرار؛ مشاهده کن، کپی بگیر یا PDF برنددار دانلود کن، جاهای خالی را پر کن و امضا کن.</p>` +
      `<div class="contract-grid">` +
      requests.map((r) =>
        `<article class="contract-card"><div class="contract-card-top"><div><small>${esc(r.category || '')}</small><h2>${esc(r.title)}</h2><p>${esc(r.intro || '')}</p></div></div>` +
        `<a class="button button-small" href="${url(`/درخواست‌های-اداری/${r.id}`)}">مشاهده و دانلود ←</a></article>`).join('') +
      `</div>` +
      relatedBox('ابزارهای مرتبط کاربان', [{ href: '/قراردادها', label: 'بانک قراردادها' }, { href: '/دانشنامه', label: 'دانشنامه حقوقی' }, { href: '/ابزارهای-هوش-مصنوعی', label: 'ماشین‌حساب‌ها' }]) +
      `${pageClose()}`;
    await write('/درخواست‌های-اداری', transformHtml(template, {
      title: META_ROUTES['/درخواست‌های-اداری'].title,
      description: META_ROUTES['/درخواست‌های-اداری'].description,
      image: META_ROUTES['/درخواست‌های-اداری'].image,
      path: '/درخواست‌های-اداری',
      jsonLd: [
        breadcrumbLd([{ name: 'خانه', href: '/' }, { name: 'درخواست‌های اداری', path: '/درخواست‌های-اداری' }]),
        itemListLd(requests.map((r) => ({ name: r.title, href: `/درخواست‌های-اداری/${r.id}` }))),
      ],
      inner: hubInner,
    }));

    for (const r of requests) {
      const path = `/درخواست‌های-اداری/${r.id}`;
      const title = `${r.title} | کاربان`;
      const description = r.intro || `متن رسمی و آماده «${r.title}»؛ کپی کنید یا PDF برنددار دانلود بگیرید.`;
      const inner =
        `${shell(path, [{ name: 'درخواست‌های اداری', href: '/درخواست‌های-اداری' }, { name: r.title, path }])}` +
        `${pageOpen(r.category)}<h1>${esc(r.title)}</h1><p class="article-intro">${esc(r.intro || '')}</p>` +
        `<div class="contract-body" style="white-space:pre-wrap;line-height:2">${esc(r.body || '')}</div>` +
        `<a class="button" href="${url('/درخواست‌های-اداری')}">بازگشت به فهرست</a>${pageClose()}`;
      await write(path, transformHtml(template, {
        title, description, path, ogType: 'article',
        jsonLd: [
          breadcrumbLd([{ name: 'خانه', href: '/' }, { name: 'درخواست‌های اداری', href: '/درخواست‌های-اداری' }, { name: r.title, path }]),
          { '@context': 'https://schema.org', '@type': 'WebPage', name: r.title, description, inLanguage: 'fa-IR', mainEntityOfPage: url(path), isPartOf: { '@id': `${ORIGIN}/#website` } },
        ],
        inner,
      }));
    }
    console.log(`prerender: requests done (${requests.length}, ${count} total).`);
  } catch (e) {
    console.warn(`prerender: requests skipped (${String(e).slice(0, 120)})`);
  }

  /* 8) چک‌لیست‌های طلایی — هاب + ۵ صفحه کامل */
  {
    const cl = checklists;
    const crumb = [{ name: 'خانه', href: '/' }, { name: 'چک‌لیست‌های طلایی', path: '/چک-لیست‌ها' }];
    const inner =
      `${shell('/چک-لیست‌ها', crumb)}` +
      `${pageOpen('راهنماهای اجرایی کاربان', false)}` +
      `<h1>چک‌لیست‌های طلایی مدیریت کسب‌وکار</h1>` +
      `<p class="lead">پنج مسیر گام‌به‌گام برای لحظه‌های حساس مدیریت: استخدام، اخراج، تنظیم قرارداد، تسویه و مالیات؛ هر گام را تیک بزن، پیشرفتت ذخیره می‌شود و دفعه بعد از همان‌جا ادامه می‌دهی.</p>` +
      `<div class="check-grid">` +
      cl.map((c) => `<article class="check-card"><div class="check-card-head"><h2>${esc(c.title)}</h2></div><p>${esc(c.description)}</p><div class="check-card-meta"><small>${c.items.length.toLocaleString('fa-IR')} گام اجرایی</small><a class="text-link" href="${url(`/چک-لیست‌ها/${c.slug}`)}">شروع ←</a></div></article>`).join('') +
      `</div>` +
      relatedBox('ابزارهای مرتبط کاربان', [
        { href: '/قراردادها', label: 'بانک قراردادها' },
        { href: '/ابزارهای-هوش-مصنوعی', label: 'ماشین‌حساب‌ها' },
        { href: '/کتابخانه-قوانین', label: 'کتابخانه قوانین' },
      ]) +
      `${pageClose()}`;
    await write('/چک-لیست‌ها', transformHtml(template, {
      title: META_ROUTES['/چک-لیست‌ها'].title,
      description: META_ROUTES['/چک-لیست‌ها'].description,
      image: META_ROUTES['/چک-لیست‌ها'].image,
      path: '/چک-لیست‌ها',
      jsonLd: [
        itemListLd(cl.map((c) => ({ name: c.title, href: `/چک-لیست‌ها/${c.slug}` }))),
        breadcrumbLd(crumb),
      ],
      inner,
    }));

    for (const c of cl) {
      const path = `/چک-لیست‌ها/${c.slug}`;
      const body =
        `${shell(path, [{ name: 'چک‌لیست‌های طلایی', href: '/چک-لیست‌ها' }, { name: c.title, path }])}` +
        `${pageOpen('چک‌لیست طلایی کاربان')}` +
        `<h1>${esc(c.title)}</h1>` +
        `<p class="lead">${esc(c.description)}</p>` +
        `<div class="contact-card calc-card checklist-box">` +
        c.items.map((i) => `<div class="checklist-item"><span>${esc(i)}</span></div>`).join('') +
        `</div>` +
        relatedBox('چک‌لیست‌های طلایی دیگر', cl.filter((x) => x.slug !== c.slug).map((x) => ({ href: `/چک-لیست‌ها/${x.slug}`, label: x.title }))) +
        `${pageClose()}`;
      await write(path, transformHtml(template, {
        title: `${c.title} | کاربان`,
        description: `${c.description} — ${c.items.length} گام عملی با ذخیره پیشرفت و خروجی PDF.`,
        image: META_ROUTES['/چک-لیست‌ها'].image,
        path,
        jsonLd: [
          breadcrumbLd([{ name: 'خانه', href: '/' }, { name: 'چک‌لیست‌های طلایی', href: '/چک-لیست‌ها' }, { name: c.title, path }]),
          faqLd(c.items.slice(0, 4).map((i) => [i.split('؛')[0].split(' (')[0], i])),
        ],
        inner: body,
      }));
    }
    console.log(`prerender: checklists done (${cl.length + 1}, ${count} total).`);
  }

  /* 9) کتابخانه قوانین — هاب + ۴ دسته */
  {
    const LAWS = lawsData.laws;
    const CATS = ['همه', ...lawsData.categories];
    const catCrumb = [{ name: 'خانه', href: '/' }, { name: 'کتابخانه قوانین', path: '/کتابخانه-قوانین' }];
    const lawCard = (l) =>
      `<article class="law-card"><header><span class="law-badge">${esc(l.law)}</span><strong>${esc(l.num)} — ${esc(l.title)}</strong></header><p>${esc(l.text)}</p><footer>${l.tags.map((t) => `<span class="law-tag">#${esc(t)}</span>`).join('')}</footer></article>`;
    const LAW_FALLBACK = [
      { href: '/دانشنامه', label: 'دانشنامه حقوقی' },
      { href: '/ابزارهای-هوش-مصنوعی/محاسبه-حقوق', label: 'ماشین‌حساب حقوق' },
      { href: '/درخواست‌های-اداری', label: 'درخواست‌های اداری آماده' },
    ];
    const lawSlug = (name) => name.replace(/ /g, '-');
    const tabsHtml = (active) => `<nav class="law-tabs" aria-label="دسته‌بندی قوانین">` + CATS.map((c) => `<a href="${url(c === 'همه' ? '/کتابخانه-قوانین' : `/کتابخانه-قوانین/${lawSlug(c)}`)}"${c === active ? ' class="active"' : ''}>${esc(c)}</a>`).join('') + `</nav>`;

    const hubInner =
      `${shell('/کتابخانه-قوانین', catCrumb)}` +
      `${pageOpen('کتابخانه قوانین کاربان')}` +
      `<h1>کتابخانه قوانین — به زبان ساده</h1>` +
      `<p class="lead">گزیده مواد پرکاربرد قانون کار، تأمین اجتماعی، مالیات‌های مستقیم و آیین‌نامه‌های اجرایی — با زبان ساده و برچسب‌های کاربردی.</p>` +
      tabsHtml('همه') +
      LAWS.map(lawCard).join('') +
      `<p class="muted-note">متن‌ها خلاصه کاربردی مواد قانونی است و جایگزین مشاوره حقوقی موردی نیست؛ در پرونده‌های حساس به متن رسمی قانون مراجعه کنید.</p>` +
      relatedBox('راهنماها و ابزارهای مرتبط', LAW_FALLBACK) +
      `${pageClose()}`;
    await write('/کتابخانه-قوانین', transformHtml(template, {
      title: META_ROUTES['/کتابخانه-قوانین'].title,
      description: META_ROUTES['/کتابخانه-قوانین'].description,
      image: META_ROUTES['/کتابخانه-قوانین'].image,
      path: '/کتابخانه-قوانین',
      jsonLd: [
        itemListLd(lawsData.categories.map((c) => ({ name: c, href: `/کتابخانه-قوانین/${lawSlug(c)}` }))),
        breadcrumbLd(catCrumb),
      ],
      inner: hubInner,
    }));

    for (const cat of lawsData.categories) {
      const path = `/کتابخانه-قوانین/${lawSlug(cat)}`;
      const items = LAWS.filter((l) => l.law === cat);
      const inner =
        `${shell(path, [{ name: 'کتابخانه قوانین', href: '/کتابخانه-قوانین' }, { name: cat, path }])}` +
        `${pageOpen('کتابخانه قوانین کاربان')}` +
        `<h1>${esc(cat)} — کتابخانه قوانین کاربان</h1>` +
        `<p class="lead">${esc(LAW_INTRO[cat] || '')}</p>` +
        tabsHtml(cat) +
        items.map(lawCard).join('') +
        relatedBox('راهنماها و ابزارهای مرتبط', lawRelatedMap[cat] || LAW_FALLBACK) +
        `${pageClose()}`;
      await write(path, transformHtml(template, {
        title: `${cat} — گزیده مواد پرکاربرد به زبان ساده | کاربان`,
        description: `گزیده مواد پرکاربرد ${cat} با زبان ساده و برچسب موضوعی؛ بخشی از کتابخانه قوانین کاربان.`,
        image: META_ROUTES['/کتابخانه-قوانین'].image,
        path,
        jsonLd: [breadcrumbLd([{ name: 'خانه', href: '/' }, { name: 'کتابخانه قوانین', href: '/کتابخانه-قوانین' }, { name: cat, path }])],
        inner,
      }));
    }
    console.log(`prerender: law library done (${CATS.length}, ${count} total).`);
  }

  /* 10) صفحه 404 واقعی — فایل ریشه‌ای که Vercel برای مسیرهای بی‌معنا
     با status 404 سرو می‌کند (noindex + لینک‌های نجات) */
  {
    const quickLinks = [
      ['/', 'صفحه اصلی'],
      ['/قراردادها', 'بانک قراردادها'],
      ['/ابزارهای-هوش-مصنوعی', 'ماشین‌حساب‌ها'],
      ['/دانشنامه', 'دانشنامه'],
      ['/درخواست‌های-اداری', 'درخواست‌های اداری'],
    ];
    const html404 = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="robots" content="noindex, follow" />
<title>صفحه پیدا نشد | کاربان</title>
<link rel="icon" type="image/png" href="/assets/images/Gemini_Generated_Image_3xp4kz3xp4kz3xp4-removebg-preview.png" />
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Vazirmatn,Tahoma,sans-serif;background:#f4f6f8;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem}
.card{background:#fff;border-radius:20px;padding:3rem 2.5rem;max-width:560px;width:100%;text-align:center;box-shadow:0 10px 40px rgba(18,57,91,.12);border-top:6px solid #12395b}
.eyebrow{display:inline-block;background:rgba(216,165,63,.14);color:#8a6a1f;font-size:.8rem;padding:.35rem 1rem;border-radius:999px;margin-bottom:1.1rem}
h1{color:#12395b;font-size:1.6rem;margin-bottom:.8rem}
p{color:#4a5b6a;line-height:2;font-size:.95rem;margin-bottom:1.6rem}
.links{display:flex;flex-wrap:wrap;gap:.6rem;justify-content:center}
.links a{display:inline-block;background:#f4f6f8;border:1px solid #dde4ea;color:#12395b;text-decoration:none;padding:.55rem 1.1rem;border-radius:999px;font-size:.88rem;transition:border-color .2s}
.links a:hover{border-color:#d8a53f}
.code{color:#98a6b3;font-size:.8rem;margin-top:1.6rem}
</style>
</head>
<body>
<div class="card">
  <span class="eyebrow">خطا ۴۰۴</span>
  <h1>این صفحه پیدا نشد</h1>
  <p>صفحه‌ای که دنبال آن بودید وجود ندارد یا جابه‌جا شده است؛ از لینک‌های زیر استفاده کن:</p>
  <div class="links">${quickLinks.map(([h, t]) => `<a href="${url(h)}">${esc(t)}</a>`).join('')}</div>
  <div class="code">کاربان — karbanapp.ir</div>
</div>
</body>
</html>`;
    await writeFile(resolve(distDir, '404.html'), html404, 'utf8');
  }

  /* manifest مسیرهای prerender‌شده — منبع هماهنگی sitemap با فایل‌های واقعی
     (sitemap.xml.ts در runtime همین را fetch و intersect می‌کند) */
  await writeFile(
    resolve(distDir, 'prerender-manifest.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), count: manifestRoutes.size, routes: [...manifestRoutes].sort() }, null, 0),
    'utf8',
  );

  /* ── sitemap.xml استاتیک در زمان بیلد ─────────────────────────────
     چرا استاتیک؟ تابع api/sitemap.xml.ts روی Vercel به‌خاطر محدودیت
     tracing فایل‌های JSON بیرون api/ کرش می‌کند (FUNCTION_INVOCATION_FAILED).
     اینجا همان منطق است + intersect با manifest واقعی همین بیلد؛ فایل
     استاتیک در روتینگ Vercel از rewrite به API جلو می‌زند (filesystem اول). */
  try {
    const day = (v) => {
      const s = String(v || '');
      return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : undefined;
    };
    const KNOWLEDGE_CATS = /** @type {string[]} */ (routeMeta.knowledgeCategories || []);
    const rows = [
      { path: '/', priority: routeMeta.home.priority || '1.0' },
      ...Object.entries(META_ROUTES).map(([p, m]) => ({ path: p, priority: /** @type {any} */ (m).priority || '0.6' })),
      ...Object.entries(META_TOOLS).map(([k, m]) => ({ path: `/ابزارهای-هوش-مصنوعی/${k}`, priority: /** @type {any} */ (m).priority || '0.8' })),
      ...KNOWLEDGE_CATS.map((c) => ({ path: categoryPath(c), priority: '0.7' })),
      ...checklists.map((c) => ({ path: `/چک-لیست‌ها/${c.slug}`, priority: '0.6' })),
      ...lawsData.categories.map((c) => ({ path: `/کتابخانه-قوانین/${categorySlug(c)}`, priority: '0.6' })),
    ];
    /* داینامیک‌ها — fetch سبک جدا با fallback ستون‌ها؛ خطا ⇒ skip آن بخش */
    try {
      const arts = await supabaseFetch('articles', 'id,title,updated_at,created_at', 'id,title,created_at');
      for (const a of arts) {
        rows.push({
          path: a.title ? articleSlugPath(String(a.title), a.id) : `/دانشنامه/مقاله/${a.id}`,
          priority: '0.7',
          lastmod: day(a.updated_at) || day(a.created_at),
        });
      }
    } catch (e) {
      console.warn(`sitemap: articles skipped (${String(e).slice(0, 80)})`);
    }
    try {
      const cons = (await supabaseFetch('contracts', 'id,updated_at,created_at,is_published', 'id,created_at,is_published'))
        .filter((c) => c.is_published !== false);
      for (const c of cons) {
        rows.push({ path: `/قراردادها/${c.id}`, priority: '0.8', lastmod: day(c.updated_at) || day(c.created_at) });
      }
    } catch (e) {
      console.warn(`sitemap: contracts skipped (${String(e).slice(0, 80)})`);
    }
    try {
      const reqs = await supabaseFetch('admin_requests', 'id,updated_at,created_at', 'id,created_at');
      for (const r of reqs) {
        rows.push({ path: `/درخواست‌های-اداری/${r.id}`, priority: '0.6', lastmod: day(r.updated_at) || day(r.created_at) });
      }
    } catch (e) {
      console.warn(`sitemap: requests skipped (${String(e).slice(0, 80)})`);
    }
    /* فقط URLهایی که واقعاً در همین بیلد فایل دارند + dedupe (حفظ آخرین) */
    const byPath = new Map();
    for (const r of rows) {
      if (r.path !== '/' && !manifestRoutes.has(r.path)) continue;
      byPath.set(r.path, r);
    }
    const sitemapXml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      [...byPath.values()]
        .map(
          (r) =>
            `  <url><loc>${ORIGIN}${encodeURI(r.path)}</loc>${
              r.lastmod ? `<lastmod>${r.lastmod}</lastmod>` : ''
            }<priority>${r.priority}</priority></url>`,
        )
        .join('\n') +
      `\n</urlset>`;
    await writeFile(resolve(distDir, 'sitemap.xml'), sitemapXml, 'utf8');
    console.log(`prerender: sitemap.xml written (${byPath.size} URLs, intersected with manifest).`);
  } catch (e) {
    console.warn(`sitemap generation skipped (${String(e).slice(0, 120)})`);
  }

  console.log(`prerender: ${count} route HTML files written (full-content mode). manifest: ${manifestRoutes.size} routes.`);
}

main().catch((e) => {
  // Never break the deploy because of prerendering.
  console.error('prerender failed (build continues with SPA fallback):', e);
});
