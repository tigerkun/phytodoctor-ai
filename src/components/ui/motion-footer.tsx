import * as React from "react";
import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowUp, Heart, Leaf, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEcoMode } from "@/hooks/useEcoMode";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const STYLES = `
.cinematic-footer-wrapper {
  font-family: 'Plus Jakarta Sans', sans-serif;
  -webkit-font-smoothing: antialiased;

  --background: #FAF7F2;
  --foreground: #2C2419;
  --primary: #3D5A3D;
  --secondary: #C5A059;
  --destructive: #C4704B;
  --border: rgba(44, 36, 25, 0.12);
  --muted-foreground: #6B5E51;

  --pill-bg-1: color-mix(in oklch, #ffffff 88%, transparent);
  --pill-bg-2: color-mix(in oklch, #F4EFE6 70%, transparent);
  --pill-shadow: rgba(44, 36, 25, 0.10);
  --pill-highlight: rgba(255, 255, 255, 0.85);
  --pill-inset-shadow: rgba(44, 36, 25, 0.06);
  --pill-border: rgba(232, 225, 213, 0.95);

  --pill-bg-1-hover: color-mix(in oklch, var(--primary) 14%, #ffffff);
  --pill-bg-2-hover: color-mix(in oklch, #F4EFE6 80%, transparent);
  --pill-border-hover: color-mix(in oklch, var(--primary) 45%, #E8E1D5);
  --pill-shadow-hover: rgba(61, 90, 61, 0.18);
  --pill-highlight-hover: rgba(255, 255, 255, 0.95);

  background: var(--background);
  color: var(--foreground);
}

@keyframes footer-breathe {
  0% { transform: translate(-50%, -50%) scale(1); opacity: 0.55; }
  100% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
}

@keyframes footer-scroll-marquee {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

@keyframes footer-heartbeat {
  0%, 100% { transform: scale(1); filter: drop-shadow(0 0 5px color-mix(in oklch, var(--destructive) 50%, transparent)); }
  15%, 45% { transform: scale(1.2); filter: drop-shadow(0 0 10px color-mix(in oklch, var(--destructive) 80%, transparent)); }
  30% { transform: scale(1); }
}

.animate-footer-breathe {
  animation: footer-breathe 8s ease-in-out infinite alternate;
}

.animate-footer-scroll-marquee {
  animation: footer-scroll-marquee 40s linear infinite;
}

.animate-footer-heartbeat {
  animation: footer-heartbeat 2s cubic-bezier(0.25, 1, 0.5, 1) infinite;
}

.footer-reduce-motion .animate-footer-breathe,
.footer-reduce-motion .animate-footer-scroll-marquee,
.footer-reduce-motion .animate-footer-heartbeat {
  animation: none;
}

.footer-bg-grid {
  background-size: 60px 60px;
  background-image:
    linear-gradient(to right, color-mix(in oklch, var(--foreground) 5%, transparent) 1px, transparent 1px),
    linear-gradient(to bottom, color-mix(in oklch, var(--foreground) 5%, transparent) 1px, transparent 1px);
  mask-image: linear-gradient(to bottom, transparent, black 30%, black 70%, transparent);
  -webkit-mask-image: linear-gradient(to bottom, transparent, black 30%, black 70%, transparent);
}

.footer-aurora {
  background: radial-gradient(
    circle at 50% 50%,
    color-mix(in oklch, var(--primary) 18%, transparent) 0%,
    color-mix(in oklch, var(--secondary) 12%, transparent) 40%,
    transparent 70%
  );
}

.footer-glass-pill {
  background: linear-gradient(145deg, var(--pill-bg-1) 0%, var(--pill-bg-2) 100%);
  box-shadow:
      0 10px 30px -10px var(--pill-shadow),
      inset 0 1px 1px var(--pill-highlight),
      inset 0 -1px 2px var(--pill-inset-shadow);
  border: 1px solid var(--pill-border);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.footer-glass-pill:hover {
  background: linear-gradient(145deg, var(--pill-bg-1-hover) 0%, var(--pill-bg-2-hover) 100%);
  border-color: var(--pill-border-hover);
  box-shadow:
      0 20px 40px -10px var(--pill-shadow-hover),
      inset 0 1px 1px var(--pill-highlight-hover);
  color: var(--foreground);
}

.footer-giant-bg-text {
  font-family: 'Cormorant Garamond', serif;
  font-size: 22vw;
  line-height: 0.75;
  font-weight: 700;
  letter-spacing: -0.04em;
  color: transparent;
  -webkit-text-stroke: 1px color-mix(in oklch, var(--primary) 18%, transparent);
  background: linear-gradient(180deg, color-mix(in oklch, var(--primary) 16%, transparent) 0%, transparent 60%);
  -webkit-background-clip: text;
  background-clip: text;
}

.footer-text-glow {
  font-family: 'Cormorant Garamond', serif;
  background: linear-gradient(180deg, var(--foreground) 0%, color-mix(in oklch, var(--primary) 55%, var(--foreground)) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0px 0px 18px color-mix(in oklch, var(--primary) 22%, transparent));
}
`;

