/** Loader مینیمال با هویت طلایی کاربان — جای «در حال بارگذاری…» ساده */
export default function KarbanLoader({ label }: { label?: string }) {
  return (
    <div className="k-loader" role="status" aria-live="polite">
      <span className="k-loader-ring" aria-hidden="true" />
      {label ? <span className="k-loader-label">{label}</span> : null}
    </div>
  );
}
