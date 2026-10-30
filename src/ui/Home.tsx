import { motion, type Variants } from 'motion/react';
import { ArrowRight, Camera, Lock, Play, ShieldCheck, Upload, UserX } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { FILTERS } from '../film/filters';
import type { FilmDoc, FormatId } from '../film/types';
import { BrowserWindow, Phone } from './home/Devices';
import { Craft, Formats, Gallery, type Look } from './home/Showcase';
import { DeskStudio, PhoneStudio } from './home/StudioScreens';
import { EASE_OUT, pop, reveal, rise, staggerParent, useMotionOK } from './motion';
import { previewDoc } from './previewDocs';
import { SettingsButton } from './Settings';

interface Props {
  onStart: (look?: { format: FormatId; frames?: number; filterId: string }) => void;
  /** replay the "How it works" reel */
  onHowItWorks?: () => void;
  /** false while the intro covers the page: entrance animations wait for it */
  ready?: boolean;
}

const HERO_LOOKS = ['sunday', 'golden', 'noir', 'cherry', 'teal-night', 'vhs', 'riso', 'dream'].filter((id) => FILTERS.some((f) => f.id === id));
const GALLERY: Look[] = ([
  { format: 'strip', frames: 4, filter: 'sunday', offset: 0, name: 'Sunday' },
  { format: 'instant', frames: 1, filter: 'flash', offset: 2, name: 'Flash' },
  { format: 'film35', frames: 3, filter: 'noir', offset: 0, name: 'Noir' },
  { format: 'strip', frames: 3, filter: 'cherry', offset: 5, frame: 'grid', name: 'Cherry' },
  { format: 'instant', frames: 2, filter: 'golden', offset: 0, frame: 'paper', name: 'Golden' },
  { format: 'film35', frames: 3, filter: 'tape', offset: 4, name: 'Tape' },
  { format: 'strip', frames: 4, filter: 'cyan', offset: 2, frame: 'dots', name: 'Cyan' },
  { format: 'instant', frames: 1, filter: 'dusk', offset: 6, name: 'Dusk' },
] as Look[]).filter((g) => FILTERS.some((f) => f.id === g.filter));

const WORDMARK = (
  <a href="#home" className="flex items-center gap-2.5 font-display text-[1.05rem] font-semibold tracking-tight" aria-label="PortableBooth home">
    <span className="grid size-8 place-items-center rounded-[10px] bg-accent text-accentink shadow-sm"><Camera size={17} aria-hidden /></span>
    <span className="hidden min-[430px]:inline">PortableBooth</span>
  </a>
);

/** one headline word, clipped so it rises out of its own baseline */
function W({ ok, children, className = '' }: { ok: boolean; children: string; className?: string }) {
  const v: Variants = ok
    ? { hide: { y: '108%' }, show: { y: '0%', transition: { duration: 0.6, ease: EASE_OUT } } }
    : { hide: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.2 } } };
  return (
    <span className="reel-word">
      <motion.span variants={v} className={`inline-block ${className}`}>{children}</motion.span>
    </span>
  );
}

function useWide(q: string) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    on();
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}

