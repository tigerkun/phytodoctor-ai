import React from 'react';
import { useDayNight } from '../components/DayNightProvider';
import { Sun, Moon } from 'lucide-react';

interface StickyHeaderProps {
  plantName: string;
  healthScore: number;
  seeds: number;
}

export const StickyHeader = ({ plantName, healthScore, seeds }: StickyHeaderProps) => {
  const { isDay } = useDayNight();

  // Determine health indicator
  let healthColor: string;
  let healthLabel: string;
  
  if (healthScore >= 90) {
    healthColor = '#10B981';
    healthLabel = 'Thriving';
  } else if (healthScore >= 70) {
    healthColor = '#34D399';
    healthLabel = 'Healthy';
  } else if (healthScore >= 50) {
    healthColor = '#FBBF24';
    healthLabel = 'Needs Attention';
  } else {
    healthColor = '#F97316';
    healthLabel = 'Critical';
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-3 bg-[length:200%_200%] bg-gradient-to-b from-transparent to-[rgba(0,0,0,0.02)] backdrop-blur-md transition-[background-position] duration-1000 ease-in-out [background-position:top] border-b border-[rgba(0,0,0,0.05)]">
      <div className="flex items-center space-x-3">
        <div className="flex h-8 w-8 items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C9.79 2 8 3.79 8 6V18C8 20.21 9.79 22 12 22C14.21 22 16 20.21 16 18V6C16 3.79 14.21 2 12 2Z" stroke="currentColor" strokeWidth="2"/>
            <path d="M12 8V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M8 12H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <span className="font-serif text-lg font-bold tracking-tight">{plantName}</span>
      </div>
      
      <div className="flex items-center space-x-4 text-sm">
        <div className="flex items-center space-x-2">
          <div className="flex h-4 w-4 items-center justify-center" style={{ backgroundColor: healthColor, width: '6px', height: '6px', borderRadius: '50%' }} />
          <span>{healthLabel}</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="flex h-4 w-4 items-center justify-center bg-yellow-100 rounded-full">
            🌱
          </span>
          <span>{seeds}</span>
        </div>
        <button className="p-2 rounded-full hover:bg-[rgba(0,0,0,0.1)] transition-colors duration-200">
          {isDay ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
};