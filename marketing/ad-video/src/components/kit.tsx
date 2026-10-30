// Small motion-graphics kit: backgrounds, bokeh, masked text reveals, flashes, films, sparks.
import type { CSSProperties, ReactNode } from 'react';
import { Easing, Img, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, F } from '../theme';

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
export const EOUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EIO = Easing.bezier(0.65, 0, 0.35, 1);

export function useT() {
  return useCurrentFrame() / 30;
}
export function useFormat() {
  const { width, height } = useVideoConfig();
  return { W: width, H: height, v: height > width };
}
/** spring 0..1 starting at `at` seconds (scene-relative) */
export function useSpring(at: number, config: { damping?: number; stiffness?: number; mass?: number } = {}) {
  const frame = useCurrentFrame();
  return spring({ frame: frame - Math.round(at * 30), fps: 30, config: { damping: 16, stiffness: 140, mass: 1, ...config } });
}
export const ramp = (t: number, a: number, b: number, ease = EOUT) => interpolate(t, [a, b], [0, 1], { ...clamp, easing: ease });

export function Fill({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  return <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...style }}>{children}</div>;
}

/** dark studio background with an amber glow and drifting out-of-focus lights */
export function DarkBg({ glow = C.amber, seed = 1, intensity = 1 }: { glow?: string; seed?: number; intensity?: number }) {
  const t = useT();
  const { W, H } = useFormat();
  return (
    <Fill style={{ background: C.ink }}>
      <div style={{ position: 'absolute', left: W * 0.5 - H * 0.6 + Math.sin(t * 0.4) * 40, top: H * 0.3 - H * 0.6, width: H * 1.2, height: H * 1.2, borderRadius: '50%', background: `radial-gradient(circle, ${glow}55 0%, ${glow}18 35%, transparent 65%)`, opacity: intensity }} />
      <div style={{ position: 'absolute', left: -W * 0.2, top: H * 0.55, width: W * 0.9, height: W * 0.9, borderRadius: '50%', background: `radial-gradient(circle, ${C.violet}33, transparent 60%)`, opacity: intensity }} />
      <Bokeh seed={seed} count={14} colors={[glow, '#ffffff', C.violet]} alpha={0.22 * intensity} />
      <Grain />
    </Fill>
  );
}

/** light "Sunlit" background with soft violet / lime / coral blooms */
export function SunBg({ seed = 2 }: { seed?: number }) {
  const t = useT();
  const { W, H } = useFormat();
  const m = Math.max(W, H);
  return (
    <Fill style={{ background: C.paper }}>
      <div style={{ position: 'absolute', left: W * 0.62 - m * 0.4 + Math.sin(t * 0.3) * 30, top: -m * 0.25, width: m * 0.8, height: m * 0.8, borderRadius: '50%', background: `radial-gradient(circle, ${C.violet}40, transparent 62%)` }} />
      <div style={{ position: 'absolute', left: -m * 0.25, top: H * 0.5 + Math.cos(t * 0.25) * 30, width: m * 0.7, height: m * 0.7, borderRadius: '50%', background: `radial-gradient(circle, ${C.coral}30, transparent 60%)` }} />
      <div style={{ position: 'absolute', left: W * 0.55, top: H * 0.7, width: m * 0.5, height: m * 0.5, borderRadius: '50%', background: `radial-gradient(circle, ${C.lime}45, transparent 60%)` }} />
      <Bokeh seed={seed} count={10} colors={[C.violet, C.coral, C.amber]} alpha={0.12} />
      <Grain opacity={0.05} />
    </Fill>
  );
}

export function AmberBg() {
  const t = useT();
  const { W, H } = useFormat();
  return (
    <Fill style={{ background: `radial-gradient(120% 90% at 50% ${40 + Math.sin(t) * 4}%, #ffd27a 0%, ${C.amber} 38%, #f07a1a 78%, #c4440f 100%)` }}>
      <Bokeh seed={5} count={12} colors={['#fff4d6', '#ffffff', C.coral]} alpha={0.28} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: H * 0.4, background: 'linear-gradient(transparent, rgba(120,40,0,.25))' }} />
      <Grain opacity={0.06} />
      {W < 0 && null}
    </Fill>
  );
}

/** depth-of-field background lights */
export function Bokeh({ seed, count, colors, alpha }: { seed: number; count: number; colors: string[]; alpha: number }) {
  const t = useT();
  const { W, H } = useFormat();
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const r = (k: number) => random(`b${seed}-${i}-${k}`);
        const size = 60 + r(1) * 260;
        const x = r(2) * W + Math.sin(t * (0.2 + r(3) * 0.3) + i) * 40;
        const y = r(4) * H + Math.cos(t * (0.15 + r(5) * 0.25) + i) * 50;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x - size / 2,
              top: y - size / 2,
              width: size,
              height: size,
              borderRadius: '50%',
              background: colors[i % colors.length],
              opacity: alpha * (0.4 + r(6) * 0.6),
              filter: `blur(${8 + r(7) * 22}px)`,
            }}
          />
        );
      })}
    </>
  );
}

