import { Copy, Download, Loader2, Lock, Printer, Radio, Share, Smartphone, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { computeLayout } from '../film/layout';
import type { FilmDoc } from '../film/types';
import { downloadBlob, exportFilm, shareBlob, type ExportKind, type ExportResult } from '../media/export';
import { canCopyImage, canShareFiles, copyImage } from '../media/share';
import { PPM_300DPI } from '../render/compose';
import { useStudio } from '../state/studio';
import { FilmCanvas } from './FilmCanvas';
import { Seg } from './panels/common';
import { QrPanel, type QrMode } from './share/QrPanel';
import { SendNearby } from './share/SendNearby';

function ActionCard({ icon, title, sub, onClick, busy, disabled, btnRef }: { icon: ReactNode; title: string; sub: string; onClick: () => void; busy?: boolean; disabled?: boolean; btnRef?: RefObject<HTMLButtonElement | null> }) {
  return (
    <button ref={btnRef} className="btn h-auto min-h-16 w-full justify-start gap-3 px-3 py-2.5 text-left" onClick={onClick} disabled={disabled}>
      <span className="feature-icon shrink-0" aria-hidden>{busy ? <Loader2 className="animate-spin" size={20} /> : icon}</span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[0.95rem] font-semibold">{title}</span>
        <span className="text-xs font-normal text-muted">{sub}</span>
      </span>
    </button>
  );
}

export function ExportDialog() {
  const { doc, exportOpen, setExportOpen, toast } = useStudio();
  const ref = useRef<HTMLDialogElement>(null);
  const sendRef = useRef<HTMLButtonElement>(null);
  const qrHeading = useRef<HTMLHeadingElement>(null);
  const [kind, setKind] = useState<ExportKind>('share');
  const [busy, setBusy] = useState<'save' | 'share' | 'copy' | null>(null);
  const [beamOpen, setBeamOpen] = useState(false);
  const [qrMode, setQrMode] = useState<QrMode>('app');
  const [note, setNote] = useState('');
  const shareOk = useMemo(canShareFiles, []);
  const copyOk = useMemo(canCopyImage, []);
  const l = computeLayout(doc.format, doc.frames, doc.corners, doc.orientation);
  const wide = doc.orientation === 'landscape';
  const ppm = kind === 'print' ? PPM_300DPI : 1800 / Math.max(l.widthMm, l.heightMm);

  // Render once per (doc, size) and reuse it for Save / Share / Copy / Send, so the share sheet opens straight from the tap.
  const cache = useRef<{ doc: FilmDoc; kind: ExportKind; p: Promise<ExportResult> } | null>(null);
  const getOut = useCallback((k: ExportKind): Promise<ExportResult> => {
    const c = cache.current;
    if (c && c.doc === doc && c.kind === k) return c.p;
    const p = exportFilm(doc, k);
    cache.current = { doc, kind: k, p };
    p.catch(() => cache.current?.p === p && (cache.current = null));
    return p;
  }, [doc]);
  const getFile = useCallback(() => getOut(kind), [getOut, kind]);
  // the finished file, once rendered: Share needs it in hand so the share sheet opens inside the tap (Safari rule)
  const [ready, setReady] = useState<{ doc: FilmDoc; kind: ExportKind; out: ExportResult } | null>(null);
  const out = ready && ready.doc === doc && ready.kind === kind ? ready.out : null;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (exportOpen && !d.open) {
      d.showModal();
      sendRef.current?.focus();
    }
    if (!exportOpen && d.open) d.close();
    if (!exportOpen) {
      cache.current = null;
      setNote('');
      setBeamOpen(false);
    }
  }, [exportOpen]);

  useEffect(() => {
    if (!exportOpen) return;
    let live = true;
    const t = setTimeout(() => {
      getOut(kind).then((o) => live && setReady({ doc, kind, out: o }), () => {});
    }, 120);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [exportOpen, kind, getOut, doc]);

  const closeBeam = () => {
    setBeamOpen(false);
    requestAnimationFrame(() => sendRef.current?.focus());
  };

  const save = async () => {
    setBusy('save');
    try {
      await downloadBlob(out ?? (await getOut(kind)));
    } catch {
      toast("Couldn't save. Try again");
    } finally {
      setBusy(null);
    }
  };

  const share = () => {
    if (!out) return;
    setNote('');
    if (!shareOk) {
      void downloadBlob(out);
      setQrMode('app');
      setNote('This browser has no share sheet, so we saved the photo. Use Send to a phone to get it onto another phone.');
      return;
    }
    // no await before navigator.share: it must run inside the tap
    setBusy('share');
    shareBlob(out)
      .then((r) => {
        if (r === 'unsupported') {
          void downloadBlob(out);
          setNote("This file type can't be shared here, so we saved it instead.");
        } else if (r === 'failed') toast("The share sheet didn't open. Tap Share again, or Save to device");
      })
      .finally(() => setBusy(null));
  };

  const copy = async () => {
    setBusy('copy');
    try {
      await copyImage(getOut(kind).then((o) => o.blob));
      toast('Image copied');
    } catch {
      toast("Couldn't copy. Try Save to device");
    } finally {
      setBusy(null);
    }
  };

  return (
    <dialog
      ref={ref}
      onClose={() => setExportOpen(false)}
      onClick={(e) => e.target === ref.current && !beamOpen && setExportOpen(false)}
      onKeyDown={(e) => {
        // Esc in the send view goes back to the options instead of closing everything
        if (e.key === 'Escape' && beamOpen) {
          e.preventDefault();
          closeBeam();
        }
      }}
      aria-labelledby={beamOpen ? 'beam-send-title' : 'export-title'}
      className="mx-auto mb-0 mt-auto max-h-[94dvh] w-full max-w-full overflow-y-auto overscroll-contain rounded-t-2xl border border-line2 bg-surface p-0 text-text shadow-[var(--shadow)] backdrop:bg-black/70 backdrop:backdrop-blur-sm md:m-auto md:max-h-[92dvh] md:w-[min(94vw,60rem)] md:rounded-2xl"
    >
      {exportOpen && beamOpen && <SendNearby open onClose={closeBeam} getFile={getFile} />}
      <div className={`${beamOpen ? 'hidden' : 'grid'} md:h-[min(46rem,92dvh)] md:grid-cols-[1fr_23rem]`}>
        <div className="stage-bg grid h-[30dvh] place-items-center p-4 md:h-full md:p-6">
          {exportOpen && <FilmCanvas doc={doc} label="Your finished film" />}
        </div>
        <div className="flex flex-col gap-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 id="export-title" className="text-xl font-semibold">Save &amp; share</h2>
            <button className="btn btn-icon btn-ghost" onClick={() => setExportOpen(false)} aria-label="Close"><X size={20} aria-hidden /></button>
          </div>
          <div className="flex flex-col gap-1.5">
            <Seg label="Size" value={kind} onChange={setKind} options={wide
              ? [{ id: 'share', label: 'Share (JPEG)' }, { id: 'print', label: 'PNG (lossless)' }]
              : [{ id: 'share', label: 'Share', icon: <Smartphone size={16} aria-hidden /> }, { id: 'print', label: 'Print', icon: <Printer size={16} aria-hidden /> }]} />
            <p className="num text-xs text-muted" aria-live="polite">
              {Math.round(l.widthMm * ppm)} × {Math.round(l.heightMm * ppm)} px{kind === 'print' ? (wide ? ' · PNG' : ' · 300 DPI · PNG') : ' · JPEG'}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <ActionCard btnRef={sendRef} icon={<Radio size={20} />} title="Send to a phone" sub="They scan a code and get the photo. iPhone or Android, encrypted" onClick={() => setBeamOpen(true)} disabled={!!busy} />
            <ActionCard icon={<Share size={20} />} title="Share to nearby devices / apps" sub={!out ? 'Preparing your photo…' : shareOk ? 'AirDrop, Quick Share, Nearby Share and your apps' : 'No share sheet here: saves the photo instead'} onClick={share} busy={busy === 'share' || !out} disabled={!!busy || !out} />
            <div className={`grid gap-2 ${copyOk ? 'grid-cols-[1fr_auto]' : ''}`}>
              <button className="btn btn-primary btn-lg whitespace-nowrap" onClick={save} disabled={!!busy}>
                {busy === 'save' ? <Loader2 className="animate-spin" size={20} aria-hidden /> : <Download size={20} aria-hidden />} Save to device
              </button>
              {copyOk && (
                <button className="btn btn-lg whitespace-nowrap px-4" onClick={copy} disabled={!!busy} aria-label="Copy image">
                  {busy === 'copy' ? <Loader2 className="animate-spin" size={20} aria-hidden /> : <Copy size={20} aria-hidden />} Copy
                </button>
              )}
            </div>
            {note && <p role="status" className="rounded-lg bg-surface2 p-2.5 text-sm">{note}</p>}
          </div>

          <QrPanel doc={doc} mode={qrMode} onMode={setQrMode} headingRef={qrHeading} />

          <p className="mt-auto flex items-center gap-2 text-xs text-muted"><Lock size={14} aria-hidden /> Made on your device. Nothing is uploaded.</p>
        </div>
      </div>
    </dialog>
  );
}
