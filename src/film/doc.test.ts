import { describe, expect, it } from 'vitest';
import { createDoc, reshape, sanitizeDoc, stampText, MAX_TEXT } from './doc';
import { historyReducer, initHistory, COALESCE_MS } from './history';
import type { FilmDoc, TextItem } from './types';

describe('doc', () => {
  it('creates docs with the right slot count', () => {
    expect(createDoc('strip').slots).toHaveLength(4);
    expect(createDoc('strip', 3).slots).toHaveLength(3);
    expect(createDoc('strip', 99).slots).toHaveLength(4);
    expect(createDoc('instant').slots).toHaveLength(1);
  });
  it('reshape keeps photos that still fit and resets format-specific style', () => {
    const d = createDoc('strip');
    d.slots[0].photoId = 'a';
    d.slots[3].photoId = 'd';
    const r = reshape(d, 'strip', 3);
    expect(r.slots.map((s) => s.photoId)).toEqual(['a', null, null]);
    const film = reshape(d, 'film35');
    expect(film.frameColor).toBe('#17120F');
    expect(film.slots[0].photoId).toBe('a');
  });
  it('sanitize clamps hostile values and is idempotent', () => {
    const d = createDoc('strip');
    const bad = {
      ...d, frameColor: 'javascript:alert(1)', filterId: 'nope', date: 'x',
      adjust: { ...d.adjust, brightness: 9e9, grain: NaN, intensity: -4 },
      slots: [{ photoId: 5 as unknown as string, zoom: 99, ox: -50, oy: Infinity }],
      items: [{ id: 'x', kind: 'text', text: 'a'.repeat(500), font: 'evil', color: 'red', x: 1e9, y: 0, size: 0, rot: 0 } as unknown as TextItem, { kind: 'nope' } as never],
    } as FilmDoc;
    const s = sanitizeDoc(bad);
    expect(s.frameColor).toBe('#FFFFFF');
    expect(s.filterId).toBe('original');
    expect(s.adjust.brightness).toBe(1);
    expect(s.adjust.grain).toBe(0);
    expect(s.adjust.intensity).toBe(0);
    expect(s.slots).toHaveLength(4);
    expect(s.slots[0]).toEqual({ photoId: null, zoom: 3, ox: -1, oy: -1 });
    expect(s.items).toHaveLength(1);
    expect((s.items[0] as TextItem).text).toHaveLength(MAX_TEXT);
    expect((s.items[0] as TextItem).font).toBe('marker');
    expect(sanitizeDoc(s)).toEqual(s);
  });
  it('formats the date stamp', () => {
    expect(stampText('2026-10-30')).toBe("30 10 '26");
  });
});

describe('history', () => {
  const set = (b: number, key?: string, now?: number) => ({
    type: 'apply' as const, key, now, fn: (d: FilmDoc) => ({ ...d, adjust: { ...d.adjust, brightness: b } }),
  });
  it('undoes and redoes', () => {
    let s = initHistory(createDoc('strip'));
    s = historyReducer(s, set(0.2));
    s = historyReducer(s, set(0.4));
    s = historyReducer(s, { type: 'undo' });
    expect(s.present.adjust.brightness).toBe(0.2);
    s = historyReducer(s, { type: 'redo' });
    expect(s.present.adjust.brightness).toBe(0.4);
  });
  it('coalesces slider drags with the same key into one step', () => {
    let s = initHistory(createDoc('strip'));
    s = historyReducer(s, set(0.1, 'bright', 1000));
    s = historyReducer(s, set(0.2, 'bright', 1100));
    s = historyReducer(s, set(0.3, 'bright', 1200));
    expect(s.past).toHaveLength(1);
    s = historyReducer(s, set(0.9, 'bright', 1200 + COALESCE_MS + 1));
    expect(s.past).toHaveLength(2);
    s = historyReducer(s, { type: 'undo' });
    expect(s.present.adjust.brightness).toBe(0.3);
  });
  it('ignores no-op changes and clears redo on new edits', () => {
    let s = initHistory(createDoc('strip'));
    s = historyReducer(s, set(0));
    expect(s.past).toHaveLength(0);
    s = historyReducer(s, set(0.5));
    s = historyReducer(s, { type: 'undo' });
    s = historyReducer(s, set(0.7));
    expect(s.future).toHaveLength(0);
  });
});
