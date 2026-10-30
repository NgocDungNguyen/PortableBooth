import { useEffect, useRef } from 'react';
import { ShieldCheck, X } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}

/** Native <dialog>: focus trap, Esc to close and screen reader semantics for free. */
export function ConfirmDialog({ open, title, confirmLabel, onConfirm, onClose }: Props) {
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
      className="m-auto w-[min(92vw,26rem)] rounded-[1.6rem] border-[2.5px] border-line bg-surface p-6 text-text shadow-[0_6px_0_var(--shadow)] backdrop:bg-ink/60 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-5 text-center">
        <span className="grid size-16 place-items-center rounded-full border-[2.5px] border-line bg-mint text-ink">
          <ShieldCheck size={32} aria-hidden />
        </span>
        <h2 id="confirm-title" className="text-2xl font-extrabold">{title}</h2>
        <div className="flex w-full gap-3">
          <button className="btn flex-1" onClick={onClose} autoFocus>
            <X size={20} aria-hidden /> Cancel
          </button>
          <button className="btn btn-danger flex-1" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </dialog>
  );
}
