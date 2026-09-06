/**
 * verify-dist.mjs — تست‌های خودکار خروجی build
 * ─────────────────────────────────────────────
 * ۱) متای کامل همه routeهای prerender‌شده: title / description / canonical / H1 / JSON-LD / og:image
 * ۲) هماهنگی متای صفحات ثابت با منبع واحد src/data/route-meta.json (React = prerender)
 * ۳) هماهنگی sitemap با prerender: هر URL سitemap (شبیه‌سازی‌شده با همان منطق api/sitemap.xml.ts)
 *    باید فایل prerender واقعی داشته باشد
 * ۴) 404.html + robots + اسکن لینک‌های داخلی
 * اجرا: node scripts/verify-dist.mjs  (بعد از npm run build)
 */
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import routeMeta from '../src/data/route-meta.json' with { type: 'json' };
import checklists from '../src/data/checklists.json' with { type: 'json' };
import lawsData from '../src/data/laws.json' with { type: 'json' };

const KNOWLEDGE_CATEGORIES = routeMeta.knowledgeCategories || [];

const dist = resolve(process.cwd(), 'dist');
const ORIGIN = 'https://karbanapp.ir';

/* مسیرهایی که rewrite SPA دارند (نبود فایل استاتیک برایشان طبیعی است) */
const SPA_ROUTES = new Set([
  '/ورود', '/داشبورد', '/پروفایل', '/admin', '/کارفرما', '/کارمند', '/فریلنسر',
]);

function dec(seg) {
  try { return decodeURIComponent(seg); } catch { return seg; }
}

/* collect all prerendered routes from dist directory tree */
async function walk(dir, base = '') {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = resolve(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walk(p, base + '/' + dec(e.name))));
    } else if (e.name === 'index.html') {
      out.push({ file: p, route: base === '' ? '/' : base, base });
    } else {
      out.push({ file: p, route: null, base });
    }
  }
  return out;
}

const files = await walk(dist);
const html404 = files.find((f) => f.file.endsWith('404.html'));
const pages = files.filter((x) => x.file.endsWith('.html') && x.route);

