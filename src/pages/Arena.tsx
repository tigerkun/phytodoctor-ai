import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, TrendingUp, Star, Crown, Zap, Heart, Shield, Activity, Award, Leaf, Bird, Sword, Swords, AlertCircle, Loader2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { GameService } from '../services/gameService';
import PhytoCard from '../components/game/PhytoCard';
import PageWrapper from '../components/home/PageWrapper';
import { useToast } from '../components/Toast';

export default function Arena() {
  const { warning } = useToast();
  const profile = useLiveQuery(() => GameService.getProfile());
  const cards = useLiveQuery(() => db.cards.toArray()) || [];
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [careOffsThisWeek, setCareOffsThisWeek] = useState(0);
  const [isChallenging, setIsChallenging] = useState(false);
  const [challengeResult, setChallengeResult] = useState<{ result: 'win' | 'loss' | 'draw', score: number, opponentScore: number } | null>(null);

  const selectedCard = cards.find(c => c.id === selectedCardId);

  useEffect(() => {
    const loadCounts = async () => {
      const count = await GameService.getCareOffsThisWeek();
      setCareOffsThisWeek(count);
    };
    loadCounts();
  }, []);

  const handleStartChallenge = async () => {
    if (!selectedCardId) {
      warning('Please select a specimen to represent you in the Care-Off!');
      return;
    }

    const canStart = await GameService.canStartCareOff();
    if (!canStart) {
      warning('Weekly limit reached! Upgrade to Pro for infinite Care-Offs.');
      return;
    }

    if (!selectedCard) return;

    setIsChallenging(true);
    setChallengeResult(null);

    // Simulate challenge logic using card stats
    setTimeout(async () => {
      // User Score based on weighted stats + random factor
      const userBase = (selectedCard.stats.attack * 0.4) + (selectedCard.stats.speed * 0.3) + (selectedCard.stats.health * 0.3);
      const userRandom = Math.random() * 20;
      const userScore = Math.floor(userBase + userRandom);

      // Bot Score scaled to user level
      const botBase = 40 + (selectedCard.level * 0.5) + (['mythic', 'legendary'].includes(selectedCard.rarity) ? 15 : 0);
      const botRandom = Math.random() * 30;
      const opponentScore = Math.floor(botBase + botRandom);

      const result = userScore > opponentScore + 5 ? 'win' : userScore < opponentScore - 5 ? 'loss' : 'draw';
      
      await GameService.recordCareOff(userScore, result);
      setChallengeResult({ result, score: userScore, opponentScore });
      setIsChallenging(false);
      
      // Refresh count
      const count = await GameService.getCareOffsThisWeek();
      setCareOffsThisWeek(count);
    }, 2500);
  };

  const sortedByStat = [...cards].sort((a, b) => 
    (b.stats.attack + b.stats.defense + b.stats.health) - (a.stats.attack + a.stats.defense + a.stats.health)
  ).slice(0, 5);

  const canAffordChallenge = profile?.tier === 'pro' || careOffsThisWeek < 3;

  return (
    <PageWrapper className="min-h-screen bg-garden-beige/20 pb-24">
      {/* Header */}
      <div className="bg-garden-earth pt-24 pb-20 px-6 rounded-b-[5rem] shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/leaves.png')] opacity-10" />
        <div className="absolute top-0 right-0 w-[40%] h-full bg-gradient-to-l from-garden-sage/10 to-transparent" />
        <div className="max-w-7xl mx-auto relative z-10">
           <div className="flex flex-col md:flex-row justify-between items-center gap-12">
              <div className="text-center md:text-left space-y-4 relative">
                 {/* Floating Bird */}
                 <motion.div 
                    animate={{ x: [0, 20, 0], y: [0, -10, 0] }}
                    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -top-12 -left-8 text-garden-sage opacity-20"
                 >
                    <Bird size={40} />
                 </motion.div>

                 <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full border border-white/10 text-white/60 text-[8px] font-black uppercase tracking-[0.3em]">
                   Exhibition Room 01
                 </div>
                 <h1 className="text-5xl md:text-7xl font-serif font-bold text-white leading-tight">
                   The <span className="italic text-garden-sage">Magnificent</span> Gallery
                 </h1>
                 <p className="text-white/40 font-serif italic text-xl">A curated exhibition of your botanical achievements.</p>
              </div>
              
              <div className="flex gap-6">
                 <div className="bg-white/5 backdrop-blur-xl px-10 py-6 rounded-[3rem] border border-white/10 flex flex-col items-center group hover:bg-white/10 transition-all">
                    <span className="text-[8px] font-black uppercase text-white/40 mb-2 tracking-widest">Specimen Count</span>
                    <span className="text-4xl font-black text-white group-hover:scale-110 transition-transform">{cards.length}</span>
                 </div>
                 <div className="bg-white/5 backdrop-blur-xl px-10 py-6 rounded-[3rem] border border-white/10 flex flex-col items-center group hover:bg-white/10 transition-all">
                    <span className="text-[8px] font-black uppercase text-white/40 mb-2 tracking-widest">Heritage Pts</span>
                    <span className="text-4xl font-black text-garden-sage group-hover:scale-110 transition-transform">{profile?.totalXP || 0}</span>
                 </div>
              </div>
           </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Featured Specimens */}
        <div className="lg:col-span-2 space-y-12">
           {/* Care-Off Arena Section */}
           <section className="bg-garden-sage p-12 rounded-[4rem] text-white relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12 pointer-events-none">
                 <Swords size={200} />
              </div>
              
              <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
                 <div className="flex-grow">
                    <div className="flex items-center gap-3 mb-6">
                       <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                          <Sword size={20} />
                       </div>
                       <h2 className="text-3xl font-serif font-bold italic tracking-tight">Care-Off Arena</h2>
                    </div>
                    <p className="text-white/70 leading-relaxed mb-8 font-serif text-lg">
                      Challenge other Guardians to prove your nurturing skills. 
                      {profile?.tier === 'pro' ? (
                        <span className="text-yellow-400 font-bold block mt-2">Unlimited Pro Challenges Active</span>
                      ) : (
                        <span className="block mt-2 font-bold">Weekly Challenges: <span className={careOffsThisWeek >= 3 ? 'text-red-400' : 'text-white'}>{careOffsThisWeek} / 3</span></span>
                      )}
                    </p>
                    
                    <div className="flex flex-wrap gap-4">
                      <div className="w-full mb-8">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-4">Select Representing Specimen</h4>
                        <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                          {cards.map(card => (
                            <motion.button
                              key={card.id}
                              whileHover={{ y: -5 }}
                              onClick={() => setSelectedCardId(card.id)}
                              className={`shrink-0 transition-all rounded-2xl ${selectedCardId === card.id ? 'ring-4 ring-white ring-offset-4 ring-offset-garden-sage scale-100 opacity-100' : 'opacity-60 scale-95'}`}
                            >
                              <PhytoCard card={card} size="sm" interactive={false} showStats={false} />
                            </motion.button>
                          ))}
                          {cards.length === 0 && (
                            <p className="text-sm italic opacity-50">Capture specimens in the Clinic to enter the Arena.</p>
                          )}
                        </div>
                      </div>
                      
                      <button 
                        onClick={handleStartChallenge}
                        disabled={isChallenging || !canAffordChallenge || !selectedCardId}
                        className="px-10 py-5 bg-white text-garden-sage rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl hover:bg-garden-cream transition-all flex items-center gap-3 disabled:opacity-50"
                      >
                        {isChallenging ? <Loader2 size={18} className="animate-spin" /> : <Swords size={18} />}
                        {isChallenging ? 'Calculating Synergy...' : 'Start Care-Off'}
                      </button>
                      
                      {profile?.tier !== 'pro' && careOffsThisWeek >= 3 && (
                        <button 
                          onClick={() => GameService.upgradeToPro()}
                          className="px-10 py-5 bg-garden-earth text-yellow-400 rounded-2xl font-black uppercase tracking-widest text-xs border border-white/10 hover:bg-garden-olive transition-all flex items-center gap-2"
                        >
                          <Crown size={18} />
                          Go Pro for Unlimited
                        </button>
                      )}
                    </div>
                 </div>
                 
                  <AnimatePresence>
                    {challengeResult && (
                      <motion.div 
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        className="bg-white/20 backdrop-blur-md p-8 rounded-[3rem] border border-white/20 flex flex-col items-center text-center min-w-[240px]"
                      >
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${
                          challengeResult.result === 'win' ? 'bg-yellow-400 text-garden-sage' :
                          challengeResult.result === 'loss' ? 'bg-red-400 text-white' :
                          'bg-blue-400 text-white'
                        }`}>
                          {challengeResult.result === 'win' ? <Trophy size={40} /> : <AlertCircle size={40} />}
                        </div>
                        <h4 className="text-2xl font-black uppercase tracking-widest mb-2">{challengeResult.result}</h4>
                        <div className="flex flex-col items-center gap-1 mb-4 text-white">
                           <p className="text-sm font-medium opacity-60 italic">Care Quality Score: {challengeResult.score}</p>
                           <p className="text-[10px] font-black uppercase opacity-30 tracking-widest leading-none">Opponent: {challengeResult.opponentScore}</p>
                        </div>
                        {challengeResult.result === 'win' && (
                          <div className="text-yellow-400 font-bold text-xs">+100 Seeds Earned</div>
                        )}
                      </motion.div>
                    )}
                 </AnimatePresence>
              </div>
           </section>

           {/* Spotlight Section */}
           <section className="bg-white p-12 rounded-[4rem] shadow-2xl border border-garden-olive/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-12 opacity-5 -rotate-12 pointer-events-none">
                 <Crown size={240} className="text-garden-earth" />
              </div>
              
              <div className="relative z-10">
                 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12">
                    <div>
                       <h2 className="text-4xl font-serif font-bold text-garden-earth mb-4">Masterpiece Specimens</h2>
                       <p className="text-lg text-garden-slate font-serif italic">These individuals represent the peak of your collection—thriving through your care.</p>
                    </div>
                    <div className="flex items-center gap-3 bg-garden-earth text-white px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl shadow-garden-earth/20">
   <Activity size={16} className="text-garden-sage animate-pulse" />
   Stability: Optimized
</div>
                 </div>

                 <div className="flex flex-wrap justify-center gap-12 mb-12">
                    {cards.slice(0, 3).map((card, i) => (
                       <motion.div 
                          key={card.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.1 }}
                       >
                          <PhytoCard card={card} size="md" />
                       </motion.div>
                    ))}
                    {cards.length === 0 && (
                       <div className="py-20 text-center w-full">
                          <p className="text-garden-earth/30 font-black uppercase tracking-widest italic">No specimens synced yet</p>
                       </div>
                    )}
                 </div>
              </div>
           </section>

           {/* Personal Growth Records */}
           <div className="space-y-8">
              <div className="flex justify-between items-center">
                 <h2 className="text-2xl font-serif font-bold text-garden-earth flex items-center gap-3">
                   <Trophy size={28} className="text-yellow-600" />
                   Growth Performance <span className="text-garden-earth/20 font-sans font-black italic">ELITE SQUAD</span>
                 </h2>
              </div>

              <div className="bg-white rounded-[3rem] shadow-2xl border border-garden-olive/10 overflow-hidden">
                 <table className="w-full text-left">
                    <thead>
                      <tr className="bg-garden-earth text-white">
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-white/40 w-20 text-center">Rank</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-white/40">Specimen</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-white/40">Growth Stage</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-white/40 text-right">Power Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-garden-olive/5">
                      {sortedByStat.map((card, index) => (
                        <motion.tr 
                          key={card.id}
                          whileHover={{ backgroundColor: 'rgba(147, 162, 147, 0.05)' }}
                          className="group cursor-pointer"
                        >
                          <td className="px-8 py-6 text-center">
                             <span className="font-black text-lg text-garden-earth/30">#{index + 1}</span>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                               <div className="w-10 h-10 rounded-full bg-garden-earth flex items-center justify-center text-garden-sage overflow-hidden group-hover:scale-110 transition-transform">
                                 {card.plantId ? <span className="text-lg">🌿</span> : card.commonName[0]}
                               </div>
                               <div>
                                 <p className="font-bold text-garden-earth">{card.commonName}</p>
                                 <span className="text-[8px] font-black uppercase tracking-widest text-garden-sage">{card.species}</span>
                               </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <span className="text-xs font-black text-garden-earth/60 italic bg-garden-beige/30 px-3 py-1 rounded-full uppercase tracking-tighter">{card.growthStage}</span>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <span className="text-xl font-black text-garden-earth">{(card.stats.attack + card.stats.defense + card.stats.health).toFixed(0)}</span>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                 </table>
                 <div className="p-6 bg-garden-beige/10 text-center">
                    <span className="text-xs font-black uppercase tracking-widest text-garden-earth/30">Total Specimens Tracked: {cards.length}</span>
                 </div>
              </div>
           </div>
        </div>

        {/* Right Column: Achievements & Rewards */}
        <div className="space-y-8">
           <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-garden-olive/10 relative overflow-hidden">
              <h2 className="text-2xl font-serif font-bold text-garden-earth flex items-center gap-3 mb-6">
                 <Award size={28} className="text-garden-sage" />
                 Signatures
              </h2>
              
              <div className="space-y-6">
                 <div className="bg-garden-beige/20 p-6 rounded-2xl border border-garden-olive/5">
                    <span className="text-[8px] font-black uppercase text-garden-earth/40 block mb-2">Longest Streak</span>
                    <div className="flex items-end gap-2">
                       <span className="text-4xl font-black text-garden-earth">{profile?.longestStreak || 0}</span>
                       <span className="text-sm font-bold text-garden-sage mb-1 uppercase tracking-widest">Days</span>
                    </div>
                 </div>

                 <div className="bg-garden-beige/20 p-6 rounded-2xl border border-garden-olive/5">
                    <span className="text-[8px] font-black uppercase text-garden-earth/40 block mb-2">Healthy Signatures</span>
                    <div className="flex items-end gap-2">
                       <span className="text-4xl font-black text-garden-earth">{cards.filter(c => c.stats.health > 80).length}</span>
                       <span className="text-sm font-bold text-garden-sage mb-1 uppercase tracking-widest">Elite</span>
                    </div>
                 </div>

                 <div className="bg-garden-beige/20 p-6 rounded-2xl border border-garden-olive/5">
                    <span className="text-[8px] font-black uppercase text-garden-earth/40 block mb-4">Genetic Stability Index</span>
                    <div className="flex items-end gap-1 h-12">
                       {[40, 70, 45, 90, 65, 80, 95].map((h, i) => (
                          <motion.div 
                            key={i}
                            initial={{ height: 0 }}
                            animate={{ height: `${h}%` }}
                            transition={{ delay: i * 0.1 }}
                            className="flex-1 bg-garden-sage/30 rounded-t-sm"
                          />
                       ))}
                    </div>
                 </div>
              </div>
           </div>

           <div className="bg-garden-earth p-10 rounded-[3rem] text-white relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 p-8 opacity-10 -rotate-12">
                 <Shield size={120} />
              </div>
              <h3 className="text-2xl font-serif italic mb-6">Collection Trophies</h3>
              <ul className="space-y-6">
                 <li className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                       <Star size={16} className="text-yellow-400" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wide">First 5 Specimens Acquired</span>
                 </li>
                 <li className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                       <Zap size={16} className="text-garden-sage" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wide">Stable Streak: 14 Days</span>
                 </li>
                 <li className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                       <Heart size={16} className="text-red-400" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wide">Recovered 3 specimems</span>
                 </li>
              </ul>
           </div>
        </div>
     </div>
    </PageWrapper>
  );
}
