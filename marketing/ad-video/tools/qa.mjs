// Delivery checks: streams, duration, loudness / true peak, plus QA frames every 2 s (out/qa/ or $QA_DIR).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const OUT = path.resolve(root, '..', 'out');
const QA = process.env.QA_DIR || path.join(root, 'out', 'qa');
fs.mkdirSync(QA, { recursive: true });
for (const fmt of ['9x16', '16x9']) {
  const f = path.join(OUT, `PortableBooth-ad-${fmt}.mp4`);
  if (!fs.existsSync(f)) continue;
  const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,sample_rate,channels,bit_rate:format=duration', '-of', 'compact', f]).toString();
  const loud = execFileSync('sh', ['-c', `ffmpeg -hide_banner -nostats -i "${f}" -af ebur128=peak=true -f null - 2>&1 | grep -E "I:|Peak:|LRA:" | tail -3`]).toString();
  console.log(`\n== ${fmt}\n${probe}${loud}`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', f, '-vf', `fps=1/2,scale=${fmt === '9x16' ? '540:-1' : '960:-1'}`, path.join(QA, `${fmt}-%03d.jpg`)]);
}
console.log('QA frames in', QA);
