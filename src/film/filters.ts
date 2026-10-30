export type FilterFamily = 'film' | 'mono' | 'digicam' | 'mood' | 'fx';

export const FILTER_FAMILIES: { id: FilterFamily; label: string }[] = [
  { id: 'film', label: 'Film' },
  { id: 'mono', label: 'Mono' },
  { id: 'digicam', label: 'Digicam' },
  { id: 'mood', label: 'Mood' },
  { id: 'fx', label: 'FX' },
];

type RGB = [number, number, number];

export interface FilterDef {
  id: string;
  name: string;
  family: FilterFamily;
  contrast: number;
  saturation: number;
  brightness: number;
  warmth: number;
  fade: number;
  grain: number;
  glow: number;
  vignette: number;
  bw: boolean;
  /** shadow tint (added) and highlight tint (multiplied), strength `split` */
  shadow: RGB;
  highlight: RGB;
  split: number;
  /** light leak: colour, strength, corner 0=TL 1=TR 2=BL 3=BR */
  leakColor: RGB;
  leak: number;
  leakCorner: number;
  /** duotone: luma maps a (dark) -> b (light), optionally through `mid`; blended in by `amount` */
  duo: { a: RGB; b: RGB; amount: number; mid?: RGB } | null;
  /** pixelate: cells across the film width (0 = off) */
  pixel: number;
  /** posterize: levels per channel (0 = off) */
  poster: number;
  /** scanlines + chroma bleed 0..1 */
  scan: number;
  /** chromatic aberration 0..1 */
  aber: number;
  /** halftone dot screen 0..1 */
  halftone: number;
  /** horizontal glitch bands 0..1 */
  glitch: number;
}

const base: Omit<FilterDef, 'id' | 'name' | 'family'> = {
  contrast: 0, saturation: 0, brightness: 0, warmth: 0, fade: 0, grain: 0, glow: 0, vignette: 0, bw: false,
  shadow: [0, 0, 0], highlight: [1, 1, 1], split: 0, leakColor: [1, 0.4, 0.1], leak: 0, leakCorner: 1,
  duo: null, pixel: 0, poster: 0, scan: 0, aber: 0, halftone: 0, glitch: 0,
};
const f = (id: string, name: string, family: FilterFamily, o: Partial<FilterDef>): FilterDef => ({ ...base, id, name, family, ...o });

