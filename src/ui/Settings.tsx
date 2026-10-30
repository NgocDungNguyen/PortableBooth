import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Info, Monitor, Moon, Music2, RotateCcw, Settings2, ShieldX, Sun, Volume1, Volume2, VolumeX, X } from 'lucide-react';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as RKeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { audio, TRACKS, useAudio } from '../audio';
import { Slider } from './Slider';
import { useTheme, type ThemeMode } from './ThemeToggle';

interface Props {
  /** shows "Replay intro" */
  onReplayIntro?: () => void;
  /** shows "Clear everything" as a danger action (the studio passes it so phones keep it reachable) */
  onClear?: () => void;
  className?: string;
}

const THEMES: { id: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { id: 'light', label: 'Light', Icon: Sun },
  { id: 'auto', label: 'Auto', Icon: Monitor },
  { id: 'dark', label: 'Dark', Icon: Moon },
];

const PHONE = '(max-width: 639px)';
const isPhone = () => typeof window !== 'undefined' && !!window.matchMedia?.(PHONE).matches;
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** arrow keys move (and select) inside a radiogroup, like native radios */
function arrowNav(e: RKeyboardEvent<HTMLElement>, count: number, index: number, select: (i: number) => void) {
  const k = e.key;
  const d = k === 'ArrowRight' || k === 'ArrowDown' ? 1 : k === 'ArrowLeft' || k === 'ArrowUp' ? -1 : 0;
  if (!d && k !== 'Home' && k !== 'End') return;
  e.preventDefault();
  const next = k === 'Home' ? 0 : k === 'End' ? count - 1 : (index + d + count) % count;
  select(next);
  const group = e.currentTarget.closest('[role="radiogroup"]');
  (group?.querySelectorAll<HTMLElement>('[role="radio"]')[next])?.focus();
}

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="set-section">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="label !text-[0.72rem] uppercase tracking-[0.08em]">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Equaliser({ on }: { on: boolean }) {
  return (
    <span className="eq" data-on={on || undefined} aria-hidden>
      <span />
      <span />
      <span />
    </span>
  );
}

function Panel({ onClose, onReplayIntro, onClear, labelId }: { onClose: () => void; onReplayIntro?: () => void; onClear?: () => void; labelId: string }) {
  const { mode, setMode } = useTheme();
  const a = useAudio();
  const themeIdx = THEMES.findIndex((t) => t.id === mode);
  const trackIdx = Math.max(0, TRACKS.findIndex((t) => t.id === a.track));
  const VolIcon = a.volume === 0 ? VolumeX : a.volume < 0.5 ? Volume1 : Volume2;

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h2 id={labelId} className="font-display text-lg font-semibold">Settings</h2>
        <button type="button" className="btn btn-icon btn-ghost -mr-2 !min-h-10 !min-w-10" onClick={onClose} aria-label="Close settings">
          <X size={18} aria-hidden />
        </button>
      </div>

      <Section title="Theme">
        <div role="radiogroup" aria-label="Theme" className="seg grid w-full grid-cols-3">
          {THEMES.map(({ id, label, Icon }, i) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={mode === id}
              aria-label={`${label} theme`}
              tabIndex={mode === id || (themeIdx < 0 && i === 0) ? 0 : -1}
              onClick={() => setMode(id)}
              onKeyDown={(e) => arrowNav(e, THEMES.length, i, (n) => setMode(THEMES[n].id))}
              className="!justify-center"
            >
              <Icon size={16} aria-hidden /> {label}
            </button>
          ))}
        </div>
      </Section>

      <Section
        title="Music"
        aside={
          <button
            type="button"
            role="switch"
            aria-checked={a.enabled}
            aria-label="Background music"
            className="switch"
            onClick={() => audio.setEnabled(!a.enabled)}
          >
            <span className="switch-thumb" />
          </button>
        }
      >
        <div role="radiogroup" aria-label="Track" className={`flex flex-col gap-1 transition-opacity ${a.enabled ? '' : 'opacity-55'}`}>
          {TRACKS.map((t, i) => {
            const on = a.track === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                onClick={() => audio.setTrack(t.id)}
                onKeyDown={(e) => arrowNav(e, TRACKS.length, i, (n) => audio.setTrack(TRACKS[n].id))}
                className="track-row"
              >
                <span className="track-icon" aria-hidden>
                  {on ? <Equaliser on={a.playing && a.mode === 'background'} /> : <Music2 size={15} />}
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[0.9rem] font-semibold">{t.name}</span>
                  {t.vibe && <span className="block truncate text-xs text-muted">{t.vibe}</span>}
                </span>
              </button>
            );
          })}
        </div>
        <div className={`mt-2 ${a.enabled ? '' : 'opacity-55'}`}>
          <Slider label="Volume" icon={<VolIcon size={15} aria-hidden />} value={a.volume} min={0} max={1} step={0.05} onChange={audio.setVolume} format={(v) => `${Math.round(v * 100)}%`} />
        </div>
        {!a.unlocked && a.enabled && <p className="mt-1 text-xs text-muted">Music starts after your first tap.</p>}
        <span className="sr-only-text" aria-live="polite">{a.enabled ? `Playing ${TRACKS[trackIdx]?.name ?? ''}` : 'Music off'}</span>
      </Section>

      <div className="set-section flex flex-col gap-1">
        {onReplayIntro && (
          <button type="button" className="set-link" onClick={() => { onClose(); onReplayIntro(); }}>
            <RotateCcw size={17} aria-hidden /> Replay intro
          </button>
        )}
        <a href="#about" className="set-link" onClick={onClose}>
          <Info size={17} aria-hidden /> About PortableBooth
        </a>
        {onClear && (
          <button type="button" className="set-link set-danger" onClick={() => { onClose(); onClear(); }}>
            <ShieldX size={17} aria-hidden /> Clear everything
          </button>
        )}
      </div>
    </>
  );
}

