// Thumbnail / cover frame: the phone with a strip, the wordmark and the promise.
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { loadFonts } from './fonts';
import { C, F } from './theme';
import { Phone } from './components/Devices';
import { FilmImg, SunBg, useFormat, Wordmark } from './components/kit';

loadFonts();

export const Cover = () => {
  const { W, H, v } = useFormat();
  const pw = v ? 520 : 400;
  return (
    <AbsoluteFill>
      <SunBg seed={22} />
      <div style={{ position: 'absolute', left: v ? 70 : 110, top: v ? 120 : 150, width: v ? W - 140 : W * 0.5 }}>
        <Wordmark size={v ? 70 : 64} />
        <div style={{ marginTop: v ? 50 : 50, fontFamily: F.display, fontWeight: 800, fontSize: v ? 150 : 140, letterSpacing: '-0.05em', lineHeight: 0.92, color: C.text }}>
          The photobooth
          <br />
          in your <span style={{ fontFamily: F.serif, fontStyle: 'italic', fontWeight: 400, color: C.violet }}>pocket.</span>
        </div>
        <div style={{ marginTop: 36, display: 'inline-block', padding: '14px 28px', borderRadius: 999, background: C.lime, fontFamily: F.ui, fontWeight: 650, fontSize: v ? 38 : 34, color: C.text }}>Free, in your browser</div>
      </div>
      <div style={{ position: 'absolute', left: v ? W * 0.5 - pw / 2 + 60 : W * 0.66, top: v ? H * 0.42 : H * 0.1, transform: 'rotate(6deg)' }}>
        <Phone width={pw}>
          <Img src={staticFile('shots/phone-home.png')} style={{ width: 390, height: 844 }} />
        </Phone>
      </div>
      <div style={{ position: 'absolute', left: v ? W * 0.08 : W * 0.55, top: v ? H * 0.5 : H * 0.3, transform: 'rotate(-9deg)' }}>
        <FilmImg name="strip-cherry" height={v ? 820 : 640} />
      </div>
    </AbsoluteFill>
  );
};
