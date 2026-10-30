"""Original score + sound design for the PortableBooth ad, synthesised from scratch (numpy/scipy, no samples),
then mixed under the voice-over and mastered.

  python3 audio/compose.py        (reads audio/cues.json, public/audio/vo.mp3; writes public/audio/mix.wav + stems)

Arc: nostalgic Rhodes + vinyl -> beat drop on "pocket" -> 120 BPM indie-pop/house through the demos (fills on cuts)
-> breakdown under "the part we care about most" -> build through sharing -> landing -> final hit on the logo -> tail.
"""
import json, os, subprocess, sys
import numpy as np
from scipy import signal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
cues = json.load(open(os.path.join(ROOT, 'audio', 'cues.json')))
DUR = cues['duration']
N = int(round(DUR * SR))
rng = np.random.default_rng(7)
G = cues['grid']['origin']           # downbeat of the drop ("pocket")
BEAT = 60 / cues['grid']['bpm']
BAR = BEAT * 4
SEC = cues['sections']
HIT = cues['hit']
H2 = HIT['logo']                     # downbeat of the final section (logo hit)

def bar(n, origin=G):
    return origin + n * BAR

def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)

def env_exp(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))

def adsr(n, a=0.005, d=0.1, s=0.7, r=0.2, hold=None):
    a_n, d_n, r_n = int(a * SR), int(d * SR), int(r * SR)
    hold_n = n - a_n - d_n - r_n if hold is None else int(hold * SR)
    hold_n = max(0, hold_n)
    e = np.concatenate([np.linspace(0, 1, max(1, a_n)), np.linspace(1, s, max(1, d_n)), np.full(hold_n, s), np.linspace(s, 0, max(1, r_n))])
    return e[:n] if len(e) >= n else np.pad(e, (0, n - len(e)))

def lp(x, fc, order=2):
    b, a = signal.butter(order, min(fc, SR / 2 * 0.95) / (SR / 2), 'low')
    return signal.lfilter(b, a, x, axis=0)

def hp(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), 'high')
    return signal.lfilter(b, a, x, axis=0)

def bp(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), min(hi, SR / 2 * 0.95) / (SR / 2)], 'band')
    return signal.lfilter(b, a, x, axis=0)

class Bus:
    def __init__(self):
        self.x = np.zeros((N, 2))
    def add(self, sig, t, gain=1.0, pan=0.0):
        if t >= DUR or t < -5:
            return
        i = int(round(t * SR))
        if sig.ndim == 1:
            l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
            sig = np.stack([sig * l * 1.414, sig * r * 1.414], 1)
        s0 = max(0, -i); i0 = max(0, i)
        n = min(len(sig) - s0, N - i0)
        if n > 0:
            self.x[i0:i0 + n] += sig[s0:s0 + n] * gain

# ------------------------------------------------------------------ instruments
def kick(level=1.0, tone=1.0):
    n = int(0.55 * SR); t = np.arange(n) / SR
    f = 46 + 110 * np.exp(-t / 0.032) * tone
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / 0.30)
    click = bp(rng.standard_normal(n) * np.exp(-t / 0.0025), 1500, 7000) * 0.35
    return np.tanh((body + click) * 1.6) * 0.8 * level

def clap():
    n = int(0.45 * SR); t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    e = np.zeros(n)
    for k, d in enumerate([0, 0.011, 0.022]):
        i = int(d * SR); e[i:] += np.exp(-(t[: n - i]) / 0.006) * (0.8 if k < 2 else 1)
    e += np.exp(-t / 0.14) * 0.45 * (t > 0.022)
    return bp(noise * e, 900, 5200) * 0.9

def snare(level=1.0):
    n = int(0.35 * SR); t = np.arange(n) / SR
    body = (np.sin(2 * np.pi * 185 * t) + 0.5 * np.sin(2 * np.pi * 330 * t)) * np.exp(-t / 0.06)
    nz = hp(rng.standard_normal(n), 1800) * np.exp(-t / 0.13)
    return np.tanh((body * 0.7 + nz * 0.8) * 1.2) * 0.7 * level

