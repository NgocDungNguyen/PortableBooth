import { useEffect, useRef, type ReactNode } from 'react';
import { computeLayout } from '../../film/layout';
import { useStudio } from '../../state/studio';

export function Section({ title, children, aside }: { title?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 py-3 first:pt-0">
      {(title || aside) && (
        <div className="flex items-center justify-between">
          {title && <h3 className="label font-sans uppercase tracking-wider" style={{ letterSpacing: '0.06em' }}>{title}</h3>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function Collapse({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group border-t border-line py-1">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-[0.8rem] font-semibold uppercase text-muted" style={{ letterSpacing: '0.06em' }}>
        {title}
        <span aria-hidden className="text-base transition-transform group-open:rotate-90">›</span>
      </summary>
      <div className="flex flex-col gap-2.5 pb-3">{children}</div>
    </details>
  );
}

export function Seg<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { id: T; label: string; icon?: ReactNode }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="seg w-full">
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)} className="flex-1 justify-center">
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Swatches({ colors, value, onChange, label, allowCustom = true, nullable }: { colors: string[]; value: string | null; onChange: (c: string | null) => void; label: string; allowCustom?: boolean; nullable?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-2">
      {nullable && (
        <button role="radio" aria-checked={value === null} aria-label={`${label}: none`} onClick={() => onChange(null)} className="swatch checker text-xs font-bold text-muted">
          –
        </button>
      )}
      {colors.map((c) => (
        <button key={c} role="radio" aria-checked={value?.toLowerCase() === c.toLowerCase()} aria-label={`${label} ${c}`} onClick={() => onChange(c)} className="swatch" style={{ background: c }} />
      ))}
      {allowCustom && (
        <label className="swatch relative overflow-hidden" title="Custom colour" style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }}>
          <input type="color" aria-label={`${label} custom`} value={value && /^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff'} onChange={(e) => onChange(e.target.value.toUpperCase())} className="absolute inset-0 size-full cursor-pointer opacity-0" />
        </label>
      )}
    </div>
  );
}

/** where new elements land: centre of the selected photo, else the middle of the film */
export function useDropPoint() {
  const { doc, selection } = useStudio();
  return () => {
    const l = computeLayout(doc.format, doc.frames, doc.corners);
    const s = selection?.type === 'slot' ? l.slots[selection.index] : undefined;
    const jitter = ((doc.items.length * 7) % 9) - 4;
    return s ? { x: s.x + s.w / 2 + jitter, y: s.y + s.h / 2 + jitter } : { x: l.widthMm / 2 + jitter, y: l.heightMm / 2 + jitter };
  };
}

/** run `draw` on a small canvas whenever deps change */
export function useCanvas(draw: (c: HTMLCanvasElement) => void, deps: unknown[]) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) draw(ref.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}
