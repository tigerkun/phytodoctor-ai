import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sprout } from 'lucide-react';

interface PageTransitionContextType {
  transitionTo: (to: string, pageName: string) => void;
  isTransitioning: boolean;
}

const PageTransitionContext = createContext<PageTransitionContextType | undefined>(undefined);

export function PageTransitionProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [targetPath, setTargetPath] = useState('');
  const [targetName, setTargetName] = useState('');

  const transitionTo = (to: string, pageName: string) => {
    // If we're already on that page, do nothing
    if (location.pathname === to) return;
    setIsTransitioning(true);
    setTargetPath(to);
    setTargetName(pageName);
  };

  useEffect(() => {
    if (isTransitioning && targetPath) {
      // Navigate almost instantly (50ms)
      const navTimer = setTimeout(() => {
        navigate(targetPath);
      }, 50);

      // Dismiss overlay quickly (300ms)
      const completeTimer = setTimeout(() => {
        setIsTransitioning(false);
      }, 300);

      return () => {
        clearTimeout(navTimer);
        clearTimeout(completeTimer);
      };
    }
  }, [isTransitioning, targetPath, navigate]);

  return (
    <PageTransitionContext.Provider value={{ transitionTo, isTransitioning }}>
      {children}
      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-lg bg-bg-primary/80 pointer-events-auto"
          >
            {/* Ambient decorative leaves in loader */}
            <div className="absolute inset-0 overflow-hidden opacity-10 pointer-events-none">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
                className="absolute -top-12 -left-12 text-9xl text-moss"
              >
                🍃
              </motion.div>
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
                className="absolute -bottom-16 -right-16 text-9xl text-moss"
              >
                🌿
              </motion.div>
            </div>

            <div className="text-center space-y-6 w-full max-w-md px-6 relative z-10">
              {/* Premium Shimmer Ring */}
              <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-moss/10"
                />
                <motion.div
                  className="absolute inset-0 rounded-full border-t-2 border-r-2 border-moss"
                  style={{ borderTopColor: 'var(--moss)', borderRightColor: 'var(--moss)' }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                />
                <motion.div
                  animate={{ scale: [0.9, 1.1, 0.9] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="text-3xl"
                >
                  🌱
                </motion.div>
              </div>
              <div className="space-y-2">
                <motion.p
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="text-[10px] uppercase tracking-[0.3em] font-black text-text-stone/60 font-sans"
                >
                  Synchronizing Garden Ecosystem
                </motion.p>
                <motion.h2
                  initial={{ y: 15, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-3xl font-serif font-black text-text-bark"
                >
                  Heading to {targetName}...
                </motion.h2>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
