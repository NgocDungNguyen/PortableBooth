/**
 * "Beam": phone-to-phone transfer with no server.
 * A WebRTC data channel over the local network (host / mDNS candidates only, no STUN or TURN), signalled by two QR codes:
 * the sender shows an offer (as an app link, `#beam=<code>`), the receiver answers with a second code the sender scans.
 * Codes carry only what ICE + DTLS need (ufrag, pwd, fingerprint, setup, candidates), packed by hand: these are random
 * tokens, which deflate would make longer, so a field packing keeps the QR small (~150-250 chars).
 */

export type BeamKind = 'o' | 'a';
export interface BeamCandidate {
  /** IPv4, IPv6 or an mDNS `<uuid>.local` name */
  ip: string;
  port: number;
}
export interface BeamDesc {
  kind: BeamKind;
  ufrag: string;
  pwd: string;
  /** sha-256 certificate fingerprint, 32 bytes */
  fp: Uint8Array;
  setup: 'actpass' | 'active' | 'passive';
  cands: BeamCandidate[];
}

const VERSION = 'B1';
const MAX_CANDS = 8;
const ICE_CHAR = /^[A-Za-z0-9+/]+$/;
const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV6 = /^[0-9a-fA-F:]{2,39}$/;
const MDNS = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.local$/;
const SETUP = { x: 'actpass', a: 'active', p: 'passive' } as const;

