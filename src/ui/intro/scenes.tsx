import { motion, useMotionValueEvent, useTransform, type MotionValue } from 'motion/react';
import { ArrowRight, Check, Download, Image as ImageIcon, Mail, MessageCircle, Printer, Radio, Share2, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { getStickerImage } from '../../assets/library';
import { computeLayout } from '../../film/layout';
import type { FilmDoc } from '../../film/types';
import { drawCover } from '../../render/compose';
import { itemBox } from '../../render/elements';
import { getPhoto } from '../../media/photos';
import { FilmCanvas } from '../FilmCanvas';
import { clamp01, easeInOutCubic, easeOutCubic, steps, useProgress, useSpringProgress } from '../motion';
import { reelDocs, TRAY } from './docs';

/**
 * One scene = a pure function of `local` (ms since the scene began, 0..7500). No timers, so pause/seek are exact.
 * The stage is a fixed 4:5 box and a size container: every position below is in `cqw` (stage width = 100,
 * stage height = 125), so the whole illustration scales as one picture and nothing is ever cropped.
 */
export interface SceneProps {
  local: MotionValue<number>;
  /** sticker artwork is loaded and can be drawn by the renderer */
  stickersReady: boolean;
}

/* ------------------------------------------------------------------ toolkit */

type Key = [t: number, v: number];
/** piecewise interpolation over [time, value] keys (eased per segment), held before the first and after the last */
function kf(v: number, keys: Key[], ease: (t: number) => number = easeInOutCubic): number {
  if (v <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (v <= t1) {
      const [t0, v0] = keys[i - 1];
      return v0 + (v1 - v0) * (t1 === t0 ? 1 : ease((v - t0) / (t1 - t0)));
    }
  }
  return keys[keys.length - 1][1];
}
const useKf = (local: MotionValue<number>, keys: Key[], ease?: (t: number) => number) => useTransform(local, (v) => kf(v, keys, ease));
const cq = (n: number) => `${n}cqw`;
const pulse = (dt: number, len = 320) => (dt <= 0 || dt >= len ? 0 : Math.sin((Math.PI * dt) / len));

/** how many of `marks` (ms) the scene clock has passed; changes only a handful of times per scene */
function useStep(local: MotionValue<number>, marks: number[]): number {
  const count = (v: number) => marks.reduce((n, m) => (v >= m ? n + 1 : n), 0);
  const [n, setN] = useState(() => count(local.get()));
  useMotionValueEvent(local, 'change', (v) => setN(count(v)));
  return n;
}

/** soft rise-in at `start` ms */
function useEnter(local: MotionValue<number>, start: number, dy = 7) {
  const p = useSpringProgress(local, start, 230, 26);
  return { y: useTransform(p, (v) => cq((1 - v) * dy)), opacity: useTransform(p, (v) => clamp01(v * 1.7)) };
}
/** a small press (scale dip) at `t` ms */
function usePress(local: MotionValue<number>, ts: number[], depth = 0.07) {
  return useTransform(local, (v) => 1 - depth * ts.reduce((m, t) => Math.max(m, pulse(v - t, 280)), 0));
}

type Style = CSSProperties | Record<string, unknown>;
/** absolutely placed box, in stage cqw */
function At({ x, y, w, h, style, className = '', children }: { x: number; y: number; w?: number; h?: number; style?: Style; className?: string; children?: ReactNode }) {
  return (
    <motion.div className={`absolute ${className}`} style={{ left: cq(x), top: cq(y), width: w === undefined ? undefined : cq(w), height: h === undefined ? undefined : cq(h), ...(style as CSSProperties) }}>
      {children}
    </motion.div>
  );
}

/** the size a film is drawn at inside a box (contain), in the box's units */
function fitIn(doc: FilmDoc, w: number, h: number) {
  const l = computeLayout(doc.format, doc.frames, doc.corners, doc.orientation);
  const s = Math.min(w / l.widthMm, h / l.heightMm);
  return { w: l.widthMm * s, h: l.heightMm * s, ppm: s };
}

interface TouchKey {
  t: number;
  x: number;
  y: number;
  tap?: boolean;
}
/** a fingertip: glides between keys, dips and ripples on taps, fades in at the first key and out after the last */
function Touch({ local, path }: { local: MotionValue<number>; path: TouchKey[] }) {
  const xs = path.map((k) => [k.t, k.x] as Key);
  const ys = path.map((k) => [k.t, k.y] as Key);
  const taps = path.filter((k) => k.tap).map((k) => k.t);
  const first = path[0].t;
  const last = path[path.length - 1].t;
  const x = useTransform(local, (v) => cq(kf(v, xs)));
  const y = useTransform(local, (v) => cq(kf(v, ys)));
  const opacity = useTransform(local, (v) => (v < first ? 0 : v < first + 260 ? (v - first) / 260 : v <= last ? 1 : Math.max(0, 1 - (v - last) / 320)));
  const scale = useTransform(local, (v) => 1 - 0.2 * taps.reduce((m, t) => Math.max(m, pulse(v - t + 70, 300)), 0));
  const ring = useTransform(local, (v) => {
    let d = -1;
    for (const t of taps) if (v >= t) d = v - t;
    return d < 0 || d > 620 ? 0 : d / 620;
  });
  const ringScale = useTransform(ring, (r) => 0.7 + 1.5 * easeOutCubic(r));
  const ringOp = useTransform(ring, (r) => (r <= 0 ? 0 : 0.85 * (1 - r)));
  return (
    <motion.div className="reel-touch-at" style={{ x, y, opacity }}>
      <motion.span className="reel-ripple" style={{ scale: ringScale, opacity: ringOp }} />
      <motion.span className="reel-touch" style={{ scale }} />
    </motion.div>
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

/** a sticker's artwork (optionally tinted) drawn into a small canvas */
function StickerGlyph({ id, tint, ready }: { id: string; tint: string | null; ready: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const img = getStickerImage(id);
    const x = c?.getContext('2d');
    if (!c || !img || !x || !ready) return;
    const S = c.width;
    x.clearRect(0, 0, S, S);
    const r = img.naturalWidth / Math.max(1, img.naturalHeight);
    const w = r >= 1 ? S : S * r;
    const h = r >= 1 ? S / r : S;
    x.globalCompositeOperation = 'source-over';
    x.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
    if (tint) {
      x.globalCompositeOperation = 'source-in';
      x.fillStyle = tint;
      x.fillRect(0, 0, S, S);
      x.globalCompositeOperation = 'source-over';
    }
  }, [id, tint, ready]);
  return <canvas ref={ref} width={128} height={128} className="block h-full w-full" />;
}

const SPARKS = ['var(--spark)', 'var(--coral)', '#ffffff'];
function Particle({ local, start, i, n, reach }: { local: MotionValue<number>; start: number; i: number; n: number; reach: number }) {
  const p = useProgress(local, start, 700, easeOutCubic);
  const a = (i / n) * Math.PI * 2 + 0.4;
  const r = reach * (0.7 + (0.5 * ((i * 7) % 3)) / 2);
  const x = useTransform(p, (v) => Math.cos(a) * r * v);
  const y = useTransform(p, (v) => Math.sin(a) * r * v);
  const scale = useTransform(p, (v) => 1 - v * 0.9);
  const opacity = useTransform(p, (v) => (v <= 0 ? 0 : 1 - v * v));
  return <motion.span className="absolute left-0 top-0 -ml-1 -mt-1 block size-2 rounded-full" style={{ x, y, scale, opacity, background: SPARKS[i % SPARKS.length] }} />;
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

/** the big "now applying" caption under the side panel (scenes 3 and 4) */
function NowLabel({ kicker, label }: { kicker: string; label: string }) {
  return (
    <At x={47} y={97} w={48} h={22} className="flex flex-col justify-center">
      <span className="reel-kicker reel-on">{kicker}</span>
      <motion.span key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.26 }} className="reel-now reel-on">
        {label}
      </motion.span>
    </At>
  );
}

/* ------------------------------------------------------------------ 1. Pick your film (Film tab) */

const FILM_NAMES = ['Strip', 'Instant', 'Roll'];
const T_IN = [500, 1150, 1800];
const SEG_TAP = 3500;
const FLIP = 3650;
const NEXT_TAP = 6050;
/** boxes (cqw) the tall and the wide films are fitted into */
const TALL_BOX = [
  { x: 12, y: 22, w: 20, h: 55 },
  { x: 37.5, y: 22, w: 25, h: 55 },
  { x: 68, y: 22, w: 20, h: 55 },
];
const WIDE_BOX = [
  { x: 30, y: 22.5, w: 61, h: 19 },
  { x: 30, y: 45.5, w: 25, h: 21 },
  { x: 30, y: 70.5, w: 61, h: 19 },
];

function MorphFilm({ local, i }: { local: MotionValue<number>; i: number }) {
  const d = reelDocs();
  const tb = TALL_BOX[i];
  const wb = WIDE_BOX[i];
  const tf = fitIn(d.tall[i], tb.w, tb.h);
  const wf = fitIn(d.wide[i], wb.w, wb.h);
  const dx = wb.x + wb.w / 2 - (tb.x + tb.w / 2);
  const dy = wb.y + wb.h / 2 - (tb.y + tb.h / 2);
  const sT = wf.w / tf.h;
  const sW = tf.h / wf.w;
  const flip = useProgress(local, FLIP + i * 120, 900, easeInOutCubic);
  const enter = useEnter(local, T_IN[i], 9);
  const tallStyle = {
    x: useTransform(flip, (p) => cq(dx * p)),
    y: useTransform(flip, (p) => cq(dy * p)),
    rotate: useTransform(flip, (p) => -90 * p),
    scale: useTransform(flip, (p) => 1 + (sT - 1) * p),
    opacity: useTransform([flip, enter.opacity] as MotionValue[], ([p, o]: number[]) => o * (1 - clamp01((p - 0.35) / 0.3))),
  };
  const wideStyle = {
    x: useTransform(flip, (p) => cq(-dx * (1 - p))),
    y: useTransform(flip, (p) => cq(-dy * (1 - p))),
    rotate: useTransform(flip, (p) => 90 * (1 - p)),
    scale: useTransform(flip, (p) => sW + (1 - sW) * p),
    opacity: useTransform(flip, (p) => clamp01((p - 0.35) / 0.3)),
  };
  return (
    <>
      <At {...tb} style={{ y: enter.y }}>
        <motion.div className="h-full w-full" style={tallStyle}>
          <FilmCanvas doc={d.tall[i]} label={`${FILM_NAMES[i]} film`} />
        </motion.div>
      </At>
      <At {...wb}>
        <motion.div className="h-full w-full" style={wideStyle}>
          <FilmCanvas doc={d.wide[i]} label={`${FILM_NAMES[i]} wide film`} />
        </motion.div>
      </At>
    </>
  );
}

function FilmLabel({ local, i }: { local: MotionValue<number>; i: number }) {
  const tb = TALL_BOX[i];
  const wb = WIDE_BOX[i];
  const enter = useEnter(local, T_IN[i] + 160, 4);
  const flip = useProgress(local, FLIP + i * 120, 900, easeInOutCubic);
  const tallOp = useTransform([flip, enter.opacity] as MotionValue[], ([p, o]: number[]) => o * (1 - clamp01(p * 2.5)));
  const wideOp = useTransform(flip, (p) => clamp01((p - 0.6) * 2.5));
  return (
    <>
      <At x={tb.x + tb.w / 2 - 12} y={tb.y + tb.h + 2} w={24} className="flex justify-center" style={{ opacity: tallOp, y: enter.y }}>
        <span className="reel-label">{FILM_NAMES[i]}</span>
      </At>
      <At x={10} y={wb.y + wb.h / 2 - 3} w={18} h={6} className="flex items-center" style={{ opacity: wideOp }}>
        <span className="reel-label">{FILM_NAMES[i]}</span>
      </At>
    </>
  );
}

export function PickScene({ local }: SceneProps) {
  const panel = useEnter(local, 0, 10);
  const wide = useStep(local, [SEG_TAP + 60]) > 0;
  const photos = useStep(local, [NEXT_TAP + 200]) > 0;
  const segX = useKf(local, [[SEG_TAP + 40, 0], [SEG_TAP + 340, 100]]);
  const segThumb = useTransform(segX, (v) => `${v}%`);
  const tabX = useKf(local, [[NEXT_TAP + 150, 0], [NEXT_TAP + 450, 100]]);
  const tabThumb = useTransform(tabX, (v) => `${v}%`);
  const segPress = usePress(local, [SEG_TAP]);
  const nextPress = usePress(local, [NEXT_TAP], 0.05);
  const dim = useKf(local, [[NEXT_TAP + 150, 1], [NEXT_TAP + 550, 0.4]]);
  const ctrl = useEnter(local, 2300, 5);
  return (
    <div className="absolute inset-0">
      <At x={5} y={4} w={90} h={117} className="reel-app" style={panel} />
      <At x={9} y={8} w={82} h={9} className="reel-tabs" style={panel}>
        <motion.span className="reel-tabs-thumb" style={{ x: tabThumb }} />
        <span data-on={!photos ? '' : undefined}><b>1</b> Film</span>
        <span data-on={photos ? '' : undefined}><b>2</b> Photos</span>
      </At>
      <motion.div className="absolute inset-0" style={{ opacity: dim }}>
        {[0, 1, 2].map((i) => <MorphFilm key={i} local={local} i={i} />)}
        {[0, 1, 2].map((i) => <FilmLabel key={i} local={local} i={i} />)}
      </motion.div>
      <At x={9} y={93} w={82} h={9.5} className="reel-seg" style={{ ...ctrl, scale: segPress }}>
        <motion.span className="reel-seg-thumb" style={{ x: segThumb }} />
        <span data-on={!wide ? '' : undefined}>Print <small>tall</small></span>
        <span data-on={wide ? '' : undefined}>Share <small>wide</small></span>
      </At>
      <At x={9} y={106} w={82} h={10.5} className="reel-cta" style={{ ...ctrl, scale: nextPress }}>
        Next: add photos <ArrowRight aria-hidden className="reel-ico" />
      </At>
      <Touch
        local={local}
        path={[
          { t: 2700, x: 86, y: 124 },
          { t: 3380, x: 71, y: 98 },
          { t: SEG_TAP, x: 71, y: 98, tap: true },
          { t: 5450, x: 71, y: 98 },
          { t: 5950, x: 54, y: 111.5 },
          { t: NEXT_TAP, x: 54, y: 111.5, tap: true },
          { t: 6900, x: 62, y: 122 },
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ 2. Snap or upload */

const SHUTTER_TAP = 1500;
const COUNT_AT = [1650, 2350, 3050];
const SHOTS = [3750, 4550];
const UPLOAD_TAP = 5450;
const PICK_TAP = 6350;
const DROPS = [SHOTS[0] + 60, SHOTS[1] + 60, PICK_TAP + 120];
/** phone origin and gallery geometry (cqw, relative to the phone) */
const PHONE = { x: 5, y: 4, w: 50, h: 117 };
const VF = { x: 4, y: 18, w: 42, h: 56 };
const galleryTile = (k: number) => {
  const c = k % 3;
  const r = Math.floor(k / 3);
  const w = (VF.w - 2) / 3;
  const h = (VF.h - 2) / 3;
  return { x: VF.x + c * (w + 1), y: VF.y + r * (h + 1), w, h };
};

function Digit({ local, n, start }: { local: MotionValue<number>; n: number; start: number }) {
  const k = useTransform(local, (v) => clamp01((v - start) / 700));
  const opacity = useTransform(k, (v) => (v <= 0 || v >= 1 ? 0 : v < 0.12 ? v / 0.12 : 1 - Math.max(0, (v - 0.75) / 0.25)));
  const scale = useTransform(k, (v) => 1.5 - 0.5 * easeOutCubic(clamp01(v / 0.4)) - 0.06 * clamp01((v - 0.4) / 0.6));
  return (
    <motion.span className="reel-digit" style={{ opacity, scale }}>
      {n}
    </motion.span>
  );
}

function DropTile({ local, i, ppm, doc, start }: { local: MotionValue<number>; i: number; ppm: number; doc: FilmDoc; start: number }) {
  const lay = computeLayout(doc.format, doc.frames, doc.corners, doc.orientation);
  const r = lay.slots[i];
  const id = reelDocs().photoIds[i];
  const p = useSpringProgress(local, start, 200, 21);
  const y = useTransform(p, (v) => (1 - v) * -ppm * 22);
  const x = useTransform(p, (v) => (1 - v) * -ppm * 55);
  const scale = useTransform(p, (v) => 1.4 - 0.4 * v);
  const rotate = useTransform(p, (v) => (1 - v) * (i % 2 ? 9 : -9));
  const fade = useProgress(local, start + 520, 160, (t) => t);
  const opacity = useTransform([p, fade] as MotionValue[], ([a, f]: number[]) => clamp01(a * 3) * (1 - f));
  return (
    <motion.div
      className="absolute overflow-hidden shadow-[0_14px_30px_rgba(0,0,0,0.35)]"
      style={{ left: r.x * ppm, top: r.y * ppm, width: r.w * ppm, height: r.h * ppm, borderRadius: lay.slotRadius * ppm, x, y, scale, rotate, opacity }}
    >
      <PhotoFill photoId={id} w={200} h={Math.round((200 * r.h) / r.w)} />
    </motion.div>
  );
}

export function SnapScene({ local }: SceneProps) {
  const d = reelDocs();
  const placed = useStep(local, DROPS.map((t) => t + 520));
  const upload = useStep(local, [UPLOAD_TAP + 80]) > 0;
  const picked = useStep(local, [PICK_TAP]) > 0;
  const shot = useStep(local, SHOTS);
  const doc = d.fill[placed];
  const live = useKf(local, [[0, 1.04], [5600, 1.16]], (t) => t);
  const flash = useTransform(local, (v) => SHOTS.reduce((m, s) => Math.max(m, v < s ? 0 : v < s + 50 ? (v - s) / 50 : Math.max(0, 1 - (v - s - 50) / 380)), 0) * 0.95);
  const shutter = usePress(local, [SHUTTER_TAP], 0.14);
  const phone = useEnter(local, 0, 10);
  const strip = useEnter(local, 250, 10);
  const gallery = useKf(local, [[UPLOAD_TAP + 80, 0], [UPLOAD_TAP + 480, 1]]);
  const camOp = useTransform(gallery, (g) => 1 - g);
  const modeX = useKf(local, [[UPLOAD_TAP + 40, 0], [UPLOAD_TAP + 340, 100]]);
  const modeThumb = useTransform(modeX, (v) => `${v}%`);
  const pickIdx = Math.max(0, d.gallery.indexOf(d.photoIds[2]));
  const pickPress = usePress(local, [PICK_TAP], 0.1);
  const sb = { x: 60, y: 9, w: 35, h: 107 };
  const pickTile = galleryTile(pickIdx);
  return (
    <div className="absolute inset-0">
      <At {...PHONE} className="reel-phone" style={phone}>
        <span className="reel-notch" />
        <At x={9} y={8.5} w={32} h={6.5} className="reel-mode">
          <motion.span className="reel-mode-thumb" style={{ x: modeThumb }} />
          <span data-on={!upload ? '' : undefined}>Camera</span>
          <span data-on={upload ? '' : undefined}>Upload</span>
        </At>
        <At {...VF} className="overflow-hidden rounded-[1.6cqw]" style={{ opacity: camOp }}>
          <motion.div className="absolute inset-0" style={{ scale: live }}>
            <PhotoFill photoId={d.liveId} w={240} h={320} />
          </motion.div>
          <i className="reel-corner left-[2cqw] top-[2cqw] border-l-2 border-t-2" />
          <i className="reel-corner right-[2cqw] top-[2cqw] border-r-2 border-t-2" />
          <i className="reel-corner bottom-[2cqw] left-[2cqw] border-b-2 border-l-2" />
          <i className="reel-corner bottom-[2cqw] right-[2cqw] border-b-2 border-r-2" />
          <span className="reel-rec num">{shot}/3</span>
          {[3, 2, 1].map((n, i) => <Digit key={n} local={local} n={n} start={COUNT_AT[i]} />)}
          <motion.span className="absolute inset-0 bg-white" style={{ opacity: flash }} />
        </At>
        <motion.div className="absolute inset-0" style={{ opacity: gallery }}>
          {d.gallery.concat(d.gallery.slice(0, 3)).map((id, k) => {
            const g = galleryTile(k);
            return (
              <At key={k} {...g} className="overflow-hidden rounded-[1cqw]" style={k === pickIdx ? { scale: pickPress } : undefined}>
                <PhotoFill photoId={id} w={96} h={128} />
                {k === pickIdx && picked && (
                  <span className="reel-check"><Check aria-hidden className="size-full" strokeWidth={3} /></span>
                )}
              </At>
            );
          })}
          <span className="reel-phone-cap">Recents</span>
        </motion.div>
        <motion.span className="reel-shutter" style={{ scale: shutter, opacity: camOp }} />
        <motion.span className="reel-phone-btn" style={{ opacity: gallery }}>
          <ImageIcon aria-hidden className="reel-ico" /> Add 1 photo
        </motion.span>
      </At>
      <At {...sb} style={strip}>
        <FilmCanvas doc={doc} showEmpty label="Film strip">
          {(ppm) => ppm > 0 && DROPS.map((s, i) => <DropTile key={i} local={local} i={i} ppm={ppm} doc={doc} start={s} />)}
        </FilmCanvas>
      </At>
      <Touch
        local={local}
        path={[
          { t: 850, x: 44, y: 124 },
          { t: 1380, x: PHONE.x + 25, y: PHONE.y + 95 },
          { t: SHUTTER_TAP, x: PHONE.x + 25, y: PHONE.y + 95, tap: true },
          { t: 2000, x: PHONE.x + 25, y: PHONE.y + 95 },
          { t: 2500, x: PHONE.x + 40, y: PHONE.y + 112 },
        ]}
      />
      <Touch
        local={local}
        path={[
          { t: 4900, x: 48, y: 40 },
          { t: 5330, x: PHONE.x + 33, y: PHONE.y + 11.75 },
          { t: UPLOAD_TAP, x: PHONE.x + 33, y: PHONE.y + 11.75, tap: true },
          { t: 5850, x: PHONE.x + 33, y: PHONE.y + 11.75 },
          { t: 6230, x: PHONE.x + pickTile.x + pickTile.w / 2, y: PHONE.y + pickTile.y + pickTile.h / 2 },
          { t: PICK_TAP, x: PHONE.x + pickTile.x + pickTile.w / 2, y: PHONE.y + pickTile.y + pickTile.h / 2, tap: true },
          { t: 7050, x: PHONE.x + 38, y: PHONE.y + 100 },
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ 3. Make it yours */

const LOOK_TAPS = [1000, 2150, 3300];
const STICKERS_TAB = 4050;
const STAR_PRESS = 4650;
const STAR_DROP = 5450;
const TEXT_TAB = 5950;
const HANDLE_PRESS = 6400;
const HANDLE_END = 7050;
/** the film every editing scene shares (cqw) */
const EDIT_FILM = { x: 5, y: 7, w: 38, h: 112 };
const PANEL = { x: 47, y: 7, w: 48, h: 86 };
const TAB_CX = [55.6, 71, 86.4];
const LOOK_TILE = (i: number) => ({ x: 50.5 + (i % 2) * 22, y: 21 + Math.floor(i / 2) * 35, w: 19, h: 27 });
const TRAY_TILE = (i: number) => ({ x: 50.5 + (i % 3) * 14.5, y: 22 + Math.floor(i / 3) * 14.5, w: 12.5, h: 12.5 });

/** maps film mm to stage cqw for the shared editing film */
function editGeom(doc: FilmDoc) {
  const f = fitIn(doc, EDIT_FILM.w, EDIT_FILM.h);
  const ox = EDIT_FILM.x + (EDIT_FILM.w - f.w) / 2;
  const oy = EDIT_FILM.y + (EDIT_FILM.h - f.h) / 2;
  return { at: (mmX: number, mmY: number) => ({ x: ox + mmX * f.ppm, y: oy + mmY * f.ppm }), s: f.ppm };
}

function PanelTabs({ local, labels, active, moves }: { local: MotionValue<number>; labels: string[]; active: number; moves: Key[] }) {
  const tx = useKf(local, moves);
  const thumb = useTransform(tx, (v) => `${v * 100}%`);
  return (
    <At x={PANEL.x + 2} y={PANEL.y + 3} w={PANEL.w - 4} h={7.5} className="reel-ptabs" style={{ gridTemplateColumns: `repeat(${labels.length}, 1fr)` }}>
      <motion.span className="reel-ptabs-thumb" style={{ x: thumb, width: `calc((100% - 1.2cqw) / ${labels.length})` }} />
      {labels.map((l, i) => <span key={l} data-on={i === active ? '' : undefined}>{l}</span>)}
    </At>
  );
}

export function StyleScene({ local, stickersReady }: SceneProps) {
  const d = reelDocs();
  const look = useStep(local, LOOK_TAPS);
  const tab = useStep(local, [STICKERS_TAB + 80, TEXT_TAB + 80]);
  const dropped = useStep(local, [STAR_DROP]) > 0;
  const pressed = useStep(local, [STAR_PRESS]) > 0;
  const sizeStep = useStep(local, d.textAt.sizes.slice(1).map((_, i) => HANDLE_PRESS + 80 + ((i + 1) * (HANDLE_END - HANDLE_PRESS - 80)) / (d.textAt.sizes.length - 1)));
  const hasText = tab >= 2;
  const doc = hasText && stickersReady ? d.textSteps[sizeStep] : dropped && stickersReady ? d.withSticker : d.looks[look].doc;
  const g = editGeom(doc);
  const star = g.at(d.stickerAt.x, d.stickerAt.y);
  const starSize = d.stickerAt.size * g.s;
  const textItem = (s: number) => d.textSteps[Math.min(d.textSteps.length - 1, d.textAt.sizes.indexOf(s))].items[2];
  const tb0 = itemBox(textItem(d.textAt.sizes[0]));
  const tb1 = itemBox(textItem(d.textAt.sizes[d.textAt.sizes.length - 1]));
  const tc = g.at(d.textAt.x, d.textAt.y);
  const handle0 = { x: tc.x + (tb0.w / 2) * g.s, y: tc.y + (tb0.h / 2) * g.s };
  const handle1 = { x: tc.x + (tb1.w / 2) * g.s, y: tc.y + (tb1.h / 2) * g.s };
  const selW = useKf(local, [[HANDLE_PRESS + 80, tb0.w * g.s], [HANDLE_END, tb1.w * g.s]]);
  const selH = useKf(local, [[HANDLE_PRESS + 80, tb0.h * g.s], [HANDLE_END, tb1.h * g.s]]);
  const selOp = useKf(local, [[TEXT_TAB + 150, 0], [TEXT_TAB + 350, 1]]);
  const sel = { width: useTransform(selW, cq), height: useTransform(selH, cq), x: useTransform(selW, (w) => cq(-w / 2)), y: useTransform(selH, (h) => cq(-h / 2)), opacity: selOp };
  const tray = TRAY_TILE(0);
  const trayC = { x: tray.x + tray.w / 2, y: tray.y + tray.h / 2 };
  const dragX = useKf(local, [[STAR_PRESS + 60, trayC.x], [STAR_DROP, star.x]]);
  const dragY = useKf(local, [[STAR_PRESS + 60, trayC.y], [STAR_DROP, star.y]]);
  const dragS = useKf(local, [[STAR_PRESS + 60, tray.w * 0.8], [STAR_DROP, starSize]]);
  const dragOp = useTransform(local, (v) => (v < STAR_PRESS || v >= STAR_DROP + 40 ? 0 : 1));
  const drag = { left: useTransform(dragX, cq), top: useTransform(dragY, cq), width: useTransform(dragS, cq), height: useTransform(dragS, cq), x: '-50%', y: '-50%', opacity: dragOp, rotate: d.stickerAt.rot };
  const filmIn = useEnter(local, 0, 8);
  const panelIn = useEnter(local, 200, 8);
  const lookPress = usePress(local, LOOK_TAPS, 0.06);
  const bump = useTransform(local, (v) => 1 + 0.025 * (pulse(v - STAR_DROP, 340) + LOOK_TAPS.reduce((m, t) => Math.max(m, pulse(v - t, 300)), 0)));
  const labels = ['Original', ...d.looks.slice(1).map((l) => l.name)];
  const now = tab === 0 ? { k: 'Look', l: labels[look] } : tab === 1 ? { k: 'Sticker', l: pressed ? 'Chrome star' : 'Shapes' } : { k: 'Text', l: sizeStep > 0 ? 'Resize' : 'Best night' };
  return (
    <div className="absolute inset-0">
      <At {...EDIT_FILM} style={{ ...filmIn, scale: bump }}>
        <FilmCanvas doc={doc} label="Film strip">
          {(ppm) => ppm > 0 && <Burst local={local} start={STAR_DROP} x={d.stickerAt.x * ppm} y={d.stickerAt.y * ppm} />}
        </FilmCanvas>
      </At>
      {stickersReady && (
        <motion.div className="absolute" style={{ left: cq(tc.x), top: cq(tc.y), rotate: d.textAt.rot }}>
          <motion.span className="reel-sel" style={sel}>
            <i className="reel-sel-h" />
          </motion.span>
        </motion.div>
      )}
      <motion.div className="absolute inset-0" style={panelIn}>
        <At {...PANEL} className="reel-app" />
        <PanelTabs local={local} labels={['Looks', 'Stickers', 'Text']} active={tab} moves={[[STICKERS_TAB + 40, 0], [STICKERS_TAB + 340, 1], [TEXT_TAB + 40, 1], [TEXT_TAB + 340, 2]]} />
        {tab === 0 && d.looks.map((l, i) => {
          const t = LOOK_TILE(i);
          return (
            <At key={l.id} x={t.x} y={t.y} w={t.w} h={t.h + 6} style={i === look ? { scale: lookPress } : undefined}>
              <div className="reel-tile" data-on={i === look ? '' : undefined} style={{ height: cq(t.h) }}>
                <FilmCanvas doc={l.thumb} label={`${l.name} look`} />
              </div>
              <span className="reel-tile-name">{labels[i]}</span>
            </At>
          );
        })}
        {tab === 1 && (
          <>
            {TRAY.map((s, i) => {
              const t = TRAY_TILE(i);
              return (
                <At key={s.id} {...t} className="reel-tile p-[1.6cqw]" style={i === 0 && dropped ? { opacity: 0.45 } : undefined}>
                  <StickerGlyph id={s.id} tint={s.tint} ready={stickersReady} />
                </At>
              );
            })}
            <At x={50.5} y={53} w={42} h={7} className="flex gap-[1.4cqw]">
              <span className="reel-pill" data-on="">Shapes</span>
              <span className="reel-pill">Emoji</span>
              <span className="reel-pill">Icons</span>
            </At>
            <At x={50.5} y={65} w={42} h={20} className="reel-hintbox">Drag onto your film</At>
          </>
        )}
        {tab === 2 && (
          <>
            <At x={50.5} y={20} w={41} h={9} className="reel-field">BEST NIGHT<i className="reel-caret" /></At>
            <At x={50.5} y={33} w={42} h={7} className="flex gap-[1.4cqw]">
              <span className="reel-pill" data-on="">Bold</span>
              <span className="reel-pill">Serif</span>
              <span className="reel-pill">Script</span>
            </At>
            <At x={50.5} y={45} w={42} h={7} className="flex items-center gap-[1.8cqw]">
              {['#14121F', '#FFFFFF', '#FF5C7A', '#C6F432', '#9FD3FF'].map((c, i) => <span key={c} className="reel-sw" data-on={i === 0 ? '' : undefined} style={{ background: c }} />)}
            </At>
            <At x={50.5} y={58} w={42} h={20} className="reel-hintbox">Drag the corner to resize</At>
          </>
        )}
      </motion.div>
      <NowLabel kicker={now.k} label={now.l} />
      <motion.div className="pointer-events-none absolute" style={drag}>
        <StickerGlyph id={TRAY[0].id} tint={TRAY[0].tint} ready={stickersReady} />
      </motion.div>
      <Touch
        local={local}
        path={[
          { t: 550, x: 94, y: 100 },
          ...LOOK_TAPS.flatMap((t, k) => {
            const tile = LOOK_TILE(k + 1);
            const c = { x: tile.x + tile.w / 2, y: tile.y + tile.h / 2 };
            return [{ t: t - 280, ...c }, { t, ...c, tap: true }, { t: t + 500, ...c }];
          }),
          { t: STICKERS_TAB - 300, x: TAB_CX[1], y: PANEL.y + 6.75 },
          { t: STICKERS_TAB, x: TAB_CX[1], y: PANEL.y + 6.75, tap: true },
          { t: STAR_PRESS - 320, x: TAB_CX[1], y: PANEL.y + 6.75 },
          { t: STAR_PRESS - 60, ...trayC },
          { t: STAR_PRESS, ...trayC, tap: true },
          { t: STAR_DROP, ...star },
          { t: STAR_DROP + 150, ...star },
          { t: TEXT_TAB - 120, x: TAB_CX[2], y: PANEL.y + 6.75 },
          { t: TEXT_TAB, x: TAB_CX[2], y: PANEL.y + 6.75, tap: true },
          { t: HANDLE_PRESS - 300, x: TAB_CX[2], y: PANEL.y + 6.75 },
          { t: HANDLE_PRESS - 40, ...handle0 },
          { t: HANDLE_PRESS, ...handle0, tap: true },
          { t: HANDLE_END, ...handle1 },
          { t: HANDLE_END + 250, ...handle1 },
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ 4. Frames, colours, details */

const STYLE_TAPS = [900, 2050];
const COLOUR_TAPS = [3150, 4200];
const WIDGET_TAP = 5200;
const LEAK_TAP = 6200;
const FTILE = (i: number) => ({ x: 50.5 + i * 10.7, y: 15, w: 9.3, h: 11 });
const SWATCH = (i: number) => ({ x: 50.5 + i * 7.1, y: 36.5, w: 6, h: 6 });
const DETAIL = [{ x: 50.5, y: 54, w: 21, h: 7, label: 'Date stamp' }, { x: 72.5, y: 54, w: 19.5, h: 7, label: 'Ticket' }];
const LEAKS = [{ x: 50.5, y: 72, w: 20, h: 7, label: 'Amber leak' }, { x: 71.5, y: 72, w: 20.5, h: 7, label: 'Bokeh' }];
const centre = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

export function FrameScene({ local }: SceneProps) {
  const d = reelDocs();
  const step = useStep(local, [...STYLE_TAPS, ...COLOUR_TAPS, WIDGET_TAP]);
  const doc = step <= 4 ? d.frameSteps[step] : d.withWidget;
  const leak = useKf(local, [[LEAK_TAP + 60, 0], [LEAK_TAP + 900, 1]], (t) => t);
  const styleOn = step === 0 ? 0 : step === 1 ? 1 : 2;
  const swatchOn = step < 3 ? 1 : step === 3 ? 2 : 3;
  const leakOn = useStep(local, [LEAK_TAP]) > 0;
  const g = editGeom(doc);
  const stamp = g.at(33, 129);
  const filmIn = useEnter(local, 0, 8);
  const panelIn = useEnter(local, 200, 8);
  const press = usePress(local, [...STYLE_TAPS, ...COLOUR_TAPS, WIDGET_TAP, LEAK_TAP], 0.08);
  const bump = useTransform(local, (v) => 1 + 0.025 * [...STYLE_TAPS, ...COLOUR_TAPS, WIDGET_TAP].reduce((m, t) => Math.max(m, pulse(v - t, 320)), 0));
  const NAMES = ['Plain', 'Polka dots', 'Graph paper', 'Sky blue', 'Sunshine', 'Date stamp'];
  const now = leakOn ? { k: 'Light', l: 'Amber leak' } : { k: step <= 2 ? 'Frame' : step <= 4 ? 'Colour' : 'Detail', l: NAMES[step] };
  const tapAt = (t: number, r: { x: number; y: number; w: number; h: number }, from?: { x: number; y: number }) => {
    const c = centre(r);
    return [...(from ? [{ t: t - 300, ...from }] : []), { t: t - 260, ...c }, { t, ...c, tap: true }, { t: t + 450, ...c }];
  };
  return (
    <div className="absolute inset-0">
      <At {...EDIT_FILM} style={{ ...filmIn, scale: bump }}>
        <div className="relative h-full w-full">
          <div className="absolute inset-0"><FilmCanvas doc={doc} label="Film strip" /></div>
          <motion.div className="absolute inset-0" style={{ opacity: leak }}><FilmCanvas doc={d.withLeak} label="Film strip with a light leak" /></motion.div>
        </div>
      </At>
      <div className="pointer-events-none absolute" style={{ left: cq(stamp.x), top: cq(stamp.y) }}>
        <Burst local={local} start={WIDGET_TAP} x={0} y={0} reach={40} />
      </div>
      <motion.div className="absolute inset-0" style={panelIn}>
        <At {...PANEL} className="reel-app" />
        <At x={50.5} y={10.5} w={40} h={4} className="reel-sect">Frame</At>
        {d.frameTiles.map((f, i) => (
          <At key={f.id} {...FTILE(i)} className={`reel-ft reel-ft-${f.id}`} style={i === styleOn && step <= 2 && step > 0 ? { scale: press } : undefined}>
            <span data-on={i === styleOn ? '' : undefined} className="reel-ft-ring" />
          </At>
        ))}
        <At x={50.5} y={31} w={40} h={4} className="reel-sect">Colour</At>
        {d.swatches.map((c, i) => (
          <At key={c} {...SWATCH(i)} className="reel-sw" style={{ background: c, ...(i === swatchOn && step >= 3 && step <= 4 ? { scale: press } : {}) }}>
            <span data-on={i === swatchOn ? '' : undefined} className="reel-sw-ring" />
          </At>
        ))}
        <At x={50.5} y={49} w={40} h={4} className="reel-sect">Details</At>
        {DETAIL.map((c, i) => (
          <At key={c.label} {...c} className="reel-pill reel-pill-box" style={i === 0 && step === 5 && !leakOn ? { scale: press } : undefined}>
            <span data-on={i === 0 && step === 5 ? '' : undefined}>{c.label}</span>
          </At>
        ))}
        <At x={50.5} y={67} w={40} h={4} className="reel-sect">Light</At>
        {LEAKS.map((c, i) => (
          <At key={c.label} {...c} className="reel-pill reel-pill-box" style={i === 0 && leakOn ? { scale: press } : undefined}>
            <span data-on={i === 0 && leakOn ? '' : undefined}>{c.label}</span>
          </At>
        ))}
        <At x={50.5} y={84} w={41} h={2.6} className="reel-meter">
          <motion.i style={{ scaleX: useTransform(leak, (v) => 0.15 + 0.7 * v) }} />
        </At>
      </motion.div>
      <NowLabel kicker={now.k} label={now.l} />
      <Touch
        local={local}
        path={[
          { t: 450, x: 94, y: 100 },
          ...tapAt(STYLE_TAPS[0], FTILE(1)),
          ...tapAt(STYLE_TAPS[1], FTILE(2)),
          ...tapAt(COLOUR_TAPS[0], SWATCH(2)),
          ...tapAt(COLOUR_TAPS[1], SWATCH(3)),
          ...tapAt(WIDGET_TAP, DETAIL[0]),
          ...tapAt(LEAK_TAP, LEAKS[0]),
          { t: LEAK_TAP + 800, x: 80, y: 96 },
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ 5. Save. Print. Share. */

const PRINT_TAP = 1600;
const SHEET_OUT = 2050;
const FEED = [2250, 3950];
const SHARE_IN = 4750;
const SAVE_TAP = 6150;
export const START_AT = 6500;

/** a decorative QR-style code: three finder squares and a fixed pseudo-random fill (it encodes nothing) */
function QrArt() {
  const cells = useMemo(() => {
    const n = 25;
    let seed = 0x2f6b1d;
    const rnd = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return ((seed >>> 0) % 1000) / 1000;
    };
    const finder = (x: number, y: number) => [[0, 0, 7, 7], [1, 1, 5, 5], [2, 2, 3, 3]].map(([dx, dy, w], k) => ({ x: x + dx, y: y + dy, w, fill: k !== 1 }));
    const zone = (x: number, y: number) => (x < 8 && y < 8) || (x >= n - 8 && y < 8) || (x < 8 && y >= n - 8);
    const out: string[] = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!zone(x, y) && rnd() > 0.52) out.push(`M${x} ${y}h1v1h-1z`);
    return { n, d: out.join(''), finders: [...finder(0, 0), ...finder(n - 7, 0), ...finder(0, n - 7)] };
  }, []);
  return (
    <svg viewBox={`-1 -1 ${cells.n + 2} ${cells.n + 2}`} className="block h-full w-full" shapeRendering="crispEdges" aria-hidden>
      <rect x={-1} y={-1} width={cells.n + 2} height={cells.n + 2} fill="#ffffff" />
      {cells.finders.map((f, i) => <rect key={i} x={f.x} y={f.y} width={f.w} height={f.w} fill={f.fill ? '#14121f' : '#ffffff'} />)}
      <path d={cells.d} fill="#14121f" />
    </svg>
  );
}

const TARGETS = [
  { label: 'Nearby', icon: <Radio aria-hidden className="reel-ico" /> },
  { label: 'Messages', icon: <MessageCircle aria-hidden className="reel-ico" /> },
  { label: 'Mail', icon: <Mail aria-hidden className="reel-ico" /> },
  { label: 'Save', icon: <Download aria-hidden className="reel-ico" /> },
];

export function SaveScene({ local, stickersReady }: SceneProps) {
  const d = reelDocs();
  const doc = stickersReady ? d.finale : d.looks[3].doc;
  const sheetY = useKf(local, [[250, 62], [800, 0], [SHEET_OUT, 0], [SHEET_OUT + 450, 62]], easeOutCubic);
  const preview = useKf(local, [[100, 0], [500, 1], [SHEET_OUT, 1], [SHEET_OUT + 300, 0]]);
  const printPress = usePress(local, [PRINT_TAP], 0.05);
  const slotOp = useKf(local, [[SHEET_OUT, 0], [SHEET_OUT + 250, 1], [SHARE_IN, 1], [SHARE_IN + 300, 0]]);
  const feed = useProgress(local, FEED[0], FEED[1] - FEED[0], steps(20));
  const feedY = useTransform(feed, (v) => `${(v - 1) * 100}%`);
  const shrink = useProgress(local, SHARE_IN - 100, 650, easeInOutCubic);
  const groupX = useTransform(shrink, (v) => cq(-25 * v));
  const groupS = useTransform(shrink, (v) => 1 - 0.45 * v);
  const dpi = useSpringProgress(local, FEED[1] - 100, 320, 20);
  const dpiS = useTransform(dpi, (v) => Math.max(0, v));
  const dpiOp = useTransform([dpi, shrink] as MotionValue[], ([v, s]: number[]) => clamp01(v) * (1 - s));
  const shareY = useKf(local, [[SHARE_IN, 70], [SHARE_IN + 550, 0]], easeOutCubic);
  const qr = useSpringProgress(local, SHARE_IN + 450, 240, 24);
  const qrS = useTransform(qr, (v) => 0.85 + 0.15 * v);
  const qrOp = useTransform(qr, (v) => clamp01(v * 1.6));
  const savePress = usePress(local, [SAVE_TAP], 0.12);
  const saved = useStep(local, [SAVE_TAP + 100]) > 0;
  const SB = { x: 4, y: 73, w: 92, h: 54 };
  const SH = { x: 4, y: 69, w: 92, h: 58 };
  return (
    <div className="absolute inset-0">
      <At x={30} y={6} w={40} h={62} style={{ opacity: preview }}>
        <FilmCanvas doc={doc} label="Finished film strip" />
      </At>
      <motion.div className="absolute inset-0" style={{ x: groupX, scale: groupS, transformOrigin: '50% 4%' }}>
        <At x={22} y={4.5} w={56} h={3} className="reel-slot" style={{ opacity: slotOp }} />
        <At x={33} y={6.5} w={34} h={104} className="overflow-hidden [clip-path:inset(0_-40%_-10%_-40%)]">
          <motion.div className="h-full w-full" style={{ y: feedY }}>
            <FilmCanvas doc={doc} label="Printed film strip" />
          </motion.div>
        </At>
      </motion.div>
      <At x={6} y={56} style={{ scale: dpiS, opacity: dpiOp }}>
        <span className="reel-chip reel-chip-spark"><Printer aria-hidden className="reel-ico" /> 300 DPI</span>
      </At>
      <At x={71} y={34} style={{ scale: dpiS, opacity: dpiOp }}>
        <span className="reel-chip" data-on="">2 × 6 in</span>
      </At>
      <At {...SB} className="reel-sheet" style={{ y: useTransform(sheetY, cq) }}>
        <span className="reel-grab" />
        <span className="reel-sheet-title" style={{ top: cq(4.5) }}>Export</span>
        <span className="reel-sheet-meta" style={{ top: cq(11) }}>PNG · 300 DPI · ready to print</span>
        <At x={5} y={18} w={39} h={12} className="reel-btn2"><Share2 aria-hidden className="reel-ico" /> Share</At>
        <At x={47} y={18} w={40} h={12} className="reel-btn1" style={{ scale: printPress }}><Printer aria-hidden className="reel-ico" /> Print 300 DPI</At>
        <At x={5} y={33.5} w={82} h={9} className="reel-row"><Download aria-hidden className="reel-ico" /> Save to device</At>
      </At>
      <At x={50} y={9} w={44} h={52} className="reel-qr" style={{ scale: qrS, opacity: qrOp }}>
        <span className="reel-qr-code"><QrArt /></span>
        <span className="reel-qr-cap">Scan to get your film</span>
      </At>
      <At {...SH} className="reel-sheet" style={{ y: useTransform(shareY, cq) }}>
        <span className="reel-grab" />
        <span className="reel-sheet-title" style={{ top: cq(4.5) }}>Share</span>
        {TARGETS.map((t, i) => (
          <At key={t.label} x={4 + i * 21.5} y={13} w={19} h={22} className="reel-target" style={i === 3 ? { scale: savePress } : undefined}>
            <span className="reel-target-ic" data-on={i === 3 && saved ? '' : undefined}>{i === 3 && saved ? <Check aria-hidden className="reel-ico" strokeWidth={3} /> : t.icon}</span>
            <span className="reel-target-l">{i === 3 && saved ? 'Saved' : t.label}</span>
          </At>
        ))}
        <At x={5} y={38} w={82} h={9} className="reel-row"><Sparkles aria-hidden className="reel-ico" /> Your film never leaves this device</At>
      </At>
      <Touch
        local={local}
        path={[
          { t: 950, x: 88, y: 118 },
          { t: PRINT_TAP - 150, x: 71, y: SB.y + 24 },
          { t: PRINT_TAP, x: 71, y: SB.y + 24, tap: true },
          { t: SHEET_OUT + 300, x: 80, y: 120 },
        ]}
      />
      <Touch
        local={local}
        path={[
          { t: SHARE_IN + 700, x: 94, y: 122 },
          { t: SAVE_TAP - 220, x: SH.x + 4 + 3 * 21.5 + 9.5, y: SH.y + 20 },
          { t: SAVE_TAP, x: SH.x + 4 + 3 * 21.5 + 9.5, y: SH.y + 20, tap: true },
          { t: SAVE_TAP + 650, x: 90, y: 122 },
        ]}
      />
    </div>
  );
}

export const SCENE_VIEWS = [PickScene, SnapScene, StyleScene, FrameScene, SaveScene];
