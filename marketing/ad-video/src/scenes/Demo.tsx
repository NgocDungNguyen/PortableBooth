// 13.6 - 47.8 s: the real app on a phone and a laptop.
import type { ReactNode } from 'react';
import { Easing, Img, interpolate, Sequence, staticFile } from 'remotion';
import { CLIPS, pointerAt, resolveSeg, type Seg } from '../clips';
import { HIT, S, SEG, w } from '../edit';
import { C, F, f } from '../theme';
import { ClipView } from '../components/ClipView';
import { Laptop, Phone } from '../components/Devices';
import { clamp, DarkBg, EOUT, Fill, FilmImg, Flash, ramp, Rise, Sparks, SunBg, Tag, useFormat, useSpring, useT } from '../components/kit';

/** a segment placed relative to the scene start */
function At({ seg, start, children }: { seg: Seg; start: number; children: ReactNode }) {
  return (
    <Sequence from={f(seg.at - start)} durationInFrames={Math.max(1, f(seg.dur))} layout="none">
      {children}
    </Sequence>
  );
}

function Float({ children, amp = 1, style }: { children: ReactNode; amp?: number; style?: React.CSSProperties }) {
  const t = useT();
  return <div style={{ transform: `rotateY(${Math.sin(t * 0.6) * 6 * amp - 4}deg) rotateX(${Math.cos(t * 0.5) * 3 * amp + 2}deg) translateY(${Math.sin(t * 1.1) * 8 * amp}px)`, ...style }}>{children}</div>;
}

/** Film tab on the phone: Strip, Instant, Film roll, Tall to Wide */
export function FilmDemo() {
  const t = useT();
  const { W, H, v } = useFormat();
  const enter = useSpring(0, { damping: 18, stiffness: 120 });
  const pw = v ? 500 : 410;
  const ph = pw * 0.94 * (844 / 390) + pw * 0.06;
  const L = (x: number) => x - S.film;
  const labels: [string, number, string][] = [
    ['Strip', L(w('strip', 2)), '2×6 in'],
    ['Instant', L(w('instant')), '54×86 mm'],
    ['35mm', L(w('roll')), 'film roll'],
    ['Tall', L(w('tall')), 'to print'],
    ['Wide', L(w('wide')), 'for your feed'],
  ];
  const cur = [...labels].reverse().find((l) => t >= l[1] - 0.05);
  return (
    <Fill>
      <SunBg seed={4} />
      <div style={{ position: 'absolute', inset: 0, perspective: 2000 }}>
        <div style={{ position: 'absolute', left: v ? W / 2 - pw / 2 : W * 0.33 - pw / 2, top: (v ? H * 0.385 : H * 0.5) - ph / 2, translate: `0 ${(1 - enter) * 300}px`, opacity: enter }}>
          <Float>
            <Phone width={pw}>
              <ClipView seg={{ ...SEG.film, at: 0 }} />
            </Phone>
          </Float>
        </div>
      </div>
      {!v && cur && (
        <div style={{ position: 'absolute', left: W * 0.55, top: H * 0.33, width: W * 0.4 }}>
          <Tag dark={false}>Pick your film</Tag>
          <div key={cur[0]} style={{ marginTop: 28, fontFamily: F.display, fontWeight: 760, fontSize: 168, letterSpacing: '-0.045em', color: C.text, lineHeight: 0.95 }}>
            <Rise at={cur[1] - 0.05} dur={0.4}>{cur[0]}</Rise>
          </div>
          <div style={{ marginTop: 16, fontFamily: F.serif, fontStyle: 'italic', fontSize: 64, color: C.violet }}>
            <Rise at={cur[1] + 0.05} dur={0.4}>{cur[2]}</Rise>
          </div>
        </div>
      )}
      {v && cur && (
        <div style={{ position: 'absolute', left: 64, top: 70, opacity: enter }}>
          <Tag dark={false}>
            {cur[0]} · {cur[2]}
          </Tag>
        </div>
      )}
    </Fill>
  );
}

