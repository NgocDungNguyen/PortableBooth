const FAMILIES = ['"Permanent Marker"', '"Caveat"', '"Special Elite"', '"Bricolage Grotesque Variable"', '"VT323"'];

let pending: Promise<void> | null = null;
/** Canvas text only uses a font once it is loaded, so wait for them before the first render. */
export function ensureFonts(): Promise<void> {
  pending ??= Promise.all(FAMILIES.map((f) => document.fonts.load(`32px ${f}`, 'Aa0'))).then(() => undefined, () => undefined);
  return pending;
}
