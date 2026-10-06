/* ═════════════════════════════════════════════════════════════════════
   کاربان — دستیار حقوقی چت‌بات (Phase 3.2)
   ─────────────────────────────────────────────────────────────────
   POST /api/ai-chat
     body: { question: string, history?: [{role, content}] }
     → { ok, answer, citations: [{law_id, article, text}] }

   استراتژی RAG سبک:
   1. کلیدواژه‌های سوال را استخراج می‌کنیم
   2. در laws.json محلی جست‌وجو می‌کنیم (بدون embedding — ساده و سریع)
   3. ۳ ماده قانونی مرتبط + سوال را به LLM می‌دهیم
   4. LLM پاسخ می‌دهد با استناد به مواد
   ═════════════════════════════════════════════════════════════════════ */

const LAWS = {
  'قانون کار': [
    { article: 'ماده ۷', text: 'قرارداد کار ممکن است برای کار غیرمحدود یا محدود (برای کار معین یا مدت معین) منعقد شود.' },
    { article: 'ماده ۱۰', text: 'قرارداد کار باید کتبی منعقد شود. عدم رعایت شکل مکتوب قرارداد کارفرما را از پذیرش ادعا معاف نمی‌کند.' },
    { article: 'ماده ۲۴', text: 'قرارداد کار ممکن است با رضایت طرفین فسخ شود.' },
    { article: 'ماده ۲۷', text: 'کارفرما حق ندارد بدون اسباب موجه قرارداد را فسخ کند.' },
    { article: 'ماده ۳۴', text: 'مزد کارگر باید قبل از عمل تعیین شود.' },
    { article: 'ماده ۴۱', text: 'حداقل مزد سالانه توسط شورای عالی کار تعیین می‌شود.' },
    { article: 'ماده ۵۱', text: 'بیمه تأمین اجتماعی از روز اول استخدام الزامی است.' },
    { article: 'ماده ۵۹', text: 'سنوات خدمت به ازای هر سال معادل یک ماه آخرین حقوق است.' },
  ],
  'تأمین اجتماعی': [
    { article: 'ماده ۳', text: 'بیمه تأمین اجتماعی شامل بیمه‌های بازنشستگی، ازکارافتادگی، بیمه‌های درمان و خانواده است.' },
    { article: 'ماده ۳۸', text: 'حق بیمه سهم کارگر ۷٪ و سهم کارفرما ۲۳٪ مزد یا حقوق است.' },
    { article: 'ماده ۷۷', text: 'بازنشستگی پس از ۳۰ سال سابقه پرداخت حق بیمه برای مردان و ۲۰ سال برای زنان ممکن است.' },
  ],
  'مالیات': [
    { article: 'ماده ۱۳۱', text: 'مالیات مشاغل پلکانی ۱۵ تا ۳۵ درصد است پس از کسر معافیت سالانه.' },
    { article: 'ماده ۸۴', text: 'مالیات بر ارزش افزوده ۱۰ درصد است (قانون مالیات‌های مستقیم).' },
    { article: 'ماده ۱۶۹', text: 'صاحبان مشاغل موظف به ارائه معاملات فصلی خود هستند.' },
  ],
};

function searchLaws(question) {
  const q = question.toLowerCase();
  const hits = [];
  for (const [lawName, articles] of Object.entries(LAWS)) {
    for (const a of articles) {
      const text = (lawName + ' ' + a.article + ' ' + a.text).toLowerCase();
      let score = 0;
      for (const word of q.split(/\s+/)) {
        if (word.length < 2) continue;
        if (text.includes(word)) score += 2;
        if (lawName.includes(word)) score += 5;
      }
      if (score > 0) hits.push({ law_id: lawName, article: a.article, text: a.text, score });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 4);
}

function buildPrompt(question, citations, history) {
  const ctx = citations.length
    ? 'مواد قانونی مرتبط:\n' + citations.map((c) => `- ${c.law_id} ${c.article}: ${c.text}`).join('\n')
    : '';
  const historyStr = (history || []).slice(-4).map((m) => `${m.role === 'user' ? 'کاربر' : 'دستیار'}: ${m.content}`).join('\n');
  return `تو دستیار حقوقی کاربان هستی. به سؤال کاربر پاسخ بده و به مواد قانونی استناد کن.

${ctx}

${historyStr ? 'گفت‌وگوی قبلی:\n' + historyStr : ''}

سؤال کاربر: ${question}

پاسخ را به فارسی، روشن و کاربردی بده. اگر به ماده قانونی استناد می‌کنی، نام آن را ذکر کن (مثلاً: «ماده ۷ قانون کار»).
اگر سؤال خارج از حوزه حقوق، کار و مالیات است، مودبانه بگو که فقط در این حوزه‌ها پاسخ می‌دهی.
هرگز توصیه حقوقی قطعی نده — هم بنویس «برای پرونده خاص به مشاور مراجعه کنید».`;
}

let _zai = null;
async function getZai() {
  if (_zai) return _zai;
  const ZAI = (await import('z-ai-web-dev-sdk')).default;

  /* راه ۱: کانفیگ از env vars (پایدار روی Vercel) */
  const token = process.env.ZAI_TOKEN;
  const userId = process.env.ZAI_USER_ID;
  const chatId = process.env.ZAI_CHAT_ID;
  if (token && userId && chatId) {
    _zai = new ZAI({ baseUrl: 'https://internal-api.z.ai/v1', apiKey: 'Z.ai', token, userId, chatId });
    return _zai;
  }

  /* راه ۲: SDK پیش‌فرض (نیاز به .z-ai-config دارد) */
  _zai = await ZAI.create();
  return _zai;
}

async function callZai(prompt) {
  const zai = await getZai();
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: 'تو دستیار حقوقی کاربان هستی. پاسخ‌های کوتاه و کاربردی به فارسی بده.' },
      { role: 'user', content: prompt },
    ],
    thinking: { type: 'disabled' },
  });
  return completion.choices?.[0]?.message?.content || '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }
  const { question, history } = req.body || {};
  if (!question || typeof question !== 'string' || question.trim().length < 3) {
    return res.status(400).json({ ok: false, error: 'سؤال بسیار کوتاه است' });
  }

  try {
    const citations = searchLaws(question);
    const prompt = buildPrompt(question, citations, history);
    const answer = await callZai(prompt);
    return res.json({ ok: true, answer, citations });
  } catch (e) {
    console.error('ai-chat failed', e.message);
    return res.status(502).json({ ok: false, error: 'پاسخ‌گویی ناموفق بود؛ دوباره تلاش کنید', detail: e.message });
  }
}

export const config = { maxDuration: 30 };
