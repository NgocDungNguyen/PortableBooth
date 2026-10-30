import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight, Camera, Check, Download, Home, Redo2, Rows3, ShieldX, Undo2, Wand2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { filledCount, isComplete } from '../film/doc';
import { useStudio, type Step } from '../state/studio';
import { ConfirmDialog } from './ConfirmDialog';
import { StepEdit } from './StepEdit';
import { StepExport } from './StepExport';
import { StepFilm } from './StepFilm';
import { StepPhotos } from './StepPhotos';

const META = [
  { Icon: Rows3, label: 'Film' },
  { Icon: Camera, label: 'Photos' },
  { Icon: Wand2, label: 'Edit' },
  { Icon: Download, label: 'Save' },
] as const;

export default function Studio() {
  const { doc, step, setStep, undo, redo, canUndo, canRedo, clearAll } = useStudio();
  const reduce = useReducedMotion();
  const [confirm, setConfirm] = useState(false);
  const complete = isComplete(doc);
  const reach = (s: number) => (s <= 1 ? true : complete);
  const go = (s: Step) => reach(s) && setStep(s);
  const dir = useDirection(step);

  const nextDisabled = step === 1 && !complete;

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-3 pb-28 pt-3 sm:px-5">
      {/* top bar */}
      <header className="flex items-center gap-2">
        <a href="#/" className="btn btn-icon btn-sm" aria-label="Home" title="Home">
          <Home size={22} aria-hidden />
        </a>
        <nav aria-label="Steps" className="mx-auto flex flex-1 items-center justify-center">
          <ol className="flex w-full max-w-md items-center">
            {META.map(({ Icon, label }, i) => {
              const state = i === step ? 'current' : i < step && reach(i) ? 'done' : 'todo';
              return (
                <li key={label} className="flex flex-1 items-center last:flex-none">
                  <button
                    onClick={() => go(i as Step)}
                    aria-current={i === step ? 'step' : undefined}
                    aria-disabled={!reach(i)}
                    disabled={!reach(i)}
                    className={`group flex min-h-11 flex-col items-center gap-0.5 rounded-2xl px-1 disabled:opacity-40`}
                  >
                    <span
                      className={`grid size-11 place-items-center rounded-2xl border-[2.5px] border-line transition-all duration-200 ${
                        state === 'current' ? 'scale-110 bg-lemon text-ink shadow-[0_3px_0_var(--shadow)]' : state === 'done' ? 'bg-mint text-ink' : 'bg-surface'
                      }`}
                    >
                      {state === 'done' ? <Check size={22} aria-hidden /> : <Icon size={22} aria-hidden />}
                    </span>
                    <span className="text-xs font-bold">{label}</span>
                  </button>
                  {i < META.length - 1 && (
                    <span className="relative mx-1 mb-4 h-1 flex-1 overflow-hidden rounded-full bg-line/20" aria-hidden>
                      <motion.span className="absolute inset-y-0 left-0 bg-line" initial={false} animate={{ width: i < step ? '100%' : '0%' }} transition={{ duration: reduce ? 0 : 0.4 }} />
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
        <div className="flex items-center gap-2">
          {step === 2 && (
            <>
              <button className="btn btn-icon btn-sm" onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo">
                <Undo2 size={22} aria-hidden />
              </button>
              <button className="btn btn-icon btn-sm" onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo">
                <Redo2 size={22} aria-hidden />
              </button>
            </>
          )}
          <button className="btn btn-icon btn-sm" onClick={() => setConfirm(true)} aria-label="Clear everything" title="Clear everything">
            <ShieldX size={22} aria-hidden />
          </button>
        </div>
      </header>

      {/* step body */}
      <div className="relative mt-4 flex min-h-0 flex-1 flex-col">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.section
            key={step}
            custom={dir}
            aria-label={META[step].label}
            variants={{
              enter: (d: number) => ({ opacity: 0, x: reduce ? 0 : d * 60, scale: reduce ? 1 : 0.98 }),
              center: { opacity: 1, x: 0, scale: 1 },
              exit: (d: number) => ({ opacity: 0, x: reduce ? 0 : d * -60, scale: reduce ? 1 : 0.98 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 260, damping: 28, duration: reduce ? 0.01 : undefined }}
            className="flex min-h-0 flex-1 flex-col"
          >
            {step === 0 && <StepFilm />}
            {step === 1 && <StepPhotos />}
            {step === 2 && <StepEdit />}
            {step === 3 && <StepExport />}
          </motion.section>
        </AnimatePresence>
      </div>

      {/* bottom nav */}
      {step < 3 && (
        <nav aria-label="Navigation" className="fixed inset-x-0 bottom-0 z-30 border-t-[2.5px] border-line bg-bg/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <button className="btn" onClick={() => setStep(Math.max(0, step - 1) as Step)} disabled={step === 0}>
              <ArrowLeft size={22} aria-hidden /> Back
            </button>
            {step === 1 && !complete && (
              <span className="font-display text-xl font-extrabold tabular-nums" aria-live="polite">
                {filledCount(doc)}/{doc.slots.length}
              </span>
            )}
            <button className={`btn btn-primary ${step === 1 && complete ? 'pulse' : ''}`} onClick={() => go((step + 1) as Step)} disabled={nextDisabled}>
              {step === 2 ? 'Done' : 'Next'} <ArrowRight size={22} aria-hidden />
            </button>
          </div>
        </nav>
      )}

      <ConfirmDialog
        open={confirm}
        title="Clear everything?"
        confirmLabel="Clear"
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          clearAll();
          setConfirm(false);
        }}
      />
    </div>
  );
}

/** +1 when moving forward through the steps, -1 when going back (drives the slide direction) */
function useDirection(step: number): number {
  const prev = useRef(step);
  const dir = step >= prev.current ? 1 : -1;
  prev.current = step;
  return dir;
}
