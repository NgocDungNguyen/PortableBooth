/**
 * "Send to a phone": the sender shows a QR link, the other phone scans it with its normal camera and receives the photo.
 *
 * Transport: a tiny relay on our own host (worker/index.js, `/beam/<room>`) pairs the two browsers over WebSockets.
 * Privacy: the photo is encrypted in the sender's browser with AES-GCM-256. The key travels only inside the QR
 * link's #fragment, which browsers never send to a server, so the relay sees ciphertext and nothing is stored.
 * Every frame is authenticated and bound to its position, and the receiver checks size, type and file signature.
 */

export const CHUNK = 192 * 1024;
const WINDOW = 6; // frames in flight before waiting for the receiver's acknowledgement
export const MAX_BYTES = 60 * 1024 * 1024;
const CONNECT_MS = 12_000;
const KINDS = ['image/png', 'image/jpeg'] as const;

export type BeamPhase = 'waiting' | 'connecting' | 'transferring' | 'done' | 'failed';
export interface BeamFile {
  name: string;
  mime: string;
  blob: Blob;
}
export interface BeamOffer {
  room: string;
  key: string;
}
interface Callbacks {
  phase: (p: BeamPhase, message?: string) => void;
  progress: (fraction: number) => void;
}

// ------------------------------------------------------------------------------------------------- codec
export function b64u(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unb64u(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** `#beam=<room 16 bytes>.<key 32 bytes>`, both base64url */
export function parseBeamHash(hash: string | null | undefined): BeamOffer | null {
  if (typeof hash !== 'string') return null;
  const m = /^#?beam=([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/.exec(hash.trim());
  return m ? { room: m[1], key: m[2] } : null;
}
export const beamToHash = (o: BeamOffer) => `#beam=${o.room}.${o.key}`;
export function beamLink(o: BeamOffer): string {
  return `${location.origin}${location.pathname}${beamToHash(o)}`;
}
function relayUrl(room: string, role: 'send' | 'recv'): string {
  return `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/beam/${room}?role=${role}`;
}

// ------------------------------------------------------------------------------------------------ frames
const KIND_META = 1;
const KIND_DATA = 2;
const KIND_END = 3;

const aad = (seq: number) => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, seq);
  return b;
};

export async function importKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** wire: seq (4) | iv (12) | AES-GCM(kind (1) | payload), with seq as additional data */
export async function seal(key: CryptoKey, seq: number, kind: number, payload: Uint8Array): Promise<Uint8Array> {
  const plain = new Uint8Array(1 + payload.length);
  plain[0] = kind;
  plain.set(payload, 1);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(seq) }, key, plain));
  const out = new Uint8Array(16 + ct.length);
  out.set(aad(seq), 0);
  out.set(iv, 4);
  out.set(ct, 16);
  return out;
}
export async function open(key: CryptoKey, frame: Uint8Array, expectSeq: number): Promise<{ kind: number; payload: Uint8Array }> {
  if (frame.length < 17) throw new Error('short');
  const seq = new DataView(frame.buffer, frame.byteOffset, 4).getUint32(0);
  if (seq !== expectSeq) throw new Error('order');
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: frame.slice(4, 16), additionalData: aad(seq) }, key, frame.slice(16)));
  return { kind: plain[0], payload: plain.subarray(1) };
}

/** PNG / JPEG magic numbers */
export function looksLike(mime: string, head: Uint8Array): boolean {
  if (mime === 'image/png') return head.length > 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => head[i] === b);
  if (mime === 'image/jpeg') return head.length > 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  return false;
}
const safeName = (n: unknown, mime: string) => {
  const base = typeof n === 'string' ? n.replace(/[^\w.-]+/g, '-').slice(0, 80) : '';
  return base || `portablebooth.${mime === 'image/png' ? 'png' : 'jpg'}`;
};

function connect(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      reject(new Error('no-relay'));
      return;
    }
    ws.binaryType = 'arraybuffer';
    const t = setTimeout(() => {
      ws.close();
      reject(new Error('no-relay'));
    }, CONNECT_MS);
    ws.onopen = () => {
      clearTimeout(t);
      resolve(ws);
    };
    ws.onerror = () => {
      clearTimeout(t);
      reject(new Error('no-relay'));
    };
  });
}

const parseCtl = (d: unknown): { t?: string; n?: number; done?: boolean } | null => {
  if (typeof d !== 'string') return null;
  try {
    return JSON.parse(d);
  } catch {
    return null;
  }
};

// ------------------------------------------------------------------------------------------------ sender
export interface BeamSender {
  offer: BeamOffer;
  link: string;
  close: () => void;
}

