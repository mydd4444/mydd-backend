/* global AgoraRTC, API_BASE, DEFAULT_CHANNEL, DEFAULT_LIVE_ID */
(async () => {
  const channel = qs('channel', window.DEFAULT_CHANNEL || 'test1');
  const liveId = qs('liveId', window.DEFAULT_LIVE_ID || channel);
  setText('channel', channel);
  setText('liveId', liveId);

  const apiBase = window.API_BASE;

  const uid = Math.floor(Math.random() * 1000000000);

  let ws;
  function connectRealtime() {
    const wsUrl = apiBase.replace(/^http/, 'ws') + `/v1/realtime?liveId=${encodeURIComponent(liveId)}`;
    ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'hello', role: 'viewer' }));
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'stats') {
          setText('viewerCount', msg.viewerCount);
        }
      } catch (_) {}
    };
  }
  connectRealtime();

  const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
  client.setClientRole('audience');

  client.on('user-published', async (user, mediaType) => {
    await client.subscribe(user, mediaType);
    if (mediaType === 'video') {
      const player = document.getElementById('player');
      player.innerHTML = '';
      const div = document.createElement('div');
      div.id = `remote-${user.uid}`;
      div.style.width = '100%';
      div.style.height = '100%';
      player.appendChild(div);
      user.videoTrack.play(div);
    }
    if (mediaType === 'audio') {
      user.audioTrack.play();
    }
  });

  async function join() {
    setText('status', 'joining');
    const tokenUrl = `${apiBase}/v1/agora/token?channel=${encodeURIComponent(channel)}&uid=${uid}&role=subscriber`;
    const resp = await fetch(tokenUrl, { method: 'GET' });
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data?.error?.message || 'token error');
    }
    const appId = data.appId;
    const token = data.token;
    await client.join(appId, channel, token, uid);
    setText('status', 'watching');
    logLine('Joined as audience');
  }

  document.getElementById('btnJoin').onclick = () => join().catch(e => { setText('status', 'error'); logLine(String(e)); });
})();
