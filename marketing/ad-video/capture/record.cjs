// Records the real-app demo clips used by the ad. Usage: node capture/record.cjs [clip ...]  (default: all)
// Needs the app running (APP_URL, default http://localhost:5199). Output: public/cap/<clip>.mp4 + .json (events, marks).
// Clips are paced to the voice-over (src/timing.json); the edit aligns them by their named marks.
const path = require('path');
const fs = require('fs');
const { session, dropFiles, photos, PHONE, DESKTOP, sleep } = require('./lib.cjs');

const timing = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'timing.json'), 'utf8'));
const W = timing.lines.flatMap((l) => l.words);
/** VO start time of the n-th occurrence of a word */
const vo = (w, n = 1) => {
  const hits = W.filter((x) => x.w === w);
  if (!hits[n - 1]) throw new Error(`word ${w}#${n} not in timing`);
  return hits[n - 1].s;
};

const tab = (p, name) => p.getByRole('tab', { name, exact: true });

async function fill(s, n = 4, off = 0) {
  await dropFiles(s.page, photos(n, off), { hoverMs: 100 });
  await sleep(2500);
}

const CLIPS = {
  // Film tab on a phone: Strip, Instant, Film roll, then Tall -> Wide, then "Next: add photos".
  async 'phone-film'() {
    const s = await session('phone-film', PHONE);
    await s.open();
    const p = s.page;
    const base = vo('start') - 1.2; // clip time 1.2 s == "Start"
    await s.start();
    const at = (t, lead = 0.45) => s.until(t - base - lead);
    const film = (name) => p.getByRole('radio', { name: new RegExp('^' + name) });
    s.mark('start');
    await at(vo('strip', 2)); await s.tap(film('Strip'), { mark: 'strip' });
    await at(vo('instant')); await s.tap(film('Instant card'), { mark: 'instant' });
    await at(vo('roll')); await s.tap(film('Film roll'), { mark: 'roll' });
    await at(vo('tall')); await s.tap(p.getByRole('radio', { name: 'Print (tall)' }), { mark: 'tall' });
    await at(vo('wide')); await s.tap(p.getByRole('radio', { name: 'Share (wide)' }), { mark: 'wide' });
    await at(vo('feed') + 0.25); await s.tap(p.getByRole('button', { name: /Next: add photos/ }), { mark: 'next' });
    await sleep(1600);
    return s.stop();
  },

  // Laptop: photos dropped in from a folder (real drag-over state + import into the slots).
  async 'desk-upload'() {
    const s = await session('desk-upload', DESKTOP, { colorScheme: 'dark' });
    await s.open();
    const p = s.page;
    await tab(p, 'Photos').click();
    await sleep(500);
    await s.start();
    await s.moveTo(1000, 520, 10);
    await sleep(600);
    s.mark('drag');
    // cursor arrives carrying the files from the left (the folder is drawn by the edit)
    await s.moveTo(560, 470, 700);
    s.mark('drop');
    await dropFiles(p, photos(4, 0), { hoverMs: 650 });
    await sleep(2600);
    s.mark('filled');
    await s.moveTo(980, 300, 600);
    await sleep(800);
    return s.stop();
  },

  // Laptop editing: looks, frames, colours, stickers, text, widget, drag, resize, crop, tint.
  async 'desk-edit'() {
    const s = await session('desk-edit', DESKTOP, { colorScheme: 'dark' });
    await s.open();
    const p = s.page;
    await fill(s, 4, 0);
    await tab(p, 'Looks').click();
    await sleep(800);
    await s.start();
    await sleep(500);
    const filt = (n) => p.getByRole('radiogroup', { name: 'Filter' }).getByRole('radio').nth(n);
    s.mark('looks');
    for (const [i, n] of [[1, 2], [2, 4], [3, 6], [4, 7]]) { await s.tap(filt(n), { mark: `look${i}`, ms: 380 }); await sleep(650); }
    await s.tap(tab(p, 'Frame'), { mark: 'frame' }); await sleep(500);
    const style = (n) => p.getByRole('radiogroup', { name: 'Frame style' }).getByRole('radio').nth(n);
    await s.tap(style(2), { mark: 'frame1', ms: 380 }); await sleep(650);
    await s.tap(style(5), { mark: 'frame2', ms: 380 }); await sleep(650);
    const sw = (n) => p.getByRole('radiogroup', { name: 'Film colour' }).getByRole('radio').nth(n);
    await s.tap(sw(4), { mark: 'colour1', ms: 380 }); await sleep(600);
    await s.tap(sw(7), { mark: 'colour2', ms: 380 }); await sleep(600);
    await s.tap(tab(p, 'Add'), { mark: 'add' }); await sleep(700);
    await s.tap(p.getByRole('radio', { name: 'Emoji' }), { ms: 380 }); await sleep(900);
    const sticker = p.locator('button[aria-label^="Add "].tile').nth(2);
    await s.tap(sticker, { mark: 'sticker', ms: 380 }); await sleep(900);
    // drag the sticker, then resize it from its corner handle
    const box = async () => {
      const h = p.locator('span.cursor-nwse-resize');
      const a = await h.nth(0).boundingBox();
      const d = await h.nth(3).boundingBox();
      return { cx: (a.x + d.x + d.width) / 2, cy: (a.y + d.y + d.height) / 2, br: { x: d.x + d.width / 2, y: d.y + d.height / 2 } };
    };
    let b = await box();
    await s.drag({ x: b.cx, y: b.cy }, { x: b.cx + 70, y: b.cy - 120 }, { mark: 'drag', ms: 800 }); await sleep(500);
    b = await box();
    await s.drag(b.br, { x: b.br.x + 45, y: b.br.y + 45 }, { mark: 'resize', ms: 700 }); await sleep(600);
    await s.tap(tab(p, 'Text'), { mark: 'text' }); await sleep(500);
    await s.tap(p.getByRole('textbox', { name: 'Text' }), { ms: 380 });
    s.mark('type');
    await s.type(p.getByRole('textbox', { name: 'Text' }), 'best night ever', { cps: 14 });
    await s.tap(p.getByRole('button', { name: 'Add text', exact: true }), { mark: 'textadd', ms: 300 }); await sleep(900);
    await s.tap(tab(p, 'Add'), { ms: 380 }); await sleep(500);
    await s.tap(p.getByRole('radio', { name: 'Widgets' }), { ms: 380 }); await sleep(700);
    await s.tap(p.locator('button[aria-label^="Add "].tile').nth(0), { mark: 'widget', ms: 380 }); await sleep(1100);
    // crop: select a photo, zoom in; tint: give it its own filter
    await s.tap(tab(p, 'Photos'), { ms: 380 }); await sleep(400);
    await s.tap(p.getByRole('radio', { name: /^Photo 2/ }), { mark: 'slot', ms: 380 }); await sleep(700);
    const zoom = p.getByRole('slider', { name: 'Zoom' });
    const zb = (await s.center(zoom)).b;
    await s.drag({ x: zb.x + 4, y: zb.y + zb.height / 2 }, { x: zb.x + zb.width * 0.55, y: zb.y + zb.height / 2 }, { mark: 'crop', ms: 700 }); await sleep(600);
    await s.tap(p.getByRole('button', { name: 'Choose filter' }), { ms: 380 }); await sleep(700);
    const ft = (n) => p.getByRole('radiogroup', { name: 'Filter' }).getByRole('radio').nth(n);
    await s.tap(ft(5), { mark: 'tint', ms: 380 }); await sleep(700);
    await s.tap(ft(1), { mark: 'tint2', ms: 380 }); await sleep(900);
    s.mark('end');
    return s.stop();
  },

  // Phone editing (used next to the laptop): looks + a sticker on the phone.
  async 'phone-edit'() {
    const s = await session('phone-edit', PHONE);
    await s.open();
    const p = s.page;
    await fill(s, 4, 2);
    await tab(p, 'Looks').click();
    await sleep(800);
    await s.start();
    await sleep(400);
    const filt = (n) => p.getByRole('radiogroup', { name: 'Filter' }).getByRole('radio').nth(n);
    for (const [i, n] of [[1, 2], [2, 5], [3, 10]]) { await s.tap(filt(n), { mark: `look${i}`, ms: 380 }); await sleep(700); }
    await s.tap(tab(p, 'Frame'), { mark: 'frame', ms: 380 }); await sleep(500);
    const style = (n) => p.getByRole('radiogroup', { name: 'Frame style' }).getByRole('radio').nth(n);
    await s.tap(style(3), { mark: 'frame1', ms: 380 }); await sleep(700);
    const sw = (n) => p.getByRole('radiogroup', { name: 'Film colour' }).getByRole('radio').nth(n);
    await s.tap(sw(5), { mark: 'colour1', ms: 380 }); await sleep(900);
    s.mark('end');
    return s.stop();
  },

  // Phone export: the sheet slides up, Save, then "Send to a nearby phone" (QR offer).
  async 'phone-export'() {
    const s = await session('phone-export', PHONE);
    await s.open();
    const p = s.page;
    await fill(s, 4, 0);
    await tab(p, 'Looks').click(); await sleep(300);
    await p.getByRole('radiogroup', { name: 'Filter' }).getByRole('radio').nth(3).click(); await sleep(600);
    await s.start();
    await sleep(400);
    await s.tap(p.getByRole('button', { name: 'Export', exact: true }), { mark: 'export' });
    await sleep(1300);
    const dl = p.waitForEvent('download', { timeout: 15000 }).catch(() => null);
    await s.tap(p.getByRole('button', { name: /Save to device/ }), { mark: 'save' });
    const d = await dl;
    if (d) await d.saveAs(path.join(__dirname, '..', 'public', 'films', 'export-from-app.jpg'));
    await sleep(900);
    await s.tap(p.getByRole('button', { name: /Send to a nearby phone/ }), { mark: 'send' });
    await sleep(3500);
    s.mark('qr');
    await sleep(1500);
    return s.stop();
  },
};

(async () => {
  const want = process.argv.slice(2);
  const names = want.length ? want : Object.keys(CLIPS);
  for (const n of names) {
    if (!CLIPS[n]) throw new Error('unknown clip ' + n);
    const t = Date.now();
    await CLIPS[n]();
    console.log(`  (${((Date.now() - t) / 1000).toFixed(0)} s)`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
