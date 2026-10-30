import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { createDoc, reshape } from '../film/doc';
import { historyReducer, initHistory } from '../film/history';
import type { FilmDoc, FormatId } from '../film/types';
import { clearPhotos } from '../media/photos';

export type Selection = { type: 'item'; id: string } | { type: 'slot'; index: number } | null;
export type Tool = 'film' | 'photos' | 'looks' | 'frame' | 'add' | 'text' | 'layers';

interface Studio {
  doc: FilmDoc;
  apply: (fn: (d: FilmDoc) => FilmDoc, key?: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  tool: Tool;
  setTool: (t: Tool) => void;
  selection: Selection;
  setSelection: (s: Selection) => void;
  exportOpen: boolean;
  setExportOpen: (o: boolean) => void;
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
  const [tool, setTool] = useState<Tool>('photos');
  const [selection, setSelection] = useState<Selection>(null);
  const [exportOpen, setExportOpen] = useState(false);
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
    setTool('photos');
  }, []);

  const clearAll = useCallback(() => {
    clearPhotos();
    dispatch({ type: 'reset', doc: createDoc('strip') });
    setSelection(null);
    setTool('photos');
    setExportOpen(false);
  }, []);

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
      tool, setTool, selection, setSelection, exportOpen, setExportOpen, startFrom, clearAll, toast, toastMsg,
    }),
    [h, apply, tool, selection, exportOpen, startFrom, clearAll, toast, toastMsg],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
