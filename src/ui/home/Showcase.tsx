import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ensureSticker } from '../../assets/library';
import { newSticker, newWidget } from '../../film/doc';
import { FILTERS } from '../../film/filters';
import { computeLayout } from '../../film/layout';
import type { FilmDoc, FormatId } from '../../film/types';
import { FRAME_STYLES } from '../../render/frames';
import { OVERLAYS } from '../../render/overlays';
import { WIDGETS } from '../../render/widgets';
import { FilmCanvas } from '../FilmCanvas';
import { reveal, useMotionOK } from '../motion';
import { previewDoc } from '../previewDocs';

const size = (d: FilmDoc) => computeLayout(d.format, d.frames, d.corners, d.orientation);
const widget = (id: string) => WIDGETS.find((w) => w.id === id) ?? WIDGETS[0];

/** a film lying on a lit tabletop, with a contact shadow under it */
function OnTable({ doc, label, tilt = 0, className = '' }: { doc: FilmDoc; label: string; tilt?: number; className?: string }) {
  return (
    <div className={`table-film ${className}`} style={{ ['--tilt' as string]: `${tilt}deg` }}>
      <FilmCanvas doc={doc} label={label} />
    </div>
  );
}

const FORMATS: { key: string; title: string; note: string; doc: FilmDoc; tilt: number; cls: string; box: string }[] = [
  { key: 'tall', title: 'Tall strip', note: 'The classic four-frame booth strip. Prints at 2×6 in.', doc: { ...previewDoc('strip', 4, 'sunday', 0), dateStamp: true }, tilt: -3, cls: 'md:col-span-4 md:row-span-2', box: 'h-[24rem] md:h-[36rem]' },
  { key: 'wide', title: 'Wide strip', note: 'Same strip, turned sideways for posts and chats.', doc: previewDoc('strip', 4, 'golden', 4, 'landscape'), tilt: 1.5, cls: 'md:col-span-8', box: 'h-[9rem] md:h-[15rem]' },
  { key: 'instant', title: 'Instant card', note: 'One frame, a fat chin for a caption.', doc: previewDoc('instant', 1, 'flash', 2), tilt: 4, cls: 'md:col-span-3', box: 'h-[17rem] md:h-[15rem]' },
  { key: 'roll', title: '35mm roll', note: 'Sprockets, edge print, frame numbers.', doc: previewDoc('film35', 3, 'tape', 5, 'landscape'), tilt: -2, cls: 'md:col-span-5', box: 'h-[8.5rem] md:h-[15rem]' },
];

/** "What you can make": every format, well lit, on a tabletop */
export function Formats() {
  const ok = useMotionOK();
  return (
    <div className="grid gap-4 md:grid-cols-12">
      {FORMATS.map((f, i) => (
        <motion.figure key={f.key} {...reveal(ok, i * 0.06)} className={`table-tile ${f.cls}`}>
          <div className={`grid place-items-center px-6 pt-8 ${f.box}`}>
            <OnTable doc={f.doc} label={`${f.title} example`} tilt={f.tilt} className="h-full w-full" />
          </div>
          <figcaption className="px-6 pb-5 pt-3">
            <span className="block text-[1.05rem] font-semibold">{f.title}</span>
            <span className="block text-sm text-muted">{f.note}</span>
          </figcaption>
        </motion.figure>
      ))}
    </div>
  );
}

