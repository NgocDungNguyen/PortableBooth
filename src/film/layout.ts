import type { FormatId, Rect } from './types';

export interface FormatMeta {
  id: FormatId;
  name: string;
  /** selectable frame counts */
  frameOptions: number[];
  defaultFrames: number;
  defaultColor: string;
  defaultCorners: 'square' | 'round';
}

export const FORMATS: Record<FormatId, FormatMeta> = {
  strip: { id: 'strip', name: 'Strip', frameOptions: [3, 4], defaultFrames: 4, defaultColor: '#FFFFFF', defaultCorners: 'square' },
  instant: { id: 'instant', name: 'Instant', frameOptions: [1, 2], defaultFrames: 1, defaultColor: '#FFFFFF', defaultCorners: 'round' },
  film35: { id: 'film35', name: '35mm', frameOptions: [2, 3], defaultFrames: 3, defaultColor: '#17120F', defaultCorners: 'square' },
};
export const FORMAT_ORDER: FormatId[] = ['strip', 'instant', 'film35'];

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
  /** y of each frame-number label (35mm) */
  frameNumberYs: number[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function stack(n: number, x: number, y: number, w: number, totalH: number, gap: number): Rect[] {
  const h = (totalH - gap * (n - 1)) / n;
  return Array.from({ length: n }, (_, i) => ({ x, y: round2(y + i * (h + gap)), w, h: round2(h) }));
}

export function computeLayout(format: FormatId, frames: number, corners: 'square' | 'round'): FilmLayout {
  const slotRadius = corners === 'round' ? 1.6 : 0;
  if (format === 'strip') {
    const W = 51;
    const H = 152;
    const slots = stack(frames, 4, 4, 43, H - 4 - 15, 3);
    return {
      widthMm: W, heightMm: H, slots, slotRadius, outerRadius: corners === 'round' ? 2.5 : 0,
      holes: [], holeRadius: 0, caption: { x: 4, y: H - 15, w: 43, h: 15 }, frameNumberYs: [],
    };
  }
  if (format === 'instant') {
    const W = 54;
    const H = 86;
    const slots = stack(frames, 4, 4, 46, frames === 1 ? 62 : 62, 3);
    return {
      widthMm: W, heightMm: H, slots, slotRadius, outerRadius: corners === 'round' ? 3 : 0,
      holes: [], holeRadius: 0, caption: { x: 4, y: 4 + 62, w: 46, h: H - 66 }, frameNumberYs: [],
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
  return {
    widthMm: W, heightMm: H, slots, slotRadius, outerRadius: 0, holes, holeRadius: 0.5,
    caption: null, frameNumberYs: slots.map((s) => s.y + s.h + 2.4),
  };
}

export function slotAspect(r: Rect): number {
  return r.w / r.h;
}
