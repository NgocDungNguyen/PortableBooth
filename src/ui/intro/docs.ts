import { newSticker, newText, newWidget } from '../../film/doc';
import type { FilmDoc } from '../../film/types';
import { filterById } from '../../film/filters';
import { WIDGETS } from '../../render/widgets';
import { previewDoc } from '../previewDocs';

/** Everything the reel draws is a real FilmDoc rendered by the real renderer. Built once, reused. */
export const REEL_STICKERS = ['shapes/chrome-star', 'shapes/heart-solid'];

export interface FrameLook {
  style: string;
  name: string;
  color: string;
  color2: string;
}
export interface ReelDocs {
  /** scene 1: tall layouts then wide layouts */
  tall: FilmDoc[];
  wide: FilmDoc[];
  /** scene 2: slot photo ids, an empty strip and the strip with 1..3 photos placed */
  photoIds: string[];
  /** the photo shown in the viewfinder */
  liveId: string;
  fill: FilmDoc[];
  /** scene 3: one doc per look, then the same with a sticker, then with a sticker and a text label */
  looks: { id: string; name: string; doc: FilmDoc }[];
  withSticker: FilmDoc;
  withText: FilmDoc;
  /** scene 4 */
  frames: { look: FrameLook; doc: FilmDoc }[];
  withWidget: FilmDoc;
  /** scene 5 */
  finale: FilmDoc;
}

const LOOKS = ['noir', 'riso', 'teal-night', 'sunday', 'cherry'].map((id) => ({ id, name: filterById(id).name }));
export const FRAME_LOOKS: FrameLook[] = [
  { style: 'grid', name: 'Graph paper', color: '#FFD66B', color2: '#17163A' },
  { style: 'dots', name: 'Polka dots', color: '#F4A6B7', color2: '#FFFFFF' },
  { style: 'gradient', name: 'Gradient', color: '#B9A7FF', color2: '#9FD3FF' },
  { style: 'holo', name: 'Holo foil', color: '#17163A', color2: '#FFD66B' },
];

const SOLID_FINAL = FRAME_LOOKS[1];
let cache: ReelDocs | null = null;

export function reelDocs(): ReelDocs {
  if (cache) return cache;
  const strip = previewDoc('strip', 3, 'original', 0);
  const photoIds = strip.slots.map((s) => s.photoId ?? '');
  const withPhotos = (n: number): FilmDoc => ({ ...strip, slots: strip.slots.map((s, i) => ({ ...s, photoId: i < n ? s.photoId : null })) });
  const fill = [0, 1, 2, 3].map(withPhotos);

  const looks = LOOKS.map((l) => ({ ...l, doc: previewDoc('strip', 3, l.id, 1) }));
  const base = looks[looks.length - 1].doc;
  const star = { ...newSticker('shapes/chrome-star', false, 38, 24, 17), rot: 12 };
  const heart = { ...newSticker('shapes/heart-solid', true, 11, 70, 11), tint: '#FF5C7A', rot: -12 };
  const label = { ...newText('SMILE!', '#14121F', 25.5, 132), font: 'bold' as const, size: 8, bg: '#C6F432', rot: -4 };
  const withSticker: FilmDoc = { ...base, items: [star, heart] };
  const withText: FilmDoc = { ...withSticker, items: [...withSticker.items, label] };

  const frames = FRAME_LOOKS.map((look) => ({
    look,
    doc: { ...base, frameStyle: look.style, frameColor: look.color, frameColor2: look.color2 } as FilmDoc,
  }));
  const ticket = WIDGETS.find((w) => w.id === 'ticket') ?? WIDGETS[0];
  const fb = frames[frames.length - 1].doc;
  const withWidget: FilmDoc = { ...fb, items: [{ ...newWidget(ticket.id, ticket.defaults, 25.5, 126, 40), rot: -3 }] };
  const finale: FilmDoc = {
    ...base,
    frameStyle: SOLID_FINAL.style, frameColor: SOLID_FINAL.color, frameColor2: SOLID_FINAL.color2,
    items: [star, heart, label],
  };

  cache = {
    tall: [previewDoc('strip', 3, 'sunday', 0), previewDoc('instant', 1, 'flash', 2), previewDoc('film35', 3, 'noir', 1)],
    wide: [previewDoc('strip', 3, 'sunday', 0, 'landscape'), previewDoc('instant', 1, 'flash', 2, 'landscape'), previewDoc('film35', 3, 'noir', 1, 'landscape')],
    photoIds, liveId: previewDoc('strip', 3, 'original', 3).slots[0].photoId ?? '', fill, looks, withSticker, withText, frames, withWidget, finale,
  };
  return cache;
}
