/*
# Admin panel: profiles, contracts, orders tables + admin RLS policies

## Purpose
Enables an /admin route with Supabase email/password auth, role-based access
(profiles.role = 'admin'), and CRUD on services, settings, contracts, leads,
orders, and consultation_requests.

## New Tables
1. profiles — tracks each user's role (user vs admin)
   - id (uuid, PK, FK -> auth.users ON DELETE CASCADE)
   - role (text, NOT NULL, DEFAULT 'user')
   - created_at (timestamptz, DEFAULT now())

2. contracts — admin-managed contract catalog
   - id (uuid, PK)
   - title (text, NOT NULL)
   - type (text)
   - industry (text)
   - summary (text)
   - created_at (timestamptz, DEFAULT now())

3. orders — order tracking
   - id (uuid, PK)
   - mobile (text)
   - service (text)
   - amount (text)
   - status (text, NOT NULL, DEFAULT 'pending', CHECK in pending/processing/completed/cancelled)
   - created_at (timestamptz, DEFAULT now())

## Security Changes
- profiles: RLS enabled. Users read own row; admins read all.
- contracts: RLS enabled. Public SELECT; admin-only INSERT/UPDATE/DELETE.
- orders: RLS enabled. Public INSERT; admin-only SELECT/UPDATE/DELETE.
- leads: added admin SELECT (existing public INSERT unchanged).
- consultation_requests: added admin SELECT (existing public INSERT unchanged).
- services: added admin INSERT/UPDATE/DELETE (existing public SELECT unchanged).
- settings: added admin INSERT/UPDATE (existing public SELECT unchanged).

## Trigger
- on_auth_user_created: auto-inserts a profile row (role='user') for every
  new auth user via SECURITY DEFINER function.

## Notes
1. First admin must be promoted manually:
   UPDATE profiles SET role='admin' WHERE id = '<user-uuid>';
2. Admin check predicate used throughout:
   EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
*/

-- ── profiles table ──
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own profile" ON profiles;
CREATE POLICY "Users read own profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins read all profiles" ON profiles;
CREATE POLICY "Admins read all profiles" ON profiles FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ── Auto-create profile on signup ──
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, role) VALUES (new.id, 'user');
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── contracts table ──
CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  type text,
  industry text,
  summary text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read contracts" ON contracts;
CREATE POLICY "Public read contracts" ON contracts FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Admin insert contracts" ON contracts;
CREATE POLICY "Admin insert contracts" ON contracts FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admin update contracts" ON contracts;
CREATE POLICY "Admin update contracts" ON contracts FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admin delete contracts" ON contracts;
CREATE POLICY "Admin delete contracts" ON contracts FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── orders table ──
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile text,
  service text,
  amount text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public insert orders" ON orders;
CREATE POLICY "Public insert orders" ON orders FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Admin read orders" ON orders;
CREATE POLICY "Admin read orders" ON orders FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admin update orders" ON orders;
CREATE POLICY "Admin update orders" ON orders FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admin delete orders" ON orders;
CREATE POLICY "Admin delete orders" ON orders FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── Admin SELECT on leads (existing public INSERT stays) ──
DROP POLICY IF EXISTS "Admin read leads" ON leads;
CREATE POLICY "Admin read leads" ON leads FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── Admin SELECT on consultation_requests (existing public INSERT stays) ──
DROP POLICY IF EXISTS "Admin read consultations" ON consultation_requests;
CREATE POLICY "Admin read consultations" ON consultation_requests FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── Admin INSERT/UPDATE/DELETE on services (existing public SELECT stays) ──
DROP POLICY IF EXISTS "Admin insert services" ON services;
CREATE POLICY "Admin insert services" ON services FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admin update services" ON services;
CREATE POLICY "Admin update services" ON services FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admin delete services" ON services;
CREATE POLICY "Admin delete services" ON services FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── Admin INSERT/UPDATE on settings (existing public SELECT stays) ──
DROP POLICY IF EXISTS "Admin insert settings" ON settings;
CREATE POLICY "Admin insert settings" ON settings FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admin update settings" ON settings;
CREATE POLICY "Admin update settings" ON settings FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));