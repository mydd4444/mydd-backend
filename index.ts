import { json, corsHeaders, readJson } from "./util";
import { createLive, getLive, listLives, startLive, stopLive } from "./store";
export { LiveRoom } from "./realtime";
import { RtcRole, RtcTokenBuilder } from "agora-access-token";

export interface Env {
  LIVE_ROOM: DurableObjectNamespace;
  ALLOWED_ORIGINS: string;
  JWT_SECRET?: string;

  // Agora (secure mode: App ID + Token)
  AGORA_APP_ID: string;
  AGORA_APP_CERT: string; // store as Wrangler secret
  TOKEN_TTL_SECONDS?: string; // default 3600
}

function withCors(request: Request, env: Env, resp: Response): Response {
  const h = corsHeaders(request, env.ALLOWED_ORIGINS);
  const headers = new Headers(resp.headers);
  for (const [k,v] of h.entries()) headers.set(k,v);
  return new Response(resp.body, { status: resp.status, headers, webSocket: (resp as any).webSocket });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const h = corsHeaders(request, env.ALLOWED_ORIGINS);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: h });
    }

    // Realtime WS -> Durable Object (one room per liveId)
    if (url.pathname === "/v1/realtime") {
      const liveId = url.searchParams.get("liveId");
      if (!liveId) return json({ error: { code: "MISSING_LIVE_ID", message: "liveId is required" } }, { status: 400, headers: h });
      const id = env.LIVE_ROOM.idFromName(liveId);
      const stub = env.LIVE_ROOM.get(id);
      const resp = await stub.fetch(request);
      return withCors(request, env, resp);
    }

    // GET /v1/agora/token?channel=xxx&uid=123&role=publisher|subscriber
    // NOTE: Requires AGORA_APP_CERT secret to be set in Worker.
    if (url.pathname === "/v1/agora/token" && request.method === "GET") {
      const channel = (url.searchParams.get("channel") || "").trim();
      const uidStr = (url.searchParams.get("uid") || "").trim();
      const roleStr = (url.searchParams.get("role") || "subscriber").trim();

      if (!channel) return json({ error: { code: "MISSING_CHANNEL", message: "channel is required" } }, { status: 400, headers: h });
      const uid = uidStr ? Number(uidStr) : Math.floor(Math.random() * 1_000_000_000);
      if (!Number.isFinite(uid) || uid < 0) return json({ error: { code: "BAD_UID", message: "uid must be a number" } }, { status: 400, headers: h });

      const ttl = Number(env.TOKEN_TTL_SECONDS || "3600");
      const now = Math.floor(Date.now() / 1000);
      const exp = now + (Number.isFinite(ttl) && ttl > 0 ? ttl : 3600);

      const cert = (env.AGORA_APP_CERT || "").trim();
      if (!cert) {
        return json({
          error: {
            code: "MISSING_APP_CERT",
            message: "AGORA_APP_CERT secret is not set. Add it with: wrangler secret put AGORA_APP_CERT",
          },
        }, { status: 500, headers: h });
      }

      const role = roleStr === "publisher" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
      const token = RtcTokenBuilder.buildTokenWithUid(env.AGORA_APP_ID, cert, channel, uid, role, exp);
      return json({ appId: env.AGORA_APP_ID, channel, uid, role: roleStr, token, expireAt: exp }, { status: 200, headers: h });
    }

    try {
      // POST /v1/lives
      if (url.pathname === "/v1/lives" && request.method === "POST") {
        const body = await readJson<{ title: string; coverUrl?: string; shopId?: string }>(request);
        const title = (body.title || "").trim();
        if (!title) return json({ error: { code: "VALIDATION", message: "title is required" } }, { status: 400, headers: h });
        const rec = createLive(title, body.coverUrl ?? null, body.shopId ?? null);
        return json({
          liveId: rec.liveId,
          channelName: rec.channelName,
          status: rec.status,
          realtime: { wsUrl: `${url.origin}/v1/realtime?liveId=${rec.liveId}` },
        }, { status: 200, headers: h });
      }

      // GET /v1/lives
      if (url.pathname === "/v1/lives" && request.method === "GET") {
        const status = url.searchParams.get("status") as any;
        const items = listLives(status || undefined).map(r => ({
          liveId: r.liveId,
          title: r.title,
          status: r.status,
          shopId: r.shopId,
          channelName: r.channelName,
          hlsUrl: r.hlsUrl,
          createdAt: r.createdAt,
        }));
        return json({ items, cursor: null }, { status: 200, headers: h });
      }

      // GET /v1/lives/:id
      const getMatch = url.pathname.match(/^\/v1\/lives\/([a-f0-9-]{36})$/i);
      if (getMatch && request.method === "GET") {
        const liveId = getMatch[1];
        const rec = getLive(liveId);
        if (!rec) return json({ error: { code: "LIVE_NOT_FOUND" } }, { status: 404, headers: h });

        // viewerCount from DO
        const id = env.LIVE_ROOM.idFromName(liveId);
        const stub = env.LIVE_ROOM.get(id);
        const statsResp = await stub.fetch(`${url.origin}/stats`);
        let viewerCount = 0;
        try {
          const stats = await statsResp.json();
          viewerCount = stats.viewerCount ?? 0;
        } catch {}

        return json({
          liveId: rec.liveId,
          status: rec.status,
          title: rec.title,
          playback: { hlsUrl: rec.hlsUrl },
          viewerCount,
          realtime: { wsUrl: `${url.origin}/v1/realtime?liveId=${rec.liveId}` },
        }, { status: 200, headers: h });
      }

      // POST /v1/lives/:id/start
      const startMatch = url.pathname.match(/^\/v1\/lives\/([a-f0-9-]{36})\/start$/i);
      if (startMatch && request.method === "POST") {
        const liveId = startMatch[1];
        const rec = getLive(liveId);
        if (!rec) return json({ error: { code: "LIVE_NOT_FOUND" } }, { status: 404, headers: h });

        const body = await request.json().catch(()=>({}));
        const hlsUrl = body?.hlsUrl ?? null;
        const updated = startLive(liveId, hlsUrl);
        return json({
          status: updated.status,
          channelName: updated.channelName,
          playback: { hlsUrl: updated.hlsUrl },
          realtime: { wsUrl: `${url.origin}/v1/realtime?liveId=${updated.liveId}` },
        }, { status: 200, headers: h });
      }

      // POST /v1/lives/:id/stop
      const stopMatch = url.pathname.match(/^\/v1\/lives\/([a-f0-9-]{36})\/stop$/i);
      if (stopMatch && request.method === "POST") {
        const liveId = stopMatch[1];
        const updated = stopLive(liveId);
        return json({ status: updated.status }, { status: 200, headers: h });
      }

      return new Response("Not found", { status: 404, headers: h });
    } catch (e: any) {
      return json({ error: { code: "INTERNAL", message: String(e?.message || e) } }, { status: 500, headers: h });
    }
  }
};
