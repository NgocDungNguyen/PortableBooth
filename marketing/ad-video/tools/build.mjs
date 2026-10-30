// One command after the app changes:  npm run build
//   1. re-capture every real-app asset from a fresh worktree of HEAD (capture/all.cjs)
//   2. regenerate sound cues from the edit + re-compose / re-mix the music (audio/compose.py)
//   3. render both cuts, covers and the SRT into marketing/out/
// Flags: --no-capture (reuse public/cap), --ref=<git ref>. Requires public/audio/vo.mp3 (the owner's voice-over).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const ref = (args.find((a) => a.startsWith('--ref=')) || '').slice(6) || 'HEAD';
const win = process.platform === 'win32';
// npm / npx are .cmd files on Windows; python is "python" there and "python3" elsewhere
const run = (cmd, a) => execFileSync(cmd, a, { stdio: 'inherit', cwd: root, shell: win && (cmd === 'npx' || cmd === 'npm') });
const PY = process.env.PYTHON || (win ? 'python' : 'python3');
if (!fs.existsSync(path.join(root, 'public/audio/vo.mp3'))) throw new Error('missing public/audio/vo.mp3 (the voice-over)');
run('node', ['tools/fonts.mjs']);
if (!fs.existsSync(path.join(root, 'src/timing.json'))) run(PY, ['tools/align.py', 'public/audio/vo.mp3']);
if (!args.includes('--no-capture')) run('node', ['capture/all.cjs', ref]);
run('npx', ['tsx', 'tools/cues.ts']);
run(PY, ['audio/compose.py']);
run('node', ['tools/render.mjs']);
run('node', ['tools/qa.mjs']);
