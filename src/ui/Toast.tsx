import { AnimatePresence, motion } from 'motion/react';
import { Info } from 'lucide-react';
import { useStudio } from '../state/studio';

export function Toast() {
  const { toastMsg } = useStudio();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4" role="status" aria-live="polite">
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            key={toastMsg}
            initial={{ y: 24, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 12, opacity: 0 }}
            className="panel flex items-center gap-2 px-4 py-3 font-bold"
          >
            <Info size={20} aria-hidden /> {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
