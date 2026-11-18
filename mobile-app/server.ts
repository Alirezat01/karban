import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('کلید GEMINI_API_KEY در تنظیمات سرور یافت نشد.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// 1. Smart AI OCR Scanner for Paper Invoices & 16-Digit Sayadi Checks
app.post('/api/ai/ocr-scan', async (req, res) => {
  try {
    const { imageBase64, mimeType, scanMode, manualHint } = req.body;
    const ai = getAiClient();

    const systemInstruction = `شما موتور هوش مصنوعی اسکن اپتیکال (OCR) سامانه حسابداری و حقوقی «کاربان» (Karban) هستید.
وظیفه شما استخراج دقیق اطلاعات مالی از تصویر یا مشخصات «فاکتور رسمی/کاغذی» یا «چک صیادی ۱۶ رقمی» ایران است.
همواره مبالغ را به ریال، تاریخ را به شمسی (مثلاً ۱۴۰۵/۰۸/۱۵) و شناسه صیادی را ۱۶ رقمی استخراج کنید. اگر تصویر نمونه یا توضیح متنی ارسال شده، اطلاعات کامل، واقع‌گرایانه و منطبق با استاندارد مالیاتی ایران استخراج نمایید.`;

    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
    if (imageBase64 && mimeType) {
      const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
      parts.push({
        inlineData: {
          mimeType,
          data: cleanBase64,
        },
      });
    }
    parts.push({
      text: `نوع سند: ${scanMode === 'check' ? 'چک صیادی بانکی' : 'فاکتور خرید/فروش یا رسید هزینه'}. ${
        manualHint ? `توضیحات تکمیلی کاربر: ${manualHint}` : 'لطفاً تمام فیلدهای سند را با دقت استخراج کنید.'
      }`,
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            docType: { type: Type.STRING, description: 'invoice or check' },
            title: { type: Type.STRING, description: 'عنوان سند یا خلاصه فاکتور/چک' },
            partyName: { type: Type.STRING, description: 'نام طرف حساب، فروشنده یا صادرکننده چک' },
            nationalOrEcoId: { type: Type.STRING, description: 'کد ملی یا شناسه اقتصادی ۱۰ یا ۱۱ رقمی' },
            dateJalali: { type: Type.STRING, description: 'تاریخ صدور یا سررسید به شمسی مثل ۱۴۰۵/۰۸/۲۵' },
            totalAmountRial: { type: Type.NUMBER, description: 'مبلغ کل به ریال' },
            vatAmountRial: { type: Type.NUMBER, description: 'مبلغ مالیات ارزش افزوده (۱۰ درصد) به ریال' },
            sayadiId: { type: Type.STRING, description: 'شناسه ۱۶ رقمی صیادی (در صورت چک بودن)' },
            bankName: { type: Type.STRING, description: 'نام بانک صادرکننده چک یا تراکنش' },
            sayadiStatusSummary: { type: Type.STRING, description: 'وضعیت پیشنهادی استعلام و اعتبار سند' },
            suggestedDebitAccount: { type: Type.STRING, description: 'حساب بدهکار پیشنهادی در دفتر روزنامه' },
            suggestedCreditAccount: { type: Type.STRING, description: 'حساب بستانکار پیشنهادی در دفتر روزنامه' },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  unitPriceRial: { type: Type.NUMBER },
                  totalRial: { type: Type.NUMBER },
                },
              },
            },
          },
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json({ ok: true, result: parsed });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'خطا در پردازش تصویر توسط هوش مصنوعی';
    res.status(500).json({ ok: false, error: msg });
  }
});

