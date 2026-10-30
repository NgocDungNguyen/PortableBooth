// Local setup + full render, on your own machine (Windows, macOS or Linux).
//   node tools/setup.mjs                      check tools, install everything, then render both videos
//   node tools/setup.mjs --vo=C:\path\vo.mp3  same, copying your ElevenLabs voice-over in first
//   node tools/setup.mjs --setup-only         only check + install
// Extra flags go to the build: --no-capture (reuse the last app recordings), --ref=<git ref>.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repo = path.resolve(root, '..', '..');
const win = process.platform === 'win32';
const args = process.argv.slice(2);
const PY = process.env.PYTHON || (win ? 'python' : 'python3');

const ok = (m) => console.log(`  \u2713 ${m}`);
const step = (m) => console.log(`\n\u25B6 ${m}`);
function die(m) {
  console.error(`\n\u2717 ${m}\n`);
  process.exit(1);
}
const has = (cmd, a = ['--version']) => spawnSync(cmd, a, { stdio: 'ignore', shell: win }).status === 0;
const run = (cmd, a, cwd = root) => execFileSync(cmd, a, { stdio: 'inherit', cwd, shell: win && ['npm', 'npx'].includes(cmd) });

step('Checking tools');
const [major] = process.versions.node.split('.').map(Number);
if (major < 20) die(`Node.js 20 or newer is needed (you have ${process.versions.node}). Get it from https://nodejs.org`);
ok(`Node.js ${process.versions.node}`);
if (!has('git')) die('git is missing. Install it from https://git-scm.com');
ok('git');
if (!has('ffmpeg', ['-version']) || !has('ffprobe', ['-version']))
  die(`ffmpeg is missing. Install it:\n  Windows: winget install Gyan.FFmpeg   (then open a NEW terminal)\n  macOS:   brew install ffmpeg\n  Linux:   sudo apt install ffmpeg`);
ok('ffmpeg');
if (!has(PY)) die(`Python 3 is missing ("${PY}"). Install it from https://www.python.org (tick "Add to PATH" on Windows), or set PYTHON=...`);
ok(`Python (${PY})`);
if (spawnSync(PY, ['-c', 'import numpy, scipy'], { stdio: 'ignore' }).status !== 0) {
  step('Installing Python packages (numpy, scipy)');
  run(PY, ['-m', 'pip', 'install', '--user', '-r', path.join(root, 'requirements.txt')]);
}
ok('numpy + scipy');

step('Installing the app (needed to record it)');
if (!fs.existsSync(path.join(repo, 'node_modules'))) run('npm', ['ci', '--no-audit', '--no-fund'], repo);
ok('app dependencies');

step('Installing the video project');
if (!fs.existsSync(path.join(root, 'node_modules', 'remotion'))) run('npm', ['install', '--no-audit', '--no-fund']);
ok('Remotion + Playwright');
try {
  run('npx', ['playwright', 'install', 'chromium']);
  ok('Chromium for recording the app');
} catch {
  console.warn('  ! Could not download Chromium for recording. Check your internet, then run: npx playwright install chromium');
}

const vo = args.find((a) => a.startsWith('--vo='))?.slice(5);
const voDest = path.join(root, 'public', 'audio', 'vo.mp3');
if (vo) {
  if (!fs.existsSync(vo)) die(`Voice-over not found: ${vo}`);
  fs.mkdirSync(path.dirname(voDest), { recursive: true });
  fs.copyFileSync(vo, voDest);
  ok(`voice-over copied from ${vo}`);
}
if (!fs.existsSync(voDest)) die(`Put your ElevenLabs voice-over at\n  ${voDest}\nor run again with --vo=<path to the mp3>`);
ok('voice-over found');

if (args.includes('--setup-only')) {
  console.log('\nSetup done. Render with:  npm run build   (in marketing/ad-video)\n');
  process.exit(0);
}

step('Rendering (records the app, makes the music, renders both videos). This takes 30-60 minutes.');
const pass = args.filter((a) => a === '--no-capture' || a.startsWith('--ref='));
run('node', ['tools/build.mjs', ...pass]);
console.log(`\n\u2713 Done. Your videos are in ${path.resolve(root, '..', 'out')}\n`);
