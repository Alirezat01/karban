-- ═══════════════════════════════════════════════════════════════════════════
-- M5 — چک‌ها سازگار با چک صیادی (بند ۴) + پیوند یکپارچه با خزانه
-- ═══════════════════════════════════════════════════════════════════════════
-- ساختار: شناسهٔ صیادی ۱۶رقمی یگانه + نوع چک (عادی/تضمینی) + صادرکننده/گیرنده
-- چرخهٔ عمر با گارد DB: از وضعیت متناقض غیرممکن می‌شود (transition matrix)
-- ارتباط: check_id روی acc_transactions → زنجیرهٔ چک→دریافت/پرداخت→سند صریح می‌شود
-- قابل اجرای مجدد. ترتیب: بعد از M4.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ §۱) ستون‌های صیادی ═══
alter table public.acc_checks add column if not exists sayadi_id   text;
alter table public.acc_checks add column if not exists cheque_type text not null default 'ordinary';
alter table public.acc_checks add column if not exists issuer_name text;
alter table public.acc_checks add column if not exists payee_name  text;

do $$ begin
  if not exists (select 1 from pg_constraint con where con.conrelid = 'public.acc_checks'::regclass
                  and con.conname = 'acc_checks_sayadi_format_chk') then
    -- شناسهٔ صیادی: دقیقاً ۱۶ رقم
    alter table public.acc_checks add constraint acc_checks_sayadi_format_chk
      check (sayadi_id is null or sayadi_id ~ '^[0-9]{16}$');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint con where con.conrelid = 'public.acc_checks'::regclass
                  and con.conname = 'acc_checks_cheque_type_chk') then
    alter table public.acc_checks add constraint acc_checks_cheque_type_chk
      check (cheque_type in ('ordinary','guaranteed'));
  end if;
end $$;

-- یگانگی شناسهٔ صیادی در هر کسب‌وکار (فقط وقتی ثبت شده)
create unique index if not exists acc_checks_biz_sayadi_uniq
  on public.acc_checks (business_id, sayadi_id)
  where sayadi_id is not null;

-- ═══ §۲) وضعیت‌های چرخهٔ عمر — افزودن «واگذارشده» ═══
-- in_hand=در جریان (دریافتنی/پرداختنی حسب kind) · deposited=در جریان وصول/خوابانده
-- cleared=وصول‌شده · bounced=برگشتی · assigned=واگذارشده · returned=مستردشده · canceled=ابطال‌شده
do $$ begin
  if exists (select 1 from pg_constraint con where con.conrelid = 'public.acc_checks'::regclass
              and con.conname = 'acc_checks_status_check') then
    alter table public.acc_checks drop constraint acc_checks_status_check;
  end if;
  alter table public.acc_checks add constraint acc_checks_status_check
    check (status in ('in_hand','deposited','cleared','bounced','assigned','returned','canceled'));
exception when others then
  raise notice 'status CHECK: %', sqlerrm;
end $$;

-- ═══ §۳) گارد چرخهٔ عمر — جلوگیری از وضعیت متناقض (بند ۴) ═══
create or replace function public.acc_check_status_guard()
returns trigger
language plpgsql
security definer
set search_path = public as $$
declare
  v_allowed text[] :=
    array['in_hand>deposited','in_hand>cleared','in_hand>bounced','in_hand>assigned','in_hand>returned','in_hand>canceled',
          'deposited>cleared','deposited>bounced','deposited>returned','deposited>in_hand','deposited>canceled',
          'assigned>cleared','assigned>bounced','assigned>canceled',
          'bounced>in_hand','bounced>deposited','bounced>canceled',
          'returned>canceled'];
begin
  if tg_op = 'UPDATE' then
    if old.status = new.status then return new; end if;
    if old.voided_at is not null then
      raise exception 'چک ابطال‌شده تغییر وضعیت نمی‌پذیرد';
    end if;
    -- وضعیت‌های نهایی: cleared و canceled برگشت‌پذیر نیستند
    if old.status in ('cleared','canceled') then
      raise exception 'چک با وضعیت نهایی (% قابل تغییر نیست)', old.status;
    end if;
    if not (old.status || '>' || new.status) = any (v_allowed) then
      raise exception 'گذار وضعیت چک «% → %» مجاز نیست', old.status, new.status;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists acc_check_status_guard_tr on public.acc_checks;
create trigger acc_check_status_guard_tr
  before update of status on public.acc_checks
  for each row execute function public.acc_check_status_guard();

-- ═══ §۴) پیوند چک با دریافت/پرداخت (زنجیرهٔ چک→تراکنش→سند) ═══
alter table public.acc_transactions add column if not exists check_id uuid references public.acc_checks(id) on delete set null;

-- تفکیک‌پذیری: گزارش وضعیت چک‌ها همراه با سند خزانهٔ متصل
-- گارد واریانت: نسخهٔ پیشین با امضای متفاوت → اول حذف کامل.
drop function if exists public.acc_checks_overview(uuid);
create or replace function public.acc_checks_overview(p_business uuid)
returns table (
  check_id uuid, kind text, status text, amount bigint,
  serial_no text, sayadi_id text, cheque_type text,
  bank_name text, branch text,
  issue_date_g date, due_date_g date,
  partner_id uuid, partner_name text,
  account_id uuid,
  issuer_name text, payee_name text,
  transaction_id uuid, transaction_kind text,
  journal_id uuid, journal_no bigint
)
language sql stable security definer set search_path = public as $$
  select c.id, c.kind, c.status, c.amount,
         c.serial_no, c.sayadi_id, c.cheque_type,
         c.bank_name, c.branch,
         c.issue_date_g, c.due_date_g,
         c.partner_id, p.name,
         c.account_id,
         c.issuer_name, c.payee_name,
         t.id, t.kind,
         j.id, j.entry_no
    from public.acc_checks c
    left join public.acc_partners p on p.id = c.partner_id
    left join public.acc_transactions t on t.check_id = c.id
    left join public.acc_journal j
      on j.ref_type = 'transaction' and j.ref_id = t.id and j.ref_action = 'post'
   where c.business_id = p_business
     and public.acc_is_member(p_business)
   order by c.due_date_g nulls last, c.created_at;
$$;

revoke all on function public.acc_checks_overview(uuid) from public, anon;
grant execute on function public.acc_checks_overview(uuid) to authenticated;

-- ═══ §۵) Post-check ═══
do $$
declare n int;
begin
  select count(*) into n from pg_indexes
   where schemaname='public' and indexname='acc_checks_biz_sayadi_uniq';
  raise notice 'POSTCHECK ایندکس یگانگی صیادی: % (انتظار: 1)', n;

  select count(*) into n from pg_trigger
   where tgrelid = 'public.acc_checks'::regclass and tgname = 'acc_check_status_guard_tr' and not tgisinternal;
  raise notice 'POSTCHECK گارد چرخهٔ عمر چک: % (انتظار: 1)', n;

  select count(*) into n from information_schema.columns
   where table_schema='public' and table_name='acc_transactions' and column_name='check_id';
  raise notice 'POSTCHECK ستون check_id روی تراکنش‌ها: % (انتظار: 1)', n;
end $$;
