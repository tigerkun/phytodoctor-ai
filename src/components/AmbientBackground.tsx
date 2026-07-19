import React from 'react';
import { useDayNight } from '../components/DayNightProvider';
import './AmbientBackground.css';

export const AmbientBackground = () => {
  const { isDay } = useDayNight();

  return (
    <div className="ambient-background fixed inset-0 z-[-1] pointer-events-none overflow-hidden">
      {isDay ? (
        <>
          {/* Day: Slow clouds */}
          <div className="cloud-layer">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="cloud" />
            ))}
          </div>
          
          {/* Day: Rotating sun rays (conic-gradient) */}
          <div className="sun-rays" />
          
          {/* Day: Floating pollen */}
          <div className="pollen-layer">
            {[...Array(20)].map((_, i) => (
              <div key={i} className="pollen" />
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Night: Twinkling stars */}
          <div className="star-layer">
            {[...Array(50)].map((_, i) => (
              <div key={i} className="star" />
            ))}
          </div>
          
          {/* Night: Slow moon drift */}
          <div className="moon" />
          
          {/* Night: Fireflies */}
          <div className="firefly-layer">
            {[...Array(15)].map((_, i) => (
              <div key={i} className="firefly" />
            ))}
          </div>
        </>
      )}
    </div>
  );
};