/** "Then strike a pose. 3, 2, 1, SNAP!" - viewfinder built as motion graphics over a sample photo */
export function Pose() {
  const t = useT();
  const { W, H, v } = useFormat();
  const L = (x: number) => x - S.pose;
  const snap = L(HIT.snap);
  const enter = useSpring(0, { damping: 18, stiffness: 130 });
  const pw = v ? 540 : 420;
  const ph = pw * 0.94 * (844 / 390) + pw * 0.06;
  const nums: [string, number][] = [['3', L(HIT.three)], ['2', L(HIT.two)], ['1', L(HIT.one)]];
  const cur = [...nums].reverse().find((n) => t >= n[1] - 0.04 && t < snap - 0.02);
  const frozen = t >= snap;
  const shrink = ramp(t, snap + 0.25, snap + 0.7, Easing.inOut(Easing.cubic));
  const px = v ? W / 2 : W * 0.5;
  const py = v ? H * 0.4 : H * 0.5;
  return (
    <Fill>
      <DarkBg glow={C.coral} seed={6} />
      <div style={{ position: 'absolute', inset: 0, perspective: 2000 }}>
        <div style={{ position: 'absolute', left: px - pw / 2, top: py - ph / 2, opacity: enter, translate: `${(1 - enter) * 200}px 0` }}>
          <Float amp={0.6}>
            <Phone width={pw}>
              <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
                <Img
                  src={staticFile('photos/photo-0.jpg')}
                  style={{ position: 'absolute', left: -20, top: 90, width: 430, height: 560, objectFit: 'cover', scale: String(frozen ? 1.08 : 1.02 + t * 0.012), translate: frozen ? '0 0' : `${Math.sin(t * 2) * 4}px ${Math.cos(t * 1.6) * 3}px` }}
                />
                {/* viewfinder chrome */}
                <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 90, background: 'rgba(0,0,0,.85)' }} />
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 194, background: 'rgba(0,0,0,.9)', display: 'grid', placeItems: 'center' }}>
                  <div style={{ width: 78, height: 78, borderRadius: 99, border: '4px solid #fff', display: 'grid', placeItems: 'center' }}>
                    <div style={{ width: 62, height: 62, borderRadius: 99, background: frozen && t < snap + 0.2 ? C.amber : '#fff', scale: String(t > snap - 0.08 && t < snap + 0.12 ? 0.82 : 1) }} />
                  </div>
                  <div style={{ position: 'absolute', left: 40, top: 70, width: 50, height: 50, borderRadius: 10, overflow: 'hidden', border: '2px solid #fff', opacity: frozen ? 1 : 0 }}>
                    <Img src={staticFile('photos/photo-0.jpg')} style={{ width: 50, height: 50, objectFit: 'cover' }} />
                  </div>
                  <div style={{ position: 'absolute', right: 34, top: 82, fontFamily: F.mono, fontSize: 18, color: '#fff' }}>{frozen ? '2/4' : '1/4'}</div>
                </div>
                <div style={{ position: 'absolute', left: 0, right: 0, top: 100, textAlign: 'center', fontFamily: F.ui, fontWeight: 600, fontSize: 16, color: '#fff', opacity: 0.85 }}>Photo 1 of 4</div>
                {/* rule of thirds */}
                {[1, 2].map((k) => (
                  <div key={k}>
                    <div style={{ position: 'absolute', left: (390 * k) / 3, top: 90, width: 1, height: 560, background: 'rgba(255,255,255,.25)' }} />
                    <div style={{ position: 'absolute', top: 90 + (560 * k) / 3, left: 0, width: 390, height: 1, background: 'rgba(255,255,255,.25)' }} />
                  </div>
                ))}
                {cur && (
                  <div key={cur[0]} style={{ position: 'absolute', left: 0, right: 0, top: 230, textAlign: 'center', fontFamily: F.display, fontWeight: 800, fontSize: 200, color: '#fff', textShadow: '0 8px 30px rgba(0,0,0,.4)', scale: String(1.4 - ramp(t, cur[1] - 0.04, cur[1] + 0.25) * 0.4), opacity: interpolate(t, [cur[1] - 0.04, cur[1] + 0.05, cur[1] + 0.55, cur[1] + 0.7], [0, 1, 1, 0], clamp) }}>
                    {cur[0]}
                  </div>
                )}
              </div>
            </Phone>
          </Float>
        </div>
      </div>
      {/* giant kinetic countdown behind / beside the phone */}
      {cur && (
        <div key={'big' + cur[0]} style={{ position: 'absolute', left: v ? 0 : W * 0.06, right: v ? 0 : undefined, top: v ? H * 0.74 : H * 0.18, textAlign: v ? 'center' : 'left', fontFamily: F.display, fontWeight: 800, fontSize: v ? 220 : 520, lineHeight: 1, color: C.amber, opacity: interpolate(t, [cur[1] - 0.04, cur[1] + 0.04, cur[1] + 0.6, cur[1] + 0.72], [0, 1, 1, 0], clamp), scale: String(1.25 - ramp(t, cur[1] - 0.04, cur[1] + 0.3) * 0.25) }}>
          {cur[0]}
        </div>
      )}
      {!v && t < L(HIT.three) - 0.05 && (
        <div style={{ position: 'absolute', left: W * 0.06, top: H * 0.36, fontFamily: F.serif, fontStyle: 'italic', fontSize: 120, color: C.paper, lineHeight: 1 }}>
          <Rise at={L(w('strike')) - 0.05}>strike a</Rise>
          <br />
          <Rise at={L(w('pose')) - 0.05} style={{ color: C.amber }}>pose.</Rise>
        </div>
      )}
      {v && t < L(HIT.three) - 0.05 && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: H * 0.75, textAlign: 'center', fontFamily: F.serif, fontStyle: 'italic', fontSize: 110, color: C.paper, lineHeight: 1 }}>
          <Rise at={L(w('strike')) - 0.05}>strike a&nbsp;</Rise>
          <Rise at={L(w('pose')) - 0.05} style={{ color: C.amber }}>pose.</Rise>
        </div>
      )}
      {frozen && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: v ? H * 0.74 : H * 0.36, textAlign: v ? 'center' : 'right', paddingRight: v ? 0 : W * 0.07, fontFamily: F.display, fontWeight: 800, fontSize: v ? 210 : 230, letterSpacing: '-0.04em', color: C.paper, scale: String(1.3 - ramp(t, snap, snap + 0.25) * 0.3), opacity: ramp(t, snap, snap + 0.06) }}>
          SNAP!
        </div>
      )}
      {/* after the snap, the photos drop into a strip */}
      {frozen && (
        <div style={{ position: 'absolute', left: v ? W * 0.74 : W * 0.16, top: v ? H * 0.12 : H * 0.12, rotate: v ? '6deg' : '-6deg', translate: `0 ${(1 - ramp(t, snap + 0.15, snap + 0.6)) * -H * 0.6}px` }}>
          <FilmImg name="strip-sunday" height={v ? 620 : 760} />
        </div>
      )}
      <Sparks at={snap} x={px} y={py} spread={700} count={24} seed={12} />
      <Flash at={snap} decay={0.4} />
      {shrink > 2 && null}
    </Fill>
  );
}

