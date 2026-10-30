import { Config } from '@remotion/cli/config';
// REMOTION_CHROME: use an installed Chrome; otherwise Remotion downloads its own headless Chrome once.
if (process.env.REMOTION_CHROME) Config.setBrowserExecutable(process.env.REMOTION_CHROME);
Config.setChromiumOpenGlRenderer('swangle');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setConcurrency(4);
