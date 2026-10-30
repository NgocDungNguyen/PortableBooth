import { Camera, ImageOff, Upload } from 'lucide-react';
import { filledCount } from '../../film/doc';
import { getPhoto } from '../../media/photos';
import { useStudio } from '../../state/studio';
import { drawCoverSimple } from '../util';
import { useIntake } from '../intake';
import { Section, useCanvas } from './common';

function SlotThumb({ photoId }: { photoId: string | null }) {
  const ref = useCanvas((c) => {
    const ph = getPhoto(photoId);
    const x = c.getContext('2d');
    if (!x) return;
    c.width = 96;
    c.height = 96;
    x.clearRect(0, 0, 96, 96);
    if (ph) drawCoverSimple(x, ph.canvas, 96, 96);
  }, [photoId]);
  return <canvas ref={ref} width={96} height={96} aria-hidden className="size-full object-cover" />;
}

export function PhotosPanel() {
  const { doc, selection, setSelection, apply } = useStudio();
  const intake = useIntake();
  return (
    <div>
      <Section title="Add photos">
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-primary btn-lg flex-col !h-20 gap-1" onClick={() => intake.camera(null)}>
            <Camera size={22} aria-hidden /> Camera
          </button>
          <button className="btn btn-lg flex-col !h-20 gap-1" onClick={() => intake.pick(null)}>
            <Upload size={22} aria-hidden /> Upload
          </button>
        </div>
      </Section>
      <Section title="Slots" aside={<span className="num text-xs text-muted">{filledCount(doc)}/{doc.slots.length}</span>}>
        <div className="grid grid-cols-4 gap-2">
          {doc.slots.map((s, i) => (
            <div key={i} className="relative">
              <button role="radio" aria-checked={selection?.type === 'slot' && selection.index === i} aria-label={`Photo ${i + 1}${s.photoId ? '' : ' (empty)'}`} className="tile aspect-square w-full" onClick={() => setSelection({ type: 'slot', index: i })}>
                {s.photoId ? <SlotThumb photoId={s.photoId} /> : <span className="num text-lg text-muted">{i + 1}</span>}
              </button>
              {s.photoId && (
                <button className="btn btn-icon btn-ghost absolute -right-1 -top-1 !min-h-8 !min-w-8 rounded-full bg-bg/80" aria-label={`Remove photo ${i + 1}`} onClick={() => apply((d) => ({ ...d, slots: d.slots.map((x, k) => (k === i ? { ...x, photoId: null, zoom: 1, ox: 0, oy: 0 } : x)) }))}>
                  <ImageOff size={14} aria-hidden />
                </button>
              )}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
