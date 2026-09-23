-- ═══════════════════════════════════════════════════════════════════════════
-- M7 — پشتیبانی فرانت: قفل دورهٔ مالی + پیوند سند افتتاحیه
-- ═══════════════════════════════════════════════════════════════════════════
-- پس از M150000 نوشتن مستقیم acc_periods/acc_fiscal_years از سمت کلاینت بسته شد.
-- دو قابلیت مشروع فرانت که به این جدول‌ها نیاز دارند از مسیر RPC (اتمیک و دارای
-- مجوز) عبور داده می‌شوند — در جای درست معماری، نه پچ دستی:
--   §۱ acc_period_lock_set  → قفل/بازکردن تک‌ماه (صفحهٔ «دوره‌های مالی»)
--   §۲ acc_fiscal_link_entry → پیوند سند افتتاحیهٔ دستی به سال مالی
-- قابل اجرای مجدد. ترتیب: بعد از M170000.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ §۱) قفل/بازکردن دورهٔ ماهانه — فقط با مجوز مالی ═══
create or replace function public.acc_period_lock_set(
  p_business uuid, p_jyear int, p_jmonth int, p_locked boolean
)
returns void
language plpgsql
security definer
set search_path = public as $$
declare
  v_fy public.acc_fiscal_years%rowtype;
begin
  if auth.uid() is null then
    raise exception 'ابتدا وارد حساب کاربری شوید';
  end if;
  if not public.acc_perm_ok(p_business, 'fiscal.close') then
    raise exception 'اجازهٔ قفل/بازکردن دورهٔ مالی را ندارید';
  end if;
  if p_jmonth not between 1 and 12 then
    raise exception 'ماه نامعتبر است';
  end if;

  -- سال بسته‌شده هرگز قابل بازکردن نیست (وارونگی اختتامیه ممنوع)
  select * into v_fy
    from public.acc_fiscal_years
   where business_id = p_business and jyear = p_jyear;
  if found and v_fy.status = 'closed' and p_locked = false then
    raise exception 'سال مالی % بسته شده است — دوره‌های آن قابل بازکردن نیستند', p_jyear;
  end if;

  insert into public.acc_periods (business_id, jyear, jmonth, locked, locked_at)
  values (p_business, p_jyear, p_jmonth, p_locked,
          case when p_locked then now() else null end)
  on conflict (business_id, jyear, jmonth)
  do update set locked   = excluded.locked,
                locked_at = excluded.locked_at;
end $$;

revoke all on function public.acc_period_lock_set(uuid, int, int, boolean) from public, anon;
grant execute on function public.acc_period_lock_set(uuid, int, int, boolean) to authenticated;

-- ═══ §۲) پیوند سند افتتاحیهٔ دستی به سال مالی ═══
-- سند افتتاحیه از موتور (acc_create_journal) ثبت شده؛ این RPC فقط پیوند آن به
-- ردیف سال مالی را اتمیک انجام می‌دهد — بدون پنجرهٔ رقابت و با گارد تکرار.
create or replace function public.acc_fiscal_link_entry(
  p_business uuid, p_jyear int, p_entry uuid
)
returns void
language plpgsql
security definer
set search_path = public as $$
declare
  v_entry public.acc_journal%rowtype;
  v_fy    public.acc_fiscal_years%rowtype;
begin
  if auth.uid() is null then
    raise exception 'ابتدا وارد حساب کاربری شوید';
  end if;
  if not public.acc_perm_ok(p_business, 'fiscal.close') then
    raise exception 'اجازهٔ ثبت افتتاحیهٔ دورهٔ مالی را ندارید';
  end if;

  select * into v_entry
    from public.acc_journal
   where id = p_entry and business_id = p_business;
  if not found then
    raise exception 'سند افتتاحیه یافت نشد';
  end if;
  if v_entry.ref_type <> 'opening' then
    raise exception 'سند انتخاب‌شده افتتاحیه نیست';
  end if;
  if v_entry.voided_at is not null then
    raise exception 'سند باطل‌شده قابل پیوند نیست';
  end if;

  insert into public.acc_fiscal_years (business_id, jyear, status)
  values (p_business, p_jyear, 'open')
  on conflict (business_id, jyear) do nothing;

  select * into v_fy
    from public.acc_fiscal_years
   where business_id = p_business and jyear = p_jyear
   for update;

  if v_fy.status = 'closed' then
    raise exception 'سال مالی % بسته است — افتتاحیه روی سال بسته مجاز نیست', p_jyear;
  end if;
  if v_fy.opening_entry_id is not null and v_fy.opening_entry_id <> p_entry then
    raise exception 'سند افتتاحیهٔ سال % قبلاً ثبت شده است', p_jyear;
  end if;

  update public.acc_fiscal_years
     set opening_entry_id = p_entry
   where business_id = p_business and jyear = p_jyear;
end $$;

revoke all on function public.acc_fiscal_link_entry(uuid, int, uuid) from public, anon;
grant execute on function public.acc_fiscal_link_entry(uuid, int, uuid) to authenticated;

-- ═══ §۳) Post-check ═══
do $$
declare n int;
begin
  select count(*) into n from pg_proc p
   join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and p.proname in ('acc_period_lock_set','acc_fiscal_link_entry');
  raise notice 'POSTCHECK توابع پشتیبانی فرانت: % (انتظار: 2)', n;
end $$;
