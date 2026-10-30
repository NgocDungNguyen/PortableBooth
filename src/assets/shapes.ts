/**
 * Original shape / decor stickers drawn for PortableBooth (CC0 1.0, public domain dedication).
 * All art lives on a 256x256 canvas. No <style>, no style="" attributes, no external refs (CSP-safe).
 * Mono shapes use #000000 and are recoloured by the app with a source-in composite;
 * names in SHAPES_COLOURED keep their own colours.
 */

const K = '#000000';
const r1 = (n: number) => Math.round(n * 10) / 10;

const svg = (inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">${inner}</svg>`;

/** Point on a circle, angle in degrees, 0 = up, clockwise. */
const pol = (cx: number, cy: number, r: number, deg: number): [number, number] => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [r1(cx + r * Math.cos(a)), r1(cy + r * Math.sin(a))];
};

const polygon = (pts: [number, number][]) => 'M' + pts.map((p) => p.join(' ')).join('L') + 'Z';

const starPath = (n: number, outer: number, inner: number, cx = 128, cy = 128, rot = 0) => {
  const pts: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) pts.push(pol(cx, cy, i % 2 === 0 ? outer : inner, rot + (i * 180) / n));
  return polygon(pts);
};

/** Concave four-point sparkle centred on (cx, cy) with radius r. */
const sparklePath = (cx: number, cy: number, r: number) => {
  const k = r * 0.06; // how tightly the waist pinches
  const t = r;
  return (
    `M${cx} ${cy - t}C${r1(cx + k)} ${r1(cy - t * 0.55)} ${r1(cx + t * 0.55)} ${r1(cy - k)} ${cx + t} ${cy}` +
    `C${r1(cx + t * 0.55)} ${r1(cy + k)} ${r1(cx + k)} ${r1(cy + t * 0.55)} ${cx} ${cy + t}` +
    `C${r1(cx - k)} ${r1(cy + t * 0.55)} ${r1(cx - t * 0.55)} ${r1(cy + k)} ${cx - t} ${cy}` +
    `C${r1(cx - t * 0.55)} ${r1(cy - k)} ${r1(cx - k)} ${r1(cy - t * 0.55)} ${cx} ${cy - t}Z`
  );
};

/** Deterministic pseudo-random in [0,1) so the torn edge is stable between builds. */
const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

const HEART = 'M128 222C52 168 22 128 22 84A54 54 0 0 1 128 66A54 54 0 0 1 234 84C234 128 204 168 128 222Z';

/** Washi tape strip with torn (zigzag) short ends, x from 18 to 238, y from y0 to y1. */
const tapePath = (y0: number, y1: number) => {
  const n = 6;
  const step = (y1 - y0) / n;
  let d = `M26 ${y0}H230`;
  for (let i = 0; i < n; i++) d += `L${i % 2 ? 238 : 230} ${r1(y0 + step * (i + 0.5))}L230 ${r1(y0 + step * (i + 1))}`;
  d += `H26`;
  for (let i = 0; i < n; i++) d += `L${i % 2 ? 18 : 26} ${r1(y1 - step * (i + 0.5))}L26 ${r1(y1 - step * (i + 1))}`;
  return d + 'Z';
};

const tornPaper = (() => {
  const rand = rng(11);
  let d = 'M32 62';
  for (let x = 32; x < 224; x += 24) d += `L${x + 12} ${r1(48 + rand() * 10)}L${x + 24} ${r1(58 + rand() * 6)}`;
  d += 'L224 60L228 120L224 196';
  for (let x = 224; x > 32; x -= 24) d += `L${x - 12} ${r1(204 + rand() * 8)}L${x - 24} ${r1(194 + rand() * 6)}`;
  d += 'L32 196L28 128Z';
  return d;
})();

const petals = (n: number, dist: number, r: number) =>
  Array.from({ length: n }, (_, i) => {
    const [x, y] = pol(128, 128, dist, (i * 360) / n);
    return `<circle cx="${x}" cy="${y}" r="${r}"/>`;
  }).join('');

