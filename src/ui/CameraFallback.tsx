import { Camera, ShieldCheck, Upload, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { CameraReason } from '../media/capture';

interface Props {
  reason: CameraReason;
  /** open the phone's own camera app (file input with capture) */
  onNative: () => void;
  /** open the normal photo picker */
  onUpload: () => void;
  /** re-run the live camera; only offered when trying again can help */
  onRetry: () => void;
  onClose: () => void;
}

const COPY: Record<CameraReason, { title: string; body: string }> = {
  iframe: {
    title: 'Camera is blocked here',
    body: "This preview page can't open your camera. Take a photo with your phone instead, or open the app on its own page.",
  },
  denied: {
    title: 'Camera is off for this site',
    body: 'Tap the lock icon next to the address, allow Camera, then try again.',
  },
  none: {
    title: 'No camera found',
    body: "We couldn't find a camera on this device. Take a photo with your phone instead, or upload one.",
  },
  'no-api': {
    title: 'No camera found',
    body: "This browser can't open a camera on this page. Take a photo with your phone instead, or upload one.",
  },
  insecure: {
    title: 'Camera needs a secure page (https)',
    body: 'Open this app from an https link to use the live camera. You can still take a photo with your phone.',
  },
  failed: {
    title: "Camera didn't start",
    body: 'Another app might be using it. Try again, or take a photo with your phone instead.',
  },
};

const CAN_RETRY: ReadonlySet<CameraReason> = new Set(['denied', 'failed']);

/** Shown whenever the live camera cannot work: says why in plain words and always offers a button that works now. */
export function CameraFallback({ reason, onNative, onUpload, onRetry, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const { title, body } = COPY[reason];

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    primary.current?.focus();
    return () => {
      if (d?.open) d.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="camfb-title"
      aria-describedby="camfb-body"
      className="m-auto w-[min(92vw,26rem)] rounded-2xl border border-line2 bg-surface p-6 text-text shadow-[var(--shadow)] backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-full bg-surface2 text-accent" aria-hidden>
          <Camera size={22} />
        </div>
        <button className="btn btn-icon btn-ghost -mr-2 -mt-2" onClick={onClose} aria-label="Close">
          <X size={20} aria-hidden />
        </button>
      </div>
      <h2 id="camfb-title" className="mt-3 text-xl font-semibold">{title}</h2>
      <p id="camfb-body" className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
      <div className="mt-5 flex flex-col gap-2">
        <button ref={primary} className="btn btn-primary btn-lg w-full" onClick={onNative}>
          <Camera size={20} aria-hidden /> Take photo with phone camera
        </button>
        <button className="btn btn-lg w-full" onClick={onUpload}>
          <Upload size={20} aria-hidden /> Upload a photo
        </button>
        {CAN_RETRY.has(reason) && (
          <button className="btn btn-ghost w-full" onClick={onRetry}>Try again</button>
        )}
      </div>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted">
        <ShieldCheck size={14} aria-hidden /> Photos never leave your device.
      </p>
    </dialog>
  );
}
