import { motion, type Variants } from 'motion/react';
import { ArrowRight, Camera, Lock, Play, Shapes, ShieldCheck, SlidersHorizontal, Smile, Upload, UserX } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ensureSticker } from '../assets/library';
import { newSticker, newWidget } from '../film/doc';
import { FILTERS } from '../film/filters';
import { OVERLAYS } from '../render/overlays';
import { FRAME_STYLES } from '../render/frames';
import type { FilmDoc, FormatId } from '../film/types';
import { FilmCanvas } from './FilmCanvas';
import { EASE_OUT, pop, reveal, rise, staggerParent, useMotionOK } from './motion';
import { previewDoc } from './previewDocs';
import { ThemeToggle } from './ThemeToggle';
import { WIDGETS } from '../render/widgets';

interface Props {
  onStart: (look?: { format: FormatId; frames?: number; filterId: string }) => void;
  /** replay the "How it works" reel */
  onHowItWorks?: () => void;
  /** false while the intro covers the page: entrance animations wait for it */
  ready?: boolean;
}

const HERO_LOOKS = ['sunday', 'flash', 'noir', 'cherry', 'teal-night', 'vhs', 'riso', 'dream'].filter((id) => FILTERS.some((f) => f.id === id));
type Look = { format: FormatId; frames: number; filter: string; offset: number; frame?: string; name: string };
const GALLERY: Look[] = ([
  { format: 'strip', frames: 4, filter: 'sunday', offset: 0, name: 'Sunday' },
  { format: 'instant', frames: 1, filter: 'flash', offset: 2, name: 'Flash' },
  { format: 'film35', frames: 3, filter: 'noir', offset: 1, name: 'Noir' },
  { format: 'strip', frames: 3, filter: 'cherry', offset: 3, frame: 'grid', name: 'Cherry' },
  { format: 'instant', frames: 2, filter: 'golden', offset: 1, frame: 'paper', name: 'Golden' },
  { format: 'film35', frames: 3, filter: 'tape', offset: 2, name: 'Tape' },
  { format: 'strip', frames: 4, filter: 'cyan', offset: 4, frame: 'dots', name: 'Cyan' },
  { format: 'instant', frames: 1, filter: 'dusk', offset: 5, name: 'Dusk' },
] as Look[]).filter((g) => FILTERS.some((f) => f.id === g.filter));

const WORDMARK = (
  <a href="#home" className="flex items-center gap-2 font-display text-lg font-semibold" aria-label="PortableBooth home">
    <span className="grid size-8 place-items-center rounded-lg bg-accent text-accentink"><Camera size={17} aria-hidden /></span>
    <span className="hidden min-[430px]:inline">PortableBooth</span>
  </a>
);

/** one headline word, clipped so it rises out of its own baseline */
function W({ ok, children, className = '' }: { ok: boolean; children: string; className?: string }) {
  const v: Variants = ok
    ? { hide: { y: '108%' }, show: { y: '0%', transition: { duration: 0.55, ease: EASE_OUT } } }
    : { hide: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.2 } } };
  return (
    <span className="reel-word">
      <motion.span variants={v} className={`inline-block ${className}`}>{children}</motion.span>
    </span>
  );
}

