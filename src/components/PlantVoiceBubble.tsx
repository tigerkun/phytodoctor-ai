import { Leaf, MessageCircle } from 'lucide-react';
import type { PlantVoice } from '../services/plantVoiceService';

export default function PlantVoiceBubble({ voice, plantName }: { voice: PlantVoice; plantName: string }) {
  return (
    <aside className={`rounded-2xl border p-4 ${voice.tone === 'urgent' ? 'border-red-400/50 bg-red-950/30' : 'border-[#c5a059]/30 bg-black/20'}`}>
      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-[#d8bc78]">
        <MessageCircle size={14} aria-hidden="true" />
        <span>{plantName} speaks</span>
      </div>
      <p className="mt-2 flex gap-2 font-serif text-lg text-[#f4eee1]">
        <Leaf size={18} className="mt-1 shrink-0 text-[#86b98b]" aria-hidden="true" />
        “{voice.message}”
      </p>
      {voice.suggestedAction && <p className="mt-2 text-xs text-[#cbbda8]">{voice.suggestedAction}</p>}
    </aside>
  );
}
