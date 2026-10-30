#!/usr/bin/env node
/**
 * Builds the lazy-loaded sticker packs from curated icon lists.
 *
 *   Phosphor Icons ("-fill" variants, MIT)   -> src/assets/packs/ph-*.json      (mono, tintable)
 *   Microsoft Fluent Emoji Flat (MIT)        -> src/assets/packs/emoji-*.json   (full colour)
 *   + src/assets/packs/manifest.json         (names only, so the UI can list packs without loading them)
 *
 * Run with `npm run packs`. The output is committed; this script is only needed when the lists below change.
 * Exits non-zero when a pack ends up with fewer than 20 entries or when any svg violates the CSP-safety rules.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src/assets/packs');
const MIN_PACK = 20;
const MAX_PACK_BYTES = 120 * 1024;

const words = (s) => s.trim().split(/\s+/);

/* ------------------------------------------------------------------ Phosphor (mono) */
const PH_PACKS = [
  {
    id: 'ph-love', label: 'Love',
    names: words(`
      heart heart-straight heart-half heart-break heart-straight-break hand-heart heartbeat list-heart calendar-heart
      envelope envelope-open gift champagne cheers balloon confetti
      smiley smiley-wink smiley-sticker smiley-melting smiley-nervous smiley-angry smiley-sad smiley-x-eyes smiley-meh
      mask-happy mask-sad hand-peace hands-clapping hands-praying thumbs-up thumbs-down hand-waving hand-fist hand-pointing handshake
      baby
    `),
  },
  {
    id: 'ph-nature', label: 'Nature',
    names: words(`
      sun sun-dim sun-horizon moon moon-stars cloud cloud-sun cloud-moon cloud-rain cloud-lightning cloud-snow
      rainbow rainbow-cloud snowflake wind drop flower flower-lotus flower-tulip leaf plant potted-plant tree tree-palm
      tree-evergreen cactus clover mountains waves planet shooting-star meteor butterfly bird cat dog fish paw-print
      rabbit horse feather fire flame island campfire tornado umbrella
    `),
  },
  {
    id: 'ph-music', label: 'Music',
    names: words(`
      music-note music-note-simple music-notes music-notes-simple headphones headset vinyl-record disc cassette-tape
      microphone microphone-stage guitar piano-keys speaker-hifi speaker-high radio equalizer waveform metronome playlist
      play pause skip-forward skip-back fast-forward rewind record shuffle repeat disco-ball
      television film-strip film-reel film-slate video-camera popcorn ticket
    `),
  },
  {
    id: 'ph-travel', label: 'Travel',
    names: words(`
      airplane airplane-tilt airplane-takeoff airplane-landing airplane-in-flight map-pin map-pin-area map-trifold compass
      globe-hemisphere-west globe suitcase-rolling suitcase backpack car taxi bus train subway tram bicycle motorcycle
      scooter sailboat boat anchor lighthouse tent beach-ball sunglasses binoculars signpost traffic-cone steering-wheel
      gas-pump parachute swimming-pool umbrella-simple van jeep bed castle-turret bridge house church buildings storefront
    `),
  },
  {
    id: 'ph-tech', label: 'Tech',
    names: words(`
      camera camera-rotate aperture webcam image images selfie-placeholder game-controller joystick device-mobile
      device-mobile-camera laptop monitor keyboard mouse battery-full battery-charging battery-low battery-high
      wifi-high wifi-slash bluetooth cell-signal-full qr-code robot alien cpu lightbulb plug rocket rocket-launch
      flying-saucer atom code terminal-window gif high-definition closed-captioning sticker magic-wand
      eyedropper paint-brush palette lasso scissors printer power
    `).filter((n) => n !== 'selfie-placeholder'),
  },
  {
    id: 'ph-symbols', label: 'Symbols',
    names: words(`
      star star-four star-half sparkle asterisk lightning crown crown-simple diamond seal-check circle-wavy-check
      check-circle check check-fat checks x x-circle plus plus-circle minus equals percent hash at quotes question
      exclamation-mark warning info tag bookmark flag flag-pennant trophy medal target crosshair infinity peace yin-yang
      pentagram club spade dice-five cards puzzle-piece key lock bell bell-ringing eye eyes ghost skull pi
      hexagon triangle circle square polygon pentagon octagon
    `),
  },
  {
    id: 'ph-arrows', label: 'Arrows',
    names: words(`
      arrow-up arrow-down arrow-left arrow-right arrow-up-right arrow-down-right arrow-up-left arrow-down-left
      arrow-u-up-right arrow-u-up-left arrow-bend-up-right arrow-bend-up-left arrow-bend-down-right arrow-elbow-down-right
      arrow-arc-right arrow-arc-left arrow-clockwise arrow-counter-clockwise arrows-clockwise arrow-fat-right arrow-fat-left
      arrow-fat-up arrow-fat-down arrow-circle-right arrow-circle-up arrow-circle-left arrow-circle-down arrow-square-out
      caret-right caret-double-right caret-circle-right cursor cursor-click navigation-arrow arrows-out arrows-in
      arrows-out-cardinal swap shuffle-angular arrows-left-right arrows-down-up trend-up trend-down share-fat share
      paper-plane-tilt paper-plane-right sign-out spiral path flow-arrow
    `),
  },
  {
    id: 'ph-food', label: 'Food',
    names: words(`
      coffee coffee-bean tea-bag pizza hamburger ice-cream popsicle cookie bread egg egg-crack cheese avocado carrot
      cherries orange orange-slice pepper fish-simple shrimp bowl-food bowl-steam cooking-pot fork-knife knife chef-hat
      wine martini beer-stein beer-bottle pint-glass brandy onigiri jar grains pill hand-soap
    `),
  },
];

