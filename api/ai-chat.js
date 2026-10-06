/* ═════════════════════════════════════════════════════════════════════
   کاربان — دستیار حقوقی چت‌بات (Phase 3.2)
   از Google Gemini API رایگان استفاده می‌کند.
   متغیر لازم: GEMINI_API_KEY
   ═════════════════════════════════════════════════════════════════════ */

const LAWS = {
  'قانون کار': [
    { article: 'ماده ۷', text: 'قرارداد کار ممکن است برای کار غیرمحدود یا محدود منعقد شود.' },
    { article: 'ماده ۱۰', text: 'قرارداد کار باید کتبی منعقد شود.' },
    { article: 'ماده ۲۴', text: 'قرارداد کار ممکن است با رضایت طرفین فسخ شود.' },
    { article: 'ماده ۲۷', text: 'کارفرما حق ندارد بدون اسباب موجه قرارداد را فسخ کند.' },
    { article: 'ماده ۳۴', text: 'مزد کارگر باید قبل از عمل تعیین شود.' },
    { article: 'ماده ۴۱', text: 'حداقل مزد سالانه توسط شورای عالی کار تعیین می‌شود.' },
    { article: 'ماده ۵۱', text: 'بیمه تأمین اجتماعی از روز اول استخدام الزامی است.' },
    { article: 'ماده ۵۹', text: 'سنوات خدمت به ازای هر سال معادل یک ماه آخرین حقوق است.' },
  ],
  'تأمین اجتماعی': [
    { article: 'ماده ۳', text: 'بیمه تأمین اجتماعی شامل بازنشستگی، ازکارافتادگی و درمان است.' },
    { article: 'ماده ۳۸', text: 'حق بیمه سهم کارگر ۷٪ و سهم کارفرما ۲۳٪ مزد است.' },
    { article: 'ماده ۷۷', text: 'بازنشستگی پس از ۳۰ سال سابقه برای مردان ممکن است.' },
  ],
  'مالیات': [
    { article: 'ماده ۱۳۱', text: 'مالیات مشاغل پلکانی ۱۵ تا ۳۵ درصد است.' },
    { article: 'ماده ۸۴', text: 'مالیات بر ارزش افزوده ۱۰ درصد است.' },
    { article: 'ماده ۱۶۹', text: 'صاحبان مشاغل موظف به ارائه معاملات فصلی هستند.' },
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

پاسخ را به فارسی، روشن و کاربردی بده. اگر به ماده قانونی استناد می‌کنی، نام آن را ذکر کن.
اگر سؤال خارج از حوزه حقوق، کار و مالیات است، مودبانه بگو که فقط در این حوزه‌ها پاسخ می‌دهی.
هرگز توصیه حقوقی قطعی نده — هم بنویس «برای پرونده خاص به مشاور مراجعه کنید».`;
}

const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY env var not set');
  }

  const url = `${GEMINI_BASE}?key=${apiKey}`;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }], role: 'user' }],
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 800,
    },
    systemInstruction: {
      parts: [{ text: 'تو دستیار حقوقی کاربان هستی. پاسخ‌های کوتاه و کاربردی به فارسی بده.' }],
    },
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Gemini API ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = await res.json();
  const content = j.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!content) {
    if (j.promptFeedback?.blockReason) {
      throw new Error(`محتوای مسدودشده توسط Gemini: ${j.promptFeedback.blockReason}`);
    }
    throw new Error('پاسخ خالی از Gemini');
  }
  return content;
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
    const answer = await callGemini(prompt);
    return res.json({ ok: true, answer, citations });
  } catch (e) {
    console.error('ai-chat failed', e.message);
    return res.status(502).json({ ok: false, error: 'پاسخ‌گویی ناموفق بود؛ دوباره تلاش کنید', detail: e.message });
  }
}

export const config = { maxDuration: 30 };
