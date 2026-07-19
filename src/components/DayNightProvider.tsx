import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface DayNightContextType {
  isDay: boolean;
  toggleTheme: () => void;
}

const DayNightContext = createContext<DayNightContextType | undefined>(undefined);

export const DayNightProvider = ({ children }: { children: ReactNode }) => {
  const [isDay, setIsDay] = useState<boolean>(() => {
    // Check for saved preference first
    const savedTheme = localStorage.getItem('botanical-theme');
    if (savedTheme === 'day' || savedTheme === 'night') {
      return savedTheme === 'day';
    }
    
    // Auto-detect based on time
    const hour = new Date().getHours();
    return hour >= 6 && hour < 18; // 6 AM to 6 PM
  });

  useEffect(() => {
    // Update HTML attribute for CSS transitions
    document.documentElement.setAttribute('data-theme', isDay ? 'day' : 'night');
    localStorage.setItem('botanical-theme', isDay ? 'day' : 'night');
  }, [isDay]);

  const toggleTheme = () => {
    setIsDay(!isDay);
  };

  return (
    <DayNightContext.Provider value={{ isDay, toggleTheme }}>
      {children}
    </DayNightContext.Provider>
  );
};

export const useDayNight = () => {
  const context = useContext(DayNightContext);
  if (!context) {
    throw new Error('useDayNight must be used within a DayNightProvider');
  }
  return context;
};