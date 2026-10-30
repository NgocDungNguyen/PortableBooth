# Demo photos

Drop your own JPG, PNG or WebP photos here to use them as the demo photos on the homepage, in the intro and in the film/filter pickers. You need the rights to every photo you add (your own shots, or a licence that allows redistribution).

- Files are used in alphabetical order (`01-friends.jpg`, `02-city.jpg`, ...). The first three fill the hero strip, so put your best there.
- Up to 7 are used. Each one replaces one generated scene; any slot without a photo keeps its generated scene.
- Landscape around 4:3 works best (photos are cover-cropped into each frame). Large files are scaled down to 1600 px on the long edge when loaded, but keep them under ~500 KB each so the app stays light.
- They are bundled with the app as same-origin files: nothing is fetched from anywhere else, so the CSP stays strict.
- Remove a file to bring the generated scene back.

The loader lives in `src/samples.ts` (look for `OWNER_URLS`).