export async function startSender(file: BeamFile, cb: Callbacks): Promise<BeamSender> {
  if (file.blob.size > MAX_BYTES) throw new Error('too-big');
  const room = b64u(crypto.getRandomValues(new Uint8Array(16)));
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const offer = { room, key: b64u(raw) };
  const key = await importKey(raw);
  const ws = await connect(relayUrl(room, 'send'));
  let closed = false;
  let state: 'waiting' | 'sending' | 'done' = 'waiting';
  let acked = -1;
  let total = 1;
  let wake: (() => void) | null = null;

  const fail = (msg: string) => {
    if (closed || state === 'done') return;
    closed = true;
    cb.phase('failed', msg);
    ws.close();
  };

  const send = async () => {
    state = 'sending';
    cb.phase('transferring');
    const bytes = new Uint8Array(await file.blob.arrayBuffer());
    const chunks = Math.max(1, Math.ceil(bytes.length / CHUNK));
    total = chunks + 2;
    const meta = new TextEncoder().encode(JSON.stringify({ name: file.name, mime: file.mime, size: bytes.length, chunks }));
    let seq = 0;
    const push = async (kind: number, payload: Uint8Array) => {
      while (!closed && seq - acked > WINDOW) await new Promise<void>((r) => (wake = r));
      if (closed) throw new Error('closed');
      ws.send(await seal(key, seq, kind, payload));
      seq++;
    };
    try {
      await push(KIND_META, meta);
      for (let i = 0; i < chunks; i++) {
        await push(KIND_DATA, bytes.subarray(i * CHUNK, (i + 1) * CHUNK));
      }
      await push(KIND_END, new Uint8Array(0));
    } catch {
      /* closed: the close handler reports it */
    }
  };

  ws.onmessage = (e) => {
    const m = parseCtl(e.data);
    if (!m) return;
    if (m.t === 'peer' && state === 'waiting') void send();
    else if (m.t === 'ack' && typeof m.n === 'number') {
      acked = Math.max(acked, m.n);
      if (state === 'sending') cb.progress(Math.min(0.99, (acked + 1) / total));
      wake?.();
      wake = null;
      if (m.done) {
        state = 'done';
        cb.progress(1);
        cb.phase('done');
        closed = true;
        ws.close();
      }
    } else if (m.t === 'fail') fail(m.n === 1 ? 'The other phone could not open the photo.' : 'The other phone stopped receiving.');
    else if (m.t === 'gone' && state === 'sending') fail('The other phone left before the photo arrived.');
  };
  ws.onclose = () => {
    wake?.();
    if (state === 'waiting' && !closed) fail('This code expired. Make a new one.');
    else if (state === 'sending') fail('The connection dropped. Try again.');
    closed = true;
  };

  cb.phase('waiting');
  return {
    offer,
    link: beamLink(offer),
    close: () => {
      closed = true;
      wake?.();
      ws.close();
    },
  };
}

// ---------------------------------------------------------------------------------------------- receiver
export function startReceiver(offer: BeamOffer, cb: Callbacks): { file: Promise<BeamFile>; close: () => void } {
  let ws: WebSocket | null = null;
  let closed = false;
  const file = (async () => {
    cb.phase('connecting');
    const key = await importKey(unb64u(offer.key));
    try {
      ws = await connect(relayUrl(offer.room, 'recv'));
    } catch {
      throw new Error('This code has expired or was already used. Ask for a new one.');
    }
    const sock = ws;
    return await new Promise<BeamFile>((resolve, reject) => {
      let expect = 0;
      let meta: { name: string; mime: string; size: number; chunks: number } | null = null;
      const parts: Uint8Array[] = [];
      let got = 0;
      let chain = Promise.resolve();
      let finished = false;
      const bad = (msg: string, code = 2) => {
        if (finished) return;
        finished = true;
        try {
          sock.send(JSON.stringify({ t: 'fail', n: code }));
        } catch {
          /* ignore */
        }
        sock.close();
        reject(new Error(msg));
      };
      const handle = async (frame: Uint8Array) => {
        if (finished) return;
        const seq = expect;
        const { kind, payload } = await open(key, frame, seq);
        expect++;
        if (kind === KIND_META) {
          const m = JSON.parse(new TextDecoder().decode(payload));
          if (!KINDS.includes(m.mime) || !(m.size > 0) || m.size > MAX_BYTES || !(m.chunks > 0) || m.chunks > Math.ceil(MAX_BYTES / CHUNK)) return bad('That file is not a photo we can open.', 1);
          meta = { name: safeName(m.name, m.mime), mime: m.mime, size: m.size, chunks: m.chunks };
          cb.phase('transferring');
        } else if (kind === KIND_DATA && meta) {
          got += payload.length;
          if (got > meta.size) return bad('The photo arrived damaged.', 1);
          parts.push(payload.slice());
          cb.progress(Math.min(0.99, got / meta.size));
        } else if (kind === KIND_END && meta) {
          const blob = new Blob(parts as BlobPart[], { type: meta.mime });
          if (blob.size !== meta.size || !looksLike(meta.mime, parts[0] ?? new Uint8Array(0))) return bad('The photo arrived damaged.', 1);
          finished = true;
          sock.send(JSON.stringify({ t: 'ack', n: seq, done: true }));
          cb.progress(1);
          cb.phase('done');
          resolve({ name: meta.name, mime: meta.mime, blob });
          setTimeout(() => sock.close(), 500);
          return;
        } else return bad('The photo arrived damaged.', 1);
        sock.send(JSON.stringify({ t: 'ack', n: seq }));
      };
      sock.onmessage = (e) => {
        if (typeof e.data === 'string') {
          const m = parseCtl(e.data);
          if (m?.t === 'gone' && !finished) {
            finished = true;
            reject(new Error('The sender closed the code before the photo arrived.'));
          }
          return;
        }
        const frame = new Uint8Array(e.data as ArrayBuffer);
        chain = chain.then(() => handle(frame)).catch(() => bad('The photo arrived damaged. Ask them to send it again.', 1));
      };
      sock.onclose = () => {
        if (!finished && !closed) {
          finished = true;
          reject(new Error('The connection dropped. Ask them to send it again.'));
        }
      };
    });
  })();
  file.catch((e: unknown) => {
    if (!closed) cb.phase('failed', e instanceof Error ? e.message : 'Something went wrong.');
  });
  return {
    file,
    close: () => {
      closed = true;
      ws?.close();
    },
  };
}
