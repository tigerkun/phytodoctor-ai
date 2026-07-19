import React, { createContext, useEffect, useState } from 'react';

export type Theme = 'day' | 'night';

export interface DayNightContextType {
  theme: Theme;
  toggleTheme: () => void;
  isAutomatic: boolean;
}

export const DayNightContext = createContext<DayNightContextType | undefined>(undefined);

function getTimeOfDay(): Theme {
  const now = new Date();
  const hours = now.getHours();
  
  // 6 AM - 6 PM = day, 6 PM - 6 AM = night
  return hours >= 6 && hours < 18 ? 'day' : 'night';
}

export function DayNightProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('day');
  const [manualOverride, setManualOverride] = useState<Theme | null>(null);
  const [isAutomatic, setIsAutomatic] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Initialize theme on mount
  useEffect(() => {
    const storedTheme = localStorage.getItem('theme-override') as Theme | null;
    const storedIsAutomatic = localStorage.getItem('theme-automatic');
    
    if (storedTheme) {
      setManualOverride(storedTheme);
      setTheme(storedTheme);
      setIsAutomatic(false);
    } else {
      const autoTheme = getTimeOfDay();
      setTheme(autoTheme);
      setIsAutomatic(true);
    }
    
    setMounted(true);
  }, []);

  // Apply theme to DOM
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.style.transition = 'all 1.2s ease-in-out';
  }, [theme, mounted]);

  const toggleTheme = () => {
    setManualOverride(prev => {
      if (prev === null) {
        // Switch to manual override
        const newTheme = theme === 'day' ? 'night' : 'day';
        setTheme(newTheme);
        setIsAutomatic(false);
        localStorage.setItem('theme-override', newTheme);
        localStorage.removeItem('theme-automatic');
        return newTheme;
      } else {
        // Reset to automatic
        const autoTheme = getTimeOfDay();
        setTheme(autoTheme);
        setIsAutomatic(true);
        localStorage.removeItem('theme-override');
        localStorage.removeItem('theme-automatic');
        return null;
      }
    });
  };

  const value: DayNightContextType = {
    theme,
    toggleTheme,
    isAutomatic
  };

  return (
    <DayNightContext.Provider value={value}>
      {children}
    </DayNightContext.Provider>
  );
}
