-- ═══════════════════════════════════════════════════════════════════════════
-- M220000 — ویرایش قابل‌اعتماد هزینه + شفاف‌سازی چرخهٔ ابطال/صدور مجدد
-- ═══════════════════════════════════════════════════════════════════════════
-- RCA سه باگ گزارش کاربر:
--   ۱) ویرایش هزینهٔ سندخورده خطای مبهم می‌دهد ← گارد ۹.۲ سندِ «فعال» را از
--      سندِ «ابطال‌شده» تفکیک نمی‌کرد و مسیر ویرایشِ واقعی (ابطال+صدور مجدد)
--      در اپ وجود نداشت.
--   ۲) پس از ابطال، صدور مجدد رخ نمی‌داد چون idempotencyِ acc_post_document
--      سندِ postِ ابطال‌شده را هم «موجود» می‌دانست.
-- تغییرات (فقط این — هیچ چیز دیگر):
--   §۱  acc_post_document v4 — idempotency فقط سند postِ «فعال» را می‌شمارد
--       (voided_at is null) → ابطال + ویرایش + صدور مجدد ممکن می‌شود.
--       سمانتیک حفظ‌شده: هر رویداد در هر لحظه حداکثر یک سند post فعال دارد.
--   §۲  گارد ۹.۲ هزینه — فقط سندخوردگیِ «فعال» را قفل می‌کند.
--   §۳  RPC acc_edit_expense — ویرایش اتمیکِ درست: اگر فیلد مالی تغییر کرده
--       باشد سند فعال را ابطال و سند جدید با مقادیر جدید صادر می‌کند؛
--       تغییر غیرمالی (عنوان/توضیح/فروشنده/…) بدون دست‌زدن به سند.
--   §۴  POSTCHECK — صحت نصب هر چهار بخش.
-- قابل اجرای مجدد. ترتیب: بعد از M210000 (و قبل از هر ریست داده).
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ §۱) acc_post_document v4 ═══
create or replace function public.acc_post_document(p_kind text, p_ref_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_biz uuid;
  v_exists uuid;
  v_id uuid;
  v_lines jsonb := '[]'::jsonb;
  v_desc text;
  v_date date;
  v_rec record;
  v_cash_code text;
  v_net bigint;
  v_vat bigint;
  v_total bigint;
  v_acc_kind text;
  v_cogs bigint := 0;
  v_cash_detail uuid;
begin
  if v_user is null then raise exception 'ابتدا وارد حساب کاربری شوید'; end if;
  if p_kind not in ('invoice','expense','transaction') then
    raise exception 'نوع سند آینه‌ای نامعتبر: %', p_kind;
  end if;

  if p_kind = 'invoice' then
    select * into v_rec from public.acc_invoices where id = p_ref_id;
    if not found then raise exception 'فاکتور یافت نشد'; end if;
    v_biz := v_rec.business_id;
    if not public.acc_perm_ok(v_biz, 'invoices.issue') then raise exception 'اجازهٔ صدور صورتحساب را ندارید'; end if;
    if v_rec.type = 'proforma' or v_rec.status = 'draft' then return null; end if;
    if v_rec.status = 'cancelled' then return null; end if;
    -- idempotency سخت‌گیرانه: هر رویداد فقط یک سند post در کل عمر خود دارد
    select id into v_exists from public.acc_journal
      where business_id = v_biz and ref_type = 'invoice' and ref_id = p_ref_id and ref_action = 'post' and voided_at is null limit 1;
    if v_exists is not null then return v_exists; end if;

    v_net := coalesce(v_rec.subtotal, 0) - coalesce(v_rec.discount_total, 0);
    v_vat := coalesce(v_rec.vat_total, 0);
    v_total := v_net + v_vat;
    v_date := v_rec.date_g;
    v_desc := case v_rec.type
      when 'sale' then 'فاکتور فروش ' || v_rec.number
      when 'purchase' then 'فاکتور خرید ' || v_rec.number
      when 'return_sale' then 'برگشت از فروش ' || v_rec.number
      else 'فاکتور ' || v_rec.number end;

    v_cash_code := null;
    if v_rec.account_id is not null then
      select kind into v_acc_kind from public.acc_accounts where id = v_rec.account_id;
      v_cash_code := case when v_acc_kind = 'cash' then '1101' else '1102' end;
    end if;

    if v_rec.type in ('sale','return_sale') then
      perform public.acc_ensure_chart(v_biz, '4101', 'درآمد فروش کالا و خدمات', 'income');
      perform public.acc_ensure_chart(v_biz, '4103', 'برگشت از فروش و تخفیفات', 'income');
      perform public.acc_ensure_chart(v_biz, '2102', 'مالیات و عوارض ارزش افزوده فروش', 'liability');
      perform public.acc_ensure_chart(v_biz, '1103', 'حساب‌های دریافتنی تجاری', 'asset');
      perform public.acc_ensure_chart(v_biz, '5101', 'بهای تمام‌شده کالای فروش رفته', 'expense');
      perform public.acc_ensure_chart(v_biz, '1201', 'موجودی کالا و خرید', 'asset');

      -- طرف حساب واقعی: نقدی → حساب بانک/صندوق سند؛ نسیه → دریافتنی با طرف‌حساب اجباری
      if v_cash_code is not null then
        perform public.acc_ensure_chart(v_biz, v_cash_code,
          case when v_cash_code = '1101' then 'موجودی نقد و بانک — صندوق' else 'موجودی نقد و بانک — بانک' end, 'asset');
        v_cash_detail := public.acc_account_detail_id(v_rec.account_id);
      else
        if v_rec.partner_id is null then
          raise exception 'فروش نسیه بدون طرف‌حساب مجاز نیست — مشتری را انتخاب کنید یا حساب نقدی/بانکی را برای فروش نقدی مشخص کنید';
        end if;
      end if;

      if v_rec.type = 'sale' then
        -- طرف بدهکار
        if v_cash_code is not null then
          v_lines := v_lines || jsonb_build_array(
            jsonb_build_object('account_code', v_cash_code, 'account_title',
              case when v_cash_code = '1101' then 'موجودی نقد و بانک — صندوق' else 'موجودی نقد و بانک — بانک' end,
              'debit', v_total, 'credit', 0, 'detail_id', v_cash_detail, 'line_desc', 'فروش نقدی'));
        else
          v_lines := v_lines || jsonb_build_array(
            jsonb_build_object('account_code', '1103', 'account_title', 'حساب‌های دریافتنی تجاری',
              'debit', v_total, 'credit', 0, 'partner_id', v_rec.partner_id, 'line_desc', 'طلب از مشتری'));
        end if;
        -- درآمد + مالیات
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('account_code', '4101', 'account_title', 'درآمد فروش کالا و خدمات',
            'debit', 0, 'credit', v_net, 'line_desc', 'درآمد فروش'),
          jsonb_build_object('account_code', '2102', 'account_title', 'مالیات و عوارض ارزش افزوده فروش',
            'debit', 0, 'credit', v_vat, 'line_desc', 'مالیات بر ارزش افزوده'));
        -- COGS کالای انباری (بند ۱۲)
        select coalesce(sum(round(ii.quantity * coalesce(i.purchase_price, 0))), 0) into v_cogs
          from public.acc_invoice_items ii
          join public.acc_items i on i.id = ii.item_id
         where ii.invoice_id = p_ref_id and i.track_stock and i.kind = 'goods';
        if v_cogs > 0 then
          v_lines := v_lines || jsonb_build_array(
            jsonb_build_object('account_code', '5101', 'account_title', 'بهای تمام‌شده کالای فروش رفته',
              'debit', v_cogs, 'credit', 0, 'line_desc', 'بهای تمام‌شده فروش'),
            jsonb_build_object('account_code', '1201', 'account_title', 'موجودی کالا و خرید',
              'debit', 0, 'credit', v_cogs, 'line_desc', 'کاهش موجودی'));
        end if;
      else
        -- برگشت از فروش: عکس اثر — کاهش درآمد، عودت وجه/بدهی، بازگشت موجودی
        if v_cash_code is not null then
          v_lines := v_lines || jsonb_build_array(
            jsonb_build_object('account_code', v_cash_code, 'account_title',
              case when v_cash_code = '1101' then 'موجودی نقد و بانک — صندوق' else 'موجودی نقد و بانک — بانک' end,
              'debit', 0, 'credit', v_total, 'detail_id', v_cash_detail, 'line_desc', 'عودت وجه برگشت فروش'));
        else
          v_lines := v_lines || jsonb_build_array(
            jsonb_build_object('account_code', '1103', 'account_title', 'حساب‌های دریافتنی تجاری',
              'debit', 0, 'credit', v_total, 'partner_id', v_rec.partner_id, 'line_desc', 'کاهش طلب از مشتری'));
        end if;
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('account_code', '4103', 'account_title', 'برگشت از فروش و تخفیفات',
            'debit', v_net, 'credit', 0, 'line_desc', 'برگشت از فروش'),
          jsonb_build_object('account_code', '2102', 'account_title', 'مالیات و عوارض ارزش افزوده فروش',
            'debit', v_vat, 'credit', 0, 'line_desc', 'برگشت مالیات فروش'));
        select coalesce(sum(round(ii.quantity * coalesce(i.purchase_price, 0))), 0) into v_cogs
          from public.acc_invoice_items ii
          join public.acc_items i on i.id = ii.item_id
         where ii.invoice_id = p_ref_id and i.track_stock and i.kind = 'goods';
        if v_cogs > 0 then
          v_lines := v_lines || jsonb_build_array(
            jsonb_build_object('account_code', '1201', 'account_title', 'موجودی کالا و خرید',
              'debit', v_cogs, 'credit', 0, 'line_desc', 'بازگشت موجودی'),
            jsonb_build_object('account_code', '5101', 'account_title', 'بهای تمام‌شده کالای فروش رفته',
              'debit', 0, 'credit', v_cogs, 'line_desc', 'برگشت بهای تمام‌شده'));
        end if;
      end if;

    elsif v_rec.type = 'purchase' then
      perform public.acc_ensure_chart(v_biz, '1201', 'موجودی کالا و خرید', 'asset');
      perform public.acc_ensure_chart(v_biz, '2103', 'اعتبار مالیات و عوارض ارزش افزوده', 'asset');
      perform public.acc_ensure_chart(v_biz, '2101', 'حساب‌های پرداختنی تجاری', 'liability');
      if v_cash_code is not null then
        perform public.acc_ensure_chart(v_biz, v_cash_code,
          case when v_cash_code = '1101' then 'موجودی نقد و بانک — صندوق' else 'موجودی نقد و بانک — بانک' end, 'asset');
        v_cash_detail := public.acc_account_detail_id(v_rec.account_id);
      else
        if v_rec.partner_id is null then
          raise exception 'خرید نسیه بدون طرف‌حساب مجاز نیست — تامین‌کننده را انتخاب کنید یا حساب پرداخت نقدی را مشخص کنید';
        end if;
      end if;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('account_code', '1201', 'account_title', 'موجودی کالا و خرید',
          'debit', v_net, 'credit', 0, 'line_desc', 'خرید کالا/خدمت'),
        jsonb_build_object('account_code', '2103', 'account_title', 'اعتبار مالیات و عوارض ارزش افزوده',
          'debit', v_vat, 'credit', 0, 'line_desc', 'اعتبار مالیات خرید'));
      if v_cash_code is not null then
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('account_code', v_cash_code, 'account_title',
            case when v_cash_code = '1101' then 'موجودی نقد و بانک — صندوق' else 'موجودی نقد و بانک — بانک' end,
            'debit', 0, 'credit', v_total, 'detail_id', v_cash_detail, 'line_desc', 'پرداخت نقدی خرید'));
      else
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('account_code', '2101', 'account_title', 'حساب‌های پرداختنی تجاری',
            'debit', 0, 'credit', v_total, 'partner_id', v_rec.partner_id, 'line_desc', 'بدهی به تامین‌کننده'));
      end if;
    end if;

  elsif p_kind = 'expense' then
    select * into v_rec from public.acc_expenses where id = p_ref_id;
    if not found then raise exception 'هزینه یافت نشد'; end if;
    v_biz := v_rec.business_id;
    if not public.acc_perm_ok(v_biz, 'expenses.manage') then raise exception 'اجازهٔ ثبت هزینه را ندارید'; end if;
    if v_rec.voided_at is not null then return null; end if;
    select id into v_exists from public.acc_journal
      where business_id = v_biz and ref_type = 'expense' and ref_id = p_ref_id and ref_action = 'post' and voided_at is null limit 1;
    if v_exists is not null then return v_exists; end if;

    v_net := coalesce(v_rec.amount, 0);
    v_vat := coalesce(v_rec.vat_amount, 0);
    v_total := v_net + v_vat;
    v_date := v_rec.date_g;
    v_desc := 'هزینه: ' || coalesce(v_rec.title, v_rec.category, '');

    declare
      v_code text;
      v_title text;
      v_cash_detail uuid;
      v_pd_detail uuid;
      v_cc_code text;
    begin
      -- کد سرفصل هزینه: حساب انتخابی > mapping دسته > کد پیش‌فرض دسته‌بندی
      if v_rec.expense_account_id is not null then
        select code, title into v_code, v_title from public.acc_chart where id = v_rec.expense_account_id limit 1;
      end if;
      if v_code is null and v_rec.category is not null then
        select coalesce(cc.chart_code, cc.code) into v_code
          from public.acc_expense_categories cc
         where cc.business_id = v_biz and cc.title = v_rec.category limit 1;
        if v_code is not null then
          v_title := public.acc_chart_title(v_biz, v_code);
        end if;
      end if;
      if v_code is null then
        v_code := public.acc_expense_code(v_rec.category);
        v_title := public.acc_chart_title(v_biz, v_code);
      end if;
      v_code := coalesce(v_code, '5299');
      v_title := coalesce(v_title, coalesce(v_rec.category, 'سایر هزینه‌ها'));
      perform public.acc_ensure_chart(v_biz, v_code, v_title, 'expense');
      perform public.acc_ensure_chart(v_biz, '2103', 'اعتبار مالیات و عوارض ارزش افزوده', 'asset');

      -- بدهکار: هزینه (+اعتبار مالیات خرید در صورت وجود)
      v_lines := jsonb_build_array(
        jsonb_build_object('account_code', v_code, 'account_title', v_title,
          'debit', v_net, 'credit', 0, 'detail_id', v_rec.detail_id,
          'cost_center_id', v_rec.cost_center_id, 'project_id', v_rec.project_id,
          'line_desc', coalesce(v_rec.title, v_rec.category)));
      if v_vat > 0 then
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('account_code', '2103', 'account_title', 'اعتبار مالیات و عوارض ارزش افزوده',
            'debit', v_vat, 'credit', 0, 'line_desc', 'اعتبار مالیات هزینه'));
      end if;

      -- بستانکار بر اساس پرداخت‌کننده (بند ۱۳) — هیچ مسیری به 7101 نمی‌رود
      if v_rec.paid_by_kind in ('partner','employee','shareholder','other_person') then
        -- شخص ثالث پرداخت کرده → بدهی ما به شخص (2110)؛ بانک/صندوق شرکت دست نمی‌خورد
        perform public.acc_ensure_chart(v_biz, '2112', 'پرداختنی به اشخاص', 'liability');
        if v_rec.paid_by_detail_id is null then
          raise exception 'پرداخت‌کنندهٔ شخصی هزینه مشخص نشده است — «پرداخت‌کننده» را انتخاب کنید';
        end if;
        select id into v_pd_detail from public.acc_details
         where id = v_rec.paid_by_detail_id and business_id = v_biz;
        if v_pd_detail is null then
          raise exception 'تفصیلی پرداخت‌کننده به این کسب‌وکار تعلق ندارد';
        end if;
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('account_code', '2112', 'account_title', 'پرداختنی به اشخاص',
            'debit', 0, 'credit', v_total, 'detail_id', v_pd_detail,
            'line_desc', 'پرداخت توسط شخص ثالث — بازپرداخت به شخص'));
      elsif v_rec.paid_by_kind = 'unpaid' then
        -- پرداخت‌نشده: بدهی به طرف‌حساب (سهامدار → جاری شرکا | کارمند → جاری کارکنان | غیره → پرداختنی تجاری)
        if v_rec.partner_id is null then
          raise exception 'هزینهٔ پرداخت‌نشده بدون طرف‌حساب مجاز نیست — طرف‌حساب را مشخص کنید';
        end if;
        select case when exists (select 1 from public.acc_partner_roles r where r.partner_id = v_rec.partner_id and r.role = 'shareholder')
                     then '3103'
                    when exists (select 1 from public.acc_partner_roles r where r.partner_id = v_rec.partner_id and r.role = 'employee')
                     then '2108'
                    else '2101' end
          into v_cc_code;
        perform public.acc_ensure_chart(v_biz, v_cc_code,
          case v_cc_code when '3103' then 'جاری شرکا' when '2108' then 'جاری کارکنان' else 'حساب‌های پرداختنی تجاری' end,
          case when v_cc_code = '3103' then 'equity' else 'liability' end);
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('account_code', v_cc_code, 'account_title',
            coalesce(public.acc_chart_title(v_biz, v_cc_code), v_cc_code),
            'debit', 0, 'credit', v_total, 'partner_id', v_rec.partner_id,
            'line_desc', 'هزینه پرداخت‌نشده'));
      else
        -- شرکت پرداخت کرده → باید حساب بانک/صندوق مشخص باشد
        if v_rec.account_id is null then
          raise exception 'هزینهٔ پرداخت‌شدهٔ شرکت بدون حساب بانک/صندوق مجاز نیست — حساب پرداخت‌کننده را انتخاب کنید یا پرداخت‌کنندهٔ شخصی/پرداخت‌نشده را مشخص کنید';
        end if;
        select kind into v_acc_kind from public.acc_accounts where id = v_rec.account_id;
        v_cash_code := case when v_acc_kind = 'cash' then '1101' else '1102' end;
        perform public.acc_ensure_chart(v_biz, v_cash_code,
          case when v_cash_code = '1101' then 'موجودی نقد و بانک — صندوق' else 'موجودی نقد و بانک — بانک' end, 'asset');
        v_cash_detail := public.acc_account_detail_id(v_rec.account_id);
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('account_code', v_cash_code, 'account_title',
            case when v_cash_code = '1101' then 'موجودی نقد و بانک — صندوق' else 'موجودی نقد و بانک — بانک' end,
            'debit', 0, 'credit', v_total, 'detail_id', v_cash_detail, 'line_desc', 'پرداخت هزینه'));
      end if;
    end;

  elsif p_kind = 'transaction' then
    select * into v_rec from public.acc_transactions where id = p_ref_id;
    if not found then raise exception 'تراکنش یافت نشد'; end if;
    v_biz := v_rec.business_id;
    if not public.acc_perm_ok(v_biz, 'payments.manage') then raise exception 'اجازهٔ ثبت دریافت/پرداخت را ندارید'; end if;
    if v_rec.voided_at is not null then return null; end if;
    select id into v_exists from public.acc_journal
      where business_id = v_biz and ref_type = 'transaction' and ref_id = p_ref_id and ref_action = 'post' and voided_at is null limit 1;
    if v_exists is not null then return v_exists; end if;

    v_total := coalesce(v_rec.amount, 0);
    v_date := v_rec.date_g;

    if v_rec.kind = 'transfer' then
      -- انتقال داخلی: فقط جابه‌جایی بین دو حساب خودِ کسب‌وکار
      if v_rec.account_id is null or v_rec.to_account_id is null then
        return null; -- انتقال ناقص سند ندارد (قید قدیمی)
      end if;
      v_desc := 'انتقال: ' || coalesce(v_rec.description, '');
      declare v_to_cash text; v_to_title text; begin
        select kind into v_acc_kind from public.acc_accounts where id = v_rec.to_account_id;
        v_to_cash := case when v_acc_kind = 'cash' then '1101' else '1102' end;
        perform public.acc_ensure_chart(v_biz, v_to_cash,
          case when v_to_cash = '1101' then 'موجودی نقد و بانک — صندوق' else 'موجودی نقد و بانک — بانک' end, 'asset');
        v_lines := jsonb_build_array(
          jsonb_build_object('account_code', v_to_cash, 'account_title',
            coalesce(public.acc_chart_title(v_biz, v_to_cash), v_to_cash),
            'debit', v_total, 'credit', 0,
            'detail_id', public.acc_account_detail_id(v_rec.to_account_id),
            'line_desc', coalesce(v_rec.description, 'انتقال وجه')));
        select kind into v_acc_kind from public.acc_accounts where id = v_rec.account_id;
        v_cash_code := case when v_acc_kind = 'cash' then '1101' else '1102' end;
        perform public.acc_ensure_chart(v_biz, v_cash_code,
          case when v_cash_code = '1101' then 'موجودی نقد و بانک — صندوق' else 'موجودی نقد و بانک — بانک' end, 'asset');
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('account_code', v_cash_code, 'account_title',
            coalesce(public.acc_chart_title(v_biz, v_cash_code), v_cash_code),
            'debit', 0, 'credit', v_total,
            'detail_id', public.acc_account_detail_id(v_rec.account_id),
            'line_desc', coalesce(v_rec.description, 'انتقال وجه')));
      end;
    else
      -- دریافت/پرداخت: طرف‌حساب اجباری (بند ۱۱) — بدون 7101
      if v_rec.partner_id is null then
        raise exception 'ثبت % بدون طرف‌حساب مجاز نیست — طرف‌حساب را انتخاب کنید',
          case when v_rec.kind = 'receipt' then 'دریافت' else 'پرداخت' end;
      end if;
      if v_rec.account_id is null then
        raise exception 'حساب بانک/صندوق % مشخص نشده است', case when v_rec.kind = 'receipt' then 'دریافت' else 'پرداخت' end;
      end if;
      select kind into v_acc_kind from public.acc_accounts where id = v_rec.account_id;
      v_cash_code := case when v_acc_kind = 'cash' then '1101' else '1102' end;
      perform public.acc_ensure_chart(v_biz, v_cash_code,
        case when v_cash_code = '1101' then 'موجودی نقد و بانک — صندوق' else 'موجودی نقد و بانک — بانک' end, 'asset');
      perform public.acc_ensure_chart(v_biz, '1103', 'حساب‌های دریافتنی تجاری', 'asset');
      perform public.acc_ensure_chart(v_biz, '2101', 'حساب‌های پرداختنی تجاری', 'liability');

      declare
        v_pd uuid;
        v_pname text;
        v_pcode text;
        v_ptitle text;
      begin
        -- تفصیلی طرف‌حساب با نقش: سهامدار → 3103 | کارمند → 2108 | غیره → 1103/2101
        select role into v_acc_kind from public.acc_partner_roles
         where partner_id = v_rec.partner_id and role in ('shareholder','employee')
         order by case role when 'shareholder' then 1 else 2 end limit 1;
        if v_acc_kind = 'shareholder' then
          v_pcode := '3103'; v_ptitle := coalesce(public.acc_chart_title(v_biz, '3103'), 'جاری شرکا');
          perform public.acc_ensure_chart(v_biz, '3103', 'جاری شرکا', 'equity');
        elsif v_acc_kind = 'employee' then
          v_pcode := '2108'; v_ptitle := coalesce(public.acc_chart_title(v_biz, '2108'), 'جاری کارکنان');
          perform public.acc_ensure_chart(v_biz, '2108', 'جاری کارکنان', 'liability');
        else
          v_pcode := case when v_rec.kind = 'receipt' then '1103' else '2101' end;
          v_ptitle := case when v_rec.kind = 'receipt' then 'حساب‌های دریافتنی تجاری' else 'حساب‌های پرداختنی تجاری' end;
        end if;
        select name into v_pname from public.acc_partners where id = v_rec.partner_id;
        v_pd := public.acc_ensure_detail(
          v_biz,
          case when v_acc_kind = 'shareholder' then 'shareholder'
               when v_acc_kind = 'employee' then 'employee'
               when v_rec.kind = 'receipt' then 'customer' else 'supplier' end,
          coalesce(v_pname, ''), v_rec.partner_id);

        if v_rec.kind = 'receipt' then
          v_desc := 'دریافت: ' || coalesce(v_rec.description, '');
          v_lines := jsonb_build_array(
            jsonb_build_object('account_code', v_cash_code, 'account_title',
              coalesce(public.acc_chart_title(v_biz, v_cash_code), public.acc_cash_title(v_cash_code)),
              'debit', v_total, 'credit', 0,
              'detail_id', public.acc_account_detail_id(v_rec.account_id),
              'line_desc', coalesce(v_rec.description, 'دریافت وجه')),
            jsonb_build_object('account_code', v_pcode, 'account_title', v_ptitle,
              'debit', 0, 'credit', v_total, 'partner_id', v_rec.partner_id, 'detail_id', v_pd,
              'line_desc', coalesce(v_rec.description, 'تسویه مطالبات')));
        else
          v_desc := 'پرداخت: ' || coalesce(v_rec.description, '');
          v_lines := jsonb_build_array(
            jsonb_build_object('account_code', v_pcode, 'account_title', v_ptitle,
              'debit', v_total, 'credit', 0, 'partner_id', v_rec.partner_id, 'detail_id', v_pd,
              'line_desc', coalesce(v_rec.description, 'تسویه بدهی')),
            jsonb_build_object('account_code', v_cash_code, 'account_title',
              coalesce(public.acc_chart_title(v_biz, v_cash_code), public.acc_cash_title(v_cash_code)),
              'debit', 0, 'credit', v_total,
              'detail_id', public.acc_account_detail_id(v_rec.account_id),
              'line_desc', coalesce(v_rec.description, 'پرداخت وجه')));
        end if;
      end;
    end if;
  end if;

  -- نویسندهٔ واحد
  v_id := public.acc_post_journal(v_biz, v_date, p_kind, 'post', p_ref_id, v_desc, v_lines);
  return v_id;
