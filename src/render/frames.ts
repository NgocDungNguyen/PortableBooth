/**
 * Film body painters: background, pattern and edge treatment for the whole strip/card.
 * Pure Canvas2D, resolution independent (everything is expressed in mm * ppm) and deterministic.
 */

export interface FrameStyleDef {
  id: string;
  name: string;
  /** needs a second colour (gradient / pattern ink) */
  usesColor2: boolean;
}

export const FRAME_STYLES: FrameStyleDef[] = [
  { id: 'plain', name: 'Plain', usesColor2: false },
  { id: 'paper', name: 'Cotton paper', usesColor2: false },
  { id: 'grid', name: 'Graph paper', usesColor2: true },
  { id: 'dots', name: 'Polka dots', usesColor2: true },
  { id: 'lines', name: 'Notebook', usesColor2: true },
  { id: 'checker', name: 'Checker', usesColor2: true },
  { id: 'gradient', name: 'Gradient', usesColor2: true },
  { id: 'holo', name: 'Holo foil', usesColor2: false },
  { id: 'foil-gold', name: 'Gold foil', usesColor2: false },
  { id: 'deckle', name: 'Deckle edge', usesColor2: false },
  { id: 'noise-film', name: 'Film base', usesColor2: false },
  { id: 'double-line', name: 'Double line', usesColor2: true },
];

type Rng = () => number;
type RGB = [number, number, number];

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

