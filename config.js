// === CONFIG ===
// Agora App ID (public). App Certificate must stay on backend only.
window.AGORA_APP_ID = "5d5e84ffd2ca46c0a71cf82b8033ff6b";

// Your API domain (Cloudflare Worker custom domain)
window.API_BASE = "https://api.mydd.com";
// Default channel name if URL doesn't provide one
window.DEFAULT_CHANNEL = "test1";
// LiveId used for realtime viewer count (if omitted, uses channel)
window.DEFAULT_LIVE_ID = "test1";
