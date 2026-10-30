import { addPhoto, type Photo } from './media/photos';

/**
 * Procedural stand-in photos (golden-hour skyline, night bokeh, beach sunset, neon street, misty pines,
 * pool caustics) used by the homepage, film pickers and filter thumbnails, so we never ship or fetch real
 * portraits. Everything is drawn from a seeded PRNG: the same index always yields the same pixels.
 */
type RGB = [number, number, number];
type Ctx = CanvasRenderingContext2D;

const rgba = (c: RGB, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
const mixc = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function prng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rnd = () => number;
const between = (r: Rnd, a: number, b: number) => a + (b - a) * r();

/** vertical gradient fill of a band */
function vband(x: Ctx, w: number, y0: number, y1: number, stops: [number, string][]) {
  const g = x.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([t, c]) => g.addColorStop(t, c));
  x.fillStyle = g;
  x.fillRect(0, y0, w, y1 - y0);
}

/** soft elliptical light (gaussian-ish falloff) */
function glow(x: Ctx, cx: number, cy: number, rx: number, ry: number, c: RGB, a: number, mode: GlobalCompositeOperation = 'lighter') {
  x.save();
  x.globalCompositeOperation = mode;
  x.translate(cx, cy);
  x.scale(rx, ry);
  const g = x.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, rgba(c, a));
  g.addColorStop(0.2, rgba(c, a * 0.62));
  g.addColorStop(0.45, rgba(c, a * 0.24));
  g.addColorStop(0.72, rgba(c, a * 0.06));
  g.addColorStop(1, rgba(c, 0));
  x.fillStyle = g;
  x.fillRect(-1, -1, 2, 2);
  x.restore();
}

/** out-of-focus lamp: flat disc, brighter rim, soft edge */
function bokeh(x: Ctx, cx: number, cy: number, r: number, c: RGB, a: number) {
  x.save();
  x.globalCompositeOperation = 'lighter';
  const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, rgba(c, a * 0.7));
  g.addColorStop(0.72, rgba(c, a * 0.85));
  g.addColorStop(0.9, rgba(c, a * 1.2));
  g.addColorStop(1, rgba(c, 0));
  x.fillStyle = g;
  x.beginPath();
  x.arc(cx, cy, r, 0, Math.PI * 2);
  x.fill();
  x.restore();
}

/** a few overlapping soft ellipses: a wispy cloud */
function cloud(x: Ctx, r: Rnd, cx: number, cy: number, w: number, h: number, c: RGB, a: number) {
  for (let i = 0; i < 7; i++) {
    glow(x, cx + between(r, -0.5, 0.5) * w, cy + between(r, -0.5, 0.5) * h, w * between(r, 0.25, 0.5), h * between(r, 0.4, 0.9), c, a * between(r, 0.5, 1), 'source-over');
  }
}

/** feathered vertical light smear (a reflection on wet ground), additive */
function streak(x: Ctx, cx: number, y0: number, y1: number, width: number, c: RGB, a: number) {
  x.save();
  x.globalCompositeOperation = 'lighter';
  const g = x.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, rgba(c, a));
  g.addColorStop(0.5, rgba(c, a * 0.4));
  g.addColorStop(1, rgba(c, 0));
  x.fillStyle = g;
  const steps = 7;
  for (let i = 0; i < steps; i++) {
    const wd = width * (1 - i / steps);
    x.globalAlpha = 1 / (steps * 0.55);
    x.fillRect(cx - wd / 2, y0, wd, y1 - y0);
  }
  x.restore();
}

/** film-ish bloom + slight softness so vector edges read as a lens, not a drawing */
function lensFinish(x: Ctx, w: number, h: number, bloom: number, soft = 0.35) {
  const t = document.createElement('canvas');
  const tx = t.getContext('2d');
  if (!tx) return;
  const s = 6;
  t.width = Math.max(2, Math.round(w / s));
  t.height = Math.max(2, Math.round(h / s));
  tx.imageSmoothingQuality = 'high';
  tx.drawImage(x.canvas, 0, 0, t.width, t.height);
  x.save();
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  x.globalCompositeOperation = 'source-over';
  x.globalAlpha = soft;
  x.drawImage(t, 0, 0, w, h);
  x.globalCompositeOperation = 'screen';
  x.globalAlpha = bloom;
  x.drawImage(t, 0, 0, w, h);
  x.restore();
}

/** deterministic sensor grain */
function grain(x: Ctx, w: number, h: number, r: Rnd, amount: number) {
  const img = x.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() + r() + r() - 1.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n * 1.05;
  }
  x.putImageData(img, 0, 0);
}

