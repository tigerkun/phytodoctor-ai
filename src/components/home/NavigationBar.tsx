import React from 'react';
import { motion } from 'framer-motion';
import { Leaf, Sun, Moon, ChevronLeft } from 'lucide-react';
import { useDayNightTheme } from '@/hooks/useDayNightTheme';
import { NavLink, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { GameService } from '@/services/gameService';
import { NAV_DESTINATIONS, isDestinationActive } from '@/lib/navRoutes';
import { useAppBack } from '@/hooks/useAppBack';
import { usePageTransition } from './PageTransitionContext';

export function NavigationBar() {
  const { theme, toggleTheme, isAutomatic } = useDayNightTheme();
  const profile = useLiveQuery(() => GameService.getProfile());
  const seedCount = profile?.seeds || 0;
  const location = useLocation();
  const { transitionTo } = usePageTransition();
  const { target: back, goBack } = useAppBack();

  // Every destination is a NavLink, not a button. A button has no href, so the
  // browser cannot open the page in a new tab, a long-press cannot offer a
  // link, and a packaged app cannot register it as a deep link. NavLink also
  // sets aria-current itself, which is what tells a screen reader which tab is
  // the current page.
  const showBack = back.usesHistory || back.to !== null;

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
        <div className="flex items-center gap-2 min-w-0">
          {/* The back control, not the logo, is the leftmost thing on a deep
              page. This is the affordance the browser back button used to
              provide and that a packaged app does not have. */}
          {showBack && (
            <button
              onClick={goBack}
              aria-label={back.label}
              className="w-11 h-11 shrink-0 grid place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss"
              style={{ color: 'var(--text-secondary)' }}
            >
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
          )}

          {/* Logo */}
          <button
            aria-label="Go to home"
            onClick={() => transitionTo('/', 'Home')}
            className="flex min-h-11 items-center gap-2 cursor-pointer transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss"
            style={{ color: 'var(--text-primary)' }}
          >
            <Leaf size={20} aria-hidden="true" className="text-moss shrink-0" />
            <span className="font-serif text-xl font-bold relative">PhytoDoctor</span>
          </button>
        </div>

        {/* Center Navigation Pills */}
        <nav aria-label="Primary" className="hidden md:flex items-center gap-6">
          {NAV_DESTINATIONS.map((item) => {
            const active = isDestinationActive(item.path, location.pathname);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
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
              </NavLink>
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
            {theme === 'day' ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
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
            {/* A bare "4,250" announced on its own tells a screen reader user
                nothing about what the number is. */}
            <span className="font-mono font-bold text-sm">
              {seedCount.toLocaleString()}
              <span className="sr-only"> seeds</span>
            </span>
          </div>

          {/* Avatar */}
          <button
            aria-label="Open profile"
            onClick={() => transitionTo('/profile', 'Profile')}
            className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss focus-visible:ring-offset-2"
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