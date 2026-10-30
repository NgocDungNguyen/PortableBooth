import { addPhoto, type Photo } from './photos';

/**
 * Why the live camera cannot be used. Everything except `failed` is something we can explain in plain words.
 * - iframe:   embedded in a page that did not delegate camera access (sandboxed preview, no `allow="camera"`)
 * - insecure: not a secure context (plain http)
 * - no-api:   this browser has no getUserMedia
 * - denied:   the person (or their browser settings) said no
 * - none:     no usable camera on the device
 * - failed:   anything else (camera busy, hardware error ...)
 */
export type CameraReason = 'iframe' | 'insecure' | 'no-api' | 'denied' | 'none' | 'failed';
/** @deprecated alias kept for older imports */
export type CameraError = CameraReason;

export class CameraFailure extends Error {
  constructor(public code: CameraReason) {
    super(code);
  }
}

export type Facing = 'user' | 'environment';

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const g = (): Loose => globalThis as Loose;

/** Tri-state: does the page's permissions policy let this document use the camera? `null` = cannot tell. */
function cameraPolicy(): boolean | null {
  const doc = g().document as Loose | undefined;
  const policy = doc?.permissionsPolicy ?? doc?.featurePolicy;
  if (policy && typeof policy.allowsFeature === 'function') {
    try {
      return !!policy.allowsFeature('camera');
    } catch {
      return null;
    }
  }
  return null;
}

function isFramed(): boolean {
  const w = g().window as Loose | undefined;
  if (!w) return false;
  try {
    return w.self !== w.top;
  } catch {
    return true; // cross-origin access errors only happen when framed
  }
}

/**
 * Cheap, synchronous pre-check: can the live camera possibly work here?
 * Returns the reason it cannot, or `null` when it is worth trying (the browser may still ask / refuse later).
 */
export function classifyCameraSupport(): CameraReason | null {
  // Framed: only blocked when the policy says so. When the browser cannot tell (Safari) we still try.
  if (cameraPolicy() === false) return 'iframe';
  const w = g().window as Loose | undefined;
  if (w && w.isSecureContext === false) return 'insecure';
  const nav = g().navigator as Loose | undefined;
  if (typeof nav?.mediaDevices?.getUserMedia !== 'function') return 'no-api';
  return null;
}

/** Map a getUserMedia rejection to a reason. */
export function classifyCameraError(e: unknown): CameraReason {
  if (e instanceof CameraFailure) return e.code;
  const name = (e as { name?: string } | null)?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    // inside a frame that did not delegate the camera the platform refuses silently: say so
    if (isFramed() && cameraPolicy() !== true) return 'iframe';
    return 'denied';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') return 'none';
  return 'failed';
}

/** True on phones and tablets (touch first), where the native camera app is the natural way to take a photo. */
export function hasCoarsePointer(): boolean {
  const w = g().window as Loose | undefined;
  try {
    return !!w?.matchMedia?.('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

export async function startCamera(facing: Facing): Promise<MediaStream> {
  const blocked = classifyCameraSupport();
  if (blocked) throw new CameraFailure(blocked);
  try {
    // `ideal` only (never `exact`): iOS Safari rejects exact constraints it cannot satisfy
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    });
  } catch (e) {
    throw new CameraFailure(classifyCameraError(e));
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
