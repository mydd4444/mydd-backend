import type { LiveRecord, LiveStatus } from "./types";

const lives = new Map<string, LiveRecord>();

export function createLive(title: string, coverUrl?: string | null, shopId?: string | null): LiveRecord {
  const liveId = crypto.randomUUID();
  const rec: LiveRecord = {
    liveId,
    shopId: shopId ?? null,
    title,
    coverUrl: coverUrl ?? null,
    status: "CREATED",
    channelName: `live_${liveId}`,
    hlsUrl: null,
    createdAt: Date.now(),
  };
  lives.set(liveId, rec);
  return rec;
}

export function getLive(liveId: string): LiveRecord | null {
  return lives.get(liveId) ?? null;
}

export function listLives(status?: LiveStatus): LiveRecord[] {
  const arr = Array.from(lives.values());
  if (!status) return arr.sort((a,b)=>b.createdAt-a.createdAt);
  return arr.filter(x=>x.status===status).sort((a,b)=>b.createdAt-a.createdAt);
}

export function startLive(liveId: string, hlsUrl?: string | null): LiveRecord {
  const rec = lives.get(liveId);
  if (!rec) throw new Error("LIVE_NOT_FOUND");
  rec.status = "LIVE";
  rec.startedAt = Date.now();
  if (hlsUrl) rec.hlsUrl = hlsUrl;
  lives.set(liveId, rec);
  return rec;
}

export function stopLive(liveId: string): LiveRecord {
  const rec = lives.get(liveId);
  if (!rec) throw new Error("LIVE_NOT_FOUND");
  rec.status = "ENDED";
  rec.endedAt = Date.now();
  lives.set(liveId, rec);
  return rec;
}
