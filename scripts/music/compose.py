#!/usr/bin/env python3
"""
PortableBooth original music: composed, synthesised and mixed entirely by this script (numpy only, no samples),
then encoded to AAC with ffmpeg.  Every sound here is generated from sine/saw/noise maths, so the output is an
original work owned by the project (see LICENSES.md).

    python3 scripts/music/compose.py              # all tracks -> src/assets/audio/*.m4a
    python3 scripts/music/compose.py --only intro --wav /tmp/out   # one track, also keep a float WAV

Tracks
  golden-hour.m4a  lo-fi chill hop, 84 BPM, 28 bars (80.0 s loop)
  night-drive.m4a  synthwave / city pop, 100 BPM, 32 bars (76.8 s loop)
  sunday-pop.m4a   bright indie pop, 118 BPM, 40 bars (81.4 s loop)
  intro.m4a        the tutorial score: 5 scenes x 7.5 s (128 BPM, 4 bars each), resolve + fade, 40.0 s

Loops are seamless: the song is rendered with a tail and the tail (reverb, echoes, ringing notes) is folded back
onto the head; filtering and limiting on the master are circular.
"""
import argparse
import os
import shutil
import subprocess
import sys
import wave
import zlib

import numpy as np

SR = 44100
TAU = 2 * np.pi
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, 'src', 'assets', 'audio')
FFMPEG = '/usr/bin/ffmpeg' if os.path.exists('/usr/bin/ffmpeg') else (shutil.which('ffmpeg') or 'ffmpeg')
BITRATE = '112k'

# ----------------------------------------------------------------------------------------------- pitch helpers
_NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
         'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}


def midi(s):
    return 12 * (int(s[-1]) + 1) + _NOTE[s[:-1]]


def hz(s):
    return 440.0 * 2 ** (((midi(s) if isinstance(s, str) else s) - 69) / 12)


def notes(s):
    return [hz(x) for x in s.split()]


def seed_of(*key):
    return zlib.crc32(repr(key).encode())


def rng_for(*key):
    return np.random.default_rng(seed_of(*key))


_cache = {}


def cached(fn):
    def wrap(*a, **k):
        key = (fn.__name__, a, tuple(sorted(k.items())))
        if key not in _cache:
            _cache[key] = fn(*a, **k)
        return _cache[key]
    return wrap

# ---------------------------------------------------------------------------------------------------- filters


def fftlen(n):
    return 1 << int(np.ceil(np.log2(max(n, 2))))


def filt(x, resp, circular=False):
    """zero-phase FFT filter with a magnitude response resp(freqs)"""
    n = x.shape[-1]
    N = n if circular else fftlen(n + 4096)
    f = np.fft.rfftfreq(N, 1 / SR)
    return np.fft.irfft(np.fft.rfft(x, N) * resp(f), N)[..., :n]


def LP(fc, order=2):
    return lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * order))


def HP(fc, order=2):
    return lambda f: 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-3)) ** (2 * order))


def BP(lo, hi, order=2):
    return lambda f: LP(hi, order)(f) * HP(lo, order)(f)


def SHELF(fc, db):
    """high shelf (db>0 boosts above fc)"""
    g = 10 ** (db / 20)
    return lambda f: 1 + (g - 1) / (1 + (fc / np.maximum(f, 1e-3)) ** 2)


def LOWSHELF(fc, db):
    g = 10 ** (db / 20)
    return lambda f: 1 + (g - 1) / (1 + (np.maximum(f, 1e-3) / fc) ** 2)


def PEAK(fc, db, width=1.0):
    """bell, width in octaves"""
    g = 10 ** (db / 20)
    return lambda f: 1 + (g - 1) * np.exp(-0.5 * (np.log2(np.maximum(f, 1e-3) / fc) / (width / 2)) ** 2)


def chain(*rs):
    def r(f):
        out = np.ones_like(f)
        for x in rs:
            out = out * x(f)
        return out
    return r


def sweep(x, cut, order=2, win=2048):
    """low-pass whose cutoff follows cut(t) (STFT overlap-add)"""
    mono = x.ndim == 1
    x2 = x[None] if mono else x
    n = x2.shape[1]
    hop = win // 4
    w = np.hanning(win + 1)[:-1]
    pad = np.pad(x2, ((0, 0), (win, win)))
    out = np.zeros_like(pad)
    f = np.fft.rfftfreq(win, 1 / SR)
    for s in range(0, pad.shape[1] - win + 1, hop):
        tc = max(0.0, (s + win / 2 - win) / SR)
        seg = pad[:, s:s + win] * w
        out[:, s:s + win] += np.fft.irfft(np.fft.rfft(seg) * LP(max(cut(tc), 20.0), order)(f), win) * w
    out = out[:, win:win + n] / 1.5
    return out[0] if mono else out

# ------------------------------------------------------------------------------------------------- envelopes


def tvec(n):
    return np.arange(n) / SR


def shape(n, attack=0.002, hold=None, rel=0.05):
    """attack ramp, then (if hold) a squared release that starts at `hold` seconds"""
    t = tvec(n)
    e = np.minimum(1.0, t / max(attack, 1e-4))
    if hold is not None:
        e = e * np.clip(1 - (t - hold) / max(rel, 1e-3), 0, 1) ** 2
    else:
        k = min(n, int(0.004 * SR))
        e[n - k:] *= np.linspace(1, 0, k)
    return e

# ----------------------------------------------------------------------------------------------- oscillators


def saw(freq, n, phase=0.0):
    """band-limited (polyBLEP) saw; freq is a scalar or per-sample array"""
    dt = np.broadcast_to(np.asarray(freq, dtype=float) / SR, (n,))
    ph = (phase + np.cumsum(dt)) % 1.0
    y = 2 * ph - 1
    a = ph < dt
    x = ph[a] / dt[a]
    y[a] -= x + x - x * x - 1
    b = ph > 1 - dt
    x = (ph[b] - 1) / dt[b]
    y[b] -= x * x + x + x + 1
    return y

# --------------------------------------------------------------------------------------------------- drums


@cached
def kick(f0=160.0, f1=48.0, pdecay=0.035, decay=0.32, click=0.25, drive=1.6, tone=8000.0):
    n = int((decay * 4 + 0.05) * SR)
    t = tvec(n)
    f = f1 + (f0 - f1) * np.exp(-t / pdecay)
    body = np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / decay) * np.minimum(1, t / 0.0012)
    r = rng_for('kick', f0, f1)
    cl = filt(r.standard_normal(n) * np.exp(-t / 0.004), BP(1200, tone)) * click
    y = np.tanh(drive * (body + cl)) / np.tanh(drive)
    return y * shape(n)


@cached
def snare(tone=190.0, body=0.55, ndecay=0.15, lo=1100.0, hi=8000.0, v=0):
    n = int((ndecay * 5 + 0.05) * SR)
    t = tvec(n)
    f = tone * (1 + 0.45 * np.exp(-t / 0.012))
    b = np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / 0.055) * body
    r = rng_for('snare', tone, v)
    nz = filt(r.standard_normal(n), chain(BP(lo, hi), PEAK(4500, 3, 1.5))) * np.exp(-t / ndecay) * 0.55
    y = np.tanh(1.6 * (b + nz)) * np.minimum(1, t / 0.0008)
    return y * shape(n)


@cached
def clap(decay=0.13, v=0):
    n = int((decay * 5 + 0.06) * SR)
    t = tvec(n)
    e = np.zeros(n)
    for k, o in enumerate((0.0, 0.010, 0.021, 0.031)):
        tt = np.clip(t - o, 0, None)
        e += (t >= o) * np.exp(-tt / (0.005 if k < 3 else decay)) * (1.0 if k < 3 else 0.75)
    r = rng_for('clap', v)
    nz = filt(r.standard_normal(n), chain(BP(850, 6000), PEAK(1500, 5, 1.2)))
    return np.tanh(1.3 * nz * e) * shape(n)


