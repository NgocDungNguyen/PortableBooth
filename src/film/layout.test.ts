import { describe, expect, it } from 'vitest';
import { computeLayout, FORMATS, frameOptionsFor, nearestFrames, ORIENTATIONS } from './layout';

const rects = (l: ReturnType<typeof computeLayout>) => [...l.slots, ...l.holes, ...(l.caption ? [l.caption] : [])];

describe('computeLayout', () => {
  it('keeps every slot, hole and caption inside the film for all formats, frame counts and orientations', () => {
    for (const fm of Object.values(FORMATS)) {
      for (const o of ORIENTATIONS) {
        for (const corners of ['square', 'round'] as const) {
          for (const n of frameOptionsFor(fm.id, o)) {
            const l = computeLayout(fm.id, n, corners, o);
            expect(l.slots).toHaveLength(n);
            for (const s of rects(l)) {
              expect(s.x).toBeGreaterThanOrEqual(0);
              expect(s.y).toBeGreaterThanOrEqual(0);
              expect(s.x + s.w).toBeLessThanOrEqual(l.widthMm + 1e-6);
              expect(s.y + s.h).toBeLessThanOrEqual(l.heightMm + 1e-6);
            }
          }
        }
      }
    }
  });
  it('does not overlap slots, in either orientation', () => {
    for (const fm of Object.values(FORMATS)) {
      for (const o of ORIENTATIONS) {
        for (const n of frameOptionsFor(fm.id, o)) {
          const { slots } = computeLayout(fm.id, n, 'square', o);
          for (let i = 0; i < slots.length; i++) {
            for (let j = i + 1; j < slots.length; j++) {
              const a = slots[i], b = slots[j];
              const apart = a.x + a.w <= b.x + 1e-6 || b.x + b.w <= a.x + 1e-6 || a.y + a.h <= b.y + 1e-6 || b.y + b.h <= a.y + 1e-6;
              expect(apart, `${fm.id} ${o} ${n}: slot ${i} vs ${j}`).toBe(true);
            }
          }
        }
      }
    }
  });
  it('keeps text anchors and the caption clear of the photos', () => {
    for (const fm of Object.values(FORMATS)) {
      for (const o of ORIENTATIONS) {
        const l = computeLayout(fm.id, frameOptionsFor(fm.id, o)[0], 'square', o);
        if (l.caption) for (const s of l.slots) {
          const apart = s.y + s.h <= l.caption.y + 1e-6 || s.x + s.w <= l.caption.x + 1e-6 || l.caption.x + l.caption.w <= s.x + 1e-6;
          expect(apart).toBe(true);
        }
        for (const f of l.edgeText?.frameNumbers ?? []) {
          expect(f.x).toBeGreaterThanOrEqual(0);
          expect(f.x).toBeLessThanOrEqual(l.widthMm);
          expect(f.y).toBeLessThanOrEqual(l.heightMm);
        }
      }
    }
  });
  it('uses real stock sizes (portrait geometry is unchanged)', () => {
    expect(computeLayout('strip', 4, 'square')).toMatchObject({ widthMm: 51, heightMm: 152 });
    expect(computeLayout('strip', 4, 'square', 'portrait')).toMatchObject({ widthMm: 51, heightMm: 152 });
    expect(computeLayout('strip', 3, 'square')).toMatchObject({ widthMm: 51, heightMm: 152 });
    expect(computeLayout('instant', 1, 'round')).toMatchObject({ widthMm: 54, heightMm: 86, outerRadius: 3 });
    expect(computeLayout('film35', 3, 'square').widthMm).toBe(50);
    expect(computeLayout('film35', 3, 'square').heightMm).toBe(167);
    expect(computeLayout('film35', 2, 'square').heightMm).toBe(115.5);
    const strip = computeLayout('strip', 4, 'square');
    expect(strip.slots[0]).toEqual({ x: 4, y: 4, w: 43, h: 31 });
    expect(strip.caption).toEqual({ x: 4, y: 137, w: 43, h: 15 });
    expect(strip.captionBrand).toMatchObject({ x: 25.5, y: 148.6, align: 'center' });
    expect(computeLayout('instant', 2, 'round').captionBrand).toMatchObject({ x: 50, y: 82.6, align: 'right' });
    expect(computeLayout('film35', 3, 'square').frameNumberYs).toHaveLength(3);
  });
  it('has the agreed wide geometries', () => {
    expect(computeLayout('strip', 3, 'square', 'landscape')).toMatchObject({ widthMm: 164, heightMm: 54 });
    const s4 = computeLayout('strip', 4, 'square', 'landscape');
    expect(s4).toMatchObject({ widthMm: 217, heightMm: 54 });
    expect(s4.slots[3]).toEqual({ x: 163, y: 4, w: 50, h: 40 });
    expect(s4.caption).toEqual({ x: 4, y: 44, w: 209, h: 10 });
    expect(s4.captionBrand?.align).toBe('center');
    const i1 = computeLayout('instant', 1, 'round', 'landscape');
    expect(i1).toMatchObject({ widthMm: 108, heightMm: 86, outerRadius: 3, slotHairline: true });
    expect(i1.slots).toEqual([{ x: 4, y: 4, w: 100, h: 62 }]);
    expect(i1.caption).toEqual({ x: 4, y: 66, w: 100, h: 20 });
    expect(i1.captionBrand?.align).toBe('right');
    const i2 = computeLayout('instant', 2, 'square', 'landscape');
    expect(i2.slots).toEqual([{ x: 4, y: 4, w: 48.5, h: 62 }, { x: 55.5, y: 4, w: 48.5, h: 62 }]);
    expect(computeLayout('film35', 3, 'square', 'landscape')).toMatchObject({ widthMm: 167, heightMm: 54 });
    const f4 = computeLayout('film35', 4, 'square', 'landscape');
    expect(f4).toMatchObject({ widthMm: 218.5, heightMm: 54 });
    expect(f4.slots[1]).toEqual({ x: 59.5, y: 9, w: 48, h: 34 });
    expect(f4.edgeText?.brand).toEqual({ x: 8, y: 6.2 });
    expect(f4.edgeText?.frameNumbers).toHaveLength(4);
    expect(f4.edgeText?.frameNumbers[0]).toMatchObject({ x: 8, y: 45.5 });
  });
  it('puts sprocket holes only on 35mm (rows along the long edges when wide)', () => {
    expect(computeLayout('film35', 3, 'square').holes.length).toBeGreaterThan(10);
    expect(computeLayout('strip', 3, 'square').holes).toHaveLength(0);
    const w = computeLayout('film35', 3, 'square', 'landscape');
    expect(w.holes.length).toBeGreaterThan(20);
    expect(new Set(w.holes.map((h) => h.y))).toEqual(new Set([1.6, 50.4]));
    expect(computeLayout('instant', 1, 'round', 'landscape').holes).toHaveLength(0);
  });
  it('picks the nearest allowed frame count', () => {
    expect(nearestFrames('film35', 'landscape', 2)).toBe(3);
    expect(nearestFrames('film35', 'portrait', 4)).toBe(3);
    expect(nearestFrames('strip', 'landscape', 4)).toBe(4);
    expect(nearestFrames('instant', 'landscape', 2)).toBe(2);
  });
});
