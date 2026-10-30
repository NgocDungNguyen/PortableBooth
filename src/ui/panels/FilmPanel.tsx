import { ArrowRight } from 'lucide-react';
import { reshape, setOrientation } from '../../film/doc';
import { computeLayout, FORMAT_ORDER, frameOptionsFor, defaultFramesFor } from '../../film/layout';
import type { FormatId, Orientation } from '../../film/types';
import { useStudio } from '../../state/studio';
import { FilmCanvas } from '../FilmCanvas';
import { previewDoc } from '../previewDocs';
import { Section, Seg } from './common';

const FILTER: Record<FormatId, string> = { strip: 'sunday', instant: 'flash', film35: 'noir' };
const WIDTH: Record<Orientation, Record<FormatId, number>> = {
  portrait: { strip: 52, instant: 66, film35: 54 },
  landscape: { strip: 96, instant: 82, film35: 96 },
};
const PORTRAIT_SIZE: Record<FormatId, string> = { strip: '2×6 in', instant: '54×86 mm', film35: '50×167 mm' };
const CARD_NAME: Record<FormatId, string> = { strip: 'Strip', instant: 'Instant card', film35: 'Film roll' };

function sizeLabel(format: FormatId, orientation: Orientation): string {
  if (orientation === 'portrait') return PORTRAIT_SIZE[format];
  const l = computeLayout(format, defaultFramesFor(format, 'landscape'), 'square', 'landscape');
  return `${Math.round(l.widthMm)}×${Math.round(l.heightMm)} mm`;
}

function Glyph({ format, frames, orientation }: { format: FormatId; frames: number; orientation: Orientation }) {
  const l = computeLayout(format, frames, 'square', orientation);
  return (
    <svg viewBox={`0 0 ${l.widthMm} ${l.heightMm}`} className={orientation === 'landscape' ? 'h-7 w-auto max-w-14' : 'h-9 w-auto'} aria-hidden>
      <rect width={l.widthMm} height={l.heightMm} rx="3" fill="currentColor" opacity=".2" />
      {l.slots.map((s, i) => <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx="1.5" fill="currentColor" />)}
    </svg>
  );
}

function Pictogram({ orientation }: { orientation: Orientation }) {
  return orientation === 'portrait' ? (
    <svg width="12" height="16" viewBox="0 0 12 16" aria-hidden><rect x="1.5" y="1.5" width="9" height="13" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
  ) : (
    <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden><rect x="1.5" y="1.5" width="13" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
  );
}

export function FilmPanel() {
  const { doc, apply, setSelection, setTool } = useStudio();
  const orientation = doc.orientation ?? 'portrait';
  const options = frameOptionsFor(doc.format, orientation);
  const pick = (o: Orientation) => {
    if (o === orientation) return;
    apply((d) => setOrientation(d, o));
    setSelection(null);
  };
  return (
    <div>
      <Section title="Shape">
        <Seg
          label="Film shape" value={orientation} onChange={pick}
          options={[
            { id: 'portrait' as Orientation, label: 'Print (tall)', icon: <Pictogram orientation="portrait" /> },
            { id: 'landscape' as Orientation, label: 'Share (wide)', icon: <Pictogram orientation="landscape" /> },
          ]}
        />
        <p className="label">Tall = real film stock for printing. Wide = for posts and chats.</p>
      </Section>
      <Section title="Film">
        <div role="radiogroup" aria-label="Film type" className="grid grid-cols-3 gap-2">
          {FORMAT_ORDER.map((f, i) => (
            <button key={f} role="radio" aria-checked={doc.format === f} aria-label={`${CARD_NAME[f]}${f === 'film35' ? ' (35mm)' : ''}, ${sizeLabel(f, orientation)}`} className="tile flex-col gap-1.5 px-1 py-3" onClick={() => { apply((d) => reshape(d, f)); setSelection(null); }}>
              <div className={`grid place-items-center ${orientation === 'landscape' ? 'h-[4.5rem]' : ''}`}>
                <FilmCanvas doc={previewDoc(f, defaultFramesFor(f, orientation), FILTER[f], i, orientation)} width={WIDTH[orientation][f]} label="" />
              </div>
              <span className="text-sm font-semibold">{CARD_NAME[f]}</span>
              <span className="label">{sizeLabel(f, orientation)}</span>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Photos">
        <div role="radiogroup" aria-label="Number of photos" className="flex gap-2">
          {options.map((n) => (
            <button key={n} role="radio" aria-checked={doc.frames === n} aria-label={`${n} ${n === 1 ? 'photo' : 'photos'}`} onClick={() => apply((d) => reshape(d, d.format, n))} className="tile h-16 w-20 flex-col gap-1">
              <Glyph format={doc.format} frames={n} orientation={orientation} />
              <span className="num text-xs">{n}</span>
            </button>
          ))}
        </div>
      </Section>
      <div className="sticky -bottom-3 z-10 -mx-4 -mb-3 mt-4 bg-surface px-4 pb-3 pt-2">
        <button className="btn btn-primary btn-lg w-full" onClick={() => setTool('photos')}>
          Next: add photos <ArrowRight size={18} aria-hidden />
        </button>
      </div>
    </div>
  );
}