@cached
def hat(decay=0.045, v=0, tone=1.0):
    n = int((decay * 5 + 0.02) * SR)
    t = tvec(n)
    metal = sum(np.sign(np.sin(TAU * f * tone * t + k)) for k, f in enumerate((205.3, 304.4, 369.6, 522.7, 540.0, 800.0)))
    r = rng_for('hat', decay, v, tone)
    x = filt(0.12 * metal + r.standard_normal(n), chain(HP(7000, 3), LP(15000, 1)))
    return x * np.exp(-t / decay) * np.minimum(1, t / 0.0006) * 0.7


@cached
def shaker(v=0, decay=0.05):
    n = int(0.25 * SR)
    t = tvec(n)
    r = rng_for('shaker', v)
    x = filt(r.standard_normal(n), BP(4500, 12000, 2))
    e = np.minimum(1, t / 0.012) * np.exp(-np.clip(t - 0.012, 0, None) / decay)
    return x * e * shape(n) * 0.6


@cached
def tambourine(v=0):
    n = int(0.3 * SR)
    t = tvec(n)
    r = rng_for('tamb', v)
    jingles = sum(np.sin(TAU * f * t + r.random() * 6) for f in (6100.0, 7350.0, 8220.0, 9600.0, 11000.0))
    x = filt(r.standard_normal(n) * 0.7 + 0.25 * jingles, HP(5000, 2))
    return x * np.exp(-t / 0.07) * np.minimum(1, t / 0.002) * shape(n) * 0.6


@cached
def crash(dur=2.6, v=0):
    n = int(dur * SR)
    t = tvec(n)
    r = rng_for('crash', v)
    metal = sum(np.sin(TAU * f * t + r.random() * 6) for f in r.uniform(3000, 12000, 24))
    x = filt(r.standard_normal(n) + 0.08 * metal, chain(HP(3000, 2), LP(13000, 1)))
    e = np.exp(-t / (dur * 0.33)) * np.minimum(1, t / 0.002)
    return x * e * shape(n) * 0.55


@cached
def rim():
    n = int(0.1 * SR)
    t = tvec(n)
    x = np.sin(TAU * 1750 * t) * np.exp(-t / 0.01) + 0.5 * filt(rng_for('rim').standard_normal(n), BP(2000, 8000)) * np.exp(-t / 0.006)
    return x * shape(n) * 0.7


@cached
def snap(v=0):
    n = int(0.2 * SR)
    t = tvec(n)
    r = rng_for('snap', v)
    x = filt(r.standard_normal(n), BP(1800, 7500)) * np.exp(-t / 0.02) + 0.35 * np.sin(TAU * 2300 * t) * np.exp(-t / 0.006)
    return np.tanh(1.5 * x) * shape(n) * 0.8


@cached
def gated_snare(tone=200.0):
    """80s snare: dense short room, then a hard gate"""
    s = snare(tone, 0.6, 0.12, 900.0, 9000.0) + 0.7 * clap()[: len(snare(tone, 0.6, 0.12, 900.0, 9000.0))]
    ir = make_ir(0.9, 0.004, 6500, seed=3)
    n = int(0.45 * SR)
    dry = np.zeros(n)
    dry[: len(s)] += s[:n]
    wet = convolve(np.stack([dry, dry]), ir)
    t = tvec(n)
    gate = np.clip(1 - (t - 0.2) / 0.05, 0, 1) ** 1.5
    return (np.stack([dry, dry]) * 0.8 + wet * 0.9) * gate


def riser(dur, lo=300.0, hi=10000.0, curve=2.2, seed=0, level=0.5):
    n = int(dur * SR)
    t = tvec(n)
    r = rng_for('riser', dur, seed)
    x = r.standard_normal((2, n)) * (t / dur) ** curve
    y = sweep(x, lambda tt: lo * (hi / lo) ** (np.clip(tt / dur, 0, 1) ** 1.4))
    y[:, -int(0.006 * SR):] *= np.linspace(1, 0, int(0.006 * SR))
    return y * level


def swell(dur, v=0, level=0.6):
    """reverse cymbal that peaks exactly at its end"""
    c = crash(3.0, v)[::-1][-int(dur * SR):].copy()
    c *= np.linspace(0, 1, len(c)) ** 0.6
    c[-int(0.004 * SR):] *= np.linspace(1, 0, int(0.004 * SR))
    return c * level


@cached
def shutter():
    """camera shutter: click-clack with a little air"""
    n = int(0.4 * SR)
    t = tvec(n)
    r = rng_for('shutter')
    y = np.zeros(n)
    for at, amp, f0 in ((0.0, 1.0, 3300.0), (0.062, 0.75, 2500.0)):
        i = int(at * SR)
        m = n - i
        tt = t[:m]
        c = filt(r.standard_normal(m), BP(1500, 9500)) * np.exp(-tt / 0.0035)
        c += 0.5 * np.sin(TAU * f0 * tt) * np.exp(-tt / 0.012)
        c += 0.55 * np.sin(TAU * 150 * tt) * np.exp(-tt / 0.025)
        y[i:] += amp * c
    air = filt(r.standard_normal(n), BP(800, 6000)) * np.minimum(1, t / 0.006) * np.exp(-t / 0.08) * 0.18
    return np.tanh(1.4 * (y + air)) * shape(n) * 0.8


@cached
def boom():
    n = int(2.2 * SR)
    t = tvec(n)
    f = 38 + 60 * np.exp(-t / 0.12)
    y = np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / 0.7) * np.minimum(1, t / 0.002)
    return np.tanh(1.5 * y) * shape(n)

# ---------------------------------------------------------------------------------------------- instruments


@cached
def ep(f, dur, vel=0.8, rel=0.3, wow=0.0, seed=0):
    """FM electric piano (tine + bark)"""
    n = int((dur + rel) * SR)
    t = tvec(n)
    r = rng_for('ep', seed)
    drift = 2 ** (wow * np.sin(TAU * 0.55 * t + r.random() * 6) / 1200)  # tape wow, in cents
    ph = TAU * np.cumsum(np.full(n, f) * drift) / SR
    idx = vel * (2.6 * np.exp(-t / 0.25) + 0.5)
    y = np.sin(ph + idx * np.sin(ph))
    y += 0.10 * vel * np.sin(14.0 * ph) * np.exp(-t / 0.018)
    y += 0.25 * np.sin(2 * ph) * np.exp(-t / 0.4)
    amp = np.exp(-t / (2.2 * (261.6 / f) ** 0.45)) * shape(n, 0.003, dur, rel)
    return y * amp * (0.55 + 0.45 * vel)


@cached
def pluck(f, dur, bright=0.5, decay=0.5, kind='saw', rel=0.06, stretch=0.0):
    """additive plucked string / synth pluck: upper partials die faster"""
    n = int((dur + rel) * SR)
    t = tvec(n)
    fc = f * (1.5 + 10 * bright)
    y = np.zeros(n)
    k = 1
    while True:
        fk = f * k * np.sqrt(1 + stretch * k * k)
        if fk > 15500 or k > 40:
            break
        if kind == 'square' and k % 2 == 0:
            k += 1
            continue
        a = (1 / k) / np.sqrt(1 + (fk / fc) ** 4)
        if a > 2e-3:
            dk = decay / (1 + 0.55 * (k - 1) * (1.2 - bright))
            y += a * np.exp(-t / dk) * np.sin(TAU * fk * t + 0.3 * k)
        k += 1
    return y * shape(n, 0.0015, dur, rel) * 0.8


