import { Camera, ImageOff, ImagePlus, Smartphone, Upload } from 'lucide-react';
import { useMemo } from 'react';
import { filledCount } from '../../film/doc';
import { classifyCameraSupport, hasCoarsePointer } from '../../media/capture';
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
  // the phone's own camera app is the natural button on touch devices, and the only working one when the live camera is blocked
  const liveBlocked = useMemo(() => classifyCameraSupport() !== null, []);
  const showPhoneCamera = useMemo(() => liveBlocked || hasCoarsePointer(), [liveBlocked]);
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
        {showPhoneCamera && (
          <button className="btn mt-2 w-full" onClick={() => intake.nativeCamera(null)}>
            <Smartphone size={18} aria-hidden /> Phone camera
          </button>
        )}
        <p className="mt-2 text-xs text-muted">
          {liveBlocked ? "The live camera can't open on this page. Use your phone's camera instead." : "We'll ask to use your camera."} Photos never leave your device.
        </p>
      </Section>
      <Section title="Slots" aside={<span className="num text-xs text-muted">{filledCount(doc)}/{doc.slots.length}</span>}>
        <div className="grid grid-cols-4 gap-2">
          {doc.slots.map((s, i) => (
            <div key={i} className="relative">
              <button role="radio" aria-checked={selection?.type === 'slot' && selection.index === i} aria-label={`Photo ${i + 1}${s.photoId ? '' : ' (empty)'}`} className="tile aspect-square w-full" onClick={() => setSelection({ type: 'slot', index: i })}>
                {s.photoId ? <SlotThumb photoId={s.photoId} /> : <span className="flex flex-col items-center gap-0.5 text-muted"><ImagePlus size={18} aria-hidden /><span className="text-[0.7rem] font-semibold">Slot {i + 1}</span></span>}
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
