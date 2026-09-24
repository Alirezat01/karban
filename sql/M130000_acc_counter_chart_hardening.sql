-- ═══════════════════════════════════════════════════════════════════════════
-- M2 — شماره‌گذاری خودترمیم + بازچینی سلسله‌مراتب Chart (کل → معین)
-- ═══════════════════════════════════════════════════════════════════════════
-- هدف (بندهای ۷ و ۹): RC-7 (شمارندهٔ عقب‌مانده فقط در exception ترمیم می‌شد) و
-- backfill یتیم‌های ساخته‌شدهٔ قدیمی. acc_ensure_chart v2 در M1 آمده است.
-- قابل اجرای مجدد. ترتیب: بعد از M1.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ §۱) acc_next_entry_no v2 — خودترمیم در مسیر عادی (بند ۷) ═══
-- (بنیان جدول/تابع اکنون در M120000 §۰.۳ است؛ این بخش همان بدنه را idempotent
--  بازنشان می‌دهد تا ترتیب مستقل فایل‌ها حفظ شود.)
-- زیر قفل ردیف شمارنده، MAX واقعی دفتر خوانده می‌شود؛ شمارنده هیچ‌وقت از دفتر
-- عقب‌تر نمی‌ماند (پاک‌سازی/بازیابی هم بی‌خطر است). قفل ردیف = سریال‌سازی per business.
create or replace function public.acc_next_entry_no(p_business uuid)
returns integer
language plpgsql
security definer
set search_path = public as $$
declare
  v_no  bigint;
  v_max bigint;
begin
  if p_business is null then
    raise exception 'کسب‌وکار نامعتبر است';
  end if;

  select last_entry_no into v_no
    from public.acc_entry_counters
   where business_id = p_business
   for update;

  if not found then
    insert into public.acc_entry_counters (business_id, last_entry_no)
    values (p_business, 0)
    on conflict (business_id) do update set updated_at = now();

    select last_entry_no into v_no
      from public.acc_entry_counters
     where business_id = p_business
     for update;
  end if;

  -- خودترمیمی: شمارنده هرگز از ماکس واقعی دفتر عقب‌تر نمی‌ماند
  select coalesce(max(entry_no), 0) into v_max
    from public.acc_journal
   where business_id = p_business;

  v_no := greatest(v_no, v_max) + 1;

  update public.acc_entry_counters
     set last_entry_no = v_no, updated_at = now()
   where business_id = p_business;

  return v_no::integer;
end $$;

revoke all on function public.acc_next_entry_no(uuid) from public, anon, authenticated;

-- ═══ §۲) گزارش همگامی شمارنده (پایش دائمی — بند ۷) ═══
-- نسخهٔ قدیمی‌تر نصب‌شده روی زنده خروجی «counter_value» دارد؛ create or replace
-- نمی‌تواند نوع خروجی را عوض کند (42P13). با امضای صفر-آرگومان، هر واریانتی حذف می‌شود.
drop function if exists public.acc_entry_counter_report();
create or replace function public.acc_entry_counter_report()
returns table (business_id uuid, counter bigint, max_entry_no bigint, in_sync boolean)
language sql stable security definer set search_path = public as $$
  select c.business_id,
         c.last_entry_no,
         (select coalesce(max(j.entry_no), 0) from public.acc_journal j where j.business_id = c.business_id),
         c.last_entry_no >= (select coalesce(max(j.entry_no), 0) from public.acc_journal j where j.business_id = c.business_id)
    from public.acc_entry_counters c
   where public.acc_is_member(c.business_id)
$$;

revoke all on function public.acc_entry_counter_report() from public, anon;
grant execute on function public.acc_entry_counter_report() to authenticated;

-- ═══ §۳) Backfill یک‌باره: بازچینی یتیم‌های چندرقمی + هم‌سازی level/is_leaf ═══
-- هیچ سطری حذف نمی‌شود؛ فقط parent/level/is_leaf اصلاح می‌شود (بند ۹).
do $$
declare v_orphans int;
begin
  update public.acc_chart c
     set parent_id = m.pid,
         level = m.plevel + 1
    from (
      select distinct on (c2.id) c2.id as cid, p.id as pid, p.level as plevel
        from public.acc_chart c2
        join public.acc_chart p
          on p.business_id is not distinct from c2.business_id
         and length(p.code) in (1, 2)
         and length(p.code) < length(c2.code)
         and p.code = left(c2.code, length(p.code))
       where c2.parent_id is null and length(c2.code) >= 3
       order by c2.id, length(p.code) desc
    ) m
   where c.id = m.cid;
  get diagnostics v_orphans = row_count;
  raise notice 'backfill chart: % سطر چندرقمی بازچینی شد', v_orphans;

  update public.acc_chart p
     set is_leaf = false
   where p.is_leaf
     and exists (select 1 from public.acc_chart c where c.parent_id = p.id);

  update public.acc_chart p
     set is_leaf = true
   where not p.is_leaf
     and not exists (select 1 from public.acc_chart c where c.parent_id = p.id);
end $$;

