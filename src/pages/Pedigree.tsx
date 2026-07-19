import React from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { ChevronLeft, GitMerge, Sprout, Star, Info, Zap, History } from 'lucide-react';
import PhytoCard from '../components/game/PhytoCard';
import PageWrapper from '../components/home/PageWrapper';
import { usePageTransition } from '../components/home/PageTransitionContext';

export default function Pedigree() {
  const { id } = useParams<{ id: string }>();
  const { transitionTo } = usePageTransition();
  
  const card = useLiveQuery(() => db.cards.get(id || ''), [id]);
  const user = useLiveQuery(() => db.userProfile.get('local_user'));
  
  const propagationsAsParent = useLiveQuery(() => 
    db.propagations.where('parentCardId').equals(id || '').toArray(), 
    [id]
  );

  const propagationAsHybridParent = useLiveQuery(() => 
    db.propagations.filter(p => p.hybridParents?.includes(id || '') || false).toArray(),
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

  if (!card) return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-garden-sage"></div>
    </div>
  );

  return (
    <PageWrapper className="max-w-7xl mx-auto px-6 py-12">
      <button 
        onClick={() => transitionTo('/collection', 'Collection')} 
        className="inline-flex items-center gap-2 text-garden-slate hover:text-garden-sage transition-colors mb-12"
      >
        <ChevronLeft size={20} />
        <span className="text-sm font-black uppercase tracking-widest">Back to Collection</span>
      </button>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-16">
        {/* Main Card Spotlight */}
        <div className="xl:col-span-4 flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative"
          >
            <PhytoCard card={card} size="xl" interactive={false} />
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-6 py-2 bg-garden-earth text-white rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-xl">
              Specimen Master
            </div>
          </motion.div>
          
          <div className="mt-16 w-full space-y-6">
            <h3 className="font-serif text-3xl font-bold text-garden-earth">Botanical Identity</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-[2rem] border border-garden-olive/10 shadow-sm">
                <div className="text-[8px] font-black uppercase tracking-widest text-garden-earth/40 mb-1">Acquired</div>
                <div className="text-sm font-bold text-garden-earth">{new Date(card.acquiredAt).toLocaleDateString()}</div>
              </div>
              <div className="bg-white p-6 rounded-[2rem] border border-garden-olive/10 shadow-sm">
                <div className="text-[8px] font-black uppercase tracking-widest text-garden-earth/40 mb-1">Generation</div>
                <div className="text-sm font-bold text-garden-earth">Gen {lineage ? '2' : '1'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Lineage Mapping */}
        <div className="xl:col-span-8">
          <div className="space-y-16">
            {/* Ancestry */}
            <section>
              <h2 className="flex items-center gap-4 text-xs font-black uppercase tracking-[0.3em] text-garden-sage mb-8">
                <History size={16} /> Ancestry Lineage
              </h2>
              {lineage ? (
                <div className="flex flex-col md:flex-row items-center gap-12">
                  {lineage.parent && (
                    <button onClick={() => transitionTo(`/pedigree/${lineage!.parent!.id}`, 'Pedigree Lineage')}>
                      <motion.div whileHover={{ scale: 1.02 }}>
                         <PhytoCard card={lineage.parent} size="md" />
                      </motion.div>
                    </button>
                  )}
                  <div className="flex flex-col items-center">
                    <div className="w-1 h-12 bg-garden-olive/20" />
                    <div className={`p-4 rounded-full ${lineage.isHybrid ? 'bg-garden-coral text-white' : 'bg-garden-sage text-white'} shadow-lg`}>
                       {lineage.isHybrid ? <GitMerge size={24} /> : <Sprout size={24} />}
                    </div>
                    <div className="w-1 h-12 bg-garden-olive/20" />
                  </div>
                  <div className="p-12 bg-garden-cream/30 rounded-[3rem] border border-dashed border-garden-olive/20 text-center">
                    <p className="text-garden-earth font-bold">Current Subject</p>
                    <p className="text-xs text-garden-slate mt-2 italic">Result of successful propagation</p>
                  </div>
                </div>
              ) : (
                <div className="p-16 bg-garden-earth/5 rounded-[4rem] border border-dashed border-garden-olive/20 flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-white/50 rounded-full flex items-center justify-center mb-6">
                    <Star size={32} className="text-garden-sage" />
                  </div>
                  <h4 className="font-serif text-3xl font-bold text-garden-earth">Founder Specimen</h4>
                  <p className="text-garden-slate/60 mt-4 max-w-sm">This plant was acquired from the wild or global registry. It has no recorded domestic ancestors.</p>
                </div>
              )}
            </section>

            {/* Offspring */}
            <section>
              <h2 className="flex items-center gap-4 text-xs font-black uppercase tracking-[0.3em] text-garden-sage mb-8">
                <Sprout size={16} /> Recorded Offspring
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                 {propagationsAsParent?.filter(p => p.success).map((prop, i) => (
                   <OffspringLoader key={i} babyId={prop.babyCardId} />
                 ))}
                 
                 {/* Create New Propagation Placeholder */}
                 <button 
                   onClick={() => transitionTo(`/plant/${card.plantId}`, 'Plant Analytics')}
                   className="group p-8 rounded-[3rem] border-2 border-dashed border-garden-olive/20 flex flex-col items-center justify-center text-center hover:bg-white hover:border-garden-sage transition-all h-64 w-full"
                 >
                    <div className="w-12 h-12 bg-garden-earth/5 rounded-full flex items-center justify-center mb-4 group-hover:bg-garden-sage/10 transition-colors mx-auto">
                       <Zap size={20} className="text-garden-olive group-hover:text-garden-sage transition-colors" />
                    </div>
                    <h5 className="font-bold text-garden-earth">Propagate Node</h5>
                    <p className="text-[10px] text-garden-slate mt-2 uppercase tracking-widest font-black">Requires Node Maturation</p>
                 </button>
              </div>
              
              {(!propagationsAsParent || propagationsAsParent.filter(p => p.success).length === 0) && (
                 <div className="mt-8 p-10 bg-white rounded-[3rem] border border-garden-olive/10 flex items-start gap-8 shadow-xl shadow-garden-earth/5">
                    <div className="shrink-0 p-4 bg-garden-cream rounded-2xl">
                       <Info size={24} className="text-garden-sage" />
                    </div>
                    <div>
                       <h4 className="font-bold text-garden-earth mb-2">No successfully recorded offspring</h4>
                       <p className="text-sm text-garden-slate leading-relaxed">
                         Propagating a PhytoCard allows you to transmit traits and stats to a new specimen. High health and streaks increase success probability.
                       </p>
                    </div>
                 </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}

function OffspringLoader({ babyId }: { babyId: string, key?: any }) {
  const card = useLiveQuery(() => db.cards.get(babyId), [babyId]);
  const { transitionTo } = usePageTransition();
  
  if (!card) return (
     <div className="w-48 h-64 bg-garden-earth/5 rounded-2xl animate-pulse" />
  );

  return (
    <button 
      onClick={() => transitionTo(`/pedigree/${card.id}`, 'Pedigree Lineage')}
      className="text-left block focus-visible:outline-none"
    >
       <motion.div whileHover={{ scale: 1.05 }}>
          <PhytoCard card={card} size="md" />
       </motion.div>
    </button>
  );
}
