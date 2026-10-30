import {
  BatteryFull, Camera, Download, Ellipsis, Film, Frame, House, Layers, Monitor, Moon, Redo2, ShieldCheck, Signal, Smile, Smartphone,
  Sparkles, Sun, Type, Undo2, Wifi,
} from 'lucide-react';
import { useMemo } from 'react';
import { FILTERS } from '../../film/filters';
import type { FilmDoc } from '../../film/types';
import { FilmCanvas } from '../FilmCanvas';
import { previewDoc } from '../previewDocs';

const TOOLS = [
  { Icon: Film, t: 'Film' },
  { Icon: Camera, t: 'Photos' },
  { Icon: Sparkles, t: 'Looks' },
  { Icon: Frame, t: 'Frame' },
  { Icon: Smile, t: 'Add' },
  { Icon: Type, t: 'Text' },
  { Icon: Layers, t: 'Layers' },
];
const filterName = (id: string) => FILTERS.find((f) => f.id === id)?.name ?? id;

/**
 * The mobile studio in miniature (laid out at 390x844 inside <Phone>): status bar, header, the stage with a
 * real live film, the tool dock on Looks and a row of filter thumbnails. Purely decorative (aria-hidden by
 * the caller); nothing in here is focusable.
 */
export function PhoneStudio({ doc, look, looks, print }: { doc: FilmDoc; look: string; looks: string[]; print: boolean }) {
  const around = useMemo(() => {
    const i = Math.max(0, looks.indexOf(look));
    return [0, 1, 2, 3].map((k) => looks[(i - 1 + k + looks.length) % looks.length]);
  }, [look, looks]);
  return (
    <div className="mini flex h-full flex-col bg-bg text-text">
      <div className="flex h-[54px] shrink-0 items-center justify-between px-8 pt-1 text-[15px] font-semibold">
        <span className="num" style={{ fontFamily: 'var(--font-sans)' }}>9:41</span>
        <span className="flex items-center gap-1.5">
          <Signal size={16} strokeWidth={2.6} /> <Wifi size={16} strokeWidth={2.6} /> <BatteryFull size={22} strokeWidth={2} />
        </span>
      </div>
      <div className="flex h-[56px] shrink-0 items-center justify-between px-4">
        <House size={22} />
        <span className="flex items-center gap-6 text-muted">
          <Undo2 size={21} className="text-text" /> <Redo2 size={21} className="opacity-50" /> <Ellipsis size={21} className="text-text" />
        </span>
        <span className="mini-export"><Download size={17} /> Export</span>
      </div>
      <div className="stage-bg relative min-h-0 flex-1 overflow-hidden px-10 pb-5 pt-0">
        <span className="mini-slot" />
        <div className="h-full overflow-hidden pt-3">
          <div className={`h-full ${print ? 'home-print' : ''}`}>
            <FilmCanvas doc={doc} label="" />
          </div>
        </div>
      </div>
      <div className="mini-dock">
        {TOOLS.map(({ Icon, t }) => (
          <span key={t} className="mini-tool" data-on={t === 'Looks' ? '' : undefined}>
            <Icon size={21} strokeWidth={1.8} />
            {t}
          </span>
        ))}
      </div>
      <div className="h-[198px] shrink-0 px-4 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Filters</span>
          <span className="text-[11px] font-semibold text-muted">{FILTERS.length - 1} looks</span>
        </div>
        <div className="grid grid-cols-4 gap-2.5">
          {around.map((id, k) => (
            <span key={`${id}-${k}`} className="mini-thumb" data-on={id === look ? '' : undefined}>
              <span className="block h-[72px] overflow-hidden rounded-[9px]">
                <FilmCanvas doc={previewDoc('instant', 1, id, 0)} label="" className="mini-thumb-canvas" />
              </span>
              <span className="mt-1.5 block truncate text-center text-[11.5px] font-semibold">{filterName(id)}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="flex h-[22px] shrink-0 items-start justify-center"><span className="h-[5px] w-[134px] rounded-full bg-text opacity-80" /></div>
    </div>
  );
}

/** The desktop studio in miniature (1180x720 inside <BrowserWindow>): editing a wide 35mm roll on the Film tab. */
export function DeskStudio({ doc, look }: { doc: FilmDoc; look: string }) {
  const formats = useMemo(
    () => [
      { t: 'Strip', d: '217×54 mm', doc: previewDoc('strip', 4, look, 0, 'landscape') },
      { t: 'Instant card', d: '108×86 mm', doc: previewDoc('instant', 1, look, 1, 'landscape') },
      { t: 'Film roll', d: '167×54 mm', doc: previewDoc('film35', 3, look, 2, 'landscape'), on: true },
    ],
    [look],
  );
  return (
    <div className="mini flex h-full flex-col bg-bg text-text">
      <div className="flex h-[56px] shrink-0 items-center justify-between border-b border-line px-6">
        <span className="flex items-center gap-3 text-[16px] font-semibold"><House size={20} /> PortableBooth</span>
        <span className="flex items-center gap-5">
          <span className="seg pointer-events-none">
            <span className="mini-seg"><Sun size={15} /></span>
            <span className="mini-seg" data-on=""><Monitor size={15} /></span>
            <span className="mini-seg"><Moon size={15} /></span>
          </span>
          <Undo2 size={19} /> <Redo2 size={19} className="opacity-40" /> <ShieldCheck size={19} />
          <span className="mini-export"><Download size={16} /> Export</span>
        </span>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="stage-bg relative flex min-w-0 flex-1 items-center justify-center px-8 py-14">
          <div className="h-[300px] w-full"><FilmCanvas doc={doc} label="" /></div>
          <span className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-[12px] font-semibold text-muted shadow-sm">
            <Sparkles size={13} /> {filterName(look)} · 3 frames
          </span>
        </div>
        <div className="w-[380px] shrink-0 border-l border-line bg-bg">
          <div className="grid grid-cols-7 border-b border-line px-1.5 py-1.5">
            {TOOLS.map(({ Icon, t }) => (
              <span key={t} className="mini-tool mini-tool-sm" data-on={t === 'Film' ? '' : undefined}>
                <Icon size={17} strokeWidth={1.8} />
                {t}
              </span>
            ))}
          </div>
          <div className="px-4 py-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Shape</p>
            <div className="grid grid-cols-2 gap-1 rounded-[12px] border border-line bg-surface2 p-1 text-[13px] font-semibold">
              <span className="flex h-9 items-center justify-center gap-2 text-muted"><Smartphone size={14} /> Print (tall)</span>
              <span className="flex h-9 items-center justify-center gap-2 rounded-[9px] bg-surface3"><Monitor size={14} /> Share (wide)</span>
            </div>
            <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Film</p>
            <div className="grid grid-cols-3 gap-2">
              {formats.map((f) => (
                <span key={f.t} className="mini-card" data-on={f.on ? '' : undefined}>
                  <span className="block h-[54px] w-full"><FilmCanvas doc={f.doc} label="" /></span>
                  <span className="mt-2 block text-[12.5px] font-semibold">{f.t}</span>
                  <span className="block text-[11px] text-muted">{f.d}</span>
                </span>
              ))}
            </div>
            <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Photos</p>
            <div className="flex gap-2">
              <span className="mini-card w-16 py-2.5 text-center text-[12px] font-semibold" data-on="">3</span>
              <span className="mini-card w-16 py-2.5 text-center text-[12px] font-semibold">4</span>
            </div>
            <span className="mini-next">Next: add photos</span>
          </div>
        </div>
      </div>
    </div>
  );
}
