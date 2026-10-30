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
  await ensureFonts();
  const canvas = document.createElement('canvas');
  try {
    const stamp = doc.date.replaceAll('-', '');
    const wide = doc.orientation === 'landscape' ? '-wide' : '';
    if (kind === 'print') {
      const r = renderFilm(canvas, doc, { ppm: PPM_300DPI });
      const buf = new Uint8Array(await (await toBlob(canvas, 'image/png')).arrayBuffer());
      const png = setPngDpi(buf, 300);
      return { blob: new Blob([png.slice().buffer], { type: 'image/png' }), filename: `portablebooth-${doc.format}${wide}${wide ? '' : '-300dpi'}-${stamp}.png`, width: r.width, height: r.height, mime: 'image/png' };
    }
    const probe = renderFilm(canvas, doc, { ppm: 1 });
    const ppm = SHARE_LONG_EDGE_PX / Math.max(probe.width, probe.height);
    const r = renderFilm(canvas, doc, { ppm, matte: '#FFFFFF' });
    const buf = new Uint8Array(await (await toBlob(canvas, 'image/jpeg', 0.92)).arrayBuffer());
    const jpg = setJpegDpi(buf, Math.round(r.ppm * 25.4));
    return { blob: new Blob([jpg.slice().buffer], { type: 'image/jpeg' }), filename: `portablebooth-${doc.format}${wide}-${stamp}.jpg`, width: r.width, height: r.height, mime: 'image/jpeg' };
  } finally {
    canvas.width = 0; // free the big bitmap straight away
  }
}

type ClaudeHost = { claude?: { use?: (name: string) => Promise<{ save?: (r: { filename: string; data: Blob }) => Promise<unknown> } | null> } };

/** Save the file. Inside a sandboxed host that offers a `downloads` capability, use it; otherwise a normal download. */
export async function downloadBlob(b: ExportResult): Promise<void> {
  const host = (window as unknown as ClaudeHost).claude;
  if (host?.use) {
    try {
      const dl = await host.use('downloads');
      if (dl?.save) {
        await dl.save({ filename: b.filename, data: b.blob });
        return;
      }
    } catch {
      /* declined or unavailable: fall through to the plain download */
    }
  }
  const url = URL.createObjectURL(b.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = b.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export type ShareOutcome = 'shared' | 'unsupported' | 'cancelled' | 'failed';

/** Hand the file to the OS share sheet (AirDrop on iPhone/Mac, Quick Share on Android, and the user's apps). */
export async function shareBlob(b: ExportResult, text?: string): Promise<ShareOutcome> {
  let file: File;
  try {
    file = new File([b.blob], b.filename, { type: b.mime });
  } catch {
    return 'unsupported';
  }
  if (!navigator.canShare?.({ files: [file] })) return 'unsupported';
  try {
    // files only by default: some targets (iOS Messages, chat apps) drop the image when text rides along
    await navigator.share({ files: [file], ...(text ? { text } : {}) });
    return 'shared';
  } catch (e) {
    return e instanceof DOMException && e.name === 'AbortError' ? 'cancelled' : 'failed';
  }
}
