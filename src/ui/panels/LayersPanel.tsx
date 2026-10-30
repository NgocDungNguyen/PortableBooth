import { ArrowDown, ArrowUp, Eye, EyeOff, Image as ImageIcon, Lock, LockOpen, Sticker, Type, LayoutTemplate } from 'lucide-react';
import { useStudio } from '../../state/studio';
import { stickerLabel } from '../../assets/library';
import { WIDGETS } from '../../render/widgets';
import type { Item } from '../../film/types';
import { Section } from './common';

const name = (it: Item) => (it.kind === 'sticker' ? stickerLabel(it.sticker) : it.kind === 'text' ? `“${it.text}”` : WIDGETS.find((w) => w.id === it.widget)?.name ?? 'Widget');
const Icon = ({ it }: { it: Item }) => (it.kind === 'sticker' ? <Sticker size={16} aria-hidden /> : it.kind === 'text' ? <Type size={16} aria-hidden /> : <LayoutTemplate size={16} aria-hidden />);

export function LayersPanel() {
  const { doc, apply, selection, setSelection } = useStudio();
  const items = [...doc.items].reverse();
  const move = (id: string, dir: 1 | -1) =>
    apply((d) => {
      const i = d.items.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.items.length) return d;
      const next = [...d.items];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...d, items: next };
    });
  const patch = (id: string, p: Partial<Item>) => apply((d) => ({ ...d, items: d.items.map((x) => (x.id === id ? ({ ...x, ...p } as Item) : x)) }));
  return (
    <div>
      <Section title="Layers" aside={<span className="num text-xs text-muted">{doc.items.length}</span>}>
        {items.length === 0 && <p className="label">Stickers, widgets and text you add show up here.</p>}
        <ul className="flex flex-col gap-1.5">
          {items.map((it, k) => (
            <li key={it.id} className={`flex items-center gap-1 rounded-xl border p-1 ${selection?.type === 'item' && selection.id === it.id ? 'border-ring bg-surface2' : 'border-line'}`}>
              <button className="flex min-h-11 min-w-0 flex-1 items-center gap-2 px-2 text-left text-sm font-medium" onClick={() => setSelection({ type: 'item', id: it.id })}>
                <Icon it={it} />
                <span className="truncate">{name(it)}</span>
              </button>
              <button className="btn btn-icon btn-ghost !min-h-9 !min-w-9" aria-label={it.hidden ? 'Show' : 'Hide'} onClick={() => patch(it.id, { hidden: !it.hidden })}>{it.hidden ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}</button>
              <button className="btn btn-icon btn-ghost !min-h-9 !min-w-9" aria-label={it.locked ? 'Unlock' : 'Lock'} onClick={() => patch(it.id, { locked: !it.locked })}>{it.locked ? <Lock size={16} aria-hidden /> : <LockOpen size={16} aria-hidden />}</button>
              <button className="btn btn-icon btn-ghost !min-h-9 !min-w-9" aria-label="Move up" disabled={k === 0} onClick={() => move(it.id, 1)}><ArrowUp size={16} aria-hidden /></button>
              <button className="btn btn-icon btn-ghost !min-h-9 !min-w-9" aria-label="Move down" disabled={k === items.length - 1} onClick={() => move(it.id, -1)}><ArrowDown size={16} aria-hidden /></button>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Photos">
        <ul className="flex flex-col gap-1.5">
          {doc.slots.map((s, i) => (
            <li key={i}>
              <button className={`flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 text-left text-sm font-medium ${selection?.type === 'slot' && selection.index === i ? 'border-ring bg-surface2' : 'border-line'}`} onClick={() => setSelection({ type: 'slot', index: i })}>
                <ImageIcon size={16} aria-hidden /> Photo {i + 1} {!s.photoId && <span className="label">(empty)</span>}
              </button>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
