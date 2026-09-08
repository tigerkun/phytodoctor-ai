import React, { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { NavigationBar } from './home/NavigationBar';
import MobileBottomNav from './home/MobileBottomNav';
import CursorGlow from './home/CursorGlow';
import AmbientGarden from './AmbientGarden';
import Leafify from './Leafify';
import { PageTransitionProvider } from './home/PageTransitionContext';

import { supabase } from '../lib/supabase';
import { GameService } from '../services/gameService';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthPage = location.pathname.startsWith('/auth');

  // Auth guard & Supabase session sync
  React.useEffect(() => {
    const checkSession = async () => {
      // If Supabase isn't configured, fall back to local token check
      if (!supabase) {
        const token = localStorage.getItem('botanical_guardian_auth_token');
        if (!token && !isAuthPage) navigate('/auth', { replace: true });
        return;
      }

      // Check current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session && !isAuthPage) {
        // No session but trying to access protected route
        navigate('/auth', { replace: true });
      } else if (session) {
        // Ensure local storage is synced for Dexie / GameService
        const u = session.user;
        const userId = `sb_${u.id}`;
        localStorage.setItem('botanical_guardian_auth_token', session.access_token);
        localStorage.setItem('botanical_guardian_userId', userId);
        localStorage.setItem('botanical_guardian_user_email', u.email ?? '');
        localStorage.setItem('botanical_guardian_onboarded', '1');
      }
    };

    checkSession();

    // Listen for auth state changes (login, logout, token refresh)
    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!session && !isAuthPage) {
          localStorage.removeItem('botanical_guardian_auth_token');
          navigate('/auth', { replace: true });
        } else if (session) {
          localStorage.setItem('botanical_guardian_auth_token', session.access_token);
        }
      });
      return () => subscription.unsubscribe();
    }
  }, [location.pathname, isAuthPage, navigate]);

  return (
    <div className="min-h-screen flex flex-col font-sans relative overflow-x-hidden" id="app-shell" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <AmbientGarden />
      <CursorGlow />
      <Leafify />
      <PageTransitionProvider>
        {/* Only show nav when authenticated */}
        {!isAuthPage && (
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
        <span>Privacy</span>
        <span>Terms</span>
      </div>
    </footer>
  );
}