// Karban Content Engine — weekly AI legal content with provider fallback
import { createClient } from '@supabase/supabase-js';

/* ── اعتبارسنجی شروع به کار: اگر secretای کم باشد، پیام واضح فارسی بده
   (قبلاً اینجا بی‌صدا کرش می‌کرد و لاگ گیت‌هاب فقط exit 1 نشان می‌داد) ── */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const problems = [];
if (!SUPABASE_URL) problems.push('secret «SUPABASE_URL» تنظیم نشده است');
else if (!/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(SUPABASE_URL)) problems.push('secret «SUPABASE_URL» فرمت درست ندارد (باید مثل https://xxxx.supabase.co باشد)');
if (!SUPABASE_SERVICE_ROLE_KEY) problems.push('secret «SUPABASE_SERVICE_ROLE_KEY» تنظیم نشده است (کلید service_role از: Supabase → Project Settings → API)');
if (problems.length) {
  console.error('❌ خطای پیکربندی ورک‌فلو:');
  problems.forEach((p) => console.error('   - ' + p));
  console.error('   مسیر رفع: GitHub → Settings → Secrets and variables → Actions → New repository secret');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const tg = (text) =>
  fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text }),
  }).catch(() => {});

/* ── زنجیره ارائه‌دهنده‌ها (همه رایگان) — جمینای اولویت اول است ──
   نام‌های جایگزین جمینای هم پذیرفته می‌شود تا اشتباه اسم secret بلاک‌مان نکند */
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const providers = [
  { name: 'gemini', base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: process.env.GEMINI_MODEL || 'gemini-3.6-flash', key: GEMINI_KEY },
  { name: 'groq', base: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', key: process.env.GROQ_API_KEY },
  { name: 'openrouter', base: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.3-70b-instruct:free', key: process.env.OPENROUTER_API_KEY },
].filter((p) => p.key);

console.log(`🤖 ارائه‌دهنده‌های فعال (به همین ترتیب امتحان می‌شوند): ${providers.map((p) => p.name).join(' → ') || 'هیچ!'}`);

/* ── تشخیص نوع کلید بدون افشای خود کلید: فقط نقش/نوع/طول را می‌گوییم ── */
function describeKey(k) {
  if (!k) return 'خالی';
  if (k.startsWith('sb_secret_')) return 'کلید secret جدید (sb_secret_…) — نوع درست';
  if (k.startsWith('sb_pub_') || k.startsWith('sb_anon_')) return 'کلید publishable/anon (sb_pub_…) — نوع اشتباه!';
  try {
    const payload = JSON.parse(Buffer.from(k.split('.')[1], 'base64').toString('utf8'));
    return payload.role ? `کلید JWT با نقش «${payload.role}»` : 'کلید JWT بدون نقش';
  } catch {
    return `رشتهٔ ${k.length} کاراکتری (نه کلید JWT و نه sb_...)`;
  }
}

/* ── health-check کلید سرویس: با یک تست نوشتن+پاک‌کردن مطمئن می‌شویم کلید واقعاً
   service_role است (کلید anon چون SELECT عمومی دارد با تستِ فقط-خواندن گول می‌زد) ── */
{
  const probe = { job: '__health__', topic: 'write-probe', status: 'failed' };
  const { error: insErr } = await supabase.from('content_jobs').insert(probe);
  if (insErr) {
    const why = `کلید «SUPABASE_SERVICE_ROLE_KEY» کار نمی‌کند | نوع کلید دریافتی: ${describeKey(SUPABASE_SERVICE_ROLE_KEY)} | خطا: ${insErr.message}`;
    console.error('❌ ' + why);
    if (/row-level security|42501|permission/i.test(insErr.message))
      console.error('   یعنی مقدار این secret کلید service_role نیست (انگار anon/public گذاشته‌ای). کلید درست: Supabase → Project Settings → API Keys → سربرگ service_role → کپی کامل → GitHub → Settings → Secrets and variables → Actions → روی SUPABASE_SERVICE_ROLE_KEY گزینهٔ Update (نه secret جدید).');
    else
      console.error('   جدول content_jobs مشکل دارد؛ اسکیمای دیتابیس را چک کن.');
    await tg(`❌ ورک‌فلوی کاربان نتوانست به دیتابیس بنویسد.\n${why}\nبرای دیدن جزئیات: لاگ ران در Actions → استپ article`);
    process.exit(1);
  }
  const { error: delErr } = await supabase.from('content_jobs').delete().eq('job', '__health__');
  if (delErr) console.error(`⚠️ ردیف تست پاک نشد (${delErr.message}) — در SQL Editor این را بزن: delete from content_jobs where job = '__health__';`);
  console.log('✅ اتصال Supabase (service_role) سالم است — نوشتن و پاک‌کردن تست شد.');
}

async function callAI(system, user) {
  const errs = [];
  for (const p of providers) {
    try {
      const res = await fetch(`${p.base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.key}` },
        body: JSON.stringify({ model: p.model, temperature: 0.7, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
      });
      if (!res.ok) {
        const body = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 250);
        throw new Error(`${p.name} HTTP ${res.status}: ${body}`);
      }
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error(`${p.name} پاسخ خالی برگرداند`);
      return { text, provider: p.name };
    } catch (e) {
      console.error(`   ↳ [${p.name}] ناموفق: ${String(e).slice(0, 300)}`);
      errs.push(String(e).slice(0, 250));
    }
  }
  throw new Error(errs.length ? `همه ارائه‌دهنده‌ها شکست خوردند ⇐ ${errs.join(' | ')}` : 'هیچ ارائه‌دهنده‌ای تنظیم نشده است');
}

/* ── دستور وکیل دادگستری ── */
const LAWYER = `تو وکیل دادگستری ایرانی با ۱۵ سال سابقه در حقوق کار، قراردادهای مدنی و مالیات هستی.
قواعد سخت:
- لحن حرفه‌ای و دقیق ولی قابل‌فهم برای غیرحقوقی‌ها.
- استناد فقط به شماره ماده واقعی (قانون کار، قانون مدنی، قانون تأمین اجتماعی، قانون مالیات‌های مستقیم). اگر مطمئن نیستی ننویس «ماده X»؛ بنویس «مطابق مقررات جاری».
- سال‌ها و اعداد فقط فارسی و صحیح: ۱۴۰۵. هرگز «۱۴۰» یا «۱۴» یا «۱۴» تنها.
- هیچ آدرس یا برند خارجی (مثل bolt.new) ذکر نکن.
- خروجی فقط و فقط JSON معتبر، بدون هیچ متن اضافه.`;

const ARTICLE_SCHEMA = `{
 "slug":"kebab-case-english",
 "title":"عنوان سئویی فارسی",
 "meta_title":"حداکثر ۶۰ نویسه با کلمه کلیدی",
 "meta_description":"۱۵۰-۱۶۰ نویسه ترغیب‌کننده",
 "category":"یکی از: حقوقی و قانون کار | مالیات | حسابداری | منابع انسانی | مدیریت",
 "tags":"کلمه۱، کلمه۲، کلمه۳",
 "intro":"چکیده ۲-۳ خطی",
 "body":"متن ۱۲۰۰-۱۸۰۰ کلمه؛ پاراگراف‌ها با خط خالی؛ سرتیترها با خطی که با ## شروع شود",
 "faqs":[["سؤال۱","پاسخ۱"],["سؤال۲","پاسخ۲"],["سؤال۳","پاسخ۳"]]
}`;

const TOPICS = [
  ['حقوقی و قانون کار', 'ترک کار کارگر؛ تعهدات کارفرما و مراحل قانونی'],
  ['حقوقی و قانون کار', 'قرارداد دورکاری؛ نکات حقوقی کار از راه دور'],
  ['حقوقی و قانون کار', 'بیمه حوادث کار؛ مسئولیت کارفرما'],
  ['حقوقی و قانون کار', 'فسخ قرارداد کار؛ حقوق کارگر و کارفرما'],
  ['مالیات', 'معافیت‌های مالیاتی مشاغل کوچک ۱۴۰۵'],
  ['مالیات', 'جریمه دیرکرد اظهارنامه؛ بخشودگی‌ها'],
  ['مالیات', 'مالیات بر درآمد اجاره ملک'],
  ['حسابداری', 'اسناد هزینه قابل قبول مالیاتی'],
  ['منابع انسانی', 'آیین‌نامه انضباطی کارگاه؛ چارچوب قانونی'],
  ['مدیریت', 'قرارداد محرمانگی برای کارکنان'],
];

const CONTRACT_QUEUE = [
  { title: 'قرارداد مبایع‌نامه خودرو (نمایشگاه‌های خودرو)', type: 'مبایع‌نامه', industry: 'نمایشگاه‌های خودرو' },
  { title: 'قرارداد اجاره دفتر کار (مشاوران املاک)', type: 'اجاره', industry: 'مشاوران املاک' },
  { title: 'قرارداد مشارکت مدنی (رستوران‌ها)', type: 'مشارکت مدنی', industry: 'رستوران‌ها' },
  { title: 'قرارداد جعاله (بازاریابی دیجیتال)', type: 'جعاله', industry: 'بازاریابی دیجیتال' },
  { title: 'قرارداد اجاره ماشین‌آلات و تجهیزات (شرکت‌های عمرانی)', type: 'اجاره', industry: 'شرکت‌های عمرانی' },
  { title: 'قرارداد پیمانکاری نصب و نگهداری آسانسور', type: 'پیمانکاری', industry: 'آسانسور و بالابر' },
  { title: 'قرارداد خدمات نظافت ساختمان‌های اداری', type: 'خدمات', industry: 'خدمات نظافتی' },
  { title: 'قرارداد تأمین و پخش مواد غذایی (فروشگاه‌های زنجیره‌ای)', type: 'تأمین کالا', industry: 'پخش مواد غذایی' },
  { title: 'قرارداد طراحی و مدیریت شبکه‌های اجتماعی', type: 'خدمات', industry: 'دیجیتال مارکتینگ' },
  { title: 'قرارداد نماینده بیمه (شعب و نمایندگی‌ها)', type: 'نمایندگی', industry: 'بیمه' },
  { title: 'قرارداد پشتیبانی فنی و نگهداری سرور', type: 'پشتیبانی و نگهداری', industry: 'فناوری اطلاعات' },
  { title: 'قرارداد آموزشگاه آزاد با هنرجو', type: 'آموزش', industry: 'آموزشگاه‌های آزاد' },
];


function validArticle(a) {
  if (!a || !a.title || !a.body || a.body.length < 800) return 'too short';
  if (/bolt\.new/.test(a.body)) return 'foreign brand';
  if (/۱۴۰[^۰-۹]|۱۴۵[^۰-۹]/.test(a.body)) return 'broken year';
  if (!a.meta_title || !a.meta_description) return 'missing meta';
  return null;
}

function parseJSON(text) {
  const m = text.match(/\{[\s\S]*\}/);
  return m ? JSON.parse(m[0]) : null;
}

async function logJob(job, topic, status, provider, error, meta) {
  // سه لایه تلاش تا ردیف لاگ هرگز گم نشود (ستون error ممکن است varchar کوچک باشد یا topic NOT NULL)
  const safeTopic = topic || job;
  const tries = [
    { job, topic, status, provider, error, meta },
    { job, topic: safeTopic, status, provider, error: String(error ?? '').slice(0, 180), meta: null },
    { job, topic: safeTopic, status },
  ];
  let dbErr = null;
  for (const payload of tries) {
    const r = await supabase.from('content_jobs').insert(payload);
    if (!r.error) return;
    dbErr = r.error;
  }
  console.error('[logJob]', dbErr.message); // لاگ نباید هرگز خودِ ورک‌فلو را بیندازد
}

async function runArticle() {
  const { data: existing } = await supabase.from('articles').select('title');
  const titles = (existing || []).map((a) => a.title);
  const pool = TOPICS.filter(([c, t]) => !titles.some((x) => x.includes(t.slice(0, 12))));
  const [category, topic] = (pool[0] || TOPICS[Math.floor(Math.random() * TOPICS.length)]);

  const user = `موضوع مقاله: «${topic}» — دسته: ${category}
عناوین موجود (تکراری ممنوع): ${titles.slice(0, 40).join(' | ')}
خروجی مطابق این اسکیما: ${ARTICLE_SCHEMA}`;

  const { text, provider } = await callAI(LAWYER, user);
  const a = parseJSON(text);
  const problem = validArticle(a);
  if (problem) throw new Error(`validation: ${problem}`);

  let body = `${a.intro}\n\n${a.body}`;
  if (a.faqs?.length) body += `\n\n## پرسش‌های پرتکرار\n` + a.faqs.map(([q, an]) => `**${q}**\n${an}`).join('\n\n');

  const { error } = await supabase.from('articles').insert({
    category: a.category || category,
    title: a.title,
    intro: a.intro,
    author: 'تیم کاربان',
    body,
    meta_title: a.meta_title,
    meta_description: a.meta_description,
    tags: a.tags,
  });
  if (error) throw new Error(error.message);

  await logJob('article', topic, 'success', provider, null, { title: a.title, meta_title: a.meta_title, meta_description: a.meta_description });
  await tg(`✅ مقاله جدید منتشر شد:\n«${a.title}»\nدسته: ${a.category}\nمتا: ${a.meta_description}\nارائه‌دهنده: ${provider}`);
}

async function runContracts() {
  // ۱) پر کردن قراردادهای ناقص
  const { data: incomplete } = await supabase.from('contracts').select('id,title,type,industry').or('body.is.null,body.eq.').limit(2);
  for (const c of incomplete || []) {
    const user = `متن کامل و حرفه‌ای «${c.title}» (نوع: ${c.type}، صنف: ${c.industry}) را با بندهای: طرفین، موضوع، تعهدات طرفین، فسخ، فورس‌ماژور، حل اختلاف و داوری، تبصره‌ها بنویس. پاراگراف‌ها با خط خالی، سرتیترها با ## . خروجی JSON: {"body":"..."}`;
    const { text, provider } = await callAI(LAWYER, user);
    const r = parseJSON(text);
    if (r?.body?.length > 500) {
      await supabase.from('contracts').update({ body: r.body }).eq('id', c.id);
      await tg(`✅ قرارداد ناقص تکمیل شد: «${c.title}» (${provider})`);
      await logJob('contracts', c.title, 'success', provider, null, null);
    }
  }

  // ۲) دو قرارداد جدید در هفته
  const { data: all } = await supabase.from('contracts').select('title');
  const have = (all || []).map((c) => c.title);
  const pending = CONTRACT_QUEUE.filter((q) => !have.includes(q.title)).slice(0, 2);
  for (const next of pending) {
    const user = `متن کامل «${next.title}» را مانند یک وکیل بنویس (بندهای استاندارد + تبصره). خروجی JSON: {"body":"...","summary":"خلاصه یک خطی"}`;
    const { text, provider } = await callAI(LAWYER, user);
    const r = parseJSON(text);
    if (r?.body?.length > 500) {
      await supabase.from('contracts').insert({ title: next.title, type: next.type, industry: next.industry, summary: r.summary || next.title, body: r.body });
      await tg(`✅ قرارداد جدید منتشر شد: «${next.title}» (${provider})`);
      await logJob('contracts', next.title, 'success', provider, null, null);
    }
  }
}

async function runRetry() {
  // ستون attempts ممکن است در جدول نباشد؛ دفاعی کوئری می‌زنیم
  let q = supabase.from('content_jobs').select('*').eq('status', 'failed').order('id').limit(2);
  const withAttempts = await q.lt('attempts', 4);
  let failed = withAttempts.data;
  if (withAttempts.error) {
    const fallback = await supabase.from('content_jobs').select('*').eq('status', 'failed').order('id').limit(2);
    failed = fallback.data;
    if (fallback.error) throw new Error(fallback.error.message);
  }
  for (const f of failed || []) {
    await supabase.from('content_jobs').update({ attempts: (f.attempts || 0) + 1 }).eq('id', f.id).then(({ error }) => { if (error) console.error('[attempts]', error.message); });
    try {
      if (f.job === 'article') await runArticle();
      else await runContracts();
      await supabase.from('content_jobs').update({ status: 'recovered' }).eq('id', f.id);
    } catch (e) {
      await tg(`⚠️ تلاش مجدد ${f.job} شکست خورد: ${String(e).slice(0, 200)}`);
    }
  }
}

const mode = process.argv[2] || 'article';
try {
  if (mode === 'article') await runArticle();
  else if (mode === 'contracts') await runContracts();
  else if (mode === 'retry') await runRetry();
} catch (e) {
  console.error(`❌ خطای ورک‌فلوی ${mode}:`, e);
  await logJob(mode, null, 'failed', null, String(e).slice(0, 500), null);
  await tg(`❌ ورک‌فلوی ${mode} شکست خورد؛ retry خودکار هر ۳ ساعت فعال است.\nخطا: ${String(e).slice(0, 500)}`);
  process.exit(1);
}