def hat(open_=False, level=1.0):
    n = int((0.42 if open_ else 0.09) * SR); t = np.arange(n) / SR
    m = sum(signal.square(2 * np.pi * f * t) for f in [205.3, 304.4, 369.6, 522.7, 540.0, 800.0])
    x = hp(m * 0.15 + rng.standard_normal(n) * 0.6, 7000, 3)
    return x * np.exp(-t / (0.12 if open_ else 0.022)) * 0.35 * level

def shaker(level=1.0):
    n = int(0.09 * SR); t = np.arange(n) / SR
    e = np.minimum(t / 0.012, 1) * np.exp(-t / 0.03)
    return bp(rng.standard_normal(n), 4500, 11000) * e * 0.18 * level

def tom(f0=120, level=1.0):
    n = int(0.4 * SR); t = np.arange(n) / SR
    f = f0 * (1 + 0.5 * np.exp(-t / 0.05))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.18) * 0.6 * level

def crash(length=2.4, level=1.0):
    n = int(length * SR); t = np.arange(n) / SR
    m = sum(signal.square(2 * np.pi * f * t + rng.random() * 6) for f in [310, 457, 583, 711, 893, 1123, 1407])
    x = hp(m * 0.1 + rng.standard_normal(n), 3500, 2)
    x = x * (np.exp(-t / (length * 0.35)))
    st = np.stack([x, np.roll(x, 37)], 1)
    return st * 0.22 * level

def rhodes(midi, dur, vel=0.7, bright=1.0):
    f = mtof(midi)
    n = int((dur + 1.6) * SR); t = np.arange(n) / SR
    idx = (2.2 * bright * vel) * np.exp(-t / 0.35) + 0.4
    mod = np.sin(2 * np.pi * f * t) * idx
    car = np.sin(2 * np.pi * f * t + mod)
    tine = np.sin(2 * np.pi * f * 7.03 * t) * np.exp(-t / 0.05) * 0.25 * bright * vel
    tau = 1.6 * (60 / max(midi, 40)) ** 1.2
    e = np.exp(-t / tau) * np.minimum(t / 0.004, 1)
    rel = np.ones(n); r0 = int(dur * SR)
    if r0 < n:
        rel[r0:] = np.exp(-np.arange(n - r0) / (0.12 * SR))
    trem = 1 + 0.12 * np.sin(2 * np.pi * 4.8 * t)
    x = (car + tine) * e * rel * vel * 0.32
    return np.stack([x * trem, x * (2 - trem)], 1)

def pad(midis, dur, level=0.5, cutoff=1800, attack=0.8):
    n = int((dur + 1.5) * SR); t = np.arange(n) / SR
    x = np.zeros((n, 2))
    for m in midis:
        f = mtof(m)
        for k, det in enumerate([-0.11, -0.04, 0.03, 0.09, 0.14]):
            ph = rng.random()
            saw = 2 * ((f * (1 + det / 100 * 12) * t + ph) % 1) - 1
            x[:, k % 2] += saw
    x = lp(x, cutoff, 2)
    e = adsr(n, a=attack, d=0.4, s=0.85, r=1.4, hold=max(0, dur - attack - 0.4))
    return x * e[:, None] * level * 0.05

def ks_pluck(midi, dur=0.6, bright=0.5, level=0.5):
    f = mtof(midi)
    n = int(dur * SR)
    p = int(round(SR / f))
    buf = lp(rng.standard_normal(p), 2000 + 6000 * bright, 1)
    out = np.zeros(n)
    d = 0.996 - 0.006 * (1 - bright)
    y = np.concatenate([buf, np.zeros(n)])
    for i in range(p, n + p):  # Karplus-Strong
        y[i] = d * 0.5 * (y[i - p] + y[i - p + 1])
    out = y[p:n + p]
    out *= np.minimum(np.arange(n) / 48, 1)
    return out * level

def bass_note(midi, dur, level=0.8):
    f = mtof(midi)
    n = int((dur + 0.08) * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t)
    saw = lp(2 * ((f * t) % 1) - 1, 380, 2)
    e = np.minimum(t / 0.006, 1) * np.exp(-t / 0.5)
    e[int(dur * SR):] *= np.exp(-np.arange(n - int(dur * SR)) / (0.02 * SR))
    return np.tanh((s * 0.9 + saw * 0.5) * 1.4) * e * level * 0.55

