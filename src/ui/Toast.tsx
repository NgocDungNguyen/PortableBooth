import { AnimatePresence, motion } from 'motion/react';
import { Info } from 'lucide-react';
import { useStudio } from '../state/studio';

export function Toast() {
  const { toastMsg } = useStudio();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center px-4" role="status" aria-live="polite">
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            key={toastMsg}
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="panel flex items-center gap-2 px-4 py-2.5 text-sm font-medium shadow-[var(--shadow)]"
          >
            <Info size={18} aria-hidden className="text-accent" /> {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
