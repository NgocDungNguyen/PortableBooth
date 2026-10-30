import { motion, useMotionValueEvent, useTransform, type MotionValue } from 'motion/react';
import { ArrowLeft, ArrowRight, Camera, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { ensureSticker } from '../../assets/library';
import { audio } from '../../audio';
import { clamp01, easeOutCubic, useMotionOK, useProgress, useSpringProgress, useLerp } from '../motion';
import { REEL_STICKERS, reelDocs } from './docs';
import { SCENE_VIEWS, START_AT } from './scenes';
import { useReel } from './useReel';

/** every scene lasts exactly this long; the intro music cuts on the same grid (0, 7.5, 15, 22.5, 30 s) */
export const SCENE_MS = 7500;

interface SceneMeta {
  words: string[];
  /** index of the word that gets the gradient */
  em: number;
  /** the supporting line under the headline */
  line: string;
  /** plain-language description for screen readers */
  desc: string;
}
const SCENES: SceneMeta[] = [
  { words: ['Pick', 'your', 'film'], em: 2, line: 'Strip, instant or roll. Tall to print, wide to share.', desc: 'Start on the Film tab: choose a strip, an instant card or a film roll, tall for print or wide for sharing, then tap Next: add photos.' },
  { words: ['Snap', 'or', 'upload'], em: 0, line: 'Shoot with a countdown, or add photos you love.', desc: 'Take photos with a 3, 2, 1 countdown, or upload your own. They drop into the film one by one.' },
  { words: ['Make', 'it', 'yours'], em: 2, line: 'Try looks, then add stickers and text.', desc: 'Tap looks to restyle the whole film, drag stickers on, and add a text label you can resize.' },
  { words: ['Frames,', 'colours,', 'details'], em: 2, line: 'Patterns, colours, date stamps and light leaks.', desc: 'Change the frame pattern and colour, place a date stamp, and fade in a light leak.' },
  { words: ['Save.', 'Print.', 'Share.'], em: 2, line: '300 DPI prints, or send it anywhere.', desc: 'Export a 300 DPI PNG to print, or share it with nearby devices, messages, mail or a QR code.' },
];
const COUNT = SCENES.length;
/** poses for reduced motion (static cards): when everything has landed, before the scene fades out */
const STILL_AT = [5200, 7100, 7100, 7100, 7100];

function Segment({ time, i }: { time: MotionValue<number>; i: number }) {
  const scaleX = useTransform(time, (v) => clamp01((v - i * SCENE_MS) / SCENE_MS));
  return (
    <span className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-[color:var(--line-strong)]">
      <motion.span className="absolute inset-0 origin-left rounded-full bg-[color:var(--text)]" style={{ scaleX }} />
    </span>
  );
}

function Word({ local, i, em, children }: { local: MotionValue<number>; i: number; em: boolean; children: string }) {
  const p = useSpringProgress(local, 60 + i * 110, 260, 28);
  const y = useTransform(p, (v) => `${(1 - v) * 108}%`);
  return (
    <span className="reel-word">
      <motion.span className={em ? 'grad-text inline-block' : 'inline-block'} style={{ y }}>{children}</motion.span>
    </span>
  );
}

function Caption({ local, index, last }: { local: MotionValue<number>; index: number; last: boolean }) {
  const m = SCENES[index];
  const out = useProgress(local, SCENE_MS - 260, 260, easeOutCubic);
  const opacity = useTransform(out, (v) => (last ? 1 : 1 - v));
  const num = useSpringProgress(local, 0, 300, 28);
  const numOp = useTransform(num, (v) => clamp01(v * 2));
  const sub = useSpringProgress(local, 420, 220, 26);
  const subOp = useTransform(sub, (v) => clamp01(v * 1.6));
  const subY = useLerp(sub, 10, 0);
  return (
    <motion.div style={{ opacity }} className="reel-cap" aria-hidden>
      <motion.p style={{ opacity: numOp }} className="reel-count num">
        {index + 1}<span className="opacity-55">/{COUNT}</span>
      </motion.p>
      <h2 className="reel-h font-display font-bold">
        {m.words.map((w, i) => (
          <span key={w} className="reel-h-w"><Word local={local} i={i} em={i === m.em}>{w}</Word></span>
        ))}
      </h2>
      <motion.p className="reel-sub" style={{ opacity: subOp, y: subY }}>{m.line}</motion.p>
    </motion.div>
  );
}

function StartButton({ local, onClick }: { local: MotionValue<number>; onClick: () => void }) {
  const [shown, setShown] = useState(() => local.get() >= START_AT);
  useMotionValueEvent(local, 'change', (v) => setShown(v >= START_AT));
  const p = useSpringProgress(local, START_AT, 300, 22);
  const scale = useLerp(p, 0.85, 1);
  const opacity = useTransform(p, (v) => clamp01(v * 2.5));
  return (
    <motion.button type="button" onClick={onClick} className="btn btn-primary btn-lg reel-start" style={{ scale, opacity, visibility: shown ? 'visible' : 'hidden' }}>
      Start <ArrowRight size={19} aria-hidden />
    </motion.button>
  );
}

/** a copy of the audio state, refreshed on every change (works whether the store mutates or replaces it) */
function useAudioState() {
  const [s, setS] = useState(() => ({ ...audio.getState() }));
  useEffect(() => {
    setS({ ...audio.getState() });
    return audio.subscribe(() => setS({ ...audio.getState() }));
  }, []);
  return s;
}

/** resolves after fonts are ready and the first frame has painted (at least ~400 ms after mount) */
function usePainted(): boolean {
  const [painted, setPainted] = useState(false);
  useEffect(() => {
    let live = true;
    const t0 = performance.now();
    const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready ?? Promise.resolve();
    const cap = new Promise((r) => setTimeout(r, 1500));
    Promise.race([fonts, cap]).then(() => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const wait = Math.max(0, 400 - (performance.now() - t0));
          setTimeout(() => live && setPainted(true), wait);
        }),
      );
    });
    return () => {
      live = false;
    };
  }, []);
  return painted;
}

