import { describe, expect, it } from 'vitest';
import { b64u, beamToHash, importKey, looksLike, open, parseBeamHash, seal, unb64u } from './beam';

const room = b64u(new Uint8Array(16).fill(7));
const key = b64u(new Uint8Array(32).fill(9));

describe('beam link codec', () => {
  it('round-trips a room and key through the hash', () => {
    const o = { room, key };
    expect(room).toHaveLength(22);
    expect(key).toHaveLength(43);
    expect(parseBeamHash(beamToHash(o))).toEqual(o);
    expect(parseBeamHash(beamToHash(o).slice(1))).toEqual(o);
  });
  it('rejects junk', () => {
    for (const h of ['', '#beam=', '#beam=abc.def', `#beam=${room}`, `#beam=${room}.${key}x`, `#look=${room}.${key}`, `#beam=${room}.${key}<script>`, null, undefined]) {
      expect(parseBeamHash(h as string)).toBeNull();
    }
  });
  it('base64url round-trips bytes', () => {
    const bytes = crypto.getRandomValues(new Uint8Array(100));
    expect([...unb64u(b64u(bytes))]).toEqual([...bytes]);
  });
});

describe('beam frames', () => {
  it('seals and opens a frame', async () => {
    const k = await importKey(unb64u(key));
    const payload = new TextEncoder().encode('hello photo');
    const f = await seal(k, 3, 2, payload);
    const o = await open(k, f, 3);
    expect(o.kind).toBe(2);
    expect(new TextDecoder().decode(o.payload)).toBe('hello photo');
  });
  it('rejects a frame out of order, a tampered frame and a wrong key', async () => {
    const k = await importKey(unb64u(key));
    const f = await seal(k, 1, 2, new Uint8Array([1, 2, 3]));
    await expect(open(k, f, 2)).rejects.toThrow();
    const t = f.slice();
    t[t.length - 1] ^= 1;
    await expect(open(k, t, 1)).rejects.toThrow();
    const other = await importKey(new Uint8Array(32).fill(1));
    await expect(open(other, f, 1)).rejects.toThrow();
    // relabelling the sequence number breaks the authentication
    const r = f.slice();
    r[3] = 2;
    await expect(open(k, r, 2)).rejects.toThrow();
  });
  it('checks file signatures', () => {
    expect(looksLike('image/png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe(true);
    expect(looksLike('image/jpeg', new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(looksLike('image/png', new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(false);
    expect(looksLike('image/svg+xml', new Uint8Array([0x3c, 0x73, 0x76, 0x67]))).toBe(false);
  });
});
