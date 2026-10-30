import { CalendarDays, Square, SquareRoundCorner, Tag } from 'lucide-react';
import { FRAME_COLORS } from '../../film/doc';
import { FRAME_STYLES, paintFrameBody } from '../../render/frames';
import { useStudio } from '../../state/studio';
import { Section, Seg, Swatches, useCanvas } from './common';

function StyleThumb({ style, color, color2 }: { style: string; color: string; color2: string }) {
  const ref = useCanvas((c) => {
    c.width = 60;
    c.height = 84;
    const x = c.getContext('2d');
    if (!x) return;
    x.clearRect(0, 0, 60, 84);
    paintFrameBody(x, 60, 84, { style, color, color2, ppm: 1.2, radiusMm: 2, seed: 3 });
    x.fillStyle = 'rgba(128,128,128,0.35)';
    x.fillRect(8, 8, 44, 52);
  }, [style, color, color2]);
  return <canvas ref={ref} width={60} height={84} aria-hidden className="h-[4.5rem] w-auto" />;
}

export function FramePanel() {
  const { doc, apply } = useStudio();
  const usesC2 = FRAME_STYLES.find((s) => s.id === doc.frameStyle)?.usesColor2;
  return (
    <div>
      <Section title="Style">
        <div role="radiogroup" aria-label="Frame style" className="grid grid-cols-4 gap-2 md:grid-cols-3">
          {FRAME_STYLES.map((s) => (
            <button key={s.id} role="radio" aria-checked={doc.frameStyle === s.id} aria-label={s.name} onClick={() => apply((d) => ({ ...d, frameStyle: s.id }))} className="tile flex-col gap-1 py-2">
              <StyleThumb style={s.id} color={doc.frameColor} color2={doc.frameColor2} />
              <span className="text-[0.72rem] font-semibold">{s.name}</span>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Colour">
        <Swatches label="Film colour" colors={FRAME_COLORS} value={doc.frameColor} onChange={(c, k) => c && apply((d) => ({ ...d, frameColor: c }), k)} />
      </Section>
      {usesC2 && (
        <Section title="Accent colour">
          <Swatches label="Accent colour" colors={FRAME_COLORS} value={doc.frameColor2} onChange={(c, k) => c && apply((d) => ({ ...d, frameColor2: c }), k)} />
        </Section>
      )}
      <Section title="Corners">
        <Seg label="Corners" value={doc.corners} onChange={(v) => apply((d) => ({ ...d, corners: v }))} options={[{ id: 'square', label: 'Square', icon: <Square size={16} aria-hidden /> }, { id: 'round', label: 'Round', icon: <SquareRoundCorner size={16} aria-hidden /> }]} />
      </Section>
      <Section title="Details">
        <div className="flex flex-wrap items-center gap-2">
          <button className="chip chip-tall" aria-pressed={doc.dateStamp} onClick={() => apply((d) => ({ ...d, dateStamp: !d.dateStamp }))}><CalendarDays size={16} aria-hidden /> Date</button>
          <input type="date" aria-label="Date on the film" value={doc.date} disabled={!doc.dateStamp} onChange={(e) => e.target.value && apply((d) => ({ ...d, date: e.target.value }), 'date')} className="disabled:opacity-40" />
          <button className="chip chip-tall" aria-pressed={doc.brandMark} onClick={() => apply((d) => ({ ...d, brandMark: !d.brandMark }))}><Tag size={16} aria-hidden /> Logo</button>
        </div>
      </Section>
    </div>
  );
}
