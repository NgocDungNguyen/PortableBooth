import { Video } from '@remotion/media';
import { interpolate, staticFile, useCurrentFrame } from 'remotion';
import { CLIPS, pointerAt, resolveSeg, type Seg } from '../clips';
import { C } from '../theme';

/** One recorded app segment at CSS size, with the scripted finger / cursor drawn on top. Place inside a <Sequence from={seg.at}>. */
export function ClipView({ seg, pointer = true }: { seg: Seg; pointer?: boolean }) {
  const frame = useCurrentFrame();
  const clip = CLIPS[seg.clip];
  const { from, rate } = resolveSeg(seg);
  const t = from + (frame / 30) * rate;
  const p = pointer ? pointerAt(clip, t) : null;
  const { width, height } = clip.css;
  return (
    <div style={{ position: 'relative', width, height, overflow: 'hidden', background: clip.mobile ? C.paper : C.ink }}>
      <Video
        src={staticFile(`cap/${clip.name}.mp4`)}
        trimBefore={Math.max(0, Math.round(from * 30))}
        playbackRate={rate}
        muted
        style={{ position: 'absolute', left: 0, top: 0, width, height }}
      />
      {p && (clip.mobile ? <Finger p={p} /> : <Cursor p={p} />)}
    </div>
  );
}

type P = NonNullable<ReturnType<typeof pointerAt>>;

function Ripple({ p, color, size }: { p: P; color: string; size: number }) {
  if (p.sinceDown > 0.6) return null;
  const k = p.sinceDown / 0.6;
  return (
    <div
      style={{
        position: 'absolute',
        left: p.x - size / 2,
        top: p.y - size / 2,
        width: size,
        height: size,
        borderRadius: 999,
        border: `2px solid ${color}`,
        opacity: (1 - k) * 0.9,
        scale: String(0.4 + k * 1.4),
      }}
    />
  );
}

function Finger({ p }: { p: P }) {
  const press = p.down ? 1 : Math.max(0, 1 - p.sinceDown / 0.18);
  const appear = interpolate(p.first, [0, 0.3], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <>
      <Ripple p={p} color="rgba(255,255,255,0.95)" size={64} />
      <div
        style={{
          position: 'absolute',
          left: p.x - 23,
          top: p.y - 23,
          width: 46,
          height: 46,
          borderRadius: 999,
          background: 'radial-gradient(circle at 40% 35%, rgba(255,255,255,.75), rgba(255,255,255,.42))',
          border: '1.5px solid rgba(255,255,255,.95)',
          boxShadow: '0 6px 18px rgba(20,18,31,.35), inset 0 0 0 1px rgba(20,18,31,.12)',
          scale: String(1 - press * 0.16),
          opacity: appear,
        }}
      />
    </>
  );
}

function Cursor({ p }: { p: P }) {
  const press = p.down ? 1 : Math.max(0, 1 - p.sinceDown / 0.18);
  return (
    <>
      <Ripple p={p} color={C.amber} size={54} />
      <svg width={30} height={30} viewBox="0 0 24 24" style={{ position: 'absolute', left: p.x - 5, top: p.y - 3, scale: String(1 - press * 0.12), filter: 'drop-shadow(0 3px 5px rgba(0,0,0,.45))' }}>
        <path d="M4 2.5 L4 19 L8.3 15 L11.2 21.3 L14 20 L11.2 13.9 L17 13.6 Z" fill="#fff" stroke="#111" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    </>
  );
}
