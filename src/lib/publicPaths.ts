/**
 * The routes a visitor may hold without an account.
 *
 * Two guards protect the private pages -- RequireAuth inside App.tsx's route
 * table, and the redirect in Layout. They live in different files, so nothing
 * stops someone un-wrapping a route while the other guard still treats it as
 * closed. That is not hypothetical: it is how the landing page stayed
 * unreachable to every signed-out visitor while App.tsx plainly rendered it
 * un-wrapped. `routeGates.test.ts` fails if this list stops matching App.tsx.
 *
 * It lives in its own module so the test can import it without dragging React
 * and the router in behind it.
 */
export const PUBLIC_PATHS = ['/', '/auth', '/lab', '/help', '/privacy', '/terms'];

/** Whether `pathname` is one of the open routes, exactly or below it. */
export function isPublicPath(pathname: string): boolean {
  // Callers pass location.pathname, but a guard that silently closes on a
  // stray '?tab=dex' would be a nasty failure mode, so drop the query and hash.
  const path = pathname.split(/[?#]/)[0];
  return PUBLIC_PATHS.some(p => path === p || path.startsWith(`${p}/`));
}