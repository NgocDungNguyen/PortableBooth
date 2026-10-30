export type FormatId = 'strip' | 'instant' | 'film35';
export type FontId = 'marker' | 'script' | 'type' | 'bold';

export interface SlotState {
  photoId: string | null;
  /** 1 = cover fit, up to 3 */
  zoom: number;
  /** pan, -1..1 (fraction of the spare image overflow) */
  ox: number;
  oy: number;
}

/** Bipolar sliders are -1..1, the rest 0..1. They are added on top of the chosen filter. */
export interface AdjustParams {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  fade: number;
  grain: number;
  glow: number;
  vignette: number;
  /** filter strength, 0..1 */
  intensity: number;
}

interface ItemBase {
  id: string;
  /** centre, in mm from the film's top-left */
  x: number;
  y: number;
  /** sticker width / text font size, mm */
  size: number;
  /** degrees */
  rot: number;
}
export interface StickerItem extends ItemBase {
  kind: 'sticker';
  sticker: string;
}
export interface TextItem extends ItemBase {
  kind: 'text';
  text: string;
  font: FontId;
  color: string;
}
export type Item = StickerItem | TextItem;

export interface FilmDoc {
  v: 1;
  format: FormatId;
  frames: number;
  frameColor: string;
  corners: 'square' | 'round';
  dateStamp: boolean;
  brandMark: boolean;
  /** ISO date (yyyy-mm-dd) printed by the date stamp */
  date: string;
  filterId: string;
  adjust: AdjustParams;
  slots: SlotState[];
  items: Item[];
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
