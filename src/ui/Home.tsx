import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Camera, Download, Lock, Palette, Rows3, ShieldCheck, Sparkles, Upload, UserX, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { STICKERS, stickerDataUrl } from '../assets/stickers';
import type { FormatId } from '../film/types';
import { FilmCanvas } from './FilmCanvas';
import { previewDoc } from './previewDocs';

interface Props {
  onStart: (look?: { format: FormatId; frames?: number; filterId: string }) => void;
}

const sticker = (id: string) => stickerDataUrl(STICKERS.find((s) => s.id === id)!);

const LOOKS: { format: FormatId; frames: number; filter: string; offset: number; name: string }[] = [
  { format: 'strip', frames: 4, filter: 'sunday', offset: 0, name: 'Sunday strip' },
  { format: 'instant', frames: 1, filter: 'flash', offset: 2, name: 'Flash instant' },
  { format: 'film35', frames: 3, filter: 'noir', offset: 1, name: 'Noir 35mm' },
  { format: 'strip', frames: 3, filter: 'cherry', offset: 3, name: 'Cherry strip' },
  { format: 'instant', frames: 2, filter: 'golden', offset: 1, name: 'Golden instant' },
  { format: 'film35', frames: 3, filter: 'tape', offset: 2, name: 'Tape 35mm' },
  { format: 'strip', frames: 4, filter: 'cyan', offset: 2, name: 'Cyan strip' },
  { format: 'instant', frames: 1, filter: 'dusk', offset: 3, name: 'Dusk instant' },
];

const STEPS = [
  { Icon: Rows3, label: 'Pick', color: 'bg-lilac' },
  { Icon: Camera, label: 'Snap', color: 'bg-pop' },
  { Icon: Wand2, label: 'Style', color: 'bg-mint' },
  { Icon: Download, label: 'Save', color: 'bg-lemon' },
];

