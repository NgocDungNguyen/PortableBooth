import { ArrowDownToLine, ArrowUpToLine, Camera, ChevronLeft, Copy, FlipHorizontal2, Lock, LockOpen, RotateCcw, Trash2, Upload } from 'lucide-react';
import { FONTS, TEXT_COLORS, TINT_COLORS, uid } from '../../film/doc';
import { FILTERS } from '../../film/filters';
import type { Blend, Item, StickerItem, TextItem, WidgetItem } from '../../film/types';
import { isMonoSticker } from '../../assets/library';
import { WIDGETS } from '../../render/widgets';
import { useStudio } from '../../state/studio';
import { useIntake } from '../intake';
import { Slider } from '../Slider';
import { Collapse, Section, Seg, Swatches } from './common';

const BLENDS: { id: Blend; label: string }[] = [{ id: 'normal', label: 'Normal' }, { id: 'multiply', label: 'Multiply' }, { id: 'screen', label: 'Screen' }, { id: 'overlay', label: 'Overlay' }];

export function ItemInspector({ id }: { id: string }) {
  const { doc, apply, setSelection } = useStudio();
  const it = doc.items.find((i) => i.id === id);
  if (!it) return null;
  const patch = (p: Partial<Item>, key?: string) => apply((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? ({ ...i, ...p } as Item) : i)) }), key);
  const order = (dir: 'front' | 'back') => apply((d) => ({ ...d, items: dir === 'front' ? [...d.items.filter((i) => i.id !== id), it] : [it, ...d.items.filter((i) => i.id !== id)] }));
  const dup = () => {
    const nid = uid('item');
    apply((d) => ({ ...d, items: [...d.items, { ...it, id: nid, x: it.x + 3, y: it.y + 3 }] }));
    setSelection({ type: 'item', id: nid });
  };
  const tintable = it.kind === 'sticker' && isMonoSticker(it.sticker);
  const wdef = it.kind === 'widget' ? WIDGETS.find((w) => w.id === it.widget) : undefined;

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 -mx-4 -mt-3 mb-1 flex items-center gap-1 bg-surface px-4 pb-2 pt-3">
        <button className="btn btn-ghost btn-sm !px-2" onClick={() => setSelection(null)} aria-label="Done editing">
          <ChevronLeft size={18} aria-hidden /> Done
        </button>
        <div className="ml-auto flex gap-1">
          <button className="btn btn-icon btn-ghost" aria-pressed={it.flipX} aria-label="Flip" title="Flip" onClick={() => patch({ flipX: !it.flipX })}><FlipHorizontal2 size={18} aria-hidden /></button>
          <button className="btn btn-icon btn-ghost" aria-label="Duplicate" title="Duplicate" onClick={dup}><Copy size={18} aria-hidden /></button>
          <button className="btn btn-icon btn-ghost" aria-label="Bring to front" title="Bring to front" onClick={() => order('front')}><ArrowUpToLine size={18} aria-hidden /></button>
          <button className="btn btn-icon btn-ghost" aria-label="Send to back" title="Send to back" onClick={() => order('back')}><ArrowDownToLine size={18} aria-hidden /></button>
          <button className="btn btn-icon btn-ghost" aria-pressed={it.locked} aria-label={it.locked ? 'Unlock' : 'Lock'} title={it.locked ? 'Unlock' : 'Lock'} onClick={() => patch({ locked: !it.locked })}>{it.locked ? <Lock size={18} aria-hidden /> : <LockOpen size={18} aria-hidden />}</button>
          <button className="btn btn-icon btn-ghost btn-danger" aria-label="Delete" title="Delete" onClick={() => { apply((d) => ({ ...d, items: d.items.filter((i) => i.id !== id) })); setSelection(null); }}><Trash2 size={18} aria-hidden /></button>
        </div>
      </div>

      <Section title="Transform">
        <Slider label="Size" value={it.size} min={3} max={it.kind === 'text' ? 24 : 70} step={0.1} onChange={(v) => patch({ size: v }, 'size')} format={(v) => `${Math.round(v)} mm`} />
        <Slider label="Rotate" value={it.rot} min={-180} max={180} step={1} onChange={(v) => patch({ rot: v }, 'rot')} format={(v) => `${Math.round(v)}°`} />
        <Slider label="Opacity" value={it.opacity} min={0.05} max={1} onChange={(v) => patch({ opacity: v }, 'op')} />
      </Section>

      {it.kind === 'text' && <TextControls it={it} patch={patch} />}
      {it.kind === 'widget' && wdef && <WidgetControls it={it} patch={patch} labels={wdef.labels} usesBg={wdef.usesBg} />}
      {tintable && it.kind === 'sticker' && (
        <Section title="Colour">
          <Swatches label="Colour" colors={TINT_COLORS} value={(it as StickerItem).tint} onChange={(c, k) => patch({ tint: c } as Partial<StickerItem>, k)} />
        </Section>
      )}
      {it.kind === 'sticker' && !tintable && (
        <Section title="Tint">
          <Swatches label="Tint" colors={TINT_COLORS} value={it.tint} nullable onChange={(c, k) => patch({ tint: c } as Partial<StickerItem>, k)} />
        </Section>
      )}
      {it.kind === 'sticker' && (
        <Collapse title="Crop">
          {(['l', 't', 'r', 'b'] as const).map((k) => (
            <Slider key={k} label={{ l: 'Left', t: 'Top', r: 'Right', b: 'Bottom' }[k]} value={it.crop[k]} min={0} max={0.8} onChange={(v) => patch({ crop: { ...it.crop, [k]: v } } as Partial<StickerItem>, `crop-${k}`)} />
          ))}
          <button className="btn btn-sm self-start" onClick={() => patch({ crop: { l: 0, t: 0, r: 0, b: 0 } } as Partial<StickerItem>)}><RotateCcw size={16} aria-hidden /> Reset crop</button>
        </Collapse>
      )}

      <Section title="Style">
        <div className="flex flex-wrap items-center gap-2">
          <button className="chip chip-tall" aria-pressed={it.shadow} onClick={() => patch({ shadow: !it.shadow })}>Shadow</button>
          <button className="chip chip-tall" aria-pressed={!!it.outline} onClick={() => patch({ outline: it.outline ? null : { color: '#FFFFFF', width: 0.6 } })}>Outline</button>
        </div>
        {it.outline && (
          <>
            <Swatches label="Outline colour" colors={TINT_COLORS} value={it.outline.color} onChange={(c, k) => c && patch({ outline: { ...it.outline!, color: c } }, k)} />
            <Slider label="Width" value={it.outline.width} min={0.1} max={2.5} step={0.05} onChange={(v) => patch({ outline: { ...it.outline!, width: v } }, 'ow')} format={(v) => `${v.toFixed(1)} mm`} />
          </>
        )}
      </Section>
      <Collapse title="Blend">
        <Seg label="Blend" value={it.blend} onChange={(b) => patch({ blend: b })} options={BLENDS} />
      </Collapse>
    </div>
  );
}

