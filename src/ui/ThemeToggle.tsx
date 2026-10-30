import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

export type ThemeMode = 'auto' | 'light' | 'dark';
const Ctx = createContext<{ mode: ThemeMode; setMode: (m: ThemeMode) => void }>({ mode: 'auto', setMode: () => undefined });
export const useTheme = () => useContext(Ctx);

/** Theme lives in memory only: nothing is stored, so every visit starts on the device setting. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('auto');
  useEffect(() => {
    const el = document.documentElement;
    if (mode === 'auto') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', mode);
  }, [mode]);
  const value = useMemo(() => ({ mode, setMode }), [mode]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const OPTIONS: { id: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { id: 'light', label: 'Light', Icon: Sun },
  { id: 'auto', label: 'Auto', Icon: Monitor },
  { id: 'dark', label: 'Dark', Icon: Moon },
];

/** Sun / Auto / Moon segmented control */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { mode, setMode } = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className={`seg !p-0.5 ${className}`}>
      {OPTIONS.map(({ id, label, Icon }) => (
        <button key={id} role="radio" aria-checked={mode === id} aria-label={`${label} theme`} title={`${label} theme`} onClick={() => setMode(id)} className="!min-h-9 !min-w-9 !justify-center !px-2">
          <Icon size={16} aria-hidden />
        </button>
      ))}
    </div>
  );
}
