import { motion, useReducedMotion } from 'motion/react';
import { Check } from 'lucide-react';
import { reshape } from '../film/doc';
import { computeLayout, FORMAT_ORDER, FORMATS } from '../film/layout';
import type { FormatId } from '../film/types';
import { useStudio } from '../state/studio';
import { FilmCanvas } from './FilmCanvas';
import { previewDoc } from './previewDocs';

const SAMPLE_FILTER: Record<FormatId, string> = { strip: 'sunday', instant: 'flash', film35: 'noir' };
const WIDTH: Record<FormatId, number> = { strip: 104, instant: 150, film35: 108 };
const SIZE_LABEL: Record<FormatId, string> = { strip: '2×6 in', instant: '54×86 mm', film35: '50×167 mm' };

/** tiny wireframe of how many frames a layout has */
function FrameGlyph({ format, frames }: { format: FormatId; frames: number }) {
  const l = computeLayout(format, frames, 'square');
  return (
    <svg viewBox={`0 0 ${l.widthMm} ${l.heightMm}`} className="h-12 w-auto" aria-hidden>
      <rect width={l.widthMm} height={l.heightMm} rx="3" fill="currentColor" opacity=".18" />
      {l.slots.map((s, i) => (
        <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx="1.5" fill="currentColor" />
      ))}
    </svg>
  );
}

export function StepFilm() {
  const { doc, apply, setSelection } = useStudio();
  const reduce = useReducedMotion();
  const meta = FORMATS[doc.format];

  const pickFormat = (f: FormatId) => {
    apply((d) => reshape(d, f));
    setSelection(null);
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 py-4">
      <div role="radiogroup" aria-label="Film type" className="no-scrollbar flex w-full snap-x snap-mandatory items-end gap-4 overflow-x-auto px-2 py-4 md:justify-center">
        {FORMAT_ORDER.map((f, i) => {
          const sel = doc.format === f;
          const pd = previewDoc(f, sel ? doc.frames : FORMATS[f].defaultFrames, SAMPLE_FILTER[f], i);
          return (
            <motion.button
              key={f}
              role="radio"
              aria-checked={sel}
              aria-label={`${FORMATS[f].name}, ${SIZE_LABEL[f]}`}
              onClick={() => pickFormat(f)}
              initial={reduce ? false : { opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0, scale: sel ? 1.04 : 1, rotate: sel ? 0 : i === 0 ? -2 : i === 2 ? 2 : 0 }}
              whileHover={reduce ? undefined : { y: -8 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 220, damping: 18, delay: reduce ? 0 : i * 0.06 }}
              className={`relative flex min-h-[20rem] w-[13rem] shrink-0 snap-center flex-col items-center justify-between rounded-[2rem] border-[3px] p-4 pb-4 ${
                sel ? 'border-line bg-lemon text-ink shadow-[0_8px_0_var(--shadow)]' : 'border-line bg-surface shadow-[0_5px_0_var(--shadow)]'
              }`}
            >
              {sel && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -right-3 -top-3 grid size-11 place-items-center rounded-full border-[2.5px] border-line bg-mint text-ink">
                  <Check size={24} aria-hidden />
                </motion.span>
              )}
              <div className="flex flex-1 items-center">
                <FilmCanvas doc={pd} width={WIDTH[f]} label={`${FORMATS[f].name} preview`} />
              </div>
              <span className="mt-3 font-display text-2xl font-extrabold">{FORMATS[f].name}</span>
              <span className={`text-sm font-bold ${sel ? 'text-ink/70' : 'text-muted'}`}>{SIZE_LABEL[f]}</span>
            </motion.button>
          );
        })}
      </div>

      <div role="radiogroup" aria-label="Number of photos" className="flex items-center gap-3">
        {meta.frameOptions.map((n) => (
          <motion.button
            key={n}
            role="radio"
            aria-checked={doc.frames === n}
            aria-label={`${n} ${n === 1 ? 'photo' : 'photos'}`}
            onClick={() => apply((d) => reshape(d, d.format, n))}
            whileTap={{ scale: 0.93 }}
            className={`flex min-h-[4.5rem] min-w-[4.5rem] flex-col items-center justify-center gap-1 rounded-2xl border-[2.5px] border-line px-4 py-2 font-display text-xl font-extrabold ${
              doc.frames === n ? 'bg-lemon text-ink shadow-[0_4px_0_var(--shadow)]' : 'bg-surface'
            }`}
          >
            <FrameGlyph format={doc.format} frames={n} />
            {n}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