def bell(midi, level=0.4, dur=2.5):
    f = mtof(midi)
    n = int(dur * SR); t = np.arange(n) / SR
    x = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / (dec)) for r, a, dec in [(1, 1, 1.2), (2.76, 0.5, 0.5), (5.4, 0.3, 0.25), (8.93, 0.15, 0.12)])
    return x * np.minimum(t / 0.002, 1) * level * 0.3

def noise_sweep(dur, f0, f1, level=0.3, curve=2.0, rise=True):
    """STFT-shaped noise with a moving band (risers, whooshes)"""
    hop, nfft = 256, 1024
    frames = int(dur * SR / hop) + 4
    freqs = np.fft.rfftfreq(nfft, 1 / SR)
    out = np.zeros(frames * hop + nfft)
    win = np.hanning(nfft)
    for k in range(frames):
        u = k / frames
        fc = f0 * (f1 / f0) ** (u ** curve if rise else u)
        shape = np.exp(-0.5 * (np.log(np.maximum(freqs, 1) / fc) / 0.35) ** 2)
        spec = shape * np.exp(2j * np.pi * rng.random(len(freqs)))
        out[k * hop:k * hop + nfft] += np.fft.irfft(spec) * win
    out = out[: int(dur * SR)]
    out /= np.max(np.abs(out)) + 1e-9
    return out * level

def reverb_ir(rt=1.8, pre=0.02, damp=6000):
    n = int(rt * SR); t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-6.9 * t / rt)[:, None]
    ir = lp(ir, damp, 1)
    ir = np.concatenate([np.zeros((int(pre * SR), 2)), ir])
    return ir / np.sqrt(np.sum(ir ** 2))

def reverb(x, rt=1.8, mix=0.25, pre=0.02, damp=6000):
    ir = reverb_ir(rt, pre, damp)
    wet = np.stack([signal.fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], 1)
    return x * (1 - mix * 0.3) + wet * mix

# ------------------------------------------------------------------ harmony
CH = {
    'F':  ([53, 57, 60, 64], 41), 'Am': ([52, 57, 60, 64], 45), 'Dm': ([53, 57, 60, 62], 38),
    'Bb': ([53, 57, 62, 65], 46), 'C': ([55, 60, 64, 67], 48), 'Gm': ([53, 58, 62, 65], 43), 'Csus': ([53, 55, 60, 65], 48),
}
PROG = ['F', 'Am', 'Dm', 'Bb']
BREAK = ['Bb', 'C', 'Am', 'Dm']

drums, bass, keys, pads, plucks, fx, sfx = Bus(), Bus(), Bus(), Bus(), Bus(), Bus(), Bus()
kicks = []

def K(t, lv=1.0, tone=1.0):
    drums.add(kick(lv, tone), t, 0.95)
    kicks.append(t)

def groove_bar(b0, chord, lvl=1.0, hats=True, claps=True, kick_on=True, pluck=True, bass_on=True, stabs=True, shake=True, origin=G):
    t0 = bar(b0, origin)
    notes, root = CH[chord]
    for q in range(4):
        tb = t0 + q * BEAT
        if kick_on: K(tb, lvl)
        if claps and q in (1, 3): drums.add(clap(), tb, 0.55 * lvl, 0.05)
        if hats:
            drums.add(hat(False, 0.9), tb + BEAT / 2, 0.8 * lvl, 0.25)
            if q in (1, 3): drums.add(hat(True, 0.6), tb + BEAT / 2, 0.35 * lvl, 0.25)
        if shake:
            for s in range(4): drums.add(shaker(0.6 + 0.4 * (s % 2)), tb + s * BEAT / 4 + 0.006, 0.7 * lvl, -0.35)
        if bass_on:
            bass.add(bass_note(root - 12 + 12 * (q == 2 and False), BEAT * 0.42), tb + BEAT / 2, 0.85 * lvl)
            if q == 3: bass.add(bass_note(root, BEAT * 0.2), tb + BEAT * 0.75, 0.5 * lvl)
    if stabs:
        for off, v in [(0, 0.62), (BEAT * 1.5, 0.5), (BEAT * 3, 0.42)]:
            for m in notes: keys.add(rhodes(m, BEAT * 0.9, v, 1.1), t0 + off, 0.55 * lvl, -0.15)
    if pluck:
        arp = [notes[0] + 12, notes[2] + 12, notes[1] + 12, notes[3] + 12, notes[2] + 24, notes[3] + 12, notes[1] + 12, notes[2] + 12]
        for i in range(8):
            plucks.add(ks_pluck(arp[i], 0.5, 0.55), t0 + i * BEAT / 2 + BEAT / 4, 0.28 * lvl, 0.35 if i % 2 else -0.35)

