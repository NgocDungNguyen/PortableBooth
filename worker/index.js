// PortableBooth on Cloudflare Workers.
// Static files come from ./dist (wrangler "assets"). The only dynamic route is the "Send to a phone" relay:
//   wss://<host>/beam/<room>?role=send|recv
// It pairs one sender with one receiver and forwards their messages. The photo is end-to-end encrypted in the
// browser (AES-GCM, key only in the QR link fragment, which never reaches the server), so the relay only ever sees
// ciphertext. Nothing is written to storage except a self-destruct alarm; a room lives at most 15 minutes.
import { DurableObject } from 'cloudflare:workers';

const ROOM = /^\/beam\/([A-Za-z0-9_-]{22,64})$/;
const LIFETIME_MS = 15 * 60 * 1000;
const MAX_FRAME = 1024 * 1024;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const m = ROOM.exec(url.pathname);
    if (!m) return env.ASSETS.fetch(req);
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    const origin = req.headers.get('Origin');
    if (origin && origin !== url.origin) return new Response('Forbidden', { status: 403 });
    const role = url.searchParams.get('role');
    if (role !== 'send' && role !== 'recv') return new Response('Bad role', { status: 400 });
    return env.BEAM.get(env.BEAM.idFromName(m[1])).fetch(req);
  },
};

export class BeamRoom extends DurableObject {
  async fetch(req) {
    const role = new URL(req.url).searchParams.get('role');
    const other = role === 'send' ? 'recv' : 'send';
    // one sender, one receiver; a receiver needs a waiting sender
    if (this.ctx.getWebSockets(role).length) return new Response('Room taken', { status: 409 });
    if (role === 'recv' && !this.ctx.getWebSockets('send').length) return new Response('No sender', { status: 404 });
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server, [role]);
    if (role === 'send') await this.ctx.storage.setAlarm(Date.now() + LIFETIME_MS);
    else for (const s of this.ctx.getWebSockets(other)) safeSend(s, '{"t":"peer"}');
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, msg) {
    const size = typeof msg === 'string' ? msg.length : msg.byteLength;
    if (size > MAX_FRAME) return ws.close(1009, 'Too big');
    const role = this.ctx.getTags(ws)[0];
    for (const o of this.ctx.getWebSockets(role === 'send' ? 'recv' : 'send')) safeSend(o, msg);
  }

  webSocketClose(ws) {
    this.leave(ws);
  }

  webSocketError(ws) {
    this.leave(ws);
  }

  leave(ws) {
    const role = this.ctx.getTags(ws)[0];
    for (const o of this.ctx.getWebSockets(role === 'send' ? 'recv' : 'send')) safeSend(o, '{"t":"gone"}');
    try {
      ws.close(1000, 'Bye');
    } catch {
      /* already closed */
    }
  }

  async alarm() {
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.close(1000, 'Expired');
      } catch {
        /* ignore */
      }
    }
    await this.ctx.storage.deleteAll();
  }
}

function safeSend(ws, msg) {
  try {
    ws.send(msg);
  } catch {
    /* peer went away */
  }
}
