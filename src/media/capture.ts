import { addPhoto, type Photo } from './photos';

export type CameraError = 'denied' | 'none' | 'failed';
export class CameraFailure extends Error {
  constructor(public code: CameraError) {
    super(code);
  }
}

export type Facing = 'user' | 'environment';

export async function startCamera(facing: Facing): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new CameraFailure('none');
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } },
    });
  } catch (e) {
    const name = (e as DOMException)?.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') throw new CameraFailure('denied');
    if (name === 'NotFoundError' || name === 'OverconstrainedError') throw new CameraFailure('none');
    throw new CameraFailure('failed');
  }
}

/** Always release the camera (the browser's recording light) when leaving. */
export function stopCamera(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => t.stop());
}

/** Centre-crop the current video frame to the slot's aspect ratio, mirrored to match the preview. */
export function captureFrame(video: HTMLVideoElement, aspect: number, mirror: boolean): Photo {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  let sw = vw;
  let sh = vw / aspect;
  if (sh > vh) {
    sh = vh;
    sw = vh * aspect;
  }
  const k = Math.min(1, 1800 / Math.max(sw, sh));
  const c = document.createElement('canvas');
  c.width = Math.round(sw * k);
  c.height = Math.round(sh * k);
  const ctx = c.getContext('2d')!;
  if (mirror) {
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, c.width, c.height);
  return addPhoto(c);
}
