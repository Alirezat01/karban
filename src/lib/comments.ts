/* ────────────────────────────────────────────────────────────
   Clause comments — threaded comments on saved contract clauses.
   ──────────────────────────────────────────────────────────── */
import { supabase } from '@/lib/supabase';

export type ClauseComment = {
  id: string;
  contract_id: string;
  user_id: string;
  clause_index: number;
  body: string;
  resolved: boolean;
  parent_id: string | null;
  created_at: string;
};

export async function listComments(contractId: string): Promise<ClauseComment[]> {
  const { data, error } = await supabase
    .from('clause_comments')
    .select('*')
    .eq('contract_id', contractId)
    .order('clause_index', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return [];
  return data as ClauseComment[];
}

export async function addComment(contractId: string, clauseIndex: number, body: string, parentId?: string | null): Promise<ClauseComment | null> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from('clause_comments')
    .insert({
      contract_id: contractId,
      user_id: uid,
      clause_index: clauseIndex,
      body: body.trim(),
      parent_id: parentId || null,
    })
    .select('*')
    .single();
  if (error) return null;
  return data as ClauseComment;
}

export async function resolveComment(commentId: string, resolved: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('clause_comments')
    .update({ resolved })
    .eq('id', commentId);
  return !error;
}
