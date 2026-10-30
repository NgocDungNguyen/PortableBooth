import { Download, Loader2, Lock, Share } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseBeamHash, startReceiver, type BeamFile, type BeamPhase } from '../../media/beam';
import { downloadBlob, shareBlob, type ExportResult } from '../../media/export';
import { appUrl, canShareFiles } from '../../media/share';
import { ProgressRing } from './ProgressRing';
import { Sheet } from './Sheet';

type Step = 'invalid' | BeamPhase;

const asResult = (f: BeamFile): ExportResult => ({ blob: f.blob, filename: f.name, mime: f.mime, width: 0, height: 0 });

/**
 * Receiver flow, opened from a `#beam=<room>.<key>` link (the sender's QR code, scanned with the phone camera).
 * Connects to the sender through the relay, decrypts the photo and offers Save / Share.
 */
export function Receive({ hash, onClose }: { hash: string; onClose: () => void }) {
  const offer = useMemo(() => parseBeamHash(hash), [hash]);
  const [step, setStep] = useState<Step>(offer ? 'connecting' : 'invalid');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [file, setFile] = useState<BeamFile | null>(null);
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const run = useRef(0);
  const closeLink = useRef<() => void>(() => {});
  const saveBtn = useRef<HTMLButtonElement>(null);
  const canShare = useMemo(canShareFiles, []);

  const start = useCallback(() => {
    if (!offer) return;
    closeLink.current();
    const me = ++run.current;
    setProgress(0);
    setError('');
    if (typeof WebSocket === 'undefined' || !crypto?.subtle) {
      setError("This browser can't receive photos. Ask them to use Share instead.");
      setStep('failed');
      return;
    }
    const r = startReceiver(offer, {
      phase: (p, msg) => {
        if (me !== run.current) return;
        if (msg) setError(msg);
        setStep(p);
      },
      progress: (f) => me === run.current && setProgress(f),
    });
    closeLink.current = r.close;
    r.file.then((f) => me === run.current && setFile(f), () => {});
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

  const save = async () => {
    if (!file) return;
    await downloadBlob(asResult(file));
    setNote('Saved to your device');
  };
  // straight from the tap (the photo is already here), so the share sheet is allowed; on iPhone "Save Image" puts it in Photos
  const share = async () => {
    if (!file) return;
    const r = await shareBlob(asResult(file));
    if (r === 'unsupported' || r === 'failed') await save();
  };

  const busy = step === 'connecting' || step === 'transferring' || step === 'waiting';
  const done = step === 'done' && file && url;

  return (
    <Sheet open onClose={onClose} title={done ? 'You got a photo' : 'Receiving a photo'} titleId="beam-receive-title" wide>
      <div aria-live="polite" className="flex flex-col gap-4">
        {step === 'invalid' && (
          <>
            <p role="alert" className="text-sm">This link isn't a working code. Ask the sender to show a new one.</p>
            <button className="btn btn-primary btn-lg" onClick={onClose}>Open PortableBooth</button>
          </>
        )}

        {busy && (
          <div className="flex flex-col items-center gap-3 py-6">
            {step === 'transferring' ? <ProgressRing value={progress} label="Receiving" /> : <div className="grid size-36 place-items-center"><Loader2 className="animate-spin text-accent" size={40} aria-hidden /></div>}
            <p className="font-semibold">{step === 'transferring' ? 'Receiving…' : 'Connecting…'}</p>
          </div>
        )}

        {done && (
          <>
            <div className="stage-bg grid max-h-[46dvh] place-items-center overflow-hidden rounded-xl p-3">
              <img src={url} alt="The photo you received" className="fade-up max-h-[42dvh] w-auto max-w-full rounded-md object-contain shadow-[var(--shadow)]" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {canShare && <button className="btn btn-primary btn-lg" onClick={share}><Share size={20} aria-hidden /> Save to Photos</button>}
              <button ref={saveBtn} className={`btn btn-lg ${canShare ? '' : 'btn-primary col-span-2'}`} onClick={save}><Download size={20} aria-hidden /> Download</button>
            </div>
            <button className="btn btn-ghost" onClick={onClose}>Make your own</button>
          </>
        )}

        {step === 'failed' && (
          <>
            <p role="alert" className="text-sm">{error}</p>
            <button className="btn btn-primary btn-lg" onClick={start}>Try again</button>
            <button className="btn btn-ghost" onClick={onClose}>Open PortableBooth</button>
          </>
        )}

        {note && <p className="text-center text-sm text-muted" role="status">{note}</p>}
      </div>
      {busy && (
        <p className="flex items-start gap-2 text-xs text-muted"><Lock size={14} className="mt-0.5 shrink-0" aria-hidden /> End-to-end encrypted. Only this phone can open the photo.</p>
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
