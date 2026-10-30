import { Maximize2, Minus, Plus } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Zoom + pan for the film preview only (the page and the tool dock never zoom).
 * Touch: pinch with two fingers (and drag with two fingers to move). Trackpad: pinch. Mouse: Ctrl/Cmd + wheel,
 * plain wheel pans once zoomed. Buttons: zoom out, zoom in, fit.
 */
interface View {
  z: number;
  x: number;
  y: number;
}
interface ZoomCtx {
  /** live zoom factor, for converting pointer positions and counter-scaling handles */
  zoom: number;
  /** zoom after the gesture settles, for re-rendering the canvas sharper */
  detail: number;
  /** true while two fingers are down: the editor ignores those pointers */
  pinching: React.MutableRefObject<boolean>;
}
const Ctx = createContext<ZoomCtx>({ zoom: 1, detail: 1, pinching: { current: false } });
export const useZoom = () => useContext(Ctx);

const onFilm = (t: EventTarget | null) => t instanceof Element && !!t.closest('[data-film-editor], .zoom-bar');

const MIN = 1;
const MAX = 5;
const clampZ = (z: number) => Math.min(MAX, Math.max(MIN, z));

export function ZoomViewport({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ z: 1, x: 0, y: 0 });
  const [detail, setDetail] = useState(1);
  const viewRef = useRef(view);
  viewRef.current = view;
  const pinching = useRef(false);
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; cx: number; cy: number; v: View } | null>(null);
  const pan = useRef<{ x: number; y: number; v: View } | null>(null);

  /** keep at least a third of the content on screen */
  const clamp = useCallback((v: View): View => {
    const el = box.current;
    if (!el || v.z <= 1.0001) return { z: 1, x: 0, y: 0 };
    const w = el.clientWidth;
    const h = el.clientHeight;
    const minX = w / 3 - w * v.z;
    const minY = h / 3 - h * v.z;
    const maxX = (w * 2) / 3;
    const maxY = (h * 2) / 3;
    return { z: v.z, x: Math.min(maxX, Math.max(minX, v.x)), y: Math.min(maxY, Math.max(minY, v.y)) };
  }, []);

  /** zoom to `z` keeping the point (px, py) (container coordinates) still */
  const zoomAt = useCallback(
    (z: number, px: number, py: number, from: View = viewRef.current) => {
      const nz = clampZ(z);
      const k = nz / from.z;
      setView(clamp({ z: nz, x: px - (px - from.x) * k, y: py - (py - from.y) * k }));
    },
    [clamp],
  );

  // sharper canvas once the zoom stops changing
  useEffect(() => {
    const t = window.setTimeout(() => setDetail(view.z), 180);
    return () => clearTimeout(t);
  }, [view.z]);

  // wheel / trackpad: needs a non-passive listener to keep the page itself from zooming
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        // trackpad pinch sends small deltas, a mouse wheel ~100 per notch: cap each step at about 25%
        const dy = Math.max(-22, Math.min(22, e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY));
        zoomAt(viewRef.current.z * Math.exp(-dy * 0.01), e.clientX - r.left, e.clientY - r.top);
      } else if (viewRef.current.z > 1) {
        e.preventDefault();
        const v = viewRef.current;
        setView(clamp({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    // Safari trackpad pinch
    const stopGesture = (e: Event) => e.preventDefault();
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', stopGesture);
    el.addEventListener('gesturechange', stopGesture);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', stopGesture);
      el.removeEventListener('gesturechange', stopGesture);
    };
  }, [zoomAt, clamp]);

  const local = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const pair = () => {
    const [a, b] = [...pts.current.values()];
    return { d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  };

  const onDownCapture = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    pts.current.set(e.pointerId, local(e));
    if (pts.current.size === 2) {
      pinching.current = true;
      pinch.current = { ...pair(), v: viewRef.current };
      e.stopPropagation();
    }
  };
  const onMoveCapture = (e: React.PointerEvent) => {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, local(e));
    const p = pinch.current;
    if (!p || pts.current.size < 2) return;
    e.stopPropagation();
    const now = pair();
    const nz = clampZ(p.v.z * (now.d / p.d));
    const k = nz / p.v.z;
    // scale about the starting midpoint, then follow the midpoint (two-finger pan)
    setView(clamp({ z: nz, x: now.cx - (p.cx - p.v.x) * k, y: now.cy - (p.cy - p.v.y) * k }));
  };
  const onUpCapture = (e: React.PointerEvent) => {
    if (!pts.current.delete(e.pointerId)) return;
    if (pinching.current) e.stopPropagation();
    if (pts.current.size < 2) pinch.current = null;
    if (pts.current.size === 0) pinching.current = false;
  };

  // drag the empty area around the film to move a zoomed view (mouse or one finger)
  const onDown = (e: React.PointerEvent) => {
    if (viewRef.current.z <= 1 || onFilm(e.target)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pan.current = { ...local(e), v: viewRef.current };
  };
  const onMove = (e: React.PointerEvent) => {
    const p = pan.current;
    if (!p || pinching.current) return;
    const at = local(e);
    setView(clamp({ ...p.v, x: p.v.x + at.x - p.x, y: p.v.y + at.y - p.y }));
  };
  const onUp = () => {
    pan.current = null;
  };

  const centre = () => {
    const el = box.current;
    return el ? { x: el.clientWidth / 2, y: el.clientHeight / 2 } : { x: 0, y: 0 };
  };
  const step = (f: number) => {
    const c = centre();
    zoomAt(viewRef.current.z * f, c.x, c.y);
  };

  return (
    <Ctx.Provider value={{ zoom: view.z, detail, pinching }}>
      <div
        ref={box}
        className="absolute inset-0 touch-none overflow-hidden"
        onPointerDownCapture={onDownCapture}
        onPointerMoveCapture={onMoveCapture}
        onPointerUpCapture={onUpCapture}
        onPointerCancelCapture={onUpCapture}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onDoubleClick={(e) => {
          if (!onFilm(e.target)) setView({ z: 1, x: 0, y: 0 });
        }}
      >
        <div
          className="absolute inset-0 origin-top-left p-4 md:p-8"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`, pointerEvents: 'none' }}
        >
          <div className="pointer-events-auto h-full w-full">{children}</div>
        </div>
        <div className="zoom-bar" role="group" aria-label="Preview zoom">
          <button type="button" className="zoom-btn" onClick={() => step(1 / 1.4)} disabled={view.z <= MIN} aria-label="Zoom out">
            <Minus size={16} aria-hidden />
          </button>
          <button type="button" className="zoom-btn num w-14 text-xs" onClick={() => setView({ z: 1, x: 0, y: 0 })} aria-label={`Zoom ${Math.round(view.z * 100)}%, fit to screen`} title="Fit">
            {view.z > 1.01 ? `${Math.round(view.z * 100)}%` : <Maximize2 size={15} aria-hidden />}
          </button>
          <button type="button" className="zoom-btn" onClick={() => step(1.4)} disabled={view.z >= MAX} aria-label="Zoom in">
            <Plus size={16} aria-hidden />
          </button>
        </div>
      </div>
    </Ctx.Provider>
  );
}
