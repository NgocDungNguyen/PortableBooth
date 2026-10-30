import { createDoc } from '../film/doc';
import type { FilmDoc, FormatId, Orientation } from '../film/types';
import { samplePhotos } from '../samples';

// Registered at import time (not during render) so the photo store never changes mid-render.
const PHOTOS = samplePhotos();
const cache = new Map<string, FilmDoc>();

/** A film filled with sample scenes, for pickers, thumbnails and the homepage. */
export function previewDoc(format: FormatId, frames: number | undefined, filterId: string, offset = 0, orientation: Orientation = 'portrait'): FilmDoc {
  const key = `${format}|${frames}|${filterId}|${offset}|${orientation}`;
  let d = cache.get(key);
  if (!d) {
    d = createDoc(format, frames, orientation);
    d.filterId = filterId;
    d.dateStamp = false;
    d.slots = d.slots.map((s, i) => ({ ...s, photoId: PHOTOS[(i + offset) % PHOTOS.length].id }));
    cache.set(key, d);
  }
  return d;
}
