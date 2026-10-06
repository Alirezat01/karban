/* ────────────────────────────────────────────────────────────
   LiveStats — animated counters shown on the homepage.
   Numbers are real (counted from contracts, articles, requests,
   industries). No suffix "+" — keeps the number honest for a
   young site. Only shows numbers ≥ 1.
   ──────────────────────────────────────────────────────────── */
import { useEffect, useState } from 'react';
import { fetchSiteStats, type SiteStat } from '@/lib/social';
import { useCountUp } from '@/lib/reveal';

function Stat({ value, label }: { value: number; label: string }) {
  const { ref, value: shown } = useCountUp(value);
  return (
    <div className="stat-block">
      <span className="stat-num" ref={ref}>
        {shown.toLocaleString('fa-IR')}
      </span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

const EMPTY_STATS: SiteStat[] = [];

export default function LiveStats() {
  const [stats, setStats] = useState<SiteStat[]>(EMPTY_STATS);

  useEffect(() => {
    let alive = true;
    fetchSiteStats().then((s) => {
      if (alive) setStats(s);
    });
    return () => { alive = false; };
  }, []);

  /* اگر همه آمار صفر بود (دیتابیس خام)، اصلاً بخش را نشان نده */
  const anyNonZero = stats.some((s) => s.value > 0);
  if (!anyNonZero) return null;

  return (
    <section className="live-stats-section" aria-label="آمار کاربان">
      <div className="container">
        <div className="stats-row">
          {stats.map((s) => (
            <Stat key={s.key} value={s.value} label={s.label} />
          ))}
        </div>
      </div>
    </section>
  );
}
