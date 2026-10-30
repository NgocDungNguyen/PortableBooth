import { addPhoto, removePhoto, type Photo } from './media/photos';

/**
 * Demo photos for the homepage, film pickers and filter thumbnails.
 *
 * Two sources, in this order of preference:
 *  1. the owner's own photos dropped into `src/assets/demo/` (see the README there), bundled as same-origin
 *     files and decoded after start-up, they replace the generated scenes one by one;
 *  2. procedural "photographs" rendered here: physically-minded light (sky gradients, volumetric beams,
 *     bokeh with highlight bloom, haze, light wrap round backlit silhouettes, wet reflections), then
 *     developed like a negative (filmic curve, bloom, vignette, luminance-shaped grain, shadow chroma noise).
 *
 * Nothing is fetched and nobody is pictured: people are soft, faceless silhouettes. Everything is drawn from a
 * seeded PRNG, so the same index always yields the same pixels.
 */
type RGB = [number, number, number];
type Ctx = CanvasRenderingContext2D;
type Rnd = () => number;
type Scene = (x: Ctx, r: Rnd, w: number, h: number) => void;

export const SAMPLE_W = 900;
export const SAMPLE_H = 700;

const rgba = (c: RGB, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
const mixc = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function prng(seed: number): Rnd {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const between = (r: Rnd, a: number, b: number) => a + (b - a) * r();
/** roughly gaussian, -1..1-ish */
const gauss = (r: Rnd) => (r() + r() + r() - 1.5) / 1.5;

// ---------------------------------------------------------------- canvas plumbing

function mk(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const x = c.getContext('2d') as Ctx;
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  return [c, x];
}
function snapshot(src: HTMLCanvasElement): HTMLCanvasElement {
  const [c, x] = mk(src.width, src.height);
  x.drawImage(src, 0, 0);
  return c;
}

let filterOK: boolean | null = null;
function canFilter(x: Ctx): boolean {
  if (filterOK === null) {
    filterOK = typeof x.filter === 'string';
    if (filterOK) {
      x.filter = 'blur(2px)';
      filterOK = x.filter === 'blur(2px)';
      x.filter = 'none';
    }
  }
  return filterOK;
}

/**
 * Gaussian-ish blur. Large radii are done on a downscaled copy (fast and smooth); `opaque` pads the edges
 * by clamping so full-frame layers do not darken at the border. Falls back to a mip-chain when the 2D
 * canvas has no `filter` (older Safari).
 */
function blur(src: HTMLCanvasElement, r: number, opaque = false): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  const [out, ox] = mk(w, h);
  if (r <= 0.25) {
    ox.drawImage(src, 0, 0);
    return out;
  }
  const f = r > 5 ? Math.min(10, Math.max(1, Math.floor(r / 2.5))) : 1;
  const sw = Math.max(2, Math.round(w / f));
  const sh = Math.max(2, Math.round(h / f));
  const rr = r / f;
  const pad = opaque ? Math.ceil(rr * 2.5) + 1 : 0;
  const [s, sx] = mk(sw + pad * 2, sh + pad * 2);
  sx.drawImage(src, pad, pad, sw, sh);
  if (pad) {
    // clamp-to-edge: stretch the outermost rows/columns into the padding
    sx.drawImage(s, pad, pad, 1, sh, 0, pad, pad, sh);
    sx.drawImage(s, pad + sw - 1, pad, 1, sh, pad + sw, pad, pad, sh);
    sx.drawImage(s, 0, pad, sw + pad * 2, 1, 0, 0, sw + pad * 2, pad);
    sx.drawImage(s, 0, pad + sh - 1, sw + pad * 2, 1, 0, pad + sh, sw + pad * 2, pad);
  }
  const [b, bx] = mk(s.width, s.height);
  if (canFilter(bx)) {
    bx.filter = `blur(${rr}px)`;
    bx.drawImage(s, 0, 0);
    bx.filter = 'none';
  } else {
    // mip-chain fallback: halve until the radius is covered, then scale back up
    let cur = s;
    let k = 1;
    while (k < rr * 1.6 && cur.width > 4 && cur.height > 4) {
      const [n, nx] = mk(cur.width / 2, cur.height / 2);
      nx.drawImage(cur, 0, 0, n.width, n.height);
      cur = n;
      k *= 2;
    }
    bx.drawImage(cur, 0, 0, s.width, s.height);
  }
  ox.drawImage(b, pad, pad, sw, sh, 0, 0, w, h);
  return out;
}

/** draw `src` onto `x` with a composite mode and alpha */
function comp(x: Ctx, src: HTMLCanvasElement, mode: GlobalCompositeOperation, a = 1) {
  x.save();
  x.globalCompositeOperation = mode;
  x.globalAlpha = a;
  x.drawImage(src, 0, 0, x.canvas.width, x.canvas.height);
  x.restore();
}

// ---------------------------------------------------------------- noise

function hash(ix: number, iy: number, seed: number) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x: number, y: number, seed: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  let fx = x - x0;
  let fy = y - y0;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, seed);
  const b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed);
  const d = hash(x0 + 1, y0 + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
function fbm(x: number, y: number, seed: number, oct = 5) {
  let v = 0;
  let amp = 0.5;
  let f = 1;
  let norm = 0;
  for (let o = 0; o < oct; o++) {
    v += vnoise(x * f, y * f, seed + o * 31) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return v / norm;
}

/** low-res procedural field -> canvas (smoothly upscaled when drawn) */
function field(gw: number, gh: number, px: (u: number, v: number) => [number, number, number, number]): HTMLCanvasElement {
  const [c, x] = mk(gw, gh);
  const img = x.createImageData(c.width, c.height);
  const d = img.data;
  let i = 0;
  for (let y = 0; y < c.height; y++) {
    for (let xx = 0; xx < c.width; xx++) {
      const p = px(xx / c.width, y / c.height);
      d[i] = p[0];
      d[i + 1] = p[1];
      d[i + 2] = p[2];
      d[i + 3] = p[3] * 255;
      i += 4;
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}

// ---------------------------------------------------------------- light primitives

function vband(x: Ctx, w: number, y0: number, y1: number, stops: [number, string][]) {
  const g = x.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([t, c]) => g.addColorStop(t, c));
  x.fillStyle = g;
  x.fillRect(0, y0, w, y1 - y0);
}

/** soft elliptical light with a gaussian-like falloff */
function glow(x: Ctx, cx: number, cy: number, rx: number, ry: number, c: RGB, a: number, mode: GlobalCompositeOperation = 'lighter') {
  x.save();
  x.globalCompositeOperation = mode;
  x.translate(cx, cy);
  x.scale(Math.max(rx, 0.01), Math.max(ry, 0.01));
  const g = x.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, rgba(c, a));
  g.addColorStop(0.12, rgba(c, a * 0.75));
  g.addColorStop(0.3, rgba(c, a * 0.38));
  g.addColorStop(0.55, rgba(c, a * 0.12));
  g.addColorStop(0.8, rgba(c, a * 0.03));
  g.addColorStop(1, rgba(c, 0));
  x.fillStyle = g;
  x.fillRect(-1, -1, 2, 2);
  x.restore();
}

/** out-of-focus point light: flat disc, a brighter rim, slight onion ring; cat's-eye clipped near the edges */
function bokehDisc(x: Ctx, cx: number, cy: number, rad: number, c: RGB, a: number, w: number, h: number) {
  x.save();
  // mechanical vignetting: intersect with a disc pushed toward the frame centre
  const dx = (cx - w / 2) / (w / 2);
  const dy = (cy - h / 2) / (h / 2);
  const dist = Math.min(1.4, Math.hypot(dx, dy));
  if (dist > 0.55) {
    const k = (dist - 0.55) * rad * 0.9;
    x.beginPath();
    x.arc(cx - (dx / dist) * k, cy - (dy / dist) * k, rad * 1.02, 0, Math.PI * 2);
    x.clip();
  }
  const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
  g.addColorStop(0, rgba(c, a * 0.62));
  g.addColorStop(0.55, rgba(c, a * 0.7));
  g.addColorStop(0.62, rgba(c, a * 0.62));
  g.addColorStop(0.86, rgba(c, a * 0.8));
  g.addColorStop(0.95, rgba(mixc(c, [255, 255, 255], 0.25), a * 1));
  g.addColorStop(1, rgba(c, 0));
  x.fillStyle = g;
  x.beginPath();
  x.arc(cx, cy, rad, 0, Math.PI * 2);
  x.fill();
  x.restore();
}

/** lens flare along the axis through the frame centre: anamorphic streak + a few tinted ghosts */
function flare(x: Ctx, sx: number, sy: number, w: number, h: number, strength: number, tint: RGB) {
  glow(x, sx, sy, w * 0.55, h * 0.012, mixc(tint, [255, 255, 255], 0.5), 0.5 * strength);
  glow(x, sx, sy, w * 0.22, h * 0.006, [255, 255, 255], 0.5 * strength);
  const cx = w / 2;
  const cy = h / 2;
  const ghosts: [number, number, RGB, number][] = [
    [-0.35, 0.03, [170, 255, 200], 0.1],
    [-0.62, 0.075, [255, 170, 120], 0.08],
    [-0.95, 0.03, [150, 170, 255], 0.12],
    [-1.25, 0.12, [255, 220, 160], 0.05],
  ];
  for (const [t, rr, c, a] of ghosts) {
    const gx = sx + (sx - cx) * t;
    const gy = sy + (sy - cy) * t;
    bokehDisc(x, gx, gy, rr * w, c, a * strength, w * 10, h * 10);
  }
}

/** colour light that wraps over the edges of a silhouette from the background behind it */
function lightWrap(x: Ctx, bg: HTMLCanvasElement, mask: HTMLCanvasElement, r: number, a: number) {
  const wrap = blur(bg, r, true);
  const wx = wrap.getContext('2d') as Ctx;
  wx.globalCompositeOperation = 'destination-out';
  wx.drawImage(blur(mask, r * 0.8), 0, 0);
  wx.globalCompositeOperation = 'destination-in';
  wx.drawImage(mask, 0, 0);
  comp(x, wrap, 'screen', a);
}

// ---------------------------------------------------------------- the darkroom

interface Develop {
  /** highlight bloom strength and threshold (0..1 of max channel) */
  bloom: number;
  bloomT: number;
  /** filmic S-curve strength (~0..1), black lift, highlight shoulder */
  contrast: number;
  lift: number;
  shoulder: number;
  sat: number;
  vignette: number;
  grain: number;
  /** warm(+)/cool(-) white balance shift */
  warmth?: number;
}

const NOISE_TILE = 512;
let tile: Float32Array | null = null;
/** shared tile of triangular-distributed noise, -1..1 */
function noiseTile(): Float32Array {
  if (!tile) {
    const r = prng(0x51ed270b);
    tile = new Float32Array(NOISE_TILE * NOISE_TILE);
    for (let i = 0; i < tile.length; i++) tile[i] = r() + r() - 1;
  }
  return tile;
}

function develop(x: Ctx, w: number, h: number, o: Develop, seed: number) {
  if (o.bloom > 0) {
    const f = 5;
    const [s, sx] = mk(w / f, h / f);
    sx.drawImage(x.canvas, 0, 0, s.width, s.height);
    const id = sx.getImageData(0, 0, s.width, s.height);
    const d = id.data;
    const t = o.bloomT * 255;
    for (let i = 0; i < d.length; i += 4) {
      const l = Math.max(d[i], d[i + 1], d[i + 2]);
      const k = l <= t ? 0 : Math.pow((l - t) / (255 - t), 1.4);
      d[i] *= k;
      d[i + 1] *= k;
      d[i + 2] *= k;
    }
    sx.putImageData(id, 0, 0);
    comp(x, blur(s, 3, true), 'screen', o.bloom);
    comp(x, blur(s, 12, true), 'screen', o.bloom * 0.9);
  }
  // tone curve LUT (logistic S, normalised), with lifted blacks and a soft shoulder
  const k = 2 + o.contrast * 6;
  const lo = 1 / (1 + Math.exp(k * 0.5));
  const hi = 1 / (1 + Math.exp(-k * 0.5));
  const lut = new Float32Array(256);
  for (let v = 0; v < 256; v++) {
    const n = v / 255;
    const s = (1 / (1 + Math.exp(-k * (n - 0.5))) - lo) / (hi - lo);
    const m = n + (s - n) * 0.85;
    lut[v] = (o.lift + m * (1 - o.lift - o.shoulder)) * 255;
  }
  const vx = new Float32Array(w);
  for (let i = 0; i < w; i++) vx[i] = ((i / w - 0.5) * 2) ** 2;
  const img = x.getImageData(0, 0, w, h);
  const d = img.data;
  const N = noiseTile();
  const TM = NOISE_TILE - 1;
  const ox = (seed * 131) & TM;
  const oy = (seed * 71) & TM;
  const wr = 1 + (o.warmth ?? 0) * 0.06;
  const wb = 1 - (o.warmth ?? 0) * 0.08;
  const aspect = h / w;
  for (let y = 0; y < h; y++) {
    const vy = ((y / h - 0.5) * 2) ** 2 * aspect;
    let i = y * w * 4;
    for (let xx = 0; xx < w; xx++, i += 4) {
      let r = d[i] * wr;
      let g = d[i + 1];
      let b = d[i + 2] * wb;
      const l0 = r * 0.3 + g * 0.59 + b * 0.11;
      r = l0 + (r - l0) * o.sat;
      g = l0 + (g - l0) * o.sat;
      b = l0 + (b - l0) * o.sat;
      const vv = (vx[xx] + vy) / (1 + aspect);
      const vig = 1 - o.vignette * vv * vv * 1.6 - o.vignette * vv * 0.35;
      r = lut[r < 0 ? 0 : r > 255 ? 255 : r | 0] * vig;
      g = lut[g < 0 ? 0 : g > 255 ? 255 : g | 0] * vig;
      b = lut[b < 0 ? 0 : b > 255 ? 255 : b | 0] * vig;
      const l = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
      const amp = o.grain * (0.45 + 2.2 * l * (1 - l));
      const ty = ((y + oy) & TM) * NOISE_TILE;
      const tx = (xx + ox) & TM;
      const n = N[ty + tx] * amp;
      const cn = o.grain * 0.4 * (1 - l) * (1 - l);
      d[i] = r + n + N[ty + ((tx + 211) & TM)] * cn;
      d[i + 1] = g + n + N[ty + ((tx + 89) & TM)] * cn;
      d[i + 2] = b + n * 1.08 + N[ty + ((tx + 353) & TM)] * cn;
    }
  }
  x.putImageData(img, 0, 0);
}

// ---------------------------------------------------------------- people (soft, faceless silhouettes)

interface Figure {
  hair: 'long' | 'bun' | 'short' | 'cap';
  arm?: 'phone' | 'wave' | 'none';
  /** slight body turn, -1..1 (narrows shoulders) */
  turn?: number;
  tilt?: number;
}
/** a person seen from behind, waist up; `sy` is the shoulder line, `s` half the shoulder width */
function person(x: Ctx, cx: number, sy: number, s: number, f: Figure) {
  const sq = 1 - Math.abs(f.turn ?? 0) * 0.25;
  x.save();
  x.translate(cx, sy);
  x.rotate(f.tilt ?? 0);
  x.scale(s * sq, s);
  x.beginPath();
  x.moveTo(-0.2, -0.72);
  x.lineTo(-0.26, -0.5);
  x.quadraticCurveTo(-0.62, -0.4, -0.86, -0.28);
  x.quadraticCurveTo(-1.1, -0.16, -1.12, 0.22);
  x.lineTo(-1.14, 1.5);
  x.lineTo(-1.04, 6);
  x.lineTo(1.04, 6);
  x.lineTo(1.14, 1.5);
  x.lineTo(1.12, 0.22);
  x.quadraticCurveTo(1.1, -0.16, 0.86, -0.28);
  x.quadraticCurveTo(0.62, -0.4, 0.26, -0.5);
  x.lineTo(0.2, -0.72);
  x.closePath();
  x.fill();
  x.fillRect(-0.19, -0.95, 0.38, 0.5);
  x.beginPath();
  x.ellipse((f.turn ?? 0) * 0.08, -1.2, 0.35, 0.43, 0, 0, Math.PI * 2);
  x.fill();
  if (f.hair === 'long') {
    x.beginPath();
    x.moveTo(-0.38, -1.35);
    x.bezierCurveTo(-0.52, -0.9, -0.6, -0.2, -0.48, 0.3);
    x.lineTo(0.48, 0.3);
    x.bezierCurveTo(0.6, -0.2, 0.52, -0.9, 0.38, -1.35);
    x.closePath();
    x.fill();
    x.beginPath();
    x.ellipse(0, -1.27, 0.4, 0.46, 0, 0, Math.PI * 2);
    x.fill();
  } else if (f.hair === 'bun') {
    x.beginPath();
    x.arc(0.04, -1.74, 0.2, 0, Math.PI * 2);
    x.fill();
  } else if (f.hair === 'cap') {
    x.beginPath();
    x.ellipse(0, -1.4, 0.4, 0.28, 0, Math.PI, 0);
    x.fillRect(-0.05, -1.42, 0.62, 0.08);
    x.fill();
  } else {
    x.beginPath();
    x.ellipse(0, -1.3, 0.38, 0.4, 0, 0, Math.PI * 2);
    x.fill();
  }
  x.lineCap = 'round';
  x.lineJoin = 'round';
  x.strokeStyle = x.fillStyle;
  if (f.arm === 'phone') {
    x.lineWidth = 0.38;
    x.beginPath();
    x.moveTo(0.75, 0.1);
    x.lineTo(1.25, -1.1);
    x.lineTo(1.02, -2.45);
    x.stroke();
    x.save();
    x.translate(1.0, -2.85);
    x.rotate(0.12);
    x.beginPath();
    x.roundRect(-0.2, -0.36, 0.4, 0.72, 0.06);
    x.fill();
    x.restore();
  } else if (f.arm === 'wave') {
    x.lineWidth = 0.28;
    x.beginPath();
    x.moveTo(-0.75, 0.1);
    x.lineTo(-1.35, -0.95);
    x.lineTo(-1.55, -2.2);
    x.stroke();
    x.beginPath();
    x.ellipse(-1.58, -2.42, 0.16, 0.22, -0.2, 0, Math.PI * 2);
    x.fill();
  }
  x.restore();
}

// ---------------------------------------------------------------- scenes

/** golden hour: three friends backlit in a field, sun flare between them */
function goldenHour(x: Ctx, r: Rnd, w: number, h: number) {
  const hz = h * 0.66;
  const sx = w * 0.6;
  const sy = h * 0.5;
  vband(x, w, 0, hz + 4, [[0, '#6f8297'], [0.3, '#b99a80'], [0.62, '#e7b57c'], [1, '#ffd79a']]);
  // thin high cloud streaks, warm-lit
  const clouds = field(180, 90, (u, v) => {
    const n = fbm(u * 3, v * 14, 11, 5);
    const a = smooth(0.55, 0.78, n) * smooth(0.0, 0.25, v) * (1 - smooth(0.55, 0.95, v));
    return [255, 214, 170, a * 0.55];
  });
  x.drawImage(clouds, 0, 0, w, hz * 0.85);
  glow(x, sx, sy, w * 1.1, h * 0.85, [255, 180, 100], 0.32);
  glow(x, sx, sy, w * 0.3, h * 0.26, [255, 228, 170], 0.6);
  // distant tree line, lost in haze
  for (let layer = 0; layer < 2; layer++) {
    const [t, tx] = mk(w, h);
    tx.fillStyle = layer ? '#8a6248' : '#b98d6c';
    tx.beginPath();
    tx.moveTo(0, hz + 6);
    let px = 0;
    while (px <= w + 20) {
      const top = hz - (layer ? 14 : 30) - fbm(px * 0.012, layer * 9, 21 + layer) * (layer ? 40 : 60);
      tx.lineTo(px, top);
      px += 6;
    }
    tx.lineTo(w, hz + 6);
    tx.closePath();
    tx.fill();
    comp(x, blur(t, layer ? 2.2 : 3.5), 'source-over', layer ? 0.75 : 0.55);
  }
  // field
  vband(x, w, hz, h, [[0, '#d4a46a'], [0.18, '#9c6c40'], [0.6, '#4f331f'], [1, '#2a1a10']]);
  glow(x, sx, hz + 10, w * 0.6, h * 0.12, [255, 200, 130], 0.45);
  // grass: dark stems with sun-caught tips; the nearest rows are out of focus
  for (let row = 0; row < 3; row++) {
    const [g, gx] = mk(w, h);
    const n = [900, 520, 160][row];
    const y0 = [hz + 8, hz + 50, h * 0.92][row];
    const len = [26, 70, 190][row];
    for (let i = 0; i < n; i++) {
      const bx = r() * w;
      const by = y0 + r() * (h - y0) * (row === 2 ? 0.3 : 0.8);
      const l = len * between(r, 0.5, 1.2);
      const bend = between(r, -0.35, 0.35) * l;
      gx.strokeStyle = rgba(mixc([42, 26, 14], [110, 72, 38], r() * 0.6), 0.9);
      gx.lineWidth = between(r, 0.8, 2.2) * (row + 1) * 0.7;
      gx.beginPath();
      gx.moveTo(bx, by);
      gx.quadraticCurveTo(bx + bend * 0.3, by - l * 0.6, bx + bend, by - l);
      gx.stroke();
      // backlit seed head
      const near = 1 - Math.min(1, Math.abs(bx - sx) / (w * 0.6));
      gx.strokeStyle = rgba([255, 205, 130], 0.25 + near * 0.6);
      gx.lineWidth *= 1.6;
      gx.beginPath();
      gx.moveTo(bx + bend * 0.85, by - l * 0.88);
      gx.lineTo(bx + bend, by - l);
      gx.stroke();
    }
    comp(x, blur(g, [0.6, 1.4, 7][row]), 'source-over', 1);
  }
  const bg = snapshot(x.canvas);
  // the friends
  const [p, pxx] = mk(w, h);
  pxx.fillStyle = '#1f130c';
  person(pxx, w * 0.27, h * 0.66, 78, { hair: 'long', arm: 'none', turn: 0.2, tilt: 0.03 });
  person(pxx, w * 0.47, h * 0.6, 70, { hair: 'bun', arm: 'phone', turn: -0.1, tilt: -0.02 });
  person(pxx, w * 0.77, h * 0.68, 74, { hair: 'short', arm: 'none', turn: 0.3, tilt: -0.06 });
  const soft = blur(p, 1.2);
  comp(x, soft, 'source-over', 1);
  lightWrap(x, bg, soft, 4, 0.55);
  // atmosphere: veiling glare lifts everything near the sun
  glow(x, sx, sy, w * 0.7, h * 0.6, [255, 186, 110], 0.16, 'screen');
  // the sun itself, peeking between them
  glow(x, sx, sy, w * 0.06, w * 0.06, [255, 250, 230], 0.95);
  flare(x, sx, sy, w, h, 0.9, [255, 200, 140]);
}

/** city lights at night, thrown completely out of focus */
function cityBokeh(x: Ctx, r: Rnd, w: number, h: number) {
  vband(x, w, 0, h, [[0, '#060814'], [0.45, '#141024'], [0.8, '#24131f'], [1, '#160b10']]);
  // buildings with lit windows, then defocused into soft glows
  const [b, bx] = mk(w, h);
  let px = -20;
  while (px < w) {
    const bw = between(r, 50, 130);
    const top = h * between(r, 0.18, 0.5);
    bx.fillStyle = 'rgba(30,28,48,1)';
    bx.fillRect(px, top, bw, h - top);
    for (let wy = top + 10; wy < h * 0.82; wy += 14) {
      for (let wx = px + 6; wx < px + bw - 8; wx += 12) {
        if (r() < 0.42) {
          bx.fillStyle = rgba(r() < 0.75 ? [255, 196, 120] : [180, 220, 255], between(r, 0.4, 1));
          bx.fillRect(wx, wy, 6, 7);
        }
      }
    }
    px += bw + between(r, 0, 12);
  }
  comp(x, blur(b, 16, true), 'lighter', 0.85);
  // street glow
  glow(x, w * 0.5, h * 0.95, w * 0.9, h * 0.3, [255, 120, 60], 0.35);
  // bokeh: a few big foreground discs, many small ones behind
  const [k, kx] = mk(w, h);
  kx.globalCompositeOperation = 'lighter';
  const pal: RGB[] = [[255, 168, 70], [255, 214, 160], [255, 96, 80], [90, 200, 230], [255, 120, 190], [255, 190, 90]];
  for (let i = 0; i < 150; i++) {
    const t = Math.pow(r(), 2.4);
    const rad = 7 + t * 62;
    const y = h * (0.18 + r() * 0.7) - t * h * 0.05;
    const c = pal[(r() * pal.length) | 0];
    bokehDisc(kx, r() * w, y, rad, c, 0.2 + (1 - t) * 0.35, w, h);
  }
  comp(x, blur(k, 1.1), 'lighter', 1);
  // tail lights smearing along the street
  for (let i = 0; i < 9; i++) {
    const y = h * between(r, 0.84, 0.95);
    glow(x, r() * w, y, between(r, 30, 90), between(r, 5, 10), r() < 0.6 ? [255, 50, 40] : [255, 200, 120], 0.5);
  }
  glow(x, w * 0.5, h * 0.4, w * 0.8, h * 0.5, [120, 80, 200], 0.08);
}

/** beach at sunset: sun on the horizon, glitter path, wet sand mirror, two walkers */
function beachSunset(x: Ctx, r: Rnd, w: number, h: number) {
  const hz = h * 0.55;
  const sx = w * 0.56;
  vband(x, w, 0, hz, [[0, '#271a45'], [0.28, '#5b2f63'], [0.58, '#c4566a'], [0.82, '#f58a52'], [1, '#ffcf7e']]);
  // cloud bands, lit from below by the sun
  const clouds = field(220, 110, (u, v) => {
    const n = fbm(u * 2.4 + fbm(u * 3, v * 3, 4) * 0.6, v * 9, 7, 6);
    const a = smooth(0.5, 0.72, n) * smooth(0.08, 0.3, v) * (1 - smooth(0.7, 0.95, v));
    const lit = smooth(0.3, 0.95, v) * (0.6 + 0.4 * (1 - Math.abs(u - 0.56) * 1.5));
    const c = mixc([70, 38, 82], [255, 150, 120], clamp01(lit));
    return [c[0], c[1], c[2], a * 0.85];
  });
  x.drawImage(clouds, 0, 0, w, hz);
  glow(x, sx, hz, w * 1.1, h * 0.55, [255, 150, 80], 0.45);
  glow(x, sx, hz - 6, w * 0.3, h * 0.2, [255, 220, 150], 0.6);
  // the sun, half sunk
  x.save();
  x.beginPath();
  x.rect(0, 0, w, hz);
  x.clip();
  glow(x, sx, hz - 4, 46, 46, [255, 250, 225], 1);
  x.fillStyle = '#fff6d8';
  x.beginPath();
  x.arc(sx, hz + 4, 26, 0, Math.PI * 2);
  x.fill();
  x.restore();
  // sea
  const seaB = h * 0.79;
  vband(x, w, hz, seaB, [[0, '#d8784f'], [0.15, '#8e4158'], [0.6, '#4a2448'], [1, '#2b1734']]);
  glow(x, sx, hz + 4, w * 0.5, h * 0.06, [255, 170, 100], 0.5);
  // swell: thin dark and light lines, closer together near the horizon
  for (let i = 0; i < 160; i++) {
    const t = Math.pow(r(), 1.7);
    const y = hz + 2 + t * (seaB - hz);
    x.fillStyle = r() < 0.5 ? `rgba(20,8,30,${0.12 + t * 0.15})` : `rgba(255,170,140,${0.05 + (1 - t) * 0.08})`;
    x.fillRect(r() * w - 60, y, between(r, 60, 260) * (0.4 + t), 1 + t * 2.4);
  }
  // sun glitter
  x.save();
  x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 900; i++) {
    const t = Math.pow(r(), 1.4);
    const y = hz + 2 + t * (seaB - hz);
    const spread = 6 + t * 120;
    const gx = sx + gauss(r) * spread;
    const near = 1 - Math.min(1, Math.abs(gx - sx) / (spread * 1.2));
    x.fillStyle = rgba([255, 214, 150], (0.25 + 0.55 * near) * (1 - t * 0.5));
    x.fillRect(gx, y, between(r, 3, 16) * (0.4 + t * 1.4), 0.8 + t * 1.8);
  }
  x.restore();
  // wet sand mirrors the sky
  vband(x, w, seaB, h, [[0, '#7a3e4e'], [0.3, '#4a2533'], [1, '#22121a']]);
  x.save();
  x.globalAlpha = 0.35;
  x.translate(0, seaB * 2 - hz * 0.2);
  x.scale(1, -0.6);
  x.drawImage(x.canvas, 0, hz * 0.4, w, hz * 0.6, 0, hz * 0.4, w, hz * 0.6);
  x.restore();
  glow(x, sx, h * 0.86, w * 0.08, h * 0.16, [255, 190, 120], 0.45);
  // foam lines
  const [fm, fx] = mk(w, h);
  for (let j = 0; j < 3; j++) {
    const y0 = seaB + j * 12 + 2;
    fx.strokeStyle = `rgba(255,236,220,${0.55 - j * 0.15})`;
    fx.lineWidth = 2.4 - j * 0.6;
    fx.beginPath();
    for (let xx = -10; xx <= w + 10; xx += 10) {
      const yy = y0 + Math.sin(xx * 0.012 + j * 2) * 4 + fbm(xx * 0.02, j, 5) * 6;
      if (xx < 0) fx.moveTo(xx, yy);
      else fx.lineTo(xx, yy);
    }
    fx.stroke();
  }
  comp(x, blur(fm, 1.3), 'screen', 1);
  // two walkers at the waterline, with reflections
  const [p, pxx] = mk(w, h);
  pxx.fillStyle = '#1d0f17';
  const walker = (cx: number, base: number, s: number, lean: number) => {
    pxx.save();
    pxx.translate(cx, base);
    pxx.rotate(lean);
    pxx.beginPath();
    pxx.ellipse(0, -s * 4.2, s * 0.42, s * 0.52, 0, 0, Math.PI * 2);
    pxx.fill();
    pxx.beginPath();
    pxx.roundRect(-s * 0.55, -s * 3.6, s * 1.1, s * 2.0, s * 0.4);
    pxx.fill();
    pxx.lineCap = 'round';
    pxx.strokeStyle = '#1d0f17';
    pxx.lineWidth = s * 0.42;
    pxx.beginPath();
    pxx.moveTo(-s * 0.2, -s * 1.8);
    pxx.lineTo(-s * 0.6, 0);
    pxx.moveTo(s * 0.2, -s * 1.8);
    pxx.lineTo(s * 0.55, -s * 0.05);
    pxx.stroke();
    pxx.restore();
  };
  walker(w * 0.27, seaB + 26, 10, 0.03);
  walker(w * 0.3, seaB + 27, 9.4, -0.04);
  comp(x, blur(p, 0.8), 'source-over', 0.95);
  x.save();
  x.globalAlpha = 0.3;
  x.translate(0, (seaB + 27) * 2);
  x.scale(1, -1);
  x.drawImage(blur(p, 2.5), 0, 0);
  x.restore();
  flare(x, sx, hz - 4, w, h, 0.5, [255, 170, 110]);
}

/** concert: volumetric beams through haze, a crowd with hands and phones up */
function concert(x: Ctx, r: Rnd, w: number, h: number) {
  vband(x, w, 0, h, [[0, '#07050d'], [0.6, '#0d0816'], [1, '#05040a']]);
  const haze = field(150, 117, (u, v) => {
    const n = fbm(u * 3.2, v * 3.2, 41, 5);
    return [255, 255, 255, 0.35 + n * 0.85];
  });
  const [beams, bx] = mk(w, h);
  bx.globalCompositeOperation = 'lighter';
  const rigs: [number, RGB, number][] = [
    [0.12, [255, 60, 170], 0.5],
    [0.3, [80, 110, 255], 0.2],
    [0.5, [255, 176, 70], 0.0],
    [0.7, [80, 110, 255], -0.2],
    [0.88, [255, 60, 170], -0.5],
  ];
  const top = h * 0.07;
  for (const [u, c, ang] of rigs) {
    for (let k = 0; k < 2; k++) {
      const a = ang + (k ? -0.35 : 0.25) * (u < 0.5 ? 1 : -1);
      const len = h * 1.15;
      const ex = w * u + Math.sin(a) * len;
      const ey = top + Math.cos(a) * len;
      const spread = w * 0.09;
      const g = bx.createLinearGradient(w * u, top, ex, ey);
      g.addColorStop(0, rgba(c, 0.55));
      g.addColorStop(0.35, rgba(c, 0.2));
      g.addColorStop(1, rgba(c, 0));
      bx.fillStyle = g;
      bx.beginPath();
      bx.moveTo(w * u - 4, top);
      bx.lineTo(ex - spread * Math.cos(a), ey + spread * Math.sin(a));
      bx.lineTo(ex + spread * Math.cos(a), ey - spread * Math.sin(a));
      bx.lineTo(w * u + 4, top);
      bx.closePath();
      bx.fill();
    }
  }
  const bb = blur(beams, 9);
  const bbx = bb.getContext('2d') as Ctx;
  bbx.globalCompositeOperation = 'destination-in';
  bbx.drawImage(haze, 0, 0, w, h);
  comp(x, bb, 'lighter', 1);
  // general haze glow
  glow(x, w * 0.5, h * 0.3, w * 0.8, h * 0.4, [150, 70, 200], 0.18);
  // truss + fixtures
  x.fillStyle = '#05040a';
  x.fillRect(0, top - 16, w, 10);
  for (const [u, c] of rigs) {
    x.fillStyle = '#0b0910';
    x.fillRect(w * u - 12, top - 8, 24, 12);
    glow(x, w * u, top + 4, 34, 22, c, 0.9);
    glow(x, w * u, top + 4, 9, 7, [255, 255, 255], 1);
  }
  const bg = snapshot(x.canvas);
  // crowd
  const [p, pxx] = mk(w, h);
  pxx.fillStyle = '#06040a';
  pxx.strokeStyle = '#06040a';
  pxx.lineCap = 'round';
  const phones: [number, number][] = [];
  for (let row = 0; row < 3; row++) {
    const base = h * (0.7 + row * 0.1);
    const s = 24 + row * 14;
    for (let cx = -20 + r() * 30; cx < w + 30; cx += s * between(r, 1.6, 2.3)) {
      const hy = base - s * between(r, 1.2, 1.7);
      pxx.beginPath();
      pxx.ellipse(cx, hy, s * 0.42, s * 0.5, 0, 0, Math.PI * 2);
      pxx.fill();
      pxx.beginPath();
      pxx.ellipse(cx, base + s * 1.4, s * 1.05, s * 1.9, 0, 0, Math.PI * 2);
      pxx.fill();
      if (r() < 0.32) {
        const hand = r() < 0.5 ? -1 : 1;
        const tx = cx + hand * s * between(r, 0.6, 1.2);
        const ty = hy - s * between(r, 1.8, 2.8);
        pxx.lineWidth = s * 0.28;
        pxx.beginPath();
        pxx.moveTo(cx + hand * s * 0.6, base);
        pxx.quadraticCurveTo(cx + hand * s * 1.1, hy, tx, ty);
        pxx.stroke();
        if (r() < 0.45) phones.push([tx, ty - s * 0.3]);
        else {
          pxx.beginPath();
          pxx.ellipse(tx, ty - s * 0.2, s * 0.2, s * 0.28, 0, 0, Math.PI * 2);
          pxx.fill();
        }
      }
    }
  }
  for (const [tx, ty] of phones) {
    pxx.fillRect(tx - 4, ty - 7, 8, 14);
  }
  const soft = blur(p, 1.3);
  comp(x, soft, 'source-over', 1);
  lightWrap(x, bg, soft, 9, 1);
  for (const [tx, ty] of phones) {
    x.fillStyle = 'rgba(200,220,255,0.55)';
    x.fillRect(tx - 3, ty - 5, 6, 10);
    glow(x, tx, ty, 18, 18, [190, 210, 255], 0.2);
  }
  // confetti catching the light
  for (let i = 0; i < 70; i++) {
    const c: RGB = r() < 0.5 ? [255, 220, 140] : [255, 150, 210];
    x.fillStyle = rgba(c, between(r, 0.3, 0.8));
    x.save();
    x.translate(r() * w, h * between(r, 0.12, 0.6));
    x.rotate(r() * 6);
    x.fillRect(-3, -1.5, 6, 3);
    x.restore();
  }
}

/** café table by the window: morning light, a cup, rising steam */
function cafeWindow(x: Ctx, r: Rnd, w: number, h: number) {
  const tableY = h * 0.6;
  // room
  vband(x, w, 0, h, [[0, '#4a3324'], [0.6, '#3a271b'], [1, '#2a1b12']]);
  // the window, overexposed and out of focus
  const [win, wx] = mk(w, h);
  const W0 = -20;
  const W1 = w * 0.6;
  const g = wx.createLinearGradient(0, 0, 0, tableY);
  g.addColorStop(0, '#fff7e4');
  g.addColorStop(1, '#ffe8bf');
  wx.fillStyle = g;
  wx.fillRect(W0, -10, W1 - W0, tableY + 10);
  const leaves = field(120, 80, (u, v) => {
    const n = fbm(u * 5, v * 5, 77, 5);
    const a = smooth(0.48, 0.7, n) * (0.35 + v * 0.5);
    return [120 + n * 60, 150 + n * 50, 80, a * 0.65];
  });
  wx.drawImage(leaves, W0, -10, W1 - W0, tableY + 10);
  wx.fillStyle = '#2b1d14';
  wx.fillRect(W1 - 6, -10, 26, tableY + 10);
  wx.fillRect(w * 0.27, -10, 12, tableY + 10);
  wx.fillRect(W0, h * 0.28, W1 - W0, 10);
  comp(x, blur(win, 7, true), 'source-over', 1);
  glow(x, w * 0.3, h * 0.3, w * 0.5, h * 0.45, [255, 236, 200], 0.5);
  // interior: pendant lamps and shelves, far behind
  const [bk, kx] = mk(w, h);
  kx.fillStyle = '#22160f';
  kx.fillRect(w * 0.64, h * 0.32, w * 0.4, 8);
  kx.fillRect(w * 0.64, h * 0.47, w * 0.4, 8);
  for (let i = 0; i < 14; i++) {
    kx.fillStyle = rgba(mixc([70, 50, 40], [150, 100, 60], r()), 1);
    const bx0 = w * 0.66 + r() * w * 0.32;
    const shelf = r() < 0.5 ? h * 0.32 : h * 0.47;
    kx.fillRect(bx0, shelf - between(r, 30, 60), between(r, 12, 22), 60);
  }
  comp(x, blur(bk, 8), 'source-over', 1);
  for (let i = 0; i < 4; i++) bokehDisc(x, w * (0.7 + i * 0.09), h * (0.1 + (i % 2) * 0.05), 22 + i * 3, [255, 180, 90], 0.55, w, h);
  // table: wood with grain, lit by a window-shaped patch of sun
  const [tb, tbx] = mk(w, h);
  vband(tbx, w, tableY, h, [[0, '#8a5a34'], [0.4, '#6a4226'], [1, '#3c2414']]);
  const grain = field(80, 200, (u, v) => {
    const n = fbm(u * 2, v * 30, 13, 4);
    return n > 0.5 ? [40, 20, 8, (n - 0.5) * 0.9] : [220, 160, 110, (0.5 - n) * 0.4];
  });
  tbx.drawImage(grain, 0, tableY, w, h - tableY);
  tbx.fillStyle = 'rgba(255,220,170,0.35)';
  tbx.fillRect(0, tableY, w, 2);
  x.drawImage(tb, 0, 0);
  const [sun, sunx] = mk(w, h);
  sunx.fillStyle = 'rgba(255,214,150,1)';
  sunx.beginPath();
  sunx.moveTo(w * 0.02, tableY + 8);
  sunx.lineTo(w * 0.58, tableY + 8);
  sunx.lineTo(w * 0.92, h);
  sunx.lineTo(w * 0.12, h);
  sunx.closePath();
  sunx.fill();
  sunx.globalCompositeOperation = 'destination-out';
  sunx.fillStyle = '#000';
  sunx.save();
  sunx.transform(1, 0, 0.55, 1, 0, 0);
  sunx.fillRect(w * 0.12, tableY, 16, h);
  sunx.restore();
  sunx.fillRect(0, h * 0.82, w, 12);
  comp(x, blur(sun, 9), 'soft-light', 0.9);
  comp(x, blur(sun, 14), 'screen', 0.22);
  // cup shadow, cast away from the window
  const cx = w * 0.6;
  const rimY = h * 0.52;
  const baseY = h * 0.72;
  const [sh, shx] = mk(w, h);
  shx.fillStyle = 'rgba(25,12,5,0.75)';
  shx.beginPath();
  shx.ellipse(cx + 70, baseY + 12, 150, 28, 0.08, 0, Math.PI * 2);
  shx.fill();
  comp(x, blur(sh, 12), 'multiply', 0.85);
  // saucer
  const sg = x.createLinearGradient(cx - 150, 0, cx + 150, 0);
  sg.addColorStop(0, '#fffaf2');
  sg.addColorStop(0.6, '#e7dcd0');
  sg.addColorStop(1, '#a89888');
  x.fillStyle = '#7d6c5e';
  x.beginPath();
  x.ellipse(cx, baseY + 6, 150, 34, 0, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = sg;
  x.beginPath();
  x.ellipse(cx, baseY, 148, 32, 0, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = 'rgba(120,100,85,0.35)';
  x.beginPath();
  x.ellipse(cx + 4, baseY - 2, 82, 16, 0, 0, Math.PI * 2);
  x.fill();
  // handle
  x.lineWidth = 16;
  x.strokeStyle = '#d9cec2';
  x.beginPath();
  x.ellipse(cx + 92, rimY + 62, 30, 34, -0.2, -1.4, 1.5);
  x.stroke();
  x.lineWidth = 5;
  x.strokeStyle = 'rgba(255,255,255,0.6)';
  x.beginPath();
  x.ellipse(cx + 90, rimY + 60, 30, 34, -0.2, -1.2, 0.2);
  x.stroke();
  // body
  const bodyG = x.createLinearGradient(cx - 95, 0, cx + 95, 0);
  bodyG.addColorStop(0, '#fffdf8');
  bodyG.addColorStop(0.18, '#fbf3e8');
  bodyG.addColorStop(0.55, '#e3d6c8');
  bodyG.addColorStop(0.85, '#a69584');
  bodyG.addColorStop(1, '#8a7a6b');
  x.fillStyle = bodyG;
  x.beginPath();
  x.moveTo(cx - 95, rimY);
  x.bezierCurveTo(cx - 95, rimY + 90, cx - 78, baseY - 6, cx - 40, baseY - 4);
  x.lineTo(cx + 40, baseY - 4);
  x.bezierCurveTo(cx + 78, baseY - 6, cx + 95, rimY + 90, cx + 95, rimY);
  x.closePath();
  x.fill();
  glow(x, cx - 58, rimY + 58, 14, 60, [255, 255, 255], 0.55, 'screen');
  // rim + coffee
  x.fillStyle = '#f6eee4';
  x.beginPath();
  x.ellipse(cx, rimY, 95, 22, 0, 0, Math.PI * 2);
  x.fill();
  const cg = x.createRadialGradient(cx - 10, rimY + 2, 4, cx, rimY + 3, 88);
  cg.addColorStop(0, '#9a6a44');
  cg.addColorStop(0.55, '#6e4326');
  cg.addColorStop(0.85, '#3a2213');
  cg.addColorStop(1, '#2a170c');
  x.fillStyle = cg;
  x.beginPath();
  x.ellipse(cx, rimY + 3, 86, 18, 0, 0, Math.PI * 2);
  x.fill();
  glow(x, cx - 30, rimY + 1, 26, 5, [255, 240, 220], 0.6, 'screen');
  // steam, backlit against the dark room
  const [st, stx] = mk(w, h);
  stx.lineCap = 'round';
  for (let k = 0; k < 7; k++) {
    let px = cx + between(r, -40, 40);
    let py = rimY - 4;
    const ph = r() * 6;
    stx.lineWidth = between(r, 8, 20);
    stx.strokeStyle = `rgba(255,248,236,${between(r, 0.1, 0.2)})`;
    stx.beginPath();
    stx.moveTo(px, py);
    for (let j = 0; j < 40; j++) {
      py -= 6;
      px += Math.sin(j * 0.22 + ph) * 3.2 + (j > 20 ? 1.5 : 0);
      stx.lineTo(px, py);
    }
    stx.stroke();
  }
  const stb = blur(st, 6);
  const stbx = stb.getContext('2d') as Ctx;
  stbx.globalCompositeOperation = 'destination-in';
  const fade = stbx.createLinearGradient(0, rimY, 0, rimY - 260);
  fade.addColorStop(0, 'rgba(0,0,0,0.9)');
  fade.addColorStop(0.3, 'rgba(0,0,0,1)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  stbx.fillStyle = fade;
  stbx.fillRect(0, 0, w, h);
  comp(x, stb, 'screen', 1);
  // a soft out-of-focus foreground edge (another cup, a plant) on the right
  const [fg, fgx] = mk(w, h);
  fgx.fillStyle = '#1c120c';
  fgx.beginPath();
  fgx.ellipse(w * 1.02, h * 0.95, w * 0.14, h * 0.35, 0, 0, Math.PI * 2);
  fgx.fill();
  comp(x, blur(fg, 18), 'source-over', 0.9);
}

/** rooftop at the end of the afternoon: tall clouds, string lights, someone on the ledge */
function rooftopSky(x: Ctx, r: Rnd, w: number, h: number) {
  vband(x, w, 0, h, [[0, '#2b63a8'], [0.45, '#6e9fd0'], [0.75, '#c7d6df'], [1, '#f2dcc2']]);
  glow(x, w * 0.92, h * 0.62, w * 0.7, h * 0.5, [255, 214, 160], 0.45);
  // cumulus: density + a self-shadowing lookup toward the sun
  const sunU = 0.95;
  const sunV = 0.6;
  const cloud = field(260, 202, (u, v) => {
    const q = (uu: number, vv: number) => {
      const warp = fbm(uu * 2, vv * 2, 91, 3) * 0.5;
      return fbm(uu * 2.6 + warp, vv * 3.4 - warp, 57, 6) + 0.06 - Math.abs(vv - 0.5) * 0.4 + Math.abs(uu - 0.5) * 0.12;
    };
    const n = q(u, v);
    const dens = smooth(0.52, 0.66, n);
    if (dens <= 0.001) return [0, 0, 0, 0];
    const du = (sunU - u) * 0.03;
    const dv = (sunV - v) * 0.03;
    const occl = clamp01((q(u + du, v + dv) - n) * 9 + 0.5);
    const lit = clamp01(1 - occl * 0.9);
    const base = mixc([118, 132, 158], [255, 247, 236], lit);
    const warm = mixc(base, [255, 214, 170], clamp01(u - 0.55) * lit * 0.8);
    return [warm[0], warm[1], warm[2], dens];
  });
  x.drawImage(cloud, 0, -h * 0.05, w, h * 1.05);
  glow(x, w * 0.95, h * 0.6, w * 0.25, h * 0.2, [255, 236, 200], 0.4);
  // distant skyline in haze
  const [sk, skx] = mk(w, h);
  skx.fillStyle = '#8796a8';
  let px = -10;
  while (px < w) {
    const bw = between(r, 20, 60);
    const top = h * between(r, 0.66, 0.74);
    skx.fillRect(px, top, bw, h);
    px += bw + between(r, -4, 6);
  }
  comp(x, blur(sk, 1.6), 'source-over', 0.8);
  // rooftop ledge and railing, in shade
  const ledge = h * 0.8;
  vband(x, w, ledge, h, [[0, '#4e4a4c'], [0.06, '#3a3537'], [1, '#1f1b1d']]);
  x.fillStyle = 'rgba(255,214,170,0.55)';
  x.fillRect(0, ledge, w, 3);
  x.fillStyle = '#2a2628';
  x.fillRect(0, h * 0.7, w, 6);
  for (let rx = 10; rx < w; rx += 46) x.fillRect(rx, h * 0.7, 5, ledge - h * 0.7);
  // water tank on the right
  x.fillStyle = '#2b2527';
  x.beginPath();
  x.roundRect(w * 0.82, h * 0.44, w * 0.13, h * 0.2, 10);
  x.fill();
  x.beginPath();
  x.moveTo(w * 0.81, h * 0.45);
  x.lineTo(w * 0.885, h * 0.37);
  x.lineTo(w * 0.96, h * 0.45);
  x.fill();
  x.fillRect(w * 0.84, h * 0.64, 6, ledge - h * 0.64);
  x.fillRect(w * 0.93, h * 0.64, 6, ledge - h * 0.64);
  x.fillStyle = 'rgba(255,210,160,0.4)';
  x.fillRect(w * 0.95 - 4, h * 0.45, 4, h * 0.19);
  const bg = snapshot(x.canvas);
  // someone sitting on the ledge, looking out
  const [p, pxx] = mk(w, h);
  pxx.fillStyle = '#231d20';
  person(pxx, w * 0.36, h * 0.66, 46, { hair: 'cap', turn: 0.4, tilt: 0.05 });
  pxx.clearRect(0, ledge + 2, w, h);
  const soft = blur(p, 1);
  comp(x, soft, 'source-over', 1);
  lightWrap(x, bg, soft, 8, 0.8);
  // string lights in the foreground, slightly soft
  const [sl, slx] = mk(w, h);
  slx.strokeStyle = 'rgba(30,24,22,0.9)';
  slx.lineWidth = 2;
  slx.beginPath();
  const pts: [number, number][] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const yy = h * 0.08 + Math.sin(t * Math.PI) * h * 0.2 + t * h * 0.05;
    pts.push([t * w * 1.05 - 20, yy]);
    if (i === 0) slx.moveTo(t * w * 1.05 - 20, yy);
    else slx.lineTo(t * w * 1.05 - 20, yy);
  }
  slx.stroke();
  comp(x, blur(sl, 1.5), 'source-over', 1);
  for (let i = 1; i < pts.length; i += 3) {
    const [bx, by] = pts[i];
    glow(x, bx, by + 10, 26, 26, [255, 196, 120], 0.6);
    glow(x, bx, by + 10, 6, 8, [255, 244, 220], 1);
  }
}

/** neon signs on a rainy street, reflections smeared down the wet tarmac */
function neonRain(x: Ctx, r: Rnd, w: number, h: number) {
  const street = h * 0.6;
  vband(x, w, 0, street, [[0, '#05060c'], [0.6, '#0c0f1c'], [1, '#141629']]);
  // walls in perspective
  x.fillStyle = '#0d0e18';
  x.beginPath();
  x.moveTo(0, 0);
  x.lineTo(w * 0.3, h * 0.2);
  x.lineTo(w * 0.3, street);
  x.lineTo(0, h * 0.78);
  x.fill();
  x.fillStyle = '#10111d';
  x.beginPath();
  x.moveTo(w, 0);
  x.lineTo(w * 0.7, h * 0.18);
  x.lineTo(w * 0.7, street);
  x.lineTo(w, h * 0.8);
  x.fill();
  // far end of the street: a warm lamp in fog
  glow(x, w * 0.5, street - 40, w * 0.28, h * 0.22, [255, 170, 90], 0.45);
  glow(x, w * 0.5, street - 60, 18, 18, [255, 230, 190], 0.9);
  for (let i = 0; i < 18; i++) {
    const c: RGB = r() < 0.5 ? [255, 190, 120] : [140, 200, 255];
    glow(x, w * between(r, 0.32, 0.68), street - between(r, 10, 160), between(r, 5, 12), between(r, 4, 9), c, 0.6);
  }
  // neon tubes
  const [ne, nx] = mk(w, h);
  nx.lineCap = 'round';
  nx.lineJoin = 'round';
  const tube = (c: RGB, draw: () => void, lw: number) => {
    nx.strokeStyle = rgba(c, 1);
    nx.lineWidth = lw * 2.4;
    nx.globalAlpha = 0.5;
    draw();
    nx.stroke();
    nx.strokeStyle = rgba(mixc(c, [255, 255, 255], 0.7), 1);
    nx.lineWidth = lw;
    nx.globalAlpha = 1;
    draw();
    nx.stroke();
  };
  // left wall: "CÀ PHÊ" sign, skewed to the wall
  nx.save();
  nx.setTransform(1, 0.2, 0, 1, w * 0.06, h * 0.15);
  nx.font = `600 ${64}px "Bricolage Grotesque Variable", system-ui, sans-serif`;
  nx.shadowColor = rgba([255, 60, 140], 1);
  nx.shadowBlur = 16;
  nx.strokeStyle = rgba([255, 110, 180], 1);
  nx.lineWidth = 5;
  nx.strokeText('CÀ PHÊ', 0, 70);
  nx.shadowBlur = 0;
  nx.strokeStyle = 'rgba(255,225,240,1)';
  nx.lineWidth = 1.8;
  nx.strokeText('CÀ PHÊ', 0, 70);
  nx.restore();
  // right wall: a cyan arrow and a warm "24H" box
  nx.save();
  nx.setTransform(1, -0.18, 0, 1, w * 0.74, h * 0.2);
  tube([40, 220, 255], () => {
    nx.beginPath();
    nx.moveTo(10, 60);
    nx.lineTo(150, 60);
    nx.moveTo(110, 30);
    nx.lineTo(150, 60);
    nx.lineTo(110, 90);
  }, 4);
  tube([255, 176, 60], () => {
    nx.beginPath();
    nx.roundRect(20, 130, 130, 70, 12);
  }, 3.5);
  nx.font = `700 ${40}px "Geist Variable", system-ui, sans-serif`;
  nx.fillStyle = 'rgba(255,214,150,1)';
  nx.shadowColor = 'rgba(255,170,60,1)';
  nx.shadowBlur = 12;
  nx.fillText('24H', 46, 180);
  nx.restore();
  comp(x, blur(ne, 0.8), 'lighter', 1);
  comp(x, blur(ne, 10), 'lighter', 0.9);
  comp(x, blur(ne, 30, true), 'lighter', 0.6);
  // wet tarmac: mirror the scene, smear it vertically, break it up with puddles
  vband(x, w, street, h, [[0, '#121424'], [1, '#07080f']]);
  const above = snapshot(x.canvas);
  const [rf, rfx] = mk(w, h);
  rfx.save();
  rfx.translate(0, street);
  rfx.scale(1, -1.5);
  rfx.drawImage(above, 0, 0, w, street, 0, -street, w, street);
  rfx.restore();
  const smear = blur(rf, 4);
  const smx = smear.getContext('2d') as Ctx;
  for (let k = 1; k <= 4; k++) {
    smx.globalAlpha = 0.35;
    smx.drawImage(smear, 0, k * 6);
  }
  const puddles = field(140, 60, (u, v) => {
    const n = fbm(u * 4, v * 6, 66, 4);
    return [0, 0, 0, smooth(0.4, 0.6, n) * 0.85 + 0.15];
  });
  smx.globalAlpha = 1;
  smx.globalCompositeOperation = 'destination-in';
  smx.drawImage(puddles, 0, street, w, h - street);
  smx.globalCompositeOperation = 'destination-out';
  smx.fillStyle = '#000';
  smx.fillRect(0, 0, w, street);
  comp(x, smear, 'lighter', 0.85);
  // ripple glints
  for (let i = 0; i < 120; i++) {
    const yy = street + Math.pow(r(), 0.8) * (h - street);
    x.fillStyle = `rgba(255,255,255,${between(r, 0.03, 0.09)})`;
    x.fillRect(r() * w, yy, between(r, 8, 40), 1);
  }
  const bg = snapshot(x.canvas);
  // a figure with an umbrella, mid-street
  const [p, pxx] = mk(w, h);
  pxx.fillStyle = '#05050a';
  const fx0 = w * 0.47;
  const fy = h * 0.66;
  pxx.beginPath();
  pxx.ellipse(fx0, fy - 118, 13, 16, 0, 0, Math.PI * 2);
  pxx.fill();
  pxx.beginPath();
  pxx.roundRect(fx0 - 24, fy - 104, 48, 82, 14);
  pxx.fill();
  pxx.fillRect(fx0 - 16, fy - 30, 13, 34);
  pxx.fillRect(fx0 + 4, fy - 30, 13, 30);
  pxx.beginPath();
  pxx.moveTo(fx0 - 78, fy - 128);
  pxx.quadraticCurveTo(fx0 + 2, fy - 200, fx0 + 82, fy - 128);
  pxx.quadraticCurveTo(fx0 + 2, fy - 142, fx0 - 78, fy - 128);
  pxx.fill();
  pxx.fillRect(fx0 + 1, fy - 170, 3, 80);
  const soft = blur(p, 1.4);
  comp(x, soft, 'source-over', 0.95);
  lightWrap(x, bg, soft, 10, 1);
  x.save();
  x.globalAlpha = 0.35;
  x.translate(0, (fy + 4) * 2);
  x.scale(1, -1);
  x.drawImage(blur(p, 4), 0, 0);
  x.restore();
  // rain, lit by the signs
  const [rn, rnx] = mk(w, h);
  rnx.lineCap = 'round';
  for (let i = 0; i < 520; i++) {
    const rx = r() * w;
    const ry = r() * h;
    const l = between(r, 10, 30);
    rnx.strokeStyle = `rgba(220,230,255,${between(r, 0.08, 0.28)})`;
    rnx.lineWidth = between(r, 0.6, 1.4);
    rnx.beginPath();
    rnx.moveTo(rx, ry);
    rnx.lineTo(rx - l * 0.12, ry + l);
    rnx.stroke();
  }
  comp(x, blur(rn, 0.6), 'screen', 1);
  // big defocused drops on the lens
  for (let i = 0; i < 7; i++) bokehDisc(x, r() * w, r() * h * 0.6, between(r, 16, 34), r() < 0.5 ? [255, 120, 190] : [90, 220, 255], 0.1, w, h);
}

interface SceneDef {
  draw: Scene;
  dev: Develop;
}
const SCENES: SceneDef[] = [
  { draw: goldenHour, dev: { bloom: 0.55, bloomT: 0.7, contrast: 0.45, lift: 0.045, shoulder: 0.02, sat: 0.94, vignette: 0.32, grain: 9, warmth: 0.3 } },
  { draw: cityBokeh, dev: { bloom: 0.6, bloomT: 0.55, contrast: 0.5, lift: 0.025, shoulder: 0.0, sat: 1.05, vignette: 0.4, grain: 12 } },
  { draw: beachSunset, dev: { bloom: 0.55, bloomT: 0.68, contrast: 0.5, lift: 0.03, shoulder: 0.01, sat: 1.0, vignette: 0.38, grain: 9, warmth: 0.1 } },
  { draw: neonRain, dev: { bloom: 0.55, bloomT: 0.5, contrast: 0.55, lift: 0.03, shoulder: 0.0, sat: 1.06, vignette: 0.45, grain: 12 } },
  { draw: cafeWindow, dev: { bloom: 0.45, bloomT: 0.72, contrast: 0.45, lift: 0.04, shoulder: 0.02, sat: 0.95, vignette: 0.38, grain: 8, warmth: 0.25 } },
  { draw: concert, dev: { bloom: 0.75, bloomT: 0.45, contrast: 0.55, lift: 0.025, shoulder: 0.0, sat: 1.1, vignette: 0.45, grain: 13 } },
  { draw: rooftopSky, dev: { bloom: 0.3, bloomT: 0.8, contrast: 0.4, lift: 0.03, shoulder: 0.02, sat: 1.02, vignette: 0.3, grain: 7, warmth: 0.1 } },
];
export const SAMPLE_COUNT = SCENES.length;

const norm = (i: number) => ((i % SCENES.length) + SCENES.length) % SCENES.length;

/** renders one generated scene at full sample size */
function renderScene(idx: number): HTMLCanvasElement {
  const [c, x] = mk(SAMPLE_W, SAMPLE_H);
  if (!x) return c;
  const r = prng(0x9e3779b1 + idx * 7919);
  const def = SCENES[idx];
  def.draw(x, r, SAMPLE_W, SAMPLE_H);
  develop(x, SAMPLE_W, SAMPLE_H, def.dev, 0x2545f491 + idx * 977);
  return c;
}

const generated: (HTMLCanvasElement | undefined)[] = [];
const owner: (HTMLCanvasElement | undefined)[] = [];
function base(idx: number): HTMLCanvasElement {
  const o = owner[idx];
  if (o && o.width) return o;
  let g = generated[idx];
  if (!g || !g.width) g = generated[idx] = renderScene(idx);
  return g;
}

/** the demo photo `i` (owner photo when there is one), cover-cropped to `w` x `h` */
export function sceneCanvas(i: number, w = 480, h = 600): HTMLCanvasElement {
  const src = base(norm(i));
  const [c, x] = mk(w, h);
  if (!x) return c;
  const s = Math.max(w / src.width, h / src.height);
  const sw = w / s;
  const sh = h / s;
  x.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, w, h);
  return c;
}

// ---------------------------------------------------------------- owner photos (src/assets/demo)

const OWNER_URLS: string[] = (() => {
  const mods = import.meta.glob<string>('./assets/demo/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', { eager: true, query: '?url', import: 'default' });
  return Object.keys(mods)
    .sort()
    .map((k) => mods[k]);
})();

/** nudge the photo store so every live film canvas re-renders */
let bumpQueued = false;
function bump() {
  if (bumpQueued) return;
  bumpQueued = true;
  requestAnimationFrame(() => {
    bumpQueued = false;
    const t = document.createElement('canvas');
    t.width = t.height = 1;
    removePhoto(addPhoto(t, true).id);
  });
}

function loadOwnerPhotos(list: Photo[]) {
  if (!OWNER_URLS.length || typeof Image === 'undefined') return;
  OWNER_URLS.slice(0, list.length).forEach((url, i) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const long = 1600;
      const k = Math.min(1, long / Math.max(img.naturalWidth, img.naturalHeight));
      const [c, x] = mk(img.naturalWidth * k, img.naturalHeight * k);
      if (!x || !c.width || !c.height) return;
      x.drawImage(img, 0, 0, c.width, c.height);
      owner[i] = c;
      swapIn(list[i], c);
    };
    img.onerror = () => {
      /* unreadable file: keep the generated scene */
    };
    img.src = url;
  });
}

