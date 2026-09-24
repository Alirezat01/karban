-- ═══════════════════════════════════════════════════════════════════════════
-- M3 — نرمال‌سازی Subledger + گزارش سلامت دفتر
-- نرمال‌سازی Subledger + یکپارچگی ارجاع‌ها + موتور گزارش سلامت دفتر
-- ═══════════════════════════════════════════════════════════════════════════
-- ریشه‌های هدف: RC-5 (partner_id بدون FK، خلط ref_id چندریختی، ستون مُردهٔ
-- acc_details.code) + نبودِ یک گزارش واحد برای orphan/ناترازی.
--
-- اصل: هیچ دادهٔ واقعی حذف نمی‌شود؛ ارجاع‌های یتیم فقط «گزارش» می‌شوند و در
-- صورت صفر بودن، قید VALIDATE می‌شود.
-- قابل اجرا روی DB زنده (idempotent). ترتیب: بعد از 20_counter_and_chart_hardening.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ §۱) موتور گزارش سلامت دفتر — همین امروز و برای همیشه ═══
-- به‌جای ۵۰ قطعه SQL پراکنده: یک تابع که همهٔ ناهنجاری‌های شناخته‌شده را
-- یک‌جا برمی‌گرداند. خروجی فقط برای کسب‌وکارهایی است که فراخوان عضو آن است.
-- گارد واریانت: نسخهٔ پیشین با امضای متفاوت ممکن است نصب باشد → اول حذف.
drop function if exists public.acc_integrity_report();
create or replace function public.acc_integrity_report()
returns table (check_name text, ok boolean, detail text)
language sql
stable
security definer
set search_path = public as $$
with member_biz as (
  select distinct a.business_id
  from public.acc_access a
  where a.user_id = auth.uid()
    and a.status in ('active','trial')
    and (a.expires_at is null or a.expires_at > now())
)
-- IG-1 سند بدون ردیف (یتیم سرِسند)
select 'IG-1 orphan-header', count(*) = 0, count(*)::text || ' سند بدون ردیف'
from public.acc_journal j
join member_biz m on m.business_id = j.business_id
where not exists (select 1 from public.acc_journal_lines l where l.entry_id = j.id)
union all
-- IG-2 ردیف بدون سند
select 'IG-2 orphan-line', count(*) = 0, count(*)::text || ' ردیف بدون سند'
from public.acc_journal_lines l
join member_biz m on m.business_id = l.business_id
where not exists (select 1 from public.acc_journal j where j.id = l.entry_id)
union all
-- IG-3 سند ناتراز (بدهکار ≠ بستانکار)
select 'IG-3 unbalanced', count(*) = 0, count(*)::text || ' سند ناتراز'
from (
  select l.entry_id
  from public.acc_journal_lines l
  join member_biz m on m.business_id = l.business_id
  group by l.entry_id
  having sum(l.debit) <> sum(l.credit)
) x
union all
-- IG-4 ثبت روی حساب مادر
select 'IG-4 parent-posting', count(*) = 0, count(*)::text || ' ردیف روی حساب مادر'
from public.acc_journal_lines l
join public.acc_chart c on c.id = l.account_id
join member_biz m on m.business_id = l.business_id
where c.is_leaf = false
union all
-- IG-5 شمارندهٔ عقب‌مانده از دفتر
select 'IG-5 counter-behind', count(*) = 0, count(*)::text || ' کسب‌وکار با شمارندهٔ عقب'
from public.acc_entry_counters c
join member_biz m on m.business_id = c.business_id
where c.last_entry_no < coalesce(
  (select max(j.entry_no) from public.acc_journal j where j.business_id = c.business_id), 0)
union all
-- IG-6 partner_id یتیم (ارجاع به طرف‌حساب حذف‌شده)
select 'IG-6 orphan-partner-ref', count(*) = 0, count(*)::text || ' ردیف با partner_id یتیم'
from public.acc_journal_lines l
join member_biz m on m.business_id = l.business_id
where l.partner_id is not null
  and not exists (select 1 from public.acc_partners p where p.id = l.partner_id)
union all
-- IG-7 ناهم‌خوانی partner_id با تفصیلیِ انتخاب‌شده
select 'IG-7 partner-detail-mismatch', count(*) = 0, count(*)::text || ' ردیف ناهم‌خوان'
from public.acc_journal_lines l
join public.acc_details d on d.id = l.detail_id
join member_biz m on m.business_id = l.business_id
where l.partner_id is not null and d.ref_id is not null and d.ref_id <> l.partner_id
union all
-- IG-8 پیوند یتیم مغایرت‌گیری بانکی
select 'IG-8 orphan-bank-link', count(*) = 0, count(*)::text || ' خط بانکی با پیوند یتیم'
from public.acc_bank_lines b
join member_biz m on m.business_id = b.business_id
where b.match_entity_id is not null
  and b.match_status in ('auto','manual','onbook')
  and not exists (select 1 from public.acc_transactions t where t.id = b.match_entity_id)
