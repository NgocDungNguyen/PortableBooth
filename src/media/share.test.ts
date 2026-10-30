import { describe, expect, it } from 'vitest';
import { createDoc } from '../film/doc';
import { FILTERS } from '../film/filters';
import { FORMAT_ORDER, ORIENTATIONS, frameOptionsFor } from '../film/layout';
import { FRAME_STYLES } from '../render/frames';
import { appUrl, lookToHash, lookUrl, parseLookHash, qrSvgPath } from './share';

describe('look hash', () => {
  it('writes the documented shape', () => {
    const d = { ...createDoc('strip', 4), filterId: 'honey', frameStyle: 'dots' };
    expect(lookToHash(d)).toBe('#look=strip.portrait.4.honey.dots');
  });

  it('round-trips every format, orientation and frame count', () => {
    for (const format of FORMAT_ORDER)
      for (const orientation of ORIENTATIONS)
        for (const frames of frameOptionsFor(format, orientation)) {
          const d = { ...createDoc(format, frames, orientation), filterId: FILTERS[3].id, frameStyle: FRAME_STYLES[2].id };
          expect(parseLookHash(lookToHash(d))).toEqual({ format, orientation, frames, filterId: d.filterId, frameStyle: d.frameStyle });
        }
  });

  it('round-trips every filter and frame style', () => {
    for (const f of FILTERS) expect(parseLookHash(lookToHash({ ...createDoc('instant'), filterId: f.id }))?.filterId).toBe(f.id);
    for (const s of FRAME_STYLES) expect(parseLookHash(lookToHash({ ...createDoc('instant'), frameStyle: s.id }))?.frameStyle).toBe(s.id);
  });

  it('accepts the hash without the leading #', () => {
    expect(parseLookHash('look=instant.landscape.2.original.plain')).toMatchObject({ format: 'instant', orientation: 'landscape', frames: 2 });
  });

  it.each([
    '',
    '#',
    '#studio',
    '#look=',
    '#look=strip.portrait.4.honey',
    '#look=strip.portrait.4.honey.dots.extra',
    '#look=polaroid.portrait.4.honey.dots',
    '#look=strip.sideways.4.honey.dots',
    '#look=strip.portrait.5.honey.dots',
    '#look=strip.portrait.04.honey.dots',
    '#look=strip.portrait.4e0.honey.dots',
    '#look=film35.portrait.4.original.plain',
    '#look=strip.portrait.4.nope.dots',
    '#look=strip.portrait.4.honey.nope',
    '#look=strip.portrait.4.HONEY.dots',
    '#look=strip.portrait.4.honey.dots&x=1',
    '#look=strip.portrait.4.%E0%A4%A.dots',
    '#look=strip.portrait.4.__proto__.dots',
    '#look=strip.portrait.4.<script>.dots',
    `#look=strip.portrait.4.${'a'.repeat(300)}.dots`,
  ])('rejects %j', (h) => {
    expect(parseLookHash(h)).toBeNull();
  });

  it('rejects non-strings', () => {
    expect(parseLookHash(null)).toBeNull();
    expect(parseLookHash(undefined)).toBeNull();
    expect(parseLookHash(42 as unknown as string)).toBeNull();
  });
});

describe('urls', () => {
  it('drops the hash from the app url', () => {
    expect(appUrl('https://x.test/booth/?a=1#studio')).toBe('https://x.test/booth/?a=1');
    expect(appUrl('https://x.test/')).toBe('https://x.test/');
  });
  it('builds a look url without any personal state', () => {
    const d = { ...createDoc('film35'), date: '2020-01-01' };
    expect(lookUrl(d, 'https://x.test/#studio')).toBe('https://x.test/#look=film35.portrait.3.original.noise-film');
  });
});

describe('qr', () => {
  it('makes a square path with a quiet zone', () => {
    const { size, d } = qrSvgPath('https://x.test/', 4);
    expect((size - 8 - 17) % 4).toBe(0); // 17 + 4 * version modules
    expect(d.startsWith('M4 4h7v1h-7z')).toBe(true); // finder pattern top row
  });
});
