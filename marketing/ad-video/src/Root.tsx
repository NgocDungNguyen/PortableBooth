import { Composition, Still } from 'remotion';
import { Ad } from './Ad';
import { DURATION } from './edit';
import { Cover } from './Cover';

const frames = Math.round(DURATION * 30);

export const RemotionRoot = () => (
  <>
    <Composition id="Ad9x16" component={Ad} width={1080} height={1920} fps={30} durationInFrames={frames} defaultProps={{ audio: true }} />
    <Composition id="Ad16x9" component={Ad} width={1920} height={1080} fps={30} durationInFrames={frames} defaultProps={{ audio: true }} />
    <Still id="Cover9x16" component={Cover} width={1080} height={1920} />
    <Still id="Cover16x9" component={Cover} width={1920} height={1080} />
  </>
);
