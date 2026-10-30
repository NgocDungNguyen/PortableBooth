export type FormatId = 'strip' | 'instant' | 'film35';
/** portrait = tall (real film stock, print); landscape = wide (for sharing) */
export type Orientation = 'portrait' | 'landscape';
export type FontId = 'sans' | 'bold' | 'serif' | 'condensed' | 'wide' | 'mono' | 'type' | 'script' | 'marker' | 'pixel';
export type Blend = 'normal' | 'multiply' | 'screen' | 'overlay';

export interface SlotState {
  photoId: string | null;
  /** 1 = cover fit, up to 3 */
  zoom: number;
  /** pan, -1..1 (fraction of the spare image overflow) */
  ox: number;
  oy: number;
  /** per-photo filter; null = use the film's filter */
  filterId: string | null;
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

/** insets as a fraction of the source image (0..0.9 each) */
export interface Crop {
  l: number;
  t: number;
  r: number;
  b: number;
}

export interface Outline {
  color: string;
  /** mm */
  width: number;
}

interface ItemBase {
  id: string;
  /** centre, in mm from the film's top-left */
  x: number;
  y: number;
  /** displayed width in mm (text: font size) */
  size: number;
  /** degrees */
  rot: number;
  flipX: boolean;
  opacity: number;
  blend: Blend;
  shadow: boolean;
  outline: Outline | null;
  locked: boolean;
  hidden: boolean;
}
export interface StickerItem extends ItemBase {
  kind: 'sticker';
  /** library id, `${pack}/${name}` */
  sticker: string;
  /** recolour (source-in); null keeps the artwork's own colours */
  tint: string | null;
  crop: Crop;
}
export interface TextItem extends ItemBase {
  kind: 'text';
  text: string;
  font: FontId;
  color: string;
  /** letter spacing in em */
  tracking: number;
  /** highlight bar colour behind the text */
  bg: string | null;
}
export interface WidgetItem extends ItemBase {
  kind: 'widget';
  widget: string;
  text: string;
  text2: string;
  color: string;
  bg: string;
}
export type Item = StickerItem | TextItem | WidgetItem;

export interface OverlayRef {
  id: string;
  opacity: number;
}

export interface FilmDoc {
  v: 2;
  format: FormatId;
  /** each (format, orientation) pair has its own hand-built geometry; missing = portrait */
  orientation: Orientation;
  frames: number;
  frameStyle: string;
  frameColor: string;
  frameColor2: string;
  corners: 'square' | 'round';
  dateStamp: boolean;
  brandMark: boolean;
  /** ISO date (yyyy-mm-dd) printed by the date stamp */
  date: string;
  filterId: string;
  adjust: AdjustParams;
  overlays: OverlayRef[];
  slots: SlotState[];
  items: Item[];
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
