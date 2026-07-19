import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useEcoMode } from '@/hooks/useEcoMode';
import { useTimeOfDay } from '@/hooks/useTimeOfDay';

// Cute animated ZZZ particles for sleeping animals
const SleepingParticles = ({ delay = 0 }: { delay?: number }) => {
  return (
    <div className="absolute -top-4 -right-2 pointer-events-none select-none z-50">
      {[1, 2, 3].map((id) => (
        <motion.span
          key={id}
          className="absolute text-[10px] font-black text-moss/80 font-mono select-none"
          initial={{ opacity: 0, y: 0, scale: 0.6 }}
          animate={{
            opacity: [0, 0.8, 0],
            y: [-3, -20],
            x: [0, 5, -3, 3],
            scale: [0.6, 1, 0.7]
          }}
          transition={{
            duration: 3.5,
            repeat: Infinity,
            delay: delay + (id * 1.1),
            ease: "easeOut"
          }}
          style={{
            transform: `translate(${id * 3}px, -${id * 3}px)`
          }}
        >
          z
        </motion.span>
      ))}
    </div>
  );
};

const SvgOwl = ({ isDay }: { isDay: boolean }) => {
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full">
      {/* Ears/Horns */}
      <path d="M14 26 L20 12 L28 22 Z" fill="var(--text-bark)" />
      <path d="M50 26 L44 12 L36 22 Z" fill="var(--text-bark)" />
      
      {/* Body */}
      <rect x="16" y="18" width="32" height="38" rx="16" fill="var(--text-bark)" />
      
      {/* Belly */}
      <rect x="22" y="32" width="20" height="18" rx="10" fill="var(--bg-secondary)" opacity={0.8} />
      
      {/* Chest Feathers */}
      <path d="M28 36 L30 38 L32 36" stroke="var(--text-stone)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M32 36 L34 38 L36 36" stroke="var(--text-stone)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M30 42 L32 44 L34 42" stroke="var(--text-stone)" strokeWidth="1.5" strokeLinecap="round" fill="none" />

      {/* Eyes Backgrounds */}
      <circle cx="23" cy="26" r="7.5" fill={isDay ? "var(--bg-secondary)" : "#FFF8E7"} />
      <circle cx="41" cy="26" r="7.5" fill={isDay ? "var(--bg-secondary)" : "#FFF8E7"} />
      
      {/* Pupils */}
      {!isDay && (
        <>
          <motion.circle 
            cx="23" 
            cy="26" 
            r="3.5" 
            fill="var(--text-bark)"
            animate={{
              scaleY: [1, 1, 0, 1, 1],
              y: [0, 0, 0.8, 0, 0]
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              times: [0, 0.88, 0.9, 0.92, 1]
            }}
          />
          <motion.circle 
            cx="41" 
            cy="26" 
            r="3.5" 
            fill="var(--text-bark)"
            animate={{
              scaleY: [1, 1, 0, 1, 1],
              y: [0, 0, 0.8, 0, 0]
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              times: [0, 0.88, 0.9, 0.92, 1]
            }}
          />
        </>
      )}
      
      {/* Eyelids / Sleeping Eyes */}
      {isDay ? (
        <>
          <path d="M17.5 26 Q23 30.5 28.5 26" stroke="var(--text-stone)" strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M35.5 26 Q41 30.5 46.5 26" stroke="var(--text-stone)" strokeWidth="2" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <motion.path
            d="M15.5 26 Q23 15 30.5 26 Z"
            fill="var(--text-bark)"
            style={{ transformOrigin: '23px 20px' }}
            animate={{
              scaleY: [0, 0, 1.2, 0, 0],
              opacity: [0, 0, 1, 0, 0]
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              times: [0, 0.88, 0.9, 0.92, 1]
            }}
          />
          <motion.path
            d="M33.5 26 Q41 15 48.5 26 Z"
            fill="var(--text-bark)"
            style={{ transformOrigin: '41px 20px' }}
            animate={{
              scaleY: [0, 0, 1.2, 0, 0],
              opacity: [0, 0, 1, 0, 0]
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              times: [0, 0.88, 0.9, 0.92, 1]
            }}
          />
        </>
      )}
      
      {/* Beak */}
      <polygon points="32,29 29,34 35,34" fill="var(--terracotta)" />
    </svg>
  );
};

