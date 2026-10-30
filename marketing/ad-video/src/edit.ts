// The edit decision list: every scene and every app-demo segment, locked to the voice-over word timings.
import timing from './timing.json';
import type { Seg } from './clips';

type Word = { w: string; s: number; e: number };
const WORDS: Word[] = (timing.lines as { words: Word[] }[]).flatMap((l) => l.words);
/** start (s) of the n-th spoken occurrence of a word in the VO */
export const w = (word: string, n = 1): number => {
  const hits = WORDS.filter((x) => x.w === word);
  if (!hits[n - 1]) throw new Error(`word ${word}#${n} missing`);
  return hits[n - 1].s;
};
/** end (s) of the n-th occurrence */
export const we = (word: string, n = 1): number => WORDS.filter((x) => x.w === word)[n - 1].e;

export const VO_DURATION = timing.duration;
export const TAIL = 2.85;
export const DURATION = Math.ceil((VO_DURATION + TAIL) * 30) / 30; // ~76 s

// Scene boundaries (s). Cuts sit just before the line they illustrate.
export const S = {
  open: 0,
  curtain: w('the', 2) - 0.1, // "The tiny curtain"
  flash: w('flash') - 0.12,
  strip: w('strip', 1) - 0.12,
  pocket: w('now', 1) - 0.12,
  logo: w('portable', 1) - 0.08,
  film: w('start') - 0.2,
  pose: w('then') - 0.12,
  upload: w('or', 3) - 0.1, // "Or drop in"
  yours: w('now', 2) - 0.12,
  looks: w('forty') - 0.06,
  frames: w('frames') - 0.06,
  colours: w('colours') - 0.04,
  stickers: w('stickers') - 0.04,
  text: w('text') - 0.04,
  details: w('and', 1) - 0.02,
  drag: w('drag') - 0.08,
  resize: w('resize') - 0.04,
  crop: w('crop') - 0.03,
  tint: w('tint') - 0.04,
  everything: w('everything') - 0.1,
  same: w('same', 1) - 0.1,
  care: w('and', 2) - 0.25,
  done: w('when') - 0.12,
  print: w('print') - 0.06,
  send: w('send') - 0.18,
  p2p: w('phone', 2) - 0.12, // "phone to phone"
  scan: w('they') - 0.12,
  moments: w('made') - 0.3,
  end: w('portable', 2) - 0.04,
  outro: DURATION,
};

// App-demo segments (timeline seconds -> clip marks). Rates > 1 compress the headless browser's slow paints.
export const SEG: Record<string, Seg> = {
  film: { clip: 'phone-film', at: S.film, dur: S.pose - S.film, from: `strip-${(w('strip', 2) - S.film).toFixed(3)}` },
  upload: { clip: 'desk-upload', at: S.upload, dur: S.yours - S.upload, from: 'drag-0.2', to: 'filled+0.4' },
  looks: { clip: 'desk-edit', at: S.looks, dur: S.frames - S.looks, from: 'look1-0.2', to: 'look3+0.45' },
  frames: { clip: 'desk-edit', at: S.frames, dur: S.colours - S.frames, from: 'frame1-0.15', to: 'frame2+0.6' },
  colours: { clip: 'desk-edit', at: S.colours, dur: S.stickers - S.colours, from: 'colour1-0.1', to: 'colour2+0.55' },
  stickers: { clip: 'desk-edit', at: S.stickers, dur: S.text - S.stickers, from: 'sticker-0.15', to: 'sticker+1.1' },
  text: { clip: 'desk-edit', at: S.text, dur: S.details - S.text, from: 'type', to: 'textadd+0.7' },
  details: { clip: 'desk-edit', at: S.details, dur: S.drag - S.details, from: 'widget-0.3', to: 'widget+1.9' },
  drag: { clip: 'desk-edit', at: S.drag, dur: S.resize - S.drag, from: 'drag-0.12', to: 'dragEnd+0.3' },
  resize: { clip: 'desk-edit', at: S.resize, dur: S.crop - S.resize, from: 'resize-0.1', to: 'resizeEnd+0.3' },
  crop: { clip: 'desk-edit', at: S.crop, dur: S.tint - S.crop, from: 'crop-0.1', to: 'cropEnd+0.5' },
  tint: { clip: 'desk-edit', at: S.tint, dur: S.everything - S.tint, from: 'tint-0.15', to: 'tint2+0.8' },
  samePhone: { clip: 'phone-edit', at: S.same, dur: S.care - S.same, from: 'look1-0.4', to: 'frame1+0.9' },
  sameDesk: { clip: 'desk-edit', at: S.same, dur: S.care - S.same, from: 'looks', to: 'colour2+0.5' },
  export: { clip: 'phone-export', at: S.done, dur: S.print - S.done, from: 'export-0.17', to: 'save+1.2' },
};

// Moments the edit and the music both hit.
export const HIT = {
  drop: w('pocket'),
  snap: w('snap'),
  three: w('three'),
  two: w('two', 1),
  one: w('one'),
  lands: w('lands'),
  logo: w('portable', 2),
  flash: w('flash'),
  printWord: w('print'),
};

// Captions are hidden where the same words are already on screen as kinetic type.
export const CAPTION_HIDE: [number, number][] = [
  [S.logo, S.film - 0.01],
  [w('three') - 0.1, S.upload - 0.01],
  [S.yours, S.looks - 0.01],
  [S.everything, S.same - 0.01],
  [w('no', 1) - 0.1, S.done - 0.01],
  [S.end, DURATION],
];
