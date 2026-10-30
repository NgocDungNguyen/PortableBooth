import { motion } from 'motion/react';
import { Camera, ImagePlus, RefreshCw, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { emptySlots, setSlotPhoto } from '../film/doc';
import { computeLayout } from '../film/layout';
import { importFile, ImportFailure, importMessage } from '../media/import';
import { useStudio } from '../state/studio';
import { CameraView } from './CameraView';
import { FilmCanvas } from './FilmCanvas';

export function StepPhotos() {
  const { doc, apply, targetSlot, setTargetSlot, toast } = useStudio();
  const [camera, setCamera] = useState(false);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const layout = computeLayout(doc.format, doc.frames, doc.corners);
  const empties = emptySlots(doc);
  const queue = targetSlot !== null ? [targetSlot] : empties.length ? empties : doc.slots.map((_, i) => i);

  const addFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      const slots = targetSlot !== null ? [targetSlot] : emptySlots(doc);
      if (!slots.length) return toast('Tap a photo to replace it');
      const take = files.slice(0, slots.length);
      let failed: ImportFailure | null = null;
      const placed: [number, string][] = [];
      for (let i = 0; i < take.length; i++) {
        try {
          placed.push([slots[i], (await importFile(take[i])).id]);
        } catch (e) {
          if (e instanceof ImportFailure) failed ??= e;
        }
      }
      if (placed.length) apply((d) => placed.reduce((acc, [idx, id]) => setSlotPhoto(acc, idx, id), d));
      setTargetSlot(null);
      if (failed) toast(importMessage[failed.code]);
      else if (files.length > slots.length) toast('Extra photos skipped');
    },
    [doc, targetSlot, apply, setTargetSlot, toast],
  );

  // paste images straight in
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length) void addFiles(files);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [addFiles]);

  const onDenied = useCallback(
    (reason: 'denied' | 'none' | 'failed') => {
      setCamera(false);
      toast(reason === 'denied' ? 'Camera is blocked. Upload instead' : reason === 'none' ? 'No camera found. Upload instead' : "Camera didn't start. Upload instead");
    },
    [toast],
  );
  const closeCamera = useCallback(() => {
    setCamera(false);
    setTargetSlot(null);
  }, [setTargetSlot]);

  return (
    <div
      className="grid flex-1 grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,1fr)_22rem] md:items-center md:gap-5"
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        void addFiles([...e.dataTransfer.files]);
      }}
    >
      <div className="relative min-h-[36dvh] min-w-0 md:min-h-[60dvh]">
        <FilmCanvas doc={doc} showEmpty label={`Your film with ${doc.slots.length} photo slots`}>
          {(pxPerMm) =>
            layout.slots.map((s, i) => {
              const filled = !!doc.slots[i].photoId;
              const sel = targetSlot === i;
              return (
                <button
                  key={i}
                  onClick={() => setTargetSlot(sel ? null : i)}
                  aria-pressed={sel}
                  aria-label={filled ? `Photo ${i + 1}. Choose to retake or replace` : `Empty slot ${i + 1}. Choose to fill`}
                  className={`absolute grid place-items-center overflow-hidden border-[3px] transition-all ${sel ? 'border-lemon bg-lemon/25' : 'border-transparent hover:border-white/80'}`}
                  style={{ left: s.x * pxPerMm, top: s.y * pxPerMm, width: s.w * pxPerMm, height: s.h * pxPerMm, borderRadius: layout.slotRadius * pxPerMm }}
                >
                  {(sel || !filled) && (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="grid size-10 place-items-center rounded-full border-2 border-line bg-lemon text-ink shadow-[0_2px_0_var(--shadow)]">
                      {filled ? <RefreshCw size={20} aria-hidden /> : <ImagePlus size={20} aria-hidden />}
                    </motion.span>
                  )}
                </button>
              );
            })
          }
        </FilmCanvas>
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-1 md:gap-4">
        <motion.button
          whileTap={{ scale: 0.96 }}
          whileHover={{ y: -3 }}
          onClick={() => setCamera(true)}
          className="btn btn-lg btn-primary h-24 w-full flex-col gap-1 text-2xl md:h-28"
        >
          <Camera size={34} aria-hidden /> Camera
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.96 }}
          whileHover={{ y: -3 }}
          onClick={() => input.current?.click()}
          className="btn btn-lg h-24 w-full flex-col gap-1 text-2xl md:h-28"
        >
          <Upload size={34} aria-hidden /> Upload
        </motion.button>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          multiple={targetSlot === null}
          className="hidden"
          aria-label="Choose photos"
          onChange={(e) => {
            void addFiles([...(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />
      </div>

      {drag && (
        <div className="pointer-events-none fixed inset-3 z-40 grid place-items-center rounded-[2rem] border-4 border-dashed border-line bg-lemon/80 text-ink" aria-hidden>
          <Upload size={72} />
        </div>
      )}
      {camera && <CameraView queue={queue} onClose={closeCamera} onDenied={onDenied} />}
    </div>
  );
}
