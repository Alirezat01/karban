/* ═══════════════════════════════════════════════════════════════════════════
   موتور شفاف‌سازی خطا — هر خطای سیستمی به «زبان کاربر» ترجمه می‌شود
   ─────────────────────────────────────────────────────────────────────────
   هدف (درخواست مالک): وقتی «ذخیره نشد» یا خطا می‌آید، کاربر بفهمد
     ۱) مشکل از ورودی خودش است (کدام فیلد، چرا) یا
     ۲) مشکل سیستمی است — و بتواند همان را با یک کلیک به پشتیبانی اعلام کند.
   ساختار خروجی: { title, reason, hint?, code?, report }
     report = متن آمادهٔ کپی/تیکت با پیام فنی و صفحه و زمان — بدون اصطلاح فنی الزامی.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface FriendlyError {
  title: string;    // یک خط — چه اتفاقی افتاد
  reason: string;   // دلیل — چرا
  hint?: string;    // کاربر چه کند
  code?: string;    // کد فنی (برای پشتیبانی)
  raw: string;      // پیام فنی خام
  report: string;   // متن آمادهٔ گزارش به پشتیبانی
}

/* پیام‌های گارد خودِ اپ فارسی‌اند — تشخیص: حاوی حروف فارسی و خط‌تیرهٔ توضیح */
function isPersianGuardMessage(s: string): boolean {
  return /[\u0600-\u06FF]/.test(s) && s.length > 12;
}

interface Rule { test: RegExp; title: string; reason: string; hint?: string }

/* نقشهٔ کدها/الگوها → جملهٔ انسانی */
const RULES: Rule[] = [
  {
    test: /23505|unique/i,
    title: 'اطلاعات تکراری است',
    reason: 'همین اطلاعات قبلاً ثبت شده و سیستم اجازهٔ ثبت دوباره نمی‌دهد.',
    hint: 'اگر رکورد قبلی اشتباه است، همان را ویرایش کنید — نه اینکه دوباره بسازید.',
  },
  {
    test: /23503|foreign key|violates foreign/i,
    title: 'به اطلاعات دیگری وابسته است',
    reason: 'یکی از موارد انتخاب‌شده (مثلاً طرف‌حساب یا حساب) در سیستم پیدا نشد یا حذف شده.',
    hint: 'مقادیر کشویی را دوباره انتخاب کنید و ذخیره را تکرار کنید.',
  },
  {
    test: /23502|null value/i,
    title: 'یک فیلد الزامی خالی مانده',
    reason: 'یکی از فیلدهای لازم پر نشده است.',
    hint: 'فیلدهای ستاره‌دار را بررسی کنید.',
  },
  {
    test: /23514|check constraint/i,
    title: 'مقدار یکی از فیلدها مجاز نیست',
    reason: 'مقدار واردشده با قواعد سیستم نمی‌خواند (مثلاً قالب شناسهٔ صیادی یا نوع پرداخت‌کننده).',
    hint: 'مقادیر را با راهنمای فیلد مطابقت دهید.',
  },
  {
    test: /42501|row-level security|permission denied|PGRST|401|403/i,
    title: 'دسترسی ندارید',
    reason: 'نقش کاربری شما اجازهٔ این کار را در این کسب‌وکار ندارد.',
    hint: 'اگر فکر می‌کنید باید دسترسی داشته باشید، به مالک کسب‌وکار یا پشتیبانی اطلاع دهید.',
  },
  {
    test: /42883|could not find the function|schema cache|does not exist in the schema/i,
    title: 'امکان مربوطه هنوز نصب نیست',
    reason: 'بخشی از به‌روزرسانی (فایل SQL) هنوز در دیتابیس اجرا نشده است.',
    hint: 'فایل SQL مربوط به آخرین بسته را در SQL Editor اجرا کنید و صفحه را تازه‌سازی کنید.',
  },
  {
    test: /42P01|relation .* does not exist/i,
    title: 'جدول مورد نیاز موجود نیست',
    reason: 'مایگریشن مربوطه روی دیتابیس اجرا نشده است.',
    hint: 'زنجیرهٔ SQL بستهٔ فعال را به ترتیب اجرا کنید.',
  },
  {
    test: /22P02|invalid input syntax/i,
    title: 'قالب مقدار اشتباه است',
    reason: 'مقداری که وارد شده در قالب درست نیست (مثلاً عدد در جای تاریخ).',
  },
  {
    test: /22001|too long|value too long/i,
    title: 'متن از حد مجاز بلندتر است',
    reason: 'یکی از متن‌ها بیشتر از اندازهٔ مجاز است — کوتاهش کنید.',
  },
  {
    test: /failed to fetch|networkerror|load failed|ERR_NETWORK|internet/i,
    title: 'ارتباط با سرور برقرار نشد',
    reason: 'درخواست به سرور نرسید — معمولاً قطعی یا کندی اینترنت.',
    hint: 'اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.',
  },
  {
    test: /jwt|expired|invalid claim|token/i,
    title: 'نشست شما منقضی شده',
    reason: 'مدت ورود شما به سیستم به پایان رسیده است.',
    hint: 'خارج و دوباره وارد شوید.',
  },
  {
    test: /quota|rate limit|too many/i,
    title: 'درخواست‌ها بیش از حد مجاز است',
    reason: 'سیستم موقتاً محدود شده — کمی صبر کنید.',
  },
  {
    test: /deadlock|57P01|terminating|lock/i,
    title: 'دیتابیس موقتاً شلوغ است',
    reason: 'تراکنش هم‌زمان دیگری همین داده را گرفته و عملیات رد شد.',
    hint: 'چند لحظه بعد دوباره ذخیره کنید.',
  },
];

