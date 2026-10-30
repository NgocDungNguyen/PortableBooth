const FAMILIES = [
  '"Geist Variable"', '"Geist Mono Variable"', '"Bricolage Grotesque Variable"', '"Instrument Serif"', '"Bebas Neue"',
  '"Unbounded Variable"', '"Space Mono"', '"Special Elite"', '"Caveat"', '"Permanent Marker"', '"VT323"',
];

let pending: Promise<void> | null = null;
/** Canvas text only uses a font once it is loaded, so wait for them before the first render. */
export function ensureFonts(): Promise<void> {
  pending ??= Promise.all(FAMILIES.map((f) => document.fonts.load(`32px ${f}`, 'Aa0'))).then(() => undefined, () => undefined);
  return pending;
}
