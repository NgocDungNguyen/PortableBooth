// Shared recorder: drives the real app with Playwright, captures a CDP screencast (crisp, device-pixel frames),
// logs pointer/tap events and named marks, then builds a constant-30-fps H.264 clip with ffmpeg.
// The finger / cursor is NOT drawn into the page: it is drawn by the Remotion edit from the logged events,
// so it stays sharp and also sits on top of modal dialogs (top layer).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const APP_URL = process.env.APP_URL || 'http://localhost:5199';
const PUBLIC = path.join(__dirname, '..', 'public');
const CAP = path.join(PUBLIC, 'cap');
const FPS = 30;

const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

async function session(name, device, { colorScheme = 'light', url = '/#studio' } = {}) {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  const ctx = await browser.newContext({ ...device, colorScheme, reducedMotion: 'no-preference', acceptDownloads: true });
  const page = await ctx.newPage();
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), `cap-${name}-`));
  const frames = [];
  const events = [];
  const marks = {};
  let pos = { x: device.viewport.width / 2, y: device.viewport.height * 0.7 };
  let t0 = null;
  let cdp = null;
  const now = () => Date.now() / 1000;

  const s = {
    page,
    ctx,
    async open() {
      await page.goto(APP_URL + url);
      await page.waitForLoadState('networkidle').catch(() => {});
      await sleep(1200);
    },
    async start() {
      cdp = await ctx.newCDPSession(page);
      cdp.on('Page.screencastFrame', async (f) => {
        const ts = f.metadata.timestamp;
        const file = path.join(tmp, `f${String(frames.length).padStart(6, '0')}.jpg`);
        fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
        frames.push({ ts, file });
        try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {}
      });
      const vw = device.viewport.width * device.deviceScaleFactor;
      const vh = device.viewport.height * device.deviceScaleFactor;
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: vw, maxHeight: vh, everyNthFrame: 1 });
      t0 = now();
      // nudge a repaint so the first frame exists
      await page.evaluate(() => document.body.style.setProperty('--rec', String(Math.random())));
      await sleep(300);
    },
    t() { return now() - t0; },
    mark(n) { marks[n] = now() - t0; },
    /** wait until clip time t (s) */
    async until(t) { const d = t - (now() - t0); if (d > 0) await sleep(d * 1000); },
    async moveTo(x, y, ms = 420) {
      const from = { ...pos };
      const steps = Math.max(2, Math.round(ms / 16));
      const tStart = now();
      for (let i = 1; i <= steps; i++) {
        const k = ease(i / steps);
        const nx = from.x + (x - from.x) * k + Math.sin(k * Math.PI) * (x - from.x) * 0.04;
        const ny = from.y + (y - from.y) * k - Math.sin(k * Math.PI) * 18;
        events.push({ t: now() - t0, type: 'move', x: nx, y: ny });
        if (device.isMobile) {
          // fingers don't hover: only log, the page sees the tap
        } else {
          await page.mouse.move(nx, ny);
        }
        const target = tStart + (ms / 1000) * (i / steps);
        const d = target - now();
        if (d > 0) await sleep(d * 1000);
      }
      pos = { x, y };
    },
    async center(loc) {
      await loc.scrollIntoViewIfNeeded().catch(() => {});
      const b = await loc.boundingBox();
      if (!b) throw new Error('no box for ' + loc);
      return { x: b.x + b.width / 2, y: b.y + b.height / 2, b };
    },
    async tap(loc, { ms = 420, mark, hold = 90 } = {}) {
      const c = await s.center(loc);
      await s.moveTo(c.x, c.y, ms);
      if (mark) s.mark(mark);
      events.push({ t: now() - t0, type: 'down', x: c.x, y: c.y });
      await page.mouse.move(c.x, c.y);
      await page.mouse.down();
      await sleep(hold);
      await page.mouse.up();
      events.push({ t: now() - t0, type: 'up', x: c.x, y: c.y });
      return c;
    },
    /** drag in small steps, waiting for the app to paint each one (the edit time-remaps the segment to a natural speed) */
    async drag(from, to, { steps = 16, mark } = {}) {
      await s.moveTo(from.x, from.y, 380);
      if (mark) s.mark(mark);
      events.push({ t: now() - t0, type: 'down', x: from.x, y: from.y });
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await s.paint();
      for (let i = 1; i <= steps; i++) {
        const k = ease(i / steps);
        const x = from.x + (to.x - from.x) * k;
        const y = from.y + (to.y - from.y) * k;
        await page.mouse.move(x, y);
        events.push({ t: now() - t0, type: 'drag', x, y });
        await s.paint();
      }
      await page.mouse.up();
      events.push({ t: now() - t0, type: 'up', x: to.x, y: to.y });
      await s.paint();
      if (mark) s.mark(mark + 'End');
      pos = { ...to };
    },
    /** wait until the page has painted twice */
    async paint() {
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
    },
    async type(loc, text, { cps = 11 } = {}) {
      await loc.click();
      for (const ch of text) {
        await page.keyboard.type(ch);
        events.push({ t: now() - t0, type: 'key', x: pos.x, y: pos.y });
        await sleep(1000 / cps);
      }
    },
    async stop() {
      await sleep(600);
      await cdp.send('Page.stopScreencast');
      await sleep(200);
      const end = now();
      await browser.close();
      return build(name, device, frames, events, marks, t0, end, tmp);
    },
    async close() { await browser.close(); },
  };
  return s;
}