/** mirror the strip above `y0` below it (water reflection), with ripples */
function reflect(x: Ctx, w: number, y0: number, depth: number, r: Rnd, alpha: number, u: number) {
  x.save();
  x.beginPath();
  x.rect(0, y0, w, depth);
  x.clip();
  x.globalAlpha = alpha;
  x.translate(0, y0 * 2);
  x.scale(1, -1);
  x.drawImage(x.canvas, 0, 0);
  x.restore();
  // ripple banding: thin horizontal offsets of the reflection
  for (let i = 0; i < 90; i++) {
    const yy = y0 + Math.pow(r(), 1.5) * depth;
    const k = (yy - y0) / depth;
    x.fillStyle = r() < 0.5 ? `rgba(255,255,255,${0.05 + k * 0.05})` : `rgba(10,10,30,${0.05 + k * 0.08})`;
    x.fillRect(r() * w, yy, between(r, 10, 70) * u * (0.5 + k), (0.6 + k * 2.2) * u);
  }
}

// ---------------------------------------------------------------- scenes

function skylineLayer(x: Ctx, r: Rnd, w: number, base: number, minH: number, maxH: number, bw: [number, number], col: RGB, u: number, windows: number) {
  x.fillStyle = rgba(col);
  let px = -20 * u;
  while (px < w) {
    const bwid = between(r, bw[0], bw[1]) * u;
    const bh = between(r, minH, maxH);
    x.fillRect(px, base - bh, bwid + 0.6, bh + 2);
    if (r() < 0.3) x.fillRect(px + bwid * 0.4, base - bh - between(r, 6, 26) * u, bwid * 0.12 + 1, 30 * u); // antenna / spire
    if (r() < 0.25) x.fillRect(px + bwid * 0.15, base - bh - 5 * u, bwid * 0.7, 5 * u); // roof step
    if (windows > 0) {
      const ww = 2.4 * u, wh = 3.4 * u, gx = 6 * u, gy = 8 * u;
      for (let wy = base - bh + 8 * u; wy < base - 6 * u; wy += gy) {
        for (let wx = px + 4 * u; wx < px + bwid - 5 * u; wx += gx) {
          if (r() < windows) {
            x.fillStyle = rgba([255, between(r, 170, 215), between(r, 100, 150)], between(r, 0.45, 0.95));
            x.fillRect(wx, wy, ww, wh);
          }
        }
      }
      x.fillStyle = rgba(col);
    }
    px += bwid + between(r, -2, 3) * u;
  }
}

