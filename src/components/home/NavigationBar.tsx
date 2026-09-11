import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useDayNightTheme } from '@/hooks/useDayNightTheme';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { GameService } from '@/services/gameService';
import { usePageTransition } from './PageTransitionContext';

export function NavigationBar() {
  const { theme, toggleTheme, isAutomatic } = useDayNightTheme();
  const profile = useLiveQuery(() => GameService.getProfile());
  const seedCount = profile?.seeds || 0;
  const initial = profile?.username?.[0]?.toUpperCase() || 'G';
  const location = useLocation();
  const navigate = useNavigate();
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
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="sticky top-0 z-50 backdrop-blur-md border-b"
      style={{
        background: theme === 'day'
          ? 'linear-gradient(180deg, rgba(255, 248, 240, 0.92), rgba(255, 248, 240, 0.72))'
          : 'linear-gradient(180deg, rgba(15, 20, 25, 0.95), rgba(15, 20, 25, 0.82))',
        borderColor: theme === 'day' ? 'rgba(90, 122, 90, 0.12)' : 'rgba(255, 255, 255, 0.08)',
        transition: 'background 0.6s ease, border-color 0.6s ease'
      }}
    >
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo */}
        <motion.button
          onClick={() => transitionTo('/', 'Home')}
          className="flex items-center gap-2 cursor-pointer transition-colors hover:opacity-80 group"
          style={{
            color: 'var(--text-primary)'
          }}
        >
          <motion.div
            animate={{ 
              rotate: [0, 5, -3, 0],
              scale: [1, 1.05, 0.98, 1] 
            }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="text-3xl relative"
          >
            🌿
            <motion.div 
              className="absolute inset-0 bg-green-400 rounded-full blur-md opacity-20"
              animate={{ opacity: [0.1, 0.3, 0.1], scale: [1, 1.2, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>
          <span className="font-serif text-xl font-bold relative">
            PhytoDoctor
          </span>
        </motion.button>

        {/* Center Navigation Pills */}
        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <motion.button
                key={item.href}
                onClick={() => transitionTo(item.href, item.label)}
            className="relative px-3 py-2 text-sm font-medium tracking-wide"
            style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}
            whileHover={!active ? { y: -2 } : {}}
          >
            {item.label}
            {active && (
              <motion.div
                layoutId="underline"
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                style={{ background: 'var(--accent)' }}
              />
            )}
              </motion.button>
            );
          })}
        </nav>

        {/* Right Cluster */}
        <div className="flex items-center gap-4">
          {/* Enhanced Day/Night Toggle */}
          <motion.button
            onClick={toggleTheme}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`relative p-2.5 rounded-full overflow-hidden transition-all duration-500 border ${
              theme === 'day' 
                ? 'bg-gradient-to-br from-yellow-100 to-orange-50 border-orange-200/50 shadow-[0_0_15px_rgba(251,191,36,0.4)]' 
                : 'bg-gradient-to-br from-indigo-900 to-slate-900 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.4)]'
            }`}
            title={isAutomatic ? 'Auto mode' : 'Manual mode'}
          >
            {/* Day Visuals (Sunlight & Rays) */}
            <AnimatePresence mode="wait">
              {theme === 'day' ? (
                <motion.div
                  key="day"
                  initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
                  transition={{ duration: 0.4, type: "spring" }}
                  className="relative z-10 text-orange-500"
                >
                  <Sun size={20} strokeWidth={2.5} />
                  <motion.div 
                    className="absolute inset-0 bg-yellow-400 rounded-full mix-blend-screen filter blur-md"
                    animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0.8, 0.4] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  />
                </motion.div>
              ) : (
                /* Night Visuals (Moonlight & Stars) */
                <motion.div
                  key="night"
                  initial={{ opacity: 0, rotate: 90, scale: 0.5 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: -90, scale: 0.5 }}
                  transition={{ duration: 0.4, type: "spring" }}
                  className="relative z-10 text-indigo-300"
                >
                  <Moon size={20} strokeWidth={2.5} />
                  <motion.div 
                    className="absolute inset-0 bg-indigo-400 rounded-full mix-blend-screen filter blur-[6px]"
                    animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  />
                  {/* Twinkling star */}
                  <motion.div 
                    className="absolute -top-1 -right-1 w-1 h-1 bg-white rounded-full"
                    animate={{ opacity: [0, 1, 0], scale: [0, 1, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Wallet Pill */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="flex items-center gap-2 px-4 py-2 rounded-full border"
            style={{
              background: theme === 'day' ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.08)',
              borderColor: theme === 'day' ? 'rgba(90,122,90,0.18)' : 'rgba(255,255,255,0.1)',
              color: 'var(--text-primary)'
            }}
          >
            <span className="text-lg">🌱</span>
            <span className="font-mono font-bold text-sm">{seedCount.toLocaleString()}</span>
          </motion.div>

          {/* Avatar */}
          <motion.button
            onClick={() => transitionTo('/profile', 'Profile')}
            whileHover={{ scale: 1.1 }}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm cursor-pointer relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-warm))' }}
          >
            {initial}
            {/* Live active indicator */}
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-white rounded-full"></div>
          </motion.button>
        </div>
      </div>

      {/* Victorian Glasshouse Leaded Transom Trim Ribbon */}
      <div className="h-1.5 w-full leaded-transom opacity-85" aria-hidden="true" />
    </motion.header>
  );
}