end $$;

-- ═══ §۲) گارد ویرایش هزینه — فقط سندِ فعال قفل است ═══
create or replace function public.acc_expense_posted_guard()
returns trigger
language plpgsql
security definer
set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.voided_at is null and new.voided_at is null
     and exists (select 1 from public.acc_journal j
                  where j.ref_type = 'expense' and j.ref_id = new.id and j.ref_action = 'post' and j.voided_at is null)
     and (
       coalesce(new.amount,0) <> coalesce(old.amount,0)
       or coalesce(new.vat_amount,0) <> coalesce(old.vat_amount,0)
       or new.date_g is distinct from old.date_g
       or new.category is distinct from old.category
       or new.account_id is distinct from old.account_id
       or new.expense_account_id is distinct from old.expense_account_id
       or new.partner_id is distinct from old.partner_id
       or new.detail_id is distinct from old.detail_id
       or new.cost_center_id is distinct from old.cost_center_id
       or new.project_id is distinct from old.project_id
       or new.paid_by_kind is distinct from old.paid_by_kind
       or new.paid_by_detail_id is distinct from old.paid_by_detail_id
     ) then
    raise exception 'هزینهٔ سندخورده قابل ویرایش نیست — ابتدا سند را ابطال کنید، سپس ویرایش و صدور مجدد';
  end if;
  return new;
