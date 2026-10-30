// 0 - 13.6 s: the nostalgic opening, "now it lives in your pocket", logo reveal.
import { Easing, Img, interpolate, staticFile } from 'remotion';
import { HIT, S, w } from '../edit';
import { C, F } from '../theme';
import { Phone } from '../components/Devices';
import { AmberBg, Bokeh, clamp, DarkBg, EOUT, Fill, FilmImg, Flash, Grain, ramp, Rise, Sparks, SunBg, useFormat, useSpring, useT, Vignette, Wordmark } from '../components/kit';

/** "Remember the photobooth?" - a flash, then a printed strip drops in, turning slowly */
export function Open() {
  const t = useT();
  const { W, H, v } = useFormat();
  const drop = useSpring(0.12, { damping: 13, stiffness: 70 });
  const h = v ? 1080 : 820;
  return (
    <Fill>
      <DarkBg intensity={0.7} />
      <div style={{ position: 'absolute', inset: 0, perspective: 1600 }}>
        <div
          style={{
            position: 'absolute',
            left: W / 2 - (h * 0.335) / 2,
            top: (v ? H * 0.43 : H * 0.5) - h / 2,
            translate: `0 ${(1 - drop) * -H}px`,
            transform: `rotateZ(${-12 + t * 3}deg) rotateY(${-18 + t * 9}deg) rotateX(${6 - t * 2}deg)`,
          }}
        >
          <FilmImg name="strip-sunday" height={h} />
        </div>
      </div>
      <Vignette strength={0.6} />
      <Flash at={0} decay={0.55} />
    </Fill>
  );
}

/** "The tiny curtain..." - an illustrated booth with a swaying curtain and marquee bulbs */
export function Curtain() {
  const t = useT();
  const { W, H, v } = useFormat();
  const bw = v ? 760 : 620;
  const bh = v ? 1250 : 860;
  const x0 = W / 2 - bw / 2;
  const y0 = (v ? H * 0.42 : H * 0.53) - bh / 2;
  const sway = Math.sin(t * 3.1) * 1 + Math.sin(t * 1.7) * 0.6;
  const push = 1.04 + t * 0.03;
  return (
    <Fill style={{ background: '#1a0f12' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(70% 60% at 50% 45%, #5a2a1f 0%, #2a1416 55%, #120a0c 100%)' }} />
      <Bokeh seed={11} count={10} colors={['#ffcf8a', '#ff8a5c', '#ffffff']} alpha={0.2} />
      <div style={{ position: 'absolute', left: x0, top: y0, width: bw, height: bh, scale: String(push) }}>
        {/* booth body */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: 26, background: 'linear-gradient(180deg,#f4e6cf,#e3cfae)', boxShadow: '0 50px 90px rgba(0,0,0,.55)' }} />
        {/* marquee */}
        <div style={{ position: 'absolute', left: bw * 0.08, right: bw * 0.08, top: bh * 0.035, height: bh * 0.12, borderRadius: 18, background: '#2a1416', display: 'grid', placeItems: 'center' }}>
          <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: bh * 0.06, letterSpacing: '0.2em', color: '#ffd9a0', textShadow: '0 0 18px rgba(255,190,90,.9)' }}>PHOTOS</span>
          {Array.from({ length: 14 }, (_, i) => {
            const on = (Math.floor(t * 8) + i) % 3 !== 0;
            const px = (i / 13) * 0.92 + 0.04;
            return <div key={i} style={{ position: 'absolute', left: `${px * 100}%`, top: i % 2 ? '86%' : '6%', width: 12, height: 12, borderRadius: 9, background: on ? '#ffe2a8' : '#7a5a3a', boxShadow: on ? '0 0 14px 4px rgba(255,200,120,.75)' : 'none' }} />;
          })}
        </div>
        {/* curtain opening */}
        <div style={{ position: 'absolute', left: bw * 0.1, right: bw * 0.1, top: bh * 0.2, bottom: bh * 0.07, borderRadius: 14, background: '#0d0708', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(60% 50% at 50% 40%, rgba(255,230,190,.35), transparent 70%)' }} />
          {[0, 1].map((side) => (
            <div
              key={side}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                [side ? 'right' : 'left']: 0,
                width: `${56 - sway * 2}%`,
                background: 'repeating-linear-gradient(90deg, #b3202f 0px, #d63a45 26px, #8e1622 52px, #c42b38 78px)',
                transformOrigin: 'top center',
                transform: `skewX(${(side ? -1 : 1) * sway * 1.6}deg)`,
                boxShadow: 'inset 0 -60px 80px rgba(0,0,0,.35), inset 0 30px 40px rgba(0,0,0,.35)',
                borderRadius: side ? '0 0 0 30px' : '0 0 30px 0',
              }}
            />
          ))}
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 26, background: 'linear-gradient(#5c3a20,#3a2412)' }} />
        </div>
        {/* print slot */}
        <div style={{ position: 'absolute', right: -bw * 0.02, top: bh * 0.55, width: bw * 0.05, height: bh * 0.16, borderRadius: 8, background: '#2a1416' }} />
      </div>
      <Grain opacity={0.1} />
      <Vignette strength={0.7} />
    </Fill>
  );
}

