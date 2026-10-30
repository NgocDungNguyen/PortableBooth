import type { CSSProperties, ReactNode } from 'react';
import { C, F } from '../theme';

/** Modern generic phone: thin bezel, dynamic island (no brand marks). Screen is 390x844 CSS px scaled to `width`. */
export function Phone({ width, children, style, variant = 'a', glare = 0.5 }: { width: number; children?: ReactNode; style?: CSSProperties; variant?: 'a' | 'b'; glare?: number }) {
  const bez = width * 0.03;
  const sw = width - bez * 2;
  const sh = sw * (844 / 390);
  const h = sh + bez * 2;
  const r = width * 0.155;
  const frame = variant === 'a' ? 'linear-gradient(145deg,#3a3846,#15141b 40%,#2a2833 70%,#0c0b10)' : 'linear-gradient(145deg,#e9e6ef,#a8a4b4 35%,#d8d4df 70%,#8b8798)';
  return (
    <div style={{ position: 'relative', width, height: h, ...style }}>
      {/* soft contact + ambient shadow */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: r, boxShadow: `0 ${width * 0.09}px ${width * 0.2}px rgba(10,8,20,.42), 0 ${width * 0.02}px ${width * 0.04}px rgba(10,8,20,.35)` }} />
      <div style={{ position: 'absolute', inset: 0, borderRadius: r, background: frame, padding: width * 0.006 }}>
        <div style={{ width: '100%', height: '100%', borderRadius: r - width * 0.006, background: '#050507' }} />
      </div>
      {/* side buttons */}
      {variant === 'a' ? (
        <>
          <div style={{ position: 'absolute', left: -width * 0.012, top: h * 0.2, width: width * 0.014, height: h * 0.05, borderRadius: 4, background: '#2a2833' }} />
          <div style={{ position: 'absolute', left: -width * 0.012, top: h * 0.28, width: width * 0.014, height: h * 0.08, borderRadius: 4, background: '#2a2833' }} />
          <div style={{ position: 'absolute', right: -width * 0.012, top: h * 0.25, width: width * 0.014, height: h * 0.11, borderRadius: 4, background: '#2a2833' }} />
        </>
      ) : (
        <>
          <div style={{ position: 'absolute', right: -width * 0.012, top: h * 0.18, width: width * 0.014, height: h * 0.07, borderRadius: 4, background: '#9a96a6' }} />
          <div style={{ position: 'absolute', right: -width * 0.012, top: h * 0.28, width: width * 0.014, height: h * 0.12, borderRadius: 4, background: '#9a96a6' }} />
        </>
      )}
      <div style={{ position: 'absolute', left: bez, top: bez, width: sw, height: sh, borderRadius: r - bez, overflow: 'hidden', background: C.paper }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 390, height: 844, transform: `scale(${sw / 390})`, transformOrigin: '0 0' }}>{children}</div>
        {/* glass glare */}
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(115deg, rgba(255,255,255,${0.16 * glare}) 0%, rgba(255,255,255,0) 32%, rgba(255,255,255,0) 70%, rgba(255,255,255,${0.06 * glare}) 100%)`, pointerEvents: 'none' }} />
      </div>
      {/* camera: dynamic island (variant a) or punch hole (variant b) */}
      {variant === 'a' ? (
        <div style={{ position: 'absolute', left: '50%', top: bez + sw * 0.028, width: sw * 0.3, height: sw * 0.085, marginLeft: -sw * 0.15, borderRadius: 999, background: '#000' }} />
      ) : (
        <div style={{ position: 'absolute', left: '50%', top: bez + sw * 0.035, width: sw * 0.055, height: sw * 0.055, marginLeft: -sw * 0.0275, borderRadius: 999, background: '#000', boxShadow: '0 0 0 2px #111' }} />
      )}
    </div>
  );
}

/** Laptop with a generic browser window. Screen content is 1440x900 CSS px scaled to fit `width`. */
export function Laptop({ width, children, style, title = 'Studio · PortableBooth', dark = true }: { width: number; children?: ReactNode; style?: CSSProperties; title?: string; dark?: boolean }) {
  const lid = width * 0.84;
  const bez = lid * 0.022;
  const sw = lid - bez * 2;
  const chrome = sw * (38 / 1440);
  const sh = sw * (900 / 1440) + chrome;
  const lh = sh + bez * 2.6;
  const k = sw / 1440;
  const bar = dark ? '#1d1b24' : '#ece8e1';
  const ink = dark ? '#a9a5b6' : '#5c5868';
  return (
    <div style={{ position: 'relative', width, height: lh + width * 0.035, ...style }}>
      <div style={{ position: 'absolute', left: (width - lid) / 2, top: 0, width: lid, height: lh, borderRadius: lid * 0.026, background: 'linear-gradient(180deg,#2b2934,#121117)', boxShadow: `0 ${width * 0.05}px ${width * 0.09}px rgba(10,8,20,.40)`, padding: bez }}>
        <div style={{ position: 'relative', width: sw, height: sh, overflow: 'hidden', borderRadius: lid * 0.008, background: C.ink }}>
          <div style={{ height: chrome, background: bar, display: 'flex', alignItems: 'center', gap: chrome * 0.22, padding: `0 ${chrome * 0.4}px` }}>
            {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
              <div key={c} style={{ width: chrome * 0.3, height: chrome * 0.3, borderRadius: 99, background: c, opacity: 0.9 }} />
            ))}
            <div style={{ marginLeft: chrome * 0.5, height: chrome * 0.66, padding: `0 ${chrome * 0.4}px`, borderRadius: chrome * 0.18, background: dark ? '#2b2833' : '#ffffff', display: 'flex', alignItems: 'center', fontFamily: F.ui, fontSize: chrome * 0.36, color: ink, gap: chrome * 0.2 }}>
              <div style={{ width: chrome * 0.3, height: chrome * 0.3, borderRadius: 4, background: C.amber }} />
              {title}
            </div>
          </div>
          <div style={{ position: 'absolute', left: 0, top: chrome, width: 1440, height: 900, transform: `scale(${k})`, transformOrigin: '0 0' }}>{children}</div>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(120deg, rgba(255,255,255,.07), rgba(255,255,255,0) 35%)', pointerEvents: 'none' }} />
        </div>
        <div style={{ position: 'absolute', left: '50%', top: bez * 0.32, width: bez * 0.4, height: bez * 0.4, marginLeft: -bez * 0.2, borderRadius: 99, background: '#000' }} />
      </div>
      {/* base */}
      <div style={{ position: 'absolute', left: 0, top: lh - 2, width, height: width * 0.03, borderRadius: `0 0 ${width * 0.04}px ${width * 0.04}px / 0 0 ${width * 0.025}px ${width * 0.025}px`, background: 'linear-gradient(180deg,#d9d6de,#9c98a6 60%,#6f6b78)' }} />
      <div style={{ position: 'absolute', left: width * 0.42, top: lh - 2, width: width * 0.16, height: width * 0.008, borderRadius: '0 0 12px 12px', background: '#8a8694' }} />
    </div>
  );
}
