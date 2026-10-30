// 47.8 s - end: privacy, export, print, phone-to-phone sharing, hero, end card.
import qrcode from 'qrcode-generator';
import { useMemo } from 'react';
import { Easing, Img, interpolate, staticFile } from 'remotion';
import { DURATION, HIT, S, SEG, w } from '../edit';
import { C, F, URL } from '../theme';
import { ClipView } from '../components/ClipView';
import { Phone } from '../components/Devices';
import { clamp, DarkBg, Fill, FilmImg, Flash, Grain, ramp, Rise, Sparks, SunBg, Tag, useFormat, useSpring, useT, Vignette, Wordmark } from '../components/kit';

/** privacy: a lock, then three calm lines */
export function Care() {
  const t = useT();
  const { W, H, v } = useFormat();
  const L = (x: number) => x - S.care;
  const draw = ramp(t, 0.2, 1.6, Easing.inOut(Easing.cubic));
  const lines: [string, number][] = [
    ['No account', L(w('no', 1))],
    ['No uploads', L(w('no', 2))],
    ['Never leaves your device', L(w('photos') - 0.1)],
  ];
  const lock = v ? 230 : 200;
  const listTop = v ? H * 0.42 : H * 0.36;
  const lockY = v ? H * 0.2 : H * 0.5 - lock / 2;
  const lockX = v ? W / 2 - lock / 2 : W * 0.2 - lock / 2;
  const shrink = ramp(t, lines[0][1] - 0.4, lines[0][1]);
  return (
    <Fill>
      <DarkBg seed={13} intensity={0.55} glow={C.amber} />
      <div style={{ position: 'absolute', left: lockX, top: lockY - (v ? shrink * 60 : 0), width: lock, height: lock, scale: String(1 - (v ? shrink * 0.2 : 0)) }}>
        <div style={{ position: 'absolute', inset: -lock * 0.6, borderRadius: '50%', background: `radial-gradient(circle, ${C.amber}40, transparent 65%)`, opacity: draw }} />
        <svg width={lock} height={lock} viewBox="0 0 24 24" fill="none" stroke={C.amber} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="11" width="16" height="10" rx="2.5" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
          <path d="M8 11V7.5a4 4 0 0 1 8 0V11" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} style={{ translate: `0 ${(1 - ramp(t, 1.4, 1.9, Easing.out(Easing.back(3)))) * -1.6}px` }} />
          <circle cx="12" cy="16" r="1.3" fill={C.amber} opacity={ramp(t, 1.5, 1.9)} />
        </svg>
      </div>
      <div style={{ position: 'absolute', left: v ? 80 : W * 0.36, right: v ? 80 : W * 0.06, top: listTop, display: 'flex', flexDirection: 'column', gap: v ? 34 : 30 }}>
        {lines.map(([txt, at], i) => {
          const k = ramp(t, at - 0.08, at + 0.35);
          const tick = ramp(t, at + 0.05, at + 0.4, Easing.out(Easing.cubic));
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 30, opacity: k, translate: `${(1 - k) * 40}px 0` }}>
              <div style={{ width: v ? 74 : 66, height: v ? 74 : 66, flex: 'none', borderRadius: 99, background: C.lime, display: 'grid', placeItems: 'center', scale: String(0.6 + tick * 0.4) }}>
                <svg width="60%" height="60%" viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - tick} />
                </svg>
              </div>
              <span style={{ fontFamily: F.display, fontWeight: 700, fontSize: v ? (i === 2 ? 74 : 92) : 92, letterSpacing: '-0.035em', color: C.paper, lineHeight: 1.02 }}>{txt}</span>
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: v ? H * 0.71 : H * 0.84, textAlign: 'center', opacity: ramp(t, lines[2][1] + 0.6, lines[2][1] + 1.1) }}>
        <span style={{ fontFamily: F.mono, fontSize: 26, letterSpacing: '0.14em', color: '#9b97a8', textTransform: 'uppercase' }}>No sign-up · Nothing stored · 100% in your browser</span>
      </div>
    </Fill>
  );
}

/** "When you're done... save it" - the real export sheet */
export function Done() {
  const { W, H, v } = useFormat();
  const enter = useSpring(0, { damping: 18, stiffness: 120 });
  const pw = v ? 520 : 420;
  const ph = pw * 0.94 * (844 / 390) + pw * 0.06;
  return (
    <Fill>
      <SunBg seed={14} />
      <div style={{ position: 'absolute', left: W / 2 - pw / 2, top: (v ? H * 0.39 : H * 0.5) - ph / 2, translate: `0 ${(1 - enter) * 300}px`, opacity: enter }}>
        <Phone width={pw}>
          <ClipView seg={{ ...SEG.export, at: 0 }} />
        </Phone>
      </div>
      {!v && (
        <div style={{ position: 'absolute', left: W * 0.06, top: H * 0.4 }}>
          <Tag dark={false}>Save & share</Tag>
        </div>
      )}
    </Fill>
  );
}

