import { useEffect, useRef } from 'react';

export function useScrollBehavior() {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    // Apply native CSS scroll snapping instead of JS loop
    container.style.scrollSnapType = 'x mandatory';
    Array.from(container.children).forEach(child => {
      (child as HTMLElement).style.scrollSnapAlign = 'center';
    });
  }, []);

  return scrollRef;
}

export function useParallax(offset = 0.3) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const rect = element.getBoundingClientRect();
          const scrolled = window.scrollY;
          const elementOffset = element.offsetTop;
          
          if (rect.top < window.innerHeight) {
            const distance = scrolled - elementOffset;
            element.style.transform = `translateY(${distance * offset}px) translateZ(0)`;
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [offset]);

  return ref;
}

export function useStickyHeader() {
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          header.classList.add('sticky-active');
        } else {
          header.classList.remove('sticky-active');
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  return headerRef;
}
