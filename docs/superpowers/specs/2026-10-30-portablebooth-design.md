# PortableBooth — Design Spec

## Goal
A free, public, mobile-first web photobooth for Gen Z. Users shoot or upload photos, place them in a film
(Strip, Instant, 35mm), style them with filters/frames/stickers/text and export a share image or a
300 DPI print-ready file. Later (when there are enough users) a PortableBooth printer prints the same
designs as physical film, so the film model is **print-first** (millimetres + DPI), not screen pixels.

## Constraints
- 100% client-side. No backend, accounts, database, cookies, localStorage, IndexedDB or analytics scripts.
  Photos live in memory only and vanish on tab close; "Clear everything" is always visible.
- Maximum practical security: strict CSP, no third-party scripts/requests, self-hosted fonts/assets,
  Permissions-Policy (camera only), `no-referrer`, no framing, pinned deps, EXIF/GPS stripped on import and export,
  uploads treated as untrusted (decode-validated, size capped, no SVG), user text only drawn on canvas.
- Scalable: static files on a CDN; heavy studio code is lazy-loaded after "Start".
- Accessibility: WCAG AA contrast, 44px targets, full keyboard use, ARIA labels, reduced-motion support.
- Little text, lots of UI/motion. Icons + 1–2 word labels.
- Licenses: only original or permissive assets. Stickers are original vector art authored in this repo;
  fonts are SIL OFL via Fontsource (self-hosted); icons are Lucide (ISC). See `LICENSES.md`.
- No trademarked names/brand colours (formats: Strip, Instant, 35mm).

## Flow
Homepage (animated booth + strip, how-it-works, looks gallery, privacy badge) → Studio:
**Film → Photos → Edit → Export**.
- Film: pick format and frame count (live animated previews).
- Photos: Camera (3-2-1 countdown, auto-shoots all slots, retake per slot, flip camera) or Upload
  (picker/drop/paste). Camera blocked → Upload.
- Edit: live preview; tools Filter, Adjust, Photo (pan/zoom), Frame, Stickers, Text; undo/redo.
- Export: Share (JPEG ~1200px) or Print (PNG, 300 DPI, pHYs chunk); Save and native Share.

## Architecture (units)
| Unit | Job |
|---|---|
| `film/doc` | Serialisable `FilmDoc` (mm), sanitising validator, undo/redo history reducer |
| `film/layout` | Pure mm geometry for each format → slot rects, sprocket holes, caption areas |
| `film/filters` | Filter presets → shader params |
| `render/*` | WebGL filter pass (grain, split-tone, halation, light leak, per-slot vignette) + Canvas 2D composition; same code for preview and export; 2D fallback if WebGL fails |
| `capture/*` | getUserMedia camera, countdown, crop-to-slot-aspect, track release |
| `media/import` | Untrusted image decode, EXIF orientation applied, metadata dropped, downscale |
| `media/export` | Render at ppm, encode PNG/JPEG, write DPI |
| `assets/*` | Original SVG stickers, fonts |
| `ui/*` | Home + Studio screens |

## Not in v1
GIF/video, accounts, cloud, AI effects, printer integration (design leaves room: doc is mm + DPI).

## Testing
Vitest for layout/doc/validator/PNG-DPI; Playwright e2e with a fake camera and upload; axe accessibility checks;
visual spot checks via screenshots.
