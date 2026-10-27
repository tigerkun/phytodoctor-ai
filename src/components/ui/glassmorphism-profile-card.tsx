import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Clock, Plus, Copy, Leaf } from "lucide-react";

interface GlassmorphismProfileCardProps {
  name?: string;
  role?: string;
  email?: string;
  avatarSrc?: string;
  statusText?: string;
  statusColor?: string;
  glowText?: string;
  className?: string;
}

export default function GlassmorphismProfileCard({
  name = "Guild Master",
  role = "Botanical Guardian",
  email = "keeper@phytodoctor.sanctuary",
  avatarSrc = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face",
  statusText = "Active in Sanctuary",
  statusColor = "bg-moss",
  glowText = "Tending the Living Collection",
  className,
}: GlassmorphismProfileCardProps) {
  const [copied, setCopied] = useState(false);

  const timeText = useMemo(() => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes().toString().padStart(2, "0");
    const hour12 = ((h + 11) % 12) + 1;
    const ampm = h >= 12 ? "PM" : "AM";
    return `${hour12}:${m}${ampm}`;
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard not available */ }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn("relative w-full max-w-sm mx-auto", className)}
    >
      {/* Warm glow beneath the card */}
      <div className="pointer-events-none absolute inset-x-3 -bottom-10 top-[90%] rounded-[28px] bg-[var(--gold)]/40 blur-sm shadow-[0_40px_80px_-16px_var(--shadow-glow-moss)] z-0" />

      {/* Floating status text below the card */}
      <div className="absolute inset-x-0 -bottom-10 mx-auto w-full z-0">
        <div className="flex items-center justify-center gap-2 bg-transparent py-3 text-center text-sm font-serif font-medium text-text-stone">
          <Leaf className="h-4 w-4 text-moss" /> {glowText}
        </div>
      </div>

      {/* Main card */}
      <div
        className={cn(
          "relative z-10 mx-auto w-full max-w-3xl overflow-visible rounded-[var(--radius-xl)]",
          "bg-[var(--bg-glass)] backdrop-blur-xl",
          "border-2 border-[var(--border-medium)]",
          "shadow-[var(--shadow-lg)]",
        )}
      >
        <div className="p-6 sm:p-8">
          {/* Status bar */}
          <div className="mb-6 flex items-center justify-between text-sm text-text-muted">
            <div className="flex items-center gap-2">
              <span className={cn("inline-block h-2.5 w-2.5 rounded-full animate-pulse", statusColor)} />
              <span className="select-none font-mono text-xs uppercase tracking-wider">{statusText}</span>
            </div>
            <div className="flex items-center gap-2 opacity-80">
              <Clock className="h-4 w-4" />
              <span className="tabular-nums font-mono text-xs">{timeText}</span>
            </div>
          </div>

          {/* Avatar + identity */}
          <div className="flex flex-col justify-center items-center gap-5">
            <div className="relative h-52 w-52 shrink-0 overflow-hidden rounded-[var(--radius-lg)] ring-2 ring-[var(--gold)]/30 shadow-[var(--shadow-md)]">
              <img
                src={avatarSrc}
                alt={`${name} avatar`}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 text-center">
              <h3 className="truncate text-xl font-serif font-bold tracking-tight sm:text-3xl text-text-bark">
                {name}
              </h3>
              <p className="mt-0.5 text-sm text-text-stone font-mono uppercase tracking-wider text-xs">
                {role}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              className="h-12 flex items-center justify-start gap-3 rounded-[var(--radius-md)] px-4 bg-moss-deep text-white font-mono text-sm font-bold uppercase tracking-wider transition-colors hover:bg-moss-dark active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" /> Hire Me
            </button>

            <button
              onClick={handleCopy}
              className="h-12 flex items-center justify-start gap-3 rounded-[var(--radius-md)] px-4 border-2 border-[var(--border-medium)] bg-[var(--bg-secondary)] text-text-bark font-mono text-sm font-bold uppercase tracking-wider transition-colors hover:bg-[var(--bg-tertiary)] active:scale-[0.98]"
            >
              <Copy className="h-4 w-4" /> {copied ? "Copied!" : "Copy Email"}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
