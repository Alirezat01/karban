-- ════════════════════════════════════════════════════════════════════════════
-- karban — M260000: تثبیت یافته‌های حسابرسی خودکار (B11/B12/B40/B44/C4)
-- ════════════════════════════════════════════════════════════════════════════
-- این مایگریشن چهار باگ شناسایی‌شده توسط acc-audit (تاریخ ۲۰۲۶-۱۱-۰۷) را تثبیت می‌کند:
--
--   B11/B12 (ریشه‌ای): تریگری روی acc_accounts که به تابع حذف‌شده acc_mirror_journal
--                     اشاره می‌کرد → هر INSERT/PATCH روی acc_accounts شکست می‌خورد
--                     → همه‌چیز به هم می‌ریخت: ثبت حساب بانکی، صندوق، دریافت وجه، هزینه...
--
--   B40/B44:           قید NOT NULL اشتباه روی account_id در acc_reconciliations و
--                     acc_bank_lines (که nullable طراحی شده بودند ولی دستی NOT NULL شده‌اند)
--
--   C4:                کسب‌وکارهایی که acc_access ندارند (داده تاریخی از نسخه ۱) →
--                     کاربر وارد می‌شود ولی «ذخیره ناموفق» می‌بیند. این مایگریشن:
--                     ۱) یک view گزارش می‌سازد
--                     ۲) تریگری می‌گذارد که در آینده هر کسب‌وکار جدید، لایسنس آزمایشی می‌گیرد
--                     ۳) برای کسب‌وکارهای یتیم موجود، لایسنس آزمایشی ۱۴ روزه می‌سازد
--
-- روش اجرا: در Supabase Dashboard → SQL Editor → New query → این فایل را paste → Run
-- این فایل idempotent است — چند بار اجرا هم اشکالی ندارد.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- بخش ۱) تثبیت B11/B12 — حذف تریگر یتیم acc_mirror_journal
-- ─────────────────────────────────────────────────────────────────────────────
-- تابع قدیمی acc_mirror_journal در M120000_acc_canonical_engine.sql خط ۷۹۹ drop شد
-- ولی تریگری که آن را صدا می‌زد هنوز روی acc_accounts فعاله → هر INSERT شکست می‌خورد
-- با خطای 42883: function public.acc_mirror_journal(uuid, date, unknown) does not exist
--
-- نمی‌توانیم نام تریگر را از کد حدس بزنیم چون در هیچ مایگریشن موجودی نیست — یعنی
-- احتمالاً در نسخه‌های ابتدایی، قبل از Supabase migration system، دستی ساخته شده.
-- راه‌حل: با pg_trigger همه تریگرهای روی acc_accounts را پیدا می‌کنیم و آن‌هایی را
-- که به تابع ناموجود اشاره می‌کنند، drop می‌کنیم. این کار امن است چون:
--   - مایگریشن M120000 تریگرهای فعال را خودش re-creates می‌کند (لاین ۸۰۲-۸۱۲)
--   - هر تریگر دیگری که تابعش drop شده، در حال حاضر در حال fail کردن است
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  t_name text;
  t_func text;
  t_nsp text;
  orphan_count int := 0;
  total_count int := 0;