/** warm golden-hour skyline over a river, hazy and backlit */
function goldenSkyline(x: Ctx, r: Rnd, w: number, h: number) {
  const u = w / 480;
  const hor = h * 0.63;
  vband(x, w, 0, hor, [[0, '#3a4f86'], [0.3, '#8b8aa8'], [0.6, '#f0a77f'], [0.85, '#ffc888'], [1, '#ffd9a3']]);
  const sx = w * 0.64, sy = hor - h * 0.36;
  cloud(x, r, w * 0.25, h * 0.2, w * 0.55, h * 0.05, [255, 205, 190], 0.35);
  cloud(x, r, w * 0.75, h * 0.3, w * 0.5, h * 0.045, [255, 190, 150], 0.4);
  cloud(x, r, w * 0.4, h * 0.42, w * 0.6, h * 0.04, [255, 215, 170], 0.45);
  glow(x, sx, sy, w * 0.7, h * 0.45, [255, 170, 90], 0.4);
  glow(x, sx, sy, w * 0.16, h * 0.1, [255, 236, 190], 0.8);
  const sun = x.createRadialGradient(sx, sy, 0, sx, sy, 22 * u);
  sun.addColorStop(0, 'rgba(255,255,248,1)');
  sun.addColorStop(0.7, 'rgba(255,250,225,1)');
  sun.addColorStop(1, 'rgba(255,240,200,0)');
  x.fillStyle = sun;
  x.fillRect(sx - 30 * u, sy - 30 * u, 60 * u, 60 * u);
  const haze: RGB = [236, 178, 140];
  skylineLayer(x, r, w, hor, h * 0.12, h * 0.34, [14, 40], mixc(haze, [120, 110, 150], 0.3), u, 0);
  vband(x, w, hor - h * 0.3, hor, [[0, 'rgba(255,205,150,0)'], [1, 'rgba(255,205,150,0.45)']]);
  skylineLayer(x, r, w, hor, h * 0.08, h * 0.28, [16, 44], mixc(haze, [80, 60, 100], 0.62), u, 0.05);
  vband(x, w, hor - h * 0.18, hor, [[0, 'rgba(255,190,140,0)'], [1, 'rgba(255,190,140,0.3)']]);
  skylineLayer(x, r, w, hor, h * 0.05, h * 0.2, [18, 50], mixc(haze, [40, 30, 62], 0.9), u, 0.16);
  // river
  vband(x, w, hor, h, [[0, '#f1b27e'], [0.45, '#5b4468'], [1, '#221d3a']]);
  reflect(x, w, hor, h * 0.22, r, 0.55, u);
  for (let i = 0; i < 170; i++) {
    const yy = hor + Math.pow(r(), 1.3) * h * 0.3;
    const k = (yy - hor) / (h * 0.3);
    const near = Math.exp(-Math.pow((sx - w * 0.5 - (w * 0.5 * 0)) / (w * 0.4), 2));
    x.fillStyle = `rgba(255,238,200,${(0.1 + k * 0.4) * near * between(r, 0.4, 1)})`;
    x.fillRect(sx + between(r, -1, 1) * (30 + k * 90) * u, yy, between(r, 6, 30) * u * (0.6 + k), (0.8 + k * 2) * u);
  }
  // near bank / rooftops silhouette
  x.fillStyle = '#120f1c';
  x.beginPath();
  x.moveTo(0, h);
  x.lineTo(0, h * 0.9);
  x.lineTo(w * 0.12, h * 0.885);
  x.lineTo(w * 0.12, h * 0.87);
  x.lineTo(w * 0.34, h * 0.86);
  x.lineTo(w * 0.4, h * 0.9);
  x.lineTo(w * 0.62, h * 0.92);
  x.lineTo(w * 0.78, h * 0.905);
  x.lineTo(w * 0.78, h * 0.88);
  x.lineTo(w, h * 0.9);
  x.lineTo(w, h);
  x.fill();
  vband(x, w, h * 0.84, h, [[0, 'rgba(255,200,140,0)'], [1, 'rgba(255,170,110,0.18)']]);
  glow(x, sx, hor + h * 0.07, w * 0.4, h * 0.08, [255, 200, 130], 0.28);
  lensFinish(x, w, h, 0.32);
}

/** night city out of focus: bokeh, reflections, lamp-lit warmth */
function nightBokeh(x: Ctx, r: Rnd, w: number, h: number) {
  const u = w / 480;
  vband(x, w, 0, h, [[0, '#050716'], [0.45, '#14102d'], [0.75, '#2a1428'], [1, '#120a14']]);
  glow(x, w * 0.5, h * 0.62, w * 0.7, h * 0.3, [255, 140, 70], 0.5);
  glow(x, w * 0.14, h * 0.5, w * 0.45, h * 0.3, [40, 150, 190], 0.4);
  glow(x, w * 0.88, h * 0.4, w * 0.4, h * 0.25, [220, 70, 140], 0.38);
  glow(x, w * 0.66, h * 0.7, w * 0.22, h * 0.14, [255, 200, 150], 0.5);
  const pal: [RGB, number][] = [
    [[255, 170, 70], 5], [[255, 215, 150], 4], [[255, 90, 140], 3], [[70, 205, 235], 3], [[120, 140, 255], 2], [[255, 120, 60], 3],
  ];
  const total = pal.reduce((s, p) => s + p[1], 0);
  const pick = (): RGB => {
    let t = r() * total;
    for (const [c, wt] of pal) { t -= wt; if (t <= 0) return c; }
    return pal[0][0];
  };
  for (let i = 0; i < 110; i++) {
    const big = r() < 0.2;
    const rad = (big ? between(r, 26, 54) : between(r, 7, 24)) * u;
    const yy = h * (0.18 + Math.pow(r(), 0.8) * 0.66);
    bokeh(x, r() * w, yy, rad, pick(), big ? between(r, 0.1, 0.22) : between(r, 0.14, 0.4));
  }
  // wet street: vertical smears of the lights
  const sy = h * 0.8;
  vband(x, w, sy - h * 0.06, h, [[0, 'rgba(8,6,16,0)'], [0.3, 'rgba(8,6,16,0.55)'], [1, 'rgba(6,4,10,0.9)']]);
  for (let i = 0; i < 26; i++) {
    const c = pick();
    streak(x, r() * w, sy, h, between(r, 14, 50) * u, c, between(r, 0.3, 0.7));
  }
  glow(x, w * 0.5, h * 0.9, w * 0.6, h * 0.08, [255, 120, 60], 0.18);
  lensFinish(x, w, h, 0.5, 0.25);
}

