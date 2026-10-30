import { Download, Loader2, Lock, Printer, Share2, Smartphone, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { computeLayout } from '../film/layout';
import { downloadBlob, exportFilm, shareBlob, type ExportKind } from '../media/export';
import { PPM_300DPI } from '../render/compose';
import { useStudio } from '../state/studio';
import { FilmCanvas } from './FilmCanvas';
import { Seg } from './panels/common';

export function ExportDialog() {
  const { doc, exportOpen, setExportOpen, toast } = useStudio();
  const ref = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<ExportKind>('share');
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);
  const l = computeLayout(doc.format, doc.frames, doc.corners);
  const ppm = kind === 'print' ? PPM_300DPI : 1800 / Math.max(l.widthMm, l.heightMm);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (exportOpen && !d.open) d.showModal();
    if (!exportOpen && d.open) d.close();
  }, [exportOpen]);

  const run = async (mode: 'save' | 'share') => {
    setBusy(mode);
    try {
      const out = await exportFilm(doc, kind);
      if (mode === 'share') {
        const r = await shareBlob(out);
        if (r === 'unsupported') {
          await downloadBlob(out);
          toast('Saved to your device');
        }
      } else await downloadBlob(out);
    } catch {
      toast("Couldn't save. Try again");
    } finally {
      setBusy(null);
    }
  };

  return (
    <dialog
      ref={ref}
      onClose={() => setExportOpen(false)}
      onClick={(e) => e.target === ref.current && setExportOpen(false)}
      aria-labelledby="export-title"
      className="m-auto w-[min(94vw,56rem)] overflow-hidden rounded-2xl border border-line2 bg-surface p-0 text-text shadow-[var(--shadow)] backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <div className="grid md:grid-cols-[1fr_20rem]">
        <div className="stage-bg grid h-[44dvh] place-items-center p-6 md:h-[70dvh]">
          {exportOpen && <FilmCanvas doc={doc} label="Your finished film" />}
        </div>
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <h2 id="export-title" className="text-xl font-semibold">Export</h2>
            <button className="btn btn-icon btn-ghost" onClick={() => setExportOpen(false)} aria-label="Close"><X size={20} aria-hidden /></button>
          </div>
          <Seg label="Size" value={kind} onChange={setKind} options={[{ id: 'share', label: 'Share', icon: <Smartphone size={16} aria-hidden /> }, { id: 'print', label: 'Print', icon: <Printer size={16} aria-hidden /> }]} />
          <p className="num text-sm text-muted" aria-live="polite">
            {Math.round(l.widthMm * ppm)} × {Math.round(l.heightMm * ppm)} px{kind === 'print' ? ' · 300 DPI · PNG' : ' · JPEG'}
          </p>
          <button className="btn btn-primary btn-lg" onClick={() => run('save')} disabled={!!busy}>
            {busy === 'save' ? <Loader2 className="animate-spin" size={20} aria-hidden /> : <Download size={20} aria-hidden />} Save
          </button>
          <button className="btn btn-lg" onClick={() => run('share')} disabled={!!busy}>
            {busy === 'share' ? <Loader2 className="animate-spin" size={20} aria-hidden /> : <Share2 size={20} aria-hidden />} Share
          </button>
          <p className="mt-auto flex items-center gap-2 text-xs text-muted"><Lock size={14} aria-hidden /> Made on your device. Nothing is uploaded.</p>
        </div>
      </div>
    </dialog>
  );
}
