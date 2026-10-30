import { Check } from 'lucide-react';

/** Determinate ring with the percentage in the middle (announced politely). */
export function ProgressRing({ value, done, label }: { value: number; done?: boolean; label: string }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative grid size-36 place-items-center" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--line-strong)" strokeWidth="7" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--accent)" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} className="transition-[stroke-dashoffset] duration-200" />
      </svg>
      {done ? <Check size={44} className="pop-in text-accent" aria-hidden /> : <span className="num text-2xl font-semibold">{Math.round(v * 100)}%</span>}
    </div>
  );
}
