import React from 'react';
import { useDayNight } from '../components/DayNightProvider';
import { Zap } from 'lucide-react';

interface WalletPillProps {
  seeds: number;
  level: number;
  isPro: boolean;
}

export const WalletPill = ({ seeds, level, isPro }: WalletPillProps) => {
  const { isDay } = useDayNight();

  return (
    <div className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-[length:200%_200%] bg-gradient-to-b from-transparent to-[rgba(0,0,0,0.02)] backdrop-blur-md transition-[background-position] duration-1000 ease-in-out [background-position:top] border border-[rgba(0,0,0,0.05)] text-sm font-medium">
      <Zap className="h-4 w-4" />
      <div className="flex items-center space-x-1">
        <span className="flex h-3 w-3 items-center justify-center bg-green-100 rounded-full">
          🌱
        </span>
        <span>{seeds}</span>
      </div>
      <div className="flex items-center space-x-1">
        <span className="flex h-3 w-3 items-center justify-center bg-purple-100 rounded-full">
          ⭐
        </span>
        <span>{level}</span>
      </div>
      {isPro && (
        <span className="flex h-3 w-3 items-center justify-center bg-blue-100 rounded-full text-xs">
          💎
        </span>
      )}
    </div>
  );
};