/* ------------------------------------------------------------------ Fluent Emoji Flat (colour) */
const EMOJI_PACKS = [
  {
    id: 'emoji-faces', label: 'Faces',
    names: words(`
      grinning-face grinning-face-with-big-eyes grinning-face-with-smiling-eyes beaming-face-with-smiling-eyes
      grinning-squinting-face grinning-face-with-sweat face-with-tears-of-joy rolling-on-the-floor-laughing
      slightly-smiling-face upside-down-face winking-face smiling-face-with-smiling-eyes smiling-face-with-halo
      smiling-face-with-hearts smiling-face-with-heart-eyes star-struck face-blowing-a-kiss kissing-face smiling-face
      face-savoring-food winking-face-with-tongue zany-face squinting-face-with-tongue money-mouth-face hugging-face
      face-with-hand-over-mouth shushing-face thinking-face smirking-face unamused-face face-with-rolling-eyes
      relieved-face sleepy-face sleeping-face smiling-face-with-sunglasses nerd-face partying-face disguised-face
      pleading-face loudly-crying-face crying-face face-screaming-in-fear exploding-head face-with-symbols-on-mouth
      angry-face smiling-face-with-horns hot-face cold-face melting-face saluting-face face-holding-back-tears
      woozy-face clown-face
    `),
  },
  {
    id: 'emoji-love', label: 'Love',
    names: words(`
      red-heart orange-heart yellow-heart green-heart blue-heart light-blue-heart purple-heart pink-heart black-heart
      white-heart brown-heart grey-heart broken-heart heart-on-fire mending-heart two-hearts revolving-hearts
      beating-heart growing-heart sparkling-heart heart-with-arrow heart-with-ribbon heart-decoration heart-exclamation
      heart-hands kiss-mark love-letter love-you-gesture smiling-cat-with-heart-eyes rose bouquet cherry-blossom ring
      gem-stone lipstick teddy-bear victory-hand crossed-fingers folded-hands clapping-hands raising-hands thumbs-up
      waving-hand flexed-biceps sign-of-the-horns call-me-hand ok-hand
    `),
  },
  {
    id: 'emoji-party', label: 'Party',
    names: words(`
      party-popper confetti-ball balloon wrapped-gift birthday-cake cupcake fireworks sparkler sparkles glowing-star
      dizzy collision high-voltage fire hundred-points trophy 1st-place-medal crown clinking-glasses
      bottle-with-popping-cork cocktail-glass tropical-drink mirror-ball guitar microphone headphone musical-notes
      musical-note drum saxophone trumpet video-game joystick game-die clapper-board camera-with-flash sunglasses
      crystal-ball magic-wand piata ribbon circus-tent ferris-wheel roller-coaster carousel-horse performing-arts
      artist-palette selfie
    `),
  },
  {
    id: 'emoji-nature', label: 'Nature',
    names: words(`
      sun sun-with-face full-moon-face crescent-moon full-moon star shooting-star comet milky-way night-with-stars cloud
      sun-behind-cloud cloud-with-rain cloud-with-lightning rainbow snowflake snowman droplet water-wave volcano mountain
      snow-capped-mountain sunrise sunset hibiscus sunflower tulip blossom white-flower herb seedling four-leaf-clover
      maple-leaf fallen-leaf cactus palm-tree evergreen-tree mushroom potted-plant butterfly honeybee lady-beetle snail
      turtle frog cat-face dog-face fox panda koala unicorn bear rabbit-face hamster tiger-face lion cow-face pig-face
      monkey-face penguin baby-chick owl flamingo swan dolphin whale octopus tropical-fish blowfish jellyfish sloth otter
      hedgehog llama giraffe
    `),
  },
  {
    id: 'emoji-food', label: 'Food',
    names: words(`
      red-apple green-apple banana watermelon grapes strawberry peach cherries lemon pineapple mango kiwi-fruit avocado
      tomato hot-pepper carrot broccoli pizza hamburger french-fries hot-dog taco burrito sandwich spaghetti sushi
      steaming-bowl cooked-rice rice-ball dumpling fried-shrimp popcorn doughnut cookie shortcake pie chocolate-bar
      candy lollipop ice-cream soft-ice-cream shaved-ice pancakes waffle croissant bagel pretzel bread egg cheese-wedge
      bacon cut-of-meat poultry-leg bubble-tea hot-beverage teapot beer-mug wine-glass glass-of-milk cup-with-straw
      coconut fortune-cookie honey-pot
    `),
  },
  {
    id: 'emoji-travel', label: 'Travel',
    names: words(`
      airplane small-airplane airplane-departure rocket flying-saucer helicopter automobile taxi racing-car police-car
      bus train bullet-train tram metro ship sailboat speedboat anchor bicycle motor-scooter motorcycle kick-scooter
      skateboard fuel-pump world-map globe-showing-americas globe-showing-europe-africa globe-showing-asia-australia
      compass camping tent beach-with-umbrella desert-island national-park statue-of-liberty tokyo-tower castle hotel
      house-with-garden luggage sunrise-over-mountains cityscape bridge-at-night japanese-castle moai mount-fuji
    `),
  },
  {
    id: 'emoji-symbols', label: 'Symbols',
    names: words(`
      check-mark-button cross-mark red-exclamation-mark red-question-mark double-exclamation-mark eight-pointed-star
      sparkle recycling-symbol infinity peace-symbol yin-yang red-circle orange-circle yellow-circle green-circle
      blue-circle purple-circle black-circle white-circle red-square new-button free-button cool-button ok-button
      sos-button soon-arrow top-arrow up-arrow right-arrow left-arrow down-arrow heavy-dollar-sign bell loudspeaker
      speech-balloon thought-balloon right-anger-bubble zzz warning prohibited no-entry spade-suit club-suit diamond-suit
      heart-suit joker bullseye magnet light-bulb key locked label pushpin paperclip link hourglass-done alarm-clock
      stopwatch
    `),
  },
];

