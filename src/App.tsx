import { AnimatePresence, motion } from 'motion/react';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import type { FormatId } from './film/types';
import { StudioProvider, useStudio } from './state/studio';
import { Home } from './ui/Home';
import { Intro } from './ui/intro/Intro';
import { routeMotion, useMotionOK } from './ui/motion';
import { Toast } from './ui/Toast';
import { ThemeProvider } from './ui/ThemeToggle';

const loadStudio = () => import('./ui/Studio');
const Studio = lazy(loadStudio);

type Route = 'home' | 'studio';
const read = (): Route => (location.hash === '#studio' ? 'studio' : 'home');

function Router() {
  const ok = useMotionOK();
  const [route, setRoute] = useState<Route>(read);
  // The intro plays on every cold load of the home route (nothing is stored, so it cannot be remembered),
  // never on a #studio deep link. Home stays mounted underneath so its films render while the reel plays.
  const [intro, setIntro] = useState(() => read() === 'home');
  const { startFrom } = useStudio();

  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    document.title = route === 'studio' ? 'Studio · PortableBooth' : 'PortableBooth';
    if (route === 'studio') setIntro(false);
  }, [route]);
  // warm the studio chunk while the reel plays
  useEffect(() => {
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const id = ric ? ric(() => void loadStudio()) : window.setTimeout(() => void loadStudio(), 800);
    return () => {
      if (!ric) clearTimeout(id);
    };
  }, []);

  const start = useCallback(
    (look?: { format: FormatId; frames?: number; filterId: string }) => {
      if (look) {
        startFrom(look.format, look.frames, look.filterId);
      }
      location.hash = '#studio';
    },
    [startFrom],
  );
  const closeIntro = useCallback(() => setIntro(false), []);
  const openIntro = useCallback(() => setIntro(true), []);

  return (
    <>
      <AnimatePresence mode="wait" initial={false} onExitComplete={() => window.scrollTo({ top: 0 })}>
        {route === 'home' ? (
          <motion.div key="home" {...routeMotion(ok)} inert={intro}>
            <Home onStart={start} onHowItWorks={openIntro} ready={!intro} />
          </motion.div>
        ) : (
          <motion.div key="studio" {...routeMotion(ok)}>
            <Suspense fallback={<div className="grid min-h-dvh place-items-center bg-bg" role="status" aria-label="Loading studio"><div className="size-10 animate-spin rounded-full border-2 border-line2 border-t-accent" /></div>}>
              <Studio />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>{intro && route === 'home' && <Intro key="intro" onDone={closeIntro} />}</AnimatePresence>
    </>
  );
}

export function App() {
  return (
    <ThemeProvider>
    <StudioProvider>
      <a href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }} className="sr-only-text focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:p-3 focus:font-semibold focus:text-accentink">
        Skip to content
      </a>
      <main id="main" tabIndex={-1} className="outline-none">
        <Router />
      </main>
      <Toast />
    </StudioProvider>
    </ThemeProvider>
  );
}
