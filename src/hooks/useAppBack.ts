import { useCallback, useRef } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { resolveBackTarget, nextHistoryDepth } from '@/lib/backRoute';

/**
 * A back control that works without the browser back button.
 *
 * The depth counter starts at 1 on mount and is deliberately never read from
 * `window.history.length`: that number includes entries from before the app was
 * entered, so in a WebView wrapper it reports plenty of history when there is
 * none. Counting our own pushes is the only version of this number that is
 * true at the moment it matters -- a cold start straight onto a deep link.
 */
export function useAppBack() {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();

  // Derived during render, deliberately not in an effect. An effect runs after
  // the render that already computed the target has finished, and mutating a
  // ref there triggers no re-render to correct it -- so after any forward
  // navigation the control kept offering the cold-start fallback ("Back to
  // Home") instead of stepping through history, until some unrelated state
  // change happened to re-render the header.
  //
  // Guarding on the location key also makes this idempotent under StrictMode's
  // double render: the second pass sees the key it just stored and stops.
  const depth = useRef(1);
  const seenKey = useRef<string | null>(null);
  if (seenKey.current !== location.key) {
    seenKey.current = location.key;
    depth.current = nextHistoryDepth(depth.current, navigationType);
  }

  const target = resolveBackTarget(location.pathname, depth.current > 1);

  const goBack = useCallback(() => {
    if (target.usesHistory) {
      navigate(-1);
    } else if (target.to) {
      navigate(target.to);
    }
  }, [navigate, target.to, target.usesHistory]);

  return { target, goBack };
}