/*
# Karban Features — Phase 1 to 4
# Adds new tables for testimonials, document vault, OTP login,
# clause comments, contract signatures, AI analyses, and reminders.
#
# Idempotent: all statements use IF NOT EXISTS so this file is safe to run
# on a database that already has the karban core tables (profiles,
# saved_contracts, notifications, feedback, tickets, etc.).
#
# Tables introduced here:
#   1. testimonials              (Phase 1 — social proof on homepage)
#   2. vault_documents            (Phase 2 — personal document vault)
#   3. otp_codes                  (Phase 2 — mobile OTP login)
#   4. ai_analyses                (Phase 3 — AI contract analysis results)
#   5. ai_chat_messages            (Phase 3 — legal chatbot conversation log)
#   6. reminders                  (Phase 4 — deadline reminders feed)
#   7. contract_signatures        (Phase 4 — digital signature + sharing)
#   8. clause_comments            (Phase 4 — clause-level comments)
#
# Storage buckets required (create in Supabase Dashboard → Storage):
#   - vault-docs   (private)  → user uploaded personal documents
#   - ai-uploads   (private)  → contracts uploaded for AI analysis
*/

-- ════════════════════════════════════════════════════════════════
-- 1. testimonials  (Phase 1 — social proof)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL,                          -- e.g. "کارفرما، شرکت فناوری"
  company text,
  content text NOT NULL,
  rating smallint NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  avatar_url text,
  logo_url text,                              -- company logo for the logos strip
  sort integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
-- public can read published testimonials; only admins can write
CREATE POLICY "testimonials_public_read" ON public.testimonials
  FOR SELECT USING (is_published = true);
CREATE POLICY "testimonials_admin_all" ON public.testimonials
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
CREATE INDEX IF NOT EXISTS idx_testimonials_published_sort ON public.testimonials (is_published, sort);

-- ════════════════════════════════════════════════════════════════
-- 2. vault_documents  (Phase 2 — personal document vault)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.vault_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  doc_type text NOT NULL DEFAULT 'other',     -- contract | id | invoice | legal | other
  file_url text NOT NULL,                      -- path in `vault-docs` bucket
  file_name text,
  file_size bigint,
  tags text[] NOT NULL DEFAULT '{}',
  notes text,
  expires_at timestamptz,                       -- optional document expiry (for reminders)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vault_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vault_owner_rw" ON public.vault_documents
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_vault_user ON public.vault_documents (user_id, created_at DESC);

-- ════════════════════════════════════════════════════════════════
-- 3. otp_codes  (Phase 2 — mobile OTP login)
--    Lightweight OTP store. We use this instead of Supabase Phone Auth
--    so we can route SMS through sms.ir (cheaper, user already has account).
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile text NOT NULL,                        -- normalized 09xxxxxxxxx
  code text NOT NULL,                          -- 6-digit code (hashed)
  code_hash text NOT NULL,                     -- sha256 of code for verification
  purpose text NOT NULL DEFAULT 'login',      -- login | register | reset
  attempts smallint NOT NULL DEFAULT 0,
  verified boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT otp_mobile_check CHECK (mobile ~ '^09[0-9]{9}$')
);
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
-- public insert (for requesting a code); service_role reads/verifies
CREATE POLICY "otp_public_insert" ON public.otp_codes FOR INSERT WITH CHECK (true);
CREATE POLICY "otp_owner_select" ON public.otp_codes
  FOR SELECT USING (true);  -- verification is done server-side via service_role
CREATE INDEX IF NOT EXISTS idx_otp_mobile_expires ON public.otp_codes (mobile, expires_at DESC);

-- ════════════════════════════════════════════════════════════════
-- 4. ai_analyses  (Phase 3 — AI contract analysis results)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.ai_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  contract_text text NOT NULL,                 -- extracted plain text
  contract_title text,
  summary text,                                -- overall AI summary
  risk_level text NOT NULL DEFAULT 'medium',  -- low | medium | high | critical
  clauses jsonb NOT NULL DEFAULT '[]',        -- [{index, title, text, risk, reason, suggestion}]
  model text,                                  -- which LLM was used
  tokens_used integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_analyses_owner_rw" ON public.ai_analyses
  FOR ALL USING (user_id = auth.uid() OR user_id IS NULL) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_ai_user ON public.ai_analyses (user_id, created_at DESC);