/* ------------------------------------------------------------------ sanitiser */
const FORBIDDEN = [
  [/<style/i, '<style'],
  [/style\s*=/i, 'style='],
  [/<script/i, '<script'],
  [/foreignObject/i, 'foreignObject'],
  [/href\s*=/i, 'href= / xlink:href'],
  [/\son[a-z]+\s*=/i, 'on* handler'],
  [/<image/i, '<image'],
  [/<use[\s>]/i, '<use'],
  [/url\(\s*['"]?\s*(https?:|data:|\/\/)/i, 'external url()'],
  [/url\(\s*['"]?(?!#)/i, 'non-fragment url()'],
  [/javascript:/i, 'javascript:'],
  [/<!(entity|doctype)/i, 'entity/doctype'],
  [/@import/i, '@import'],
];

function sanitiseCheck(name, svg) {
  const problems = [];
  for (const [re, label] of FORBIDDEN) if (re.test(svg)) problems.push(label);
  if (!svg.startsWith('<svg ') || !svg.endsWith('</svg>')) problems.push('not a standalone <svg>');
  return problems.map((p) => `${name}: ${p}`);
}

const minify = (s) =>
  s
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s*\n\s*/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim();

/* ------------------------------------------------------------------ build */
function loadSet(pkg) {
  const j = JSON.parse(readFileSync(join(ROOT, 'node_modules/@iconify-json', pkg, 'icons.json'), 'utf8'));
  return j;
}

function resolveIcon(set, name) {
  let icon = set.icons[name];
  if (!icon && set.aliases?.[name]) {
    const a = set.aliases[name];
    icon = { ...set.icons[a.parent], ...a };
  }
  return icon;
}

const iconSvg = (set, icon, { mono }) => {
  const w = icon.width ?? set.width ?? 24;
  const h = icon.height ?? set.height ?? 24;
  // Width/height at 256 on the long edge so the <img> has a crisp natural size for canvas drawImage.
  const scale = 256 / Math.max(w, h);
  const rw = Math.round(w * scale);
  const rh = Math.round(h * scale);
  let body = icon.body;
  if (mono) body = body.replace(/currentColor/g, '#000000');
  const fill = mono ? ' fill="#000000"' : '';
  return minify(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${rw}" height="${rh}"${fill}>${body}</svg>`);
};

const errors = [];
const manifest = [];
const stats = [];
const seenAcrossPacks = new Map();

mkdirSync(OUT, { recursive: true });
// remove stale pack files so the directory always mirrors the manifest
for (const f of readdirSync(OUT)) if (f.endsWith('.json')) unlinkSync(join(OUT, f));

function buildFamily(family, setName, packs, suffix, mono) {
  const set = loadSet(setName);
  for (const pack of packs) {
    const out = {};
    const missing = [];
    const seen = new Set();
    for (const name of pack.names) {
      if (seen.has(name)) { console.warn(`  [dup] ${pack.id}: ${name}`); continue; }
      seen.add(name);
      const icon = resolveIcon(set, name + suffix);
      if (!icon) { missing.push(name); continue; }
      const svg = iconSvg(set, icon, { mono });
      const problems = sanitiseCheck(`${pack.id}/${name}`, svg);
      if (problems.length) { errors.push(...problems); continue; }
      out[name] = svg;
      const key = `${family}:${name}`;
      if (seenAcrossPacks.has(key)) console.warn(`  [note] ${name} appears in ${seenAcrossPacks.get(key)} and ${pack.id}`);
      else seenAcrossPacks.set(key, pack.id);
    }
    if (missing.length) console.warn(`  [missing] ${pack.id}: ${missing.join(', ')}`);
    const names = Object.keys(out);
    if (names.length < MIN_PACK) errors.push(`${pack.id}: only ${names.length} entries (< ${MIN_PACK})`);
    const json = JSON.stringify(out);
    if (json.length > MAX_PACK_BYTES) errors.push(`${pack.id}: ${(json.length / 1024).toFixed(1)}KB exceeds ${MAX_PACK_BYTES / 1024}KB, split it`);
    writeFileSync(join(OUT, `${pack.id}.json`), json + '\n');
    manifest.push({ id: pack.id, family, label: pack.label, mono, names });
    stats.push({ id: pack.id, count: names.length, raw: json.length, gz: gzipSync(json).length, missing: missing.length });
  }
}

buildFamily('icons', 'ph', PH_PACKS, '-fill', true);
buildFamily('emoji', 'fluent-emoji-flat', EMOJI_PACKS, '', false);

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest) + '\n');

const kb = (n) => (n / 1024).toFixed(1).padStart(7) + ' KB';
console.log('\npack            count      raw       gzip   missing');
let tc = 0, tr = 0, tg = 0;
for (const s of stats) {
  console.log(`${s.id.padEnd(15)} ${String(s.count).padStart(4)} ${kb(s.raw)} ${kb(s.gz)}   ${s.missing}`);
  tc += s.count; tr += s.raw; tg += s.gz;
}
console.log(`${'TOTAL'.padEnd(15)} ${String(tc).padStart(4)} ${kb(tr)} ${kb(tg)}`);

if (errors.length) {
  console.error('\nBUILD FAILED:\n  ' + errors.join('\n  '));
  process.exit(1);
}
