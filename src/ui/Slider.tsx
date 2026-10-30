import type { ReactNode } from 'react';

interface Props {
  label: string;
  icon?: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}

/** Labelled native range input (the label is visible: a number alone means nothing). */
export function Slider({ label, icon, value, min, max, step = 0.01, onChange, format }: Props) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <label className="grid grid-cols-[5.5rem_1fr_2.75rem] items-center gap-2">
      <span className="flex items-center gap-2 text-[0.8rem] font-medium text-muted">
        {icon}
        {label}
      </span>
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
      <output className="num text-right text-xs text-muted">{format ? format(value) : Math.round(value * 100)}</output>
    </label>
  );
}
