import { loadStickers } from '../assets/stickers';
import type { FilmDoc } from '../film/types';
import { ensureFonts } from '../render/fonts';
import { PPM_300DPI, renderFilm } from '../render/compose';
import { setJpegDpi, setPngDpi } from './png';

export type ExportKind = 'share' | 'print';
export interface ExportResult {
  blob: Blob;
  filename: string;
  width: number;
  height: number;
  mime: string;
}

const SHARE_LONG_EDGE_PX = 1800;

const toBlob = (c: HTMLCanvasElement, type: string, q?: number) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), type, q));

/** Renders the doc with the exact same pipeline as the preview, then encodes it. */
export async function exportFilm(doc: FilmDoc, kind: ExportKind): Promise<ExportResult> {
  await Promise.all([ensureFonts(), loadStickers()]);
  const canvas = document.createElement('canvas');
  try {
    const stamp = doc.date.replaceAll('-', '');
    if (kind === 'print') {
      const r = renderFilm(canvas, doc, { ppm: PPM_300DPI });
      const buf = new Uint8Array(await (await toBlob(canvas, 'image/png')).arrayBuffer());
      const png = setPngDpi(buf, 300);
      return { blob: new Blob([png.slice().buffer], { type: 'image/png' }), filename: `portablebooth-${doc.format}-300dpi-${stamp}.png`, width: r.width, height: r.height, mime: 'image/png' };
    }
    const probe = renderFilm(canvas, doc, { ppm: 1 });
    const ppm = SHARE_LONG_EDGE_PX / Math.max(probe.width, probe.height);
    const r = renderFilm(canvas, doc, { ppm, matte: '#FFFFFF' });
    const buf = new Uint8Array(await (await toBlob(canvas, 'image/jpeg', 0.92)).arrayBuffer());
    const jpg = setJpegDpi(buf, Math.round(r.ppm * 25.4));
    return { blob: new Blob([jpg.slice().buffer], { type: 'image/jpeg' }), filename: `portablebooth-${doc.format}-${stamp}.jpg`, width: r.width, height: r.height, mime: 'image/jpeg' };
  } finally {
    canvas.width = 0; // free the big bitmap straight away
  }
}

export function downloadBlob(b: ExportResult) {
  const url = URL.createObjectURL(b.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = b.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function shareBlob(b: ExportResult): Promise<'shared' | 'unsupported' | 'cancelled'> {
  const file = new File([b.blob], b.filename, { type: b.mime });
  if (!navigator.canShare?.({ files: [file] })) return 'unsupported';
  try {
    await navigator.share({ files: [file], title: 'PortableBooth' });
    return 'shared';
  } catch {
    return 'cancelled';
  }
}