function TextControls({ it, patch }: { it: TextItem; patch: (p: Partial<Item>, key?: string) => void }) {
  return (
    <>
      <Section title="Text">
        <input type="text" aria-label="Text" value={it.text} maxLength={40} onChange={(e) => patch({ text: e.target.value }, 'text')} />
        <div role="radiogroup" aria-label="Font" className="grid grid-cols-3 gap-1.5">
          {FONTS.map((f) => (
            <button key={f.id} role="radio" aria-checked={it.font === f.id} className="tile min-h-11 px-1 text-base" style={{ fontFamily: f.css }} onClick={() => patch({ font: f.id })}>{f.label}</button>
          ))}
        </div>
        <Slider label="Spacing" value={it.tracking} min={-0.05} max={0.5} onChange={(v) => patch({ tracking: v }, 'trk')} format={(v) => v.toFixed(2)} />
      </Section>
      <Section title="Colour">
        <Swatches label="Text colour" colors={TEXT_COLORS} value={it.color} onChange={(c, k) => c && patch({ color: c }, k)} />
      </Section>
      <Section title="Highlight">
        <Swatches label="Highlight" colors={TEXT_COLORS} value={it.bg} nullable onChange={(c, k) => patch({ bg: c }, k)} />
      </Section>
    </>
  );
}

function WidgetControls({ it, patch, labels, usesBg }: { it: WidgetItem; patch: (p: Partial<Item>, key?: string) => void; labels: { text: string; text2?: string }; usesBg: boolean }) {
  return (
    <>
      <Section title="Content">
        <label className="flex flex-col gap-1 text-xs text-muted">{labels.text}<input type="text" value={it.text} maxLength={40} onChange={(e) => patch({ text: e.target.value }, 'wt')} /></label>
        {labels.text2 !== undefined && <label className="flex flex-col gap-1 text-xs text-muted">{labels.text2}<input type="text" value={it.text2} maxLength={40} onChange={(e) => patch({ text2: e.target.value }, 'wt2')} /></label>}
      </Section>
      <Section title="Ink"><Swatches label="Ink" colors={TEXT_COLORS} value={it.color} onChange={(c, k) => c && patch({ color: c }, k)} /></Section>
      {usesBg && <Section title="Paper"><Swatches label="Paper" colors={['#FFFFFF', '#F4EFE6', '#FFD66B', '#F4A6B7', '#9FD3FF', '#0F0F12']} value={it.bg} nullable onChange={(c, k) => patch({ bg: c ?? '' }, k)} /></Section>}
    </>
  );
}

export function SlotInspector({ index }: { index: number }) {
  const { doc, apply, setSelection, setTool } = useStudio();
  const intake = useIntake();
  const slot = doc.slots[index];
  if (!slot) return null;
  const patch = (p: Partial<typeof slot>, key?: string) => apply((d) => ({ ...d, slots: d.slots.map((s, i) => (i === index ? { ...s, ...p } : s)) }), key);
  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-center gap-1">
        <button className="btn btn-ghost btn-sm !px-2" onClick={() => setSelection(null)} aria-label="Done editing"><ChevronLeft size={18} aria-hidden /> Photo {index + 1}</button>
      </div>
      <Section title="Photo">
        <div className="grid grid-cols-2 gap-2">
          <button className="btn" onClick={() => intake.camera(index)}><Camera size={18} aria-hidden /> Retake</button>
          <button className="btn" onClick={() => intake.pick(index)}><Upload size={18} aria-hidden /> Replace</button>
        </div>
        <Slider label="Zoom" value={slot.zoom} min={1} max={3} onChange={(v) => patch({ zoom: v }, 'zoom')} format={(v) => `${v.toFixed(1)}×`} />
        <p className="label">Drag the photo on the film to move it.</p>
        <button className="btn btn-sm self-start" onClick={() => patch({ zoom: 1, ox: 0, oy: 0 })}><RotateCcw size={16} aria-hidden /> Reset position</button>
      </Section>
      <Section title="Filter" aside={slot.filterId && <button className="chip" onClick={() => patch({ filterId: null })}>Use film filter</button>}>
        <p className="label">{slot.filterId ? `This photo: ${FILTERS.find((f) => f.id === slot.filterId)?.name}` : 'Following the film filter'}</p>
        <button className="btn btn-sm self-start" onClick={() => setTool('looks')}>Choose filter</button>
      </Section>
    </div>
  );
}
