// Render QA stills: node tools/stills.mjs <outDir> <comp> <sec,sec,...>  (no audio needed)
import path from 'node:path';
import fs from 'node:fs';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
const [out, comp, secs] = process.argv.slice(2);
const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const CHROME = process.env.REMOTION_CHROME || '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
fs.mkdirSync(out, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.join(root, 'src/index.ts'), publicDir: path.join(root, 'public') });
const inputProps = { audio: false };
for (const c of comp.split(',')) {
  const composition = await selectComposition({ serveUrl, id: c, inputProps, browserExecutable: CHROME, chromiumOptions: { gl: 'swangle' } });
  for (const s of secs.split(',')) {
    const frame = Math.min(composition.durationInFrames - 1, Math.round(parseFloat(s) * 30));
    await renderStill({ serveUrl, composition, frame, output: path.join(out, `${c}-${String(s).padStart(5, '0')}.jpg`), imageFormat: 'jpeg', jpegQuality: 85, inputProps, browserExecutable: CHROME, chromiumOptions: { gl: 'swangle' } });
  }
  console.log('done', c);
}
