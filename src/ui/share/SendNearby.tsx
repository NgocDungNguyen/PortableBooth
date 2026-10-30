import { ArrowLeft, Check, Copy, Link2, Loader2, Lock } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { startSender, type BeamPhase, type BeamSender } from '../../media/beam';
import type { ExportResult } from '../../media/export';
import { ProgressRing } from './ProgressRing';
import { QrCode } from './QrCode';

type Step = 'prep' | BeamPhase;

function failMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : '';
  if (m === 'no-relay') return "Couldn't reach PortableBooth's send service. Check your internet connection and try again.";
  if (m === 'too-big') return 'This photo is too large to send. Use Save or Share instead.';
  return m || 'Something went wrong. Try again.';
}

/**
 * Sender flow: QR link -> the other phone scans it with its camera -> encrypted photo goes across with progress.
 * Rendered as a view inside the export dialog (no nested modal), so Esc / Back return to the export options.
 */
export function SendNearby({ open, onClose, getFile }: { open: boolean; onClose: () => void; getFile: () => Promise<ExportResult> }) {
  const [step, setStep] = useState<Step>('prep');
  const [link, setLink] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const sender = useRef<BeamSender | null>(null);
  const run = useRef(0);
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
    setCopied(false);
    try {
      if (typeof WebSocket === 'undefined' || !crypto?.subtle) throw new Error("This browser can't send directly. Use Share or Save instead.");
      const out = await getFile();
      const s = await startSender({ name: out.filename, mime: out.mime, blob: out.blob }, {
        phase: (p, msg) => {
          if (me !== run.current) return;
          if (msg) setError(msg);
          setStep(p);
        },
        progress: (f) => me === run.current && setProgress(f),
      });
      if (me !== run.current) return s.close();
      sender.current = s;
      setLink(s.link);
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
    if (open) title.current?.focus();
  }, [open]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const shareLink = () => {
    // called straight from the tap so the share sheet is allowed
    navigator.share?.({ title: 'A photo from PortableBooth', url: link }).catch(() => {});
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-2">
        <button className="btn btn-icon btn-ghost -ml-2" onClick={onClose} aria-label="Back to save and share"><ArrowLeft size={20} aria-hidden /></button>
        <h2 id="beam-send-title" ref={title} tabIndex={-1} className="text-xl font-semibold outline-none">Send to a phone</h2>
      </div>
      <div aria-live="polite" className="flex flex-col gap-4">
        {step === 'prep' && (
          <p className="flex items-center justify-center gap-2 py-16 text-muted"><Loader2 className="animate-spin" size={20} aria-hidden /> Getting ready…</p>
        )}

        {step === 'waiting' && link && (
          <>
            <p className="text-sm">Ask your friend to <b>scan this with their phone camera</b>. The photo lands on their screen, iPhone or Android.</p>
            <QrCode text={link} label="Code for the other phone to scan" className="mx-auto w-full max-w-[17rem] border border-line2 p-1" />
            <p className="flex items-center justify-center gap-2 text-sm text-muted"><Loader2 className="animate-spin" size={16} aria-hidden /> Waiting for the other phone…</p>
            <div className={`grid gap-2 ${typeof navigator.share === 'function' ? 'grid-cols-2' : ''}`}>
              <button className="btn" onClick={copyLink}>{copied ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />} {copied ? 'Link copied' : 'Copy link'}</button>
              {typeof navigator.share === 'function' && <button className="btn" onClick={shareLink}><Link2 size={18} aria-hidden /> Send link</button>}
            </div>
            <p className="text-xs text-muted">Far away? Send the link in any chat. It works once, for 15 minutes.</p>
          </>
        )}

        {(step === 'connecting' || step === 'transferring' || step === 'done') && (
          <div className="flex flex-col items-center gap-3 py-6">
            <ProgressRing value={progress} done={step === 'done'} label="Sending" />
            <p className="font-semibold">{step === 'done' ? 'Sent!' : 'Sending…'}</p>
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
      {step === 'waiting' && (
        <p className="flex items-start gap-2 text-xs text-muted"><Lock size={14} className="mt-0.5 shrink-0" aria-hidden /> End-to-end encrypted. The key is only in this code, so nobody else, not even our server, can see the photo. Nothing is stored.</p>
      )}
    </div>
  );
}