/** "print it" - the strip feeds out of a printer slot (a print-ready 300 DPI file today) */
export function PrintScene() {
  const t = useT();
  const { W, H, v } = useFormat();
  const sh = v ? 1100 : 860;
  const slotW = sh * 0.45;
  const out = ramp(t, 0.02, 0.85, Easing.out(Easing.quad));
  const slotY = v ? H * 0.16 : H * 0.12;
  return (
    <Fill>
      <SunBg seed={15} />
      <div style={{ position: 'absolute', left: W / 2 - slotW / 2, top: slotY + 26, width: slotW, height: sh + 40, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: (slotW - sh * 0.335) / 2, top: -sh + out * sh * 0.85, rotate: `${Math.sin(t * 40) * 0.3}deg` }}>
          <FilmImg name="strip-golden" height={sh} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: W / 2 - slotW * 0.7, top: slotY - 40, width: slotW * 1.4, height: 70, borderRadius: 24, background: 'linear-gradient(180deg,#2a2833,#121117)', boxShadow: '0 20px 40px rgba(10,8,20,.35)' }}>
        <div style={{ position: 'absolute', left: slotW * 0.17, right: slotW * 0.17, top: 52, height: 8, borderRadius: 4, background: '#000' }} />
        <div style={{ position: 'absolute', right: 26, top: 24, width: 12, height: 12, borderRadius: 9, background: C.lime, boxShadow: `0 0 12px ${C.lime}` }} />
      </div>
      <div style={{ position: 'absolute', left: v ? 64 : W * 0.68, top: v ? H * 0.06 : H * 0.42 }}>
        <Tag dark={false}>300 DPI · print-ready</Tag>
      </div>
    </Fill>
  );
}

function Qr({ size, text = 'PortableBooth: send to a nearby phone', dark = C.text }: { size: number; text?: string; dark?: string }) {
  const cells = useMemo(() => {
    const q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    const n = q.getModuleCount();
    const out: [number, number][] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) out.push([r, c]);
    return { n, out };
  }, [text]);
  const m = size / (cells.n + 2);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ background: '#fff', borderRadius: size * 0.05 }}>
      {cells.out.map(([r, c]) => (
        <rect key={`${r}-${c}`} x={(c + 1) * m} y={(r + 1) * m} width={m + 0.4} height={m + 0.4} fill={dark} />
      ))}
    </svg>
  );
}

/** a phone screen in the app's light theme: the "Send to a nearby phone" sheet with the offer QR */
function SendScreen({ t0 }: { t0: number }) {
  const t = useT();
  const k = ramp(t, t0, t0 + 0.4);
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#e9e4dc' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.35)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 700, borderRadius: '22px 22px 0 0', background: C.paper, padding: 22, translate: `0 ${(1 - k) * 700}px` }}>
        <div style={{ width: 40, height: 5, borderRadius: 9, background: '#cfc9bf', margin: '0 auto 18px' }} />
        <div style={{ fontFamily: F.ui, fontWeight: 650, fontSize: 21, color: C.text }}>Send to a nearby phone</div>
        <div style={{ fontFamily: F.ui, fontSize: 14, color: '#6b6777', marginTop: 6 }}>Direct, phone to phone, on the same Wi-Fi</div>
        <div style={{ marginTop: 28, display: 'grid', placeItems: 'center' }}>
          <div style={{ padding: 14, borderRadius: 20, background: '#fff', boxShadow: '0 8px 30px rgba(20,18,31,.12)' }}>
            <Qr size={250} />
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 22, fontFamily: F.ui, fontWeight: 600, fontSize: 17, color: C.text }}>Ask them to scan this code</div>
        <div style={{ textAlign: 'center', marginTop: 8, fontFamily: F.ui, fontSize: 14, color: '#6b6777' }}>Works with iPhone and Android</div>
        <div style={{ marginTop: 26, height: 52, borderRadius: 14, background: C.violet, color: '#fff', display: 'grid', placeItems: 'center', fontFamily: F.ui, fontWeight: 650, fontSize: 17 }}>Scan their reply</div>
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 8, fontFamily: F.ui, fontSize: 13, color: '#6b6777' }}>🔒 Made on your device. Nothing is uploaded.</div>
      </div>
    </div>
  );
}

