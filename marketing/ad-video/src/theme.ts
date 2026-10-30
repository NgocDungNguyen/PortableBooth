// Brand tokens, taken from the app (src/index.css): dark "studio" and light "Sunlit".
export const C = {
  ink: '#0d0c12',
  ink2: '#17151f',
  amber: '#ffb020',
  paper: '#fbf8f3',
  text: '#14121f',
  violet: '#5b3df5',
  lime: '#c6f432',
  coral: '#ff4f5e',
  white: '#ffffff',
};
export const F = {
  display: '"Bricolage Grotesque", "Geist", sans-serif',
  ui: '"Geist", sans-serif',
  serif: '"Instrument Serif", serif',
  mono: '"Geist Mono", monospace',
};
export const FPS = 30;
/** seconds -> frames */
export const f = (s: number) => Math.round(s * FPS);
/** Optional link shown on the end card. Leave empty to show "Search PortableBooth" instead (no URL is claimed). */
export const URL = '';
