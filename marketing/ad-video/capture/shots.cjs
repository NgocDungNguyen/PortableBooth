// Still screenshots of the real app used by motion-graphics beats.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const URL = process.env.APP_URL || 'http://localhost:5199';
const OUT = path.join(__dirname, '..', 'public', 'shots');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light' });
  const p = await ctx.newPage();
  await p.goto(URL + '/');
  await p.waitForTimeout(1500);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(3500);
  await p.screenshot({ path: path.join(OUT, 'phone-home.png') });
  await b.close();
  console.log('shots done');
})();
