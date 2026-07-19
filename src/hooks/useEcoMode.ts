import { useEffect, useState } from 'react';

interface BatteryStatus {
  level: number; // 0-1
  charging: boolean;
  isLow: boolean; // < 20%
}

export function useEcoMode() {
  const [battery, setBattery] = useState<BatteryStatus>({
    level: 1,
    charging: false,
    isLow: false
  });

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check prefers-reduced-motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    // Check Battery API (if available)
    if (!(navigator as any).getBattery && !(navigator as any).battery) return;

    const updateBattery = async () => {
      const battery = await (navigator as any).getBattery?.();
      if (battery) {
        setBattery({
          level: battery.level,
          charging: battery.charging,
          isLow: battery.level < 0.2
        });

        battery.onlevelchange = () => {
          setBattery(prev => ({ ...prev, level: battery.level }));
        };

        battery.onchargingchange = () => {
          setBattery(prev => ({ ...prev, charging: battery.charging }));
        };
      }
    };

    updateBattery();
  }, []);

  return {
    battery,
    ecoModeActive: prefersReducedMotion || battery.isLow,
    prefersReducedMotion,
    shouldDisableAnimations: prefersReducedMotion || battery.isLow,
    shouldReduceParticles: battery.isLow,
    particleCount: battery.isLow ? 2 : battery.level < 0.5 ? 3 : 5,
    animationDuration: battery.isLow ? 2 : 1 // Slower animations on low battery
  };
}
