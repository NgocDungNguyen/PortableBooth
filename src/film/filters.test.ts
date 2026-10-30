import { describe, expect, it } from 'vitest';
import { FILTER_FAMILIES, FILTERS, filterById, type FilterDef } from './filters';

const BANNED = ['kodak', 'portra', 'cinestill', 'fuji', 'velvia', 'ektar', 'polaroid', 'instax', 'lomo', 'vsco'];
const FAMILY_IDS = FILTER_FAMILIES.map((f) => f.id);
const inRange = (n: number, lo: number, hi: number) => typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;
const rgb = (c: number[], lo = 0, hi = 1) => c.length === 3 && c.every((n) => inRange(n, lo, hi));

describe('FILTERS', () => {
  it('starts with original, in the film family', () => {
    expect(FILTERS[0].id).toBe('original');
    expect(FILTERS[0].family).toBe('film');
  });
  it('has a healthy catalogue', () => {
    expect(FILTERS.length).toBeGreaterThanOrEqual(30);
    for (const fam of FILTER_FAMILIES) expect(FILTERS.some((f) => f.family === fam.id)).toBe(true);
  });
  it('lists the five families in order', () => {
    expect(FILTER_FAMILIES.map((f) => f.label)).toEqual(['Film', 'Mono', 'Digicam', 'Mood', 'FX']);
  });
  it('has unique ids and names, each with a valid family', () => {
    expect(new Set(FILTERS.map((f) => f.id)).size).toBe(FILTERS.length);
    expect(new Set(FILTERS.map((f) => f.name.toLowerCase())).size).toBe(FILTERS.length);
    for (const f of FILTERS) {
      expect(f.id).toMatch(/^[a-z0-9-]+$/);
      expect(FAMILY_IDS).toContain(f.family);
      expect(f.name.trim().split(/\s+/).length).toBeLessThanOrEqual(2);
    }
  });
  it('never uses trademarked words in names or ids', () => {
    for (const f of FILTERS) {
      const hay = `${f.id} ${f.name}`.toLowerCase();
      for (const word of BANNED) expect(hay).not.toContain(word);
    }
  });
  it('keeps every numeric param in a sane range', () => {
    for (const f of FILTERS as FilterDef[]) {
      for (const k of ['contrast', 'saturation', 'brightness', 'warmth'] as const) expect(inRange(f[k], -1, 1)).toBe(true);
      for (const k of ['fade', 'grain', 'glow', 'vignette', 'split', 'leak', 'scan', 'aber', 'halftone', 'glitch'] as const) expect(inRange(f[k], 0, 1)).toBe(true);
      expect(rgb(f.shadow, 0, 1)).toBe(true);
      expect(rgb(f.highlight, 0, 1)).toBe(true);
      expect(rgb(f.leakColor, 0, 1)).toBe(true);
      expect([0, 1, 2, 3]).toContain(f.leakCorner);
      expect(typeof f.bw).toBe('boolean');
      expect(f.pixel === 0 || inRange(f.pixel, 8, 400)).toBe(true);
      expect(f.poster === 0 || (Number.isInteger(f.poster) && inRange(f.poster, 2, 16))).toBe(true);
      if (f.duo) {
        expect(rgb(f.duo.a)).toBe(true);
        expect(rgb(f.duo.b)).toBe(true);
        if (f.duo.mid) expect(rgb(f.duo.mid)).toBe(true);
        expect(inRange(f.duo.amount, 0, 1)).toBe(true);
      }
    }
  });
  it('makes every non-original filter do something', () => {
    for (const f of FILTERS.slice(1)) {
      const active =
        f.contrast !== 0 || f.saturation !== 0 || f.brightness !== 0 || f.warmth !== 0 || f.fade > 0 || f.grain > 0 || f.glow > 0 ||
        f.vignette > 0 || f.bw || f.split > 0 || f.leak > 0 || !!f.duo || f.pixel > 0 || f.poster > 0 || f.scan > 0 || f.aber > 0 ||
        f.halftone > 0 || f.glitch > 0;
      expect(active).toBe(true);
    }
  });
  it('has the new effect filters wired to their parameters', () => {
    expect(filterById('pixel').pixel).toBeGreaterThan(0);
    expect(filterById('poster').poster).toBeGreaterThan(0);
    expect(filterById('halftone').halftone).toBeGreaterThan(0);
    expect(filterById('glitch').aber).toBeGreaterThan(0);
    expect(filterById('camcorder').scan).toBeGreaterThan(0);
    expect(filterById('cyano').duo).not.toBeNull();
    expect(filterById('vivid').name).toBe('Vivid');
    expect(FILTERS.some((f) => f.id === 'lomo')).toBe(false);
  });
});

describe('filterById', () => {
  it('finds filters by id', () => {
    expect(filterById('noir').name).toBe('Noir');
  });
  it('falls back to original for unknown ids', () => {
    expect(filterById('nope').id).toBe('original');
    expect(filterById('').id).toBe('original');
    expect(filterById('lomo').id).toBe('original');
  });
});
