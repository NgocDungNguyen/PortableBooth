import { motion, useMotionValueEvent, useTransform, type MotionValue } from 'motion/react';
import { Camera, Frame, Palette, SlidersHorizontal, Smile, Ticket, Type, Upload } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { computeLayout } from '../../film/layout';
import type { FilmDoc } from '../../film/types';
import { drawCover } from '../../render/compose';
import { getPhoto } from '../../media/photos';
import { FilmCanvas } from '../FilmCanvas';
import { clamp01, easeInOutCubic, easeOutCubic, linear, steps, useLerp, useProgress, useSpringProgress } from '../motion';
import { reelDocs } from './docs';

/** One scene = a pure function of `local` (ms since the scene began). No timers, so pause/seek are exact. */
export interface SceneProps {
  local: MotionValue<number>;
  /** sticker artwork is loaded and can be drawn by the renderer */
  stickersReady: boolean;
}

/** how many of `marks` (ms) the scene clock has passed; changes only a handful of times per scene */
function useStep(local: MotionValue<number>, marks: number[]): number {
  const count = (v: number) => marks.reduce((n, m) => (v >= m ? n + 1 : n), 0);
  const [n, setN] = useState(() => count(local.get()));
  useMotionValueEvent(local, 'change', (v) => setN(count(v)));
  return n;
}

const pulse = (dt: number, len = 320) => (dt <= 0 || dt >= len ? 0 : Math.sin((Math.PI * dt) / len));

