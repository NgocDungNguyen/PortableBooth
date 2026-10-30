import { useSyncExternalStore } from 'react';
import { uid } from '../film/doc';

/** In-memory photo store. Nothing here is ever persisted; it is gone when the tab closes. */
export interface Photo {
  id: string;
  /** re-encoded pixels only: no EXIF, GPS or other metadata survives */
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
  /** built-in sample scene: survives "Clear everything" */
  keep?: boolean;
}

const photos = new Map<string, Photo>();
const listeners = new Set<() => void>();
let version = 0;
const emit = () => {
  version += 1;
  listeners.forEach((l) => l());
};

export function addPhoto(canvas: HTMLCanvasElement, keep = false): Photo {
  const p: Photo = { id: uid('photo'), canvas, w: canvas.width, h: canvas.height, keep };
  photos.set(p.id, p);
  emit();
  return p;
}
export const getPhoto = (id: string | null | undefined): Photo | undefined => (id ? photos.get(id) : undefined);

export function removePhoto(id: string) {
  const p = photos.get(id);
  if (!p) return;
  p.canvas.width = 0; // release the pixel memory
  photos.delete(id);
  emit();
}

export function clearPhotos() {
  photos.forEach((p, id) => {
    if (p.keep) return;
    p.canvas.width = 0;
    photos.delete(id);
  });
  emit();
}
export const photoCount = () => [...photos.values()].filter((p) => !p.keep).length;

/** re-renders the caller whenever photos are added or removed */
export function usePhotosVersion(): number {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
  );
}