def fill(t_end, kind='snare', lvl=1.0):
    if kind == 'snare':
        for i, d in enumerate([0.5, 0.375, 0.25, 0.125]):
            drums.add(snare(0.5 + i * 0.15), t_end - d, 0.55 * lvl)
    else:
        for i, (d, f0) in enumerate([(0.5, 190), (0.375, 150), (0.25, 120), (0.125, 95)]):
            drums.add(tom(f0, 0.8), t_end - d, 0.6 * lvl, 0.4 - i * 0.25)

def impact(t, lvl=1.0):
    n = int(1.6 * SR); tt = np.arange(n) / SR
    boom = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-tt / 0.08)) / SR) * np.exp(-tt / 0.6)
    fx.add(np.tanh(boom * 1.5) * 0.7 * lvl, t)
    fx.add(crash(2.6, lvl), t, 0.9)
    kicks.append(t)

# ---- intro: nostalgic Rhodes, rubato, with vinyl
for tt, ch in [(0.15, 'F'), (2.05, 'Am'), (3.62, 'Dm'), (5.05, 'Bb'), (6.9, 'Gm')]:
    notes, root = CH[ch]
    for k, m in enumerate(notes):
        keys.add(rhodes(m, 1.5, 0.45, 0.7), tt + k * 0.035, 0.75, -0.2 + k * 0.13)
    keys.add(rhodes(root, 1.6, 0.4, 0.5), tt, 0.5)
pads.add(pad([53, 57, 60, 64], 7.5, 0.5, 1200, 1.5), 0.0, 0.5)
keys.add(rhodes(72, 1.0, 0.35), 3.2, 0.5, 0.3)
keys.add(rhodes(69, 1.0, 0.3), 4.6, 0.45, 0.3)
# riser into the drop, then a breath of silence before it
r = noise_sweep(G - 0.12 - SEC['pocket'], 300, 9000, 0.28, 2.2)
fx.add(r * np.linspace(0.2, 1, len(r)), SEC['pocket'])
for k, m in enumerate([60, 62, 64, 65, 67, 69, 72]):
    plucks.add(ks_pluck(m + 12, 0.4, 0.4), SEC['pocket'] + 0.25 + k * (G - 0.4 - SEC['pocket']) / 7, 0.22, 0.3 * (-1) ** k)

# ---- drop + section A (logo, film demo)
impact(G, 1.0)
for b in range(0, 7):
    groove_bar(b, PROG[b % 4], lvl=0.92 if b > 1 else 1.0, pluck=b >= 2)
fill(bar(2), 'tom', 0.8)
# ---- pose: pull back, filtered chords and a rising snare roll into SNAP
for b in (7, 8):
    notes, root = CH[PROG[(b) % 4]]
    for m in notes: keys.add(rhodes(m, BAR * 0.95, 0.4, 0.6), bar(b), 0.6)
    bass.add(bass_note(root - 12, BAR * 0.9, 0.6), bar(b), 0.7)
pads.add(pad([53, 57, 60, 64], BAR * 2, 0.4, 900, 0.6), bar(7), 0.6)
roll_s, roll_e = bar(8) + BEAT * 0, HIT['snap'] - 0.02
t = roll_s; step = BEAT / 2
while t < roll_e - 0.03:
    u = (t - roll_s) / (roll_e - roll_s)
    drums.add(snare(0.3 + 0.7 * u), t, 0.18 + 0.4 * u)
    t += step * (1 - 0.6 * u)
