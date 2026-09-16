-- ═══════════════════════════════════════════════════════════════════
-- حسابداری کاربان — ارتقای نسخه ۲ (سلف‌سرویس + تفکیک پلن‌ها)
-- این فایل «بعد از» مایگریشن اصلی acc اجرا می‌شود.
--
-- چه چیزی اضافه می‌کند:
--   ۱) شروع خودکار نسخه آزمایشی (بدون تایید ادمین): acc_start_trial()
--      - ۱۴ روز، ۱ کسب‌وکار، حداکثر ۲۰ صورتحساب — فقط یک‌بار برای هر کاربر
--   ۲) ساخت کسب‌وکار دوم و سوم فقط با پلن: acc_create_business()
--      - آزمایشی: ۱ کسب‌وکار | ماهانه: ۳ | سالانه: ۵ | بنیان‌گذار: ۱۰
--   ۳) سقف ۲۰ صورتحساب برای کسب‌وکارهای آزمایشی (RLS restrictive)
--   ۴) فیلدهای کامل صورتحساب رسمی: شهرستان و نمابر (کسب‌وکار و طرف‌حساب)
--      + نحوه فروش نقدی/غیرنقدی روی فاکتور
-- ═══════════════════════════════════════════════════════════════════

-- ───────────── ۱) فیلدهای جدید ─────────────
alter table public.acc_businesses add column if not exists county text;
alter table public.acc_businesses add column if not exists fax text;

alter table public.acc_partners add column if not exists registration_number text;
alter table public.acc_partners add column if not exists province text;
alter table public.acc_partners add column if not exists county text;
alter table public.acc_partners add column if not exists city text;
alter table public.acc_partners add column if not exists fax text;

alter table public.acc_invoices add column if not exists is_cash_sale boolean;

-- ───────────── ۲) سقف تعداد کسب‌وکار بر اساس پلن ─────────────
create or replace function public.acc_business_limit()
returns int
language sql stable security definer set search_path = public as $$
  select coalesce(max(case a.plan
    when 'founder' then 10
    when 'yearly'  then 5
    when 'monthly' then 3
    when 'trial'   then 1
    else 1
  end), 0)
  from public.acc_access a
  where a.user_id = auth.uid()
    and a.role = 'owner'
    and a.status in ('active','trial')
    and (a.expires_at is null or a.expires_at > now());
$$;

create or replace function public.acc_can_create_business()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select count(*) from public.acc_businesses where owner_id = auth.uid()), 0)
    < public.acc_business_limit();
$$;

-- ───────────── ۳) سقف صورتحساب برای پلن آزمایشی ─────────────
create or replace function public.acc_invoice_quota_ok(p_business uuid)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_trial_only boolean;
  v_count int;
begin
  if p_business is null then return true; end if;
  -- فقط کسب‌وکارهایی که «تنها» لایسنس آزمایشی دارند سقف دارند
  select exists (
    select 1 from public.acc_access a
     where a.business_id = p_business
       and a.status = 'trial'
       and (a.expires_at is null or a.expires_at > now())
       and not exists (
         select 1 from public.acc_access b
          where b.business_id = p_business
            and b.status = 'active'
            and (b.expires_at is null or b.expires_at > now())
       )
  ) into v_trial_only;
  if not v_trial_only then return true; end if;
  select count(*) into v_count from public.acc_invoices where business_id = p_business;
  return v_count < 20;
end $$;

-- پالیسی restrictive: با پالیسی‌های permissive جمع (OR) نمی‌شود؛ حتماً رعایت می‌شود
drop policy if exists "acc invoice trial quota" on public.acc_invoices;
create policy "acc invoice trial quota" on public.acc_invoices
  as restrictive for insert to authenticated
  with check (public.acc_invoice_quota_ok(business_id));

