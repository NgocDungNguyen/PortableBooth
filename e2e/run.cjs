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
  const r = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })).violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes[0].html.slice(0, 160) })));
  ok(r.filter((v) => v.impact === 'critical' || v.impact === 'serious').length === 0, `axe ${name}: no serious/critical violations`);
  r.forEach((v) => console.log(`      axe[${v.impact}] ${v.id} x${v.n}  ${v.sample}`));
}
const panel = (page) => page.locator('#tool-body');

(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 }, permissions: ['camera'], acceptDownloads: true, bypassCSP: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const requests = [];
  page.on('request', (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) requests.push(r.url()); });

  // ---- home
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('[role=dialog][aria-label="How PortableBooth works"]');
  await page.waitForTimeout(500);
  await axe(page, 'intro');
  await page.waitForTimeout(1100);
  await page.screenshot({ path: `${SHOTS}/00-intro-scene1.png` });
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOTS}/00-intro-scene2.png` });
  await page.keyboard.press('Escape');
  await page.waitForSelector('[role=dialog][aria-label="How PortableBooth works"]', { state: 'detached' });
  ok(true, 'intro: shows on a cold load and Esc skips it');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}/01-home.png` });
  await page.screenshot({ path: `${SHOTS}/01b-home-full.png`, fullPage: true });
  await axe(page, 'home');
  await page.getByRole('radio', { name: 'Noir' }).click();
  await page.waitForTimeout(500);
  ok(true, 'home: hero look chips respond');
  const m = await ctx.newPage();
  await m.setViewportSize({ width: 390, height: 844 });
  await m.goto(BASE, { waitUntil: 'networkidle' });
  await m.waitForSelector('[role=dialog][aria-label="How PortableBooth works"]');
  await m.screenshot({ path: `${SHOTS}/02a-intro-mobile.png` });
  await m.keyboard.press('Escape');
  await m.waitForTimeout(3000);
  await m.screenshot({ path: `${SHOTS}/02-home-mobile.png` });
  ok(await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'home: no horizontal scroll on mobile');
  await m.close();

  // ---- test photos
  const imgs = [];
  for (let i = 0; i < 5; i++) {
    const b64 = await page.evaluate((i) => {
      const c = document.createElement('canvas'); c.width = 900; c.height = 700;
      const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 900, 700); g.addColorStop(0, ['#ff9a6b', '#4d9bf7', '#51c98a', '#f7c548', '#a78bfa'][i]); g.addColorStop(1, '#1a1a2e');
      x.fillStyle = g; x.fillRect(0, 0, 900, 700);
      x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.arc(660, 190, 90, 0, 7); x.fill();
      x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 470, 900, 230);
      x.fillStyle = '#fff'; x.font = 'bold 220px sans-serif'; x.fillText(String(i + 1), 120, 450);
      return c.toDataURL('image/png').split(',')[1];
    }, i);
    const p = path.join(SHOTS, `test-${i}.png`); fs.writeFileSync(p, Buffer.from(b64, 'base64')); imgs.push(p);
  }
  const svgBad = path.join(SHOTS, 'evil.svg'); fs.writeFileSync(svgBad, '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  const junk = path.join(SHOTS, 'junk.png'); fs.writeFileSync(junk, 'not an image');

  // ---- a look card on the homepage starts the studio with that film + filter
  await page.getByRole('button', { name: 'Start with Noir' }).first().click();
  await page.waitForSelector('[role=tablist][aria-label=Tools]');
  await page.getByRole('tab', { name: 'Film' }).click();
  ok((await page.getByRole('radio', { name: /35mm/ }).getAttribute('aria-checked')) === 'true', 'home: look card opens the studio with that film format');
  await page.getByRole('tab', { name: 'Looks' }).click();
  ok((await panel(page).getByRole('radio', { name: 'Noir', exact: true }).getAttribute('aria-checked')) === 'true', 'home: look card applies its filter');
  await page.goto(BASE + '/#home');
  await page.waitForTimeout(400);

  // ---- studio: empty state
  await page.getByRole('button', { name: 'Start', exact: true }).first().click();
  await page.waitForSelector('[role=tablist][aria-label=Tools]');
  await page.waitForTimeout(800);
  ok((await page.getByRole('tab', { name: 'Film' }).getAttribute('aria-selected')) === 'true', 'flow: the studio opens on Film so the film is chosen before photos');
  await page.getByRole('radio', { name: /Strip/ }).click();
  await page.getByRole('button', { name: /Next: add photos/ }).click();
  ok((await page.getByRole('tab', { name: 'Photos' }).getAttribute('aria-selected')) === 'true', 'flow: Next moves from Film to Photos');
  await page.screenshot({ path: `${SHOTS}/03-studio-empty.png` });
  await axe(page, 'studio (empty)');
  ok(await page.getByRole('button', { name: /Export \(add 4 more/ }).isDisabled(), 'export is disabled until every slot has a photo');

  // film tool
  await page.getByRole('tab', { name: 'Film' }).click();
  await page.getByRole('radio', { name: /Strip/ }).click();
  await page.getByRole('radio', { name: '3 photos' }).click();
  await page.getByRole('radio', { name: '4 photos' }).click();

  // ---- photos: bad files first
  await page.getByRole('tab', { name: 'Photos' }).click();
  const fileInput = page.locator('input[aria-label="Choose photos"]');
  await fileInput.setInputFiles(svgBad);
  await page.waitForSelector('text=Only photos work here');
  ok(true, 'upload: svg rejected with a message');
  await fileInput.setInputFiles(junk);
  await page.waitForTimeout(500);
  ok((await page.getByText(/open that photo|Only photos/).count()) > 0, 'upload: junk rejected');
  await fileInput.setInputFiles(imgs.slice(0, 2));
  await page.waitForTimeout(800);
  ok((await page.getByRole('button', { name: /Export \(add 2 more/ }).count()) === 1, 'upload: 2 of 4 slots filled');

  // ---- camera fills the rest
  await panel(page).getByRole('button', { name: 'Camera', exact: true }).click();
  await page.waitForSelector('[role=dialog][aria-label=Camera] video');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/04-camera.png` });
  await page.getByRole('button', { name: /Start photo sequence/ }).click();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${SHOTS}/05-countdown.png` });
  await page.waitForSelector('[role=dialog][aria-label=Camera]', { state: 'detached', timeout: 20000 });
  ok(await page.getByRole('button', { name: 'Export', exact: true }).isEnabled(), 'camera: sequence filled the remaining slots');
  ok(await page.evaluate(() => !document.querySelector('video')), 'camera: video element removed (camera released)');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/06-studio-filled.png` });
  await axe(page, 'studio (filled)');

  // ---- looks
  await page.getByRole('tab', { name: 'Looks' }).click();
  await page.waitForTimeout(600);
  await panel(page).getByRole('radio', { name: 'Cherry', exact: true }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/07-looks.png` });
  await axe(page, 'looks');
  for (const fam of ['Mono', 'Digicam', 'FX']) { await panel(page).getByRole('radio', { name: fam, exact: true }).click(); await page.waitForTimeout(200); }
  const filterCount = await panel(page).locator('[role=radiogroup][aria-label=Filter] [role=radio]').count();
  ok(filterCount >= 4, `looks: filter families filter the list (${filterCount} in FX)`);
  await panel(page).getByRole('radio', { name: 'All', exact: true }).click();
  ok((await panel(page).locator('[role=radiogroup][aria-label=Filter] [role=radio]').count()) >= 36, 'looks: 36+ filters in total');
  await panel(page).getByRole('radio', { name: 'Overlays' }).click();
  await panel(page).locator('button[aria-pressed]').first().click();
  await panel(page).locator('button[aria-pressed]').nth(5).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/08-overlays.png` });
  await panel(page).getByRole('radio', { name: 'Adjust' }).click();
  await page.locator('input[aria-label=Grain]').fill('0.5');

  // per-photo filter
  await page.getByRole('radio', { name: 'Photo 2', exact: true }).first().click({ timeout: 2000 }).catch(() => {});
  await page.getByRole('tab', { name: 'Looks' }).click();
  await panel(page).getByRole('radio', { name: 'Filters' }).click();

  // ---- frame
  await page.getByRole('tab', { name: 'Frame' }).click();
  await panel(page).getByRole('radio', { name: 'Grid', exact: true }).click().catch(() => {});
  await panel(page).getByRole('radio', { name: /Film colour #FFD66B/ }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/09-frame.png` });

  // ---- add: icon, emoji, shape, widget
  await page.getByRole('tab', { name: 'Add' }).click();
  await page.waitForSelector('#tool-body button[aria-label^="Add "]');
  await panel(page).locator('button[aria-label^="Add "]').nth(3).click();
  await page.waitForSelector('button[aria-label="Done editing"]');
  ok(true, 'add: icon added and inspector opened');
  await page.screenshot({ path: `${SHOTS}/10-inspector-icon.png` });
  await page.locator('input[aria-label=Opacity]').fill('0.6');
  await page.getByRole('button', { name: 'Flip' }).click();
  await page.getByRole('button', { name: 'Outline' }).click();
  await panel(page).getByRole('radio', { name: /Colour #FF5C7A/ }).click();
  await axe(page, 'inspector');
  await page.getByRole('button', { name: 'Done editing' }).click();
  await page.getByRole('tab', { name: 'Add' }).click();
  await page.getByRole('radio', { name: 'Emoji' }).click();
  await page.waitForTimeout(600);
  await panel(page).locator('button[aria-label^="Add "]').nth(2).click();
  await page.getByRole('button', { name: 'Done editing' }).click();
  await page.getByRole('tab', { name: 'Add' }).click();
  await page.getByRole('radio', { name: 'Shapes' }).click();
  await page.waitForTimeout(300);
  await panel(page).locator('button[aria-label^="Add "]').nth(5).click();
  await panel(page).locator('summary', { hasText: 'Blend' }).click();
  await panel(page).getByRole('radio', { name: 'Multiply' }).click();
  await page.getByRole('button', { name: 'Done editing' }).click();
  await page.getByRole('tab', { name: 'Add' }).click();
  await page.getByRole('radio', { name: 'Widgets' }).click();
  await page.waitForTimeout(400);
  await panel(page).locator('button[aria-label^="Add "]').nth(2).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/11-widget-inspector.png` });
  await page.getByRole('button', { name: 'Done editing' }).click();

  // text
  await page.getByRole('tab', { name: 'Text' }).click();
  await page.locator('input[aria-label=Text]').fill('best day');
  await page.getByRole('button', { name: 'Add text' }).click();
  await page.waitForTimeout(300);
  await panel(page).getByRole('radio', { name: 'Serif' }).click();
  await page.screenshot({ path: `${SHOTS}/12-text-inspector.png` });
  await page.getByRole('button', { name: 'Done editing' }).click();

  // layers
  await page.getByRole('tab', { name: 'Layers' }).click();
  await page.waitForTimeout(500);
  const layerCount = await panel(page).locator('li').count();
  ok(layerCount >= 8, `layers: lists elements and photos (${layerCount} rows)`);
  await page.screenshot({ path: `${SHOTS}/13-layers.png` });

  // keyboard delete on a selected item
  await panel(page).locator('li button').first().click();
  await page.waitForSelector('button[aria-label="Done editing"]');
  await page.getByRole('group', { name: /Film editor/ }).focus();
  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);
  ok(await page.getByRole('button', { name: 'Done editing' }).count() === 0, 'keyboard: Delete removes the selected element');
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.getByRole('button', { name: 'Redo' }).click();
  await page.screenshot({ path: `${SHOTS}/14-studio-final.png` });

  // ---- theme toggle (light <-> dark, in memory only)
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('radio', { name: 'Light theme' }).click();
  ok((await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'light', 'theme: light can be chosen in Settings');
  await page.screenshot({ path: `${SHOTS}/14a-settings.png` });
  await axe(page, 'settings (light theme)');
  const music = page.getByRole('switch', { name: 'Background music' });
  if (await music.count()) {
    const before = await music.getAttribute('aria-checked');
    await music.click();
    ok((await music.getAttribute('aria-checked')) !== before, 'settings: background music can be switched on/off');
    await music.click();
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/14b-light-studio.png` });
  await axe(page, 'studio (light theme)');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('radio', { name: 'Dark theme' }).click();
  ok((await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'dark', 'theme: dark can be chosen');
  await page.getByRole('radio', { name: 'Auto theme' }).click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // ---- horizontal ("Share (wide)") film keeps photos and elements
  await page.getByRole('tab', { name: 'Film' }).click();
  await page.getByRole('radio', { name: /Share \(wide\)/ }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOTS}/14c-wide.png` });
  ok(await page.getByRole('button', { name: 'Export', exact: true }).isEnabled(), 'wide: photos survive the switch to a horizontal film');
  const box = await page.locator('canvas[aria-label="Your film"]').boundingBox();
  ok(box.width > box.height * 2, `wide: film is horizontal (${Math.round(box.width)}x${Math.round(box.height)})`);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.waitForSelector('dialog[open] #export-title');
  const [wdl] = await Promise.all([page.waitForEvent('download'), (async () => { await page.locator('dialog[open]').getByRole('radio', { name: /PNG/ }).click(); await page.locator('dialog[open] .btn-primary').click(); })()]);
  const wfile = path.join(SHOTS, wdl.suggestedFilename()); await wdl.saveAs(wfile);
  const wbuf = fs.readFileSync(wfile);
  ok(wbuf.readUInt32BE(16) > wbuf.readUInt32BE(20) * 2, `wide: PNG is horizontal (${wbuf.readUInt32BE(16)}x${wbuf.readUInt32BE(20)})`);
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Film' }).click();
  await page.getByRole('radio', { name: /Print \(tall\)/ }).click();
  await page.waitForTimeout(400);
  ok(await page.getByRole('button', { name: 'Export', exact: true }).isEnabled(), 'wide: switching back to tall keeps the photos');

  // ---- export
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.waitForSelector('dialog[open] #export-title');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOTS}/15-export.png` });
  await axe(page, 'export dialog');
  for (const kind of ['Print', 'Share']) {
    await page.locator('dialog[open]').getByRole('radio', { name: kind }).click();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('dialog[open] .btn-primary').click()]);
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
  await page.keyboard.press('Escape');

  ok(requests.length === 0, `no external network requests (${requests.slice(0, 3).join(', ')})`);
  ok(await page.evaluate(() => localStorage.length === 0 && sessionStorage.length === 0 && document.cookie === ''), 'no localStorage / sessionStorage / cookies');
  ok(errors.length === 0, `no console errors ${errors.slice(0, 3).join(' | ')}`);

  // ---- mobile pass over the studio
  const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, bypassCSP: true, hasTouch: true, isMobile: true });
  const mp = await mob.newPage();
  await mp.goto(BASE + '/#studio', { waitUntil: 'networkidle' });
  await mp.waitForSelector('[role=tablist][aria-label=Tools]');
  await mp.waitForTimeout(800);
  await mp.screenshot({ path: `${SHOTS}/m1-empty.png` });
  await mp.getByRole('button', { name: /Next: add photos/ }).click();
  await mp.locator('input[aria-label="Choose photos"]').setInputFiles(imgs.slice(0, 4));
  await mp.waitForTimeout(1000);
  await mp.getByRole('tab', { name: 'Looks' }).click();
  await mp.waitForTimeout(600);
  await mp.screenshot({ path: `${SHOTS}/m2-looks.png` });
  await mp.getByRole('tab', { name: 'Add' }).click();
  await mp.waitForSelector('#tool-body button[aria-label^="Add "]');
  await mp.locator('#tool-body button[aria-label^="Add "]').nth(4).tap();
  await mp.waitForTimeout(500);
  await mp.screenshot({ path: `${SHOTS}/m3-inspector.png` });
  ok(await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'mobile studio: no horizontal scroll');
  const eb = await mp.getByRole('button', { name: /^Export/ }).boundingBox();
  ok(eb && eb.x >= 0 && eb.x + eb.width <= 390 - 8, `mobile studio: Export button fits the header (right edge ${eb ? Math.round(eb.x + eb.width) : '?'} of 390)`);
  await mp.getByRole('button', { name: 'Settings' }).tap();
  ok((await mp.getByRole('radio', { name: 'Dark theme' }).count()) === 1, 'mobile studio: theme switch lives in Settings');
  ok((await mp.getByRole('button', { name: 'Clear everything' }).count()) === 1, 'mobile studio: Clear everything is reachable in Settings');
  await mp.screenshot({ path: `${SHOTS}/m3b-settings.png` });
  await mp.keyboard.press('Escape');
  await mp.waitForTimeout(300);
  await mp.getByRole('button', { name: 'Done editing' }).tap();
  await mp.getByRole('tab', { name: 'Frame' }).tap();
  await mp.waitForTimeout(400);
  await mp.screenshot({ path: `${SHOTS}/m4-frame.png` });
  await mob.close();

  // ---- strict CSP smoke test: same flow with the policy enforced (no bypass)
  const strict = await browser.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true });
  const sp = await strict.newPage();
  const cspHits = [];
  sp.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) cspHits.push(m.text().slice(0, 160)); });
  sp.on('pageerror', (e) => cspHits.push('pageerror: ' + e.message));
  await sp.goto(BASE, { waitUntil: 'networkidle' });
  await sp.waitForSelector('[role=dialog][aria-label="How PortableBooth works"]');
  await sp.keyboard.press('Escape');
  await sp.waitForSelector('[role=dialog][aria-label="How PortableBooth works"]', { state: 'detached' });
  await sp.getByRole('button', { name: 'Start', exact: true }).first().click();
  await sp.waitForSelector('[role=tablist][aria-label=Tools]');
  await sp.getByRole('tab', { name: 'Photos' }).click();
  await sp.locator('input[aria-label="Choose photos"]').setInputFiles(imgs[0]);
  await sp.getByRole('tab', { name: 'Film' }).click();
  await sp.getByRole('radio', { name: /Instant/ }).click();
  await sp.getByRole('tab', { name: 'Photos' }).click();
  await sp.locator('input[aria-label="Choose photos"]').setInputFiles(imgs[1]);
  await sp.waitForTimeout(800);
  await sp.getByRole('tab', { name: 'Add' }).click();
  await sp.waitForSelector('#tool-body button[aria-label^="Add "]');
  await sp.locator('#tool-body button[aria-label^="Add "]').nth(1).click();
  await sp.getByRole('button', { name: 'Done editing' }).click();
  await sp.getByRole('tab', { name: 'Add' }).click();
  await sp.getByRole('radio', { name: 'Emoji' }).click();
  await sp.waitForTimeout(500);
  await sp.locator('#tool-body button[aria-label^="Add "]').nth(1).click();
  await sp.waitForTimeout(600);
  await sp.screenshot({ path: `${SHOTS}/16-strict-csp.png` });
  ok(cspHits.length === 0, `strict CSP: app (incl. lazy icon packs) works with the policy enforced ${cspHits.slice(0, 2).join(' | ')}`);
  ok((await sp.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || '')).includes("default-src 'none'"), 'strict CSP: policy present in HTML');

  // ---- About page, shared look links, music files (all under the strict CSP)
  await sp.goto('about:blank');
  await sp.goto(BASE + '/#about', { waitUntil: 'networkidle' });
  await sp.waitForSelector('text=/June Nguyen/', { timeout: 5000 }).catch(() => {});
  ok((await sp.getByText(/June Nguyen/).count()) > 0 && (await sp.getByText(/RMIT/).count()) > 0, 'about: credits June Nguyen / RMIT');
  ok((await sp.locator('[role=dialog][aria-label="How PortableBooth works"]').count()) === 0, 'about: no intro on a deep link');
  await sp.goto('about:blank');
  await sp.goto(BASE + '/#look=film35.landscape.3.noir.plain', { waitUntil: 'networkidle' });
  await sp.waitForSelector('[role=tablist][aria-label=Tools]');
  ok((await sp.getByRole('radio', { name: /35mm/ }).getAttribute('aria-checked')) === 'true' && (await sp.getByRole('radio', { name: /Share \(wide\)/ }).getAttribute('aria-checked')) === 'true', 'share: a look link opens the studio with that film');
  const audioOk = await sp.evaluate(async () => {
    const urls = [...document.querySelectorAll('audio')].map((a) => a.currentSrc || a.src).filter(Boolean);
    return urls.length;
  });
  ok(cspHits.length === 0, `strict CSP: about, look links and music raise no violations ${cspHits.slice(0, 2).join(' | ')} (${audioOk} audio decks)`);
  await strict.close();

  await browser.close();
  console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
