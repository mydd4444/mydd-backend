export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function corsHeaders(request: Request, allowed: string): Headers {
  const h = new Headers();
  const origin = request.headers.get("origin") || "";
  if (allowed === "*" || allowed.split(",").map(s => s.trim()).includes(origin)) {
    h.set("access-control-allow-origin", allowed === "*" ? "*" : origin);
    h.set("vary", "origin");
  }
  h.set("access-control-allow-methods", "GET,POST,PATCH,OPTIONS");
  h.set("access-control-allow-headers", "content-type,authorization");
  h.set("access-control-allow-credentials", "true");
  return h;
}

export function uid(prefix = ""): string {
  const t = Date.now().toString(36);
  const r = crypto.getRandomValues(new Uint8Array(10));
  const rs = Array.from(r).map(b => b.toString(16).padStart(2,"0")).join("");
  return (prefix ? prefix + "_" : "") + t + rs.slice(0, 16);
}

export async function readJson<T = any>(request: Request): Promise<T> {
  const ct = request.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    throw new Error("Expected application/json");
  }
  return (await request.json()) as T;
}
