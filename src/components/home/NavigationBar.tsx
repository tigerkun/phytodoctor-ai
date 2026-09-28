import React from 'react';
import { motion } from 'framer-motion';
import { Leaf, Sun, Moon } from 'lucide-react';
import { useDayNightTheme } from '@/hooks/useDayNightTheme';
import { useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { GameService } from '@/services/gameService';
import { usePageTransition } from './PageTransitionContext';

export function NavigationBar() {
  const { theme, toggleTheme, isAutomatic } = useDayNightTheme();
  const profile = useLiveQuery(() => GameService.getProfile());
  const seedCount = profile?.seeds || 0;
  const location = useLocation();
  const { transitionTo } = usePageTransition();

  const navItems = [
    { label: 'Home', href: '/' },
    { label: 'Lab', href: '/lab' },
    { label: 'Market', href: '/market' },
    { label: 'Library', href: '/library' },
  ];

  const isActive = (href: string) => {
    return location.pathname === href;
  };

  return (
    <header
      className="sticky top-0 z-50 border-b bg-bg-primary/95 backdrop-blur-sm"
      style={{
        background: theme === 'day'
          ? 'linear-gradient(180deg, rgba(255, 248, 240, 0.92), rgba(255, 248, 240, 0.72))'
          : 'linear-gradient(180deg, rgba(15, 20, 25, 0.95), rgba(15, 20, 25, 0.82))',
        borderColor: theme === 'day' ? 'rgba(90, 122, 90, 0.12)' : 'rgba(255, 255, 255, 0.08)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <button
          aria-label="Go to home"
          onClick={() => transitionTo('/', 'Home')}
          className="flex min-h-11 items-center gap-2 cursor-pointer transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss"
          style={{
            color: 'var(--text-primary)'
          }}
        >
          <Leaf size={20} aria-hidden="true" className="text-moss" />
          <span className="font-serif text-xl font-bold relative">
            PhytoDoctor
          </span>
        </button>

        {/* Center Navigation Pills */}
        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <button
                key={item.href}
                onClick={() => transitionTo(item.href, item.label)}
            className="relative min-h-11 px-3 py-2 text-sm font-medium tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss"
            style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}
          >
            {item.label}
            {active && (
              <motion.div
                layoutId="underline"
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                style={{ background: 'var(--accent)' }}
              />
            )}
              </button>
            );
          })}
        </nav>

        {/* Right Cluster */}
        <div className="flex items-center gap-4">
          {/* Enhanced Day/Night Toggle */}
          <button
            aria-label={theme === 'day' ? 'Switch to night theme' : 'Switch to day theme'}
            onClick={toggleTheme}
            className="grid size-11 place-items-center rounded-[var(--radius-sm)] border border-border-light text-text-bark hover:bg-bg-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss"
            title={isAutomatic ? 'Auto mode' : 'Manual mode'}
          >
            {theme === 'day' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          {/* Wallet Pill */}
          <div className="hidden sm:flex min-h-11 items-center gap-2 px-3 rounded-[var(--radius-sm)] border"
            style={{
              background: theme === 'day' ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.08)',
              borderColor: theme === 'day' ? 'rgba(90,122,90,0.18)' : 'rgba(255,255,255,0.1)',
              color: 'var(--text-primary)'
            }}
          >
            <Leaf size={15} aria-hidden="true" className="text-moss" />
            <span className="font-mono font-bold text-sm">{seedCount.toLocaleString()}</span>
          </div>

          {/* Avatar */}
          <button
            aria-label="Open profile"
            onClick={() => transitionTo('/profile', 'Profile')}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss focus-visible:ring-offset-2"
            style={{ background: 'var(--moss)' }}
          >
            {profile?.username?.[0]?.toUpperCase() || 'G'}
          </button>
        </div>
      </div>

      {/* Victorian Glasshouse Leaded Transom Trim Ribbon */}
      <div className="h-1.5 w-full leaded-transom opacity-85" aria-hidden="true" />
    </header>
  );
}
