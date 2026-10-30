import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Download, Loader2, Lock, Plus, Printer, Share2, Smartphone, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { STICKERS, stickerDataUrl } from '../assets/stickers';
import { computeLayout } from '../film/layout';
import { downloadBlob, exportFilm, shareBlob, type ExportKind } from '../media/export';
import { PPM_300DPI } from '../render/compose';
import { useStudio } from '../state/studio';
import { FilmCanvas } from './FilmCanvas';

const BURST = ['star', 'heart', 'sparkle', 'smile', 'bolt', 'flower'];

export function StepExport() {
  const { doc, setStep, clearAll, toast } = useStudio();
  const reduce = useReducedMotion();
  const [kind, setKind] = useState<ExportKind>('share');
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);
  const [burst, setBurst] = useState(0);
  const l = computeLayout(doc.format, doc.frames, doc.corners);
  const ppm = kind === 'print' ? PPM_300DPI : 1800 / Math.max(l.widthMm, l.heightMm);
  const dims = `${Math.round(l.widthMm * ppm)} × ${Math.round(l.heightMm * ppm)}`;

  const run = async (mode: 'save' | 'share') => {
    setBusy(mode);
    try {
      const out = await exportFilm(doc, kind);
      if (mode === 'share') {
        const r = await shareBlob(out);
        if (r === 'unsupported') {
          downloadBlob(out);
          toast('Saved to your device');
        }
        if (r !== 'cancelled') setBurst((b) => b + 1);
      } else {
        downloadBlob(out);
        setBurst((b) => b + 1);
      }
    } catch {
      toast("Couldn't save. Try again");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid flex-1 grid-cols-[minmax(0,1fr)] items-center gap-5 md:grid-cols-[minmax(0,1fr)_22rem] md:gap-6">
      <div className="relative h-[44dvh] min-w-0 md:h-[64dvh]">
        <motion.div
          className="h-full"
          initial={reduce ? false : { y: -80, opacity: 0, rotate: -3 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 90, damping: 14 }}
        >
          <FilmCanvas doc={doc} label="Your finished film" />
        </motion.div>
        <AnimatePresence>
          {!reduce &&
            burst > 0 &&
            BURST.map((id, i) => {
              const a = (i / BURST.length) * Math.PI * 2;
              return (
                <motion.img
                  key={`${burst}-${id}`}
                  src={stickerDataUrl(STICKERS.find((s) => s.id === id)!)}
                  alt=""
                  aria-hidden
                  className="pointer-events-none absolute left-1/2 top-1/2 size-14"
                  initial={{ x: -28, y: -28, scale: 0, opacity: 1 }}
                  animate={{ x: Math.cos(a) * 170 - 28, y: Math.sin(a) * 170 - 28, scale: 1.1, opacity: 0, rotate: 200 }}
                  transition={{ duration: 1.1, ease: 'easeOut' }}
                />
              );
            })}
        </AnimatePresence>
      </div>

      <div className="flex flex-col gap-4">
        <div role="radiogroup" aria-label="Size" className="grid grid-cols-2 gap-2 rounded-[1.4rem] border-[2.5px] border-line bg-surface p-1.5">
          {(
            [
              { k: 'share', label: 'Share', Icon: Smartphone },
              { k: 'print', label: 'Print', Icon: Printer },
            ] as const
          ).map(({ k, label, Icon }) => (
            <button
              key={k}
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={`flex min-h-14 items-center justify-center gap-2 rounded-2xl font-display text-lg font-extrabold transition-colors ${kind === k ? 'bg-lemon text-ink shadow-[0_3px_0_var(--shadow)]' : ''}`}
            >
              <Icon size={24} aria-hidden /> {label}
            </button>
          ))}
        </div>
        <p className="text-center text-sm font-bold tabular-nums text-muted" aria-live="polite">
          {dims} px{kind === 'print' ? ' · 300 DPI' : ''}
        </p>

        <button className="btn btn-primary btn-lg w-full" onClick={() => run('save')} disabled={!!busy}>
          {busy === 'save' ? <Loader2 className="animate-spin" size={26} aria-hidden /> : <Download size={26} aria-hidden />} Save
        </button>
        <button className="btn btn-lg w-full" onClick={() => run('share')} disabled={!!busy}>
          {busy === 'share' ? <Loader2 className="animate-spin" size={26} aria-hidden /> : <Share2 size={26} aria-hidden />} Share
        </button>
        <div className="mt-2 flex gap-3">
          <button className="btn flex-1" onClick={() => setStep(2)}>
            <Wand2 size={22} aria-hidden /> Edit
          </button>
          <button className="btn flex-1" onClick={clearAll}>
            <Plus size={22} aria-hidden /> New
          </button>
        </div>
        <p className="flex items-center justify-center gap-2 text-sm font-semibold text-muted">
          <Lock size={16} aria-hidden /> Nothing was uploaded
        </p>
      </div>
    </div>
  );
}
