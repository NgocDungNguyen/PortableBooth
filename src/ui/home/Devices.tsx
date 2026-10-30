import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';

/** logical size the phone screen is laid out at (an iPhone-class viewport), then scaled to fit */
export const PHONE_W = 390;
export const PHONE_H = 844;

/**
 * A modern phone in CSS: thin even bezel, dynamic island, side keys and a faint glass reflection.
 * The screen content is laid out at 390x844 and scaled, so it is a true miniature of the mobile studio.
 */
export function Phone({ width, children, className = '' }: { width: number; children: ReactNode; className?: string }) {
  const bezel = Math.max(6, Math.round(width * 0.034));
  const sw = width - bezel * 2;
  const k = sw / PHONE_W;
  const sh = PHONE_H * k;
  return (
    <div className={`phone ${className}`} style={{ width, height: sh + bezel * 2, padding: bezel, borderRadius: width * 0.16 }}>
      <span className="phone-key" style={{ left: -3, top: '17%', height: '4%' }} />
      <span className="phone-key" style={{ left: -3, top: '24%', height: '7.5%' }} />
      <span className="phone-key" style={{ left: -3, top: '33%', height: '7.5%' }} />
      <span className="phone-key" style={{ right: -3, top: '27%', height: '11%' }} />
      <div className="phone-screen" style={{ width: sw, height: sh, borderRadius: width * 0.13 }}>
        <div style={{ width: PHONE_W, height: PHONE_H, transform: `scale(${k})`, transformOrigin: '0 0' }}>{children}</div>
        <span className="phone-island" style={{ top: 11 * k, width: 122 * k, height: 35 * k }} />
        <span className="phone-glare" />
      </div>
    </div>
  );
}

/** logical size of the desktop studio inside the browser window */
export const DESK_W = 1180;
export const DESK_H = 720;

/** A quiet browser window (macOS-style controls, address pill); content laid out at 1180x720 and scaled */
export function BrowserWindow({ width, children, className = '' }: { width: number; children: ReactNode; className?: string }) {
  const k = width / DESK_W;
  return (
    <div className={`browser ${className}`} style={{ width }}>
      <div className="browser-bar">
        <span className="flex gap-1.5" aria-hidden>
          <i className="browser-dot bg-[#ff5f57]" />
          <i className="browser-dot bg-[#febc2e]" />
          <i className="browser-dot bg-[#28c840]" />
        </span>
        <span className="browser-url">
          <Lock size={10} aria-hidden /> PortableBooth
        </span>
        <span className="w-[42px]" />
      </div>
      <div className="relative overflow-hidden" style={{ width, height: DESK_H * k }}>
        <div style={{ width: DESK_W, height: DESK_H, transform: `scale(${k})`, transformOrigin: '0 0' }}>{children}</div>
      </div>
    </div>
  );
}
