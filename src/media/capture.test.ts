import { afterEach, describe, expect, it, vi } from 'vitest';
import { CameraFailure, classifyCameraError, classifyCameraSupport, hasCoarsePointer } from './capture';

interface Env {
  framed?: boolean;
  secure?: boolean;
  policy?: boolean | 'none'; // 'none' = browser has no permissions-policy API
  api?: boolean;
  coarse?: boolean;
}

function stub({ framed = false, secure = true, policy = true, api = true, coarse = false }: Env = {}) {
  const win: Record<string, unknown> = { isSecureContext: secure, matchMedia: () => ({ matches: coarse }) };
  win.self = win;
  win.top = framed ? {} : win;
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', policy === 'none' ? {} : { permissionsPolicy: { allowsFeature: (f: string) => f === 'camera' && policy } });
  vi.stubGlobal('navigator', api ? { mediaDevices: { getUserMedia: async () => ({}) } } : {});
}

afterEach(() => vi.unstubAllGlobals());

describe('classifyCameraSupport', () => {
  it('is null when a normal page can try the camera', () => {
    stub();
    expect(classifyCameraSupport()).toBeNull();
  });
  it('flags an embedded page whose policy blocks the camera as iframe', () => {
    stub({ framed: true, policy: false });
    expect(classifyCameraSupport()).toBe('iframe');
  });
  it('lets a framed page try when the host delegated the camera', () => {
    stub({ framed: true, policy: true });
    expect(classifyCameraSupport()).toBeNull();
  });
  it('lets a framed page try when the browser cannot tell (Safari)', () => {
    stub({ framed: true, policy: 'none' });
    expect(classifyCameraSupport()).toBeNull();
  });
  it('flags a non-secure page as insecure', () => {
    stub({ secure: false, api: false });
    expect(classifyCameraSupport()).toBe('insecure');
  });
  it('flags a missing getUserMedia as no-api', () => {
    stub({ api: false });
    expect(classifyCameraSupport()).toBe('no-api');
  });
  it('does not throw without any DOM globals', () => {
    expect(classifyCameraSupport()).toBe('no-api');
  });
});

describe('classifyCameraError', () => {
  const err = (name: string) => Object.assign(new Error(name), { name });
  it('maps permission errors to denied on a normal page', () => {
    stub();
    expect(classifyCameraError(err('NotAllowedError'))).toBe('denied');
    expect(classifyCameraError(err('SecurityError'))).toBe('denied');
  });
  it('maps permission errors to iframe inside a frame that did not delegate', () => {
    stub({ framed: true, policy: 'none' });
    expect(classifyCameraError(err('NotAllowedError'))).toBe('iframe');
  });
  it('keeps denied inside a frame that did delegate the camera', () => {
    stub({ framed: true, policy: true });
    expect(classifyCameraError(err('NotAllowedError'))).toBe('denied');
  });
  it('maps missing hardware to none', () => {
    stub();
    for (const n of ['NotFoundError', 'OverconstrainedError', 'DevicesNotFoundError']) expect(classifyCameraError(err(n))).toBe('none');
  });
  it('maps everything else to failed', () => {
    stub();
    expect(classifyCameraError(err('NotReadableError'))).toBe('failed');
    expect(classifyCameraError(new TypeError('x'))).toBe('failed');
    expect(classifyCameraError(null)).toBe('failed');
  });
  it('passes an existing CameraFailure through', () => {
    expect(classifyCameraError(new CameraFailure('insecure'))).toBe('insecure');
  });
});

describe('hasCoarsePointer', () => {
  it('reads the pointer media query', () => {
    stub({ coarse: true });
    expect(hasCoarsePointer()).toBe(true);
    stub({ coarse: false });
    expect(hasCoarsePointer()).toBe(false);
  });
});
