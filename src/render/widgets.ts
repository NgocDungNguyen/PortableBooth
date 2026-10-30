/**
 * Shareable "object" widgets (date stamp, camera HUD, ticket, receipt, ...) drawn with Canvas2D.
 * Each widget is designed on a fixed 400-unit-wide logical canvas and scaled to the requested
 * width, so it stays crisp at any size. Fully deterministic (hash seeded), original artwork.
 */

export interface WidgetDef {
  id: string;
  name: string;
  /** width / height of the drawn canvas */
  aspect: number;
  defaults: { text: string; text2: string; color: string; bg: string };
  labels: { text: string; text2?: string };
  /** true if bg is meaningful (paper colour) */
  usesBg: boolean;
}

export type WidgetParams = { text: string; text2: string; color: string; bg: string };

export const WIDGETS: WidgetDef[] = [
  { id: 'stamp', name: 'Date stamp', aspect: 3.2, defaults: { text: "30 10 '26", text2: '', color: '#FF9A2E', bg: '' }, labels: { text: 'Date' }, usesBg: false },
  { id: 'viewfinder', name: 'Viewfinder', aspect: 4 / 3, defaults: { text: '00:12:08', text2: '4:3', color: '#FFFFFF', bg: '' }, labels: { text: 'Timer', text2: 'Ratio' }, usesBg: false },
  { id: 'ticket', name: 'Ticket', aspect: 2.5, defaults: { text: 'PHOTO NIGHT', text2: 'Row A  /  Seat 12  /  30 Oct 2026', color: '#7A1F2E', bg: '#F3E3BE' }, labels: { text: 'Title', text2: 'Details' }, usesBg: true },
  { id: 'receipt', name: 'Receipt', aspect: 400 / 540, defaults: { text: 'Smile|Pose|Laugh|Silly face', text2: '3.00|3.00|3.00|3.00', color: '#26262B', bg: '#FBFAF4' }, labels: { text: 'Items (a|b|c|d)', text2: 'Prices (1|2|3|4)' }, usesBg: true },
  { id: 'barcode', name: 'Barcode', aspect: 2, defaults: { text: 'PB-301026-0042', text2: '', color: '#111111', bg: '#FFFFFF' }, labels: { text: 'Code' }, usesBg: true },
  { id: 'rating', name: 'Star rating', aspect: 4, defaults: { text: '5', text2: '', color: '#FFB62E', bg: '' }, labels: { text: 'Stars (1-5)' }, usesBg: false },
  { id: 'nowplaying', name: 'Now playing', aspect: 400 / 170, defaults: { text: 'Golden Hour', text2: 'Midnight Polaroids', color: '#FFFFFF', bg: '#1C1B22' }, labels: { text: 'Song', text2: 'Artist' }, usesBg: true },
  { id: 'label', name: 'Label', aspect: 3.6, defaults: { text: 'Main character', text2: '', color: '#FFFFFF', bg: '#17163A' }, labels: { text: 'Label' }, usesBg: true },
  { id: 'battery', name: 'Battery', aspect: 2.4, defaults: { text: '78%', text2: '', color: '#FFFFFF', bg: '' }, labels: { text: 'Level' }, usesBg: true },
  { id: 'caption', name: 'Handwritten', aspect: 3.3, defaults: { text: 'best day ever', text2: '', color: '#2B2A35', bg: '' }, labels: { text: 'Caption' }, usesBg: false },
  { id: 'timecode', name: 'Camcorder', aspect: 3.6, defaults: { text: '00:03:21', text2: 'PLAY', color: '#FFFFFF', bg: '' }, labels: { text: 'Timecode', text2: 'Mode' }, usesBg: false },
  { id: 'badge', name: 'Badge', aspect: 1, defaults: { text: 'GOOD VIBES ONLY', text2: '100%', color: '#17163A', bg: '#FFD84D' }, labels: { text: 'Ring text', text2: 'Centre' }, usesBg: true },
  { id: 'postmark', name: 'Postmark', aspect: 1.6, defaults: { text: 'PHOTO CITY', text2: '30 OCT|2026', color: '#2E2A5E', bg: '' }, labels: { text: 'Place', text2: 'Date (a|b)' }, usesBg: false },
  { id: 'clock', name: 'Clock', aspect: 2.2, defaults: { text: '9:41', text2: 'Friday 30 October', color: '#FFFFFF', bg: '' }, labels: { text: 'Time', text2: 'Date' }, usesBg: true },
];

// ---------------------------------------------------------------------------------------------
// shared helpers
// ---------------------------------------------------------------------------------------------

type G = CanvasRenderingContext2D;
type RGB = [number, number, number];

const LW = 400;
const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const F_DISPLAY = '"Bricolage Grotesque Variable", system-ui, sans-serif';
const F_UI = '"Geist Variable", system-ui, sans-serif';
const F_MONO = '"Geist Mono Variable", ui-monospace, Menlo, monospace';
const F_SPACE = '"Space Mono", ui-monospace, Menlo, monospace';
const F_BEBAS = '"Bebas Neue", Impact, "Arial Narrow", sans-serif';
const F_VT = '"VT323", ui-monospace, monospace';
const F_CAVEAT = '"Caveat", "Segoe Script", cursive';