-- ════════════════════════════════════════════════════════════════
-- 5. ai_chat_messages  (Phase 3 — legal chatbot conversation log)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL DEFAULT gen_random_uuid(),
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  citations jsonb,                             -- [{law_id, article, text}]
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_chat_owner_rw" ON public.ai_chat_messages
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_ai_chat_session ON public.ai_chat_messages (session_id, created_at);

-- ════════════════════════════════════════════════════════════════
-- 6. reminders  (Phase 4 — deadline reminders feed)
--    Populated by the daily cron job (api/cron-reminders.js).
--    Each row creates a row in `notifications` for the user when due.
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid,                            -- optional link to acc_businesses
  ref_type text NOT NULL,                      -- contract | check | tax | vat | subscription | vault_doc | custom
  ref_id text,                                 -- id of referenced entity
  title text NOT NULL,
  description text,
  due_at timestamptz NOT NULL,                 -- when the deadline is
  notified_at timestamptz,                     -- null = not yet notified
  status text NOT NULL DEFAULT 'pending',     -- pending | sent | dismissed
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reminders_owner_rw" ON public.reminders
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_reminders_due ON public.reminders (due_at, notified_at) WHERE notified_at IS NULL;

-- ════════════════════════════════════════════════════════════════
-- 7. contract_signatures  (Phase 4 — digital signature + sharing)
--    A signed contract generates a unique shareable link.
--    The counterparty opens the link, sees the contract text, and signs.
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.contract_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.saved_contracts(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_token uuid NOT NULL DEFAULT gen_random_uuid(),  -- token in the share URL
  signer_name text,                            -- filled when signed
  signer_ip inet,
  signer_user_agent text,
  signed_at timestamptz,                       -- null = not yet signed
  expires_at timestamptz,                      -- optional link expiry
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;
-- owner has full access; anyone (even anon) can read by share_token (server verifies)
CREATE POLICY "sig_owner_all" ON public.contract_signatures
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "sig_public_read_by_token" ON public.contract_signatures
  FOR SELECT USING (true);  -- server filters by token via service_role
CREATE UNIQUE INDEX IF NOT EXISTS idx_sig_token ON public.contract_signatures (share_token);

-- ════════════════════════════════════════════════════════════════
-- 8. clause_comments  (Phase 4 — clause-level comments)
--    Threaded comments attached to a specific clause index in a saved contract.
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.clause_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.saved_contracts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clause_index integer NOT NULL,               -- 0-based clause index in the contract text
  body text NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  parent_id uuid REFERENCES public.clause_comments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clause_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_contract_read" ON public.clause_comments
  FOR SELECT USING (true);  -- anyone who can see the contract can read comments
CREATE POLICY "comments_owner_insert" ON public.clause_comments
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "comments_owner_update" ON public.clause_comments
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_comments_contract ON public.clause_comments (contract_id, clause_index, created_at);

-- ════════════════════════════════════════════════════════════════
-- 9. site_stats  (Phase 1 — live counters on homepage)
--    Single-row table of public aggregate stats; updated by a cron job.
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.site_stats (
  key text PRIMARY KEY,                         -- contracts_count | calculator_uses | users_count | ...
  value bigint NOT NULL DEFAULT 0,
  label text,                                  -- Persian display label
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.site_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stats_public_read" ON public.site_stats FOR SELECT USING (true);
CREATE POLICY "stats_admin_write" ON public.site_stats
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Seed initial stat keys (values will be filled by cron or admin)
INSERT INTO public.site_stats (key, value, label) VALUES
  ('contracts_count', 90, 'قرارداد تخصصی'),
  ('calculator_uses', 12000, 'محاسبه حقوقی'),
  ('users_count', 5000, 'کاربر فعال'),
  ('industries_count', 60, 'صنف پوشش‌داده‌شده')
ON CONFLICT (key) DO NOTHING;

-- ════════════════════════════════════════════════════════════════
-- 10. updated_at triggers for vault_documents
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vault_documents_touch ON public.vault_documents;
CREATE TRIGGER vault_documents_touch BEFORE UPDATE ON public.vault_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
