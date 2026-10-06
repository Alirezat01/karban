/* ────────────────────────────────────────────────────────────
   API Keys — management for Phase 5.4 public REST API.
   Keys are SHA-256 hashed on creation; full key shown once.
   ──────────────────────────────────────────────────────────── */
import { supabase } from '@/lib/supabase';

/* در محیط مرورگر، از window.crypto استفاده می‌کنیم (Web Crypto API).
   این روی همه مرورگرهای مدرن موجود است. */
async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* تولید بافر تصادفی به طول ۱۶ بایت با Web Crypto */
function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  rate_limit_per_day: number;
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export const AVAILABLE_SCOPES = [
  { value: 'contracts', label: 'قراردادها — لیست و جزئیات' },
  { value: 'calculators', label: 'ماشین‌حساب‌ها — پارامترهای محاسباتی' },
  { value: 'ai', label: 'هوش مصنوعی — تحلیل قرارداد' },
];

/* تولید کلید: kb_live_ + 32 hex char */
export async function generateApiKey(): Promise<{ full: string; prefix: string; hash: string }> {
  const random = randomHex(16);
  const full = `kb_live_${random}`;
  const prefix = full.slice(0, 14);
  const hash = await sha256Hex(full);
  return { full, prefix, hash };
}

export async function listApiKeys(): Promise<ApiKey[]> {
  const { data, error } = await supabase
    .from('api_keys')
    .select('id,name,key_prefix,scopes,rate_limit_per_day,is_active,last_used_at,expires_at,created_at')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as ApiKey[];
}

export async function createApiKey(name: string, scopes: string[], rateLimitPerDay = 1000): Promise<{ key: ApiKey; fullKey: string } | null> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return null;

  const { full, prefix, hash } = await generateApiKey();
  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      user_id: uid,
      name: name.trim(),
      key_prefix: prefix,
      key_hash: hash,
      scopes,
      rate_limit_per_day: rateLimitPerDay,
    })
    .select('id,name,key_prefix,scopes,rate_limit_per_day,is_active,last_used_at,expires_at,created_at')
    .single();
  if (error || !data) return null;
  return { key: data as ApiKey, fullKey: full };
}

export async function revokeApiKey(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('api_keys')
    .update({ is_active: false })
    .eq('id', id);
  return !error;
}

export async function deleteApiKey(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('api_keys')
    .delete()
    .eq('id', id);
  return !error;
}
