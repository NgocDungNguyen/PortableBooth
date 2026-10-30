import { stampText } from '../film/doc';
import { computeLayout } from '../film/layout';
import type { FilmDoc, Rect, SlotState } from '../film/types';
import { getPhoto, type Photo } from '../media/photos';
import { applyCpu } from './cpu';
import { drawItem } from './elements';
import { paintFrameBody } from './frames';
import { FilterGL } from './gl';
import { drawOverlay } from './overlays';
import { isIdentity, resolveParams } from './params';

export { itemBox, textWidthMm } from './elements';
export const PPM_300DPI = 300 / 25.4;
export const BRAND = 'PortableBooth';

let gl: FilterGL | null | undefined;
const sharedGL = () => (gl === undefined || gl?.lost ? (gl = FilterGL.create()) : gl);
export const webglAvailable = () => sharedGL() !== null;

const scratch = (() => {
  let c: HTMLCanvasElement | null = null;
  return () => (c ??= document.createElement('canvas'));
})();

const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};
export const inkOn = (bg: string) => (luminance(bg) > 0.6 ? '#0F0F12' : '#FFFFFF');

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

  // 1. film body (colour, pattern, edge)
  paintFrameBody(ctx, W, H, { style: doc.frameStyle, color: doc.frameColor, color2: doc.frameColor2, ppm, radiusMm: layout.outerRadius, seed: 7 });
  const ink = inkOn(doc.frameColor);

  // 2. 35mm perforations
  if (layout.holes.length) {
    ctx.fillStyle = luminance(doc.frameColor) > 0.5 ? '#17163A' : '#F4F0E8';
    for (const h of layout.holes) {
      roundRect(ctx, h.x * ppm, h.y * ppm, h.w * ppm, h.h * ppm, layout.holeRadius * ppm);
      ctx.fill();
    }
  }

  // 3. photos -> filter pass, one pass per distinct filter (film filter + per-photo overrides)
  const slotsPx: Rect[] = layout.slots.map((s) => ({ x: s.x * ppm, y: s.y * ppm, w: s.w * ppm, h: s.h * ppm }));
  const layer = scratch();
  layer.width = W;
  layer.height = H;
  const lctx = layer.getContext('2d');
  if (lctx) {
    const groups = new Map<string, number[]>();
    doc.slots.forEach((s, i) => {
      if (!getPhoto(s.photoId)) return;
      const id = s.filterId ?? doc.filterId;
      groups.set(id, [...(groups.get(id) ?? []), i]);
    });
    groups.forEach((indices, filterId) => {
      lctx.clearRect(0, 0, W, H);
      indices.forEach((i) => {
        const ph = getPhoto(doc.slots[i].photoId)!;
        const r = slotsPx[i];
        lctx.save();
        roundRect(lctx, r.x, r.y, r.w, r.h, layout.slotRadius * ppm);
        lctx.clip();
        drawCover(lctx, ph, r, doc.slots[i]);
        lctx.restore();
      });
      const params = resolveParams({ filterId, adjust: doc.adjust });
      const uvSlots = indices.map((i) => ({ x: slotsPx[i].x / W, y: slotsPx[i].y / H, w: slotsPx[i].w / W, h: slotsPx[i].h / H }));
      let filtered: HTMLCanvasElement = layer;
      if (!isIdentity(params)) {
        const viaGL = g ? g.apply(layer, params, uvSlots, 1.7) : null;
        if (viaGL) filtered = viaGL;
        else if (W * H <= 4_500_000) filtered = applyCpu(layer, params, uvSlots);
      }
      ctx.drawImage(filtered, 0, 0);
    });

    // 4. overlays (light leaks, dust, grain...) inside each filled photo
    if (doc.overlays.length) {
      doc.slots.forEach((s, i) => {
        if (!getPhoto(s.photoId)) return;
        const r = slotsPx[i];
        ctx.save();
        roundRect(ctx, r.x, r.y, r.w, r.h, layout.slotRadius * ppm);
        ctx.clip();
        doc.overlays.forEach((o, k) => drawOverlay(ctx, o.id, r, o.opacity, 11 + i * 7 + k * 31, ppm));
        ctx.restore();
      });
    }

    // 5. empty slot placeholders + inner edge
    doc.slots.forEach((s, i) => {
      const r = slotsPx[i];
      const has = !!getPhoto(s.photoId);
      if (!has && opts.showEmpty) {
        roundRect(ctx, r.x, r.y, r.w, r.h, layout.slotRadius * ppm);
        ctx.fillStyle = luminance(doc.frameColor) > 0.5 ? 'rgba(15,15,18,0.07)' : 'rgba(255,255,255,0.1)';
        ctx.fill();
        ctx.setLineDash([ppm * 1.6, ppm * 1.2]);
        ctx.strokeStyle = ink;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 0.35 * ppm;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
      if (has && doc.format === 'instant') {
        roundRect(ctx, r.x, r.y, r.w, r.h, layout.slotRadius * ppm);
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 0.3 * ppm;
        ctx.stroke();
      }
    });

    // 6. date stamp on the last filled photo
    if (doc.dateStamp) {
      let last = -1;
      doc.slots.forEach((s, i) => {
        if (getPhoto(s.photoId)) last = i;
      });
      if (last >= 0) {
        const r = slotsPx[last];
        const size = Math.min(4.2 * ppm, r.h * 0.12);
        ctx.save();
        ctx.font = `${size}px "VT323", monospace`;
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

  // 7. captions / film edge text
  ctx.save();
  ctx.fillStyle = ink;
  ctx.textBaseline = 'middle';
  if (layout.caption && doc.brandMark) {
    const c = layout.caption;
    const size = (doc.format === 'strip' ? 3.2 : 3) * ppm;
    ctx.font = `600 ${size}px "Geist Variable", system-ui, sans-serif`;
    ctx.textAlign = doc.format === 'strip' ? 'center' : 'right';
    const bx = doc.format === 'strip' ? (c.x + c.w / 2) * ppm : (c.x + c.w) * ppm;
    ctx.globalAlpha = 0.8;
    ctx.fillText(BRAND, bx, (c.y + c.h - 3.4) * ppm);
  }
  if (doc.format === 'film35') {
    ctx.fillStyle = '#FFA726';
    ctx.font = `${1.9 * ppm}px "Special Elite", monospace`;
    ctx.textAlign = 'left';
    if (doc.brandMark) ctx.fillText(`${BRAND.toUpperCase()} 400`, 8 * ppm, 4.4 * ppm);
    layout.frameNumberYs.forEach((y, i) => ctx.fillText(`> ${i + 1}  ${i + 1}A`, 8 * ppm, y * ppm));
    ctx.textAlign = 'right';
    ctx.fillText('>', (layout.widthMm - 8) * ppm, (layout.heightMm - 3.6) * ppm);
  }
  ctx.restore();

  // 8. stickers, widgets, text (array order = layer order)
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
  drawCover(sctx, photo, { x: 0, y: 0, w: size, h: size }, { photoId: null, zoom: 1, ox: 0, oy: 0, filterId: null });
  const params = resolveParams({ filterId, adjust: { brightness: 0, contrast: 0, saturation: 0, warmth: 0, fade: 0, grain: 0, glow: 0, vignette: 0, intensity: 1 } });
  const slots = [{ x: 0, y: 0, w: 1, h: 1 }];
  const g = sharedGL();
  const out = isIdentity(params) ? src : (g?.apply(src, params, slots, 1.7) ?? applyCpu(src, params, slots));
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(out, 0, 0);
}
