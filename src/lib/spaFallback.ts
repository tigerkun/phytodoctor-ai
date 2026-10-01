// Decides what the static handler should do with a request that
// `express.static` did not serve.
//
// This used to be `app.get('*')`, which answered everything with
// index.html and a 200. That is wrong in three ways that all showed up in
// production:
//
//   /robots.txt          -> index.html, Content-Type: text/html, 200
//   /assets/missing.js   -> index.html, Content-Type: text/html, 200
//   /api/typo            -> index.html, Content-Type: text/html, 200
//
// A crawler parsing robots.txt gets HTML. A stale asset name returns a 200,
// so caches are willing to store it, and the browser then tries to execute
// HTML as JavaScript and reports "Unexpected token '<'" instead of the
// obvious 404. And a mistyped API path comes back 200, so `res.ok` passes
// and the client fails later somewhere unrelated to the actual mistake.

export type StaticDecision =
  /** A client-side route: send the SPA shell. */
  | 'spa'
  /** A missing file. 404, not the shell. */
  | 'not-found'
  /** A miss inside /api. Answer in JSON so the failure reads as JSON. */
  | 'api-not-found';

// Every client-side route is a bare path: /, /lab, /plant/abc123. A trailing
// extension means the caller is asking for a real file, so honour the miss.
const FILE_EXTENSION = /\.[a-z0-9]{1,6}$/i;

export function classifyStaticRequest(pathname: string, method = 'GET'): StaticDecision {
  const path = pathname.split(/[?#]/)[0];

  // `/api` on its own is the API root, not a route.
  if (path === '/api' || path.startsWith('/api/')) return 'api-not-found';

  // Only navigation requests get the shell. Express's own 404 already covers
  // the rest, and answering a POST with a 200 of HTML hides real breakage.
  const verb = method.toUpperCase();
  if (verb !== 'GET' && verb !== 'HEAD') return 'not-found';

  if (FILE_EXTENSION.test(path)) return 'not-found';

  return 'spa';
}
