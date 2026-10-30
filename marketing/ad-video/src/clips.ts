// Recorded app clips (public/cap/*.json, written by capture/record.cjs) and helpers to address them by named marks.
import phoneFilm from '../public/cap/phone-film.json';
import phoneEdit from '../public/cap/phone-edit.json';
import phoneExport from '../public/cap/phone-export.json';
import deskUpload from '../public/cap/desk-upload.json';
import deskEdit from '../public/cap/desk-edit.json';

export type Ev = { t: number; type: 'move' | 'down' | 'up' | 'drag' | 'key'; x: number; y: number };
export type ClipMeta = {
  name: string;
  width: number;
  height: number;
  css: { width: number; height: number };
  dpr: number;
  mobile: boolean;
  duration: number;
  events: Ev[];
  marks: Record<string, number>;
};

export const CLIPS: Record<string, ClipMeta> = {
  'phone-film': phoneFilm as ClipMeta,
  'phone-edit': phoneEdit as ClipMeta,
  'phone-export': phoneExport as ClipMeta,
  'desk-upload': deskUpload as ClipMeta,
  'desk-edit': deskEdit as ClipMeta,
};

/** "mark", "mark+0.3", "mark-0.2" or a number (clip seconds) */
export function clipTime(clip: string, ref: string | number): number {
  if (typeof ref === 'number') return ref;
  const m = /^([a-zA-Z0-9]+)([+-][0-9.]+)?$/.exec(ref);
  if (!m) throw new Error('bad ref ' + ref);
  const base = CLIPS[clip].marks[m[1]];
  if (base === undefined) throw new Error(`mark ${m[1]} missing in ${clip}`);
  return base + (m[2] ? parseFloat(m[2]) : 0);
}

export type Seg = {
  clip: string;
  /** VO time (s) where the segment starts on the timeline */
  at: number;
  /** timeline duration (s) */
  dur: number;
  /** clip time where it starts */
  from: string | number;
  /** optional clip time where it ends; with it the segment is time-remapped (rate = (to - from) / dur) */
  to?: string | number;
  rate?: number;
};

export function resolveSeg(s: Seg) {
  const from = clipTime(s.clip, s.from);
  const rate = s.to !== undefined ? (clipTime(s.clip, s.to) - from) / s.dur : s.rate ?? 1;
  return { from, rate };
}

/** pointer state at clip time t */
export function pointerAt(clip: ClipMeta, t: number) {
  const ev = clip.events;
  if (!ev.length) return null;
  let i = -1;
  let lo = 0;
  let hi = ev.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (ev[mid].t <= t) {
      i = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (i < 0) return { x: ev[0].x, y: ev[0].y, down: false, sinceDown: 99, sinceMove: 99, first: ev[0].t - t };
  const a = ev[i];
  const b = ev[i + 1];
  let x = a.x;
  let y = a.y;
  if (b && b.t - a.t < 0.25 && (b.type === 'move' || b.type === 'drag')) {
    const k = (t - a.t) / (b.t - a.t);
    x = a.x + (b.x - a.x) * k;
    y = a.y + (b.y - a.y) * k;
  }
  let down = false;
  let sinceDown = 99;
  for (let j = i; j >= 0; j--) {
    if (ev[j].type === 'up') break;
    if (ev[j].type === 'down') {
      down = true;
      break;
    }
  }
  for (let j = i; j >= 0; j--) {
    if (ev[j].type === 'down') {
      sinceDown = t - ev[j].t;
      break;
    }
  }
  let lastMove = a.t;
  return { x, y, down, sinceDown, sinceMove: t - lastMove, first: 0 };
}

/** timeline times (s) of every tap inside a segment (used for UI tick sounds) */
export function tapsIn(s: Seg): number[] {
  const { from, rate } = resolveSeg(s);
  const clip = CLIPS[s.clip];
  return clip.events
    .filter((e) => e.type === 'down')
    .map((e) => s.at + (e.t - from) / rate)
    .filter((t) => t >= s.at && t < s.at + s.dur);
}
