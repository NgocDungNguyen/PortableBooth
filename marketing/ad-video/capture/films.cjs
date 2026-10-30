// Render finished films with the app's own renderer (src/render) for the motion-graphics beats.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const URL = process.env.APP_URL || 'http://localhost:5199';
const OUT = path.join(__dirname, '..', 'public', 'films');
const JOBS = [
  ['strip-sunday', 'strip', 4, 'sunday', 0, 'portrait', {}],
  ['strip-cherry', 'strip', 4, 'cherry', 2, 'portrait', { frameStyle: 'grid' }],
  ['strip-noir', 'strip', 4, 'noir', 1, 'portrait', {}],
  ['strip-golden', 'strip', 4, 'golden', 3, 'portrait', {}],
  ['strip-vintage', 'strip', 4, 'vhs', 0, 'portrait', {}],
  ['instant-flash', 'instant', 1, 'flash', 2, 'portrait', {}],
  ['film35-noir', 'film35', 3, 'noir', 1, 'portrait', {}],
  ['wide-sunday', 'strip', undefined, 'sunday', 4, 'landscape', {}],
  ['wide-dream', 'instant', undefined, 'dream', 5, 'landscape', {}],
];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto(URL + '/#studio');
  await p.waitForTimeout(1500);
  fs.mkdirSync(OUT, { recursive: true });
  const info = await p.evaluate(async () => {
    const f = await import('/src/film/filters.ts');
    return { filters: f.FILTERS.length };
  });
  for (const [name, fmt, frames, filt, off, ori, extra] of JOBS) {
    const data = await p.evaluate(async ([fmt, frames, filt, off, ori, extra]) => {
      const pd = await import('/src/ui/previewDocs.ts');
      const ex = await import('/src/media/export.ts');
      const { FILTERS } = await import('/src/film/filters.ts');
      const id = FILTERS.some((x) => x.id === filt) ? filt : FILTERS[0].id;
      const doc = { ...pd.previewDoc(fmt, frames ?? undefined, id, off, ori), ...extra };
      await new Promise((r) => setTimeout(r, 400));
      const r = await ex.exportFilm(doc, 'print');
      const buf = new Uint8Array(await r.blob.arrayBuffer());
      let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      return btoa(s);
    }, [fmt, frames ?? null, filt, off, ori, extra]);
    fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(data, 'base64'));
    console.log(name);
  }
  fs.writeFileSync(path.join(OUT, 'info.json'), JSON.stringify(info));
  console.log(info);
  await b.close();
})();