/** film grain (static SVG noise, shifted every frame) */
export function Grain({ opacity = 0.07 }: { opacity?: number }) {
  const frame = useCurrentFrame();
  const x = (frame * 37) % 200;
  const y = (frame * 71) % 200;
  return (
    <div
      style={{
        position: 'absolute',
        inset: -200,
        opacity,
        mixBlendMode: 'overlay',
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.2 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`,
        translate: `${x}px ${y}px`,
        pointerEvents: 'none',
      }}
    />
  );
}

export function Vignette({ strength = 0.55 }: { strength?: number }) {
  return <Fill style={{ background: `radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,${strength}) 100%)`, pointerEvents: 'none' }} />;
}

/** white flash that peaks at `at` (s, scene-relative) */
export function Flash({ at, attack = 0.03, decay = 0.45, max = 1, color = '#fff' }: { at: number; attack?: number; decay?: number; max?: number; color?: string }) {
  const t = useT();
  const o = t < at ? interpolate(t, [at - attack, at], [0, max], clamp) : interpolate(t, [at, at + decay], [max, 0], { ...clamp, easing: Easing.out(Easing.quad) });
  if (o <= 0) return null;
  return <Fill style={{ background: color, opacity: o, pointerEvents: 'none' }} />;
}

/** a line of text revealed upward out of its own baseline mask */
export function Rise({ at, children, style, dur = 0.55, dy = 1.1 }: { at: number; children: ReactNode; style?: CSSProperties; dur?: number; dy?: number }) {
  const t = useT();
  const k = ramp(t, at, at + dur);
  return (
    <span style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom', paddingBottom: '0.08em', marginBottom: '-0.08em', ...style }}>
      <span style={{ display: 'inline-block', translate: `0 ${(1 - k) * dy * 100}%`, opacity: k > 0 ? 1 : 0 }}>{children}</span>
    </span>
  );
}

export function FilmImg({ name, height, width, style, sepia = 0 }: { name: string; height?: number; width?: number; style?: CSSProperties; sepia?: number }) {
  return (
    <Img
      src={staticFile(`films/${name}.png`)}
      style={{
        height,
        width,
        display: 'block',
        boxShadow: '0 30px 60px rgba(10,8,20,.35), 0 6px 14px rgba(10,8,20,.25)',
        filter: sepia ? `sepia(${sepia}) contrast(0.92) brightness(1.03)` : undefined,
        ...style,
      }}
    />
  );
}

/** colour sparks bursting from a point at `at` */
export function Sparks({ at, x, y, count = 22, spread = 520, seed = 3 }: { at: number; x: number; y: number; count?: number; spread?: number; seed?: number }) {
  const t = useT();
  const k = (t - at) / 0.9;
  if (k < 0 || k > 1) return null;
  const cols = [C.lime, C.coral, C.violet, C.amber, '#ffffff'];
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const a = random(`s${seed}${i}`) * Math.PI * 2;
        const d = spread * (0.35 + random(`d${seed}${i}`) * 0.65) * Easing.out(Easing.cubic)(k);
        const sz = 10 + random(`z${seed}${i}`) * 22;
        const shape = i % 3;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x + Math.cos(a) * d - sz / 2,
              top: y + Math.sin(a) * d - sz / 2 + k * k * 120,
              width: sz,
              height: shape === 2 ? sz * 0.35 : sz,
              borderRadius: shape === 0 ? '50%' : 3,
              background: cols[i % cols.length],
              opacity: 1 - k,
              rotate: `${a * 57 + k * 200}deg`,
            }}
          />
        );
      })}
    </>
  );
}

/** small mono label chip, e.g. "LOOKS" */
export function Tag({ children, style, dark = true }: { children: ReactNode; style?: CSSProperties; dark?: boolean }) {
  return (
    <div
      style={{
        fontFamily: F.mono,
        fontWeight: 600,
        fontSize: 26,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        padding: '10px 18px',
        borderRadius: 999,
        color: dark ? C.paper : C.text,
        background: dark ? 'rgba(255,255,255,.08)' : 'rgba(20,18,31,.06)',
        border: `1px solid ${dark ? 'rgba(255,255,255,.16)' : 'rgba(20,18,31,.12)'}`,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** the app's wordmark: rounded tile with a camera glyph + name */
export function Wordmark({ size, color = C.text, tile = C.violet, reveal = 1 }: { size: number; color?: string; tile?: string; reveal?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.28 }}>
      <div style={{ width: size * 1.05, height: size * 1.05, borderRadius: size * 0.28, background: tile, display: 'grid', placeItems: 'center', scale: String(0.6 + 0.4 * reveal), opacity: reveal }}>
        <CameraGlyph size={size * 0.56} color="#fff" />
      </div>
      <span style={{ fontFamily: F.display, fontWeight: 720, fontSize: size, letterSpacing: '-0.035em', color, lineHeight: 1 }}>PortableBooth</span>
    </div>
  );
}

export function CameraGlyph({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}
