/**
 * Photographic overlays (light leaks, grain, dust, bokeh, weather ...) drawn with plain Canvas2D.
 *
 * Everything is resolution independent: layout is expressed in the area's normalised coordinates
 * and physical sizes in millimetres (px = mm * ppm), and every random choice comes from a seeded
 * PRNG so a preview and a 300 DPI export look the same.
 */

export type OverlayFamily = 'light' | 'texture' | 'weather' | 'glow';
export interface OverlayDef {
  id: string;
  name: string;
  family: OverlayFamily;
}

export const OVERLAYS: OverlayDef[] = [
  { id: 'leak-amber', name: 'Amber leak', family: 'light' },
  { id: 'leak-rose', name: 'Rose leak', family: 'light' },
  { id: 'leak-prism', name: 'Prism leak', family: 'light' },
  { id: 'leak-teal', name: 'Teal leak', family: 'light' },
  { id: 'film-burn', name: 'Film burn', family: 'light' },
  { id: 'grain-fine', name: 'Fine grain', family: 'texture' },
  { id: 'grain-coarse', name: 'Coarse grain', family: 'texture' },
  { id: 'dust', name: 'Dust', family: 'texture' },
  { id: 'scratches', name: 'Scratches', family: 'texture' },
  { id: 'paper', name: 'Paper', family: 'texture' },
  { id: 'halftone-dots', name: 'Halftone', family: 'texture' },
  { id: 'bokeh', name: 'Bokeh', family: 'glow' },
  { id: 'flare', name: 'Lens flare', family: 'glow' },
  { id: 'sun-rays', name: 'Sun rays', family: 'glow' },
  { id: 'glow-soft', name: 'Soft glow', family: 'glow' },
  { id: 'fog', name: 'Fog', family: 'weather' },
  { id: 'rain', name: 'Rain', family: 'weather' },
  { id: 'snow', name: 'Snow', family: 'weather' },
  { id: 'sparkle', name: 'Sparkle', family: 'weather' },
];

type Area = { x: number; y: number; w: number; h: number };
type RGB = readonly [number, number, number];
type Rng = () => number;

// ---------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------

const TAU = Math.PI * 2;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);

function mulberry32(seed: number): Rng {
  let a = (Math.floor(Number.isFinite(seed) ? seed : 0) ^ 0x9e3779b9) | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h | 0;
}

