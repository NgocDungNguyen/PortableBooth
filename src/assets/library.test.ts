import { describe, it, expect } from 'vitest';
// @types/node is not installed in this project; vitest runs in node so these resolve at runtime.
// @ts-ignore
import { readFileSync, readdirSync, statSync } from 'node:fs';
// @ts-ignore
import { fileURLToPath } from 'node:url';
import { SHAPES, SHAPE_NAMES, SHAPES_COLOURED } from './shapes';
import {
  PACKS, FAMILIES, packsOf, stickerId, parseStickerId, loadPack, isMonoSticker, packEntries, stickerLabel,
  getStickerImage, ensureSticker,
} from './library';

const DIR: string = fileURLToPath(new URL('./packs/', import.meta.url));
const join = (d: string, f: string): string => d + f;
const manifest: { id: string; family: string; label: string; mono: boolean; names: string[] }[] = JSON.parse(
  readFileSync(join(DIR, 'manifest.json'), 'utf8'),
);
const readPack = (id: string): Record<string, string> => JSON.parse(readFileSync(join(DIR, `${id}.json`), 'utf8'));

/** id -> svg for every pack on disk plus the shapes pack. */
const all: { packId: string; name: string; svg: string }[] = [];
for (const m of manifest) for (const [name, svg] of Object.entries(readPack(m.id))) all.push({ packId: m.id, name, svg });
for (const [name, svg] of Object.entries(SHAPES)) all.push({ packId: 'shapes', name, svg });