/** beach at sunset with a sun path on the water and wet sand */
function beachSunset(x: Ctx, r: Rnd, w: number, h: number) {
  const u = w / 480;
  const hor = h * 0.56;
  const sx = w * 0.5, sy = hor - h * 0.025;
  vband(x, w, 0, hor, [[0, '#272063'], [0.3, '#7c3a86'], [0.55, '#e0607c'], [0.8, '#ffa062'], [1, '#ffd58a']]);
  glow(x, sx, sy, w * 0.9, h * 0.45, [255, 150, 90], 0.5);
  glow(x, sx, sy, w * 0.3, h * 0.2, [255, 225, 160], 0.8);
  for (let i = 0; i < 7; i++) {
    const cy = h * between(r, 0.1, 0.46);
    const k = cy / hor;
    cloud(x, r, w * between(r, 0.1, 0.9), cy, w * between(r, 0.4, 0.8), h * 0.028, mixc([70, 40, 100], [255, 150, 120], k), 0.55);
    cloud(x, r, w * between(r, 0.1, 0.9), cy + h * 0.02, w * between(r, 0.3, 0.6), h * 0.015, [255, 190, 130], 0.45 * k);
  }
  const sun = x.createRadialGradient(sx, sy, 0, sx, sy, 24 * u);
  sun.addColorStop(0, 'rgba(255,252,235,1)');
  sun.addColorStop(0.75, 'rgba(255,240,190,0.98)');
  sun.addColorStop(1, 'rgba(255,225,170,0)');
  x.fillStyle = sun;
  x.fillRect(sx - 30 * u, sy - 30 * u, 60 * u, 60 * u);
  // distant headland
  x.fillStyle = 'rgba(100,52,100,0.75)';
  x.beginPath();
  x.moveTo(0, hor + 2 * u);
  x.lineTo(0, hor - h * 0.035);
  x.bezierCurveTo(w * 0.1, hor - h * 0.05, w * 0.2, hor - h * 0.035, w * 0.32, hor - h * 0.008);
  x.lineTo(w * 0.36, hor + 2 * u);
  x.fill();
  // sea
  vband(x, w, hor, h * 0.8, [[0, '#ffb472'], [0.18, '#c4607a'], [0.6, '#4a2d68'], [1, '#2a2050']]);
  reflect(x, w, hor, h * 0.2, r, 0.45, u);
  for (let i = 0; i < 260; i++) {
    const k = Math.pow(r(), 1.4);
    const yy = hor + k * h * 0.24;
    const spread = (20 + k * 120) * u;
    const a = (0.2 + k * 0.5) * Math.exp(-Math.pow(1.4, 2) * 0.0) * between(r, 0.35, 1);
    x.fillStyle = `rgba(255,${Math.round(210 - k * 40)},${Math.round(150 - k * 40)},${a})`;
    x.fillRect(sx + between(r, -1, 1) * spread - 12 * u, yy, between(r, 8, 40) * u * (0.5 + k), (0.7 + k * 2.4) * u);
  }
  for (let i = 0; i < 70; i++) {
    const yy = hor + Math.pow(r(), 1.2) * h * 0.24;
    x.fillStyle = `rgba(255,190,160,${between(r, 0.04, 0.12)})`;
    x.fillRect(r() * w, yy, between(r, 20, 90) * u, 1.2 * u);
  }
  // wet sand
  const sand = h * 0.8;
  vband(x, w, sand, h, [[0, '#8b5a62'], [0.35, '#c58a78'], [1, '#6d4452']]);
  x.save();
  x.beginPath();
  x.rect(0, sand, w, h - sand);
  x.clip();
  glow(x, sx, sand + h * 0.04, w * 0.28, h * 0.1, [255, 190, 140], 0.65);
  vband(x, w, sand, h, [[0, 'rgba(255,170,120,0.25)'], [1, 'rgba(70,40,70,0.0)']]);
  for (let i = 0; i < 40; i++) {
    x.fillStyle = `rgba(255,200,170,${between(r, 0.04, 0.14)})`;
    x.fillRect(r() * w, sand + r() * (h - sand), between(r, 30, 140) * u, 1.5 * u);
  }
  x.restore();
  // foam line
  x.strokeStyle = 'rgba(255,225,215,0.55)';
  x.lineWidth = 2.2 * u;
  x.beginPath();
  x.moveTo(0, sand + 2 * u);
  for (let px = 0; px <= w; px += 8 * u) x.lineTo(px, sand + Math.sin(px / (50 * u)) * 4 * u + Math.sin(px / (17 * u)) * 1.2 * u);
  x.stroke();
  // rocks
  x.fillStyle = '#1d1424';
  x.beginPath();
  x.moveTo(0, h);
  x.lineTo(0, h * 0.86);
  x.lineTo(w * 0.07, h * 0.83);
  x.lineTo(w * 0.15, h * 0.87);
  x.lineTo(w * 0.22, h * 0.9);
  x.lineTo(w * 0.3, h * 0.97);
  x.lineTo(w * 0.34, h);
  x.fill();
  lensFinish(x, w, h, 0.3);
}

