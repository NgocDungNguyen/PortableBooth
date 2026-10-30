import { continueRender, delayRender, staticFile } from 'remotion';

const faces: [string, string, string, string, string?][] = [
  // family, file, weight, style, unicodeRange
  ['Bricolage Grotesque', 'bricolage-grotesque-latin-wght-normal.woff2', '200 800', 'normal'],
  ['Bricolage Grotesque', 'bricolage-grotesque-latin-ext-wght-normal.woff2', '200 800', 'normal', 'U+0100-02AF, U+0304, U+0308, U+0329, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF'],
  ['Geist', 'geist-latin-wght-normal.woff2', '100 900', 'normal'],
  ['Geist', 'geist-latin-ext-wght-normal.woff2', '100 900', 'normal', 'U+0100-02AF, U+0304, U+0308, U+0329, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF'],
  ['Geist', 'geist-vietnamese-wght-normal.woff2', '100 900', 'normal', 'U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB'],
  ['Geist Mono', 'geist-mono-latin-wght-normal.woff2', '100 900', 'normal'],
  ['Instrument Serif', 'instrument-serif-latin-400-italic.woff2', '400', 'italic'],
  ['Instrument Serif', 'instrument-serif-latin-ext-400-italic.woff2', '400', 'italic', 'U+0100-02AF, U+0304, U+0308, U+0329, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF'],
];

let started = false;
export function loadFonts() {
  if (started || typeof document === 'undefined') return;
  started = true;
  const h = delayRender('fonts');
  Promise.all(
    faces.map(async ([family, file, weight, style, unicodeRange]) => {
      const ff = new FontFace(family, `url(${staticFile('fonts/' + file)}) format('woff2')`, { weight, style, ...(unicodeRange ? { unicodeRange } : {}) });
      await ff.load();
      document.fonts.add(ff);
    }),
  )
    .then(() => continueRender(h))
    .catch((e) => {
      console.error(e);
      continueRender(h);
    });
}
