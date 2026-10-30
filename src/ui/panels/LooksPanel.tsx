import { Blend, CircleDot, Cloud, Contrast, Droplet, Grip, Shuffle, Sparkles, Sun, Thermometer, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { DEFAULT_ADJUST, MAX_OVERLAYS } from '../../film/doc';
import { FILTER_FAMILIES, FILTERS } from '../../film/filters';
import type { AdjustParams } from '../../film/types';
import { getPhoto } from '../../media/photos';
import { drawOverlay, OVERLAYS } from '../../render/overlays';
import { renderFilterThumb } from '../../render/compose';
import { FRAME_STYLES } from '../../render/frames';
import { sceneCanvas } from '../../samples';
import { useStudio } from '../../state/studio';
import { Slider } from '../Slider';
import { drawCoverSimple } from '../util';
import { Seg, Section, useCanvas } from './common';

function FilterThumb({ photoId, filterId }: { photoId: string | null; filterId: string }) {
  const ref = useCanvas((c) => {
    const ph = getPhoto(photoId);
    if (ph) renderFilterThumb(c, ph, filterId, 112);
  }, [photoId, filterId]);
  return <canvas ref={ref} width={112} height={112} aria-hidden className="aspect-square w-full" />;
}

function OverlayThumb({ id, photoId }: { id: string; photoId: string | null }) {
  const ref = useCanvas((c) => {
    c.width = 112;
    c.height = 112;
    const x = c.getContext('2d');
    if (!x) return;
    const ph = getPhoto(photoId);
    drawCoverSimple(x, ph ? ph.canvas : sceneCanvas(1, 112, 112), 112, 112);
    drawOverlay(x, id, { x: 0, y: 0, w: 112, h: 112 }, 0.9, 5, 2);
  }, [id, photoId]);
  return <canvas ref={ref} width={112} height={112} aria-hidden className="aspect-square w-full" />;
}

const ADJ: { key: keyof AdjustParams; label: string; Icon: typeof Sun; bipolar: boolean }[] = [
  { key: 'intensity', label: 'Strength', Icon: Blend, bipolar: false },
  { key: 'brightness', label: 'Light', Icon: Sun, bipolar: true },
  { key: 'contrast', label: 'Contrast', Icon: Contrast, bipolar: true },
  { key: 'saturation', label: 'Colour', Icon: Droplet, bipolar: true },
  { key: 'warmth', label: 'Warmth', Icon: Thermometer, bipolar: true },
  { key: 'fade', label: 'Fade', Icon: Cloud, bipolar: false },
  { key: 'grain', label: 'Grain', Icon: Grip, bipolar: false },
  { key: 'glow', label: 'Glow', Icon: Sparkles, bipolar: false },
  { key: 'vignette', label: 'Vignette', Icon: CircleDot, bipolar: false },
];

type Sub = 'filters' | 'adjust' | 'overlays';

export function LooksPanel() {
  const { doc, apply, selection } = useStudio();
  const [sub, setSub] = useState<Sub>('filters');
  const [family, setFamily] = useState<string>('all');
  const slotIdx = selection?.type === 'slot' ? selection.index : null;
  const [scope, setScope] = useState<'all' | 'one'>('all');
  const effScope = scope === 'one' && slotIdx !== null ? 'one' : 'all';
  const thumbPhoto = (slotIdx !== null ? doc.slots[slotIdx].photoId : null) ?? doc.slots.find((s) => s.photoId)?.photoId ?? null;
  const current = effScope === 'one' && slotIdx !== null ? doc.slots[slotIdx].filterId ?? doc.filterId : doc.filterId;
  const list = FILTERS.filter((f) => family === 'all' || f.family === family);

  const setFilter = (id: string) =>
    apply((d) =>
      effScope === 'one' && slotIdx !== null
        ? { ...d, slots: d.slots.map((s, i) => (i === slotIdx ? { ...s, filterId: id } : s)) }
        : { ...d, filterId: id, slots: d.slots.map((s) => ({ ...s, filterId: null })) },
    );

  const surprise = () => {
    const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
    apply((d) => ({
      ...d,
      filterId: pick(FILTERS.filter((f) => f.id !== 'original')).id,
      slots: d.slots.map((s) => ({ ...s, filterId: null })),
      frameStyle: pick(FRAME_STYLES.filter((f) => f.id !== 'noise-film' || d.format === 'film35')).id,
      overlays: Math.random() < 0.6 ? [{ id: pick(OVERLAYS).id, opacity: 0.6 }] : [],
    }));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-0 z-10 -mx-4 -mt-3 flex flex-col gap-2 bg-surface px-4 pb-2 pt-3">
      <div className="flex items-center gap-2">
        <Seg label="Looks" value={sub} onChange={setSub} options={[{ id: 'filters', label: 'Filters' }, { id: 'adjust', label: 'Adjust' }, { id: 'overlays', label: 'Overlays' }]} />
        <button className="btn btn-icon" onClick={surprise} aria-label="Surprise me" title="Surprise me"><Shuffle size={18} aria-hidden /></button>
      </div>
      {sub === 'filters' && (
        <>
          <Seg label="Apply to" value={effScope} onChange={setScope} options={[{ id: 'all', label: 'All photos' }, { id: 'one', label: slotIdx !== null ? `Photo ${slotIdx + 1}` : 'One photo' }]} />
          <div role="radiogroup" aria-label="Filter family" className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
            {[{ id: 'all', label: 'All' }, ...FILTER_FAMILIES].map((f) => (
              <button key={f.id} role="radio" aria-checked={family === f.id} className="chip" onClick={() => setFamily(f.id)}>{f.label}</button>
            ))}
          </div>
        </>
      )}
      </div>
      {sub === 'filters' && (
        <>
          {effScope === 'all' && scope === 'one' && <p className="label">Select a photo on the film first.</p>}
          <div role="radiogroup" aria-label="Filter" className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-3">
            {list.map((f) => (
              <button key={f.id} role="radio" aria-checked={current === f.id} aria-label={f.name} onClick={() => setFilter(f.id)} className="tile flex-col !place-items-stretch">
                <FilterThumb photoId={thumbPhoto} filterId={f.id} />
                <span className="truncate px-1 py-1 text-center text-[0.72rem] font-semibold">{f.name}</span>
              </button>
            ))}
          </div>
          <Slider label="Strength" icon={<Blend size={15} aria-hidden />} value={doc.adjust.intensity} min={0} max={1} onChange={(v) => apply((d) => ({ ...d, adjust: { ...d.adjust, intensity: v } }), 'adj-intensity')} format={(v) => `${Math.round(v * 100)}`} />
        </>
      )}
      {sub === 'adjust' && (
        <div className="flex flex-col">
          {ADJ.map(({ key, label, Icon, bipolar }) => (
            <Slider key={key} label={label} icon={<Icon size={15} aria-hidden />} value={doc.adjust[key]} min={bipolar ? -1 : 0} max={1} onChange={(v) => apply((d) => ({ ...d, adjust: { ...d.adjust, [key]: v } }), `adj-${key}`)} format={(v) => `${Math.round(v * 100)}`} />
          ))}
          <button className="btn btn-sm mt-2 self-start" onClick={() => apply((d) => ({ ...d, adjust: { ...DEFAULT_ADJUST } }))}>
            <RotateCcw size={16} aria-hidden /> Reset
          </button>
        </div>
      )}
      {sub === 'overlays' && (
        <>
          <p className="label">Up to {MAX_OVERLAYS} at once, over every photo.</p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-3">
            {OVERLAYS.map((o) => {
              const on = doc.overlays.some((x) => x.id === o.id);
              return (
                <button
                  key={o.id}
                  aria-pressed={on}
                  aria-label={o.name}
                  onClick={() => apply((d) => (on ? { ...d, overlays: d.overlays.filter((x) => x.id !== o.id) } : { ...d, overlays: [...d.overlays, { id: o.id, opacity: 0.7 }].slice(-MAX_OVERLAYS) }))}
                  className="tile flex-col !place-items-stretch"
                >
                  <OverlayThumb id={o.id} photoId={thumbPhoto} />
                  <span className="truncate px-1 py-1 text-center text-[0.72rem] font-semibold">{o.name}</span>
                </button>
              );
            })}
          </div>
          {doc.overlays.length > 0 && (
            <Section title="Active">
              {doc.overlays.map((o) => (
                <Slider key={o.id} label={OVERLAYS.find((x) => x.id === o.id)?.name ?? o.id} value={o.opacity} min={0} max={1} onChange={(v) => apply((d) => ({ ...d, overlays: d.overlays.map((x) => (x.id === o.id ? { ...x, opacity: v } : x)) }), `ov-${o.id}`)} />
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}
