#!/usr/bin/env node
/* ═════════════════════════════════════════════════════════════════════
   CLI حسابرسی کامل حسابداری کاربان
   اجرا:  node scripts/audit-full.mjs [--keep] [--full]
   env:   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (یا VITE_SUPABASE_URL)
   خروجی: audit-report.json (عمومی/پاک‌سازی‌شده؛ با --full کامل)
          + audit-report.md
   مسیر خروجی نسبت به cwd است — در GitHub Actions و لوکال هر دو کار می‌کند
   ═════════════════════════════════════════════════════════════════════ */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { resolveConfig, runAudit, publicReport, buildMd } from '../api/_lib/audit-core.js';

const args = new Set(process.argv.slice(2));
const keep = args.has('--keep');
const full = args.has('--full');

const { URL, SRK } = resolveConfig(process.env);
if (!SRK) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY missing');
  console.error('   راهنما: این متغیر را در GitHub (Settings → Secrets and variables → Actions) یا لوکال تعریف کنید:');
  console.error('   export SUPABASE_SERVICE_ROLE_KEY="eyJ..."');
  process.exit(1);
}

console.log(`🔍 حسابرسی کامل حسابداری کاربان شروع شد → ${URL}`);
let fullReport;
try {
  fullReport = await runAudit({ URL, SRK, cleanup: !keep });
} catch (e) {
  console.error('❌ خطای اجرای حسابرسی:', String(e?.message || e));
  process.exit(1);
}

const pub = publicReport(fullReport);
const outJson = full ? fullReport : pub;
const outPath = join(process.cwd(), 'audit-report.json');
const mdPath = join(process.cwd(), 'audit-report.md');
writeFileSync(outPath, JSON.stringify(outJson, null, 2));
writeFileSync(mdPath, buildMd(pub));

console.log(`\n📄 ${outPath} نوشته شد${full ? ' (کامل)' : ' (نسخه عمومی — با --full کامل می‌شود)'}`);
console.log(`📄 ${mdPath} نوشته شد`);
process.exit(0);
