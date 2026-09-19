-- ═══════════════════════════════════════════════════════════════════
-- sql-6-storage-lock.sql — نسخه ۳.۱۹ کاربان
-- هدف: ریشه‌کنی کامل باگ‌های ذخیره‌سازی + اصل حسابداری (قفل سند قطعی)
-- ═══════════════════════════════════════════════════════════════════
-- اجرا: Supabase Dashboard → SQL Editor → کل فایل را اجرا کنید (بدون خطر، تکرارپذیر)
--
-- بخش ۱: قفل ویرایش صورتحساب صادره (رفع B18 حسابرسی)
--         — فروش/خرید/برگشتی صادره‌شده غیرقابل ویرایش؛ پیش‌فاکتور آزاد می‌ماند
-- بخش ۲: گارد ردیف‌های صورتحساب — با معافیت پیش‌فاکتور
-- بخش ۳: قفل سند حسابداری قطعی — اصل حسابداری: سند فقط با ابطال اصلاح می‌شود
--         (سندهای آینه‌ای سیستم: opening/expense/transaction/invoice اجازه نگهداری دارند)
-- بخش ۴: تضمین پالیسی‌های UPDATE/DELETE برای جداول قابل ویرایش اپ
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────── بخش ۱ ─────────────────────────
-- مهر زمانی صدور + قفل ویرایش صورتحساب صادره
create or replace function public.acc_invoice_before()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if old.status = 'cancelled' then
      raise exception 'صورتحساب ابطال‌شده دیگر قابل تغییر نیست';
    end if;
    -- قفل فقط برای اسناد رسمی (فروش/خرید/برگشتی) — پیش‌فاکتور استعلام قیمت است و آزاد می‌ماند
    if old.posted_at is not null and old.type in ('sale','purchase','return_sale') then
      if new.status not in ('issued','partial','paid','cancelled') then
        raise exception 'صورتحساب صادره‌شده فقط قابل ابطال است';
      end if;
      if (new.number, new.type, new.partner_id, new.date_g, new.due_date_g, new.description,
          new.payment_terms, new.is_cash_sale, new.buyer_type, new.pay_id, new.account_id,
          new.project_id, new.subtotal, new.discount_total, new.vat_total, new.total)
         is distinct from
         (old.number, old.type, old.partner_id, old.date_g, old.due_date_g, old.description,
          old.payment_terms, old.is_cash_sale, old.buyer_type, old.pay_id, old.account_id,
          old.project_id, old.subtotal, old.discount_total, old.vat_total, old.total) then
        raise exception 'صورتحساب صادره‌شده قابل ویرایش نیست؛ برای اصلاح، ابتدا آن را ابطال کنید';
      end if;
      if new.status = 'cancelled' then
        new.reversed_at := coalesce(new.reversed_at, now());
      end if;
    end if;
  end if;
  if (tg_op = 'INSERT' and new.status = 'issued')
     or (tg_op = 'UPDATE' and old.status <> 'issued' and new.status = 'issued') then
    new.posted_at := coalesce(new.posted_at, now());
  end if;
  return new;
end $$;

drop trigger if exists acc_invoice_before_tr on public.acc_invoices;
create trigger acc_invoice_before_tr
  before insert or update on public.acc_invoices
  for each row execute function public.acc_invoice_before();

-- ───────────────────────── بخش ۲ ─────────────────────────
-- ردیف‌های صورتحساب صادره قفل است؛ پیش‌فاکتور برای ویرایش آزاد
create or replace function public.acc_invoice_items_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_posted timestamptz;
  v_type text;
begin
  if tg_op in ('INSERT','UPDATE') then
    select posted_at, type into v_posted, v_type from public.acc_invoices where id = new.invoice_id;
  else
    select posted_at, type into v_posted, v_type from public.acc_invoices where id = old.invoice_id;
  end if;
  if v_posted is not null and v_type in ('sale','purchase','return_sale') then
    raise exception 'این صورتحساب صادر شده و ردیف‌های آن قابل تغییر نیست؛ برای اصلاح، آن را ابطال و صورتحساب جدید صادر کنید';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists acc_invoice_items_guard_tr on public.acc_invoice_items;
create trigger acc_invoice_items_guard_tr
  before insert or update or delete on public.acc_invoice_items
  for each row execute function public.acc_invoice_items_guard();

-- ───────────────────────── بخش ۳ ─────────────────────────
-- سند حسابداری قطعی: ساختار سند (تاریخ/شماره/نوع/ارجاع) غیرقابل تغییر است.
-- مجاز: ثبت ابطال (voided_at/void_reason)، پیوست (attachment_url)
-- و نگهداری خودکار سندهای آینه‌ای سیستم (opening/expense/transaction/invoice):
--   تاریخ و شرح این سندها توسط تریگرهای سیستم از سند مادر همگام می‌شود.
create or replace function public.acc_journal_lock()
returns trigger language plpgsql as $$
begin
  if (new.business_id, new.entry_no, new.ref_type, new.ref_action, new.ref_id, new.reversal_of)
     is distinct from
     (old.business_id, old.entry_no, old.ref_type, old.ref_action, old.ref_id, old.reversal_of) then
    raise exception 'سند قطعی قابل ویرایش نیست — برای اصلاح، سند را ابطال کنید';
  end if;
  if new.description is distinct from old.description
     and old.ref_type not in ('opening','expense','transaction','invoice') then
    raise exception 'شرح سند قطعی قابل ویرایش نیست — برای اصلاح، سند را ابطال کنید';
  end if;
  if new.date_g is distinct from old.date_g
     and old.ref_type not in ('opening','expense','transaction','invoice') then
    raise exception 'تاریخ سند قطعی قابل ویرایش نیست — برای اصلاح، سند را ابطال کنید';
  end if;
  if old.voided_at is not null
     and (new.voided_at, new.void_reason) is distinct from (old.voided_at, old.void_reason) then
    raise exception 'سند باطل‌شده دیگر قابل تغییر نیست';
  end if;
  return new;
end $$;

drop trigger if exists acc_journal_lock_tr on public.acc_journal;
create trigger acc_journal_lock_tr
  before update on public.acc_journal
  for each row execute function public.acc_journal_lock();

-- ───────────────────────── بخش ۴ ─────────────────────────
-- تضمین پالیسی‌های UPDATE/DELETE اعضا روی جداول قابل ویرایش اپ
-- (اگر پالیسی هم‌نام نبود، این نسخه با نام جدید اضافه می‌شود — permissive/OR)
do $$
declare t text;
begin
  foreach t in array array['acc_partners','acc_items','acc_accounts','acc_expenses','acc_transactions',
                           'acc_checks','acc_projects','acc_contracts','acc_recurring',
                           'acc_employees','acc_assets','acc_payrolls','acc_expense_categories']
  loop
    execute format('drop policy if exists "acc upd member v2" on public.%I', t);
    execute format($f$create policy "acc upd member v2" on public.%I for update to authenticated
      using (public.acc_member_role(business_id) in ('owner','accountant') or public.acc_is_admin())$f$, t);
    execute format('drop policy if exists "acc del member v2" on public.%I', t);
    execute format($f$create policy "acc del member v2" on public.%I for delete to authenticated
      using (public.acc_member_role(business_id) in ('owner','accountant') or public.acc_is_admin())$f$, t);
  end loop;
end $$;

-- ═══════════════ پایان — گزارش حسابرسی بعدی باید B18 سبز شود ═══════════════
