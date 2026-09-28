import React, { createContext, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface PageTransitionContextType {
  transitionTo: (to: string, pageName: string) => void;
  isTransitioning: boolean;
}

const PageTransitionContext = createContext<PageTransitionContextType | undefined>(undefined);

export function PageTransitionProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const transitionTo = (to: string, _pageName: string) => {
    // If we're already on that page, do nothing
    if (location.pathname === to) return;
    navigate(to);
  };

  return (
    <PageTransitionContext.Provider value={{ transitionTo, isTransitioning: false }}>
      {children}
    </PageTransitionContext.Provider>
  );
}

export function usePageTransition() {
  const context = useContext(PageTransitionContext);
  if (!context) {
    throw new Error('usePageTransition must be used within a PageTransitionProvider');
  }
  return context;
}