union all
-- IG-9 تفصیلیِ یتیمِ طرف‌حساب حذف‌شده (قفل‌شده و بی‌صاحب)
select 'IG-9 orphan-locked-detail', count(*) = 0, count(*)::text || ' تفصیلی قفل‌شدهٔ بی‌صاحب'
from public.acc_details d
join member_biz m on m.business_id = d.business_id
where d.ref_id is not null and d.kind in ('customer','supplier','shareholder','employee')
  and not exists (select 1 from public.acc_partners p where p.id = d.ref_id)
$$;

revoke all on function public.acc_integrity_report() from public, anon;
grant execute on function public.acc_integrity_report() to authenticated;

-- ═══ §۲) FK برای acc_journal_lines.partner_id (تا امروز فقط uuid خام بود) ═══
-- NOT VALID → روی رکوردهای جدید فوراً enforce می‌شود؛ VALIDATE فقط وقتی
-- یتیمی نباشد (هیچ داده‌ای null یا حذف نمی‌شود).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.acc_journal_lines'::regclass and conname = 'acc_jline_partner_fk'
  ) then
    alter table public.acc_journal_lines
      add constraint acc_jline_partner_fk
      foreign key (partner_id) references public.acc_partners(id)
      on delete set null not valid;
  end if;
end $$;

do $$
declare n int;
begin
  select count(*) into n
  from public.acc_journal_lines l
  where l.partner_id is not null
    and not exists (select 1 from public.acc_partners p where p.id = l.partner_id);

  if n = 0 then
    alter table public.acc_journal_lines validate constraint acc_jline_partner_fk;
    raise notice 'POSTCHECK FK partner_id: VALIDATE شد (0 یتیم)';
  else
    raise notice 'POSTCHECK FK partner_id: % ردیف یتیم — VALIDATE رد شد؛ با IG-6 گزارش شود (قید برای رکوردهای جدید فعال است)', n;
  end if;
end $$;

-- ═══ §۳) گارد هم‌خوانی partner_id ↔ تفصیلی ═══
-- اگر هر دو ست شده‌اند و تفصیلی صاحب دارد، صاحبش باید همان partner باشد.
create or replace function public.acc_jline_partner_detail_chk()
returns trigger
language plpgsql
security definer
set search_path = public as $$
declare v_ref uuid;
begin
  if new.partner_id is not null and new.detail_id is not null then
    select ref_id into v_ref from public.acc_details where id = new.detail_id;
    if v_ref is not null and v_ref <> new.partner_id then
      raise exception 'ناهم‌خوانی طرف‌حساب: partner_id با تفصیلی انتخاب‌شده نمی‌خواند';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists acc_jline_partner_detail_chk_tr on public.acc_journal_lines;
create trigger acc_jline_partner_detail_chk_tr
  before insert or update of partner_id, detail_id on public.acc_journal_lines
  for each row execute function public.acc_jline_partner_detail_chk();

-- ═══ §۴) ستون موروثی acc_details.code — تنها با مدرک حذف می‌شود ═══
-- detail_code منبع یگانهٔ کد است (UNIQUE روی آن است؛ trigger کد می‌سازد)؛
-- ستون legacy هرگز نوشته نشده (0 استفاده در repo). اگر همه null باشد → حذف؛
-- وگرنه نگه داشته می‌شود و در گزارش اعلام.
do $$
declare n int;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'acc_details' and column_name = 'code'
  ) then
    select count(*) into n from public.acc_details where code is not null;
    if n = 0 then
      alter table public.acc_details drop column code;
      raise notice 'POSTCHECK acc_details.code: حذف شد (همه null بودند — detail_code منبع یگانه است)';
    else
      raise notice 'POSTCHECK acc_details.code: % مقدار غیر-null دارد — حذف نشد؛ بررسی دستی لازم', n;
    end if;
  else
    raise notice 'POSTCHECK acc_details.code: ستون وجود ندارد (قبلاً حذف شده)';
  end if;
end $$;

-- ═══ §۵) Post-check نهایی این مایگریشن ═══
do $$
declare n int;
begin
  select count(*) into n from pg_constraint
  where conrelid = 'public.acc_journal_lines'::regclass and conname = 'acc_jline_partner_fk';
  raise notice 'POSTCHECK FK partner_id موجود: % (انتظار: 1)', n;

  select count(*) into n from pg_trigger
  where tgrelid = 'public.acc_journal_lines'::regclass
    and tgname = 'acc_jline_partner_detail_chk_tr' and not tgisinternal;
  raise notice 'POSTCHECK تریگر هم‌خوانی partner/detail: % (انتظار: 1)', n;
end $$;
