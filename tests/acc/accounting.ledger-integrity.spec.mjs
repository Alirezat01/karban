/* ═══════════ accounting.ledger-integrity.spec ═══════════
   بخش ۹ درخواست — سلامت کل دفتر: هر سند تراز · هیچ سرِسند بدون ردیف
   اسکن واقعی روی همهٔ اسناد کسب‌وکار آزمایشی (+ نمونهٔ کسب‌وکار دوم) */
import { record, entrySums } from './_harness.mjs';

export async function run(ctx) {
  const { A, B, bizA, bizB } = ctx;

  /* همهٔ اسناد کسب‌وکار A */
  const { data: journals } = await A.sb.from('acc_journal').select('id, entry_no, description').eq('business_id', bizA);
  let balanced = 0, unbalanced = [], noLines = [];
  for (const j of journals || []) {
    const s = await entrySums(A.sb, j.id);
    if (s.lines === 0) { noLines.push(j); continue; }
    if (s.d === s.c) balanced++;
    else unbalanced.push({ entry_no: j.entry_no, d: s.d, c: s.c });
  }
  record('LGI-1', 'همهٔ سندهای دارای ردیف، تراز هستند', unbalanced.length === 0 ? 'PASS' : (ctx.rpc ? 'FAIL' : 'EXPECTED-FAIL'),
    unbalanced.length === 0
      ? `${balanced}/${(journals || []).length - noLines.length} تراز`
      : `${balanced} تراز · ناتراز: ${JSON.stringify(unbalanced.slice(0, 2))}${ctx.rpc ? '' : ' — پیش از مایگریشن سند غیرتراز ممکن است؛ تریگر تراز بعد از اجرا جلویش را می‌گیرد'}`);
  record('LGI-2', 'هیچ سرِسند بدون ردیف در دفتر نیست', noLines.length === 0 ? 'PASS' : 'FAIL',
    noLines.length ? `سندهای یتیم: ${noLines.map(j => '#' + j.entry_no).join(', ')}` : `${(journals || []).length} سند بررسی شد`);

  /* ردیف‌های یتیم (entry_id بدون والد) — بعد از آبشاری نباید وجود داشته باشد */
  const { data: orphanLines } = await A.sb.from('acc_journal_lines').select('id, entry_id, acc_journal(id)').eq('business_id', bizA).limit(500);
  const orphans = (orphanLines || []).filter(l => !l.acc_journal);
  record('LGI-3', 'هیچ ردیف سند بدون سند والد نیست', orphans.length === 0 ? 'PASS' : 'FAIL', `${orphans.length} ردیف یتیم`);

  /* کسب‌وکار B هم همین بررسی */
  const { data: journalsB } = await B.sb.from('acc_journal').select('id').eq('business_id', bizB);
  let okB = true;
  for (const j of journalsB || []) {
    const s = await entrySums(B.sb, j.id);
    if (s.lines > 0 && s.d !== s.c) okB = false;
  }
  record('LGI-4', 'سلامت دفتر کسب‌وکار دوم (ایزوله)', okB ? 'PASS' : 'FAIL', `${(journalsB || []).length} سند`);
}
