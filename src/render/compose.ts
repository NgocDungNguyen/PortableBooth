import { fontCss, stampText } from '../film/doc';
import { computeLayout } from '../film/layout';
import type { FilmDoc, Item, Rect, SlotState, TextItem } from '../film/types';
import { getStickerImage } from '../assets/stickers';
import { getPhoto, type Photo } from '../media/photos';
import { applyCpu } from './cpu';
import { FilterGL } from './gl';
import { isIdentity, resolveParams } from './params';

export const PPM_300DPI = 300 / 25.4;
export const BRAND = 'PortableBooth';

let gl: FilterGL | null | undefined;
const sharedGL = () => (gl === undefined || gl?.lost ? (gl = FilterGL.create()) : gl);
export const webglAvailable = () => sharedGL() !== null;

const scratch = (() => {
  let c: HTMLCanvasElement | null = null;
  return () => (c ??= document.createElement('canvas'));
})();

let paper: CanvasPattern | null = null;
function paperPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (paper) return paper;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  if (!x) return null;
  const img = x.createImageData(128, 128);
  let s = 7;
  for (let i = 0; i < img.data.length; i += 4) {
    s = (s * 16807) % 2147483647;
    const v = (s % 255) | 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  paper = ctx.createPattern(c, 'repeat');
  return paper;
}

const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};
export const inkOn = (bg: string) => (luminance(bg) > 0.6 ? '#17163A' : '#FFFFFF');

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (r > 0) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

export function drawCover(ctx: CanvasRenderingContext2D, ph: Photo, r: Rect, s: SlotState) {
  const k = Math.max(r.w / ph.w, r.h / ph.h) * s.zoom;
  const dw = ph.w * k;
  const dh = ph.h * k;
  const dx = r.x + (r.w - dw) / 2 + (s.ox * (dw - r.w)) / 2;
  const dy = r.y + (r.h - dh) / 2 + (s.oy * (dh - r.h)) / 2;
  ctx.drawImage(ph.canvas, dx, dy, dw, dh);
}

let measureCtx: CanvasRenderingContext2D | null = null;
/** width of a text item in mm */
export function textWidthMm(t: Pick<TextItem, 'text' | 'font' | 'size'>): number {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return t.text.length * t.size * 0.55;
  measureCtx.font = `100px ${fontCss(t.font)}`;
  return (measureCtx.measureText(t.text || ' ').width / 100) * t.size;
}
export function itemBox(it: Item): { w: number; h: number } {
  return it.kind === 'sticker' ? { w: it.size, h: it.size } : { w: textWidthMm(it), h: it.size * 1.25 };
}

