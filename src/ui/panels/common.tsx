import { Plus } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ColorPicker, isHex, recentColors } from './ColorPicker';
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

export function Swatches({ colors, value, onChange, label, allowCustom = true, nullable }: { colors: string[]; value: string | null; onChange: (c: string | null, key?: string) => void; label: string; allowCustom?: boolean; nullable?: boolean }) {
  const [open, setOpen] = useState(false);
  const lower = colors.map((c) => c.toLowerCase());
  const custom = isHex(value) && !lower.includes(value.toLowerCase());
  // colours picked earlier in this visit, offered next to the presets
  const extra = allowCustom ? recentColors().filter((c) => !lower.includes(c.toLowerCase())).slice(0, 4) : [];
  // the + swatch wears the custom colour only when no other swatch already shows it
  const ownSwatch = custom && !extra.some((c) => c.toLowerCase() === value!.toLowerCase());
  return (
    <div className="flex flex-col gap-2.5">
      <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-2">
        {nullable && (
          <button role="radio" aria-checked={value === null} aria-label={`${label}: none`} onClick={() => onChange(null)} className="swatch checker text-xs font-bold text-muted">
            –
          </button>
        )}
        {[...colors, ...extra].map((c) => (
          <button key={c} role="radio" aria-checked={value?.toLowerCase() === c.toLowerCase()} aria-label={`${label} ${c}`} onClick={() => onChange(c)} className="swatch" style={{ background: c }} />
        ))}
        {allowCustom && (
          <button
            type="button"
            role="radio"
            aria-checked={ownSwatch}
            aria-label={`${label}: pick any colour`}
            title="Pick any colour"
            onClick={() => setOpen((o) => !o)}
            className="swatch swatch-custom"
            style={ownSwatch ? { background: value! } : undefined}
          >
            {!ownSwatch && <Plus size={15} strokeWidth={2.6} aria-hidden />}
          </button>
        )}
      </div>
      {open && <ColorPicker value={value} label={label} onChange={(c) => onChange(c, `colour-${label}`)} onClose={() => setOpen(false)} />}
    </div>
  );
}

/** where new elements land: centre of the selected photo, else the middle of the film */
export function useDropPoint() {
  const { doc, selection } = useStudio();
  return () => {
    const l = computeLayout(doc.format, doc.frames, doc.corners, doc.orientation);
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