const SvgHummingbird = ({ isDay }: { isDay: boolean }) => {
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full">
      {/* Long Slender Beak */}
      <polygon points="46,24 62,21 48,27" fill="var(--text-bark)" />
      {/* Head */}
      <circle cx="44" cy="25" r="7" fill="var(--moss)" />
      {/* Eye */}
      <circle cx="46" cy="24" r="1.5" fill={isDay ? "white" : "var(--text-stone)"} />
      {/* Body */}
      <path d="M44 26 C36 26 26 32 24 44 C26 40 32 38 40 34 Z" fill="var(--moss)" />
      {/* Belly */}
      <path d="M42 29 C38 31 34 36 34 42 C36 39 40 36 42 32 Z" fill="#9CAF88" />
      {/* Wings — CSS-driven animation replaces Framer Motion for performance */}
      <path
        d="M36 29 C32 10 20 8 26 26"
        fill="var(--terracotta)"
        className={isDay ? "wing-beat" : ""}
        style={{
          transformOrigin: '32px 25px',
          transform: !isDay ? 'scaleY(1) rotate(-20deg)' : undefined
        }}
      />
      {/* Tail */}
      <polygon points="24,44 14,54 18,56 26,46" fill="var(--text-stone)" />
    </svg>
  );
};

const SvgButterfly = ({ isDay }: { isDay: boolean }) => {
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full">
      {/* Left Wing */}
      <motion.path
        d="M32 32 C12 16 8 36 30 40 Z"
        fill="var(--accent)"
        opacity={0.95}
        animate={isDay ? {
          skewY: [0, 15, 0],
          scaleX: [1, 0.2, 1]
        } : {
          scaleX: 0.8
        }}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '32px 32px' }}
      />
      {/* Left Wing Pattern */}
      <motion.circle
        cx="20"
        cy="28"
        r="3"
        fill="var(--terracotta)"
        animate={isDay ? {
          scaleX: [1, 0.2, 1]
        } : {}}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '32px 32px' }}
      />

      {/* Right Wing */}
      <motion.path
        d="M32 32 C52 16 56 36 34 40 Z"
        fill="var(--accent)"
        opacity={0.95}
        animate={isDay ? {
          skewY: [0, -15, 0],
          scaleX: [1, 0.2, 1]
        } : {
          scaleX: 0.8
        }}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '32px 32px' }}
      />
      {/* Right Wing Pattern */}
      <motion.circle
        cx="44"
        cy="28"
        r="3"
        fill="var(--terracotta)"
        animate={isDay ? {
          scaleX: [1, 0.2, 1]
        } : {}}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '32px 32px' }}
      />

      {/* Body */}
      <rect x="30" y="20" width="4" height="24" rx="2" fill="var(--text-bark)" />
      
      {/* Antennae */}
      <path d="M31 20 Q26 12 24 14" stroke="var(--text-stone)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M33 20 Q38 12 40 14" stroke="var(--text-stone)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
};

