/* ────────────────────────────────────────────────────────────
   StepIndicator — shared wizard progress bar.
   Pass an array of step labels and the current index (0-based).
   ──────────────────────────────────────────────────────────── */
import { Check } from 'lucide-react';

type Props = {
  steps: string[];
  current: number;          /* 0-based index of the active step */
  onStepClick?: (index: number) => void;  /* optional click-to-jump (only to completed steps) */
};

export default function StepIndicator({ steps, current, onStepClick }: Props) {
  return (
    <ol className="step-indicator" aria-label="مراحل">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        const clickable = onStepClick && (done || i === current);
        return (
          <li
            key={label}
            className={`step-item${done ? ' is-done' : ''}${active ? ' is-active' : ''}`}
            aria-current={active ? 'step' : undefined}
          >
            <button
              type="button"
              className="step-dot"
              disabled={!clickable}
              onClick={() => clickable && onStepClick?.(i)}
              aria-label={`مرحله ${i + 1}: ${label}${done ? ' (تکمیل شده)' : ''}`}
            >
              {done ? <Check size={14} /> : <span>{(i + 1).toLocaleString('fa-IR')}</span>}
            </button>
            <span className="step-label">{label}</span>
            {i < steps.length - 1 && <span className="step-bar" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
