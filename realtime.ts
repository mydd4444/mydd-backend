import type { ClientMsg, HelloMsg, ServerMsg } from "./types";
import { uid, json } from "./util";

export interface Env {
  LIVE_ROOM: DurableObjectNamespace;
  ALLOWED_ORIGINS: string;
  JWT_SECRET?: string; // optional in starter
}

type Conn = {
  ws: WebSocket;
  userId: string;
  name?: string;
  role: "HOST" | "VIEWER";
  lastChatAt: number;
};

export class LiveRoom implements DurableObject {
  state: DurableObjectState;
  env: Env;
  conns: Map<WebSocket, Conn> = new Map();
  viewerIds: Map<string, number> = new Map(); // userId -> lastPing
  cleanupTimer?: number;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.headers.get("upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      await this.handleSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname.endsWith("/stats")) {
      return json({ viewerCount: this.currentViewerCount() });
    }

    return new Response("Not found", { status: 404 });
  }

  currentViewerCount(): number {
    const now = Date.now();
    let count = 0;
    for (const [, ts] of this.viewerIds) {
      if (now - ts <= 60_000) count++;
    }
    return count;
  }

  broadcast(msg: ServerMsg) {
    const data = JSON.stringify(msg);
    for (const c of this.conns.values()) {
      try { c.ws.send(data); } catch {}
    }
  }

  ensureCleanupLoop() {
    if (this.cleanupTimer) return;
    // @ts-ignore
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [uid, ts] of this.viewerIds) {
        if (now - ts > 60_000) this.viewerIds.delete(uid);
      }
      this.broadcast({ type: "presence.count", count: this.currentViewerCount() });
    }, 10_000) as unknown as number;
  }

  async handleSocket(ws: WebSocket) {
    ws.accept();
    const conn: Conn = { ws, userId: uid("u"), role: "VIEWER", lastChatAt: 0 };
    this.conns.set(ws, conn);

    ws.addEventListener("message", (evt) => {
      try {
        const parsed = JSON.parse(String(evt.data)) as ClientMsg;
        this.onMessage(conn, parsed);
      } catch {
        ws.send(JSON.stringify({ type: "error", code: "BAD_JSON" } satisfies ServerMsg));
      }
    });

    ws.addEventListener("close", () => {
      this.onClose(conn);
    });

    this.ensureCleanupLoop();
  }

  onClose(conn: Conn) {
    this.conns.delete(conn.ws);
    if (conn.role === "VIEWER") {
      this.viewerIds.delete(conn.userId);
      this.broadcast({ type: "presence.count", count: this.currentViewerCount() });
    }
  }

  onMessage(conn: Conn, msg: ClientMsg) {
    switch (msg.type) {
      case "hello":
        this.onHello(conn, msg);
        break;

      case "presence.join":
        if (conn.role === "VIEWER") {
          this.viewerIds.set(conn.userId, Date.now());
          this.broadcast({ type: "presence.count", count: this.currentViewerCount() });
        }
        break;

      case "presence.ping":
        if (conn.role === "VIEWER") {
          this.viewerIds.set(conn.userId, Date.now());
        }
        break;

      case "chat.send": {
        const text = (msg.text || "").trim();
        if (!text) return;

        const now = Date.now();
        // rate limit: 1 msg per 700ms per connection
        if (now - conn.lastChatAt < 700) {
          conn.ws.send(JSON.stringify({ type: "error", code: "RATE_LIMIT" } satisfies ServerMsg));
          return;
        }
        conn.lastChatAt = now;

        this.broadcast({
          type: "chat.message",
          msgId: uid("m"),
          user: { id: conn.userId, name: conn.name },
          text,
          ts: now,
        });
        break;
      }

      default:
        conn.ws.send(JSON.stringify({ type: "error", code: "UNKNOWN_TYPE" } satisfies ServerMsg));
    }
  }

  onHello(conn: Conn, msg: HelloMsg) {
    if (msg.userId) conn.userId = msg.userId;
    if (msg.name) conn.name = msg.name;
    conn.role = msg.role;

    if (conn.role === "VIEWER") {
      this.viewerIds.set(conn.userId, Date.now());
      this.broadcast({ type: "presence.count", count: this.currentViewerCount() });
    }
  }
}
