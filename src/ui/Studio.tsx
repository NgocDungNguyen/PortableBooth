import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Camera, Download, Film, Frame, Home, Layers, Redo2, ShieldX, Smile, Sparkles, Type, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { filledCount, isComplete } from '../film/doc';
import { useStudio, type Tool } from '../state/studio';
import { ConfirmDialog } from './ConfirmDialog';
import { ExportDialog } from './ExportDialog';
import { IntakeProvider } from './intake';
import { Stage } from './edit/Stage';
import { AddPanel } from './panels/AddPanel';
import { FilmPanel } from './panels/FilmPanel';
import { FramePanel } from './panels/FramePanel';
import { ItemInspector, SlotInspector } from './panels/Inspector';
import { LayersPanel } from './panels/LayersPanel';
import { LooksPanel } from './panels/LooksPanel';
import { PhotosPanel } from './panels/PhotosPanel';
import { TextPanel } from './panels/TextPanel';

const TOOLS: { id: Tool; label: string; Icon: typeof Film }[] = [
  { id: 'film', label: 'Film', Icon: Film },
  { id: 'photos', label: 'Photos', Icon: Camera },
  { id: 'looks', label: 'Looks', Icon: Sparkles },
  { id: 'frame', label: 'Frame', Icon: Frame },
  { id: 'add', label: 'Add', Icon: Smile },
  { id: 'text', label: 'Text', Icon: Type },
  { id: 'layers', label: 'Layers', Icon: Layers },
];

function ToolBody({ tool }: { tool: Tool }) {
  switch (tool) {
    case 'film': return <FilmPanel />;
    case 'photos': return <PhotosPanel />;
    case 'looks': return <LooksPanel />;
    case 'frame': return <FramePanel />;
    case 'add': return <AddPanel />;
    case 'text': return <TextPanel />;
    case 'layers': return <LayersPanel />;
  }
}

function StudioInner() {
  const { doc, tool, setTool, selection, setSelection, undo, redo, canUndo, canRedo, clearAll, setExportOpen } = useStudio();
  const reduce = useReducedMotion();
  const [confirm, setConfirm] = useState(false);
  const complete = isComplete(doc);
  const left = doc.slots.length - filledCount(doc);
  // an element or photo takes over the panel (the Looks tool keeps it so a filter can be set per photo)
  const showInspector = selection?.type === 'item' || (selection?.type === 'slot' && tool !== 'looks');
  const bodyKey = showInspector && selection ? `i-${selection.type}-${selection.type === 'item' ? selection.id : selection.index}` : tool;

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center gap-1 border-b border-line px-2 sm:px-3">
        <a href="#home" className="btn btn-icon btn-ghost" aria-label="Home"><Home size={20} aria-hidden /></a>
        <span className="mr-auto hidden font-display text-base font-semibold sm:block">PortableBooth</span>
        <span className="mr-auto sm:hidden" />
        <button className="btn btn-icon btn-ghost" onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo"><Undo2 size={20} aria-hidden /></button>
        <button className="btn btn-icon btn-ghost" onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo"><Redo2 size={20} aria-hidden /></button>
        <button className="btn btn-icon btn-ghost" onClick={() => setConfirm(true)} aria-label="Clear everything" title="Clear everything"><ShieldX size={20} aria-hidden /></button>
        <button className="btn btn-primary ml-1" onClick={() => setExportOpen(true)} disabled={!complete} aria-label={complete ? 'Export' : `Export (${left} photo${left === 1 ? '' : 's'} left to add)`}>
          <Download size={18} aria-hidden /> {complete ? 'Export' : <span className="num">{left} left</span>}
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="stage-bg relative min-h-0 flex-1 p-4 md:p-8">
          <Stage />
        </div>
        <aside className="flex h-[46dvh] shrink-0 flex-col border-t border-line bg-surface md:h-auto md:w-[26rem] md:border-l md:border-t-0" aria-label="Tools">
          <div role="tablist" aria-label="Tools" className="no-scrollbar flex shrink-0 gap-0 overflow-x-auto border-b border-line px-1 py-1.5">
            {TOOLS.map(({ id, label, Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={tool === id && !showInspector}
                aria-controls="tool-body"
                onClick={() => {
                  setTool(id);
                  if (selection?.type === 'item' || (selection?.type === 'slot' && id !== 'looks')) setSelection(null);
                }}
                className={`flex min-h-12 min-w-[2.9rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-xs font-semibold transition-colors ${tool === id && !showInspector ? 'bg-surface3 text-text' : 'text-muted hover:text-text'}`}
              >
                <Icon size={19} aria-hidden />
                {label}
              </button>
            ))}
          </div>
          <div id="tool-body" role="tabpanel" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={bodyKey} initial={{ opacity: 0, y: reduce ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.14, ease: 'easeOut' }}>
                {showInspector && selection?.type === 'item' ? <ItemInspector id={selection.id} /> : showInspector && selection?.type === 'slot' ? <SlotInspector index={selection.index} /> : <ToolBody tool={tool} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </aside>
      </div>

      <ExportDialog />
      <ConfirmDialog open={confirm} title="Clear everything?" detail="Your photos and edits are removed from this device. This can't be undone." confirmLabel="Clear" onClose={() => setConfirm(false)} onConfirm={() => { clearAll(); setConfirm(false); }} />
    </div>
  );
}

export default function Studio() {
  return (
    <IntakeProvider>
      <StudioInner />
    </IntakeProvider>
  );
}