-- ═══ §۳.۵) acc_seed_chart کانونیکال — بازچینی قطعی با «بلندترین پیشوند» ═══
-- باگ قبلی: UPDATE والدی هر پیشوند منطبق را بی‌ترتیب برمی‌گزید → 1103 گاهی زیر
-- گروه «1» بسته می‌شد و گاهی زیر کل «11» (نامعین). حالا distinct on + بلندترین
-- پیشوند + level = parent.level+1 — قطعی و هم‌ساز با ensure_chart v2.
create or replace function public.acc_seed_chart(p_business uuid)
returns void
language plpgsql
security definer
set search_path = public as $$
begin
  if p_business is null then return; end if;
  -- کپی گره‌های کدینگ پایه به فضای‌نام کسب‌وکار
  insert into public.acc_chart (business_id, code, title, kind, is_system, level, is_leaf, nature, active,
                                requires_detail, allowed_detail_types)
  select p_business, s.code, s.title, s.kind, false, s.level, s.is_leaf, s.nature, true,
         s.requires_detail, s.allowed_detail_types
    from public.acc_chart s
   where s.business_id is null
  on conflict (business_id, code) do nothing;

  -- بازچینی قطعی: والد = بلندترین پیشوند (کل ۲رقمی بر گروه ۱رقمی اولویت دارد)
  update public.acc_chart child
     set parent_id = m.pid,
         level = m.plevel + 1,
         is_leaf = true
    from (
      select distinct on (c2.id) c2.id as cid, p.id as pid, p.level as plevel
        from public.acc_chart c2
        join public.acc_chart p
          on p.business_id = p_business
         and length(p.code) in (1, 2)
         and length(p.code) < length(c2.code)
         and p.code = left(c2.code, length(p.code))
       where c2.business_id = p_business
         and length(c2.code) >= 2
       order by c2.id, length(p.code) desc
    ) m
   where child.id = m.cid;

  -- والدی که فرزند گرفت دیگر برگ نیست
  update public.acc_chart p
     set is_leaf = false
   where p.business_id = p_business
     and p.is_leaf
     and exists (select 1 from public.acc_chart c where c.parent_id = p.id);
end $$;

revoke all on function public.acc_seed_chart(uuid) from public, anon;
grant execute on function public.acc_seed_chart(uuid) to authenticated;

-- ═══ §۴) گارد سلسله‌مراتب Chart — سطح DB (بند ۹) ═══
create or replace function public.acc_chart_hierarchy_guard()
returns trigger
language plpgsql
security definer
set search_path = public as $$
declare
  v_parent public.acc_chart%rowtype;
begin
  if new.parent_id is not null then
    select * into v_parent from public.acc_chart where id = new.parent_id;
    if not found then
      raise exception 'acc_chart: والد یافت نشد';
    end if;
    if v_parent.business_id is distinct from new.business_id then
      raise exception 'acc_chart: والد باید در همان فضای‌نام کسب‌وکار باشد';
    end if;
    if new.level is distinct from v_parent.level + 1 then
      new.level := v_parent.level + 1;
    end if;
    if new.code is not null and (length(v_parent.code) >= length(new.code)
        or left(new.code, length(v_parent.code)) <> v_parent.code) then
      raise exception 'acc_chart: کد «%» با پیشوند والد «%» نمی‌خواند', new.code, v_parent.code;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists acc_chart_hierarchy_guard_tr on public.acc_chart;
create trigger acc_chart_hierarchy_guard_tr
  before insert or update of parent_id, level, code on public.acc_chart
  for each row execute function public.acc_chart_hierarchy_guard();

-- ═══ §۵) گارد «ثبت روی حساب مادر ممنوع» — Invariant #9 در DB (بند ۹) ═══
create or replace function public.acc_jline_leaf_guard()
returns trigger
language plpgsql
security definer
set search_path = public as $$
declare
  v_row public.acc_chart%rowtype;
begin
  if new.account_id is not null then
    select * into v_row from public.acc_chart where id = new.account_id;
  elsif new.account_code is not null then
    select * into v_row from public.acc_chart
     where code = new.account_code
       and (business_id = new.business_id or business_id is null)
     order by (business_id = new.business_id) desc nulls last, level desc
     limit 1;
  else
    return new;
  end if;

  if found and v_row.is_leaf = false then
    raise exception
      'حساب «% — %» حساب مادر است (برگ نیست) — ثبت سند روی حساب مادر مجاز نیست؛ سند را روی حساب معین ثبت کنید',
      v_row.code, v_row.title;
  end if;
  return new;
end $$;

drop trigger if exists acc_jline_leaf_guard_tr on public.acc_journal_lines;
create trigger acc_jline_leaf_guard_tr
  before insert or update of account_id, account_code on public.acc_journal_lines
  for each row execute function public.acc_jline_leaf_guard();

-- ═══ §۶) Post-check ═══
do $$
declare n int;
begin
  select count(*) into n from public.acc_chart c
   where c.parent_id is null and length(c.code) >= 3;
  raise notice 'POSTCHECK چندرقمی بی‌والد: % (انتظار: 0)', n;

  select count(*) into n from public.acc_chart c
   join public.acc_chart p on p.id = c.parent_id
   where c.level <> p.level + 1;
  raise notice 'POSTCHECK ناسازگاری level: % (انتظار: 0)', n;

  select count(*) into n from public.acc_entry_counters c
   where c.last_entry_no < coalesce((select max(j.entry_no) from public.acc_journal j where j.business_id = c.business_id), 0);
  raise notice 'POSTCHECK شمارندهٔ عقب‌مانده: % (انتظار: 0)', n;
end $$;
