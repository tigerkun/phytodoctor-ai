import React from 'react';

/**
 * SproutButton
 * A living, interactive button with micro-foliage sprouts that bloom on hover.
 *
 * Spec:
 *  - group + relative overflow-visible wrapper
 *  - Two inline SVG sprout nodes (left + right rim)
 *  - normal: scale(0) opacity(0) pointer-events-none
 *  - group-hover: scale(1) opacity(1) + translateY/-translateX + rotation
 *  - chassis hover: scale-[1.03], active: scale-[0.98]
 */
export default function SproutButton({
  children,
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`
        group
        relative
        overflow-visible
        inline-flex
        items-center
        justify-center
        font-black
        uppercase
        tracking-widest
        transition-all
        duration-300
        hover:scale-[1.03]
        active:scale-[0.98]
        ${className}
      `}
    >
      {/* left micro-sprout — blooms up-left on group-hover */}
      <svg
        className="sprout-leaf sprout--left"
        style={{ left: '-7px', top: '50%', transformOrigin: 'bottom right' }}
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        aria-hidden="true"
      >
        <path d="M2 12 Q0 6 6 2 Q10 5 8 12 Z" fill="#5D7052" opacity="0.65" />
      </svg>

      <span className="relative z-10">{children}</span>

      {/* right micro-sprout — blooms up-right on group-hover */}
      <svg
        className="sprout-leaf sprout--right"
        style={{ right: '-7px', top: '50%', transformOrigin: 'bottom left' }}
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        aria-hidden="true"
      >
        <path d="M12 12 Q14 6 8 2 Q4 5 6 12 Z" fill="#5D7052" opacity="0.65" />
      </svg>
    </button>
  );
}
