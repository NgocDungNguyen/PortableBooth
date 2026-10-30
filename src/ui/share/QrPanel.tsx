import { useState } from 'react';
import type { FilmDoc } from '../../film/types';
import { appUrl, lookUrl } from '../../media/share';
import { Seg } from '../panels/common';
import { QrCode } from './QrCode';

export type QrMode = 'app' | 'look';

/** "Scan to make yours" (the app) / "Scan to get this look" (format, frames, filter, frame style; no photos, nothing personal). */
export function QrPanel({ doc, mode, onMode, headingRef }: { doc: FilmDoc; mode: QrMode; onMode: (m: QrMode) => void; headingRef?: React.Ref<HTMLHeadingElement> }) {
  const [href] = useState(() => location.href);
  const text = mode === 'app' ? appUrl(href) : lookUrl(doc, href);
  return (
    <section className="panel flex flex-col gap-3 p-3" aria-labelledby="qr-title">
      <h3 id="qr-title" ref={headingRef} tabIndex={-1} className="text-sm font-semibold">Scan with another phone</h3>
      <Seg label="QR code" value={mode} onChange={onMode} options={[{ id: 'app', label: 'Make yours' }, { id: 'look', label: 'Get this look' }]} />
      <div className="flex items-center gap-3">
        <QrCode text={text} label={mode === 'app' ? 'QR code that opens PortableBooth' : 'QR code that opens PortableBooth with this look'} className="w-28 shrink-0 border border-line2 p-0.5" />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm font-semibold">{mode === 'app' ? 'Scan to make yours' : 'Scan to get this look'}</p>
          <p className="text-xs text-muted">{mode === 'app' ? 'Opens PortableBooth on their phone.' : 'Same film, frames, filter and frame. No photos.'}</p>
          <p className="text-xs text-muted">A QR code is too small to hold the photo itself: use Send or Share for that.</p>
        </div>
      </div>
    </section>
  );
}
