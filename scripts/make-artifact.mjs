// Turns dist-preview/index.html (single file) into a body-only fragment for hosts that wrap pages in their own skeleton.
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('dist-preview/index.html', 'utf8');
const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? 'PortableBooth';
const styles = [...html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map((m) => m[0]).join('\n');
const scripts = [...html.matchAll(/<script[^>]*>[\s\S]*?<\/script>/g)].map((m) => m[0]).join('\n');
const out = `<title>${title}</title>\n${styles}\n<div id="root"></div>\n${scripts}\n`;
writeFileSync('dist-preview/artifact.html', out);
console.log(`artifact.html ${(out.length / 1024).toFixed(0)} KB`);
