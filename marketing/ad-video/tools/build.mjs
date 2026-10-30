// One command after the app changes:  npm run build
//   1. re-capture every real-app asset from a fresh worktree of HEAD (capture/all.cjs)
//   2. regenerate sound cues from the edit + re-compose / re-mix the music (audio/compose.py)
//   3. render both cuts, covers and the SRT into marketing/out/
// Flags: --no-capture (reuse public/cap), --ref=<git ref>. Requires public/audio/vo.mp3 (the owner's voice-over).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const args = process.argv.slice(2);
const ref = (args.find((a) => a.startsWith('--ref=')) || '').slice(6) || 'HEAD';
const run = (cmd, a) => execFileSync(cmd, a, { stdio: 'inherit', cwd: root });
if (!fs.existsSync(path.join(root, 'public/audio/vo.mp3'))) throw new Error('missing public/audio/vo.mp3 (the voice-over)');
run('node', ['tools/fonts.mjs']);
if (!fs.existsSync(path.join(root, 'src/timing.json'))) run('python3', ['tools/align.py', 'public/audio/vo.mp3']);
if (!args.includes('--no-capture')) run('node', ['capture/all.cjs', ref]);
run('npx', ['tsx', 'tools/cues.ts']);
run('python3', ['audio/compose.py']);
run('node', ['tools/render.mjs']);
run('node', ['tools/qa.mjs']);