// 2. Automatic Tax & Labor Defense Brief Generator (لایحه دفاعیه مالیاتی و اداره کار)
app.post('/api/ai/tax-defense', async (req, res) => {
  try {
    const { topicType, taxpayerName, fiscalYear, claimedAmountRial, issueDescription, targetAuthority } = req.body;
    const ai = getAiClient();

    const systemInstruction = `شما وکیل پایه یک دادگستری، مشاور رسمی مالیاتی و کارشناس ارشد روابط کار در سامانه «کاربان» هستید.
وظیفه شما نگارش یک «لایحه دفاعیه رسمی، مستند به مواد قانونی و آماده چاپ» برای ارائه به هیئت‌های حل اختلاف مالیاتی (ماده ۲۴۴، ماده ۲۱۶، ماده ۲۵۱ مکرر، ماده ۱۶۹ و قانون پایانه‌های فروشگاهی و سامانه مودیان) یا هیئت‌های تشخیص و حل اختلاف اداره کار است.
خروجی باید به زبان فارسی رسمی، حقوقی، ساختارمند و با ذکر دقیق مواد قانونی، دلایل شکلی و ماهوی و خواسته نهایی باشد.`;

    const prompt = `درخواست تنظیم لایحه دفاعیه رسمی:
- حوزه پرونده: ${topicType || 'مالیاتی و سامانه مودیان'}
- مرجع رسیدگی: ${targetAuthority || 'هیئت حل اختلاف مالیاتی بدوی (ماده ۲۴۴)'}
- نام مودی / شرکت / کارفرما: ${taxpayerName || 'شرکت تجاری نمونه'}
- سال مالی / دوره مورد اعتراض: ${fiscalYear || '۱۴۰۴-۱۴۰۵'}
- مبلغ مورد اعتراض (ریال): ${claimedAmountRial ? Number(claimedAmountRial).toLocaleString('fa-IR') : 'مشخص نشده'}
- شرح ماوقع و برگ تشخیص / ادعا: ${issueDescription}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            briefTitle: { type: Type.STRING, description: 'عنوان رسمی لایحه دفاعیه' },
            legalCitations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'فهرست مواد قانونی و بخشنامه‌های مستند (مثلاً ماده ۹۷ ق.م.م، ماده ۲۳۸ و ...)',
            },
            formalDefenseBody: {
              type: Type.STRING,
              description: 'متن کامل و رسمی لایحه دفاعیه با مقدمات، دفاعیات شکلی، دفاعیات ماهوی و نتیجه‌گیری',
            },
            winProbabilityPercent: {
              type: Type.NUMBER,
              description: 'درصد شانس موفقیت برآوردی با توجه به مستندات (۰ تا ۱۰۰)',
            },
            requiredAttachments: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'مدارک و پیوست‌های الزامی که باید همراه لایحه تحویل هیئت شود',
            },
            strategicTip: {
              type: Type.STRING,
              description: 'نکته کلیدی و استراتژیک برای جلسه دفاع حضوری',
            },
          },
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json({ ok: true, result: parsed });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'خطا در تولید لایحه دفاعیه';
    res.status(500).json({ ok: false, error: msg });
  }
});

// 3. Clause-by-Clause Contract Risk Audit (تحلیل‌گر هوشمند ریسک قرارداد)
app.post('/api/ai/contract-audit', async (req, res) => {
  try {
    const { contractText, userRole } = req.body;
    const ai = getAiClient();

    const systemInstruction = `شما تحلیل‌گر ارشد قراردادهای تجاری، کار و پیمانکاری در پلتفرم «کاربان» هستید.
متن قرارداد ارسالی را از دیدگاه حفظ منافع «${userRole || 'کارفرما / طرف اول'}» بر اساس قانون مدنی، قانون کار و قانون تجارت ایران کالبدشکافی کنید.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `متن قرارداد جهت تحلیل ریسک:\n${contractText}`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            safetyScore: { type: Type.NUMBER, description: 'امتیاز امنیت حقوقی قرارداد از ۰ تا ۱۰۰' },
            overallSummary: { type: Type.STRING, description: 'جمع‌بندی کلی وضعیت حقوقی قرارداد' },
            riskyClauses: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  clauseTitle: { type: Type.STRING },
                  severity: { type: Type.STRING, description: 'high, medium, low' },
                  riskExplanation: { type: Type.STRING },
                  suggestedRewrite: { type: Type.STRING, description: 'متن جایگزین ایمن و استاندارد' },
                },
              },
            },
            missingClauses: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'بندهای مهمی که در قرارداد جا افتاده‌اند (مثل فورس‌ماژور، محرمانگی، شرط داوری و...)',
            },
          },
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json({ ok: true, result: parsed });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'خطا در تحلیل هوشمند قرارداد';
    res.status(500).json({ ok: false, error: msg });
  }
});

// 4. Contextual Legal, Tax & Accounting Chatbot
app.post('/api/ai/legal-chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    const ai = getAiClient();

    const systemInstruction = `شما دستیار هوشمند حقوقی، مالیاتی، بیمه تأمین اجتماعی و حسابداری «کاربان» (KarbanApp.ir) هستید.
پاسخ‌های شما باید کاملاً دقیق، مستند به قوانین جاری ایران (نرخ‌های مصوب ۱۴۰۵، ارزش افزوده ۱۰٪، قوانین سامانه مودیان، قانون کار و تأمین اجتماعی)، کاربردی و مختصر و مفید باشد.`;

    const contextText = Array.isArray(history)
      ? history.map((m: { role: string; text: string }) => `${m.role === 'user' ? 'کاربر' : 'کاربان'}: ${m.text}`).join('\n')
      : '';

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `${contextText ? `سابقه گفتگو:\n${contextText}\n\n` : ''}پرسش جدید کاربر: ${message}`,
      config: {
        systemInstruction,
      },
    });

    res.json({ ok: true, reply: response.text || 'پاسخی دریافت نشد.' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'خطا در ارتباط با مشاور هوشمند';
    res.status(500).json({ ok: false, error: msg });
  }
});

