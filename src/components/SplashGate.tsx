import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { GlassIconReveal } from '@/components/ui/liquid-glass-logo-reveal';

/**
 * The first thing an opened app shows: the Sanctuary crest condenses out of a
 * droplet of glass, holds, and lets go — then the gate (or the garden) takes
 * over. Runs once per full page load; SPA navigation never remounts App, so
 * route changes do not replay it. Click "Skip intro" to move on early.
 *
 * The ground is deliberately light in both themes (a brand moment, not a
 * theme surface), and it is garden-tinted rather than flat cream: the shader
 * ground is a pale sage-cream, and four plant-toned washes — sage dawn,
 * moss-light, deep moss shade and a touch of harvest gold — sit over it, so
 * the intro reads as our palette, not as a neutral placeholder.
 */

// The app icon, verbatim from public/icon.svg, inlined so the reveal never
// depends on a fetch finishing before its first frame. Rendered into a canvas
// texture inside the component, so the duplicate gradient ids here cannot
// collide with any other SVG on the page.
const APP_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="splash-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1d5643"/>
      <stop offset="1" stop-color="#0c2b1f"/>
    </linearGradient>
    <linearGradient id="splash-leaf" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="#9bde8b"/>
      <stop offset="1" stop-color="#3fa05f"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="130" fill="url(#splash-bg)"/>
  <path d="M256 48 C 274 48, 300 57, 326 74 C 402 124, 452 200, 444 278 C 434 372, 366 452, 284 462 C 270 464, 258 448, 256 418 C 254 448, 242 464, 228 462 C 146 452, 78 372, 68 278 C 60 200, 110 124, 186 74 C 212 57, 238 48, 256 48 Z" fill="url(#splash-leaf)"/>
  <g stroke="#0c2b1f" stroke-width="21" stroke-linecap="round" fill="none">
    <path d="M78 322 L196 266"/>
    <path d="M96 228 L202 210"/>
    <path d="M150 132 L226 154"/>
    <path d="M434 322 L316 266"/>
    <path d="M416 228 L310 210"/>
    <path d="M362 132 L286 154"/>
  </g>
  <g fill="#0c2b1f">
    <ellipse cx="212" cy="322" rx="12" ry="21" transform="rotate(-16 212 322)"/>
    <ellipse cx="300" cy="322" rx="12" ry="21" transform="rotate(16 300 322)"/>
  </g>
  <path d="M256 400 L256 92" stroke="#e9f5e4" stroke-width="14" stroke-linecap="round" opacity="0.85" fill="none"/>
  <path d="M118 380 L210 380 L234 344 L262 394 L282 350 L292 380 L394 380" fill="none" stroke="#f7dfa8" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// Leaf outlines that root the corners in the garden without competing with
// the crest — same leaf path as the icon, stroke only, barely there.
const LEAF_PATH = 'M256 48 C 274 48, 300 57, 326 74 C 402 124, 452 200, 444 278 C 434 372, 366 452, 284 462 C 270 464, 258 448, 256 418 C 254 448, 242 464, 228 462 C 146 452, 78 372, 68 278 C 60 200, 110 124, 186 74 C 212 57, 238 48, 256 48 Z';

function LeafWatermark({ className, rotate }: { className: string; rotate: number }) {
  return (
    <svg viewBox="0 0 512 512" aria-hidden className={`pointer-events-none absolute ${className}`}>
      <g transform={`rotate(${rotate} 256 256)`}>
        <path d={LEAF_PATH} fill="none" stroke="currentColor" strokeWidth="18" strokeLinejoin="round" />
        <path d="M256 420 L256 96" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// Plant-toned washes over the pale ground. Low alphas on purpose: they tint,
// they never veil — the glass and the crest stay the loudest things on screen.
const GARDEN_WASHES = [
  // sage dawn, upper left
  'radial-gradient(58% 48% at 16% 10%, rgba(168,181,160,0.30) 0%, rgba(168,181,160,0) 70%)',
  // moss-light, lower left
  'radial-gradient(52% 42% at 12% 88%, rgba(143,181,143,0.24) 0%, rgba(143,181,143,0) 70%)',
  // deep moss shade, lower right
  'radial-gradient(56% 46% at 86% 84%, rgba(90,125,90,0.20) 0%, rgba(90,125,90,0) 72%)',
  // harvest gold, upper right
  'radial-gradient(42% 36% at 82% 12%, rgba(212,168,67,0.16) 0%, rgba(212,168,67,0) 70%)',
];

// The reveal's own timeline runs present(1.7s) + tail(1.1s); the fade begins
// just after the glass lets go, giving the bare crest a beat to be seen.
const HOLD_MS = 3400;
const FADE_MS = 600;

type Phase = 'show' | 'leaving' | 'gone';

export default function SplashGate() {
  const [phase, setPhase] = useState<Phase>('show');
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hold = reduced ? 1100 : HOLD_MS;
    // The reveal component shows a settled still frame under reduced motion,
    // so a short hold is all the branding the timeline needs there.
    timers.current.push(
      window.setTimeout(() => setPhase((p) => (p === 'show' ? 'leaving' : p)), hold),
      window.setTimeout(() => setPhase('gone'), hold + FADE_MS),
    );
    // The overlay is the only interactive thing while it is up.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      timers.current.forEach(clearTimeout);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const leave = () => setPhase((p) => (p === 'show' ? 'leaving' : p));

  if (phase === 'gone') return null;

  return (
    <motion.div
      className="fixed inset-0 z-[100] bg-[#F4F8F0]"
      initial={{ opacity: 1 }}
      animate={{ opacity: phase === 'leaving' ? 0 : 1 }}
      transition={{ duration: FADE_MS / 1000, ease: 'easeOut' }}
    >
      <GlassIconReveal
        logo={APP_ICON_SVG}
        originalColors
        loop={false}
        label="PhytoDoctor"
        background="#F4F8F0"
        logoScale={0.62}
        finalScale={0.85}
        tileSize={260}
        className="h-full w-full"
        // Gentler optics than the demo defaults: the crest reads through the
        // glass instead of dissolving into it, and arrives sooner.
        tuning={{ present: 1.7, glide: 1.5, dispersion: 1.2, opticalDepth: 0.95, colorBleed: 1.05 }}
      />

      {/* plant-toned light over the ground */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {GARDEN_WASHES.map((bg, i) => (
          <div key={i} className="absolute inset-0" style={{ background: bg }} />
        ))}
      </div>
      <LeafWatermark className="-right-16 -top-16 h-80 w-80 rotate-12 text-[#A8B5A0] opacity-25" rotate={18} />
      <LeafWatermark className="-bottom-20 -left-20 h-96 w-96 -rotate-12 text-[#8FB58F] opacity-20" rotate={-14} />

      {/* Wordmark: arrives while the crest settles, leaves with the splash */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-[12%] flex flex-col items-center gap-1.5 text-center"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.7, ease: 'easeOut' }}
      >
        <div className="font-serif text-3xl font-black tracking-tight text-[#2C2419]">PhytoDoctor</div>
        <div className="text-[10px] font-sans font-bold uppercase tracking-[0.3em] text-[#6B6156]">
          Botanical Diagnosis Lab
        </div>
      </motion.div>

      <button
        type="button"
        onClick={leave}
        className="absolute bottom-7 left-1/2 min-h-[44px] -translate-x-1/2 cursor-pointer rounded-full px-4 py-2 text-xs font-semibold text-[#6B6156] transition-colors hover:text-[#2C2419] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5A7D5A]"
      >
        Skip intro
      </button>
    </motion.div>
  );
}