export type MagneticButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    as?: React.ElementType;
    to?: string;
  };

const MagneticButton = React.forwardRef<HTMLElement, MagneticButtonProps>(
  ({ className, children, as: Component = "button", ...props }, forwardedRef) => {
    const localRef = useRef<HTMLElement>(null);
    const { shouldDisableAnimations } = useEcoMode();

    useEffect(() => {
      if (typeof window === "undefined" || shouldDisableAnimations) return;
      const element = localRef.current;
      if (!element) return;

      const ctx = gsap.context(() => {
        const handleMouseMove = (e: MouseEvent) => {
          const rect = element.getBoundingClientRect();
          const h = rect.width / 2;
          const w = rect.height / 2;
          const x = e.clientX - rect.left - h;
          const y = e.clientY - rect.top - w;

          gsap.to(element, {
            x: x * 0.4,
            y: y * 0.4,
            rotationX: -y * 0.15,
            rotationY: x * 0.15,
            scale: 1.05,
            ease: "power2.out",
            duration: 0.4,
          });
        };

        const handleMouseLeave = () => {
          gsap.to(element, {
            x: 0,
            y: 0,
            rotationX: 0,
            rotationY: 0,
            scale: 1,
            ease: "elastic.out(1, 0.3)",
            duration: 1.2,
          });
        };

        element.addEventListener("mousemove", handleMouseMove);
        element.addEventListener("mouseleave", handleMouseLeave);

        return () => {
          element.removeEventListener("mousemove", handleMouseMove);
          element.removeEventListener("mouseleave", handleMouseLeave);
        };
      }, element);

      return () => ctx.revert();
    }, [shouldDisableAnimations]);

    return (
      <Component
        ref={(node: HTMLElement) => {
          localRef.current = node;
          if (typeof forwardedRef === "function") forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        className={cn("cursor-pointer", className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);
MagneticButton.displayName = "MagneticButton";

const MarqueeItem = () => (
  <div className="flex items-center space-x-12 px-6">
    <span>AI Plant Doctor</span> <span className="text-[#8FB58F]">✦</span>
    <span>On-Device Privacy</span> <span className="text-[#C5A059]">✦</span>
    <span>PhytoCards</span> <span className="text-[#8FB58F]">✦</span>
    <span>Care-Off Arena</span> <span className="text-[#C5A059]">✦</span>
    <span>Living Conservatory</span> <span className="text-[#8FB58F]">✦</span>
  </div>
);

export function CinematicFooter({ onSignIn }: { onSignIn: () => void }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const giantTextRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);
  const { shouldDisableAnimations } = useEcoMode();

  useEffect(() => {
    if (typeof window === "undefined" || shouldDisableAnimations) return;
    if (!wrapperRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        giantTextRef.current,
        { y: "10vh", scale: 0.8, opacity: 0 },
        {
          y: "0vh",
          scale: 1,
          opacity: 1,
          ease: "power1.out",
          scrollTrigger: {
            trigger: wrapperRef.current,
            start: "top 80%",
            end: "bottom bottom",
            scrub: 1,
          },
        }
      );

      gsap.fromTo(
        [headingRef.current, linksRef.current],
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.15,
          ease: "power3.out",
          scrollTrigger: {
            trigger: wrapperRef.current,
            start: "top 40%",
            end: "bottom bottom",
            scrub: 1,
          },
        }
      );
    }, wrapperRef);

    return () => ctx.revert();
  }, [shouldDisableAnimations]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <div
        ref={wrapperRef}
        className="relative h-screen w-full"
        style={{ clipPath: "polygon(0% 0, 100% 0%, 100% 100%, 0 100%)" }}
      >
        <footer
          className={cn(
            "fixed bottom-0 left-0 flex h-screen w-full flex-col justify-between overflow-hidden cinematic-footer-wrapper",
            shouldDisableAnimations && "footer-reduce-motion"
          )}
        >
          <div className="footer-aurora absolute left-1/2 top-1/2 h-[60vh] w-[80vw] -translate-x-1/2 -translate-y-1/2 animate-footer-breathe rounded-[50%] blur-[80px] pointer-events-none z-0" />
          <div className="footer-bg-grid absolute inset-0 z-0 pointer-events-none" />

          <div
            ref={giantTextRef}
            className="footer-giant-bg-text absolute -bottom-[5vh] left-1/2 -translate-x-1/2 whitespace-nowrap z-0 pointer-events-none select-none"
          >
            PHYTO
          </div>

          <div className="absolute top-12 left-0 w-full overflow-hidden border-y border-[#E8E1D5] bg-[#FAF7F2]/80 backdrop-blur-md py-4 z-10 -rotate-2 scale-110 shadow-xs">
            <div className="flex w-max animate-footer-scroll-marquee text-xs md:text-sm font-bold tracking-[0.3em] text-[#6B5E51] uppercase">
              <MarqueeItem />
              <MarqueeItem />
            </div>
          </div>

          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 mt-20 w-full max-w-5xl mx-auto">
            <h2
              ref={headingRef}
              className="text-4xl md:text-7xl font-black footer-text-glow tracking-tighter mb-12 text-center"
            >
              Ready to nurture your living sanctuary?
            </h2>

            <div ref={linksRef} className="flex flex-col items-center gap-6 w-full">
              <div className="flex flex-wrap justify-center gap-4 w-full">
                <MagneticButton
                  as="button"
                  type="button"
                  onClick={onSignIn}
                  className="footer-glass-pill min-h-[44px] px-10 py-5 rounded-full bg-[#3D5A3D] text-white font-bold text-sm md:text-base flex items-center gap-3 group"
                >
                  <Leaf className="w-5 h-5 text-[#C5D1BF] group-hover:text-white transition-colors" />
                  Enter Sanctuary
                </MagneticButton>

                <MagneticButton
                  as="button"
                  type="button"
                  onClick={onSignIn}
                  className="footer-glass-pill min-h-[44px] px-10 py-5 rounded-full text-[#2C2419] font-bold text-sm md:text-base flex items-center gap-3 group"
                >
                  <LogIn className="w-5 h-5 text-[#6B5E51] group-hover:text-[#3D5A3D] transition-colors" />
                  Sign In to Existing Account
                </MagneticButton>
              </div>

              <div className="flex flex-wrap justify-center gap-3 md:gap-6 w-full mt-2">
                <MagneticButton as={Link} to="/privacy" className="footer-glass-pill px-6 py-3 rounded-full text-[#6B5E51] font-medium text-xs md:text-sm hover:text-[#2C2419]">
                  Privacy Policy
                </MagneticButton>
                <MagneticButton as={Link} to="/terms" className="footer-glass-pill px-6 py-3 rounded-full text-[#6B5E51] font-medium text-xs md:text-sm hover:text-[#2C2419]">
                  Terms of Service
                </MagneticButton>
                <MagneticButton as={Link} to="/help" className="footer-glass-pill px-6 py-3 rounded-full text-[#6B5E51] font-medium text-xs md:text-sm hover:text-[#2C2419]">
                  Help &amp; FAQ
                </MagneticButton>
                <MagneticButton as={Link} to="/lab" className="footer-glass-pill px-6 py-3 rounded-full text-[#6B5E51] font-medium text-xs md:text-sm hover:text-[#2C2419]">
                  Lab Notes
                </MagneticButton>
                <MagneticButton as={Link} to="/library" className="footer-glass-pill px-6 py-3 rounded-full text-[#6B5E51] font-medium text-xs md:text-sm hover:text-[#2C2419]">
                  Library
                </MagneticButton>
              </div>
            </div>
          </div>

          <div className="relative z-20 w-full pb-8 px-6 md:px-12 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-[#6B5E51] text-[10px] md:text-xs font-semibold tracking-widest uppercase order-2 md:order-1">
              © 2026 PhytoDoctor AI. All rights reserved.
            </div>

            <div className="footer-glass-pill px-6 py-3 rounded-full flex items-center gap-2 order-1 md:order-2 cursor-default">
              <span className="text-[#6B5E51] text-[10px] md:text-xs font-bold uppercase tracking-widest">Crafted with</span>
              <Heart className="animate-footer-heartbeat w-4 h-4 text-[#C4704B] fill-[#C4704B]" aria-hidden="true" />
              <span className="text-[#6B5E51] text-[10px] md:text-xs font-bold uppercase tracking-widest">in the</span>
              <span className="text-[#2C2419] font-black text-xs md:text-sm tracking-normal ml-1">Conservatory</span>
            </div>

            <MagneticButton
              as="button"
              type="button"
              onClick={scrollToTop}
              aria-label="Back to top"
              className="w-12 h-12 min-h-[44px] min-w-[44px] rounded-full footer-glass-pill flex items-center justify-center text-[#6B5E51] hover:text-[#3D5A3D] group order-3"
            >
              <ArrowUp className="w-5 h-5 transform group-hover:-translate-y-1.5 transition-transform duration-300" />
            </MagneticButton>
          </div>
        </footer>
      </div>
    </>
  );
}