function parseColor(c: string, fallback: RGB): RGB {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((c || '').trim());
  if (!m) return fallback;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgb = (c: RGB, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${clamp(a, 0, 1)})`;
const mixc = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rr(g: G, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + k, y);
  g.arcTo(x + w, y, x + w, y + h, k);
  g.arcTo(x + w, y + h, x, y + h, k);
  g.arcTo(x, y + h, x, y, k);
  g.arcTo(x, y, x + w, y, k);
  g.closePath();
}

/** font size so `text` fits `maxW` (linear scaling; never grows beyond `start`) */
function fit(g: G, text: string, mk: (s: number) => string, maxW: number, start: number, min = 6): number {
  g.font = mk(start);
  const w = g.measureText(text).width;
  if (!(w > maxW) || w <= 0) return start;
  return Math.max(min, (start * maxW) / w);
}

function spacedWidth(g: G, text: string, sp: number): number {
  let w = 0;
  for (const ch of text) w += g.measureText(ch).width + sp;
  return Math.max(0, w - sp);
}
/** letter-spaced text without relying on ctx.letterSpacing */
function spaced(g: G, text: string, x: number, y: number, sp: number, align: CanvasTextAlign = 'left') {
  const w = spacedWidth(g, text, sp);
  let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  const prev = g.textAlign;
  g.textAlign = 'left';
  for (const ch of text) {
    g.fillText(ch, cx, y);
    cx += g.measureText(ch).width + sp;
  }
  g.textAlign = prev;
}

/** draw text centred horizontally and vertically on its ink box */
function inkCentered(g: G, text: string, cx: number, cy: number, align: CanvasTextAlign = 'center') {
  const m = g.measureText(text);
  const asc = m.actualBoundingBoxAscent ?? 0;
  const desc = m.actualBoundingBoxDescent ?? 0;
  g.textAlign = align;
  g.textBaseline = 'alphabetic';
  g.fillText(text, cx, cy + (asc - desc) / 2);
}

/** text along a circle; `top` text reads clockwise with glyph tops outward, otherwise inward */
function arcText(g: G, text: string, cx: number, cy: number, radius: number, mid: number, sp: number, top: boolean) {
  const chars = Array.from(text);
  const widths = chars.map((c) => g.measureText(c).width + sp);
  const total = widths.reduce((a, b) => a + b, 0) - sp;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  let pos = -total / 2;
  chars.forEach((ch, i) => {
    const w = widths[i] - sp;
    const a = mid + ((pos + w / 2) / radius) * (top ? 1 : -1);
    pos += widths[i];
    g.save();
    g.translate(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
    g.rotate(top ? a + Math.PI / 2 : a - Math.PI / 2);
    g.fillText(ch, 0, 0);
    g.restore();
  });
}

function starPath(g: G, cx: number, cy: number, R: number, r: number, n = 5, rot = -Math.PI / 2) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n;
    const rad = i % 2 === 0 ? R : r;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
}

function pillShadow(g: G, a = 0.25, blur = 10, dy = 3) {
  g.shadowColor = `rgba(0,0,0,${a})`;
  g.shadowBlur = blur;
  g.shadowOffsetY = dy;
}
function noShadow(g: G) {
  g.shadowColor = 'transparent';
  g.shadowBlur = 0;
  g.shadowOffsetX = 0;
  g.shadowOffsetY = 0;
}

/** Code-128-ish bar widths (in modules) derived from a hash of the text */
function barWidths(text: string, modules: number): number[] {
  const r = rng(hash(text || '0') ^ 0x5bd1e995);
  const out: number[] = [2, 1, 1, 2, 1, 4]; // start guard
  let sum = out.reduce((a, b) => a + b, 0);
  while (sum < modules - 13) {
    const w = 1 + Math.floor(r() * r() * 4 + r() * 1.2);
    out.push(Math.min(4, w));
    sum += out[out.length - 1];
  }
  out.push(2, 3, 3, 1, 1, 1, 2); // stop guard
  return out;
}
function drawBars(g: G, widths: number[], x: number, y: number, w: number, h: number) {
  const total = widths.reduce((a, b) => a + b, 0);
  const unit = w / total;
  let cx = x;
  widths.forEach((bw, i) => {
    if (i % 2 === 0) g.fillRect(cx, y, bw * unit + 0.15, h);
    cx += bw * unit;
  });
}

// ---------------------------------------------------------------------------------------------
// widgets
// ---------------------------------------------------------------------------------------------

type Draw = (g: G, p: WidgetParams, W: number, H: number) => void;

const drawStamp: Draw = (g, p, W, H) => {
  const text = p.text || ' ';
  const ink = parseColor(p.color, [255, 154, 46]);
  const mk = (s: number) => `${s}px ${F_VT}`;
  const size = fit(g, text, mk, W - 44, 120, 14);
  g.font = mk(size);
  // light-bleed glow, then the lit core of the segments
  g.fillStyle = rgb(ink, 1);
  g.shadowColor = rgb(ink, 0.95);
  g.shadowBlur = size * 0.22;
  inkCentered(g, text, W / 2, H / 2);
  g.shadowBlur = size * 0.08;
  inkCentered(g, text, W / 2, H / 2);
  noShadow(g);
  g.fillStyle = rgb(mixc(ink, [255, 245, 220], 0.45), 0.85);
  g.font = mk(size);
  inkCentered(g, text, W / 2, H / 2);
};

const drawViewfinder: Draw = (g, p, W, H) => {
  const ink = parseColor(p.color, [255, 255, 255]);
  const col = rgb(ink);
  g.shadowColor = 'rgba(0,0,0,0.55)';
  g.shadowBlur = 4;
  g.shadowOffsetY = 1;
  g.strokeStyle = col;
  g.fillStyle = col;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // corner brackets
  const m = 14;
  const L = 44;
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(m, m + L); g.lineTo(m, m + 6); g.arcTo(m, m, m + 6, m, 6); g.lineTo(m + L, m);
  g.moveTo(W - m - L, m); g.lineTo(W - m - 6, m); g.arcTo(W - m, m, W - m, m + 6, 6); g.lineTo(W - m, m + L);
  g.moveTo(m, H - m - L); g.lineTo(m, H - m - 6); g.arcTo(m, H - m, m + 6, H - m, 6); g.lineTo(m + L, H - m);
  g.moveTo(W - m - L, H - m); g.lineTo(W - m - 6, H - m); g.arcTo(W - m, H - m, W - m, H - m - 6, 6); g.lineTo(W - m, H - m - L);
  g.stroke();

  // REC
  g.fillStyle = '#FF3B30';
  g.beginPath();
  g.arc(44, 46, 8, 0, TAU);
  g.fill();
  g.fillStyle = col;
  g.font = `700 24px ${F_MONO}`;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  spaced(g, 'REC', 62, 47, 2);

  // battery, top right
  const bx = W - 36 - 54;
  const by = 36;
  g.lineWidth = 2.6;
  rr(g, bx, by, 46, 22, 5);
  g.stroke();
  g.beginPath();
  g.moveTo(bx + 51, by + 7); g.lineTo(bx + 51, by + 15);
  g.lineWidth = 4;
  g.stroke();
  for (let i = 0; i < 3; i++) {
    rr(g, bx + 5 + i * 13, by + 5, 10, 12, 2);
    g.fill();
  }

  // focus box
  const cx = W / 2;
  const cy = H / 2 - 6;
  const s = 46;
  const t = 18;
  g.lineWidth = 2.6;
  g.beginPath();
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    g.moveTo(cx + sx * s, cy + sy * (s - t));
    g.lineTo(cx + sx * s, cy + sy * s);
    g.lineTo(cx + sx * (s - t), cy + sy * s);
  }
  g.stroke();
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx - 8, cy); g.lineTo(cx + 8, cy);
  g.moveTo(cx, cy - 8); g.lineTo(cx, cy + 8);
  g.stroke();

  // exposure scale, bottom centre
  const sy0 = H - 40;
  g.lineWidth = 2;
  g.beginPath();
  for (let i = -4; i <= 4; i++) {
    const tall = i % 2 === 0;
    g.moveTo(cx + i * 9, sy0 - (tall ? 8 : 4));
    g.lineTo(cx + i * 9, sy0 + (tall ? 8 : 4));
  }
  g.stroke();
  g.beginPath();
  g.moveTo(cx - 5, sy0 + 20); g.lineTo(cx + 5, sy0 + 20); g.lineTo(cx, sy0 + 12);
  g.closePath();
  g.fill();

  // ratio chip + time
  const ratio = p.text2 || '4:3';
  g.font = `700 20px ${F_MONO}`;
  const rw = g.measureText(ratio).width + 20;
  g.lineWidth = 2.4;
  rr(g, 34, H - 34 - 28, rw, 28, 6);
  g.stroke();
  g.textAlign = 'center';
  g.fillText(ratio, 34 + rw / 2, H - 34 - 13);
  const time = p.text || '';
  const ts = fit(g, time, (z) => `600 ${z}px ${F_MONO}`, W * 0.3, 22, 10);
  g.font = `600 ${ts}px ${F_MONO}`;
  g.textAlign = 'right';
  g.fillText(time, W - 34, H - 34 - 13);
};

const drawTicket: Draw = (g, p, W, H) => {
  const ink = parseColor(p.color, [122, 31, 46]);
  const paper = p.bg ? parseColor(p.bg, [243, 227, 190]) : null;
  const x0 = 6;
  const y0 = 6;
  const bw = W - 12;
  const bh = H - 12;
  const stubX = 292;
  const R = 12;

  if (paper) {
    g.save();
    pillShadow(g, 0.28, 10, 3);
    rr(g, x0, y0, bw, bh, R);
    const gr = g.createLinearGradient(0, y0, 0, y0 + bh);
    gr.addColorStop(0, rgb(mixc(paper, [255, 255, 255], 0.2)));
    gr.addColorStop(1, rgb(mixc(paper, [120, 80, 30], 0.1)));
    g.fillStyle = gr;
    g.fill();
    g.restore();
    // paper tooth: a few faint specks
    const r = rng(hash(p.text) + 3);
    g.fillStyle = rgb(mixc(paper, [90, 60, 20], 0.5), 0.1);
    for (let i = 0; i < 70; i++) g.fillRect(x0 + r() * bw, y0 + r() * bh, 1 + r() * 1.5, 1);
    // punched notches
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = '#000';
    for (const [nx, ny, nr] of [[x0, H / 2, 11], [x0 + bw, H / 2, 11], [stubX, y0, 7], [stubX, y0 + bh, 7]]) {
      g.beginPath();
      g.arc(nx, ny, nr, 0, TAU);
      g.fill();
    }
    g.restore();
  }

  g.strokeStyle = rgb(ink, 0.6);
  g.lineWidth = 1.5;
  rr(g, 20, 20, stubX - 34, H - 40, 6);
  g.stroke();
  rr(g, stubX + 14, 20, bw + x0 - stubX - 28, H - 40, 6);
  g.stroke();
  // perforation
  g.setLineDash([2.5, 5]);
  g.lineCap = 'round';
  g.lineWidth = 2;
  g.strokeStyle = rgb(ink, 0.55);
  g.beginPath();
  g.moveTo(stubX, y0 + 14);
  g.lineTo(stubX, y0 + bh - 14);
  g.stroke();
  g.setLineDash([]);

  // main section
  const cx = (20 + stubX - 14) / 2;
  g.fillStyle = rgb(ink);
  g.font = `700 13px ${F_SPACE}`;
  g.textBaseline = 'alphabetic';
  spaced(g, 'ADMIT ONE', cx, 47, 4, 'center');
  g.fillRect(cx - 74, 55, 36, 1.5);
  g.fillRect(cx + 38, 55, 36, 1.5);
  starPath(g, cx, 55.5, 4.5, 1.9);
  g.fill();
  const title = (p.text || ' ').toUpperCase();
  const ts = fit(g, title, (z) => `${z}px ${F_BEBAS}`, 232, 58, 14);
  g.font = `${ts}px ${F_BEBAS}`;
  g.textAlign = 'center';
  g.fillText(title, cx, 108);
  g.globalAlpha = 0.85;
  const d = p.text2 || '';
  const ds = fit(g, d, (z) => `400 ${z}px ${F_SPACE}`, 232, 12.5, 7);
  g.font = `400 ${ds}px ${F_SPACE}`;
  g.fillText(d, cx, 133);
  g.globalAlpha = 1;

  // stub
  const sx = (stubX + 14 + bw + x0 - 14) / 2;
  g.font = `700 11px ${F_SPACE}`;
  spaced(g, 'ADMIT', sx, 44, 3, 'center');
  spaced(g, 'ONE', sx, 58, 3, 'center');
  g.font = `38px ${F_BEBAS}`;
  g.textAlign = 'center';
  const no = String(1000 + (hash(p.text || '') % 9000));
  g.fillText(no, sx, 104);
  g.font = `400 10px ${F_SPACE}`;
  spaced(g, 'No.', sx, 118, 2, 'center');
  starPath(g, sx, 130, 5, 2.2);
  g.fill();
};

const drawReceipt: Draw = (g, p, W, H) => {
  const ink = parseColor(p.color, [38, 38, 43]);
  const paper = p.bg ? parseColor(p.bg, [251, 250, 244]) : null;
  const x0 = 14;
  const x1 = W - 14;
  const y0 = 8;
  const y1 = H - 8;
  const tooth = 9;
  if (paper) {
    g.save();
    pillShadow(g, 0.25, 12, 3);
    const n = Math.max(2, Math.floor((x1 - x0) / tooth));
    const tw = (x1 - x0) / n;
    g.beginPath();
    g.moveTo(x0, y0 + tooth);
    for (let i = 0; i < n; i++) {
      g.lineTo(x0 + (i + 0.5) * tw, y0);
      g.lineTo(x0 + (i + 1) * tw, y0 + tooth);
    }
    g.lineTo(x1, y1 - tooth);
    for (let i = n - 1; i >= 0; i--) {
      g.lineTo(x0 + (i + 0.5) * tw, y1);
      g.lineTo(x0 + i * tw, y1 - tooth);
    }
    g.closePath();
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    gr.addColorStop(0, rgb(mixc(paper, [0, 0, 0], 0.05)));
    gr.addColorStop(0.12, rgb(paper));
    gr.addColorStop(0.88, rgb(paper));
    gr.addColorStop(1, rgb(mixc(paper, [0, 0, 0], 0.06)));
    g.fillStyle = gr;
    g.fill();
    g.restore();
  }
  const pad = 30;
  const l = x0 + pad;
  const r = x1 - pad;
  const cx = (x0 + x1) / 2;
  g.fillStyle = rgb(ink, 0.92);
  g.strokeStyle = rgb(ink, 0.55);
  g.textBaseline = 'alphabetic';

  g.font = `700 27px ${F_SPACE}`;
  g.textAlign = 'center';
  spaced(g, 'PHOTO BOOTH', cx, 62, 2, 'center');
  g.font = `400 12px ${F_SPACE}`;
  const orderNo = String(hash(p.text) % 9000 + 1000);
  spaced(g, 'SELF-SERVE  *  4 FRAMES', cx, 84, 1, 'center');
  spaced(g, `ORDER #${orderNo}`, cx, 102, 1, 'center');

  const dash = (y: number) => {
    g.save();
    g.setLineDash([5, 4]);
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(l, y);
    g.lineTo(r, y);
    g.stroke();
    g.restore();
  };
  dash(120);

  const names = (p.text || '').split('|').map((s) => s.trim());
  const prices = (p.text2 || '').split('|').map((s) => s.trim());
  const rows = 4;
  let sum = 0;
  let numeric = true;
  for (let i = 0; i < rows; i++) {
    const y = 160 + i * 36;
    const name = (names[i] ?? '').toUpperCase();
    const price = prices[i] ?? '';
    const n = parseFloat(price.replace(',', '.'));
    if (price) {
      if (Number.isFinite(n)) sum += n;
      else numeric = false;
    }
    g.font = `400 16px ${F_SPACE}`;
    g.textAlign = 'right';
    const pw = g.measureText(price).width;
    g.fillText(price, r, y);
    const maxN = r - l - pw - 28;
    const ns = fit(g, name, (z) => `400 ${z}px ${F_SPACE}`, maxN, 16, 8);
    g.font = `400 ${ns}px ${F_SPACE}`;
    g.textAlign = 'left';
    g.fillText(name, l, y);
    const nw = g.measureText(name).width;
    // dotted leader
    g.save();
    g.fillStyle = rgb(ink, 0.5);
    for (let x = l + nw + 8; x < r - pw - 8; x += 6) g.fillRect(x, y - 2, 1.8, 1.8);
    g.restore();
  }
  dash(308);
  g.font = `700 22px ${F_SPACE}`;
  g.textAlign = 'left';
  g.fillText('TOTAL', l, 346);
  g.textAlign = 'right';
  g.fillText(numeric && sum > 0 ? sum.toFixed(2) : '', r, 346);
  dash(366);
  g.font = `400 14px ${F_SPACE}`;
  spaced(g, 'THANK YOU!  KEEP SMILING', cx, 396, 1, 'center');

  // barcode
  const bars = barWidths(`${p.text}|${p.text2}`, 90);
  g.fillStyle = rgb(ink, 0.92);
  drawBars(g, bars, l + 8, 418, r - l - 16, 68);
  g.font = `400 12px ${F_SPACE}`;
  spaced(g, `${orderNo}  0042  ${String(hash(p.text2) % 90000 + 10000)}`, cx, 508, 2, 'center');
};