end $$;

-- ═══ §۳) RPC ویرایش اتمیک هزینه — ابطال + ویرایش + صدور مجدد در یک تراکنش ═══
create or replace function public.acc_edit_expense(p_expense_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_old public.acc_expenses%ROWTYPE;
  v_keys text[] := array['title','category','amount','vat_amount','date_g','description',
    'vendor_name','receipt_no','receipt_url','tax_status','tax_note','is_paid',
    'paid_by_kind','paid_by_detail_id','account_id','partner_id',
    'expense_account_id','detail_id','cost_center_id','project_id'];
  v_financial text[] := array['amount','vat_amount','date_g','category','account_id',
    'expense_account_id','partner_id','detail_id','cost_center_id','project_id',
    'paid_by_kind','paid_by_detail_id'];
  v_k text;
  v_fin_changed boolean := false;
  v_new_val text;
  v_old_val text;
  v_voided int := 0;
  v_journal uuid;
begin
  if v_user is null then raise exception 'ابتدا وارد حساب کاربری شوید'; end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'پچ ارسالی نامعتبر است';
  end if;
  select * into v_old from public.acc_expenses where id = p_expense_id;
  if not found then raise exception 'هزینه یافت نشد'; end if;
  if not public.acc_perm_ok(v_old.business_id, 'expenses.manage') then
    raise exception 'اجازهٔ ویرایش هزینه در این کسب‌وکار را ندارید';
  end if;
  if v_old.voided_at is not null then
    raise exception 'هزینهٔ ابطال‌شده قابل ویرایش نیست — حذف کامل کنید و هزینهٔ جدید ثبت کنید';
  end if;

  -- کلیدهای مجاز + تشخیص تغییر مالی (فقط کلیدهای ارسالی مقایسه می‌شوند)
  foreach v_k in array v_keys loop
    if p_patch ? v_k then
      if v_k = any (v_financial) then
        v_new_val := coalesce(nullif(p_patch ->> v_k, ''), '');
        case v_k
          when 'amount' then v_old_val := coalesce(v_old.amount::text, '0');
          when 'vat_amount' then v_old_val := coalesce(v_old.vat_amount::text, '0');
          when 'date_g' then v_old_val := coalesce(v_old.date_g::text, '');
          when 'category' then v_old_val := coalesce(v_old.category, '');
          when 'account_id' then v_old_val := coalesce(v_old.account_id::text, '');
          when 'expense_account_id' then v_old_val := coalesce(v_old.expense_account_id::text, '');
          when 'partner_id' then v_old_val := coalesce(v_old.partner_id::text, '');
          when 'detail_id' then v_old_val := coalesce(v_old.detail_id::text, '');
          when 'cost_center_id' then v_old_val := coalesce(v_old.cost_center_id::text, '');
          when 'project_id' then v_old_val := coalesce(v_old.project_id::text, '');
          when 'paid_by_kind' then v_old_val := coalesce(v_old.paid_by_kind, '');
          when 'paid_by_detail_id' then v_old_val := coalesce(v_old.paid_by_detail_id::text, '');
        end case;
        if v_k in ('amount','vat_amount') then
          v_fin_changed := v_fin_changed or (coalesce(nullif(v_new_val, ''), '0')::numeric <> coalesce(nullif(v_old_val, ''), '0')::numeric);
        else
          v_fin_changed := v_fin_changed or (v_new_val is distinct from v_old_val);
        end if;
      end if;
    end if;
  end loop;

  -- تغییر مالی ⇒ ابطال سند فعال (تاریخچه محفوظ می‌ماند) — صدور مجدد خودکار
  if v_fin_changed then
    with x as (
      update public.acc_journal
         set voided_at = now(),
             void_reason = coalesce(nullif(p_patch ->> '_void_reason', ''), 'ویرایش هزینه — صدور سند جایگزین')
       where ref_type = 'expense' and ref_id = p_expense_id
         and ref_action = 'post' and voided_at is null
      returning id
    )
    select count(*) into v_voided from x;
  end if;

  -- آپدیت ایستا (type-safe؛ «رشتهٔ خالی» = «نال» برای فیلدهای اختیاری)
  update public.acc_expenses set
    title              = case when p_patch ? 'title'              then nullif(p_patch ->> 'title', '')                          else title end,
    category           = case when p_patch ? 'category'           then nullif(p_patch ->> 'category', '')                       else category end,
    amount             = case when p_patch ? 'amount'             then (p_patch ->> 'amount')::numeric                          else amount end,
    vat_amount         = case when p_patch ? 'vat_amount'         then (p_patch ->> 'vat_amount')::numeric                      else vat_amount end,
    date_g             = case when p_patch ? 'date_g'             then (p_patch ->> 'date_g')::date                             else date_g end,
    description        = case when p_patch ? 'description'        then nullif(p_patch ->> 'description', '')                    else description end,
    vendor_name        = case when p_patch ? 'vendor_name'        then nullif(p_patch ->> 'vendor_name', '')                    else vendor_name end,
    receipt_no         = case when p_patch ? 'receipt_no'         then nullif(p_patch ->> 'receipt_no', '')                     else receipt_no end,
    receipt_url        = case when p_patch ? 'receipt_url'        then nullif(p_patch ->> 'receipt_url', '')                    else receipt_url end,
    tax_status         = case when p_patch ? 'tax_status'         then nullif(p_patch ->> 'tax_status', '')                     else tax_status end,
    tax_note           = case when p_patch ? 'tax_note'           then nullif(p_patch ->> 'tax_note', '')                       else tax_note end,
    is_paid            = case when p_patch ? 'is_paid'            then (p_patch ->> 'is_paid')::boolean                         else is_paid end,
    paid_by_kind       = case when p_patch ? 'paid_by_kind'       then nullif(p_patch ->> 'paid_by_kind', '')                   else paid_by_kind end,
    paid_by_detail_id  = case when p_patch ? 'paid_by_detail_id'  then nullif(p_patch ->> 'paid_by_detail_id', '')::uuid        else paid_by_detail_id end,
    account_id         = case when p_patch ? 'account_id'         then nullif(p_patch ->> 'account_id', '')::uuid               else account_id end,
    partner_id         = case when p_patch ? 'partner_id'         then nullif(p_patch ->> 'partner_id', '')::uuid               else partner_id end,
    expense_account_id = case when p_patch ? 'expense_account_id' then nullif(p_patch ->> 'expense_account_id', '')::uuid       else expense_account_id end,
    detail_id          = case when p_patch ? 'detail_id'          then nullif(p_patch ->> 'detail_id', '')::uuid                else detail_id end,
    cost_center_id     = case when p_patch ? 'cost_center_id'     then nullif(p_patch ->> 'cost_center_id', '')::uuid           else cost_center_id end,
    project_id         = case when p_patch ? 'project_id'         then nullif(p_patch ->> 'project_id', '')::uuid               else project_id end
  where id = p_expense_id;

  -- سند فعال پس از تراکنش (اگر دوباره صادر شده، شناسهٔ جدید است)
  select j.id into v_journal
    from public.acc_journal j
   where j.ref_type = 'expense' and j.ref_id = p_expense_id
     and j.ref_action = 'post' and j.voided_at is null
   limit 1;

  return jsonb_build_object(
    'expense_id', p_expense_id,
    'financial_changed', v_fin_changed,
    'voided_journals', v_voided,
    'active_journal_id', v_journal
  );
end $$;

grant execute on function public.acc_edit_expense(uuid, jsonb) to authenticated;
revoke all on function public.acc_edit_expense(uuid, jsonb) from public, anon;

-- ═══ §۴) POSTCHECK ═══
do $$
declare
  v_src text;
  v_ok int := 0;
