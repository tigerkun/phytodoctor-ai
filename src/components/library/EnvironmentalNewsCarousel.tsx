import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe2, ExternalLink, RotateCw, ChevronLeft, ChevronRight, Newspaper } from 'lucide-react';
import type { EnvironmentalNewsItem } from '../../services/libraryService';

export interface EnvironmentalNewsCarouselProps {
  items: EnvironmentalNewsItem[];
  stale?: boolean;
  actionLink?: (item: EnvironmentalNewsItem) => React.ReactNode;
}

export const FALLBACK_ENVIRONMENTAL_NEWS: EnvironmentalNewsItem[] = [
  {
    title: 'Open global natural event monitor',
    source: 'NASA EONET',
    date: 'Updated daily',
    link: 'https://eonet.gsfc.nasa.gov/',
    snippet: 'Live natural event tracking across volcanic, wildfire, storm, and ice systems.',
  },
  {
    title: 'Wildfire, storm, volcano, dust and ice records',
    source: 'NASA Earth Observatory',
    date: 'Near real-time',
    link: 'https://science.nasa.gov/earth/earth-observatory/',
    snippet: 'Curated satellite imagery and scientific analysis of major planetary environmental events.',
  },
];

export default function EnvironmentalNewsCarousel({
  items,
  stale = false,
  actionLink,
}: EnvironmentalNewsCarouselProps) {
  const newsList = items && items.length > 0 ? items : FALLBACK_ENVIRONMENTAL_NEWS;
  const [index, setIndex] = useState(0);

  const total = newsList.length;
  const current = newsList[index % total];

  const handleNext = () => {
    setIndex((prev) => (prev + 1) % total);
  };

  const handlePrev = () => {
    setIndex((prev) => (prev - 1 + total) % total);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.99 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-5 sm:p-6 rounded-xl telegraph-ticker-tape shadow-sm relative overflow-hidden flex flex-col justify-between gap-4"
    >
      {/* Circular Ink Cancellation Stamp */}
      <div className="ink-cancellation-stamp pointer-events-none" aria-hidden="true" />

      {/* Header Row */}
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="flex items-center gap-2 min-w-0">
          <Globe2 size={17} className="text-moss shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#8c6d46] dark:text-[#caa651] block">
              Telegraph Wire · Environmental Dispatch
            </span>
            <AnimatePresence mode="wait">
              <motion.h4
                key={current.title}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="font-serif font-bold text-text-bark text-sm sm:text-base leading-tight mt-0.5 line-clamp-2"
              >
                {current.title}
              </motion.h4>
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`px-2 py-0.5 text-[8px] font-mono font-bold uppercase tracking-wider rounded border ${
              !stale && items.length > 0
                ? 'bg-moss/10 text-moss border-moss/30'
                : 'bg-black/5 dark:bg-white/5 text-text-stone border-[#8c7355]/20'
            }`}
          >
            {!stale && items.length > 0 ? 'Live Top 10' : 'Archive'}
          </span>
          <span className="text-[9px] font-mono font-bold text-text-stone">
            {((index % total) + 1).toString().padStart(2, '0')}/{total.toString().padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* Body / Snippet */}
      <div className="space-y-1.5 relative z-10 font-mono">
        <p className="text-xs text-text-stone leading-relaxed flex items-center gap-2">
          <Newspaper size={12} className="text-moss shrink-0" aria-hidden="true" />
          <span className="font-bold text-text-bark">{current.source}</span>
          <span className="text-text-muted">//</span>
          <span>{current.date}</span>
        </p>
        {current.snippet && (
          <p className="text-[11px] text-text-stone line-clamp-2 leading-relaxed">
            {current.snippet}
          </p>
        )}
      </div>

      {/* Action & Slide Controls */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#8c7355]/20 relative z-10">
        <div>
          {actionLink ? (
            actionLink(current)
          ) : (
            <a
              href={current.link}
              target="_blank"
              rel="noreferrer"
              className="-my-3 inline-flex items-center min-h-[44px] gap-1.5 py-3 text-[10px] font-mono font-bold uppercase tracking-widest text-moss hover:text-moss-dark"
            >
              Open Record <ExternalLink size={11} aria-hidden="true" />
            </a>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous dispatch"
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-2.5 bg-black/5 dark:bg-white/5 hover:bg-moss/10 text-text-bark rounded text-[10px] font-mono font-bold uppercase tracking-widest transition-colors border border-[#8c7355]/25"
          >
            <ChevronLeft size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next dispatch"
            className="inline-flex items-center gap-1 min-h-[44px] px-3 bg-black/5 dark:bg-white/5 hover:bg-moss/10 text-text-bark rounded text-[10px] font-mono font-bold uppercase tracking-widest transition-colors border border-[#8c7355]/25"
          >
            <span>Next</span>
            <ChevronRight size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