fx.add(noise_sweep(roll_e - bar(7) - 0.5, 400, 7000, 0.22, 2.5), bar(7) + 0.5)
impact(HIT['snap'], 0.9)
# ---- section B: full groove through upload + editing
for b in range(9, 19):
    groove_bar(b, PROG[b % 4], lvl=1.0)
for b_end in (11, 15, 17, 19):
    fill(bar(b_end), 'snare' if b_end % 2 else 'tom', 0.9)
fx.add(crash(1.8, 0.6), bar(11))
fx.add(crash(1.8, 0.5), bar(17))
# ---- breakdown: pads, soft keys, sub, vinyl
for i, ch in enumerate(BREAK):
    notes, root = CH[ch]
    pads.add(pad(notes + [notes[0] + 12], BAR, 0.7, 1500, 0.9), bar(19 + i), 0.75)
    for k, m in enumerate(notes):
        keys.add(rhodes(m + 12, BAR * 0.9, 0.28, 0.5), bar(19 + i) + BEAT * 0.5 + k * 0.05, 0.45, 0.2)
    bass.add(bass_note(root - 12, BAR * 0.95, 0.35), bar(19 + i), 0.5)
fx.add(crash(3.0, 0.4), bar(19))
# ---- build: sharing beat
for b in range(23, 27):
    u = (b - 23) / 4
    notes, root = CH[PROG[b % 4]]
    for q in range(4):
        tb = bar(b) + q * BEAT
        K(tb, 0.55 + 0.4 * u, 0.8 + 0.2 * u)
        if b >= 24: drums.add(hat(False, 0.8), tb + BEAT / 2, 0.5 + 0.3 * u, 0.25)
        if b >= 25 and q in (1, 3): drums.add(clap(), tb, 0.45, 0.05)
        bass.add(bass_note(root - 12, BEAT * 0.42), tb + BEAT / 2, 0.6 + 0.3 * u)
    pads.add(pad(notes, BAR, 0.5, 900 + 2500 * u, 0.3), bar(b), 0.55)
    arp = [notes[0] + 12, notes[2] + 12, notes[1] + 12, notes[3] + 12] * 2
    for i in range(8):
        plucks.add(ks_pluck(arp[i], 0.45, 0.3 + 0.5 * u), bar(b) + i * BEAT / 2 + BEAT / 4, 0.2 + 0.12 * u, 0.35 * (-1) ** i)
t = bar(26);
while t < bar(27) - 0.03:
    u = (t - bar(26)) / BAR
    drums.add(snare(0.3 + 0.7 * u), t, 0.2 + 0.45 * u)
    t += BEAT / 2 if u < 0.5 else BEAT / 4
fx.add(noise_sweep(BAR * 2, 300, 10000, 0.25, 2.4), bar(25))
# ---- lands: one full bar, then the emotional turn
impact(bar(27), 0.75)
groove_bar(27, 'F', lvl=1.0)
pads.add(pad([53, 57, 60, 64, 69], 3.2, 0.7, 1600, 0.6), bar(28), 0.75)
for k, m in enumerate([65, 69, 72, 76]):
    keys.add(rhodes(m, 2.5, 0.4, 0.6), bar(28) + k * 0.12, 0.6, -0.3 + k * 0.2)
keys.add(rhodes(41, 3.0, 0.4, 0.4), bar(28), 0.5)
pads.add(pad([55, 60, 64, 67], H2 - bar(28) - 2.0, 0.5, 1400, 0.4), bar(28) + 2.0, 0.6)
rr = noise_sweep(H2 - SEC['moments'] - 0.6, 500, 9000, 0.2, 2.3)
fx.add(rr * np.linspace(0.1, 1, len(rr)), SEC['moments'] + 0.6)
# ---- final: hit on the logo, two bars, final chord + tail
impact(H2, 1.1)
for b in (0, 1):
    groove_bar(b, ['F', 'Bb'][b], lvl=0.85, origin=H2, pluck=True)