/** ترجمهٔ هر خطای ممکن به زبان کاربر */
export function friendlyError(e: unknown, fallback = 'عملیات ناموفق بود'): FriendlyError {
  const raw = (() => {
    if (e instanceof Error) return e.message || e.name;
    if (typeof e === 'string') return e;
    /* خطاهای ساپابیس معمولاً Error نیستند — آبجکت ساده با message/details/hint هستند */
    if (e && typeof e === 'object') {
      const o = e as { message?: unknown; error_description?: unknown; msg?: unknown };
      if (typeof o.message === 'string' && o.message.trim()) return o.message;
      if (typeof o.error_description === 'string' && o.error_description.trim()) return o.error_description;
      if (typeof o.msg === 'string' && o.msg.trim()) return o.msg;
    }
    try { return JSON.stringify(e) ?? ''; } catch { return String(e ?? ''); }
  })();
  const code = (() => {
    const anyE = e as { code?: string; details?: string; hint?: string } | null;
    return (anyE && typeof anyE === 'object' && anyE.code && typeof anyE.code === 'string') ? anyE.code : undefined;
  })();
  const haystack = `${raw} ${code ?? ''}`;

  let hit: Rule | undefined;
  for (const r of RULES) { if (r.test.test(haystack)) { hit = r; break; } }

  let title: string;
  let reason: string;
  let hint: string | undefined;

  if (hit) {
    title = hit.title;
    reason = raw && isPersianGuardMessage(raw) && !/^[A-Za-z0-9\s:._-]+$/.test(raw)
      ? raw /* پیام فارسی خود سیستم دقیق‌تر است */
      : hit.reason;
    hint = hit.hint;
  } else if (isPersianGuardMessage(raw)) {
    /* پیام گارد فارسی اپ — خودش گویاست */
    title = fallback;
    reason = raw;
  } else {
    title = fallback;
    reason = raw ? `پیام سیستم: ${raw}` : 'دلیل نامشخص — گزارش را برای پشتیبانی بفرستید.';
  }

  const report = [
    '🔴 گزارش خطا از کاربان',
    `اتفاق: ${title}`,
    `دلیل: ${reason}`,
    code ? `کد: ${code}` : null,
    `پیام فنی: ${raw || '—'}`,
    `صفحه: ${typeof window !== 'undefined' ? window.location.pathname : '—'}`,
    `زمان: ${new Date().toLocaleString('fa-IR')}`,
  ].filter(Boolean).join('\n');

  return { title, reason, hint, code, raw, report };
}
