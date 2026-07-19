import React from 'react';

interface GardenPulseProps {
  // In a real implementation, these would come from data/h hooks
  temperature: number;
  city: string;
  waterInHours: number;
  plantCount: number;
  streakDays: number;
}

export const GardenPulse = ({ temperature, city, waterInHours, plantCount, streakDays }: GardenPulseProps) => {
  return (
    <div className="flex flex-col md:flex-row items-center justify-between px-4 py-3 bg-[length:200%_200%] bg-gradient-to-b from-transparent to-[rgba(0,0,0,0.02)] backdrop-blur-md transition-[background-position] duration-1000 ease-in-out [background-position:top] border border-[rgba(0,0,0,0.05)] rounded-lg">
      <div className="flex items-center space-x-4 text-sm">
        <div className="flex items-center space-x-2">
          <span className="flex h-4 w-4 items-center justify-center bg-red-100 rounded-full">
            🌡️
          </span>
          <span>{temperature}°C {city}</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="flex h-4 w-4 items-center justify-center bg-blue-100 rounded-full">
            💧
          </span>
          <span>Water in {waterInHours}h</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="flex h-4 w-4 items-center justify-center bg-green-100 rounded-full">
            🌱
          </span>
          <span>{plantCount} plants</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="flex h-4 w-4 items-center justify-center bg-orange-100 rounded-full">
            🔥
          </span>
          <span>{streakDays}-day streak</span>
        </div>
      </div>
      
      {/* Add a Plant CTA */}
      <button className="px-4 py-2 bg-[length:200%_200%] bg-gradient-to-b from-transparent to-[rgba(0,0,0,0.02)] backdrop-blur-md transition-[background-position] duration-1000 ease-in-out [background-position:top] border border-[rgba(0,0,0,0.1)] rounded-lg font-medium text-sm transition-all duration-200 hover:bg-[rgba(0,0,0,0.05)] active:bg-[rgba(0,0,0,0.1)]">
        <span className="flex items-center space-x-2">
          <span className="flex h-4 w-4 items-center justify-center bg-red-100 rounded-full">
            🌱
          </span>
          <span>Add a Plant</span>
        </span>
      </button>
    </div>
  );
};