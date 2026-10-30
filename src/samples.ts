import { addPhoto, type Photo } from './media/photos';

/**
 * Procedural stand-in photos (sunny hills, city dusk, studio flash...) used by the homepage and the
 * film picker so we never ship or fetch real portraits. Deterministic and tiny.
 */
type Scene = { sky: [string, string]; sun: string; hills: string[]; skin: string; shirt: string; hair: string };
const SCENES: Scene[] = [
  { sky: ['#8ED1FF', '#FFE9B8'], sun: '#FFF6C9', hills: ['#5DB887', '#3F9A6E'], skin: '#E9B58D', shirt: '#F0285C', hair: '#2B1D1A' },
  { sky: ['#2B2A6B', '#FF8FB0'], sun: '#FFD66B', hills: ['#2A2358', '#1B1646'], skin: '#C98E67', shirt: '#FFDD3C', hair: '#14102B' },
  { sky: ['#FFD3A3', '#FF7A8A'], sun: '#FFF1D1', hills: ['#8A5A9E', '#5C3C7E'], skin: '#F2C4A0', shirt: '#2F6BFF', hair: '#6B3B1D' },
  { sky: ['#B6F0D8', '#8CC9FF'], sun: '#FFFFFF', hills: ['#47B39B', '#2E8C7C'], skin: '#9A6A4B', shirt: '#FF6F3C', hair: '#0F0D1A' },
];

export function sceneCanvas(i: number, w = 480, h = 600): HTMLCanvasElement {
  const s = SCENES[i % SCENES.length];
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d')!;
  const sky = x.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, s.sky[0]);
  sky.addColorStop(1, s.sky[1]);
  x.fillStyle = sky;
  x.fillRect(0, 0, w, h);
  const sun = x.createRadialGradient(w * 0.75, h * 0.25, 0, w * 0.75, h * 0.25, w * 0.3);
  sun.addColorStop(0, s.sun);
  sun.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = sun;
  x.fillRect(0, 0, w, h);
  s.hills.forEach((col, k) => {
    x.fillStyle = col;
    x.beginPath();
    x.moveTo(0, h);
    for (let px = 0; px <= w; px += 10) x.lineTo(px, h * (0.62 + k * 0.08) + Math.sin(px / 70 + k * 2 + i) * h * 0.04);
    x.lineTo(w, h);
    x.fill();
  });
  // friendly figure
  const cx = w * 0.42, base = h * 1.02;
  x.fillStyle = s.shirt;
  x.beginPath();
  x.ellipse(cx, base, w * 0.3, h * 0.26, 0, Math.PI, 0);
  x.fill();
  x.fillStyle = s.skin;
  x.fillRect(cx - w * 0.05, h * 0.6, w * 0.1, h * 0.1);
  x.beginPath();
  x.ellipse(cx, h * 0.52, w * 0.15, h * 0.13, 0, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = s.hair;
  x.beginPath();
  x.ellipse(cx, h * 0.47, w * 0.16, h * 0.115, 0, Math.PI, 0);
  x.fill();
  x.fillStyle = '#17163A';
  x.beginPath();
  x.arc(cx - w * 0.055, h * 0.525, w * 0.014, 0, 7);
  x.arc(cx + w * 0.055, h * 0.525, w * 0.014, 0, 7);
  x.fill();
  x.strokeStyle = '#17163A';
  x.lineWidth = w * 0.01;
  x.lineCap = 'round';
  x.beginPath();
  x.arc(cx, h * 0.55, w * 0.05, 0.2, Math.PI - 0.2);
  x.stroke();
  return c;
}

let cache: Photo[] | null = null;
/** registers the sample scenes in the photo store (so the renderer can use them) */
export function samplePhotos(): Photo[] {
  cache ??= SCENES.map((_, i) => addPhoto(sceneCanvas(i), true));
  return cache;
}
