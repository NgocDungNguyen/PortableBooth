/**
 * Sticker library: manifest of packs (listed eagerly, names only) plus lazily loaded svg packs.
 * Every `packs/<id>.json` becomes its own chunk via a non-eager import.meta.glob.
 * Sticker ids are `${packId}/${name}`.
 */
import { SHAPES, SHAPE_NAMES, SHAPES_COLOURED } from './shapes';

export type Family = 'icons' | 'emoji' | 'shapes';
export interface PackMeta {
  id: string;
  family: Family;
  label: string;
  mono: boolean;
  names: string[];
}

export const FAMILIES: { id: Family; label: string }[] = [
  { id: 'icons', label: 'Icons' },
  { id: 'emoji', label: 'Emoji' },
  { id: 'shapes', label: 'Shapes' },
];

const manifestModules = import.meta.glob<PackMeta[]>('./packs/manifest.json', { eager: true, import: 'default' });
const manifest: PackMeta[] = manifestModules['./packs/manifest.json'] ?? [];

const SHAPES_PACK_ID = 'shapes';

export const PACKS: PackMeta[] = [
  ...manifest,
  { id: SHAPES_PACK_ID, family: 'shapes', label: 'Shapes', mono: true, names: SHAPE_NAMES },
];

const packById = new Map(PACKS.map((p) => [p.id, p]));

export const packsOf = (f: Family): PackMeta[] => PACKS.filter((p) => p.family === f);

export const stickerId = (packId: string, name: string): string => `${packId}/${name}`;

export function parseStickerId(id: string): { packId: string; name: string } | null {
  if (typeof id !== 'string') return null;
  const i = id.indexOf('/');
  if (i <= 0 || i === id.length - 1) return null;
  return { packId: id.slice(0, i), name: id.slice(i + 1) };
}

/* ---------------------------------------------------------------- lazy pack loading */

const packLoaders = import.meta.glob<Record<string, string>>('./packs/*.json', { import: 'default' });
const packCache = new Map<string, Promise<Record<string, string>>>();

export function loadPack(packId: string): Promise<Record<string, string>> {
  if (packId === SHAPES_PACK_ID) return Promise.resolve(SHAPES);
  const cached = packCache.get(packId);
  if (cached) return cached;
  const loader = packLoaders[`./packs/${packId}.json`];
  if (!loader || !packById.has(packId)) return Promise.resolve({});
  const p = loader().catch((err) => {
    packCache.delete(packId); // allow a retry after a transient failure
    throw err;
  });
  packCache.set(packId, p);
  return p;
}

/* ---------------------------------------------------------------- images */

const toDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

const imageCache = new Map<string, HTMLImageElement>();
const pending = new Map<string, Promise<HTMLImageElement | null>>();

async function svgFor(id: string): Promise<string | null> {
  const parsed = parseStickerId(id);
  if (!parsed || !packById.has(parsed.packId)) return null;
  const pack = await loadPack(parsed.packId);
  return Object.prototype.hasOwnProperty.call(pack, parsed.name) ? pack[parsed.name] : null;
}

export function ensureSticker(id: string): Promise<HTMLImageElement | null> {
  const hit = imageCache.get(id);
  if (hit) return Promise.resolve(hit);
  const inflight = pending.get(id);
  if (inflight) return inflight;
  const p = (async () => {
    try {
      const svg = await svgFor(id);
      if (!svg || typeof Image === 'undefined') return null;
      const img = new Image();
      img.decoding = 'async';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`sticker decode failed: ${id}`));
        img.src = toDataUrl(svg);
      });
      imageCache.set(id, img);
      return img;
    } catch {
      return null;
    } finally {
      pending.delete(id);
    }
  })();
  pending.set(id, p);
  return p;
}

export const getStickerImage = (id: string): HTMLImageElement | undefined => imageCache.get(id);

/* ---------------------------------------------------------------- metadata */

export function isMonoSticker(id: string): boolean {
  const parsed = parseStickerId(id);
  if (!parsed) return false;
  const pack = packById.get(parsed.packId);
  if (!pack) return false;
  if (pack.family === 'shapes' && SHAPES_COLOURED.has(parsed.name)) return false;
  return pack.mono;
}

export async function packEntries(packId: string): Promise<{ id: string; label: string; src: string }[]> {
  const meta = packById.get(packId);
  if (!meta) return [];
  const svgs = await loadPack(packId);
  return meta.names
    .filter((name) => Object.prototype.hasOwnProperty.call(svgs, name))
    .map((name) => ({ id: stickerId(packId, name), label: humanise(name), src: toDataUrl(svgs[name]) }));
}

const humanise = (name: string) => name.replace(/-/g, ' ').trim();

export function stickerLabel(id: string): string {
  const parsed = parseStickerId(id);
  return parsed ? humanise(parsed.name) : 'sticker';
}
