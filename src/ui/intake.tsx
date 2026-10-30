import { X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { emptySlots, setSlotPhoto } from '../film/doc';
import { classifyCameraSupport, type CameraReason } from '../media/capture';
import { importFile, ImportFailure, importMessage } from '../media/import';
import { useStudio } from '../state/studio';
import { CameraFallback } from './CameraFallback';
import { CameraView } from './CameraView';

interface Intake {
  /** open the file picker; `slot` targets one slot (replace), otherwise fills the empty ones */
  pick: (slot?: number | null) => void;
  /** open the camera; `slot` retakes one slot, otherwise fills the empty ones (or retakes all) */
  camera: (slot?: number | null) => void;
  /**
   * open the phone's own camera app (file input with `capture`): needs no permission and works inside
   * sandboxed iframes. One tap = one photo; `slot` targets one slot, otherwise the next empty one.
   */
  nativeCamera: (slot?: number | null) => void;
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
  const [fallback, setFallback] = useState<{ reason: CameraReason; slot: number | null } | null>(null);
  /** true while a native-camera round is in progress and slots are still empty */
  const [chain, setChain] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const nativeInput = useRef<HTMLInputElement>(null);
  const target = useRef<number | null>(null);
  const nativeTarget = useRef<number | null>(null);

  const addFiles = useCallback(
    async (files: File[], slot: number | null): Promise<number[]> => {
      if (!files.length) return [];
      const slots = slot !== null ? [slot] : emptySlots(doc);
      if (!slots.length) {
        toast('All slots are filled. Tap a photo to replace it');
        return [];
      }
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
      return placed.map(([idx]) => idx);
    },
    [doc, apply, toast],
  );

  const pick = useCallback((slot: number | null = null) => {
    target.current = slot;
    if (input.current) {
      input.current.click();
    }
  }, []);

  const nativeCamera = useCallback((slot: number | null = null) => {
    nativeTarget.current = slot;
    nativeInput.current?.click();
  }, []);

  const camera = useCallback(
    (slot: number | null = null) => {
      setFallback(null);
      // never open a camera view that cannot work: explain and offer the phone camera right away
      const blocked = classifyCameraSupport();
      if (blocked) return setFallback({ reason: blocked, slot });
      const empties = emptySlots(doc);
      setQueue(slot !== null ? [slot] : empties.length ? empties : doc.slots.map((_, i) => i));
    },
    [doc],
  );

  const onNativeFiles = useCallback(
    async (files: File[]) => {
      const slot = nativeTarget.current;
      const placed = await addFiles(files.slice(0, 1), slot);
      // a native capture is one photo per tap: offer the next one when slots remain
      setChain(slot === null && placed.length > 0);
    },
    [addFiles],
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

  const cameraSlot = queue && queue.length === 1 && doc.slots.length > 1 ? queue[0] : null;
  const onDenied = useCallback(
    (reason: CameraReason) => {
      setQueue(null);
      setFallback({ reason, slot: cameraSlot });
    },
    [cameraSlot],
  );
  const onClose = useCallback(() => setQueue(null), []);

  const remaining = emptySlots(doc).length;
  const total = doc.slots.length;

  return (
    <Ctx.Provider value={{ pick, camera, nativeCamera }}>
      {children}
      <input
        ref={input}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        className="hidden"
        aria-label="Choose photos"
        onChange={(e) => {
          void addFiles([...(e.target.files ?? [])], target.current);
          e.target.value = '';
        }}
      />
      <input
        ref={nativeInput}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        aria-label="Take a photo with your phone camera"
        onChange={(e) => {
          void onNativeFiles([...(e.target.files ?? [])]);
          e.target.value = '';
        }}
      />
      {drag && <div className="pointer-events-none fixed inset-3 z-40 grid place-items-center rounded-2xl border-2 border-dashed border-accent bg-bg/80 text-lg font-semibold" aria-hidden>Drop photos</div>}
      {queue && <CameraView queue={queue} onClose={onClose} onDenied={onDenied} />}
      {fallback && (
        <CameraFallback
          reason={fallback.reason}
          onNative={() => {
            nativeCamera(fallback.slot);
            setFallback(null);
          }}
          onUpload={() => {
            pick(fallback.slot);
            setFallback(null);
          }}
          onRetry={() => camera(fallback.slot)}
          onClose={() => setFallback(null)}
        />
      )}
      {chain && remaining > 0 && !queue && !fallback && (
        <div className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md items-center gap-2 rounded-2xl border border-line2 bg-surface p-2 pl-4 text-text shadow-[var(--shadow)]" role="status">
          <span className="min-w-0 flex-1 text-sm font-semibold">Photo {total - remaining + 1} of {total}</span>
          <button className="btn btn-primary" onClick={() => nativeCamera(null)}>Tap to take the next</button>
          <button className="btn btn-icon btn-ghost" onClick={() => setChain(false)} aria-label="Dismiss"><X size={18} aria-hidden /></button>
        </div>
      )}
    </Ctx.Provider>
  );
}
