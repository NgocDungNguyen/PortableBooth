import type { Rect } from '../film/types';
import type { ShaderParams } from './params';

/** Simplified software version of the shader (no glow / light leak), used only if WebGL is unavailable. */
export function applyCpu(src: HTMLCanvasElement, p: ShaderParams, slots: Rect[]): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = src.width;
  out.height = src.height;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) return src;
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, out.width, out.height);
  const d = img.data;
  const W = out.width;
  const H = out.height;
  const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;
  const smooth = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const a = d[i + 3] / 255;
      if (a < 0.01) continue;
      let r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
      const or = r, og = g, ob = b;
      r += p.brightness * 0.25; g += p.brightness * 0.25; b += p.brightness * 0.25;
      const k = 1 + p.contrast * 0.9;
      r = (r - 0.5) * k + 0.5; g = (g - 0.5) * k + 0.5; b = (b - 0.5) * k + 0.5;
      let l = luma(r, g, b);
      r = l + (r - l) * (1 + p.saturation); g = l + (g - l) * (1 + p.saturation); b = l + (b - l) * (1 + p.saturation);
      if (p.bw) { l = luma(r, g, b); r = g = b = l; }
      r += p.warmth * 0.09; g += p.warmth * 0.02; b -= p.warmth * 0.11;
      l = luma(r, g, b);
      const sh = p.split * (1 - smooth(0, 0.6, l));
      r += p.shadow[0] * sh; g += p.shadow[1] * sh; b += p.shadow[2] * sh;
      const hi = p.split * smooth(0.35, 1, l);
      r += (r * p.highlight[0] - r) * hi; g += (g * p.highlight[1] - g) * hi; b += (b * p.highlight[2] - b) * hi;
      r += (r * 0.84 + 0.08 - r) * p.fade; g += (g * 0.84 + 0.08 - g) * p.fade; b += (b * 0.84 + 0.08 - b) * p.fade;
      const u = x / W, v = y / H;
      for (const s of slots) {
        if (u >= s.x && u <= s.x + s.w && v >= s.y && v <= s.y + s.h) {
          const px = ((u - s.x) / s.w) * 2 - 1, py = ((v - s.y) / s.h) * 2 - 1;
          const vig = 1 - smooth(0.5, 1.5, Math.hypot(px, py)) * p.vignette * 0.8;
          r *= vig; g *= vig; b *= vig;
        }
      }
      const n = rnd() * p.grain * 0.26;
      r += n; g += n; b += n;
      const m = p.intensity;
      d[i] = Math.min(255, Math.max(0, (or + (Math.min(1, Math.max(0, r)) - or) * m) * 255));
      d[i + 1] = Math.min(255, Math.max(0, (og + (Math.min(1, Math.max(0, g)) - og) * m) * 255));
      d[i + 2] = Math.min(255, Math.max(0, (ob + (Math.min(1, Math.max(0, b)) - ob) * m) * 255));
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}