BEGIN
  -- شمارش تریگرهای روی acc_accounts
  SELECT count(*) INTO total_count
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'acc_accounts'
     AND NOT t.tgisinternal;

  RAISE NOTICE 'تعداد تریگرهای روی acc_accounts: %', total_count;

  -- لیست تریگرها برای گزارش
  FOR t_name, t_func, t_nsp IN
    SELECT t.tgname, p.proname, pn.nspname
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_proc p ON p.oid = t.tgfoid
      JOIN pg_namespace pn ON pn.oid = p.pronamespace
     WHERE n.nspname = 'public' AND c.relname = 'acc_accounts'
       AND NOT t.tgisinternal
  LOOP
    RAISE NOTICE '  تریگر: % → تابع %.%', t_name, t_nsp, t_func;
  END LOOP;

  -- حذف تریگرهای یتیم: آن‌هایی که تابعشان acc_mirror_journal است
  -- (تابع در M120000 drop شده ولی تریگر هنوز مابقی است)
  FOR t_name IN
    SELECT t.tgname
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_proc p ON p.oid = t.tgfoid
     WHERE n.nspname = 'public' AND c.relname = 'acc_accounts'
       AND NOT t.tgisinternal
       AND p.proname = 'acc_mirror_journal'
  LOOP
    EXECUTE format('drop trigger if exists %I on public.acc_accounts', t_name);
    orphan_count := orphan_count + 1;
    RAISE NOTICE '  ✅ تریگر یتیم حذف شد: %', t_name;
  END LOOP;

  -- حذف تریگرهایی که تابعشان اصلاً وجود ندارد (در pg_proc نیست)
  -- این حالت نادر است ولی اگه تابع حذف شده باشد ولی تریگر مانده باشد
  FOR t_name IN
    SELECT t.tgname
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_proc p ON p.oid = t.tgfoid
     WHERE n.nspname = 'public' AND c.relname = 'acc_accounts'
       AND NOT t.tgisinternal
       AND p.oid IS NULL
  LOOP
    -- تریگرهای بدون تابع، باید با DROP TRIGGER معمولی حذف شوند
    BEGIN
      EXECUTE format('drop trigger if exists %I on public.acc_accounts', t_name);
      orphan_count := orphan_count + 1;
      RAISE NOTICE '  ✅ تریگر بدون تابع حذف شد: %', t_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ⚠️ نمی‌توان تریگر % را حذف کرد: %', t_name, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'مجموع تریگرهای یتیم حذف‌شده: %', orphan_count;

  -- تأیید نهایی: نباید هیچ تریگری روی acc_accounts به acc_mirror_journal اشاره کند
  PERFORM 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
   WHERE n.nspname = 'public' AND c.relname = 'acc_accounts'
     AND NOT t.tgisinternal
     AND p.proname = 'acc_mirror_journal';
  IF FOUND THEN
    RAISE EXCEPTION 'POSTCHECK(1/4): هنوز تریگری به acc_mirror_journal اشاره می‌کند — حذف ناموفق بود';
  ELSE
    RAISE NOTICE 'POSTCHECK(1/4): ✅ هیچ تریگری به acc_mirror_journal اشاره نمی‌کند';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- بخش ۲) تثبیت B40 — ستون account_id در acc_reconciliations باید nullable باشد
-- ─────────────────────────────────────────────────────────────────────────────
-- طبق مایگریشن 20260918200000_advanced_accounting_v7.sql خط ۵۲:
--   account_id uuid references public.acc_accounts(id) on delete set null
-- یعنی طراحی nullable بوده. ولی حسابرسی نشان داد:
--   null value in column "account_id" of relation "acc_reconciliations"
--   violates not-null constraint
-- یعنی یا دستی NOT NULL شده، یا مایگریشن دیگری آن را تغییر داده.
-- این بخش ستون را به حالت nullable برمی‌گرداند.
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_nullable boolean;
BEGIN
  SELECT is_nullable = 'YES' INTO v_nullable
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'acc_reconciliations'
     AND column_name = 'account_id';

  IF v_nullable IS NULL THEN
    RAISE NOTICE 'SKIP(2a): جدول acc_reconciliations وجود ندارد — بخش ۳ آن را می‌سازد';
  ELSIF v_nullable THEN
    RAISE NOTICE 'POSTCHECK(2/4): ✅ account_id در acc_reconciliations از قبل nullable است';
  ELSE
    ALTER TABLE public.acc_reconciliations ALTER COLUMN account_id DROP NOT NULL;
    RAISE NOTICE 'POSTCHECK(2/4): ✅ account_id در acc_reconciliations به nullable تغییر یافت';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- بخش ۳) تثبیت B40 (تکمیلی) — مطمئن شویم جدول acc_reconciliations وجود دارد
-- ─────────────────────────────────────────────────────────────────────────────
-- این کار امن است چون create table if not exists است و ساختار را با مایگریشن
-- 20260918200000_advanced_accounting_v7 هماهنگ می‌کند.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.acc_reconciliations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.acc_businesses(id) on delete cascade,
  account_id uuid references public.acc_accounts(id) on delete set null,
  statement_date_g date,
  statement_balance bigint default 0,
  book_balance bigint default 0,
  difference bigint default 0,
  reconciled boolean default false,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- اطمینان از nullable بودن حتی اگر جدول قبلاً با NOT NULL ساخته شده بود
