import { useEffect, useState } from 'react';
import { ensureFonts } from '../render/fonts';

let ready = false;
const promise = () => ensureFonts().then(() => {
  ready = true;
});

/** true once the fonts are ready, so the first canvas render uses them */
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
