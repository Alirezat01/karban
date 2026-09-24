# زنجیرهٔ مایگریشن حسابداری کاربان — ترتیب قطعی اجرا از صفر

این پوشه **منبع واحد حقیقت** زنجیرهٔ SQL حسابداری است. برای بازسازی کامل دیتابیس حسابداری از صفر (یا اطمینان از اینکه مخزن چیزی کم ندارد)، فایل‌ها را **دقیقاً به همین ترتیب** در SQL Editor سوپابیس اجرا کنید. هیچ فایلی نباید حذف، جابه‌جا یا دوباره اجرا شود؛ هر فایل POSTCHECK داخلی دارد و در صورت تکرار یا نبودِ پیش‌نیاز، خودش خطا می‌دهد.

| # | فایل | نقش |
|---|------|-----|
| ۰ | `00-fix-legacy-expenses.sql` | اصلاح ردیف‌های legacy قبل از نصب موتور |
| ۱ | `M120000_acc_canonical_engine.sql` | موتور کانونی سند (Posting Engine) + بند ۱۳ (قواعد پرداخت‌کننده) + acc_entry_counters |
| ۲ | `M130000_acc_counter_chart_hardening.sql` | سخت‌سازی شمارنده‌ها و کدینگ |
| ۳ | `M140000_acc_normalization_integrity.sql` | نرمال‌سازی و قیود صحت |
| ۴ | `M150000_acc_fiscal_rpc_lockdown.sql` | بستن INSERT/UPDATE مستقیم روی acc_journal(_lines)/acc_fiscal_years/acc_periods/acc_entry_counters — همه‌چیز فقط RPC |
| ۵ | `M160000_acc_checks_sayadi.sql` | چک صیادی — وضعیت‌ها و RPCها |
| ۶ | `M170000_acc_payable_and_backup.sql` | پرداختنی اشخاص (acc_settle_person_payable) + بکاپ/ری‌استور تراکنشی |
| ۷ | `M180000_acc_frontend_support.sql` | پشتیبانی فرانت برای موتور کانونی |
| ۸ | `M190000_acc_purge_guard_escape.sql` | دریچهٔ purge برای گاردهای حفاظت داده (پاک‌سازی مالک‌محور بدون شکستن گاردها) |
| ۹ | `M200000_acc_restore_purge_resilience.sql` | restore idempotent + دریچهٔ گارد فاکتور + بذر مجدد مراکز هزینه + تریگر sync |
| ۱۰ | `M210000_acc_bank_sheba.sql` | ستون sheba حساب‌ها + قید IR+۲۴ رقم |

## نکته‌های اجرا

- اجرا فقط با نقش **owner** پروژهٔ سوپابیس (SQL Editor).
- هر فایل با `BEGIN … COMMIT` و بلوک POSTCHECK است؛ اگر POSTCHECK خطا داد، تراکنش کامل برمی‌گردد — اصلاح نکنید، اول علت را پیدا کنید.
- فایل‌های `supabase/migrations/2026*.sql` مربوط به بخش عمومی سایت (خدمات/قراردادها/ادمین) هستند و جدا از این زنجیره‌اند.
- بعد از M210000، ستون‌های `account_number` و `sheba` در جدول `acc_accounts` موجودند و فرانت (بانک و صندوق + پانوشت صورتحساب) خودکار فعال می‌شود.
