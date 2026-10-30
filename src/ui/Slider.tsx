import type { ReactNode } from 'react';

interface Props {
  label: string;
  icon: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  /** 0 = show nothing */
  format?: (v: number) => string;
}

/** Icon + native range input. The label is visually hidden but read by screen readers. */
export function Slider({ label, icon, value, min, max, step = 0.01, onChange, format }: Props) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <label className="flex items-center gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl border-2 border-line bg-surface2" title={label}>
        {icon}
      </span>
      <span className="sr-only-text">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ ['--fill' as string]: `${fill}%` }}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        aria-label={label}
        aria-valuetext={format ? format(value) : undefined}
      />
      <output className="w-10 shrink-0 text-right text-sm font-bold tabular-nums text-muted">{format ? format(value) : Math.round(value * 100)}</output>
    </label>
  );
}
