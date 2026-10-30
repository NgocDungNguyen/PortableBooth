import { addPhoto, type Photo } from './photos';

export const MAX_FILE_BYTES = 40 * 1024 * 1024;
export const MAX_SIDE = 3000;

export type ImportError = 'too-big' | 'not-image' | 'unreadable';
export class ImportFailure extends Error {
  constructor(public code: ImportError) {
    super(code);
  }
}

/**
 * Treat every upload as hostile: size cap, no SVG, and it must actually decode as a raster image.
 * The pixels are redrawn onto a fresh canvas (EXIF orientation applied by the decoder), so all
 * metadata, including GPS, is dropped.
 */
export async function importFile(file: File): Promise<Photo> {
  if (file.size > MAX_FILE_BYTES) throw new ImportFailure('too-big');
  if (!file.type.startsWith('image/') || file.type.includes('svg')) throw new ImportFailure('not-image');
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImportFailure('unreadable');
  }
  try {
    const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bmp.width * k));
    canvas.height = Math.max(1, Math.round(bmp.height * k));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ImportFailure('unreadable');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return addPhoto(canvas);
  } finally {
    bmp.close();
  }
}

export const importMessage: Record<ImportError, string> = {
  'too-big': 'That file is too big (40 MB max)',
  'not-image': 'Only photos work here (JPG, PNG, WebP)',
  unreadable: "Couldn't open that photo",
};