const drawBarcode: Draw = (g, p, W, H) => {
  const ink = parseColor(p.color, [17, 17, 17]);
  const paper = p.bg ? parseColor(p.bg, [255, 255, 255]) : null;
  if (paper) {
    g.save();
    pillShadow(g, 0.18, 8, 2);
    rr(g, 6, 6, W - 12, H - 12, 12);
    g.fillStyle = rgb(paper);
    g.fill();
    g.restore();
  }
  const text = p.text || '0000';
  g.fillStyle = rgb(ink);
  drawBars(g, barWidths(text, 100), 40, 30, W - 80, 104);
  const mk = (z: number) => `700 ${z}px ${F_MONO}`;
  const size = fit(g, text, mk, W - 90 - text.length * 3, 24, 9);
  g.font = mk(size);
  g.textBaseline = 'alphabetic';
  spaced(g, text, W / 2, 172, 3, 'center');
};

const drawRating: Draw = (g, p, W, H) => {
  const ink = parseColor(p.color, [255, 182, 46]);
  const n = clamp(parseFloat(p.text) || 0, 0, 5);
  if (p.bg) {
    g.save();
    pillShadow(g, 0.18, 8, 2);
    rr(g, 6, 6, W - 12, H - 12, (H - 12) / 2);
    g.fillStyle = rgb(parseColor(p.bg, [255, 255, 255]));
    g.fill();
    g.restore();
  }
  const R = 29;
  const gap = 10;
  const total = 5 * R * 2 + 4 * gap;
  const x0 = (W - total) / 2 + R;
  const cy = H / 2 + 2;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const cx = x0 + i * (R * 2 + gap);
    const frac = clamp(n - i, 0, 1);
    // empty star
    starPath(g, cx, cy, R - 3, (R - 3) * 0.46);
    g.fillStyle = rgb(ink, 0.2);
    g.strokeStyle = rgb(ink, 0.5);
    g.lineWidth = 5;
    g.fill();
    g.stroke();
    if (frac > 0) {
      g.save();
      g.beginPath();
      g.rect(cx - R, cy - R, R * 2 * frac, R * 2);
      g.clip();
      starPath(g, cx, cy, R - 3, (R - 3) * 0.46);
      const gr = g.createLinearGradient(0, cy - R, 0, cy + R);
      gr.addColorStop(0, rgb(mixc(ink, [255, 255, 255], 0.42)));
      gr.addColorStop(0.55, rgb(ink));
      gr.addColorStop(1, rgb(mixc(ink, [150, 60, 0], 0.28)));
      g.fillStyle = gr;
      g.strokeStyle = rgb(mixc(ink, [150, 70, 0], 0.18));
      g.lineWidth = 5;
      g.fill();
      g.stroke();
      // glossy highlight
      g.beginPath();
      g.moveTo(cx - R * 0.55, cy - R * 0.1);
      g.lineTo(cx - R * 0.05, cy - R * 0.82);
      g.strokeStyle = 'rgba(255,255,255,0.55)';
      g.lineWidth = 3;
      g.stroke();
      g.restore();
    }
  }
};

