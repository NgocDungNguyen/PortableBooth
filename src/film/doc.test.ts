import { describe, expect, it } from 'vitest';
import { createDoc, newSticker, newText, reshape, sanitizeDoc, setOrientation, stampText, MAX_TEXT } from './doc';
import { historyReducer, initHistory, COALESCE_MS } from './history';
import { computeLayout, FORMAT_ORDER, frameOptionsFor } from './layout';
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
    expect(s.v).toBe(2);
    expect(s.filterId).toBe('original');
    expect(s.adjust.brightness).toBe(1);
    expect(s.adjust.grain).toBe(0);
    expect(s.adjust.intensity).toBe(0);
    expect(s.slots).toHaveLength(4);
    expect(s.slots[0]).toEqual({ photoId: null, zoom: 3, ox: -1, oy: -1, filterId: null });
    expect(s.items).toHaveLength(1);
    expect((s.items[0] as TextItem).text).toHaveLength(MAX_TEXT);
    expect((s.items[0] as TextItem).font).toBe('sans');
    expect(sanitizeDoc(s)).toEqual(s);
  });
  it('sanitises element styling (opacity, outline, crop, blend, overlays)', () => {
    const d = createDoc('strip');
    const st = { ...newSticker('shapes/star-5', true, 10, 10, 12), opacity: 9, blend: 'nope' as never, outline: { color: 'red', width: 99 }, crop: { l: 0.7, t: 0, r: 0.7, b: 0 } };
    const tx = { ...newText('hi', '#FFFFFF', 5, 5), tracking: 99, bg: 'x' };
    const s = sanitizeDoc({ ...d, items: [st, tx], overlays: [{ id: 'nope', opacity: 1 }] });
    const a = s.items[0] as typeof st;
    expect(a.opacity).toBe(1);
    expect(a.blend).toBe('normal');
    expect(a.outline).toBeNull();
    expect(a.crop.l + a.crop.r).toBeLessThanOrEqual(0.9 + 1e-9);
    expect((s.items[1] as typeof tx).tracking).toBe(0.6);
    expect((s.items[1] as typeof tx).bg).toBeNull();
    expect(s.overlays).toHaveLength(0);
  });
  it('creates portrait docs by default and wide docs on request', () => {
    expect(createDoc('strip').orientation).toBe('portrait');
    const w = createDoc('film35', undefined, 'landscape');
    expect(w.orientation).toBe('landscape');
    expect(w.frames).toBe(3);
    expect(createDoc('film35', 4, 'landscape').slots).toHaveLength(4);
    expect(createDoc('film35', 4).slots).toHaveLength(3);
    // reshape stays in the doc's orientation
    expect(reshape(w, 'film35', 4).slots).toHaveLength(4);
    expect(reshape(w, 'strip').orientation).toBe('landscape');
  });
  it('sanitize rejects a bad orientation and accepts the two good ones', () => {
    const d = createDoc('strip');
    expect(sanitizeDoc({ ...d, orientation: 'sideways' as never }).orientation).toBe('portrait');
    expect(sanitizeDoc({ ...d, orientation: undefined as never }).orientation).toBe('portrait');
    expect(sanitizeDoc({ ...d, orientation: 'landscape' }).orientation).toBe('landscape');
    // frame counts are validated against the orientation
    expect(sanitizeDoc({ ...createDoc('film35', 4, 'landscape') }).frames).toBe(4);
    expect(sanitizeDoc({ ...createDoc('film35', 4, 'landscape'), orientation: 'portrait' }).frames).toBe(3);
  });
  it('setOrientation keeps photos, look and elements, and remaps elements into the film', () => {
    for (const fmt of FORMAT_ORDER) {
      for (const n of frameOptionsFor(fmt, 'portrait')) {
        let d = createDoc(fmt, n);
        d.slots = d.slots.map((s, i) => ({ ...s, photoId: `p${i}`, zoom: 1.5 }));
        d.filterId = 'noir';
        d.frameColor = '#D4174A';
        d.overlays = [];
        const l0 = computeLayout(fmt, n, d.corners);
        d = { ...d, items: [newText('hi', '#FFFFFF', l0.widthMm - 1, l0.heightMm - 1), newSticker('shapes/star-5', true, 1, 1, 20)] };
        const w = setOrientation(d, 'landscape');
        expect(w.orientation).toBe('landscape');
        expect(frameOptionsFor(fmt, 'landscape')).toContain(w.frames);
        expect(w.slots).toHaveLength(w.frames);
        expect(w.filterId).toBe('noir');
        expect(w.frameColor).toBe('#D4174A');
        expect(w.format).toBe(fmt);
        const kept = Math.min(n, w.frames);
        expect(w.slots.slice(0, kept).map((s) => s.photoId)).toEqual(d.slots.slice(0, kept).map((s) => s.photoId));
        expect(w.slots[0].zoom).toBe(1.5);
        const lw = computeLayout(fmt, w.frames, w.corners, 'landscape');
        for (const it of w.items) {
          expect(it.x).toBeGreaterThanOrEqual(0);
          expect(it.x).toBeLessThanOrEqual(lw.widthMm);
          expect(it.y).toBeGreaterThanOrEqual(0);
          expect(it.y).toBeLessThanOrEqual(lw.heightMm);
          expect(it.size).toBeGreaterThanOrEqual(2);
        }
        const back = setOrientation(w, 'portrait');
        expect(back.orientation).toBe('portrait');
        const keptBack = Math.min(n, w.frames, back.frames);
        expect(back.slots.slice(0, keptBack).map((s) => s.photoId)).toEqual(d.slots.slice(0, keptBack).map((s) => s.photoId));
        const lb = computeLayout(fmt, back.frames, back.corners, 'portrait');
        for (const it of back.items) {
          expect(it.x).toBeLessThanOrEqual(lb.widthMm);
          expect(it.y).toBeLessThanOrEqual(lb.heightMm);
        }
        expect(sanitizeDoc(w)).toEqual(w);
      }
    }
  });
  it('setOrientation loses no photos when the slot count is unchanged, and is a no-op for the same orientation', () => {
    const d = createDoc('strip', 4);
    d.slots = d.slots.map((s, i) => ({ ...s, photoId: `p${i}` }));
    const w = setOrientation(d, 'landscape');
    expect(w.slots.map((s) => s.photoId)).toEqual(['p0', 'p1', 'p2', 'p3']);
    expect(setOrientation(d, 'portrait')).toBe(d);
    // 35mm wide has 3-4 frames: a 2-photo roll grows to 3 and keeps both photos
    const f = createDoc('film35', 2);
    f.slots[0].photoId = 'a';
    f.slots[1].photoId = 'b';
    const fw = setOrientation(f, 'landscape');
    expect(fw.frames).toBe(3);
    expect(fw.slots.map((s) => s.photoId)).toEqual(['a', 'b', null]);
    // shrinking drops only the extra slot
    const f4 = createDoc('film35', 4, 'landscape');
    f4.slots = f4.slots.map((s, i) => ({ ...s, photoId: `q${i}` }));
    expect(setOrientation(f4, 'portrait').slots.map((s) => s.photoId)).toEqual(['q0', 'q1', 'q2']);
  });
  it('parks photos that no longer fit and restores them when the film grows again', () => {
    const d = createDoc('strip');
    d.slots.forEach((s, i) => (s.photoId = `p${i}`));
    const small = reshape(d, 'instant');
    expect(small.slots.map((s) => s.photoId)).toEqual(['p0']);
    expect(small.spare?.map((s) => s.photoId)).toEqual(['p1', 'p2', 'p3']);
    const back = reshape(small, 'strip');
    expect(back.slots.map((s) => s.photoId)).toEqual(['p0', 'p1', 'p2', 'p3']);
    expect(sanitizeDoc(small).spare).toHaveLength(3);
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
