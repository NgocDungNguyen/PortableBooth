import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Camera, EyeOff, Heart, MapPinOff, Music2, Printer, ShieldCheck, Smartphone, Sparkles, WifiOff } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { rise, staggerParent, useMotionOK } from './motion';
import { SettingsButton } from './Settings';

const PROMISES = [
  { Icon: Smartphone, title: 'Stays on your device', body: 'Photos live in memory and are gone when you close the tab. No accounts, no uploads, no cloud.' },
  { Icon: WifiOff, title: 'Makes no network calls', body: 'A strict security policy blocks every outside request, so nothing can slip out even by accident.' },
  { Icon: MapPinOff, title: 'Drops hidden data', body: 'Location and camera details are stripped when a photo comes in and are never written on export.' },
  { Icon: EyeOff, title: 'No tracking at all', body: 'No cookies, no storage, no analytics. Settings are remembered only until you close the tab.' },
];

const CREDITS: { what: string; who: string; licence: string }[] = [
  { what: 'Typefaces', who: 'Geist, Bricolage Grotesque, Instrument Serif and friends, self-hosted via Fontsource', licence: 'SIL OFL 1.1' },
  { what: 'Sticker icons', who: 'Phosphor Icons and Microsoft Fluent Emoji', licence: 'MIT' },
  { what: 'Interface icons', who: 'Lucide', licence: 'ISC' },
  { what: 'Music', who: 'Original tracks composed and generated in code for PortableBooth', licence: 'Original' },
  { what: 'QR codes', who: 'qrcode-generator by Kazuhiko Arase', licence: 'MIT' },
  { what: 'QR scanner', who: 'jsQR by Cosmo Wolfe', licence: 'Apache-2.0' },
  { what: 'Built with', who: 'React, Motion, Tailwind CSS and Vite', licence: 'MIT' },
];

