// Karban Content Engine — weekly AI legal content with provider fallback
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const tg = (text) =>
  fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text }),
  }).catch(() => {});

/* ── زنجیره ارائه‌دهنده‌ها (همه رایگان) ── */
const providers = [
  { name: 'gemini', base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash', key: process.env.GEMINI_API_KEY },
  { name: 'github', base: 'https://models.inference.ai.azure.com', model: 'gpt-4o', key: process.env.GITHUB_TOKEN },
  { name: 'groq', base: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', key: process.env.GROQ_API_KEY },
  { name: 'openrouter', base: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.3-70b-instruct:free', key: process.env.OPENROUTER_API_KEY },
].filter((p) => p.key);

async function callAI(system, user) {
  let lastErr = '';
  for (const p of providers) {
    try {
      const res = await fetch(`${p.base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.key}` },
        body: JSON.stringify({ model: p.model, temperature: 0.7, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
      });
      if (!res.ok) throw new Error(`${p.name} ${res.status}`);
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error(`${p.name} empty`);
      return { text, provider: p.name };
    } catch (e) {
      lastErr = String(e);
    }
  }
  throw new Error(lastErr || 'no provider available');
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
  { title: 'قرارداد مبایعنامه خودرو (نمایشگاه‌های خودرو)', type: 'مبایعنامه', industry: 'نمایشگاه‌های خودرو' },
  { title: 'قرارداد اجاره دفتر کار (مشاوران املاک)', type: 'اجاره', industry: 'مشاوران املاک' },
  { title: 'قرارداد مشارکت مدنی (رستوران‌ها)', type: 'مشارکت مدنی', industry: 'رستوران‌ها' },
  { title: 'قرارداد جعاله (بازاریابی دیجیتال)', type: 'جعاله', industry: 'بازاریابی دیجیتال' },
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
  await supabase.from('content_jobs').insert({ job, topic, status, provider, error, meta });
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

  // ۲) یک قرارداد جدید در هفته
  const { data: all } = await supabase.from('contracts').select('title');
  const have = (all || []).map((c) => c.title);
  const next = CONTRACT_QUEUE.find((q) => !have.includes(q.title));
  if (!next) return;
  const user = `متن کامل «${next.title}» را مانند یک وکیل بنویس (بندهای استاندارد + تبصره). خروجی JSON: {"body":"...","summary":"خلاصه یک خطی"}`;
  const { text, provider } = await callAI(LAWYER, user);
  const r = parseJSON(text);
  if (r?.body?.length > 500) {
    await supabase.from('contracts').insert({ title: next.title, type: next.type, industry: next.industry, summary: r.summary || next.title, body: r.body });
    await tg(`✅ قرارداد جدید منتشر شد: «${next.title}» (${provider})`);
    await logJob('contracts', next.title, 'success', provider, null, null);
  }
}

async function runRetry() {
  const { data: failed } = await supabase.from('content_jobs').select('*').eq('status', 'failed').lt('attempts', 4).order('id').limit(2);
  for (const f of failed || []) {
    await supabase.from('content_jobs').update({ attempts: f.attempts + 1 }).eq('id', f.id);
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
  await logJob(mode, null, 'failed', null, String(e).slice(0, 500), null);
  await tg(`❌ ورک‌فلوی ${mode} شکست خورد؛ retry خودکار هر ۳ ساعت فعال است.\nخطا: ${String(e).slice(0, 300)}`);
  process.exit(1);
}
