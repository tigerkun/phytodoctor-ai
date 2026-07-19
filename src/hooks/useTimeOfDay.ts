import { useEffect, useState } from 'react';
import { useDayNightTheme } from './useDayNightTheme';

export type TimePeriod = 'dawn' | 'morning' | 'afternoon' | 'dusk' | 'night' | 'late-night';

export function getBackgroundGradient(period: TimePeriod): string {
  switch (period) {
    case 'dawn':
      return 'from-[#FBE8C4] to-[#A8C9A8] text-[#3D405B]'; // Soft peach to pale moss
    case 'morning':
      return 'from-[#A8C9A8] to-[#FAF7F2] text-[#3D405B]'; // Pale moss to warm cream
    case 'afternoon':
      return 'from-[#FAF7F2] to-[#FBE8C4] text-[#3D405B]'; // Warm cream to soft peach
    case 'dusk':
      return 'from-[#C4704B] to-[#1E2326] text-[#FAF7F2]'; // Terracotta to deep charcoal
    case 'night':
      return 'from-[#1E2326] to-[#0F1419] text-[#FAF7F2]'; // Charcoal to midnight
    case 'late-night':
      return 'from-[#0F1419] to-[#161A1D] text-[#FAF7F2]'; // Midnight to deep bark
    default:
      return 'from-[#A8C9A8] to-[#FAF7F2] text-[#3D405B]';
  }
}

export function useTimeOfDay() {
  const { theme } = useDayNightTheme();
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('morning');

  useEffect(() => {
    const determineTimePeriod = () => {
      const hours = new Date().getHours();
      
      // If theme is overridden manually, force time periods corresponding to theme
      if (theme === 'day') {
        if (hours >= 6 && hours < 18) {
          if (hours >= 6 && hours < 9) return 'dawn';
          if (hours >= 9 && hours < 12) return 'morning';
          return 'afternoon';
        }
        return 'morning'; // Fallback day period
      } else {
        if (hours >= 18 || hours < 6) {
          if (hours >= 18 && hours < 21) return 'dusk';
          if (hours >= 21 || hours < 0) return 'night';
          return 'late-night';
        }
        return 'night'; // Fallback night period
      }
    };

    setTimePeriod(determineTimePeriod());

    const interval = setInterval(() => {
      setTimePeriod(determineTimePeriod());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [theme]);

  const getGreeting = () => {
    const raw = localStorage.getItem('botanical_guardian_user_name') || '';
    const name = raw.split(' ')[0] || 'Guardian';
    switch (timePeriod) {
      case 'dawn':
        return `Good morning, ${name}. Your garden is starting to wake up.`;
      case 'morning':
        return `Good morning, ${name}. Your garden is soaking up the sun.`;
      case 'afternoon':
        return `Good afternoon, ${name}. Perfect time to check on your plants.`;
      case 'dusk':
        return `Good evening, ${name}. The evening air is settling in.`;
      case 'night':
        return `The garden rests, but you're still tending. Beautiful.`;
      case 'late-night':
        return `Quiet hours. Your plants are resting under the stars.`;
      default:
        return `Welcome to your garden sanctuary.`;
    }
  };

  return {
    timeOfDay: timePeriod,
    greeting: getGreeting(),
    themeMode: theme
  };
}
