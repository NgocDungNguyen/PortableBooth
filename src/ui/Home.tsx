import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Camera, Lock, Shapes, SlidersHorizontal, Smile, Upload, UserX, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ensureSticker } from '../assets/library';
import { newSticker, newWidget } from '../film/doc';
import { FILTERS } from '../film/filters';
import type { FilmDoc, FormatId } from '../film/types';
import { FilmCanvas } from './FilmCanvas';
import { previewDoc } from './previewDocs';
import { WIDGETS } from '../render/widgets';

interface Props {
  onStart: (look?: { format: FormatId; frames?: number; filterId: string }) => void;
}

const HERO_LOOKS = ['sunday', 'flash', 'noir', 'cherry', 'teal-night', 'vhs', 'riso', 'dream'].filter((id) => FILTERS.some((f) => f.id === id));
const GALLERY: { format: FormatId; frames: number; filter: string; offset: number; frame?: string; name: string }[] = [
  { format: 'strip', frames: 4, filter: 'sunday', offset: 0, name: 'Sunday' },
  { format: 'instant', frames: 1, filter: 'flash', offset: 2, name: 'Flash' },
  { format: 'film35', frames: 3, filter: 'noir', offset: 1, name: 'Noir' },
  { format: 'strip', frames: 3, filter: 'cherry', offset: 3, frame: 'grid', name: 'Cherry' },
  { format: 'instant', frames: 2, filter: 'golden', offset: 1, frame: 'paper', name: 'Golden' },
  { format: 'film35', frames: 3, filter: 'tape', offset: 2, name: 'Tape' },
  { format: 'strip', frames: 4, filter: 'cyan', offset: 4, frame: 'dots', name: 'Cyan' },
  { format: 'instant', frames: 1, filter: 'dusk', offset: 5, name: 'Dusk' },
].filter((g) => FILTERS.some((f) => f.id === g.filter));

const WORDMARK = (
  <a href="#home" className="flex items-center gap-2 font-display text-lg font-semibold" aria-label="PortableBooth home">
    <span className="grid size-8 place-items-center rounded-lg bg-accent text-accentink"><Camera size={17} aria-hidden /></span>
    PortableBooth
  </a>
);