fill(bar(2, H2), 'tom', 0.7)
end_t = bar(2, H2)
K(end_t, 1.0)
fx.add(crash(3.6, 0.8), end_t)
for k, m in enumerate([53, 57, 60, 64, 69, 72]):
    keys.add(rhodes(m, 3.0, 0.55, 0.8), end_t + k * 0.02, 0.6, -0.3 + k * 0.12)
pads.add(pad([53, 57, 60, 64, 72], 2.0, 0.8, 2200, 0.05), end_t, 0.7)
bass.add(bass_note(29, 2.5, 0.8), end_t, 0.9)
for k, m in enumerate([84, 88, 91, 96]):
    keys.add(np.stack([bell(m, 0.5)] * 2, 1), end_t + 0.12 + k * 0.09, 0.35, 0)

# ------------------------------------------------------------------ vinyl texture (intro + breakdown + outro)
def vinyl(length):
    n = int(length * SR)
    hiss = lp(rng.standard_normal(n), 5000, 1) * 0.012
    cr = np.zeros(n)
    idx = rng.choice(n, int(length * 18), replace=False)
    cr[idx] = rng.standard_normal(len(idx)) * rng.random(len(idx)) ** 3
    cr = bp(cr, 1200, 9000) * 0.9
    rumble = lp(rng.standard_normal(n), 60, 2) * 0.05
    return hiss + cr + rumble
v = vinyl(DUR)
vg = np.zeros(N); t_ = np.arange(N) / SR
vg += np.clip(1 - (t_ - (G - 0.4)) / 0.3, 0, 1) * (t_ < G)  # intro
vg += np.clip((t_ - bar(19)) / 1.0, 0, 1) * np.clip((bar(23) - t_) / 1.0, 0, 1) * 0.7
vg += np.clip((t_ - SEC['moments']) / 0.8, 0, 1) * (t_ < H2) * 0.6
vg += np.clip((t_ - (end_t + 0.5)) / 1.0, 0, 1) * 0.5
fx.add(np.stack([v * vg, np.roll(v, 13) * vg], 1), 0, 0.9)

# ------------------------------------------------------------------ sound design
def shutter():
    n = int(0.16 * SR); t = np.arange(n) / SR
    def clk(d, f):
        x = bp(rng.standard_normal(n), f, f * 3) * np.exp(-np.maximum(t - d, 0) / 0.006) * (t >= d)
        return x + np.sin(2 * np.pi * f * 0.5 * t) * np.exp(-np.maximum(t - d, 0) / 0.01) * (t >= d) * 0.3
    return (clk(0, 1800) + clk(0.055, 2600) * 0.8) * 0.9

def flash_pop():
    n = int(0.9 * SR); t = np.arange(n) / SR
    whine = np.sin(2 * np.pi * np.cumsum(1800 + 5000 * (t / 0.25)) / SR) * (t < 0.25) * 0.03 * t / 0.25
    pre = np.zeros(n)
    pop = (bp(rng.standard_normal(n), 300, 6000) * np.exp(-np.maximum(t - 0.25, 0) / 0.04) * (t >= 0.25))
    thump = np.sin(2 * np.pi * 70 * t) * np.exp(-np.maximum(t - 0.25, 0) / 0.08) * (t >= 0.25)
    return whine + pre + pop * 0.6 + thump * 0.5

def tick():
    n = int(0.03 * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 3100 * t) * np.exp(-t / 0.004) + hp(rng.standard_normal(n), 4000) * np.exp(-t / 0.002) * 0.4) * 0.5

def beep(f=880, d=0.14):
    n = int(d * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * f * t) * np.minimum(t / 0.005, 1) * np.exp(-t / 0.08) * 0.5

def whoosh(d=0.45):
    w = noise_sweep(d, 600, 5000, 0.5, 1.0)
    e = np.sin(np.linspace(0, np.pi, len(w))) ** 1.5
    return np.stack([w * e, np.roll(w, 80) * e], 1)

def printer(d=0.75):
    n = int(d * SR); t = np.arange(n) / SR
    motor = signal.sawtooth(2 * np.pi * 118 * t) * (0.6 + 0.4 * np.sin(2 * np.pi * 31 * t))
    steps = (np.sin(2 * np.pi * 26 * t) > 0.95) * bp(rng.standard_normal(n), 2000, 6000)
    x = lp(motor, 1800) * 0.35 + steps * 0.25 + bp(rng.standard_normal(n), 800, 3000) * 0.05
    return x * np.minimum(t / 0.03, 1) * np.minimum((d - t) / 0.05, 1)

