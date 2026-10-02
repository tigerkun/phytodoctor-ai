import React from 'react';

/**
 * A neutral shimmer placeholder.
 *
 * `animate-pulse` alone is what most pages were using, and it reads as a UI
 * that is stuck rather than one that is working: there is no shape to the
 * pending layout, so the page visibly reshuffles once the data lands. These
 * skeletons mirror the shape of the content they stand in for, which keeps
 * the layout stable across the loading→success transition.
 *
 * The motion is suppressed for anyone who has asked for reduced motion —
 * framer-motion's `useReducedMotion` reads the same media query that
 * `prefers-reduced-motion` does, so the two never disagree.
 */
export function Skeleton({
  className = '',
  rounded = 'rounded-lg'
}: {
  className?: string;
  rounded?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`relative overflow-hidden bg-[#e8dcc4]/45 ${rounded} ${className}`}
    >
      {/* A single absolutely-positioned band sweeping across, rather than a
          pulsing opacity on the whole block. Whole-block pulsing draws the eye
          to every skeleton at once; a travelling highlight makes the wait read
          as progress. */}
      <div className="motion-safe:animate-[skeleton-sweep_1.6s_ease-in-out_infinite] absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

/**
 * A skeleton shaped like one row of a list — a leading block plus two text
 * lines. Used wherever a list is loading, so the placeholder is recognisably
 * the same list the user will see a moment later.
 */
export function SkeletonRow({ lines = 2 }: { lines?: number }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#d9c4a0]/60 bg-[#fff8e8]/70 p-4">
      <Skeleton className="h-9 w-9 shrink-0" rounded="rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-1/3" />
        {lines > 1 && <Skeleton className="h-3 w-2/3" />}
      </div>
    </div>
  );
}

export function SkeletonList({ rows = 3, lines = 2 }: { rows?: number; lines?: number }) {
  return (
    <div className="space-y-2" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} lines={lines} />
      ))}
    </div>
  );
}