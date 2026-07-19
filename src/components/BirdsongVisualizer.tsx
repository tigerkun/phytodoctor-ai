import React from 'react';

export default function BirdsongVisualizer() {
  return (
    <div className="flex items-center gap-3 bg-white/30 backdrop-blur-md px-4 py-2 rounded-full border border-white/50 shadow-sm group">
      <div className="flex items-center gap-[2px] h-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="w-[2px] bg-garden-sage rounded-full animate-audio-wave"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <span className="text-[8px] font-black uppercase tracking-[0.2em] text-garden-earth/50 group-hover:text-garden-sage transition-colors">Atmospheric Biophony</span>
    </div>
  );
}
