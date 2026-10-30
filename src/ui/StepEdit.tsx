import { Crop, Frame, Smile, SlidersHorizontal, Sparkles, Type } from 'lucide-react';
import { useRef, useState } from 'react';
import { useStudio } from '../state/studio';
import { AdjustPanel, FilterPanel, FramePanel, PhotoPanel, SelectionBar, StickerPanel, TextPanel } from './edit/Panels';
import { Stage } from './edit/Stage';

const TABS = [
  { id: 'filter', label: 'Filter', Icon: Sparkles, Panel: FilterPanel },
  { id: 'adjust', label: 'Adjust', Icon: SlidersHorizontal, Panel: AdjustPanel },
  { id: 'photo', label: 'Photo', Icon: Crop, Panel: PhotoPanel },
  { id: 'frame', label: 'Frame', Icon: Frame, Panel: FramePanel },
  { id: 'stickers', label: 'Stickers', Icon: Smile, Panel: StickerPanel },
  { id: 'text', label: 'Text', Icon: Type, Panel: TextPanel },
] as const;

export function StepEdit() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('filter');
  const { selection } = useStudio();
  const list = useRef<HTMLDivElement>(null);
  const Active = TABS.find((t) => t.id === tab)!.Panel;

  const onKey = (e: React.KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === tab);
    const n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : -1;
    if (n < 0) return;
    e.preventDefault();
    const next = TABS[(n + TABS.length) % TABS.length];
    setTab(next.id);
    list.current?.querySelector<HTMLButtonElement>(`#tab-${next.id}`)?.focus();
  };

  return (
    <div className="grid flex-1 gap-4 md:grid-cols-[1fr_25rem]">
      <div className="min-h-[44dvh] md:min-h-[68dvh]">
        <Stage />
      </div>
      <div className="panel flex max-h-[40dvh] min-h-0 flex-col p-3 md:max-h-[72dvh]">
        <div ref={list} role="tablist" aria-label="Tools" onKeyDown={onKey} className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              id={`tab-${id}`}
              role="tab"
              aria-selected={tab === id}
              aria-controls="tool-panel"
              tabIndex={tab === id ? 0 : -1}
              onClick={() => setTab(id)}
              className={`flex min-h-14 min-w-[4.25rem] flex-1 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 px-2 text-xs font-bold transition-colors ${
                tab === id ? 'border-line bg-lemon text-ink' : 'border-transparent hover:bg-surface2'
              }`}
            >
              <Icon size={22} aria-hidden />
              {label}
            </button>
          ))}
        </div>
        <div id="tool-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1">
          {selection?.type === 'item' && <SelectionBar />}
          <Active />
        </div>
      </div>
    </div>
  );
}
