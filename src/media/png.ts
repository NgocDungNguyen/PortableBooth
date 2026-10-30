/** Tiny, dependency-free helpers that stamp the print resolution into encoded images. */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export const pixelsPerMetre = (dpi: number) => Math.round(dpi / 0.0254);

const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];

/** Insert a pHYs chunk (pixels per metre) right after IHDR so printers read the true physical size. */
export function setPngDpi(png: Uint8Array, dpi: number): Uint8Array {
  if (png.length < 33 || PNG_SIG.some((b, i) => png[i] !== b)) return png;
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  // drop an existing pHYs if present
  let pos = 8;
  while (pos + 8 <= png.length) {
    const len = view.getUint32(pos);
    const type = String.fromCharCode(png[pos + 4], png[pos + 5], png[pos + 6], png[pos + 7]);
    if (type === 'pHYs') {
      const without = new Uint8Array(png.length - (len + 12));
      without.set(png.subarray(0, pos), 0);
      without.set(png.subarray(pos + len + 12), pos);
      return setPngDpi(without, dpi);
    }
    if (type === 'IDAT') break;
    pos += len + 12;
  }
  const ppu = pixelsPerMetre(dpi);
  const chunk = new Uint8Array(21);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  dv.setUint32(8, ppu);
  dv.setUint32(12, ppu);
  chunk[16] = 1; // metres
  dv.setUint32(17, crc32(chunk.subarray(4, 17)));
  const out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, 33), 0);
  out.set(chunk, 33);
  out.set(png.subarray(33), 33 + chunk.length);
  return out;
}

export function readPngDpi(png: Uint8Array): number | null {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let pos = 8;
  while (pos + 8 <= png.length) {
    const len = view.getUint32(pos);
    const type = String.fromCharCode(png[pos + 4], png[pos + 5], png[pos + 6], png[pos + 7]);
    if (type === 'pHYs') return view.getUint8(pos + 16) === 1 ? Math.round(view.getUint32(pos + 8) * 0.0254) : null;
    pos += len + 12;
  }
  return null;
}

/** Patch the JFIF header's density to `dpi` (the browser encoder writes 1:1 aspect, unitless). */
export function setJpegDpi(jpg: Uint8Array, dpi: number): Uint8Array {
  const isJfif = jpg[0] === 0xff && jpg[1] === 0xd8 && jpg[2] === 0xff && jpg[3] === 0xe0 && jpg[6] === 0x4a && jpg[7] === 0x46;
  if (!isJfif) return jpg;
  const out = jpg.slice();
  out[13] = 1; // dots per inch
  out[14] = (dpi >> 8) & 255;
  out[15] = dpi & 255;
  out[16] = (dpi >> 8) & 255;
  out[17] = dpi & 255;
  return out;
}
