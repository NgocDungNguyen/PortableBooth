import { Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import timing from '../timing.json';
import { CAPTION_HIDE } from '../edit';
import { C, F } from '../theme';

type CW = { w: string; s: number; e: number };
type Cap = { text: string; start: number; end: number; words: CW[] };
type Group = Cap & { first: boolean; in: number; out: number; joinPrev: boolean; joinNext: boolean };

const EMPH = new Set(['years', 'tall', 'wide', 'yours', 'everything', 'never', '42', 'pocket', 'nearby']);
const FIRST_OF_LINE = new Set((timing.lines as { start: number }[]).map((l) => l.start));
const hidden = (t: number) => CAPTION_HIDE.some(([a, b]) => t >= a && t <= b);

const LEAD = 0.08; // a caption appears this long before its first word
const XFADE = 0.14; // handover between two captions
const HOLD_GAP = 0.7; // pauses shorter than this keep the caption on screen instead of blinking out
const FADE_OUT = 0.22;

/**
 * Caption groups built once from the word timing:
 * - very short neighbours are merged (no text flipping every half second)
 * - each group knows when it is on screen and whether it hands over directly to the next one
 */
const GROUPS: Group[] = (() => {
  const src = (timing.captions as Cap[]).filter((c) => !hidden(c.start + 0.01));
  const merged: Cap[] = [];
  for (const c of src) {
    const p = merged[merged.length - 1];
    const gap = p ? c.start - p.end : 1e9;
    const short = p && (p.end - p.start < 0.75 || c.end - c.start < 0.6);
    const words = p ? p.words.length + c.words.length : 0;
    const chars = p ? (p.text + ' ' + c.text).length : 0;
    const sameBlock = p && !CAPTION_HIDE.some(([a, b]) => a > p.end && a < c.start && b > a);
    if (p && sameBlock && short && gap < 0.22 && words <= 6 && chars <= 30) {
      merged[merged.length - 1] = { text: `${p.text} ${c.text}`, start: p.start, end: c.end, words: [...p.words, ...c.words] };
    } else merged.push({ ...c, words: [...c.words] });
  }
  const g: Group[] = merged.map((c) => ({ ...c, first: FIRST_OF_LINE.has(c.start), in: c.start - LEAD, out: c.end + 0.45, joinPrev: false, joinNext: false }));
  for (let i = 0; i < g.length - 1; i++) {
    const a = g[i];
    const b = g[i + 1];
    const blocked = CAPTION_HIDE.some(([x, y]) => x >= a.end && x < b.start && y > x);
    if (!blocked && b.start - a.end < HOLD_GAP) {
      a.out = b.in + XFADE; // overlap by the crossfade
      a.joinNext = true;
      b.joinPrev = true;
    }
  }
  return g;
})();

function Pill({ g, t, vertical, width, height }: { g: Group; t: number; vertical: boolean; width: number; height: number }) {
  const size = vertical ? 74 : 62;
  const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
  const half = XFADE / 2;
  // Handover between two captions: the boxes crossfade over the whole window (so the box seems to reshape),
  // while the words take turns: old words leave in the first half, new words arrive in the second. Text never overlaps.
  let box = 1;
  let text = 1;
  if (g.joinPrev) {
    box = Math.min(box, interpolate(t, [g.in, g.in + XFADE], [0, 1], clamp));
    text = Math.min(text, interpolate(t, [g.in + half, g.in + XFADE], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) }));
  } else {
    const k = interpolate(t, [g.in, g.in + 0.2], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
    box = Math.min(box, k);
    text = Math.min(text, k);
  }
  if (g.joinNext) {
    box = Math.min(box, interpolate(t, [g.out - XFADE, g.out], [1, 0], clamp));
    text = Math.min(text, interpolate(t, [g.out - XFADE, g.out - half], [1, 0], { ...clamp, easing: Easing.in(Easing.quad) }));
  } else {
    const k = interpolate(t, [g.out - FADE_OUT, g.out], [1, 0], clamp);
    box = Math.min(box, k);
    text = Math.min(text, k);
  }
  if (box <= 0.001) return null;
  const rise = g.joinPrev ? (1 - text) * size * 0.08 : (1 - box) * size * 0.25;
  const words = g.words.map((x, k) => {
    let label = x.w;
    if (k === 0 && g.first) label = label.charAt(0).toUpperCase() + label.slice(1);
    if (label === 'photobooth' && g.text.startsWith('remember')) label = 'photobooth?';
    return { ...x, label };
  });
  // 9:16 keeps text out of the bottom 20% and the right 12% (TikTok / Reels UI).
  const area = vertical ? { left: 64, width: width * 0.88 - 64 - 40, bottom: height * 0.2 + 70 } : { left: width * 0.1, width: width * 0.8, bottom: height * 0.075 };
  return (
    <div style={{ position: 'absolute', left: area.left, width: area.width, bottom: area.bottom, display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          columnGap: size * 0.26,
          rowGap: size * 0.02,
          padding: `${size * 0.16}px ${size * 0.38}px ${size * 0.22}px`,
          borderRadius: size * 0.38,
          background: `rgba(13,12,18,${0.82 * box})`,
          boxShadow: `0 12px 40px rgba(0,0,0,${0.25 * box})`,
          maxWidth: area.width,
        }}
      >
        {words.map((x, k) => {
          // karaoke: spoken words light up; upcoming ones stay readable (no flicker from near-invisible text)
          const a = interpolate(t, [x.s - 0.05, x.s + 0.1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const emph = EMPH.has(x.w.toLowerCase());
          return (
            <span key={k} style={{ fontFamily: F.display, fontWeight: 760, fontSize: size, lineHeight: 1.12, letterSpacing: '-0.02em', color: emph ? C.amber : C.white, opacity: text * (0.55 + a * 0.45), display: 'inline-block', translate: `0 ${rise}px` }}>
              {x.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Burned-in captions locked to the VO, with smooth handovers and inside the platform safe area. */
export function Captions() {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = frame / 30;
  // at most two groups are on screen: the outgoing one and the incoming one during a crossfade
  const live = GROUPS.filter((g) => t >= g.in && t < g.out).slice(-2);
  if (!live.length) return null;
  return (
    <>
      {live.map((g) => (
        <Pill key={g.start} g={g} t={t} vertical={height > width} width={width} height={height} />
      ))}
    </>
  );
}

/** the same groups, for the .srt file */
export const CAPTION_GROUPS = GROUPS.map(({ text, start, end, first }) => ({ text, start, end, first }));
