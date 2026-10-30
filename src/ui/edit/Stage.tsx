import { useRef } from 'react';
import { computeLayout } from '../../film/layout';
import type { FilmDoc, Item } from '../../film/types';
import { getPhoto } from '../../media/photos';
import { itemBox } from '../../render/compose';
import { useStudio } from '../../state/studio';
import { FilmCanvas } from '../FilmCanvas';

type Drag =
  | { kind: 'item'; id: string; dx: number; dy: number }
  | { kind: 'pan'; index: number; lastX: number; lastY: number }
  | null;

function hitItem(doc: FilmDoc, x: number, y: number): Item | null {
  for (let i = doc.items.length - 1; i >= 0; i--) {
    const it = doc.items[i];
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

export function Stage() {
  const { doc, apply, selection, setSelection } = useStudio();
  const layout = computeLayout(doc.format, doc.frames, doc.corners);
  const drag = useRef<Drag>(null);
  const scale = useRef(1);

  const toMm = (e: React.PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale.current, y: (e.clientY - r.top) / scale.current };
  };

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = toMm(e);
    const it = hitItem(doc, p.x, p.y);
    e.currentTarget.setPointerCapture(e.pointerId);
    if (it) {
      setSelection({ type: 'item', id: it.id });
      drag.current = { kind: 'item', id: it.id, dx: it.x - p.x, dy: it.y - p.y };
      return;
    }
    const si = layout.slots.findIndex((s) => p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h);
    if (si >= 0) {
      setSelection({ type: 'slot', index: si });
      drag.current = { kind: 'pan', index: si, lastX: p.x, lastY: p.y };
    } else {
      setSelection(null);
      drag.current = null;
    }
  };

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const p = toMm(e);
    if (d.kind === 'item') {
      apply((doc0) => ({ ...doc0, items: doc0.items.map((i) => (i.id === d.id ? { ...i, x: p.x + d.dx, y: p.y + d.dy } : i)) }), `move-${d.id}`);
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
        (doc0) => ({
          ...doc0,
          slots: doc0.slots.map((s, i) => (i === d.index ? { ...s, ox: spareX > 0.01 ? s.ox + ddx / spareX : s.ox, oy: spareY > 0.01 ? s.oy + ddy / spareY : s.oy } : s)),
        }),
        `pan-${d.index}`,
      );
    }
  };

  const up = () => {
    drag.current = null;
  };

  const key = (e: React.KeyboardEvent) => {
    if (selection?.type !== 'item') return;
    const step = e.shiftKey ? 2 : 0.5;
    const nudge = (dx: number, dy: number) => {
      e.preventDefault();
      apply((d) => ({ ...d, items: d.items.map((i) => (i.id === selection.id ? { ...i, x: i.x + dx, y: i.y + dy } : i)) }), `nudge-${selection.id}`);
    };
    if (e.key === 'ArrowLeft') nudge(-step, 0);
    else if (e.key === 'ArrowRight') nudge(step, 0);
    else if (e.key === 'ArrowUp') nudge(0, -step);
    else if (e.key === 'ArrowDown') nudge(0, step);
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      apply((d) => ({ ...d, items: d.items.filter((i) => i.id !== selection.id) }));
      setSelection(null);
    }
  };

  const sel = selection?.type === 'item' ? doc.items.find((i) => i.id === selection.id) : null;

  return (
    <FilmCanvas doc={doc} showEmpty label="Your film. Drag stickers and text to move them">
      {(pxPerMm) => {
        scale.current = pxPerMm;
        return (
          <div
            className="absolute inset-0 touch-none outline-offset-4"
            tabIndex={0}
            role="group"
            aria-label="Film editor. Select a sticker, then use arrow keys to move it, Delete to remove"
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onKeyDown={key}
          >
            {selection?.type === 'slot' &&
              layout.slots[selection.index] &&
              (() => {
                const s = layout.slots[selection.index];
                return <div className="pointer-events-none absolute border-[3px] border-dashed border-lemon" style={{ left: s.x * pxPerMm, top: s.y * pxPerMm, width: s.w * pxPerMm, height: s.h * pxPerMm, borderRadius: layout.slotRadius * pxPerMm, boxShadow: '0 0 0 2px var(--ink)' }} />;
              })()}
            {sel &&
              (() => {
                const b = itemBox(sel);
                const w = Math.max(b.w, 7) * pxPerMm + 10;
                const h = Math.max(b.h, 7) * pxPerMm + 10;
                return (
                  <div
                    className="pointer-events-none absolute rounded-lg border-[3px] border-dashed border-lemon"
                    style={{ left: sel.x * pxPerMm - w / 2, top: sel.y * pxPerMm - h / 2, width: w, height: h, transform: `rotate(${sel.rot}deg)`, boxShadow: '0 0 0 2px var(--ink)' }}
                  />
                );
              })()}
          </div>
        );
      }}
    </FilmCanvas>
  );
}