/** rainy neon street, brick wall, wet asphalt */
function neonStreet(x: Ctx, r: Rnd, w: number, h: number) {
  const u = w / 480;
  const road = h * 0.76;
  vband(x, w, 0, road, [[0, '#0b0814'], [1, '#1e1020']]);
  // brick wall texture
  x.save();
  x.beginPath();
  x.rect(0, 0, w * 0.64, road);
  x.clip();
  x.fillStyle = '#2a1520';
  x.fillRect(0, 0, w * 0.64, road);
  const bh = 14 * u, bw = 32 * u;
  for (let row = 0; row * bh < road; row++) {
    for (let bx = -(row % 2) * bw * 0.5; bx < w; bx += bw) {
      const tone = between(r, -14, 14);
      x.fillStyle = `rgb(${Math.round(52 + tone)},${Math.round(26 + tone * 0.5)},${Math.round(38 + tone * 0.6)})`;
      x.fillRect(bx + 1, row * bh + 1, bw - 2, bh - 2);
    }
  }
  x.restore();
  // doorway with warm light
  const dx = w * 0.72, dw = w * 0.2, dy = h * 0.28;
  x.fillStyle = '#0a0710';
  x.fillRect(w * 0.64, 0, w * 0.36, road);
  const door = x.createLinearGradient(0, dy, 0, road);
  door.addColorStop(0, '#ffb35a');
  door.addColorStop(1, '#ff8a3a');
  x.fillStyle = door;
  x.fillRect(dx, dy, dw, road - dy);
  x.fillStyle = 'rgba(40,20,20,0.55)';
  x.fillRect(dx + dw * 0.48, dy, 2 * u, road - dy);
  glow(x, dx + dw / 2, dy + (road - dy) * 0.4, dw * 1.7, (road - dy) * 0.9, [255, 150, 70], 0.45);
  // neon tubes
  const tube = (col: RGB, blur: number, draw: () => void) => {
    x.save();
    x.lineCap = 'round';
    x.lineJoin = 'round';
    x.shadowColor = rgba(col, 1);
    x.shadowBlur = blur * u * 1.6;
    x.strokeStyle = rgba(col, 0.9);
    x.lineWidth = 7 * u;
    draw();
    x.shadowBlur = blur * u * 0.7;
    x.stroke();
    x.shadowBlur = 0;
    x.strokeStyle = rgba(mixc(col, [255, 255, 255], 0.75));
    x.lineWidth = 2.6 * u;
    x.stroke();
    x.restore();
  };
  const pink: RGB = [255, 50, 140], cyan: RGB = [40, 225, 255], amber: RGB = [255, 170, 40];
  tube(pink, 26, () => { x.beginPath(); x.arc(w * 0.26, h * 0.2, 52 * u, 0, Math.PI * 2); x.stroke(); });
  tube(cyan, 24, () => {
    x.beginPath();
    x.moveTo(w * 0.1, h * 0.38); x.lineTo(w * 0.22, h * 0.33); x.lineTo(w * 0.3, h * 0.41); x.lineTo(w * 0.44, h * 0.34); x.lineTo(w * 0.54, h * 0.4);
    x.stroke();
  });
  tube(amber, 22, () => { x.beginPath(); x.moveTo(w * 0.12, h * 0.5); x.lineTo(w * 0.52, h * 0.5); x.stroke(); });
  tube(pink, 20, () => { x.beginPath(); x.moveTo(w * 0.12, h * 0.56); x.lineTo(w * 0.38, h * 0.56); x.stroke(); });
  tube(cyan, 24, () => { x.beginPath(); x.moveTo(w * 0.93, h * 0.08); x.lineTo(w * 0.93, h * 0.62); x.stroke(); });
  glow(x, w * 0.26, h * 0.22, w * 0.6, h * 0.35, [255, 40, 130], 0.22);
  glow(x, w * 0.3, h * 0.42, w * 0.5, h * 0.2, [40, 200, 255], 0.16);
  // wet asphalt
  vband(x, w, road, h, [[0, '#17101c'], [1, '#07050b']]);
  const streaks: [number, RGB, number][] = [[0.26, pink, 70], [0.3, cyan, 40], [0.5, amber, 90], [0.78, [255, 150, 70], 56], [0.93, cyan, 20]];
  for (const [fx, col, sw] of streaks) {
    for (let i = 0; i < 4; i++) streak(x, w * fx + between(r, -14, 14) * u, road, h, sw * u * between(r, 0.4, 0.9), col, 0.5);
  }
  for (let i = 0; i < 90; i++) {
    x.fillStyle = `rgba(255,255,255,${between(r, 0.03, 0.09)})`;
    x.fillRect(r() * w, road + r() * (h - road), between(r, 10, 60) * u, 1.2 * u);
  }
  // rain
  x.strokeStyle = 'rgba(200,220,255,0.1)';
  x.lineWidth = 1 * u;
  for (let i = 0; i < 160; i++) {
    const rx = r() * w, ry = r() * h, rl = between(r, 12, 34) * u;
    x.beginPath();
    x.moveTo(rx, ry);
    x.lineTo(rx - rl * 0.18, ry + rl);
    x.stroke();
  }
  lensFinish(x, w, h, 0.45, 0.25);
}

