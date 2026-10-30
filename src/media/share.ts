import qrcode from 'qrcode-generator';
import { FILTERS } from '../film/filters';
import { FORMAT_ORDER, frameOptionsFor, isOrientation } from '../film/layout';
import type { FilmDoc, FormatId, Orientation } from '../film/types';
import { FRAME_STYLES } from '../render/frames';

/** The shareable "look" of a film: layout and style only. No photos, text, stickers, dates or anything personal. */
export interface Look {
  format: FormatId;
  orientation: Orientation;
  frames: number;
  filterId: string;
  frameStyle: string;
}

const ID = /^[a-z0-9-]{1,32}$/;

/** `#look=<format>.<orientation>.<frames>.<filterId>.<frameStyle>` for this doc. */
export function lookToHash(doc: Pick<FilmDoc, 'format' | 'orientation' | 'frames' | 'filterId' | 'frameStyle'>): string {
  const o = doc.orientation ?? 'portrait';
  return `#look=${doc.format}.${o}.${doc.frames}.${doc.filterId}.${doc.frameStyle}`;
}

/** Parse a `#look=...` hash (with or without the leading `#`). Every field is checked against the real ids; anything else gives null. */
export function parseLookHash(hash: string | null | undefined): Look | null {
  if (typeof hash !== 'string' || hash.length > 200) return null;
  const m = /^#?look=([^&#]*)$/.exec(hash.trim());
  if (!m) return null;
  let raw: string;
  try {
    raw = decodeURIComponent(m[1]);
  } catch {
    return null;
  }
  const parts = raw.split('.');
  if (parts.length !== 5 || parts.some((p) => !ID.test(p))) return null;
  const [format, orientation, framesStr, filterId, frameStyle] = parts;
  if (!(FORMAT_ORDER as string[]).includes(format)) return null;
  if (!isOrientation(orientation)) return null;
  if (!/^[1-9]$/.test(framesStr)) return null;
  const frames = Number(framesStr);
  if (!frameOptionsFor(format as FormatId, orientation).includes(frames)) return null;
  if (!FILTERS.some((f) => f.id === filterId)) return null;
  if (!FRAME_STYLES.some((f) => f.id === frameStyle)) return null;
  return { format: format as FormatId, orientation, frames, filterId, frameStyle };
}

/** The app's own address, without any hash (so a scan opens a fresh app, never this person's state). */
export function appUrl(href: string = location.href): string {
  const i = href.indexOf('#');
  return i < 0 ? href : href.slice(0, i);
}

export function lookUrl(doc: Parameters<typeof lookToHash>[0], href?: string): string {
  return appUrl(href) + lookToHash(doc);
}

/** QR matrix as one SVG path (1 unit per module, `margin` modules of quiet zone). Generated locally, no network. */
export function qrSvgPath(text: string, margin = 4): { size: number; d: string } {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.isDark(r, c)) continue;
      let w = 1;
      while (c + w < n && qr.isDark(r, c + w)) w++;
      d += `M${c + margin} ${r + margin}h${w}v1h-${w}z`;
      c += w - 1;
    }
  }
  return { size: n + margin * 2, d };
}

/** True when this browser can hand image files to the OS share sheet (AirDrop, Quick Share, apps). */
export function canShareFiles(): boolean {
  try {
    const probe = new File([new Uint8Array(1)], 'probe.jpg', { type: 'image/jpeg' });
    return typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [probe] });
  } catch {
    return false;
  }
}

/** True when an image can be copied to the clipboard. */
export function canCopyImage(): boolean {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return false;
  const supports = (ClipboardItem as unknown as { supports?: (t: string) => boolean }).supports;
  return supports ? supports('image/png') : true;
}

async function toPng(blob: Blob): Promise<Blob> {
  if (blob.type === 'image/png') return blob;
  const bmp = await createImageBitmap(blob);
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext('2d')!.drawImage(bmp, 0, 0);
  bmp.close();
  try {
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), 'image/png'));
  } finally {
    c.width = 0;
  }
}

/** Copy the image as PNG. The blob may still be rendering: ClipboardItem takes the promise, so the user gesture is kept (Safari). */
export async function copyImage(blob: Blob | Promise<Blob>): Promise<void> {
  const png = Promise.resolve(blob).then(toPng);
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
}