const drawNowPlaying: Draw = (g, p, W, H) => {
  const ink = parseColor(p.color, [255, 255, 255]);
  const card = p.bg ? parseColor(p.bg, [28, 27, 34]) : null;
  g.save();
  pillShadow(g, 0.3, 14, 4);
  rr(g, 6, 6, W - 12, H - 16, 26);
  if (card) {
    const gr = g.createLinearGradient(0, 6, 0, H);
    gr.addColorStop(0, rgb(mixc(card, [255, 255, 255], 0.07)));
    gr.addColorStop(1, rgb(card));
    g.fillStyle = gr;
  } else g.fillStyle = 'rgba(24,23,30,0.82)';
  g.fill();
  g.restore();

  // album art from the song title
  const hseed = hash(p.text || 'x');
  const h1 = hseed % 360;
  const h2 = (h1 + 40 + ((hseed >> 8) % 60)) % 360;
  const ax = 24;
  const ay = 22;
  const as = H - 16 - 32;
  g.save();
  rr(g, ax, ay, as, as, 14);
  g.clip();
  const ag = g.createLinearGradient(ax, ay, ax + as, ay + as);
  ag.addColorStop(0, `hsl(${h1},82%,62%)`);
  ag.addColorStop(1, `hsl(${h2},78%,38%)`);
  g.fillStyle = ag;
  g.fillRect(ax, ay, as, as);
  const rg = g.createRadialGradient(ax + as * 0.3, ay + as * 0.25, 0, ax + as * 0.3, ay + as * 0.25, as * 0.8);
  rg.addColorStop(0, 'rgba(255,255,255,0.45)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg;
  g.fillRect(ax, ay, as, as);
  // abstract sun + horizon
  g.fillStyle = 'rgba(255,255,255,0.88)';
  g.beginPath();
  g.arc(ax + as * 0.5, ay + as * 0.55, as * 0.2, 0, TAU);
  g.fill();
  g.fillStyle = `hsla(${h2},70%,22%,0.55)`;
  g.fillRect(ax, ay + as * 0.66, as, as * 0.4);
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.fillRect(ax + as * 0.2, ay + as * 0.76, as * 0.6, 3);
  g.fillRect(ax + as * 0.3, ay + as * 0.86, as * 0.4, 3);
  g.restore();

  const tx = ax + as + 22;
  const tw = W - 24 - tx;
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.fillStyle = rgb(ink);
  const title = p.text || ' ';
  const ts = fit(g, title, (z) => `700 ${z}px ${F_DISPLAY}`, tw, 26, 11);
  g.font = `700 ${ts}px ${F_DISPLAY}`;
  g.fillText(title, tx, 52);
  g.fillStyle = rgb(ink, 0.62);
  const art = p.text2 || '';
  const ars = fit(g, art, (z) => `500 ${z}px ${F_UI}`, tw, 18, 9);
  g.font = `500 ${ars}px ${F_UI}`;
  g.fillText(art, tx, 76);

  // progress
  const by = 102;
  const pct = 0.38 + ((hseed >> 4) % 30) / 100;
  g.fillStyle = rgb(ink, 0.22);
  rr(g, tx, by - 2.5, tw, 5, 2.5);
  g.fill();
  g.fillStyle = rgb(ink, 0.95);
  rr(g, tx, by - 2.5, tw * pct, 5, 2.5);
  g.fill();
  g.beginPath();
  g.arc(tx + tw * pct, by, 6, 0, TAU);
  g.fill();
  g.fillStyle = rgb(ink, 0.55);
  g.font = `500 11px ${F_MONO}`;
  const total = 120 + (hseed % 140);
  const el = Math.round(total * pct);
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  g.fillText(fmt(el), tx, by + 20);
  g.textAlign = 'right';
  g.fillText(`-${fmt(total - el)}`, tx + tw, by + 20);

  // controls
  const cy = by + 42;
  const cx = tx + tw / 2;
  g.fillStyle = rgb(ink);
  g.lineJoin = 'round';
  for (const dir of [-1, 1]) {
    const x = cx + dir * 58;
    // skip icon = triangle + bar
    g.beginPath();
    g.moveTo(x - dir * 9, cy - 8);
    g.lineTo(x + dir * 4, cy);
    g.lineTo(x - dir * 9, cy + 8);
    g.closePath();
    g.fill();
    rr(g, x + dir * 6 - 1.8, cy - 8, 3.6, 16, 1.5);
    g.fill();
  }
  rr(g, cx - 8, cy - 10, 5.5, 20, 2);
  g.fill();
  rr(g, cx + 2.5, cy - 10, 5.5, 20, 2);
  g.fill();
};

const drawLabel: Draw = (g, p, W, H) => {
  const ink = parseColor(p.color, [255, 255, 255]);
  const fill = p.bg ? parseColor(p.bg, [23, 22, 58]) : null;
  const ph = 74;
  const text = p.text || ' ';
  const padL = 56;
  const padR = 32;
  const maxText = W - 24 - padL - padR;
  const size = fit(g, text, (z) => `700 ${z}px ${F_DISPLAY}`, maxText, 40, 12);
  g.font = `700 ${size}px ${F_DISPLAY}`;
  const tw = g.measureText(text).width;
  const pw = Math.min(W - 24, Math.max(150, padL + tw + padR));
  const px = (W - pw) / 2;
  const py = (H - ph) / 2;
  if (fill) {
    g.save();
    pillShadow(g, 0.28, 10, 3);
    rr(g, px, py, pw, ph, ph / 2);
    g.fillStyle = rgb(fill);
    g.fill();
    g.restore();
    const hg = g.createLinearGradient(0, py, 0, py + ph);
    hg.addColorStop(0, 'rgba(255,255,255,0.22)');
    hg.addColorStop(0.5, 'rgba(255,255,255,0)');
    hg.addColorStop(1, 'rgba(0,0,0,0.12)');
    rr(g, px, py, pw, ph, ph / 2);
    g.fillStyle = hg;
    g.fill();
  } else {
    rr(g, px + 2, py + 2, pw - 4, ph - 4, (ph - 4) / 2);
    g.strokeStyle = rgb(ink);
    g.lineWidth = 4;
    g.stroke();
  }
  // eyelet, punched through the tag
  const ex = px + 30;
  g.save();
  if (fill) g.globalCompositeOperation = 'destination-out';
  g.fillStyle = fill ? '#000' : rgb(ink);
  g.beginPath();
  g.arc(ex, H / 2, 8, 0, TAU);
  g.fill();
  g.restore();
  g.strokeStyle = rgb(ink, 0.5);
  g.lineWidth = 2;
  g.beginPath();
  g.arc(ex, H / 2, 11.5, 0, TAU);
  g.stroke();
  g.fillStyle = rgb(ink);
  g.font = `700 ${size}px ${F_DISPLAY}`;
  inkCentered(g, text, px + padL, H / 2, 'left');
};

const drawBattery: Draw = (g, p, W, H) => {
  const ink = parseColor(p.color, [255, 255, 255]);
  const plate = p.bg ? parseColor(p.bg, [28, 27, 34]) : null;
  if (plate) {
    g.save();
    pillShadow(g, 0.22, 10, 3);
    rr(g, 6, 6, W - 12, H - 12, 28);
    g.fillStyle = rgb(plate);
    g.fill();
    g.restore();
  }
  const raw = p.text || '';
  const m = /(\d+(?:[.,]\d+)?)/.exec(raw);
  const pct = clamp(m ? parseFloat(m[1].replace(',', '.')) : 100, 0, 100);
  const label = m ? `${Math.round(pct)}%` : raw;
  const bw = 296;
  const bh = 112;
  const nub = 16;
  const x0 = (W - bw - nub - 4) / 2;
  const y0 = (H - bh) / 2;
  const col = pct <= 20 ? ([255, 69, 58] as RGB) : ink;
  if (!plate) {
    g.shadowColor = 'rgba(0,0,0,0.28)';
    g.shadowBlur = 8;
    g.shadowOffsetY = 2;
  }
  g.strokeStyle = rgb(ink, 0.9);
  g.lineWidth = 7;
  rr(g, x0, y0, bw, bh, 30);
  g.stroke();
  g.fillStyle = rgb(ink, 0.9);
  g.beginPath();
  g.moveTo(x0 + bw + 6, y0 + bh / 2 - 20);
  g.arcTo(x0 + bw + 6 + nub, y0 + bh / 2 - 20, x0 + bw + 6 + nub, y0 + bh / 2, 8);
  g.arcTo(x0 + bw + 6 + nub, y0 + bh / 2 + 20, x0 + bw + 6, y0 + bh / 2 + 20, 8);
  g.lineTo(x0 + bw + 6, y0 + bh / 2 + 20);
  g.closePath();
  g.fill();
  noShadow(g);

  const pad = 11;
  const fx = x0 + pad;
  const fy = y0 + pad;
  const fw = (bw - pad * 2) * (pct / 100);
  const fh = bh - pad * 2;
  const size = fit(g, label, (z) => `800 ${z}px ${F_DISPLAY}`, bw - 60, 64, 14);
  const cx = x0 + bw / 2;
  const cy = y0 + bh / 2;
  const drawLabelText = () => {
    g.font = `800 ${size}px ${F_DISPLAY}`;
    inkCentered(g, label, cx, cy);
  };
  // unfilled part: ink text
  g.save();
  g.beginPath();
  g.rect(fx + fw, y0, bw, bh);
  g.clip();
  g.fillStyle = rgb(ink);
  drawLabelText();
  g.restore();
  // filled part
  if (fw > 1) {
    g.save();
    rr(g, fx, fy, fw, fh, 20);
    g.fillStyle = rgb(col);
    g.fill();
    g.clip();
    // text is knocked out of the fill (plate colour when there is a plate)
    if (plate) {
      g.fillStyle = rgb(plate);
      drawLabelText();
    } else {
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = '#000';
      drawLabelText();
    }
    g.restore();
  }
};

const drawCaption: Draw = (g, p, W, H) => {
  const ink = parseColor(p.color, [43, 42, 53]);
  const text = p.text || ' ';
  const size = fit(g, text, (z) => `${z}px ${F_CAVEAT}`, W - 40, 96, 18);
  g.save();
  g.translate(W / 2, H / 2);
  g.rotate(-0.025);
  g.font = `${size}px ${F_CAVEAT}`;
  g.fillStyle = rgb(ink, 0.96);
  inkCentered(g, text, 0, -2);
  // slight ink bleed so the pen strokes feel fuller
  g.fillStyle = rgb(ink, 0.35);
  inkCentered(g, text, 0.5, -1.6);
  g.restore();
};

const drawTimecode: Draw = (g, p, W, H) => {
  const ink = parseColor(p.color, [255, 255, 255]);
  g.shadowColor = 'rgba(0,0,0,0.55)';
  g.shadowBlur = 5;
  g.shadowOffsetY = 1.5;
  g.fillStyle = rgb(ink);
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  // REC row
  g.fillStyle = '#FF3B30';
  g.beginPath();
  g.arc(32, 31, 8, 0, TAU);
  g.fill();
  g.fillStyle = rgb(ink);
  g.font = `32px ${F_VT}`;
  g.fillText('REC', 48, 41);
  g.textAlign = 'right';
  g.font = `28px ${F_VT}`;
  g.fillStyle = rgb(ink, 0.85);
  g.fillText('SP  AUTO', W - 22, 40);

  // PLAY > 00:03:21
  const mode = (p.text2 || 'PLAY').toUpperCase();
  const time = p.text || ' ';
  const triW = 0.52;
  const mk = (z: number) => `${z}px ${F_VT}`;
  g.font = mk(100);
  const w100 = g.measureText(mode).width + g.measureText(time).width + 100 * (triW + 0.7);
  const size = Math.min(62, ((W - 44) / Math.max(1, w100)) * 100);
  g.font = mk(size);
  const mw = g.measureText(mode).width;
  const tw = g.measureText(time).width;
  const total = mw + size * (triW + 0.7) + tw;
  let x = (W - total) / 2;
  const y = H - 22;
  g.fillStyle = rgb(ink);
  g.textAlign = 'left';
  g.fillText(mode, x, y);
  x += mw + size * 0.25;
  g.beginPath();
  g.moveTo(x, y - size * 0.62);
  g.lineTo(x + size * 0.42, y - size * 0.34);
  g.lineTo(x, y - size * 0.06);
  g.closePath();
  g.fill();
  x += size * (triW + 0.45);
  g.fillText(time, x, y);
};

const drawBadge: Draw = (g, p, W, H) => {
  const ink = parseColor(p.color, [23, 22, 58]);
  const disc = p.bg ? parseColor(p.bg, [255, 216, 77]) : null;
  const cx = W / 2;
  const cy = H / 2;
  const R = 188;
  if (disc) {
    // die-cut white sticker margin
    g.save();
    pillShadow(g, 0.3, 10, 3);
    g.fillStyle = '#FFFFFF';
    g.beginPath();
    g.arc(cx, cy, R, 0, TAU);
    g.fill();
    g.restore();
    const dg = g.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    dg.addColorStop(0, rgb(mixc(disc, [255, 255, 255], 0.18)));
    dg.addColorStop(1, rgb(mixc(disc, [0, 0, 0], 0.08)));
    g.fillStyle = dg;
    g.beginPath();
    g.arc(cx, cy, R - 12, 0, TAU);
    g.fill();
  }
  const out = R - 12;
  g.strokeStyle = rgb(ink);
  g.fillStyle = rgb(ink);
  g.lineWidth = 3.5;
  g.beginPath();
  g.arc(cx, cy, out - 12, 0, TAU);
  g.stroke();
  g.lineWidth = 1.6;
  g.beginPath();
  g.arc(cx, cy, out - 22, 0, TAU);
  g.stroke();
  g.lineWidth = 2;
  g.beginPath();
  g.arc(cx, cy, 98, 0, TAU);
  g.stroke();
  g.lineWidth = 1.6;
  g.beginPath();
  g.arc(cx, cy, 90, 0, TAU);
  g.stroke();

  // ring text, repeated to close the circle
  const base = (p.text || ' ').toUpperCase().trim() || ' ';
  const radius = 126;
  const mk = (z: number) => `800 ${z}px ${F_DISPLAY}`;
  const unit = `${base}  *  `;
  const circ = TAU * radius;
  g.font = mk(30);
  const uw = spacedWidth(g, unit, 2);
  const reps = Math.max(1, Math.round(circ / uw));
  const full = unit.repeat(reps);
  const scale = clamp(circ / (spacedWidth(g, full, 2) + 2), 0.5, 1.4);
  const size = clamp(30 * scale, 14, 40);
  g.font = mk(size);
  const chars = Array.from(full);
  const sp = (circ - chars.reduce((a, ch) => a + g.measureText(ch).width, 0)) / chars.length;
  g.fillStyle = rgb(ink);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let pos = 0;
  chars.forEach((ch) => {
    const w = g.measureText(ch).width;
    const a = -Math.PI / 2 + ((pos + w / 2) / circ) * TAU;
    pos += w + sp;
    g.save();
    g.translate(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
    g.rotate(a + Math.PI / 2);
    if (ch === '*') {
      starPath(g, 0, 0, size * 0.34, size * 0.15);
      g.fill();
    } else g.fillText(ch, 0, 0);
    g.restore();
  });

  // centre
  const c = p.text2 || '';
  const cs = fit(g, c, (z) => `800 ${z}px ${F_DISPLAY}`, 150, 84, 18);
  g.font = `800 ${cs}px ${F_DISPLAY}`;
  g.fillStyle = rgb(ink);
  inkCentered(g, c, cx, cy + 2);
  starPath(g, cx, cy - 66, 8, 3.4);
  g.fill();
  starPath(g, cx, cy + 68, 8, 3.4);
  g.fill();

  if (disc) {
    // sticker gloss
    g.save();
    g.beginPath();
    g.arc(cx, cy, out, 0, TAU);
    g.clip();
    const gl = g.createLinearGradient(cx - out, cy - out, cx + out * 0.3, cy + out * 0.6);
    gl.addColorStop(0, 'rgba(255,255,255,0.35)');
    gl.addColorStop(0.45, 'rgba(255,255,255,0.08)');
    gl.addColorStop(0.46, 'rgba(255,255,255,0)');
    g.fillStyle = gl;
    g.fillRect(0, 0, W, H);
    g.restore();
  }
};

const drawPostmark: Draw = (g, p, W, H) => {
  const ink = parseColor(p.color, [46, 42, 94]);
  const place = (p.text || '').toUpperCase().trim();
  const cx = 128;
  const cy = H / 2;
  const R = 100;
  g.save();
  g.translate(W / 2, H / 2);
  g.rotate(-0.07);
  g.translate(-W / 2, -H / 2);
  g.fillStyle = rgb(ink, 0.92);
  g.strokeStyle = rgb(ink, 0.92);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // rings
  g.lineWidth = 4.2;
  g.beginPath();
  g.arc(cx, cy, R, 0, TAU);
  g.stroke();
  g.lineWidth = 1.6;
  g.beginPath();
  g.arc(cx, cy, R - 7, 0, TAU);
  g.stroke();
  g.lineWidth = 2;
  g.beginPath();
  g.arc(cx, cy, 58, 0, TAU);
  g.stroke();

  // place name on the top arc, stars underneath
  const mk = (z: number) => `700 ${z}px ${F_SPACE}`;
  g.font = mk(21);
  const maxArc = Math.PI * 1.15 * 80;
  const sw = spacedWidth(g, place, 3);
  const size = sw > maxArc ? Math.max(9, (21 * maxArc) / sw) : 21;
  g.font = mk(size);
  g.textBaseline = 'alphabetic';
  if (place) arcText(g, place, cx, cy, 77, -Math.PI / 2, 3, true);
  g.font = mk(19);
  arcText(g, '* * *', cx, cy, 81, Math.PI / 2, 8, false);
  // side stars
  for (const a of [Math.PI + 0.02, -0.02]) {
    starPath(g, cx + Math.cos(a) * 77, cy + Math.sin(a) * 77, 6, 2.6);
    g.fill();
  }

  // date, centre
  const lines = (p.text2 || '').split('|').map((s) => s.trim()).filter(Boolean).slice(0, 2);
  if (lines.length) {
    const ds = Math.min(...lines.map((l) => fit(g, l, (z) => `700 ${z}px ${F_SPACE}`, 90, lines.length === 1 ? 26 : 23, 8)));
    g.font = `700 ${ds}px ${F_SPACE}`;
    g.fillStyle = rgb(ink, 0.95);
    g.textAlign = 'center';
    const lh = ds * 1.18;
    lines.forEach((l, i) => g.fillText(l, cx, cy + ds * 0.32 + (i - (lines.length - 1) / 2) * lh));
  }

  // wavy cancellation lines
  g.lineWidth = 4.6;
  g.strokeStyle = rgb(ink, 0.92);
  const waves = 5;
  for (let k = 0; k < waves; k++) {
    const y = cy + (k - (waves - 1) / 2) * 19;
    g.beginPath();
    for (let x = 226; x <= W - 8; x += 2) {
      const yy = y + Math.sin((x - 226) / 5.4 + k * 0.5) * 5.4;
      if (x === 226) g.moveTo(x, yy);
      else g.lineTo(x, yy);
    }
    g.stroke();
  }
  g.restore();

  // worn ink: punch tiny voids through everything
  const r = rng(hash(p.text + p.text2) + 11);
  g.save();
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 190; i++) {
    g.fillStyle = `rgba(0,0,0,${0.35 + r() * 0.65})`;
    g.beginPath();
    g.arc(r() * W, r() * H, 0.5 + r() * r() * 2.4, 0, TAU);
    g.fill();
  }
  g.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    g.strokeStyle = `rgba(0,0,0,${0.3 + r() * 0.5})`;
    g.lineWidth = 0.8 + r() * 1.6;
    const x = r() * W;
    const y = r() * H;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 40, y + (r() - 0.5) * 12);
    g.stroke();
  }
  g.restore();
};

