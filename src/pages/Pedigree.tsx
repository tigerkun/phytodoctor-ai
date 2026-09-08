import React from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { ChevronLeft, GitMerge, Sprout, Star, Info, Zap, History, Dna, ShieldCheck } from 'lucide-react';
import PhytoCard from '../components/game/PhytoCard';
import PageWrapper from '../components/home/PageWrapper';
import { usePageTransition } from '../components/home/PageTransitionContext';
import { calculateGenerationDepth, deriveInheritedTraits } from '../services/pedigreeUtils';

export default function Pedigree() {
  const { id } = useParams<{ id: string }>();
  const { transitionTo } = usePageTransition();
  
  const card = useLiveQuery(() => db.cards.get(id || ''), [id]);
  const allProps = useLiveQuery(() => db.propagations.toArray()) || [];
  
  const propagationsAsParent = useLiveQuery(() => 
    db.propagations.where('parentCardId').equals(id || '').toArray(), 
    [id]
  );

  const lineage = useLiveQuery(async () => {
    if (!id) return null;
    const fromMe = await db.propagations.where('babyCardId').equals(id).first();
    if (fromMe) {
      const parent = await db.cards.get(fromMe.parentCardId);
      return { parent, isHybrid: fromMe.isHybrid, otherParent: fromMe.hybridParents?.find(p => p !== fromMe.parentCardId) };
    }
    return null;
  }, [id]);

  const otherParentCard = useLiveQuery(async () => {
    if (lineage?.otherParent) {
      return db.cards.get(lineage.otherParent);
    }
    return undefined;
  }, [lineage?.otherParent]);

  if (!card) return (
    <div className="flex items-center justify-center h-screen bg-[#18130e]">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-4 border-[#c5a059] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="font-serif text-lg text-[#f4ead4] tracking-widest uppercase">Unfurling Royal Genealogist Scroll...</p>
      </div>
    </div>
  );

  const depthInfo = calculateGenerationDepth(card.id, allProps);
  const inheritedTraits = deriveInheritedTraits(card, lineage?.parent, otherParentCard);
  const successfulOffspring = propagationsAsParent?.filter(p => p.success) || [];

  return (
    <PageWrapper className="min-h-screen skin-lineage pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        {/* Navigation & Archival Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <button 
            onClick={() => transitionTo('/collection', 'Collection')} 
            className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.25em] text-[#6b553e] hover:text-[#2e2117] transition-colors group px-3.5 py-2 rounded-lg bg-white/40 border border-[#c5a059]/30 shadow-sm"
          >
            <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform text-[#c5a059]" />
            <span>Return to Herbarium Vault</span>
          </button>

          <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-md bg-[#241a12] border border-[#c5a059]/40 text-[10px] font-mono tracking-widest text-[#f0d68a] shadow-inner">
            <span className="w-2 h-2 rounded-full bg-[#52b788] animate-pulse" />
            <span>ROYAL GENEALOGY ARCHIVE // PEDIGREE STEM #{card.id.slice(0, 8).toUpperCase()}</span>
          </div>
        </div>

        {/* Turned Wooden Spindle Dowel (Top) */}
        <div className="spindle-dowel mb-2 mx-2 md:mx-6" title="Royal Genealogist Parchment Dowel" />

        {/* Royal Lineage Unrolled Scroll */}
        <div className="royal-lineage-scroll rounded-2xl md:rounded-[2.5rem] p-6 sm:p-10 md:p-14 shadow-2xl space-y-16">
          {/* Decorative Scroll Title Header */}
          <div className="text-center max-w-2xl mx-auto space-y-2 border-b-2 border-[#d5c4a7] pb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-[#c5a059]/20 text-[#7a5e26] text-[9px] font-mono uppercase tracking-[0.3em] font-bold">
              <span>Imperial Botanical Pedigree · Cartography of Lineage</span>
            </div>
            <h1 className="font-serif text-3xl sm:text-5xl font-black text-[#2e2117] tracking-tight">
              Genealogical Family Scroll
            </h1>
            <p className="font-serif italic text-sm sm:text-base text-[#6b5843]">
              Chronological tracing of vegetative cuttings, hybrid crossings, and phenotypic inheritance.
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-12 lg:gap-16 items-start">
            {/* Left Column: Master Subject Spotlight Plinth */}
            <div className="xl:col-span-4 flex flex-col items-center">
              <div className="lineage-pedestal p-6 md:p-8 rounded-[2rem] w-full flex flex-col items-center relative group">
                <motion.div
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4 }}
                  className="relative"
                >
                  <PhytoCard card={card} size="xl" interactive={false} />
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-5 py-1.5 bg-[#241a12] text-[#f0d68a] border border-[#c5a059] rounded-full text-[9px] font-mono font-bold uppercase tracking-[0.25em] shadow-lg whitespace-nowrap">
                    {depthInfo.label}
                  </div>
                </motion.div>
                
                {/* Botanical Identity Parchment Card */}
                <div className="mt-10 w-full space-y-4">
                  <div className="flex items-center justify-between border-b border-[#c9b491] pb-2">
                    <h3 className="font-serif text-lg font-bold text-[#2e2117]">Botanical Identity</h3>
                    <span className="text-[9px] font-mono text-[#8c765c] uppercase tracking-wider">Verified Stock</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-left">
                    <div className="bg-[#fbf9f4] p-3.5 rounded-xl border border-[#d5c4a7] shadow-sm">
                      <div className="text-[8px] font-mono uppercase tracking-widest text-[#8c765c] mb-1">Acquired</div>
                      <div className="text-xs font-serif font-bold text-[#2e2117]">
                        {new Date(card.acquiredAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                    <div className="bg-[#fbf9f4] p-3.5 rounded-xl border border-[#d5c4a7] shadow-sm">
                      <div className="text-[8px] font-mono uppercase tracking-widest text-[#8c765c] mb-1">Taxon Tier</div>
                      <div className="text-xs font-serif font-bold text-[#2e2117] capitalize">
                        {card.rarity || 'Standard'}
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 bg-[#f5ecdd] rounded-xl border border-[#c9b491] flex items-center justify-between font-mono text-[10px]">
                    <span className="text-[#6b553e] uppercase tracking-wider font-bold">Lineage Vector</span>
                    <span className="text-[#2e2117] font-bold bg-white/60 px-2 py-0.5 rounded border border-[#c9b491]">
                      {lineage?.isHybrid ? 'Biparental Hybrid' : depthInfo.generation === 0 ? 'Founder Taxon' : 'Clonal Sprout'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Lineage Vine Mapping & Trait Ledger */}
            <div className="xl:col-span-8 space-y-12">
              {/* Ancestry Section with Organic Botanical Vines */}
              <section className="lineage-cartouche p-6 sm:p-8">
                <div className="flex items-center justify-between border-b border-[#e4d7c3] pb-3 mb-6">
                  <h2 className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-[0.25em] text-[#3d2a1c]">
                    <History size={15} className="text-[#c5a059]" /> Ancestral Germination Vine
                  </h2>
                  <span className="text-[9px] font-mono text-[#8c765c] uppercase tracking-wider">
                    Generational Origin
                  </span>
                </div>

                {lineage ? (
                  <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10 py-4">
                    {/* Primary Parent */}
                    {lineage.parent && (
                      <div className="flex flex-col items-center space-y-2 text-center">
                        <span className="text-[9px] font-mono uppercase tracking-widest text-[#8c765c] font-bold">Maternal Stock</span>
                        <button 
                          onClick={() => transitionTo(`/pedigree/${lineage!.parent!.id}`, 'Pedigree Lineage')}
                          className="focus-visible:outline-none group"
                        >
                          <motion.div whileHover={{ scale: 1.04 }} className="transition-transform">
                            <PhytoCard card={lineage.parent} size="md" />
                          </motion.div>
                        </button>
                      </div>
                    )}

                    {/* Secondary Hybrid Parent (if applicable) */}
                    {otherParentCard && (
                      <div className="flex flex-col items-center space-y-2 text-center">
                        <span className="text-[9px] font-mono uppercase tracking-widest text-[#8c765c] font-bold">Paternal Cross</span>
                        <button 
                          onClick={() => transitionTo(`/pedigree/${otherParentCard.id}`, 'Pedigree Lineage')}
                          className="focus-visible:outline-none group"
                        >
                          <motion.div whileHover={{ scale: 1.04 }} className="transition-transform">
                            <PhytoCard card={otherParentCard} size="md" />
                          </motion.div>
                        </button>
                      </div>
                    )}

                    {/* Organic Botanical SVG Vine Connector */}
                    <div className="flex flex-col items-center py-2">
                      <svg width="40" height="80" viewBox="0 0 40 80" className="text-[#3b7a40]">
                        <path 
                          d="M 20 0 Q 35 25, 20 40 T 20 80" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="3" 
                          strokeLinecap="round" 
                        />
                        <circle cx="28" cy="22" r="3.5" fill="#52b788" />
                        <circle cx="12" cy="58" r="3.5" fill="#52b788" />
                      </svg>
                      <div className={`p-3 rounded-full ${lineage.isHybrid ? 'bg-[#c17f59] text-white' : 'bg-[#3b7a40] text-white'} shadow-md border-2 border-white/60`}>
                        {lineage.isHybrid ? <GitMerge size={20} /> : <Sprout size={20} />}
                      </div>
                      <span className="text-[9px] font-mono uppercase tracking-widest text-[#7a654c] mt-1 font-bold">
                        {lineage.isHybrid ? 'Hybrid Cross' : 'Direct Cutting'}
                      </span>
                    </div>

                    {/* Current Subject Leaf Card */}
                    <div className="p-6 bg-[#fbf9f4] rounded-2xl border-2 border-[#d5c4a7] text-center max-w-xs shadow-sm">
                      <div className="inline-flex p-2 rounded-full bg-[#52b788]/15 text-[#3b7a40] mb-2">
                        <Dna size={20} />
                      </div>
                      <p className="text-[#2e2117] font-serif font-bold text-base">Progeny: {card.commonName || card.species}</p>
                      <p className="text-[10px] font-mono text-[#8c765c] mt-1 italic">
                        Successfully integrated into Sanctuary register.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Founder Specimen Callout */
                  <div className="p-8 sm:p-12 bg-[#fcfaf5] rounded-2xl border-2 border-dashed border-[#c5a059]/60 flex flex-col items-center text-center space-y-4">
                    <div className="w-14 h-14 bg-[#c5a059]/20 border border-[#c5a059] rounded-full flex items-center justify-center text-[#7e5e26] shadow-sm">
                      <Star size={28} />
                    </div>
                    <div>
                      <h4 className="font-serif text-2xl sm:text-3xl font-bold text-[#2e2117]">Root Zero · Founder Specimen</h4>
                      <p className="text-xs sm:text-sm text-[#7c6953] mt-2 max-w-md mx-auto leading-relaxed font-serif italic">
                        Acquired directly from botanical field exploration. This specimen serves as an ancestral primogenitor with an unbroken wild genetic pool.
                      </p>
                    </div>
                    <div className="px-4 py-1 bg-[#c5a059]/15 rounded-full text-[9px] font-mono uppercase tracking-widest text-[#7a5e26] font-bold">
                      Gene Pool Purity: 100% Wildtype
                    </div>
                  </div>
                )}
              </section>

              {/* Genetic Trait Transmission Ledger */}
              <section className="lineage-cartouche p-6 sm:p-8">
                <div className="flex items-center justify-between border-b border-[#e4d7c3] pb-3 mb-6">
                  <h2 className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-[0.25em] text-[#3d2a1c]">
                    <Dna size={15} className="text-[#c5a059]" /> Inherited Phenotypic Traits
                  </h2>
                  <span className="text-[9px] font-mono text-[#8c765c] uppercase tracking-wider">
                    Genetic Allocation
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {inheritedTraits.map((t, i) => (
                    <div key={i} className="bg-[#fbf9f4] p-4 rounded-xl border border-[#d5c4a7] shadow-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-base text-[#7e5e26]">{t.glyph}</span>
                        <span className="text-[9px] font-mono font-bold text-[#3b7a40] bg-[#3b7a40]/10 px-2 py-0.5 rounded">
                          {t.purity}% Purity
                        </span>
                      </div>
                      <div>
                        <h4 className="font-serif text-sm font-bold text-[#2e2117]">{t.trait}</h4>
                        <p className="text-[10px] font-mono text-[#8c765c] mt-0.5 italic">{t.inheritance}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Recorded Offspring Nursery */}
              <section className="space-y-6">
                <div className="flex items-center justify-between border-b border-[#c9b491] pb-2">
                  <h2 className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-[0.25em] text-[#3d2a1c]">
                    <Sprout size={15} className="text-[#3b7a40]" /> Progeny Registry ({successfulOffspring.length} Recorded Offspring)
                  </h2>
                  <span className="text-[9px] font-mono text-[#8c765c] uppercase tracking-wider">
                    Descendants
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {successfulOffspring.map((prop, i) => (
                    <OffspringCard key={prop.babyCardId || i} babyId={prop.babyCardId} />
                  ))}

                  {/* Propagate Node Button */}
                  <button 
                    onClick={() => transitionTo(`/plant/${card.plantId}`, 'Plant Analytics')}
                    className="p-6 rounded-2xl border-2 border-dashed border-[#c5a059]/60 hover:border-[#3b7a40] bg-[#faf5eb] hover:bg-[#f3ede1] transition-all flex flex-col items-center justify-center text-center group h-64 shadow-sm"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#c5a059]/20 text-[#7a5e26] group-hover:bg-[#3b7a40]/20 group-hover:text-[#3b7a40] transition-colors flex items-center justify-center mb-3">
                      <Zap size={20} />
                    </div>
                    <h5 className="font-serif font-bold text-base text-[#2e2117]">Germinate Next Node</h5>
                    <p className="text-[9px] font-mono text-[#8c765c] mt-1 uppercase tracking-wider">
                      Initiate Propagation Cutting
                    </p>
                  </button>
                </div>

                {successfulOffspring.length === 0 && (
                  <div className="p-6 bg-[#fbf9f4] rounded-2xl border border-[#d5c4a7] flex items-start gap-4 shadow-sm">
                    <div className="shrink-0 p-3 bg-[#c5a059]/20 text-[#7a5e26] rounded-xl">
                      <Info size={20} />
                    </div>
                    <div>
                      <h4 className="font-serif font-bold text-sm text-[#2e2117]">No progeny recorded in Sanctuary registry</h4>
                      <p className="text-xs text-[#7c6953] leading-relaxed font-serif italic mt-1">
                        Cultivate and hydrate this specimen to optimal health to unlock genetic cuttings and produce F1 generation offspring.
                      </p>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>

        {/* Turned Wooden Spindle Dowel (Bottom) */}
        <div className="spindle-dowel mt-2 mx-2 md:mx-6" title="Royal Genealogist Parchment Dowel" />
      </div>
    </PageWrapper>
  );
}

function OffspringCard({ babyId }: { babyId: string }) {
  const card = useLiveQuery(() => db.cards.get(babyId), [babyId]);
  const { transitionTo } = usePageTransition();
  
  if (!card) return (
    <div className="w-full h-64 bg-[#fbf9f4] border-2 border-[#d5c4a7] rounded-2xl animate-pulse flex items-center justify-center text-[#8c765c] text-xs font-mono">
      Reading Sprout Record...
    </div>
  );

  return (
    <div className="lineage-cartouche p-4 flex flex-col items-center text-center space-y-3 shadow-sm group">
      <button 
        onClick={() => transitionTo(`/pedigree/${card.id}`, 'Pedigree Lineage')}
        className="focus-visible:outline-none"
      >
        <motion.div whileHover={{ scale: 1.04 }} className="transition-transform">
          <PhytoCard card={card} size="md" />
        </motion.div>
      </button>
      <div className="space-y-1">
        <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#3b7a40] bg-[#3b7a40]/10 px-2 py-0.5 rounded">
          Progeny Specimen
        </span>
        <p className="text-xs font-serif font-bold text-[#2e2117] truncate max-w-[180px]">{card.commonName || card.species}</p>
      </div>
    </div>
  );
}
