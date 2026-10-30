// Re-capture every real-app asset from a fresh, clean worktree of the repo's current HEAD.
//   node capture/all.cjs [git-ref]        (default: HEAD)
// 1. git worktree add (detached) in the OS temp dir, reuse the repo's node_modules when the lockfile matches, else npm ci
// 2. start Vite on :5199, 3. export sample photos, finished films, stills, then record every demo clip
// 4. stop Vite and remove the worktree. Nothing in the main checkout is touched.
const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const AD = path.join(__dirname, '..');
const REPO = execFileSync('git', ['-C', AD, 'rev-parse', '--show-toplevel']).toString().trim();
const ref = process.argv[2] || 'HEAD';
const PORT = process.env.PORT || '5199';
const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-app-'));
const env = { ...process.env, APP_URL: `http://localhost:${PORT}`, NODE_PATH: process.env.NODE_PATH || execFileSync('npm', ['root', '-g']).toString().trim() };
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', env, ...opts });

function waitFor(url, ms = 60000) {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => http.get(url, (r) => { r.resume(); resolve(); }).on('error', () => (Date.now() - t0 > ms ? reject(new Error('vite did not start')) : setTimeout(tick, 500)));
    tick();
  });
}

(async () => {
  fs.rmSync(wt, { recursive: true, force: true });
  run('git', ['-C', REPO, 'worktree', 'add', '--detach', wt, ref]);
  const sha = execFileSync('git', ['-C', wt, 'rev-parse', '--short', 'HEAD']).toString().trim();
  console.log('capturing app at', sha, 'in', wt);
  const sameLock = fs.existsSync(path.join(REPO, 'node_modules')) &&
    fs.readFileSync(path.join(REPO, 'package-lock.json'), 'utf8') === fs.readFileSync(path.join(wt, 'package-lock.json'), 'utf8');
  if (sameLock) fs.symlinkSync(path.join(REPO, 'node_modules'), path.join(wt, 'node_modules'));
  else run('npm', ['ci', '--no-audit', '--no-fund'], { cwd: wt });
  const vite = spawn('npx', ['vite', '--port', PORT, '--strictPort'], { cwd: wt, env, stdio: 'ignore', detached: true });
  try {
    await waitFor(`http://localhost:${PORT}/`);
    await new Promise((r) => setTimeout(r, 3000));
    for (const s of ['samples.cjs', 'films.cjs', 'shots.cjs', 'record.cjs']) run('node', [path.join(__dirname, s)]);
    fs.writeFileSync(path.join(AD, 'public', 'cap', 'SOURCE'), `${sha}\n`);
  } finally {
    try { process.kill(-vite.pid); } catch {}
    try { run('git', ['-C', REPO, 'worktree', 'remove', '--force', wt]); } catch (e) { console.error(e.message); }
  }
})().catch((e) => { console.error(e); process.exit(1); });
