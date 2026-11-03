import { useEffect, useState } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { useEcoMode } from '../hooks/useEcoMode';

interface GuardianScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
}

/**
 * The live vitality ring (PlantDetail). The arc already animates on mount;
 * this adds the delight layer — a count-up on the number, a slow pulse when
 * the score sits at thriving (>=90) and a gentle urgency shake when it drops
 * into critical (<40) — all gated on eco mode, which mutes the whole lot.
 */
export default function GuardianScoreRing({ score, size = 120, strokeWidth = 8, isNight = false }: GuardianScoreRingProps & { isNight?: boolean }) {
  const { shouldDisableAnimations } = useEcoMode();
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;

  // Count-up: a motion value driven to `score`, mirrored to state for render.
  const count = useMotionValue(shouldDisableAnimations ? score : 0);
  const [shown, setShown] = useState(shouldDisableAnimations ? score : 0);

  useEffect(() => {
    if (shouldDisableAnimations) {
      count.set(score);
      setShown(score);
      return;
    }
    const controls = animate(count, score, {
      duration: 1.2,
      ease: 'easeOut',
      onUpdate: v => setShown(Math.round(v)),
    });
    // count is a stable motion value; only the target moves.
    return () => controls.stop();
  }, [score, shouldDisableAnimations, count]);

  const getColor = (s: number) => {
    if (s >= 80) return '#95D5B2'; // garden-sage
    if (s >= 60) return '#F4A261'; // garden-amber/orange
    return '#E76F51'; // garden-coral
  };

  const thriving = score >= 90;
  const critical = score < 40;

  return (
    <motion.div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      animate={
        shouldDisableAnimations
          ? undefined
          : thriving
          // Thriving: a slow, proud pulse of the whole medallion.
          ? { scale: [1, 1.04, 1] }
          : critical
          // Critical: a small horizontal shake — noticed, not nauseating.
          ? { x: [0, -2, 2, -1, 1, 0] }
          : undefined
      }
      transition={
        thriving && !shouldDisableAnimations
          ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
          : critical && !shouldDisableAnimations
          ? { duration: 0.5, repeat: 2, ease: 'easeInOut' }
          : undefined
      }
    >
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-garden-earth/5"
        />
        {/* Progress circle */}
        <motion.circle
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor(score)}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeLinecap="round"
          style={
            thriving && !shouldDisableAnimations
              ? { filter: 'drop-shadow(0 0 6px rgba(149, 213, 178, 0.55))' }
              : undefined
          }
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          aria-hidden="true"
          className={`text-2xl font-black leading-none ${isNight ? 'text-white' : 'text-garden-earth'}`}
        >
          {shown}
        </motion.span>
        {/* The real number for assistive tech, which should not wait out an
            animation or inherit the count-up's intermediate values. */}
        <span className="sr-only">{score}</span>
        <span className={`text-[8px] font-black uppercase tracking-widest ${isNight ? 'text-white/30' : 'text-garden-earth/30'}`}>Index</span>
      </div>
    </motion.div>
  );
}
