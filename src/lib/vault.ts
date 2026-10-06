/* ────────────────────────────────────────────────────────────
   Vault — personal document storage.
   Uploads go to the `vault-docs` Supabase Storage bucket
   (private; RLS: user can read/write only own folder).
   ──────────────────────────────────────────────────────────── */
import { supabase } from '@/lib/supabase';

export type VaultDoc = {
  id: string;
  title: string;
  doc_type: string;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  tags: string[];
  notes: string | null;
  expires_at: string | null;
  created_at: string;
};

export const DOC_TYPES = [
  { value: 'contract', label: 'قرارداد' },
  { value: 'id', label: 'مدارک هویتی' },
  { value: 'invoice', label: 'فاکتور و رسید' },
  { value: 'legal', label: 'سند حقوقی' },
  { value: 'tax', label: 'اسناد مالیاتی' },
  { value: 'other', label: 'سایر' },
];

export async function listVault(): Promise<VaultDoc[]> {
  const { data, error } = await supabase
    .from('vault_documents')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return [];
  return data as VaultDoc[];
}

export async function uploadVaultFile(file: File): Promise<{ path: string; size: number } | null> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;
  const ext = file.name.split('.').pop() || 'bin';
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('vault-docs').upload(path, file, { upsert: false });
  if (error) return null;
  return { path, size: file.size };
}

export async function getVaultUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('vault-docs').createSignedUrl(path, 3600);
  return data?.signedUrl || null;
}

export async function deleteVaultDoc(doc: VaultDoc): Promise<boolean> {
  /* حذف فایل از storage + رکورد از دیتابیس */
  await supabase.storage.from('vault-docs').remove([doc.file_url]);
  const { error } = await supabase.from('vault_documents').delete().eq('id', doc.id);
  return !error;
}

export async function saveVaultDoc(input: {
  title: string;
  doc_type: string;
  file_url: string;
  file_name: string;
  file_size: number;
  tags: string[];
  notes?: string;
  expires_at?: string | null;
}): Promise<VaultDoc | null> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from('vault_documents')
    .insert({ ...input, user_id: uid, expires_at: input.expires_at || null })
    .select('*')
    .single();
  if (error) return null;
  return data as VaultDoc;
}
