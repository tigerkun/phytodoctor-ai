import React from 'react';
import { motion } from 'framer-motion';
import { Sprout, ChevronRight } from 'lucide-react';

/**
 * The empty half of a data-driven view.
 *
 * This file previously held a single hard-coded empty state for the plant
 * collection: a nice seedling illustration, a fixed heading, and two CTA
 * buttons. It was never imported anywhere, and its buttons had no onClick, so
 * it could not have worked even if it had been used. Meanwhile every page that
 * *did* have an empty case rendered a bare sentence of grey text with no
 * illustration and no action — the player was told they had nothing and left
 * to work out what to do about it.
 *
 * An empty state has a job: say what would fill this space, and give the
 * player the button that fills it. That is what this does, driven by props,
 * so each caller supplies its own copy and its own next step.
 */
export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export default function EmptyState({
  icon: Icon = Sprout,
  title,
  body,
  action,
  secondaryAction,
  compact = false,
  className = ''
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  body?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  /** Drops the illustration and the vertical padding, for use inside a panel
      rather than as a whole page region. */
  compact?: boolean;
  className?: string;
}) {
  const renderAction = (a: EmptyStateAction, i: number) => {
    const primary = a.variant !== 'secondary';
    return (
      <button
        key={i}
        type="button"
        onClick={a.onClick}
        className={
          'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded px-6 py-2 text-[10px] font-black uppercase tracking-widest transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ' +
          (primary
            ? 'bg-[#5a7d5a] text-white hover:bg-[#3d6b4a] focus-visible:outline-[#3d6b4a]'
            : 'border border-[#c4a574] bg-[#fff8e8] text-[#3d2a1c] hover:bg-[#f4e4c1] focus-visible:outline-[#8c7355]')
        }
      >
        {a.label}
        <ChevronRight size={12} aria-hidden="true" />
      </button>
    );
  };

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${compact ? 'px-4 py-8' : 'px-6 py-12'} ${className}`}
    >
      {!compact && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative mb-5 h-24 w-24"
          aria-hidden="true"
        >
          <motion.div
            animate={{ y: [0, -7, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Icon className="h-16 w-16 text-[#8fae8c]" />
          </motion.div>
          {Array.from({ length: 5 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute h-1.5 w-1.5 rounded-full bg-[#c4a574]"
              style={{ bottom: '18%', left: `${18 + i * 16}%` }}
              animate={{ y: [0, -4, 0], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, delay: i * 0.3, repeat: Infinity }}
            />
          ))}
        </motion.div>
      )}

      <p className="font-serif text-lg text-[#3d2a1c]">{title}</p>
      {body && <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-[#7a6a50]">{body}</p>}

      {(action || secondaryAction) && (
        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
          {action && renderAction(action, 0)}
          {secondaryAction && renderAction(secondaryAction, 1)}
        </div>
      )}
    </div>
  );
}