import { FORMATS } from './layout';
import { filterById } from './filters';
import type { AdjustParams, Blend, Crop, FilmDoc, FontId, FormatId, Item, Outline, SlotState, StickerItem, TextItem, WidgetItem } from './types';
import { parseStickerId } from '../assets/library';
import { FRAME_STYLES } from '../render/frames';
import { OVERLAYS } from '../render/overlays';
import { WIDGETS } from '../render/widgets';

export const clamp = (n: number, lo: number, hi: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo);

export const DEFAULT_ADJUST: AdjustParams = {
  brightness: 0, contrast: 0, saturation: 0, warmth: 0, fade: 0, grain: 0, glow: 0, vignette: 0, intensity: 1,
};

export const FRAME_COLORS = [
  '#FFFFFF', '#F4EFE6', '#E9E4D8', '#FFD66B', '#F4A6B7', '#B9A7FF', '#9FD3FF', '#9EE6C6',
  '#17163A', '#0F0F12', '#D4174A', '#1F3A2E',
];
export const TEXT_COLORS = ['#FFFFFF', '#0F0F12', '#FFD66B', '#FF5C7A', '#7CE0B5', '#9CC9FF', '#B9A7FF', '#FF8A1F'];
export const TINT_COLORS = ['#FFFFFF', '#0F0F12', '#FFD66B', '#FF5C7A', '#FF8A1F', '#7CE0B5', '#9CC9FF', '#B9A7FF'];

export interface FontMeta {
  id: FontId;
  label: string;
  css: string;
}
export const FONTS: FontMeta[] = [
  { id: 'sans', label: 'Sans', css: '"Geist Variable", system-ui, sans-serif' },
  { id: 'bold', label: 'Bold', css: '"Bricolage Grotesque Variable", system-ui, sans-serif' },
  { id: 'serif', label: 'Serif', css: '"Instrument Serif", Georgia, serif' },
  { id: 'condensed', label: 'Tall', css: '"Bebas Neue", Impact, sans-serif' },
  { id: 'wide', label: 'Wide', css: '"Unbounded Variable", system-ui, sans-serif' },
  { id: 'mono', label: 'Mono', css: '"Space Mono", ui-monospace, monospace' },
  { id: 'type', label: 'Typewriter', css: '"Special Elite", "Courier New", monospace' },
  { id: 'script', label: 'Script', css: '"Caveat", cursive' },
  { id: 'marker', label: 'Marker', css: '"Permanent Marker", cursive' },
  { id: 'pixel', label: 'Pixel', css: '"VT323", monospace' },
];
export const fontCss = (id: FontId) => (FONTS.find((f) => f.id === id) ?? FONTS[0]).css;

export const MAX_TEXT = 40;
export const MAX_ITEMS = 60;
export const MAX_OVERLAYS = 4;

let counter = 0;
export function uid(prefix = 'id'): string {
  counter += 1;
  const rnd = typeof crypto !== 'undefined' && 'getRandomValues' in crypto ? crypto.getRandomValues(new Uint32Array(1))[0].toString(36) : String(Math.random()).slice(2, 8);
  return `${prefix}-${counter}-${rnd}`;
}

export const todayISO = (): string => new Date().toISOString().slice(0, 10);

const emptySlot = (): SlotState => ({ photoId: null, zoom: 1, ox: 0, oy: 0, filterId: null });
export const NO_CROP: Crop = { l: 0, t: 0, r: 0, b: 0 };

export function createDoc(format: FormatId, frames?: number): FilmDoc {
  const meta = FORMATS[format];
  const n = frames && meta.frameOptions.includes(frames) ? frames : meta.defaultFrames;
  return {
    v: 2, format, frames: n, frameStyle: format === 'film35' ? 'noise-film' : 'plain', frameColor: meta.defaultColor, frameColor2: '#17163A',
    corners: meta.defaultCorners, dateStamp: true, brandMark: true, date: todayISO(), filterId: 'original',
    adjust: { ...DEFAULT_ADJUST }, overlays: [], slots: Array.from({ length: n }, emptySlot), items: [],
  };
}