/** the finishing tools: filters, stickers, widgets */
export function Craft() {
  const ok = useMotionOK();
  const [stickersReady, setStickersReady] = useState(false);
  useEffect(() => {
    let live = true;
    Promise.all(['shapes/star-burst', 'shapes/sparkle', 'shapes/heart-solid', 'shapes/tape-pink', 'shapes/chrome-star'].map(ensureSticker)).then(() => live && setStickersReady(true));
    return () => {
      live = false;
    };
  }, []);

  const stickers = useMemo<FilmDoc>(() => {
    const d = { ...previewDoc('instant', 1, 'peach', 0), frameStyle: 'paper', frameColor: '#F4EFE6' };
    if (!stickersReady) return d;
    const L = size(d);
    return {
      ...d,
      items: [
        { ...newSticker('shapes/tape-pink', false, L.widthMm * 0.5, 2, L.widthMm * 0.36), rot: -4 },
        { ...newSticker('shapes/chrome-star', false, L.widthMm * 0.84, L.heightMm * 0.2, 16), rot: 14 },
        { ...newSticker('shapes/heart-solid', true, L.widthMm * 0.16, L.heightMm * 0.62, 12), tint: '#FF5C7A', rot: -12 },
        { ...newSticker('shapes/sparkle', true, L.widthMm * 0.78, L.heightMm * 0.6, 9), tint: '#FFE27A', rot: 0 },
      ],
    };
  }, [stickersReady]);

  const widgets = useMemo<FilmDoc>(() => {
    const d = { ...previewDoc('instant', 1, 'dusk', 1), frameColor: '#1C1B22' };
    const L = size(d);
    const np = widget('nowplaying');
    const ra = widget('rating');
    return {
      ...d,
      items: [
        { ...newWidget(np.id, np.defaults, L.widthMm * 0.5, L.heightMm * 0.56, L.widthMm * 0.78), rot: -3 },
        { ...newWidget(ra.id, ra.defaults, L.widthMm * 0.5, L.heightMm * 0.885, L.widthMm * 0.42), rot: 0 },
      ],
    };
  }, []);

  const swatches = ['original', 'golden', 'noir', 'cherry', 'vhs', 'dream'].filter((id) => FILTERS.some((f) => f.id === id));

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <motion.article {...reveal(ok, 0)} className="craft-card">
        <div className="craft-visual">
          <div className="grid w-full grid-cols-3 gap-2">
            {swatches.map((id) => (
              <figure key={id} className="m-0">
                <div className="h-[5.4rem] overflow-hidden rounded-lg shadow-sm"><FilmCanvas doc={previewDoc('instant', 1, id, 0)} label="" className="mini-thumb-canvas" /></div>
                <figcaption className="mt-1 text-center text-[11px] font-semibold text-muted">{FILTERS.find((f) => f.id === id)?.name}</figcaption>
              </figure>
            ))}
          </div>
        </div>
        <h3 className="text-lg font-semibold">Filters that feel like film</h3>
        <p className="mt-1 text-sm text-muted">{FILTERS.length - 1} looks, {OVERLAYS.length} light leaks and textures, plus sliders for the fussy.</p>
      </motion.article>
      <motion.article {...reveal(ok, 0.06)} className="craft-card">
        <div className="craft-visual"><div className="h-full w-full py-2"><FilmCanvas doc={stickers} label="Instant card with tape, stars and a heart" /></div></div>
        <h3 className="text-lg font-semibold">Stickers and tape</h3>
        <p className="mt-1 text-sm text-muted">Hundreds of icons and emoji. Tint, flip, outline, layer.</p>
      </motion.article>
      <motion.article {...reveal(ok, 0.12)} className="craft-card">
        <div className="craft-visual"><div className="h-full w-full py-2"><FilmCanvas doc={widgets} label="Instant card with a now-playing widget and a star rating" /></div></div>
        <h3 className="text-lg font-semibold">Widgets</h3>
        <p className="mt-1 text-sm text-muted">Now playing, tickets, receipts, date stamps. {FRAME_STYLES.length} frame styles to go round it all.</p>
      </motion.article>
    </div>
  );
}

export interface Look {
  format: FormatId;
  frames: number;
  filter: string;
  offset: number;
  frame?: string;
  name: string;
}
const FORMAT_NAME: Record<FormatId, string> = { strip: 'Strip', instant: 'Instant', film35: '35mm' };

/** "Start from a look": real renders, each opens the studio with that film + filter */
export function Gallery({ looks, onPick }: { looks: Look[]; onPick: (l: Look) => void }) {
  const ok = useMotionOK();
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4" aria-label="Looks you can start from">
      {looks.map((l, i) => {
        const doc = l.frame ? { ...previewDoc(l.format, l.frames, l.filter, l.offset), frameStyle: l.frame } : previewDoc(l.format, l.frames, l.filter, l.offset);
        return (
          <motion.li key={l.name} {...reveal(ok, (i % 4) * 0.05)}>
            <button onClick={() => onPick(l)} aria-label={`Start with ${l.name}`} className="look-card group">
              <span className="look-stage">
                <OnTable doc={doc} label={`${l.name} look`} tilt={[-2, 2, -1, 3, -3, 1, 2, -2][i % 8]} className="h-full w-full" />
              </span>
              <span className="flex items-center justify-between gap-2 px-4 py-3">
                <span className="text-left">
                  <span className="block font-semibold">{l.name}</span>
                  <span className="block text-xs text-muted">{FORMAT_NAME[l.format]} · {l.frames} {l.frames === 1 ? 'frame' : 'frames'}</span>
                </span>
                <span className="look-go" aria-hidden><ArrowRight size={16} /></span>
              </span>
            </button>
          </motion.li>
        );
      })}
    </ul>
  );
}
