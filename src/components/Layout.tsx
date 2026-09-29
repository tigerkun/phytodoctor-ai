import React, { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { NavigationBar } from './home/NavigationBar';
import MobileBottomNav from './home/MobileBottomNav';
import { PageTransitionProvider } from './home/PageTransitionContext';
import GardenAmbience from './GardenAmbience';

import { supabase } from '../lib/supabase';
import { GameService } from '../services/gameService';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthPage = location.pathname.startsWith('/auth');
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
        // Pull the authoritative seeds/tier from the server economy.
        GameService.pullServerProfile(userId);
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
    if (!token && !isAuthPage) navigate('/auth', { replace: true });
  }, [hasAuth, isAuthPage, navigate]);

  return (
    <div className="min-h-screen flex flex-col font-sans relative overflow-x-hidden" id="app-shell" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <GardenAmbience />
      <PageTransitionProvider>
        {/* Only show nav when authenticated */}
        {!isAuthPage && hasAuth && (
          <>
            <NavigationBar />
            <MobileBottomNav />
          </>
        )}

        <main className="flex-grow relative z-10 w-full min-w-0 pb-28 md:pb-12 overflow-x-visible overflow-y-auto">
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
      <div className="flex gap-6">
        <Link to="/lab">Lab Notes</Link>
        <Link to="/help">Help &amp; FAQ</Link>
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
      </div>
    </footer>
  );
}