const drawClock: Draw = (g, p, W, H) => {
  const ink = parseColor(p.color, [255, 255, 255]);
  const plate = p.bg ? parseColor(p.bg, [28, 27, 34]) : null;
  if (plate) {
    g.save();
    pillShadow(g, 0.22, 10, 3);
    rr(g, 6, 6, W - 12, H - 12, 34);
    const gr = g.createLinearGradient(0, 6, 0, H);
    gr.addColorStop(0, rgb(mixc(plate, [255, 255, 255], 0.08)));
    gr.addColorStop(1, rgb(plate));
    g.fillStyle = gr;
    g.fill();
    g.restore();
  } else {
    g.shadowColor = 'rgba(0,0,0,0.3)';
    g.shadowBlur = 14;
    g.shadowOffsetY = 2;
  }
  const date = p.text2 || '';
  const time = p.text || ' ';
  g.fillStyle = rgb(ink);
  g.textBaseline = 'alphabetic';
  let cyTime = H / 2;
  if (date) {
    const ds = fit(g, date.toUpperCase(), (z) => `600 ${z}px ${F_UI}`, W - 80, 21, 9);
    g.font = `600 ${ds}px ${F_UI}`;
    g.fillStyle = rgb(ink, 0.82);
    g.textAlign = 'center';
    spaced(g, date.toUpperCase(), W / 2, 50, 2.5, 'center');
    cyTime = H / 2 + 20;
  }
  const maxH = date ? 108 : 124;
  const ts = Math.min(fit(g, time, (z) => `800 ${z}px ${F_DISPLAY}`, W - 60, maxH * 1.15, 18), maxH * 1.15);
  g.font = `800 ${ts}px ${F_DISPLAY}`;
  g.fillStyle = rgb(ink);
  inkCentered(g, time, W / 2, cyTime);
};

