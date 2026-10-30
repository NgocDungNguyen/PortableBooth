import { Camera, Plus, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { computeLayout } from '../../film/layout';
import type { FilmDoc, Item } from '../../film/types';
import { getPhoto } from '../../media/photos';
import { itemBox } from '../../render/compose';
import { useStudio } from '../../state/studio';
import { FilmCanvas } from '../FilmCanvas';
import { useIntake } from '../intake';

type Drag =
  | { kind: 'item'; id: string; dx: number; dy: number }
  | { kind: 'pan'; index: number; lastX: number; lastY: number }
  | null;

function hitItem(doc: FilmDoc, x: number, y: number): Item | null {
  for (let i = doc.items.length - 1; i >= 0; i--) {
    const it = doc.items[i];
    if (it.hidden) continue;
    const { w, h } = itemBox(it);
    const a = (-it.rot * Math.PI) / 180;
    const dx = x - it.x;
    const dy = y - it.y;
    const lx = dx * Math.cos(a) - dy * Math.sin(a);
    const ly = dx * Math.sin(a) + dy * Math.cos(a);
    if (Math.abs(lx) <= Math.max(w, 7) / 2 && Math.abs(ly) <= Math.max(h, 7) / 2) return it;
  }
  return null;
}

const stop = (e: React.PointerEvent) => e.stopPropagation();

export function Stage() {
  const { doc, apply, selection, setSelection, setTool } = useStudio();
  const intake = useIntake();
  const layout = computeLayout(doc.format, doc.frames, doc.corners);
  const drag = useRef<Drag>(null);
  const scale = useRef(1);
  const root = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<number | null>(null);

  const toMm = (clientX: number, clientY: number) => {
    const r = root.current!.getBoundingClientRect();
    return { x: (clientX - r.left) / scale.current, y: (clientY - r.top) / scale.current };
  };

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = toMm(e.clientX, e.clientY);
    const it = hitItem(doc, p.x, p.y);
    setMenu(null);
    e.currentTarget.setPointerCapture(e.pointerId);
    if (it) {
      setSelection({ type: 'item', id: it.id });
      drag.current = it.locked ? null : { kind: 'item', id: it.id, dx: it.x - p.x, dy: it.y - p.y };
      return;
    }
    const si = layout.slots.findIndex((s) => p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h);
    if (si >= 0) {
      setSelection({ type: 'slot', index: si });
      drag.current = doc.slots[si].photoId ? { kind: 'pan', index: si, lastX: p.x, lastY: p.y } : null;
    } else {
      setSelection(null);
      drag.current = null;
    }
  };

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const p = toMm(e.clientX, e.clientY);
    if (d.kind === 'item') {
      apply((d0) => ({ ...d0, items: d0.items.map((i) => (i.id === d.id ? { ...i, x: p.x + d.dx, y: p.y + d.dy } : i)) }), `move-${d.id}`);
    } else {
      const slot = doc.slots[d.index];
      const ph = getPhoto(slot.photoId);
      const r = layout.slots[d.index];
      if (!ph) return;
      const k = Math.max(r.w / ph.w, r.h / ph.h) * slot.zoom;
      const spareX = (ph.w * k - r.w) / 2;
      const spareY = (ph.h * k - r.h) / 2;
      const ddx = p.x - d.lastX;
      const ddy = p.y - d.lastY;
      d.lastX = p.x;
      d.lastY = p.y;
      apply(
        (d0) => ({ ...d0, slots: d0.slots.map((s, i) => (i === d.index ? { ...s, ox: spareX > 0.01 ? s.ox + ddx / spareX : s.ox, oy: spareY > 0.01 ? s.oy + ddy / spareY : s.oy } : s)) }),
        `pan-${d.index}`,
      );
    }
  };

  const up = () => {
    drag.current = null;
  };

  const sel = selection?.type === 'item' ? doc.items.find((i) => i.id === selection.id) : undefined;
  const patch = (id: string, p: Partial<Item>, key: string) =>
    apply((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? ({ ...i, ...p } as Item) : i)) }), key);

  /** drag a corner: scale about the centre; drag the top knob: rotate */
  const startHandle = (mode: 'size' | 'rot') => (e: React.PointerEvent<HTMLElement>) => {
    if (!sel || sel.locked) return;
    e.stopPropagation();
    e.preventDefault();
    const id = sel.id;
    const c = { x: sel.x, y: sel.y };
    const p0 = toMm(e.clientX, e.clientY);
    const d0 = Math.max(1, Math.hypot(p0.x - c.x, p0.y - c.y));
    const size0 = sel.size;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      const p = toMm(ev.clientX, ev.clientY);
      if (mode === 'size') patch(id, { size: size0 * (Math.hypot(p.x - c.x, p.y - c.y) / d0) }, `size-${id}`);
      else {
        let a = (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI + 90;
        if (a > 180) a -= 360;
        const snapped = Math.round(a / 15) * 15;
        patch(id, { rot: ev.shiftKey || Math.abs(a - snapped) < 3 ? snapped : a }, `rot-${id}`);
      }
    };
    const end = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  };

  const key = (e: React.KeyboardEvent) => {
    if (!sel || sel.locked) return;
    const step = e.shiftKey ? 2 : 0.5;
    const nudge = (dx: number, dy: number) => {
      e.preventDefault();
      patch(sel.id, { x: sel.x + dx, y: sel.y + dy }, `nudge-${sel.id}`);
    };
    if (e.key === 'ArrowLeft') nudge(-step, 0);
    else if (e.key === 'ArrowRight') nudge(step, 0);
    else if (e.key === 'ArrowUp') nudge(0, -step);
    else if (e.key === 'ArrowDown') nudge(0, step);
    else if (e.key === '+' || e.key === '=') patch(sel.id, { size: sel.size * 1.06 }, `size-${sel.id}`);
    else if (e.key === '-') patch(sel.id, { size: sel.size / 1.06 }, `size-${sel.id}`);
    else if (e.key === '[') patch(sel.id, { rot: sel.rot - 5 }, `rot-${sel.id}`);
    else if (e.key === ']') patch(sel.id, { rot: sel.rot + 5 }, `rot-${sel.id}`);
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      apply((d) => ({ ...d, items: d.items.filter((i) => i.id !== sel.id) }));
      setSelection(null);
    }
  };

  return (
    <FilmCanvas doc={doc} showEmpty label="Your film">
      {(pxPerMm) => {
        scale.current = pxPerMm;
        const box = sel ? itemBox(sel) : null;
        return (
          <div
            ref={root}
            className="absolute inset-0 touch-none outline-offset-8"
            tabIndex={0}
            role="group"
            aria-label="Film editor. Select a sticker, then use arrow keys to move, plus and minus to resize, brackets to rotate, Delete to remove"
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onKeyDown={key}
          >
            {layout.slots.map((s, i) => {
              const filled = !!doc.slots[i].photoId;
              const selected = selection?.type === 'slot' && selection.index === i;
              return (
                <div key={i} className="pointer-events-none absolute" style={{ left: s.x * pxPerMm, top: s.y * pxPerMm, width: s.w * pxPerMm, height: s.h * pxPerMm, borderRadius: layout.slotRadius * pxPerMm }}>
                  {selected && <div className="absolute inset-0 rounded-[inherit] border-2 border-accent" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }} />}
                  {!filled && (
                    <div className="absolute inset-0 grid place-items-center">
                      <div className="pointer-events-auto relative" onPointerDown={stop}>
                        <button className="grid size-11 place-items-center rounded-full border border-line2 bg-bg/70 text-text backdrop-blur transition-transform hover:scale-105" aria-haspopup="menu" aria-expanded={menu === i} aria-label={`Add photo ${i + 1}`} onClick={() => setMenu(menu === i ? null : i)}>
                          <Plus size={20} aria-hidden />
                        </button>
                        {menu === i && (
                          <div role="menu" className="absolute left-1/2 top-full z-20 mt-2 flex -translate-x-1/2 flex-col gap-1 rounded-xl border border-line2 bg-surface p-1 shadow-[var(--shadow)]">
                            <button role="menuitem" className="btn btn-ghost justify-start" onClick={() => { setMenu(null); setTool('photos'); intake.camera(i); }}><Camera size={18} aria-hidden /> Camera</button>
                            <button role="menuitem" className="btn btn-ghost justify-start" onClick={() => { setMenu(null); intake.pick(i); }}><Upload size={18} aria-hidden /> Upload</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {sel && box && !sel.hidden && (
              <div
                className="pointer-events-none absolute"
                style={{ left: sel.x * pxPerMm, top: sel.y * pxPerMm, width: Math.max(box.w, 4) * pxPerMm, height: Math.max(box.h, 4) * pxPerMm, transform: `translate(-50%,-50%) rotate(${sel.rot}deg)` }}
              >
                <div className="absolute -inset-1 rounded border border-accent" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.45)' }} />
                {!sel.locked &&
                  ([[0, 0], [1, 0], [0, 1], [1, 1]] as const).map(([cx, cy]) => (
                    <span
                      key={`${cx}${cy}`}
                      role="presentation"
                      onPointerDown={startHandle('size')}
                      className="pointer-events-auto absolute grid size-11 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize place-items-center touch-none"
                      style={{ left: `${cx * 100}%`, top: `${cy * 100}%` }}
                    >
                      <span className="size-3.5 rounded-[4px] border-2 border-accent bg-bg shadow md:size-3" />
                    </span>
                  ))}
                {!sel.locked && (
                  <>
                    <span className="absolute left-1/2 -top-6 h-5 w-px bg-accent" aria-hidden />
                    <span
                      role="presentation"
                      onPointerDown={startHandle('rot')}
                      className="pointer-events-auto absolute left-1/2 grid size-11 -translate-x-1/2 cursor-grab place-items-center touch-none"
                      style={{ top: -52 }}
                    >
                      <span className="size-3.5 rounded-full border-2 border-accent bg-bg shadow" />
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        );
      }}
    </FilmCanvas>
  );
}
