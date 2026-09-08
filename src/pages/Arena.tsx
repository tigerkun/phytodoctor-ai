import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Crown,
  Zap,
  Heart,
  Shield,
  Activity,
  Award,
  Swords,
  AlertCircle,
  Loader2,
  Sparkles,
  Flame,
  CheckCircle2,
  Coins
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db, type CardStats } from '../db/database';
import { GameService } from '../services/gameService';
import { ECONOMY_CONFIG, SEED_MULTIPLIERS } from '../game/ECONOMY_DATA';
import PhytoCard from '../components/game/PhytoCard';
import PageWrapper from '../components/home/PageWrapper';
import { useToast } from '../components/Toast';
import { triggerHaptic, playAudio } from '../utils/hapticAudio';

export const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

// Shared combat power calculation adhering to requirement 7: (attack * 0.4) + (speed * 0.3) + (health * 0.3)
export function calculateCombatPower(stats: CardStats): number {
  return Math.floor((stats.attack * 0.4) + (stats.speed * 0.3) + (stats.health * 0.3));
}

// Cast Bronze Laurel Medallion with swallowtail tournament pennant
export function BronzeLaurelMedal({ label, size = 'md' }: { label: React.ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  const variantClass = size === 'sm' ? 'is-sm' : size === 'lg' ? 'is-lg' : '';

  return (
    <div className={`bronze-laurel-medal ${variantClass}`}>
      <div className="bronze-laurel-disc">
        {label}
      </div>
      <div className="tournament-pennant" />
    </div>
  );
}

export default function Arena() {
  const { warning, success } = useToast();
  const profile = useLiveQuery(() => GameService.getProfile());
  const cards = useLiveQuery(() => db.cards.toArray()) || [];
  const careOffsThisWeek = useLiveQuery(() => GameService.getCareOffsThisWeek()) ?? 0;

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isChallenging, setIsChallenging] = useState(false);
  const [duelPhase, setDuelPhase] = useState<'init' | 'roots' | 'foliar' | 'sun'>('init');
  const [challengeResult, setChallengeResult] = useState<{
    result: 'win' | 'loss' | 'draw';
    score: number;
    opponentScore: number;
    seedsAwarded: number;
  } | null>(null);

  const timersRef = useRef<NodeJS.Timeout[]>([]);

  // Cleanup pending timeouts on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  // Auto-select first or featured card if none selected
  useEffect(() => {
    if (!selectedCardId && cards.length > 0) {
      const featured = cards.find(c => c.isFeatured) || cards[0];
      setSelectedCardId(featured.id);
    }
  }, [cards, selectedCardId]);

  const selectedCard = cards.find(c => c.id === selectedCardId);

  const handleSelectCard = (id: string) => {
    if (id === selectedCardId) return;
    triggerHaptic('light');
    playAudio('water-drop');
    setSelectedCardId(id);
    setChallengeResult(null);
  };

  const handleStartChallenge = async () => {
    if (isChallenging) return;

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
    setDuelPhase('roots');
    triggerHaptic('medium');
    playAudio('leaf-rustle');

    // Multi-phase sensory simulation
    const t1 = setTimeout(() => setDuelPhase('foliar'), 700);
    const t2 = setTimeout(() => setDuelPhase('sun'), 1400);

    const t3 = setTimeout(async () => {
      // User Score based on weighted stats + random factor
      const userBase = calculateCombatPower(selectedCard.stats);
      const userRandom = Math.random() * 20;
      const userScore = Math.floor(userBase + userRandom);

      // Bot Score scaled to user level
      const botBase = 40 + (selectedCard.level * 0.5) + (['mythic', 'legendary'].includes(selectedCard.rarity) ? 15 : 0);
      const botRandom = Math.random() * 30;
      const opponentScore = Math.floor(botBase + botRandom);

      const result = userScore > opponentScore + 5 ? 'win' : userScore < opponentScore - 5 ? 'loss' : 'draw';

      await GameService.recordCareOff(userScore, result);

      const multiplier = profile?.tier === 'pro' ? SEED_MULTIPLIERS.pro : SEED_MULTIPLIERS.free;
      const seedsAwarded = result === 'win' ? Math.floor(ECONOMY_CONFIG.EARNING_BASE.arena_win * multiplier) : 0;

      setChallengeResult({ result, score: userScore, opponentScore, seedsAwarded });
      setIsChallenging(false);
      setDuelPhase('init');

      if (result === 'win') {
        triggerHaptic('heavy');
        playAudio('success');
      } else if (result === 'loss') {
        triggerHaptic('medium');
      } else {
        triggerHaptic('light');
      }
    }, 2200);

    timersRef.current.push(t1, t2, t3);
  };

  const handleUpgradePro = async () => {
    try {
      await GameService.upgradeToPro();
      triggerHaptic('heavy');
      playAudio('success');
      success('Imperial Bulla activated! Unlimited Care-Offs and +1000 welcome seeds granted.');
    } catch {
      warning('Unable to activate Pro subscription.');
    }
  };

  // Sort descending by combat power so leaderboard ranking strictly matches combat power column
  const sortedByCombatPower = [...cards].sort((a, b) =>
    calculateCombatPower(b.stats) - calculateCombatPower(a.stats)
  ).slice(0, 5);

  const canAffordChallenge = profile?.tier === 'pro' || careOffsThisWeek < 3;

  // Procedural challenger preview based on current player card
  const opponentName = selectedCard?.species
    ? `Praetor ${selectedCard.species.split(' ')[0]}`
    : 'Coliseum Challenger';
  const opponentApproxPower = selectedCard
    ? Math.floor(40 + (selectedCard.level * 0.5) + (['mythic', 'legendary'].includes(selectedCard.rarity) ? 14 : 0) + 12)
    : 62;

  const userCombatPower = selectedCard ? calculateCombatPower(selectedCard.stats) : 0;

  return (
    <PageWrapper className="min-h-screen skin-arena pb-24">
      {/* Coliseum Architrave & Sun-Drenched Header */}
      <div className="pt-14 pb-14 px-6 relative overflow-hidden sandstone-banner">
        {/* Travertine Ashlar cornice strip */}
        <div
          className="h-3.5 w-full absolute top-0 left-0"
          style={{ background: 'repeating-linear-gradient(90deg, #d4af37 0 18px, #362618 18px 36px)' }}
        />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="text-center md:text-left space-y-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-sm border border-[#d4af37]/40 bg-[#d4af37]/15 text-[#f4e4c1] text-[9px] font-black uppercase tracking-[0.3em] sandstone-bevel">
                <Swords size={12} className="text-[#d4af37]" />
                Colosseum Hortorum • Arena VII
              </div>
              <h1 className="text-4xl md:text-6xl font-serif font-bold text-[#f7ecd5] leading-tight">
                The Sun-Drenched <span className="italic text-[#d4af37]">Arena</span>
              </h1>
              <p className="text-[#d9c4a0]/80 font-serif italic text-lg max-w-xl">
                Field your champion on the tournament sand. Test cultivation depth and botanical synergy.
              </p>
            </div>

            {/* Chiseled Stat Plinths */}
            <div className="flex gap-3 sm:gap-4 flex-wrap justify-center">
              <div className="arena-stat flex flex-col items-center sandstone-bevel min-w-[100px] sm:min-w-[110px]">
                <span className="text-[9px] font-black uppercase text-[#d4af37] mb-1 tracking-widest">
                  Barracks
                </span>
                <span className="text-3xl font-black text-[#f7ecd5] font-serif">{cards.length}</span>
                <span className="text-[8px] text-[#d9c4a0]/60 uppercase tracking-wider">Specimens</span>
              </div>
              <div className="arena-stat flex flex-col items-center sandstone-bevel min-w-[100px] sm:min-w-[110px]">
                <span className="text-[9px] font-black uppercase text-[#d4af37] mb-1 tracking-widest flex items-center gap-1">
                  <Coins size={10} /> Seeds
                </span>
                <span className="text-3xl font-black text-[#f7d468] font-serif">{profile?.seeds ?? 0}</span>
                <span className="text-[8px] text-[#d9c4a0]/60 uppercase tracking-wider">Laurel Balance</span>
              </div>
              <div className="arena-stat flex flex-col items-center sandstone-bevel min-w-[100px] sm:min-w-[110px]">
                <span className="text-[9px] font-black uppercase text-[#d4af37] mb-1 tracking-widest">
                  Heritage
                </span>
                <span className="text-3xl font-black text-[#d4af37] font-serif">{profile?.totalXP || 0}</span>
                <span className="text-[8px] text-[#d9c4a0]/60 uppercase tracking-wider">Total XP</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left 2 Columns: Tournament Paddock & Barracks & Leaderboard */}
        <div className="lg:col-span-2 space-y-10">

          {/* 1. Sanded Tournament Paddock & Jousting Grounds */}
          <section className="tournament-paddock p-6 md:p-10 rounded-3xl text-[#f7ecd5]">
            {/* Paddock Top Bar with Sunbaked Clay Challenge Tokens */}
            <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-[#f7ecd5]/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-black/25 flex items-center justify-center border border-[#d4af37]/40">
                  <Swords size={20} className="text-[#f7d468]" />
                </div>
                <div>
                  <h2 className="text-2xl font-serif font-bold tracking-tight text-[#fff8ed]">
                    Sanded Tournament Paddock
                  </h2>
                  <p className="text-xs text-[#f5ecd7]/80 font-serif italic">
                    Elevated terracotta ring • Dual stone facing pedestals
                  </p>
                </div>
              </div>

              {/* Sunbaked Clay Challenge Tokens */}
              <div className="flex items-center gap-3 bg-black/30 px-4 py-2 rounded-2xl border border-[#d4af37]/30">
                <div className="text-right">
                  <div className="text-[8px] font-black uppercase tracking-widest text-[#f5ecd7]/70">
                    Clay Challenge Tokens
                  </div>
                  <div className="text-xs font-bold text-[#f7d468]">
                    {profile?.tier === 'pro'
                      ? 'Imperial Bulla Active'
                      : `${Math.max(0, 3 - careOffsThisWeek)} of 3 Ready`}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {profile?.tier === 'pro' ? (
                    <div
                      className="clay-token is-pro"
                      title="Imperial Gilded Bulla — Unlimited Pro Access"
                    >
                      <span>∞</span>
                    </div>
                  ) : (
                    [0, 1, 2].map((tokenIdx) => {
                      const isSpent = careOffsThisWeek > tokenIdx;
                      return (
                        <div
                          key={tokenIdx}
                          className={`clay-token ${isSpent ? 'is-spent' : ''}`}
                          title={`Token ${ROMAN_NUMERALS[tokenIdx]}: ${isSpent ? 'Depleted / Cracked' : 'Primed for duel'}`}
                        >
                          <span>{ROMAN_NUMERALS[tokenIdx]}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Facing Pedestals Area */}
            <div className="relative z-10 py-8 grid grid-cols-1 md:grid-cols-7 gap-6 items-center">
              {/* Guardian's Champion Pedestal (Left, cols 3) */}
              <div className="md:col-span-3 flex flex-col items-center">
                <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#f7d468] mb-2 flex items-center gap-1.5">
                  <Sparkles size={12} />
                  Guardian's Champion
                </div>

                <div className="stone-pedestal w-full max-w-[240px] p-4 flex flex-col items-center min-h-[300px] justify-between text-[#2e1f13]">
                  {selectedCard ? (
                    <>
                      <div className="w-full flex flex-col items-center">
                        <PhytoCard card={selectedCard} size="sm" interactive={false} showStats={false} />
                        <div className="mt-3 text-center">
                          <h4 className="font-serif font-bold text-base leading-snug">{selectedCard.commonName}</h4>
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[#634b07]">
                            {selectedCard.species}
                          </span>
                        </div>
                      </div>

                      {/* Combat Power Plaque */}
                      <div className="w-full mt-3 pt-3 border-t border-[#948163]/30 flex justify-between items-center text-xs">
                        <span className="text-[9px] font-black uppercase tracking-wider text-[#665036]">Power Index</span>
                        <span className="font-serif font-black text-lg text-[#3b2713]">{userCombatPower}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center my-auto p-6 text-center opacity-60">
                      <Shield size={36} className="mb-2 text-[#7d6849]" />
                      <p className="text-xs font-serif italic">Select a champion specimen from the barracks below</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Center Jousting Clash & Duel Control (cols 1) */}
              <div className="md:col-span-1 flex flex-col items-center justify-center text-center py-2">
                <div className="w-12 h-12 rounded-full bg-black/40 border-2 border-[#d4af37] flex items-center justify-center shadow-lg mb-2">
                  <Swords size={22} className={`text-[#f7d468] ${isChallenging ? 'animate-bounce' : ''}`} />
                </div>
                <span className="font-serif font-bold text-sm tracking-widest text-[#fff8ed]">VS</span>
                {selectedCard && (
                  <span className="text-[9px] text-[#f7ecd5]/70 mt-1 uppercase font-mono">
                    {userCombatPower > opponentApproxPower ? '+Advantage' : 'Tough Match'}
                  </span>
                )}
              </div>

              {/* Coliseum Challenger Pedestal (Right, cols 3) */}
              <div className="md:col-span-3 flex flex-col items-center">
                <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#d9c4a0] mb-2 flex items-center gap-1.5">
                  <Shield size={12} />
                  Coliseum Challenger
                </div>

                <div className="stone-pedestal w-full max-w-[240px] p-4 flex flex-col items-center min-h-[300px] justify-between text-[#2e1f13]">
                  <div className="w-full flex flex-col items-center">
                    {/* Stylized Opponent Crest Card */}
                    <div className="w-32 h-44 rounded-2xl bg-gradient-to-b from-[#3d2a1c] to-[#1e140d] border-2 border-[#c9a356] flex flex-col items-center justify-center p-3 text-[#f7ecd5] shadow-md relative overflow-hidden">
                      <div className="absolute inset-0 opacity-10 flex items-center justify-center pointer-events-none">
                        <Swords size={90} />
                      </div>
                      <Crown size={32} className="text-[#d4af37] mb-2" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#d4af37] text-center">
                        Rival Guild
                      </span>
                      <span className="font-serif font-bold text-center text-xs mt-1">{opponentName}</span>
                    </div>

                    <div className="mt-3 text-center">
                      <h4 className="font-serif font-bold text-base leading-snug">{opponentName}</h4>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#634b07]">
                        Terra Coliseum Challenger
                      </span>
                    </div>
                  </div>

                  {/* Opponent Rating Plaque */}
                  <div className="w-full mt-3 pt-3 border-t border-[#948163]/30 flex justify-between items-center text-xs">
                    <span className="text-[9px] font-black uppercase tracking-wider text-[#665036]">Rating Thresh</span>
                    <span className="font-serif font-black text-lg text-[#3b2713]">~{opponentApproxPower}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Duel Initiation & Live Result Plaque */}
            <div className="relative z-10 pt-4 flex flex-col items-center">
              <AnimatePresence mode="wait">
                {isChallenging ? (
                  <motion.div
                    key="challenging"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-5 rounded-2xl bg-black/50 border border-[#d4af37]/40 flex flex-col items-center text-center max-w-md w-full"
                  >
                    <Loader2 size={32} className="animate-spin text-[#f7d468] mb-3" />
                    <h4 className="text-base font-serif font-bold tracking-wide text-[#fff8ed]">
                      {duelPhase === 'roots' && 'Assessing Root Anchorage & Soil Balance...'}
                      {duelPhase === 'foliar' && 'Measuring Foliar Vigour & Chlorophyll Resilience...'}
                      {duelPhase === 'sun' && 'Evaluating Solar Synergy & Growth Stamina...'}
                    </h4>
                    <span className="text-[10px] uppercase tracking-widest text-[#d4af37] mt-1 font-mono">
                      Round Phase 3 of 3
                    </span>
                  </motion.div>
                ) : challengeResult ? (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="p-6 rounded-3xl bg-black/60 backdrop-blur-md border-2 border-[#d4af37] flex flex-col items-center text-center max-w-md w-full shadow-2xl"
                  >
                    <div className="mb-2">
                      <BronzeLaurelMedal
                        size="lg"
                        label={challengeResult.result === 'win' ? <Trophy size={28} /> : <AlertCircle size={28} />}
                      />
                    </div>

                    <h3 className="text-2xl font-serif font-bold uppercase tracking-widest mt-1 text-[#fff8ed]">
                      {challengeResult.result === 'win'
                        ? 'Glorious Victory'
                        : challengeResult.result === 'loss'
                        ? 'Honorable Contention'
                        : 'Balanced Stalemate'}
                    </h3>

                    <div className="flex items-center gap-6 my-3 text-[#f7ecd5]">
                      <div className="text-center">
                        <span className="text-[9px] uppercase tracking-widest text-[#d4af37] block">Your Score</span>
                        <span className="text-2xl font-serif font-black">{challengeResult.score}</span>
                      </div>
                      <div className="h-8 w-px bg-white/20" />
                      <div className="text-center">
                        <span className="text-[9px] uppercase tracking-widest text-white/50 block">Challenger</span>
                        <span className="text-2xl font-serif font-black">{challengeResult.opponentScore}</span>
                      </div>
                    </div>

                    {challengeResult.result === 'win' && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#d4af37]/25 text-[#f7d468] text-xs font-bold mb-4 border border-[#d4af37]/40">
                        <Sparkles size={13} />
                        +{challengeResult.seedsAwarded} Sun-Dried Seeds Laurel Awarded
                      </div>
                    )}

                    <button
                      onClick={handleStartChallenge}
                      disabled={!canAffordChallenge}
                      className="px-6 py-2.5 rounded-xl bg-[#d4af37] hover:bg-[#e6c352] text-[#2b1e14] text-xs font-black uppercase tracking-widest transition-all shadow-lg disabled:opacity-50"
                    >
                      Challenge Next Contender
                    </button>
                  </motion.div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <button
                      onClick={handleStartChallenge}
                      disabled={isChallenging || !canAffordChallenge || !selectedCardId}
                      className="px-10 py-4 bg-[#fbf7ee] hover:bg-white text-[#382618] rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl transition-all flex items-center gap-3 sandstone-bevel disabled:opacity-50"
                    >
                      <Swords size={18} className="text-[#8c5218]" />
                      Initiate Care-Off Duel
                    </button>

                    {profile?.tier !== 'pro' && careOffsThisWeek >= 3 && (
                      <button
                        onClick={handleUpgradePro}
                        className="px-8 py-4 bg-[#382618] text-[#f7d468] rounded-2xl font-black uppercase tracking-widest text-xs border border-[#d4af37]/50 hover:bg-[#4a3422] transition-all flex items-center gap-2 shadow-lg"
                      >
                        <Crown size={16} />
                        Imperial Bulla (Go Pro)
                      </button>
                    )}
                  </div>
                )}
              </AnimatePresence>
            </div>

            {/* Specimen Barracks & Stable Selection Carousel */}
            <div className="relative z-10 mt-8 pt-6 border-t border-[#f7ecd5]/20">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#f5ecd7]/80">
                  Specimen Barracks • Pick Your Combatant
                </span>
                <span className="text-[9px] text-[#f7d468] uppercase font-mono">
                  {cards.length} specimens ready
                </span>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-3 pt-1 no-scrollbar">
                {cards.map((card) => (
                  <motion.button
                    key={card.id}
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelectCard(card.id)}
                    className={`shrink-0 transition-all rounded-2xl p-1 ${
                      selectedCardId === card.id
                        ? 'ring-4 ring-[#d4af37] ring-offset-2 ring-offset-[#7d4e28] scale-100 opacity-100 shadow-xl'
                        : 'opacity-70 hover:opacity-100 scale-95'
                    }`}
                  >
                    <PhytoCard card={card} size="sm" interactive={false} showStats={false} />
                  </motion.button>
                ))}

                {cards.length === 0 && (
                  <div className="py-4 text-center w-full">
                    <p className="text-xs italic opacity-80 mb-2">
                      Capture or index specimens in the Clinic to field your champions here.
                    </p>
                    <Link
                      to="/clinic"
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#d4af37]/20 border border-[#d4af37]/50 text-[#f7d468] text-xs font-bold hover:bg-[#d4af37]/30 transition-colors"
                    >
                      Visit Clinic & Dispensary
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 2. Carved Carrara Marble Honor Roll Tablet (Leaderboard) */}
          <section className="marble-tablet p-6 md:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-[#c2b5a1]/40 dark:border-[#523d26]">
              <div>
                <div className="text-[9px] font-black uppercase tracking-[0.25em] text-[#785a3a] dark:text-[#c4ab84] mb-1 font-mono">
                  Colosseum Hortorum • Tabula Honoris
                </div>
                <h2 className="text-2xl md:text-3xl font-serif font-bold text-[#302417] dark:text-[#f7ecd5] flex items-center gap-2.5">
                  <Trophy size={24} className="text-[#b8860b] dark:text-[#d4af37]" />
                  Carved Honor Roll Tablet
                </h2>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-[#785a3a] dark:text-[#e0cfa5] bg-[#ebe2d3] dark:bg-[#2c2217] px-3 py-1.5 rounded-full border border-[#c2b5a1]/50 dark:border-[#523d26]">
                Top Cultivated Specimens
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b-2 border-[#b8a68f]/50 dark:border-[#523d26] text-[#54412e] dark:text-[#c4ab84]">
                    <th className="py-3 px-4 text-[9px] font-black uppercase tracking-widest text-center w-16">
                      Rank
                    </th>
                    <th className="py-3 px-4 text-[9px] font-black uppercase tracking-widest">
                      Specimen
                    </th>
                    <th className="py-3 px-4 text-[9px] font-black uppercase tracking-widest">
                      Stage
                    </th>
                    <th className="py-3 px-4 text-[9px] font-black uppercase tracking-widest text-right">
                      Combat Power
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c2b5a1]/30 dark:divide-[#523d26]">
                  {sortedByCombatPower.map((card, idx) => {
                    const power = calculateCombatPower(card.stats);
                    const romanRank = ROMAN_NUMERALS[idx] || (idx + 1);

                    return (
                      <motion.tr
                        key={card.id}
                        whileHover={{ backgroundColor: 'rgba(180, 150, 110, 0.08)' }}
                        onClick={() => handleSelectCard(card.id)}
                        className={`group cursor-pointer transition-colors ${
                          selectedCardId === card.id ? 'bg-[#ebdcc4]/30 dark:bg-[#3d2a1c]/40' : ''
                        }`}
                      >
                        <td className="py-4 px-4 text-center">
                          <span className="chiseled-numeral text-lg font-bold">
                            #{romanRank}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#2b1e14] text-[#f7d468] flex items-center justify-center font-serif text-sm font-bold shadow-sm">
                              {card.commonName[0]}
                            </div>
                            <div>
                              <p className="font-bold text-[#2e1f13] dark:text-[#f7ecd5] text-sm group-hover:text-[#8c5218] dark:group-hover:text-[#f7d468] transition-colors">
                                {card.commonName}
                              </p>
                              <span className="text-[8px] font-bold uppercase tracking-wider text-[#735b44] dark:text-[#a89279]">
                                {card.species}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-[10px] font-black uppercase tracking-wider bg-[#eae0cf] dark:bg-[#302518] text-[#4d3a27] dark:text-[#d9c4a0] px-2.5 py-1 rounded-full border border-[#c2b5a1]/40 dark:border-[#523d26]">
                            {card.growthStage}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span className="font-serif font-black text-xl text-[#2e1f13] dark:text-[#f7ecd5]">
                            {power}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}

                  {sortedByCombatPower.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-[#785a3a] dark:text-[#c4ab84] italic text-sm">
                        No specimens registered in the archives yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 pt-4 border-t border-[#c2b5a1]/40 dark:border-[#523d26] text-center">
              <span className="text-[9px] font-black uppercase tracking-widest text-[#785a3a] dark:text-[#c4ab84]">
                Cultivation Index Logged • {cards.length} Total Specimens in Sanctuary
              </span>
            </div>
          </section>

          {/* 3. Masterpiece Specimens Spotlight */}
          <section className="sandstone-coliseum p-8 rounded-3xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div>
                <h2 className="text-3xl font-serif font-bold text-[#2e1f13] dark:text-[#f7ecd5]">
                  Masterpiece Specimens
                </h2>
                <p className="text-sm text-[#735b44] dark:text-[#c4ab84] font-serif italic">
                  Peak individuals thriving through consistent botanical care.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#2e1f13] text-[#f7ecd5] text-[9px] font-black uppercase tracking-widest sandstone-bevel">
                <Activity size={13} className="text-[#f7d468] animate-pulse" />
                Stability: Prime
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-8">
              {cards.slice(0, 3).map((card, i) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ y: -5 }}
                  onClick={() => handleSelectCard(card.id)}
                  className="cursor-pointer"
                >
                  <PhytoCard card={card} size="md" />
                </motion.div>
              ))}

              {cards.length === 0 && (
                <div className="py-12 text-center w-full">
                  <p className="text-[#785a3a] dark:text-[#c4ab84] font-serif italic text-sm">
                    Capture and care for specimens in the Clinic to exhibit them here.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Cast Bronze Accolades & Standards */}
        <div className="space-y-8">
          {/* Signatures & Cast Bronze Accolades */}
          <section className="sandstone-coliseum p-8 rounded-3xl">
            <h2 className="text-2xl font-serif font-bold text-[#2e1f13] dark:text-[#f7ecd5] flex items-center gap-3 mb-6 pb-3 border-b border-[#cfb895]/50 dark:border-[#523d26]">
              <Award size={24} className="text-[#8c5218] dark:text-[#d4af37]" />
              Coliseum Accolades
            </h2>

            <div className="space-y-5">
              {/* Streak Accolade with Bronze Laurel Medal */}
              <div className="p-4 rounded-2xl bg-[#f4ebd9] dark:bg-[#261e16] border border-[#cfb895]/60 dark:border-[#523d26] flex items-center justify-between sandstone-bevel">
                <div>
                  <span className="text-[9px] font-black uppercase text-[#735b44] dark:text-[#c4ab84] tracking-widest block mb-1">
                    Longest Streak
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-serif font-black text-[#2e1f13] dark:text-[#f7ecd5]">
                      {profile?.longestStreak || 0}
                    </span>
                    <span className="text-xs font-bold text-[#8c5218] dark:text-[#d4af37] uppercase tracking-wider">Days</span>
                  </div>
                </div>
                <BronzeLaurelMedal label={<Flame size={20} />} size="sm" />
              </div>

              {/* Elite Signatures Accolade with Bronze Laurel Medal */}
              <div className="p-4 rounded-2xl bg-[#f4ebd9] dark:bg-[#261e16] border border-[#cfb895]/60 dark:border-[#523d26] flex items-center justify-between sandstone-bevel">
                <div>
                  <span className="text-[9px] font-black uppercase text-[#735b44] dark:text-[#c4ab84] tracking-widest block mb-1">
                    Elite Guardians
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-serif font-black text-[#2e1f13] dark:text-[#f7ecd5]">
                      {cards.filter(c => c.stats.health > 80).length}
                    </span>
                    <span className="text-xs font-bold text-[#8c5218] dark:text-[#d4af37] uppercase tracking-wider">Thriving</span>
                  </div>
                </div>
                <BronzeLaurelMedal label={<Shield size={18} />} size="sm" />
              </div>

              {/* Genetic Stability Graph */}
              <div className="p-4 rounded-2xl bg-[#f4ebd9] dark:bg-[#261e16] border border-[#cfb895]/60 dark:border-[#523d26] sandstone-bevel">
                <span className="text-[9px] font-black uppercase text-[#735b44] dark:text-[#c4ab84] tracking-widest block mb-3">
                  Genetic Stability Rhythm
                </span>
                <div className="flex items-end gap-1.5 h-12">
                  {[45, 75, 50, 92, 68, 85, 96].map((height, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      animate={{ height: `${height}%` }}
                      transition={{ delay: i * 0.08 }}
                      className="flex-1 bg-[#8c5218]/50 dark:bg-[#d4af37]/40 hover:bg-[#8c5218] dark:hover:bg-[#d4af37] transition-colors rounded-t-sm"
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Coliseum Standards & Trophies */}
          <section className="sandstone-banner p-8 rounded-3xl text-[#f7edd8]">
            <div className="flex items-center gap-3 mb-6 pb-3 border-b border-[#9e7a46]/40">
              <Shield size={24} className="text-[#d4af37]" />
              <h3 className="text-2xl font-serif font-bold italic">Coliseum Standards</h3>
            </div>

            <ul className="space-y-4">
              <li className="flex items-center gap-3 p-2.5 rounded-xl bg-black/20 border border-[#9e7a46]/30">
                <div className="w-8 h-8 rounded-lg bg-[#d4af37]/20 flex items-center justify-center text-[#f7d468]">
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#fff8ed]">First 5 Specimens Fielded</p>
                  <span className="text-[8px] uppercase tracking-wider text-[#d9c4a0]/60 font-mono">Standard of Unity</span>
                </div>
              </li>

              <li className="flex items-center gap-3 p-2.5 rounded-xl bg-black/20 border border-[#9e7a46]/30">
                <div className="w-8 h-8 rounded-lg bg-[#d4af37]/20 flex items-center justify-center text-[#f7d468]">
                  <Zap size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#fff8ed]">14-Day Stable Vigil</p>
                  <span className="text-[8px] uppercase tracking-wider text-[#d9c4a0]/60 font-mono">Standard of Fortitude</span>
                </div>
              </li>

              <li className="flex items-center gap-3 p-2.5 rounded-xl bg-black/20 border border-[#9e7a46]/30">
                <div className="w-8 h-8 rounded-lg bg-[#d4af37]/20 flex items-center justify-center text-[#f7d468]">
                  <Heart size={16} className="text-red-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#fff8ed]">Tended 3 Recovered Species</p>
                  <span className="text-[8px] uppercase tracking-wider text-[#d9c4a0]/60 font-mono">Standard of Grace</span>
                </div>
              </li>
            </ul>

            <div className="mt-6 pt-4 border-t border-[#9e7a46]/30 text-center">
              <span className="text-[8px] font-black uppercase tracking-widest text-[#d9c4a0]/60">
                Weekly tokens refill every Monday dawn
              </span>
            </div>
          </section>
        </div>
      </div>
    </PageWrapper>
  );
}
