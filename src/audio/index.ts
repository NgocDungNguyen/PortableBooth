/**
 * Audio contract (implementation owned by the audio engineer; this stub keeps everyone compiling).
 * Browsers only allow sound after a user gesture, so everything is queued until `unlock()`.
 */
export type TrackId = string;
export interface AudioState {
  enabled: boolean;
  volume: number; // 0..1
  track: TrackId;
  unlocked: boolean;
  mode: 'off' | 'intro' | 'background';
}
export interface TrackMeta {
  id: TrackId;
  name: string;
}

export const TRACKS: TrackMeta[] = [];
const state: AudioState = { enabled: true, volume: 0.6, track: '', unlocked: false, mode: 'off' };
const subs = new Set<() => void>();

export const audio = {
  getState: (): AudioState => state,
  subscribe: (fn: () => void) => {
    subs.add(fn);
    return () => void subs.delete(fn);
  },
  /** call from any pointerdown / keydown */
  unlock: () => undefined as void,
  /** the tutorial score, synced to the intro scenes (scene index 0..n-1) */
  playIntro: () => undefined as void,
  introScene: (_index: number) => undefined as void,
  stopIntro: () => undefined as void,
  playBackground: () => undefined as void,
  setEnabled: (_on: boolean) => undefined as void,
  setVolume: (_v: number) => undefined as void,
  setTrack: (_id: TrackId) => undefined as void,
};
