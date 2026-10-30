import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode, type RefObject } from 'react';

/** Native modal <dialog> (focus trap, Esc, top layer): a bottom sheet on phones, a centred card from `sm` up. */
export function Sheet({ open, onClose, title, titleId, children, initialFocus, wide }: {
  open: boolean;
  onClose: () => void;
  title: string;
  titleId: string;
  children: ReactNode;
  initialFocus?: RefObject<HTMLElement | null>;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      initialFocus?.current?.focus();
    }
    if (!open && d.open) d.close();
  }, [open, initialFocus]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby={titleId}
      className={`mx-auto mb-0 mt-auto max-h-[94dvh] w-full max-w-full overflow-y-auto overscroll-contain rounded-t-2xl border border-line2 bg-surface p-0 text-text shadow-[var(--shadow)] backdrop:bg-black/70 backdrop:backdrop-blur-sm sm:m-auto sm:max-h-[92dvh] sm:rounded-2xl ${wide ? 'sm:w-[min(94vw,30rem)]' : 'sm:w-[min(94vw,26rem)]'}`}
    >
      <div className="flex flex-col gap-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto -mt-2 h-1 w-10 rounded-full bg-line2 sm:hidden" aria-hidden />
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-xl font-semibold">{title}</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose} aria-label="Close"><X size={20} aria-hidden /></button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
