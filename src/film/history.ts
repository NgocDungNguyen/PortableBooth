import { sanitizeDoc } from './doc';
import type { FilmDoc } from './types';

export interface HistoryState {
  present: FilmDoc;
  past: FilmDoc[];
  future: FilmDoc[];
  lastKey: string | null;
  lastAt: number;
}

export type HistoryAction =
  | { type: 'apply'; fn: (d: FilmDoc) => FilmDoc; key?: string; now?: number }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; doc: FilmDoc };

export const LIMIT = 60;
/** consecutive edits with the same key inside this window collapse into one undo step */
export const COALESCE_MS = 700;

export const initHistory = (doc: FilmDoc): HistoryState => ({ present: doc, past: [], future: [], lastKey: null, lastAt: 0 });

export function historyReducer(s: HistoryState, a: HistoryAction): HistoryState {
  switch (a.type) {
    case 'apply': {
      const next = sanitizeDoc(a.fn(s.present));
      if (JSON.stringify(next) === JSON.stringify(s.present)) return s;
      const now = a.now ?? Date.now();
      const coalesce = a.key !== undefined && a.key === s.lastKey && now - s.lastAt < COALESCE_MS;
      return {
        present: next,
        past: coalesce ? s.past : [...s.past, s.present].slice(-LIMIT),
        future: [], lastKey: a.key ?? null, lastAt: now,
      };
    }
    case 'undo': {
      if (!s.past.length) return s;
      const prev = s.past[s.past.length - 1];
      return { present: prev, past: s.past.slice(0, -1), future: [s.present, ...s.future], lastKey: null, lastAt: 0 };
    }
    case 'redo': {
      if (!s.future.length) return s;
      const [next, ...rest] = s.future;
      return { present: next, past: [...s.past, s.present], future: rest, lastKey: null, lastAt: 0 };
    }
    case 'reset':
      return initHistory(a.doc);
  }
}