/** "Or drop in your favourite shots" - photos dragged from a folder into the laptop */
export function Upload() {
  const t = useT();
  const { W, H, v } = useFormat();
  const seg = SEG.upload;
  const enter = useSpring(0, { damping: 18, stiffness: 110 });
  const lw = v ? 1500 : 1560;
  const lx = W / 2 - lw / 2 + (v ? 120 : 0);
  const ly = v ? H * 0.16 : H * 0.12;
  const { from, rate } = resolveSeg(seg);
  const ct = from + t * rate;
  const clip = CLIPS['desk-upload'];
  const carrying = ct >= clip.marks.drag - 0.05 && ct < clip.marks.drop + 0.5;
  const p = pointerAt(clip, ct);
  // laptop screen CSS px -> output px
  const lid = lw * 0.84;
  const sw = lid - lid * 0.022 * 2;
  const k = sw / 1440;
  const sx = lx + (lw - lid) / 2 + lid * 0.022;
  const sy = ly + lid * 0.022 + sw * (38 / 1440);
  const dropK = ramp(ct, clip.marks.drop + 0.2, clip.marks.drop + 0.6);
  const folder = { x: v ? W * 0.1 : W * 0.66, y: v ? H * 0.47 : H * 0.52 };
  return (
    <Fill>
      <DarkBg seed={7} />
      <div style={{ position: 'absolute', left: lx, top: ly, translate: `0 ${(1 - enter) * 200}px`, opacity: enter }}>
        <Laptop width={lw}>
          <ClipView seg={{ ...seg, at: 0 }} />
        </Laptop>
      </div>
      {/* a camera-roll folder window */}
      <div style={{ position: 'absolute', left: folder.x, top: folder.y, width: v ? 470 : 520, borderRadius: 22, background: 'rgba(32,30,40,.92)', border: '1px solid rgba(255,255,255,.12)', boxShadow: '0 30px 70px rgba(0,0,0,.5)', padding: 18, opacity: ramp(t, 0.05, 0.35) * (1 - ramp(t, 2.2, 2.6)), translate: `0 ${(1 - ramp(t, 0.05, 0.4)) * 60}px` }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => <div key={c} style={{ width: 12, height: 12, borderRadius: 9, background: c }} />)}
          <span style={{ marginLeft: 12, fontFamily: F.ui, fontSize: 22, fontWeight: 600, color: '#e8e5ef' }}>Camera roll</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Img key={i} src={staticFile(`photos/photo-${i}.jpg`)} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 10, outline: i < 4 ? `3px solid ${C.amber}` : 'none', opacity: carrying && i < 4 ? 0.35 : 1 }} />
          ))}
        </div>
      </div>
      {/* the dragged stack follows the cursor, then drops */}
      {p && carrying && (
        <div style={{ position: 'absolute', left: sx + p.x * k + 14, top: sy + p.y * k + 14, opacity: 1 - dropK, scale: String(1 - dropK * 0.5) }}>
          {[3, 2, 1, 0].map((i) => (
            <Img key={i} src={staticFile(`photos/photo-${i}.jpg`)} style={{ position: 'absolute', width: 120, height: 120, objectFit: 'cover', borderRadius: 12, border: '3px solid #fff', rotate: `${(i - 1.5) * 7}deg`, boxShadow: '0 10px 24px rgba(0,0,0,.45)' }} />
          ))}
          <div style={{ position: 'absolute', left: 92, top: -14, minWidth: 40, height: 40, borderRadius: 20, background: C.amber, color: C.ink, fontFamily: F.ui, fontWeight: 700, fontSize: 24, display: 'grid', placeItems: 'center' }}>4</div>
        </div>
      )}
    </Fill>
  );
}