/** "the flash..." - a flash bulb pop that develops a photo */
export function FlashScene() {
  const t = useT();
  const { W, H, v } = useFormat();
  const at = HIT.flash - S.flash;
  const dev = ramp(t, at + 0.05, at + 1.1, Easing.out(Easing.quad));
  const size = v ? 820 : 600;
  return (
    <Fill style={{ background: '#0b0a0e' }}>
      <div style={{ position: 'absolute', left: W / 2 - size / 2, top: (v ? H * 0.42 : H * 0.5) - size * 0.62, width: size, padding: size * 0.05, paddingBottom: size * 0.2, background: '#f6f1e8', boxShadow: '0 40px 80px rgba(0,0,0,.6)', rotate: `${-3 + t * 1.2}deg`, scale: String(0.94 + t * 0.03), opacity: ramp(t, at - 0.02, at + 0.05) }}>
        <Img src={staticFile('photos/photo-6.jpg')} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block', filter: `brightness(${2.6 - dev * 1.6}) contrast(${0.5 + dev * 0.55}) saturate(${0.2 + dev * 0.75}) sepia(${0.25 * (1 - dev)})` }} />
      </div>
      {/* bulb flare */}
      <div style={{ position: 'absolute', left: W / 2 - 700, top: H * 0.4 - 700, width: 1400, height: 1400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,.95) 0%, rgba(255,240,210,.5) 12%, transparent 45%)', opacity: interpolate(t, [at - 0.03, at, at + 0.7], [0, 1, 0], clamp), scale: String(0.6 + ramp(t, at, at + 0.7) * 0.8) }} />
      <Flash at={at} decay={0.5} max={0.95} />
      <Grain opacity={0.1} />
      <Vignette />
    </Fill>
  );
}

