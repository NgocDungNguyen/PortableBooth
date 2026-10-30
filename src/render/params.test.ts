import { describe, expect, it } from 'vitest';
import { DEFAULT_ADJUST } from '../film/doc';
import { isIdentity, resolveParams } from './params';

describe('resolveParams', () => {
  it('original + default adjustments is an identity (skips the shader)', () => {
    expect(isIdentity(resolveParams({ filterId: 'original', adjust: DEFAULT_ADJUST }))).toBe(true);
  });
  it('adds user adjustments on top of the preset and clamps', () => {
    const p = resolveParams({ filterId: 'sunday', adjust: { ...DEFAULT_ADJUST, warmth: 0.9, grain: 1 } });
    expect(p.warmth).toBe(1);
    expect(p.grain).toBe(1);
    expect(isIdentity(p)).toBe(false);
  });
  it('zero intensity means no effect', () => {
    expect(isIdentity(resolveParams({ filterId: 'noir', adjust: { ...DEFAULT_ADJUST, intensity: 0 } }))).toBe(true);
  });
  it('unknown filter ids fall back to original', () => {
    expect(isIdentity(resolveParams({ filterId: '??', adjust: DEFAULT_ADJUST }))).toBe(true);
  });
  it('passes the new effect fields through from the preset', () => {
    const adjust = DEFAULT_ADJUST;
    expect(resolveParams({ filterId: 'pixel', adjust }).pixel).toBeGreaterThan(0);
    expect(resolveParams({ filterId: 'poster', adjust }).poster).toBeGreaterThan(0);
    expect(resolveParams({ filterId: 'camcorder', adjust }).scan).toBeGreaterThan(0);
    expect(resolveParams({ filterId: 'glitch', adjust }).aber).toBeGreaterThan(0);
    expect(resolveParams({ filterId: 'halftone', adjust }).halftone).toBeGreaterThan(0);
    expect(resolveParams({ filterId: 'cyano', adjust }).duo?.amount).toBe(1);
    expect(resolveParams({ filterId: 'original', adjust })).toMatchObject({ duo: null, pixel: 0, poster: 0, scan: 0, aber: 0, halftone: 0 });
  });
  it('effect-only filters are not identities', () => {
    for (const id of ['pixel', 'poster', 'halftone', 'camcorder', 'glitch', 'cyano']) {
      const p = resolveParams({ filterId: id, adjust: DEFAULT_ADJUST });
      expect(isIdentity(p)).toBe(false);
    }
    // the effect alone (everything else zeroed) must still defeat the identity shortcut
    const bare = resolveParams({ filterId: 'original', adjust: DEFAULT_ADJUST });
    expect(isIdentity({ ...bare, pixel: 40 })).toBe(false);
    expect(isIdentity({ ...bare, duo: { a: [0, 0, 0], b: [1, 1, 1], amount: 1 } })).toBe(false);
    expect(isIdentity({ ...bare, duo: { a: [0, 0, 0], b: [1, 1, 1], amount: 0 } })).toBe(true);
  });
});
