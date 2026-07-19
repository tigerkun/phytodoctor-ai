import React, { useEffect } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { useDayNightTheme } from '@/hooks/useDayNightTheme';
import { useEcoMode } from '@/hooks/useEcoMode';

export default function CursorGlow() {
  const { theme } = useDayNightTheme();
  const { shouldDisableAnimations } = useEcoMode();

  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches[0]) {
        mouseX.set(e.touches[0].clientX);
        mouseY.set(e.touches[0].clientY);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [mouseX, mouseY]);

  // Smooth springs for a fluid, natural delay trail
  const springConfig = { damping: 35, stiffness: 350, mass: 0.5 };
  const cursorX = useSpring(mouseX, springConfig);
  const cursorY = useSpring(mouseY, springConfig);

  if (shouldDisableAnimations) return null;

  const glowColor = theme === 'day'
    ? 'radial-gradient(circle, rgba(212, 168, 67, 0.25) 0%, rgba(212, 168, 67, 0) 70%)'
    : 'radial-gradient(circle, rgba(143, 181, 143, 0.3) 0%, rgba(143, 181, 143, 0) 70%)';

  return (
    <motion.div
      className="fixed top-0 left-0 w-16 h-16 rounded-full pointer-events-none z-[99999] mix-blend-screen -translate-x-1/2 -translate-y-1/2 blur-sm"
      style={{
        x: cursorX,
        y: cursorY,
        background: glowColor,
      }}
    />
  );
}
