import { useContext, useEffect, useState } from 'react';
import { DayNightContext } from '@/components/home/DayNightProvider';

export function useDayNightTheme() {
  const context = useContext(DayNightContext);
  
  if (!context) {
    throw new Error('useDayNightTheme must be used within DayNightProvider');
  }

  return context;
}
