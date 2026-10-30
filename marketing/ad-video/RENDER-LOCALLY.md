# Render the PortableBooth ad on your own computer

One command records the app, rebuilds the music and renders both videos: 9:16 and 16:9, plus covers and captions.
It takes about 30–60 minutes and runs entirely on your machine.

## 1. Install these once

| Tool | Windows | macOS | Check it works |
|---|---|---|---|
| **Node.js 20+** | https://nodejs.org (LTS) | `brew install node` | `node -v` |
| **Git** | https://git-scm.com | already there, or `xcode-select --install` | `git --version` |
| **Python 3** | https://www.python.org (tick **"Add python.exe to PATH"**) | `brew install python` | `python --version` (Windows) / `python3 --version` |
| **ffmpeg** | `winget install Gyan.FFmpeg` | `brew install ffmpeg` | `ffmpeg -version` |

After installing on Windows, **close and reopen the terminal** so it can find the new tools.

## 2. Get the project

```bash
git clone https://github.com/NgocDungNguyen/PortableBooth.git
```

```bash
cd PortableBooth
```

```bash
git checkout claude/nice-lovelace-y04pw0
```

Already cloned? Run `git pull` inside the folder instead.

## 3. Render

Use the voice-over MP3 you downloaded from ElevenLabs. The script copies it in for you.

**Windows:** open the `marketing\ad-video` folder and drag your MP3 onto **`render-ad.cmd`**. You can also run it from a terminal:

```bash
marketing\ad-video\render-ad.cmd "C:\Users\you\Downloads\your-voice-over.mp3"
```

**macOS / Linux:**

```bash
marketing/ad-video/render-ad.sh ~/Downloads/your-voice-over.mp3
```

The first run installs everything else on its own:

- the app's packages
- Remotion
- the browser used to record the app
- numpy and scipy

It checks each tool first and tells you exactly what's missing.

**Finished files:** `marketing/out/`

| File | Use |
|---|---|
| `PortableBooth-ad-9x16.mp4` | TikTok / Reels / Shorts |
| `PortableBooth-ad-16x9.mp4` | YouTube / website |
| `PortableBooth-ad-cover-9x16.png`, `PortableBooth-ad-cover-16x9.png` | Thumbnails |
| `PortableBooth-ad.srt` | Captions |

## Handy options

Run these from `marketing/ad-video`.

| Command | What it does |
|---|---|
| `node tools/setup.mjs` | Render again. The voice-over is already in place from the first run. |
| `node tools/setup.mjs --no-capture` | Skip re-recording the app, e.g. after only changing text or the end card. Much faster. |
| `node tools/setup.mjs --ref=main` | Record the app from another branch or commit. |
| `node tools/setup.mjs --setup-only` | Only check and install, don't render. |
| `npm run studio` | Open Remotion Studio to preview and scrub the video in your browser. |

## Change things

| What | Where |
|---|---|
| Website address on the end card | `src/theme.ts`, the `URL` constant. Empty shows *Search "PortableBooth"*. |
| End card / sharing scene | `src/scenes/Outro.tsx` |
| Captions and their timing | `src/timing.json`, matched to the voice-over |
| A new voice-over | Delete `src/timing.json` so the timing is rebuilt. This needs `pip install pocketsphinx`. Then render with the new MP3. |

## If something goes wrong

**"Could not download Chromium for recording"**

Check your internet, then run this in `marketing/ad-video`:

```bash
npx playwright install chromium
```

**Python is called something else**

Set `PYTHON` to its name before rendering.

Windows:

```bash
set PYTHON=py
```

macOS / Linux:

```bash
export PYTHON=python3.12
```

**Port 5199 is busy**

Set `PORT` to a free port.

Windows:

```bash
set PORT=5299
```

macOS / Linux:

```bash
export PORT=5299
```

**Slow renders**

Lower `CONCURRENCY` if your computer struggles, or raise it on a fast one. The default is 4.

Windows:

```bash
set CONCURRENCY=2
```

macOS / Linux:

```bash
export CONCURRENCY=2
```

Remotion is free for individuals and teams of up to 3 people.
