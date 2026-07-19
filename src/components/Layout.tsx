import React, { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { NavigationBar } from './home/NavigationBar';
import MobileBottomNav from './home/MobileBottomNav';
import CursorGlow from './home/CursorGlow';
import AmbientGarden from './AmbientGarden';
import Leafify from './Leafify';
import { PageTransitionProvider } from './home/PageTransitionContext';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthPage = location.pathname.startsWith('/auth');

  // Auth guard: redirect to /auth if not logged in
  React.useEffect(() => {
    const token = localStorage.getItem('botanical_guardian_auth_token');
    if (!token && !isAuthPage) {
      navigate('/auth', { replace: true });
    }
  }, [location.pathname]);

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