@cached
def bell(f, dur=1.5, kind='glock', bright=1.0):
    n = int(dur * SR)
    t = tvec(n)
    if kind == 'glock':
        parts = ((1, 1.0, 1.0), (2.756, 0.32 * bright, 0.35), (5.404, 0.12 * bright, 0.15), (8.933, 0.05 * bright, 0.06))
    else:  # music box / celesta
        parts = ((1, 1.0, 0.9), (2.0, 0.22, 0.45), (3.0, 0.08 * bright, 0.22), (4.07, 0.06 * bright, 0.1), (6.2, 0.03 * bright, 0.04))
    y = np.zeros(n)
    for r_, a, d in parts:
        if f * r_ < 16000:
            y += a * np.exp(-t / (d * dur * 0.6)) * np.sin(TAU * f * r_ * t)
    y += 0.04 * filt(rng_for('bell', f).standard_normal(n), HP(3000)) * np.exp(-t / 0.002)
    return y * np.minimum(1, t / 0.001) * shape(n) * 0.7


@cached
def vibes(f, dur, rel=0.4):
    n = int((dur + rel) * SR)
    t = tvec(n)
    y = np.sin(TAU * f * t) + 0.12 * np.sin(TAU * f * 4 * t) * np.exp(-t / 0.15) + 0.05 * np.sin(TAU * f * 10 * t) * np.exp(-t / 0.04)
    trem = 1 + 0.18 * np.sin(TAU * 4.8 * t)
    return y * trem * np.exp(-t / 1.4) * shape(n, 0.002, dur, rel) * 0.6


@cached
def lead(f, dur, cutoff=3000.0, vib=0.15, rel=0.14):
    n = int((dur + rel) * SR)
    t = tvec(n)
    v = 1 + (2 ** (vib / 12) - 1) * np.sin(TAU * 5.3 * t) * np.clip((t - 0.2) / 0.3, 0, 1)
    s = 0.5 * saw(f * v * 2 ** (7 / 1200), n) + 0.5 * saw(f * v * 2 ** (-7 / 1200), n, 0.37) + 0.35 * np.sin(TAU * f * 0.5 * t)
    dark = filt(s, LP(cutoff * 0.55))
    bright = filt(s, LP(cutoff * 1.6))
    y = dark + (bright - dark) * np.exp(-t / 0.18)
    return y * shape(n, 0.012, dur, rel) * 0.45


@cached
def bass_sine(f, dur, rel=0.07, harm=0.22):
    n = int((dur + rel) * SR)
    t = tvec(n)
    y = np.sin(TAU * f * t) + harm * np.sin(TAU * 2 * f * t) * np.exp(-t / 0.35) + 0.07 * np.sin(TAU * 3 * f * t)
    y = np.tanh(1.4 * y) / np.tanh(1.4)
    return filt(y * shape(n, 0.006, dur, rel), LP(1100))


@cached
def bass_saw(f, dur, cutoff=230.0, amt=1300.0, decay=0.11, rel=0.04):
    n = int((dur + rel) * SR)
    t = tvec(n)
    s = 0.6 * saw(f, n) + 0.45 * saw(f * 1.005, n, 0.5)
    dark = filt(s, LP(cutoff, 2))
    bright = filt(s, LP(cutoff + amt, 2))
    y = dark + (bright - dark) * np.exp(-t / decay) + 0.35 * np.sin(TAU * f * t)
    return np.tanh(1.3 * y * shape(n, 0.003, dur, rel)) * 0.8


@cached
def bass_pick(f, dur, rel=0.05):
    n = int((dur + rel) * SR)
    t = tvec(n)
    y = pluck(f, dur, 0.18, 0.7, 'saw', rel)[:n] * 1.2 + 0.55 * np.sin(TAU * f * t) * np.exp(-t / 0.9) * shape(n, 0.003, dur, rel)
    return np.tanh(1.2 * y)


def pad(freqs, dur, voices=5, detune=14.0, cutoff=1800.0, attack=0.45, rel=0.9, width=0.85, seed=0, bright=0.0):
    """detuned saw pad, low-passed, spread across the stereo field"""
    n = int((dur + rel) * SR)
    r = rng_for('pad', tuple(round(x, 2) for x in freqs), seed)
    L = np.zeros(n)
    R = np.zeros(n)
    for f in freqs:
        for v in range(voices):
            c = detune * (v - (voices - 1) / 2) / max(1, (voices - 1) / 2)
            s = saw(f * 2 ** (c / 1200), n, r.random())
            p = width * (2 * v / max(1, voices - 1) - 1) * (1 if r.random() > 0.5 else -1)
            L += s * np.cos((p + 1) * np.pi / 4)
            R += s * np.sin((p + 1) * np.pi / 4)
    y = filt(np.stack([L, R]), chain(LP(cutoff, 2), HP(110, 1), SHELF(3000, bright)))
    return y * shape(n, attack, dur, rel) / (len(freqs) * voices) ** 0.5 * 0.5

# ------------------------------------------------------------------------------------------------ space


