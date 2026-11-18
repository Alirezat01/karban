/* دیسپچر یکپارچهٔ سرویس‌های هوش مصنوعی — یک تابع سرورلس، شش سرویس.
   علت: سقف پلن Hobby ورسل = حداکثر ۱۲ تابع در هر Deployment؛ با ۱۴ تابع انتشار رد می‌شد.
   فایل‌های handler با پیشوند «_» شمرده نمی‌شوند و فقط از همین‌جا import می‌شوند.
   URLها عیناً همان قبلی‌ها هستند: /api/ai/<endpoint> — اپ هیچ تغییری لازم ندارد. */

import cashflowRadar from './_cashflow-radar.js';
import contractAudit from './_contract-audit.js';
import legalChat from './_legal-chat.js';
import ocrScan from './_ocr-scan.js';
import taxDefense from './_tax-defense.js';
import voiceAssistant from './_voice-assistant.js';

const HANDLERS = {
  'cashflow-radar': cashflowRadar,
  'contract-audit': contractAudit,
  'legal-chat': legalChat,
  'ocr-scan': ocrScan,
  'tax-defense': taxDefense,
  'voice-assistant': voiceAssistant,
};

export default async function handler(req, res) {
  /* پارامتر مسیر داینامیک: req.query.endpoint (fallback: پارس از url) */
  let endpoint = (req.query && req.query.endpoint) || '';
  if (!endpoint || String(endpoint).includes('/')) {
    const m = String(req.url || '').match(/\/api\/ai\/([^/?#]+)/);
    endpoint = m ? decodeURIComponent(m[1]) : '';
  }

  const h = HANDLERS[endpoint];
  if (!h) {
    return res.status(404).json({ ok: false, error: `unknown endpoint: ${endpoint || '(empty)'}` });
  }
  return h(req, res);
}

export const config = { maxDuration: 60 };
