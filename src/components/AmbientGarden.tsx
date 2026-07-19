import React from 'react';
import { useEcoMode } from '../hooks/useEcoMode';
import { useDayNightTheme } from '@/hooks/useDayNightTheme';
import '../styles/ambient.css';

/**
 * AmbientGarden
 * Global Full-Viewport Canopy Layer — 50 high-visibility mid-sage leaf nodes
 * falling with @keyframes canopy-fall physics spec (7s–15s, ease-in-out).
 *
 * Total particle call: 50 canopy leaves + 20 petals + 8 pollen + 5 light rays
 * = 83 animated particles continuously looping across the viewport.
 */
export default function AmbientGarden() {
  const { shouldDisableAnimations } = useEcoMode();
  const { theme } = useDayNightTheme();
  if (shouldDisableAnimations) return null;
  // 16 leaf particles — staggered layout + speed/delay variance for a subtle background drift
  const leaves = [
    { left: 5,   duration:  9.5, delay: 0.0  },
    { left: 12,  duration: 12.0, delay: 2.5  },
    { left: 20,  duration:  8.0, delay: 5.0  },
    { left: 28,  duration: 14.5, delay: 1.0  },
    { left: 35,  duration: 10.5, delay: 7.5  },
    { left: 42,  duration: 13.0, delay: 3.5  },
    { left: 50,  duration:  9.0, delay: 9.0  },
    { left: 58,  duration: 11.5, delay: 6.0  },
    { left: 65,  duration: 15.0, delay: 11.0 },
    { left: 72,  duration:  8.5, delay: 4.5  },
    { left: 80,  duration: 12.5, delay: 13.0 },
    { left: 88,  duration: 10.0, delay: 8.0  },
    { left: 95,  duration: 14.0, delay: 15.0 },
    { left: 15,  duration: 11.0, delay: 17.5 },
    { left: 55,  duration:  9.8, delay: 19.0 },
    { left: 75,  duration: 13.5, delay: 21.0 },
  ];

  // Rich mid-sage / deep-green palette — saturated for cream (#FDFCF6) readability
  const leafTints = [
    'rgba(82, 121, 111, 0.85)',   // #52796F — primary mid-sage
    'rgba(61,  99,  83, 0.82)',   // deep forest green
    'rgba(93, 154, 106, 0.80)',   // #5D9E72 — live sage
    'rgba(45,  80,  65, 0.88)',   // near-black forest
    'rgba(116,165,127, 0.78)',   // #74A57F — bright sage
  ];

  return (
    <div className="ambient-container" aria-hidden="true" id="ambient-garden-root">
      <div className="leaf-overlay" id="ambient-leaf-overlay" />

      {/* ── Canopy: 16 falling organic leaf nodes ─────────────────── */}
      {leaves.map((leaf, i) => {
        const size = 24 + ((i * 7) % 33); // 24–57px spread
        const tint = leafTints[i % leafTints.length];
        return (
          <div
            key={`canopy-leaf-${i}`}
            className="canopy-leaf"
            style={{
              left: `${leaf.left}%`,
              animationDuration: `${leaf.duration}s`,
              animationDelay: `${leaf.delay}s`,
              width: `${size}px`,
              height: `${size}px`,
              borderRadius: '0 100% 0 100%',
              background: `radial-gradient(circle, ${tint} 0%, ${tint.replace(/[\d.]+\)$/, '0.10)')} 60%, transparent 100%)`,
              opacity: 0,
            }}
          />
        );
      })}

      {/* ── 12 Floating Petals ──────────────────────────────────── */}
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={`petal-${i}`}
          className="petal"
          style={{
            left: `${(i * 23 + 3) % 100}%`,
            animationDuration: `${8 + Math.random() * 10}s`,
            animationDelay: `${Math.random() * 15}s`,
            opacity: 0.40 + Math.random() * 0.30,
          }}
        />
      ))}

      {/* ── 6 Drifting Pollen Particles ───────────────────────────── */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={`pollen-${i}`}
          className="pollen"
          style={{
            left: `${(i * 19 + 7) % 100}%`,
            bottom: `${(Math.random() * 25).toFixed(0)}%`,
            animationDuration: `${16 + Math.random() * 12}s`,
            animationDelay: `${Math.random() * 18}s`,
            opacity: 0.35 + Math.random() * 0.30,
          }}
        />
      ))}

      {theme === 'day' ? (
        <>
          {/* ── Day: 3 Visible Sunlight Rays ─────────────────────────────────── */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={`ray-${i}`}
              className="light-ray"
              style={{
                left: `${15 + i * 30}%`,
                animationDelay: `${i * 4}s`,
                opacity: 0.40 + Math.random() * 0.25,
                width: `${30 + Math.random() * 20}vw`,
                background: 'linear-gradient(180deg, rgba(255,245,210,0.8) 0%, rgba(255,245,210,0) 100%)',
              }}
            />
          ))}

          {/* ── Day: Gentle green depth-haze over viewport ── */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#FDFCF6]/0 via-transparent to-garden-cream/30 pointer-events-none transition-colors duration-1000" />

          {/* ── Day: Dappled sunlight overlay ────────────────────────────── */}
          <div className="dapple-overlay opacity-[0.75] mix-blend-soft-light transition-opacity duration-1000" />
        </>
      ) : (
        <>
          {/* ── Night: Moonlight Glow ─────────────────────────────────── */}
          <div className="absolute top-0 right-[20%] w-[50vw] h-[50vw] bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen transition-opacity duration-1000" />
          <div className="absolute top-[-10%] right-[25%] w-[30vw] h-[30vw] bg-blue-300/30 rounded-full blur-[80px] pointer-events-none mix-blend-screen transition-opacity duration-1000" />

          {/* ── Night: Deep Indigo Depth-Haze ── */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0B1021]/60 via-transparent to-[#0B1021]/80 pointer-events-none transition-colors duration-1000" />

          {/* ── Night: Fireflies (Replaces Pollen glow) ── */}
          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={`firefly-${i}`}
              className="absolute w-1.5 h-1.5 bg-green-200 rounded-full blur-[1px]"
              style={{
                left: `${Math.random() * 100}%`,
                bottom: `${Math.random() * 60}%`,
                animation: `float ${8 + Math.random() * 10}s infinite ease-in-out`,
                animationDelay: `${Math.random() * 5}s`,
                opacity: 0.4 + Math.random() * 0.6,
                boxShadow: '0 0 8px 2px rgba(134, 239, 172, 0.8)',
              }}
            />
          ))}

          {/* ── Night: Stars ── */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
             {Array.from({ length: 30 }).map((_, i) => (
               <div
                 key={`star-${i}`}
                 className="absolute w-0.5 h-0.5 bg-white rounded-full"
                 style={{
                   left: `${Math.random() * 100}%`,
                   top: `${Math.random() * 100}%`,
                   opacity: Math.random(),
                   animation: `pulse ${2 + Math.random() * 3}s infinite`,
                   animationDelay: `${Math.random() * 5}s`
                 }}
               />
             ))}
          </div>
        </>
      )}
    </div>
  );
}