function check(name, ok, detail = '') {
  const mark = ok ? '✓' : '✗';
  console.log(`${mark} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) process.exitCode = 1;
}

function inspect(route) {
  const segs = route.split('/').filter(Boolean).map((s) => encodeURIComponent(s));
  const f = resolve(dist, ...segs, 'index.html');
  return readFile(f, 'utf8');
}

/* ── شبیه‌سازی sitemap با همان منابع api/sitemap.xml.ts (بدون دیتابیس؛ از خود فایل‌های prerender) ──
   STATIC = route-meta، دیتابیسی = هر مسیر /قراردادها/{id} و /دانشنامه/مقاله/* و /درخواست‌های-اداری/{id}
   که واقعاً در dist وجود دارد (نمایشِ همان manifest-intersect در runtime). */
const manifest = JSON.parse(await readFile(resolve(dist, 'prerender-manifest.json'), 'utf8').catch(() => null));
const manifestSet = new Set(manifest?.routes || []);

function simulatedSitemapRoutes() {
  /* همان منطق api/sitemap.xml.ts: ثابت‌ها از route-meta + چک‌لیست‌ها + قوانین + دسته‌ها،
     دیتابیسی‌ها = هر مسیر واقعاً prerender‌شده با الگوی قرارداد/مقاله/درخواست */
  const routes = [
    '/',
    ...Object.keys(routeMeta.routes),
    ...Object.keys(routeMeta.tools).map((k) => `/ابزارهای-هوش-مصنوعی/${k}`),
    ...KNOWLEDGE_CATEGORIES.map((c) => `/دانشنامه/${c.replace(/ /g, '-')}`),
    ...(checklists).map((c) => `/چک-لیست‌ها/${c.slug}`),
    ...(lawsData.categories).map((c) => `/کتابخانه-قوانین/${c.replace(/ /g, '-')}`),
  ];
  for (const r of pages) {
    /* مقاله فقط نسخه اسلاگ (URL استاندارد sitemap است؛ عددی legacy canonical دارد) */
    if (/^\/قراردادها\/\d+$/.test(r.route) || (/^\/دانشنامه\/مقاله\//.test(r.route) && !/\/\d+$/.test(r.route)) || /^\/درخواست‌های-اداری\/\d+$/.test(r.route)) {
      routes.push(r.route);
    }
  }
  return routes;
}

/* 1) مسیرهای کلیدی — نمونه برای خوانایی خروجی */
const REQUIRED = ['/', '/دانشنامه', '/قراردادها', '/خدمات', '/ابزارهای-هوش-مصنوعی', '/چک-لیست‌ها', '/کتابخانه-قوانین', '/درخواست‌های-اداری'];
/* نمونه مقاله اسلاگ‌دار از خود مسیرهای prerender‌شده (نه عددی legacy) */
const articleSample = pages.map((p) => p.route).find((r) => /^\/دانشنامه\/مقاله\//.test(r) && !/\/\d+$/.test(r));
const conDir = resolve(dist, ...'/قراردادها'.split('/').filter(Boolean).map((s) => encodeURIComponent(s)));
const conFirst = dec((await readdir(conDir)).filter((x) => !x.includes('.')).sort((a, b) => Number(a) - Number(b))[0]);

const targets = [
  ...REQUIRED,
  articleSample,
  `/قراردادها/${conFirst}`,
  '/ابزارهای-هوش-مصنوعی/محاسبه-حقوق',
  '/چک-لیست‌ها/چک-لیست-استخدام',
].filter(Boolean);

for (const route of targets) {
  try {
    const html = await inspect(route);
    const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
    const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
    const canonical = (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1] || '';
    const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '';
    const ld = (html.match(/<script type="application\/ld\+json" id="page-jsonld">([\s\S]*?)<\/script>/) || [])[1] || '';
    const orgLd = /"@type"\s*:\s*"(Organization|WebSite)"/.test(html);
    const ogi = (html.match(/<meta property="og:image" content="([^"]*)"/) || [])[1] || '';
    const robot = (html.match(/<meta name="robots" content="([^"]*)"/) || [])[1] || '';
    const homeDuplicate = title.startsWith('کاربان | بانک قرارداد') && route !== '/';
    check(route, !!(title && desc && canonical && h1 && (ld || orgLd) && ogi) && !homeDuplicate,
      `title="${title.slice(0, 45)}" canonical=${canonical === ORIGIN + encodeURI(route) ? 'OK' : canonical} h1="${h1.replace(/<[^>]*>/g, '').slice(0, 30)}" ld=${ld || orgLd ? 'yes' : 'NO'} og=${ogi ? 'yes' : 'NO'} robots=${robot || 'default'}`);
  } catch (e) {
    check(route, false, String(e).slice(0, 80));
  }
}

/* 2) تست عمیق همه صفحات: متا + canonical منحصربه‌فرد + هماهنگی با route-meta */
console.log(`\ndeep meta audit — ${pages.length} prerendered pages:`);
const META_STATIC = { '/': routeMeta.home, ...routeMeta.routes };
const TOOL_META = routeMeta.tools;
let deepFail = 0;
const canonicalSeen = new Map();
const routeSet = new Set(pages.map((p) => p.route));

for (const page of pages) {
  if (page.route === '/404') continue;
  const html = await readFile(page.file, 'utf8');
  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
  const canonical = (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1] || '';
  const h1s = (html.match(/<h1[^>]*>/g) || []).length;
  const hasLd = /<script type="application\/ld\+json"/.test(html);
  const problems = [];

  if (!title.trim()) problems.push('no title');
  if (!desc || desc.length < 40) problems.push(`desc weak (${desc.length})`);
  if (h1s !== 1) problems.push(`h1×${h1s}`);
  if (!hasLd) problems.push('no json-ld');

  /* canonical باید به مسیری برود که واقعاً prerender شده (اسلاگ یا خودش) */
  if (!canonical.startsWith(ORIGIN)) problems.push('canonical not absolute');
  else {
    const cPath = decodeURIComponent(canonical.slice(ORIGIN.length)) || '/';
    if (!routeSet.has(cPath)) problems.push(`canonical→missing:${cPath}`);
    if (canonicalSeen.has(canonical) && canonicalSeen.get(canonical) !== page.route) {
      /* فقط برای صفحات legacy عمدی است (عددی → اسلاگ)؛ تکرار بین دو مسیر غیر legacy خطاست */
      const other = canonicalSeen.get(canonical);
      const legacyPair =
        (page.route === other) ||
        (/^\/دانشنامه\/(مقاله\/)?\d+/.test(page.route) && cPath === other);
      if (!legacyPair) problems.push(`canonical dup with ${other}`);
    }
    canonicalSeen.set(canonical, page.route);
  }

  /* صفحات ثابت: title/description باید دقیقاً با route-meta یکی باشد (React = prerender) */
  const toolKey = page.route.startsWith('/ابزارهای-هوش-مصنوعی/') ? dec(page.route.split('/')[2]) : null;
  const staticMeta = META_STATIC[page.route] || (toolKey ? TOOL_META[toolKey] : null);
  if (staticMeta) {
    const expectTitle = (toolKey ? TOOL_META[toolKey].title : META_STATIC[page.route].title).replace(/ \| کاربان$/, '');
    if (title !== (toolKey ? TOOL_META[toolKey].title : META_STATIC[page.route].title)) problems.push(`title≠meta-map`);
    if (desc !== (toolKey ? TOOL_META[toolKey].description : META_STATIC[page.route].description)) problems.push(`desc≠meta-map`);
  }

  if (problems.length) {
    deepFail++;
    console.log(`  ✗ ${page.route} → ${problems.join(' | ')}`);
  }
}
check(`deep meta audit (${pages.length - 1} pages)`, deepFail === 0, deepFail ? `${deepFail} pages with problems` : 'همه متاها کامل و هماهنگ');

/* 3) هماهنگی sitemap با prerender — هر URL سitemap باید فایل واقعی داشته باشد */
console.log('\nsitemap ↔ prerender sync:');
if (!manifest) {
  check('prerender-manifest.json exists', false, 'missing — prerender باید manifest بنویسد');
} else {
  const smRoutes = simulatedSitemapRoutes();
  const missing = smRoutes.filter((r) => !manifestSet.has(r));
  /* کپی‌های legacy عددی (canonical → اسلاگ) عمداً خارج از sitemap هستند؛ role pages هم */
  const isLegacyCopy = (r) => /^\/دانشنامه\/\d+$/.test(r) || /^\/دانشنامه\/مقاله\/\d+$/.test(r);
  const outside = [...manifestSet].filter((r) => !smRoutes.includes(r) && !isLegacyCopy(r) && !['/کارفرما', '/کارمند', '/فریلنسر'].includes(r));
  check(`manifest written (${manifestSet.size} routes)`, manifestSet.size > 100);
  check(`sitemap(${smRoutes.length} urls) → همه در prerender`, missing.length === 0, missing.length ? `missing: ${missing.slice(0, 5).join(', ')}` : 'کامل هماهنگ');
  check('هیچ route خارج از sitemap جز role pages نیست', outside.length === 0, outside.length ? `outside: ${outside.slice(0, 5).join(', ')}` : '');
  /* صفحات خصوصی هرگز در prerender/sitemap نیستند */
  const leaked = smRoutes.filter((r) => SPA_ROUTES.has(r) || r.startsWith('/سفارش') || r === '/admin');
  check('صفحات خصوصی در sitemap نیستند', leaked.length === 0, leaked.join(', ') || '');
}

/* 4) 404.html */
if (html404) {
  const c = await readFile(html404.file, 'utf8');
  check('404.html', /noindex/.test(c) && /این صفحه پیدا نشد/.test(c) && /<h1/.test(c));
} else {
  check('404.html', false, 'missing in dist');
}

/* 5) اسکن لینک‌های داخلی همه صفحات */
const known = new Set(pages.map((f) => f.route));
const broken = new Map();
const hrefRe = /href="(\/[^"#]*)"/g;
let scanned = 0;
for (const f of files.filter((x) => x.file.endsWith('.html'))) {
  const html = await readFile(f.file, 'utf8');
  let m;
  scanned++;
  while ((m = hrefRe.exec(html))) {
    let href = m[1];
    if (href.startsWith('//')) continue;
    href = href.split('?')[0];
    if (href.length > 1 && href.endsWith('/')) href = href.replace(/\/+$/, '');
    if (SPA_ROUTES.has(href) || href === '/sitemap.xml' || href === '/prerender-manifest.json' || href.startsWith('/api/')) continue;
    const segs = href.split('/').filter(Boolean).map((s) => encodeURIComponent(s));
    const asFile = resolve(dist, ...segs, 'index.html');
    const asHtml = resolve(dist, ...segs) + '.html';
    const asPlain = resolve(dist, ...segs.slice(0, -1), segs.at(-1) + '.html');
    const asStatic = resolve(dist, ...segs); /* فایل استاتیک واقعی (assets/fonts/…) */
    const okDir = known.has(href);
    let ok = okDir;
    if (!ok) {
      try { await readFile(asFile, 'utf8'); ok = true; } catch { /* try next */ }
      if (!ok) try { await readFile(asHtml, 'utf8'); ok = true; } catch { /* try next */ }
      if (!ok) try { await readFile(asPlain, 'utf8'); ok = true; } catch { /* try next */ }
      if (!ok) try { await readFile(asStatic); ok = true; } catch { /* nope */ }
    }
    if (!ok) broken.set(href, (broken.get(href) || 0) + 1);
  }
}
console.log(`\nlink scan: ${scanned} HTML files scanned`);
if (broken.size === 0) {
  console.log('✓ هیچ لینک داخلی شکسته‌ای در HTML تولیدشده نیست');
} else {
  console.log(`✗ ${broken.size} مقصد شکسته:`);
  for (const [href, n] of broken) console.log(`   ${href} (×${n})`);
  process.exitCode = 1;
}

/* 6) robots/sitemap/og assets */
try {
  const c = await readFile(resolve(dist, 'robots.txt'), 'utf8');
  check('robots.txt in dist', c.includes('Sitemap: https://karbanapp.ir/sitemap.xml') && c.includes(encodeURIComponent('پروفایل')));
} catch { check('robots.txt in dist', false); }

for (const img of ['og-cover.jpg', 'og-contracts.png', 'og-knowledge.png', 'og-tools.png', 'og-services.png', 'og-requests.png', 'og-checklists.png', 'og-laws.png']) {
  try {
    const b = await readFile(resolve(dist, 'images', img));
    check(`og asset ${img}`, b.length > 10000 && b.length < 400000, `${Math.round(b.length / 1024)}KB`);
  } catch { check(`og asset ${img}`, false, 'missing'); }
}
