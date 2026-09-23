/* ═══════════════════════════════════════════════════════════════════
   سناریو: Master Data — کد یکتای طرف‌حساب (۲۰ هم‌زمان)، نقش‌ها،
   زنجیرهٔ نقش→تفصیلی، مراکز هزینه، گارد حذف (بندهای ۳۰، ۴۰، ۴۱)
   ═══════════════════════════════════════════════════════════════════ */

export async function run(ctx) {
  const { A, B, bizA, bizB, record, TODAY, RID } = ctx;
  const P = `MD-${RID}`;

  /* MD1: ۲۰ طرف‌حساب هم‌زمان → ۲۰ کد یکتا (بند ۴۰) */
  {
    const n = 20;
    const out = Array(n).fill(null);
    await Promise.all(out.map(async (_, i) => {
      const { data, error } = await A.sb
        .from('acc_partners')
        .insert({ business_id: bizA, kind: 'customer', person_type: 'legal', name: `${P}-همزمان-${i}` })
        .select('partner_code')
        .single();
      out[i] = error ? `err:${error.message.slice(0, 40)}` : data?.partner_code;
    }));
    const codes = out.filter((x) => typeof x === 'string');
    const uniq = new Set(codes).size;
    record('MD1', '۲۰ طرف‌حساب هم‌زمان → ۲۰ کد یکتا', codes.length === 20 && uniq === 20 ? 'PASS' : 'FAIL',
      `ok=${codes.length} uniq=${uniq} errs=${out.filter((x) => typeof x !== 'string').length}`);
  }

  /* MD2: یک شخص + چند نقش هم‌زمان؛ نقش تکراری رد (بند ۴۱) */
  {
    const { data: p } = await A.sb
      .from('acc_partners')
      .insert({ business_id: bizA, kind: 'both', person_type: 'real', name: `${P}-علی رضایی` })
      .select('id, partner_code')
      .single();
    const roles = ['customer', 'supplier', 'shareholder', 'employee'];
    let allOk = true;
    for (const role of roles) {
      const { error } = await A.sb.from('acc_partner_roles').insert({ business_id: bizA, partner_id: p.id, role });
      if (error) allOk = false;
    }
    const { error: dupErr } = await A.sb.from('acc_partner_roles').insert({ business_id: bizA, partner_id: p.id, role: 'customer' });
    record('MD2', 'یک شخص + ۴ نقش هم‌زمان؛ نقش تکراری رد شود', allOk && !!dupErr ? 'PASS' : 'FAIL',
      `partner_code=${p.partner_code} dupBlocked=${!!dupErr}`);

    /* MD3: زنجیرهٔ نقش→تفصیلی — برای هر نقش نیازمند دفتر تفصیلی با ref_id شریک ساخته شود */
    const { data: dets } = await A.sb.from('acc_details')
      .select('kind, detail_code, ref_id').eq('business_id', bizA).eq('ref_id', p.id);
    const kinds = new Set((dets || []).map((d) => d.kind));
    const ok = ['customer', 'supplier', 'shareholder', 'employee'].every((k) => kinds.has(k));
    const coded = (dets || []).every((d) => !!d.detail_code);
    record('MD3', 'زنجیرهٔ Partner→Role→Detail (۴ تفصیلی سیستمی کددار)', ok && coded ? 'PASS' : 'FAIL',
      `kinds=${[...kinds].join(',')}`);
  }

  /* MD4: مراکز هزینه — بذر استاندارد + کد اتمیک هم‌زمان (بند ۲۲ و ۴۰) */
  {
    const { data: seeded } = await A.sb.from('acc_cost_centers').select('code').eq('business_id', bizA);
    const n = 20;
    const out = Array(n).fill(null);
    await Promise.all(out.map(async (_, i) => {
      const { data, error } = await A.sb.from('acc_cost_centers')
        .insert({ business_id: bizA, name: `${P}-مرکز-${i}` })
        .select('code').single();
      out[i] = error ? 'err' : data?.code;
    }));
    const codes = out.filter((x) => typeof x === 'string');
    record('MD4', '۲۰ مرکز هزینه هم‌زمان → کدهای CC-### یکتا + بذر ۵تایی',
      codes.length === 20 && new Set(codes).size === 20 && (seeded || []).length >= 5 ? 'PASS' : 'FAIL',
      `seeded=${(seeded || []).length} created=${codes.length} uniq=${new Set(codes).size}`);
  }

  /* MD5: گارد حذف — طرف‌حساب دارای گردش ممنوع؛ حذف طرف‌حساب بدون گردش مجاز (بند ۳۰) */
  {
    /* طرف‌حساب آزمایشی با نقش مشتری → تفصیلی خودکار (تریگر نقش) → گردش واقعی */
    const { data: busy, error: busyErr } = await A.sb.from('acc_partners')
      .insert({ business_id: bizA, kind: 'customer', person_type: 'real', name: `${P}-باگردش` })
      .select('id, name').single();
    if (busyErr || !busy) {
      record('MD5', 'حذف طرف‌حساب دارای گردش → رد با پیام غیرفعال‌سازی', 'FAIL',
        'ساخت طرف‌حساب: ' + (busyErr?.message?.slice(0, 55) || 'بدون داده'));
    } else {
      await A.sb.from('acc_partner_roles').insert({ business_id: bizA, partner_id: busy.id, role: 'customer' });
      /* گردش بساز: سند دستی روی 1103 با تفصیلی مشتریِ همین طرف‌حساب */
      const { data: det } = await A.sb.from('acc_details')
        .select('id').eq('business_id', bizA).eq('ref_id', busy.id).eq('kind', 'customer').maybeSingle();
      if (det) {
        await A.sb.rpc('acc_create_journal', {
          p_business: bizA, p_date: TODAY, p_description: `${P}-گردش`, p_ref_type: 'manual',
          p_lines: [
            { account_code: '1103', debit: 1000, credit: 0, detail_id: det.id },
            { account_code: '4101', debit: 0, credit: 1000 },
          ],
        });
      }
      const { error: delErr } = await A.sb.from('acc_partners').delete().eq('id', busy.id);
      record('MD5', 'حذف طرف‌حساب دارای گردش → رد با پیام غیرفعال‌سازی', !!delErr && /غیرفعال/.test(delErr.message) ? 'PASS' : 'FAIL',
        delErr ? delErr.message.slice(0, 70) : `no error! (det=${!!det})`);

    /* طرف‌حساب بدون گردش: حذف مجاز */
    const { data: fresh } = await A.sb.from('acc_partners')
      .insert({ business_id: bizA, kind: 'customer', person_type: 'real', name: `${P}-بدون-گردش` })
      .select('id').single();
    const { error: okErr } = await A.sb.from('acc_partners').delete().eq('id', fresh.id);
    record('MD6', 'حذف طرف‌حساب بدون گردش مجاز است', !okErr ? 'PASS' : 'FAIL', okErr?.message?.slice(0, 60));
    }
  }

  /* MD7: ایزوله‌سازی — کسب‌وکار B نقش‌ها و مراکز A را نمی‌بیند (بند ۳۷ و ۴۹) */
  {
    const { count: r1 } = await B.sb.from('acc_partner_roles').select('*', { count: 'exact', head: true }).eq('business_id', bizA);
    const { count: r2 } = await B.sb.from('acc_cost_centers').select('*', { count: 'exact', head: true }).eq('business_id', bizA);
    const { count: r3 } = await B.sb.from('acc_partners').select('*', { count: 'exact', head: true }).eq('business_id', bizA);
    record('MD7', 'کسب‌وکار B داده‌های Master کسب‌وکار A را نمی‌بیند',
      (r1 || 0) === 0 && (r2 || 0) === 0 && (r3 || 0) === 0 ? 'PASS' : 'FAIL',
      `roles=${r1} cc=${r2} partners=${r3}`);
  }

  /* MD8: viewer نمی‌تواند Master Data بسازد (بند ۳۸) — تست در permissions spec با V انجام می‌شود؛
     این‌جا: آغاز شمارندهٔ مستقل هر کسب‌وکار — کد A و B هر دو از ۱۰۰۰۰۱ شروع اما فضای جداست */
  {
    const { data: pb } = await B.sb.from('acc_partners')
      .insert({ business_id: bizB, kind: 'customer', person_type: 'real', name: `${P}-B-اول` })
      .select('partner_code').single();
    record('MD8', 'شمارندهٔ کد مستقل برای هر کسب‌وکار', pb?.partner_code === '100001' ? 'PASS' : 'PARTIAL',
      `bizB first code=${pb?.partner_code} (اگر B قبلاً در تست‌های دیگر طرف‌حساب ساخته باشد > ۱۰۰۰۰۱ است)`);
  }
}