/** Switch format / frame count, keeping photos that still fit. */
export function reshape(doc: FilmDoc, format: FormatId, frames?: number): FilmDoc {
  const meta = FORMATS[format];
  const n = frames && meta.frameOptions.includes(frames) ? frames : meta.defaultFrames;
  const slots = Array.from({ length: n }, (_, i) => doc.slots[i] ?? emptySlot());
  const formatChanged = format !== doc.format;
  return {
    ...doc, format, frames: n, slots,
    frameColor: formatChanged ? meta.defaultColor : doc.frameColor,
    frameStyle: formatChanged ? (format === 'film35' ? 'noise-film' : 'plain') : doc.frameStyle,
    corners: formatChanged ? meta.defaultCorners : doc.corners,
    items: formatChanged ? [] : doc.items,
  };
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const BLENDS: Blend[] = ['normal', 'multiply', 'screen', 'overlay'];

const sanitizeOutline = (o: Outline | null | undefined): Outline | null =>
  o && typeof o === 'object' && HEX.test(o.color) ? { color: o.color, width: clamp(o.width, 0, 2.5) } : null;

function sanitizeCrop(c: Crop | undefined): Crop {
  const l = clamp(c?.l ?? 0, 0, 0.8), t = clamp(c?.t ?? 0, 0, 0.8);
  const r = clamp(c?.r ?? 0, 0, 0.9 - l), b = clamp(c?.b ?? 0, 0, 0.9 - t);
  return { l, t, r, b };
}

function sanitizeItem(it: Item): Item | null {
  if (!it || typeof it !== 'object') return null;
  const common = {
    id: typeof it.id === 'string' ? it.id.slice(0, 64) : uid('item'),
    x: clamp(it.x, -50, 400), y: clamp(it.y, -50, 400),
    size: clamp(it.size, 2, 200), rot: clamp(it.rot, -360, 360),
    flipX: !!it.flipX,
    opacity: clamp(it.opacity ?? 1, 0.05, 1),
    blend: BLENDS.includes(it.blend) ? it.blend : ('normal' as Blend),
    shadow: !!it.shadow,
    outline: sanitizeOutline(it.outline),
    locked: !!it.locked,
    hidden: !!it.hidden,
  };
  if (it.kind === 'sticker' && typeof it.sticker === 'string' && parseStickerId(it.sticker)) {
    return { kind: 'sticker', sticker: it.sticker.slice(0, 64), tint: it.tint && HEX.test(it.tint) ? it.tint : null, crop: sanitizeCrop(it.crop), ...common };
  }
  if (it.kind === 'text' && typeof it.text === 'string') {
    return {
      kind: 'text', text: it.text.slice(0, MAX_TEXT), font: FONTS.some((f) => f.id === it.font) ? it.font : 'sans',
      color: HEX.test(it.color) ? it.color : '#FFFFFF', tracking: clamp(it.tracking ?? 0, -0.1, 0.6),
      bg: it.bg && HEX.test(it.bg) ? it.bg : null, ...common,
    };
  }
  if (it.kind === 'widget' && WIDGETS.some((w) => w.id === it.widget)) {
    return {
      kind: 'widget', widget: it.widget, text: String(it.text ?? '').slice(0, MAX_TEXT), text2: String(it.text2 ?? '').slice(0, MAX_TEXT),
      color: HEX.test(it.color) ? it.color : '#0F0F12', bg: it.bg === '' || HEX.test(it.bg) ? it.bg : '', ...common,
    };
  }
  return null;
}

/** Clamp every field to its legal range. Safe to run on any doc, idempotent. */
export function sanitizeDoc(d: FilmDoc): FilmDoc {
  const meta = FORMATS[d.format] ?? FORMATS.strip;
  const format = FORMATS[d.format] ? d.format : 'strip';
  const frames = meta.frameOptions.includes(d.frames) ? d.frames : meta.defaultFrames;
  const a = d.adjust ?? DEFAULT_ADJUST;
  const bip = (n: number) => clamp(n, -1, 1);
  const uni = (n: number) => clamp(n, 0, 1);
  const slots = Array.from({ length: frames }, (_, i) => {
    const s = d.slots?.[i] ?? emptySlot();
    return {
      photoId: typeof s.photoId === 'string' ? s.photoId : null,
      zoom: clamp(s.zoom, 1, 3), ox: clamp(s.ox, -1, 1), oy: clamp(s.oy, -1, 1),
      filterId: typeof s.filterId === 'string' ? filterById(s.filterId).id : null,
    };
  });
  return {
    v: 2, format, frames,
    frameStyle: FRAME_STYLES.some((f) => f.id === d.frameStyle) ? d.frameStyle : 'plain',
    frameColor: HEX.test(d.frameColor) ? d.frameColor : meta.defaultColor,
    frameColor2: HEX.test(d.frameColor2) ? d.frameColor2 : '#17163A',
    corners: d.corners === 'round' ? 'round' : 'square',
    dateStamp: !!d.dateStamp, brandMark: !!d.brandMark,
    date: /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : todayISO(),
    filterId: filterById(d.filterId).id,
    adjust: {
      brightness: bip(a.brightness), contrast: bip(a.contrast), saturation: bip(a.saturation), warmth: bip(a.warmth),
      fade: uni(a.fade), grain: uni(a.grain), glow: uni(a.glow), vignette: uni(a.vignette), intensity: uni(a.intensity),
    },
    overlays: (d.overlays ?? [])
      .filter((o) => o && OVERLAYS.some((x) => x.id === o.id))
      .slice(0, MAX_OVERLAYS)
      .map((o) => ({ id: o.id, opacity: clamp(o.opacity, 0, 1) })),
    slots,
    items: (d.items ?? []).slice(0, MAX_ITEMS).map(sanitizeItem).filter((x): x is Item => x !== null),
  };
}

export const filledCount = (d: FilmDoc) => d.slots.filter((s) => s.photoId).length;
export const isComplete = (d: FilmDoc) => d.slots.every((s) => s.photoId);

/** "30 10 '26" style stamp */
export function stampText(iso: string): string {
  const [y, m, day] = iso.split('-');
  return `${day} ${m} '${y.slice(2)}`;
}

/** Put a photo in a slot, resetting its crop (the per-photo filter is kept). */
export function setSlotPhoto(d: FilmDoc, index: number, photoId: string): FilmDoc {
  if (index < 0 || index >= d.slots.length) return d;
  return { ...d, slots: d.slots.map((s, i) => (i === index ? { ...s, photoId, zoom: 1, ox: 0, oy: 0 } : s)) };
}
export const emptySlots = (d: FilmDoc): number[] => d.slots.flatMap((s, i) => (s.photoId ? [] : [i]));

const itemBase = (x: number, y: number, size: number) => ({
  id: uid('item'), x, y, size, rot: 0, flipX: false, opacity: 1, blend: 'normal' as Blend, shadow: false, outline: null,
  locked: false, hidden: false,
});
export function newSticker(sticker: string, mono: boolean, x: number, y: number, size: number): StickerItem {
  return { ...itemBase(x, y, size), kind: 'sticker', sticker, tint: mono ? '#FFFFFF' : null, crop: { ...NO_CROP } };
}
export function newText(text: string, color: string, x: number, y: number): TextItem {
  return { ...itemBase(x, y, 6), kind: 'text', text, font: 'sans', color, tracking: 0, bg: null };
}
export function newWidget(widget: string, d: { text: string; text2: string; color: string; bg: string }, x: number, y: number, size: number): WidgetItem {
  return { ...itemBase(x, y, size), kind: 'widget', widget, ...d };
}
