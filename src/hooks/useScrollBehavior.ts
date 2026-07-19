import { useEffect, useRef } from 'react';

export function useScrollBehavior() {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    // Snap to center for horizontal scroll
    container.addEventListener('scroll', () => {
      const children = container.children;
      let closestChild: Element | null = null;
      let closestDistance = Infinity;

      const containerCenter = container.scrollLeft + container.clientWidth / 2;

      for (let child of children) {
        const childCenter = (child as HTMLElement).offsetLeft + (child as HTMLElement).clientWidth / 2;
        const distance = Math.abs(containerCenter - childCenter);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestChild = child;
        }
      }

      if (closestChild && closestDistance < 200) {
        closestChild.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    });
  }, []);

  return scrollRef;
}

export function useParallax(offset = 0.3) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleScroll = () => {
      const rect = element.getBoundingClientRect();
      const scrolled = window.scrollY;
      const elementOffset = element.offsetTop;
      
      if (rect.top < window.innerHeight) {
        const distance = scrolled - elementOffset;
        element.style.transform = `translateY(${distance * offset}px)`;
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
