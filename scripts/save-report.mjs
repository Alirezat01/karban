#!/usr/bin/env node
/* استخراج گزارش حسابرسی از پاسخ endpoint ورسل و نوشتن فایل گزارش
   استفاده در GitHub Actions:
     node scripts/save-report.mjs audit-response.json audit-report.json
   اگر ok نبود، با کد خطا خارج می‌شود تا وورک‌فلو fallback کند */
import { readFileSync, writeFileSync } from 'fs';

const [, , inFile = 'audit-response.json', outFile = 'audit-report.json'] = process.argv;
let resp;
try {
  resp = JSON.parse(readFileSync(inFile, 'utf8'));
} catch (e) {
  console.error(`پاسخ endpoint قابل خواندن نیست: ${String(e?.message || e)}`);
  process.exit(2);
}
if (!resp?.ok || !resp?.report) {
  console.error(`endpoint پاسخ موفق نداد: ${JSON.stringify(resp).slice(0, 300)}`);
  process.exit(2);
}
writeFileSync(outFile, JSON.stringify(resp.report, null, 2));
if (resp.md) writeFileSync(outFile.replace(/\.json$/, '.md'), resp.md);
console.log(`✅ گزارش از ورسل ذخیره شد → ${outFile}${resp.cached ? ' (کش‌شده)' : ''} | ${resp.summary?.pass} موفق / ${resp.summary?.fail} ناموفق`);
process.exit(0);