const DRAWERS: Record<string, Draw> = {
  stamp: drawStamp,
  viewfinder: drawViewfinder,
  ticket: drawTicket,
  receipt: drawReceipt,
  barcode: drawBarcode,
  rating: drawRating,
  nowplaying: drawNowPlaying,
  label: drawLabel,
  battery: drawBattery,
  caption: drawCaption,
  timecode: drawTimecode,
  badge: drawBadge,
  postmark: drawPostmark,
  clock: drawClock,
};

// ---------------------------------------------------------------------------------------------
// entry
// ---------------------------------------------------------------------------------------------

export function drawWidget(id: string, p: WidgetParams, widthPx: number): HTMLCanvasElement {
  const def = WIDGETS.find((w) => w.id === id);
  const aspect = def?.aspect ?? 2;
  const wpx = Math.max(1, Math.round(Number.isFinite(widthPx) ? widthPx : LW));
  const hpx = Math.max(1, Math.round(wpx / aspect));
  const c = document.createElement('canvas');
  c.width = wpx;
  c.height = hpx;
  const g = c.getContext('2d');
  const draw = DRAWERS[id];
  if (!g || !draw) return c;
  const s = wpx / LW;
  g.scale(s, s);
  const params: WidgetParams = {
    text: typeof p?.text === 'string' ? p.text : '',
    text2: typeof p?.text2 === 'string' ? p.text2 : '',
    color: p?.color || def?.defaults.color || '#FFFFFF',
    bg: p?.bg || '',
  };
  try {
    g.save();
    draw(g, params, LW, hpx / s);
    g.restore();
  } catch {
    /* a widget must never throw */
  }
  return c;
}
