import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMotionValue, type MotionValue } from 'motion/react';

export interface Reel {
  /** global time in ms (0..count*sceneMs) */
  time: MotionValue<number>;
  /** time inside the current scene in ms (0..sceneMs) */
  local: MotionValue<number>;
  scene: number;
  /** go to scene i (clamped) */
  seek: (i: number) => void;
  next: () => boolean;
  prev: () => void;
  /** pause reasons that stack: pointer hold, hidden tab */
  hold: (on: boolean) => void;
  /** true once the last scene's animation has finished */
  ended: boolean;
}

interface Opts {
  count: number;
  sceneMs: number;
  /** false = reduced motion: no clock at all, each scene is shown in its `stillAt` pose */
  auto: boolean;
  /** local time (ms) at which each scene looks best when shown as a static card */
  stillAt: number[];
}

/**
 * One clock for the whole reel. Scenes are pure functions of `local`, so pausing (just stop adding time)
 * and seeking (just set the time) are exact. Time is advanced in a single rAF loop and capped per frame so a
 * stalled tab never makes the reel jump.
 */
export function useReel({ count, sceneMs, auto, stillAt }: Opts): Reel {
  const time = useMotionValue(0);
  const local = useMotionValue(0);
  const [scene, setScene] = useState(0);
  const [ended, setEnded] = useState(false);
  const total = count * sceneMs;

  const s = useRef({ t: 0, scene: 0, holding: false, hidden: false, ended: false });

  const apply = useCallback(
    (t: number) => {
      const st = s.current;
      st.t = t;
      const idx = Math.min(count - 1, Math.floor(t / sceneMs));
      if (auto) {
        time.set(t);
        local.set(t - idx * sceneMs);
      } else {
        time.set((idx + 1) * sceneMs - 0.001);
        local.set(stillAt[idx] ?? sceneMs);
      }
      if (idx !== st.scene) {
        st.scene = idx;
        setScene(idx);
      }
      const done = auto && t >= total;
      if (done !== st.ended) {
        st.ended = done;
        setEnded(done);
      }
    },
    [auto, count, local, sceneMs, stillAt, time, total],
  );

  const seek = useCallback(
    (i: number) => {
      apply(Math.max(0, Math.min(count - 1, i)) * sceneMs);
    },
    [apply, count, sceneMs],
  );
  const next = useCallback(() => {
    if (s.current.scene + 1 >= count) return false;
    seek(s.current.scene + 1);
    return true;
  }, [count, seek]);
  const prev = useCallback(() => seek(s.current.scene - 1), [seek]);
  const hold = useCallback((on: boolean) => {
    s.current.holding = on;
  }, []);

  // the clock
  useEffect(() => {
    apply(s.current.t);
    if (!auto) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const st = s.current;
      const dt = Math.max(0, Math.min(now - last, 50));
      last = now;
      if (st.holding || st.hidden || st.t >= total) return;
      apply(Math.min(total, st.t + dt));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [apply, auto, total]);

  // pause while the tab is hidden
  useEffect(() => {
    const on = () => {
      s.current.hidden = document.hidden;
    };
    on();
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);

  return useMemo(() => ({ time, local, scene, seek, next, prev, hold, ended }), [time, local, scene, seek, next, prev, hold, ended]);
}
