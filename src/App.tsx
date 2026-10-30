import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import type { FormatId } from './film/types';
import { StudioProvider, useStudio } from './state/studio';
import { Home } from './ui/Home';
import { Toast } from './ui/Toast';

const Studio = lazy(() => import('./ui/Studio'));

type Route = 'home' | 'studio';
const read = (): Route => (location.hash === '#studio' ? 'studio' : 'home');

function Router() {
  const [route, setRoute] = useState<Route>(read);
  const { startFrom } = useStudio();

  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    window.scrollTo({ top: 0 });
    document.title = route === 'studio' ? 'Studio · PortableBooth' : 'PortableBooth';
  }, [route]);

  const start = useCallback(
    (look?: { format: FormatId; frames?: number; filterId: string }) => {
      if (look) {
        startFrom(look.format, look.frames, look.filterId);
      }
      location.hash = '#studio';
    },
    [startFrom],
  );

  return route === 'home' ? (
    <Home onStart={start} />
  ) : (
    <Suspense fallback={<div className="grid min-h-dvh place-items-center bg-bg" role="status" aria-label="Loading studio"><div className="size-10 animate-spin rounded-full border-2 border-line2 border-t-accent" /></div>}>
      <Studio />
    </Suspense>
  );
}

export function App() {
  return (
    <StudioProvider>
      <a href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }} className="sr-only-text focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:p-3 focus:font-semibold focus:text-accentink">
        Skip to content
      </a>
      <main id="main" tabIndex={-1} className="outline-none">
        <Router />
      </main>
      <Toast />
    </StudioProvider>
  );
}
