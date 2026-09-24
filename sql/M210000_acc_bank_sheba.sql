/* ═══════════════════════════════════════════════════════════════════════════
   M210000 — شماره شبا (IBAN) برای حساب‌های بانکی/صندوق
   ───────────────────────────────────────────────────────────────────────────
   درخواست محصول کاربر (راند ۳):
   «توی مشخصات حساب شماره حساب و شبا رو هم باید ثبت کنی، که موقع صدور
    صورتحساب زیر صورتحساب اضافه کنی»

   - ستون «شماره حساب» از قبل موجود است (acc_accounts.account_number)
   - این مایگریشن ستون «شبا» را اضافه می‌کند + قید اعتبار IR + ۲۴ رقم
   - نمایش زیر صورتحساب در فرانت (InvoicePrint) انجام می‌شود
   - RLS جدول acc_accounts از قبل فعال است و ستون جدید را پوشش می‌دهد

   اجرا: Supabase SQL Editor — قابل اجرای مجدد (idempotent)
   ═════════════════════════════════════════════════════════════════════ */

-- ۱) ستون شبا
alter table public.acc_accounts
  add column if not exists sheba text;

-- ۲) نرمال‌سازی مقادیر موجود: حذف فاصله و خط تیره + حروف بزرگ
update public.acc_accounts
   set sheba = upper(regexp_replace(sheba, '[\s\-]', '', 'g'))
 where sheba is not null
   and sheba <> '';

-- ۳) قید اعتبار شبا: یا تهی یا ۲۶ نویسه = «IR» + ۲۴ رقم
do $$ begin
  if not exists (
    select 1 from pg_constraint con
     where con.conrelid = 'public.acc_accounts'::regclass
       and con.conname = 'acc_accounts_sheba_chk'
  ) then
    alter table public.acc_accounts
      add constraint acc_accounts_sheba_chk
      check (sheba is null or (
        char_length(sheba) = 26
        and sheba like 'IR%'
        and substr(sheba, 3) ~ '^[0-9]{24}$'
      ));
  end if;
end $$;

comment on column public.acc_accounts.sheba is
  'شماره شبا (IBAN) — ۲۶ نویسه: IR + ۲۴ رقم، بدون فاصله و خط تیره';

-- ═══════════════════ POSTCHECK ═══════════════════
do $$
declare
  v_bad     bigint;
  v_col     bigint;
  v_chk     bigint;
begin
  select count(*) into v_col
    from information_schema.columns
   where table_schema = 'public' and table_name = 'acc_accounts'
     and column_name = 'sheba';
  if v_col = 0 then
    raise exception 'POSTCHECK(1/3): ستون sheba ساخته نشد';
  end if;

  select count(*) into v_bad
    from public.acc_accounts
   where sheba is not null
     and not (char_length(sheba) = 26 and sheba like 'IR%' and substr(sheba, 3) ~ '^[0-9]{24}$');
  if v_bad > 0 then
    raise exception 'POSTCHECK(2/3): % ردیف شبای نامعتبر دارد', v_bad;
  end if;

  select count(*) into v_chk
    from pg_constraint con
   where con.conrelid = 'public.acc_accounts'::regclass
     and con.conname = 'acc_accounts_sheba_chk';
  if v_chk = 0 then
    raise exception 'POSTCHECK(3/3): قید acc_accounts_sheba_chk نصب نشد';
  end if;

  raise notice 'M210000 OK — ستون sheba آماده است (POSTCHECK ۳/۳ سبز)';
end $$;