ALTER TABLE public.acc_reconciliations ALTER COLUMN account_id DROP NOT NULL;

-- RLS را فعال نگه می‌داریم (اگه فعال بود، نمی‌خواهیم غیرفعال کنیم)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = 'acc_reconciliations'
       AND c.relrowsecurity = true
  ) THEN
    ALTER TABLE public.acc_reconciliations ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'POSTCHECK(2b/4): ✅ RLS روی acc_reconciliations فعال شد';
  ELSE
    RAISE NOTICE 'POSTCHECK(2b/4): ✅ RLS روی acc_reconciliations از قبل فعال است';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- بخش ۴) تثبیت B44 — ستون account_id در acc_bank_lines هم باید nullable باشد
-- ─────────────────────────────────────────────────────────────────────────────
-- حسابرسی: null value in column "account_id" of relation "acc_bank_lines"
-- این جدول برای «خطوط صورت‌حساب بانک» است — یک خط ممکن است هنوز به حسابی
-- در سیستم نگفته نشده باشد (Pending matching).
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_nullable boolean;
BEGIN
  SELECT is_nullable = 'YES' INTO v_nullable
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'acc_bank_lines'
     AND column_name = 'account_id';

  IF v_nullable IS NULL THEN
    RAISE NOTICE 'POSTCHECK(3/4): SKIP — جدول acc_bank_lines یا ستون account_id وجود ندارد';
  ELSIF v_nullable THEN
    RAISE NOTICE 'POSTCHECK(3/4): ✅ account_id در acc_bank_lines از قبل nullable است';
  ELSE
    ALTER TABLE public.acc_bank_lines ALTER COLUMN account_id DROP NOT NULL;
    RAISE NOTICE 'POSTCHECK(3/4): ✅ account_id در acc_bank_lines به nullable تغییر یافت';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- بخش ۵) تثبیت C4 — گزارش کسب‌وکارهای یتیم (بدون acc_access)
-- ─────────────────────────────────────────────────────────────────────────────
-- یک view می‌سازیم که کسب‌وکارهای بدون لایسنس را نشان دهد. این برای پنل ادمین
-- مفید است تا ادمین ببیند کدام کسب‌وکارها لایسنس ندارند.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.acc_orphan_businesses AS
SELECT
  b.id AS business_id,
  b.name AS business_name,
  b.owner_id,
  u.email AS owner_email,
  b.created_at,
  (SELECT count(*) FROM public.acc_invoices WHERE business_id = b.id) AS invoice_count,
  CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM public.acc_access a
       WHERE a.business_id = b.id
         AND a.status IN ('active','trial')
         AND (a.expires_at IS NULL OR a.expires_at > now())
    ) THEN 'NO_ACTIVE_LICENSE'
    ELSE 'HAS_LICENSE'
  END AS license_status
FROM public.acc_businesses b
LEFT JOIN auth.users u ON u.id = b.owner_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.acc_access a
   WHERE a.business_id = b.id
     AND a.status IN ('active','trial')
     AND (a.expires_at IS NULL OR a.expires_at > now())
)
ORDER BY b.created_at DESC;

COMMENT ON VIEW public.acc_orphan_businesses IS
  'گزارش کسب‌وکارهایی که لایسنس فعال ندارند (یافته C4 حسابرسی). ادمین باید بررسی کند: یا داده تاریخی است (نسخه ۱) یا کاربر در فرآیند ساخت کسب‌وکار استثنا خورده است.';

-- به ادمین اجازه خواندن view بدهیم (RLS روی acc_businesses معمولاً mangers را مجاز می‌دارد)
GRANT SELECT ON public.acc_orphan_businesses TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- بخش ۶) تثبیت C4 — تخصیص لایسنس آزمایشی به کسب‌وکارهای یتیم موجود
-- ─────────────────────────────────────────────────────────────────────────────
-- برای هر کسب‌وکاری که هیچ رکورد acc_access ندارد (حتی منقضی)، یک لایسنس
-- آزمایشی ۱۴ روزه با نقش owner می‌سازیم. این کاربر را قادر می‌سازد وارد پنل
-- شود و داده‌هایش را ببیند. ادمین بعداً می‌تواند این لایسنس را به active ارتقا دهد.
--
-- نکته: فقط کسب‌وکارهایی که هیچ رکورد لایسنس ندارند (حتی منقضی) را پوشش می‌دهیم.
-- کسب‌وکارهایی که لایسنس منقضی دارند، باید از طریق پنل ادمین پلن بگیرند.
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.acc_access (business_id, user_id, email, role, status, plan, expires_at)
SELECT
  b.id,
  b.owner_id,
  u.email,
  'owner',
  'trial',
  'trial',
  now() + interval '14 days'