export function Home({ onStart }: Props) {
  const reduce = useReducedMotion();
  const [printKey, setPrintKey] = useState(0);
  const heroDoc = previewDoc('strip', 4, 'sunday', 0);

  return (
    <div className="relative">
      {/* ---------- top bar ---------- */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <a href="#/" className="flex items-center gap-2 font-display text-xl font-extrabold" aria-label="PortableBooth home">
          <span className="grid size-10 place-items-center rounded-xl border-[2.5px] border-line bg-lemon text-ink shadow-[0_3px_0_var(--shadow)]">
            <Camera size={22} aria-hidden />
          </span>
          PortableBooth
        </a>
        <button className="btn btn-sm btn-primary" onClick={() => onStart()}>
          <Camera size={20} aria-hidden /> Start
        </button>
      </header>

      {/* ---------- hero ---------- */}
      <section className="mx-auto grid max-w-6xl items-center gap-8 px-5 pb-14 pt-4 md:grid-cols-[1.1fr_0.9fr] md:pt-10">
        <div className="relative z-10 order-2 md:order-1">
          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 120, damping: 16, delay: 0.1 }}
            className="font-display text-[clamp(3.2rem,11vw,7.2rem)] font-extrabold leading-[0.9] tracking-tight"
          >
            Your booth,
            <br />
            <span className="relative inline-block">
              anywhere.
              <svg className="absolute -bottom-2 left-0 w-full text-pop" viewBox="0 0 300 16" fill="none" aria-hidden>
                <path d="M3 10c40-9 80 7 120-2s90-4 174 2" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
              </svg>
            </span>
          </motion.h1>
          <p className="mt-6 max-w-md text-xl font-semibold text-muted">Snap. Style. Print-ready film.</p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button className="btn btn-primary btn-lg pulse" onClick={() => onStart()}>
              <Camera size={28} aria-hidden /> Start
              <ArrowRight size={24} aria-hidden />
            </button>
            <button className="btn btn-lg" onClick={() => onStart()}>
              <Upload size={26} aria-hidden /> Upload
            </button>
          </div>
          <ul className="mt-8 flex flex-wrap gap-3 text-sm font-bold" aria-label="Privacy">
            {[
              { Icon: Lock, t: 'On your device' },
              { Icon: UserX, t: 'No sign-up' },
              { Icon: ShieldCheck, t: 'Nothing stored' },
            ].map(({ Icon, t }) => (
              <li key={t} className="inline-flex items-center gap-2 rounded-full border-2 border-line bg-surface px-3.5 py-2">
                <Icon size={18} aria-hidden /> {t}
              </li>
            ))}
          </ul>
        </div>

        {/* the booth: a strip prints out of the slot */}
        <div className="relative order-1 mx-auto w-full max-w-[22rem] md:order-2">
          {[
            { id: 'star', cls: '-left-6 top-10 size-16', r: '-12deg', d: '0s' },
            { id: 'heart', cls: '-right-5 top-40 size-14', r: '10deg', d: '.8s' },
            { id: 'sparkle', cls: '-right-2 -top-3 size-12', r: '0deg', d: '.4s' },
            { id: 'smile', cls: '-left-8 bottom-28 size-14', r: '8deg', d: '1.2s' },
          ].map((s) => (
            <img
              key={s.id}
              src={sticker(s.id)}
              alt=""
              aria-hidden
              className={`bob absolute z-20 ${s.cls}`}
              style={{ ['--r' as string]: s.r, animationDelay: s.d }}
            />
          ))}
          <div className="relative rounded-[2rem] border-[3px] border-line bg-ink px-4 pb-5 pt-5 shadow-[0_8px_0_var(--shadow)]">
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="flex gap-1.5" aria-hidden>
                <i className="size-3 rounded-full bg-pop" />
                <i className="size-3 rounded-full bg-lemon" />
                <i className="size-3 rounded-full bg-mint" />
              </span>
              <span className="font-display text-xs font-bold tracking-widest text-lemon">BOOTH</span>
            </div>
            {/* slot */}
            <div className="relative z-10 mx-auto h-4 w-[88%] rounded-full bg-black shadow-[inset_0_2px_6px_rgba(0,0,0,.9),0_0_0_3px_#2f2d63]" aria-hidden />
            <button
              type="button"
              onClick={() => setPrintKey((k) => k + 1)}
              aria-label="Print the sample strip again"
              className="relative -mt-2 block w-full cursor-pointer overflow-hidden rounded-b-2xl pb-3 pt-3"
              style={{ height: 'min(66vw, 24rem)' }}
            >
              <div key={printKey} className={reduce ? '' : 'printing'}>
                <div className={reduce ? '' : 'sway'} style={{ height: '100%' }}>
                  <FilmCanvas doc={heroDoc} width={150} label="Sample film strip with four photos" className="mx-auto" />
                </div>
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* ---------- how it works ---------- */}
      <section aria-label="How it works" className="mx-auto max-w-6xl px-5 py-10">
        <ol className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {STEPS.map(({ Icon, label, color }, i) => (
            <motion.li
              key={label}
              initial={reduce ? false : { opacity: 0, y: 36, rotate: i % 2 ? 2 : -2 }}
              whileInView={{ opacity: 1, y: 0, rotate: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ type: 'spring', stiffness: 140, damping: 15, delay: i * 0.07 }}
              className="panel flex flex-col items-center gap-4 px-4 py-7"
            >
              <motion.span
                whileHover={reduce ? undefined : { rotate: [0, -10, 10, 0], scale: 1.08 }}
                className={`grid size-20 place-items-center rounded-3xl border-[2.5px] border-line text-ink ${color}`}
              >
                <Icon size={38} aria-hidden />
              </motion.span>
              <span className="font-display text-2xl font-extrabold">{label}</span>
            </motion.li>
          ))}
        </ol>
      </section>

      {/* ---------- looks ---------- */}
      <section aria-labelledby="looks" className="py-10">
        <div className="mx-auto mb-6 flex max-w-6xl items-center gap-3 px-5">
          <span className="grid size-11 place-items-center rounded-2xl border-[2.5px] border-line bg-lilac text-ink" aria-hidden>
            <Palette size={24} />
          </span>
          <h2 id="looks" className="font-display text-3xl font-extrabold">Pick a look</h2>
        </div>
        <div className="marquee-wrap no-scrollbar overflow-x-auto py-4">
          <ul className="marquee flex gap-6 px-5" aria-label="Looks you can start from">
            {[...LOOKS, ...LOOKS].map((l, i) => (
              <li key={i} aria-hidden={i >= LOOKS.length}>
                <button
                  onClick={() => onStart({ format: l.format, frames: l.frames, filterId: l.filter })}
                  tabIndex={i >= LOOKS.length ? -1 : 0}
                  aria-label={`Start with ${l.name}`}
                  className="group flex h-[17rem] w-[11rem] flex-col items-center justify-center rounded-[1.6rem] border-[2.5px] border-line bg-surface p-3 shadow-[0_5px_0_var(--shadow)] transition-transform hover:-translate-y-1.5 hover:rotate-1 active:translate-y-0.5"
                >
                  <FilmCanvas doc={previewDoc(l.format, l.frames, l.filter, l.offset)} width={l.format === 'film35' ? 74 : l.format === 'instant' ? 108 : 70} label={l.name} />
                  <span className="mt-2 inline-flex items-center gap-1 text-sm font-extrabold">
                    <Sparkles size={14} aria-hidden /> {l.name.split(' ')[0]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- final cta ---------- */}
      <section className="mx-auto max-w-6xl px-5 pb-20 pt-6">
        <div className="panel relative overflow-hidden bg-ink px-6 py-12 text-center text-white md:py-16" style={{ background: 'var(--ink)', borderColor: 'var(--lemon)' }}>
          <img src={sticker('sparkle')} alt="" aria-hidden className="bob absolute left-6 top-6 size-12" />
          <img src={sticker('star')} alt="" aria-hidden className="bob absolute bottom-6 right-8 size-14" style={{ animationDelay: '.6s' }} />
          <h2 className="font-display text-4xl font-extrabold md:text-6xl">Ready?</h2>
          <button className="btn btn-primary btn-lg mt-8" onClick={() => onStart()}>
            <Camera size={28} aria-hidden /> Start
          </button>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-5 pb-10 text-sm font-semibold text-muted">
        <Lock size={16} aria-hidden /> Photos never leave your device.
      </footer>
    </div>
  );
}