def chime():
    out = np.zeros(int(2.2 * SR))
    for k, m in enumerate([84, 88, 91, 96]):
        b = bell(m, 0.8, 2.0)
        i = int(k * 0.07 * SR)
        out[i:i + len(b)] += b[: len(out) - i]
    return out

S = cues
for t in S['shutter']:
    sfx.add(shutter(), t, 0.7 if t > 0 else 0.6)
sfx.add(flash_pop(), S['flash'][0] - 0.25, 0.6)
for t in S['countdown']:
    sfx.add(beep(880), t, 0.22)
for t in S['taps']:
    sfx.add(tick(), t, 0.22, 0.1)
for t in S['whoosh']:
    sfx.add(whoosh(0.42), t - 0.24, 0.13)
for t in S['printer']:
    sfx.add(printer(0.72), t + 0.02, 0.32)
for t in S['chime']:
    sfx.add(reverb(np.stack([chime()] * 2, 1), 1.6, 0.4), t, 0.5)
for t in S['scan']:
    sfx.add(beep(1568, 0.09), t, 0.25)
    sfx.add(beep(2093, 0.09), t + 0.08, 0.2)

# ------------------------------------------------------------------ sidechain + bus processing
def pump(depth=0.55, rel=0.22):
    g = np.ones(N)
    for t in kicks:
        i = int(t * SR)
        if 0 <= i < N:
            n = min(int(0.45 * SR), N - i)
            tt = np.arange(n) / SR
            g[i:i + n] = np.minimum(g[i:i + n], 1 - depth * np.exp(-tt / rel * 2.2))
    return g[:, None]

pm = pump()
drums.x = hp(drums.x, 30)
drums.x = drums.x * 0.9 + reverb(drums.x * 0.25, 0.9, 0.3, 0.01, 7000)
bass.x = lp(bass.x, 2500) * pump(0.7, 0.2)
keys.x = reverb(hp(keys.x, 90), 2.2, 0.35) * pump(0.35)
pads.x = reverb(hp(pads.x, 120), 3.0, 0.4) * pump(0.5)
plucks.x = reverb(hp(plucks.x, 250), 1.8, 0.35) * pump(0.3)
# stereo delay on plucks (dotted 8th)
dly = int(BEAT * 0.75 * SR)
pl = plucks.x.copy(); pl[dly:, 0] += plucks.x[:-dly, 1] * 0.3; pl[dly:, 1] += plucks.x[:-dly, 0] * 0.3; plucks.x = pl
fx.x = reverb(fx.x, 2.0, 0.25)
sfx.x = sfx.x + reverb(sfx.x, 1.0, 0.2) * 0.3

music = drums.x * 1.0 + bass.x * 1.1 + keys.x * 0.9 + pads.x * 0.8 + plucks.x * 0.8 + fx.x * 0.8

def comp(x, thr_db=-18, ratio=2.5, att=0.01, rel=0.15, makeup=3):
    lvl = np.sqrt(signal.lfilter([1 - np.exp(-1 / (0.02 * SR))], [1, -np.exp(-1 / (0.02 * SR))], np.mean(x ** 2, 1)))
    db = 20 * np.log10(lvl + 1e-9)
    over = np.maximum(db - thr_db, 0)
    gr = -over * (1 - 1 / ratio)
    # smooth gain reduction
    a_a, a_r = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR))
    g = np.zeros_like(gr); prev = 0.0
    for i in range(0, len(gr), 64):
        target = gr[i]
        coef = a_a ** 64 if target < prev else a_r ** 64
        prev = coef * prev + (1 - coef) * target
        g[i:i + 64] = prev
    return x * (10 ** ((g + makeup) / 20))[:, None]

music = comp(music, -16, 2.2, 0.01, 0.2, 2)
music /= np.max(np.abs(music)) + 1e-9
music *= 0.7

