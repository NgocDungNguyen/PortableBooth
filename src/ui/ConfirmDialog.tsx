import { useEffect, useRef } from 'react';

interface Props {
  open: boolean;
  title: string;
  detail?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}

/** Native <dialog>: focus trap, Esc to close and screen reader semantics for free. */
export function ConfirmDialog({ open, title, detail, confirmLabel, onConfirm, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="confirm-title"
      className="m-auto w-[min(92vw,24rem)] rounded-2xl border border-line2 bg-surface p-6 text-text shadow-[var(--shadow)] backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <h2 id="confirm-title" className="text-xl font-semibold">{title}</h2>
      {detail && <p className="mt-2 text-sm text-muted">{detail}</p>}
      <div className="mt-6 flex gap-3">
        <button className="btn flex-1" onClick={onClose} autoFocus>Cancel</button>
        <button className="btn btn-primary flex-1" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </dialog>
  );
}