/**
 * "How it works": an auto-running reel shown before the homepage. Five 7.5 s scenes, each with a few
 * choreographed beats drawn with the real film renderer. One clock drives everything (see useReel), so pause and
 * seek are exact, and the intro music (audio.playIntro) cuts on the same grid.
 */
export function Intro({ onDone }: { onDone: () => void }) {
  const ok = useMotionOK();
  const painted = usePainted();
  const reel = useReel({ count: COUNT, sceneMs: SCENE_MS, auto: ok, stillAt: STILL_AT, running: painted });
  const { scene, local, time } = reel;
  const sound = useAudioState();
  const [tapped, setTapped] = useState(false);
  const [stickersReady, setStickersReady] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const skip = useRef<HTMLButtonElement>(null);
  const down = useRef<{ x: number; y: number; at: number } | null>(null);
  const closed = useRef(false);
  const hintShown = useRef(false);
  const latest = useRef({ reel, onDone, tapped, sound });
  latest.current = { reel, onDone, tapped, sound };

  reelDocs(); // build the sample films once, before the first frame
  useEffect(() => {
    let live = true;
    Promise.all(REEL_STICKERS.map(ensureSticker)).then(() => live && setStickersReady(true));
    return () => {
      live = false;
    };
  }, []);

  // the score starts with the clock and always stops when the reel goes away, whatever closed it
  useEffect(() => {
    if (painted) audio.playIntro();
  }, [painted]);
  useEffect(() => () => audio.stopIntro(), []);

  const finish = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    audio.stopIntro();
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

  /** user navigation: move the reel, then put the music on the same cut */
  const goTo = useCallback((move: () => boolean | void) => {
    const r = latest.current.reel;
    const before = r.current();
    move();
    const after = r.current();
    if (after !== before) audio.introScene(after);
  }, []);
  const goNext = useCallback(() => {
    let more = true;
    goTo(() => (more = latest.current.reel.next()));
    if (!more) finish();
  }, [finish, goTo]);
  const goPrev = useCallback(() => goTo(() => latest.current.reel.prev()), [goTo]);

  /** the first touch (while "Tap for sound" shows) only turns the sound on; it does not skip ahead */
  const firstTouch = useCallback(() => {
    if (latest.current.tapped) return false;
    setTapped(true);
    // the score follows the reel clock by itself once unlocked, so this tap only turns the sound on
    return hintShown.current && audio.getState().enabled;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === 'Escape') {
        e.preventDefault();
        finish();
        return;
      }
      audio.unlock();
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
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
  }, [finish, goNext, goPrev]);

  // tap = next (right two thirds) / back (left third); press and hold = pause
  const interactive = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.('button, a');
  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    audio.unlock();
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
    if (firstTouch()) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (e.clientX - r.left < r.width / 3) goPrev();
    else goNext();
  };
  const onPointerCancel = () => {
    down.current = null;
    reel.hold(false);
  };
  const toggleSound = () => {
    audio.unlock();
    setTapped(true);
    audio.setEnabled(!sound.enabled);
  };

  const View = SCENE_VIEWS[scene];
  const last = scene === COUNT - 1;
  const exit = useProgress(local, SCENE_MS - 260, 260, easeOutCubic);
  const stageOpacity = useTransform(exit, (v) => (last ? 1 : 1 - v));
  const m = SCENES[scene];
  const soundHint = ok && !tapped && sound.enabled && !sound.unlocked;
  // remembered, because the tap that answers the hint unlocks audio (App's global listener) before it reaches us
  if (soundHint) hintShown.current = true;

  return (
    <motion.div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label="How PortableBooth works"
      tabIndex={-1}
      className="reel fixed inset-0 z-[100] overflow-hidden bg-bg text-text outline-none"
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

      <header className="reel-head">
        <div aria-hidden className="flex gap-1.5">
          {SCENES.map((_, i) => <Segment key={i} time={time} i={i} />)}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2 font-display text-[0.95rem] font-semibold" aria-hidden>
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent text-accentink"><Camera size={15} /></span>
            <span className="truncate">PortableBooth</span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={toggleSound} className="btn reel-sound" aria-label="Sound" aria-pressed={sound.enabled} title={sound.enabled ? 'Mute' : 'Sound on'}>
              {sound.enabled ? <Volume2 size={18} aria-hidden /> : <VolumeX size={18} aria-hidden />}
            </button>
            <button ref={skip} type="button" onClick={finish} className="btn reel-skip">Skip</button>
          </span>
        </div>
      </header>

      <div className="reel-body">
        <Caption key={scene} local={local} index={scene} last={last} />
        <div className="reel-fit">
          <div className="reel-frame" data-s={scene}>
            {SCENES.map((_, i) => <div key={i} aria-hidden className={`reel-layer reel-layer-${i}`} style={{ opacity: i === scene ? 1 : 0 }} />)}
            <motion.div key={scene} aria-hidden className="reel-stage absolute inset-0" style={{ opacity: stageOpacity }}>
              <View local={local} stickersReady={stickersReady} />
            </motion.div>
          </div>
        </div>
        <div className="reel-foot">
          {!ok && (
            <button type="button" className="btn btn-lg" onClick={goPrev} disabled={scene === 0}><ArrowLeft size={18} aria-hidden /> Back</button>
          )}
          {last && (ok ? <StartButton local={local} onClick={finish} /> : <button type="button" onClick={finish} className="btn btn-primary btn-lg reel-start">Start <ArrowRight size={19} aria-hidden /></button>)}
          {!last && !ok && (
            <button type="button" className="btn btn-primary btn-lg" onClick={goNext}>Next <ArrowRight size={18} aria-hidden /></button>
          )}
          {!last && ok && (
            soundHint ? (
              <p className="reel-hint reel-hint-sound" aria-hidden>
                <Volume2 size={15} aria-hidden /> <span className="reel-hint-touch">Tap for sound</span><span className="reel-hint-keys">Click for sound</span>
              </p>
            ) : (
              <p className="reel-hint" aria-hidden>
                <span className="reel-hint-touch">Tap to continue · hold to pause</span>
                <span className="reel-hint-keys num">← → move · Esc skip</span>
              </p>
            )
          )}
        </div>
      </div>

      <p className="sr-only-text" aria-live="polite" aria-atomic="true">{`Step ${scene + 1} of ${COUNT}: ${m.words.join(' ')} ${m.line} ${m.desc}`}</p>
      <ol className="sr-only-text">
        {SCENES.map((s) => <li key={s.words.join('-')}>{s.words.join(' ')}. {s.desc}</li>)}
      </ol>
    </motion.div>
  );
}
