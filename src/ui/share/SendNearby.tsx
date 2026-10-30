import { ArrowLeft, Loader2, Lock, ScanLine, Wifi } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { NETWORK_HINT, beamToHash, decodeBeam, startSender, type BeamPhase, type BeamSender } from '../../media/beam';
import type { ExportResult } from '../../media/export';
import { appUrl } from '../../media/share';
import { ProgressRing } from './ProgressRing';
import { QrCode } from './QrCode';
import { QrScanner } from './QrScanner';

type Step = 'prep' | 'offer' | 'scan' | BeamPhase;

function failMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : '';
  if (m === 'no-network') return 'No network found. Connect to Wi-Fi or a hotspot and try again.';
  if (m === 'unsupported') return "This browser can't send directly. Use Share or Save instead.";
  if (m === 'bad-code') return "That reply code didn't work. Scan it again.";
  return `Couldn't reach the other device. ${NETWORK_HINT}`;
}

/**
 * Sender flow: offer QR -> scan the reply QR -> direct WebRTC link on the local network -> chunked transfer with progress.
 * Rendered as a view inside the export dialog (no nested modal), so Esc / Back return to the export options.
 */
export function SendNearby({ open, onClose, getFile }: { open: boolean; onClose: () => void; getFile: () => Promise<ExportResult> }) {
  const [step, setStep] = useState<Step>('prep');
  const [code, setCode] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const sender = useRef<BeamSender | null>(null);
  const run = useRef(0);
  const scanBtn = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLHeadingElement>(null);

  const stop = () => {
    run.current++;
    sender.current?.close();
    sender.current = null;
  };

  const start = useCallback(async () => {
    stop();
    const me = run.current;
    setStep('prep');
    setProgress(0);
    setError('');
    try {
      if (typeof RTCPeerConnection === 'undefined') throw new Error('unsupported');
      const out = await getFile();
      const s = await startSender({ name: out.filename, mime: out.mime, blob: out.blob }, {
        phase: (p) => me === run.current && setStep(p),
        progress: (f) => me === run.current && setProgress(f),
      });
      if (me !== run.current) return s.close();
      sender.current = s;
      setCode(s.offerCode);
      setStep('offer');
    } catch (e) {
      if (me !== run.current) return;
      setError(failMessage(e));
      setStep('failed');
    }
  }, [getFile]);

  useEffect(() => {
    if (open) start();
    else stop();
    return stop;
  }, [open, start]);

  useEffect(() => {
    if (step === 'offer') scanBtn.current?.focus();
    else if (open) title.current?.focus();
  }, [step, open]);

  const onReply = async (reply: string) => {
    const s = sender.current;
    if (!s) return;
    const me = run.current;
    setStep('connecting');
    try {
      await s.accept(reply);
    } catch (e) {
      if (me !== run.current) return;
      setError(failMessage(e));
      setStep('failed');
    }
  };

  const link = appUrl() + beamToHash(code);
  const busy = step === 'connecting' || step === 'transferring';

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-2">
        <button className="btn btn-icon btn-ghost -ml-2" onClick={onClose} aria-label="Back to save and share"><ArrowLeft size={20} aria-hidden /></button>
        <h2 id="beam-send-title" ref={title} tabIndex={-1} className="text-xl font-semibold outline-none">Send to a nearby phone</h2>
      </div>
      <div aria-live="polite" className="flex flex-col gap-4">
        {step === 'prep' && (
          <p className="flex items-center justify-center gap-2 py-16 text-muted"><Loader2 className="animate-spin" size={20} aria-hidden /> Getting ready…</p>
        )}

        {step === 'offer' && (
          <>
            <ol className="flex flex-col gap-1.5 text-sm">
              <li><b>1.</b> On the other phone, open the camera and scan this code.</li>
              <li><b>2.</b> It shows a reply code. Tap <b>Scan reply</b> and point this phone at it.</li>
            </ol>
            <QrCode text={link} label="Code for the other phone to scan" className="mx-auto w-full max-w-[18rem] border border-line2 p-1" />
            <button ref={scanBtn} className="btn btn-primary btn-lg" onClick={() => setStep('scan')}><ScanLine size={20} aria-hidden /> Scan reply</button>
          </>
        )}

        {step === 'scan' && (
          <>
            <p className="text-sm">Point the camera at the code on the other phone.</p>
            <QrScanner accept={(t) => !!decodeBeam(t, 'a')} onCode={onReply} pasteLabel="Or paste the reply code" />
            <button className="btn" onClick={() => setStep('offer')}>Back to my code</button>
          </>
        )}

        {(busy || step === 'done') && (
          <div className="flex flex-col items-center gap-3 py-6">
            {step === 'connecting' ? (
              <div className="grid size-36 place-items-center"><Loader2 className="animate-spin text-accent" size={40} aria-hidden /></div>
            ) : (
              <ProgressRing value={progress} done={step === 'done'} label="Sending" />
            )}
            <p className="font-semibold">{step === 'connecting' ? 'Connecting…' : step === 'transferring' ? 'Sending…' : 'Sent!'}</p>
            {step === 'done' && <button className="btn btn-primary btn-lg w-full" onClick={onClose}>Done</button>}
          </div>
        )}

        {step === 'failed' && (
          <div className="flex flex-col gap-3 py-2">
            <p role="alert" className="text-sm">{error}</p>
            <button className="btn btn-primary btn-lg" onClick={start}>Try again</button>
          </div>
        )}
      </div>
      {(step === 'offer' || step === 'scan') && (
        <div className="flex flex-col gap-1.5 text-xs text-muted">
          <p className="flex items-center gap-2"><Wifi size={14} aria-hidden /> {NETWORK_HINT}</p>
          <p className="flex items-center gap-2"><Lock size={14} aria-hidden /> Goes straight to the other device. Nothing is uploaded.</p>
        </div>
      )}
    </div>
  );
}
