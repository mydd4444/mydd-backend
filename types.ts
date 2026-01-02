export type LiveStatus = "CREATED" | "LIVE" | "ENDED";

export interface LiveRecord {
  liveId: string;
  shopId?: string | null;
  title: string;
  status: LiveStatus;
  channelName: string;
  coverUrl?: string | null;
  hlsUrl?: string | null;
  createdAt: number;
  startedAt?: number | null;
  endedAt?: number | null;
}

export interface HelloMsg {
  type: "hello";
  token?: string;
  role: "HOST" | "VIEWER";
  userId?: string;
  name?: string;
}

export type ClientMsg =
  | HelloMsg
  | { type: "presence.join" }
  | { type: "presence.ping" }
  | { type: "chat.send"; text: string; clientMsgId?: string };

export type ServerMsg =
  | { type: "presence.count"; count: number }
  | { type: "chat.message"; msgId: string; user: { id: string; name?: string }; text: string; ts: number }
  | { type: "error"; code: string; message?: string }
  | { type: "live.ended" };