export const FILTERS: FilterDef[] = [
  // ---- Film ----
  f('original', 'Original', 'film', {}),
  f('honey', 'Honey', 'film', { contrast: 0.08, saturation: 0.08, warmth: 0.24, fade: 0.08, grain: 0.14, vignette: 0.16, shadow: [0.1, 0.05, 0], highlight: [1, 0.93, 0.76], split: 0.38 }),
  f('amber', 'Amber', 'film', { contrast: 0.14, saturation: 0.06, warmth: 0.52, fade: 0.06, grain: 0.2, vignette: 0.28, shadow: [0.18, 0.07, 0], highlight: [1, 0.8, 0.5], split: 0.5, leakColor: [1, 0.45, 0.08], leak: 0.35, leakCorner: 0 }),
  f('slide', 'Slide', 'film', { contrast: 0.3, saturation: 0.42, grain: 0.06, vignette: 0.14, shadow: [0, 0.02, 0.1], split: 0.25 }),
  f('teal-night', 'Teal Night', 'film', { contrast: 0.22, saturation: 0.08, warmth: 0.04, vignette: 0.32, grain: 0.15, shadow: [0, 0.14, 0.17], highlight: [1, 0.82, 0.62], split: 0.6 }),
  f('expired', 'Expired', 'film', { saturation: -0.14, warmth: 0.1, fade: 0.3, grain: 0.4, vignette: 0.36, shadow: [0.03, 0.15, 0.1], highlight: [1, 0.9, 0.7], split: 0.55, leakColor: [1, 0.28, 0.08], leak: 0.45, leakCorner: 1 }),
  f('cross', 'Cross', 'film', { contrast: 0.36, saturation: 0.3, grain: 0.15, vignette: 0.14, shadow: [0, 0.12, 0.24], highlight: [1, 0.95, 0.5], split: 0.65 }),
  f('verdant', 'Verdant', 'film', { contrast: 0.14, saturation: 0.16, warmth: -0.04, fade: 0.1, grain: 0.12, vignette: 0.16, shadow: [0, 0.13, 0.05], highlight: [0.9, 1, 0.78], split: 0.5 }),
  f('postcard', 'Postcard', 'film', { brightness: 0.06, contrast: -0.04, saturation: -0.04, warmth: 0.12, fade: 0.26, grain: 0.1, vignette: 0.1, shadow: [0.1, 0.06, 0.13], highlight: [1, 0.97, 0.9], split: 0.3 }),
  f('sunday', 'Sunday', 'film', { contrast: 0.05, saturation: -0.1, warmth: 0.28, fade: 0.14, grain: 0.18, vignette: 0.2, shadow: [0.16, 0.08, 0.02], highlight: [1, 0.95, 0.85], split: 0.4 }),
  f('golden', 'Golden', 'film', { saturation: 0.15, warmth: 0.42, glow: 0.35, vignette: 0.2, highlight: [1, 0.84, 0.55], split: 0.35, leakColor: [1, 0.55, 0.1], leak: 0.55, leakCorner: 1, grain: 0.1 }),
  f('vivid', 'Vivid', 'film', { saturation: 0.35, contrast: 0.3, vignette: 0.6, shadow: [0, 0.04, 0.2], split: 0.3, grain: 0.22 }),

  // ---- Mono ----
  f('noir', 'Noir', 'mono', { bw: true, contrast: 0.38, grain: 0.36, vignette: 0.38, fade: 0.04 }),
  f('silver', 'Silver', 'mono', { bw: true, contrast: 0.16, brightness: 0.03, fade: 0.1, grain: 0.22, vignette: 0.16, shadow: [0, 0.01, 0.05], highlight: [0.97, 0.99, 1], split: 0.4 }),
  f('platinum', 'Platinum', 'mono', { bw: true, contrast: -0.06, brightness: 0.05, fade: 0.24, grain: 0.08, vignette: 0.1, shadow: [0.06, 0.045, 0.02], highlight: [1, 0.97, 0.92], split: 0.55 }),
  f('tape', 'Tape', 'mono', { saturation: -0.7, fade: 0.16, grain: 0.32, vignette: 0.32, shadow: [0.22, 0.12, 0.04], highlight: [1, 0.9, 0.7], split: 0.55 }),
  f('cyano', 'Cyano', 'mono', { contrast: 0.12, grain: 0.2, vignette: 0.24, fade: 0.04, duo: { a: [0.01, 0.07, 0.22], mid: [0.08, 0.32, 0.55], b: [0.88, 0.97, 1], amount: 1 } }),
  f('ink', 'Ink', 'mono', { contrast: 0.16, grain: 0.14, vignette: 0.14, duo: { a: [0.04, 0.07, 0.3], b: [1, 0.96, 0.86], amount: 1 } }),
  f('rose', 'Rose', 'mono', { contrast: 0.1, grain: 0.1, vignette: 0.12, duo: { a: [0.42, 0.04, 0.2], b: [1, 0.94, 0.91], amount: 1 } }),
  f('sunset', 'Sunset', 'mono', { contrast: 0.12, grain: 0.12, vignette: 0.2, duo: { a: [0.17, 0.05, 0.42], mid: [0.88, 0.22, 0.4], b: [1, 0.78, 0.3], amount: 1 } }),
  f('riso', 'Riso', 'mono', { contrast: 0.22, halftone: 0.9, grain: 0.1, duo: { a: [0.04, 0.3, 0.78], b: [1, 0.95, 0.86], amount: 1 } }),

  // ---- Digicam ----
  f('flash', 'Flash', 'digicam', { contrast: 0.28, brightness: 0.08, saturation: 0.12, warmth: 0.06, grain: 0.4, glow: 0.18, vignette: 0.35 }),
  f('y2k', 'Y2K', 'digicam', { contrast: 0.2, saturation: 0.25, warmth: -0.15, fade: 0.05, glow: 0.4, shadow: [0.12, 0, 0.3], highlight: [0.85, 0.9, 1], split: 0.45, brightness: 0.05 }),
  f('ccd', 'CCD', 'digicam', { contrast: 0.2, brightness: 0.05, saturation: 0.06, warmth: -0.26, glow: 0.12, grain: 0.2, vignette: 0.1, shadow: [0, 0.04, 0.16], highlight: [0.9, 0.95, 1], split: 0.5 }),
  f('disposable', 'Disposable', 'digicam', { contrast: 0.16, brightness: 0.05, saturation: 0.1, warmth: 0.04, glow: 0.16, grain: 0.5, vignette: 0.58, shadow: [0, 0.1, 0.04], highlight: [0.94, 1, 0.88], split: 0.5, leakColor: [1, 0.5, 0.1], leak: 0.3, leakCorner: 3 }),
  f('camcorder', 'Camcorder', 'digicam', { contrast: 0.1, saturation: -0.08, fade: 0.12, warmth: -0.04, grain: 0.3, vignette: 0.3, scan: 0.55, aber: 0.22 }),
  f('vhs', 'VHS', 'digicam', { contrast: 0.12, saturation: 0.18, warmth: 0.04, fade: 0.2, grain: 0.38, vignette: 0.22, shadow: [0.1, 0, 0.18], highlight: [1, 0.94, 0.96], split: 0.4, scan: 0.42, aber: 0.6, glitch: 0.2 }),
  f('instant', 'Instant', 'digicam', { brightness: 0.08, contrast: -0.05, saturation: -0.12, warmth: 0.2, fade: 0.3, glow: 0.22, vignette: 0.26, grain: 0.14, shadow: [0.09, 0.09, 0.03], highlight: [1, 0.97, 0.88], split: 0.5 }),

  // ---- Mood ----
  f('cherry', 'Cherry', 'mood', { saturation: 0.12, warmth: 0.1, glow: 0.3, shadow: [0.3, 0, 0.1], highlight: [1, 0.86, 0.92], split: 0.4, leakColor: [1, 0.15, 0.25], leak: 0.5, leakCorner: 0, grain: 0.12 }),
  f('cyan', 'Cyan', 'mood', { saturation: 0.05, warmth: -0.35, fade: 0.08, shadow: [0, 0.16, 0.3], highlight: [0.86, 1, 1], split: 0.45, grain: 0.12 }),
  f('mint', 'Mint', 'mood', { saturation: -0.05, warmth: -0.1, fade: 0.22, shadow: [0, 0.2, 0.14], highlight: [0.9, 1, 0.95], split: 0.4, grain: 0.1 }),
  f('dusk', 'Dusk', 'mood', { warmth: 0.08, saturation: 0.1, glow: 0.2, shadow: [0.2, 0.04, 0.36], highlight: [1, 0.76, 0.82], split: 0.5, leakColor: [0.7, 0.4, 1], leak: 0.5, leakCorner: 2, vignette: 0.2 }),
  f('blue-hour', 'Blue Hour', 'mood', { contrast: 0.12, brightness: -0.03, saturation: -0.04, warmth: -0.28, vignette: 0.3, grain: 0.12, shadow: [0.02, 0.06, 0.26], highlight: [0.76, 0.87, 1], split: 0.62 }),
  f('neon-noir', 'Neon Noir', 'mood', { contrast: 0.4, brightness: -0.08, saturation: 0.35, glow: 0.45, vignette: 0.5, grain: 0.15, shadow: [0.24, 0, 0.3], highlight: [0.68, 1, 1], split: 0.58, leakColor: [1, 0.1, 0.6], leak: 0.4, leakCorner: 3 }),
  f('dream', 'Dream', 'mood', { contrast: -0.1, brightness: 0.08, saturation: -0.04, warmth: 0.1, fade: 0.18, glow: 0.9, vignette: 0.08, grain: 0.06, highlight: [1, 0.93, 0.96], split: 0.3 }),
  f('peach', 'Peach', 'mood', { brightness: 0.08, saturation: 0.08, warmth: 0.2, fade: 0.14, glow: 0.2, grain: 0.08, shadow: [0.2, 0.06, 0.06], highlight: [1, 0.88, 0.8], split: 0.5 }),
  f('fog', 'Fog', 'mood', { brightness: 0.1, contrast: -0.2, saturation: -0.35, warmth: -0.08, fade: 0.45, glow: 0.3, vignette: 0.1, grain: 0.1, shadow: [0.03, 0.05, 0.08], highlight: [0.95, 0.98, 1], split: 0.3 }),

  // ---- FX ----
  f('halftone', 'Halftone', 'fx', { contrast: 0.2, saturation: 0.4, halftone: 1 }),
  f('pixel', 'Pixel', 'fx', { contrast: 0.12, saturation: 0.25, pixel: 44 }),
  f('poster', 'Poster', 'fx', { contrast: 0.22, saturation: 0.45, poster: 4 }),
  f('glitch', 'Glitch', 'fx', { contrast: 0.16, saturation: 0.2, aber: 0.85, glitch: 0.8, scan: 0.2, grain: 0.14 }),
  f('thermal', 'Thermal', 'fx', { contrast: 0.45, glow: 0.2, duo: { a: [0.04, 0, 0.35], mid: [0.9, 0.12, 0.35], b: [1, 0.92, 0.2], amount: 1 } }),
];

export const filterById = (id: string): FilterDef => FILTERS.find((x) => x.id === id) ?? FILTERS[0];
