# PortableBooth

A photobooth in your browser. Snap or upload photos, drop them into a **Strip**, **Instant** card or **35mm** film,
style them (filters, frames, stickers, text) and export a share image or a **300 DPI print-ready** file.
Built so the same designs can later be printed by a PortableBooth printer.

## Privacy and security
- 100% client-side. No backend, accounts, cookies, localStorage, IndexedDB or analytics scripts.
- Photos live in memory only and disappear when the tab closes ("Clear everything" button in the studio).
- EXIF / GPS is dropped on import (pixels are re-drawn) and never written on export.
- Uploads are treated as untrusted: size cap, no SVG, must decode as a raster image.
- Strict CSP (`default-src 'none'`, no network access at all), Permissions-Policy (camera only), `no-referrer`,
  no framing. Headers: `public/_headers` (Cloudflare Pages / Netlify); the CSP is also baked into the built HTML.
- No third-party scripts, fonts or requests. All fonts are self-hosted.

## Develop
```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests (layout, doc, history, PNG DPI, shader params)
npm run build        # typecheck + production build into dist/
npm run build:preview  # single-file build into dist-preview/ (for quick sharing)
npm run packs        # regenerate the lazy icon/emoji packs from the Iconify JSON (devDependencies)
npm run e2e          # Playwright smoke test (needs `npm run build && npm run preview`)
```

## Hosting (and why the camera needs it)
The live camera only works on a normal page served over https. Inside a sandboxed preview/iframe the browser blocks it (the app then
offers "Take photo with phone camera", which opens the phone's own camera app and works everywhere).
`.github/workflows/pages.yml` builds and deploys `dist/` to GitHub Pages: merge to `main`, then in the repo go to
Settings > Pages > Source: "GitHub Actions". Any static host works (Cloudflare Pages, Netlify): publish `dist/` and keep the headers in `public/_headers`.

## How it works
- `src/film` – the film as plain data in **millimetres** (`FilmDoc`), pure layout maths, filters, undo/redo.
- `src/render` – one renderer for preview *and* export: Canvas 2D composition (frames, overlays, elements) + a WebGL film pass
  (split-toning, duotone, halftone, glitch, grain, halation, light leaks, per-photo vignette), with a software fallback.
- `src/assets` – the lazy-loaded sticker library (`packs/*.json`, built by `scripts/build-packs.mjs`) and original shapes.
- `src/media` – import, camera capture, export (PNG with `pHYs` = 300 DPI, JPEG for sharing).
- `src/ui` – homepage and the Film → Photos → Edit → Export studio.
- `docs/superpowers` – design spec and implementation plan.

Sizes: Strip 51×152 mm (2×6 in), Instant 54×86 mm, 35mm 50 mm wide. Print export = 300 DPI.

See `LICENSES.md` for asset and font licenses.