const FORBIDDEN: [RegExp, string][] = [
  [/<style/i, '<style'],
  [/style\s*=/i, 'style='],
  [/<script/i, '<script'],
  [/foreignObject/i, 'foreignObject'],
  [/href\s*=/i, 'href'],
  [/\son[a-z]+\s*=/i, 'on* handler'],
  [/<image/i, '<image'],
  [/url\(\s*['"]?\s*(https?:|data:|\/\/)/i, 'external url()'],
  [/url\(\s*['"]?(?!#)/i, 'non-fragment url()'],
  [/javascript:/i, 'javascript:'],
];

describe('packs on disk', () => {
  it('manifest matches the files', () => {
    const files = (readdirSync(DIR) as string[]).filter((f) => f.endsWith('.json') && f !== 'manifest.json').map((f) => f.replace(/\.json$/, '')).sort();
    expect(manifest.map((m) => m.id).sort()).toEqual(files);
    for (const m of manifest) {
      expect(Object.keys(readPack(m.id))).toEqual(m.names);
    }
  });

  it('has the expected packs, families and labels', () => {
    const ids = manifest.map((m) => m.id);
    for (const id of ['ph-love', 'ph-nature', 'ph-music', 'ph-travel', 'ph-tech', 'ph-symbols', 'ph-arrows', 'ph-food']) expect(ids).toContain(id);
    for (const id of ['emoji-faces', 'emoji-love', 'emoji-party', 'emoji-nature', 'emoji-food', 'emoji-travel', 'emoji-symbols']) expect(ids).toContain(id);
    for (const m of manifest) {
      expect(m.family).toBe(m.id.startsWith('ph-') ? 'icons' : 'emoji');
      expect(m.mono).toBe(m.family === 'icons');
      expect(m.names.length).toBeGreaterThanOrEqual(20);
    }
  });

  it('every name has a non-empty standalone svg', () => {
    for (const { packId, name, svg } of all) {
      expect(svg.length, `${packId}/${name}`).toBeGreaterThan(40);
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'), `${packId}/${name}`).toBe(true);
      expect(svg.endsWith('</svg>'), `${packId}/${name}`).toBe(true);
      expect(svg, `${packId}/${name}`).toMatch(/viewBox="0 0 [\d.]+ [\d.]+"/);
    }
  });

  it('every svg passes the CSP sanitisation rules', () => {
    for (const { packId, name, svg } of all) {
      for (const [re, label] of FORBIDDEN) expect(re.test(svg), `${packId}/${name} contains ${label}`).toBe(false);
    }
  });

  it('mono icon packs contain no currentColor and are black', () => {
    for (const m of manifest.filter((p) => p.mono)) {
      for (const [name, svg] of Object.entries(readPack(m.id))) {
        expect(svg, `${m.id}/${name}`).not.toMatch(/currentColor/i);
        expect(svg, `${m.id}/${name}`).toContain('#000000');
      }
    }
  });

  it('sticker ids are unique and there are at least 400 stickers', () => {
    const ids = all.map((a) => stickerId(a.packId, a.name));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(400);
  });

  it('every pack stays under 200KB raw', () => {
    for (const m of manifest) expect((statSync(join(DIR, `${m.id}.json`)) as { size: number }).size, m.id).toBeLessThan(200 * 1024);
  });
});

describe('shapes pack', () => {
  it('has ~28+ shapes, names match, coloured set is valid', () => {
    expect(SHAPE_NAMES.length).toBeGreaterThanOrEqual(28);
    expect(SHAPE_NAMES).toEqual(Object.keys(SHAPES));
    for (const n of SHAPES_COLOURED) expect(SHAPES).toHaveProperty(n);
    for (const n of SHAPE_NAMES) if (n.startsWith('tape-')) expect(SHAPES_COLOURED.has(n)).toBe(true);
  });
});

describe('library API', () => {
  it('stickerId / parseStickerId round trip', () => {
    for (const { packId, name } of all) {
      const id = stickerId(packId, name);
      expect(id).toBe(`${packId}/${name}`);
      expect(parseStickerId(id)).toEqual({ packId, name });
    }
    expect(parseStickerId('nope')).toBeNull();
    expect(parseStickerId('/x')).toBeNull();
    expect(parseStickerId('x/')).toBeNull();
  });

  it('PACKS = manifest + shapes with stable order, and families are covered', () => {
    expect(PACKS.map((p) => p.id)).toEqual([...manifest.map((m) => m.id), 'shapes']);
    expect(FAMILIES.map((f) => f.id)).toEqual(['icons', 'emoji', 'shapes']);
    expect(packsOf('icons').length).toBe(8);
    expect(packsOf('emoji').length).toBe(7);
    expect(packsOf('shapes').map((p) => p.id)).toEqual(['shapes']);
  });

  it('loadPack resolves lazily-imported packs and shapes; unknown packs are empty', async () => {
    expect(await loadPack('shapes')).toBe(SHAPES);
    const love = await loadPack('ph-love');
    expect(Object.keys(love)).toEqual(manifest.find((m) => m.id === 'ph-love')!.names);
    expect(await loadPack('ph-love')).toBe(love); // cached
    expect(await loadPack('does-not-exist')).toEqual({});
  });

  it('packEntries returns data-URL thumbnails', async () => {
    const entries = await packEntries('emoji-love');
    expect(entries.length).toBe(manifest.find((m) => m.id === 'emoji-love')!.names.length);
    expect(entries[0].id.startsWith('emoji-love/')).toBe(true);
    expect(entries[0].src.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(await packEntries('nope')).toEqual([]);
  });

  it('isMonoSticker honours pack meta and coloured shapes', () => {
    expect(isMonoSticker('ph-love/heart')).toBe(true);
    expect(isMonoSticker('emoji-love/red-heart')).toBe(false);
    expect(isMonoSticker('shapes/circle')).toBe(true);
    expect(isMonoSticker('shapes/chrome-star')).toBe(false);
    expect(isMonoSticker('shapes/tape-pink')).toBe(false);
    expect(isMonoSticker('garbage')).toBe(false);
    expect(isMonoSticker('unknown/x')).toBe(false);
  });

  it('stickerLabel is human readable and tolerant', () => {
    expect(stickerLabel('emoji-love/red-heart')).toBe('red heart');
    expect(stickerLabel('nonsense')).toBe('sticker');
  });

  it('unknown ids degrade gracefully', async () => {
    expect(getStickerImage('ph-love/heart')).toBeUndefined();
    expect(await ensureSticker('unknown/x')).toBeNull();
    expect(await ensureSticker('ph-love/not-a-real-name')).toBeNull();
    expect(await ensureSticker('garbage')).toBeNull();
  });
});
