import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Swords, Shield, Loader2, Trophy, Sparkles, Lock, Sprout, Clock } from 'lucide-react';
import { db } from '../db/database';
import { GameService } from '../services/gameService';
import { PlantService } from '../services/plantService';
import { useToast } from '../components/Toast';
import PageWrapper from '../components/home/PageWrapper';
import EmptyState from '../components/EmptyState';
import {
  ARENA_RIVALS,
  ARENA_WIN_SEEDS,
  WEEKLY_FREE_DUELS,
  scoreFromStanding,
  resolveDuel,
  nextRival,
  type ArenaRival,
  type DuelOutcome,
} from '../game/arenaScoring';
import type { CareOff } from '../db/database';

/**
 * THE CARE-OFF ARENA
 *
 * The landing page has promised this since the first commit: "Challenge other
 * guardians to head-to-head care battles. Prove your green thumb and climb the
 * leaderboard." Behind that sentence sat a complete data layer — a `careOffs`
 * table with two indexes, `getCareOffsThisWeek`, `canStartCareOff`,
 * `recordCareOff`, an `arena_win: 200` economy entry, and a `winBattle` reward
 * helper. Not one line of it was ever reachable. The card was the most
 * expensive promise on the page and the first thing a visitor read.
 *
 * WHAT THIS IS, PRECISELY
 *
 * The score comes from the Keeper's own real data — the health of their
 * specimens, the streak they have kept, the check-ins they have actually
 * logged, and the species they have found. There is no dice roll anywhere.
 * A strong collection genuinely outscores a weak one, which is the entire
 * point of a care battle: you win it by caring, not by pressing a button.
 *
 * The opponent is a BENCHMARK KEEPER, not another player. `recordCareOff`
 * already hardcoded `opponentId: 'bot'`, and there is no multiplayer backend
 * behind this table — so the honest version is a ladder of rival thresholds to
 * climb past, rather than a fake lobby of invented usernames. Presenting
 * those as real people would be the exact kind of invented social proof this
 * app has otherwise been careful to strip out.
 *
 * The scoring itself lives in `src/game/arenaScoring.ts` so it can be tested
 * as a function rather than string-matched out of this file.
 *
 * A win is worth ARENA_WIN_SEEDS, credited through the normal earnSeeds path.
 * Free Keepers get three duels a week, Pro is unlimited — the same allowance
 * `canStartCareOff` already enforced.
 */

type Phase = 'idle' | 'scoring' | 'result';

interface DuelResult {
  rival: ArenaRival;
  score: number;
  outcome: DuelOutcome;
  seedsWon: number;
}

