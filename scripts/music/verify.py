#!/usr/bin/env python3
"""
Technical check of the encoded music: duration, peak / RMS, clipping, loop seam, per-section loudness, band balance.
Optionally renders a spectrogram + waveform PNG per track (ffmpeg filters) for a visual check.

    python3 scripts/music/verify.py [--png DIR]
"""
import argparse
import os
import subprocess

import numpy as np

from compose import FFMPEG, OUT, SR

SECTIONS = {'intro': 7.5}


def decode(path):
    raw = subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), 'pipe:1'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, '<f4').reshape(-1, 2).T


def db(x):
    return 20 * np.log10(max(float(x), 1e-12))


def bands(y):
    m = y.mean(axis=0)
    P = np.abs(np.fft.rfft(m)) ** 2
    f = np.fft.rfftfreq(len(m), 1 / SR)
    tot = P.sum()
    return {k: 10 * np.log10(P[(f >= lo) & (f < hi)].sum() / tot) for k, (lo, hi) in
            {'sub<60': (0, 60), 'bass<250': (60, 250), 'mid<2k': (250, 2000), 'pres<6k': (2000, 6000), 'air>6k': (6000, 22050)}.items()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--png')
    a = ap.parse_args()
    total = 0
    for fn in sorted(os.listdir(OUT)):
        if not fn.endswith('.m4a'):
            continue
        p = os.path.join(OUT, fn)
        size = os.path.getsize(p)
        total += size
        y = decode(p)
        name = fn[:-4]
        n = y.shape[1]
        peak = np.max(np.abs(y))
        rms = np.sqrt(np.mean(y ** 2))
        clips = int(np.sum(np.abs(y) >= 0.999))
        d = np.abs(np.diff(y, axis=1))
        seam = np.max(np.abs(y[:, 0] - y[:, -1]))
        print(f'{fn:16s} {n / SR:6.2f}s {size / 1024:7.1f} KB  peak {db(peak):6.2f} dBFS  rms {db(rms):6.2f} dBFS  clipped {clips}  '
              f'seam delta {seam:.4f} (median step {np.median(d):.4f}, p99 {np.percentile(d, 99):.4f})')
        if name != 'intro':
            # loop seam: a click would show up as a high-frequency burst at the wrap point; compare it with the rest of the track
            w = int(0.25 * SR)
            hpf = lambda x: np.fft.irfft(np.fft.rfft(x) * (np.fft.rfftfreq(x.shape[-1], 1 / SR) > 5000), x.shape[-1])
            wrap = hpf(np.concatenate([y[:, -w:], y[:, :w]], axis=1).mean(axis=0))
            at = np.max(np.abs(wrap[w - 220:w + 220]))
            ref = np.percentile(np.abs(hpf(y.mean(axis=0))), 99.9)
            print(f'   loop seam HF peak {at:.4f} vs track p99.9 {ref:.4f} -> {"OK" if at <= ref * 1.5 else "CHECK"}')
        print('   bands (dB of total):', ' '.join(f'{k} {v:5.1f}' for k, v in bands(y).items()))
        sec = SECTIONS.get(name, 10.0)
        segs = [db(np.sqrt(np.mean(y[:, int(i * sec * SR):int((i + 1) * sec * SR)] ** 2))) for i in range(int(np.ceil(n / SR / sec)))]
        print(f'   rms per {sec:g}s:', ' '.join(f'{v:6.1f}' for v in segs))
        if a.png:
            os.makedirs(a.png, exist_ok=True)
            subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-i', p, '-lavfi',
                            'showspectrumpic=s=1600x600:legend=1:scale=log:fscale=log:color=intensity', os.path.join(a.png, f'{name}-spec.png')], check=True)
            subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-i', p, '-lavfi',
                            'showwavespic=s=1600x300:split_channels=1:colors=0x5b3df5|0xff4f5e', os.path.join(a.png, f'{name}-wave.png')], check=True)
    print(f'total {total / 1024 / 1024:.2f} MB')


if __name__ == '__main__':
    main()