// 5. Predictive Cashflow & Tax/Check Deficit Radar
app.post('/api/ai/cashflow-radar', async (req, res) => {
  try {
    const { financialSnapshot } = req.body;
    const ai = getAiClient();

    const systemInstruction = `شما مدیر مالی هوشمند (AI CFO) پلتفرم «کاربان» هستید. بر اساس داده‌های نقدینگی، فاکتورهای فروش/خرید و چک‌های صیادی در جریان کسب‌وکار، پیش‌بینی ۳۰ روز آینده، ریسک برگشت چک یا کسری نقدینگی و راهکار عملیاتی ارائه دهید.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `داده‌های مالی زنده کسب‌وکار:\n${JSON.stringify(financialSnapshot, null, 2)}`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            liquidityStatus: { type: Type.STRING, description: 'وضعیت نقدینگی: ایمن، نیازمند مراقبت، یا بحرانی' },
            projected30DayNetRial: { type: Type.NUMBER, description: 'تراز خالص پیش‌بینی‌شده ۳۰ روز آینده به ریال' },
            riskAlerts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'هشدارهای سررسید چک، مالیات ارزش افزوده و کسری احتمالی',
            },
            actionableRecommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'اقدامات پیشنهادی فوری برای بهبود جریان نقدینگی و کاهش مالیات قانونی',
            },
          },
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json({ ok: true, result: parsed });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'خطا در تحلیل رادار نقدینگی';
    res.status(500).json({ ok: false, error: msg });
  }
});

// 6. Multi-Turn Voice Assistant & Financial/Navigation Copilot (Gemini 3.8 Flash & 3.1 Flash Lite)
app.post('/api/ai/voice-assistant', async (req, res) => {
  try {
    const { message, history, personaRole, fastMode, financialContext } = req.body;
    const ai = getAiClient();

    const selectedModel = fastMode ? 'gemini-3.1-flash-lite' : 'gemini-3.8-flash';

    const roleDescriptions: Record<string, string> = {
      cfo: 'شما «مدیر مالی هوشمند (AI CFO) و دستیار صوتی نئوبانک کاربان» هستید. وظیفه شما پاسخگویی سریع، دقیق و محترمانه به سوالات مالی، موجودی خزانه، چک‌های صیادی، سود و زیان و هدایت صوتی کاربر به بخش‌های مختلف اپلیکیشن است.',
      tax: 'شما «مشاور ارشد مالیاتی و متخصص سامانه مودیان و ارزش افزوده ۱۴۰۵ کاربان» هستید. به سوالات مالیاتی، نرخ ۱۰٪ ارزش افزوده، جرایم ماده ۱۶۹ و لوایح دفاعیه پاسخ دقیق بدهید.',
      legal: 'شما «وکیل پایه یک قراردادها و کارشناس روابط کار و تامین اجتماعی ۱۴۰۵ کاربان» هستید. به سوالات حقوقی، حق بیمه ۳۰٪، عیدی و سنوات و قراردادها پاسخ دقیق بدهید.',
    };

    const systemInstruction = `${roleDescriptions[personaRole || 'cfo'] || roleDescriptions.cfo}
اطلاعات مالی زنده کسب‌وکار کاربر در حال حاضر:
${JSON.stringify(financialContext || {}, null, 2)}

قوانین مهم پاسخگویی:
۱. تمام اعداد و مبالغ را به فارسی و با جداکننده سه‌رقمی (مثلاً ۳۷۴٬۵۵۰٬۰۰۰ تومان) بیان کنید.
۲. اگر کاربر دستور رفتن یا باز کردن یکی از بخش‌های برنامه را داد (مثلاً «برو به حسابداری»، «فاکتور صادر کن»، «چک‌های صیادی رو نشون بده»، «امضای دیجیتال»، «ماشین‌حساب حقوق»، «هوش مصنوعی»، «قفل برنامه»)، فیلد navigationAction را دقیق تنظیم کنید و در پاسخ صوتی اعلام کنید که آن بخش باز شد.
۳. پاسخ باید روان، مختصر (۲ تا ۴ جمله مفید برای خوانش صوتی) و کاملاً کاربردی باشد.`;

    const formattedHistory = Array.isArray(history)
      ? history
          .slice(-10)
          .map((m: { role: string; text: string }) => `${m.role === 'user' ? 'کاربر' : 'دستیار صوتی کاربان'}: ${m.text}`)
          .join('\n')
      : '';

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: `${formattedHistory ? `سابقه مکالمه چندمرحله‌ای:\n${formattedHistory}\n\n` : ''}فرمان صوتی یا پرسش جدید کاربر: ${message}`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            replyText: {
              type: Type.STRING,
              description: 'پاسخ فارسی، دقیق و خوش‌آهنگ جهت نمایش در چت و خوانش صوتی',
            },
            navigationAction: {
              type: Type.STRING,
              description:
                'یکی از مقادیر: none, dashboard, accounting, ai_studio, contracts, signpad, tools, lock_app, upgrade_modal',
            },
            actionLabel: {
              type: Type.STRING,
              description: 'عنوان کوتاه عملیات انجام‌شده، مثلاً: انتقال به بخش حسابداری و مودیان',
            },
            highlightedMetric: {
              type: Type.STRING,
              description: 'در صورت پرسش مالی، عدد یا شاخص کلیدی استخراج‌شده به فارسی (اختیاری)',
            },
          },
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json({ ok: true, result: parsed, modelUsed: selectedModel });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'خطا در پردازش فرمان صوتی';
    res.status(500).json({ ok: false, error: msg });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Karban SuperApp Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
