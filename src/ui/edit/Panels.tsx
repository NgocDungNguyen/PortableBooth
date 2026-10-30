import { motion } from 'motion/react';
import {
  Blend, CalendarDays, CircleDot, Cloud, Contrast, Copy, Droplet, Grip, Layers, Plus, RotateCcw, Sparkles, Square, SquareRoundCorner, Sun, Tag, Thermometer, Trash2, Type,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { STICKERS, stickerDataUrl } from '../../assets/stickers';
import { DEFAULT_ADJUST, FONTS, FRAME_COLORS, MAX_TEXT, TEXT_COLORS, uid } from '../../film/doc';
import { FILTERS } from '../../film/filters';
import { computeLayout } from '../../film/layout';
import type { AdjustParams, TextItem } from '../../film/types';
import { getPhoto } from '../../media/photos';
import { inkOn, renderFilterThumb } from '../../render/compose';
import { useStudio } from '../../state/studio';
import { Slider } from '../Slider';

const pct = (v: number) => `${Math.round(v * 100)}`;

function FilterThumb({ photoId, filterId }: { photoId: string | null; filterId: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ph = getPhoto(photoId);
    if (ph && ref.current) renderFilterThumb(ref.current, ph, filterId, 96);
  }, [photoId, filterId]);
  return <canvas ref={ref} width={96} height={96} className="size-[4.5rem] rounded-2xl border-2 border-line bg-surface2" aria-hidden />;
}

