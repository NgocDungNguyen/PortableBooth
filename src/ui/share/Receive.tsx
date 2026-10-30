import { Copy, Download, Loader2, Lock, Share, Wifi } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NETWORK_HINT, parseBeamHash, startReceiver, type BeamFile, type BeamPhase } from '../../media/beam';
import { downloadBlob, shareBlob, type ExportResult } from '../../media/export';
import { appUrl, canShareFiles } from '../../media/share';
import { ProgressRing } from './ProgressRing';
import { QrCode } from './QrCode';
import { Sheet } from './Sheet';

type Step = 'prep' | 'invalid' | BeamPhase;

const asResult = (f: BeamFile): ExportResult => ({ blob: f.blob, filename: f.name, mime: f.mime, width: 0, height: 0 });

/**
 * Receiver flow, opened from a `#beam=<offer>` link (the sender's QR code).
 * Shows the reply QR, then receives the photo over the direct local link and offers Save / Share.
 * Mount it when `parseBeamHash(location.hash)` is not null; `onClose` should clear the hash.
 */
export function Receive({ hash, onClose }: { hash: string; onClose: () => void }) {
  const offer = useMemo(() => parseBeamHash(hash), [hash]);
  const [step, setStep] = useState<Step>(offer ? 'prep' : 'invalid');
  const [code, setCode] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [file, setFile] = useState<BeamFile | null>(null);
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const run = useRef(0);
  const closeLink = useRef<() => void>(() => {});
  const saveBtn = useRef<HTMLButtonElement>(null);
  const canShare = useMemo(canShareFiles, []);

  const start = useCallback(async () => {
    if (!offer) return;
    closeLink.current();
    const me = ++run.current;
    setStep('prep');
    setProgress(0);
    setError('');
    setCode('');
    try {
      if (typeof RTCPeerConnection === 'undefined') throw new Error("This browser can't receive directly. Ask for the photo with Share instead.");
      const r = await startReceiver(offer, {
        phase: (p, msg) => {
          if (me !== run.current) return;
          setStep(p);
          if (msg) setError(msg);
        },
        progress: (f) => me === run.current && setProgress(f),
      });
      if (me !== run.current) return r.close();
      closeLink.current = r.close;
      setCode(r.answerCode);
      r.file.then((f) => me === run.current && setFile(f), () => {});
    } catch (e) {
      if (me !== run.current) return;
      setError(e instanceof Error && e.message !== 'no-network' ? e.message : 'No network found. Connect to Wi-Fi or a hotspot and try again.');
      setStep('failed');
    }
  }, [offer]);

  useEffect(() => {
    start();
    return () => {
      run.current++;
      closeLink.current();
    };
  }, [start]);

  useEffect(() => {
    if (!file) return;
    const u = URL.createObjectURL(file.blob);
    setUrl(u);
    requestAnimationFrame(() => saveBtn.current?.focus());
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setNote('Code copied. Paste it on the other device.');
    } catch {
      setNote("Couldn't copy. Scan the code instead.");
    }
  };
  const save = async () => {
    if (!file) return;
    await downloadBlob(asResult(file));
    setNote('Saved to your device');
  };
  const share = async () => {
    if (!file) return;
    const r = await shareBlob(asResult(file));
    if (r === 'unsupported' || r === 'failed') await save();
  };

  const busy = step === 'connecting' || step === 'transferring';
  const done = step === 'done' && file && url;

  return (
    <Sheet open onClose={onClose} title={done ? 'You got a photo' : 'Receive a photo'} titleId="beam-receive-title" wide>
      <div aria-live="polite" className="flex flex-col gap-4">
        {step === 'prep' && <p className="flex items-center justify-center gap-2 py-16 text-muted"><Loader2 className="animate-spin" size={20} aria-hidden /> Getting ready…</p>}

        {step === 'invalid' && (
          <>
            <p role="alert" className="text-sm">This link isn't a working code. Ask the sender to show a new one.</p>
            <button className="btn btn-primary btn-lg" onClick={onClose}>Open PortableBooth</button>
          </>
        )}

        {step === 'waiting' && code && (
          <>
            <p className="text-sm">On the sending phone, tap <b>Scan reply</b> and point it at this code.</p>
            <QrCode text={code} label="Reply code for the sending phone to scan" className="mx-auto w-full max-w-[18rem] border border-line2 p-1" />
            <button className="btn" onClick={copyCode}><Copy size={18} aria-hidden /> Copy code instead</button>
          </>
        )}

        {busy && (
          <div className="flex flex-col items-center gap-3 py-6">
            {step === 'connecting' ? <div className="grid size-36 place-items-center"><Loader2 className="animate-spin text-accent" size={40} aria-hidden /></div> : <ProgressRing value={progress} label="Receiving" />}
            <p className="font-semibold">{step === 'connecting' ? 'Connecting…' : 'Receiving…'}</p>
          </div>
        )}

        {done && (
          <>
            <div className="stage-bg grid max-h-[46dvh] place-items-center overflow-hidden rounded-xl p-3">
              <img src={url} alt="The photo you received" className="fade-up max-h-[42dvh] w-auto max-w-full rounded-md object-contain shadow-[var(--shadow)]" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button ref={saveBtn} className={`btn btn-primary btn-lg ${canShare ? '' : 'col-span-2'}`} onClick={save}><Download size={20} aria-hidden /> Save</button>
              {canShare && <button className="btn btn-lg" onClick={share}><Share size={20} aria-hidden /> Share</button>}
            </div>
            <button className="btn btn-ghost" onClick={onClose}>Make your own</button>
          </>
        )}

        {step === 'failed' && (
          <>
            <p role="alert" className="text-sm">{error}</p>
            <button className="btn btn-primary btn-lg" onClick={start}>Make a new code</button>
          </>
        )}

        {note && <p className="text-center text-sm text-muted" role="status">{note}</p>}
      </div>
      {(step === 'waiting' || step === 'prep') && (
        <div className="flex flex-col gap-1.5 text-xs text-muted">
          <p className="flex items-center gap-2"><Wifi size={14} aria-hidden /> {NETWORK_HINT}</p>
          <p className="flex items-center gap-2"><Lock size={14} aria-hidden /> Comes straight from the other device. Nothing is uploaded.</p>
        </div>
      )}
    </Sheet>
  );
}

/** Drop-in for App: shows <Receive> while the address is a `#beam=` link, and clears the hash when closed. */
export function ReceiveFromHash() {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  if (!/^#beam=/.test(hash)) return null;
  const close = () => {
    history.replaceState(null, '', appUrl());
    setHash('');
  };
  return <Receive key={hash} hash={hash} onClose={close} />;
}
