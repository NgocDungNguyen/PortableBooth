// Copies the app's own Fontsource fonts (same packages as the app) into public/fonts for the edit.
import fs from 'node:fs';
import path from 'node:path';
const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const nm = path.join(root, 'node_modules');
const out = path.join(root, 'public', 'fonts');
fs.mkdirSync(out, { recursive: true });
const files = [
  '@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2',
  '@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-ext-wght-normal.woff2',
  '@fontsource-variable/geist/files/geist-latin-wght-normal.woff2',
  '@fontsource-variable/geist/files/geist-latin-ext-wght-normal.woff2',
  '@fontsource-variable/geist/files/geist-vietnamese-wght-normal.woff2',
  '@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2',
  '@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2',
  '@fontsource/instrument-serif/files/instrument-serif-latin-ext-400-italic.woff2',
];
for (const f of files) fs.copyFileSync(path.join(nm, f), path.join(out, path.basename(f)));
console.log('fonts:', files.length);
