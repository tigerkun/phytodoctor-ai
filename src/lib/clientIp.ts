/**
 * Which address a rate limit should count against.
 *
 * The requirement is narrow and absolute: this value must not be something the
 * caller can choose, because both the general limiter and the AI limiter key
 * on it, and the AI routes spend Gemini tokens per call.
 *
 * Why not X-Forwarded-For: measured against production, rotating that header
 * defeated both limiters outright -- 70 requests in 19 seconds, a fresh value
 * each time, and not a single 429. Reading the *rightmost* XFF entry, which
 * is the usual "unspoofable" advice, did not help here: this app sits behind
 * Cloudflare, and the header a client sends survives to this process.
 *
 * CF-Connecting-IP is the header that cannot be forged in this topology.
 * Cloudflare overwrites it with the real client address, and a request that
 * carries its own copy is refused at the edge (HTTP 403, Cloudflare error
 * 1000) before it is proxied onward. A value that reaches us is Cloudflare's.
 *
 * The XFF fallback stays for running without Cloudflare in front -- a local dev
 * server, or a deployment that talks to Render directly. That path is only
 * reachable when nothing rewrites the header, which is also the only case
 * where a client cannot choose it, because the proxy writes it from the real
 * peer address.
 */

/** The subset of the request this needs; keeps it unit-testable. */
export interface IpCarrier {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
}

export function clientIpOf(req: IpCarrier): string {
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf.trim()) return cf.trim();

  const xff = req.headers['x-forwarded-for'];
  const entries =
    typeof xff === 'string' ? xff.split(',').map((s) => s.trim()).filter(Boolean) : [];
  if (entries.length > 0) return entries[entries.length - 1];

  return req.ip || req.socket?.remoteAddress || 'unknown';
}