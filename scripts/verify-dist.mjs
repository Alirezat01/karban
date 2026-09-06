/**
 * verify-dist.mjs — تست خروجی build (item 15) + اسکن لینک‌های داخلی (item 24)
 * اجرا: node scripts/verify-dist.mjs
 */
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const dist = resolve(process.cwd(), 'dist');
const ORIGIN = 'https://karbanapp.ir';

/* مسیرهایی که rewrite SPA دارند (نبود فایل استاتیک برایشان طبیعی است) */
const SPA_ROUTES = new Set([
  '/ورود', '/داشبورد', '/admin', '/کارفرما', '/کارمند', '/فریلنسر',
]);

function dec(seg) {
  try { return decodeURIComponent(seg); } catch { return seg; }
}

/* collect all prerendered routes from dist directory tree */
async function walk(dir, base = '') {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = resolve(dir, e.name);
    const route = base + '/' + dec(e.name);
    if (e.isDirectory()) out.push(...(await walk(p, route)));
    else out.push({ file: p, route: base === '' && e.name === 'index.html' ? '/' : (e.name === 'index.html' ? route : null), base });
  }
  return out;
}

const files = await walk(dist);
const html404 = files.find((f) => f.file.endsWith('404.html'));

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

/* 1) مسیرهای کلیدی */
const REQUIRED = ['/', '/دانشنامه', '/قراردادها', '/خدمات', '/ابزارهای-هوش-مصنوعی', '/چک-لیست‌ها', '/کتابخانه-قوانین', '/درخواست‌های-اداری'];
const db = JSON.parse(await readFile(resolve(dist, '.prerender-ids.json'), 'utf8').catch(() => null));

/* article/contract نمونه از خود فایل‌ها */
const artDir = resolve(dist, ...'/دانشنامه/مقاله'.split('/').filter(Boolean).map((s) => encodeURIComponent(s)));
const artFirst = dec((await readdir(artDir))[0]).replace('.html', '');
const conDir = resolve(dist, ...'/قراردادها'.split('/').filter(Boolean).map((s) => encodeURIComponent(s)));
const conFirst = dec((await readdir(conDir)).filter((x) => !x.includes('.')).sort((a, b) => Number(a) - Number(b))[0]);

const targets = [
  ...REQUIRED,
  `/دانشنامه/مقاله/${artFirst}`,
  `/قراردادها/${conFirst}`,
  '/ابزارهای-هوش-مصنوعی/محاسبه-حقوق',
  '/چک-لیست‌ها/چک-لیست-استخدام',
];

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
    check(route, !!(title && desc && canonical && h1 && (ld || orgLd)) && !homeDuplicate,
      `title="${title.slice(0, 45)}" canonical=${canonical === ORIGIN + encodeURI(route) ? 'OK' : canonical} h1="${h1.replace(/<[^>]*>/g, '').slice(0, 30)}" ld=${ld || orgLd ? 'yes' : 'NO'} robots=${robot || 'default'}`);
  } catch (e) {
    check(route, false, String(e).slice(0, 80));
  }
}

/* 2) 404.html */
if (html404) {
  const c = await readFile(html404.file, 'utf8');
  check('404.html', /noindex/.test(c) && /این صفحه پیدا نشد/.test(c) && /<h1/.test(c));
} else {
  check('404.html', false, 'missing in dist');
}

/* 3) اسکن لینک‌های داخلی همه صفحات (item 24) */
const known = new Set(files.map((f) => f.route).filter(Boolean));
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
    if (SPA_ROUTES.has(href) || href === '/sitemap.xml' || href.startsWith('/api/')) continue;
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

/* 4) robots/sitemap assets */
try { await readFile(resolve(dist, 'robots.txt'), 'utf8').then((c) => check('robots.txt in dist', c.includes('Sitemap: https://karbanapp.ir/sitemap.xml'))); } catch { check('robots.txt in dist', false); }
