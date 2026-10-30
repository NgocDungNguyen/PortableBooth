import { motion, useMotionValueEvent, useTransform, type MotionValue } from 'motion/react';
import { ArrowLeft, ArrowRight, Camera } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { ensureSticker } from '../../assets/library';
import { clamp01, easeOutCubic, useMotionOK, useProgress, useSpringProgress, useLerp } from '../motion';
import { REEL_STICKERS, reelDocs } from './docs';
import { SCENE_VIEWS } from './scenes';
import { useReel } from './useReel';

export const SCENE_MS = 2200;

interface SceneMeta {
  words: string[];
  /** index of the word that gets the gradient */
  em: number;
  /** plain-language description for screen readers */
  desc: string;
}
const SCENES: SceneMeta[] = [
  { words: ['Pick', 'your', 'film'], em: 2, desc: 'Choose a film strip, an instant card or a film roll. Tall for print, wide for sharing.' },
  { words: ['Snap', 'or', 'upload'], em: 0, desc: 'Take photos with a countdown, or upload your own. They drop into the film.' },
  { words: ['Make', 'it', 'yours'], em: 2, desc: 'Try looks, add stickers and a text label.' },
  { words: ['Frames,', 'colours,', 'details'], em: 2, desc: 'Change the frame style and colours, and add details like a ticket.' },
  { words: ['Save.', 'Print.', 'Share.'], em: 2, desc: 'Save a 300 DPI PNG, ready to print or share.' },
];
const COUNT = SCENES.length;
const STILL_AT = [900, 2200, 2200, 2200, 2200];

function Segment({ time, i }: { time: MotionValue<number>; i: number }) {
  const scaleX = useTransform(time, (v) => clamp01((v - i * SCENE_MS) / SCENE_MS));
  return (
    <span className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-[color:var(--line-strong)]">
      <motion.span className="absolute inset-0 origin-left rounded-full bg-[color:var(--text)]" style={{ scaleX }} />
    </span>
  );
}

function Word({ local, i, em, children }: { local: MotionValue<number>; i: number; em: boolean; children: string }) {
  const p = useSpringProgress(local, 40 + i * 90, 300, 28);
  const y = useTransform(p, (v) => `${(1 - v) * 108}%`);
  return (
    <span className="reel-word">
      <motion.span className={em ? 'grad-text inline-block' : 'inline-block'} style={{ y }}>{children}</motion.span>
    </span>
  );
}

function Title({ local, index, last }: { local: MotionValue<number>; index: number; last: boolean }) {
  const m = SCENES[index];
  const out = useProgress(local, SCENE_MS - 170, 170, easeOutCubic);
  const opacity = useTransform(out, (v) => (last ? 1 : 1 - v));
  const num = useSpringProgress(local, 0, 300, 28);
  const numOp = useTransform(num, (v) => clamp01(v * 2));
  return (
    <motion.div style={{ opacity }} className="reel-title">
      <motion.p style={{ opacity: numOp }} className="num mb-2 text-[0.8rem] tracking-[0.14em] text-muted lg:mb-5 lg:text-sm" aria-hidden>
        {String(index + 1).padStart(2, '0')} <span className="opacity-50">/ {String(COUNT).padStart(2, '0')}</span>
      </motion.p>
      <h2 aria-hidden className="reel-h flex flex-wrap gap-x-[0.28em] font-display font-bold lg:block">
        {m.words.map((w, i) => (
          <span key={w} className="lg:block"><Word local={local} i={i} em={i === m.em}>{w}</Word></span>
        ))}
      </h2>
    </motion.div>
  );
}

function StartButton({ local, onClick }: { local: MotionValue<number>; onClick: () => void }) {
  const [shown, setShown] = useState(() => local.get() >= 1450);
  useMotionValueEvent(local, 'change', (v) => setShown(v >= 1450));
  const p = useSpringProgress(local, 1450, 360, 22);
  const scale = useLerp(p, 0.8, 1);
  const opacity = useTransform(p, (v) => clamp01(v * 2.5));
  return (
    <motion.button type="button" onClick={onClick} className="btn btn-primary btn-lg reel-start" style={{ scale, opacity, visibility: shown ? 'visible' : 'hidden' }}>
      Start <ArrowRight size={19} aria-hidden />
    </motion.button>
  );
}

/**
 * "How it works": a short auto-running reel shown before the homepage. Five scenes, each one idea, drawn with the
 * real film renderer. One clock drives everything (see useReel), so pause and seek are exact.
 */
