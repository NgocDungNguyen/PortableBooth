import { Type } from 'lucide-react';
import { useState } from 'react';
import { MAX_TEXT, newText } from '../../film/doc';
import type { FontId, TextItem } from '../../film/types';
import { useStudio } from '../../state/studio';
import { useDropPoint, Section } from './common';

const PRESETS: { name: string; text: string; font: FontId; size: number; color: string; tracking: number; bg: string | null; outline?: { color: string; width: number }; shadow?: boolean; rot?: number }[] = [
  { name: 'Title', text: 'SUMMER', font: 'condensed', size: 10, color: '#FFFFFF', tracking: 0.12, bg: null, shadow: true },
  { name: 'Serif', text: 'moments', font: 'serif', size: 9, color: '#FFFFFF', tracking: 0, bg: null, shadow: true },
  { name: 'Script', text: 'good times', font: 'script', size: 9, color: '#FFFFFF', tracking: 0, bg: null, shadow: true, rot: -4 },
  { name: 'Label', text: 'camera roll', font: 'mono', size: 3.6, color: '#0F0F12', tracking: 0.04, bg: '#FFD66B' },
  { name: 'Neon', text: 'night out', font: 'wide', size: 6, color: '#FFFFFF', tracking: 0.02, bg: null, outline: { color: '#FF5C7A', width: 0.45 }, shadow: true },
  { name: 'Marker', text: 'best day', font: 'marker', size: 7, color: '#FFFFFF', tracking: 0, bg: null, shadow: true, rot: -3 },
  { name: 'Type', text: 'dear diary', font: 'type', size: 4.4, color: '#0F0F12', tracking: 0.02, bg: '#F4EFE6' },
  { name: 'Pixel', text: 'LEVEL UP', font: 'pixel', size: 7, color: '#7CE0B5', tracking: 0.06, bg: null, shadow: true },
];

export function TextPanel() {
  const { doc, apply, setSelection } = useStudio();
  const drop = useDropPoint();
  const [draft, setDraft] = useState('');

  const add = (p?: (typeof PRESETS)[number]) => {
    const at = drop();
    const t: TextItem = {
      ...newText(p ? p.text : draft.trim() || 'hello', p?.color ?? '#FFFFFF', at.x, at.y),
      ...(p ? { font: p.font, size: p.size, tracking: p.tracking, bg: p.bg, rot: p.rot ?? 0, shadow: !!p.shadow, outline: p.outline ?? null } : {}),
    };
    if (p && draft.trim()) t.text = draft.trim().slice(0, MAX_TEXT);
    apply((d) => ({ ...d, items: [...d.items, t] }));
    setSelection({ type: 'item', id: t.id });
    setDraft('');
  };
  void doc;

  return (
    <div>
      <Section title="Add text">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <input type="text" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={MAX_TEXT} placeholder="Type something" aria-label="Text" className="min-w-0 flex-1" />
          <button type="submit" className="btn btn-primary btn-icon" aria-label="Add text"><Type size={20} aria-hidden /></button>
        </form>
      </Section>
      <Section title="Styles">
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((p) => (
            <button key={p.name} onClick={() => add(p)} aria-label={`Add ${p.name} text`} className="tile h-16 bg-[#6f747e]">
              <span style={{ fontFamily: `var(--f-${p.font})`, color: p.color, fontSize: '1.15rem', letterSpacing: `${p.tracking}em`, background: p.bg ?? undefined, padding: p.bg ? '0 0.4em' : undefined, borderRadius: 4, WebkitTextStroke: p.outline ? `1px ${p.outline.color}` : undefined, textShadow: p.shadow ? '0 1px 6px rgba(0,0,0,.5)' : undefined }}>
                {p.text}
              </span>
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}
