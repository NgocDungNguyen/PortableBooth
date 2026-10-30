import { newSticker, newText, newWidget } from '../../film/doc';
import type { FilmDoc, Item } from '../../film/types';
import { filterById } from '../../film/filters';
import { WIDGETS } from '../../render/widgets';
import { samplePhotos } from '../../samples';
import { previewDoc } from '../previewDocs';

/** Everything the reel draws is a real FilmDoc rendered by the real renderer. Built once, reused. */
export const REEL_STICKERS = ['shapes/chrome-star', 'shapes/heart-solid', 'shapes/sparkle-cluster', 'shapes/star-burst', 'shapes/tape-pink', 'shapes/tape-mint'];
/** sticker tray shown in scene 3: id + tint (null keeps the artwork's colours) */
export const TRAY: { id: string; tint: string | null }[] = [
  { id: 'shapes/chrome-star', tint: null },
  { id: 'shapes/heart-solid', tint: '#FF5C7A' },
  { id: 'shapes/sparkle-cluster', tint: '#FFB020' },
  { id: 'shapes/tape-pink', tint: null },
  { id: 'shapes/star-burst', tint: '#7C5CFF' },
  { id: 'shapes/tape-mint', tint: null },
];

export interface ReelLook {
  id: string;
  name: string;
  doc: FilmDoc;
  /** a one-photo instant film in this look, for the picker tile */
  thumb: FilmDoc;
}
export interface FrameStyleTile {
  id: string;
  name: string;
}
export interface ReelDocs {
  /** scene 1: tall layouts then the same films wide */
  tall: FilmDoc[];
  wide: FilmDoc[];
  /** scene 2: slot photo ids, the gallery and the strip with 0..3 photos placed */
  photoIds: string[];
  gallery: string[];
  /** the photo shown in the viewfinder */
  liveId: string;
  fill: FilmDoc[];
  /** scene 3: the looks picker (first = Original), then a sticker, then a text label growing in size steps */
  looks: ReelLook[];
  withSticker: FilmDoc;
  textSteps: FilmDoc[];
  /** where the sticker lands and where the label sits (mm on the strip) */
  stickerAt: { x: number; y: number; size: number; rot: number };
  textAt: { x: number; y: number; sizes: number[]; rot: number; text: string };
  /** scene 4: base, two frame styles, two colours, the widget, the light leak */
  frameSteps: FilmDoc[];
  withWidget: FilmDoc;
  withLeak: FilmDoc;
  frameTiles: FrameStyleTile[];
  swatches: string[];
  /** scene 5 */
  finale: FilmDoc;
}

const LOOK_IDS = ['original', 'noir', 'riso', 'cherry'];
export const FRAME_TILES: FrameStyleTile[] = [
  { id: 'plain', name: 'Plain' },
  { id: 'dots', name: 'Dots' },
  { id: 'grid', name: 'Grid' },
  { id: 'gradient', name: 'Gradient' },
];
export const SWATCHES = ['#FFFFFF', '#F4A6B7', '#9FD3FF', '#FFD66B', '#B9A7FF', '#17163A'];

let cache: ReelDocs | null = null;

export function reelDocs(): ReelDocs {
  if (cache) return cache;
  const strip = previewDoc('strip', 3, 'original', 0);
  const photoIds = strip.slots.map((s) => s.photoId ?? '');
  const withPhotos = (n: number): FilmDoc => ({ ...strip, slots: strip.slots.map((s, i) => ({ ...s, photoId: i < n ? s.photoId : null })) });
  const fill = [0, 1, 2, 3].map(withPhotos);

  const looks = LOOK_IDS.map((id) => ({
    id,
    name: id === 'original' ? 'Original' : filterById(id).name,
    doc: id === 'original' ? fill[3] : previewDoc('strip', 3, id, 0),
    thumb: previewDoc('instant', 1, id, 2),
  }));
  const base = looks[looks.length - 1].doc;

  const stickerAt = { x: 38, y: 22, size: 17, rot: 12 };
  const star: Item = { ...newSticker('shapes/chrome-star', false, stickerAt.x, stickerAt.y, stickerAt.size), rot: stickerAt.rot };
  const heart: Item = { ...newSticker('shapes/heart-solid', true, 11, 64, 10), tint: '#FF5C7A', rot: -12 };
  const withSticker: FilmDoc = { ...base, items: [star] };
  const textAt = { x: 25.5, y: 144, sizes: [4.6, 5.2, 5.8, 6.4, 7, 7.6], rot: -3, text: 'BEST NIGHT' };
  const label = (size: number): Item => ({ ...newText(textAt.text, '#14121F', textAt.x, textAt.y), font: 'bold' as const, size, bg: '#C6F432', rot: textAt.rot });
  const textSteps = textAt.sizes.map((s) => ({ ...base, items: [star, heart, label(s)] }));
  const decorated = textSteps[textSteps.length - 1];

  const frameSteps: FilmDoc[] = [
    decorated,
    { ...decorated, frameStyle: 'dots', frameColor: '#F4A6B7', frameColor2: '#FFFFFF' },
    { ...decorated, frameStyle: 'grid', frameColor: '#F4A6B7', frameColor2: '#17163A' },
    { ...decorated, frameStyle: 'grid', frameColor: '#9FD3FF', frameColor2: '#17163A' },
    { ...decorated, frameStyle: 'grid', frameColor: '#FFD66B', frameColor2: '#17163A' },
  ];
  const stamp = WIDGETS.find((w) => w.id === 'stamp') ?? WIDGETS[0];
  const last = frameSteps[frameSteps.length - 1];
  const withWidget: FilmDoc = { ...last, items: [...last.items, { ...newWidget(stamp.id, stamp.defaults, 33, 129, 20), rot: -4 }] };
  const withLeak: FilmDoc = { ...withWidget, overlays: [{ id: 'leak-amber', opacity: 0.85 }] };

  const all = samplePhotos();
  cache = {
    tall: [previewDoc('strip', 3, 'sunday', 0), previewDoc('instant', 1, 'flash', 2), previewDoc('film35', 3, 'noir', 1)],
    wide: [previewDoc('strip', 3, 'sunday', 0, 'landscape'), previewDoc('instant', 1, 'flash', 2, 'landscape'), previewDoc('film35', 3, 'noir', 1, 'landscape')],
    photoIds,
    gallery: [3, 2, 4, 5, 0, 1].map((i) => all[i % all.length].id),
    liveId: previewDoc('strip', 3, 'original', 3).slots[0].photoId ?? '',
    fill, looks, withSticker, textSteps, stickerAt, textAt,
    frameSteps, withWidget, withLeak, frameTiles: FRAME_TILES, swatches: SWATCHES,
    finale: withLeak,
  };
  return cache;
}
