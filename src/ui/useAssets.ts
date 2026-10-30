import { useEffect, useState } from 'react';
import { loadStickers } from '../assets/stickers';
import { ensureFonts } from '../render/fonts';

let ready = false;
const promise = () => Promise.all([ensureFonts(), loadStickers()]).then(() => {
  ready = true;
});

/** true once fonts + sticker images are ready, so the first canvas render is correct */
export function useAssetsReady(): boolean {
  const [ok, setOk] = useState(ready);
  useEffect(() => {
    if (ready) return;
    let live = true;
    promise().then(() => live && setOk(true));
    return () => {
      live = false;
    };
  }, []);
  return ok;
}