# ------------------------------------------------------------------ voice-over: HPF 80 Hz, de-ess, light compression, normalise
tmp = os.path.join(ROOT, 'audio', 'build'); os.makedirs(tmp, exist_ok=True)
vo_wav = os.path.join(tmp, 'vo_proc.wav')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(ROOT, 'public', 'audio', 'vo.mp3'), '-af',
                'highpass=f=80,deesser=i=0.35:m=0.5:f=0.5,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120:makeup=2,loudnorm=I=-16:TP=-2:LRA=9,aresample=48000',
                '-ac', '1', '-ar', str(SR), vo_wav], check=True)
from scipy.io import wavfile
_, vo = wavfile.read(vo_wav)
vo = vo.astype(np.float64) / 32768.0
vo = np.pad(vo, (0, max(0, N - len(vo))))[:N]

# music ducked under speech (DUCK_DB, default 5 dB) (sidechain by the VO envelope, fast attack, smooth release)
envr = np.abs(vo)
envr = signal.lfilter([1 - np.exp(-1 / (0.015 * SR))], [1, -np.exp(-1 / (0.015 * SR))], envr)
speech = np.clip((20 * np.log10(envr + 1e-9) + 42) / 12, 0, 1)   # 0 below -42 dBFS, 1 above -30
hold = signal.lfilter([1 - np.exp(-1 / (0.30 * SR))], [1, -np.exp(-1 / (0.30 * SR))], speech)
duck = np.maximum(speech, hold)
duck = signal.lfilter([1 - np.exp(-1 / (0.05 * SR))], [1, -np.exp(-1 / (0.05 * SR))], duck)
# Levels (dB, tweak without editing code): MUSIC_DB = music level (0 = default), DUCK_DB = how far music dips under the voice,
# SFX_DB = sound effects level. e.g. on Windows:  set MUSIC_DB=3   then render again with --no-capture
MUSIC_DB = float(os.environ.get('MUSIC_DB', '0'))
DUCK_DB = float(os.environ.get('DUCK_DB', '5'))
SFX_DB = float(os.environ.get('SFX_DB', '0'))
gain_music = 10 ** (-DUCK_DB * np.clip(duck, 0, 1) / 20)
gain_sfx = 10 ** (-2.0 * np.clip(duck, 0, 1) / 20)
music_level = 1.05 * 10 ** (MUSIC_DB / 20)   # was 0.55 with a 9 dB duck: the music disappeared under the voice
sfx_level = 1.25 * 10 ** (SFX_DB / 20)

mix = music * gain_music[:, None] * music_level + sfx.x * gain_sfx[:, None] * sfx_level + np.stack([vo, vo], 1) * 1.0
mix = hp(mix, 25)
# gentle final fades
fade = int(0.01 * SR); mix[:fade] *= np.linspace(0, 1, fade)[:, None]
fo = int(0.02 * SR); mix[-fo:] *= np.linspace(1, 0.6, fo)[:, None]
pre = os.path.join(tmp, 'premaster.wav')
wavfile.write(pre, SR, (np.clip(mix / max(1.0, np.max(np.abs(mix))), -1, 1) * 32767).astype(np.int16))
wavfile.write(os.path.join(tmp, 'music.wav'), SR, (np.clip(music, -1, 1) * 32767).astype(np.int16))
wavfile.write(os.path.join(tmp, 'sfx.wav'), SR, (np.clip(sfx.x / max(1, np.max(np.abs(sfx.x))), -1, 1) * 32767).astype(np.int16))

# ------------------------------------------------------------------ master: two-pass loudnorm to -14 LUFS, TP <= -1.5 dBTP
out = os.path.join(ROOT, 'public', 'audio', 'mix.wav')
r = subprocess.run(['ffmpeg', '-hide_banner', '-i', pre, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True)
js = r.stderr[r.stderr.rindex('{'):r.stderr.rindex('}') + 1]
m = json.loads(js)
af = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
      f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,alimiter=limit=0.84:level=false,aresample=48000")
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', pre, '-af', af, '-ar', str(SR), '-c:a', 'pcm_s24le', out], check=True)
print('wrote', out, 'measured input', m['input_i'], 'LUFS')
