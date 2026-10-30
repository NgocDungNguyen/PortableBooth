"""Word-level timing of the voice-over by forced alignment (pocketsphinx, bundled en-US model, offline).
Usage: python3 tools/align.py public/audio/vo.mp3  ->  src/timing.json  (lines, words, captions)
The transcript is tools/transcript.txt (spoken form of docs/marketing/ad-script.md)."""
import json, os, subprocess, sys
from pocketsphinx import Decoder

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
vo = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'public', 'audio', 'vo.mp3')
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', vo, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], capture_output=True, check=True).stdout
txt = open(os.path.join(ROOT, 'tools', 'transcript.txt')).read().split()
d = Decoder(bestpath=False)
d.add_word('photobooth', 'F OW T OW B UW TH', False)
d.add_word('resize', 'R IY S AY Z', False)
d.add_word('editable', 'EH D IH T AH B AH L', True)
d.set_align_text(' '.join(txt))
d.start_utt(); d.process_raw(raw, full_utt=True); d.end_utt()
words = [{'w': s.word.split('(')[0], 's': round(s.start_frame / 100, 2), 'e': round((s.end_frame + 1) / 100, 2)}
         for s in d.seg() if s.word not in ('<s>', '</s>', '<sil>', '(NULL)')]
assert len(words) == len(txt), (len(words), len(txt))

# Display words (what the captions show), one per spoken word ('' = merged into the previous one).
DISPLAY = {'iphone': 'iPhone', 'android': 'Android', 'three': '3', 'two': '2', 'one': '1', 'snap': 'SNAP!'}
MERGE = {'portable': 'PortableBooth', 'thirty': '35', 'forty': '42'}  # this word + the next one -> one caption word
# Lines of the script (word counts), with caption chunks (max ~4 words) as word counts per chunk.
LINES = [
  ('Remember the photobooth?', [3]),
  ('The tiny curtain… the flash… the strip you kept for YEARS.', [3, 2, 6]),
  ('Now… it lives in your pocket.', [6]),
  ('PortableBooth. The photobooth that goes where you go.', [2, 2, 5]),
  ('Start by picking your film — a classic strip, an instant card, or a roll of thirty-five mil.', [5, 3, 3, 7]),
  ('Keep it TALL for printing… or go WIDE for your feed.', [5, 6]),
  ('Then strike a pose. Three… two… one… SNAP!', [4, 1, 1, 1, 1]),
  ('Or drop in your favourite shots, straight from your camera roll.', [6, 5]),
  ('Now make it YOURS. Forty-two looks… frames… colours… stickers, text, and all the little details.', [4, 3, 1, 1, 1, 1, 5]),
  ('Drag it, resize it, crop it, tint it — EVERYTHING is editable.', [2, 2, 2, 2, 3]),
  ('Same booth on your phone. Same booth on your laptop.', [5, 5]),
  ("And here's the part we care about most.", [4, 4]),
  ('No account. No uploads. Your photos NEVER leave your device.', [2, 2, 3, 3]),
  ("When you're done… save it, print it, or send it to a friend nearby — phone to phone, iPhone or Android.", [3, 2, 2, 4, 3, 3, 3]),
  ('They scan the code… and your strip lands right on their screen.', [4, 4, 4]),
  ('Made for the moments worth keeping.', [3, 3]),
  ('PortableBooth. Free, right in your browser. Go make some memories.', [2, 5, 4]),
]
# exceptions where the chunk would split a word pair: 'thirty five' counts as 2 spoken words in the counts above
i = 0
lines, caps = [], []
for text, chunks in LINES:
    n = sum(chunks)
    ws = words[i:i + n]
    lines.append({'text': text, 'start': ws[0]['s'], 'end': ws[-1]['e'], 'words': ws})
    k = 0
    for c in chunks:
        cw = ws[k:k + c]
        out = []
        j = 0
        while j < len(cw):
            w = cw[j]
            if w['w'] in MERGE and j + 1 < len(cw):
                out.append({'w': MERGE[w['w']], 's': w['s'], 'e': cw[j + 1]['e']}); j += 2; continue
            out.append({'w': DISPLAY.get(w['w'], w['w']), 's': w['s'], 'e': w['e']}); j += 1
        caps.append({'text': ' '.join(o['w'] for o in out), 'start': cw[0]['s'], 'end': cw[-1]['e'], 'words': out})
        k += c
    i += n
assert i == len(words), (i, len(words))
dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', vo], capture_output=True, text=True).stdout)
json.dump({'source': os.path.basename(vo), 'duration': round(dur, 3), 'method': 'pocketsphinx forced alignment (en-US), 10 ms frames',
           'lines': lines, 'captions': caps}, open(os.path.join(ROOT, 'src', 'timing.json'), 'w'), indent=1)
print(len(lines), 'lines', len(caps), 'captions', 'duration', dur)
for c in caps: print(f"{c['start']:6.2f}-{c['end']:6.2f}  {c['text']}")
