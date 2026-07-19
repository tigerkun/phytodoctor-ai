import React from 'react';
import { useDayNight } from '../components/DayNightProvider';
import './FloatingElements.css';

export const FloatingElements = () => {
  const { isDay } = useDayNight();

  return (
    <div className="floating-elements fixed inset-0 z-[-1] pointer-events-none overflow-hidden">
      {isDay ? (
        <>
          {/* Day: Bird silhouettes */}
          <div className="bird-layer">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bird" />
            ))}
          </div>
          
          {/* Day: Falling leaves */}
          <div className="leaf-layer">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="falling-leaf" />
            ))}
          </div>
          
          {/* Day: Butterfly landing on cards */}
          <div className="butterfly" />
          
          {/* Day: Cartoon gardener waving */}
          <div className="gardener" />
        </>
      ) : (
        <>
          {/* Night: Fireflies with glow falloff */}
          <div className="firefly-layer-night">
            {[...Array(20)].map((_, i) => (
              <div key={i} className="firefly-night" />
            ))}
          </div>
          
          {/* Night: Moth circling light */}
          <div className="moth" />
          
          {/* Night: Owl blinking */}
          <div className="owl" />
          
          {/* Night: Gardener with lantern */}
          <div className="gardener-night" />
        </>
      )}
    </div>
  );
};