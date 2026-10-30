/**
 * Original vector stickers drawn for PortableBooth (CC0 / public domain dedication).
 * viewBox is always 100x100; 4px ink outline keeps them readable on any photo.
 */
const INK = '#17163A';
const o = `stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;

export interface StickerDef {
  id: string;
  label: string;
  svg: string;
}

const wrap = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="256" height="256">${inner}</svg>`;

export const STICKERS: StickerDef[] = [
  { id: 'star', label: 'Star', svg: wrap(`<path d="M50 8l11.5 25.6 27.9 2.9-20.9 18.7 6 27.4L50 68.8 25.5 82.6l6-27.4L10.6 36.5l27.9-2.9z" fill="#FFDD3C" ${o}/>`) },
  { id: 'heart', label: 'Heart', svg: wrap(`<path d="M50 86C14 60 8 38 20 24c9-10 24-8 30 4 6-12 21-14 30-4 12 14 6 36-30 62z" fill="#FF3B6B" ${o}/><path d="M24 34c3-6 9-8 13-5" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".8"/>`) },
  { id: 'sparkle', label: 'Sparkle', svg: wrap(`<path d="M50 6c3 24 20 41 44 44-24 3-41 20-44 44-3-24-20-41-44-44C30 47 47 30 50 6z" fill="#fff" ${o}/>`) },
  { id: 'bolt', label: 'Bolt', svg: wrap(`<path d="M58 6L22 56h22l-8 38 42-56H55z" fill="#FFDD3C" ${o}/>`) },
  { id: 'smile', label: 'Smile', svg: wrap(`<circle cx="50" cy="50" r="40" fill="#FFDD3C" ${o}/><circle cx="36" cy="42" r="5" fill="${INK}"/><circle cx="64" cy="42" r="5" fill="${INK}"/><path d="M30 60c8 14 32 14 40 0" fill="none" ${o}/><circle cx="26" cy="58" r="5" fill="#FF8FB0" opacity=".8"/><circle cx="74" cy="58" r="5" fill="#FF8FB0" opacity=".8"/>`) },
  { id: 'flower', label: 'Flower', svg: wrap(`${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="50" cy="26" rx="14" ry="20" fill="#FFB3C9" ${o} transform="rotate(${a} 50 50)"/>`).join('')}<circle cx="50" cy="50" r="13" fill="#FFDD3C" ${o}/>`) },
  { id: 'cherry', label: 'Cherry', svg: wrap(`<path d="M34 66C36 40 46 22 66 12M70 70C68 44 66 26 66 12" fill="none" stroke="#2f8f4e" stroke-width="5" stroke-linecap="round"/><path d="M66 12c12-4 22 2 24 10-12 2-20 0-24-10z" fill="#8EEBC4" ${o}/><circle cx="30" cy="72" r="20" fill="#E8204F" ${o}/><circle cx="72" cy="74" r="18" fill="#E8204F" ${o}/><circle cx="24" cy="66" r="4" fill="#fff" opacity=".7"/><circle cx="67" cy="68" r="4" fill="#fff" opacity=".7"/>`) },
  { id: 'camera', label: 'Camera', svg: wrap(`<rect x="8" y="28" width="84" height="56" rx="12" fill="#C9B6FF" ${o}/><path d="M32 28l6-12h24l6 12" fill="#C9B6FF" ${o}/><circle cx="50" cy="56" r="19" fill="#fff" ${o}/><circle cx="50" cy="56" r="9" fill="${INK}"/><circle cx="80" cy="40" r="4" fill="#FFDD3C" stroke="${INK}" stroke-width="3"/>`) },
  { id: 'tape', label: 'Tape', svg: wrap(`<g transform="rotate(-6 50 50)"><rect x="6" y="32" width="88" height="36" fill="#FFDD3C" fill-opacity=".88" ${o}/><path d="M22 40v20M36 40v20M50 40v20M64 40v20M78 40v20" stroke="#fff" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/></g>`) },
  { id: 'rainbow', label: 'Rainbow', svg: wrap(`<path d="M8 76a42 42 0 0184 0" fill="none" stroke="#FF3B6B" stroke-width="9"/><path d="M18 76a32 32 0 0164 0" fill="none" stroke="#FFDD3C" stroke-width="9"/><path d="M28 76a22 22 0 0144 0" fill="none" stroke="#8EEBC4" stroke-width="9"/><path d="M38 76a12 12 0 0124 0" fill="none" stroke="#7EC8FF" stroke-width="9"/>`) },
  { id: 'cloud', label: 'Cloud', svg: wrap(`<path d="M26 74a18 18 0 01-2-35 24 24 0 0145-6 20 20 0 015 41z" fill="#fff" ${o}/>`) },
  { id: 'sun', label: 'Sun', svg: wrap(`${Array.from({ length: 10 }, (_, i) => `<path d="M50 6v14" ${o} transform="rotate(${i * 36} 50 50)"/>`).join('')}<circle cx="50" cy="50" r="24" fill="#FFB02E" ${o}/>`) },
  { id: 'moon', label: 'Moon', svg: wrap(`<path d="M66 10a42 42 0 100 80A34 34 0 0166 10z" fill="#FFF1CF" ${o}/><circle cx="36" cy="46" r="5" fill="#E8D9A8"/><circle cx="46" cy="68" r="4" fill="#E8D9A8"/>`) },
  { id: 'crown', label: 'Crown', svg: wrap(`<path d="M12 74L8 30l24 20 18-30 18 30 24-20-4 44z" fill="#FFDD3C" ${o}/><rect x="12" y="74" width="76" height="10" rx="3" fill="#FFB02E" ${o}/><circle cx="50" cy="56" r="5" fill="#E8204F" stroke="${INK}" stroke-width="3"/>`) },
  { id: 'bubble', label: 'Bubble', svg: wrap(`<path d="M18 16h64a10 10 0 0110 10v38a10 10 0 01-10 10H50L30 92V74H18A10 10 0 018 64V26a10 10 0 0110-10z" fill="#fff" ${o}/><circle cx="34" cy="45" r="5" fill="${INK}"/><circle cx="50" cy="45" r="5" fill="${INK}"/><circle cx="66" cy="45" r="5" fill="${INK}"/>`) },
  { id: 'gem', label: 'Gem', svg: wrap(`<path d="M28 18h44l22 24-44 46L6 42z" fill="#7EC8FF" ${o}/><path d="M6 42h88M28 18l22 24 22-24M50 42v46" fill="none" ${o} stroke-width="3"/>`) },
];

const images = new Map<string, HTMLImageElement>();
export const stickerDataUrl = (s: StickerDef) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(s.svg)}`;

export async function loadStickers(): Promise<void> {
  await Promise.all(
    STICKERS.filter((s) => !images.has(s.id)).map(async (s) => {
      const img = new Image();
      img.src = stickerDataUrl(s);
      try {
        await img.decode();
        images.set(s.id, img);
      } catch {
        /* a missing sticker is skipped at draw time */
      }
    }),
  );
}
export const getStickerImage = (id: string) => images.get(id);
