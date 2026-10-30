import { useMemo } from 'react';
import { qrSvgPath } from '../../media/share';

/** Locally generated QR code, always black on white with a quiet zone so any camera can read it in either theme. */
export function QrCode({ text, label, className = '' }: { text: string; label: string; className?: string }) {
  const q = useMemo(() => qrSvgPath(text, 4), [text]);
  return (
    <svg
      viewBox={`0 0 ${q.size} ${q.size}`}
      role="img"
      aria-label={label}
      data-qr={text}
      shapeRendering="crispEdges"
      className={`block aspect-square rounded-xl bg-white ${className}`}
    >
      <rect width={q.size} height={q.size} fill="#ffffff" />
      <path d={q.d} fill="#000000" />
    </svg>
  );
}