/** the second phone: scanner, then receiving with a progress ring, then the strip */
function ReceiveScreen({ scanAt, lockAt, recvAt, landAt }: { scanAt: number; lockAt: number; recvAt: number; landAt: number }) {
  const t = useT();
  const scanning = t < recvAt;
  const lockK = ramp(t, lockAt, lockAt + 0.25);
  const prog = ramp(t, recvAt, landAt, Easing.inOut(Easing.quad));
  const landed = t >= landAt;
  const lk = ramp(t, landAt, landAt + 0.45, Easing.out(Easing.back(1.6)));
  const R = 70;
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0d0c12' }}>
      {scanning && (
        <>
          {/* camera view of the other phone's QR, slightly tilted */}
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(80% 60% at 50% 45%, #4a4652, #1b1a20)' }} />
          <div style={{ position: 'absolute', left: 70, top: 250, rotate: `${-6 + lockK * 6}deg`, scale: String(0.92 + lockK * 0.08), filter: `blur(${(1 - ramp(t, scanAt, scanAt + 0.5)) * 3}px)` }}>
            <Qr size={250} />
          </div>
          {[0, 1, 2, 3].map((i) => {
            const x = i % 2 ? 1 : 0;
            const y = i > 1 ? 1 : 0;
            const inset = 50 - lockK * 30;
            return (
              <div key={i} style={{ position: 'absolute', left: x ? undefined : 55 + inset, right: x ? 55 + inset : undefined, top: y ? undefined : 235 + inset, bottom: y ? undefined : 844 - 515 - inset, width: 50, height: 50, borderColor: lockK > 0.5 ? C.lime : '#fff', borderStyle: 'solid', borderWidth: 0, [y ? 'borderBottomWidth' : 'borderTopWidth']: 6, [x ? 'borderRightWidth' : 'borderLeftWidth']: 6, borderRadius: 10 } as React.CSSProperties} />
            );
          })}
          <div style={{ position: 'absolute', left: 70, width: 250, top: 250 + ((t * 1.6) % 1) * 250, height: 3, background: C.lime, boxShadow: `0 0 18px ${C.lime}`, opacity: 1 - lockK }} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: 600, textAlign: 'center', fontFamily: F.ui, fontWeight: 600, fontSize: 19, color: '#fff' }}>{lockK > 0.5 ? 'Code found' : 'Point at the code'}</div>
        </>
      )}
      {!scanning && (
        <div style={{ position: 'absolute', inset: 0, background: C.paper }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 70, textAlign: 'center', fontFamily: F.ui, fontWeight: 650, fontSize: 21, color: C.text }}>{landed ? 'You got a strip!' : 'Receiving…'}</div>
          {!landed && (
            <svg width={R * 2 + 20} height={R * 2 + 20} style={{ position: 'absolute', left: 195 - R - 10, top: 360 - R - 10 }}>
              <circle cx={R + 10} cy={R + 10} r={R} stroke="#e4ded4" strokeWidth={10} fill="none" />
              <circle cx={R + 10} cy={R + 10} r={R} stroke={C.violet} strokeWidth={10} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - prog} transform={`rotate(-90 ${R + 10} ${R + 10})`} />
              <text x={R + 10} y={R + 20} textAnchor="middle" fontFamily="Geist Mono" fontSize={30} fontWeight={600} fill={C.text}>{Math.round(prog * 100)}%</text>
            </svg>
          )}
          {landed && (
            <div style={{ position: 'absolute', left: 195 - 95, top: 130, scale: String(0.6 + lk * 0.4), opacity: lk }}>
              <Img src={staticFile('films/strip-sunday.png')} style={{ height: 560, boxShadow: '0 20px 40px rgba(20,18,31,.25)' }} />
            </div>
          )}
          {landed && (
            <div style={{ position: 'absolute', left: 24, right: 24, bottom: 40, height: 54, borderRadius: 14, background: C.violet, color: '#fff', display: 'grid', placeItems: 'center', fontFamily: F.ui, fontWeight: 650, fontSize: 17, opacity: ramp(t, landAt + 0.3, landAt + 0.6) }}>Save to photos</div>
          )}
        </div>
      )}
    </div>
  );
}

