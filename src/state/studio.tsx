import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { createDoc, reshape } from '../film/doc';
import { historyReducer, initHistory } from '../film/history';
import type { FilmDoc, FormatId } from '../film/types';
import { clearPhotos } from '../media/photos';

export type Selection = { type: 'item'; id: string } | { type: 'slot'; index: number } | null;
export const STEPS = ['film', 'photos', 'edit', 'export'] as const;
export type Step = 0 | 1 | 2 | 3;

interface Studio {
  doc: FilmDoc;
  apply: (fn: (d: FilmDoc) => FilmDoc, key?: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  step: Step;
  setStep: (s: Step) => void;
  selection: Selection;
  setSelection: (s: Selection) => void;
  /** target slot for the next capture/upload (retake) */
  targetSlot: number | null;
  setTargetSlot: (i: number | null) => void;
  startFrom: (format: FormatId, frames?: number, filterId?: string) => void;
  clearAll: () => void;
  toast: (msg: string) => void;
  toastMsg: string;
}

const Ctx = createContext<Studio | null>(null);
export const useStudio = (): Studio => {
  const v = useContext(Ctx);
  if (!v) throw new Error('StudioProvider missing');
  return v;
};

export function StudioProvider({ children }: { children: ReactNode }) {
  const [h, dispatch] = useReducer(historyReducer, undefined, () => initHistory(createDoc('strip')));
  const [step, setStep] = useState<Step>(0);
  const [selection, setSelection] = useState<Selection>(null);
  const [targetSlot, setTargetSlot] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const timer = useRef<number>(0);

  const toast = useCallback((m: string) => {
    setToastMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToastMsg(''), 3200);
  }, []);

  const apply = useCallback((fn: (d: FilmDoc) => FilmDoc, key?: string) => dispatch({ type: 'apply', fn, key }), []);

  const startFrom = useCallback((format: FormatId, frames?: number, filterId?: string) => {
    dispatch({ type: 'apply', fn: (d) => ({ ...reshape(d, format, frames), ...(filterId ? { filterId } : {}) }) });
    setSelection(null);
    setTargetSlot(null);
  }, []);

  const clearAll = useCallback(() => {
    clearPhotos();
    dispatch({ type: 'reset', doc: createDoc('strip') });
    setSelection(null);
    setTargetSlot(null);
    setStep(0);
  }, []);

  // keyboard undo / redo while the studio is mounted
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? 'redo' : 'undo' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const value = useMemo<Studio>(
    () => ({
      doc: h.present, apply, undo: () => dispatch({ type: 'undo' }), redo: () => dispatch({ type: 'redo' }),
      canUndo: h.past.length > 0, canRedo: h.future.length > 0,
      step, setStep, selection, setSelection, targetSlot, setTargetSlot, startFrom, clearAll, toast, toastMsg,
    }),
    [h, apply, step, selection, targetSlot, startFrom, clearAll, toast, toastMsg],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