// ---------- base64url ----------
export function b64u(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
export function unb64u(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  try {
    const bin = atob(s.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (s.length % 4)) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0').toUpperCase()).join(':');

// ---------- SDP <-> essentials ----------
/** Pull the essentials out of a full SDP. Only UDP host candidates are kept (no STUN/TURN is ever configured). */
export function minifySdp(sdp: string, kind: BeamKind): BeamDesc | null {
  const line = (k: string) => sdp.match(new RegExp(`^a=${k}:(.+)$`, 'm'))?.[1]?.trim();
  const ufrag = line('ice-ufrag');
  const pwd = line('ice-pwd');
  const fpLine = line('fingerprint');
  const setup = line('setup');
  if (!ufrag || !pwd || !fpLine || !setup) return null;
  const [alg, fpHex] = fpLine.split(/\s+/);
  if (alg?.toLowerCase() !== 'sha-256' || !fpHex) return null;
  const fp = Uint8Array.from(fpHex.split(':'), (h) => parseInt(h, 16));
  if (fp.length !== 32 || fp.some((x) => Number.isNaN(x))) return null;
  if (setup !== 'actpass' && setup !== 'active' && setup !== 'passive') return null;
  const cands: BeamCandidate[] = [];
  for (const m of sdp.matchAll(/^a=candidate:(.+)$/gm)) {
    const f = m[1].trim().split(/\s+/);
    // foundation component proto priority ip port typ type ...
    if (f.length < 8 || f[1] !== '1' || f[2].toLowerCase() !== 'udp' || f[6] !== 'typ') continue;
    const ip = f[4];
    const port = Number(f[5]);
    if (!validIp(ip) || !validPort(port) || cands.some((c) => c.ip === ip && c.port === port)) continue;
    cands.push({ ip, port });
    if (cands.length >= MAX_CANDS) break;
  }
  return { kind, ufrag, pwd, fp, setup, cands };
}

const validIp = (ip: string) => IPV4.test(ip) || MDNS.test(ip) || (ip.includes(':') && IPV6.test(ip));
const validPort = (p: number) => Number.isInteger(p) && p > 0 && p < 65536;

/** Rebuild a standard data-channel-only SDP from the essentials (works for Chrome, Safari and Firefox). */
export function expandSdp(d: BeamDesc): string {
  const L = [
    'v=0',
    `o=- ${Math.floor(Math.random() * 1e15)} 2 IN IP4 127.0.0.1`,
    's=-',
    't=0 0',
    'a=group:BUNDLE 0',
    'a=msid-semantic: WMS',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
    'c=IN IP4 0.0.0.0',
    ...d.cands.map((c, i) => `a=candidate:${i + 1} 1 udp ${2122260223 - i * 256} ${c.ip} ${c.port} typ host generation 0`),
    ...(d.cands.length ? ['a=end-of-candidates'] : []),
    `a=ice-ufrag:${d.ufrag}`,
    `a=ice-pwd:${d.pwd}`,
    `a=fingerprint:sha-256 ${hex(d.fp)}`,
    `a=setup:${d.setup}`,
    'a=mid:0',
    'a=sctp-port:5000',
    'a=max-message-size:262144',
  ];
  return L.join('\r\n') + '\r\n';
}

// ---------- essentials <-> code ----------
const UUID_RE = /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})\.local$/;
function packIp(ip: string): string {
  const m = UUID_RE.exec(ip);
  if (!m) return ip;
  const h = m.slice(1).join('');
  return 'm' + b64u(Uint8Array.from({ length: 16 }, (_, i) => parseInt(h.slice(i * 2, i * 2 + 2), 16)));
}
function unpackIp(s: string): string | null {
  if (s[0] !== 'm') return validIp(s) ? s : null;
  const b = unb64u(s.slice(1));
  if (!b || b.length !== 16) return null;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}.local`;
}

/** `B1~<o|a>~ufrag~pwd~fingerprint~setup~ip,port!ip,port` (URL-fragment safe). */
export function encodeBeam(d: BeamDesc): string {
  const setup = (Object.keys(SETUP) as (keyof typeof SETUP)[]).find((k) => SETUP[k] === d.setup)!;
  const cands = d.cands.map((c) => `${packIp(c.ip)},${c.port}`).join('!');
  return [VERSION, d.kind, d.ufrag, d.pwd, b64u(d.fp), setup, cands].join('~');
}

export function decodeBeam(code: string, expect?: BeamKind): BeamDesc | null {
  if (typeof code !== 'string' || code.length > 1500) return null;
  let s = code.trim();
  if (s.includes('%')) {
    try {
      s = decodeURIComponent(s);
    } catch {
      return null;
    }
  }
  const p = s.split('~');
  if (p.length !== 7 || p[0] !== VERSION) return null;
  const [, kind, ufrag, pwd, fpS, setupS, candS] = p;
  if (kind !== 'o' && kind !== 'a') return null;
  if (expect && kind !== expect) return null;
  if (!ICE_CHAR.test(ufrag) || ufrag.length < 4 || ufrag.length > 256) return null;
  if (!ICE_CHAR.test(pwd) || pwd.length < 22 || pwd.length > 256) return null;
  const fp = unb64u(fpS);
  if (!fp || fp.length !== 32) return null;
  const setup = SETUP[setupS as keyof typeof SETUP];
  if (!setup || (kind === 'o') !== (setup === 'actpass')) return null;
  const cands: BeamCandidate[] = [];
  if (candS) {
    const items = candS.split('!');
    if (items.length > MAX_CANDS) return null;
    for (const it of items) {
      const i = it.lastIndexOf(',');
      if (i < 1) return null;
      const ip = unpackIp(it.slice(0, i));
      const portS = it.slice(i + 1);
      if (!ip || !/^\d{1,5}$/.test(portS) || !validPort(Number(portS))) return null;
      cands.push({ ip, port: Number(portS) });
    }
  }
  if (!cands.length) return null;
  return { kind, ufrag, pwd, fp, setup, cands };
}

/** `#beam=<offer code>` -> the offer, or null for anything else. */
export function parseBeamHash(hash: string | null | undefined): BeamDesc | null {
  if (typeof hash !== 'string') return null;
  const m = /^#?beam=(.+)$/s.exec(hash.trim());
  return m ? decodeBeam(m[1], 'o') : null;
}
export const beamToHash = (offerCode: string) => `#beam=${offerCode}`;

// ---------- the live link ----------
export const CHUNK = 16 * 1024;
export const MAX_BYTES = 60 * 1024 * 1024;
const ACCEPT = ['image/png', 'image/jpeg'];

export interface BeamFile {
  name: string;
  mime: string;
  blob: Blob;
}
export type BeamPhase = 'waiting' | 'connecting' | 'transferring' | 'done' | 'failed';
export interface BeamEvents {
  phase: (p: BeamPhase, message?: string) => void;
  progress: (fraction: number) => void;
}

export const NETWORK_HINT = 'Both devices need to be on the same Wi-Fi or hotspot.';

function waitForIce(pc: RTCPeerConnection, ms: number): Promise<void> {
  return new Promise((res) => {
    if (pc.iceGatheringState === 'complete') return res();
    const t = setTimeout(done, ms);
    function done() {
      clearTimeout(t);
      pc.removeEventListener('icegatheringstatechange', check);
      res();
    }
    function check() {
      if (pc.iceGatheringState === 'complete') done();
    }
    pc.addEventListener('icegatheringstatechange', check);
  });
}

async function localCode(pc: RTCPeerConnection, kind: BeamKind): Promise<string> {
  await waitForIce(pc, 4000);
  const d = pc.localDescription && minifySdp(pc.localDescription.sdp, kind);
  if (!d || !d.cands.length) throw new Error('no-network');
  return encodeBeam(d);
}

const newPc = () => new RTCPeerConnection({ iceServers: [] });
const safeName = (n: unknown, mime: string) => {
  const ext = mime === 'image/png' ? 'png' : 'jpg';
  const base = typeof n === 'string' ? n.replace(/[^\w.-]+/g, '-').slice(0, 80) : '';
  return /\.(png|jpe?g)$/i.test(base) ? base : `portablebooth-received.${ext}`;
};
function looksLikeImage(b: Uint8Array, mime: string): boolean {
  if (mime === 'image/png') return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  return b[0] === 0xff && b[1] === 0xd8;
}

export interface BeamSender {
  offerCode: string;
  /** Apply the receiver's reply code; resolves once the file has been delivered. */
  accept: (answerCode: string) => Promise<void>;
  close: () => void;
}

/** Sender side: creates the offer now; the file goes once the reply code is applied and the link opens. */
export async function startSender(file: BeamFile, ev: BeamEvents, connectTimeoutMs = 25000): Promise<BeamSender> {
  const pc = newPc();
  const dc = pc.createDataChannel('beam', { ordered: true });
  dc.binaryType = 'arraybuffer';
  await pc.setLocalDescription(await pc.createOffer());
  const offerCode = await localCode(pc, 'o');
  let closed = false;
  const close = () => {
    closed = true;
    try {
      dc.close();
      pc.close();
    } catch {
      /* already closed */
    }
  };

  const accept = async (answerCode: string) => {
    const d = decodeBeam(answerCode, 'a');
    if (!d) throw new Error('bad-code');
    ev.phase('connecting');
    await pc.setRemoteDescription({ type: 'answer', sdp: expandSdp(d) });
    await new Promise<void>((res, rej) => {
      const t = setTimeout(() => rej(new Error('timeout')), connectTimeoutMs);
      if (dc.readyState === 'open') {
        clearTimeout(t);
        res();
      }
      dc.addEventListener('open', () => (clearTimeout(t), res()), { once: true });
      pc.addEventListener('connectionstatechange', () => {
        if (pc.connectionState === 'failed') (clearTimeout(t), rej(new Error('failed')));
      });
    });
    ev.phase('transferring');
    const bytes = new Uint8Array(await file.blob.arrayBuffer());
    dc.send(JSON.stringify({ t: 'meta', name: file.name, mime: file.mime, size: bytes.length }));
    dc.bufferedAmountLowThreshold = 256 * 1024;
    const acked = new Promise<void>((res, rej) => {
      const t = setTimeout(() => rej(new Error('timeout')), 60000 + bytes.length / 20);
      dc.addEventListener('message', (e) => {
        if (typeof e.data === 'string' && e.data.includes('"ok"')) (clearTimeout(t), res());
      });
      dc.addEventListener('close', () => (clearTimeout(t), rej(new Error('closed'))));
    });
    acked.catch(() => {});
    for (let off = 0; off < bytes.length; off += CHUNK) {
      if (closed) throw new Error('closed');
      if (dc.bufferedAmount > 1024 * 1024) await new Promise((r) => dc.addEventListener('bufferedamountlow', r, { once: true }));
      dc.send(bytes.subarray(off, off + CHUNK));
      ev.progress(Math.min(0.99, (off + CHUNK) / bytes.length));
    }
    dc.send(JSON.stringify({ t: 'done' }));
    await acked;
    ev.progress(1);
    ev.phase('done');
  };
  return { offerCode, accept, close };
}

export interface BeamReceiver {
  answerCode: string;
  /** resolves with the received file */
  file: Promise<BeamFile>;
  close: () => void;
}

/** Receiver side: answers the offer; the file promise settles when the image has arrived (or the link failed). */
export async function startReceiver(offer: BeamDesc, ev: BeamEvents, waitMs = 5 * 60000): Promise<BeamReceiver> {
  const pc = newPc();
  let close = () => pc.close();
  const file = new Promise<BeamFile>((resolve, reject) => {
    let meta: { name: string; mime: string; size: number } | null = null;
    const parts: Uint8Array[] = [];
    let got = 0;
    let stall: ReturnType<typeof setTimeout> | undefined;
    const fail = (msg: string) => {
      clearTimeout(stall);
      clearTimeout(wait);
      ev.phase('failed', msg);
      reject(new Error(msg));
      pc.close();
    };
    const wait = setTimeout(() => fail('The code expired. Make a new one.'), waitMs);
    const kick = () => {
      clearTimeout(stall);
      stall = setTimeout(() => fail('The transfer stopped. Try again.'), 20000);
    };
    close = () => {
      clearTimeout(stall);
      clearTimeout(wait);
      pc.close();
    };
    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'connecting') ev.phase('connecting');
      if (pc.connectionState === 'failed' && !meta) fail(`Couldn't reach the other device. ${NETWORK_HINT}`);
    });
    pc.addEventListener('datachannel', ({ channel: dc }) => {
      if (dc.label !== 'beam') return;
      dc.binaryType = 'arraybuffer';
      dc.addEventListener('open', () => {
        clearTimeout(wait);
        ev.phase('transferring');
        kick();
      });
      dc.addEventListener('message', (e) => {
        kick();
        if (typeof e.data === 'string') {
          let m: { t?: string; name?: unknown; mime?: unknown; size?: unknown };
          try {
            m = JSON.parse(e.data);
          } catch {
            return fail('Something went wrong. Try again.');
          }
          if (m.t === 'meta') {
            const mime = String(m.mime);
            const size = Number(m.size);
            if (!ACCEPT.includes(mime) || !Number.isInteger(size) || size <= 0 || size > MAX_BYTES) return fail('That file is not a photo.');
            meta = { name: safeName(m.name, mime), mime, size };
          } else if (m.t === 'done') {
            if (!meta || got !== meta.size) return fail('The photo arrived incomplete. Try again.');
            const all = new Uint8Array(got);
            let o = 0;
            for (const p of parts) (all.set(p, o), (o += p.length));
            if (!looksLikeImage(all, meta.mime)) return fail('That file is not a photo.');
            clearTimeout(stall);
            dc.send(JSON.stringify({ t: 'ok' }));
            ev.progress(1);
            ev.phase('done');
            resolve({ name: meta.name, mime: meta.mime, blob: new Blob([all], { type: meta.mime }) });
            setTimeout(() => pc.close(), 1500);
          }
          return;
        }
        if (!meta) return fail('Something went wrong. Try again.');
        const chunk = new Uint8Array(e.data as ArrayBuffer);
        got += chunk.length;
        if (got > meta.size) return fail('The photo arrived incomplete. Try again.');
        parts.push(chunk);
        ev.progress(got / meta.size);
      });
    });
  });
  file.catch(() => {});
  await pc.setRemoteDescription({ type: 'offer', sdp: expandSdp(offer) });
  await pc.setLocalDescription(await pc.createAnswer());
  const answerCode = await localCode(pc, 'a');
  ev.phase('waiting');
  return { answerCode, file, close: () => close() };
}
