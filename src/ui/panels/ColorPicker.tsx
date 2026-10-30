import { Check, Pipette } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/** HSV <-> hex, all channels 0..1 (h 0..360) */
export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0xffffff;
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}
export function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255);
  };
  return `#${[f(5), f(3), f(1)].map((x) => x.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}
export const isHex = (c: string | null | undefined): c is string => !!c && /^#[0-9a-f]{6}$/i.test(c);

/** colours picked during this visit (memory only, like everything else) */
const recent: string[] = [];
export const recentColors = () => recent;
function remember(c: string) {
  const i = recent.indexOf(c);
  if (i >= 0) recent.splice(i, 1);
  recent.unshift(c);
  recent.length = Math.min(recent.length, 6);
}

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };

/**
 * Inline picker: saturation/brightness square, hue strip, hex field, eyedropper where supported.
 * `onChange(c, live)`: live = true while dragging (callers coalesce those into one undo step).
 */
export function ColorPicker({ value, label, onChange, onClose }: { value: string | null; label: string; onChange: (c: string, live: boolean) => void; onClose: () => void }) {
  const [hsv, setHsv] = useState(() => hexToHsv(isHex(value) ? value : '#FF4F5E'));
  const [text, setText] = useState(() => hsvToHex(hsv.h, hsv.s, hsv.v));
  const hex = hsvToHex(hsv.h, hsv.s, hsv.v);
  const sv = useRef<HTMLDivElement>(null);
  const hue = useRef<HTMLDivElement>(null);
  const eye = typeof window !== 'undefined' ? (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper : undefined;

  // follow outside changes (undo, preset swatch) when they are not ours
  useEffect(() => {
    if (isHex(value) && value.toUpperCase() !== hex) {
      const next = hexToHsv(value);
      setHsv(next);
      setText(value.toUpperCase());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = (n: { h: number; s: number; v: number }, live: boolean) => {
    setHsv(n);
    const c = hsvToHex(n.h, n.s, n.v);
    setText(c);
    onChange(c, live);
    if (!live) remember(c);
  };

  const drag = (el: React.RefObject<HTMLDivElement | null>, at: (x: number, y: number) => { h: number; s: number; v: number }) => (e: React.PointerEvent) => {
    const box = el.current;
    if (!box) return;
    e.preventDefault();
    box.setPointerCapture(e.pointerId);
    const pos = (ev: { clientX: number; clientY: number }) => {
      const r = box.getBoundingClientRect();
      return at(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)));
    };
    let last = pos(e);
    emit(last, true);
    const move = (ev: PointerEvent) => {
      last = pos(ev);
      emit(last, true);
    };
    const up = () => {
      emit(last, false);
      box.removeEventListener('pointermove', move);
      box.removeEventListener('pointerup', up);
      box.removeEventListener('pointercancel', up);
    };
    box.addEventListener('pointermove', move);
    box.addEventListener('pointerup', up);
    box.addEventListener('pointercancel', up);
  };

  const svKey = (e: React.KeyboardEvent) => {
    const d = e.shiftKey ? 0.1 : 0.02;
    const m: Record<string, [number, number]> = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, d], ArrowDown: [0, -d] };
    const step = m[e.key];
    if (!step) return;
    e.preventDefault();
    emit({ ...hsv, s: Math.min(1, Math.max(0, hsv.s + step[0])), v: Math.min(1, Math.max(0, hsv.v + step[1])) }, false);
  };
  const hueKey = (e: React.KeyboardEvent) => {
    const d = (e.shiftKey ? 15 : 3) * (e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : 0);
    if (!d) return;
    e.preventDefault();
    emit({ ...hsv, h: (hsv.h + d + 360) % 360 }, false);
  };

  const commitText = (t: string) => {
    const c = t.trim().startsWith('#') ? t.trim() : `#${t.trim()}`;
    if (isHex(c)) emit(hexToHsv(c), false);
    else setText(hex);
  };

  return (
    <div className="color-picker" role="group" aria-label={`${label}: custom colour`}>
      <div
        ref={sv}
        className="cp-sv"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))` }}
        onPointerDown={drag(sv, (x, y) => ({ h: hsv.h, s: x, v: 1 - y }))}
        role="slider"
        tabIndex={0}
        aria-label="Saturation and brightness"
        aria-valuetext={`saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
        aria-valuenow={Math.round(hsv.s * 100)}
        onKeyDown={svKey}
      >
        <span className="cp-thumb" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hex }} />
      </div>
      <div
        ref={hue}
        className="cp-hue"
        onPointerDown={drag(hue, (x) => ({ ...hsv, h: Math.min(359.9, x * 360) }))}
        role="slider"
        tabIndex={0}
        aria-label="Hue"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.h)}
        onKeyDown={hueKey}
      >
        <span className="cp-thumb" style={{ left: `${(hsv.h / 360) * 100}%`, top: '50%', background: `hsl(${hsv.h} 100% 50%)` }} />
      </div>
      <div className="flex items-center gap-2">
        <span className="size-9 shrink-0 rounded-full border border-line-strong" style={{ background: hex }} aria-hidden />
        <input
          type="text"
          aria-label="Hex colour"
          className="num min-w-0 flex-1 uppercase"
          value={text}
          maxLength={7}
          spellCheck={false}
          onChange={(e) => {
            setText(e.target.value);
            const c = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
            if (isHex(c)) emit(hexToHsv(c), false);
          }}
          onBlur={(e) => commitText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commitText((e.target as HTMLInputElement).value)}
        />
        {eye && (
          <button
            type="button"
            className="btn btn-icon"
            aria-label="Pick a colour from the screen"
            title="Eyedropper"
            onClick={() => {
              new eye()
                .open()
                .then((r) => isHex(r.sRGBHex) && emit(hexToHsv(r.sRGBHex), false))
                .catch(() => {});
            }}
          >
            <Pipette size={17} aria-hidden />
          </button>
        )}
        <button type="button" className="btn btn-icon" onClick={onClose} aria-label="Done choosing colour" title="Done">
          <Check size={18} aria-hidden />
        </button>
      </div>
    </div>
  );
}
