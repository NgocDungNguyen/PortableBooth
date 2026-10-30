import type { FormatId, Orientation, Rect } from './types';

export interface FormatMeta {
  id: FormatId;
  name: string;
  /** selectable frame counts (portrait / tall) */
  frameOptions: number[];
  defaultFrames: number;
  /** selectable frame counts (landscape / wide) */
  landscapeFrameOptions: number[];
  landscapeDefaultFrames: number;
  defaultColor: string;
  defaultCorners: 'square' | 'round';
}

export const FORMATS: Record<FormatId, FormatMeta> = {
  strip: { id: 'strip', name: 'Strip', frameOptions: [3, 4], defaultFrames: 4, landscapeFrameOptions: [3, 4], landscapeDefaultFrames: 4, defaultColor: '#FFFFFF', defaultCorners: 'square' },
  instant: { id: 'instant', name: 'Instant', frameOptions: [1, 2], defaultFrames: 1, landscapeFrameOptions: [1, 2], landscapeDefaultFrames: 1, defaultColor: '#FFFFFF', defaultCorners: 'round' },
  film35: { id: 'film35', name: '35mm', frameOptions: [2, 3], defaultFrames: 3, landscapeFrameOptions: [3, 4], landscapeDefaultFrames: 3, defaultColor: '#17120F', defaultCorners: 'square' },
};
export const FORMAT_ORDER: FormatId[] = ['strip', 'instant', 'film35'];

export const ORIENTATIONS: Orientation[] = ['portrait', 'landscape'];
export const isOrientation = (o: unknown): o is Orientation => o === 'portrait' || o === 'landscape';

export const frameOptionsFor = (format: FormatId, orientation: Orientation = 'portrait'): number[] =>
  orientation === 'landscape' ? FORMATS[format].landscapeFrameOptions : FORMATS[format].frameOptions;
export const defaultFramesFor = (format: FormatId, orientation: Orientation = 'portrait'): number =>
  orientation === 'landscape' ? FORMATS[format].landscapeDefaultFrames : FORMATS[format].defaultFrames;

/** The allowed frame count closest to `n` (ties go to the larger count, so photos are not dropped). */
export function nearestFrames(format: FormatId, orientation: Orientation, n: number): number {
  const opts = frameOptionsFor(format, orientation);
  return opts.reduce((best, o) => {
    const d = Math.abs(o - n);
    const bd = Math.abs(best - n);
    return d < bd || (d === bd && o > best) ? o : best;
  }, opts[0]);
}

export interface TextAnchor {
  x: number;
  y: number;
}

