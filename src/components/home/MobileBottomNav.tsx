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
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200, delay: 0.5 }}
      className="fixed bottom-4 left-4 right-4 z-50 md:hidden flex justify-around items-center py-3 px-4 rounded-[2rem] border backdrop-blur-lg shadow-2xl transition-all"
      style={{
        background: theme === 'day'
          ? 'rgba(255, 248, 240, 0.85)'
          : 'rgba(15, 20, 25, 0.85)',
        borderColor: theme === 'day'
          ? 'rgba(90, 122, 90, 0.15)'
          : 'rgba(255, 255, 255, 0.08)',
        boxShadow: theme === 'day'
          ? '0 12px 40px -10px rgba(90, 122, 90, 0.15)'
          : '0 12px 40px -10px rgba(0, 0, 0, 0.5)'
      }}
    >
      {navItems.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;

        return (
          <button
            key={item.href}
            onClick={() => transitionTo(item.href, item.label)}
            className="relative flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all focus:outline-none"
            style={{
              color: active
                ? 'var(--accent)'
                : 'var(--text-secondary)'
            }}
          >
            <motion.div
              whileTap={{ scale: 0.85 }}
              whileHover={{ y: -2 }}
              className="relative z-10 flex flex-col items-center gap-1"
            >
              <Icon size={18} className={active ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
              <span className="text-[9px] font-black uppercase tracking-wider font-sans">
                {item.label}
              </span>
            </motion.div>

            {active && (
              <motion.div
                layoutId="bottomBubble animate-pulse"
                className="absolute inset-0 rounded-2xl -z-0"
                style={{
                  background: theme === 'day'
                    ? 'rgba(90, 122, 90, 0.08)'
                    : 'rgba(255, 255, 255, 0.04)',
                }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
          </button>
        );
      })}
    </motion.div>
  );
}
