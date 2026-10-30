// Export the app's own procedural demo photos (src/samples.ts) as JPEGs, used as "camera roll" uploads.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const URL = process.env.APP_URL || 'http://localhost:5199';
const OUT = path.join(__dirname, '..', 'public', 'photos');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto(URL + '/#studio');
  const imgs = await p.evaluate(async () => {
    const m = await import('/src/samples.ts');
    const out = [];
    for (let i = 0; i < Math.min(8, m.SAMPLE_COUNT); i++) out.push(m.sceneCanvas(i, 1200, 1500).toDataURL('image/jpeg', 0.92));
    return out;
  });
  fs.mkdirSync(OUT, { recursive: true });
  imgs.forEach((d, i) => fs.writeFileSync(path.join(OUT, `photo-${i}.jpg`), Buffer.from(d.split(',')[1], 'base64')));
  console.log('wrote', imgs.length);
  await b.close();
})();