/** "send it to a friend nearby - phone to phone, iPhone or Android. They scan the code... and your strip lands" */
export function Share() {
  const t = useT();
  const { W, H, v } = useFormat();
  const L = (x: number) => x - S.send;
  const twoAt = L(S.p2p);
  const two = ramp(t, twoAt - 0.1, twoAt + 0.6, Easing.inOut(Easing.cubic));
  const pw = v ? 470 : 380;
  const ph = pw * 0.94 * (844 / 390) + pw * 0.06;
  const cy = v ? H * 0.4 : H * 0.5;
  const gap = v ? 40 : 160;
  const aX = interpolate(two, [0, 1], [W / 2 - pw / 2, W / 2 - pw - gap / 2]);
  const bX = interpolate(two, [0, 1], [W + 100, W / 2 + gap / 2]);
  const sAt = L(w('scan'));
  const lockAt = L(w('code')) + 0.05;
  const recvAt = L(w('and', 3)) - 0.05;
  const landAt = L(HIT.lands);
  // the strip flies from A to B along an arc
  const fly = ramp(t, recvAt, landAt, Easing.inOut(Easing.cubic));
  const ax = aX + pw / 2;
  const bx = bX + pw / 2;
  const fx = interpolate(fly, [0, 1], [ax, bx]);
  const fy = cy - Math.sin(fly * Math.PI) * (v ? 380 : 300);
  const sideScale = v ? 0.88 : 1;
  return (
    <Fill>
      <SunBg seed={16} />
      <div style={{ position: 'absolute', inset: 0, perspective: 2000 }}>
        <div style={{ position: 'absolute', left: aX, top: cy - ph / 2, transform: `rotateY(${two * 10}deg) scale(${1 - two * (1 - sideScale)})` }}>
          <Phone width={pw} variant="a">
            <SendScreen t0={0.05} />
          </Phone>
        </div>
        <div style={{ position: 'absolute', left: bX, top: cy - ph / 2, transform: `rotateY(${-two * 10}deg) scale(${1 - two * (1 - sideScale)})` }}>
          <Phone width={pw} variant="b">
            <ReceiveScreen scanAt={sAt} lockAt={lockAt} recvAt={recvAt} landAt={landAt} />
          </Phone>
        </div>
      </div>
      {fly > 0 && fly < 1 && (
        <>
          {[0.12, 0.08, 0.04].map((d, i) => {
            const ff = Math.max(0, fly - d);
            return (
              <div key={i} style={{ position: 'absolute', left: interpolate(ff, [0, 1], [ax, bx]) - 50, top: cy - Math.sin(ff * Math.PI) * (v ? 380 : 300) - 150, opacity: 0.15 + i * 0.1, rotate: `${-20 + ff * 40}deg` }}>
                <FilmImg name="strip-sunday" height={300} style={{ boxShadow: 'none' }} />
              </div>
            );
          })}
          <div style={{ position: 'absolute', left: fx - 50, top: fy - 150, rotate: `${-20 + fly * 40}deg`, scale: String(1 + Math.sin(fly * Math.PI) * 0.25) }}>
            <FilmImg name="strip-sunday" height={300} />
          </div>
        </>
      )}
      <Sparks at={landAt} x={bx} y={cy - ph * 0.1} spread={360} count={20} seed={21} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: v ? H * 0.065 : H * 0.07, display: 'flex', justifyContent: 'center', gap: 18, opacity: two }}>
        <Tag dark={false}>iPhone</Tag>
        <Tag dark={false} style={{ background: C.lime, borderColor: C.lime }}>⇄</Tag>
        <Tag dark={false}>Android</Tag>
      </div>
    </Fill>
  );
}