const rgba = (c: RGB, a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp01(a).toFixed(3)})`;

/** Smooth (zero-slope) falloff stops: strong in the centre, exactly transparent at the rim. */
function falloff(c: RGB, a: number, steps = 8): [number, string][] {
  const out: [number, string][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    out.push([t, rgba(c, i === steps ? 0 : a * (1 - smooth(t)))]);
  }
  return out;
}

/** Soft anisotropic blob: radial gradient scaled to an ellipse and rotated. */
function blob(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rot: number,
  stops: [number, string][],
) {
  if (!(rx > 0.2) || !(ry > 0.2)) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

function newCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

// scratch layer for effects that need masking (sun rays)
let layerCv: HTMLCanvasElement | null = null;
function layer(w: number, h: number): CanvasRenderingContext2D | null {
  const W = Math.max(1, Math.ceil(w));
  const H = Math.max(1, Math.ceil(h));
  layerCv ??= document.createElement('canvas');
  if (layerCv.width !== W || layerCv.height !== H) {
    layerCv.width = W;
    layerCv.height = H;
  }
  const c = layerCv.getContext('2d');
  if (!c) return null;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
  c.clearRect(0, 0, W, H);
  return c;
}

/** Seamless value-noise field in 0..1 (period = size). */
function periodicNoise(size: number, cells: number, rand: Rng): Float32Array {
  const lat = new Float32Array(cells * cells);
  for (let i = 0; i < lat.length; i++) lat[i] = rand();
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const fy = (y / size) * cells;
    const iy = Math.floor(fy);
    const ty = smooth(fy - iy);
    const r0 = (iy % cells) * cells;
    const r1 = ((iy + 1) % cells) * cells;
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * cells;
      const ix = Math.floor(fx);
      const tx = smooth(fx - ix);
      const x0 = ix % cells;
      const x1 = (ix + 1) % cells;
      out[y * size + x] = lerp(lerp(lat[r0 + x0], lat[r0 + x1], tx), lerp(lat[r1 + x0], lat[r1 + x1], tx), ty);
    }
  }
  return out;
}

function fbm(size: number, baseCells: number, octaves: number, rand: Rng): Float32Array {
  const out = new Float32Array(size * size);
  let amp = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const n = periodicNoise(size, baseCells << o, rand);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
    norm += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= norm;
  return out;
}

function makeTile(size: number, fill: (px: Uint8ClampedArray) => void): HTMLCanvasElement {
  const c = newCanvas(size, size);
  const x = c.getContext('2d');
  if (!x) return c;
  const img = x.createImageData(size, size);
  fill(img.data);
  x.putImageData(img, 0, 0);
  return c;
}

// ---------------------------------------------------------------------------------------------
// cached tiles (created lazily, shared by every call)
// ---------------------------------------------------------------------------------------------

let grainTileCv: HTMLCanvasElement | null = null;
/** gaussian-ish grey noise centred on 128, neutral under 'overlay' */
function grainTile() {
  return (grainTileCv ??= makeTile(256, (d) => {
    const r = mulberry32(1337);
    for (let i = 0; i < d.length; i += 4) {
      const g = (r() + r() + r() - 1.5) / 1.5; // -1..1, bell shaped
      const v = 128 + g * 120;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
  }));
}

let blotchTileCv: HTMLCanvasElement | null = null;
/** grain with clumps (two octaves) for the coarse look */
function blotchTile() {
  return (blotchTileCv ??= makeTile(256, (d) => {
    const r = mulberry32(4242);
    const lo = periodicNoise(256, 64, r);
    const mid = periodicNoise(256, 128, r);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const g = (r() + r() - 1) * 0.9 + (lo[p] - 0.5) * 0.55 + (mid[p] - 0.5) * 0.7;
      const v = 128 + Math.max(-1, Math.min(1, g)) * 125;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
  }));
}

let fogTileCv: HTMLCanvasElement | null = null;
function fogTile() {
  return (fogTileCv ??= makeTile(256, (d) => {
    const n = fbm(256, 3, 5, mulberry32(777));
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const v = smooth(clamp01((n[p] - 0.34) / 0.42)) * 255;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
  }));
}

let paperTileCv: HTMLCanvasElement | null = null;
function paperTile() {
  if (paperTileCv) return paperTileCv;
  const S = 384;
  const r = mulberry32(2024);
  const mott = fbm(S, 6, 4, r);
  const fine = periodicNoise(S, 192, r);
  const c = makeTile(S, (d) => {
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const v = 128 + (mott[p] - 0.5) * 70 + (fine[p] - 0.5) * 40;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
  });
  const x = c.getContext('2d');
  if (x) {
    x.lineCap = 'round';
    for (let k = 0; k < 520; k++) {
      const px = r() * S;
      const py = r() * S;
      const len = 4 + r() * 16;
      const ang = r() * TAU;
      const bend = (r() - 0.5) * 8;
      const light = r() < 0.55;
      x.strokeStyle = light ? 'rgba(255,255,255,0.20)' : 'rgba(70,55,40,0.16)';
      x.lineWidth = 0.6 + r() * 0.7;
      for (const ox of [-S, 0, S]) {
        for (const oy of [-S, 0, S]) {
          x.beginPath();
          x.moveTo(px + ox, py + oy);
          x.quadraticCurveTo(
            px + ox + Math.cos(ang) * len * 0.5 - Math.sin(ang) * bend,
            py + oy + Math.sin(ang) * len * 0.5 + Math.cos(ang) * bend,
            px + ox + Math.cos(ang) * len,
            py + oy + Math.sin(ang) * len,
          );
          x.stroke();
        }
      }
    }
  }
  return (paperTileCv = c);
}

function tileFill(
  ctx: CanvasRenderingContext2D,
  tile: HTMLCanvasElement,
  a: Area,
  scale: number,
  rand: Rng,
  comp: GlobalCompositeOperation,
  alpha: number,
) {
  const pat = ctx.createPattern(tile, 'repeat');
  if (!pat) return;
  const s = Math.max(0.05, scale);
  const ox = rand() * tile.width;
  const oy = rand() * tile.height;
  ctx.save();
  ctx.globalCompositeOperation = comp;
  ctx.globalAlpha = clamp01(alpha);
  ctx.translate(a.x, a.y);
  ctx.scale(s, s);
  ctx.translate(-ox, -oy);
  ctx.fillStyle = pat;
  ctx.fillRect(ox, oy, a.w / s + 1, a.h / s + 1);
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// light leaks
// ---------------------------------------------------------------------------------------------

/** Move the origin to an edge anchor with +x pointing into the area; returns edge/depth extents. */
function edgeFrame(ctx: CanvasRenderingContext2D, a: Area, side: number, t: number) {
  const horizontalEdge = side >= 2;
  if (side === 0) {
    ctx.translate(a.x, a.y + t * a.h);
  } else if (side === 1) {
    ctx.translate(a.x + a.w, a.y + t * a.h);
    ctx.rotate(Math.PI);
  } else if (side === 2) {
    ctx.translate(a.x + t * a.w, a.y);
    ctx.rotate(Math.PI / 2);
  } else {
    ctx.translate(a.x + t * a.w, a.y + a.h);
    ctx.rotate(-Math.PI / 2);
  }
  return { E: horizontalEdge ? a.w : a.h, D: horizontalEdge ? a.h : a.w };
}

interface LeakLayer {
  c: RGB;
  /** size relative to max(w,h) */
  s: number;
  a: number;
}

function leaks(ctx: CanvasRenderingContext2D, a: Area, r: Rng, op: number, layers: LeakLayer[], second: RGB) {
  const sides = [0, 1, 2, 3];
  const first = Math.floor(r() * 4);
  const picks = [first, sides.filter((s) => s !== first)[Math.floor(r() * 3)]];
  picks.forEach((side, k) => {
    ctx.save();
    const { E } = edgeFrame(ctx, a, side, 0.15 + r() * 0.7);
    const size = Math.max(a.w, a.h) * (k === 0 ? 1 : 0.55);
    const tilt = (r() - 0.5) * 0.5;
    ctx.globalAlpha = op * (k === 0 ? 1 : 0.7);
    for (const L of layers) {
      const c = k === 0 ? L.c : second;
      blob(ctx, -size * 0.04, (r() - 0.5) * E * 0.2, size * L.s * (0.9 + 0.3 * r()), size * L.s * (0.75 + 0.35 * r()), tilt, falloff(c, L.a));
    }
    // streaks fanning out of the edge
    const nStreak = 3 + Math.floor(r() * 2);
    for (let i = 0; i < nStreak; i++) {
      const y = (r() - 0.5) * E * 0.6;
      const L = layers[1 + Math.floor(r() * (layers.length - 1))];
      blob(ctx, 0, y, size * (0.3 + 0.4 * r()), size * (0.06 + 0.09 * r()), (r() - 0.5) * 0.5, falloff(k === 0 ? L.c : second, 0.22 + 0.2 * r()));
    }
    // blown rim right on the edge
    blob(ctx, 0, 0, size * 0.09, E * 0.55, 0, falloff(layers[layers.length - 1].c, 0.6));
    ctx.restore();
  });
}

function leakAmber(ctx: CanvasRenderingContext2D, a: Area, r: Rng, op: number) {
  leaks(
    ctx, a, r, op,
    [
      { c: [255, 70, 20], s: 1.05, a: 0.7 },
      { c: [255, 140, 30], s: 0.8, a: 0.9 },
      { c: [255, 205, 90], s: 0.46, a: 0.95 },
      { c: [255, 246, 220], s: 0.17, a: 0.85 },
    ],
    [255, 120, 30],
  );
}

function leakRose(ctx: CanvasRenderingContext2D, a: Area, r: Rng, op: number) {
  leaks(
    ctx, a, r, op,
    [
      { c: [170, 60, 220], s: 1.1, a: 0.6 },
      { c: [255, 60, 140], s: 0.8, a: 0.9 },
      { c: [255, 145, 185], s: 0.46, a: 0.9 },
      { c: [255, 226, 236], s: 0.17, a: 0.8 },
    ],
    [255, 90, 160],
  );
}

function leakTeal(ctx: CanvasRenderingContext2D, a: Area, r: Rng, op: number) {
  leaks(
    ctx, a, r, op,
    [
      { c: [30, 60, 230], s: 1.1, a: 0.65 },
      { c: [10, 190, 210], s: 0.8, a: 0.9 },
      { c: [110, 245, 225], s: 0.46, a: 0.9 },
      { c: [225, 255, 250], s: 0.16, a: 0.75 },
    ],
    [30, 200, 190],
  );
}

function leakPrism(ctx: CanvasRenderingContext2D, a: Area, r: Rng, op: number) {
  const hues: RGB[] = [
    [255, 40, 60],
    [255, 140, 30],
    [255, 235, 70],
    [60, 235, 110],
    [40, 200, 255],
    [70, 90, 255],
    [190, 80, 255],
  ];
  const side = Math.floor(r() * 4);
  ctx.save();
  const { E, D } = edgeFrame(ctx, a, side, 0.25 + r() * 0.5);
  ctx.globalAlpha = op;
  const tilt = (r() - 0.5) * 0.7;
  const span = Math.max(D, E) * 0.55;
  const ry = Math.max(D, E) * (0.5 + 0.2 * r());
  hues.forEach((c, i) => {
    const x = (i / (hues.length - 1)) * span * 0.9 - span * 0.1;
    blob(ctx, x, 0, span * 0.34, ry, tilt, falloff(c, 0.62));
  });
  // thin bright crisp edge band, like light through a prism
  ctx.rotate(tilt);
  const band = ctx.createLinearGradient(0, 0, span * 0.5, 0);
  hues.forEach((c, i) => band.addColorStop(i / (hues.length - 1), rgba(c, 0.22 * (1 - i / hues.length * 0.5))));
  ctx.fillStyle = band;
  ctx.fillRect(-4, -ry * 0.8, span * 0.5, ry * 1.6);
  ctx.restore();
  // a faint warm wash on the opposite side keeps it from looking synthetic
  ctx.save();
  ctx.globalAlpha = op * 0.5;
  const opp = (side + 1 + Math.floor(r() * 2) * 1) % 4;
  edgeFrame(ctx, a, opp === side ? (side + 2) % 4 : opp, r());
  blob(ctx, 0, 0, Math.max(a.w, a.h) * 0.35, Math.max(a.w, a.h) * 0.4, 0, falloff([255, 170, 120], 0.45));
  ctx.restore();
}

/** sum of sines: cheap deterministic 1-D noise in 0..1 */
function sineNoise(r: Rng, n = 5) {
  const comps = Array.from({ length: n }, (_, i) => ({ f: (1 + i * 1.7 + r()) , p: r() * TAU, a: 1 / (1 + i * 0.9) }));
  const norm = comps.reduce((s, c) => s + c.a, 0);
  return (t: number) => 0.5 + (0.5 * comps.reduce((s, c) => s + c.a * Math.sin(t * c.f * TAU + c.p), 0)) / norm;
}

function filmBurn(ctx: CanvasRenderingContext2D, a: Area, r: Rng, op: number) {
  const side = Math.floor(r() * 4);
  ctx.save();
  const { E, D } = edgeFrame(ctx, a, side, 0.5);
  ctx.globalAlpha = op;
  const wide = sineNoise(r, 3);
  const base = D * (0.3 + 0.12 * r());
  const steps = Math.max(30, Math.min(200, Math.round(E / 4)));
  // ramp from the blown-out edge (white) through yellow, orange, red to a dark brick fringe
  const ramp: { c: RGB; k: number; a: number }[] = [
    { c: [90, 12, 8], k: 1.45, a: 0.5 },
    { c: [170, 25, 12], k: 1.25, a: 0.5 },
    { c: [225, 50, 15], k: 1.05, a: 0.5 },
    { c: [250, 90, 18], k: 0.88, a: 0.5 },
    { c: [255, 135, 25], k: 0.72, a: 0.5 },
    { c: [255, 178, 50], k: 0.56, a: 0.55 },
    { c: [255, 214, 100], k: 0.42, a: 0.6 },
    { c: [255, 238, 170], k: 0.29, a: 0.7 },
    { c: [255, 252, 232], k: 0.17, a: 0.85 },
  ];
  ramp.forEach((L, li) => {
    const noise = sineNoise(r, 5);
    const depth = base * L.k;
    ctx.beginPath();
    ctx.moveTo(-4, -E);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = (t - 0.5) * E * 1.2;
      const prof = (0.4 + 0.6 * noise(t * 1.8 + li * 0.13)) * (0.4 + 0.6 * wide(t * 1.1));
      ctx.lineTo(depth * (0.2 + 0.8 * prof) + depth * 0.1, y);
    }
    ctx.lineTo(-4, E);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, depth * 1.1, 0);
    g.addColorStop(0, rgba(L.c, L.a));
    g.addColorStop(0.6, rgba(L.c, L.a * 0.55));
    g.addColorStop(1, rgba(L.c, L.a * 0.15));
    ctx.fillStyle = g;
    ctx.fill();
  });
  // soft ember halo past the ragged edge
  blob(ctx, 0, 0, base * 2.4, E * 0.7, 0, falloff([255, 90, 25], 0.5));
  blob(ctx, 0, 0, base * 1.2, E * 0.5, 0, falloff([255, 200, 110], 0.5));
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// textures
// ---------------------------------------------------------------------------------------------

function grain(ctx: CanvasRenderingContext2D, a: Area, r: Rng, op: number, ppm: number, coarse: boolean) {
  if (coarse) {
    tileFill(ctx, blotchTile(), a, Math.max(0.6, ppm * 0.4), r, 'overlay', op * 0.62);
    tileFill(ctx, grainTile(), a, Math.max(0.5, ppm * 0.15), r, 'overlay', op * 0.3);
  } else {
    tileFill(ctx, grainTile(), a, Math.max(0.5, ppm * 0.17), r, 'overlay', op * 0.55);
    tileFill(ctx, grainTile(), a, Math.max(0.5, ppm * 0.09), r, 'soft-light', op * 0.4);
  }
}

function dust(ctx: CanvasRenderingContext2D, a: Area, r: Rng, op: number, ppm: number) {
  const mm2 = (a.w * a.h) / (ppm * ppm);
  const nSpecks = Math.min(520, Math.round(mm2 / 14) + 6);
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = 'rgb(250,246,238)';
  for (let i = 0; i < nSpecks; i++) {
    const x = a.x + r() * a.w;
    const y = a.y + r() * a.h;
    const rad = (0.035 + Math.pow(r(), 3.2) * 0.3) * ppm;
    ctx.globalAlpha = op * (0.35 + 0.6 * r());
    ctx.beginPath();
    if (rad < 1.4 || r() < 0.4) {
      ctx.arc(x, y, Math.max(0.5, rad), 0, TAU);
    } else {
      const n = 5 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const ang = (k / n) * TAU + r() * 0.5;
        const rr = rad * (0.6 + 0.6 * r());
        if (k === 0) ctx.moveTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
        else ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
      }
      ctx.closePath();
    }
    ctx.fill();
  }
  // a few out-of-focus motes
  for (let i = 0; i < 4 + Math.round(mm2 / 700); i++) {
    const R = (0.7 + r() * 1.2) * ppm;
    ctx.globalAlpha = op * (0.35 + 0.35 * r());
    blob(ctx, a.x + r() * a.w, a.y + r() * a.h, R, R, 0, falloff([255, 250, 240], 0.28));
  }
  // hairs and fibres
  const nHair = Math.min(40, 2 + Math.round(mm2 / 260));
  ctx.lineCap = 'round';
  for (let i = 0; i < nHair; i++) {
    const x = a.x + r() * a.w;
    const y = a.y + r() * a.h;
    const len = (1.5 + r() * 5.5) * ppm;
    const ang = r() * TAU;
    const curl = (r() - 0.5) * len * 1.1;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    ctx.globalAlpha = op * (0.4 + 0.45 * r());
    ctx.strokeStyle = 'rgb(246,242,232)';
    ctx.lineWidth = Math.max(0.7, (0.04 + r() * 0.05) * ppm);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(
      x + dx * len * 0.3 - dy * curl,
      y + dy * len * 0.3 + dx * curl,
      x + dx * len * 0.7 + dy * curl * 0.6,
      y + dy * len * 0.7 - dx * curl * 0.6,
      x + dx * len,
      y + dy * len,
    );
    ctx.stroke();
  }
  // faint dark flecks (dirt on the lens)
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgb(30,26,22)';
  for (let i = 0; i < Math.round(nSpecks / 8); i++) {
    ctx.globalAlpha = op * (0.2 + 0.3 * r());
    ctx.beginPath();
    ctx.arc(a.x + r() * a.w, a.y + r() * a.h, Math.max(0.5, (0.04 + r() * 0.1) * ppm), 0, TAU);
    ctx.fill();
  }
}

function scratches(ctx: CanvasRenderingContext2D, a: Area, r: Rng, op: number, ppm: number) {
  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const n = 7 + Math.floor(r() * 5);
  for (let i = 0; i < n; i++) {
    const x0 = a.x + r() * a.w;
    const long = r() < 0.4;
    const y0 = a.y + (long ? r() * a.h * 0.25 : r() * a.h * 0.8);
    const y1 = long ? a.y + a.h * (0.7 + r() * 0.3) : y0 + a.h * (0.1 + r() * 0.3);
    const wob = (0.05 + r() * 0.25) * ppm;
    const steps = 12;
    ctx.globalAlpha = op * (0.25 + 0.6 * r());
    ctx.strokeStyle = r() < 0.7 ? 'rgb(252,248,238)' : 'rgb(255,226,190)';
    ctx.lineWidth = Math.max(0.7, (0.03 + 0.06 * r()) * ppm);
    ctx.beginPath();
    let x = x0;
    for (let k = 0; k <= steps; k++) {
      x += (r() - 0.5) * wob;
      const y = lerp(y0, Math.min(y1, a.y + a.h), k / steps);
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // faint broad vertical wear bands
  for (let i = 0; i < 3; i++) {
    const x = a.x + r() * a.w;
    const w = (0.2 + r() * 0.6) * ppm;
    const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
    g.addColorStop(0, 'rgba(255,250,240,0)');
    g.addColorStop(0.5, 'rgba(255,250,240,0.16)');
    g.addColorStop(1, 'rgba(255,250,240,0)');
    ctx.globalAlpha = op * (0.5 + 0.5 * r());
    ctx.fillStyle = g;
    ctx.fillRect(x - w, a.y, w * 2, a.h);
  }
  // a couple of dark hair-line scratches
  ctx.globalCompositeOperation = 'multiply';
  ctx.strokeStyle = 'rgb(40,34,30)';
  for (let i = 0; i < 2; i++) {
    const x = a.x + r() * a.w;
    ctx.globalAlpha = op * 0.28;
    ctx.lineWidth = Math.max(0.7, 0.04 * ppm);
    ctx.beginPath();
    ctx.moveTo(x, a.y + r() * a.h * 0.3);
    ctx.lineTo(x + (r() - 0.5) * 2 * ppm, a.y + a.h * (0.6 + r() * 0.4));
    ctx.stroke();
  }
}

function paper(ctx: CanvasRenderingContext2D, a: Area, r: Rng, op: number, ppm: number) {
  // warm paper cast, then the tooth: mottling + fibres
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = op * 0.22;
  ctx.fillStyle = 'rgb(255,243,222)';
  ctx.fillRect(a.x, a.y, a.w, a.h);
  tileFill(ctx, paperTile(), a, Math.max(0.5, ppm * 0.24), r, 'overlay', op * 1.0);
  tileFill(ctx, paperTile(), a, Math.max(0.5, ppm * 0.11), r, 'soft-light', op * 0.8);
}

function halftone(ctx: CanvasRenderingContext2D, a: Area, r: Rng, op: number, ppm: number) {
  const pitch = Math.max(3.2, 0.95 * ppm);
  const ang = Math.PI / 4;
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const cx = a.x + a.w / 2;
  const cy = a.y + a.h / 2;
  const half = Math.hypot(a.w, a.h) / 2;
  const dirA = r() * TAU;
  const dx = Math.cos(dirA);
  const dy = Math.sin(dirA);
  const N = Math.ceil(half / pitch) + 1;
  const maxR = pitch * 0.66;
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = op * 0.62;
  ctx.fillStyle = 'rgb(22,20,34)';
  ctx.beginPath();
  for (let j = -N; j <= N; j++) {
    for (let i = -N; i <= N; i++) {
      const lx = i * pitch;
      const ly = j * pitch;
      const x = cx + lx * ca - ly * sa;
      const y = cy + lx * sa + ly * ca;
      if (x < a.x - pitch || x > a.x + a.w + pitch || y < a.y - pitch || y > a.y + a.h + pitch) continue;
      const lin = clamp01(((x - cx) * dx + (y - cy) * dy) / half * 0.5 + 0.5);
      const rad = clamp01(Math.hypot(x - cx, y - cy) / half);
      const f = clamp01(smooth(lin) * 0.7 + smooth(rad) * 0.55 - 0.18);
      const rr = maxR * Math.sqrt(f);
      if (rr < 0.45) continue;
      ctx.moveTo(x + rr, y);
      ctx.arc(x, y, rr, 0, TAU);
    }
  }
  ctx.fill();
}

// ---------------------------------------------------------------------------------------------
// glow / lens
// ---------------------------------------------------------------------------------------------

function bokeh(ctx: CanvasRenderingContext2D, a: Area, r: Rng, op: number, ppm: number) {
  ctx.globalCompositeOperation = 'screen';
  const palette: RGB[] = [
    [255, 244, 224],
    [255, 205, 130],
    [255, 160, 110],
    [255, 190, 215],
    [170, 225, 255],
    [255, 255, 255],
  ];
  const mm2 = (a.w * a.h) / (ppm * ppm);
  const n = Math.max(8, Math.min(26, Math.round(mm2 / 120)));
  // cluster the lights toward one side so it feels like a real out-of-focus background
  const fx = r();
  const fy = r();
  for (let i = 0; i < n; i++) {
    const near = r() < 0.65;
    const x = a.x + (near ? clamp01(fx + (r() - 0.5) * 0.7) : r()) * a.w;
    const y = a.y + (near ? clamp01(fy + (r() - 0.5) * 0.7) : r()) * a.h;
    const R = (1.4 + Math.pow(r(), 1.6) * 5.6) * ppm * Math.min(1.4, Math.max(0.6, Math.sqrt(mm2) / 40));
    const c = palette[Math.floor(r() * palette.length)];
    const k = 0.5 + 0.5 * r();
    ctx.globalAlpha = op * k;
    // a bokeh disc: nearly flat body, brighter rim, crisp-soft edge
    const g = ctx.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, rgba(c, 0.2));
    g.addColorStop(0.72, rgba(c, 0.3));
    g.addColorStop(0.9, rgba(c, 0.5));
    g.addColorStop(0.97, rgba(c, 0.22));
    g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TAU);
    ctx.fill();
  }
}

function polygon(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, sides: number, rot: number) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const t = rot + (i / sides) * TAU;
    if (i === 0) ctx.moveTo(x + Math.cos(t) * R, y + Math.sin(t) * R);
    else ctx.lineTo(x + Math.cos(t) * R, y + Math.sin(t) * R);
  }
  ctx.closePath();
}

function flare(ctx: CanvasRenderingContext2D, a: Area, r: Rng, op: number) {
  ctx.globalCompositeOperation = 'screen';
  const M = Math.max(a.w, a.h);
  // light source near a corner/edge, partly outside the frame
  const corner = Math.floor(r() * 4);
  const sx = a.x + (corner % 2 === 0 ? 0.12 + 0.18 * r() : 0.7 + 0.18 * r()) * a.w;
  const sy = a.y + (corner < 2 ? -0.02 + 0.2 * r() : 0.8 + 0.18 * r()) * a.h;
  const cx = a.x + a.w / 2;
  const cy = a.y + a.h / 2;
  const vx = cx - sx;
  const vy = cy - sy;

  // big haze + hot core
  ctx.globalAlpha = op;
  blob(ctx, sx, sy, M * 0.85, M * 0.85, 0, falloff([255, 170, 90], 0.42));
  blob(ctx, sx, sy, M * 0.4, M * 0.4, 0, falloff([255, 225, 170], 0.7));
  blob(ctx, sx, sy, M * 0.11, M * 0.11, 0, falloff([255, 252, 240], 1));
  // anamorphic streak (cool) and a fainter vertical one
  ctx.save();
  ctx.translate(sx, sy);
  blob(ctx, 0, 0, M * 1.15, M * 0.016, 0, falloff([140, 190, 255], 0.75));
  blob(ctx, 0, 0, M * 0.5, M * 0.006, 0, falloff([255, 255, 255], 0.8));
  blob(ctx, 0, 0, M * 0.012, M * 0.5, 0, falloff([255, 220, 180], 0.3));
  ctx.restore();

  // ghosts along the axis through the frame centre
  const ghosts: { t: number; r: number; c: RGB; k: number; poly: number }[] = [
    { t: 0.38, r: 0.045, c: [255, 120, 80], k: 0.5, poly: 6 },
    { t: 0.62, r: 0.1, c: [120, 255, 190], k: 0.3, poly: 0 },
    { t: 0.95, r: 0.06, c: [140, 150, 255], k: 0.5, poly: 6 },
    { t: 1.3, r: 0.17, c: [255, 190, 110], k: 0.24, poly: 0 },
    { t: 1.55, r: 0.05, c: [255, 120, 200], k: 0.55, poly: 6 },
    { t: 1.85, r: 0.09, c: [110, 220, 255], k: 0.3, poly: 0 },
  ];
  const rot = r() * 1.0;
  for (const g of ghosts) {
    const x = sx + vx * g.t * (0.9 + 0.2 * r());
    const y = sy + vy * g.t * (0.9 + 0.2 * r());
    const R = M * g.r * (0.85 + 0.3 * r());
    ctx.globalAlpha = op * g.k;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, R);
    grad.addColorStop(0, rgba(g.c, 0.15));
    grad.addColorStop(0.75, rgba(g.c, 0.35));
    grad.addColorStop(0.93, rgba(g.c, 0.7));
    grad.addColorStop(1, rgba(g.c, 0));
    ctx.fillStyle = grad;
    if (g.poly) polygon(ctx, x, y, R, g.poly, rot);
    else {
      ctx.beginPath();
      ctx.arc(x, y, R, 0, TAU);
    }
    ctx.fill();
  }
  // one thin halo ring around the source
  ctx.globalAlpha = op * 0.55;
  const ringR = M * 0.5;
  const ring = ctx.createRadialGradient(sx, sy, ringR * 0.9, sx, sy, ringR * 1.1);
  ring.addColorStop(0, 'rgba(255,200,150,0)');
  ring.addColorStop(0.5, 'rgba(190,220,255,0.28)');
  ring.addColorStop(1, 'rgba(255,160,200,0)');
  ctx.fillStyle = ring;
  ctx.fillRect(a.x, a.y, a.w, a.h);
}

function sunRays(ctx: CanvasRenderingContext2D, a: Area, r: Rng, op: number) {
  const M = Math.hypot(a.w, a.h);
  const sx = a.x + (0.15 + 0.7 * r()) * a.w;
  const sy = a.y - a.h * (0.12 + 0.12 * r());
  const aim = Math.atan2(a.y + a.h * 0.6 - sy, a.x + a.w / 2 - sx) + (r() - 0.5) * 0.3;
  const half = 0.82; // half fan width in radians
  const L = layer(a.w, a.h);
  if (!L) return;
  const lx = sx - a.x;
  const ly = sy - a.y;
  const conic = (L as CanvasRenderingContext2D & { createConicGradient?: (s: number, x: number, y: number) => CanvasGradient }).createConicGradient;
  const N = 140;
  // ray strengths: smooth random field, spikier than plain noise
  const raw = Array.from({ length: N + 1 }, () => r());
  const field = (i: number) => {
    const t = ((i % N) + N) % N;
    return (raw[t] * 0.55 + raw[(t + 1) % N] * 0.3 + raw[(t + N - 1) % N] * 0.15);
  };
  if (typeof conic === 'function') {
    const g = conic.call(L, aim - Math.PI, lx, ly);
    for (let i = 0; i <= N; i++) {
      const ang = (i / N) * TAU - Math.PI; // relative to aim
      const env = clamp01(1 - Math.abs(ang) / half);
      const e = smooth(env);
      const v = Math.pow(clamp01((field(i) - 0.28) / 0.6), 1.6);
      g.addColorStop(i / N, `rgba(255,236,190,${(e * (0.18 + 0.82 * v) * 0.8).toFixed(3)})`);
    }
    L.fillStyle = g;
    L.fillRect(0, 0, a.w, a.h);
  } else {
    // fallback: soft wedge stack
    for (let i = 0; i < 18; i++) {
      const ang = aim + (r() - 0.5) * 2 * half * 0.9;
      const wd = 0.01 + r() * 0.035;
      L.fillStyle = `rgba(255,236,190,${(0.12 + 0.2 * r()).toFixed(3)})`;
      L.beginPath();
      L.moveTo(lx, ly);
      L.lineTo(lx + Math.cos(ang - wd) * M * 1.6, ly + Math.sin(ang - wd) * M * 1.6);
      L.lineTo(lx + Math.cos(ang + wd) * M * 1.6, ly + Math.sin(ang + wd) * M * 1.6);
      L.closePath();
      L.fill();
    }
  }
  // fade the rays out with distance
  L.globalCompositeOperation = 'destination-in';
  const fade = L.createRadialGradient(lx, ly, 0, lx, ly, M * 1.05);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(0.35, 'rgba(0,0,0,0.85)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  L.fillStyle = fade;
  L.fillRect(0, 0, a.w, a.h);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = op;
  ctx.drawImage(layerCv as HTMLCanvasElement, 0, 0, Math.ceil(a.w), Math.ceil(a.h), a.x, a.y, Math.ceil(a.w), Math.ceil(a.h));
  // sun glow where the rays originate
  const gx = clamp01((sx - a.x) / a.w) * a.w + a.x;
  const gy = a.y + a.h * 0.02;
  blob(ctx, gx, gy, a.w * 0.6, a.h * 0.45, 0, falloff([255, 214, 150], 0.55));
  ctx.restore();
}

function glowSoft(ctx: CanvasRenderingContext2D, a: Area, r: Rng, op: number) {
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = op;
  const M = Math.max(a.w, a.h);

  // Orton-style bloom: a heavily downsampled copy of whatever is already there, screened back on top
  try {
    const m = ctx.getTransform();
    if (Math.abs(m.b) < 1e-6 && Math.abs(m.c) < 1e-6 && m.a > 0 && m.d > 0) {
      const src = ctx.canvas as HTMLCanvasElement;
      const sx = Math.max(0, Math.round(a.x * m.a + m.e));
      const sy = Math.max(0, Math.round(a.y * m.d + m.f));
      const sw = Math.min(src.width - sx, Math.round(a.w * m.a));
      const sh = Math.min(src.height - sy, Math.round(a.h * m.d));
      if (sw > 8 && sh > 8) {
        const k = 1 / Math.max(6, Math.round(Math.min(sw, sh) / 28));
        const tw = Math.max(2, Math.round(sw * k));
        const th = Math.max(2, Math.round(sh * k));
        const small = layer(tw, th);
        if (small) {
          small.imageSmoothingEnabled = true;
          small.imageSmoothingQuality = 'high';
          small.drawImage(src, sx, sy, sw, sh, 0, 0, tw, th);
          // second pass for a wider kernel
          const t2w = Math.max(2, Math.round(tw / 2));
          const t2h = Math.max(2, Math.round(th / 2));
          const tmp = newCanvas(t2w, t2h);
          const tc = tmp.getContext('2d');
          if (tc) {
            tc.imageSmoothingQuality = 'high';
            tc.drawImage(layerCv as HTMLCanvasElement, 0, 0, tw, th, 0, 0, t2w, t2h);
            ctx.save();
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.globalAlpha = op * 0.75;
            ctx.drawImage(tmp, 0, 0, t2w, t2h, a.x, a.y, a.w, a.h);
            ctx.restore();
          }
        }
      }
    }
  } catch {
    /* tainted or unsupported source: the gradient haze below still works */
  }

  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = op;
  // overall milky lift
  ctx.fillStyle = 'rgba(255,236,230,0.12)';
  ctx.fillRect(a.x, a.y, a.w, a.h);
  // warm bloom from a bright corner, cool counter-glow opposite
  const hx = r() < 0.5 ? 0.12 : 0.88;
  const hy = r() < 0.5 ? 0.1 : 0.9;
  blob(ctx, a.x + hx * a.w, a.y + hy * a.h, M * 0.95, M * 0.85, 0, falloff([255, 232, 205], 0.55));
  blob(ctx, a.x + (1 - hx) * a.w, a.y + (1 - hy) * a.h, M * 0.75, M * 0.7, 0, falloff([255, 170, 215], 0.3));
  blob(ctx, a.x + a.w * 0.5, a.y + a.h * 0.4, M * 0.6, M * 0.55, 0, falloff([205, 225, 255], 0.2));
  // luminous edges, as through a diffusion filter
  const vg = ctx.createRadialGradient(a.x + a.w / 2, a.y + a.h / 2, M * 0.2, a.x + a.w / 2, a.y + a.h / 2, M * 0.78);
  vg.addColorStop(0, 'rgba(255,245,240,0)');
  vg.addColorStop(1, 'rgba(255,245,240,0.28)');
  ctx.fillStyle = vg;
  ctx.fillRect(a.x, a.y, a.w, a.h);
}

// ---------------------------------------------------------------------------------------------
// weather
// ---------------------------------------------------------------------------------------------

function fog(ctx: CanvasRenderingContext2D, a: Area, r: Rng, op: number, ppm: number) {
  ctx.globalCompositeOperation = 'screen';
  const mm = Math.max(a.w, a.h) / ppm;
  // two drifting cloud layers at different scales
  tileFill(ctx, fogTile(), a, Math.max(0.5, (mm / 90) * ppm * 0.9) , r, 'screen', op * 0.7);
  tileFill(ctx, fogTile(), a, Math.max(0.5, (mm / 90) * ppm * 0.45), r, 'screen', op * 0.45);
  // denser toward the bottom, thin haze up top
  const g = ctx.createLinearGradient(0, a.y, 0, a.y + a.h);
  g.addColorStop(0, 'rgba(215,224,232,0.06)');
  g.addColorStop(0.55, 'rgba(215,224,232,0.14)');
  g.addColorStop(1, 'rgba(225,232,238,0.5)');
  ctx.globalAlpha = op;
  ctx.fillStyle = g;
  ctx.fillRect(a.x, a.y, a.w, a.h);
}

function rain(ctx: CanvasRenderingContext2D, a: Area, r: Rng, op: number, ppm: number) {
  const mm2 = (a.w * a.h) / (ppm * ppm);
  // cool, slightly dull atmosphere
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = op * 0.35;
  ctx.fillStyle = 'rgb(176,194,214)';
  ctx.fillRect(a.x, a.y, a.w, a.h);

  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';
  const slant = 0.2 + (r() - 0.5) * 0.06;
  const dx = Math.sin(slant);
  const dy = Math.cos(slant);
  const n = Math.min(480, Math.round(mm2 / 7) + 16);
  for (let i = 0; i < n; i++) {
    const depth = r(); // 0 far, 1 near
    const len = (2 + depth * 7 + r() * 2) * ppm;
    const x = a.x + (r() * 1.3 - 0.15) * a.w;
    const y = a.y + (r() * 1.2 - 0.1) * a.h;
    ctx.globalAlpha = op * (0.12 + 0.55 * depth * r());
    ctx.lineWidth = Math.max(0.6, (0.035 + 0.07 * depth) * ppm);
    const g = ctx.createLinearGradient(x, y, x + dx * len, y + dy * len);
    g.addColorStop(0, 'rgba(225,236,248,0)');
    g.addColorStop(0.5, 'rgba(225,236,248,1)');
    g.addColorStop(1, 'rgba(225,236,248,0)');
    ctx.strokeStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx * len, y + dy * len);
    ctx.stroke();
  }
  // droplets sitting on the lens: dark rim, bright catchlight
  const nd = Math.min(16, 3 + Math.round(mm2 / 220));
  for (let i = 0; i < nd; i++) {
    const R = (0.45 + Math.pow(r(), 2) * 1.1) * ppm;
    const x = a.x + r() * a.w;
    const y = a.y + r() * a.h;
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = op * 0.55;
    const body = ctx.createRadialGradient(x, y - R * 0.2, R * 0.15, x, y, R);
    body.addColorStop(0, 'rgba(255,255,255,1)');
    body.addColorStop(0.75, 'rgba(225,232,240,1)');
    body.addColorStop(1, 'rgba(110,125,145,1)');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(x, y, R * 0.85, R, 0, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = op * 0.8;
    blob(ctx, x - R * 0.28, y - R * 0.38, R * 0.3, R * 0.2, -0.5, falloff([255, 255, 255], 0.95, 5));
  }
}

function snow(ctx: CanvasRenderingContext2D, a: Area, r: Rng, op: number, ppm: number) {
  ctx.globalCompositeOperation = 'screen';
  const mm2 = (a.w * a.h) / (ppm * ppm);
  // faint cold veil
  ctx.globalAlpha = op * 0.4;
  ctx.fillStyle = 'rgba(205,220,240,0.12)';
  ctx.fillRect(a.x, a.y, a.w, a.h);
  const layersSpec = [
    { n: Math.round(mm2 / 12), r: 0.14, soft: 0.2, k: 0.55 }, // far: small, crisp
    { n: Math.round(mm2 / 40), r: 0.3, soft: 0.5, k: 0.8 },
    { n: Math.round(mm2 / 170), r: 0.75, soft: 1, k: 0.85 }, // near: big, blurry
  ];
  for (const L of layersSpec) {
    const n = Math.min(300, Math.max(4, L.n));
    for (let i = 0; i < n; i++) {
      const x = a.x + r() * a.w;
      const y = a.y + r() * a.h;
      const R = Math.max(0.8, L.r * ppm * (0.7 + 0.7 * r()));
      ctx.globalAlpha = op * L.k * (0.5 + 0.5 * r());
      const g = ctx.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(clamp01(0.55 - L.soft * 0.4), 'rgba(255,255,255,0.85)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, R, 0, TAU);
      ctx.fill();
    }
  }
}

function sparkleStar(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, rot: number, tint: RGB) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  // soft glow
  blob(ctx, 0, 0, R * 0.45, R * 0.45, 0, falloff(tint, 0.65));
  // four-point star with concave sides
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, rgba(tint, 0.9));
  g.addColorStop(1, rgba(tint, 0));
  ctx.fillStyle = g;
  const w = R * 0.07;
  ctx.beginPath();
  ctx.moveTo(0, -R);
  ctx.quadraticCurveTo(w, -w, R, 0);
  ctx.quadraticCurveTo(w, w, 0, R);
  ctx.quadraticCurveTo(-w, w, -R, 0);
  ctx.quadraticCurveTo(-w, -w, 0, -R);
  ctx.closePath();
  ctx.fill();
  // tiny bright centre
  blob(ctx, 0, 0, R * 0.12, R * 0.12, 0, falloff([255, 255, 255], 1, 4));
  ctx.restore();
}

function sparkle(ctx: CanvasRenderingContext2D, a: Area, r: Rng, op: number, ppm: number) {
  ctx.globalCompositeOperation = 'screen';
  const mm2 = (a.w * a.h) / (ppm * ppm);
  const tints: RGB[] = [
    [255, 250, 235],
    [255, 226, 170],
    [200, 230, 255],
    [255, 210, 235],
  ];
  const n = Math.min(40, Math.max(6, Math.round(mm2 / 90)));
  for (let i = 0; i < n; i++) {
    const big = i < Math.max(2, n / 6);
    const R = (big ? 3.2 + r() * 3.2 : 0.8 + r() * 1.7) * ppm;
    ctx.globalAlpha = op * (big ? 0.95 : 0.5 + 0.45 * r());
    sparkleStar(ctx, a.x + r() * a.w, a.y + r() * a.h, R, big ? (r() - 0.5) * 0.3 : 0, tints[Math.floor(r() * tints.length)]);
  }
  // fine glitter dust
  for (let i = 0; i < n * 3; i++) {
    const R = (0.12 + r() * 0.25) * ppm;
    ctx.globalAlpha = op * (0.35 + 0.55 * r());
    ctx.fillStyle = 'rgb(255,250,240)';
    ctx.beginPath();
    ctx.arc(a.x + r() * a.w, a.y + r() * a.h, Math.max(0.5, R), 0, TAU);
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------------------------
// public entry point
// ---------------------------------------------------------------------------------------------

export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  id: string,
  area: { x: number; y: number; w: number; h: number },
  opacity: number,
  seed: number,
  ppm: number,
): void {
  const op = clamp01(Number.isFinite(opacity) ? opacity : 0);
  if (op <= 0 || !(area.w >= 1) || !(area.h >= 1)) return;
  const a: Area = { x: area.x, y: area.y, w: area.w, h: area.h };
  const p = Number.isFinite(ppm) && ppm > 0 ? ppm : 3;
  const r = mulberry32(((Number.isFinite(seed) ? seed : 0) | 0) ^ hashStr(id));
  ctx.save();
  try {
    ctx.beginPath();
    ctx.rect(a.x, a.y, a.w, a.h);
    ctx.clip();
    ctx.globalAlpha = op;
    ctx.globalCompositeOperation = 'screen';
    switch (id) {
      case 'leak-amber': leakAmber(ctx, a, r, op); break;
      case 'leak-rose': leakRose(ctx, a, r, op); break;
      case 'leak-prism': leakPrism(ctx, a, r, op); break;
      case 'leak-teal': leakTeal(ctx, a, r, op); break;
      case 'film-burn': filmBurn(ctx, a, r, op); break;
      case 'grain-fine': grain(ctx, a, r, op, p, false); break;
      case 'grain-coarse': grain(ctx, a, r, op, p, true); break;
      case 'dust': dust(ctx, a, r, op, p); break;
      case 'scratches': scratches(ctx, a, r, op, p); break;
      case 'paper': paper(ctx, a, r, op, p); break;
      case 'halftone-dots': halftone(ctx, a, r, op, p); break;
      case 'bokeh': bokeh(ctx, a, r, op, p); break;
      case 'flare': flare(ctx, a, r, op); break;
      case 'sun-rays': sunRays(ctx, a, r, op); break;
      case 'glow-soft': glowSoft(ctx, a, r, op); break;
      case 'fog': fog(ctx, a, r, op, p); break;
      case 'rain': rain(ctx, a, r, op, p); break;
      case 'snow': snow(ctx, a, r, op, p); break;
      case 'sparkle': sparkle(ctx, a, r, op, p); break;
      default: break;
    }
  } catch {
    /* an overlay must never break a render */
  } finally {
    ctx.restore();
  }
}
