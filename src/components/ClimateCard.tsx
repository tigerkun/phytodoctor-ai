import React from 'react';

interface ClimateCardProps {
  climateData: {
    temp: number;
    humidity: number;
    city: string;
    tip: string;
    schedule: string[];
  };
}

export const ClimateCard = ({ climateData }: ClimateCardProps) => {
  const { temp, humidity, city, tip, schedule } = climateData;

  return (
    <div className="flex-shrink-0 w-[280px] md:w-[280px] p-6 bg-[length:200%_200%] bg-gradient-to-b from-transparent to-[rgba(0,0,0,0.02)] backdrop-blur-md transition-[background-position] duration-1000 ease-in-out [background-position:top] rounded-2xl border border-[rgba(0,0,0,0.05)] hover:-translate-y-2 hover:shadow-xl transition-all duration-300">
      <div className="space-y-4">
        <div className="flex items-start space-x-3">
          <div className="flex h-8 w-8 items-center justify-center bg-blue-100 rounded-full flex-shrink-0">
            🌤️
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{city}, {temp}°C, {humidity}% humidity</p>
            <p className="text-xs text-muted-foreground">Climate care</p>
          </div>
        </div>
        
        <div className="space-y-3">
          <p className="text-sm text-foreground">{tip}</p>
          
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">3-day watering schedule</p>
            <div className="flex flex-wrap gap-2">
              {schedule.map((day, index) => (
                <div key={index} className="flex items-center space-x-1 px-2 py-1 bg-[rgba(0,0,0,0.05)] rounded text-xs">
                  <span className="flex h-3 w-3 items-center justify-center bg-blue-100 rounded-full">
                    💧
                  </span>
                  <span>{day}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};