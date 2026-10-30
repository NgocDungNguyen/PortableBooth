import { describe, expect, it } from 'vitest';
import { crc32, pixelsPerMetre, readPngDpi, setJpegDpi, setPngDpi } from './png';

// 1x1 transparent PNG
const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==')
    .split('')
    .map((c) => c.charCodeAt(0)),
);

describe('png dpi', () => {
  it('computes 300 DPI as 11811 px/m', () => {
    expect(pixelsPerMetre(300)).toBe(11811);
  });
  it('crc32 matches the known check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
  it('writes a readable pHYs chunk after IHDR and keeps the rest intact', () => {
    const out = setPngDpi(PNG, 300);
    expect(out.length).toBe(PNG.length + 21);
    expect(readPngDpi(out)).toBe(300);
    expect(String.fromCharCode(...out.subarray(37, 41))).toBe('pHYs');
    expect(Array.from(out.subarray(41 + 9 + 4))).toEqual(Array.from(PNG.subarray(33)));
  });
  it('is idempotent', () => {
    const once = setPngDpi(PNG, 300);
    expect(Array.from(setPngDpi(once, 300))).toEqual(Array.from(once));
    expect(readPngDpi(setPngDpi(once, 150))).toBe(150);
  });
  it('ignores non-PNG input', () => {
    const junk = new Uint8Array(64);
    expect(setPngDpi(junk, 300)).toBe(junk);
  });
  it('patches JFIF density', () => {
    const jfif = new Uint8Array(20);
    jfif.set([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1]);
    const out = setJpegDpi(jfif, 300);
    expect([out[13], (out[14] << 8) | out[15], (out[16] << 8) | out[17]]).toEqual([1, 300, 300]);
  });
});
