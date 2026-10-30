import { CameraOff, Loader2 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> };

/** Reads a QR code with the camera (BarcodeDetector when the browser has it, else jsQR), with a paste box as a fallback. */
export function QrScanner({ onCode, accept, pasteLabel = 'Or paste the code' }: { onCode: (text: string) => void; accept: (text: string) => boolean; pasteLabel?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [cam, setCam] = useState<'starting' | 'on' | 'off'>('starting');
  const [paste, setPaste] = useState('');
  const [bad, setBad] = useState(false);
  const cb = useRef({ onCode, accept });
  cb.current = { onCode, accept };
  const pid = useId();

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('no camera api');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        const v = video.current!;
        v.srcObject = stream;
        await v.play().catch(() => {});
        setCam('on');
      } catch {
        if (!stopped) setCam('off');
        return;
      }
      let detector: Detector | null = null;
      const BD = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
      try {
        if (BD && (!BD.getSupportedFormats || (await BD.getSupportedFormats()).includes('qr_code'))) detector = new BD({ formats: ['qr_code'] });
      } catch {
        detector = null;
      }
      const jsQR = detector ? null : (await import('jsqr')).default;
      const tick = async () => {
        if (stopped) return;
        const v = video.current;
        if (v && v.videoWidth && ctx) {
          const s = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
          canvas.width = Math.round(v.videoWidth * s);
          canvas.height = Math.round(v.videoHeight * s);
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          let text: string | null = null;
          try {
            if (detector) text = (await detector.detect(canvas))[0]?.rawValue ?? null;
            else if (jsQR) text = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
          } catch {
            text = null;
          }
          if (text && cb.current.accept(text)) {
            stopped = true;
            stream?.getTracks().forEach((t) => t.stop());
            cb.current.onCode(text);
            return;
          }
        }
        timer = setTimeout(tick, 160);
      };
      tick();
    })();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      canvas.width = 0;
    };
  }, []);

  const submit = () => {
    const t = paste.trim();
    if (cb.current.accept(t)) cb.current.onCode(t);
    else setBad(true);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative mx-auto aspect-square w-full max-w-72 overflow-hidden rounded-2xl border border-line2 bg-black">
        <video ref={video} muted playsInline aria-label="Camera view for scanning the reply code" className={`size-full object-cover ${cam === 'on' ? '' : 'hidden'}`} />
        {cam === 'on' && <div aria-hidden className="pointer-events-none absolute inset-[14%] rounded-xl border-2 border-white/85 shadow-[0_0_0_999px_rgba(0,0,0,0.35)]" />}
        {cam !== 'on' && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/80">
            {cam === 'starting' ? <Loader2 className="animate-spin" size={28} aria-label="Starting the camera" /> : (
              <span className="flex flex-col items-center gap-2"><CameraOff size={28} aria-hidden />No camera here. Paste the code instead.</span>
            )}
          </div>
        )}
      </div>
      <form className="flex gap-2" onSubmit={(e) => (e.preventDefault(), submit())}>
        <label htmlFor={pid} className="sr-only-text">{pasteLabel}</label>
        <input id={pid} type="text" value={paste} onChange={(e) => (setPaste(e.target.value), setBad(false))} placeholder={pasteLabel} autoComplete="off" spellCheck={false} className="num min-w-0 flex-1 text-sm" aria-invalid={bad} aria-describedby={bad ? `${pid}-err` : undefined} />
        <button className="btn" type="submit" disabled={!paste.trim()}>Use</button>
      </form>
      {bad && <p id={`${pid}-err`} role="alert" className="text-sm text-danger">That isn't a PortableBooth reply code.</p>}
    </div>
  );
}