export function FilterPanel() {
  const { doc, apply } = useStudio();
  const thumbPhoto = doc.slots.find((s) => s.photoId)?.photoId ?? null;
  return (
    <div role="radiogroup" aria-label="Filter" className="no-scrollbar flex gap-3 overflow-x-auto px-1 pb-2 pt-1 md:grid md:grid-cols-3 md:overflow-visible">
      {FILTERS.map((f) => {
        const on = doc.filterId === f.id;
        return (
          <motion.button
            key={f.id}
            role="radio"
            aria-checked={on}
            onClick={() => apply((d) => ({ ...d, filterId: f.id }))}
            whileTap={{ scale: 0.92 }}
            className={`flex shrink-0 flex-col items-center gap-1.5 rounded-2xl p-1.5 ${on ? 'bg-lemon text-ink' : ''}`}
          >
            <FilterThumb photoId={thumbPhoto} filterId={f.id} />
            <span className="text-sm font-bold">{f.name}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

const ADJ: { key: keyof AdjustParams; label: string; Icon: typeof Sun; bipolar: boolean }[] = [
  { key: 'intensity', label: 'Filter strength', Icon: Blend, bipolar: false },
  { key: 'brightness', label: 'Brightness', Icon: Sun, bipolar: true },
  { key: 'contrast', label: 'Contrast', Icon: Contrast, bipolar: true },
  { key: 'saturation', label: 'Color', Icon: Droplet, bipolar: true },
  { key: 'warmth', label: 'Warmth', Icon: Thermometer, bipolar: true },
  { key: 'fade', label: 'Fade', Icon: Cloud, bipolar: false },
  { key: 'grain', label: 'Grain', Icon: Grip, bipolar: false },
  { key: 'glow', label: 'Glow', Icon: Sparkles, bipolar: false },
  { key: 'vignette', label: 'Vignette', Icon: CircleDot, bipolar: false },
];

export function AdjustPanel() {
  const { doc, apply } = useStudio();
  return (
    <div className="flex flex-col gap-1">
      {ADJ.map(({ key, label, Icon, bipolar }) => (
        <Slider
          key={key}
          label={label}
          icon={<Icon size={22} aria-hidden />}
          value={doc.adjust[key]}
          min={bipolar ? -1 : 0}
          max={1}
          onChange={(v) => apply((d) => ({ ...d, adjust: { ...d.adjust, [key]: v } }), `adj-${key}`)}
          format={pct}
        />
      ))}
      <button className="btn btn-sm mt-1 self-start" onClick={() => apply((d) => ({ ...d, adjust: { ...DEFAULT_ADJUST } }))}>
        <RotateCcw size={20} aria-hidden /> Reset
      </button>
    </div>
  );
}

export function PhotoPanel() {
  const { doc, apply, selection, setSelection, setTargetSlot, setStep } = useStudio();
  const idx = selection?.type === 'slot' ? selection.index : 0;
  const slot = doc.slots[idx];
  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Photo" className="flex flex-wrap gap-2">
        {doc.slots.map((_, i) => (
          <button key={i} role="radio" aria-checked={idx === i} aria-label={`Photo ${i + 1}`} className="chip font-display text-lg" onClick={() => setSelection({ type: 'slot', index: i })}>
            {i + 1}
          </button>
        ))}
      </div>
      <Slider
        label="Zoom"
        icon={<Plus size={22} aria-hidden />}
        value={slot.zoom}
        min={1}
        max={3}
        step={0.01}
        onChange={(v) => apply((d) => ({ ...d, slots: d.slots.map((s, i) => (i === idx ? { ...s, zoom: v } : s)) }), `zoom-${idx}`)}
        format={(v) => `${v.toFixed(1)}×`}
      />
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-sm" onClick={() => apply((d) => ({ ...d, slots: d.slots.map((_, i) => (i === idx ? { photoId: d.slots[i].photoId, zoom: 1, ox: 0, oy: 0 } : d.slots[i])) }))}>
          <RotateCcw size={20} aria-hidden /> Reset
        </button>
        <button
          className="btn btn-sm"
          onClick={() => {
            setTargetSlot(idx);
            setStep(1);
          }}
        >
          <RotateCcw size={20} aria-hidden className="rotate-180" /> Retake
        </button>
      </div>
      <p className="sr-only-text">Drag the photo on the film to move it.</p>
    </div>
  );
}

export function FramePanel() {
  const { doc, apply } = useStudio();
  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Film color" className="flex flex-wrap gap-2.5">
        {FRAME_COLORS.map((c) => (
          <motion.button
            key={c}
            role="radio"
            aria-checked={doc.frameColor === c}
            aria-label={`Film color ${c}`}
            whileTap={{ scale: 0.88 }}
            onClick={() => apply((d) => ({ ...d, frameColor: c }))}
            className="grid size-11 place-items-center rounded-full border-[2.5px] border-line"
            style={{ background: c, boxShadow: doc.frameColor === c ? `0 0 0 3px var(--bg), 0 0 0 6px var(--text)` : undefined }}
          >
            {doc.frameColor === c && <span className="size-2.5 rounded-full" style={{ background: inkOn(c) }} />}
          </motion.button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="chip" aria-pressed={doc.corners === 'square'} onClick={() => apply((d) => ({ ...d, corners: 'square' }))}>
          <Square size={20} aria-hidden /> Square
        </button>
        <button className="chip" aria-pressed={doc.corners === 'round'} onClick={() => apply((d) => ({ ...d, corners: 'round' }))}>
          <SquareRoundCorner size={20} aria-hidden /> Round
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className="chip" aria-pressed={doc.dateStamp} onClick={() => apply((d) => ({ ...d, dateStamp: !d.dateStamp }))}>
          <CalendarDays size={20} aria-hidden /> Date
        </button>
        <input
          type="date"
          aria-label="Date on the film"
          value={doc.date}
          disabled={!doc.dateStamp}
          onChange={(e) => e.target.value && apply((d) => ({ ...d, date: e.target.value }), 'date')}
          className="min-h-11 rounded-xl border-2 border-line bg-surface px-3 font-bold disabled:opacity-40"
        />
        <button className="chip" aria-pressed={doc.brandMark} onClick={() => apply((d) => ({ ...d, brandMark: !d.brandMark }))}>
          <Tag size={20} aria-hidden /> Logo
        </button>
      </div>
    </div>
  );
}

function centre(doc: ReturnType<typeof useStudio>['doc'], slotIdx: number | null) {
  const l = computeLayout(doc.format, doc.frames, doc.corners);
  const s = slotIdx !== null ? l.slots[slotIdx] : undefined;
  return s ? { x: s.x + s.w / 2, y: s.y + s.h / 2 } : { x: l.widthMm / 2, y: l.heightMm / 2 };
}

export function StickerPanel() {
  const { doc, apply, setSelection, selection } = useStudio();
  const add = (sticker: string) => {
    const id = uid('item');
    const at = centre(doc, selection?.type === 'slot' ? selection.index : 0);
    const jitter = ((doc.items.length * 7) % 9) - 4;
    apply((d) => ({
      ...d,
      items: [...d.items, { id, kind: 'sticker', sticker, x: at.x + jitter, y: at.y + jitter, size: d.format === 'film35' ? 14 : 15, rot: ((d.items.length * 13) % 25) - 12 }],
    }));
    setSelection({ type: 'item', id });
  };
  return (
    <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6 md:grid-cols-4">
      {STICKERS.map((s) => (
        <motion.button
          key={s.id}
          whileTap={{ scale: 0.85, rotate: -8 }}
          whileHover={{ y: -3, rotate: 4 }}
          onClick={() => add(s.id)}
          aria-label={`Add ${s.label} sticker`}
          className="grid aspect-square min-h-14 place-items-center rounded-2xl border-2 border-line bg-surface2 p-1.5"
        >
          <img src={stickerDataUrl(s)} alt="" className="size-full" draggable={false} />
        </motion.button>
      ))}
    </div>
  );
}

export function TextPanel() {
  const { doc, apply, selection, setSelection } = useStudio();
  const [draft, setDraft] = useState('');
  const sel = selection?.type === 'item' ? doc.items.find((i): i is TextItem => i.id === selection.id && i.kind === 'text') : undefined;

  const add = () => {
    const id = uid('item');
    const text = draft.trim() || 'hello!';
    const l = computeLayout(doc.format, doc.frames, doc.corners);
    const target = l.caption ?? l.slots[0];
    const x = target.x + target.w / 2;
    const y = l.caption ? target.y + target.h / 2 : target.y + target.h - 5;
    apply((d) => ({
      ...d,
      items: [...d.items, { id, kind: 'text', text, font: 'marker', color: inkOn(d.frameColor), x, y, size: 5.5, rot: -3 }],
    }));
    setSelection({ type: 'item', id });
    setDraft('');
  };
  const patch = (p: Partial<TextItem>, key?: string) =>
    sel && apply((d) => ({ ...d, items: d.items.map((i) => (i.id === sel.id ? ({ ...i, ...p } as TextItem) : i)) }), key);

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_TEXT}
          placeholder="Say something"
          aria-label="New text"
          className="min-h-12 min-w-0 flex-1 rounded-2xl border-[2.5px] border-line bg-surface px-4 text-lg font-bold placeholder:text-muted"
        />
        <button type="submit" className="btn btn-primary btn-icon" aria-label="Add text">
          <Type size={24} aria-hidden />
        </button>
      </form>
      {sel && (
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-dashed border-line p-3">
          <input
            value={sel.text}
            maxLength={MAX_TEXT}
            onChange={(e) => patch({ text: e.target.value }, 'text')}
            aria-label="Edit text"
            className="min-h-12 rounded-2xl border-[2.5px] border-line bg-surface px-4 text-lg font-bold"
          />
          <div role="radiogroup" aria-label="Font" className="flex flex-wrap gap-2">
            {FONTS.map((f) => (
              <button key={f.id} role="radio" aria-checked={sel.font === f.id} className="chip text-lg" style={{ fontFamily: f.css }} onClick={() => patch({ font: f.id })}>
                {f.label}
              </button>
            ))}
          </div>
          <div role="radiogroup" aria-label="Text color" className="flex flex-wrap gap-2.5">
            {TEXT_COLORS.map((c) => (
              <button
                key={c}
                role="radio"
                aria-checked={sel.color === c}
                aria-label={`Text color ${c}`}
                onClick={() => patch({ color: c })}
                className="size-11 rounded-full border-[2.5px] border-line"
                style={{ background: c, boxShadow: sel.color === c ? '0 0 0 3px var(--bg), 0 0 0 6px var(--text)' : undefined }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** size / rotate / duplicate / layer / delete for the selected sticker or text */
export function SelectionBar() {
  const { doc, apply, selection, setSelection } = useStudio();
  if (selection?.type !== 'item') return null;
  const it = doc.items.find((i) => i.id === selection.id);
  if (!it) return null;
  const patch = (p: Partial<typeof it>, key?: string) =>
    apply((d) => ({ ...d, items: d.items.map((i) => (i.id === it.id ? ({ ...i, ...p } as typeof it) : i)) }), key);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-3 rounded-2xl border-2 border-line bg-surface2 p-2" role="group" aria-label="Selected item">
      <Slider label="Size" icon={<Plus size={22} aria-hidden />} value={it.size} min={3} max={it.kind === 'text' ? 16 : 45} step={0.1} onChange={(v) => patch({ size: v }, 'size')} format={(v) => `${Math.round(v)}`} />
      <Slider label="Rotate" icon={<RotateCcw size={22} aria-hidden />} value={it.rot} min={-180} max={180} step={1} onChange={(v) => patch({ rot: v }, 'rot')} format={(v) => `${Math.round(v)}°`} />
      <div className="mt-1 flex gap-2">
        <button
          className="btn btn-sm btn-icon"
          aria-label="Duplicate"
          title="Duplicate"
          onClick={() => {
            const id = uid('item');
            apply((d) => ({ ...d, items: [...d.items, { ...it, id, x: it.x + 3, y: it.y + 3 }] }));
            setSelection({ type: 'item', id });
          }}
        >
          <Copy size={20} aria-hidden />
        </button>
        <button
          className="btn btn-sm btn-icon"
          aria-label="Bring to front"
          title="Bring to front"
          onClick={() => apply((d) => ({ ...d, items: [...d.items.filter((i) => i.id !== it.id), it] }))}
        >
          <Layers size={20} aria-hidden />
        </button>
        <button
          className="btn btn-sm btn-danger btn-icon ml-auto"
          aria-label="Delete"
          title="Delete"
          onClick={() => {
            apply((d) => ({ ...d, items: d.items.filter((i) => i.id !== it.id) }));
            setSelection(null);
          }}
        >
          <Trash2 size={20} aria-hidden />
        </button>
      </div>
    </motion.div>
  );
}
