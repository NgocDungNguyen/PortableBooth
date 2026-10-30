/* Sharing end to end against the Worker (real CSP + relay). Run e2e/run.cjs first (it makes the test photos), then:
   npm run build && npx wrangler dev --port 8787   and   BASE_URL=http://127.0.0.1:8787 SHOTS=./e2e-shots node e2e/share.cjs */
const { chromium } = require('playwright');
const S = require('path').resolve(process.env.SHOTS || './e2e-shots');
const B = process.env.BASE_URL || 'http://127.0.0.1:8787';
const BYPASS = process.env.BYPASS === '1';
const E = S + '/';
const imgs = [0, 1, 2, 3].map((i) => E + `test-${i}.png`);
const results = [];
const ok = (c, m) => { results.push((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const br = await chromium.launch();
  const errs = [];
  // ---------- sender (desktop)
  const sc = await br.newContext({ viewport: { width: 1360, height: 860 }, acceptDownloads: true, bypassCSP: BYPASS, permissions: ['clipboard-read', 'clipboard-write'] });
  await sc.addInitScript(() => {
    window.__shared = [];
    const file = new File([new Uint8Array(1)], 'p.jpg', { type: 'image/jpeg' });
    navigator.canShare = (d) => !!(d && d.files);
    navigator.share = async (d) => { window.__shared.push({ active: navigator.userActivation.isActive, files: (d.files || []).map((f) => [f.name, f.type, f.size]), text: d.text || null, url: d.url || null }); };
  });
  const s = await sc.newPage();
  s.on('pageerror', (e) => errs.push('S ' + e.message));
  s.on('console', (m) => m.type() === 'error' && errs.push('S console ' + m.text()));
  await s.goto(B + '/#studio', { waitUntil: 'networkidle' });
  await s.getByRole('button', { name: /Next: add photos/ }).click();
  await s.locator('input[aria-label="Choose photos"]').setInputFiles(imgs);
  await s.waitForTimeout(1200);
  await s.getByRole('button', { name: 'Export', exact: true }).click();
  await s.waitForSelector('dialog[open]');
  // share sheet: enabled once the file is ready, then called inside the tap
  const shareBtn = s.getByRole('button', { name: /Share to nearby devices/ });
  await s.waitForFunction(() => [...document.querySelectorAll('dialog[open] button')].some((b) => /Share to nearby/.test(b.textContent) && !b.disabled), null, { timeout: 15000 });
  await shareBtn.click();
  await s.waitForTimeout(400);
  const shared = await s.evaluate(() => window.__shared);
  ok(shared.length === 1 && shared[0].active && shared[0].files[0][1] === 'image/jpeg' && shared[0].files[0][2] > 10000, 'share sheet: opened inside the tap with the JPEG ' + JSON.stringify(shared));
  // save
  const [dl] = await Promise.all([s.waitForEvent('download'), s.locator('dialog[open] .btn-primary').click()]);
  ok(/\.jpg$/.test(dl.suggestedFilename()), 'save: downloads ' + dl.suggestedFilename());
  // copy
  const copyBtn = s.getByRole('button', { name: 'Copy image' });
  if (await copyBtn.count()) {
    await copyBtn.click();
    await s.waitForTimeout(1500);
    const types = await s.evaluate(async () => { try { const it = await navigator.clipboard.read(); return it.flatMap((i) => i.types); } catch (e) { return ['ERR ' + e.message]; } });
    ok(types.includes('image/png'), 'copy: clipboard holds a PNG ' + types.join(','));
  } else ok(false, 'copy: button missing');
  // QR "make yours" points at the app
  // ---------- send to a phone
  await s.getByRole('button', { name: /^Send to a phone/ }).click();
  await s.waitForSelector('text=Waiting for the other phone', { timeout: 15000 }).catch(() => {});
  const waiting = await s.getByText('Waiting for the other phone').count();
  if (!waiting) {
    const msg = await s.locator('[role=alert]').allTextContents();
    ok(false, 'send: sender waiting state ' + msg.join(' '));
  } else {
    await s.getByRole('button', { name: /Copy link/ }).click();
    const link = await s.evaluate(() => navigator.clipboard.readText());
    ok(/#beam=[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/.test(link), 'send: link ' + link.replace(/\.[^.]+$/, '.<key>'));
    await s.screenshot({ path: S + '/sender-qr.png' });
    // ---------- receiver (phone)
    const rc = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, bypassCSP: BYPASS });
    const r = await rc.newPage();
    r.on('pageerror', (e) => errs.push('R ' + e.message));
    r.on('console', (m) => m.type() === 'error' && errs.push('R console ' + m.text()));
    const t0 = Date.now();
    await r.goto(link, { waitUntil: 'domcontentloaded' });
    const got = await r.waitForSelector('text=You got a photo', { timeout: 30000 }).then(() => true, () => false);
    ok(got, `receive: photo arrived in ${Date.now() - t0} ms`);
    if (got) {
      const info = await r.evaluate(async () => {
        const img = document.querySelector('img[alt="The photo you received"]');
        await img.decode();
        return { w: img.naturalWidth, h: img.naturalHeight, type: 'image/jpeg' };
      });
      ok(info.w > 500 && info.type === 'image/jpeg', 'receive: decodes ' + JSON.stringify(info));
      ok((await r.locator('[role=dialog][aria-label="How PortableBooth works"]').count()) === 0, 'receive: intro does not cover it');
      await r.screenshot({ path: S + '/receiver-got.png' });
    } else {
      await r.screenshot({ path: S + '/receiver-fail.png' });
      results.push('receiver text: ' + (await r.locator('body').innerText()).slice(0, 300));
    }
    const sent = await s.waitForSelector('text=Sent!', { timeout: 10000 }).then(() => true, () => false);
    ok(sent, 'send: sender shows Sent!');
    await s.screenshot({ path: S + '/sender-sent.png' });
    // the link only works once
    const r2 = await rc.newPage();
    await r2.goto(link.replace('#', '?x#'), { waitUntil: 'domcontentloaded' });
    const used = await r2.waitForSelector('text=/expired or was already used/', { timeout: 20000 }).then(() => true, () => false);
    ok(used, 'send: a used code cannot be opened again');
    await rc.close();
  }
  ok(errs.length === 0, 'no page errors ' + errs.slice(0, 4).join(' | '));
  console.log(results.join('\n'));
  await br.close();
})();