export interface FilmLayout {
  widthMm: number;
  heightMm: number;
  slots: Rect[];
  slotRadius: number;
  outerRadius: number;
  holes: Rect[];
  holeRadius: number;
  /** area under the photos (brand / caption) */
  caption: Rect | null;
  /** brand text in the caption area (anchor is the text's vertical middle), null = no caption text */
  captionBrand: { x: number; y: number; align: 'center' | 'right'; size: number } | null;
  /** thin dark edge around each photo (instant film) */
  slotHairline: boolean;
  /** printed film-edge text (35mm): brand, per-frame numbers and an end mark */
  edgeText: {
    brand: TextAnchor | null;
    frameNumbers: { x: number; y: number; text: string }[];
    endMark: { x: number; y: number; align: 'left' | 'right' } | null;
    /** font size in mm */
    size: number;
  } | null;
  /** y of each frame-number label (35mm, portrait only; kept for older callers) */
  frameNumberYs: number[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function stack(n: number, x: number, y: number, w: number, totalH: number, gap: number): Rect[] {
  const h = (totalH - gap * (n - 1)) / n;
  return Array.from({ length: n }, (_, i) => ({ x, y: round2(y + i * (h + gap)), w, h: round2(h) }));
}

function perforationsH(W: number, H: number): Rect[] {
  const pitch = 5.2;
  const hw = 2.8;
  const n = Math.floor((W - 3.2 - hw) / pitch) + 1;
  const x0 = (W - ((n - 1) * pitch + hw)) / 2;
  const holes: Rect[] = [];
  for (let i = 0; i < n; i++) {
    const x = round2(x0 + i * pitch);
    holes.push({ x, y: 1.6, w: hw, h: 2 });
    holes.push({ x, y: round2(H - 3.6), w: hw, h: 2 });
  }
  return holes;
}

const NO_TEXT = { slotHairline: false, edgeText: null, captionBrand: null, frameNumberYs: [] as number[] };

export function computeLayout(format: FormatId, frames: number, corners: 'square' | 'round', orientation: Orientation = 'portrait'): FilmLayout {
  const slotRadius = corners === 'round' ? 1.6 : 0;
  const land = orientation === 'landscape';
  if (format === 'strip') {
    if (land) {
      const W = 8 + 50 * frames + 3 * (frames - 1);
      const H = 54;
      const slots = Array.from({ length: frames }, (_, i) => ({ x: 4 + i * 53, y: 4, w: 50, h: 40 }));
      const caption = { x: 4, y: 44, w: W - 8, h: 10 };
      return {
        ...NO_TEXT, widthMm: W, heightMm: H, slots, slotRadius, outerRadius: corners === 'round' ? 2.5 : 0,
        holes: [], holeRadius: 0, caption, captionBrand: { x: caption.x + caption.w / 2, y: caption.y + caption.h / 2, align: 'center', size: 3.2 },
      };
    }
    const W = 51;
    const H = 152;
    const slots = stack(frames, 4, 4, 43, H - 4 - 15, 3);
    return {
      ...NO_TEXT, widthMm: W, heightMm: H, slots, slotRadius, outerRadius: corners === 'round' ? 2.5 : 0,
      holes: [], holeRadius: 0, caption: { x: 4, y: H - 15, w: 43, h: 15 },
      captionBrand: { x: 4 + 43 / 2, y: H - 3.4, align: 'center', size: 3.2 },
    };
  }
  if (format === 'instant') {
    if (land) {
      const W = 108;
      const H = 86;
      const slots = frames === 1
        ? [{ x: 4, y: 4, w: 100, h: 62 }]
        : [{ x: 4, y: 4, w: 48.5, h: 62 }, { x: 55.5, y: 4, w: 48.5, h: 62 }];
      return {
        ...NO_TEXT, widthMm: W, heightMm: H, slots, slotRadius, outerRadius: corners === 'round' ? 3 : 0,
        holes: [], holeRadius: 0, caption: { x: 4, y: 66, w: 100, h: 20 }, slotHairline: true,
        captionBrand: { x: 104, y: H - 4.6, align: 'right', size: 3 },
      };
    }
    const W = 54;
    const H = 86;
    const slots = stack(frames, 4, 4, 46, 62, 3);
    return {
      ...NO_TEXT, widthMm: W, heightMm: H, slots, slotRadius, outerRadius: corners === 'round' ? 3 : 0,
      holes: [], holeRadius: 0, caption: { x: 4, y: 4 + 62, w: 46, h: H - 66 }, slotHairline: true,
      captionBrand: { x: 4 + 46, y: H - 3.4, align: 'right', size: 3 },
    };
  }
  if (land) {
    // 35mm film on its side: frames are 48 × 34 with sprocket rows along the top and bottom edges
    const W = round2(16 + 48 * frames + 3.5 * (frames - 1));
    const H = 54;
    const slots = Array.from({ length: frames }, (_, i) => ({ x: round2(8 + i * 51.5), y: 9, w: 48, h: 34 }));
    return {
      ...NO_TEXT, widthMm: W, heightMm: H, slots, slotRadius, outerRadius: 0, holes: perforationsH(W, H), holeRadius: 0.5, caption: null,
      edgeText: {
        brand: { x: 8, y: 6.2 },
        frameNumbers: slots.map((s, i) => ({ x: s.x, y: 45.5, text: `> ${i + 1}  ${i + 1}A` })),
        endMark: { x: W - 8, y: 45.5, align: 'right' },
        size: 1.9,
      },
    };
  }
  // 35mm, laid out vertically: frames are 34 × 48 with sprocket columns either side
  const W = 50;
  const frameW = 34;
  const frameH = 48;
  const gap = 3.5;
  const head = 8;
  const foot = 8;
  const H = round2(head + frames * frameH + (frames - 1) * gap + foot);
  const slots = Array.from({ length: frames }, (_, i) => ({ x: 8, y: round2(head + i * (frameH + gap)), w: frameW, h: frameH }));
  const holes: Rect[] = [];
  const pitch = 5.2;
  for (let y = 1.6; y + 2 <= H - 1; y += pitch) {
    holes.push({ x: 2.6, y: round2(y), w: 2.8, h: 2 });
    holes.push({ x: W - 5.4, y: round2(y), w: 2.8, h: 2 });
  }
  const frameNumberYs = slots.map((s) => s.y + s.h + 2.4);
  return {
    ...NO_TEXT, widthMm: W, heightMm: H, slots, slotRadius, outerRadius: 0, holes, holeRadius: 0.5, caption: null,
    frameNumberYs,
    edgeText: {
      brand: { x: 8, y: 4.4 },
      frameNumbers: slots.map((_, i) => ({ x: 8, y: frameNumberYs[i], text: `> ${i + 1}  ${i + 1}A` })),
      endMark: { x: W - 8, y: H - 3.6, align: 'right' },
      size: 1.9,
    },
  };
}

export function slotAspect(r: Rect): number {
  return r.w / r.h;
}