export const SHAPES: Record<string, string> = {
  circle: svg(`<circle cx="128" cy="128" r="106" fill="${K}"/>`),
  ring: svg(`<circle cx="128" cy="128" r="90" fill="none" stroke="${K}" stroke-width="28"/>`),
  square: svg(`<rect x="28" y="28" width="200" height="200" fill="${K}"/>`),
  'rounded-square': svg(`<rect x="24" y="24" width="208" height="208" rx="56" fill="${K}"/>`),
  triangle: svg(`<path d="M128 40L222 206H34Z" fill="${K}" stroke="${K}" stroke-width="20" stroke-linejoin="round"/>`),
  'star-5': svg(`<path d="${starPath(5, 118, 50)}" fill="${K}" stroke="${K}" stroke-width="14" stroke-linejoin="round"/>`),
  'star-burst': svg(`<path d="${starPath(8, 116, 70)}" fill="${K}" stroke="${K}" stroke-width="14" stroke-linejoin="round"/>`),
  sparkle: svg(`<path d="${sparklePath(128, 128, 116)}" fill="${K}"/>`),
  'sparkle-cluster': svg(
    `<path d="${sparklePath(110, 134, 92)}" fill="${K}"/><path d="${sparklePath(196, 58, 44)}" fill="${K}"/><path d="${sparklePath(204, 192, 30)}" fill="${K}"/>`,
  ),
  plus: svg(`<path d="M104 30H152V104H226V152H152V226H104V152H30V104H104Z" fill="${K}" stroke="${K}" stroke-width="12" stroke-linejoin="round"/>`),
  cross: svg(
    `<g transform="rotate(45 128 128)"><rect x="100" y="22" width="56" height="212" rx="22" fill="${K}"/><rect x="22" y="100" width="212" height="56" rx="22" fill="${K}"/></g>`,
  ),
  'heart-outline': svg(`<path d="${HEART}" fill="none" stroke="${K}" stroke-width="20" stroke-linejoin="round"/>`),
  'heart-solid': svg(`<path d="${HEART}" fill="${K}" stroke="${K}" stroke-width="12" stroke-linejoin="round"/>`),
  'arrow-straight': svg(
    `<path d="M26 128H224M150 54L224 128L150 202" fill="none" stroke="${K}" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  'arrow-curved': svg(
    `<path d="M34 200C42 112 112 58 214 74M164 36L214 74L176 124" fill="none" stroke="${K}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  squiggle: svg(
    `<path d="M20 128Q46 66 72 128T124 128T176 128T228 128" fill="none" stroke="${K}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  zigzag: svg(
    `<path d="M22 172L66 84L110 172L154 84L198 172L238 100" fill="none" stroke="${K}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  'wavy-line': svg(
    `<path d="M16 128C46 70 80 70 112 128S178 186 208 128Q222 100 240 112" fill="none" stroke="${K}" stroke-width="12" stroke-linecap="round"/>`,
  ),
  'dotted-line': svg(
    Array.from({ length: 6 }, (_, i) => `<circle cx="${34 + i * 38}" cy="128" r="13" fill="${K}"/>`).join(''),
  ),
  'thick-line': svg(`<rect x="20" y="104" width="216" height="48" rx="24" fill="${K}"/>`),
  'blob-1': svg(
    `<path d="M120 24C168 12 226 50 232 108C238 160 200 176 190 208C178 244 120 242 82 226C40 208 18 170 26 126C34 84 52 66 70 48C86 32 100 28 120 24Z" fill="${K}"/>`,
  ),
  'blob-2': svg(
    `<path d="M72 40C112 14 168 36 196 62C226 90 244 112 226 152C210 190 214 226 164 234C120 240 98 212 60 204C22 196 14 150 24 118C32 90 46 58 72 40Z" fill="${K}"/>`,
  ),
  'blob-3': svg(
    `<path d="M146 30C196 38 240 84 226 138C216 176 238 212 196 230C150 248 124 214 88 214C48 214 22 176 30 134C36 100 70 94 80 66C92 34 112 24 146 30Z" fill="${K}"/>`,
  ),
  flower: svg(`<g fill="${K}">${petals(6, 62, 46)}<circle cx="128" cy="128" r="62"/></g>`),
  cloud: svg(
    `<g fill="${K}"><circle cx="82" cy="140" r="52"/><circle cx="138" cy="98" r="66"/><circle cx="198" cy="148" r="44"/><rect x="30" y="148" width="200" height="62" rx="31"/></g>`,
  ),
  'tape-pink': svg(
    `<g transform="rotate(-8 128 128)"><path d="${tapePath(84, 172)}" fill="#F7A8C8" fill-opacity="0.78"/><path d="${tapePath(84, 172)}" fill="none" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="2"/></g>`,
  ),
  'tape-mint': svg(
    `<defs><clipPath id="t"><path d="${tapePath(84, 172)}"/></clipPath></defs>` +
      `<g transform="rotate(6 128 128)"><path d="${tapePath(84, 172)}" fill="#A8E6CF" fill-opacity="0.8"/>` +
      `<g clip-path="url(#t)" fill="#FFFFFF" fill-opacity="0.55">${Array.from(
        { length: 10 },
        (_, i) => `<rect x="${i * 26 - 20}" y="70" width="10" height="120" transform="rotate(28 ${i * 26 - 15} 128)"/>`,
      ).join('')}</g></g>`,
  ),
  'paper-clip': svg(
    `<path d="M150 70L88 134A30 30 0 0 0 130 176L198 108A52 52 0 0 0 124 34L52 106A76 76 0 0 0 160 214L206 168" fill="none" stroke="${K}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" transform="rotate(8 128 128)"/>`,
  ),
  'torn-paper': svg(`<path d="${tornPaper}" fill="${K}"/>`),
  'corner-marks': svg(
    `<path d="M30 92V40Q30 30 40 30H92M164 30H216Q226 30 226 40V92M226 164V216Q226 226 216 226H164M92 226H40Q30 226 30 216V164" fill="none" stroke="${K}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  crosshair: svg(
    `<circle cx="128" cy="128" r="72" fill="none" stroke="${K}" stroke-width="14"/><path d="M128 20V76M128 180V236M20 128H76M180 128H236" stroke="${K}" stroke-width="14" stroke-linecap="round"/><circle cx="128" cy="128" r="10" fill="${K}"/>`,
  ),
  'chrome-star': svg(
    `<defs><linearGradient id="c" x1="0" y1="0" x2="0.35" y2="1">` +
      `<stop offset="0" stop-color="#FFFFFF"/><stop offset="0.28" stop-color="#B9C3D6"/><stop offset="0.5" stop-color="#4A5570"/>` +
      `<stop offset="0.62" stop-color="#E9EEF8"/><stop offset="0.82" stop-color="#8793AB"/><stop offset="1" stop-color="#2B3247"/></linearGradient>` +
      `<linearGradient id="h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.95"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient></defs>` +
      `<path d="${sparklePath(128, 128, 118)}" fill="url(#c)" stroke="#1E2438" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="${sparklePath(120, 118, 56)}" fill="url(#h)"/>`,
  ),
  'speech-bubble': svg(
    `<path d="M70 36H186A44 44 0 0 1 230 80V132A44 44 0 0 1 186 176H132L82 224V176H70A44 44 0 0 1 26 132V80A44 44 0 0 1 70 36Z" fill="${K}" stroke="${K}" stroke-width="8" stroke-linejoin="round"/>`,
  ),
};

export const SHAPE_NAMES: string[] = Object.keys(SHAPES);

/** Shapes that keep their own colours (not recoloured by the app). */
export const SHAPES_COLOURED: ReadonlySet<string> = new Set(['chrome-star', 'tape-pink', 'tape-mint']);
