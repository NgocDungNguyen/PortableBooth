import { useReducedMotion, useTransform, type MotionValue, type Transition, type Variants } from 'motion/react';

/**
 * Shared motion language. Rules: transform + opacity only, nothing animates layout, the WebGL canvas,
 * filter thumbnails, or anything while the user is editing. Springs are stiff and well damped (no wobble),
 * durations sit between 180 and 260 ms.
 */

export const SPRING = {
  /** buttons, chips, small pops */
  snappy: { type: 'spring', stiffness: 380, damping: 30 } satisfies Transition,
  /** cards and sheets */
  soft: { type: 'spring', stiffness: 260, damping: 28 } satisfies Transition,
  /** a little overshoot for "landing" things */
  pop: { type: 'spring', stiffness: 340, damping: 22 } satisfies Transition,
};
export const DUR = { fast: 0.18, base: 0.22, slow: 0.26 } as const;
export const EASE_OUT = [0.2, 0.8, 0.2, 1] as const;

/** true when motion is welcome (the user has not asked the OS for reduced motion) */
export function useMotionOK(): boolean {
  return !useReducedMotion();
}

/** Route/page transition props: opacity + 12px rise (opacity only when motion is reduced). */
export function routeMotion(ok: boolean) {
  return {
    initial: { opacity: 0, y: ok ? 12 : 0 },
    animate: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE_OUT } },
    exit: { opacity: 0, y: 0, transition: { duration: DUR.fast, ease: 'easeIn' as const } },
  };
}

/** Parent variants that stagger their children (children use `rise` / `pop`). */
export const staggerParent = (step = 0.06, delay = 0): Variants => ({
  hide: {},
  show: { transition: { staggerChildren: step, delayChildren: delay } },
});
export const rise = (ok: boolean, dy = 16): Variants => ({
  hide: { opacity: 0, y: ok ? dy : 0 },
  show: { opacity: 1, y: 0, transition: { duration: DUR.slow + 0.12, ease: EASE_OUT } },
});
export const pop = (ok: boolean): Variants => ({
  hide: { opacity: 0, scale: ok ? 0.7 : 1 },
  show: { opacity: 1, scale: 1, transition: ok ? SPRING.pop : { duration: DUR.fast } },
});
/** scroll-reveal props for sections below the fold (once) */
export const reveal = (ok: boolean, delay = 0) => ({
  initial: { opacity: 0, y: ok ? 18 : 0 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '0px 0px -8% 0px' },
  transition: { duration: DUR.slow + 0.1, ease: EASE_OUT, delay },
});

/* ---------- time-driven animation (the intro reel) ----------
 * Elements are pure functions of a scene clock (a MotionValue in ms), so pausing and seeking are exact and
 * nothing re-renders per frame.
 */

export const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const linear = (t: number) => t;
/** quantised ease: reads like a printer feeding paper */
export const steps = (n: number) => (t: number) => Math.round(clamp01(t) * n) / n;

/** closed-form damped spring from 0 to 1 (seconds in, position out; overshoots when under-damped) */
export function springAt(sec: number, stiffness = 340, damping = 24, mass = 1): number {
  if (sec <= 0) return 0;
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  if (zeta >= 1) return 1 - Math.exp(-w0 * sec) * (1 + w0 * sec);
  const wd = w0 * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w0 * sec) * (Math.cos(wd * sec) + ((zeta * w0) / wd) * Math.sin(wd * sec));
}

/** 0..1 progress of a timed segment [start, start+dur] of the clock */
export function useProgress(clock: MotionValue<number>, start: number, dur: number, ease: (t: number) => number = easeOutCubic): MotionValue<number> {
  return useTransform(clock, (v) => ease(clamp01((v - start) / dur)));
}
/** spring progress that starts at `start` ms (can overshoot past 1) */
export function useSpringProgress(clock: MotionValue<number>, start: number, stiffness = 340, damping = 24): MotionValue<number> {
  return useTransform(clock, (v) => springAt((v - start) / 1000, stiffness, damping));
}
/** linear map of a progress value to [a, b] (does not clamp, so springs can overshoot) */
export function useLerp(p: MotionValue<number>, a: number, b: number): MotionValue<number> {
  return useTransform(p, (v) => a + (b - a) * v);
}