/** "the strip you kept for YEARS" - old strips pinned to a wall */
export function Wall() {
  const t = useT();
  const { W, H, v } = useFormat();
  const s = v ? 1 : 0.8;
  const items = [
    { n: 'strip-golden', x: -0.3, y: -0.06, r: -7, h: 900, d: 0.0 },
    { n: 'strip-vintage', x: 0.0, y: 0.03, r: 3, h: 960, d: 0.18 },
    { n: 'strip-noir', x: 0.3, y: -0.04, r: 8, h: 880, d: 0.32 },
  ];
  return (
    <Fill style={{ background: '#e9dccb' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(80% 70% at 45% 35%, #f5ebdd 0%, #dccab3 70%, #b9a38a 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, scale: String(1 + t * 0.045) }}>
        {items.map((it, i) => {
          const k = ramp(t, it.d, it.d + 0.5);
          return (
            <div key={it.n} style={{ position: 'absolute', left: W / 2 + it.x * (v ? W * 1.05 : W * 0.55) - it.h * s * 0.168, top: (v ? H * 0.42 : H * 0.5) + it.y * H - (it.h * s) / 2, rotate: `${it.r + (1 - k) * 6}deg`, opacity: k, translate: `0 ${(1 - k) * 40}px` }}>
              <FilmImg name={it.n} height={it.h * s} sepia={0.45} style={{ boxShadow: '0 18px 30px rgba(60,40,20,.35)' }} />
              <div style={{ position: 'absolute', left: '50%', top: -26, width: 150 * s, height: 52 * s, marginLeft: -75 * s, rotate: `${i % 2 ? 4 : -5}deg`, background: i === 1 ? 'rgba(198,244,50,.6)' : 'rgba(255,176,32,.55)', boxShadow: '0 2px 4px rgba(0,0,0,.12)' }} />
            </div>
          );
        })}
      </div>
      <Grain opacity={0.14} />
      <Vignette strength={0.45} />
    </Fill>
  );
}

/** "Now... it lives in your pocket." - the strip flies into a phone; the beat drops on "pocket" */
export function Pocket() {
  const t = useT();
  const { W, H, v } = useFormat();
  const drop = HIT.drop - S.pocket;
  const rise = useSpring(0.05, { damping: 15, stiffness: 90 });
  const land = useSpring(drop, { damping: 9, stiffness: 180 });
  const pw = v ? 560 : 400;
  const ph = pw * 0.94 * (844 / 390) + pw * 0.06;
  const cx = W / 2;
  const cy = v ? H * 0.43 : H * 0.53;
  // strip shrinks from huge into the screen just before the drop
  const into = ramp(t, drop - 0.75, drop, Easing.in(Easing.cubic));
  const stripH = interpolate(into, [0, 1], [v ? 1500 : 1000, ph * 0.5]);
  return (
    <Fill>
      <AmberBg />
      <div style={{ position: 'absolute', inset: 0, perspective: 1800 }}>
        <div
          style={{
            position: 'absolute',
            left: cx - pw / 2,
            top: cy - ph / 2,
            translate: `0 ${(1 - rise) * H * 0.8}px`,
            transform: `rotateY(${-14 + t * 5}deg) rotateX(${8 - t * 2}deg) rotateZ(${-4 + land * 4}deg) scale(${1 + (land - (t > drop ? 1 : 0)) * 0.04})`,
          }}
        >
          <Phone width={pw}>
            <Img src={staticFile('shots/phone-home.png')} style={{ width: 390, height: 844, opacity: ramp(t, drop - 0.1, drop + 0.15) }} />
          </Phone>
        </div>
      </div>
      {into < 1 && (
        <div style={{ position: 'absolute', left: cx - stripH * 0.168, top: cy - stripH / 2, rotate: `${-8 + into * 8}deg`, opacity: 1 - ramp(t, drop - 0.12, drop) }}>
          <FilmImg name="strip-sunday" height={stripH} />
        </div>
      )}
      <Sparks at={drop} x={cx} y={cy} spread={v ? 700 : 620} count={30} />
      <Flash at={drop} decay={0.3} max={0.7} />
    </Fill>
  );
}

/** Logo: "PortableBooth. The photobooth that goes where you go." */
export function Logo() {
  const t = useT();
  const { W, H, v } = useFormat();
  const mark = useSpring(0.05, { damping: 12, stiffness: 160 });
  const size = v ? 128 : 150;
  const tag = w('the', 5) - S.logo;
  return (
    <Fill>
      <SunBg />
      <div style={{ position: 'absolute', left: 0, right: 0, top: v ? H * 0.34 : H * 0.36, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: v ? 56 : 44 }}>
        <div style={{ scale: String(0.85 + mark * 0.15), opacity: mark, transform: v ? 'scale(0.82)' : undefined }}>
          <Wordmark size={size} reveal={mark} />
        </div>
        <div style={{ fontFamily: F.serif, fontStyle: 'italic', fontSize: v ? 86 : 84, color: C.text, textAlign: 'center', lineHeight: 1.08, maxWidth: v ? 860 : 1500, padding: '0 40px' }}>
          {['The', 'photobooth', 'that', 'goes'].map((x, i) => (
            <Rise key={i} at={tag + i * 0.16} style={{ marginRight: '0.24em' }}>{x}</Rise>
          ))}
          {v && <br />}
          {['where', 'you'].map((x, i) => (
            <Rise key={x} at={tag + 0.75 + i * 0.12} style={{ marginRight: '0.24em' }}>{x}</Rise>
          ))}
          <Rise at={tag + 0.98} style={{ color: C.violet }}>go.</Rise>
        </div>
      </div>
      <Sparks at={0.02} x={W / 2} y={v ? H * 0.37 : H * 0.42} spread={v ? 520 : 760} count={26} seed={9} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: v ? H * 0.27 : H * 0.12, display: 'flex', justifyContent: 'center', opacity: ramp(t, tag + 1.4, tag + 1.9) }}>
        <div style={{ fontFamily: F.mono, fontSize: 26, letterSpacing: '0.16em', color: '#5c5868', textTransform: 'uppercase' }}>Strip · Instant · 35mm</div>
      </div>
    </Fill>
  );
}

export { EOUT };