export function Home({ onStart, onHowItWorks, ready = true }: Props) {
  const ok = useMotionOK();
  const [look, setLook] = useState(HERO_LOOKS[0] ?? 'original');
  const [printKey, setPrintKey] = useState(0);
  const [stickersReady, setStickersReady] = useState(false);
  // entrance choreography plays once, the first time the page is actually visible
  const [revealed, setRevealed] = useState(ready);
  useEffect(() => {
    if (ready) setRevealed(true);
  }, [ready]);
  const phase = revealed ? 'show' : 'hide';

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
    <div className="home relative overflow-x-clip bg-bg">
      <div className="relative isolate overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="blob drift-a hero-blob-1" />
          <div className="blob drift-b hero-blob-2" />
          <div className="blob drift-a hero-blob-3" />
        </div>

        <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4">
          {WORDMARK}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button className="btn btn-primary" onClick={() => onStart()}>Start</button>
          </div>
        </header>

        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-6 md:grid-cols-[1.08fr_0.92fr] md:pt-14">
          <motion.div variants={staggerParent(0.07, 0.04)} initial="hide" animate={phase}>
            <motion.p variants={rise(ok, 10)} className="mb-5"><span className="spark-chip">Free, in your browser</span></motion.p>
            <h1 className="home-h1 font-display">
              <W ok={ok}>The</W> <W ok={ok}>photobooth</W>
              <br />
              <W ok={ok}>in</W> <W ok={ok}>your</W> <W ok={ok} className="grad-text">pocket.</W>
            </h1>
            <motion.p variants={rise(ok)} className="mt-6 max-w-md text-lg text-muted">Snap or upload, style every detail, then print or share.</motion.p>
            <motion.div variants={rise(ok)} className="mt-8 flex flex-wrap items-center gap-3">
              <button className="btn btn-primary btn-lg" onClick={() => onStart()}><Camera size={20} aria-hidden /> Start <ArrowRight size={18} aria-hidden /></button>
              <button className="btn btn-lg" onClick={() => onStart()}><Upload size={20} aria-hidden /> Upload</button>
              {onHowItWorks && <button className="btn btn-lg btn-ghost" onClick={onHowItWorks}><Play size={16} aria-hidden /> How it works</button>}
            </motion.div>
            <motion.ul variants={rise(ok)} className="mt-8 flex flex-wrap gap-2 text-sm text-muted" aria-label="Privacy">
              {[{ Icon: Lock, t: 'On your device' }, { Icon: UserX, t: 'No sign-up' }, { Icon: ShieldCheck, t: 'Nothing stored' }].map(({ Icon, t }) => (
                <li key={t} className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5"><Icon size={15} aria-hidden /> {t}</li>
              ))}
            </motion.ul>
          </motion.div>

          <div className="mx-auto w-full max-w-[24rem]">
            <motion.div
              className="relative"
              initial={ok ? { opacity: 0, y: 26, scale: 0.97 } : { opacity: 0 }}
              animate={revealed ? { opacity: 1, y: 0, scale: 1 } : undefined}
              transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.1 }}
            >
              <div className="hero-back" aria-hidden />
              <div className="hero-block p-5 pb-4">
                <div className="relative mx-auto h-2.5 w-[70%] rounded-full bg-black/85 shadow-[inset_0_1px_3px_rgba(0,0,0,0.9)]" aria-hidden />
                <button type="button" onClick={() => setPrintKey((k) => k + 1)} aria-label="Print the sample strip again" className="relative -mt-1 block w-full cursor-pointer overflow-hidden pt-2" style={{ height: '25.5rem' }}>
                  <div key={printKey} className={revealed && ok ? 'printing' : ''}>
                    <FilmCanvas doc={hero} width={130} label="Sample film strip" className="mx-auto" />
                  </div>
                </button>
              </div>
            </motion.div>
            <motion.div variants={staggerParent(0.04, 0.5)} initial="hide" animate={phase} role="radiogroup" aria-label="Try a look" className="mt-5 flex flex-wrap gap-1.5">
              {HERO_LOOKS.map((id) => (
                <motion.button key={id} variants={pop(ok)} role="radio" aria-checked={look === id} className="chip chip-tall" onClick={() => setLook(id)}>{FILTERS.find((f) => f.id === id)?.name}</motion.button>
              ))}
            </motion.div>
          </div>
        </section>
      </div>

      <section aria-labelledby="what" className="mx-auto max-w-6xl px-5 py-12">
        <h2 id="what" className="sr-only-text">What you can do</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { Icon: SlidersHorizontal, t: 'Looks', d: `${FILTERS.length - 1} filters, ${OVERLAYS.length} overlays`, doc: previewDoc('instant', 1, 'dream', 3) },
            { Icon: Shapes, t: 'Frames', d: `${FRAME_STYLES.length} film styles`, doc: { ...previewDoc('instant', 1, 'honey', 4), frameStyle: 'holo' } },
            { Icon: Smile, t: 'Stickers', d: 'Icons, emoji, widgets', doc: decorated },
          ].map(({ Icon, t, d, doc }, i) => (
            <motion.article key={t} {...reveal(ok, i * 0.07)} className="panel lift flex items-center gap-5 overflow-hidden p-5">
              <div className="grid h-52 w-36 shrink-0 place-items-center"><FilmCanvas doc={doc} width={doc.format === 'strip' ? 70 : 96} label={`${t} example`} /></div>
              <div>
                <span className="feature-icon"><Icon size={20} aria-hidden /></span>
                <h3 className="mt-3 text-xl font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-muted">{d}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      <section aria-labelledby="looks" className="py-10">
        <motion.h2 {...reveal(ok)} id="looks" className="mx-auto mb-5 max-w-6xl px-5 text-2xl font-semibold md:text-3xl">Start from a look</motion.h2>
        <div className="no-scrollbar overflow-x-auto py-3">
          <ul className="mx-auto flex w-max snap-x gap-5 px-5" aria-label="Looks you can start from">
            {GALLERY.map((l, i) => (
              <motion.li key={i} className="snap-start" {...reveal(ok, Math.min(i, 4) * 0.05)}>
                <button onClick={() => onStart({ format: l.format, frames: l.frames, filterId: l.filter })} aria-label={`Start with ${l.name}`} className="stage-bg lift group flex h-[17rem] w-[11rem] flex-col items-center justify-center gap-3 rounded-2xl border border-line">
                  <FilmCanvas doc={l.frame ? { ...previewDoc(l.format, l.frames, l.filter, l.offset), frameStyle: l.frame } : previewDoc(l.format, l.frames, l.filter, l.offset)} width={l.format === 'film35' ? 58 : l.format === 'instant' ? 100 : 56} label={l.name} />
                  <span className="text-xs font-semibold text-muted group-hover:text-text">{l.name}</span>
                </button>
              </motion.li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20 pt-8">
        <motion.div {...reveal(ok)} className="cta-block flex flex-col items-start justify-between gap-6 p-8 md:flex-row md:items-center md:p-12">
          <h2 className="relative text-3xl font-semibold md:text-4xl">Make your first strip.</h2>
          <button className="btn btn-lg cta-btn relative" onClick={() => onStart()}><Camera size={20} aria-hidden /> Start</button>
        </motion.div>
      </section>

      <footer className="mx-auto flex max-w-6xl items-center gap-2 px-5 pb-10 text-sm text-muted"><Lock size={14} aria-hidden /> Photos never leave your device.</footer>
    </div>
  );
}
