import React from 'react';
import { useEcoMode } from '../hooks/useEcoMode';
import { useDayNightTheme } from '@/hooks/useDayNightTheme';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/ambient.css';

/**
 * AmbientGarden
 * A majestic 4-state background layer (Morning, Day, City, Night).
 * Renders distinct visual moods and particle systems based on the ambientScene.
 */
export default function AmbientGarden() {
  const { shouldDisableAnimations } = useEcoMode();
  const { ambientScene } = useDayNightTheme();
  
  if (shouldDisableAnimations) return null;

  // ── Canopy Leaves ──
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
  ];

  const leafTints = [
    'rgba(82, 121, 111, 0.85)',   // primary mid-sage
    'rgba(61,  99,  83, 0.82)',   // deep forest green
    'rgba(93, 154, 106, 0.80)',   // live sage
    'rgba(116,165,127, 0.78)',    // bright sage
  ];

  return (
    <div className="ambient-container" aria-hidden="true" id="ambient-garden-root">
      
      {/* ── Base Texture Overlay ── */}
      <div className="leaf-overlay" id="ambient-leaf-overlay" />

      {/* ── MORNING SCENE ── */}
      {ambientScene === 'morning' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 2 }}>
          {/* Soft Golden Sunrise Gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#FFE5B4]/40 via-transparent to-[#FFB7C5]/20 pointer-events-none mix-blend-overlay" />
          
          {/* Light Rays */}
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={`morning-ray-${i}`}
              className="light-ray"
              style={{
                left: `${10 + i * 25}%`,
                animationDelay: `${i * 3}s`,
                opacity: 0.3 + Math.random() * 0.3,
                width: `${40 + Math.random() * 20}vw`,
                background: 'linear-gradient(180deg, rgba(255,235,180,0.8) 0%, rgba(255,235,180,0) 100%)',
              }}
            />
          ))}

          {/* Drifting Pollen */}
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={`morning-pollen-${i}`}
              className="pollen"
              style={{
                left: `${(i * 17) % 100}%`,
                bottom: `${(Math.random() * 30)}%`,
                animationDuration: `${12 + Math.random() * 10}s`,
                animationDelay: `${Math.random() * 10}s`,
                opacity: 0.5 + Math.random() * 0.4,
              }}
            />
          ))}
          
          {/* Floating Petals */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={`morning-petal-${i}`}
              className="petal"
              style={{
                left: `${(i * 29) % 100}%`,
                animationDuration: `${10 + Math.random() * 8}s`,
                animationDelay: `${Math.random() * 15}s`,
                opacity: 0.6 + Math.random() * 0.3,
              }}
            />
          ))}
        </motion.div>
      )}


      {/* ── DAY SCENE ── */}
      {ambientScene === 'day' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 2 }}>
          {/* Crisp Light Green Depth Haze */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#FDFCF6]/0 via-transparent to-garden-cream/40 pointer-events-none" />
          
          {/* Dappled Sunlight */}
          <div className="dapple-overlay opacity-[0.85] mix-blend-soft-light" />
          
          {/* Falling Leaves */}
          {leaves.map((leaf, i) => {
            const size = 28 + ((i * 7) % 30);
            const tint = leafTints[i % leafTints.length];
            return (
              <div
                key={`day-leaf-${i}`}
                className="canopy-leaf"
                style={{
                  left: `${leaf.left}%`,
                  animationDuration: `${leaf.duration}s`,
                  animationDelay: `${leaf.delay}s`,
                  width: `${size}px`,
                  height: `${size}px`,
                  background: `radial-gradient(circle, ${tint} 0%, ${tint.replace(/[\d.]+\)$/, '0.10)')} 60%, transparent 100%)`,
                }}
              />
            );
          })}
          
          {/* Bold Sun Rays */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={`day-ray-${i}`}
              className="light-ray"
              style={{
                left: `${15 + i * 30}%`,
                animationDelay: `${i * 4}s`,
                opacity: 0.5 + Math.random() * 0.2,
                width: `${35 + Math.random() * 20}vw`,
                background: 'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 100%)',
              }}
            />
          ))}
        </motion.div>
      )}


      {/* ── CITY SCENE ── */}
      {ambientScene === 'city' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 2 }}>
          {/* Neon Twilight Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#120B21]/80 via-[#1A1230]/70 to-[#0F1C2E]/90 pointer-events-none" />
          
          {/* Vaporwave / Neon Light Blooms */}
          <div className="absolute top-[-10%] left-[10%] w-[40vw] h-[40vw] bg-pink-500/10 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />
          <div className="absolute bottom-[-10%] right-[10%] w-[50vw] h-[50vw] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
          <div className="absolute top-[30%] right-[-10%] w-[30vw] h-[30vw] bg-purple-500/10 rounded-full blur-[80px] pointer-events-none mix-blend-screen" />

          {/* Urban Digital Sparks (Recolored Pollen) */}
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={`city-spark-${i}`}
              className="pollen"
              style={{
                left: `${(i * 11) % 100}%`,
                bottom: `${(Math.random() * 50)}%`,
                animationDuration: `${8 + Math.random() * 8}s`,
                animationDelay: `${Math.random() * 10}s`,
                opacity: 0.4 + Math.random() * 0.5,
                background: i % 2 === 0 
                  ? 'radial-gradient(circle, #00FFFF 0%, #0088FF 100%)' 
                  : 'radial-gradient(circle, #FF00FF 0%, #AA00FF 100%)',
                boxShadow: i % 2 === 0 ? '0 0 8px #00FFFF' : '0 0 8px #FF00FF'
              }}
            />
          ))}
        </motion.div>
      )}


      {/* ── NIGHT SCENE ── */}
      {ambientScene === 'night' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 2 }}>
          {/* Deep Indigo Space Haze */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#040814]/90 via-[#0A1128]/80 to-[#040814]/95 pointer-events-none" />
          
          {/* Moonlight Glow */}
          <div className="absolute top-[-5%] right-[15%] w-[40vw] h-[40vw] bg-blue-300/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
          
          {/* Stars */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
             {Array.from({ length: 45 }).map((_, i) => (
               <div
                 key={`star-${i}`}
                 className="absolute w-[2px] h-[2px] bg-white rounded-full"
                 style={{
                   left: `${Math.random() * 100}%`,
                   top: `${Math.random() * 100}%`,
                   opacity: Math.random(),
                   animation: `pulse ${1.5 + Math.random() * 3}s infinite`,
                   animationDelay: `${Math.random() * 5}s`,
                   boxShadow: Math.random() > 0.8 ? '0 0 4px 1px rgba(255,255,255,0.8)' : 'none'
                 }}
               />
             ))}
          </div>

          {/* Fireflies */}
          {Array.from({ length: 18 }).map((_, i) => (
            <div
              key={`night-firefly-${i}`}
              className="absolute w-1.5 h-1.5 bg-[#A7F3D0] rounded-full blur-[1px]"
              style={{
                left: `${Math.random() * 100}%`,
                bottom: `${Math.random() * 60}%`,
                animation: `float ${7 + Math.random() * 8}s infinite ease-in-out`,
                animationDelay: `${Math.random() * 5}s`,
                opacity: 0.3 + Math.random() * 0.7,
                boxShadow: '0 0 10px 2px rgba(16, 185, 129, 0.8)',
              }}
            />
          ))}
        </motion.div>
      )}

    </div>
  );
}