export function Home({ onStart }: Props) {
  const reduce = useReducedMotion();
  const [look, setLook] = useState(HERO_LOOKS[0] ?? 'original');
  const [printKey, setPrintKey] = useState(0);
  const [stickersReady, setStickersReady] = useState(false);

  useEffect(() => {
    Promise.all(['shapes/star-burst', 'shapes/sparkle', 'shapes/heart-solid', 'shapes/tape-pink', 'shapes/chrome-star'].map(ensureSticker)).then(() => setStickersReady(true));
  }, []);

  const hero = useMemo<FilmDoc>(() => ({ ...previewDoc('strip', 4, look, 0), dateStamp: true }), [look]);
  const decorated = useMemo<FilmDoc>(() => {
    const d = { ...previewDoc('strip', 3, 'cherry', 2), frameStyle: 'paper', frameColor: '#F4EFE6', dateStamp: false };
    if (!stickersReady) return d;
    const w = WIDGETS.find((x) => x.id === 'ticket') ?? WIDGETS[0];
    return {
      ...d,
      items: [
        { ...newSticker('shapes/chrome-star', false, 40, 24, 16), rot: 12 },
        { ...newSticker('shapes/heart-solid', true, 12, 72, 12), tint: '#FF5C7A', rot: -10 },
        { ...newSticker('shapes/tape-pink', false, 26, 3, 22), rot: -6 },
        { ...newWidget(w.id, w.defaults, 25.5, 116, 36), rot: -3 },
      ],
    };
  }, [stickersReady]);

  return (
    <div className="relative overflow-x-clip bg-bg">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        {WORDMARK}
        <button className="btn btn-primary" onClick={() => onStart()}>Start</button>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-6 md:grid-cols-[1.05fr_0.95fr] md:pt-14">
        <div className="order-2 md:order-1">
          <motion.h1 initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }} className="text-[clamp(2.8rem,8vw,5.6rem)] font-semibold leading-[0.95]">
            The photobooth
            <br />
            <span className="text-muted">in your pocket.</span>
          </motion.h1>
          <p className="mt-5 max-w-md text-lg text-muted">Shoot or upload, then style every detail. Export for the feed or for print.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button className="btn btn-primary btn-lg" onClick={() => onStart()}><Camera size={20} aria-hidden /> Start <ArrowRight size={18} aria-hidden /></button>
            <button className="btn btn-lg" onClick={() => onStart()}><Upload size={20} aria-hidden /> Upload</button>
          </div>
          <ul className="mt-8 flex flex-wrap gap-2 text-sm text-muted" aria-label="Privacy">
            {[{ Icon: Lock, t: 'On your device' }, { Icon: UserX, t: 'No sign-up' }, { Icon: ShieldCheck, t: 'Nothing stored' }].map(({ Icon, t }) => (
              <li key={t} className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5"><Icon size={15} aria-hidden /> {t}</li>
            ))}
          </ul>
        </div>

        <div className="order-1 mx-auto w-full max-w-[22rem] md:order-2">
          <div className="stage-bg relative rounded-3xl border border-line p-5 pb-4">
            <div className="mx-auto h-2.5 w-[70%] rounded-full bg-black/80 shadow-[inset_0_1px_3px_rgba(0,0,0,0.9)]" aria-hidden />
            <button type="button" onClick={() => setPrintKey((k) => k + 1)} aria-label="Print the sample strip again" className="relative -mt-1 block w-full cursor-pointer pt-2" style={{ height: '21rem', clipPath: 'inset(0 -2rem -2rem -2rem)' }}>
              <div key={printKey} className={reduce ? '' : 'printing'}>
                <FilmCanvas doc={hero} width={128} label="Sample film strip" className="mx-auto" />
              </div>
            </button>
          </div>
          <div role="radiogroup" aria-label="Try a look" className="no-scrollbar mt-4 flex gap-1.5 overflow-x-auto pb-1">
            {HERO_LOOKS.map((id) => (
              <button key={id} role="radio" aria-checked={look === id} className="chip chip-tall" onClick={() => setLook(id)}>{FILTERS.find((f) => f.id === id)?.name}</button>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="what" className="mx-auto max-w-6xl px-5 py-12">
        <h2 id="what" className="sr-only-text">What you can do</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { Icon: SlidersHorizontal, t: 'Looks', d: '36 filters, 16 overlays', doc: previewDoc('instant', 1, 'dream', 3) },
            { Icon: Shapes, t: 'Frames', d: '12 film styles', doc: { ...previewDoc('instant', 1, 'honey', 4), frameStyle: 'holo' } },
            { Icon: Smile, t: 'Stickers', d: 'Icons, emoji, widgets', doc: decorated },
          ].map(({ Icon, t, d, doc }, i) => (
            <motion.article key={t} initial={reduce ? false : { opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.45, delay: i * 0.06, ease: [0.2, 0.8, 0.2, 1] }} className="panel flex items-center gap-5 overflow-hidden p-5">
              <div className="grid h-52 w-36 shrink-0 place-items-center"><FilmCanvas doc={doc} width={doc.format === 'strip' ? 70 : 96} label={`${t} example`} /></div>
              <div>
                <Icon size={22} className="text-accent" aria-hidden />
                <h3 className="mt-2 text-xl font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-muted">{d}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      <section aria-labelledby="looks" className="py-10">
        <h2 id="looks" className="mx-auto mb-5 max-w-6xl px-5 text-2xl font-semibold">Start from a look</h2>
        <div className="marquee-wrap no-scrollbar overflow-x-auto py-3">
          <ul className="marquee flex gap-5 px-5" aria-label="Looks you can start from">
            {[...GALLERY, ...GALLERY].map((l, i) => (
              <li key={i} aria-hidden={i >= GALLERY.length}>
                <button onClick={() => onStart({ format: l.format, frames: l.frames, filterId: l.filter })} tabIndex={i >= GALLERY.length ? -1 : 0} aria-label={`Start with ${l.name}`} className="stage-bg group flex h-[17rem] w-[11rem] flex-col items-center justify-center gap-3 rounded-2xl border border-line transition-transform hover:-translate-y-1">
                  <FilmCanvas doc={l.frame ? { ...previewDoc(l.format, l.frames, l.filter, l.offset), frameStyle: l.frame } : previewDoc(l.format, l.frames, l.filter, l.offset)} width={l.format === 'film35' ? 58 : l.format === 'instant' ? 100 : 56} label={l.name} />
                  <span className="text-xs font-semibold text-muted group-hover:text-text">{l.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20 pt-8">
        <div className="panel flex flex-col items-start justify-between gap-6 p-8 md:flex-row md:items-center md:p-12">
          <h2 className="text-3xl font-semibold md:text-4xl">Make your first strip.</h2>
          <button className="btn btn-primary btn-lg" onClick={() => onStart()}><Camera size={20} aria-hidden /> Start</button>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl items-center gap-2 px-5 pb-10 text-sm text-muted"><Lock size={14} aria-hidden /> Photos never leave your device.</footer>
    </div>
  );
}