/** an absolutely placed box in percent of the stage; the film inside is fitted to it ("contain") */
function Box({ x, y, w, h, style, children, className = '' }: { x: number; y: number; w: number; h: number; style?: CSSProperties | Record<string, unknown>; children?: ReactNode; className?: string }) {
  return (
    <motion.div className={`absolute ${className}`} style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%`, ...(style as CSSProperties) }}>
      {children}
    </motion.div>
  );
}

function Chip({ children, on, className = '', style }: { children: ReactNode; on?: boolean; className?: string; style?: Record<string, unknown> }) {
  return (
    <motion.span data-on={on ? '' : undefined} className={`reel-chip ${className}`} style={style as CSSProperties}>
      {children}
    </motion.span>
  );
}

/** a sample photo drawn "cover" into a small canvas (decorative; same pixels the renderer uses) */
function PhotoFill({ photoId, w = 200, h = 150 }: { photoId: string; w?: number; h?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ph = getPhoto(photoId);
    const x = c?.getContext('2d');
    if (!c || !ph || !x) return;
    x.clearRect(0, 0, w, h);
    drawCover(x, ph, { x: 0, y: 0, w, h }, { photoId, zoom: 1, ox: 0, oy: 0, filterId: null });
  }, [photoId, w, h]);
  return <canvas ref={ref} width={w} height={h} className="block h-full w-full" />;
}

const SPARKS = ['var(--spark)', 'var(--coral)', '#ffffff'];
function Particle({ local, start, i, n, reach }: { local: MotionValue<number>; start: number; i: number; n: number; reach: number }) {
  const p = useProgress(local, start, 560, easeOutCubic);
  const a = (i / n) * Math.PI * 2 + 0.4;
  const r = reach * (0.7 + 0.5 * ((i * 7) % 3) / 2);
  const x = useTransform(p, (v) => Math.cos(a) * r * v);
  const y = useTransform(p, (v) => Math.sin(a) * r * v);
  const scale = useTransform(p, (v) => 1 - v * 0.9);
  const opacity = useTransform(p, (v) => (v <= 0 ? 0 : 1 - v * v));
  return <motion.span className="absolute left-0 top-0 block size-2 rounded-full" style={{ x, y, scale, opacity, background: SPARKS[i % SPARKS.length], marginLeft: -4, marginTop: -4 }} />;
}
/** a small radial burst of dots around a point (px, relative to the film) */
function Burst({ local, start, x, y, reach = 46 }: { local: MotionValue<number>; start: number; x: number; y: number; reach?: number }) {
  const n = 9;
  return (
    <div className="pointer-events-none absolute" style={{ left: x, top: y }}>
      {Array.from({ length: n }, (_, i) => <Particle key={i} local={local} start={start} i={i} n={n} reach={reach} />)}
    </div>
  );
}

/** vertical editorial label + icon rail used by scenes 3 and 4 */
function Rail({ label, dot, icons, active }: { label: string; dot?: string; icons: ReactNode[]; active: number }) {
  return (
    <>
      <div className="absolute left-[5%] top-[4%] flex h-[84%] flex-col items-center gap-3">
        {dot && <span className="reel-dot size-3.5 shrink-0 rounded-full" style={{ background: dot }} />}
        <motion.span key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="reel-vertical font-display text-[clamp(1.4rem,6.2cqw,2.4rem)] font-semibold leading-none tracking-tight reel-on">
          {label}
        </motion.span>
      </div>
      <div className="absolute right-[5%] top-1/2 flex -translate-y-1/2 flex-col gap-2.5">
        {icons.map((ic, i) => (
          <span key={i} data-on={i === active ? '' : undefined} className="reel-icon">{ic}</span>
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ 1. Pick your film */

const TALL = [
  { x: 5, label: 'Strip' },
  { x: 36.5, label: 'Instant' },
  { x: 68, label: 'Roll' },
];
const WIDE = [
  { y: 5, h: 23, label: 'Strip' },
  { y: 31, h: 30, label: 'Instant' },
  { y: 64, h: 23, label: 'Roll' },
];

function TallFilm({ local, i, doc }: { local: MotionValue<number>; i: number; doc: FilmDoc }) {
  const p = useSpringProgress(local, 90 + i * 120, 300, 26);
  const y = useLerp(p, 56, 0);
  const opacity = useTransform(p, (v) => clamp01(v * 2));
  const t = TALL[i];
  return (
    <>
      <Box x={t.x} y={5} w={27} h={71} style={{ y, opacity }}>
        <FilmCanvas doc={doc} label={`${t.label} film`} />
      </Box>
      <Chip className="absolute -translate-x-1/2" style={{ left: `${t.x + 13.5}%`, top: '79.5%', opacity }}>{t.label}</Chip>
    </>
  );
}

export function PickScene({ local }: SceneProps) {
  const d = reelDocs();
  const flip = useProgress(local, 1150, 560, easeInOutCubic);
  const tallRot = useTransform(flip, (v) => -90 * clamp01(v * 2));
  const tallOp = useTransform(flip, (v) => 1 - clamp01((v - 0.1) * 2.2));
  const wideRot = useTransform(flip, (v) => 90 * (1 - clamp01(v * 2 - 1)));
  const wideOp = useTransform(flip, (v) => clamp01((v - 0.5) * 2.2));
  const slide = useTransform(flip, (v) => `${v * 100}%`);
  const wide = useStep(local, [1150 + 280]) > 0;
  const rise = useSpringProgress(local, 40, 300, 28);
  const pillY = useLerp(rise, 16, 0);
  const pillOp = useTransform(rise, (v) => clamp01(v * 2));
  return (
    <div className="absolute inset-0" style={{ perspective: 1100 }}>
      <motion.div className="absolute inset-0" style={{ rotateY: tallRot, opacity: tallOp, transformStyle: 'preserve-3d' }}>
        {d.tall.map((doc, i) => <TallFilm key={i} local={local} i={i} doc={doc} />)}
      </motion.div>
      <motion.div className="absolute inset-0" style={{ rotateY: wideRot, opacity: wideOp }}>
        {WIDE.map((w, i) => (
          <div key={i}>
            <Box x={6} y={w.y} w={88} h={w.h}>
              <FilmCanvas doc={d.wide[i]} label={`${w.label} wide film`} />
            </Box>
          </div>
        ))}
      </motion.div>
      <motion.div className="reel-seg absolute bottom-[3.5%] left-1/2 -ml-[7.5rem] w-[15rem]" style={{ y: pillY, opacity: pillOp }}>
        <motion.span className="reel-seg-thumb" style={{ x: slide }} />
        <span data-on={!wide ? '' : undefined}>Print <small>tall</small></span>
        <span data-on={wide ? '' : undefined}>Share <small>wide</small></span>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ 2. Snap or upload */

const SHOTS = [980, 1180, 1380];

function Digit({ local, n, start }: { local: MotionValue<number>; n: number; start: number }) {
  const k = useTransform(local, (v) => clamp01((v - start) / 300));
  const opacity = useTransform(k, (v) => (v <= 0 || v >= 1 ? 0 : v < 0.15 ? v / 0.15 : 1 - Math.max(0, (v - 0.72) / 0.28)));
  const scale = useTransform(k, (v) => 1.55 - 0.55 * easeOutCubic(clamp01(v / 0.55)) - 0.08 * clamp01((v - 0.55) / 0.45));
  return (
    <motion.span className="absolute inset-0 grid place-items-center font-display text-[clamp(4rem,22cqw,9rem)] font-bold leading-none text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.45)]" style={{ opacity, scale }}>
      {n}
    </motion.span>
  );
}

function DropTile({ local, i, ppm, doc }: { local: MotionValue<number>; i: number; ppm: number; doc: FilmDoc }) {
  const lay = computeLayout(doc.format, doc.frames, doc.corners, doc.orientation);
  const r = lay.slots[i];
  const id = reelDocs().photoIds[i];
  const start = SHOTS[i];
  const p = useSpringProgress(local, start, 340, 23);
  const y = useLerp(p, -ppm * 70, 0);
  const scale = useLerp(p, 1.35, 1);
  const rotate = useLerp(p, i % 2 ? 7 : -7, 0);
  const fade = useProgress(local, start + 330, 150, linear);
  const opacity = useTransform([p, fade], ([a, f]: number[]) => clamp01(a * 3) * (1 - f));
  return (
    <motion.div
      className="absolute overflow-hidden shadow-[0_14px_30px_rgba(0,0,0,0.35)]"
      style={{ left: r.x * ppm, top: r.y * ppm, width: r.w * ppm, height: r.h * ppm, borderRadius: lay.slotRadius * ppm, y, scale, rotate, opacity }}
    >
      <PhotoFill photoId={id} w={200} h={Math.round((200 * r.h) / r.w)} />
    </motion.div>
  );
}

export function SnapScene({ local }: SceneProps) {
  const d = reelDocs();
  const placed = useStep(local, [SHOTS[0] + 200, SHOTS[1] + 200, SHOTS[2] + 200]);
  const doc = d.fill[placed];
  const zoom = useProgress(local, 0, 2200, linear);
  const live = useLerp(zoom, 1.03, 1.14);
  const flash = useTransform(local, (v) => (v < 900 ? 0 : v < 940 ? (v - 900) / 40 : Math.max(0, 1 - (v - 940) / 300)) * 0.95);
  const press = useTransform(local, (v) => 1 - 0.16 * pulse(v - 850, 240));
  const enter = useSpringProgress(local, 30, 300, 28);
  const enterY = useLerp(enter, 24, 0);
  const enterOp = useTransform(enter, (v) => clamp01(v * 2));
  const stripIn = useSpringProgress(local, 120, 300, 26);
  const stripY = useLerp(stripIn, 40, 0);
  const stripOp = useTransform(stripIn, (v) => clamp01(v * 2));
  return (
    <div className="absolute inset-0">
      <motion.div className="absolute left-[4%] top-[21%] w-[58%] overflow-hidden rounded-[12px] shadow-[0_18px_40px_rgba(0,0,0,0.28)]" style={{ aspectRatio: '4 / 3', y: enterY, opacity: enterOp }}>
        <motion.div className="absolute inset-0" style={{ scale: live }}>
          <PhotoFill photoId={d.liveId} w={320} h={240} />
        </motion.div>
        <i className="reel-corner left-2.5 top-2.5 border-l-2 border-t-2" />
        <i className="reel-corner right-2.5 top-2.5 border-r-2 border-t-2" />
        <i className="reel-corner bottom-2.5 left-2.5 border-b-2 border-l-2" />
        <i className="reel-corner bottom-2.5 right-2.5 border-b-2 border-r-2" />
        {[3, 2, 1].map((n, i) => <Digit key={n} local={local} n={n} start={i * 300} />)}
        <motion.span className="absolute inset-0 bg-white" style={{ opacity: flash }} />
      </motion.div>
      <motion.div className="absolute left-[4%] top-[60%] flex w-[58%] items-center justify-center gap-2" style={{ y: enterY, opacity: enterOp }}>
        <Chip on><Camera size={13} aria-hidden /> Camera</Chip>
        <Chip><Upload size={13} aria-hidden /> Upload</Chip>
      </motion.div>
      <motion.span className="reel-shutter absolute left-[33%] top-[71%] -ml-[1.9rem]" style={{ scale: press, y: enterY, opacity: enterOp }} />
      <Box x={66} y={5} w={30} h={90} style={{ y: stripY, opacity: stripOp }}>
        <FilmCanvas doc={doc} showEmpty label="Film strip">
          {(ppm) => ppm > 0 && SHOTS.map((_, i) => <DropTile key={i} local={local} i={i} ppm={ppm} doc={doc} />)}
        </FilmCanvas>
      </Box>
    </div>
  );
}

/* ------------------------------------------------------------------ 3. Make it yours */

const LOOK_MARKS = [200, 450, 700, 950, 1200];
const STICKER_AT = 1450;
const TEXT_AT = 1800;

export function StyleScene({ local, stickersReady }: SceneProps) {
  const d = reelDocs();
  const step = useStep(local, [...LOOK_MARKS, STICKER_AT, TEXT_AT]);
  const doc = step === 0 ? d.fill[3] : step <= 5 ? d.looks[step - 1].doc : step === 6 ? (stickersReady ? d.withSticker : d.looks[4].doc) : stickersReady ? d.withText : d.looks[4].doc;
  const label = step === 0 ? 'Original' : step <= 5 ? d.looks[step - 1].name : step === 6 ? 'Stickers' : 'Text';
  const bump = useTransform(local, (v) => 1 + 0.035 * pulse(v - STICKER_AT, 340) + 0.03 * pulse(v - TEXT_AT, 340));
  const enter = useSpringProgress(local, 40, 300, 26);
  const y = useLerp(enter, 36, 0);
  const opacity = useTransform(enter, (v) => clamp01(v * 2));
  return (
    <div className="absolute inset-0">
      <Rail label={label} icons={[<SlidersHorizontal key="a" size={18} aria-hidden />, <Smile key="b" size={18} aria-hidden />, <Type key="c" size={18} aria-hidden />]} active={step <= 5 ? 0 : step === 6 ? 1 : 2} />
      <Box x={25} y={3} w={50} h={88} style={{ y, opacity, scale: bump }}>
        <FilmCanvas doc={doc} label="Film strip">
          {(ppm) => ppm > 0 && (
            <>
              <Burst local={local} start={STICKER_AT} x={38 * ppm} y={24 * ppm} />
              <Burst local={local} start={TEXT_AT} x={25 * ppm} y={132 * ppm} reach={54} />
            </>
          )}
        </FilmCanvas>
      </Box>
    </div>
  );
}

/* ------------------------------------------------------------------ 4. Frames, colours, details */

const FRAME_MARKS = [160, 490, 820, 1150];
const WIDGET_AT = 1500;

export function FrameScene({ local }: SceneProps) {
  const d = reelDocs();
  const step = useStep(local, [...FRAME_MARKS, WIDGET_AT]);
  const doc = step === 0 ? d.looks[4].doc : step <= 4 ? d.frames[step - 1].doc : d.withWidget;
  const look = step >= 1 && step <= 4 ? d.frames[step - 1].look : null;
  const label = step === 0 ? 'Frame' : look ? look.name : 'Ticket';
  const bump = useTransform(local, (v) => 1 + 0.03 * pulse(v - WIDGET_AT, 340));
  const enter = useSpringProgress(local, 40, 300, 26);
  const y = useLerp(enter, 36, 0);
  const opacity = useTransform(enter, (v) => clamp01(v * 2));
  return (
    <div className="absolute inset-0">
      <Rail label={label} dot={look?.color} icons={[<Frame key="a" size={18} aria-hidden />, <Palette key="b" size={18} aria-hidden />, <Ticket key="c" size={18} aria-hidden />]} active={step <= 2 ? 0 : step <= 4 ? 1 : 2} />
      <Box x={25} y={3} w={50} h={88} style={{ y, opacity, scale: bump }}>
        <FilmCanvas doc={doc} label="Film strip">
          {(ppm) => ppm > 0 && <Burst local={local} start={WIDGET_AT} x={25.5 * ppm} y={126 * ppm} reach={58} />}
        </FilmCanvas>
      </Box>
    </div>
  );
}

/* ------------------------------------------------------------------ 5. Save. Print. Share. */

export function SaveScene({ local, stickersReady }: SceneProps) {
  const d = reelDocs();
  const feed = useProgress(local, 220, 1150, steps(22));
  const feedY = useTransform(feed, (v) => `${(v - 1) * 100}%`);
  const settle = useSpringProgress(local, 1380, 220, 20);
  const tilt = useLerp(settle, 0, -2.5);
  const slot = useSpringProgress(local, 0, 300, 28);
  const slotOp = useTransform(slot, (v) => clamp01(v * 2));
  const dpi = useSpringProgress(local, 1500, 340, 20);
  const dpiS = useTransform(dpi, (v) => Math.max(0, v));
  const dpiY = useLerp(dpi, 14, 0);
  const png = useSpringProgress(local, 1640, 340, 20);
  const pngS = useTransform(png, (v) => Math.max(0, v));
  const pngY = useLerp(png, 14, 0);
  return (
    <div className="absolute inset-0">
      <motion.div className="reel-slot absolute left-[17%] top-[3%] h-[2.2%] w-[66%]" style={{ opacity: slotOp }} />
      <Box x={20} y={5.2} w={60} h={90} className="[clip-path:inset(0_-60%_-20%_-60%)]">
        <motion.div className="h-full w-full" style={{ y: feedY, rotate: tilt }}>
          <FilmCanvas doc={stickersReady ? d.finale : d.looks[4].doc} label="Finished film strip" />
        </motion.div>
      </Box>
      <motion.div className="absolute left-[4%] top-[58%]" style={{ scale: dpiS, y: dpiY, opacity: dpiS }}>
        <span className="reel-chip reel-chip-spark">300 DPI</span>
      </motion.div>
      <motion.div className="absolute right-[5%] top-[32%]" style={{ scale: pngS, y: pngY, opacity: pngS }}>
        <span className="reel-chip" data-on="">PNG</span>
      </motion.div>
    </div>
  );
}

export const SCENE_VIEWS = [PickScene, SnapScene, StyleScene, FrameScene, SaveScene];