function parseHex(c: string, fallback: RGB): RGB {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((c || '').trim());
  if (!m) return fallback;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const css = (c: RGB, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${clamp01(a)})`;
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const lum = (c: RGB) => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;

function newCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

function makeTile(w: number, h: number, fill: (d: Uint8ClampedArray) => void): HTMLCanvasElement {
  const c = newCanvas(w, h);
  const x = c.getContext('2d');
  if (!x) return c;
  const img = x.createImageData(c.width, c.height);
  fill(img.data);
  x.putImageData(img, 0, 0);
  return c;
}

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

// ---------------------------------------------------------------------------------------------
// cached tiles
// ---------------------------------------------------------------------------------------------

let grainCv: HTMLCanvasElement | null = null;
/** neutral grey grain (128 +- noise), for 'overlay' / 'soft-light' */
function grainTile() {
  return (grainCv ??= makeTile(256, 256, (d) => {
    const r = mulberry32(9001);
    for (let i = 0; i < d.length; i += 4) {
      const g = (r() + r() + r() - 1.5) / 1.5;
      d[i] = d[i + 1] = d[i + 2] = 128 + g * 100;
      d[i + 3] = 255;
    }
  }));
}

let sparkCv: HTMLCanvasElement | null = null;
/** black with sparse bright speckles, for 'screen' on dark bases */
function speckTile() {
  return (sparkCv ??= makeTile(256, 256, (d) => {
    const r = mulberry32(31337);
    for (let i = 0; i < d.length; i += 4) {
      const g = (r() + r() + r() - 1.5) / 1.5;
      const v = Math.max(0, g) ** 1.3 * 230 + (r() < 0.012 ? 120 : 0);
      d[i] = d[i + 1] = d[i + 2] = Math.min(255, v);
      d[i + 3] = 255;
    }
  }));
}

let paperCv: HTMLCanvasElement | null = null;
/** mottled cotton paper with fibres; neutral grey around 128 */
function paperTile() {
  if (paperCv) return paperCv;
  const S = 320;
  const r = mulberry32(555);
  const a = periodicNoise(S, 5, r);
  const b = periodicNoise(S, 20, r);
  const c = periodicNoise(S, 160, r);
  const tile = makeTile(S, S, (d) => {
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const v = 128 + (a[p] - 0.5) * 36 + (b[p] - 0.5) * 34 + (c[p] - 0.5) * 34;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
  });
  const x = tile.getContext('2d');
  if (x) {
    x.lineCap = 'round';
    for (let k = 0; k < 420; k++) {
      const px = r() * S;
      const py = r() * S;
      const len = 4 + r() * 18;
      const ang = r() * TAU;
      const bend = (r() - 0.5) * 9;
      x.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.3)' : 'rgba(80,60,40,0.22)';
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
  return (paperCv = tile);
}

function tileFill(
  ctx: CanvasRenderingContext2D,
  tile: HTMLCanvasElement,
  W: number,
  H: number,
  scaleX: number,
  scaleY: number,
  rand: Rng,
  comp: GlobalCompositeOperation,
  alpha: number,
) {
  const pat = ctx.createPattern(tile, 'repeat');
  if (!pat) return;
  const sx = Math.max(0.05, scaleX);
  const sy = Math.max(0.05, scaleY);
  const ox = rand() * tile.width;
  const oy = rand() * tile.height;
  ctx.save();
  ctx.globalCompositeOperation = comp;
  ctx.globalAlpha = clamp01(alpha);
  ctx.scale(sx, sy);
  ctx.translate(-ox, -oy);
  ctx.fillStyle = pat;
  ctx.fillRect(ox, oy, W / sx + 1, H / sy + 1);
  ctx.restore();
}

/** faint paper grain; one noise pixel is about ppm/6 device pixels */
function paperGrain(ctx: CanvasRenderingContext2D, W: number, H: number, ppm: number, rand: Rng, strength = 1) {
  const s = Math.max(0.5, ppm / 6);
  tileFill(ctx, grainTile(), W, H, s, s, rand, 'overlay', 0.1 * strength);
  tileFill(ctx, grainTile(), W, H, s * 0.5, s * 0.5, rand, 'soft-light', 0.1 * strength);
}

function vignette(ctx: CanvasRenderingContext2D, W: number, H: number, color: string, from: number, a: number) {
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(W / 2, H / 2);
  const g = ctx.createRadialGradient(0, 0, from, 0, 0, 1.42);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, color.replace('A', String(a)));
  ctx.fillStyle = g;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// outline
// ---------------------------------------------------------------------------------------------

function roundedPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  if (rr < 0.01) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// ---------------------------------------------------------------------------------------------
// styles (each is called with the outline already clipped)
// ---------------------------------------------------------------------------------------------

interface Ctx {
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  ppm: number;
  c1: RGB;
  c2: RGB;
  rand: Rng;
  rPx: number;
}

const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];

function fillBase(s: Ctx) {
  s.ctx.fillStyle = css(s.c1);
  s.ctx.fillRect(0, 0, s.W, s.H);
}

function plain(s: Ctx) {
  fillBase(s);
  paperGrain(s.ctx, s.W, s.H, s.ppm, s.rand, 0.8);
}

function paperStyle(s: Ctx) {
  const { ctx, W, H, ppm } = s;
  fillBase(s);
  const sc = Math.max(0.5, ppm * 0.22);
  tileFill(ctx, paperTile(), W, H, sc, sc, s.rand, 'overlay', 0.75);
  tileFill(ctx, paperTile(), W, H, sc * 0.45, sc * 0.45, s.rand, 'soft-light', 0.55);
  // slight vignette, warmer than the paper itself
  const dark = lum(s.c1) > 0.5;
  vignette(ctx, W, H, dark ? 'rgba(90,60,30,A)' : 'rgba(255,240,210,A)', 0.6, dark ? 0.13 : 0.14);
}

function gridStyle(s: Ctx) {
  const { ctx, W, H, ppm } = s;
  fillBase(s);
  const cell = 4 * ppm;
  const lw = Math.max(1, 0.13 * ppm);
  const x0 = ((W % cell) / 2) | 0;
  const y0 = ((H % cell) / 2) | 0;
  ctx.fillStyle = css(s.c2, 0.28);
  for (let i = 0, x = x0; x < W + cell; i++, x = x0 + i * cell) {
    if (i % 5 !== 0) ctx.fillRect(Math.round(x), 0, lw, H);
  }
  for (let j = 0, y = y0; y < H + cell; j++, y = y0 + j * cell) {
    if (j % 5 !== 0) ctx.fillRect(0, Math.round(y), W, lw);
  }
  const lw2 = Math.max(1, 0.2 * ppm);
  ctx.fillStyle = css(s.c2, 0.55);
  for (let i = 0, x = x0; x < W + cell; i++, x = x0 + i * cell) {
    if (i % 5 === 0) ctx.fillRect(Math.round(x), 0, lw2, H);
  }
  for (let j = 0, y = y0; y < H + cell; j++, y = y0 + j * cell) {
    if (j % 5 === 0) ctx.fillRect(0, Math.round(y), W, lw2);
  }
  paperGrain(ctx, W, H, ppm, s.rand, 0.8);
}

function dotsStyle(s: Ctx) {
  const { ctx, W, H, ppm } = s;
  fillBase(s);
  const pitch = 4.2 * ppm;
  const rad = Math.max(0.8, 0.62 * ppm);
  ctx.fillStyle = css(s.c2, 0.7);
  ctx.beginPath();
  const rows = Math.ceil(H / (pitch * 0.5)) + 2;
  const cols = Math.ceil(W / pitch) + 2;
  const ox = (W - Math.floor(W / pitch) * pitch) / 2;
  for (let j = -1; j < rows; j++) {
    const y = j * pitch * 0.5;
    const off = j % 2 === 0 ? 0 : pitch / 2;
    for (let i = -1; i < cols; i++) {
      const x = ox + i * pitch + off;
      ctx.moveTo(x + rad, y);
      ctx.arc(x, y, rad, 0, TAU);
    }
  }
  ctx.fill();
  paperGrain(ctx, W, H, ppm, s.rand, 0.8);
}

function linesStyle(s: Ctx) {
  const { ctx, W, H, ppm } = s;
  fillBase(s);
  const gap = 6.2 * ppm;
  const lw = Math.max(1, 0.15 * ppm);
  ctx.fillStyle = css(s.c2, 0.4);
  const top = 12 * ppm;
  for (let y = top; y < H; y += gap) ctx.fillRect(0, Math.round(y), W, lw);
  // red-ish margin line, mixed with the rule colour so it stays on-palette
  const margin = mix(s.c2, [229, 72, 77], 0.6);
  ctx.fillStyle = css(margin, 0.75);
  const mx = Math.round(Math.min(W * 0.2, 8.5 * ppm));
  ctx.fillRect(mx, 0, Math.max(1, 0.2 * ppm), H);
  ctx.fillRect(mx + Math.max(2, 0.55 * ppm), 0, Math.max(1, 0.12 * ppm), H);
  paperGrain(ctx, W, H, ppm, s.rand, 0.8);
}

function checkerStyle(s: Ctx) {
  const { ctx, W, H, ppm } = s;
  fillBase(s);
  const cell = Math.max(2, 2.4 * ppm);
  ctx.fillStyle = css(s.c2, 0.9);
  const nx = Math.ceil(W / cell);
  const ny = Math.ceil(H / cell);
  for (let j = 0; j < ny; j++) {
    const y0 = Math.round(j * cell);
    const y1 = Math.round((j + 1) * cell);
    for (let i = (j & 1) as number; i < nx; i += 2) {
      const x0 = Math.round(i * cell);
      ctx.fillRect(x0, y0, Math.round((i + 1) * cell) - x0, y1 - y0);
    }
  }
  paperGrain(ctx, W, H, ppm, s.rand, 0.6);
}

function gradientStyle(s: Ctx) {
  const { ctx, W, H, ppm } = s;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, css(s.c1));
  g.addColorStop(1, css(s.c2));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // grain doubles as dither, which keeps long gradients free of banding
  const sc = Math.max(0.5, ppm / 5);
  tileFill(ctx, grainTile(), W, H, sc, sc, s.rand, 'overlay', 0.1);
  tileFill(ctx, grainTile(), W, H, sc * 0.5, sc * 0.5, s.rand, 'soft-light', 0.14);
}

function holoStyle(s: Ctx) {
  const { ctx, W, H, ppm } = s;
  const cycle: RGB[] = [
    [255, 170, 224],
    [196, 170, 255],
    [150, 205, 255],
    [150, 245, 225],
    [215, 250, 170],
    [255, 236, 160],
    [255, 190, 170],
  ];
  const L = Math.hypot(W, H);
  const ang = Math.atan2(H, W) + 0.35;
  const dx = Math.cos(ang) * L * 0.5;
  const dy = Math.sin(ang) * L * 0.5;
  const g = ctx.createLinearGradient(W / 2 - dx, H / 2 - dy, W / 2 + dx, H / 2 + dy);
  const reps = Math.max(1.6, Math.min(4, L / (46 * ppm)));
  const N = Math.ceil(reps * cycle.length);
  for (let i = 0; i <= N; i++) g.addColorStop(i / N, css(cycle[i % cycle.length]));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // second, counter-running rainbow for the interference look
  const g2 = ctx.createLinearGradient(W / 2 + dx * 0.3, H / 2 - dy, W / 2 - dx * 0.3, H / 2 + dy);
  const sat: RGB[] = [[255, 60, 160], [120, 90, 255], [0, 190, 255], [30, 235, 170], [255, 220, 60], [255, 110, 120]];
  const N2 = Math.ceil(reps * 0.8 * sat.length);
  for (let i = 0; i <= N2; i++) g2.addColorStop(i / N2, css(sat[i % sat.length]));
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 0.65;
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // diagonal specular band
  const sh = ctx.createLinearGradient(W / 2 - dx * 0.5, H / 2 - dy * 0.5, W / 2 + dx * 0.5, H / 2 + dy * 0.5);
  sh.addColorStop(0, 'rgba(255,255,255,0)');
  sh.addColorStop(0.42, 'rgba(255,255,255,0)');
  sh.addColorStop(0.5, 'rgba(255,255,255,0.5)');
  sh.addColorStop(0.58, 'rgba(255,255,255,0)');
  sh.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sh;
  ctx.fillRect(0, 0, W, H);

  // micro-glitter
  const sc = Math.max(0.5, ppm / 4);
  tileFill(ctx, grainTile(), W, H, sc, sc, s.rand, 'overlay', 0.22);
  tileFill(ctx, speckTile(), W, H, sc * 0.8, sc * 0.8, s.rand, 'screen', 0.14);
}

function foilGoldStyle(s: Ctx) {
  const { ctx, W, H, ppm } = s;
  const stops: [number, string][] = [
    [0, '#7d4f10'],
    [0.1, '#c9952a'],
    [0.2, '#f6dd85'],
    [0.3, '#d3a238'],
    [0.42, '#8a5a14'],
    [0.54, '#d9ab45'],
    [0.64, '#fff1b3'],
    [0.74, '#caa03a'],
    [0.88, '#8c5c15'],
    [1, '#d6a640'],
  ];
  const L = Math.hypot(W, H);
  const ang = Math.atan2(H, W) * 0.35 + 0.55;
  const dx = Math.cos(ang) * L * 0.5;
  const dy = Math.sin(ang) * L * 0.5;
  const g = ctx.createLinearGradient(W / 2 - dx, H / 2 - dy, W / 2 + dx, H / 2 + dy);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // brushed metal: noise stretched along one axis
  const k = Math.max(0.5, ppm / 5);
  tileFill(ctx, grainTile(), W, H, k * 14, k, s.rand, 'overlay', 0.34);
  tileFill(ctx, grainTile(), W, H, k * 5, k * 0.7, s.rand, 'soft-light', 0.3);
  tileFill(ctx, grainTile(), W, H, k, k, s.rand, 'overlay', 0.1);

  // broad sheen
  const sh = ctx.createLinearGradient(W / 2 + dx * 0.15, H / 2 - dy * 0.9, W / 2 - dx * 0.15, H / 2 + dy * 0.9);
  sh.addColorStop(0, 'rgba(255,250,220,0)');
  sh.addColorStop(0.38, 'rgba(255,250,220,0)');
  sh.addColorStop(0.5, 'rgba(255,250,225,0.34)');
  sh.addColorStop(0.62, 'rgba(255,250,220,0)');
  sh.addColorStop(1, 'rgba(255,250,220,0)');
  ctx.fillStyle = sh;
  ctx.fillRect(0, 0, W, H);
  vignette(ctx, W, H, 'rgba(70,40,5,A)', 0.6, 0.28);
}

// --- deckle -----------------------------------------------------------------------------------

function valueNoise1D(rand: Rng, n: number) {
  const v = Array.from({ length: n + 2 }, () => rand());
  return (x: number) => {
    const i = Math.max(0, Math.min(n, Math.floor(x)));
    return lerp(v[i], v[i + 1], smooth(clamp01(x - i)));
  };
}

function deckleOutline(W: number, H: number, ppm: number, rand: Rng): { x: number; y: number }[] {
  const amp = (0.85 + 0.35 * rand()) * ppm; // 0.85-1.2 mm
  const step = Math.max(1, 0.32 * ppm);
  const edge = (len: number) => {
    const n = Math.ceil(len / step);
    const lo = valueNoise1D(rand, Math.ceil(len / (5 * ppm)) + 2);
    const mid = valueNoise1D(rand, Math.ceil(len / (1.4 * ppm)) + 2);
    const hi = valueNoise1D(rand, Math.ceil(len / (0.45 * ppm)) + 2);
    const out: number[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const v = lo(t * len / (5 * ppm)) * 0.4 + mid(t * len / (1.4 * ppm)) * 0.35 + hi(t * len / (0.45 * ppm)) * 0.25;
      out.push(amp * (0.18 + 0.82 * clamp01((v - 0.18) / 0.64)));
    }
    out[0] = out[n] = amp * 0.5; // matching corners
    return out;
  };
  const top = edge(W);
  const right = edge(H);
  const bottom = edge(W);
  const left = edge(H);
  const pts: { x: number; y: number }[] = [];
  top.forEach((o, i) => pts.push({ x: (i / (top.length - 1)) * W, y: o }));
  right.forEach((o, i) => pts.push({ x: W - o, y: (i / (right.length - 1)) * H }));
  bottom.forEach((o, i) => pts.push({ x: W - (i / (bottom.length - 1)) * W, y: H - o }));
  left.forEach((o, i) => pts.push({ x: o, y: H - (i / (left.length - 1)) * H }));
  return pts;
}

function deckleStyle(s: Ctx) {
  const { ctx, W, H, ppm } = s;
  const pts = deckleOutline(W, H, ppm, s.rand);
  const path = () => {
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
  };
  ctx.save();
  path();
  ctx.clip();
  ctx.fillStyle = css(s.c1);
  ctx.fillRect(0, 0, W, H);
  const sc = Math.max(0.5, ppm * 0.22);
  tileFill(ctx, paperTile(), W, H, sc, sc, s.rand, 'overlay', 0.7);
  tileFill(ctx, paperTile(), W, H, sc * 0.45, sc * 0.45, s.rand, 'soft-light', 0.5);
  // the torn rim is thinner and fibrous: lighter, slightly translucent-looking band along the edge
  const light = lum(s.c1) > 0.5;
  path();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = css(light ? mix(s.c1, WHITE, 0.55) : mix(s.c1, WHITE, 0.22), 0.7);
  ctx.lineWidth = Math.max(1.2, 0.9 * ppm);
  ctx.stroke();
  ctx.strokeStyle = css(light ? mix(s.c1, WHITE, 0.8) : mix(s.c1, WHITE, 0.35), 0.55);
  ctx.lineWidth = Math.max(0.8, 0.35 * ppm);
  ctx.stroke();
  // soft shadow just inside, as the paper thickens away from the tear
  vignette(ctx, W, H, 'rgba(90,60,30,A)', 0.7, light ? 0.1 : 0.0);
  ctx.restore();
}

// --- film base ---------------------------------------------------------------------------------

function noiseFilm(s: Ctx) {
  const { ctx, W, H, ppm } = s;
  const base = mix(s.c1, [12, 10, 9], 0.86);
  ctx.fillStyle = css(base);
  ctx.fillRect(0, 0, W, H);
  // a faint orange mask glow near the edges of the base, as on real negatives
  const edge = ctx.createLinearGradient(0, 0, W, 0);
  edge.addColorStop(0, 'rgba(150,80,30,0.16)');
  edge.addColorStop(0.18, 'rgba(150,80,30,0)');
  edge.addColorStop(0.82, 'rgba(150,80,30,0)');
  edge.addColorStop(1, 'rgba(150,80,30,0.16)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, W, H);
  // dense grain, two sizes
  const k = Math.max(0.5, ppm / 9);
  tileFill(ctx, speckTile(), W, H, k, k, s.rand, 'screen', 0.28);
  tileFill(ctx, speckTile(), W, H, k * 0.55, k * 0.55, s.rand, 'screen', 0.2);
  tileFill(ctx, grainTile(), W, H, k * 1.4, k * 1.4, s.rand, 'soft-light', 0.18);
  // a handful of dust specks and fine vertical scratches
  const mm2 = (W * H) / (ppm * ppm);
  ctx.fillStyle = 'rgba(230,220,205,0.5)';
  for (let i = 0; i < Math.min(140, mm2 / 55); i++) {
    ctx.globalAlpha = 0.15 + 0.4 * s.rand();
    ctx.beginPath();
    ctx.arc(s.rand() * W, s.rand() * H, Math.max(0.5, (0.04 + s.rand() ** 3 * 0.2) * ppm), 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(230,220,205,0.4)';
  ctx.lineWidth = Math.max(0.6, 0.04 * ppm);
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = 0.12 + 0.2 * s.rand();
    const x = s.rand() * W;
    const y = s.rand() * H * 0.7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (s.rand() - 0.5) * 2 * ppm, y + H * (0.1 + 0.3 * s.rand()));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// --- double line ------------------------------------------------------------------------------

function doubleLine(s: Ctx) {
  const { ctx, W, H, ppm } = s;
  fillBase(s);
  paperGrain(ctx, W, H, ppm, s.rand, 0.8);
  const insets: [number, number][] = [
    [1.5, 0.32],
    [2.45, 0.13],
  ];
  ctx.strokeStyle = css(s.c2, 0.92);
  for (const [mm, wmm] of insets) {
    const inset = mm * ppm;
    const lw = Math.max(1, wmm * ppm);
    if (W - 2 * inset < 4 || H - 2 * inset < 4) continue;
    ctx.lineWidth = lw;
    roundedPath(ctx, inset, inset, W - 2 * inset, H - 2 * inset, Math.max(0.4 * ppm, s.rPx - inset));
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------------------------
// entry
// ---------------------------------------------------------------------------------------------

export function paintFrameBody(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  o: { style: string; color: string; color2: string; ppm: number; radiusMm: number; seed?: number },
): void {
  if (!(W >= 1) || !(H >= 1)) return;
  const ppm = Number.isFinite(o.ppm) && o.ppm > 0 ? o.ppm : 3;
  const rPx = Math.max(0, (Number.isFinite(o.radiusMm) ? o.radiusMm : 0) * ppm);
  const c1 = parseHex(o.color, [244, 240, 232]);
  const c2 = parseHex(o.color2, mix(c1, lum(c1) > 0.5 ? BLACK : WHITE, 0.3));
  const rand = mulberry32(o.seed ?? 1);
  const s: Ctx = { ctx, W, H, ppm, c1, c2, rand, rPx };
  ctx.save();
  try {
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    if (o.style === 'deckle') {
      deckleStyle(s);
    } else {
      roundedPath(ctx, 0, 0, W, H, rPx);
      ctx.clip();
      switch (o.style) {
        case 'paper': paperStyle(s); break;
        case 'grid': gridStyle(s); break;
        case 'dots': dotsStyle(s); break;
        case 'lines': linesStyle(s); break;
        case 'checker': checkerStyle(s); break;
        case 'gradient': gradientStyle(s); break;
        case 'holo': holoStyle(s); break;
        case 'foil-gold': foilGoldStyle(s); break;
        case 'noise-film': noiseFilm(s); break;
        case 'double-line': doubleLine(s); break;
        default: plain(s); break;
      }
    }
  } catch {
    /* never break a render */
  } finally {
    ctx.restore();
  }
}
