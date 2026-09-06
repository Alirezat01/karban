/* تست محلی handler سitemap — شبیه‌سازی Vercel function */
import { execSync } from 'node:child_process';

const mod = await import('../api/sitemap.xml.ts').catch(() => null);
if (!mod) {
  // tsx-run: compile on the fly
  execSync('npx --yes tsx scripts/test-sitemap.ts', { stdio: 'inherit', cwd: process.cwd() });
  process.exit(0);
}

const res = {
  headers: {},
  _status: null,
  _body: null,
  setHeader(k, v) { this.headers[k] = v; },
  status(c) { this._status = c; return { send: (b) => { this._body = b; } }; },
};

await mod.default({}, res);

console.log('status:', res._status);
console.log('content-type:', res.headers['Content-Type']);
const xml = res._body || '';
const urls = (xml.match(/<loc>/g) || []).length;
console.log('url count:', urls);
console.log('has robots-disallowed paths?', /داشبورد|\/ورود|\/admin|\/سفارش/.test(decodeURIComponent(xml)));
console.log('has lastmod?', xml.includes('<lastmod>'));
console.log('sample:', xml.split('\n').slice(0, 4).join('\n'));
const bad = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]).filter((u) => /undefined|null/.test(u));
console.log('bad urls:', bad.length ? bad.slice(0, 5) : 'none');
