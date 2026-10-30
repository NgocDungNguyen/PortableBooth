import { useEffect, useState } from 'react';
import { newSticker, newWidget } from '../../film/doc';
import { ensureSticker, FAMILIES, isMonoSticker, packEntries, packsOf, type Family } from '../../assets/library';
import { drawWidget, WIDGETS } from '../../render/widgets';
import { useStudio } from '../../state/studio';
import { Seg, useCanvas, useDropPoint } from './common';

type Tab = Family | 'widgets';
type Entry = { id: string; label: string; src: string };

function WidgetThumb({ id }: { id: string }) {
  const def = WIDGETS.find((w) => w.id === id)!;
  const ref = useCanvas((c) => {
    const src = drawWidget(id, { text: def.defaults.text, text2: def.defaults.text2, color: def.defaults.color, bg: def.defaults.bg }, 220);
    c.width = src.width;
    c.height = src.height;
    c.getContext('2d')?.drawImage(src, 0, 0);
  }, [id]);
  return <canvas ref={ref} aria-hidden className="max-h-16 max-w-full" />;
}

export function AddPanel() {
  const { doc, apply, setSelection } = useStudio();
  const drop = useDropPoint();
  const [tab, setTab] = useState<Tab>('icons');
  const packs = tab === 'widgets' ? [] : packsOf(tab);
  const [pack, setPack] = useState<string>('');
  const activePack = packs.find((p) => p.id === pack)?.id ?? packs[0]?.id ?? '';
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activePack) return setEntries([]);
    let live = true;
    setLoading(true);
    packEntries(activePack).then((e) => {
      if (live) {
        setEntries(e);
        setLoading(false);
      }
    });
    return () => {
      live = false;
    };
  }, [activePack]);

  const addSticker = async (id: string) => {
    await ensureSticker(id);
    const at = drop();
    const item = newSticker(id, isMonoSticker(id), at.x, at.y, doc.format === 'film35' ? 14 : 15);
    apply((d) => ({ ...d, items: [...d.items, item] }));
    setSelection({ type: 'item', id: item.id });
  };
  const addWidget = (wid: string) => {
    const def = WIDGETS.find((w) => w.id === wid)!;
    const at = drop();
    const item = newWidget(wid, def.defaults, at.x, at.y, doc.format === 'film35' ? 32 : 38);
    apply((d) => ({ ...d, items: [...d.items, item] }));
    setSelection({ type: 'item', id: item.id });
  };
  const mono = packsOf(tab === 'widgets' ? 'icons' : tab)[0]?.mono;

  return (
    <div className="flex flex-col gap-3">
      <Seg label="Library" value={tab} onChange={setTab} options={[...FAMILIES.map((f) => ({ id: f.id as Tab, label: f.label })), { id: 'widgets' as Tab, label: 'Widgets' }]} />
      {tab === 'widgets' ? (
        <div className="grid grid-cols-2 gap-2">
          {WIDGETS.map((w) => (
            <button key={w.id} onClick={() => addWidget(w.id)} aria-label={`Add ${w.name}`} className="tile h-24 flex-col gap-1 bg-[#7d828c] p-2">
              <WidgetThumb id={w.id} />
              <span className="text-[0.72rem] font-semibold text-white drop-shadow">{w.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <>
          {packs.length > 1 && (
            <div role="radiogroup" aria-label="Category" className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
              {packs.map((p) => (
                <button key={p.id} role="radio" aria-checked={activePack === p.id} className="chip" onClick={() => setPack(p.id)}>{p.label}</button>
              ))}
            </div>
          )}
          <div className={`grid grid-cols-5 gap-1.5 sm:grid-cols-7 md:grid-cols-5 ${loading ? 'opacity-50' : ''}`} aria-busy={loading}>
            {entries.map((e) => (
              <button key={e.id} onClick={() => addSticker(e.id)} aria-label={`Add ${e.label}`} className="tile aspect-square p-1.5">
                {packs.find((p) => p.id === activePack)?.mono && isMonoSticker(e.id) ? (
                  <span aria-hidden className="size-full bg-text" style={{ WebkitMaskImage: `url("${e.src}")`, maskImage: `url("${e.src}")`, WebkitMaskSize: 'contain', maskSize: 'contain', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskPosition: 'center' }} />
                ) : (
                  <img src={e.src} alt="" className="size-full object-contain" draggable={false} loading="lazy" />
                )}
              </button>
            ))}
          </div>
          {!loading && entries.length === 0 && <p className="label">Nothing here yet.</p>}
          {mono !== undefined && <span className="sr-only-text">{entries.length} items</span>}
        </div>
      )}
    </div>
  );
}