function pine(x: Ctx, cx: number, base: number, ph: number, pw: number, col: string) {
  x.fillStyle = col;
  const tiers = 7;
  x.fillRect(cx - pw * 0.04, base - ph * 0.12, pw * 0.08, ph * 0.12);
  x.beginPath();
  x.moveTo(cx, base - ph);
  for (let i = 1; i <= tiers; i++) {
    const t = i / tiers;
    const ty = base - ph * (1 - t) - ph * 0.08;
    const half = pw * 0.5 * t;
    x.lineTo(cx + half, ty + ph * 0.02);
    x.lineTo(cx + half * 0.55, ty - ph * 0.02);
  }
  x.lineTo(cx - pw * 0.27, base - ph * 0.1);
  for (let i = tiers; i >= 1; i--) {
    const t = i / tiers;
    const ty = base - ph * (1 - t) - ph * 0.08;
    const half = pw * 0.5 * t;
    x.lineTo(cx - half * 0.55, ty - ph * 0.02);
    x.lineTo(cx - half, ty + ph * 0.02);
  }
  x.closePath();
  x.fill();
}

/** layered pine forest in morning mist with light shafts */
function mistyForest(x: Ctx, r: Rnd, w: number, h: number) {
  const u = w / 480;
  vband(x, w, 0, h, [[0, '#7f9497'], [0.3, '#9fb0ad'], [0.55, '#b0beb6'], [1, '#8fa59c']]);
  cloud(x, r, w * 0.3, h * 0.08, w * 0.8, h * 0.06, [215, 225, 222], 0.35);
  glow(x, w * 0.82, h * 0.06, w * 0.6, h * 0.34, [255, 222, 160], 0.2);
  const layers: { y: number; n: number; hh: [number, number]; col: RGB; fog: number }[] = [
    { y: 0.5, n: 20, hh: [0.12, 0.2], col: [168, 188, 180], fog: 0.55 },
    { y: 0.6, n: 15, hh: [0.17, 0.28], col: [128, 154, 148], fog: 0.5 },
    { y: 0.7, n: 11, hh: [0.24, 0.38], col: [86, 116, 110], fog: 0.45 },
    { y: 0.82, n: 7, hh: [0.34, 0.52], col: [46, 72, 70], fog: 0.3 },
  ];
  layers.forEach((L, li) => {
    const base = h * L.y;
    for (let i = 0; i < L.n; i++) {
      const ph = between(r, L.hh[0], L.hh[1]) * h;
      const cx = ((i + between(r, -0.3, 0.3)) / (L.n - 1)) * (w + 40 * u) - 20 * u;
      pine(x, cx, base + between(r, -6, 10) * u, ph, ph * between(r, 0.38, 0.5), rgba(mixc(L.col, [30, 50, 50], between(r, 0, 0.15))));
    }
    x.fillStyle = rgba(L.col);
    x.fillRect(0, base, w, h - base);
    vband(x, w, base - h * 0.2, base + h * 0.08, [[0, 'rgba(205,220,214,0)'], [0.6, `rgba(205,220,214,${L.fog})`], [1, 'rgba(205,220,214,0)']]);
    if (li === 1) {
      // a lit cabin window far away
      const cx = w * 0.3, cy = base - h * 0.01;
      x.fillStyle = 'rgba(60,45,45,0.7)';
      x.fillRect(cx - 9 * u, cy - 9 * u, 18 * u, 9 * u);
      x.beginPath(); x.moveTo(cx - 12 * u, cy - 9 * u); x.lineTo(cx, cy - 18 * u); x.lineTo(cx + 12 * u, cy - 9 * u); x.fill();
      x.fillStyle = 'rgba(255,190,100,0.95)';
      x.fillRect(cx - 3 * u, cy - 6 * u, 5 * u, 4 * u);
      glow(x, cx, cy - 4 * u, 28 * u, 22 * u, [255, 170, 80], 0.5);
    }
  });
  // light shafts
  x.save();
  x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    const sx0 = w * (0.55 + i * 0.12) + between(r, -0.05, 0.05) * w;
    const wd = between(r, 16, 46) * u;
    const g = x.createLinearGradient(sx0, 0, sx0 - w * 0.5, h);
    g.addColorStop(0, `rgba(255,240,200,${between(r, 0.07, 0.14)})`);
    g.addColorStop(1, 'rgba(255,240,200,0)');
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(sx0, -10);
    x.lineTo(sx0 + wd, -10);
    x.lineTo(sx0 + wd - w * 0.6, h);
    x.lineTo(sx0 - w * 0.6 - wd * 0.5, h);
    x.fill();
  }
  x.restore();
  // foreground trunks + ferns
  const trunk = (cx: number, tw: number) => {
    const g = x.createLinearGradient(cx - tw, 0, cx + tw, 0);
    g.addColorStop(0, '#16221f');
    g.addColorStop(0.7, '#25362f');
    g.addColorStop(1, '#3a4b3c');
    x.fillStyle = g;
    x.fillRect(cx - tw / 2, -10, tw, h + 20);
  };
  trunk(w * 0.05, w * 0.1);
  trunk(w * 0.95, w * 0.13);
  x.fillStyle = '#16231f';
  for (let i = 0; i < 26; i++) {
    const bx = r() * w, by = h * between(r, 0.93, 1.02), l = between(r, 40, 90) * u, a = between(r, -0.9, 0.9) - Math.PI / 2;
    x.beginPath();
    x.moveTo(bx, by);
    x.quadraticCurveTo(bx + Math.cos(a) * l * 0.6 + 8 * u, by + Math.sin(a) * l * 0.6, bx + Math.cos(a) * l, by + Math.sin(a) * l);
    x.quadraticCurveTo(bx + Math.cos(a) * l * 0.6 - 8 * u, by + Math.sin(a) * l * 0.6, bx, by);
    x.fill();
  }
  vband(x, w, h * 0.88, h, [[0, 'rgba(210,225,218,0.25)'], [1, 'rgba(210,225,218,0)']]);
  lensFinish(x, w, h, 0.28, 0.3);
}

