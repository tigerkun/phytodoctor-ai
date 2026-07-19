import React from 'react';
import { motion } from 'motion/react';

interface GuardianScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
}

export default function GuardianScoreRing({ score, size = 120, strokeWidth = 8, isNight = false }: GuardianScoreRingProps & { isNight?: boolean }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;

  const getColor = (s: number) => {
    if (s >= 80) return '#95D5B2'; // garden-sage
    if (s >= 60) return '#F4A261'; // garden-amber/orange
    return '#E76F51'; // garden-coral
  };

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
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
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span 
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`text-2xl font-black leading-none ${isNight ? 'text-white' : 'text-garden-earth'}`}
        >
          {score}
        </motion.span>
        <span className={`text-[8px] font-black uppercase tracking-widest ${isNight ? 'text-white/30' : 'text-garden-earth/30'}`}>Index</span>
      </div>
    </div>
  );
}