export default function Arena() {
  const navigate = useNavigate();
  const { success, error } = useToast();

  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<DuelResult | null>(null);
  const [rival, setRival] = useState<ArenaRival | null>(null);
  // Set after the first duel so a refresh cannot silently re-roll a loss into
  // a win, and cannot be used to farm the weekly allowance by reloading.
  const [rivalChosen, setRivalChosen] = useState(false);

  const profile = useLiveQuery(() => GameService.getProfile(), []);
  const plants = useLiveQuery(() => PlantService.fetchPlants(), []);
  const allCheckIns = useLiveQuery(() => db.checkins.toArray(), []);
  const history = useLiveQuery(
    () => db.careOffs.where('userId').equals(GameService.getUserId()).reverse().sortBy('createdAt'),
    []
  );

  const bestGuardianScore = useMemo(
    () => (plants ?? []).reduce((best, p) => Math.max(best, p.guardianScore ?? 0), 0),
    [plants]
  );

  const score = useMemo(
    () =>
      scoreFromStanding({
        bestGuardianScore,
        currentStreak: profile?.currentStreak ?? 0,
        checkInCount: (allCheckIns ?? []).length,
        discoveredCount: (profile?.discoveredSpecies ?? []).length,
      }),
    [bestGuardianScore, profile, allCheckIns]
  );

  const duelsThisWeek = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - start.getDay());
    start.setHours(0, 0, 0, 0);
    return (history ?? []).filter(d => new Date(d.createdAt) >= start).length;
  }, [history]);

  const isPro = profile?.tier === 'pro';
  const duelsLeft = isPro ? Infinity : Math.max(0, WEEKLY_FREE_DUELS - duelsThisWeek);

  const record = useMemo(() => {
    const list = history ?? [];
    return {
      total: list.length,
      wins: list.filter(d => d.result === 'win').length,
      losses: list.filter(d => d.result === 'loss').length,
      draws: list.filter(d => d.result === 'draw').length,
      best: list.reduce((b, d) => Math.max(b, d.score), 0),
    };
  }, [history]);

  // The next rung at or above where the Keeper currently stands, so there is
  // always a fight worth having. Once a rival is picked it stays picked until
  // the result is shown.
  const currentRival = useMemo(() => {
    if (rival) return rival;
    return nextRival(score);
  }, [rival, score]);

  const highestReached = useMemo(() => {
    const list = history ?? [];
    if (!list.length) return null;
    // The strongest rival already beaten, recovered from the recorded score.
    const beaten = ARENA_RIVALS.filter(r => list.some(d => d.score >= r.threshold));
    return beaten.length ? beaten[beaten.length - 1] : null;
  }, [history]);

  const handleDuel = async () => {
    if (phase === 'scoring') return;
    const opponent = currentRival;
    setRival(opponent);
    setRivalChosen(true);
    setPhase('scoring');
    setResult(null);

    // A short beat so the duel reads as an event. The outcome is already
    // decided by the score above — this delay changes nothing about it.
    await new Promise(resolve => setTimeout(resolve, 900));

    const outcome = resolveDuel(score, opponent);

    try {
      await GameService.recordCareOff(score, outcome, GameService.getUserId(), opponent.id);
      const seedsWon = outcome === 'win' ? ARENA_WIN_SEEDS : 0;
      setResult({ rival: opponent, score, outcome, seedsWon });
      if (outcome === 'win') success(`Duel won. ${seedsWon} seeds earned.`);
      else if (outcome === 'draw') success('A draw. You matched the rival exactly.');
      else error(`Outscored by ${opponent.threshold - score} points. Care on and try again.`);
    } catch (err: any) {
      error(err?.message || 'The duel could not be recorded.');
    } finally {
      setPhase('idle');
    }
  };

  const reset = () => {
    setResult(null);
    setRivalChosen(false);
    setRival(null);
  };

  return (
    <PageWrapper className="min-h-screen w-full relative overflow-hidden bg-[#FAF7F2] dark:bg-[#121619]">
      <div className="absolute inset-0 -z-10 gatehouse-stone opacity-95" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <header className="text-center mb-10">
          <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-[#8c7355] mb-4">
            <Swords size={13} aria-hidden="true" />
            Care-Off Arena
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-black text-[#2e2117] tracking-tight mb-4">
            Prove your green thumb
          </h1>
          <p className="text-[#6b5843] max-w-xl mx-auto leading-relaxed">
            Your score comes from what you have actually done — the health of your
            specimens, the streak you have kept, the check-ins you have logged and
            the species you have found. No dice, no luck. Care well and you climb.
          </p>
        </header>

        {/* ── Your standing ─────────────────────────────────────────── */}
        <section
          aria-label="Your arena standing"
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8"
        >
          <Stat label="Care score" value={String(score)} icon={<Shield size={15} />} />
          <Stat label="Duels won" value={String(record.wins)} icon={<Trophy size={15} />} />
          <Stat label="Best score" value={String(record.best)} icon={<Sparkles size={15} />} />
          <Stat
            label="Duels left"
            value={isPro ? '∞' : String(duelsLeft)}
            icon={<Clock size={15} />}
          />
        </section>

        {/* ── The duel ──────────────────────────────────────────────── */}
        <section className="bg-[#fbf9f4] dark:bg-[#1a1f22] rounded-3xl border-2 border-[#d8ccb8] dark:border-[#2f3639] p-6 sm:p-10 shadow-sm mb-8">
          {result ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <span
                className={`inline-block px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-5 ${
                  result.outcome === 'win'
                    ? 'bg-[#dce8d4] text-[#2d5c3a]'
                    : result.outcome === 'draw'
                      ? 'bg-[#e8dcc4] text-[#6b5325]'
                      : 'bg-[#f0dcd4] text-[#8c4a32]'
                }`}
              >
                {result.outcome === 'win' ? 'Victory' : result.outcome === 'draw' ? 'Draw' : 'Defeat'}
              </span>
              <div className="text-6xl mb-4" aria-hidden="true">{result.rival.emoji}</div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#2e2117] dark:text-[#f4eee1] mb-2">
                {result.rival.name}
              </h2>
              <p className="text-sm text-[#6b5843] dark:text-[#a89a86] italic mb-6">
                {result.rival.title}
              </p>

              <div className="flex items-center justify-center gap-6 sm:gap-10 mb-6">
                <ScorePlate label="You" score={result.score} highlight={result.outcome === 'win'} />
                <span className="font-serif text-2xl text-[#8c7355]" aria-hidden="true">vs</span>
                <ScorePlate label="Rival" score={result.rival.threshold} highlight={result.outcome === 'loss'} />
              </div>

              {result.outcome === 'win' ? (
                <p className="text-sm font-semibold text-[#2d5c3a] mb-6">
                  +{result.seedsWon} seeds earned
                </p>
              ) : result.outcome === 'draw' ? (
                <p className="text-sm text-[#6b5325] mb-6">
                  Dead heat. One more check-in would have settled it.
                </p>
              ) : (
                <p className="text-sm text-[#8c4a32] mb-6">
                  {result.rival.threshold - result.score} points short. Another check-in,
                  or another specimen in good health, will close the gap.
                </p>
              )}

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={reset}
                  className="inline-flex items-center gap-2 px-6 py-3 min-h-[44px] rounded-xl bg-[#244b2f] hover:bg-[#2d5c3a] text-[#f4eee1] text-[11px] font-black uppercase tracking-widest transition-all active:scale-95"
                >
                  Back to the ladder
                </button>
                {(plants ?? []).length > 0 && (
                  <button
                    onClick={() => navigate('/collection')}
                    className="inline-flex items-center gap-2 px-6 py-3 min-h-[44px] rounded-xl border-2 border-[#d8ccb8] text-[#2e2117] dark:text-[#f4eee1] dark:border-[#3a4246] text-[11px] font-black uppercase tracking-widest transition-all active:scale-95"
                  >
                    Tend your plants
                  </button>
                )}
              </div>
            </motion.div>
          ) : (
            <div className="text-center">
              <div className="text-6xl mb-4" aria-hidden="true">{currentRival.emoji}</div>
              <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#8c7355] mb-2">
                Next challenge
              </p>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#2e2117] dark:text-[#f4eee1] mb-2">
                {currentRival.name}
              </h2>
              <p className="text-sm text-[#6b5843] dark:text-[#a89a86] italic mb-6">
                {currentRival.title}
              </p>

              <div className="flex items-center justify-center gap-6 sm:gap-10 mb-8">
                <ScorePlate label="You" score={score} highlight />
                <span className="font-serif text-2xl text-[#8c7355]" aria-hidden="true">vs</span>
                <ScorePlate label="Rival" score={currentRival.threshold} />
              </div>

              {score === 0 ? (
                // A Keeper with no plants, no streak, no check-ins and no
                // discoveries scores zero, and zero loses to the very first
                // rung. Offering them a duel they cannot win — and cannot
                // avoid winning later either — greets a new user with a
                // defeat. Say what is actually true instead: there is nothing
                // to score yet, and here is the one thing that changes it.
                <div className="flex flex-col items-center gap-4">
                  <p className="text-sm text-[#6b5843] dark:text-[#a89a86] max-w-sm">
                    Your care score is zero because there is nothing in your
                    conservatory yet. Add a plant and it starts counting
                    immediately.
                  </p>
                  <button
                    onClick={() => navigate('/lab')}
                    className="inline-flex items-center gap-2 px-6 py-3 min-h-[44px] rounded-xl bg-[#244b2f] hover:bg-[#2d5c3a] text-[#f4eee1] text-[11px] font-black uppercase tracking-widest transition-all active:scale-95"
                  >
                    Identify your first plant
                  </button>
                </div>
              ) : duelsLeft === 0 ? (
                <div className="flex flex-col items-center gap-4">
                  <p className="flex items-center gap-2 text-sm text-[#6b5843] dark:text-[#a89a86]">
                    <Lock size={15} aria-hidden="true" />
                    You have used all {WEEKLY_FREE_DUELS} duels this week.
                  </p>
                  <p className="text-xs text-[#8c7355] max-w-sm">
                    They reset on Sunday. Pro Keepers duel as often as they like.
                  </p>
                  <button
                    onClick={() => navigate('/profile')}
                    className="inline-flex items-center gap-2 px-6 py-3 min-h-[44px] rounded-xl bg-[#c5a059] hover:bg-[#d4b169] text-[#2e2117] text-[11px] font-black uppercase tracking-widest transition-all active:scale-95"
                  >
                    See Pro options
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleDuel}
                  disabled={phase === 'scoring'}
                  className="inline-flex items-center gap-2 px-8 py-3.5 min-h-[44px] rounded-xl bg-[#244b2f] hover:bg-[#2d5c3a] text-[#f4eee1] text-[11px] font-black uppercase tracking-widest shadow-md transition-all active:scale-95 disabled:opacity-60"
                >
                  {phase === 'scoring'
                    ? <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                    : <Swords size={15} aria-hidden="true" />}
                  {phase === 'scoring' ? 'Scoring…' : 'Enter the duel'}
                </button>
              )}
            </div>
          )}
        </section>

        {/* ── The ladder ────────────────────────────────────────────── */}
        <section aria-label="The rival ladder" className="mb-8">
          <h2 className="font-serif text-xl font-bold text-[#2e2117] dark:text-[#f4eee1] mb-4 text-center">
            The ladder
          </h2>
          <ol className="space-y-2">
            {ARENA_RIVALS.map(r => {
              const beaten = (history ?? []).some(d => d.score >= r.threshold);
              const isNext = currentRival.id === r.id && !rivalChosen && !result;
              return (
                <li
                  key={r.id}
                  className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-colors ${
                    isNext
                      ? 'border-[#c5a059] bg-[#fdf8ec] dark:bg-[#241f16]'
                      : 'border-[#e3d8c4] dark:border-[#2f3639] bg-[#fbf9f4] dark:bg-[#1a1f22]'
                  }`}
                >
                  <span className="text-2xl" aria-hidden="true">{r.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-serif font-bold text-[#2e2117] dark:text-[#f4eee1] text-sm truncate">
                      {r.name}
                    </p>
                    <p className="text-xs text-[#6b5843] dark:text-[#a89a86] italic truncate">
                      {r.title}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-sm font-bold text-[#2e2117] dark:text-[#f4eee1]">
                      {r.threshold}
                    </p>
                    <p className="text-[9px] font-mono uppercase tracking-widest text-[#8c7355]">
                      {beaten ? 'Beaten' : isNext ? 'Next' : 'Locked'}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* ── Past duels ────────────────────────────────────────────── */}
        {record.total > 0 ? (
          <section aria-label="Your duel history" className="mb-8">
            <h2 className="font-serif text-xl font-bold text-[#2e2117] dark:text-[#f4eee1] mb-4 text-center">
              Your duels
            </h2>
            <ul className="space-y-2">
              {(history ?? []).slice(0, 8).map((d: CareOff) => {
                const opponent = ARENA_RIVALS.find(r => r.id === d.opponentId);
                const outcome =
                  d.result === 'win' ? 'Won' : d.result === 'draw' ? 'Drew' : 'Lost';
                const colour =
                  d.result === 'win'
                    ? 'text-[#2d5c3a]'
                    : d.result === 'draw'
                      ? 'text-[#6b5325]'
                      : 'text-[#8c4a32]';
                return (
                  <li
                    key={d.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-[#fbf9f4] dark:bg-[#1a1f22] border border-[#e3d8c4] dark:border-[#2f3639]"
                  >
                    <span className="text-lg" aria-hidden="true">
                      {opponent?.emoji ?? '🌿'}
                    </span>
                    <span className="flex-1 min-w-0 text-sm text-[#2e2117] dark:text-[#f4eee1] truncate">
                      vs {opponent?.name ?? 'a rival keeper'}
                    </span>
                    <span className={`text-xs font-bold uppercase tracking-wider shrink-0 ${colour}`}>
                      {outcome}
                    </span>
                    <span className="font-mono text-xs text-[#8c7355] shrink-0 w-8 text-right">
                      {d.score}
                    </span>
                  </li>
                );
              })}
            </ul>
            {record.total > 8 && (
              <p className="text-center text-xs text-[#8c7355] mt-3">
                Showing the 8 most recent of {record.total} duels.
              </p>
            )}
          </section>
        ) : highestReached ? null : (
          <EmptyState
            icon={Sprout}
            title="No duels yet"
            body="Your first duel scores you against the Windowsill Novice. It takes one tap — your score comes from the plants you are already keeping."
          />
        )}

        <p className="text-center text-xs text-[#8c7355] max-w-lg mx-auto leading-relaxed">
          Rivals are care benchmarks, not other players — this arena measures you
          against what diligent care is worth, and keeps your record on this
          device. {isPro ? 'Pro Keeper: unlimited duels.' : `Free Keepers get ${WEEKLY_FREE_DUELS} duels a week.`}
        </p>
      </div>
    </PageWrapper>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-[#fbf9f4] dark:bg-[#1a1f22] rounded-2xl border-2 border-[#e3d8c4] dark:border-[#2f3639] p-4 text-center">
      <div className="flex items-center justify-center gap-1.5 text-[#8c7234] mb-1.5">
        {icon}
        <span className="text-[8px] font-mono uppercase tracking-widest text-[#8c765c]">
          {label}
        </span>
      </div>
      <p className="font-serif text-2xl font-bold text-[#2e2117] dark:text-[#f4eee1]">{value}</p>
    </div>
  );
}

function ScorePlate({ label, score, highlight }: { label: string; score: number; highlight?: boolean }) {
  return (
    <div className="text-center">
      <p
        className={`font-serif text-5xl font-black ${
          highlight ? 'text-[#244b2f] dark:text-[#9fc48a]' : 'text-[#8c7355]'
        }`}
      >
        {score}
      </p>
      <p className="text-[9px] font-mono uppercase tracking-widest text-[#8c765c] mt-1">{label}</p>
    </div>
  );
}