/** top-down summer pool with caustics, a float ring and a sun-warmed deck */
function poolCaustics(x: Ctx, r: Rnd, w: number, h: number) {
  const u = w / 480;
  const deck = h * 0.8;
  vband(x, w, 0, deck, [[0, '#0b7fa8'], [0.5, '#16a6c6'], [1, '#52d0d4']]);
  // lane line
  x.strokeStyle = 'rgba(18,60,130,0.8)';
  x.lineWidth = 10 * u;
  x.beginPath();
  for (let py = -10; py < deck; py += 6) x.lineTo(w * 0.2 + Math.sin(py / (46 * u)) * 7 * u, py);
  x.stroke();
  for (let i = 0; i < 8; i++) {
    x.fillStyle = 'rgba(255,255,255,0.8)';
    x.fillRect(w * 0.2 - 10 * u + Math.sin((i * 80 * u) / (46 * u)) * 7 * u, i * 80 * u, 20 * u, 10 * u);
  }
  // float ring
  const rcx = w * 0.62, rcy = h * 0.4;
  x.save();
  x.translate(rcx + 14 * u, rcy + 16 * u);
  x.scale(1, 0.92);
  x.strokeStyle = 'rgba(0,50,80,0.4)';
  x.lineWidth = 34 * u;
  x.beginPath(); x.arc(0, 0, 76 * u, 0, Math.PI * 2); x.stroke();
  x.restore();
  for (let i = 0; i < 10; i++) {
    x.strokeStyle = i % 2 ? '#fdf6ee' : '#ff5c61';
    x.lineWidth = 32 * u;
    x.beginPath();
    x.arc(rcx, rcy, 76 * u, (i / 10) * Math.PI * 2, ((i + 1) / 10) * Math.PI * 2 + 0.01);
    x.stroke();
  }
  x.strokeStyle = 'rgba(255,255,255,0.35)';
  x.lineWidth = 6 * u;
  x.beginPath(); x.arc(rcx, rcy, 84 * u, 3.6, 4.6); x.stroke();
  // caustics (domain-warped interference), added per pixel
  const img = x.getImageData(0, 0, w, Math.round(deck));
  const d = img.data;
  const TAU = Math.PI * 2;
  const tm = 2.4;
  const sc = 5.2 / w;
  for (let py = 0; py < img.height; py++) {
    for (let px = 0; px < w; px++) {
      const gx = (px * sc * TAU) % TAU - 250, gy = (py * sc * TAU) % TAU - 250;
      let ix = gx, iy = gy, c = 1;
      for (let n = 1; n <= 4; n++) {
        const t = tm * (1 - 3.5 / (n + 1));
        ix = gx + Math.cos(t - ix) + Math.sin(t + iy);
        iy = gy + Math.sin(t - iy) + Math.cos(t + ix);
        const ax = gx / (Math.sin(ix + t) / 0.005), ay = gy / (Math.cos(iy + t) / 0.005);
        c += 1 / Math.hypot(ax, ay);
      }
      c /= 4;
      c = 1.17 - Math.pow(c, 1.4);
      const v = Math.pow(Math.abs(c), 8);
      const k = Math.min(1, v) * 150 + 12;
      const i = (py * w + px) * 4;
      d[i] += k * 0.7; d[i + 1] += k * 0.95; d[i + 2] += k;
    }
  }
  x.putImageData(img, 0, 0);
  glow(x, w * 0.3, h * 0.2, w * 0.7, h * 0.4, [200, 255, 250], 0.22);
  // deck + peach towel
  vband(x, w, deck, h, [[0, '#f0d9b8'], [1, '#d9b48e']]);
  x.strokeStyle = 'rgba(120,80,50,0.18)';
  x.lineWidth = 1.5 * u;
  for (let gx2 = 0; gx2 < w; gx2 += 60 * u) { x.beginPath(); x.moveTo(gx2, deck); x.lineTo(gx2 - 8 * u, h); x.stroke(); }
  x.beginPath(); x.moveTo(0, deck + (h - deck) * 0.55); x.lineTo(w, deck + (h - deck) * 0.55); x.stroke();
  x.fillStyle = 'rgba(255,255,255,0.85)';
  x.fillRect(0, deck - 3 * u, w, 5 * u);
  x.fillStyle = 'rgba(0,70,100,0.25)';
  x.fillRect(0, deck + 2 * u, w, 7 * u);
  x.save();
  x.translate(w * 0.58, deck + (h - deck) * 0.28);
  x.rotate(-0.06);
  const towel = x.createLinearGradient(0, 0, 0, (h - deck) * 0.9);
  towel.addColorStop(0, '#ffb89a');
  towel.addColorStop(1, '#f2967c');
  x.fillStyle = towel;
  x.fillRect(0, 0, w * 0.5, (h - deck) * 0.9);
  for (let i = 0; i < 4; i++) {
    x.fillStyle = i % 2 ? 'rgba(255,255,255,0.7)' : 'rgba(255,236,200,0.8)';
    x.fillRect(0, 10 * u + i * 16 * u, w * 0.5, 6 * u);
  }
  x.restore();
  glow(x, w * 0.8, h * 0.9, w * 0.5, h * 0.2, [255, 220, 150], 0.3);
  lensFinish(x, w, h, 0.25, 0.3);
}

const SCENES: ((x: Ctx, r: Rnd, w: number, h: number) => void)[] = [goldenSkyline, nightBokeh, beachSunset, neonStreet, mistyForest, poolCaustics];

export function sceneCanvas(i: number, w = 480, h = 600): HTMLCanvasElement {
  const idx = ((i % SCENES.length) + SCENES.length) % SCENES.length;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  if (!x) return c;
  const r = prng(0x9e3779b1 + idx * 7919);
  SCENES[idx](x, r, w, h);
  grain(x, w, h, r, 7);
  return c;
}

let cache: Photo[] | null = null;
/** registers the sample scenes in the photo store (so the renderer can use them) */
export function samplePhotos(): Photo[] {
  cache ??= SCENES.map((_, i) => addPhoto(sceneCanvas(i), true));
  return cache;
}