/** two-colour wash per scene, shown for the few frames before the real render lands */
const DRAFT: [string, string][] = [
  ['#b08a6a', '#3a2516'], ['#1a1430', '#2a1420'], ['#c4566a', '#3a1d38'], ['#0c0f1c', '#121424'],
  ['#e9dcc4', '#5a3a22'], ['#1a0f2a', '#07050d'], ['#6e9fd0', '#2f2a2c'],
];
function draft(idx: number): HTMLCanvasElement {
  const [c, x] = mk(SAMPLE_W / 4, SAMPLE_H / 4);
  if (!x) return c;
  const g = x.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(0, DRAFT[idx][0]);
  g.addColorStop(1, DRAFT[idx][1]);
  x.fillStyle = g;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

/** swap a finished canvas into a registered photo (same id, so every film using it simply re-renders) */
function swapIn(p: Photo, c: HTMLCanvasElement) {
  p.canvas = c;
  p.w = c.width;
  p.h = c.height;
  bump();
}

/** develop the generated scenes one per idle slot so start-up (and the intro reel) never stalls */
function renderInBackground(list: Photo[]) {
  const idle: (cb: () => void) => void =
    typeof requestIdleCallback === 'function' ? (cb) => requestIdleCallback(cb, { timeout: 120 }) : (cb) => setTimeout(cb, 16);
  let i = 0;
  const step = () => {
    while (i < list.length && owner[i]) i++;
    if (i >= list.length) {
      bump(); // one repaint for the whole batch, not one per scene
      return;
    }
    const idx = i++;
    const c = base(idx);
    const p = list[idx];
    // swapped silently: films painted from now on pick it up, the final bump repaints the rest
    p.canvas = c;
    p.w = c.width;
    p.h = c.height;
    if (idx === 2) bump(); // the hero strip's frames are ready: show them early
    idle(step);
  };
  idle(step);
}

let cache: Photo[] | null = null;
/**
 * Registers the demo photos in the photo store (so the renderer can use them). Synchronous: each id exists
 * immediately (a soft colour wash), the generated scene is swapped in a moment later, and owner photos
 * replace it (same ids) once decoded.
 */
export function samplePhotos(): Photo[] {
  if (!cache) {
    cache = SCENES.map((_, i) => addPhoto(generated[i] ?? draft(i), true));
    renderInBackground(cache);
    loadOwnerPhotos(cache);
  }
  return cache;
}
