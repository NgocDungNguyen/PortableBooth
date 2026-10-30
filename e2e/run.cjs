/* End-to-end smoke test. Needs a running build (npm run build && npm run preview) and Playwright with Chromium.
   Usage: BASE_URL=http://localhost:4173 SHOTS=./shots node e2e/run.cjs */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const SHOTS = path.resolve(process.env.SHOTS || './e2e-shots');
const AXE = require.resolve('axe-core/axe.min.js');
fs.mkdirSync(SHOTS, { recursive: true });

const errors = [];
let failed = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) failed++; };

async function axe(page, name) {
  await page.addScriptTag({ path: AXE });
  const r = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })).violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes[0].html.slice(0, 140) })));
  ok(r.filter((v) => v.impact === 'critical' || v.impact === 'serious').length === 0, `axe ${name}: no serious/critical violations`);
  r.forEach((v) => console.log(`      axe[${v.impact}] ${v.id} x${v.n}  ${v.sample}`));
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, permissions: ['camera'], acceptDownloads: true, bypassCSP: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const requests = [];
  page.on('request', (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) requests.push(r.url()); });

  // ---- home
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3200);
  await page.screenshot({ path: `${SHOTS}/01-home-desktop.png` });
  await page.screenshot({ path: `${SHOTS}/01b-home-full.png`, fullPage: true });
  await axe(page, 'home');

  const m = await ctx.newPage();
  await m.setViewportSize({ width: 390, height: 844 });
  await m.goto(BASE, { waitUntil: 'networkidle' });
  await m.waitForTimeout(3200);
  await m.screenshot({ path: `${SHOTS}/02-home-mobile.png` });
  ok(await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'home: no horizontal scroll on mobile');
  await m.close();

  // ---- make test photos (canvas -> png)
  const imgs = [];
  for (let i = 0; i < 5; i++) {
    const b64 = await page.evaluate((i) => {
      const c = document.createElement('canvas'); c.width = 900; c.height = 700;
      const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 900, 700); g.addColorStop(0, ['#ff6b6b', '#4dabf7', '#51cf66', '#fcc419', '#9775fa'][i]); g.addColorStop(1, '#222');
      x.fillStyle = g; x.fillRect(0, 0, 900, 700);
      x.fillStyle = '#fff'; x.font = 'bold 300px sans-serif'; x.fillText(String(i + 1), 330, 440);
      x.beginPath(); x.arc(760, 120, 70, 0, 7); x.fill();
      return c.toDataURL('image/png').split(',')[1];
    }, i);
    const p = path.join(SHOTS, `test-${i}.png`); fs.writeFileSync(p, Buffer.from(b64, 'base64')); imgs.push(p);
  }
  const svgBad = path.join(SHOTS, 'evil.svg'); fs.writeFileSync(svgBad, '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  const junk = path.join(SHOTS, 'junk.png'); fs.writeFileSync(junk, 'not an image');

  // ---- studio: film
  await page.getByRole('button', { name: 'Start', exact: true }).first().click();
  await page.waitForSelector('[role=radiogroup][aria-label="Film type"]');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOTS}/03-film.png` });
  await axe(page, 'film step');
  await page.getByRole('radio', { name: /Strip/ }).click();
  await page.getByRole('radio', { name: '3 photos' }).click();
  await page.getByRole('radio', { name: '4 photos' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  // ---- photos: bad files first
  await page.waitForSelector('input[type=file]', { state: 'attached' });
  const fileInput = page.locator('input[type=file]');
  await fileInput.setInputFiles(svgBad);
  await page.waitForSelector('text=Only photos work here');
  ok(true, 'upload: svg rejected with message');
  await fileInput.setInputFiles(junk);
  await page.waitForSelector("text=Couldn't open that photo").catch(() => {});
  ok(await page.getByText(/open that photo|Only photos/).count() > 0, 'upload: junk rejected');
  await fileInput.setInputFiles(imgs.slice(0, 2));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/04-photos-partial.png` });
  ok((await page.getByText('2/4').count()) > 0, 'upload: 2 of 4 slots filled');

  // ---- camera fills the rest
  await page.getByRole('button', { name: 'Camera' }).click();
  await page.waitForSelector('[role=dialog][aria-label=Camera] video');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/05-camera.png` });
  await page.getByRole('button', { name: /Start photo sequence/ }).click();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${SHOTS}/06-countdown.png` });
  await page.waitForSelector('[role=dialog][aria-label=Camera]', { state: 'detached', timeout: 20000 });
  ok((await page.getByRole('button', { name: 'Next' }).isEnabled()), 'camera: sequence filled remaining slots and closed');
  ok(await page.evaluate(() => !document.querySelector('video')), 'camera: video element removed');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/07-photos-full.png` });
  await axe(page, 'photos step');

  // ---- edit
  await page.getByRole('button', { name: 'Next' }).click();
  await page.waitForSelector('[role=tablist][aria-label=Tools]');
  await page.waitForTimeout(800);
  await page.getByRole('radio', { name: 'Cherry' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/08-edit-filter.png` });
  await axe(page, 'edit step (filters)');
  await page.getByRole('tab', { name: 'Adjust' }).click();
  await page.locator('input[aria-label=Grain]').fill('0.6');
  await page.getByRole('tab', { name: 'Stickers' }).click();
  await page.getByRole('button', { name: 'Add Star sticker' }).click();
  await page.getByRole('button', { name: 'Add Heart sticker' }).click();
  await page.getByRole('tab', { name: 'Text' }).click();
  await page.locator('input[aria-label="New text"]').fill('best day');
  await page.getByRole('button', { name: 'Add text' }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/09-edit-stickers-text.png` });
  await page.getByRole('tab', { name: 'Frame' }).click();
  await page.getByRole('radio', { name: 'Film color #FFDD3C' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/10-edit-frame.png` });
  await axe(page, 'edit step (frame)');
  // undo/redo
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.getByRole('button', { name: 'Redo' }).click();
  ok(true, 'undo/redo clickable');

  // ---- export
  await page.getByRole('button', { name: 'Done' }).click();
  await page.waitForSelector('text=Nothing was uploaded');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/11-export.png` });
  await axe(page, 'export step');
  for (const kind of ['Print', 'Share']) {
    await page.getByRole('radio', { name: kind }).click();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('section[aria-label=Save] .btn-primary').click()]);
    const file = path.join(SHOTS, dl.suggestedFilename());
    await dl.saveAs(file);
    const buf = fs.readFileSync(file);
    if (kind === 'Print') {
      ok(buf.slice(1, 4).toString() === 'PNG', 'export: print is a PNG');
      const i = buf.indexOf('pHYs');
      ok(i > 0 && buf.readUInt32BE(i + 4) === 11811, 'export: PNG carries 300 DPI (11811 px/m)');
      const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
      ok(Math.abs(w - 602) <= 1 && Math.abs(h - 1795) <= 1, `export: strip is 51x152mm at 300dpi (got ${w}x${h})`);
    } else {
      ok(buf[0] === 0xff && buf[1] === 0xd8, 'export: share is a JPEG');
      ok(!buf.includes(Buffer.from('Exif')), 'export: no EXIF in output');
    }
  }

  ok(requests.length === 0, `no external network requests (${requests.slice(0, 3).join(', ')})`);
  ok(await page.evaluate(() => localStorage.length === 0 && sessionStorage.length === 0 && document.cookie === ''), 'no localStorage / sessionStorage / cookies');
  ok(errors.length === 0, `no console errors ${errors.slice(0, 3).join(' | ')}`);

  // ---- mobile pass over the studio (layout screenshots)
  const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, bypassCSP: true, hasTouch: true, isMobile: true });
  const mp = await mob.newPage();
  await mp.goto(BASE + '/#/studio', { waitUntil: 'networkidle' });
  await mp.waitForSelector('[role=radiogroup][aria-label="Film type"]');
  await mp.waitForTimeout(800);
  await mp.screenshot({ path: `${SHOTS}/m1-film.png` });
  await mp.getByRole('button', { name: 'Next' }).click();
  await mp.locator('input[type=file]').setInputFiles(imgs);
  await mp.waitForTimeout(1000);
  await mp.screenshot({ path: `${SHOTS}/m2-photos.png` });
  await mp.getByRole('button', { name: 'Next' }).click();
  await mp.waitForSelector('[role=tablist][aria-label=Tools]');
  await mp.getByRole('radio', { name: 'Golden' }).click({ timeout: 4000 }).catch(() => console.log('      (mobile: golden filter not clickable)'));
  await mp.waitForTimeout(700);
  await mp.screenshot({ path: `${SHOTS}/m3-edit.png` });
  ok(await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'mobile edit: no horizontal scroll');
  await mp.getByRole('button', { name: 'Done' }).click();
  await mp.waitForSelector('text=Nothing was uploaded');
  await mp.waitForTimeout(1200);
  await mp.screenshot({ path: `${SHOTS}/m4-export.png` });
  await mob.close();

  // ---- strict CSP smoke test: same flow with the policy enforced (no bypass)
  const strict = await browser.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true });
  const sp = await strict.newPage();
  const cspHits = [];
  sp.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) cspHits.push(m.text().slice(0, 160)); });
  sp.on('pageerror', (e) => cspHits.push('pageerror: ' + e.message));
  await sp.goto(BASE, { waitUntil: 'networkidle' });
  await sp.getByRole('button', { name: 'Start', exact: true }).first().click();
  await sp.waitForSelector('[role=radiogroup][aria-label="Film type"]');
  await sp.getByRole('radio', { name: /Instant/ }).click();
  await sp.getByRole('button', { name: 'Next' }).click();
  await sp.locator('input[type=file]').setInputFiles(imgs[0]);
  await sp.waitForTimeout(800);
  await sp.getByRole('button', { name: 'Next' }).click();
  await sp.waitForSelector('[role=tablist][aria-label=Tools]');
  await sp.getByRole('tab', { name: 'Stickers' }).click();
  await sp.getByRole('button', { name: 'Add Star sticker' }).click();
  await sp.waitForTimeout(500);
  await sp.screenshot({ path: `${SHOTS}/12-strict-csp-edit.png` });
  ok(cspHits.length === 0, `strict CSP: app works with policy enforced ${cspHits.slice(0, 2).join(' | ')}`);
  ok((await sp.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || '')).includes("default-src 'none'"), 'strict CSP: policy present in HTML');
  await strict.close();

  await browser.close();
  console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
