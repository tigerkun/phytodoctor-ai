import React from 'react';
import { useEcoMode } from '../hooks/useEcoMode';
import { useDayNightTheme } from '@/hooks/useDayNightTheme';
import '../styles/ambient.css';

/**
 * AmbientGarden — static per-scene background wash (morning / day / city / night).
 *
 * The previous version ran 40+ permanently looping particle systems (canopy
 * leaves, pollen, petals, city sparks, 45 stars, 18 fireflies, animated light
 * rays) with Math.random() called directly in render. That read as decorative
 * noise and cost continuous paint work on low-end devices. The scenes now
 * render a single static gradient plus one soft glow each; the day/night
 * scene switcher keeps working.
 */
export default function AmbientGarden() {
  const { shouldDisableAnimations } = useEcoMode();
  const { ambientScene } = useDayNightTheme();

  if (shouldDisableAnimations) return null;

  return (
    <div className="ambient-container" aria-hidden="true" id="ambient-garden-root">
      <div className="leaf-overlay" id="ambient-leaf-overlay" />

      {ambientScene === 'morning' && (
        <div className="absolute inset-0 bg-gradient-to-br from-[#FFE5B4]/40 via-transparent to-[#FFB7C5]/20 pointer-events-none mix-blend-overlay" />
      )}

      {ambientScene === 'day' && (
        <div className="absolute inset-0 bg-gradient-to-b from-[#FDFCF6]/0 via-transparent to-garden-cream/40 pointer-events-none" />
      )}

      {ambientScene === 'city' && (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-[#120B21]/80 via-[#1A1230]/70 to-[#0F1C2E]/90 pointer-events-none" />
          <div className="absolute top-[-10%] left-[10%] w-[38vw] h-[38vw] bg-pink-500/10 rounded-full blur-[100px] pointer-events-none" />
        </>
      )}

      {ambientScene === 'night' && (
        <>
          <div className="absolute inset-0 bg-gradient-to-b from-[#040814]/90 via-[#0A1128]/80 to-[#040814]/95 pointer-events-none" />
          <div className="absolute top-[-5%] right-[15%] w-[38vw] h-[38vw] bg-blue-300/10 rounded-full blur-[110px] pointer-events-none" />
        </>
      )}
    </div>
  );
}
