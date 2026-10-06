/*
# Karban Public REST API — Phase 5.4
# Adds tables for API keys and rate limit tracking.
#
# Tables introduced here:
#   1. api_keys        — issued keys with scopes and rate limits
#   2. api_usage       — per-day usage log for rate limiting
#
# Endpoints (added in api/v1/*):
#   GET /api/v1/contracts          — list published contracts
#   GET /api/v1/contracts/:id      — single contract
#   GET /api/v1/calculators/:slug  — calc params from app_settings
#   POST /api/v1/ai/analyze        — wrapper around /api/ai-analyze
#   GET /api/v1/me                  — current API key info
*/

-- ════════════════════════════════════════════════════════════════
-- 1. api_keys  — issued API keys for external integrations
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,                              -- descriptive label
  key_prefix text NOT NULL,                        -- first 8 chars shown in UI
  key_hash text NOT NULL UNIQUE,                   -- sha256 of full key
  scopes text[] NOT NULL DEFAULT '{contracts,calculators}',  -- available scopes
  rate_limit_per_day integer NOT NULL DEFAULT 1000,
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_keys_owner_rw" ON public.api_keys
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys (key_hash) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON public.api_keys (user_id);

-- ════════════════════════════════════════════════════════════════
-- 2. api_usage  — per-day, per-key usage counter (for rate limiting)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.api_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  day date NOT NULL DEFAULT CURRENT_DATE,
  count integer NOT NULL DEFAULT 0,
  UNIQUE (api_key_id, day)
);
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
-- این جدول فقط از سمت سرور (service_role) خوانده/نوشته می‌شود
CREATE POLICY "api_usage_admin_only" ON public.api_usage
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
CREATE INDEX IF NOT EXISTS idx_api_usage_day ON public.api_usage (api_key_id, day);

-- ════════════════════════════════════════════════════════════════
-- 3. Trigger: when a key is created, ensure at least the default scopes
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.api_key_default_scopes() RETURNS trigger AS $$
BEGIN
  IF NEW.scopes IS NULL OR array_length(NEW.scopes, 1) IS NULL THEN
    NEW.scopes := ARRAY['contracts', 'calculators'];
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS api_key_default_scopes_tr ON public.api_keys;
CREATE TRIGGER api_key_default_scopes_tr BEFORE INSERT ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.api_key_default_scopes();
