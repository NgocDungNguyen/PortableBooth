import { FORMATS } from './layout';
import { filterById } from './filters';
import type { AdjustParams, FilmDoc, FontId, FormatId, Item, SlotState } from './types';

export const clamp = (n: number, lo: number, hi: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo);

export const DEFAULT_ADJUST: AdjustParams = {
  brightness: 0, contrast: 0, saturation: 0, warmth: 0, fade: 0, grain: 0, glow: 0, vignette: 0, intensity: 1,
};

export const FRAME_COLORS = [
  '#FFFFFF', '#FFF1CF', '#FFDD3C', '#8EEBC4', '#FFB3C9', '#C9B6FF', '#CDE7FF', '#17163A', '#D4174A', '#17120F',
];
export const TEXT_COLORS = ['#17163A', '#FFFFFF', '#FFDD3C', '#FF3B6B', '#8EEBC4', '#C9B6FF', '#FF8A1F'];

export interface FontMeta {
  id: FontId;
  label: string;
  css: string;
}
export const FONTS: FontMeta[] = [
  { id: 'marker', label: 'Marker', css: '"Permanent Marker"' },
  { id: 'script', label: 'Script', css: '"Caveat"' },
  { id: 'type', label: 'Typewriter', css: '"Special Elite"' },
  { id: 'bold', label: 'Bold', css: '"Bricolage Grotesque Variable"' },
];
export const fontCss = (id: FontId) => (FONTS.find((f) => f.id === id) ?? FONTS[0]).css;

export const MAX_TEXT = 40;
export const MAX_ITEMS = 40;

let counter = 0;
export function uid(prefix = 'id'): string {
  counter += 1;
  const rnd = typeof crypto !== 'undefined' && 'getRandomValues' in crypto ? crypto.getRandomValues(new Uint32Array(1))[0].toString(36) : String(Math.random()).slice(2, 8);
  return `${prefix}-${counter}-${rnd}`;
}

export const todayISO = (): string => new Date().toISOString().slice(0, 10);

const emptySlot = (): SlotState => ({ photoId: null, zoom: 1, ox: 0, oy: 0 });

export function createDoc(format: FormatId, frames?: number): FilmDoc {
  const meta = FORMATS[format];
  const n = frames && meta.frameOptions.includes(frames) ? frames : meta.defaultFrames;
  return {
    v: 1, format, frames: n, frameColor: meta.defaultColor, corners: meta.defaultCorners,
    dateStamp: true, brandMark: true, date: todayISO(), filterId: 'original', adjust: { ...DEFAULT_ADJUST },
    slots: Array.from({ length: n }, emptySlot), items: [],
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
    corners: formatChanged ? meta.defaultCorners : doc.corners,
    items: formatChanged ? [] : doc.items,
  };
}

const HEX = /^#[0-9a-fA-F]{6}$/;

function sanitizeItem(it: Item): Item | null {
  if (!it || typeof it !== 'object') return null;
  const common = {
    id: typeof it.id === 'string' ? it.id.slice(0, 64) : uid('item'),
    x: clamp(it.x, -50, 400), y: clamp(it.y, -50, 400),
    size: clamp(it.size, 2, 200), rot: clamp(it.rot, -360, 360),
  };
  if (it.kind === 'sticker' && typeof it.sticker === 'string') return { kind: 'sticker', sticker: it.sticker.slice(0, 32), ...common };
  if (it.kind === 'text' && typeof it.text === 'string') {
    return {
      kind: 'text', text: it.text.slice(0, MAX_TEXT), font: FONTS.some((f) => f.id === it.font) ? it.font : 'marker',
      color: HEX.test(it.color) ? it.color : '#17163A', ...common,
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
    };
  });
  return {
    v: 1, format, frames,
    frameColor: HEX.test(d.frameColor) ? d.frameColor : meta.defaultColor,
    corners: d.corners === 'round' ? 'round' : 'square',
    dateStamp: !!d.dateStamp, brandMark: !!d.brandMark,
    date: /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : todayISO(),
    filterId: filterById(d.filterId).id,
    adjust: {
      brightness: bip(a.brightness), contrast: bip(a.contrast), saturation: bip(a.saturation), warmth: bip(a.warmth),
      fade: uni(a.fade), grain: uni(a.grain), glow: uni(a.glow), vignette: uni(a.vignette), intensity: uni(a.intensity),
    },
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
