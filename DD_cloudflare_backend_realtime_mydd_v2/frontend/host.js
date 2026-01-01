/* global AgoraRTC, API_BASE, DEFAULT_CHANNEL, DEFAULT_LIVE_ID */
(async () => {
  const appId = qs('appid', null);
  const channel = qs('channel', window.DEFAULT_CHANNEL || 'test1');
  const liveId = qs('liveId', window.DEFAULT_LIVE_ID || channel);
  setText('channel', channel);
  setText('liveId', liveId);

  const apiBase = window.API_BASE;

  let ws;
  function connectRealtime() {
    const wsUrl = apiBase.replace(/^http/, 'ws') + `/v1/realtime?liveId=${encodeURIComponent(liveId)}`;
    ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'hello', role: 'host' }));
    };
    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data);
        if (m.type === 'stats' && m.payload) {
          setText('viewerCount', m.payload.viewerCount ?? 0);
        }
      } catch (_) {}
    };
    ws.onerror = () => {};
    ws.onclose = () => {
      setTimeout(connectRealtime, 1500);
    };
  }
  connectRealtime();

  // Agora
  const uid = Number(qs('uid', '1'));
  const localContainer = document.getElementById('local');

  async function getToken() {
    const url = new URL(apiBase + '/v1/agora/token');
    url.searchParams.set('channel', channel);
    url.searchParams.set('uid', String(uid));
    url.searchParams.set('role', 'publisher');
    const r = await fetch(url.toString());
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error?.message || 'token error');
    return j.data.token;
  }

  let client, localTracks = [];
  async function start() {
    logLine(`Using API: ${apiBase}`);
    logLine(`Channel: ${channel}, uid: ${uid}`);

    const token = await getToken();
    client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
    client.on('connection-state-change', (cur, prev) => {
      setText('status', `${prev} -> ${cur}`);
    });

    await client.setClientRole('host');
    await client.join(appId || window.AGORA_APP_ID || '', channel, token, uid);

    const [micTrack, camTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
    localTracks = [micTrack, camTrack];

    camTrack.play(localContainer);
    await client.publish(localTracks);

    setText('status', 'live');
    logLine('Published audio+video');
  }

  async function stop() {
    try {
      for (const t of localTracks) {
        try { t.stop(); } catch (_) {}
        try { t.close(); } catch (_) {}
      }
      localTracks = [];
      if (client) await client.leave();
    } finally {
      setText('status', 'stopped');
    }
  }

  document.getElementById('btnStart').onclick = () => start().catch(e => { setText('status', 'error'); logLine(String(e)); });
  document.getElementById('btnStop').onclick = () => stop().catch(e => logLine(String(e)));
})();