/** "Now make it YOURS." */
export function Yours() {
  const t = useT();
  const { W, H, v } = useFormat();
  const looks = ['strip-sunday', 'strip-cherry', 'strip-noir', 'strip-golden', 'strip-vintage'];
  const L = (x: number) => x - S.yours;
  const i = Math.floor(Math.max(0, t) / 0.25) % looks.length;
  const sh = v ? 880 : 860;
  return (
    <Fill>
      <DarkBg glow={C.violet} seed={8} />
      <div style={{ position: 'absolute', left: (v ? W / 2 : W * 0.27) - sh * 0.168, top: (v ? H * 0.31 : H * 0.5) - sh / 2, rotate: `${-4 + t * 2}deg`, scale: String(0.96 + t * 0.03), opacity: 0.95 }}>
        <FilmImg name={looks[i]} height={sh} />
      </div>
      <div style={{ position: 'absolute', left: v ? 0 : W * 0.42, right: 0, top: v ? H * 0.57 : H * 0.27, textAlign: 'center' }}>
        <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: v ? 190 : 230, letterSpacing: '-0.05em', color: C.paper, lineHeight: 0.9, textShadow: '0 20px 60px rgba(0,0,0,.45)' }}>
          <Rise at={L(w('now', 2)) - 0.05}>Make it</Rise>
        </div>
        <div style={{ fontFamily: F.serif, fontStyle: 'italic', fontSize: v ? 260 : 300, color: C.amber, lineHeight: 0.95, textShadow: '0 20px 60px rgba(0,0,0,.45)' }}>
          <Rise at={L(w('yours')) - 0.06}>yours.</Rise>
        </div>
      </div>
    </Fill>
  );
}

