/* ────────────────────────────────────────────────────────────
   ClauseComments — sidebar panel for inline comments on a
   saved contract's clauses. Used by ContractBuilderPage preview.
   ──────────────────────────────────────────────────────────── */
import { useEffect, useState } from 'react';
import { CheckCircle2, MessageSquare, Plus, X } from 'lucide-react';
import { listComments, addComment, resolveComment, type ClauseComment } from '@/lib/comments';
import { useAuth } from '@/lib/auth';

type Props = {
  contractId: string;
  clauses: string[];  /* clause titles for indexing */
  onClose: () => void;
};

export default function ClauseComments({ contractId, clauses, onClose }: Props) {
  const { userId } = useAuth();
  const [comments, setComments] = useState<ClauseComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeClause, setActiveClause] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listComments(contractId).then((c) => {
      setComments(c);
      setLoading(false);
    });
  }, [contractId]);

  const submit = async () => {
    if (!draft.trim() || activeClause === null) return;
    setBusy(true);
    const c = await addComment(contractId, activeClause, draft.trim());
    if (c) {
      setComments((prev) => [...prev, c]);
      setDraft('');
    }
    setBusy(false);
  };

  const toggleResolve = async (id: string, current: boolean) => {
    if (await resolveComment(id, !current)) {
      setComments((prev) => prev.map((c) => (c.id === id ? { ...c, resolved: !current } : c)));
    }
  };

  const commentsByClause = (idx: number) => comments.filter((c) => c.clause_index === idx);

  return (
    <aside className="clause-comments-panel">
      <header>
        <h3><MessageSquare size={16} /> یادداشت‌ها و نظرات بندها</h3>
        <button onClick={onClose} aria-label="بستن"><X size={16} /></button>
      </header>
      <p className="muted-note">روی هر بند کلیک کن تا یادداشت بگذاری یا ببینی.</p>

      <div className="clauses-comment-list">
        {clauses.map((title, idx) => {
          const list = commentsByClause(idx);
          const active = activeClause === idx;
          return (
            <div key={idx} className={`clause-comment-item${active ? ' is-active' : ''}`}>
              <button className="clause-comment-head" onClick={() => setActiveClause(active ? null : idx)}>
                <span className="clause-num">{(idx + 1).toLocaleString('fa-IR')}</span>
                <span className="clause-name">{title}</span>
                {list.length > 0 && <span className="badge">{list.length.toLocaleString('fa-IR')}</span>}
              </button>
              {list.length > 0 && (
                <ul className="comment-threads">
                  {list.map((c) => (
                    <li key={c.id} className={c.resolved ? 'is-resolved' : ''}>
                      <p>{c.body}</p>
                      <small>{new Date(c.created_at).toLocaleDateString('fa-IR')}</small>
                      {userId === c.user_id && (
                        <button className="text-link resolve-btn" onClick={() => toggleResolve(c.id, c.resolved)}>
                          <CheckCircle2 size={12} /> {c.resolved ? 'بازکردن' : 'حل‌شده'}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {active && userId && (
                <div className="comment-add">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="یادداشتت را بنویس…"
                    rows={2}
                  />
                  <button className="button button-small" onClick={submit} disabled={busy || !draft.trim()}>
                    <Plus size={13} /> ثبت
                  </button>
                </div>
              )}
              {active && !userId && (
                <small className="muted-note"><a href="/ورود" className="text-link">وارد شو</a> تا یادداشت بگذاری.</small>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