/** "Made for the moments worth keeping." - films fanned out on a tabletop */
export function Moments() {
  const t = useT();
  const { W, H, v } = useFormat();
  const items = v
    ? [
        { n: 'wide-sunday', x: 0.5, y: 0.2, r: -4, h: 300, z: 0 },
        { n: 'strip-cherry', x: 0.26, y: 0.47, r: -10, h: 900, z: 1 },
        { n: 'instant-flash', x: 0.74, y: 0.42, r: 8, h: 560, z: 2 },
        { n: 'film35-noir', x: 0.66, y: 0.7, r: -6, h: 760, z: 3 },
        { n: 'strip-sunday', x: 0.44, y: 0.6, r: 4, h: 980, z: 4 },
      ]
    : [
        { n: 'wide-dream', x: 0.2, y: 0.33, r: -8, h: 420, z: 0 },
        { n: 'strip-cherry', x: 0.37, y: 0.5, r: -12, h: 820, z: 1 },
        { n: 'film35-noir', x: 0.78, y: 0.5, r: 9, h: 860, z: 2 },
        { n: 'instant-flash', x: 0.64, y: 0.45, r: 6, h: 560, z: 3 },
        { n: 'strip-sunday', x: 0.5, y: 0.52, r: 2, h: 900, z: 4 },
      ];
  return (
    <Fill style={{ background: '#d9c7ae' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(90% 70% at 45% 40%, #f4e7d2 0%, #d8c1a1 60%, #a8896a 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(95deg, rgba(120,80,40,.05) 0 3px, transparent 3px 22px)' }} />
      <div style={{ position: 'absolute', inset: 0, scale: String(1.06 - t * 0.02), rotate: `${t * 0.6}deg` }}>
        {items.map((it, i) => {
          const k = ramp(t, i * 0.09, i * 0.09 + 0.6);
          const blur = it.z < 2 ? 3 - k : 0;
          return (
            <div key={it.n + i} style={{ position: 'absolute', left: it.x * W, top: it.y * H, translate: '-50% -50%', rotate: `${it.r + (1 - k) * 25}deg`, scale: String(0.7 + k * 0.3), opacity: k, filter: blur > 0 ? `blur(${blur}px)` : undefined }}>
              <FilmImg name={it.n} height={it.n.startsWith('wide') ? (v ? 300 : 420) : it.h} style={{ boxShadow: '0 30px 50px rgba(70,40,10,.35), 0 4px 10px rgba(70,40,10,.3)' }} />
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(120deg, rgba(255,240,210,.35), transparent 40%)' }} />
      <Grain opacity={0.08} />
      <Vignette strength={0.4} />
    </Fill>
  );
}

/** end card + loop flash */
export function End() {
  const t = useT();
  const { W, H, v } = useFormat();
  const L = (x: number) => x - S.end;
  const hit = useSpring(0.02, { damping: 11, stiffness: 170 });
  const free = L(w('free'));
  const go = L(w('go', 3));
  const len = DURATION - S.end;
  return (
    <Fill>
      <SunBg seed={17} />
      {/* fanned films behind, out of focus */}
      <div style={{ position: 'absolute', left: W / 2, top: v ? H * 0.74 : H * 0.83, filter: 'blur(5px)', opacity: 0.55 }}>
        {['strip-cherry', 'strip-sunday', 'strip-golden', 'strip-noir', 'strip-vintage'].map((n, i) => (
          <div key={n} style={{ position: 'absolute', left: -110, top: -560, transformOrigin: '50% 100%', rotate: `${(i - 2) * 13 * ramp(t, 0.1, 0.9)}deg` }}>
            <FilmImg name={n} height={v ? 620 : 560} />
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: v ? H * 0.2 : H * 0.18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: v ? 34 : 26 }}>
        <div style={{ scale: String((v ? 0.8 : 1) * (0.8 + hit * 0.2)), opacity: hit }}>
          <Wordmark size={v ? 150 : 140} reveal={hit} />
        </div>
        <div style={{ fontFamily: F.serif, fontStyle: 'italic', fontSize: v ? 92 : 88, color: C.text, textAlign: 'center', lineHeight: 1.05 }}>
          <Rise at={free - 0.05}>Free,&nbsp;</Rise>
          {v && <br />}
          <Rise at={free + 0.6} style={{ color: C.violet }}>right in your browser.</Rise>
        </div>
        <div style={{ marginTop: v ? 18 : 10, opacity: ramp(t, go - 0.1, go + 0.3), translate: `0 ${(1 - ramp(t, go - 0.1, go + 0.4)) * 20}px` }}>
          <div style={{ padding: v ? '22px 40px' : '18px 36px', borderRadius: 999, background: C.text, color: C.paper, fontFamily: F.ui, fontWeight: 650, fontSize: v ? 44 : 38, display: 'flex', alignItems: 'center', gap: 16 }}>
            {URL ? (
              URL
            ) : (
              <>
                <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.6-3.6" />
                </svg>
                Search “PortableBooth”
              </>
            )}
          </div>
        </div>
        <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: v ? 58 : 50, color: C.text, letterSpacing: '-0.03em', opacity: ramp(t, go + 0.4, go + 0.9) }}>
          Go make some memories.
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: v ? W * 0.12 : 0, bottom: v ? H * 0.205 : H * 0.05, textAlign: 'center', fontFamily: F.ui, fontWeight: 500, fontSize: v ? 30 : 26, color: '#5c5868', opacity: ramp(t, 0.8, 1.3) }}>
        Made by June Nguyen · RMIT Hà Nội
      </div>
      <Sparks at={0.02} x={W / 2} y={v ? H * 0.26 : H * 0.28} spread={v ? 560 : 800} count={30} seed={30} />
      <Flash at={0.02} decay={0.35} max={0.85} />
      {/* loop out: flash to white, matching frame 1 */}
      <Fill style={{ background: '#fff', opacity: interpolate(t, [len - 0.45, len - 1 / 30], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) }) }} />
    </Fill>
  );
}
