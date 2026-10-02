import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { pageTitle } from '@/lib/navRoutes';

/**
 * Tells a screen reader the page changed, and puts keyboard focus at the top of
 * the new page.
 *
 * Without this, a single-page route change is completely silent: the reader
 * user is left wherever focus happened to be -- often a nav button that no
 * longer exists in context, or the middle of a long document they have to
 * re-scan from scratch. Neither the router nor the scroll reset announces
 * anything; both are visual-only.
 */
export default function RouteAnnouncer() {
  const location = useLocation();
  const [message, setMessage] = useState('');
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Silent on arrival. A cold start has nothing to compare the page against,
    // and the focus move below would land before the page has rendered.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    setMessage(`${pageTitle(location.pathname)} loaded`);

    // Focus the new page so the next Tab starts from its top rather than from
    // wherever the old page left the caret. preventScroll keeps this from
    // fighting the scroll reset that App.tsx already performs.
    document.getElementById('main-content')?.focus({ preventScroll: true });
  }, [location.pathname]);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}