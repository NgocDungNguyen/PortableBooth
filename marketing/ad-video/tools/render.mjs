// Render both cuts + covers + captions, then master the delivery files.
//   node tools/render.mjs [9x16|16x9 ...]
// Output: ../out/PortableBooth-ad-9x16.mp4, -16x9.mp4, -cover-*.png, PortableBooth-ad.srt
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const OUT = path.resolve(root, '..', 'out');
const TMP = path.join(root, 'out');
const CHROME = process.env.REMOTION_CHROME || '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const chromiumOptions = { gl: 'swangle' };
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });
const want = process.argv.slice(2).length ? process.argv.slice(2) : ['9x16', '16x9'];

const serveUrl = await bundle({ entryPoint: path.join(root, 'src/index.ts'), publicDir: path.join(root, 'public') });

for (const fmt of want) {
  const id = `Ad${fmt}`;
  const inputProps = { audio: false };
  const composition = await selectComposition({ serveUrl, id, inputProps, browserExecutable: CHROME, chromiumOptions });
  const raw = path.join(TMP, `${id}-video.mp4`);
  const t0 = Date.now();
  let last = -1;
  await renderMedia({
    serveUrl, composition, inputProps, codec: 'h264', outputLocation: raw, muted: true, crf: 16, pixelFormat: 'yuv420p', x264Preset: 'slow',
    imageFormat: 'jpeg', jpegQuality: 92, concurrency: Number(process.env.CONCURRENCY || 4), browserExecutable: CHROME, chromiumOptions,
    timeoutInMilliseconds: 120000,
    onProgress: ({ progress }) => {
      const p = Math.floor(progress * 20);
      if (p !== last) { last = p; process.stdout.write(`${id} ${Math.round(progress * 100)}% `); }
    },
  });
  console.log(`\n${id} rendered in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  // mux the mastered mix: H.264 High, yuv420p, AAC-LC 48 kHz stereo 192 kbps, faststart
  const final = path.join(OUT, `PortableBooth-ad-${fmt}.mp4`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-i', path.join(root, 'public/audio/mix.wav'),
    '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p',
    '-r', '30', '-g', '60', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-shortest', '-movflags', '+faststart', final]);
  console.log('wrote', final);
  const cover = await selectComposition({ serveUrl, id: `Cover${fmt}`, inputProps, browserExecutable: CHROME, chromiumOptions });
  await renderStill({ serveUrl, composition: cover, frame: 0, output: path.join(OUT, `PortableBooth-ad-cover-${fmt}.png`), imageFormat: 'png', inputProps, browserExecutable: CHROME, chromiumOptions });
}

// SRT from the caption chunks
const timing = JSON.parse(fs.readFileSync(path.join(root, 'src/timing.json'), 'utf8'));
const ts = (s) => {
  const ms = Math.round(s * 1000);
  const p = (n, k = 2) => String(n).padStart(k, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
const caps = timing.captions;
const firsts = new Set(timing.lines.map((l) => l.start));
const srt = caps.map((c, i) => {
  const end = Math.min(c.end + 0.35, caps[i + 1] ? caps[i + 1].start - 0.05 : c.end + 1.5);
  let text = c.words.map((w) => w.w).join(' ');
  if (firsts.has(c.start)) text = text.charAt(0).toUpperCase() + text.slice(1);
  return `${i + 1}\n${ts(c.start)} --> ${ts(end)}\n${text}\n`;
}).join('\n');
fs.writeFileSync(path.join(OUT, 'PortableBooth-ad.srt'), srt);
console.log('wrote SRT');