begin
  select prosrc into v_src from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where p.proname = 'acc_post_document' and n.nspname = 'public';
  if array_length(string_to_array(v_src, 'and ref_action = ''post'' and voided_at is null'), 1) - 1 >= 3 then
    raise notice 'POSTCHECK §۱ idempotency v4: OK'; v_ok := v_ok + 1;
  else raise exception 'POSTCHECK §۱ ناموفق — idempotency ابطال‌آگاه نصب نشد'; end if;

  select prosrc into v_src from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where p.proname = 'acc_expense_posted_guard' and n.nspname = 'public';
  if position('j.voided_at is null' in v_src) > 0 then
    raise notice 'POSTCHECK §۲ گارد هزینه: OK'; v_ok := v_ok + 1;
  else raise exception 'POSTCHECK §۲ ناموفق — گارد هزینه ابطال‌آگاه نیست'; end if;

  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where p.proname = 'acc_edit_expense' and n.nspname = 'public') then
    raise notice 'POSTCHECK §۳ RPC acc_edit_expense: OK'; v_ok := v_ok + 1;
  else raise exception 'POSTCHECK §۳ ناموفق — RPC ساخته نشد'; end if;

  raise notice 'POSTCHECK M220000: % / 3 کنترل سبز', v_ok;
end $$;