type Shot = { key: keyof typeof SEG; label: string; focus: [number, number, number, number] };
// focus: [cx, cy, zoom 16:9, zoom 9:16] in desktop CSS px of the recorded 1440x900 screen
const SHOTS: Shot[] = [
  { key: 'looks', label: '42 looks', focus: [905, 470, 1.3, 1.0] },
  { key: 'frames', label: 'Frames', focus: [905, 470, 1.3, 1.0] },
  { key: 'colours', label: 'Colours', focus: [905, 520, 1.3, 1.0] },
  { key: 'stickers', label: 'Stickers', focus: [905, 470, 1.3, 1.0] },
  { key: 'text', label: 'Text', focus: [905, 420, 1.35, 1.0] },
  { key: 'details', label: 'Widgets', focus: [905, 470, 1.3, 1.0] },
  { key: 'drag', label: 'Drag', focus: [560, 420, 1.9, 1.45] },
  { key: 'resize', label: 'Resize', focus: [560, 420, 1.9, 1.45] },
  { key: 'crop', label: 'Crop', focus: [760, 380, 1.6, 1.15] },
  { key: 'tint', label: 'Tint', focus: [905, 470, 1.3, 1.0] },
];

/** desktop editing montage, fast cuts on the beat */
export function Edit() {
  const t = useT();
  const { W, H, v } = useFormat();
  const abs = S.looks + t;
  const idx = Math.max(0, SHOTS.findIndex((s, i) => abs >= SEG[s.key].at && (i === SHOTS.length - 1 || abs < SEG[SHOTS[i + 1].key].at)));
  const shot = SHOTS[idx];
  const seg = SEG[shot.key];
  const lt = abs - seg.at;
  // laptop geometry; the "camera" keeps the focus point at the frame centre
  const lw = v ? 1800 : 1560;
  const lid = lw * 0.84;
  const sw = lid - lid * 0.022 * 2;
  const k = sw / 1440;
  const zBase = v ? shot.focus[3] : shot.focus[2];
  const z = zBase * (1 + lt * 0.02);
  const fx = (lw - lid) / 2 + lid * 0.022 + shot.focus[0] * k;
  const fy = lid * 0.022 + sw * (38 / 1440) + shot.focus[1] * k;
  const cx = W / 2;
  const cy = v ? H * 0.4 : H * 0.5;
  const punch = 1 + (1 - ramp(lt, 0, 0.18)) * 0.035;
  return (
    <Fill>
      <DarkBg seed={10} />
      <div style={{ position: 'absolute', left: cx - fx, top: cy - fy, width: lw, transformOrigin: `${fx}px ${fy}px`, scale: String(z * punch) }}>
        <Laptop width={lw}>
          <Sequence key={shot.key} from={f(seg.at - S.looks)} layout="none">
            <ClipView seg={{ ...seg, at: 0 }} />
          </Sequence>
        </Laptop>
      </div>
      <div style={{ position: 'absolute', left: v ? 64 : 80, top: v ? 90 : 70 }}>
        <Tag key={shot.key} style={{ background: 'rgba(13,12,18,.75)', fontSize: v ? 30 : 26 }}>
          <span style={{ width: 12, height: 12, borderRadius: 9, background: C.amber, display: 'inline-block' }} />
          {shot.label}
        </Tag>
      </div>
    </Fill>
  );
}


