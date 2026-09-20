#!/usr/bin/env python3
"""بازسازی کامل محیط تست محلی از صفر — زنجیرهٔ کامل مایگریشن‌های حسابداری کاربان."""
import sys
import pg8000.native

PORT = 5432
FILES = [
    '/home/z/my-project/scripts/acc_migration_full.sql',                      # هستهٔ حسابداری
    '/home/z/my-project/karban_repo/supabase/migrations/20260917200000_acc_v2_selfserve_upgrade.sql',
    '/home/z/my-project/download/acc-audit-fix-v2/sql-4-fix-audit-findings.sql',
    '/home/z/my-project/karban_repo/supabase/migrations/20260918080000_fix_audit_findings.sql',
    '/home/z/my-project/download/acc-v7-pro/sql-5-advanced-accounting.sql',
    '/home/z/my-project/karban_repo/supabase/migrations/20260918200000_advanced_accounting_v7.sql',
    '/home/z/my-project/download/karban-storage-fix/sql-6-storage-lock.sql',
    '/home/z/my-project/karban_repo/supabase/migrations/20260919100000_storage_locks_and_policies.sql',
    '/home/z/my-project/karban_repo/supabase/migrations/20260920120000_acc_core_hardening.sql',
    '/home/z/my-project/karban_repo/supabase/migrations/20260920150000_accounting_master_subledger.sql',  # v8 جدید
]

def err(e):
    a = getattr(e, 'args', [None])
    if a and isinstance(a[0], dict):
        d = a[0]
        return f"{d.get('M')} | {d.get('D','')} | pos {d.get('p','')}"
    return str(e)[:200]

c = pg8000.native.Connection('postgres', host='127.0.0.1', port=5432)
print('── حذف schema کامل ──')
c.run("drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;")
c.run("drop schema if exists auth cascade; create schema auth; grant usage on schema auth to anon, authenticated, service_role;")
c.run("create table auth.users (id uuid primary key, email text);")
c.run("create table public.profiles (id uuid primary key, email text, role text default 'user');")
# استاب Supabase: auth.uid() از متغیر محیطی app.user_id
c.run("create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;")
c.run("grant all on all tables in schema public to anon, authenticated, service_role;")
c.run("grant all on all tables in schema auth to anon, authenticated, service_role;")
# جداول نسخهٔ ۵/۶ که فقط روی زنده ساخته شده‌اند و در فایل‌های ریپو نیستند
for f in FILES:
    name = f.split('/')[-1]
    if name == 'acc_migration_full.sql':
        c.run(open(f, encoding='utf-8').read())
        print('  ✓ ' + name)
        c.run(open('/home/z/my-project/scripts/missing_tables_v56.sql', encoding='utf-8').read())
        print('  ✓ missing_tables_v56.sql (bootstrap)')
        continue
    try:
        c.run(open(f, encoding='utf-8').read())
        print(f'  ✓ {name}')
    except Exception as e:
        print(f'  ✗ {name} → {err(e)}')
        sys.exit(1)
# گرانت‌های پیش‌فرض Supabase (روی زنده همهٔ جداول عمومی به authenticated داده شده)
c.run("grant usage on schema public to anon, authenticated, service_role;")
c.run("grant all on all tables in schema public to anon, authenticated, service_role;")
c.run("grant all on all sequences in schema public to anon, authenticated, service_role;")
c.run("grant all on all functions in schema public to anon, authenticated, service_role;")
c.run("grant all on all functions in schema auth to anon, authenticated, service_role;")
print('REBUILD OK')
c.close()
