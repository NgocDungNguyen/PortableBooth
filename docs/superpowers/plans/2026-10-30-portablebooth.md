# PortableBooth Implementation Plan

> **For agentic workers:** execute task by task; checkbox steps.

**Goal:** Build the client-side PortableBooth web app per the spec.
**Architecture:** React UI over a pure `FilmDoc` model; one WebGL+Canvas renderer for preview and export.
**Tech Stack:** Vite, React 19, TypeScript, Tailwind 4, Motion, Lucide, Fontsource, Vitest, Playwright.
**Spec:** `docs/superpowers/specs/2026-10-30-portablebooth-design.md`

## Global Constraints
- No network calls, storage APIs or third-party scripts at runtime.
- Film sizes: Strip 51×152 mm, Instant 54×86 mm, 35mm 50 mm wide; print = 300 DPI.

## Review Focus
- Camera denied/absent → Upload still works.
- Huge / corrupt / SVG / non-image upload → friendly error, no crash.
- WebGL unavailable → 2D fallback renders.
- Undo/redo around slider drags coalesces.
- Export DPI metadata is correct (300 → 11811 px/m).

### Task 1: Scaffold, tokens, security headers
- [ ] Vite+React+TS+Tailwind, fonts, CSP build plugin, `_headers`, LICENSES.
### Task 2: Film model (doc, layout, filters) with unit tests
- [ ] `layout.test.ts`, `doc.test.ts` first; then implement.
### Task 3: Renderer (WebGL filter pass + composition + 2D fallback)
- [ ] Render golden check via screenshot; stickers/fonts loaded before draw.
### Task 4: Media (import, capture, export + PNG DPI test)
- [ ] `png.test.ts` asserts pHYs = 11811 for 300 DPI.
### Task 5: UI — Home, Studio steps, tools
- [ ] Mobile-first, keyboard, reduced motion.
### Task 6: E2E + a11y + preview build
- [ ] Playwright flow with fake camera; axe; single-file preview build.
