import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { emptySlots, setSlotPhoto } from '../film/doc';
import { importFile, ImportFailure, importMessage } from '../media/import';
import { useStudio } from '../state/studio';
import { CameraView } from './CameraView';

interface Intake {
  /** open the file picker; `slot` targets one slot (replace), otherwise fills the empty ones */
  pick: (slot?: number | null) => void;
  /** open the camera; `slot` retakes one slot, otherwise fills the empty ones (or retakes all) */
  camera: (slot?: number | null) => void;
}
const Ctx = createContext<Intake | null>(null);
export const useIntake = (): Intake => {
  const v = useContext(Ctx);
  if (!v) throw new Error('IntakeProvider missing');
  return v;
};

/** Camera + upload + drag-and-drop + paste, shared by the canvas and the Photos panel. */
export function IntakeProvider({ children }: { children: ReactNode }) {
  const { doc, apply, toast } = useStudio();
  const [queue, setQueue] = useState<number[] | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const target = useRef<number | null>(null);

  const addFiles = useCallback(
    async (files: File[], slot: number | null) => {
      if (!files.length) return;
      const slots = slot !== null ? [slot] : emptySlots(doc);
      if (!slots.length) return toast('All slots are filled. Tap a photo to replace it');
      let failed: ImportFailure | null = null;
      const placed: [number, string][] = [];
      for (const [i, f] of files.slice(0, slots.length).entries()) {
        try {
          placed.push([slots[i], (await importFile(f)).id]);
        } catch (e) {
          if (e instanceof ImportFailure) failed ??= e;
        }
      }
      if (placed.length) apply((d) => placed.reduce((acc, [idx, id]) => setSlotPhoto(acc, idx, id), d));
      if (failed) toast(importMessage[failed.code]);
      else if (files.length > slots.length) toast('Extra photos skipped');
    },
    [doc, apply, toast],
  );

  const pick = useCallback((slot: number | null = null) => {
    target.current = slot;
    if (input.current) {
      input.current.multiple = slot === null;
      input.current.click();
    }
  }, []);

  const camera = useCallback(
    (slot: number | null = null) => {
      const empties = emptySlots(doc);
      setQueue(slot !== null ? [slot] : empties.length ? empties : doc.slots.map((_, i) => i));
    },
    [doc],
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length) void addFiles(files, null);
    };
    const over = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault();
        setDrag(true);
      }
    };
    const leave = (e: DragEvent) => e.relatedTarget === null && setDrag(false);
    const drop = (e: DragEvent) => {
      e.preventDefault();
      setDrag(false);
      void addFiles([...(e.dataTransfer?.files ?? [])], null);
    };
    window.addEventListener('paste', onPaste);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, [addFiles]);

  const onDenied = useCallback(
    (reason: 'denied' | 'none' | 'failed') => {
      setQueue(null);
      toast(reason === 'denied' ? 'Camera is blocked. Upload instead' : reason === 'none' ? 'No camera found. Upload instead' : "Camera didn't start. Upload instead");
    },
    [toast],
  );

  return (
    <Ctx.Provider value={{ pick, camera }}>
      {children}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        className="hidden"
        aria-label="Choose photos"
        onChange={(e) => {
          void addFiles([...(e.target.files ?? [])], target.current);
          e.target.value = '';
        }}
      />
      {drag && <div className="pointer-events-none fixed inset-3 z-40 grid place-items-center rounded-2xl border-2 border-dashed border-accent bg-bg/80 text-lg font-semibold" aria-hidden>Drop photos</div>}
      {queue && <CameraView queue={queue} onClose={() => setQueue(null)} onDenied={onDenied} />}
    </Ctx.Provider>
  );
}
