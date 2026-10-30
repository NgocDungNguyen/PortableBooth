import type { FC } from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { DURATION, S } from './edit';
import { f } from './theme';
import { loadFonts } from './fonts';
import { Captions } from './components/Captions';
import { Curtain, FlashScene, Logo, Open, Pocket, Wall } from './scenes/Intro';
import { Edit, Everything, FilmDemo, Pose, Same, Upload, Yours } from './scenes/Demo';
import { Care, Done, End, Moments, PrintScene, Share } from './scenes/Outro';

loadFonts();

const SCENES: [number, number, FC][] = [
  [S.open, S.curtain, Open],
  [S.curtain, S.flash, Curtain],
  [S.flash, S.strip, FlashScene],
  [S.strip, S.pocket, Wall],
  [S.pocket, S.logo, Pocket],
  [S.logo, S.film, Logo],
  [S.film, S.pose, FilmDemo],
  [S.pose, S.upload, Pose],
  [S.upload, S.yours, Upload],
  [S.yours, S.looks, Yours],
  [S.looks, S.everything, Edit],
  [S.everything, S.same, Everything],
  [S.same, S.care, Same],
  [S.care, S.done, Care],
  [S.done, S.print, Done],
  [S.print, S.send, PrintScene],
  [S.send, S.moments, Share],
  [S.moments, S.end, Moments],
  [S.end, DURATION, End],
];

export const Ad: FC<{ audio?: boolean }> = ({ audio = true }) => {
  return (
    <AbsoluteFill style={{ background: '#0d0c12' }}>
      {SCENES.map(([a, b, C], i) => (
        <Sequence key={i} from={f(a)} durationInFrames={f(b) - f(a)} name={C.name}>
          <C />
        </Sequence>
      ))}
      <Captions />
      {audio && <Audio src={staticFile('audio/mix.wav')} />}
    </AbsoluteFill>
  );
};
