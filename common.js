function qs(name, fallback = null) {
  const u = new URL(window.location.href);
  const v = u.searchParams.get(name);
  return v !== null && v !== '' ? v : fallback;
}

function $(id) {
  return document.getElementById(id);
}

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = String(text);
}

function logLine(msg) {
  const el = $('log');
  if (!el) return;
  const line = document.createElement('div');
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

async function fetchAgoraToken({ channel, uid, role }) {
  const apiBase = window.API_BASE;
  const url = new URL(apiBase + '/v1/agora/token');
  url.searchParams.set('channel', channel);
  url.searchParams.set('uid', String(uid));
  url.searchParams.set('role', role);
  const r = await fetch(url.toString(), { method: 'GET' });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(data?.error?.message || `token error (${r.status})`);
  }
  return data;
}

function connectRealtime({ liveId, role, onCount }) {
  const apiBase = window.API_BASE;
  const wsUrl = apiBase.replace('https://', 'wss://').replace('http://', 'ws://') + `/v1/realtime?liveId=${encodeURIComponent(liveId)}`;
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'hello', role }));
  };

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'state' && typeof msg.viewerCount === 'number') {
        onCount(msg.viewerCount);
      }
    } catch {
      // ignore
    }
  };

  ws.onerror = () => {
    // handled by UI log
  };

  return ws;
}