const SvgSquirrel = ({ isDay }: { isDay: boolean }) => {
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full">
      {/* Bushy Tail */}
      <motion.path
        d="M20 48 C10 48 4 36 12 28 C20 20 28 32 20 48 Z"
        fill="var(--accent-warm)"
        style={{ transformOrigin: '20px 48px' }}
        animate={isDay ? {
          rotate: [0, -5, 10, -5, 0],
        } : {
          rotate: 0,
          scale: 0.95
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
      />
      
      {/* Body */}
      <rect x="22" y="32" width="22" height="22" rx="10" fill="var(--accent-warm)" />
      
      {/* Head */}
      <rect x="28" y="20" width="18" height="18" rx="8" fill="var(--accent-warm)" />
      
      {/* Ears */}
      <polygon points="32,20 30,12 36,18" fill="var(--accent-warm)" />
      <polygon points="42,20 44,12 38,18" fill="var(--accent-warm)" />

      {/* Eye */}
      <circle cx="38" cy="27" r="2" fill="var(--text-bark)" />

      {/* Cheeks / Snout */}
      <circle cx="44" cy="30" r="1.5" fill="var(--terracotta)" opacity={isDay ? 0.8 : 0.4} />

      {/* Front Paws holding Acorn */}
      <circle cx="44" cy="40" r="2.5" fill="var(--text-stone)" />
      {/* Acorn */}
      <path d="M42 42 C42 45 46 45 46 42 Z" fill="var(--text-bark)" />
      <path d="M41 42 L47 42" stroke="var(--text-stone)" strokeWidth="1.5" />
    </svg>
  );
};

import { type TimePeriod } from '@/hooks/useTimeOfDay';

interface AmbientAnimationsProps {
  overrideTimePeriod?: TimePeriod;
}

export function AmbientAnimations({ overrideTimePeriod }: AmbientAnimationsProps = {}) {
  const { timeOfDay: currentTimeOfDay } = useTimeOfDay();
  const { shouldDisableAnimations, particleCount } = useEcoMode();
  
  const timePeriod = overrideTimePeriod || currentTimeOfDay;
  const isDay = timePeriod === 'dawn' || timePeriod === 'morning' || timePeriod === 'afternoon';

  // Point 6: Hydration-safe screen dimension state
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });

  useEffect(() => {
    setDimensions({
      width: window.innerWidth,
      height: window.innerHeight
    });

    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Stabilize positions to prevent layout shifts/re-renders
  const stableParticles = useMemo(() => {
    return Array.from({ length: particleCount }).map((_, i) => ({
      x: (i * 123) % (dimensions.width || 1200),
      y: (i * 456) % (dimensions.height || 800),
    }));
  }, [particleCount, dimensions.width, dimensions.height]);

  if (shouldDisableAnimations) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[var(--z-ambient)] select-none">
      {/* ── SUN RAYS (Day Only) ── */}
      <motion.div
        className="absolute top-0 left-1/4 w-[min(800px,150vw)] h-[min(800px,150vw)] bg-gradient-conic from-yellow-200/10 via-transparent to-transparent opacity-40"
        animate={{
          rotate: [0, 360],
          opacity: isDay ? 0.35 : 0
        }}
        transition={{
          rotate: { duration: 50, repeat: Infinity, ease: 'linear' },
          opacity: { duration: 1.5 }
        }}
      />

      {/* ── MOON GLOW (Night Only) ── */}
      <motion.div
        className="absolute top-20 right-20 w-[min(400px,80vw)] h-[min(400px,80vw)] bg-gradient-radial from-cyan-200/20 via-transparent to-transparent blur-3xl"
        animate={{
          scale: [1, 1.1, 1],
          opacity: isDay ? 0 : 0.45
        }}
        transition={{
          scale: { duration: 8, repeat: Infinity, ease: 'easeInOut' },
          opacity: { duration: 1.5 }
        }}
      />

      {/* ── STARS (Night Only) ── */}
      {!isDay && Array.from({ length: 25 }).map((_, i) => (
        <motion.div
          key={`star-${i}`}
          className="absolute w-0.5 h-0.5 bg-white rounded-full"
          style={{
            left: `${(i * 17) % 100}%`,
            top: `${(i * 23) % 45}%`
          }}
          animate={{
            opacity: [0.1, 0.8, 0.1]
          }}
          transition={{
            duration: 3 + (i % 3),
            repeat: Infinity,
            delay: (i * 0.4) % 2
          }}
        />
      ))}

      {/* ── POLLEN PARTICLES (Day) / FIREFLIES (Night) ── */}
      {stableParticles.map((pt, i) => {
        const randomX = pt.x;
        const randomY = pt.y;
        
        return (
          <motion.div
            key={`pollen-firefly-${i}`}
            className="absolute rounded-full"
            style={{
              x: randomX,
              y: randomY,
              width: isDay ? 3 : 5,
              height: isDay ? 3 : 5,
              background: isDay ? 'rgba(253, 224, 71, 0.25)' : 'rgba(253, 224, 71, 0.85)',
              boxShadow: isDay ? 'none' : '0 0 10px rgba(253, 224, 71, 0.9)',
            }}
            animate={isDay ? {
              y: [randomY, randomY - 150, randomY],
              x: [randomX, randomX + 40, randomX],
              opacity: [0.1, 0.4, 0.1]
            } : {
              x: [randomX, randomX + (i % 2 === 0 ? 100 : -100), randomX],
              y: [randomY, randomY - (i % 2 === 0 ? 80 : 80), randomY],
              opacity: [0.2, 1, 0.2]
            }}
            transition={{
              duration: 10 + (i % 5) * 2,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          />
        );
      })}

      {/* ── FLOATING LEAVES (Always, slightly slower/fewer at night) ── */}
      {Array.from({ length: Math.min(3, particleCount) }).map((_, i) => (
        <motion.div
          key={`leaf-${i}`}
          className="absolute text-3xl opacity-20"
          initial={{
            top: '-50px',
            left: `${20 + i * 25}%`,
            rotate: 0
          }}
          animate={{
            top: '100vh',
            rotate: 360,
            x: [0, 50, -50, 0]
          }}
          transition={{
            duration: isDay ? 20 + i * 4 : 28 + i * 5,
            repeat: Infinity,
            ease: 'linear'
          }}
        >
          🍃
        </motion.div>
      ))}

      {/* ── OWL (🦉): Night Active, Day Sleeping ── */}
      <motion.div
        className="absolute w-14 h-14 z-10 select-none"
        initial={{ left: '12%', top: '12%' }}
        animate={!isDay ? {
          y: [0, 2, 0],
          rotate: [-1, 1, -1]
        } : {
          // Sleeping breathing animation
          scale: [1, 1.03, 1],
          y: 0,
          rotate: 0
        }}
        transition={{
          duration: !isDay ? 6 : 4,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
        style={{
          filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.12))'
        }}
      >
        <SvgOwl isDay={isDay} />
        {isDay && <SleepingParticles delay={0} />}
      </motion.div>

      {/* ── HUMMINGBIRD (🐦): Day Active, Night Sleeping ── */}
      <motion.div
        className="absolute w-14 h-14 z-10 select-none"
        initial={{ right: '12%', top: '15%' }}
        animate={isDay ? {
          // Hover bobbing
          y: [0, -6, 0],
          x: [0, 2, 0],
          rotate: [-2, 3, -2]
        } : {
          // Sleeping perched/breathing
          scale: [0.9, 0.93, 0.9],
          y: 0,
          x: 0,
          rotate: 0
        }}
        transition={{
          duration: isDay ? 1.8 : 4.2,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
        style={{
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
        }}
      >
        <SvgHummingbird isDay={isDay} />
        {!isDay && <SleepingParticles delay={1.5} />}
      </motion.div>

      {/* ── BUTTERFLY (🦋): Day Active, Night Sleeping ── */}
      <motion.div
        className="absolute w-12 h-12 z-10 select-none"
        initial={{ left: '46%', top: '65%' }}
        animate={isDay ? {
          y: [0, -3, 0],
          rotate: [-4, 4, -4]
        } : {
          // Sleeping breathing
          scale: [0.85, 0.88, 0.85],
          y: 0,
          rotate: 0
        }}
        transition={{
          duration: isDay ? 3.5 : 4.5,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
        style={{
          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.08))'
        }}
      >
        <SvgButterfly isDay={isDay} />
        {!isDay && <SleepingParticles delay={3} />}
      </motion.div>

      {/* ── SQUIRREL (🐿️): Day Active, Night Sleeping ── */}
      <motion.div
        className="absolute w-14 h-14 z-10 select-none"
        initial={{ left: '6%', bottom: '2%' }}
        animate={isDay ? {
          // Occasional quick twitch and look around
          rotate: [0, 0, 6, -4, 0, 2, 0],
          y: [0, 0, -2, 0, 0, -1, 0]
        } : {
          // Curled up sleeping breathing
          scale: [0.9, 0.94, 0.9],
          rotate: 0,
          y: 10
        }}
        transition={{
          duration: isDay ? 9 : 3.8,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
        style={{
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
        }}
      >
        <SvgSquirrel isDay={isDay} />
        {!isDay && <SleepingParticles delay={4.5} />}
      </motion.div>
    </div>
  );
}
