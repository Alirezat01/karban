/* ────────────────────────────────────────────────────────────
   LiveStats — animated counters shown on the homepage.
   Fetches aggregate counts from `site_stats`; falls back to
   canned numbers if the table is empty / unreachable.
   ──────────────────────────────────────────────────────────── */
import { useEffect, useState } from 'react';
import { fetchSiteStats, FALLBACK_STATS, type SiteStat } from '@/lib/social';
import { useCountUp } from '@/lib/reveal';

function Stat({ value, label, suffix = '+' }: { value: number; label: string; suffix?: string }) {
  const { ref, value: shown } = useCountUp(value);
  return (
    <div className="stat-block">
      <span className="stat-num" ref={ref}>
        {shown.toLocaleString('fa-IR')}
        <span className="stat-suffix">{suffix}</span>
      </span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

export default function LiveStats() {
  const [stats, setStats] = useState<SiteStat[]>(FALLBACK_STATS);

  useEffect(() => {
    let alive = true;
    fetchSiteStats().then((s) => {
      if (alive && s.length > 0) setStats(s);
    });
    return () => { alive = false; };
  }, []);

  return (
    <section className="live-stats-section">
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
