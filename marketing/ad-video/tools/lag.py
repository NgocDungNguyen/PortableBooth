"""Re-sync each capture's logged taps with what the screen actually shows.

Headless Chromium (software GL) paints some UI changes up to ~2 s after the input event. For every tap we find
the first visible change after it and move that tap (its approach, press, release and any mark set with it) so
the press lands just before the change. Raw values are kept in events_raw / marks_raw, so this is idempotent.
  python3 tools/lag.py [clip ...]
"""
import json, os, subprocess, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAP = os.path.join(ROOT, 'public', 'cap')
LEAD = 0.1  # press this long before the visible response
names = sys.argv[1:] or sorted(f[:-5] for f in os.listdir(CAP) if f.endswith('.json'))
for n in names:
    path = os.path.join(CAP, n + '.json')
    meta = json.load(open(path))
    ev = meta.setdefault('events_raw', meta['events'])
    marks = meta.setdefault('marks_raw', meta['marks'])
    w, h = 160, int(160 * meta['height'] / meta['width'])
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(CAP, n + '.mp4'), '-vf', f'scale={w}:{h},format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.int16)
    diff = np.abs(np.diff(fr, axis=0)).mean(axis=(1, 2))
    downs = [i for i, e in enumerate(ev) if e['type'] == 'down']
    shift = {}
    for i in downs:
        t = ev[i]['t']
        k0 = int(t * 30)
        nxt_t = next((ev[d]['t'] for d in downs if d > i), 1e9)
        # look for the response only until the next tap's approach starts (it may scroll the page)
        win = diff[k0:min(k0 + 75, int((nxt_t - 0.5) * 30))]
        hit = np.nonzero(win > 1.0)[0]
        resp = (k0 + hit[0] + 1) / 30 if len(hit) else t + LEAD
        # never push a tap past the next one (a slow paint can show two taps at once)
        shift[i] = float(np.clip(resp - LEAD - t, 0, min(2.5, max(0.0, nxt_t - 0.25 - t))))
    # each event takes the shift of its tap: moves before a press belong to the next press, the rest to the last one
    out = []
    order = sorted(downs)
    for j, e in enumerate(ev):
        nxt = next((d for d in order if d >= j), None)
        prv = max((d for d in order if d <= j), default=None)
        if e['type'] in ('down',):
            s = shift[j]
        elif e['type'] == 'move' and nxt is not None:
            s = shift[nxt]
        elif prv is not None:
            s = shift[prv]
        else:
            s = 0.0
        out.append({**e, 't': round(e['t'] + s, 4)})
    # keep the event list time-ordered (a later tap can never move before an earlier one)
    for j in range(1, len(out)):
        if out[j]['t'] < out[j - 1]['t']:
            out[j]['t'] = out[j - 1]['t']
    meta['events'] = out
    newm = {}
    for k, t in marks.items():
        # the tap closest in raw time to the mark
        near = min(range(len(ev)), key=lambda j: abs(ev[j]['t'] - t)) if ev else None
        newm[k] = round(t + (out[near]['t'] - ev[near]['t'] if near is not None and abs(ev[near]['t'] - t) < 0.7 else 0), 4)
    meta['marks'] = newm
    json.dump(meta, open(path, 'w'), indent=1)
    print(n, 'shifts', [round(shift[i], 2) for i in downs])