def make_ir(rt=1.8, pre=0.018, dark=5000.0, seed=7):
    n = int((pre + rt * 1.15) * SR)
    t = tvec(n)
    r = np.random.default_rng(seed)
    nz = r.standard_normal((2, n))
    lo = filt(nz, LP(dark, 1))
    ir = lo * np.exp(-6.9 * t / rt) + 0.45 * (nz - lo) * np.exp(-6.9 * t / (rt * 0.4))
    for _ in range(10):
        i = int((pre + r.uniform(0.004, 0.07)) * SR)
        ir[r.integers(0, 2), i] += r.choice((-1, 1)) * r.uniform(1.5, 4.0)
    p = int(pre * SR)
    ir[:, :p] = 0
    ir[:, p:p + int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
    ir -= ir.mean(axis=1, keepdims=True)
    return ir / np.sqrt(np.sum(ir ** 2) / 2)


def convolve(x, ir):
    """stereo in -> mid summed into a decorrelated stereo IR"""
    n = x.shape[1]
    mid = x.mean(axis=0)
    N = fftlen(n + ir.shape[1])
    X = np.fft.rfft(mid, N)
    return np.stack([np.fft.irfft(X * np.fft.rfft(ir[c], N), N)[:n] for c in (0, 1)])


def pingpong(x, d, fb=0.42, taps=7, lp=3800.0, hp=350.0):
    n = x.shape[1]
    mono = x.mean(axis=0)
    N = fftlen(n + 4096)
    f = np.fft.rfftfreq(N, 1 / SR)
    X = np.fft.rfft(mono, N)
    H = BP(hp, lp, 1)(f)
    acc = [np.zeros_like(X), np.zeros_like(X)]
    for k in range(1, taps + 1):
        acc[(k + 1) % 2] += X * fb ** (k - 1) * H ** k * np.exp(-1j * TAU * f * k * d)
    l, r = (np.fft.irfft(a, N)[:n] for a in acc)
    return np.stack([l + 0.25 * r, r + 0.25 * l])

# --------------------------------------------------------------------------------------------- the song


class Song:
    def __init__(self, name, bpm, bars, swing=0.5, tail=6.0, loop=True, length=None, seed=0):
        self.name, self.bpm, self.bars, self.swing, self.loop = name, bpm, bars, swing, loop
        self.beat = 60.0 / bpm
        self.s16 = self.beat / 4
        self.barlen = self.beat * 4
        self.length = length if length is not None else bars * self.barlen
        if loop:
            # a whole number of AAC frames (1024 samples): no encoder padding at the end, so the loop point is clean
            n = int(round(self.length * SR / 1024)) * 1024
            k = n / SR / self.length
            self.beat *= k
            self.s16 *= k
            self.barlen *= k
            self.bpm /= k
            self.length = n / SR
        self.n = int(round(self.length * SR))
        self.total = self.n + int(tail * SR)
        self.buses = {}
        self.kicks = []
        self.rng = np.random.default_rng(seed)

    def bus(self, name):
        if name not in self.buses:
            self.buses[name] = np.zeros((2, self.total))
        return self.buses[name]

    def t(self, bar, step=0.0):
        s = int(np.floor(step + 1e-9))
        sw = (self.swing - 0.5) * 2 * self.s16 if s % 2 == 1 else 0.0
        return bar * self.barlen + step * self.s16 + sw

    def put(self, bus, sig, t, gain=1.0, pan=0.0, verb=0.0, delay=0.0, jitter=0.0):
        if jitter:
            t += self.rng.normal(0, jitter)
        if self.loop:
            t %= self.length
        i = int(round(t * SR))
        st = sig if sig.ndim == 2 else np.stack([sig * np.cos((pan + 1) * np.pi / 4), sig * np.sin((pan + 1) * np.pi / 4)]) * np.sqrt(2)
        if i < 0:
            st = st[:, -i:]
            i = 0
        m = min(self.total - i, st.shape[1])
        if m <= 0:
            return
        for name, g in ((bus, gain), ('verb', gain * verb), ('delay', gain * delay)):
            if g:
                self.bus(name)[:, i:i + m] += st[:, :m] * g

    def kick(self, t, sig, gain=1.0, **kw):
        self.kicks.append(t % self.length if self.loop else t)
        self.put('kick', sig, t, gain, **kw)

    def duck(self, depth=0.5, release=0.16, attack=0.004):
        g = np.ones(self.total)
        m = int(release * 5 * SR)
        tt = tvec(m)
        curve = depth * np.minimum(1, tt / attack) * np.exp(-tt / release)
        for k in self.kicks:
            for kk in (k, k + self.length) if self.loop else (k,):
                i = int(round(kk * SR))
                if i >= self.total:
                    continue
                e = min(self.total, i + m)
                g[i:e] = np.minimum(g[i:e], 1 - curve[: e - i])
        return g

# ------------------------------------------------------------------------------------------------ master


def _movmin(g, r, B=64):
    n = len(g)
    nb = -(-n // B)
    gb = np.pad(g, (0, nb * B - n), constant_values=1.0).reshape(nb, B).min(axis=1)
    k = r // B + 1
    p = np.pad(gb, (k, k), constant_values=1.0)
    w = np.lib.stride_tricks.sliding_window_view(p, 2 * k + 1).min(axis=1)
    return np.repeat(w, B)[:n]


def _movavg(g, r):
    c = np.cumsum(np.pad(g, (r + 1, r), mode='edge'))
    return (c[2 * r + 1:] - c[: -2 * r - 1]) / (2 * r + 1)


def limiter(x, ceil_db=-1.0, hold=0.012, smooth=0.010, loop=False):
    c = 10 ** (ceil_db / 20)
    rm, ra = int(hold * SR), int(smooth * SR)
    pad = rm + ra + 128
    xx = np.concatenate([x[:, -pad:], x, x[:, :pad]], axis=1) if loop else np.pad(x, ((0, 0), (pad, pad)))
    peak = np.max(np.abs(xx), axis=0)
    g = np.minimum(1.0, c / np.maximum(peak, 1e-9))
    g = _movavg(_movmin(g, rm), ra)
    y = (xx * g)[:, pad:pad + x.shape[1]]
    return np.clip(y, -c, c), float(g.min())


def master(x, loop, rms_db=-16.0, ceil_db=-1.0, eq=None, sat=1.0):
    x = filt(x, chain(HP(32, 2), *(eq or [])), circular=loop)
    if sat:
        x = np.tanh(x * sat) / sat
    rms = np.sqrt(np.mean(x ** 2))
    x = x * (10 ** (rms_db / 20) / max(rms, 1e-9))
    y, gmin = limiter(x, ceil_db, loop=loop)
    return y, gmin


def finish(song, mix):
    if song.loop:
        y = mix[:, : song.n].copy()
        rest = song.total - song.n
        y[:, :rest] += mix[:, song.n:]
    else:
        y = mix[:, : song.n].copy()
    return y


def mixdown(song, gains, ir=None, delay=None, duck=None):
    out = np.zeros((2, song.total))
    ducks = {}
    for name, B in song.buses.items():
        if name in ('verb', 'delay'):
            continue
        g = gains.get(name, 1.0)
        if duck and name in duck:
            depth, rel = duck[name]
            key = (depth, rel)
            if key not in ducks:
                ducks[key] = song.duck(depth, rel)
            B = B * ducks[key]
        out += B * g
    verb_in = song.buses.get('verb', np.zeros((2, song.total))).copy()
    if delay and 'delay' in song.buses:
        d = pingpong(song.buses['delay'], *delay)
        out += d * gains.get('delay', 1.0)
        verb_in += d * 0.35
    if ir is not None:
        wet = convolve(verb_in, ir) * gains.get('verb', 1.0)
        if duck and 'verb' in duck:
            wet = wet * song.duck(*duck['verb'])
        out += wet
    return out

# ================================================================================================== TRACKS


def golden_hour():
    """lo-fi chill hop: dusty Rhodes, swung boom-bap, round sine bass, vibes melody, vinyl"""
    s = Song('golden-hour', 84, 28, swing=0.585, seed=11)
    A = [('A3 C4 E4 G4', 'F2'), ('B3 D4 E4 G4', 'E2'), ('A3 C4 E4 F4', 'D2'), ('G3 B3 D4 E4', 'C2')]
    B = [('A3 C4 E4 G4', 'F2'), ('B3 D4 E4 G4', 'E2'), ('G3 B3 C4 E4', 'A2'), ('F3 A3 C4 D4', 'G2')]
    prog = [A if (b // 4) % 2 == 0 else B for b in range(28)]
    mel1 = [[(2, 2, 'E5'), (4, 2, 'G5'), (6, 4, 'A5'), (12, 2, 'G5'), (14, 2, 'E5')],
            [(0, 4, 'D5'), (6, 2, 'E5'), (8, 6, 'G5')],
            [(2, 2, 'C5'), (4, 2, 'D5'), (6, 2, 'E5'), (8, 4, 'A4'), (12, 2, 'C5')],
            [(0, 8, 'B4'), (10, 2, 'G4'), (12, 4, 'A4')]]
    mel2 = [[(0, 3, 'C6'), (3, 3, 'A5'), (6, 2, 'G5'), (8, 4, 'E5'), (14, 2, 'G5')],
            [(0, 2, 'E5'), (2, 2, 'D5'), (4, 8, 'B4')],
            [(2, 2, 'E5'), (4, 2, 'G5'), (6, 6, 'C6'), (12, 2, 'B5'), (14, 2, 'G5')],
            [(0, 10, 'A5'), (12, 2, 'G5'), (14, 2, 'F5')]]
    for bar in range(28):
        sec = 'intro' if bar < 4 else 'A' if bar < 12 else 'B' if bar < 20 else 'break' if bar < 24 else 'A2'
        ch, root = prog[bar][bar % 4]
        fs = notes(ch)
        # Rhodes: long hit + a softer re-hit, gently strummed, a touch of tape wow
        for step, length, vel in ((0, 9.5, 0.85), (10, 5.5, 0.55)):
            for k, f in enumerate(fs):
                s.put('keys', ep(f, length * s.s16, vel, 0.35, 4.0, k + bar % 3), s.t(bar, step) + k * 0.014,
                      0.23, pan=(k - 1.5) * 0.25, verb=0.22, jitter=0.002)
        # bass
        r = hz(root)
        if sec != 'intro':
            line = [(0, 5, r), (7, 2, r), (10, 3, r * 1.5), (14, 1.6, r * (2 ** (-1 / 12)) if bar % 2 else r * 2)]
            if sec == 'break':
                line = [(0, 6, r), (8, 6, r)]
            for step, length, f in line:
                s.put('bass', bass_sine(f, length * s.s16), s.t(bar, step), 0.42, jitter=0.002)
        # drums
        if sec in ('A', 'B', 'A2', 'intro'):
            ks = [0, 10] if bar % 2 == 0 else [0, 7, 10]
            for st in ks:
                s.kick(s.t(bar, st), kick(118.0, 52.0, 0.04, 0.24, 0.12, 1.3, 5000.0), 0.7 if sec != 'intro' else 0.45)
            if sec != 'intro':
                for st in (4, 12):
                    s.put('drums', snare(205.0, 0.5, 0.13, 1300.0, 8500.0, bar % 4), s.t(bar, st), 0.6, pan=0.05, verb=0.12, jitter=0.003)
                    s.put('drums', rim(), s.t(bar, st), 0.12, pan=-0.1)
                if bar % 4 == 3:
                    s.put('drums', snare(205.0, 0.5, 0.13, 1300.0, 6500.0, 7), s.t(bar, 15), 0.14, jitter=0.003)
        if sec != 'break' or bar >= 22:
            for st in range(16):
                acc = (0.75, 0.3, 0.5, 0.32)[st % 4]
                if sec == 'intro' and st % 2:
                    continue
                s.put('drums', hat(0.04, (bar * 16 + st) % 5), s.t(bar, st), acc * 0.62 * (0.85 + 0.3 * s.rng.random()), pan=0.3, jitter=0.003)
            if bar % 4 == 3:
                s.put('drums', hat(0.22, 2), s.t(bar, 14), 0.22, pan=0.3)
        # vibes melody
        if sec in ('B', 'break', 'A2'):
            mel = (mel1 if sec != 'A2' else mel2)[bar % 4]
            for step, length, nn in mel:
                s.put('lead', vibes(hz(nn), length * s.s16), s.t(bar, step), 0.33, pan=-0.2, verb=0.3, delay=0.22, jitter=0.004)
        # warm pad underneath the B section and the break
        if sec in ('B', 'break'):
            s.put('pad', pad([f / 2 for f in fs[1:]] + fs[:1], s.barlen, 4, 10.0, 1100.0, 0.6, 1.2, seed=bar), s.t(bar), 0.55)
    # vinyl crackle + hiss across the whole loop
    r = np.random.default_rng(5)
    imp = np.zeros((2, s.n))
    k = r.poisson(9 * s.length)
    pos = r.integers(0, s.n, k)
    amp = r.random(k) ** 3 * r.choice((-1, 1), k)
    imp[0, pos] += amp
    imp[1, (pos + r.integers(-30, 30, k)) % s.n] += amp * r.uniform(0.4, 1.0, k)
    crackle = filt(imp, BP(1500, 9000, 1), circular=True) * 0.5 + filt(r.standard_normal((2, s.n)), BP(400, 7000, 1), circular=True) * 0.004
    s.bus('vinyl')[:, : s.n] += crackle
    # Rhodes tremolo (slow autopan)
    tt = tvec(s.total)
    trem = 0.13 * np.sin(TAU * tt / (s.beat * 2))
    s.buses['keys'] *= np.stack([1 + trem, 1 - trem])
    ir = make_ir(1.5, 0.02, 3800.0, seed=21)
    mix = mixdown(s, {'kick': 1.0, 'drums': 0.9, 'bass': 1.0, 'keys': 1.0, 'lead': 1.0, 'pad': 0.8, 'vinyl': 0.6, 'verb': 0.5, 'delay': 0.7},
                  ir, delay=(s.beat * 0.75, 0.38, 6, 3000.0, 400.0),
                  duck={'keys': (0.22, 0.2), 'bass': (0.35, 0.12), 'pad': (0.3, 0.2), 'lead': (0.12, 0.2)})
    y = finish(s, mix)
    return s, master(y, True, -17.0, -1.0, [LP(13500, 1), LOWSHELF(70, -2.0), PEAK(300, -1.5, 1.5), SHELF(3500, 2.5)], sat=1.1)


def night_drive():
    """synthwave / city pop: octave saw bass, gated snare, supersaw pad, 16th arp, singing lead"""
    s = Song('night-drive', 100, 32, swing=0.5, seed=23)
    A = [('F3 A3 C4 E4', 'F1'), ('G3 B3 D4 E4', 'G1'), ('E3 G3 B3 D4', 'E1'), ('C4 E4 G4 B4', 'A1')]
    B = [('C4 D4 F4 A4', 'D2'), ('E3 G3 B3 D4', 'E1'), ('F3 A3 C4 E4', 'F1'), ('F3 G3 C4 D4', 'G1')]
    order = [A, A, B, A, B, A, A, B]
    leadA = [[(0, 6, 'E5'), (6, 2, 'D5'), (8, 4, 'C5'), (12, 4, 'A4')],
             [(0, 3, 'B4'), (3, 3, 'C5'), (6, 6, 'D5'), (12, 4, 'G4')],
             [(0, 4, 'E5'), (4, 4, 'G5'), (8, 6, 'B4'), (14, 2, 'D5')],
             [(0, 10, 'C5'), (10, 2, 'B4'), (12, 4, 'A4')]]
    leadB = [[(0, 4, 'F5'), (4, 4, 'E5'), (8, 8, 'D5')],
             [(0, 4, 'E5'), (4, 4, 'G5'), (8, 4, 'B5'), (12, 4, 'A5')],
             [(0, 6, 'A5'), (6, 2, 'G5'), (8, 4, 'F5'), (12, 4, 'E5')],
             [(0, 8, 'D5'), (8, 8, 'G5')]]
    gs = gated_snare()
    for bar in range(32):
        sec = 'intro' if bar < 4 else 'A' if bar < 12 else 'B' if bar < 20 else 'break' if bar < 24 else 'A2'
        prog = order[bar // 4]
        ch, root = prog[bar % 4]
        fs = notes(ch)
        r = hz(root)
        s.put('pad', pad(fs, s.barlen - 0.05, 5, 16.0, 2400.0 if sec != 'intro' else 1300.0, 0.25, 0.7, seed=bar % 4), s.t(bar), 0.85, verb=0.18)
        # 16th arpeggio across two octaves
        tones = sorted(fs + [f * 2 for f in fs])
        patt = [0, 2, 4, 6, 5, 3, 1, 3, 0, 2, 4, 7, 6, 4, 2, 1]
        for st in range(16):
            f = tones[patt[st] % len(tones)]
            g = 0.16 if sec != 'intro' else 0.11 + 0.012 * (bar * 16 + st) / 16
            s.put('arp', pluck(f, s.s16 * 0.9, 0.55, 0.16, 'square', 0.05), s.t(bar, st), g, pan=0.35 * (1 if st % 2 else -1), delay=0.28)
        # bass: octave 8ths with a filter pluck
        if sec != 'intro':
            for st in range(0, 16, 2):
                f = r if st % 4 == 0 else r * 2
                cut = 260.0 if sec != 'break' else 170.0
                s.put('bass', bass_saw(f, s.s16 * 1.7, cut, 1200.0 if sec != 'break' else 500.0), s.t(bar, st), 0.5)
        # drums
        if sec in ('A', 'B', 'A2'):
            for st in (0, 8) + ((10,) if bar % 2 else ()):
                s.kick(s.t(bar, st), kick(165.0, 46.0, 0.032, 0.34, 0.3, 1.7, 7000.0), 0.95)
            for st in (4, 12):
                s.put('drums', gs, s.t(bar, st), 0.62)
            for st in range(16):
                acc = (0.65, 0.3, 0.5, 0.3)[st % 4]
                s.put('drums', hat(0.035 if st % 4 != 2 else 0.09, st % 3), s.t(bar, st), acc * 0.38, pan=-0.25)
            if bar % 8 == 7:
                for k, st in enumerate((12, 13, 14, 15)):
                    s.put('drums', snare(230.0, 0.45, 0.1, 900.0, 8000.0, k), s.t(bar, st), 0.15 + 0.08 * k, verb=0.2)
        if sec == 'break' and bar == 23:
            s.put('fx', swell(2.2, 1, 0.5), s.t(24) - 2.2)
        if bar in (4, 12, 24):
            s.put('drums', crash(2.6, bar), s.t(bar), 0.32, pan=0.3, verb=0.2)
        if bar == 3:
            s.put('fx', swell(2.0, 2, 0.45), s.t(4) - 2.0)
        # lead
        if sec in ('B', 'break', 'A2'):
            ph = leadB if prog is B else leadA
            for step, length, nn in ph[bar % 4]:
                s.put('lead', lead(hz(nn), length * s.s16 * 0.95, 3200.0), s.t(bar, step), 0.3, pan=0.05, verb=0.28, delay=0.3)
    # gentle filter opening on the intro arp (seamless: the loop returns here from the full mix)
    i1 = int(s.t(4) * SR)
    s.buses['arp'][:, :i1] = sweep(s.buses['arp'][:, :i1], lambda tt: 700 * (6000 / 700) ** min(1, tt / s.t(4)))
    ir = make_ir(2.2, 0.025, 5200.0, seed=31)
    mix = mixdown(s, {'kick': 0.8, 'drums': 1.0, 'bass': 0.58, 'pad': 1.05, 'arp': 1.4, 'lead': 1.35, 'fx': 0.8, 'verb': 0.55, 'delay': 0.6},
                  ir, delay=(s.beat * 0.75, 0.45, 7, 4200.0, 450.0),
                  duck={'pad': (0.45, 0.18), 'bass': (0.5, 0.12), 'arp': (0.25, 0.15), 'verb': (0.3, 0.2)})
    y = finish(s, mix)
    return s, master(y, True, -16.0, -1.0, [LOWSHELF(60, -3.0), PEAK(400, -1.5, 1.5), SHELF(4000, 2.0), LP(16000, 1)], sat=1.15)


def sunday_pop():
    """bright indie pop: strummed clean guitar, picked bass, claps, tambourine, glockenspiel hook"""
    s = Song('sunday-pop', 118, 40, swing=0.52, seed=37)
    A = [('G2 B2 D3 G3 B3 G4', 'G2'), ('F#2 A2 D3 A3 D4 F#4', 'F#2'), ('E2 B2 D3 G3 B3 E4', 'E2'), ('C3 E3 G3 D4 G4', 'C2')]
    C1 = [('C3 G3 C4 E4 G4', 'C2'), ('D3 A3 D4 F#4', 'D2'), ('E3 B3 D4 G4 B4', 'E2'), ('B2 D3 G3 B3 G4', 'B1')]
    C2 = [('C3 G3 C4 E4 G4', 'C2'), ('D3 A3 D4 F#4', 'D2'), ('G2 B2 D3 G3 B3 G4', 'G2'), ('G2 B2 D3 G3 B3 G4', 'G2')]
    hook1 = [[(0, 2, 'E5'), (2, 2, 'G5'), (4, 4, 'G5'), (8, 2, 'E5'), (10, 2, 'D5'), (12, 4, 'C5')],
             [(0, 2, 'D5'), (2, 2, 'F#5'), (4, 4, 'A5'), (8, 4, 'F#5'), (12, 4, 'D5')],
             [(0, 2, 'B4'), (2, 2, 'E5'), (4, 4, 'G5'), (8, 4, 'G5'), (12, 4, 'E5')],
             [(0, 8, 'D5'), (8, 2, 'B4'), (10, 2, 'D5'), (12, 4, 'G5')]]
    hook2 = hook1[:2] + [[(0, 6, 'D5'), (6, 2, 'E5'), (8, 8, 'G5')], [(0, 8, 'B4'), (8, 8, 'G4')]]
    counter = [[(8, 4, 'B5'), (12, 4, 'D6')], [(8, 8, 'A5')], [(8, 4, 'G5'), (12, 4, 'B5')], [(8, 8, 'G5')]]
    strum = [(0, 'D', 1.0), (4, 'D', 0.8), (6, 'U', 0.6), (10, 'U', 0.65), (12, 'D', 0.8), (14, 'U', 0.6)]
    for bar in range(40):
        sec = ('intro' if bar < 4 else 'verse' if bar < 12 else 'chorus' if bar < 20 else 'verse2' if bar < 28
               else 'chorus2' if bar < 36 else 'outro')
        chorus = sec.startswith('chorus')
        prog = (C1 if (bar // 4) % 2 == 1 else C2) if chorus else A
        ch, root = prog[bar % 4]
        fs = notes(ch)
        r = hz(root)
        # guitar strums
        for i, (st, d, vel) in enumerate(strum):
            nxt = strum[i + 1][0] if i + 1 < len(strum) else 16
            dur = (nxt - st) * s.s16 + 0.03
            strings = fs if d == 'D' else fs[-4:][::-1]
            for k, f in enumerate(strings):
                s.put('gtr', pluck(f, dur, 0.62, 0.9, 'saw', 0.04, 0.00008), s.t(bar, st) + k * 0.008, 0.2 * vel * (0.9 + 0.2 * s.rng.random()),
                      pan=-0.45 + 0.15 * k / len(strings), verb=0.12, jitter=0.002)
            # double-tracked, panned right, a hair later
            if sec != 'intro':
                for k, f in enumerate(strings):
                    s.put('gtr', pluck(f, dur, 0.45, 0.8, 'saw', 0.04, 0.00008), s.t(bar, st) + 0.013 + k * 0.009, 0.15 * vel, pan=0.5, verb=0.1)
        # bass
        if sec != 'intro':
            for st in range(0, 16, 2):
                f = r * 1.5 if st == 14 else r
                s.put('bass', bass_pick(f, s.s16 * 1.8), s.t(bar, st), 0.55 * (1.0 if st % 4 == 0 else 0.8))
        # drums
        if sec != 'intro':
            kicks = (0, 8) if not chorus else (0, 6, 8, 11)
            for st in kicks:
                s.kick(s.t(bar, st), kick(185.0, 54.0, 0.03, 0.28, 0.35, 1.5, 9000.0), 0.85)
            for st in (4, 12):
                s.put('drums', snare(215.0, 0.5, 0.13, 1000.0, 9000.0, bar % 3), s.t(bar, st), 0.42, verb=0.16)
                s.put('drums', clap(0.12, bar % 2), s.t(bar, st) + 0.004, 0.33 if chorus else 0.18, pan=0.12, verb=0.18)
            for st in range(0, 16, 2 if not chorus else 1):
                acc = 0.55 if st % 4 == 0 else 0.42 if st % 2 == 0 else 0.22
                s.put('drums', hat(0.04 if not (chorus and st % 4 == 2) else 0.16, st % 4), s.t(bar, st), acc * 0.55, pan=0.28)
            if chorus:
                for st in range(16):
                    s.put('drums', tambourine(st % 3), s.t(bar, st), (0.4 if st % 4 == 0 else 0.22), pan=-0.4, jitter=0.002)
        else:
            for st in range(0, 16, 2):
                s.put('drums', shaker(st % 3), s.t(bar, st), 0.3 if st % 4 else 0.18, pan=0.3)
        if sec == 'outro':
            for st in range(0, 16, 2):
                s.put('drums', shaker(st % 3), s.t(bar, st), 0.25, pan=0.3)
        if bar in (12, 28):
            s.put('drums', crash(2.4, bar), s.t(bar), 0.35, pan=-0.2, verb=0.2)
        if bar in (11, 27):
            s.put('fx', swell(1.6, bar, 0.4), s.t(bar + 1) - 1.6)
        # glockenspiel hook in the choruses, a counter line in verse 2
        if chorus:
            hook = (hook1 if prog is C1 else hook2)[bar % 4]
            for step, length, nn in hook:
                s.put('bells', bell(hz(nn), 1.6, 'glock'), s.t(bar, step), 0.3, pan=0.15, verb=0.25, delay=0.12)
            s.put('pad', pad([f for f in fs if f > 120], s.barlen, 3, 9.0, 3000.0, 0.15, 0.6, 0.6, seed=bar % 4), s.t(bar), 0.45)
        if sec == 'verse2':
            for step, length, nn in counter[bar % 4]:
                s.put('bells', bell(hz(nn), 1.4, 'glock', 0.7), s.t(bar, step), 0.2, pan=-0.2, verb=0.3, delay=0.2)
    ir = make_ir(1.6, 0.02, 6500.0, seed=41)
    mix = mixdown(s, {'kick': 0.85, 'drums': 1.1, 'bass': 0.62, 'gtr': 1.3, 'bells': 1.1, 'pad': 0.8, 'fx': 0.8, 'verb': 0.45, 'delay': 0.5},
                  ir, delay=(s.beat * 0.5, 0.3, 5, 5000.0, 600.0),
                  duck={'pad': (0.3, 0.15), 'bass': (0.3, 0.1), 'gtr': (0.12, 0.12)})
    y = finish(s, mix)
    return s, master(y, True, -16.0, -1.0, [HP(40, 1), LOWSHELF(80, -1.5), PEAK(300, -2.0, 1.5), SHELF(3500, 2.5)], sat=1.1)


def intro():
    """the tutorial score: five 7.5 s scenes at 128 BPM (4 bars each), cuts on bar lines, resolve at 30 s"""
    s = Song('intro', 128, 22, swing=0.5, loop=False, length=40.0, tail=6.0, seed=53)
    assert abs(s.barlen * 4 - 7.5) < 1e-9
    S1 = [('F#3 A3 C#4 E4', 'D2'), ('D4 E4 F#4 A4', 'B1'), ('B3 D4 F#4 A4', 'G2'), ('A3 D4 E4', 'A2')]
    S3 = [('F#3 A3 B3 D4', 'B1'), ('F#3 B3 D4 E4', 'G2'), ('F#3 A3 D4 E4', 'F#2'), ('E3 A3 D4 E4', 'A2')]
    S4 = [('F#3 A3 D4 E4', 'D2'), ('E3 A3 C#4 E4', 'C#2'), ('F#3 A3 B3 D4', 'B1'), ('G3 B3 D4 E4', 'G2')]
    S5 = [('F#3 A3 D4 F#4', 'D2'), ('G3 B3 D4 F#4', 'B1'), ('G3 B3 D4 E4', 'E2'), ('F#3 A3 C#4 E4', 'D2')]
    box1 = [[(0, 4, 'D5'), (4, 4, 'A5'), (8, 2, 'F#5'), (10, 2, 'A5'), (12, 4, 'E5')],
            [(0, 4, 'D5'), (4, 4, 'F#5'), (8, 4, 'B5'), (12, 4, 'A5')],
            [(0, 4, 'B4'), (4, 4, 'D5'), (8, 2, 'F#5'), (10, 2, 'G5'), (12, 4, 'A5')],
            [(0, 6, 'A5'), (6, 2, 'G5'), (8, 8, 'E5')]]
    lead4 = [[(0, 2, 'F#5'), (2, 2, 'A5'), (4, 4, 'D6'), (8, 2, 'C#6'), (10, 2, 'A5'), (12, 4, 'F#5')],
             [(0, 2, 'E5'), (2, 2, 'A5'), (4, 4, 'C#6'), (8, 4, 'E6'), (12, 4, 'C#6')],
             [(0, 2, 'D6'), (2, 2, 'B5'), (4, 4, 'F#5'), (8, 2, 'A5'), (10, 2, 'B5'), (12, 4, 'D6')],
             [(0, 4, 'B5'), (4, 4, 'D6'), (8, 4, 'C#6'), (12, 4, 'E6')]]
    box5 = [[(0, 4, 'F#5'), (4, 4, 'A5'), (8, 8, 'D6')],
            [(0, 4, 'B5'), (4, 4, 'D6'), (8, 8, 'F#6')],
            [(0, 4, 'E6'), (4, 4, 'D6'), (8, 4, 'B5'), (12, 4, 'C#6')],
            [(0, 16, 'D6')]]
    hard = kick(175.0, 53.0, 0.028, 0.2, 0.42, 1.6, 9500.0)
    for bar in range(20):
        sc = bar // 4
        b4 = bar % 4
        if sc in (0, 1):
            ch, root = S1[b4]
        elif sc == 2:
            ch, root = S3[b4]
        elif sc == 3:
            ch, root = S4[b4]
        else:
            ch, root = S5[min(b4, 3)]
        fs = notes(ch)
        r = hz(root)
        t0 = s.t(bar)
        # ---- 1 Pick your film: curious, soft. music box + a quiet pad
        if sc == 0:
            s.put('pad', pad(fs, s.barlen, 4, 12.0, 900.0 + 250 * b4, 0.7 if bar == 0 else 0.3, 0.9, seed=b4), t0, 0.75, verb=0.3)
            for step, length, nn in box1[b4]:
                s.put('bells', bell(hz(nn), 2.0, 'box'), s.t(bar, step), 0.32, pan=0.2 * np.sin(step), verb=0.35, delay=0.25)
            if b4 >= 2:
                for st in (4, 12):
                    s.put('drums', rim(), s.t(bar, st), 0.06, pan=0.4, verb=0.3)
        # ---- 2 Snap or upload: playful pulse, snaps, shutter at 9.5 s
        if sc == 1:
            s.put('pad', pad(fs, s.barlen, 4, 12.0, 1400.0, 0.2, 0.9, seed=b4), t0, 0.6, verb=0.2)
            for st in range(0, 16, 2):
                f = fs[(st // 2) % len(fs)] * (1 if st % 4 == 0 else 2)
                s.put('keys', pluck(f, s.s16 * 0.8, 0.45, 0.09, 'square', 0.03), s.t(bar, st), 0.22, pan=0.3 * (1 if st % 4 else -1), delay=0.15)
            for st in (0, 8):
                s.kick(s.t(bar, st), kick(120.0, 50.0, 0.04, 0.24, 0.05, 1.2, 3000.0), 0.55)
                s.put('bass', bass_sine(r, s.s16 * 3), s.t(bar, st), 0.45)
            for st in (4, 12):
                s.put('drums', snap(st % 2 + b4), s.t(bar, st), 0.5, pan=-0.15, verb=0.2)
            for st in range(16):
                s.put('drums', shaker(st % 3), s.t(bar, st), 0.18 if st % 2 else 0.1, pan=0.35)
            if b4 % 2 == 0:
                for step, length, nn in box1[b4][:3]:
                    s.put('bells', bell(hz(nn) * 2, 1.4, 'box', 0.6), s.t(bar, step), 0.14, pan=-0.3, verb=0.4)
        # ---- 3 Make it yours: lift. four-on-the-floor fades up through a filter, bass, claps, roll + riser
        if sc == 2:
            s.put('pad', pad(fs, s.barlen, 5, 15.0, 1500.0 + 600 * b4, 0.15, 0.6, seed=b4, bright=2.0), t0, 0.7, verb=0.2)
            for st in (0, 4, 8, 12):
                s.kick(s.t(bar, st), hard, 0.8)
            for st in (2, 6, 10, 14):
                s.put('bass', bass_saw(r, s.s16 * 1.6, 240.0, 900.0 + 200 * b4), s.t(bar, st), 0.42)
                s.put('build', hat(0.06, st % 3), s.t(bar, st), 0.25, pan=0.2)
            for st in range(0, 16, 2):
                f = fs[(st // 2 + b4) % len(fs)] * 2
                s.put('keys', pluck(f, s.s16 * 1.5, 0.55, 0.14, 'saw', 0.04), s.t(bar, st), 0.16, pan=0.3 * (1 if st % 4 else -1), delay=0.2)
            if b4 >= 2:
                for st in (4, 12):
                    s.put('build', clap(0.12, st % 2), s.t(bar, st), 0.4, verb=0.2)
            if b4 == 3:
                for k, st in enumerate(range(8, 16)):
                    s.put('build', snare(240.0, 0.4, 0.09, 1000.0, 8000.0, k), s.t(bar, st), 0.12 + 0.05 * k, verb=0.15)
        # ---- 4 Frames, colours, details: the full groove
        if sc == 3:
            if b4 < 3:
                s.put('pad', pad(fs, s.barlen, 5, 15.0, 3200.0, 0.05, 0.4, seed=b4, bright=2.0), t0, 0.65, verb=0.15)
            else:
                s.put('pad', pad(fs, s.barlen / 2, 5, 15.0, 3200.0, 0.05, 0.2, seed=8, bright=2.0), t0, 0.65, verb=0.15)
                s.put('pad', pad(notes('E3 A3 C#4 E4'), s.barlen / 2, 5, 15.0, 3400.0, 0.05, 0.5, seed=9, bright=2.0), s.t(bar, 8), 0.65, verb=0.15)
            for st in (0, 4, 8, 12):
                s.kick(s.t(bar, st), hard, 0.95)
            rr = r if not (b4 == 3 and True) else r
            for st in range(0, 16, 2):
                f = rr if st % 4 == 2 else rr * 2
                if b4 == 3 and st >= 8:
                    f = hz('A1') * (1 if st % 4 == 2 else 2)
                s.put('bass', bass_saw(f, s.s16 * 1.6, 260.0, 1300.0), s.t(bar, st), 0.45)
            for st in (4, 12):
                s.put('drums', clap(0.13, st % 2), s.t(bar, st), 0.5, verb=0.2)
                s.put('drums', snare(215.0, 0.45, 0.12, 1000.0, 9000.0, st), s.t(bar, st), 0.3)
            for st in range(16):
                op = st % 4 == 2
                s.put('drums', hat(0.18 if op else 0.035, st % 3), s.t(bar, st), 0.3 if op else 0.15, pan=0.25)
            for step, length, nn in lead4[b4]:
                s.put('lead', pluck(hz(nn), length * s.s16, 0.6, 0.35, 'saw', 0.08), s.t(bar, step), 0.3, pan=-0.1, verb=0.2, delay=0.3)
                s.put('lead', bell(hz(nn), 1.0, 'glock', 0.6), s.t(bar, step), 0.08, verb=0.3)
            if bar == 12:
                s.put('drums', crash(2.4, 1), t0, 0.35, verb=0.25)
        # ---- 5 Save. Print. Share.: the hit, an uplifting resolve, then let it ring
        if sc == 4:
            if b4 == 0:
                s.put('drums', crash(3.0, 4), t0, 0.5, verb=0.4)
                s.put('bass', boom(), t0, 0.3)
                for f in fs:
                    s.put('keys', pluck(f * 2, 0.6, 0.7, 0.6, 'saw', 0.3), t0, 0.16, verb=0.5)
            s.put('pad', pad(fs, s.barlen if b4 < 3 else 6.0, 5, 15.0, 2600.0 - 300 * b4, 0.05 if b4 == 0 else 0.25, 1.5, seed=b4, bright=1.5),
                  t0, 0.7 if b4 < 3 else 0.6, verb=0.3)
            if b4 < 2:
                for st in (0, 4, 8, 12):
                    s.kick(s.t(bar, st), hard, 0.8 if b4 == 0 else 0.6)
                for st in (4, 12):
                    s.put('drums', clap(0.13, st % 2), s.t(bar, st), 0.35 if b4 == 0 else 0.25, verb=0.3)
                for st in range(2, 16, 4):
                    s.put('drums', hat(0.18, st % 3), s.t(bar, st), 0.22, pan=0.25)
                for st in range(0, 16, 2):
                    s.put('bass', bass_saw(r if st % 4 == 2 else r * 2, s.s16 * 1.6, 240.0, 1000.0), s.t(bar, st), 0.38 if b4 == 0 else 0.3)
            elif b4 == 2:
                s.put('bass', bass_sine(r, s.barlen * 0.5), t0, 0.5)
                s.put('bass', bass_sine(hz('A1'), s.barlen * 0.5), s.t(bar, 8), 0.5)
            else:
                s.put('bass', bass_sine(r, 3.0, 1.5), t0, 0.28)
            for step, length, nn in box5[b4]:
                s.put('bells', bell(hz(nn), 2.6 if b4 == 3 else 1.8, 'glock'), s.t(bar, step), 0.3, verb=0.4, delay=0.25)
                s.put('bells', bell(hz(nn) / 2, 2.0, 'box'), s.t(bar, step), 0.12, verb=0.4)
    # transitions: swells that land exactly on the cuts
    s.put('fx', swell(1.6, 0, 0.35), 7.5 - 1.6)
    s.put('fx', swell(1.8, 1, 0.42), 15.0 - 1.8)
    s.put('fx', riser(3.75, 400.0, 9000.0, 2.0, 1, 0.22), 22.5 - 3.75)
    s.put('fx', swell(2.2, 2, 0.5), 22.5 - 2.2)
    s.put('fx', riser(3.75, 300.0, 11000.0, 2.2, 2, 0.28), 30.0 - 3.75)
    s.put('fx', swell(2.6, 3, 0.6), 30.0 - 2.6)
    s.put('fx', shutter(), 9.5, 0.9, pan=0.1, verb=0.15)
    s.put('fx', bell(hz('A6'), 0.8, 'box', 0.5), 9.5 + 0.09, 0.05, verb=0.4)  # a tiny "ding" after the click
    # scene 3: the beat rises out of a low-pass
    i0, i1 = int(15.0 * SR), int(22.5 * SR)
    for name in ('kick', 'build'):
        B = s.bus(name)
        B[:, i0:i1] = sweep(B[:, i0:i1], lambda tt: 350 * (16000 / 350) ** (min(1.0, tt / 7.2) ** 1.6))
    ir = make_ir(2.0, 0.022, 5600.0, seed=61)
    mix = mixdown(s, {'kick': 0.72, 'drums': 1.0, 'build': 1.0, 'bass': 0.62, 'pad': 0.85, 'keys': 1.2, 'lead': 1.25, 'bells': 1.15, 'fx': 0.9,
                      'verb': 0.55, 'delay': 0.55},
                  ir, delay=(s.beat * 0.75, 0.4, 6, 4200.0, 450.0),
                  duck={'pad': (0.4, 0.16), 'bass': (0.45, 0.11), 'keys': (0.2, 0.12)})
    # soft ending: everything is gone by 40 s
    tt = tvec(s.total)
    fade = np.where(tt < 35.0, 1.0, np.cos(np.clip((tt - 35.0) / 4.8, 0, 1) * np.pi / 2) ** 2)
    mix *= fade
    y = finish(s, mix)
    # the start of the file breathes in (no click)
    y[:, : int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR))
    return s, master(y, False, -16.5, -1.0, [LOWSHELF(60, -2.0), PEAK(400, -1.0, 1.5), SHELF(8000, 0.5)], sat=1.1)


TRACKS = {'golden-hour': golden_hour, 'night-drive': night_drive, 'sunday-pop': sunday_pop, 'intro': intro}


def write_wav(path, y):
    data = (np.clip(y.T, -1, 1) * 32767).astype('<i2').tobytes()
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data)


def encode(path, y):
    pcm = np.ascontiguousarray(y.T.astype('<f4')).tobytes()
    cmd = [FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', 'pipe:0',
           '-c:a', 'aac', '-b:a', BITRATE, '-ar', str(SR), '-map_metadata', '-1', '-fflags', '+bitexact', '-movflags', '+faststart', path]
    subprocess.run(cmd, input=pcm, check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', action='append')
    ap.add_argument('--wav', help='also write 16-bit WAVs to this folder')
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    for name, fn in TRACKS.items():
        if a.only and name not in a.only:
            continue
        song, (y, gmin) = fn()
        peak = float(np.max(np.abs(y)))
        rms = float(np.sqrt(np.mean(y ** 2)))
        print(f'{name:12s} {y.shape[1] / SR:6.2f}s  peak {20 * np.log10(peak):6.2f} dBFS  rms {20 * np.log10(rms):6.2f} dBFS  '
              f'max GR {-20 * np.log10(gmin):4.1f} dB  seam {np.max(np.abs(y[:, -1] - y[:, 0])):.4f}  bpm {song.bpm:.3f}', flush=True)
        encode(os.path.join(OUT, f'{name}.m4a'), y)
        if a.wav:
            os.makedirs(a.wav, exist_ok=True)
            write_wav(os.path.join(a.wav, f'{name}.wav'), y)
        _cache.clear()


if __name__ == '__main__':
    sys.exit(main())
