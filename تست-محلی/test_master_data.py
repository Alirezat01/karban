#!/usr/bin/env python3
"""تست عملکردی Master Data + Subledger کاربان روی PostgreSQL محلی (شبیه‌سازی Supabase).

پوشش بندهای ۴۰ تا ۵۲ و ۸۹ دستور حسابرسی:
  شماره‌گذاری هم‌زمان کد (شرکا/تفصیلی/مرکز هزینه)، نقش‌ها، زنجیرهٔ نقش→تفصیلی،
  قوانین تفصیلی حساب، ایزوله‌سازی کسب‌وکار، گارد حذف، هزینه/دریافت/پرداخت/انتقال،
  جاری شرکا/کارکنان، تراز آزمایشی و گزارش از Journal واقعی.
"""
import threading, uuid, json
import pg8000.native

PORT = 5432
OWNER = str(uuid.uuid4())
OTHER = str(uuid.uuid4())
VIEWER = str(uuid.uuid4())

results = []

def check(name, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    results.append((name, status, detail))
    print(f"  [{status}] {name}" + (f" — {detail}" if detail else ""))

def new_conn():
    return pg8000.native.Connection("postgres", host="127.0.0.1", port=5432)

def err_msg(e):
    a = getattr(e, "args", [None])
    if a and isinstance(a[0], dict):
        return a[0].get("M", "")
    return str(e)[:220]

def as_user(con, uid):
    con.run("set role authenticated")
    con.run(f"select set_config('app.user_id', '{uid}', false)")

L = lambda code, d=0, c=0, **kw: {"account_code": code, "debit": d, "credit": c, **kw}

def rpc_create(con, biz, lines, date="2026-07-01", desc="تست v8", ref_type="manual"):
    rl = json.dumps(lines, ensure_ascii=False)
    rows = con.run(
        "select public.acc_create_journal(:biz, :dt, :ds, :rt, :ra, :ri, :ro, cast(:rl as jsonb))",
        biz=uuid.UUID(biz), dt=date, ds=desc, rt=ref_type, ra="post", ri=None, ro=None, rl=rl,
    )
    return str(rows[0][0])

def main():
    setup = new_conn()
    for uid, email in [(OWNER, "v8owner@test.ir"), (OTHER, "v8other@test.ir"), (VIEWER, "v8viewer@test.ir")]:
        setup.run("insert into auth.users (id, email) values (:u, :e)", u=uuid.UUID(uid), e=email)
        setup.run("insert into public.profiles (id, email, role) values (:u, :e, 'user')", u=uuid.UUID(uid), e=email)
    bizA = str(setup.run("insert into public.acc_businesses (owner_id, name) values (:u, 'شرکت الف') returning id", u=uuid.UUID(OWNER))[0][0])
    bizB = str(setup.run("insert into public.acc_businesses (owner_id, name) values (:u, 'شرکت ب') returning id", u=uuid.UUID(OTHER))[0][0])
    setup.run("insert into public.acc_access (business_id, user_id, role, status) values (:b, :u, 'owner', 'active')", b=uuid.UUID(bizA), u=uuid.UUID(OWNER))
    setup.run("insert into public.acc_access (business_id, user_id, role, status) values (:b, :u, 'viewer', 'active')", b=uuid.UUID(bizA), u=uuid.UUID(VIEWER))
    setup.run("insert into public.acc_access (business_id, user_id, role, status) values (:b, :u, 'owner', 'active')", b=uuid.UUID(bizB), u=uuid.UUID(OTHER))

    ucon = new_conn(); as_user(ucon, OWNER)      # صاحب کسب‌وکار الف
    bcon = new_conn(); as_user(bcon, OTHER)      # صاحب کسب‌وکار ب
    vcon = new_conn(); as_user(vcon, VIEWER)     # فقط‌خواندن

    # ═══════ ۱) کدینگ پایه ═══════
    print("\n─── کدینگ و سلسله‌مراتب ───")
    rows = ucon.run("""select c.code, p.code, g.code from public.acc_chart c
        left join public.acc_chart p on p.id = c.parent_id
        left join public.acc_chart g on g.id = p.parent_id
        where c.business_id is null and c.code in ('1103','3103','2108','5401') order by c.code""")
    hier = {r[0]: (r[1], r[2]) for r in rows}
    check("T22 مسیر سلسله‌مراتبی معین←کل←گروه",
          hier.get('1103') == ('11', '1') and hier.get('3103') == ('31', '3'),
          f"1103→{hier.get('1103')} 3103→{hier.get('3103')}")
    rows = ucon.run("select requires_detail, allowed_detail_types from public.acc_chart where code='1103' and business_id is null")
    check("T22b قوانین تفصیلی 1103 (الزام مشتری)", rows[0][0] is True and rows[0][1] == ['customer'], f"{rows[0]}")

    # ═══════ ۲) تلاش همزمان ۲۰ کد طرف‌حساب ═══════
    print("\n─── شماره‌گذاری هم‌زمان (بند ۴۰) ───")
    n = 20
    out = [None] * n
    def make_partner(i):
        c = new_conn()
        try:
            as_user(c, OWNER)
            r = c.run("""insert into public.acc_partners (business_id, kind, person_type, name)
                values (:b, 'customer', 'legal', :n) returning partner_code""",
                b=uuid.UUID(bizA), n=f"همزمان-{i}")
            out[i] = ("ok", r[0][0])
        except Exception as e:
            out[i] = ("err", err_msg(e))
        finally:
            c.close()
    ts = [threading.Thread(target=make_partner, args=(i,)) for i in range(n)]
    [t.start() for t in ts]; [t.join() for t in ts]
    codes = [o[1] for o in out if o and o[0] == "ok"]
    errs = [o[1] for o in out if o and o[0] == "err"]
    check("T01 ۲۰ طرف‌حساب هم‌زمان → ۲۰ کد یکتا",
          len(codes) == 20 and len(set(codes)) == 20,
          f"ok={len(codes)} uniq={len(set(codes))} errs={len(errs)} {errs[:2]}")
    allnum = all(code.isdigit() and len(code) == 6 and code.startswith('10') for code in codes)
    check("T01b قالب کد (100001+، بدون MAX+1 مرورگری)", allnum, f"نمونه: {sorted(codes)[:3]}")

    # ═══════ ۳) تلاش همزمان ۲۰ کد تفصیلی و مرکز هزینه ═══════
    out2 = [None] * n
    def make_detail(i):
        c = new_conn()
        try:
            as_user(c, OWNER)
            r = c.run("""insert into public.acc_details (business_id, title, kind)
                values (:b, :n, 'other') returning detail_code""", b=uuid.UUID(bizA), n=f"تفصیلی-{i}")
            out2[i] = ("ok", r[0][0])
        except Exception as e:
            out2[i] = ("err", err_msg(e))
        finally:
            c.close()
    ts = [threading.Thread(target=make_detail, args=(i,)) for i in range(n)]
    [t.start() for t in ts]; [t.join() for t in ts]
    dcodes = [o[1] for o in out2 if o and o[0] == "ok"]
    check("T02 ۲۰ تفصیلی هم‌زمان → کد یکتا", len(dcodes) == 20 and len(set(dcodes)) == 20,
          f"ok={len(dcodes)} uniq={len(set(dcodes))}")

    out3 = [None] * n
    def make_cc(i):
        c = new_conn()
        try:
            as_user(c, OWNER)
            r = c.run("""insert into public.acc_cost_centers (business_id, code, name)
                values (:b, public.acc_next_cost_center_code(:b), :n) returning code""",
                b=uuid.UUID(bizA), n=f"مرکز-{i}")
            out3[i] = ("ok", r[0][0])
        except Exception as e:
            out3[i] = ("err", err_msg(e))
        finally:
            c.close()
    ts = [threading.Thread(target=make_cc, args=(i,)) for i in range(n)]
    [t.start() for t in ts]; [t.join() for t in ts]
    ccodes = [o[1] for o in out3 if o and o[0] == "ok"]
    check("T03 ۲۰ مرکز هزینه هم‌زمان → کد یکتا (CC-###)",
          len(ccodes) == 20 and len(set(ccodes)) == 20 and all(x.startswith('CC-') for x in ccodes),
          f"ok={len(ccodes)} uniq={len(set(ccodes))}")
    rows = ucon.run("select count(*) from public.acc_cost_centers where business_id = :b and code like 'CC-00%'", b=uuid.UUID(bizA))
    check("T03b بذر مراکز هزینهٔ استاندارد CC-001..CC-005", rows[0][0] >= 5, f"count={rows[0][0]}")

    # ═══════ ۴) نقش‌ها ═══════
    print("\n─── نقش‌های طرف‌حساب (بند ۴۱) ───")
    pid = str(ucon.run("""insert into public.acc_partners (business_id, kind, person_type, name)
        values (:b, 'both', 'real', 'علی رضایی') returning id, partner_code""", b=uuid.UUID(bizA))[0][0])
    ucon.run("insert into public.acc_partner_roles (business_id, partner_id, role) values (:b, :p, 'customer')", b=uuid.UUID(bizA), p=uuid.UUID(pid))
    ucon.run("insert into public.acc_partner_roles (business_id, partner_id, role) values (:b, :p, 'supplier')", b=uuid.UUID(bizA), p=uuid.UUID(pid))
    ucon.run("insert into public.acc_partner_roles (business_id, partner_id, role) values (:b, :p, 'shareholder')", b=uuid.UUID(bizA), p=uuid.UUID(pid))
    ucon.run("insert into public.acc_partner_roles (business_id, partner_id, role) values (:b, :p, 'employee')", b=uuid.UUID(bizA), p=uuid.UUID(pid))
    dup = False
    try:
        ucon.run("insert into public.acc_partner_roles (business_id, partner_id, role) values (:b, :p, 'customer')", b=uuid.UUID(bizA), p=uuid.UUID(pid))
    except Exception as e:
        dup = True
    rows = ucon.run("select count(*) from public.acc_partner_roles where partner_id = :p", p=uuid.UUID(pid))
    check("T04 یک شخص + ۴ نقش هم‌زمان؛ نقش تکراری رد", rows[0][0] == 4 and dup, f"roles={rows[0][0]} dupBlocked={dup}")

    rows = ucon.run("""select kind, count(*) from public.acc_details
        where business_id = :b and ref_id = :p group by kind order by kind""", b=uuid.UUID(bizA), p=uuid.UUID(pid))
    kinds = {r[0]: r[1] for r in rows}
    check("T05 زنجیرهٔ نقش→تفصیلی (۴ تفصیلی با ref_id شریک)",
          all(kinds.get(k) == 1 for k in ('customer','supplier','shareholder','employee')), f"{kinds}")
    rows = ucon.run("""select detail_code is not null, is_locked from public.acc_details
        where business_id = :b and ref_id = :p and kind = 'shareholder'""", b=uuid.UUID(bizA), p=uuid.UUID(pid))
    check("T05b تفصیلی سیستمی کد دارد و قفل است", rows[0][0] is True and rows[0][1] is True, f"{rows[0]}")

    # ═══════ ۵) قوانین تفصیلی سند (بند ۲۵ و ۴۸ و ۸۹) ═══════
    print("\n─── اعتبارسنجی تفصیلی روی سند ───")
    det_cust = str(ucon.run("select id from public.acc_details where business_id = :b and ref_id = :p and kind='customer'", b=uuid.UUID(bizA), p=uuid.UUID(pid))[0][0])
    det_supp = str(ucon.run("select id from public.acc_details where business_id = :b and ref_id = :p and kind='supplier'", b=uuid.UUID(bizA), p=uuid.UUID(pid))[0][0])
    det_sh   = str(ucon.run("select id from public.acc_details where business_id = :b and ref_id = :p and kind='shareholder'", b=uuid.UUID(bizA), p=uuid.UUID(pid))[0][0])
    det_emp  = str(ucon.run("select id from public.acc_details where business_id = :b and ref_id = :p and kind='employee'", b=uuid.UUID(bizA), p=uuid.UUID(pid))[0][0])

    jid = rpc_create(ucon, bizA, [L('1103', 50000, 0, detail_id=det_cust), L('4101', 0, 50000)], desc="دریافتنی با تفصیلی مشتری")
    check("T06a دریافتنی+تفصیلی مشتری پذیرفته", bool(jid))
    row = ucon.run("select account_id is not null from public.acc_journal_lines where entry_id = :j and account_code='1103'", j=uuid.UUID(jid))
    check("T24 account_id ردیف از کدینگ پر شد", row[0][0] is True)

    for name, line, acc in [
        ("T06b دریافتنی+تفصیلی تامین‌کننده رد", L('1103', 1, 0, detail_id=det_supp), '1103'),
        ("T06c جاری شرکا+تفصیلی مشتری رد", L('3103', 1, 0, detail_id=det_cust), '3103'),
        ("T06d جاری کارکنان+تفصیلی سهامدار رد", L('2108', 1, 0, detail_id=det_sh), '2108'),
    ]:
        try:
            rpc_create(ucon, bizA, [line, L('4101', 0, 1)])
            check(name, False, "no error!")
        except Exception as e:
            check(name, True, err_msg(e)[:80])

    try:
        rpc_create(ucon, bizA, [L('1103', 50000, 0), L('4101', 0, 50000)])
        check("T06e دریافتنی بدون تفصیلی رد (الزامی)", False, "no error!")
    except Exception as e:
        check("T06e دریافتنی بدون تفصیلی رد (الزامی)", "تفصیلی" in err_msg(e), err_msg(e)[:80])

    jid = rpc_create(ucon, bizA, [L('2101', 1, 0, detail_id=det_supp), L('2108', 0, 1, detail_id=det_emp)], desc="معتبر")
    check("T06f پرداختنی+تامین‌کننده و کارکنان+کارمند پذیرفته", bool(jid))

    # تفصیلی غریبه / مرکز هزینه غریبه / پروژه غریبه / طرف‌حساب غریبه
    fdet = str(bcon.run("""insert into public.acc_details (business_id, title, kind)
        values (:b, 'تفصیلی غریبه', 'other') returning id""", b=uuid.UUID(bizB))[0][0])
    try:
        rpc_create(ucon, bizA, [L('4101', 1, 0, detail_id=fdet), L('1101', 0, 1)])
        check("T07a تفصیلی کسب‌وکار دیگر رد", False)
    except Exception as e:
        check("T07a تفصیلی کسب‌وکار دیگر رد", True, err_msg(e)[:70])
    fcc = str(bcon.run("select id from public.acc_cost_centers where business_id = :b limit 1", b=uuid.UUID(bizB))[0][0])
    try:
        rpc_create(ucon, bizA, [L('4101', 1, 0, cost_center_id=fcc), L('1101', 0, 1)])
        check("T07b مرکز هزینهٔ کسب‌وکار دیگر رد", False)
    except Exception as e:
        check("T07b مرکز هزینهٔ کسب‌وکار دیگر رد", True, err_msg(e)[:70])
    fprj = str(ucon.run("""insert into public.acc_projects (business_id, name) values (:b, 'پروژه ب') returning id""", b=uuid.UUID(bizB))[0][0])
    try:
        rpc_create(ucon, bizA, [L('4101', 1, 0, project_id=str(fprj)), L('1101', 0, 1)])
        check("T07c پروژهٔ کسب‌وکار دیگر رد", False)
    except Exception as e:
        check("T07c پروژهٔ کسب‌وکار دیگر رد", True, err_msg(e)[:70])
    try:
        rpc_create(ucon, bizA, [L('4101', 1, 0, partner_id=str(uuid.uuid4())), L('1101', 0, 1)])
        check("T07d طرف‌حساب ناموجود رد", False)
    except Exception as e:
        check("T07d طرف‌حساب ناموجود رد", True, err_msg(e)[:70])

    # حساب غیرفعال (با اتصال superuser — RLS به owner اجازهٔ غیرفعال‌سازی سراسری را نمی‌دهد)
    setup.run("update public.acc_chart set active = false where business_id is null and code = '5210'")
    try:
        rpc_create(ucon, bizA, [L('5210', 1, 0), L('1101', 0, 1)])
        check("T08 حساب غیرفعال رد", False)
    except Exception as e:
        check("T08 حساب غیرفعال رد", "غیرفعال" in err_msg(e), err_msg(e)[:70])
    setup.run("update public.acc_chart set active = true where business_id is null and code = '5210'")

    # ═══════ ۶) خزانه: بانک/صندوق با تفصیلی اختصاصی ═══════
    print("\n─── بانک/صندوق و Mapping واقعی ───")
    row_b = ucon.run("""insert into public.acc_accounts (business_id, name, kind, account_number, initial_balance)
        values (:b, 'بانک ملت', 'bank', '123', 0) returning id, chart_code, (detail_id is not null)""", b=uuid.UUID(bizA))[0]
    row_c = ucon.run("""insert into public.acc_accounts (business_id, name, kind, account_number, initial_balance)
        values (:b, 'صندوق مرکزی', 'cash', '', 0) returning id, chart_code, (detail_id is not null)""", b=uuid.UUID(bizA))[0]
    bank = [str(row_b[0]), row_b[1], row_b[2]]
    cash = [str(row_c[0]), row_c[1], row_c[2]]
    check("T09a حساب بانکی: کد معین 1102 + تفصیلی خودکار", bank[1] == '1102' and bank[2] is True, f"{bank}")
    check("T09b صندوق: کد معین 1101 + تفصیلی خودکار", cash[1] == '1101' and cash[2] is True, f"{cash}")
    bank_detail = str(ucon.run("select detail_id from public.acc_accounts where id = :a", a=uuid.UUID(bank[0]))[0][0])

    # ═══════ ۷) دریافت/پرداخت (بند ۴۵ و ۴۶) ═══════
    print("\n─── دریافت و پرداخت ───")
    cust = str(ucon.run("""insert into public.acc_partners (business_id, kind, person_type, name)
        values (:b, 'customer', 'legal', 'شرکت مشتری ایکس') returning id""", b=uuid.UUID(bizA))[0][0])
    tx = str(ucon.run("""insert into public.acc_transactions (business_id, kind, amount, date_g, method, account_id, partner_id, description)
        values (:b, 'receipt', 50000000, '2026-07-02', 'transfer', :a, :p, 'دریافت از مشتری') returning id""",
        b=uuid.UUID(bizA), a=uuid.UUID(bank[0]), p=uuid.UUID(cust))[0][0])
    rows = ucon.run("""select l.account_code, l.debit, l.credit, l.detail_id is not null, d.kind
        from public.acc_journal_lines l left join public.acc_details d on d.id = l.detail_id
        where l.entry_id in (select id from public.acc_journal where ref_type='transaction' and ref_id = :t)
        order by l.debit desc, l.account_code""", t=uuid.UUID(tx))
    ok = (len(rows) == 2 and rows[0][0] == '1102' and rows[0][1] == 50000000 and rows[0][3] is True and rows[0][4] == 'bank'
          and rows[1][0] == '1103' and rows[1][2] == 50000000 and rows[1][4] == 'customer')
    check("T10 دریافت ۵۰م: بانک بدهکار (تفصیلی بانک) / 1103 بستانکار (تفصیلی مشتری)", ok, f"{[(r[0], r[1], r[2], r[4]) for r in rows]}")

    supp = str(ucon.run("""insert into public.acc_partners (business_id, kind, person_type, name)
        values (:b, 'supplier', 'legal', 'شرکت تامین‌کننده وای') returning id""", b=uuid.UUID(bizA))[0][0])
    tx2 = str(ucon.run("""insert into public.acc_transactions (business_id, kind, amount, date_g, method, account_id, partner_id, description)
        values (:b, 'payment', 30000000, '2026-07-03', 'transfer', :a, :p, 'پرداخت به تامین‌کننده') returning id""",
        b=uuid.UUID(bizA), a=uuid.UUID(bank[0]), p=uuid.UUID(supp))[0][0])
    rows = ucon.run("""select l.account_code, l.debit, l.credit, d.kind
        from public.acc_journal_lines l left join public.acc_details d on d.id = l.detail_id
        where l.entry_id in (select id from public.acc_journal where ref_type='transaction' and ref_id = :t)
        order by l.debit desc, l.account_code""", t=uuid.UUID(tx2))
    ok = (len(rows) == 2 and rows[0][0] == '2101' and rows[0][1] == 30000000 and rows[0][3] == 'supplier'
          and rows[1][0] == '1102' and rows[1][2] == 30000000 and rows[1][3] == 'bank')
    check("T11 پرداخت ۳۰م: 2101 بدهکار (تامین‌کننده) / بانک بستانکار", ok, f"{[(r[0], r[1], r[2], r[3]) for r in rows]}")

    # ═══════ ۸) انتقال بانک ↔ صندوق (بند ۲۸ و ۴۷) ═══════
    print("\n─── انتقال بانک/صندوق ───")
    tx3 = str(ucon.run("""insert into public.acc_transactions (business_id, kind, amount, date_g, method, account_id, to_account_id, description)
        values (:b, 'transfer', 10000000, '2026-07-04', 'transfer', :a, :t, 'انتقال به صندوق') returning id""",
        b=uuid.UUID(bizA), a=uuid.UUID(bank[0]), t=uuid.UUID(cash[0]))[0][0])
    rows = ucon.run("""select l.account_code, l.debit, l.credit from public.acc_journal_lines l
        where l.entry_id in (select id from public.acc_journal where ref_type='transaction' and ref_id = :t)
        order by l.debit desc""", t=uuid.UUID(tx3))
    ok = (len(rows) == 2 and rows[0][0] == '1101' and rows[0][1] == 10000000 and rows[1][0] == '1102' and rows[1][2] == 10000000)
    check("T12 انتقال بانک→صندوق: فقط 1101 بدهکار / 1102 بستانکار", ok, f"{rows}")
    rows = ucon.run("""select count(*) from public.acc_journal_lines l
        where l.entry_id in (select id from public.acc_journal where ref_type='transaction' and ref_id = :t)
        and (l.account_code like '4%' or l.account_code like '5%')""", t=uuid.UUID(tx3))
    check("T12b انتقال هیچ درآمد/هزینه‌ای نساخت", rows[0][0] == 0, f"income/expense lines={rows[0][0]}")
    try:
        ucon.run("""insert into public.acc_transactions (business_id, kind, amount, date_g, method, account_id)
            values (:b, 'transfer', 1, '2026-07-04', 'transfer', :a)""", b=uuid.UUID(bizA), a=uuid.UUID(bank[0]))
        check("T12c انتقال بدون حساب مقصد رد (constraint)", False)
    except Exception as e:
        check("T12c انتقال بدون حساب مقصد رد (constraint)", True, err_msg(e)[:60])

    # ═══════ ۹) هزینه با Mapping کامل (بند ۲۱ و ۴۴ و ۸۹) ═══════
    print("\n─── معماری هزینه ───")
    exp_acc = str(ucon.run("select id from public.acc_chart where code='5401' and business_id is null")[0][0])
    cc = str(ucon.run("select id from public.acc_cost_centers where business_id = :b and code='CC-003'", b=uuid.UUID(bizA))[0][0])
    proj = str(ucon.run("""insert into public.acc_projects (business_id, name) values (:b, 'همایش تهران') returning id""", b=uuid.UUID(bizA))[0][0])
    exp = str(ucon.run("""insert into public.acc_expenses (business_id, category, title, amount, vat_amount, date_g, account_id,
            expense_account_id, detail_id, cost_center_id, partner_id, project_id, is_paid, description)
        values (:b, 'تبلیغات', 'هزینه تبلیغات همایش', 20000000, 0, '2026-07-05', :acc,
                :eacc, :det, :cc, :p, :pr, true, 'کمپین تبلیغاتی') returning id""",
        b=uuid.UUID(bizA), acc=uuid.UUID(bank[0]), eacc=uuid.UUID(exp_acc), det=uuid.UUID(det_supp),
        cc=uuid.UUID(cc), p=uuid.UUID(supp), pr=uuid.UUID(proj))[0][0])
    rows = ucon.run("""select l.account_code, l.debit, l.credit, l.detail_id, l.cost_center_id, l.project_id, l.line_desc
        from public.acc_journal_lines l
        where l.entry_id in (select id from public.acc_journal where ref_type='expense' and ref_id = :e)
        order by l.debit desc""", e=uuid.UUID(exp))
    ok = (len(rows) == 2 and rows[0][0] == '5401' and rows[0][1] == 20000000
          and str(rows[0][3]) == det_supp and str(rows[0][4]) == cc and str(rows[0][5]) == proj
          and rows[1][0] == '1102' and rows[1][2] == 20000000)
    check("T13 هزینه ۲۰م: 5401 بدهکار با تفصیلی+مرکز+پروژه / بانک بستانکار", ok, f"FULL={rows}")

    # هزینه نسیه → پرداختنی + تفصیلی تامین‌کننده
    exp2 = str(ucon.run("""insert into public.acc_expenses (business_id, category, title, amount, vat_amount, date_g,
            expense_account_id, partner_id, is_paid)
        values (:b, 'تبلیغات', 'تبلیغات نسیه', 5000000, 0, '2026-07-06', :eacc, :p, false) returning id""",
        b=uuid.UUID(bizA), eacc=uuid.UUID(exp_acc), p=uuid.UUID(supp))[0][0])
    rows = ucon.run("""select l.account_code, l.debit, l.credit, d.kind
        from public.acc_journal_lines l left join public.acc_details d on d.id = l.detail_id
        where l.entry_id in (select id from public.acc_journal where ref_type='expense' and ref_id = :e)
        order by l.debit desc""", e=uuid.UUID(exp2))
    ok = (len(rows) == 2 and rows[0][0] == '5401' and rows[0][1] == 5000000 and rows[1][0] == '2101' and rows[1][2] == 5000000 and rows[1][3] == 'supplier')
    check("T14 هزینه نسیه: 5401 بدهکار / 2101 بستانکار با تفصیلی تامین‌کننده", ok, f"{rows}")

    # Mapping دیتابیسی دستهٔ هزینه
    ucon.run("update public.acc_expense_categories set chart_code = '5203' where business_id = :b and title = 'اجاره'", b=uuid.UUID(bizA))
    exp3 = str(ucon.run("""insert into public.acc_expenses (business_id, category, title, amount, vat_amount, date_g, account_id, is_paid)
        values (:b, 'اجاره', 'اجاره دفتر مهر', 15000000, 0, '2026-07-07', :acc, true) returning id""",
        b=uuid.UUID(bizA), acc=uuid.UUID(bank[0]))[0][0])
    rows = ucon.run("""select l.account_code from public.acc_journal_lines l
        where l.entry_id in (select id from public.acc_journal where ref_type='expense' and ref_id = :e) and l.debit > 0""", e=uuid.UUID(exp3))
    check("T15 Mapping دیتابیسی دسته→حساب (اجاره→5203)", rows[0][0] == '5203', f"code={rows[0][0]}")

    # ═══════ ۱۰) جاری شرکا و کارکنان (بند ۱۰، ۱۱، ۴۲، ۴۳) ═══════
    print("\n─── جاری شرکا و کارکنان ───")
    # واریز شریک 100M: بانک بدهکار / جاری شریک بستانکار
    tx4 = str(ucon.run("""insert into public.acc_transactions (business_id, kind, amount, date_g, method, account_id, partner_id, description)
        values (:b, 'receipt', 100000000, '2026-07-08', 'transfer', :a, :p, 'واریز آورده شریک') returning id""",
        b=uuid.UUID(bizA), a=uuid.UUID(bank[0]), p=uuid.UUID(pid))[0][0])
    rows = ucon.run("""select l.account_code, l.debit, l.credit, d.kind
        from public.acc_journal_lines l left join public.acc_details d on d.id = l.detail_id
        where l.entry_id in (select id from public.acc_journal where ref_type='transaction' and ref_id = :t)
        order by l.debit desc""", t=uuid.UUID(tx4))
    ok = (len(rows) == 2 and rows[0][0] == '1102' and rows[0][1] == 100000000 and rows[1][0] == '3103' and rows[1][2] == 100000000 and rows[1][3] == 'shareholder')
    check("T16 واریز شریک ۱۰۰م: بانک بدهکار / جاری شرکا (3103) بستانکار", ok, f"{[(r[0], r[1], r[2], r[3]) for r in rows]}")

    # برداشت شریک 20M: جاری شریک بدهکار / بانک بستانکار
    tx5 = str(ucon.run("""insert into public.acc_transactions (business_id, kind, amount, date_g, method, account_id, partner_id, description)
        values (:b, 'payment', 20000000, '2026-07-09', 'transfer', :a, :p, 'برداشت شریک') returning id""",
        b=uuid.UUID(bizA), a=uuid.UUID(bank[0]), p=uuid.UUID(pid))[0][0])
    rows = ucon.run("""select l.account_code, l.debit, l.credit, d.kind
        from public.acc_journal_lines l left join public.acc_details d on d.id = l.detail_id
        where l.entry_id in (select id from public.acc_journal where ref_type='transaction' and ref_id = :t)
        order by l.debit desc""", t=uuid.UUID(tx5))
    ok = (len(rows) == 2 and rows[0][0] == '3103' and rows[0][1] == 20000000 and rows[0][3] == 'shareholder'
          and rows[1][0] == '1102' and rows[1][2] == 20000000)
    check("T17 برداشت شریک ۲۰م: جاری شرکا بدهکار / بانک بستانکار", ok, f"{[(r[0], r[1], r[2], r[3]) for r in rows]}")

    # هزینه پرداخت‌شده توسط شریک 10M: هزینه بدهکار / جاری شریک بستانکار (is_paid=false)
    exp4 = str(ucon.run("""insert into public.acc_expenses (business_id, category, title, amount, vat_amount, date_g,
            expense_account_id, partner_id, is_paid, description)
        values (:b, 'تبلیغات', 'هزینه‌ای که شریک پرداخت', 10000000, 0, '2026-07-10', :eacc, :p, false, 'پرداخت شخصی شریک') returning id""",
        b=uuid.UUID(bizA), eacc=uuid.UUID(exp_acc), p=uuid.UUID(pid))[0][0])
    rows = ucon.run("""select l.account_code, l.debit, l.credit, d.kind
        from public.acc_journal_lines l left join public.acc_details d on d.id = l.detail_id
        where l.entry_id in (select id from public.acc_journal where ref_type='expense' and ref_id = :e)
        order by l.debit desc""", e=uuid.UUID(exp4))
    ok = (len(rows) == 2 and rows[0][0] == '5401' and rows[0][1] == 10000000
          and rows[1][0] == '3103' and rows[1][2] == 10000000 and rows[1][3] == 'shareholder')
    check("T18 هزینه پرداخت‌شده توسط شریک: هزینه بدهکار / جاری شریک بستانکار", ok, f"{rows}")

    # بازپرداخت به شریک 5M: جاری شریک بدهکار / بانک بستانکار (همان برداشت)
    tx6 = str(ucon.run("""insert into public.acc_transactions (business_id, kind, amount, date_g, method, account_id, partner_id, description)
        values (:b, 'payment', 5000000, '2026-07-11', 'transfer', :a, :p, 'بازپرداخت به شریک') returning id""",
        b=uuid.UUID(bizA), a=uuid.UUID(bank[0]), p=uuid.UUID(pid))[0][0])
    rows = ucon.run("""select l.account_code, l.debit, l.credit
        from public.acc_journal_lines l
        where l.entry_id in (select id from public.acc_journal where ref_type='transaction' and ref_id = :t)
        order by l.debit desc""", t=uuid.UUID(tx6))
    ok = (len(rows) == 2 and rows[0][0] == '3103' and rows[0][1] == 5000000 and rows[1][0] == '1102')
    check("T19 بازپرداخت به شریک ۵م: جاری شرکا بدهکار / بانک بستانکار", ok, f"{rows}")

    # مانده جاری شریک: واریز ۱۰۰م + هزینه پرداختی شریک ۱۰م (هر دو بستانکار) − برداشت ۲۰م − بازپرداخت ۵م = ۸۵م بستانکار
    rows = ucon.run("""select coalesce(sum(l.credit),0) - coalesce(sum(l.debit),0)
        from public.acc_journal_lines l
        where l.account_code = '3103' and l.business_id = :b and l.partner_id = :p""", b=uuid.UUID(bizA), p=uuid.UUID(pid))
    check("T20 مانده جاری شریک = ۸۵م بستانکار (۱۰۰+۱۰−۲۰−۵)", rows[0][0] == 85000000, f"balance={rows[0][0]}")

    # هزینه توسط کارمند ۵م + بازپرداخت ۲م — کارمند زد فقط نقش کارمند دارد
    emp = str(ucon.run("""insert into public.acc_partners (business_id, kind, person_type, name)
        values (:b, 'both', 'real', 'کارمند زد') returning id""", b=uuid.UUID(bizA))[0][0])
    ucon.run("insert into public.acc_partner_roles (business_id, partner_id, role) values (:b, :p, 'employee')", b=uuid.UUID(bizA), p=uuid.UUID(emp))
    exp5 = str(ucon.run("""insert into public.acc_expenses (business_id, category, title, amount, vat_amount, date_g,
            expense_account_id, partner_id, is_paid, description)
        values (:b, 'اجاره', 'هزینه پرداختی کارمند', 5000000, 0, '2026-07-12', :eacc, :p, false, 'کارمند پرداخت کرد') returning id""",
        b=uuid.UUID(bizA), eacc=uuid.UUID(exp_acc), p=uuid.UUID(emp))[0][0])
    rows = ucon.run("""select l.account_code, l.debit, l.credit, d.kind
        from public.acc_journal_lines l left join public.acc_details d on d.id = l.detail_id
        where l.entry_id in (select id from public.acc_journal where ref_type='expense' and ref_id = :e)
        order by l.debit desc""", e=uuid.UUID(exp5))
    ok = (rows[1][0] == '2108' and rows[1][2] == 5000000 and rows[1][3] == 'employee')
    check("T21 هزینه توسط کارمند: هزینه بدهکار / جاری کارکنان (2108) بستانکار", ok, f"{rows}")
    tx7 = str(ucon.run("""insert into public.acc_transactions (business_id, kind, amount, date_g, method, account_id, partner_id, description)
        values (:b, 'payment', 2000000, '2026-07-13', 'transfer', :a, :p, 'بازپرداخت به کارمند') returning id""",
        b=uuid.UUID(bizA), a=uuid.UUID(bank[0]), p=uuid.UUID(emp))[0][0])
    rows = ucon.run("""select l.account_code, l.debit, l.credit
        from public.acc_journal_lines l
        where l.entry_id in (select id from public.acc_journal where ref_type='transaction' and ref_id = :t)
        order by l.debit desc""", t=uuid.UUID(tx7))
    ok = (rows[0][0] == '2108' and rows[0][1] == 2000000 and rows[1][0] == '1102')
    check("T22 بازپرداخت به کارمند: جاری کارکنان بدهکار / بانک بستانکار", ok, f"{rows}")

    # ═══════ ۱۱) گارد حذف Master Data (بند ۳۰) ═══════
    print("\n─── گارد حذف Master Data ───")
    blocked = False
    try:
        ucon.run("delete from public.acc_partners where id = :p", p=uuid.UUID(cust))
    except Exception as e:
        blocked = "غیرفعال" in err_msg(e)
    check("T23 حذف مشتری دارای گردش ممنوع → پیام غیرفعال‌سازی", blocked)
    blocked = False
    try:
        ucon.run("delete from public.acc_details where id = :d", d=uuid.UUID(det_cust))
    except Exception as e:
        blocked = "غیرفعال" in err_msg(e) or "قفل" in err_msg(e)
    check("T24 حذف تفصیلی دارای گردش ممنوع", blocked)
    blocked = False
    try:
        ucon.run("delete from public.acc_accounts where id = :a", a=uuid.UUID(bank[0]))
    except Exception as e:
        blocked = "غیرفعال" in err_msg(e)
    check("T25 حذف بانک دارای گردش ممنوع", blocked)
    blocked = False
    try:
        ucon.run("delete from public.acc_cost_centers where id = :c", c=uuid.UUID(cc))
    except Exception as e:
        blocked = "غیرفعال" in err_msg(e)
    check("T26 حذف مرکز هزینهٔ دارای گردش ممنوع", blocked)
    # طرف‌حساب بدون گردش قابل حذف است
    tmp = str(ucon.run("""insert into public.acc_partners (business_id, kind, person_type, name)
        values (:b, 'customer', 'real', 'بدون گردش') returning id""", b=uuid.UUID(bizA))[0][0])
    try:
        ucon.run("delete from public.acc_partners where id = :p", p=uuid.UUID(tmp))
        check("T27 حذف طرف‌حساب بدون گردش مجاز", True)
    except Exception as e:
        check("T27 حذف طرف‌حساب بدون گردش مجاز", False, err_msg(e)[:60])
    # کد پس از غیرفعال شدن دوباره تخصیص نمی‌یابد
    code_before = str(ucon.run("select partner_code from public.acc_partners where id = :p", p=uuid.UUID(pid))[0][0])
    ucon.run("update public.acc_partners set active = false where id = :p", p=uuid.UUID(pid))
    r = ucon.run("insert into public.acc_partners (business_id, kind, person_type, name) values (:b, 'customer', 'real', 'جدید بعد از غیرفعال') returning partner_code", b=uuid.UUID(bizA))
    new_code = str(r[0][0])
    check("T28 کد طرف‌حساب غیرفعال هرگز تکرار نمی‌شود", int(new_code) > int(code_before), f"{code_before} → {new_code}")

    # ═══════ ۱۲) ایزوله‌سازی کسب‌وکار (بند ۴۹) ═══════
    print("\n─── ایزوله‌سازی کسب‌وکار ───")
    rows = bcon.run("select count(*) from public.acc_partners where business_id = :b", b=uuid.UUID(bizA))
    check("T29 کسب‌وکار ب، طرف‌حساب‌های الف را نمی‌بیند", rows[0][0] == 0, f"visible={rows[0][0]}")
    rows = bcon.run("select count(*) from public.acc_cost_centers where business_id = :b", b=uuid.UUID(bizA))
    check("T30 کسب‌وکار ب، مراکز هزینهٔ الف را نمی‌بیند", rows[0][0] == 0)
    rows = bcon.run("select count(*) from public.acc_partner_roles where business_id = :b", b=uuid.UUID(bizA))
    check("T31 کسب‌وکار ب، نقش‌های الف را نمی‌بیند", rows[0][0] == 0)
    try:
        bcon.run("update public.acc_partners set name = 'هک' where id = :p", p=uuid.UUID(cust))
        rows = bcon.run("select count(*) from public.acc_partners where id = :p and name = 'هک'", p=uuid.UUID(cust))
        check("T32 نوشتن روی طرف‌حساب الف از کسب‌وکار ب ممنوع", rows[0][0] == 0)
    except Exception:
        check("T32 نوشتن روی طرف‌حساب الف از کسب‌وکار ب ممنوع", True, "RLS رد کرد")

    # ═══════ ۱۳) مجوزها (بند ۳۸) ═══════
    print("\n─── مجوزها ───")
    denied = False
    try:
        vcon.run("""insert into public.acc_partners (business_id, kind, person_type, name)
            values (:b, 'customer', 'real', 'ویوئر نباید بسازد')""", b=uuid.UUID(bizA))
        check("T33 viewer نمی‌تواند طرف‌حساب بسازد", False, "no error!")
    except Exception as e:
        denied = True
    check("T33 viewer نمی‌تواند طرف‌حساب بسازد (RLS)", denied)
    denied = False
    try:
        vcon.run("insert into public.acc_cost_centers (business_id, code, name) values (:b, 'CC-999', 'هک')", b=uuid.UUID(bizA))
        check("T33b viewer نمی‌تواند مرکز هزینه بسازد", False, "no error!")
    except Exception:
        denied = True
    check("T33b viewer نمی‌تواند مرکز هزینه بسازد (RLS)", denied)
    denied = False
    try:
        rpc_create(vcon, bizA, [L('4101', 1, 0), L('1101', 0, 1)])
        check("T33c viewer نمی‌تواند سند دستی ثبت کند", False, "no error!")
    except Exception as e2:
        denied = "اجازه" in err_msg(e2) or "دسترسی" in err_msg(e2)
        check("T33c viewer نمی‌تواند سند دستی ثبت کند", denied, err_msg(e2)[:60])

    # ═══════ ۱۴) گزارش‌ها از Journal واقعی (بند ۳۳، ۵۱، ۸۱، ۸۹) ═══════
    print("\n─── گزارش‌ها از Journal واقعی ───")
    rows = ucon.run("""select sum(l.debit) d, sum(l.credit) c from public.acc_journal_lines l
        join public.acc_journal j on j.id = l.entry_id
        where l.business_id = :b and j.voided_at is null and j.ref_action = 'post'""", b=uuid.UUID(bizA))
    check("T34 تراز کل دفتر: بدهکار = بستانکار", rows[0][0] == rows[0][1], f"D={rows[0][0]} C={rows[0][1]}")
    rows = ucon.run("""select l.account_code, sum(l.debit) - sum(l.credit)
        from public.acc_journal_lines l join public.acc_journal j on j.id = l.entry_id
        where l.business_id = :b and j.voided_at is null and l.account_code like '5%'
        group by l.account_code order by 2 desc limit 3""", b=uuid.UUID(bizA))
    pl = {r[0]: int(r[1]) for r in rows}
    # 5401 = 20م (تبلیغات) + 10م (شریک) + 5م (نسیه) + 5م (کارمند) = ۴۰م | 5203 = 15م
    check("T35 گزارش هزینه از Journal (5401=۴۰م، 5203=۱۵م)",
          pl.get('5401') == 40000000 and pl.get('5203') == 15000000, f"{pl}")
    rows = ucon.run("""select l.cost_center_id, sum(l.debit) from public.acc_journal_lines l
        join public.acc_journal j on j.id = l.entry_id
        where l.business_id = :b and j.voided_at is null and l.cost_center_id is not null
        group by l.cost_center_id""", b=uuid.UUID(bizA))
    ccsum = {str(r[0]): int(r[1]) for r in rows}
    check("T36 گزارش مرکز هزینه از Journal (CC-003 بازاریابی = ۲۰م)", ccsum.get(cc) == 20000000, f"{ccsum}")
    rows = ucon.run("""select l.project_id, sum(l.debit) from public.acc_journal_lines l
        join public.acc_journal j on j.id = l.entry_id
        where l.business_id = :b and j.voided_at is null and l.project_id is not null
        group by l.project_id""", b=uuid.UUID(bizA))
    check("T37 گزارش پروژه از Journal (همایش تهران = ۲۰م)", len(rows) == 1 and int(rows[0][1]) == 20000000, f"{rows}")

    # مانده عملیاتی = مانده حسابداری برای مشتری/تامین‌کننده/بانک
    op_cust = ucon.run("""select coalesce(sum(case when kind='receipt' then -amount else amount end),0)
        from public.acc_transactions where business_id=:b and partner_id=:p and kind<>'transfer' and voided_at is null""",
        b=uuid.UUID(bizA), p=uuid.UUID(cust))[0][0]
    acc_cust = ucon.run("""select coalesce(sum(l.debit),0)-coalesce(sum(l.credit),0) from public.acc_journal_lines l
        where l.business_id=:b and l.account_code='1103' and l.partner_id=:p
        and l.entry_id in (select id from public.acc_journal where voided_at is null)""", b=uuid.UUID(bizA), p=uuid.UUID(cust))[0][0]
    check("T38 مانده عملیاتی مشتری = مانده حسابداری (قرارداد بدهکار)", op_cust == acc_cust, f"op={op_cust} acc={acc_cust}")
    op_bank = ucon.run("""select coalesce(sum(case when kind='receipt' then amount else -amount end),0)
        from public.acc_transactions where business_id=:b and account_id=:a and voided_at is null""",
        b=uuid.UUID(bizA), a=uuid.UUID(bank[0]))[0][0]
    op_bank -= ucon.run("""select coalesce(sum(amount + vat_amount),0) from public.acc_expenses
        where business_id=:b and account_id=:a and is_paid and voided_at is null""",
        b=uuid.UUID(bizA), a=uuid.UUID(bank[0]))[0][0]
    acc_bank = ucon.run("""select coalesce(sum(l.debit),0)-coalesce(sum(l.credit),0) from public.acc_journal_lines l
        where l.business_id=:b and l.account_code='1102' and l.detail_id = (select detail_id from public.acc_accounts where id = :a)
        and l.entry_id in (select id from public.acc_journal where voided_at is null)""",
        b=uuid.UUID(bizA), a=uuid.UUID(bank[0]))[0][0]
    check("T39 مانده عملیاتی بانک (دریافت/پرداخت/انتقال/هزینه) = مانده حسابداری", op_bank == acc_bank, f"op={op_bank} acc={acc_bank}")

    # ═══════ ۱۵) برگشت سند: تفصیلی و مرکز هزینه حفظ می‌شود ═══════
    print("\n─── ابطال و برگشت ───")
    rev = str(ucon.run("select public.acc_void_journal_internal(:b, :j, 'تست برگشت')",
        b=uuid.UUID(bizA), j=uuid.UUID(jid2 := rpc_create(ucon, bizA, [L('4101', 1, 0, cost_center_id=cc), L('1101', 0, 1)])))[0][0])
    rows = ucon.run("""select cost_center_id is not null, account_code from public.acc_journal_lines
        where entry_id = :j order by account_code""", j=uuid.UUID(rev))
    check("T40 سند معکوس تفصیلی/مرکز هزینه را حفظ می‌کند",
          any(r[0] is True and r[1] == '4101' for r in rows), f"{rows}")

    # جمع‌بندی
    fails = [r for r in results if r[1] == "FAIL"]
    print(f"\n═══ جمع‌بندی: {len(results) - len(fails)}/{len(results)} PASS ═══")
    for f in fails:
        print(f"  FAIL: {f[0]} — {f[2]}")
    return 1 if fails else 0

if __name__ == "__main__":
    raise SystemExit(main())
