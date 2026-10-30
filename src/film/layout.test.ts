import { describe, expect, it } from 'vitest';
import { computeLayout, FORMATS } from './layout';

describe('computeLayout', () => {
  it('keeps every slot inside the film for all formats and frame counts', () => {
    for (const fm of Object.values(FORMATS)) {
      for (const n of fm.frameOptions) {
        const l = computeLayout(fm.id, n, 'square');
        expect(l.slots).toHaveLength(n);
        for (const s of l.slots) {
          expect(s.x).toBeGreaterThanOrEqual(0);
          expect(s.y).toBeGreaterThanOrEqual(0);
          expect(s.x + s.w).toBeLessThanOrEqual(l.widthMm + 1e-6);
          expect(s.y + s.h).toBeLessThanOrEqual(l.heightMm + 1e-6);
        }
      }
    }
  });
  it('does not overlap slots', () => {
    const l = computeLayout('strip', 4, 'square');
    for (let i = 1; i < l.slots.length; i++) expect(l.slots[i].y).toBeGreaterThanOrEqual(l.slots[i - 1].y + l.slots[i - 1].h - 1e-6);
  });
  it('uses real stock sizes', () => {
    expect(computeLayout('strip', 4, 'square')).toMatchObject({ widthMm: 51, heightMm: 152 });
    expect(computeLayout('instant', 1, 'round')).toMatchObject({ widthMm: 54, heightMm: 86 });
    expect(computeLayout('film35', 3, 'square').widthMm).toBe(50);
  });
  it('puts sprocket holes only on 35mm', () => {
    expect(computeLayout('film35', 3, 'square').holes.length).toBeGreaterThan(10);
    expect(computeLayout('strip', 3, 'square').holes).toHaveLength(0);
  });
});
