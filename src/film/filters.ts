export interface FilterDef {
  id: string;
  name: string;
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
  shadow: [number, number, number];
  highlight: [number, number, number];
  split: number;
  /** light leak: colour, strength, corner 0=TL 1=TR 2=BL 3=BR */
  leakColor: [number, number, number];
  leak: number;
  leakCorner: number;
}

const base: Omit<FilterDef, 'id' | 'name'> = {
  contrast: 0, saturation: 0, brightness: 0, warmth: 0, fade: 0, grain: 0, glow: 0, vignette: 0, bw: false,
  shadow: [0, 0, 0], highlight: [1, 1, 1], split: 0, leakColor: [1, 0.4, 0.1], leak: 0, leakCorner: 1,
};
const f = (id: string, name: string, o: Partial<FilterDef>): FilterDef => ({ ...base, id, name, ...o });

export const FILTERS: FilterDef[] = [
  f('original', 'Original', {}),
  f('sunday', 'Sunday', { contrast: 0.05, saturation: -0.1, warmth: 0.28, fade: 0.14, grain: 0.18, vignette: 0.2, shadow: [0.16, 0.08, 0.02], highlight: [1, 0.95, 0.85], split: 0.4 }),
  f('flash', 'Flash', { contrast: 0.28, brightness: 0.08, saturation: 0.12, warmth: 0.06, grain: 0.4, glow: 0.18, vignette: 0.35 }),
  f('cherry', 'Cherry', { saturation: 0.12, warmth: 0.1, glow: 0.3, shadow: [0.3, 0, 0.1], highlight: [1, 0.86, 0.92], split: 0.4, leakColor: [1, 0.15, 0.25], leak: 0.5, leakCorner: 0, grain: 0.12 }),
  f('golden', 'Golden', { saturation: 0.15, warmth: 0.42, glow: 0.35, vignette: 0.2, highlight: [1, 0.84, 0.55], split: 0.35, leakColor: [1, 0.55, 0.1], leak: 0.55, leakCorner: 1, grain: 0.1 }),
  f('cyan', 'Cyan', { saturation: 0.05, warmth: -0.35, fade: 0.08, shadow: [0, 0.16, 0.3], highlight: [0.86, 1, 1], split: 0.45, grain: 0.12 }),
  f('mint', 'Mint', { saturation: -0.05, warmth: -0.1, fade: 0.22, shadow: [0, 0.2, 0.14], highlight: [0.9, 1, 0.95], split: 0.4, grain: 0.1 }),
  f('dusk', 'Dusk', { warmth: 0.08, saturation: 0.1, glow: 0.2, shadow: [0.2, 0.04, 0.36], highlight: [1, 0.76, 0.82], split: 0.5, leakColor: [0.7, 0.4, 1], leak: 0.5, leakCorner: 2, vignette: 0.2 }),
  f('lomo', 'Lomo', { saturation: 0.35, contrast: 0.3, vignette: 0.6, shadow: [0, 0.04, 0.2], split: 0.3, grain: 0.22 }),
  f('y2k', 'Y2K', { contrast: 0.2, saturation: 0.25, warmth: -0.15, fade: 0.05, glow: 0.4, shadow: [0.12, 0, 0.3], highlight: [0.85, 0.9, 1], split: 0.45, brightness: 0.05 }),
  f('tape', 'Tape', { saturation: -0.7, fade: 0.16, grain: 0.32, vignette: 0.32, shadow: [0.22, 0.12, 0.04], highlight: [1, 0.9, 0.7], split: 0.55 }),
  f('noir', 'Noir', { bw: true, contrast: 0.38, grain: 0.36, vignette: 0.38, fade: 0.04 }),
];

export const filterById = (id: string): FilterDef => FILTERS.find((x) => x.id === id) ?? FILTERS[0];