function build(name, device, frames, events, marks, t0, tEnd, tmp) {
  if (!frames.length) throw new Error('no frames captured for ' + name);
  fs.mkdirSync(CAP, { recursive: true });
  frames.sort((a, b) => a.ts - b.ts);
  // CDP timestamps are wall-clock seconds, the same clock as Date.now(): align them to t0.
  const dur = tEnd - t0;
  const n = Math.floor(dur * FPS);
  const list = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const t = t0 + k / FPS;
    while (j + 1 < frames.length && frames[j + 1].ts <= t) j++;
    list.push(frames[j].file);
  }
  // concat list: one entry per output frame
  const lines = [];
  for (const f of list) lines.push(`file '${f}'`, `duration ${1 / FPS}`);
  lines.push(`file '${list[list.length - 1]}'`);
  const listFile = path.join(tmp, 'list.txt');
  fs.writeFileSync(listFile, lines.join('\n'));
  const out = path.join(CAP, `${name}.mp4`);
  const W = device.viewport.width * device.deviceScaleFactor;
  const H = device.viewport.height * device.deviceScaleFactor;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listFile,
    '-vf', `scale=${W}:${H}:flags=lanczos,fps=${FPS},format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '14',
    '-g', '15', '-movflags', '+faststart', out]);
  const meta = { name, width: W, height: H, css: device.viewport, dpr: device.deviceScaleFactor, mobile: !!device.isMobile,
    duration: n / FPS, frames: n, events, marks };
  fs.writeFileSync(path.join(CAP, `${name}.json`), JSON.stringify(meta, null, 1));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`${name}: ${n} frames (${(n / FPS).toFixed(1)} s) from ${frames.length} screencast frames; marks`, Object.keys(marks).join(','));
  return meta;
}

/** drop real image files onto the page (the app's window-level drop handler) */
async function dropFiles(page, files, { hoverMs = 700 } = {}) {
  const payload = files.map((f) => ({ name: path.basename(f), b64: fs.readFileSync(f).toString('base64') }));
  await page.evaluate(async ({ payload, hoverMs }) => {
    const dt = new DataTransfer();
    for (const p of payload) {
      const bin = atob(p.b64);
      const u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      dt.items.add(new File([u], p.name, { type: 'image/jpeg' }));
    }
    const ev = (type) => new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: innerWidth / 2, clientY: innerHeight / 2 });
    document.body.dispatchEvent(ev('dragenter'));
    document.body.dispatchEvent(ev('dragover'));
    await new Promise((r) => setTimeout(r, hoverMs));
    document.body.dispatchEvent(ev('drop'));
  }, { payload, hoverMs });
}

const photos = (n, off = 0) => Array.from({ length: n }, (_, i) => path.join(PUBLIC, 'photos', `photo-${(i + off) % 7}.jpg`));

module.exports = { session, dropFiles, photos, PHONE, DESKTOP, sleep, APP_URL, PUBLIC };
