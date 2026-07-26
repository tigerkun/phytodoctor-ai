import React, { useEffect, useRef, useState } from 'react';
import { useDayNightTheme } from '@/hooks/useDayNightTheme';
import { useEcoMode } from '@/hooks/useEcoMode';

export default function CursorGlow() {
  const { theme } = useDayNightTheme();
  const { shouldDisableAnimations } = useEcoMode();
  
  const haloRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  
  const mouse = useRef({ x: -200, y: -200 });
  const halo = useRef({ x: -200, y: -200 });
  const dot = useRef({ x: -200, y: -200 });
  const [hasMouse, setHasMouse] = useState(false);
  
  // Animation variables
  const reqRef = useRef<number>(0);

  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) setHasMouse(true);
  }, []);

  useEffect(() => {
    if (!hasMouse || shouldDisableAnimations) return;

    const onMouseMove = (e: MouseEvent) => {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
      
      // Make visible on first move
      if (haloRef.current && dotRef.current && haloRef.current.style.opacity !== '1') {
        haloRef.current.style.opacity = '1';
        dotRef.current.style.opacity = '1';
      }
    };
    
    const onMouseLeave = () => {
      if (haloRef.current && dotRef.current) {
        haloRef.current.style.opacity = '0';
        dotRef.current.style.opacity = '0';
      }
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mouseleave', onMouseLeave, { passive: true });

    const animate = () => {
      // Flowy Lerp (Linear Interpolation) for smooth following
      // Dot is snappy, halo is flowy
      dot.current.x += (mouse.current.x - dot.current.x) * 0.4;
      dot.current.y += (mouse.current.y - dot.current.y) * 0.4;
      
      halo.current.x += (mouse.current.x - halo.current.x) * 0.15;
      halo.current.y += (mouse.current.y - halo.current.y) * 0.15;

      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${dot.current.x}px, ${dot.current.y}px, 0) translate(-50%, -50%)`;
      }
      
      if (haloRef.current) {
        haloRef.current.style.transform = `translate3d(${halo.current.x}px, ${halo.current.y}px, 0) translate(-50%, -50%)`;
      }

      reqRef.current = requestAnimationFrame(animate);
    };

    reqRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
    };
  }, [hasMouse, shouldDisableAnimations]);

  if (!hasMouse || shouldDisableAnimations) return null;

  const isDay = theme === 'day';
  const dotColor = isDay ? 'rgba(180, 130, 40, 0.9)' : 'rgba(120, 180, 120, 0.9)';
  const ringColor = isDay ? 'rgba(212, 168, 67, 0.25)' : 'rgba(143, 181, 143, 0.3)';

  return (
    <>
      <div
        ref={haloRef}
        className="fixed top-0 left-0 pointer-events-none z-[99995] rounded-full will-change-transform"
        style={{
          width: 44,
          height: 44,
          background: `radial-gradient(circle, ${ringColor} 0%, transparent 65%)`,
          border: `1px solid ${isDay ? 'rgba(212,168,67,0.2)' : 'rgba(143,181,143,0.25)'}`,
          opacity: 0,
          transition: 'opacity 0.2s ease',
        }}
      />
      <div
        ref={dotRef}
        className="fixed top-0 left-0 pointer-events-none z-[99999] rounded-full will-change-transform"
        style={{
          width: 6,
          height: 6,
          backgroundColor: dotColor,
          boxShadow: `0 0 8px 2px ${dotColor}`,
          opacity: 0,
          transition: 'opacity 0.15s ease',
        }}
      />
    </>
  );
}