function drawItem(ctx: CanvasRenderingContext2D, it: Item, ppm: number) {
  ctx.save();
  ctx.translate(it.x * ppm, it.y * ppm);
  ctx.rotate((it.rot * Math.PI) / 180);
  if (it.kind === 'sticker') {
    const img = getStickerImage(it.sticker);
    if (img) {
      ctx.shadowColor = 'rgba(23,22,58,0.25)';
      ctx.shadowBlur = 0.8 * ppm;
      ctx.shadowOffsetY = 0.4 * ppm;
      ctx.drawImage(img, (-it.size / 2) * ppm, (-it.size / 2) * ppm, it.size * ppm, it.size * ppm);
    }
  } else {
    ctx.font = `${it.size * ppm}px ${fontCss(it.font)}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = it.color;
    ctx.fillText(it.text, 0, 0);
  }
  ctx.restore();
}

export interface RenderOptions {
  /** pixels per millimetre */
  ppm: number;
  /** draw "+" placeholders for empty slots */
  showEmpty?: boolean;
  /** paint behind rounded corners (JPEG has no alpha) */
  matte?: string;
}

export interface RenderResult {
  width: number;
  height: number;
  ppm: number;
  usedWebGL: boolean;
}

export function renderFilm(target: HTMLCanvasElement, doc: FilmDoc, opts: RenderOptions): RenderResult {
  const layout = computeLayout(doc.format, doc.frames, doc.corners);
  const g = sharedGL();
  const cap = Math.min(g?.maxSize ?? 4096, 8192);
  const ppm = Math.min(opts.ppm, cap / Math.max(layout.widthMm, layout.heightMm));
  const W = Math.max(1, Math.round(layout.widthMm * ppm));
  const H = Math.max(1, Math.round(layout.heightMm * ppm));
  if (target.width !== W) target.width = W;
  if (target.height !== H) target.height = H;
  const ctx = target.getContext('2d');
  if (!ctx) return { width: W, height: H, ppm, usedWebGL: false };
  ctx.clearRect(0, 0, W, H);
  if (opts.matte) {
    ctx.fillStyle = opts.matte;
    ctx.fillRect(0, 0, W, H);
  }

  // 1. film body + paper texture
  ctx.save();
  roundRect(ctx, 0, 0, W, H, layout.outerRadius * ppm);
  ctx.fillStyle = doc.frameColor;
  ctx.fill();
  ctx.clip();
  const pat = paperPattern(ctx);
  if (pat) {
    ctx.globalAlpha = luminance(doc.frameColor) > 0.5 ? 0.05 : 0.07;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();

  const ink = inkOn(doc.frameColor);

  // 2. 35mm perforations
  if (layout.holes.length) {
    ctx.fillStyle = luminance(doc.frameColor) > 0.5 ? '#17163A' : '#F4F0E8';
    for (const h of layout.holes) {
      roundRect(ctx, h.x * ppm, h.y * ppm, h.w * ppm, h.h * ppm, layout.holeRadius * ppm);
      ctx.fill();
    }
  }

  // 3. photos -> filter pass
  const slotsPx: Rect[] = layout.slots.map((s) => ({ x: s.x * ppm, y: s.y * ppm, w: s.w * ppm, h: s.h * ppm }));
  const layer = scratch();
  layer.width = W;
  layer.height = H;
  const lctx = layer.getContext('2d');
  if (lctx) {
    lctx.clearRect(0, 0, W, H);
    doc.slots.forEach((s, i) => {
      const ph = getPhoto(s.photoId);
      if (!ph) return;
      const r = slotsPx[i];
      lctx.save();
      roundRect(lctx, r.x, r.y, r.w, r.h, layout.slotRadius * ppm);
      lctx.clip();
      drawCover(lctx, ph, r, s);
      lctx.restore();
    });
    const params = resolveParams(doc);
    const uvSlots = slotsPx.map((r) => ({ x: r.x / W, y: r.y / H, w: r.w / W, h: r.h / H }));
    let filtered: HTMLCanvasElement = layer;
    if (!isIdentity(params)) {
      const viaGL = g ? g.apply(layer, params, uvSlots, 1.7) : null;
      if (viaGL) {
        filtered = viaGL;
      } else if (W * H <= 4_500_000) {
        filtered = applyCpu(layer, params, uvSlots);
      }
    }
    ctx.drawImage(filtered, 0, 0);

    // 4. empty slot placeholders + inner edge
    doc.slots.forEach((s, i) => {
      const r = slotsPx[i];
      if (!getPhoto(s.photoId) && opts.showEmpty) {
        roundRect(ctx, r.x, r.y, r.w, r.h, layout.slotRadius * ppm);
        ctx.fillStyle = luminance(doc.frameColor) > 0.5 ? 'rgba(23,22,58,0.1)' : 'rgba(255,255,255,0.14)';
        ctx.fill();
        ctx.strokeStyle = ink;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 0.5 * ppm;
        ctx.lineCap = 'round';
        const cx = r.x + r.w / 2, cy = r.y + r.h / 2, a = Math.min(r.w, r.h) * 0.12;
        ctx.beginPath();
        ctx.moveTo(cx - a, cy); ctx.lineTo(cx + a, cy); ctx.moveTo(cx, cy - a); ctx.lineTo(cx, cy + a);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (getPhoto(s.photoId) && doc.format === 'instant') {
        roundRect(ctx, r.x, r.y, r.w, r.h, layout.slotRadius * ppm);
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 0.3 * ppm;
        ctx.stroke();
      }
    });

    // 5. date stamp on the last filled photo
    if (doc.dateStamp) {
      let last = -1;
      doc.slots.forEach((s, i) => {
        if (getPhoto(s.photoId)) last = i;
      });
      if (last >= 0) {
        const r = slotsPx[last];
        const size = Math.min(4.2 * ppm, r.h * 0.12);
        ctx.save();
        ctx.font = `${size}px "VT323"`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'alphabetic';
        ctx.shadowColor = 'rgba(255,120,20,0.9)';
        ctx.shadowBlur = size * 0.35;
        ctx.fillStyle = '#FF9A2E';
        ctx.fillText(stampText(doc.date), r.x + r.w - size * 0.6, r.y + r.h - size * 0.55);
        ctx.restore();
      }
    }
  }

  // 6. captions / film edge text
  ctx.save();
  ctx.fillStyle = ink;
  ctx.textBaseline = 'middle';
  if (layout.caption && doc.brandMark) {
    const c = layout.caption;
    const size = (doc.format === 'strip' ? 3.4 : 3.1) * ppm;
    ctx.font = `700 ${size}px "Bricolage Grotesque Variable"`;
    ctx.textAlign = doc.format === 'strip' ? 'center' : 'right';
    const bx = doc.format === 'strip' ? (c.x + c.w / 2) * ppm : (c.x + c.w) * ppm;
    ctx.globalAlpha = 0.85;
    ctx.fillText(BRAND, bx, (c.y + c.h - 3.4) * ppm);
  }
  if (doc.format === 'film35') {
    ctx.fillStyle = '#FFA726';
    ctx.font = `${1.9 * ppm}px "Special Elite"`;
    ctx.textAlign = 'left';
    if (doc.brandMark) ctx.fillText(`${BRAND.toUpperCase()} 400`, 8 * ppm, 4.4 * ppm);
    layout.frameNumberYs.forEach((y, i) => ctx.fillText(`> ${i + 1}  ${i + 1}A`, 8 * ppm, y * ppm));
    ctx.textAlign = 'right';
    ctx.fillText('>', (layout.widthMm - 8) * ppm, (layout.heightMm - 3.6) * ppm);
  }
  ctx.restore();

  // 7. stickers + text on top
  for (const it of doc.items) drawItem(ctx, it, ppm);

  return { width: W, height: H, ppm, usedWebGL: !!g };
}

/** Small square preview of one photo under one filter (for the filter picker). */
export function renderFilterThumb(target: HTMLCanvasElement, photo: Photo, filterId: string, size = 96) {
  const src = scratch();
  src.width = size;
  src.height = size;
  const sctx = src.getContext('2d');
  const ctx = target.getContext('2d');
  if (!sctx || !ctx) return;
  target.width = size;
  target.height = size;
  sctx.clearRect(0, 0, size, size);
  drawCover(sctx, photo, { x: 0, y: 0, w: size, h: size }, { photoId: null, zoom: 1, ox: 0, oy: 0 });
  const params = resolveParams({ filterId, adjust: { brightness: 0, contrast: 0, saturation: 0, warmth: 0, fade: 0, grain: 0, glow: 0, vignette: 0, intensity: 1 } });
  const slots = [{ x: 0, y: 0, w: 1, h: 1 }];
  const g = sharedGL();
  const out = isIdentity(params) ? src : (g?.apply(src, params, slots, 1.7) ?? applyCpu(src, params, slots));
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(out, 0, 0);
}
