import React from 'react';
import { motion } from 'motion/react';

interface SeverityRingProps {
  severity: number; // 1 to 5
  size?: number;
}

export default function SeverityRing({ severity, size = 100 }: SeverityRingProps) {
  const segments = [1, 2, 3, 4, 5];
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  // We want to leave a gap between segments
  const segmentAngle = 360 / segments.length;
  const gapAngle = 5;
  const activeAngle = segmentAngle - gapAngle;
  
  const getColor = (s: number) => {
    if (s <= 1) return '#95D5B2'; // Low (Sage)
    if (s <= 2) return '#95D5B2'; 
    if (s <= 3) return '#F4A261'; // Moderate (Amber)
    if (s <= 4) return '#E76F51'; // High (Coral)
    return '#E76F51'; // Critical
  };

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        {segments.map((s, i) => {
          const startAngle = i * segmentAngle;
          const isActive = s <= severity;
          
          // Using stroke-dasharray to create segments
          const segmentLength = (activeAngle / 360) * circumference;
          const gapLength = circumference - segmentLength;
          
          return (
            <motion.circle
              key={s}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke={isActive ? getColor(s) : '#E2E8F0'}
              strokeWidth={strokeWidth}
              strokeDasharray={`${segmentLength} ${gapLength}`}
              strokeDashoffset={-((startAngle / 360) * circumference)}
              strokeLinecap="round"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-black text-garden-earth leading-none"
        >
          {severity}<span className="text-sm opacity-30">/5</span>
        </motion.span>
        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-garden-earth/40 mt-1">Severity</span>
      </div>
    </div>
  );
}