/**
 * Gear button + settings: theme, music on/off, track, volume, replay intro, about.
 * A popover anchored to the button on larger screens, a bottom sheet on phones. Esc / outside tap closes and focus
 * goes back to the gear. Rendered in a portal so route transforms never trap the fixed layout.
 */
export function SettingsButton({ onReplayIntro, onClear, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 64, right: 16 });
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const labelId = useId();

  const place = useCallback(() => {
    const r = btn.current?.getBoundingClientRect();
    setPhone(isPhone());
    if (!r) return;
    const w = Math.min(336, window.innerWidth - 16);
    const right = Math.min(Math.max(8, window.innerWidth - r.right), window.innerWidth - w - 8);
    setPos({ top: r.bottom + 8, right });
  }, []);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) requestAnimationFrame(() => btn.current?.focus({ preventScroll: true }));
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    // focus the selected theme (the first thing in the panel that matters)
    const id = requestAnimationFrame(() => {
      const first = panel.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]') ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus({ preventScroll: true });
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
      } else if (e.key === 'Tab' && panel.current) {
        // keep focus inside while open
        const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panel.current?.contains(t) || btn.current?.contains(t)) return;
      close(false);
    };
    const onResize = () => place();
    const onHash = () => close(false);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('resize', onResize);
    window.addEventListener('hashchange', onHash);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('hashchange', onHash);
    };
  }, [open, close, place]);

  const sheetMotion = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : phone
      ? { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }
      : { initial: { opacity: 0, y: -6, scale: 0.98 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: -4, scale: 0.98 } };

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={`btn btn-icon btn-ghost ${className}`}
        aria-label="Settings"
        title="Settings"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (open) return close();
          setPhone(isPhone());
          setOpen(true);
        }}
      >
        <Settings2 size={20} aria-hidden />
      </button>
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              <div key="settings" className="settings-layer" data-phone={phone || undefined}>
                {phone && (
                  <motion.div className="settings-backdrop" aria-hidden initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} />
                )}
                <motion.div
                  ref={panel}
                  role="dialog"
                  aria-modal={phone || undefined}
                  aria-labelledby={labelId}
                  className={phone ? 'settings-sheet' : 'settings-pop'}
                  style={phone ? undefined : { top: pos.top, right: pos.right }}
                  {...sheetMotion}
                  transition={phone && !reduce ? { type: 'spring', stiffness: 380, damping: 36 } : { duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  {phone && <span className="settings-grabber" aria-hidden />}
                  <Panel onClose={() => close()} onReplayIntro={onReplayIntro} onClear={onClear} labelId={labelId} />
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
