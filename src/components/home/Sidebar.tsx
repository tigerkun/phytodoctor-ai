import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Sun, Moon, ChevronLeft, Sparkles, PlusCircle,
  Stethoscope, MessageSquare, User, HelpCircle, Shield,
  Award, Coins
} from 'lucide-react';
import { useDayNightTheme } from '@/hooks/useDayNightTheme';
import { useLiveQuery } from 'dexie-react-hooks';
import { GameService } from '@/services/gameService';
import { NAV_DESTINATIONS, isDestinationActive } from '@/lib/navRoutes';
import { useAppBack } from '@/hooks/useAppBack';
import { usePageTransition } from './PageTransitionContext';

export function Sidebar() {
  const { theme, toggleTheme, isAutomatic } = useDayNightTheme();
  const userId = GameService.getUserId();
  const profile = useLiveQuery(() => GameService.getProfile(userId), [userId]);
  const seedCount = profile?.seeds || 0;
  const username = profile?.username || localStorage.getItem('botanical_guardian_user_name') || 'Sanctuary Keeper';
  const experienceLevel = profile?.experienceLevel || 'Keeper';
  const location = useLocation();
  const { transitionTo } = usePageTransition();
  const { target: back, goBack } = useAppBack();
  const showBack = back.usesHistory || back.to !== null;

  return (
    <aside
      aria-label="Sanctuary Sidebar"
      className="hidden md:flex flex-col w-64 shrink-0 sticky top-0 h-screen z-40 border-r select-none transition-colors duration-500 overflow-y-auto"
      style={{
        background: theme === 'day'
          ? 'linear-gradient(180deg, rgba(255, 248, 240, 0.96), rgba(250, 243, 233, 0.94))'
          : 'linear-gradient(180deg, rgba(18, 24, 21, 0.97), rgba(12, 17, 15, 0.96))',
        borderColor: theme === 'day' ? 'rgba(90, 122, 90, 0.15)' : 'rgba(255, 255, 255, 0.08)',
      }}
    >
      {/* Top Header: App Logo & Branding */}
      <div className="p-5 pb-4 border-b border-border-light flex flex-col gap-3">
        <button
          type="button"
          aria-label="Go to home"
          onClick={() => transitionTo('/', 'Home')}
          className="flex items-center gap-3 group text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss rounded-lg p-1 -m-1 transition-opacity hover:opacity-90"
        >
          {/* App Logo */}
          <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 shadow-sm border border-moss/20 bg-moss/10 flex items-center justify-center">
            <img
              src="/icon.svg"
              alt="PhytoDoctor Logo"
              className="w-full h-full object-contain p-0.5"
            />
          </div>
          <div className="min-w-0">
            <span className="font-serif text-xl font-bold tracking-tight text-text-bark dark:text-[#FAF7F2] block leading-tight">
              PhytoDoctor
            </span>
            <span className="text-[9px] font-mono tracking-widest uppercase text-moss font-bold block mt-0.5">
              Botanical AI Clinic
            </span>
          </div>
        </button>

        {/* Back Button affordance when deep in sub-routes */}
        {showBack && (
          <button
            type="button"
            onClick={goBack}
            aria-label={back.label}
            className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg text-xs font-mono font-medium text-text-secondary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <ChevronLeft size={16} aria-hidden="true" />
            <span className="truncate">{back.label}</span>
          </button>
        )}
      </div>

      {/* Main Navigation Destinations */}
      <div className="flex-1 px-3 py-4 flex flex-col gap-6">
        <div>
          <span className="text-[10px] font-mono uppercase font-bold tracking-widest text-text-muted px-3 block mb-2">
            Sanctuary Stacks
          </span>
          <nav aria-label="Sidebar Primary" className="flex flex-col gap-1">
            {NAV_DESTINATIONS.map((item) => {
              const active = isDestinationActive(item.path, location.pathname);
              const Icon = item.Icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative group ${
                    active
                      ? 'bg-moss/15 text-moss font-semibold shadow-xs'
                      : 'text-text-secondary hover:text-text-bark dark:hover:text-[#FAF7F2] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <Icon
                    size={18}
                    className={`shrink-0 transition-transform group-hover:scale-105 ${
                      active ? 'text-moss' : 'text-text-secondary'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="truncate">{item.label}</span>
                  {active && (
                    <motion.div
                      layoutId="sidebarActivePill"
                      className="absolute right-2 w-1.5 h-4 bg-moss rounded-full"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Clinical Services */}
        <div>
          <span className="text-[10px] font-mono uppercase font-bold tracking-widest text-text-muted px-3 block mb-2">
            Clinical Desks
          </span>
          <nav aria-label="Sidebar Secondary" className="flex flex-col gap-1">
            <NavLink
              to="/clinic"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-moss/15 text-moss font-semibold'
                    : 'text-text-secondary hover:text-text-bark dark:hover:text-[#FAF7F2] hover:bg-black/5 dark:hover:bg-white/5'
                }`
              }
            >
              <Stethoscope size={18} className="shrink-0 text-text-secondary" aria-hidden="true" />
              <span className="truncate">The Clinic</span>
            </NavLink>

            <NavLink
              to="/assistant"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-moss/15 text-moss font-semibold'
                    : 'text-text-secondary hover:text-text-bark dark:hover:text-[#FAF7F2] hover:bg-black/5 dark:hover:bg-white/5'
                }`
              }
            >
              <MessageSquare size={18} className="shrink-0 text-text-secondary" aria-hidden="true" />
              <span className="truncate">Gardener AI</span>
            </NavLink>
          </nav>
        </div>

        {/* New Scan CTA */}
        <div className="pt-1">
          <NavLink
            to="/lab"
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-moss text-white font-medium text-xs tracking-wide shadow-xs hover:bg-[#324f32] active:scale-[0.98] transition-all"
          >
            <PlusCircle size={16} aria-hidden="true" />
            <span>Scan Specimen</span>
          </NavLink>
        </div>
      </div>

      {/* User Status & Seed Balance Card */}
      <div className="p-4 mx-3 mb-3 rounded-xl border border-border-light bg-black/5 dark:bg-white/5 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-text-muted uppercase text-[9px] font-bold tracking-wider">Sanctuary Vault</span>
          <span className="text-[10px] font-bold text-moss capitalize">{experienceLevel}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-serif font-bold text-lg text-text-bark dark:text-[#FAF7F2] truncate">
            {username}
          </span>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-moss/10 text-moss border border-moss/20 text-xs font-mono font-bold shrink-0">
            <Coins size={12} className="text-moss" aria-hidden="true" />
            <span>{seedCount}</span>
          </div>
        </div>
      </div>

      {/* Bottom Dock: Theme & Profile */}
      <div className="p-3 border-t border-border-light flex items-center justify-between gap-2 text-text-secondary">
        <NavLink
          to="/profile"
          aria-label="Open profile"
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-bark dark:hover:text-[#FAF7F2] text-xs font-medium transition-colors"
        >
          <User size={16} aria-hidden="true" />
          <span>Passport</span>
        </NavLink>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'day' ? 'Switch to night theme' : 'Switch to day theme'}
          title={isAutomatic ? 'Theme: Auto mode' : 'Theme: Manual mode'}
          className="w-9 h-9 grid place-items-center rounded-lg hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-bark dark:hover:text-[#FAF7F2] transition-colors"
        >
          {theme === 'day' ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
        </button>
      </div>
    </aside>
  );
}
export default Sidebar;
