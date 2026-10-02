import React, { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { NavigationBar } from './home/NavigationBar';
import MobileBottomNav from './home/MobileBottomNav';
import { PageTransitionProvider } from './home/PageTransitionContext';
import GardenAmbience from './GardenAmbience';
import RouteAnnouncer from './RouteAnnouncer';

import { supabase } from '../lib/supabase';
import { rememberAuthReturn } from '../lib/guestHandoff';
import { isPublicPath } from '../lib/publicPaths';
import { GameService } from '../services/gameService';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthPage = location.pathname.startsWith('/auth');
  // Pages a visitor may hold without an account. /lab is the whole point of
  // the guest lane: the scan is the product, and a signed-out visitor has to
  // be able to reach it before we ask them for anything.
  const isPublicPage = isPublicPath(location.pathname);
  // Tracks auth so the nav/footer don't flash for logged-out visitors.
  const [hasAuth, setHasAuth] = React.useState(() =>
    Boolean(localStorage.getItem('botanical_guardian_auth_token'))
  );

  // Auth guard & Supabase session sync. This used to re-run on every route
  // change, refetching the session and hitting /api/economy/profile each time
  // — a per-navigation round trip. Split into a one-time hydrate and a
  // separate cheap redirect guard.
  React.useEffect(() => {
    const hydrate = async () => {
      // If Supabase isn't configured, fall back to local token check
      if (!supabase) {
        setHasAuth(Boolean(localStorage.getItem('botanical_guardian_auth_token')));
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      setHasAuth(Boolean(session));

      if (session) {
        // Ensure local storage is synced for Dexie / GameService
        const u = session.user;
        const userId = `sb_${u.id}`;
        localStorage.setItem('botanical_guardian_auth_token', session.access_token);
        localStorage.setItem('botanical_guardian_userId', userId);
        localStorage.setItem('botanical_guardian_user_email', u.email ?? '');
        localStorage.setItem('botanical_guardian_onboarded', '1');
        // Drain anything the outbox still owes the server BEFORE pulling.
        // Order matters: pullServerProfile deliberately bails while entries
        // are queued, because it must not overwrite a local balance the
        // server hasn't caught up with. So without a flush first, deltas
        // stranded by an outage would sit indefinitely — the pull would keep
        // deferring to a queue that nothing else on this path ever drains,
        // and they'd only move if the user happened to earn something.
        GameService.flushSeedSyncOutbox(userId)
          .catch((err) => {
            // A flush that throws must not take the pull down with it. Chaining
            // straight to .then() would leave the balance unsynced for the whole
            // session on any IndexedDB hiccup, with nothing on screen to say so.
            console.error('[Layout] Seed outbox flush failed:', err);
          })
          .then(() => {
            GameService.pullServerProfile(userId);
          });
      }
    };

    hydrate();

    // Listen for auth state changes (login, logout, token refresh)
    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setHasAuth(Boolean(session));
        if (session) {
          localStorage.setItem('botanical_guardian_auth_token', session.access_token);
        } else {
          localStorage.removeItem('botanical_guardian_auth_token');
        }
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  // Redirect guard only — depends on the route so a fresh visit to a protected
  // page still bounces to /auth, but navigation between pages is free.
  React.useEffect(() => {
    if (hasAuth) return;
    const token = supabase
      ? null
      : localStorage.getItem('botanical_guardian_auth_token');
    if (!token && !isPublicPage) {
      // Send them back to whatever they were reaching for once they sign up.
      rememberAuthReturn(`${location.pathname}${location.search}`);
      navigate('/auth', { replace: true });
    }
  }, [hasAuth, isPublicPage, navigate, location.pathname, location.search]);

  return (
    <div className="min-h-screen flex flex-col font-sans relative overflow-x-hidden" id="app-shell" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <GardenAmbience />
      <PageTransitionProvider>
        {/* First Tab stop on every page. With a header, a hero and a nav row
            ahead of the content, a keyboard user otherwise tabs through a dozen
            decorative controls to reach the page they asked for. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:px-5 focus:py-3 focus:rounded-xl focus:bg-[var(--moss)] focus:text-white focus:text-sm focus:font-bold focus:shadow-lg"
        >
          Skip to main content
        </a>

        <RouteAnnouncer />

        {/* Only show nav when authenticated */}
        {!isAuthPage && hasAuth && (
          <>
            <NavigationBar />
            <MobileBottomNav />
          </>
        )}

        {/* tabIndex and focus:outline-none are a pair: the outline rule gives
            RouteAnnouncer somewhere to put focus after a route change, and
            outline-none stops that programmatic move from painting a ring
            around the whole page. The skip link keeps its own ring. */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-grow relative z-10 w-full min-w-0 pb-28 md:pb-12 overflow-x-visible overflow-y-auto focus:outline-none"
        >
          {children}
        </main>

        {!isAuthPage && <Footer />}
      </PageTransitionProvider>
    </div>
  );
}


function Footer() {
  return (
    <footer className="w-full px-6 py-8 mt-12 border-t border-border-light flex flex-col md:flex-row justify-between items-center gap-4 text-[9px] font-black uppercase tracking-widest text-text-muted">
      <div className="flex items-center gap-2">
        <MessageCircle size={14} />
        <span>Diagnostic Research Protocol v1.4.0 active</span>
      </div>
      {/* py-3 gives each link a 44px tap height — at 9px type the text box
          was only 14px tall, well under the touch-target minimum. Library is
          here because the bottom bar caps at five and cannot carry it; this is
          the phone's only route to the Field Library now. */}
      <div className="flex flex-wrap justify-center gap-x-6">
        <Link to="/lab" className="py-3">Lab Notes</Link>
        <Link to="/library" className="py-3">Library</Link>
        <Link to="/help" className="py-3">Help &amp; FAQ</Link>
        <Link to="/privacy" className="py-3">Privacy</Link>
        <Link to="/terms" className="py-3">Terms</Link>
      </div>
    </footer>
  );
}
