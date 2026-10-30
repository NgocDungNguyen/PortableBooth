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
});
