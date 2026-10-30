import { reshape } from '../../film/doc';
import { computeLayout, FORMAT_ORDER, FORMATS } from '../../film/layout';
import type { FormatId } from '../../film/types';
import { useStudio } from '../../state/studio';
import { FilmCanvas } from '../FilmCanvas';
import { previewDoc } from '../previewDocs';
import { Section } from './common';

const FILTER: Record<FormatId, string> = { strip: 'sunday', instant: 'flash', film35: 'noir' };
const WIDTH: Record<FormatId, number> = { strip: 52, instant: 66, film35: 54 };
const SIZE: Record<FormatId, string> = { strip: '2×6 in', instant: '54×86 mm', film35: '50×167 mm' };

function Glyph({ format, frames }: { format: FormatId; frames: number }) {
  const l = computeLayout(format, frames, 'square');
  return (
    <svg viewBox={`0 0 ${l.widthMm} ${l.heightMm}`} className="h-9 w-auto" aria-hidden>
      <rect width={l.widthMm} height={l.heightMm} rx="3" fill="currentColor" opacity=".2" />
      {l.slots.map((s, i) => <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx="1.5" fill="currentColor" />)}
    </svg>
  );
}

export function FilmPanel() {
  const { doc, apply, setSelection } = useStudio();
  const meta = FORMATS[doc.format];
  return (
    <div>
      <Section title="Film">
        <div role="radiogroup" aria-label="Film type" className="grid grid-cols-3 gap-2">
          {FORMAT_ORDER.map((f, i) => (
            <button key={f} role="radio" aria-checked={doc.format === f} aria-label={`${FORMATS[f].name}, ${SIZE[f]}`} className="tile flex-col gap-1.5 px-1 py-3" onClick={() => { apply((d) => reshape(d, f)); setSelection(null); }}>
              <FilmCanvas doc={previewDoc(f, FORMATS[f].defaultFrames, FILTER[f], i)} width={WIDTH[f]} label="" />
              <span className="text-sm font-semibold">{FORMATS[f].name}</span>
              <span className="label">{SIZE[f]}</span>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Photos">
        <div role="radiogroup" aria-label="Number of photos" className="flex gap-2">
          {meta.frameOptions.map((n) => (
            <button key={n} role="radio" aria-checked={doc.frames === n} aria-label={`${n} ${n === 1 ? 'photo' : 'photos'}`} onClick={() => apply((d) => reshape(d, d.format, n))} className="tile h-16 w-20 flex-col gap-1">
              <Glyph format={doc.format} frames={n} />
              <span className="num text-xs">{n}</span>
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}