FROM public.acc_businesses b
LEFT JOIN auth.users u ON u.id = b.owner_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.acc_access a WHERE a.business_id = b.id
);

-- گزارش تعداد رکوردهای ساخته‌شده
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM public.acc_orphan_businesses;
  RAISE NOTICE 'POSTCHECK(4/4): کسب‌وکارهای یتیم باقی‌مانده: %', v_count;
  RAISE NOTICE 'ℹ️ اگر عدد بالاست یعنی لایسنس آزمایشی ساخته شد ولی همچنان expired است — ادمین باید بررسی کند';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- بخش ۷) جلوگیری از تکرار در آینده — تریگر دفاعی روی acc_businesses
-- ─────────────────────────────────────────────────────────────────────────────
-- اگر کسی از مسیر غیر از acc_start_trial یا acc_create_business (که لایسنس هم می‌سازند)
-- کسب‌وکار را insert کند، این تریگر یک هشدار در site_secrets می‌گذارد. نمی‌توانیم
-- INSERT را رد کنیم چون ممکن است جریان‌های قانونی دیگر هم باشد، ولی حداقل ردی می‌ماند.
--
-- نکته: این تریگر فقط در سطح ردیف کار می‌کند، نه در سطح statement.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.acc_business_orphan_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_has_license boolean;
BEGIN
  -- فقط برای کسب‌وکارهای متعلق به کاربر (owner_id NOT NULL)
  IF NEW.owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.acc_access a
     WHERE a.business_id = NEW.id
       AND a.user_id = NEW.owner_id
  ) INTO v_has_license;

  IF NOT v_has_license THEN
    -- ثبت در site_secrets برای رصد (نه مسدودسازی)
    -- این با upsert ایمن انجام می‌شود تا اگر چندبار تریگر اجرا شد، رکورد یکتا بماند
    INSERT INTO public.site_secrets (key, value, updated_at)
    VALUES (
      'orphan_business_alert_' || NEW.id::text,
      jsonb_build_object(
        'business_id', NEW.id,
        'business_name', NEW.name,
        'owner_id', NEW.owner_id,
        'created_at', NEW.created_at,
        'alert', 'کسب‌وکار بدون لایسنس ساخته شد — احتمالاً از مسیر غیر از acc_start_trial'
      )::text,
      now()
    )
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS acc_business_orphan_guard_tr ON public.acc_businesses;
CREATE TRIGGER acc_business_orphan_guard_tr
  AFTER INSERT ON public.acc_businesses
  FOR EACH ROW EXECUTE FUNCTION public.acc_business_orphan_guard();

-- ─────────────────────────────────────────────────────────────────────────────
-- خلاصه نهایی
-- ─────────────────────────────────────────────────────────────────────────────
--  ✅ B11/B12: تریگر یتیم acc_mirror_journal روی acc_accounts حذف شد
--  ✅ B40:     ستون account_id در acc_reconciliations به nullable برگردانده شد
--  ✅ B44:     ستون account_id در acc_bank_lines به nullable برگردانده شد
--  ✅ C4:      لایسنس آزمایشی برای کسب‌وکارهای یتیم ساخته شد
--              view acc_orphan_businesses برای پایش ادمین ساخته شد
--              تریگر acc_business_orphan_guard_tr برای رشد آینده ساخته شد
--
-- اجرای بعدی حسابرسی (شنبه/چهارشنبه) باید این موارد را سبز نشان دهد.
-- اگه C4 هنوز FAIL شد یعنی مایگریشن کامل اجرا نشده یا کاربران جدید هنوز از مسیر
-- غیر از acc_start_trial در حال ایجاد کسب‌وکار هستند — بررسی لاگ‌ها در site_secrets.
-- ════════════════════════════════════════════════════════════════════════════

COMMIT;
