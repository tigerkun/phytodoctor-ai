import React from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Microscope, Archive, ShoppingBag, MessageSquare } from 'lucide-react';
import { usePageTransition } from './PageTransitionContext';
import { useDayNightTheme } from '@/hooks/useDayNightTheme';

export default function MobileBottomNav() {
  const location = useLocation();
  const { transitionTo } = usePageTransition();
  const { theme } = useDayNightTheme();

  const navItems = [
    { label: 'Home', href: '/', icon: Home },
    { label: 'Lab', href: '/lab', icon: Microscope },
    { label: 'Vault', href: '/collection', icon: Archive },
    { label: 'Market', href: '/market', icon: ShoppingBag },
    { label: 'AI Chat', href: '/assistant', icon: MessageSquare }
  ];

  const isActive = (href: string) => {
    if (href === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden flex justify-around items-center px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] border-t backdrop-blur-lg shadow-2xl"
      style={{
        background: theme === 'day' ? 'rgba(255, 248, 240, 0.88)' : 'rgba(15, 20, 25, 0.88)',
        borderColor: theme === 'day' ? 'rgba(90, 122, 90, 0.15)' : 'rgba(255, 255, 255, 0.08)'
      }}
    >
      {navItems.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;

        return (
          <button
            key={item.href}
            onClick={() => transitionTo(item.href, item.label)}
            className="relative flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl py-1.5 px-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            style={{
              color: active
                ? 'var(--accent)'
                : 'var(--text-secondary)'
            }}
          >
            <motion.div
              whileTap={{ scale: 0.98 }}
              className="relative z-10 flex flex-col items-center gap-1"
            >
              <Icon size={18} className={active ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
              <span className="whitespace-nowrap text-[8px] font-black uppercase tracking-[0.08em] font-sans">
                {item.label}
              </span>
            </motion.div>

            {active && (
              <motion.div
                layoutId="bottom-nav-active"
                className="absolute inset-0 rounded-2xl -z-0"
                style={{
                  background: theme === 'day'
                    ? 'rgba(90, 122, 90, 0.08)'
                    : 'rgba(255, 255, 255, 0.04)',
                }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
