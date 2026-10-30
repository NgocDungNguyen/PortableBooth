import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { computeLayout } from '../film/layout';
import type { FilmDoc } from '../film/types';
import { usePhotosVersion } from '../media/photos';
import { renderFilm } from '../render/compose';
import { useAssetsReady } from './useAssets';

interface Props {
  doc: FilmDoc;
  /** fixed CSS width; otherwise the film fills its parent (contain) */
  width?: number;
  showEmpty?: boolean;
  label: string;
  className?: string;
  children?: (pxPerMm: number) => ReactNode;
}

/** Live film preview. Same renderer as the export, just at screen resolution. */
export function FilmCanvas({ doc, width, showEmpty, label, className = '', children }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const ready = useAssetsReady();
  const photosVersion = usePhotosVersion();
  const layout = computeLayout(doc.format, doc.frames, doc.corners, doc.orientation);

  useLayoutEffect(() => {
    if (width || !wrap.current) return;
    const el = wrap.current;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [width]);

  const pxPerMm = width ? width / layout.widthMm : Math.max(0, Math.min(box.w / layout.widthMm, box.h / layout.heightMm));
  const cssW = layout.widthMm * pxPerMm;
  const cssH = layout.heightMm * pxPerMm;

  useEffect(() => {
    if (!ready || !canvas.current || pxPerMm <= 0) return;
    const raf = requestAnimationFrame(() => {
      if (!canvas.current) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      renderFilm(canvas.current, doc, { ppm: pxPerMm * dpr, showEmpty });
    });
    return () => cancelAnimationFrame(raf);
  }, [doc, ready, pxPerMm, showEmpty, photosVersion]);

  return (
    <div ref={wrap} className={`${width ? '' : 'h-full w-full'} flex items-center justify-center ${className}`}>
      <div className="relative" style={{ width: cssW, height: cssH }}>
        <canvas ref={canvas} role="img" aria-label={label} className="block h-full w-full" style={{ filter: 'drop-shadow(0 10px 18px rgba(23,22,58,0.28))' }} />
        {children?.(pxPerMm)}
      </div>
    </div>
  );
}
