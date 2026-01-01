# DD Cloudflare Backend + Realtime + Agora Token (Production)

This project gives you:

1) **Cloudflare Worker API** (`api.mydd.com`) that provides
   - `GET /v1/agora/token?channel=...&uid=...&role=publisher|subscriber`
   - `WS /v1/realtime?liveId=...` (viewer count + realtime events via Durable Objects)
   - `GET /health`

2) **Static front-end pages** (`frontend/host.html` and `frontend/viewer.html`) that
   - Play/publish video using **Agora Web SDK**
   - Show **viewer count** from the Cloudflare realtime backend

---

## Your values already set

- Agora App ID: `5d5e84ffd2ca46c0a71cf82b8033ff6b`
- API domain: `https://api.mydd.com`
- Your worker dev domain: `mydd-backen.brightguide.workers.dev`

---

## Step 1) Set the Agora App Certificate (required)

In Agora Console:
- Open your project (DD) -> **Basic Settings**
- Copy **Primary Certificate** (click the copy icon)

Then in this project folder:

```bash
wrangler secret put AGORA_APP_CERT

# ใส่ค่า App Certificate นี้เมื่อระบบถาม (ห้ามใส่ลงไฟล์ frontend)
# 6626f58334354ab5a9792852a203e334
# paste the Primary Certificate value
```

> If you don’t set `AGORA_APP_CERT`, the token endpoint will return an error and the video will not play.

---

## Step 2) Deploy the Worker

```bash
npm i
npx wrangler deploy
```

---

## Step 3) Point `api.mydd.com` to the Worker (Cloudflare DNS)

In Cloudflare Dashboard -> your zone `mydd.com` -> DNS:

Create a **CNAME** record:

- Type: `CNAME`
- Name: `api`
- Target: `mydd-backen.brightguide.workers.dev`
- Proxy status: **Proxied** (orange cloud)

Wait a few minutes, then test:

- `https://api.mydd.com/health`

---

## Step 4) Host the front-end (Pages / CDN)

You can host the `frontend/` folder anywhere (Cloudflare Pages, any CDN, any static hosting).

### Option A: Cloudflare Pages (easy)
- Cloudflare Dashboard -> **Workers & Pages** -> Pages -> Create
- Upload the **`frontend/`** folder (or connect Git)

Then open:

- Host: `.../host.html?channel=test1&liveId=test1`
- Viewer: `.../viewer.html?channel=test1&liveId=test1`

---

## API usage

### Token endpoint

```text
GET /v1/agora/token?channel=<channel>&uid=<number>&role=publisher|subscriber
```

Response:

```json
{ "appId": "...", "token": "...", "uid": 1, "channel": "test1", "expiresIn": 3600 }
```

### Realtime viewer count

WebSocket:

```text
wss://api.mydd.com/v1/realtime?liveId=<liveId>
```

Client sends:

```json
{ "type": "hello", "role": "host" }
```

or

```json
{ "type": "hello", "role": "viewer" }
```

---

## Notes on scaling (200+ shops / many lives)

- Each live uses its own Durable Object instance (keyed by `liveId`).
- Cloudflare automatically scales across PoPs.
- Agora scaling depends on your Agora plan + region + bandwidth.
- For production, keep **Token mode** (App ID + Token) as implemented here.
