import React from 'react';
import { motion } from 'framer-motion';

interface PageWrapperProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * PageWrapper
 * Standardized premium animation wrapper for entry routes.
 * Provides a subtle fade and vertical slide with custom bezier curve.
 */
export default function PageWrapper({ children, className = "", style }: PageWrapperProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ 
        duration: 0.55, 
        ease: [0.22, 1, 0.36, 1] // Custom easeOutExpo-like bezier
      }}
      className={`w-full min-h-screen ${className}`}
      style={style}
    >
      {children}
    </motion.div>
  );
}
