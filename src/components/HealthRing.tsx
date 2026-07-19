import React from 'react';

interface HealthRingProps {
  score: number; // 0-100
  size?: number; // diameter in pixels
  thickness?: number; // stroke width
}

export const HealthRing = ({ score, size = 80, thickness = 8 }: HealthRingProps) => {
  // Determine color and label based on score
  let color: string;
  let label: string;
  
  if (score >= 90) {
    color = '#10B981'; // Vibrant green
    label = 'Thriving';
  } else if (score >= 70) {
    color = '#34D399'; // Soft green
    label = 'Healthy';
  } else if (score >= 50) {
    color = '#FBBF24'; // Amber
    label = 'Needs Attention';
  } else {
    color = '#F97316'; // Terracotta
    label = 'Critical';
  }
  
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  
  // Determine glow intensity based on score
  let glowOpacity: number;
  if (score >= 90) {
    glowOpacity = 0.4;
  } else if (score >= 70) {
    glowOpacity = 0.3;
  } else if (score >= 50) {
    glowOpacity = 0.2;
  } else {
    glowOpacity = 0.35; // Higher glow for critical
  }
  
  return (
    <div className="relative w-[{size}] h-[{size}]">
      {/* Background circle */}
      <svg className="absolute inset-0" viewBox="0 0 100 100">
        <circle 
          cx="50" 
          cy="50" 
          r="45" 
          stroke="rgba(0,0,0,0.1)" 
          strokeWidth="10"
          fill="none"
        />
        {/* Progress circle */}
        <circle 
          cx="50" 
          cy="50" 
          r="45" 
          stroke={color} 
          strokeWidth="10"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          fill="none"
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
        {/* Glow effect */}
        <circle 
          cx="50" 
          cy="50" 
          r="45" 
          stroke={color} 
          strokeWidth="10"
          fill="none"
          filter={`url(#glow)`}
          opacity={glowOpacity}
        />
      </svg>
      
      {/* Label */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-xs font-medium text-center">{label}</span>
      </div>
      
      {/* Glow definition */}
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge> 
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
    </div>
  );
};