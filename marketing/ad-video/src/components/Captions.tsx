import { Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import timing from '../timing.json';
import { CAPTION_HIDE } from '../edit';
import { C, F } from '../theme';

type CW = { w: string; s: number; e: number };
type Cap = { text: string; start: number; end: number; words: CW[] };
const CAPS = timing.captions as Cap[];
const EMPH = new Set(['years', 'tall', 'wide', 'yours', 'everything', 'never', '42', 'pocket', 'nearby']);
const FIRST_OF_LINE = new Set((timing.lines as { start: number }[]).map((l) => l.start));

const hidden = (t: number) => CAPTION_HIDE.some(([a, b]) => t >= a && t <= b);

/** Burned-in captions: max ~5 words, word-by-word reveal locked to the VO, inside the platform safe area. */
export function Captions() {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  const t = frame / 30;
  const i = CAPS.findIndex((c, k) => t >= c.start - 0.08 && t < Math.min(c.end + 0.45, CAPS[k + 1] ? CAPS[k + 1].start - 0.08 : 1e9));
  if (i < 0) return null;
  const cap = CAPS[i];
  if (hidden(cap.start + 0.01)) return null;
  const size = vertical ? 74 : 62;
  const out = interpolate(t, [cap.end + 0.3, cap.end + 0.45], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const words = cap.words.map((x, k) => {
    let label = x.w;
    if (k === 0 && FIRST_OF_LINE.has(cap.start)) label = label.charAt(0).toUpperCase() + label.slice(1);
    if (label === 'photobooth' && cap.text.startsWith('remember')) label = 'photobooth?';
    return { ...x, label };
  });
  // 9:16 keeps text out of the bottom 20% and the right 12% (TikTok / Reels UI).
  const box = vertical
    ? { left: 64, width: width * 0.88 - 64 - 40, bottom: height * 0.2 + 70 }
    : { left: width * 0.1, width: width * 0.8, bottom: height * 0.075 };
  return (
    <div style={{ position: 'absolute', left: box.left, width: box.width, bottom: box.bottom, display: 'flex', justifyContent: 'center', opacity: out }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          columnGap: size * 0.26,
          rowGap: size * 0.02,
          padding: `${size * 0.16}px ${size * 0.38}px ${size * 0.22}px`,
          borderRadius: size * 0.38,
          background: 'rgba(13,12,18,0.78)',
          backdropFilter: 'blur(14px)',
          boxShadow: '0 12px 40px rgba(0,0,0,.25)',
          maxWidth: box.width,
        }}
      >
        {words.map((x, k) => {
          const a = interpolate(t, [x.s - 0.06, x.s + 0.12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.2, 0.8, 0.2, 1) });
          const emph = EMPH.has(x.w.toLowerCase());
          return (
            <span
              key={k}
              style={{
                fontFamily: F.display,
                fontWeight: 760,
                fontSize: size,
                lineHeight: 1.12,
                letterSpacing: '-0.02em',
                color: emph ? C.amber : C.white,
                opacity: 0.28 + a * 0.72,
                translate: `0 ${(1 - a) * size * 0.14}px`,
                display: 'inline-block',
              }}
            >
              {x.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
