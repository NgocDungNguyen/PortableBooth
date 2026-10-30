import { clamp } from '../film/doc';
import { filterById } from '../film/filters';
import type { FilmDoc } from '../film/types';

/** Everything the shader / CPU fallback needs, with filter preset + user adjustments already merged. */
export interface ShaderParams {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  fade: number;
  grain: number;
  glow: number;
  vignette: number;
  bw: boolean;
  shadow: [number, number, number];
  highlight: [number, number, number];
  split: number;
  leakColor: [number, number, number];
  leak: number;
  leakCorner: number;
  intensity: number;
  /** duotone (luma -> a..b, optionally through mid) blended by `amount`; null = off */
  duo: { a: [number, number, number]; b: [number, number, number]; amount: number; mid?: [number, number, number] } | null;
  /** cells across the film width, 0 = off */
  pixel: number;
  /** posterize levels, 0 = off */
  poster: number;
  scan: number;
  aber: number;
  halftone: number;
  glitch: number;
}

export function resolveParams(doc: Pick<FilmDoc, 'filterId' | 'adjust'>): ShaderParams {
  const f = filterById(doc.filterId);
  const a = doc.adjust;
  return {
    brightness: clamp(f.brightness + a.brightness, -1, 1),
    contrast: clamp(f.contrast + a.contrast, -1, 1),
    saturation: clamp(f.saturation + a.saturation, -1, 1),
    warmth: clamp(f.warmth + a.warmth, -1, 1),
    fade: clamp(f.fade + a.fade, 0, 1),
    grain: clamp(f.grain + a.grain, 0, 1),
    glow: clamp(f.glow + a.glow, 0, 1),
    vignette: clamp(f.vignette + a.vignette, 0, 1),
    bw: f.bw,
    shadow: f.shadow, highlight: f.highlight, split: f.split,
    leakColor: f.leakColor, leak: f.leak, leakCorner: f.leakCorner,
    intensity: a.intensity,
    duo: f.duo, pixel: f.pixel, poster: f.poster, scan: f.scan, aber: f.aber, halftone: f.halftone, glitch: f.glitch,
  };
}

export function isIdentity(p: ShaderParams): boolean {
  return (
    p.intensity === 0 ||
    (p.brightness === 0 && p.contrast === 0 && p.saturation === 0 && p.warmth === 0 && p.fade === 0 && p.grain === 0 &&
      p.glow === 0 && p.vignette === 0 && !p.bw && p.split === 0 && p.leak === 0 &&
      (!p.duo || p.duo.amount === 0) && p.pixel === 0 && p.poster === 0 && p.scan === 0 && p.aber === 0 && p.halftone === 0 &&
      p.glitch === 0)
  );
}
