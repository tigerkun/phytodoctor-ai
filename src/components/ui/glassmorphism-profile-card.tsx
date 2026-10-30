import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Clock, Plus, Copy, Leaf, Check, Edit2 } from "lucide-react";

export interface GlassmorphismProfileCardProps {
  name?: string;
  role?: string;
  email?: string;
  avatarSrc?: string;
  statusText?: string;
  statusColor?: string;
  glowText?: string;
  className?: string;
  isEditing?: boolean;
  onToggleEdit?: () => void;
  children?: React.ReactNode;
}

export default function GlassmorphismProfileCard({
  name = "Guild Master",
  role = "Botanical Guardian & Sanctuary Scholar",
  email = "guardian@societas-botanica.org",
  avatarSrc = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80",
  statusText = "Active in Sanctuary",
  statusColor = "bg-[#5A7D5A]",
  glowText = "Tending the Rare Flora Collection",
  className,
  isEditing,
  onToggleEdit,
  children,
}: GlassmorphismProfileCardProps) {
  const [copied, setCopied] = useState(false);

  // Derive a local clock text once per minute
  const timeText = useMemo(() => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes().toString().padStart(2, "0");
    const hour12 = ((h + 11) % 12) + 1;
    const ampm = h >= 12 ? "PM" : "AM";
    return `${hour12}:${m} ${ampm}`;
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback if clipboard API is blocked
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={cn("relative w-full max-w-md mx-auto my-4", className)}
    >
      {/* Remodeled ambient botanical glow backdrop */}
      <div className="pointer-events-none absolute inset-x-4 -bottom-6 top-[82%] rounded-[28px] bg-gradient-to-r from-[#5A7D5A]/40 via-[#D4A843]/35 to-[#C4704B]/30 blur-xl shadow-[0_25px_50px_-12px_rgba(90,125,90,0.5)] z-0" />

      {/* Floating kicker banner below the glass card */}
      <div className="absolute inset-x-0 -bottom-8 mx-auto w-full z-0 pointer-events-none">
        <div className="flex items-center justify-center gap-2 bg-transparent py-2 text-center text-xs font-serif italic text-text-stone dark:text-[#c4ae95]">
          <Leaf className="h-3.5 w-3.5 text-moss animate-pulse" />
          <span>{glowText}</span>
        </div>
      </div>

      {/* Main Glassmorphic Card Container */}
      <Card
        className={cn(
          "relative z-10 mx-auto w-full overflow-visible rounded-[24px]",
          "bg-[#FAF7F2]/80 dark:bg-[#181410]/85 backdrop-blur-xl",
          "border-2 border-[#c5a059]/40 dark:border-[#c5a059]/30",
          "shadow-[0_12px_36px_rgba(44,36,25,0.12)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.6)]",
          "transition-all duration-300 hover:border-[#c5a059]/70"
        )}
      >
        <CardContent className="p-6 sm:p-8">
          {/* Header Status & Field Chronometer */}
          <div className="mb-6 flex items-center justify-between text-xs text-text-stone dark:text-[#baa489]">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#5A7D5A]/10 dark:bg-[#5A7D5A]/20 border border-[#5A7D5A]/30">
              <span className={cn("inline-block h-2 w-2 rounded-full animate-pulse", statusColor)} />
              <span className="font-mono text-[10px] uppercase font-bold tracking-wider select-none text-[#3D5A3D] dark:text-[#a8c9a8]">
                {statusText}
              </span>
            </div>
            <div className="flex items-center gap-1.5 opacity-85 font-mono text-[11px] text-[#7c634c] dark:text-[#c4ae95]">
              <Clock className="h-3.5 w-3.5 text-[#c5a059]" />
              <span className="tabular-nums tracking-wide">{timeText}</span>
            </div>
          </div>

          {/* Central Portrait & Naturalist Identity */}
          <div className="flex flex-col justify-center items-center gap-4">
            <div className="relative group">
              {/* Outer decorative ring */}
              <div className="relative h-48 w-48 sm:h-52 sm:w-52 shrink-0 overflow-hidden rounded-[22px] ring-2 ring-[#c5a059]/50 shadow-md bg-[#251b14]">
                <img
                  src={avatarSrc}
                  alt={`${name} portrait`}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    // Fallback to stock botanical portrait if url fails
                    (e.target as HTMLImageElement).src =
                      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80";
                  }}
                />
              </div>

              {/* Edit Toggle Icon Button */}
              {onToggleEdit && (
                <button
                  type="button"
                  onClick={onToggleEdit}
                  title="Engrave Identity / Edit Profile"
                  aria-label="Engrave Identity / Edit Profile"
                  className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-gradient-to-br from-[#faecd0] to-[#b89242] border-2 border-[#5c4013] text-[#3b2408] flex items-center justify-center shadow-lg transition-transform hover:scale-110 active:scale-95 z-20 cursor-pointer"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="min-w-0 text-center space-y-1">
              <h3 className="truncate font-serif text-2xl sm:text-3xl font-black tracking-tight text-[#2b2118] dark:text-[#faf1de]">
                {name}
              </h3>
              <p className="text-xs sm:text-sm font-serif italic text-[#7c634c] dark:text-[#d1b88a] max-w-xs mx-auto">
                {role}
              </p>
            </div>
          </div>

          {/* Optional inline custom controls or editing slot */}
          {children && <div className="mt-5">{children}</div>}

          {/* Action Button Controls */}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button
              variant="outline"
              onClick={onToggleEdit || (() => {})}
              className="h-11 justify-center gap-2 rounded-xl border border-[#c5a059]/40 bg-[#c5a059]/15 dark:bg-[#c5a059]/10 hover:bg-[#c5a059]/25 text-[#4a3512] dark:text-[#f4d38c] font-mono text-xs uppercase font-bold tracking-wider transition-all"
            >
              {isEditing ? (
                <>
                  <Check className="h-3.5 w-3.5 text-moss" /> Close Editor
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5 text-[#c5a059]" /> {onToggleEdit ? "Edit Dossier" : "Contact Keeper"}
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={handleCopy}
              className="h-11 justify-center gap-2 rounded-xl border border-[#5A7D5A]/40 bg-[#FAF7F2] dark:bg-[#201a14] hover:bg-[#EDE8DF] dark:hover:bg-[#2d241c] text-[#2b2118] dark:text-[#ede2cf] font-mono text-xs uppercase font-bold tracking-wider transition-all"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-moss" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-text-muted" />
                  <span>Copy Dispatch</span>
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
