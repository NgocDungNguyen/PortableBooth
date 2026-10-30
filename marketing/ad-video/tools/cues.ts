// Writes audio/cues.json: every timed sound-design event, derived from the edit (scene cuts, taps in the app clips, hits).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tapsIn } from '../src/clips';
import { DURATION, HIT, S, SEG, w } from '../src/edit';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const taps = Object.entries(SEG)
  .filter(([k]) => k !== 'sameDesk')
  .flatMap(([, s]) => tapsIn(s));
const cuts = [S.curtain, S.pocket, S.film, S.pose, S.upload, S.yours, S.looks, S.everything, S.same, S.done, S.print, S.send, S.p2p, S.moments];
const cues = {
  duration: DURATION,
  grid: { origin: HIT.drop, bpm: 120 },
  shutter: [0.0, HIT.snap, DURATION - 0.05],
  flash: [HIT.flash, HIT.drop],
  countdown: [HIT.three, HIT.two, HIT.one],
  taps: taps.sort((a, b) => a - b),
  whoosh: cuts,
  printer: [S.print],
  chime: [HIT.lands],
  scan: [w('code') + 0.05],
  hit: { drop: HIT.drop, snap: HIT.snap, logo: HIT.logo },
  sections: {
    pocket: S.pocket,
    pose: S.pose,
    care: S.care,
    done: S.done,
    lands: w('and', 3) - 0.25,
    moments: S.moments,
    end: S.end,
    yours: S.yours,
    everything: S.everything,
  },
};
fs.writeFileSync(path.join(root, 'audio', 'cues.json'), JSON.stringify(cues, null, 1));
console.log('cues:', cues.taps.length, 'taps;', JSON.stringify(cues.sections));
