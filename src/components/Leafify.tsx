import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Leaf = {
  id: string;
  x: number;
  y: number;
  size: number;
  hue: number;
  durationMs: number;
  delayMs: number;
  rotate: number;

  // Precomputed motion so the animation doesn’t “re-roll” on re-render
  dx: number;
  dy: number;
  flutter: number; // extra wobble amount (deg)
  squash: number; // initial squash amount
};

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function pickHue() {
  // garden greens + yellow-green highlights
  return Math.random() < 0.35 ? rand(70, 95) : rand(110, 145);
}

function createLeaf(x: number, y: number): Leaf {
  const size = rand(10, 18);
  const durationMs = rand(800, 1300);
  const delayMs = rand(0, 60);

  // drift upwards + sideways (more organic than pure linear)
  const dx = rand(-30, 30);
  const dy = rand(-70, -110);

  return {
    id: crypto.randomUUID(),
    x,
    y,
    size,
    hue: pickHue(),
    durationMs,
    delayMs,
    rotate: rand(-70, 70),

    dx,
    dy,
    flutter: rand(8, 22),
    squash: rand(0.85, 0.98)
  };
}

/**
 * Global leaf animation overlay.
 * - Click anywhere (pointerdown) triggers a small leaf burst.
 * - Hover over elements with data-leafify (or buttons/links by default) triggers a single leaf.
 */
export default function Leafify() {
  const [leaves, setLeaves] = useState<Leaf[]>([]);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const lastHoverAtRef = useRef<number>(0);

  const cleanup = useCallback((id: string, ttlMs: number) => {
    window.setTimeout(() => {
      setLeaves((prev: Leaf[]) => prev.filter((l: Leaf) => l.id !== id));
    }, ttlMs);
  }, []);







  const spawn = useCallback(


    (clientX: number, clientY: number, burst: boolean) => {
      const rect = overlayRef.current?.getBoundingClientRect();
      const x = rect ? clientX - rect.left : clientX;
      const y = rect ? clientY - rect.top : clientY;

      const count = burst ? Math.floor(rand(6, 10)) : Math.floor(rand(1, 2));
      const created: Leaf[] = Array.from({ length: count }).map(() => createLeaf(x + rand(-10, 10), y + rand(-10, 10)));

      setLeaves((prev: Leaf[]) => [...prev, ...created]);
      for (const leaf of created) cleanup(leaf.id, leaf.durationMs + leaf.delayMs + 80);
    },
    [cleanup]
  );


  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      // Avoid spamming when clicking on inputs
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (target as any).isContentEditable) return;
      spawn(e.clientX, e.clientY, true);
    };

    const onMouseOver = (e: MouseEvent) => {
      const now = performance.now();
      // throttle hover to avoid constant spawning
      if (now - lastHoverAtRef.current < 220) return;
      lastHoverAtRef.current = now;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      const el = target.closest('[data-leafify]') as HTMLElement | null;
      if (!el) {
        // default: any button or link-like elements
        const tag = target.tagName?.toLowerCase();
        if (tag !== 'button' && tag !== 'a') return;
      }

      spawn(e.clientX, e.clientY, false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('mouseover', onMouseOver);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('mouseover', onMouseOver);
    };
  }, [spawn]);

  // Keep style creation stable
  const leafStyle = useMemo(() => {
    return (leaf: Leaf) => {
      return {
        left: `${leaf.x}px`,
        top: `${leaf.y}px`,
        width: `${leaf.size}px`,
        height: `${leaf.size * 0.65}px`,
        filter: `hue-rotate(${leaf.hue - 120}deg) saturate(1.15)`,
        ['--dur' as any]: `${leaf.durationMs}ms`,
        ['--delay' as any]: `${leaf.delayMs}ms`,
        ['--dx' as any]: `${leaf.dx}px`,
        ['--dy' as any]: `${leaf.dy}px`,
        ['--rot' as any]: `${leaf.rotate}deg`,
        ['--flutter' as any]: `${leaf.flutter}deg`,
        ['--squash' as any]: `${leaf.squash}`
      } as React.CSSProperties;
    };
  }, []);

  return (
    <div
      ref={overlayRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9999
      }}
    >
      <style>
        {`
          @keyframes leafPop {
            0% {
              transform: translate3d(0,0,0) rotate(0deg) scaleX(var(--squash)) scaleY(1.06);
              opacity: 0;
            }
            12% {
              opacity: 0.98;
              transform: translate3d(0,0,0) rotate(calc(var(--rot) * 0.15)) scaleX(1) scaleY(1);
            }
            45% {
              opacity: 0.9;
              transform: translate3d(calc(var(--dx) * 0.55), calc(var(--dy) * 0.55), 0)
                rotate(calc(var(--rot) * 0.7)) scale(0.98);
            }
            70% {
              opacity: 0.75;
              transform: translate3d(calc(var(--dx) * 0.8), calc(var(--dy) * 0.8), 0)
                rotate(calc(var(--rot) + var(--flutter))) scale(0.95);
            }
            100% {
              transform: translate3d(var(--dx), var(--dy), 0) rotate(var(--rot)) scale(0.9);
              opacity: 0;
            }
          }

          .leafify-leaf {
            position: absolute;
            background:
              radial-gradient(circle at 30% 30%, rgba(255,255,255,0.75), rgba(255,255,255,0) 55%),
              linear-gradient(135deg, rgba(34,197,94,0.98), rgba(132,204,22,0.82));
            border-radius: 999px 999px 999px 16px;

            transform-origin: 20% 60%;
            clip-path: polygon(0% 50%, 18% 12%, 52% 0%, 78% 10%, 96% 42%, 80% 90%, 44% 100%, 18% 86%);

            box-shadow:
              0 10px 25px rgba(0,0,0,0.08),
              0 0 18px rgba(34,197,94,0.12);

            /* Slight “flutter” feel using a second transform accent */
            animation: leafPop var(--dur) cubic-bezier(0.16, 1, 0.3, 1) var(--delay) both;
            will-change: transform, opacity;
          }

          @media (prefers-reduced-motion: reduce) {
            .leafify-leaf { animation: none; opacity: 0.7; }
          }
        `}
      </style>

      {leaves.map((l: Leaf) => (
        <div key={l.id} className="leafify-leaf" style={leafStyle(l)} />
      ))}
    </div>
  );
}