export function Home({ onStart, onHowItWorks, ready = true }: Props) {
  const ok = useMotionOK();
  const md = useWide('(min-width: 768px)');
  const lg = useWide('(min-width: 1024px)');
  const [look, setLook] = useState(HERO_LOOKS[0] ?? 'original');
  // entrance choreography plays once, the first time the page is actually visible
  const [revealed, setRevealed] = useState(ready);
  useEffect(() => {
    if (ready) setRevealed(true);
  }, [ready]);
  const phase = revealed ? 'show' : 'hide';

  const strip = useMemo<FilmDoc>(() => ({ ...previewDoc('strip', 4, look, 0), dateStamp: true }), [look]);
  const roll = useMemo<FilmDoc>(() => previewDoc('film35', 3, look, 1, 'landscape'), [look]);

  const float = (delay: number, from: { x?: number; y?: number }) => ({
    initial: ok ? { opacity: 0, x: from.x ?? 0, y: from.y ?? 0, scale: 0.98 } : { opacity: 0 },
    animate: revealed ? { opacity: 1, x: 0, y: 0, scale: 1 } : undefined,
    transition: { duration: 0.9, ease: EASE_OUT, delay },
  });

  return (
    <div className="home relative overflow-x-clip bg-bg">
      <div className="hero-wrap relative isolate overflow-hidden">
        <div aria-hidden className="hero-light pointer-events-none absolute inset-0 -z-10" />

        <header className="mx-auto flex max-w-[78rem] items-center justify-between gap-3 px-5 py-4 md:px-8">
          {WORDMARK}
          <div className="flex items-center gap-2">
            <SettingsButton onReplayIntro={onHowItWorks} />
            <button className="btn btn-primary" onClick={() => onStart()}>Start</button>
          </div>
        </header>

        <section className="mx-auto grid max-w-[78rem] items-center gap-10 px-5 pb-14 pt-6 md:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:gap-6 lg:pb-24 lg:pt-10">
          <motion.div variants={staggerParent(0.07, 0.04)} initial="hide" animate={phase} className="relative z-10">
            <motion.p variants={rise(ok, 10)} className="mb-6"><span className="eyebrow"><span className="eyebrow-dot" /> Free, in your browser</span></motion.p>
            <h1 className="home-h1 font-display">
              <W ok={ok}>The</W> <W ok={ok}>photobooth</W>
              <br />
              <W ok={ok}>in</W> <W ok={ok}>your</W> <W ok={ok} className="grad-text">pocket.</W>
            </h1>
            <motion.p variants={rise(ok)} className="mt-6 max-w-[30rem] text-lg leading-relaxed text-muted">
              Snap or upload, pick a film, make it yours. Then print it or send it. Your photos never leave your phone.
            </motion.p>
            <motion.div variants={rise(ok)} className="mt-8 flex flex-wrap items-center gap-3">
              <button className="btn btn-primary btn-lg" onClick={() => onStart()}><Camera size={20} aria-hidden /> Start <ArrowRight size={18} aria-hidden /></button>
              <button className="btn btn-lg" onClick={() => onStart()}><Upload size={20} aria-hidden /> Upload</button>
              {onHowItWorks && <button className="btn btn-lg btn-ghost" onClick={onHowItWorks}><Play size={16} aria-hidden /> How it works</button>}
            </motion.div>
            <motion.ul variants={rise(ok)} className="mt-9 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted" aria-label="Privacy">
              {[{ Icon: Lock, t: 'On your device' }, { Icon: UserX, t: 'No sign-up' }, { Icon: ShieldCheck, t: 'Nothing stored' }].map(({ Icon, t }) => (
                <li key={t} className="inline-flex items-center gap-2"><Icon size={15} aria-hidden /> {t}</li>
              ))}
            </motion.ul>
          </motion.div>

          <div className="relative">
            <div className={`devices relative mx-auto ${lg ? 'h-[40rem] w-full' : 'w-fit'}`}>
              <div aria-hidden className="devices-floor" />
              {lg && (
                <motion.div className="absolute left-0 top-8" {...float(0.18, { x: 40 })} aria-hidden>
                  <BrowserWindow width={640}>
                    <DeskStudio doc={roll} look={look} />
                  </BrowserWindow>
                </motion.div>
              )}
              <motion.div className={lg ? 'absolute -right-2 bottom-2 z-10' : 'relative z-10'} {...float(0.32, { y: 60 })}>
                <div aria-hidden>
                  <Phone width={lg ? 278 : md ? 290 : 262}>
                    <PhoneStudio doc={strip} look={look} looks={HERO_LOOKS} print={revealed && ok} />
                  </Phone>
                </div>
                <p className="sr-only-text">The PortableBooth studio on a phone, printing a four-frame strip in the {FILTERS.find((f) => f.id === look)?.name} look.</p>
              </motion.div>
            </div>
            <motion.div
              variants={staggerParent(0.035, 0.9)}
              initial="hide"
              animate={phase}
              className="relative z-20 mt-8 flex flex-col items-center gap-3"
            >
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted" id="try-look">Try a look</span>
              <div role="radiogroup" aria-labelledby="try-look" className="flex flex-wrap justify-center gap-1.5">
                {HERO_LOOKS.map((id) => (
                  <motion.button key={id} variants={pop(ok)} role="radio" aria-checked={look === id} className="chip look-chip" onClick={() => setLook(id)}>
                    {FILTERS.find((f) => f.id === id)?.name}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </div>
        </section>
      </div>

      <section aria-labelledby="make" className="mx-auto max-w-[78rem] px-5 pt-10 md:px-8 md:pt-14">
        <motion.div {...reveal(ok)} className="mb-8 flex flex-col justify-between gap-3 md:mb-10 md:flex-row md:items-end">
          <div>
            <p className="kicker">Four films</p>
            <h2 id="make" className="section-h">What you can make</h2>
          </div>
          <p className="max-w-sm text-muted">Tall for the fridge, wide for the group chat. Prints come out at 300 dpi.</p>
        </motion.div>
        <Formats />
      </section>

      <section aria-labelledby="craft" className="mx-auto max-w-[78rem] px-5 pt-16 md:px-8 md:pt-24">
        <motion.div {...reveal(ok)} className="mb-8 md:mb-10">
          <p className="kicker">The finishing</p>
          <h2 id="craft" className="section-h">Make it look like you</h2>
        </motion.div>
        <Craft />
      </section>

      <section aria-labelledby="looks" className="mx-auto max-w-[78rem] px-5 pt-16 md:px-8 md:pt-24">
        <motion.div {...reveal(ok)} className="mb-8 flex flex-col justify-between gap-3 md:mb-10 md:flex-row md:items-end">
          <div>
            <p className="kicker">Shortcuts</p>
            <h2 id="looks" className="section-h">Start from a look</h2>
          </div>
          <p className="max-w-sm text-muted">Pick one and the studio opens with that film and filter. Change anything after.</p>
        </motion.div>
        <Gallery looks={GALLERY} onPick={(l) => onStart({ format: l.format, frames: l.frames, filterId: l.filter })} />
      </section>

      <section className="mx-auto max-w-[78rem] px-5 pb-16 pt-20 md:px-8 md:pt-28">
        <motion.div {...reveal(ok)} className="cta-block flex flex-col items-start justify-between gap-6 p-8 md:flex-row md:items-center md:p-12">
          <div className="relative">
            <h2 className="text-3xl font-semibold md:text-[2.6rem] md:leading-tight">Make your first strip.</h2>
            <p className="mt-2 text-base opacity-90">Takes about a minute. No account, no upload.</p>
          </div>
          <button className="btn btn-lg cta-btn relative" onClick={() => onStart()}><Camera size={20} aria-hidden /> Start</button>
        </motion.div>
      </section>

      <footer className="home-footer">
        <div className="mx-auto flex max-w-[78rem] flex-col gap-6 px-5 py-10 md:flex-row md:items-center md:justify-between md:px-8">
          <div className="flex flex-col gap-2">
            {WORDMARK}
            <p className="flex items-center gap-2 text-sm text-muted"><Lock size={14} aria-hidden /> Photos stay on your device. Nothing is uploaded or stored.</p>
          </div>
          <div className="flex flex-col gap-2 text-sm md:items-end">
            <a href="#about" className="footer-link">About</a>
            <p className="text-muted">Made by June Nguyen · RMIT Hà Nội</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