-- ───────────── ۴) شروع خودکار نسخه آزمایشی (سلف‌سرویس) ─────────────
create or replace function public.acc_start_trial(p_form jsonb)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_biz uuid;
begin
  if v_user is null then
    raise exception 'برای شروع نسخه آزمایشی ابتدا وارد حساب کاربری کاربان شوید';
  end if;
  select email into v_email from auth.users where id = v_user;

  if exists (
    select 1 from public.acc_access a
     where a.user_id = v_user
       and a.status in ('active','trial')
       and (a.expires_at is null or a.expires_at > now())
  ) then
    raise exception 'حساب شما همین حالا دسترسی فعال حسابداری دارد';
  end if;

  if exists (
    select 1 from public.acc_access a
     where a.user_id = v_user and a.status = 'trial'
  ) then
    raise exception 'نسخه آزمایشی فقط یک‌بار قابل فعال‌سازی است؛ برای ادامه، اشتراک تهیه کنید یا درخواست تماس ثبت کنید';
  end if;

  insert into public.acc_businesses (
    owner_id, name, brand, person_type, shenase_melli, national_id,
    economic_code, registration_number, province, county, city, address,
    postal_code, phone, default_vat_rate
  ) values (
    v_user,
    coalesce(nullif(p_form->>'name',''), 'کسب‌وکار من'),
    nullif(p_form->>'brand',''),
    case when p_form->>'person_type' in ('real','legal') then p_form->>'person_type' else 'legal' end,
    nullif(p_form->>'shenase_melli',''),
    nullif(p_form->>'national_id',''),
    nullif(p_form->>'economic_code',''),
    nullif(p_form->>'registration_number',''),
    nullif(p_form->>'province',''),
    nullif(p_form->>'county',''),
    nullif(p_form->>'city',''),
    nullif(p_form->>'address',''),
    nullif(p_form->>'postal_code',''),
    nullif(p_form->>'phone',''),
    least(greatest(coalesce(nullif(p_form->>'default_vat_rate','')::numeric, 10), 0), 100)
  )
  returning id into v_biz;

  insert into public.acc_access (business_id, user_id, email, role, status, plan, expires_at)
  values (v_biz, v_user, v_email, 'owner', 'trial', 'trial', now() + interval '14 days');

  -- ثبت برای گزارش ادمین (وضعیت approved یعنی سلف‌سرویس فعال شده)
  insert into public.acc_trial_requests (user_id, name, phone, email, business_name, plan, status)
  values (
    v_user,
    nullif(p_form->>'contact_name',''),
    nullif(p_form->>'contact_phone',''),
    v_email,
    coalesce(nullif(p_form->>'name',''), 'کسب‌وکار من'),
    'trial',
    'approved'
  );

  return v_biz;
end $$;

-- ───────────── ۵) ساخت کسب‌وکار جدید (با سقف پلن) ─────────────
create or replace function public.acc_create_business(p_form jsonb)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_biz uuid;
  v_limit int;
  v_count int;
  v_lic public.acc_access%rowtype;
begin
  if v_user is null then
    raise exception 'ابتدا وارد حساب کاربری کاربان شوید';
  end if;
  select email into v_email from auth.users where id = v_user;

  select * into v_lic from public.acc_access a
   where a.user_id = v_user
     and a.role = 'owner'
     and a.status in ('active','trial')
     and (a.expires_at is null or a.expires_at > now())
   order by case a.plan when 'founder' then 1 when 'yearly' then 2 when 'monthly' then 3 when 'trial' then 4 else 5 end,
            case a.status when 'active' then 1 else 2 end
   limit 1;

  if v_lic is null then
    raise exception 'لایسنس فعال حسابداری ندارید؛ ابتدا اشتراک تهیه کنید یا نسخه آزمایشی را فعال کنید';
  end if;

  v_limit := public.acc_business_limit();
  select count(*) into v_count from public.acc_businesses where owner_id = v_user;
  if v_count >= v_limit then
    raise exception 'سقف پلن فعلی شما % کسب‌وکار است؛ برای کسب‌وکار بیشتر، پلن بالاتر را تهیه کنید', v_limit;
  end if;

  insert into public.acc_businesses (
    owner_id, name, brand, person_type, shenase_melli, national_id,
    economic_code, registration_number, province, county, city, address,
    postal_code, phone, default_vat_rate
  ) values (
    v_user,
    coalesce(nullif(p_form->>'name',''), 'کسب‌وکار جدید'),
    nullif(p_form->>'brand',''),
    case when p_form->>'person_type' in ('real','legal') then p_form->>'person_type' else 'legal' end,
    nullif(p_form->>'shenase_melli',''),
    nullif(p_form->>'national_id',''),
    nullif(p_form->>'economic_code',''),
    nullif(p_form->>'registration_number',''),
    nullif(p_form->>'province',''),
    nullif(p_form->>'county',''),
    nullif(p_form->>'city',''),
    nullif(p_form->>'address',''),
    nullif(p_form->>'postal_code',''),
    nullif(p_form->>'phone',''),
    least(greatest(coalesce(nullif(p_form->>'default_vat_rate','')::numeric, 10), 0), 100)
  )
  returning id into v_biz;

  insert into public.acc_access (business_id, user_id, email, role, status, plan, expires_at)
  values (v_biz, v_user, v_email, 'owner',
          case when v_lic.status = 'trial' then 'trial' else 'active' end,
          coalesce(v_lic.plan, 'active'),
          v_lic.expires_at);

  return v_biz;
end $$;

-- ───────────── ۶) سفت‌کردن پالیسی ساخت مستقیم کسب‌وکار ─────────────
-- دیگر هیچ‌کس بدون رعایت سقف پلن نمی‌تواند از مسیر مستقیم API کسب‌وکار بسازد
drop policy if exists "acc biz insert licensed" on public.acc_businesses;
create policy "acc biz insert licensed" on public.acc_businesses for insert to authenticated
  with check (
    owner_id = auth.uid()
    and (
      public.acc_is_admin()
      or (
        exists (
          select 1 from public.acc_access a
           where a.user_id = auth.uid()
             and a.role = 'owner'
             and a.status in ('active','trial')
             and (a.expires_at is null or a.expires_at > now())
        )
        and public.acc_can_create_business()
      )
    )
  );

-- ═══════════════════════════ پایان ارتقا ═══════════════════════════
