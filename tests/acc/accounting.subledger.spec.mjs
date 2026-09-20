/* ═══════════════════════════════════════════════════════════════════
   سناریو: Subledger و اتصال عملیات به کدینگ — هزینه/دریافت/پرداخت/
   انتقال/جاری شرکا/جاری کارکنان/اعتبارسنجی تفصیلی/گزارش از Journal
   (بندهای ۱۰، ۱۱، ۲۱، ۲۵، ۲۸، ۴۲، ۴۳، ۴۴، ۴۵، ۴۶، ۴۷، ۴۸، ۵۱، ۸۹)
   ═══════════════════════════════════════════════════════════════════ */

const M = (x) => Number(x || 0);

export async function run(ctx) {
  const { A, B, bizA, bizB, record, TODAY, RID } = ctx;
  const P = `SL-${RID}`;

  /* آماده‌سازی: شریک سه‌نقشی، مشتری، تامین‌کننده، کارمند مستقل، بانک و صندوق */
  const { data: sh } = await A.sb.from('acc_partners')
    .insert({ business_id: bizA, kind: 'both', person_type: 'real', name: `${P}-شریک علی` })
    .select('id, partner_code').single();
  for (const role of ['customer', 'supplier', 'shareholder']) {
    await A.sb.from('acc_partner_roles').insert({ business_id: bizA, partner_id: sh.id, role });
  }
  const { data: emp } = await A.sb.from('acc_partners')
    .insert({ business_id: bizA, kind: 'both', person_type: 'real', name: `${P}-کارمند زد` })
    .select('id, partner_code').single();
  await A.sb.from('acc_partner_roles').insert({ business_id: bizA, partner_id: emp.id, role: 'employee' });

  const { data: bank } = await A.sb.from('acc_accounts')
    .insert({ business_id: bizA, name: `${P}-بانک ملت`, kind: 'bank', account_number: '123', initial_balance: 0 })
    .select('id, chart_code, detail_id').single();
  const { data: cash } = await A.sb.from('acc_accounts')
    .insert({ business_id: bizA, name: `${P}-صندوق`, kind: 'cash', initial_balance: 0 })
    .select('id, chart_code, detail_id').single();
  record('SL0', 'بانک/صندوق: کد معین + تفصیلی اختصاصی خودکار',
    bank?.chart_code === '1102' && cash?.chart_code === '1101' && bank?.detail_id && cash?.detail_id ? 'PASS' : 'FAIL',
    `bank=${bank?.chart_code}/${!!bank?.detail_id} cash=${cash?.chart_code}/${!!cash?.detail_id}`);

  /* SL1: واریز شریک ۱۰۰م → بانک بدهکار / جاری شرکا (3103) بستانکار با تفصیلی سهامدار (بند ۴۲) */
  {
    const { data: tx, error } = await A.sb.from('acc_transactions')
      .insert({ business_id: bizA, kind: 'receipt', amount: 100000000, date_g: TODAY, method: 'transfer', account_id: bank.id, partner_id: sh.id, description: 'واریز آورده شریک' })
      .select('id').single();
    const { data: ls } = await A.sb.from('acc_journal_lines')
      .select('account_code, debit, credit, detail_id, acc_details(kind)').eq('business_id', bizA)
      .eq('entry_id', (await A.sb.from('acc_journal').select('id').eq('ref_type', 'transaction').eq('ref_id', tx.id).single()).data.id);
    const d3103 = (ls || []).find((l) => l.account_code === '3103');
    const d1102 = (ls || []).find((l) => l.account_code === '1102');
    const ok = !error && !!d3103 && M(d3103.credit) === 100000000 && d3103.acc_details?.kind === 'shareholder'
      && !!d1102 && M(d1102.debit) === 100000000 && !!d1102.detail_id;
    record('SL1', 'واریز شریک ۱۰۰م: بانک بدهکار / 3103 بستانکار (تفصیلی سهامدار)', ok ? 'PASS' : 'FAIL',
      JSON.stringify((ls || []).map((l) => [l.account_code, l.debit, l.credit, l.acc_details?.kind])));
  }

  /* SL2: هزینه پرداخت‌شده توسط شریک ۱۰م → هزینه بدهکار / جاری شریک بستانکار (بند ۴۲) */
  {
    const { data: exp, error } = await A.sb.from('acc_expenses')
      .insert({ business_id: bizA, category: 'تبلیغات و بازاریابی', title: `${P}-هزینه توسط شریک`, amount: 10000000, vat_amount: 0, date_g: TODAY, partner_id: sh.id, is_paid: false })
      .select('id').single();
    const { data: j } = await A.sb.from('acc_journal').select('id').eq('ref_type', 'expense').eq('ref_id', exp.id).maybeSingle();
    let ls = [];
    if (j) {
      const r = await A.sb.from('acc_journal_lines').select('account_code, debit, credit, acc_details(kind)').eq('entry_id', j.id);
      ls = r.data || [];
    }
    const d3103 = ls.find((l) => l.account_code === '3103');
    const ok = !error && !!d3103 && M(d3103.credit) === 10000000 && d3103.acc_details?.kind === 'shareholder'
      && ls.some((l) => l.account_code === '5205' && M(l.debit) === 10000000);
    record('SL2', 'هزینه پرداخت‌شده توسط شریک: هزینه بدهکار / جاری شریک بستانکار', ok ? 'PASS' : 'FAIL',
      JSON.stringify(ls.map((l) => [l.account_code, l.debit, l.credit, l.acc_details?.kind])));
  }

  /* SL3: هزینه توسط کارمند ۵م → جاری کارکنان (2108) بستانکار؛ بازپرداخت ۲م → 2108 بدهکار (بند ۴۳) */
  {
    const { data: exp } = await A.sb.from('acc_expenses')
      .insert({ business_id: bizA, category: 'اجاره', title: `${P}-هزینه توسط کارمند`, amount: 5000000, vat_amount: 0, date_g: TODAY, partner_id: emp.id, is_paid: false })
      .select('id').single();
    const { data: j } = await A.sb.from('acc_journal').select('id').eq('ref_type', 'expense').eq('ref_id', exp.id).maybeSingle();
    const { data: ls } = j ? await A.sb.from('acc_journal_lines').select('account_code, debit, credit, acc_details(kind)').eq('entry_id', j.id) : { data: [] };
    const d2108 = (ls || []).find((l) => l.account_code === '2108');
    record('SL3a', 'هزینه توسط کارمند: هزینه بدهکار / جاری کارکنان بستانکار',
      d2108 && M(d2108.credit) === 5000000 && d2108.acc_details?.kind === 'employee' ? 'PASS' : 'FAIL',
      JSON.stringify((ls || []).map((l) => [l.account_code, l.debit, l.credit, l.acc_details?.kind])));

    const { data: tx } = await A.sb.from('acc_transactions')
      .insert({ business_id: bizA, kind: 'payment', amount: 2000000, date_g: TODAY, method: 'transfer', account_id: bank.id, partner_id: emp.id, description: 'بازپرداخت به کارمند' })
      .select('id').single();
    const { data: j2 } = await A.sb.from('acc_journal').select('id').eq('ref_type', 'transaction').eq('ref_id', tx.id).single();
    const { data: ls2 } = await A.sb.from('acc_journal_lines').select('account_code, debit, credit').eq('entry_id', j2.id);
    const d2108b = (ls2 || []).find((l) => l.account_code === '2108');
    record('SL3b', 'بازپرداخت به کارمند: جاری کارکنان بدهکار / بانک بستانکار',
      d2108b && M(d2108b.debit) === 2000000 && (ls2 || []).some((l) => l.account_code === '1102' && M(l.credit) === 2000000) ? 'PASS' : 'FAIL',
      JSON.stringify((ls2 || []).map((l) => [l.account_code, l.debit, l.credit])));
  }

  /* SL4: هزینه با Mapping کامل — حساب 5401 + تفصیلی + مرکز هزینه + بانک (بند ۲۱ و ۴۴) */
  {
    const { data: cc } = await A.sb.from('acc_cost_centers')
      .insert({ business_id: bizA, name: `${P}-بازاریابی` }).select('id').single();
    const { data: prj } = await A.sb.from('acc_projects')
      .insert({ business_id: bizA, name: `${P}-همایش تهران` }).select('id').single();
    const { data: chart } = await A.sb.from('acc_chart').select('id').eq('code', '5401').is('business_id', null).maybeSingle();
    const expAccId = chart?.id || null;
    const { data: exp, error } = await A.sb.from('acc_expenses')
      .insert({
        business_id: bizA, category: 'تبلیغات و بازاریابی', title: `${P}-کمپین`, amount: 20000000, vat_amount: 0,
        date_g: TODAY, account_id: bank.id, partner_id: sh.id, is_paid: true,
        expense_account_id: expAccId, cost_center_id: cc.id, project_id: prj.id,
      })
      .select('id').single();
    const { data: j } = await A.sb.from('acc_journal').select('id').eq('ref_type', 'expense').eq('ref_id', exp.id).maybeSingle();
    const { data: ls } = j ? await A.sb.from('acc_journal_lines')
      .select('account_code, debit, credit, detail_id, cost_center_id, project_id').eq('entry_id', j.id) : { data: [] };
    const debit = (ls || []).find((l) => l.account_code === '5401');
    const ok = !error && !!debit && M(debit.debit) === 20000000
      && (!!debit.detail_id || debit.account_code === '1103')
      && debit.cost_center_id === cc.id && debit.project_id === prj.id
      && (ls || []).some((l) => l.account_code === '1102' && M(l.credit) === 20000000 && !!l.detail_id);
    record('SL4', 'هزینه ۲۰م با حساب/مرکز هزینه/پروژه/تفصیلی بانک روی سطر سند', ok ? 'PASS' : 'FAIL',
      JSON.stringify((ls || []).map((l) => [l.account_code, l.debit, l.credit, !!l.detail_id, !!l.cost_center_id, !!l.project_id])));
  }

  /* SL5: دریافت از مشتری با فاکتور — 1103 بستانکار با تفصیلی مشتری (بند ۴۵) */
  {
    const { data: cust } = await A.sb.from('acc_partners')
      .insert({ business_id: bizA, kind: 'customer', person_type: 'legal', name: `${P}-مشتری ایکس` })
      .select('id').single();
    const { data: tx } = await A.sb.from('acc_transactions')
      .insert({ business_id: bizA, kind: 'receipt', amount: 50000000, date_g: TODAY, method: 'transfer', account_id: bank.id, partner_id: cust.id, description: 'دریافت از مشتری' })
      .select('id').single();
    const { data: j } = await A.sb.from('acc_journal').select('id').eq('ref_type', 'transaction').eq('ref_id', tx.id).single();
    const { data: ls } = await A.sb.from('acc_journal_lines').select('account_code, debit, credit, acc_details(kind)').eq('entry_id', j.id);
    const ar = (ls || []).find((l) => l.account_code === '1103');
    record('SL5', 'دریافت ۵۰م: بانک بدهکار / 1103 بستانکار با تفصیلی مشتری',
      ar && M(ar.credit) === 50000000 && ar.acc_details?.kind === 'customer' ? 'PASS' : 'FAIL',
      JSON.stringify((ls || []).map((l) => [l.account_code, l.debit, l.credit, l.acc_details?.kind])));
  }

  /* SL6: انتقال بانک→صندوق — فقط 1101 بدهکار / 1102 بستانکار؛ صفر درآمد/هزینه (بند ۲۸ و ۴۷) */
  {
    const { data: tx } = await A.sb.from('acc_transactions')
      .insert({ business_id: bizA, kind: 'transfer', amount: 10000000, date_g: TODAY, method: 'transfer', account_id: bank.id, to_account_id: cash.id, description: 'انتقال به صندوق' })
      .select('id').single();
    const { data: j } = await A.sb.from('acc_journal').select('id').eq('ref_type', 'transaction').eq('ref_id', tx.id).maybeSingle();
    const { data: ls } = j ? await A.sb.from('acc_journal_lines').select('account_code, debit, credit').eq('entry_id', j.id) : { data: [] };
    const ok = (ls || []).length === 2
      && ls.some((l) => l.account_code === '1101' && M(l.debit) === 10000000)
      && ls.some((l) => l.account_code === '1102' && M(l.credit) === 10000000)
      && !(ls || []).some((l) => l.account_code.startsWith('4') || l.account_code.startsWith('5'));
    record('SL6', 'انتقال بانک→صندوق: فقط دو سطر خزانه؛ بدون درآمد/هزینه', ok ? 'PASS' : 'FAIL',
      JSON.stringify((ls || []).map((l) => [l.account_code, l.debit, l.credit])));
  }

  /* SL7: اعتبارسنجی تفصیلی — رد تفصیلی اشتباه، پذیرش درست (بند ۲۵ و ۴۸) */
  {
    const { data: cust } = await A.sb.from('acc_partners')
      .insert({ business_id: bizA, kind: 'customer', person_type: 'real', name: `${P}-مشتری وای` })
      .select('id').single();
    await A.sb.from('acc_partner_roles').insert({ business_id: bizA, partner_id: cust.id, role: 'customer' });
    const { data: custDet } = await A.sb.from('acc_details').select('id').eq('business_id', bizA).eq('ref_id', cust.id).eq('kind', 'customer').maybeSingle();
    const { data: suppDet } = await A.sb.from('acc_details').select('id').eq('business_id', bizA).eq('ref_id', sh.id).eq('kind', 'supplier').maybeSingle();

    /* دریافتنی + تفصیلی تامین‌کننده → باید رد شود */
    const { error: badErr } = await A.sb.rpc('acc_create_journal', {
      p_business: bizA, p_date: TODAY, p_description: `${P}-غلط`, p_ref_type: 'manual',
      p_lines: [
        { account_code: '1103', debit: 500, credit: 0, detail_id: suppDet?.id },
        { account_code: '4101', debit: 0, credit: 500 },
      ],
    });
    record('SL7a', 'دریافتنی + تفصیلی تامین‌کننده → رد', !!badErr && /مجاز نیست/.test(badErr.message) ? 'PASS' : 'FAIL',
      badErr ? badErr.message.slice(0, 70) : 'no error!');

    /* دریافتنی + تفصیلی مشتری → پذیرفته */
    const { error: okErr } = await A.sb.rpc('acc_create_journal', {
      p_business: bizA, p_date: TODAY, p_description: `${P}-درست`, p_ref_type: 'manual',
      p_lines: [
        { account_code: '1103', debit: 500, credit: 0, detail_id: custDet?.id },
        { account_code: '4101', debit: 0, credit: 500 },
      ],
    });
    record('SL7b', 'دریافتنی + تفصیلی مشتری → پذیرفته', !okErr ? 'PASS' : 'FAIL', okErr?.message?.slice(0, 70));

    /* دریافتنی بدون تفصیلی → رد (الزام تفصیلی در دیتابیس) */
    const { error: noDetErr } = await A.sb.rpc('acc_create_journal', {
      p_business: bizA, p_date: TODAY, p_description: `${P}-بدون تفصیلی`, p_ref_type: 'manual',
      p_lines: [
        { account_code: '1103', debit: 700, credit: 0 },
        { account_code: '4101', debit: 0, credit: 700 },
      ],
    });
    record('SL7c', 'دریافتنی بدون تفصیلی → رد (الزام دیتابیسی)', !!noDetErr && /تفصیلی/.test(noDetErr.message) ? 'PASS' : 'FAIL',
      noDetErr ? noDetErr.message.slice(0, 70) : 'no error!');

    /* حساب ناموجود در کدینگ → رد (بند ۶۲ و ۸۷) */
    const { error: ghostErr } = await A.sb.rpc('acc_create_journal', {
      p_business: bizA, p_date: TODAY, p_description: `${P}-بدون کدینگ`, p_ref_type: 'manual',
      p_lines: [
        { account_code: '9999', debit: 1, credit: 0 },
        { account_code: '1101', debit: 0, credit: 1 },
      ],
    });
    record('SL7d', 'حساب خارج از کدینگ → رد', !!ghostErr && /کدینگ/.test(ghostErr.message) ? 'PASS' : 'FAIL',
      ghostErr ? ghostErr.message.slice(0, 70) : 'no error!');
  }

  /* SL8: تراز و مانده عملیاتی = حسابداری (بند ۵۱) */
  {
    /* مانده جاری شریک از Journal: واریز ۱۰۰م + هزینه پرداختی ۱۰م بستانکار */
    const { data: det } = await A.sb.from('acc_details').select('id').eq('business_id', bizA).eq('ref_id', sh.id).eq('kind', 'shareholder').maybeSingle();
    const { data: ls } = await A.sb.from('acc_journal_lines')
      .select('debit, credit').eq('business_id', bizA).eq('account_code', '3103').eq('detail_id', det.id);
    const bal = (ls || []).reduce((s, l) => s + M(l.credit) - M(l.debit), 0);
    record('SL8', 'مانده جاری شریک = ۱۱۰م بستانکار (۱۰۰ واریز + ۱۰ هزینه پرداختی)',
      bal === 110000000 ? 'PASS' : 'PARTIAL', `balance=${bal}`);
  }

  /* SL9: گزارش‌ها از Journal واقعی — مرکز هزینه و پروژه (بند ۳۳ و ۸۹) */
  {
    const { data: ccLines } = await A.sb.from('acc_journal_lines')
      .select('debit, cost_center_id, acc_cost_centers(name)').eq('business_id', bizA)
      .not('cost_center_id', 'is', null);
    const sum = (ccLines || []).reduce((s, l) => s + M(l.debit), 0);
    const { data: prjLines } = await A.sb.from('acc_journal_lines')
      .select('debit, project_id').eq('business_id', bizA).not('project_id', 'is', null);
    const psum = (prjLines || []).reduce((s, l) => s + M(l.debit), 0);
    record('SL9', 'گزارش مرکز هزینه و پروژه از ردیف‌های سند (۲۰م + ۱۰م)',
      sum === 30000000 && psum === 30000000 ? 'PASS' : 'PARTIAL',
      `ccTotal=${sum} prjTotal=${psum}`);
  }
}