/** #about: who made PortableBooth, why it exists and what it promises. */
export function About({ onStart }: { onStart: () => void }) {
  const ok = useMotionOK();
  const h1 = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    window.scrollTo({ top: 0 });
    h1.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="about relative min-h-dvh overflow-x-clip bg-bg">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[34rem] overflow-hidden">
        <div className="blob drift-a about-blob-1" />
        <div className="blob drift-b about-blob-2" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-[60rem] items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <a href="#home" className="btn btn-ghost -ml-2 !px-2 font-display text-base font-semibold">
          <ArrowLeft size={18} aria-hidden /> PortableBooth
        </a>
        <div className="flex items-center gap-2">
          <SettingsButton />
          <button type="button" className="btn btn-primary" onClick={onStart}>Start</button>
        </div>
      </header>

      <motion.article variants={staggerParent(0.06, 0.02)} initial="hide" animate="show" className="relative z-10 mx-auto max-w-[60rem] px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
        <motion.p variants={rise(ok, 8)} className="about-chip"><Sparkles size={14} aria-hidden /> About</motion.p>
        <motion.h1 variants={rise(ok)} ref={h1} tabIndex={-1} className="about-h1 mt-4 font-display font-bold outline-none">
          About <span className="grad-text">PortableBooth</span>
        </motion.h1>
        <motion.p variants={rise(ok)} className="mt-5 max-w-[38rem] text-lg leading-relaxed text-muted">
          A free photobooth that lives in your browser. Pick a film, snap or upload, make it yours, then save it, print it or share it.
        </motion.p>

        {/* credit */}
        <motion.section variants={rise(ok)} aria-labelledby="about-maker" className="about-maker mt-10">
          <div className="about-avatar" aria-hidden>JN</div>
          <div className="min-w-0">
            <p id="about-maker" className="label uppercase tracking-[0.08em]">Created by</p>
            <p className="mt-1 font-display text-xl font-semibold leading-snug sm:text-2xl">
              June Nguyen <span className="text-muted">·</span> <span className="whitespace-nowrap">RMIT University Vietnam,</span> <span className="whitespace-nowrap">Hà Nội</span>
            </p>
            <p className="mt-1 text-sm text-muted">June Nguyen – RMIT Ha Noi</p>
          </div>
        </motion.section>

        {/* why */}
        <motion.section variants={rise(ok)} aria-labelledby="about-why" className="mt-14 grid gap-8 md:grid-cols-[0.85fr_1.15fr] md:gap-12">
          <div>
            <h2 id="about-why" className="text-3xl font-semibold leading-tight sm:text-4xl">Bring the photobooth home.</h2>
          </div>
          <div className="space-y-4 text-[1.02rem] leading-relaxed text-muted">
            <p>
              A photobooth strip is a tiny ritual: a few seconds, a few faces, one keepsake. PortableBooth puts that ritual on your phone or laptop,
              free, with no sign-up and nothing to install.
            </p>
            <p>
              Everything you make is designed at real print size. Save a 300 DPI file today, and print it on real film later with a
              {' '}<span className="font-semibold text-text">PortableBooth printer</span>.
            </p>
            <p className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4 text-text">
              <ShieldCheck size={20} aria-hidden className="mt-0.5 shrink-0 text-accent" />
              <span>Nothing leaves your device. Your photos stay yours.</span>
            </p>
          </div>
        </motion.section>

        {/* privacy */}
        <motion.section variants={rise(ok)} aria-labelledby="about-privacy" className="mt-14">
          <h2 id="about-privacy" className="text-2xl font-semibold sm:text-3xl">Private by design</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {PROMISES.map(({ Icon, title, body }) => (
              <li key={title} className="about-card">
                <span className="feature-icon shrink-0" aria-hidden><Icon size={19} /></span>
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </motion.section>

        {/* how */}
        <motion.section variants={rise(ok)} aria-label="What you can do" className="mt-14 grid gap-3 sm:grid-cols-3">
          {[
            { Icon: Camera, t: 'Snap or upload', b: 'Countdown camera or your own photos.' },
            { Icon: Sparkles, t: 'Make it yours', b: 'Film looks, frames, stickers and text.' },
            { Icon: Printer, t: 'Save, print, share', b: 'Print-ready PNG or a quick share image.' },
          ].map(({ Icon, t, b }) => (
            <div key={t} className="about-step">
              <Icon size={20} aria-hidden className="text-accent" />
              <p className="mt-3 font-semibold">{t}</p>
              <p className="mt-1 text-sm text-muted">{b}</p>
            </div>
          ))}
        </motion.section>

        {/* credits */}
        <motion.section variants={rise(ok)} aria-labelledby="about-credits" className="mt-14">
          <h2 id="about-credits" className="text-2xl font-semibold sm:text-3xl">Credits</h2>
          <dl className="about-credits mt-5">
            {CREDITS.map((c) => (
              <div key={c.what} className="about-credit">
                <dt className="font-semibold">{c.what}</dt>
                <dd className="text-sm text-muted">{c.who}</dd>
                <dd className="about-licence">{c.licence === 'Original' ? <><Music2 size={12} aria-hidden /> Original</> : c.licence}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-muted">Full licence texts ship with the source in LICENSES.md.</p>
        </motion.section>

        {/* cta */}
        <motion.section variants={rise(ok)} className="cta-block mt-16 p-7 sm:p-10">
          <div className="relative">
            <h2 className="text-3xl font-semibold leading-tight text-white sm:text-4xl">Ready for your close-up?</h2>
            <p className="mt-2 max-w-[28rem] text-white/80">It takes about a minute. Nothing to sign up for.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" className="btn btn-lg cta-btn" onClick={onStart}>
                <Camera size={20} aria-hidden /> Start <ArrowRight size={18} aria-hidden />
              </button>
              <a href="#home" className="btn btn-lg about-ghost">Home</a>
            </div>
          </div>
        </motion.section>

        <p className="mt-10 flex items-center justify-center gap-1.5 text-center text-sm text-muted">
          Made with <Heart size={14} aria-hidden className="text-[color:var(--coral)]" /><span className="sr-only-text">love</span> in Hà Nội
        </p>
      </motion.article>
    </div>
  );
}
