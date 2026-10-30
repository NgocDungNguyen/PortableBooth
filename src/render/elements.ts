import { fontCss } from '../film/doc';
import type { Item, StickerItem, TextItem, WidgetItem } from '../film/types';
import { getStickerImage } from '../assets/library';
import { drawWidget, WIDGETS } from './widgets';

/**
 * Every sticker, text and widget goes through the same path:
 *   rasterise at its pixel size -> crop -> tint -> outline -> blit with flip / opacity / blend / shadow.
 * Rasters are cached so dragging stays smooth.
 */

const cache = new Map<string, HTMLCanvasElement>();
const CACHE_MAX = 90;
const remember = (key: string, c: HTMLCanvasElement) => {
  cache.set(key, c);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
  return c;
};

const newCanvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};

let measureCtx: CanvasRenderingContext2D | null = null;
function measure(text: string, font: string, px: number, tracking: number): number {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * px * 0.55;
  measureCtx.font = `${px}px ${font}`;
  const base = [...(text || ' ')].reduce((s, ch) => s + measureCtx!.measureText(ch).width, 0);
  return tracking ? base + tracking * px * (Math.max(1, [...text].length) - 1) : measureCtx.measureText(text || ' ').width;
}

/** width of a text item in mm */
export function textWidthMm(t: Pick<TextItem, 'text' | 'font' | 'size' | 'tracking'>): number {
  return (measure(t.text, fontCss(t.font), 100, t.tracking) / 100) * t.size;
}

const widgetAspect = (id: string) => WIDGETS.find((w) => w.id === id)?.aspect ?? 2;

/** displayed box in mm (before rotation) */
export function itemBox(it: Item): { w: number; h: number } {
  if (it.kind === 'sticker') {
    const img = getStickerImage(it.sticker);
    const cw = (img?.naturalWidth || 1) * (1 - it.crop.l - it.crop.r);
    const ch = (img?.naturalHeight || 1) * (1 - it.crop.t - it.crop.b);
    return { w: it.size, h: it.size * (ch / cw) };
  }
  if (it.kind === 'widget') return { w: it.size, h: it.size / widgetAspect(it.widget) };
  return { w: textWidthMm(it) + (it.bg ? it.size * 0.8 : 0), h: it.size * 1.3 };
}

function rasterSticker(it: StickerItem, pxW: number): HTMLCanvasElement | null {
  const img = getStickerImage(it.sticker);
  if (!img) return null;
  const { l, t, r, b } = it.crop;
  const sx = img.naturalWidth * l, sy = img.naturalHeight * t;
  const sw = img.naturalWidth * (1 - l - r), sh = img.naturalHeight * (1 - t - b);
  const c = newCanvas(pxW, (pxW * sh) / sw);
  const x = c.getContext('2d')!;
  x.imageSmoothingQuality = 'high';
  x.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  if (it.tint) {
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = it.tint;
    x.fillRect(0, 0, c.width, c.height);
  }
  return c;
}

function drawTracked(x: CanvasRenderingContext2D, text: string, cx: number, cy: number, px: number, tracking: number) {
  if (!tracking) return x.fillText(text, cx, cy);
  const chars = [...text];
  const widths = chars.map((ch) => x.measureText(ch).width);
  const total = widths.reduce((s, w) => s + w, 0) + tracking * px * (chars.length - 1);
  let cur = cx - total / 2;
  x.textAlign = 'left';
  chars.forEach((ch, i) => {
    x.fillText(ch, cur, cy);
    cur += widths[i] + tracking * px;
  });
}

function rasterText(it: TextItem, ppm: number): HTMLCanvasElement {
  const px = it.size * ppm;
  const font = fontCss(it.font);
  const tw = measure(it.text, font, px, it.tracking);
  const padX = it.bg ? px * 0.4 : px * 0.1;
  const c = newCanvas(tw + padX * 2, px * 1.3);
  const x = c.getContext('2d')!;
  if (it.bg) {
    x.fillStyle = it.bg;
    x.beginPath();
    x.roundRect(0, px * 0.05, c.width, c.height - px * 0.1, px * 0.18);
    x.fill();
  }
  x.font = `${px}px ${font}`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillStyle = it.color;
  drawTracked(x, it.text, c.width / 2, c.height / 2 + px * 0.04, px, it.tracking);
  return c;
}

function rasterWidget(it: WidgetItem, pxW: number): HTMLCanvasElement {
  return drawWidget(it.widget, { text: it.text, text2: it.text2, color: it.color, bg: it.bg }, pxW);
}

/** stamp the alpha silhouette around the artwork */
function withOutline(base: HTMLCanvasElement, color: string, radiusPx: number): HTMLCanvasElement {
  const pad = Math.ceil(radiusPx) + 2;
  const out = newCanvas(base.width + pad * 2, base.height + pad * 2);
  const ox = out.getContext('2d')!;
  const sil = newCanvas(base.width, base.height);
  const sx = sil.getContext('2d')!;
  sx.drawImage(base, 0, 0);
  sx.globalCompositeOperation = 'source-in';
  sx.fillStyle = color;
  sx.fillRect(0, 0, sil.width, sil.height);
  const n = Math.max(16, Math.ceil(2 * Math.PI * radiusPx));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    ox.drawImage(sil, pad + Math.cos(a) * radiusPx, pad + Math.sin(a) * radiusPx);
  }
  ox.drawImage(base, pad, pad);
  return out;
}

function rasterKey(it: Item, pxW: number, ppm: number): string {
  const o = it.outline ? `${it.outline.color}:${it.outline.width}` : '';
  if (it.kind === 'sticker') return `s|${it.sticker}|${it.tint}|${JSON.stringify(it.crop)}|${pxW}|${o}|${ppm.toFixed(2)}`;
  if (it.kind === 'text') return `t|${it.text}|${it.font}|${it.color}|${it.bg}|${it.tracking}|${it.size}|${o}|${ppm.toFixed(2)}`;
  return `w|${it.widget}|${it.text}|${it.text2}|${it.color}|${it.bg}|${pxW}|${o}`;
}

const BLEND_OP: Record<string, GlobalCompositeOperation> = { normal: 'source-over', multiply: 'multiply', screen: 'screen', overlay: 'overlay' };

export function drawItem(ctx: CanvasRenderingContext2D, it: Item, ppm: number) {
  if (it.hidden) return;
  const pxW = Math.max(2, Math.round(it.size * ppm));
  const key = rasterKey(it, pxW, ppm);
  let ras = cache.get(key);
  if (!ras) {
    const base = it.kind === 'sticker' ? rasterSticker(it, pxW) : it.kind === 'text' ? rasterText(it, ppm) : rasterWidget(it, pxW);
    if (!base) return;
    // the outline pads the bitmap symmetrically, so it stays centred on the item
    ras = remember(key, it.outline && it.outline.width > 0 ? withOutline(base, it.outline.color, it.outline.width * ppm) : base);
  }
  ctx.save();
  ctx.translate(it.x * ppm, it.y * ppm);
  ctx.rotate((it.rot * Math.PI) / 180);
  if (it.flipX) ctx.scale(-1, 1);
  ctx.globalAlpha = it.opacity;
  ctx.globalCompositeOperation = BLEND_OP[it.blend] ?? 'source-over';
  if (it.shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.38)';
    ctx.shadowBlur = 1.4 * ppm;
    ctx.shadowOffsetY = 0.6 * ppm;
  }
  ctx.drawImage(ras, -ras.width / 2, -ras.height / 2);
  ctx.restore();
}
