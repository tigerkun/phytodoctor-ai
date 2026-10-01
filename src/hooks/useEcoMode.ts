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

    let cancelled = false;
    let manager: any = null;
    const onLevelChange = () => { if (manager) read(manager); };
    const onChargingChange = () => { if (manager) read(manager); };

    // isLow is derived here rather than only at mount. The handlers used to
    // update `level` and `charging` but leave `isLow` at its initial value, so
    // the moment the battery actually dropped below 20% nothing changed:
    // ecoModeActive, shouldDisableAnimations and shouldReduceParticles all kept
    // returning full-quality values, and the low-battery protection never
    // engaged after the first read.
    const read = (b: any) => {
      setBattery({
        level: b.level,
        charging: b.charging,
        isLow: !b.charging && b.level < 0.2
      });
    };

    const updateBattery = async () => {
      const battery = await (navigator as any).getBattery?.();
      if (!battery || cancelled) return;
      manager = battery;
      read(battery);
      // addEventListener/removeEventListener, not the `onlevelchange`
      // properties: assigning those clobbers any other listener and, with no
      // cleanup below, kept firing setState after unmount.
      battery.addEventListener?.('levelchange', onLevelChange);
      battery.addEventListener?.('chargingchange', onChargingChange);
    };

    updateBattery();

    return () => {
      cancelled = true;
      if (manager) {
        manager.removeEventListener?.('levelchange', onLevelChange);
        manager.removeEventListener?.('chargingchange', onChargingChange);
      }
    };
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
