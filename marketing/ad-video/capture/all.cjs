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
const win = process.platform === 'win32';
const PY = process.env.PYTHON || (win ? 'python' : 'python3');
// Playwright comes from this folder's node_modules (npm install here); a global install also works via NODE_PATH
const globalRoot = (() => { try { return execFileSync('npm', ['root', '-g'], { shell: win }).toString().trim(); } catch { return ''; } })();
const env = { ...process.env, APP_URL: `http://localhost:${PORT}`, NODE_PATH: [path.join(AD, 'node_modules'), process.env.NODE_PATH, globalRoot].filter(Boolean).join(path.delimiter) };
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', env, shell: win && (cmd === 'npm' || cmd === 'npx'), ...opts });

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
  // a junction needs no admin rights on Windows; a normal symlink elsewhere
  if (sameLock) fs.symlinkSync(path.join(REPO, 'node_modules'), path.join(wt, 'node_modules'), win ? 'junction' : 'dir');
  else run('npm', ['ci', '--no-audit', '--no-fund'], { cwd: wt });
  const vite = spawn('npx', ['vite', '--port', PORT, '--strictPort'], { cwd: wt, env, stdio: 'ignore', detached: !win, shell: win });
  try {
    await waitFor(`http://localhost:${PORT}/`);
    await new Promise((r) => setTimeout(r, 3000));
    for (const s of ['samples.cjs', 'films.cjs', 'shots.cjs', 'record.cjs']) run('node', [path.join(__dirname, s)]);
    run(PY, [path.join(AD, 'tools', 'lag.py')]);
    fs.writeFileSync(path.join(AD, 'public', 'cap', 'SOURCE'), `${sha}\n`);
  } finally {
    try {
      if (win) execFileSync('taskkill', ['/pid', String(vite.pid), '/T', '/F'], { stdio: 'ignore' });
      else process.kill(-vite.pid);
    } catch {}
    // Windows: junctions must be removed before the worktree, or git deletes through them
    if (win) {
      const nm = path.join(wt, 'node_modules');
      try { fs.unlinkSync(nm); } catch { try { fs.rmdirSync(nm); } catch {} }
    }
    try { run('git', ['-C', REPO, 'worktree', 'remove', '--force', wt]); } catch (e) { console.error(e.message); }
  }
})().catch((e) => { console.error(e); process.exit(1); });