export function Intro({ onDone }: { onDone: () => void }) {
  const ok = useMotionOK();
  const reel = useReel({ count: COUNT, sceneMs: SCENE_MS, auto: ok, stillAt: STILL_AT });
  const { scene, local, time } = reel;
  const [stickersReady, setStickersReady] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const skip = useRef<HTMLButtonElement>(null);
  const down = useRef<{ x: number; y: number; at: number } | null>(null);
  const closed = useRef(false);
  const latest = useRef({ reel, onDone });
  latest.current = { reel, onDone };

  reelDocs(); // build the sample films once, before the first frame
  useEffect(() => {
    let live = true;
    Promise.all(REEL_STICKERS.map(ensureSticker)).then(() => live && setStickersReady(true));
    return () => {
      live = false;
    };
  }, []);

  const finish = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    latest.current.onDone();
  }, []);

  // focus Skip, freeze page scroll, give focus back afterwards
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.style.overflow = 'hidden';
    skip.current?.focus({ preventScroll: true });
    return () => {
      html.style.overflow = overflow;
      if (prev && prev !== document.body && prev.isConnected) prev.focus({ preventScroll: true });
      else document.getElementById('main')?.focus({ preventScroll: true });
    };
  }, []);

  const goNext = useCallback(() => {
    if (!latest.current.reel.next()) finish();
  }, [finish]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === 'Escape') {
        e.preventDefault();
        finish();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        latest.current.reel.prev();
      } else if (e.key === ' ' && !t?.closest('button, a')) {
        e.preventDefault();
        goNext();
      } else if (e.key === 'Tab' && root.current) {
        const items = [...root.current.querySelectorAll<HTMLElement>('button:not([disabled])')].filter((el) => getComputedStyle(el).visibility === 'visible');
        if (!items.length) return;
        const first = items[0];
        const lastEl = items[items.length - 1];
        const active = document.activeElement;
        if (!root.current.contains(active)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && active === first) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && active === lastEl) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [finish, goNext]);

  // tap = next (right two thirds) / back (left third); press and hold = pause
  const interactive = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.('button, a');
  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (interactive(e.target)) return;
    down.current = { x: e.clientX, y: e.clientY, at: performance.now() };
    reel.hold(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerUp = (e: RPointerEvent<HTMLDivElement>) => {
    const d = down.current;
    down.current = null;
    reel.hold(false);
    if (!d) return;
    const tap = performance.now() - d.at < 320 && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 14;
    if (!tap) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (e.clientX - r.left < r.width / 3) reel.prev();
    else goNext();
  };
  const onPointerCancel = () => {
    down.current = null;
    reel.hold(false);
  };

  const View = SCENE_VIEWS[scene];
  const last = scene === COUNT - 1;
  const exit = useProgress(local, SCENE_MS - 170, 170, easeOutCubic);
  const stageOpacity = useTransform(exit, (v) => (last ? 1 : 1 - v));
  const m = SCENES[scene];

  return (
    <motion.div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label="How PortableBooth works"
      tabIndex={-1}
      className="reel fixed inset-0 z-[100] flex flex-col overflow-hidden bg-bg text-text outline-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.2 } }}
      exit={{ opacity: 0, transition: { duration: 0.16 } }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="blob drift-a reel-blob reel-blob-1" />
        <div className="blob drift-b reel-blob reel-blob-2" />
        <div className="blob drift-a reel-blob reel-blob-3" />
      </div>

      <header className="relative z-10 mx-auto w-full max-w-6xl px-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <div aria-hidden className="flex gap-1.5">
          {SCENES.map((_, i) => <Segment key={i} time={time} i={i} />)}
        </div>
        <div className="mt-2.5 flex items-center justify-between">
          <span className="flex items-center gap-2 font-display text-[0.95rem] font-semibold" aria-hidden>
            <span className="grid size-7 place-items-center rounded-lg bg-accent text-accentink"><Camera size={15} /></span>
            PortableBooth
          </span>
          <button ref={skip} type="button" onClick={finish} className="btn reel-skip">Skip</button>
        </div>
      </header>

      <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-4 pt-2 lg:flex-row lg:items-center lg:gap-14">
        <div className="lg:w-[44%]">
          <Title key={scene} local={local} index={scene} last={last} />
        </div>
        <div className="reel-fit min-h-0 flex-1 lg:h-full lg:py-4">
          <div className="reel-frame" data-s={scene}>
            {SCENES.map((_, i) => <div key={i} aria-hidden className={`reel-layer reel-layer-${i}`} style={{ opacity: i === scene ? 1 : 0 }} />)}
            <motion.div key={scene} aria-hidden className="reel-stage absolute inset-0" style={{ opacity: stageOpacity }}>
              <View local={local} stickersReady={stickersReady} />
            </motion.div>
          </div>
        </div>
      </div>

      <footer className="relative z-10 flex min-h-[calc(5.25rem+env(safe-area-inset-bottom))] items-center justify-center gap-3 px-4 pb-[env(safe-area-inset-bottom)]">
        {!ok && (
          <button type="button" className="btn btn-lg" onClick={() => reel.prev()} disabled={scene === 0}><ArrowLeft size={18} aria-hidden /> Back</button>
        )}
        {last ? (
          <StartButton local={local} onClick={finish} />
        ) : ok ? (
          <p className="reel-hint text-[0.8rem] text-muted" aria-hidden>
            <span className="reel-hint-touch">Tap to continue · hold to pause</span>
            <span className="reel-hint-keys num">← → move · Esc skip</span>
          </p>
        ) : (
          <button type="button" className="btn btn-primary btn-lg" onClick={goNext}>Next <ArrowRight size={18} aria-hidden /></button>
        )}
      </footer>

      <p className="sr-only-text" aria-live="polite" aria-atomic="true">{`Step ${scene + 1} of ${COUNT}: ${m.words.join(' ')} ${m.desc}`}</p>
      <ol className="sr-only-text">
        {SCENES.map((s) => <li key={s.words.join('-')}>{s.words.join(' ')}. {s.desc}</li>)}
      </ol>
    </motion.div>
  );
}
