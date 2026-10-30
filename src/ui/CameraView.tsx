import { SwitchCamera, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { setSlotPhoto } from '../film/doc';
import { computeLayout, slotAspect } from '../film/layout';
import { CameraFailure, captureFrame, startCamera, stopCamera, type Facing } from '../media/capture';
import { useStudio } from '../state/studio';

interface Props {
  /** slots to fill, in order */
  queue: number[];
  onClose: () => void;
  onDenied: (reason: 'denied' | 'none' | 'failed') => void;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function CameraView({ queue, onClose, onDenied }: Props) {
  const { doc, apply, toast } = useStudio();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const run = useRef(0);
  const [facing, setFacing] = useState<Facing>('user');
  const [ready, setReady] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [flash, setFlash] = useState(0);
  const [running, setRunning] = useState(false);
  const [doneIdx, setDoneIdx] = useState<number[]>([]);
  const layout = computeLayout(doc.format, doc.frames, doc.corners);
  const aspect = slotAspect(layout.slots[queue[0] ?? 0]);
  const mirror = facing === 'user';

  // open / re-open the camera
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    startCamera(facing)
      .then((s) => {
        if (cancelled) return stopCamera(s);
        stream.current = s;
        const v = video.current;
        if (v) {
          v.srcObject = s;
          v.play().catch(() => undefined);
        }
      })
      .catch((e) => {
        if (!cancelled) onDenied(e instanceof CameraFailure ? e.code : 'failed');
      });
    return () => {
      cancelled = true;
      stopCamera(stream.current);
      stream.current = null;
    };
  }, [facing, onDenied]);

  // leaving cancels any running sequence
  useEffect(() => () => void (run.current += 1), []);

  const sequence = useCallback(async () => {
    const token = ++run.current;
    setRunning(true);
    setDoneIdx([]);
    for (const idx of queue) {
      for (let n = 3; n >= 1; n--) {
        if (token !== run.current) return;
        setCount(n);
        await wait(1000);
      }
      if (token !== run.current) return;
      setCount(null);
      const v = video.current;
      if (!v || !v.videoWidth) break;
      const target = slotAspect(layout.slots[idx]);
      const photo = captureFrame(v, target, mirror);
      apply((d) => setSlotPhoto(d, idx, photo.id));
      setFlash((f) => f + 1);
      setDoneIdx((x) => [...x, idx]);
      await wait(800);
    }
    if (token === run.current) {
      setRunning(false);
      onClose();
      toast('Nice! ✓');
    }
  }, [queue, layout.slots, mirror, apply, onClose, toast]);

  const stop = () => {
    run.current += 1;
    setRunning(false);
    setCount(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const total = queue.length;

  return (
    <div role="dialog" aria-modal="true" aria-label="Camera" className="fixed inset-0 z-40 flex flex-col bg-black text-white">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <video
          ref={video}
          playsInline
          muted
          onLoadedData={() => setReady(true)}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ transform: mirror ? 'scaleX(-1)' : undefined }}
          aria-label="Camera preview"
        />
        {/* crop guide: exactly what ends up in the film */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div
            className="rounded-2xl border-[3px] border-lemon"
            style={{ aspectRatio: aspect, width: `min(88%, calc((100dvh - 14rem) * ${aspect}))`, boxShadow: '0 0 0 100vmax rgba(0,0,0,0.55)' }}
          />
        </div>
        {!ready && <div className="absolute inset-0 grid place-items-center" role="status"><div className="size-12 animate-spin rounded-full border-4 border-white/30 border-t-lemon" aria-label="Starting camera" /></div>}
        {count !== null && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span key={count} className="count-pop font-display text-[min(46vw,18rem)] font-extrabold leading-none text-white drop-shadow-[0_6px_0_rgba(23,22,58,.9)]" aria-hidden>
              {count}
            </span>
          </div>
        )}
        {flash > 0 && <div key={flash} className="flash pointer-events-none absolute inset-0 bg-white" aria-hidden />}
        <div className="sr-only-text" role="status" aria-live="assertive">{count ?? ''}</div>

        <button onClick={onClose} className="btn btn-icon absolute left-4 top-[max(1rem,env(safe-area-inset-top))]" aria-label="Close camera">
          <X size={26} aria-hidden />
        </button>
        <button onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))} className="btn btn-icon absolute right-4 top-[max(1rem,env(safe-area-inset-top))]" aria-label="Flip camera" disabled={running}>
          <SwitchCamera size={26} aria-hidden />
        </button>
      </div>

      <div className="flex flex-col items-center gap-4 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        <div className="flex gap-2" role="img" aria-label={`${doneIdx.length} of ${total} photos taken`}>
          {queue.map((q, i) => (
            <span key={q} className={`size-3.5 rounded-full border-2 border-white transition-colors ${doneIdx.includes(q) ? 'bg-lemon' : i === doneIdx.length && running ? 'animate-pulse bg-white' : 'bg-transparent'}`} />
          ))}
        </div>
        <button
          onClick={running ? stop : sequence}
          disabled={!ready}
          aria-label={running ? 'Stop' : total > 1 ? 'Start photo sequence' : 'Take photo'}
          className="grid size-[5.5rem] place-items-center rounded-full border-[5px] border-white bg-transparent transition-transform active:scale-90 disabled:opacity-40"
        >
          {running ? <span className="size-8 rounded-md bg-pop" /> : <span className="size-[4.2rem] rounded-full bg-lemon" />}
        </button>
      </div>
    </div>
  );
}