/** "EVERYTHING is editable." */
export function Everything() {
  const t = useT();
  const { W, H, v } = useFormat();
  const L = (x: number) => x - S.everything;
  const films = ['strip-cherry', 'instant-flash', 'strip-noir', 'film35-noir', 'strip-golden', 'strip-sunday', 'strip-vintage', 'instant-flash'];
  const cols = v ? 4 : 8;
  const sh = v ? 560 : 520;
  return (
    <Fill>
      <SunBg seed={3} />
      <div style={{ position: 'absolute', left: W / 2, top: H / 2, rotate: '-10deg', scale: String(1.05 + t * 0.04) }}>
        {Array.from({ length: cols * 2 }, (_, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const n = films[(i * 3) % films.length];
          const gw = sh * 0.42;
          const x = (col - (cols - 1) / 2) * gw * 1.25;
          const y = (row - 0.5) * sh * 1.08 + (col % 2 ? sh * 0.25 : 0) - t * (col % 2 ? 60 : -60);
          const k = ramp(t, 0.02 * i, 0.02 * i + 0.4);
          return (
            <div key={i} style={{ position: 'absolute', left: x - gw / 2, top: y - sh / 2, width: gw, height: sh, display: 'grid', placeItems: 'center', opacity: k * 0.9, scale: String(0.8 + k * 0.2) }}>
              <FilmImg name={n} height={n.startsWith('instant') ? sh * 0.55 : sh} />
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(75% 45% at 50% 48%, rgba(251,248,243,.97) 0%, rgba(251,248,243,.85) 55%, rgba(251,248,243,.35) 100%)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: v ? H * 0.36 : H * 0.33, textAlign: 'center' }}>
        <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: v ? 170 : 220, letterSpacing: '-0.05em', color: C.text, lineHeight: 0.92 }}>
          <Rise at={L(w('everything')) - 0.05}>Everything</Rise>
        </div>
        <div style={{ fontFamily: F.serif, fontStyle: 'italic', fontSize: v ? 150 : 180, color: C.violet, lineHeight: 1 }}>
          <Rise at={L(w('is')) - 0.05}>is editable.</Rise>
        </div>
      </div>
    </Fill>
  );
}

/** "Same booth on your phone. Same booth on your laptop." */
export function Same() {
  const t = useT();
  const { W, H, v } = useFormat();
  const L = (x: number) => x - S.same;
  const inL = useSpring(0, { damping: 18, stiffness: 120 });
  const inP = useSpring(0.12, { damping: 16, stiffness: 120 });
  const phoneOn = t < L(w('same', 2)) - 0.1;
  const lw = v ? 1040 : 1280;
  const pw = v ? 400 : 340;
  const ph = pw * 0.94 * (844 / 390) + pw * 0.06;
  const lap = { x: v ? W / 2 - lw / 2 : W * 0.06, y: v ? H * 0.1 : H * 0.17 };
  const pho = { x: v ? W * 0.55 : W * 0.7, y: v ? H * 0.33 : H * 0.12 };
  return (
    <Fill>
      <SunBg seed={12} />
      <div style={{ position: 'absolute', left: lap.x, top: lap.y, translate: `${(1 - inL) * -300}px 0`, opacity: inL, scale: String(phoneOn ? 0.97 : 1.03), filter: phoneOn ? 'saturate(.85)' : 'none' }}>
        <Laptop width={lw}>
          <ClipView seg={{ ...SEG.sameDesk, at: 0 }} />
        </Laptop>
      </div>
      <div style={{ position: 'absolute', inset: 0, perspective: 1800 }}>
        <div style={{ position: 'absolute', left: pho.x, top: pho.y, translate: `${(1 - inP) * 300}px 0`, opacity: inP, scale: String(phoneOn ? 1.04 : 0.96) }}>
          <Float amp={0.5}>
            <Phone width={pw}>
              <ClipView seg={{ ...SEG.samePhone, at: 0 }} />
            </Phone>
          </Float>
        </div>
      </div>
      <div style={{ position: 'absolute', left: v ? 64 : W * 0.06, top: v ? H * 0.5 : H * 0.8, display: 'flex', gap: 16 }}>
        <Tag dark={false} style={{ background: phoneOn ? C.violet : 'rgba(20,18,31,.06)', color: phoneOn ? '#fff' : C.text }}>Phone</Tag>
        <Tag dark={false} style={{ background: !phoneOn ? C.violet : 'rgba(20,18,31,.06)', color: !phoneOn ? '#fff' : C.text }}>Laptop</Tag>
      </div>
      {ph < 0 && null}
    </Fill>
  );
}

export { EOUT, HIT };
