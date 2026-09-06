import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { notifyAdmin } from '@/lib/notify';

type Props = { targetType: 'contract' | 'service' | 'article'; targetId: string; title?: string };

type Agg = { avg: number; count: number };

export default function RatingWidget({ targetType, targetId, title }: Props) {
  const [agg, setAgg] = useState<Agg | null>(null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  useEffect(() => {
    let active = true;
    supabase
      .from('feedback')
      .select('rating')
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .then(({ data }) => {
        if (!active) return;
        const rows = (data || []) as { rating: number }[];
        if (rows.length) {
          const avg = rows.reduce((s, r) => s + r.rating, 0) / rows.length;
          setAgg({ avg: Math.round(avg * 10) / 10, count: rows.length });
        } else {
          setAgg({ avg: 0, count: 0 });
        }
      });
    return () => { active = false; };
  }, [targetType, targetId]);

  const submit = async () => {
    if (!rating) return;
    setState('loading');
    const { error } = await supabase.from('feedback').insert({
      target_type: targetType,
      target_id: targetId,
      rating,
      comment: comment.trim() || null,
    });
    setState(error ? 'error' : 'done');
    if (!error) {
      void notifyAdmin(`⭐ امتیاز ${rating} از ۵ برای ${targetType}${comment.trim() ? ` | ${comment.trim().slice(0, 60)}` : ''}`);
      setAgg((prev) => {
        const count = (prev?.count || 0) + 1;
        const avg = Math.round((((prev?.avg || 0) * (count - 1) + rating) / count) * 10) / 10;
        return { avg, count };
      });
      setComment('');
      setRating(0);
    }
  };

  return (
    <div className="rating-widget no-print">
      <div className="rating-head">
        <strong>{title || 'ارزیابی شما'}</strong>
        {agg && agg.count > 0 && (
          <span className="rating-agg">
            <Star size={14} fill="currentColor" aria-hidden /> {agg.avg.toLocaleString('fa-IR')} از ۵ ({agg.count.toLocaleString('fa-IR')} نظر)
          </span>
        )}
      </div>

      {state === 'done' ? (
        <p className="admin-success">ممنون از بازخوردت! نظر ثبت شد.</p>
      ) : (
        <>
          <div className="rating-stars" role="radiogroup" aria-label="امتیاز از ۵ ستاره">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} ستاره`}
                className={(hover || rating) >= n ? 'is-active' : ''}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(n)}
              >
                <Star size={22} fill={(hover || rating) >= n ? 'currentColor' : 'none'} aria-hidden />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <div className="rating-form">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                placeholder="نظرت (اختیاری) — چه چیزی خوب بود، چه چیزی کم بود؟"
                aria-label="متن بازخورد"
              />
              <button className="button button-small" onClick={submit} disabled={state === 'loading'}>
                {state === 'loading' ? 'در حال ثبت…' : 'ثبت نظر'}
              </button>
              {state === 'error' && <small className="admin-error">ثبت نشد؛ یک بار دیگر امتحان کن.</small>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
