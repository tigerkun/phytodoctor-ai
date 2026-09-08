import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDayNightTheme } from '@/hooks/useDayNightTheme';
import { useEcoMode } from '@/hooks/useEcoMode';
import { triggerHaptic, playAudio } from '@/utils/hapticAudio';
import { GameService } from '@/services/gameService';
import { usePageTransition } from '@/components/home/PageTransitionContext';
import { useToast } from '../market/ToastNotification';
import ToastContainer from '../market/ToastNotification';

interface GardenCoachProps {
  profile: any;
  selectedPlant: any;
  weather: any;
  onRefreshProfile: () => void;
}

const TRIVIA_TIPS = [
  "Monstera leaves split (fenestrate) to allow wild wind and sun rays to pass through to lower leaves.",
  "Snake plants perform CAM photosynthesis, releasing fresh oxygen at night rather than during the day.",
  "Ferns have been growing on Earth for over 360 million years—long before dinosaurs roamed!",
  "Watering plants with warm water helps roots absorb nutrients much more easily than ice-cold water.",
  "Succulents store water in their thick leaves, stems, and roots to survive months of dry desert heat."
];

interface DynamicPlan {
  statusText: string;
  confidence: number;
  seedsReward: number;
  steps: { text: string; done: boolean }[];
}

const getDynamicPlan = (plant: any): DynamicPlan => {
  const name = plant?.nickname || plant?.name || 'your plant';
  const species = (plant?.species || '').toLowerCase();
  const score = plant?.healthScore || plant?.guardianScore || 90;

  let statusText = `Healthy conditions observed for ${name}.`;
  let confidence = 95;
  let seedsReward = 15;
  let steps = [
    { text: `Wipe dust off leaves to facilitate maximum light absorption`, done: false },
    { text: `Inspect soil moisture level (should be slightly damp)`, done: false },
    { text: `Rotate pot by 90 degrees for even growth`, done: false }
  ];

  if (score < 70) {
    confidence = 82;
    seedsReward = 30;
    if (species.includes('monstera')) {
      statusText = `Dehydration & Leaf Curling Warning detected for ${name}.`;
      steps = [
        { text: `Water deeply until excess drains out of the pot`, done: false },
        { text: `Insert a structural support / moss pole to guide aerial roots`, done: false },
        { text: `Increase local humidity to at least 55% using a tray or mister`, done: false }
      ];
    } else if (species.includes('ficus') || species.includes('lyrata')) {
      statusText = `Foliage Spotting & Draft Shock suspected for ${name}.`;
      steps = [
        { text: `Relocate away from drafty windows or air conditioning vents`, done: false },
        { text: `Verify top 2 inches of soil is completely dry before watering`, done: false },
        { text: `Provide bright, filtered indirect sunlight for 6 hours daily`, done: false }
      ];
    } else if (species.includes('sansevieria') || species.includes('snake')) {
      statusText = `Root Humidity Overload (Overwatering) alert for ${name}.`;
      steps = [
        { text: `Cease watering immediately and allow soil to dry completely`, done: false },
        { text: `Inspect root base for soft, dark signs of root rot`, done: false },
        { text: `Move to a location with better ambient air circulation`, done: false }
      ];
    } else {
      statusText = `Mild Nutrient Deficit / Environment Stress for ${name}.`;
      steps = [
        { text: `Add organic water-soluble fertilizer at half-strength`, done: false },
        { text: `Move to a location matching species sunlight needs`, done: false },
        { text: `Trim dead or yellowed leaf tips with sterilized shears`, done: false }
      ];
    }
  } else if (score < 90) {
    confidence = 88;
    seedsReward = 20;
    statusText = `Slight Environmental Stress detected for ${name}.`;
    steps = [
      { text: `Check soil pH levels (optimal range: 6.0 - 7.0)`, done: false },
      { text: `Apply liquid kelp extract during next watering sequence`, done: false },
      { text: `Prune away decaying lower leaves to redirect energy to top growth`, done: false }
    ];
  }

  return { statusText, confidence, seedsReward, steps };
};

export function GardenCoach({ profile, selectedPlant, weather, onRefreshProfile }: GardenCoachProps) {
  const { theme } = useDayNightTheme();
  const { shouldDisableAnimations } = useEcoMode();
  const { transitionTo } = usePageTransition();
  const toast = useToast();

  // Dynamic treatment plan state
  const [activePlan, setActivePlan] = useState<DynamicPlan>({
    statusText: '',
    confidence: 90,
    seedsReward: 15,
    steps: []
  });

  useEffect(() => {
    setActivePlan(getDynamicPlan(selectedPlant));
  }, [selectedPlant]);

  // Card 2: Market Items
  const marketItems = [
    { id: 'neem_oil', name: 'Neem Oil Spray', cost: 200, icon: '🌿' },
    { id: 'moss_pole', name: 'Sphagnum Moss Pole', cost: 150, icon: '🪵' },
    { id: 'pot_self', name: 'Self-Watering Ceramic Pot', cost: 300, icon: '🏺' }
  ];

  // Card 4: Trivia state
  const [triviaIdx, setTriviaIdx] = useState(0);

  // Handle single checkbox toggle
  const handleStepToggle = async (index: number) => {
    const updatedSteps = [...activePlan.steps];
    const step = updatedSteps[index];
    if (step.done) return; // Prevent double reward

    step.done = true;
    setActivePlan(prev => ({ ...prev, steps: updatedSteps }));

    triggerHaptic('medium');
    playAudio('success');

    // Grant seeds proportionally
    const baseReward = Math.ceil(activePlan.seedsReward / activePlan.steps.length);
    await GameService.addSeeds(baseReward, 'bonus', `Completed step for ${selectedPlant?.nickname || 'plant'}`);
    onRefreshProfile();
  };

  const handleMarkAllDone = async () => {
    const uncompletedCount = activePlan.steps.filter(s => !s.done).length;
    if (uncompletedCount === 0) return;

    const updatedSteps = activePlan.steps.map(s => ({ ...s, done: true }));
    setActivePlan(prev => ({ ...prev, steps: updatedSteps }));

    triggerHaptic('heavy');
    playAudio('success');

    // Grant remaining seeds
    const baseReward = Math.ceil(activePlan.seedsReward / activePlan.steps.length);
    await GameService.addSeeds(uncompletedCount * baseReward, 'bonus', `Completed all tasks for ${selectedPlant?.nickname || 'plant'}`);
    onRefreshProfile();
  };

  const handlePurchase = async (itemId: string, cost: number, itemName: string) => {
    if (!profile) return;
    
    if (profile.seeds < cost) {
      triggerHaptic('heavy');
      toast.error(`Not enough seeds`, `You need ${cost - profile.seeds} more seeds for this.`);
      return;
    }

    try {
      // Deduct seeds
      await GameService.addSeeds(-cost, 'spend', `Purchased ${itemName} from coach`);
      triggerHaptic('medium');
      playAudio('success');
      onRefreshProfile();
      toast.reward(`${itemName} purchased!`, 'Added to your inventory.');
    } catch (err) {
      console.error(err);
    }
  };

  const rotateTrivia = () => {
    triggerHaptic('light');
    setTriviaIdx(prev => (prev + 1) % TRIVIA_TIPS.length);
  };

  // Weather variables
  const temp = weather?.temp || 34;
  const humidity = weather?.humidity || 62;
  const condition = weather?.condition || 'Partly Cloudy';
  const rainProb = weather?.rainProbability || 10;
  const isRainy = rainProb > 50;

  return (
    <>
      <section className="py-12 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm text-[10px] font-black uppercase tracking-[0.2em] bg-moss/10 text-moss border border-moss/25 mb-2">
            🌿 HEAD GARDENER'S DISPATCH
          </div>
          <motion.h2
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl font-serif font-bold text-text-bark"
          >
            Conservatory Coach & Telemetry
          </motion.h2>
          <p className="text-sm text-text-stone mt-1 font-medium">
            Tailored botanical prescriptions, apothecary requisitions, and barometric forecasts
          </p>
        </div>

        {/* Horizontal Snapping Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Card 1: Treatment Suggestions */}
          <motion.div
            whileHover={!shouldDisableAnimations ? { y: -4 } : {}}
            className="p-6 rounded-3xl oiled-teak-frame flex flex-col justify-between shadow-xs"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl">🩺</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-sm bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20">
                  Confidence: {activePlan.confidence}%
                </span>
              </div>
              <h3 className="text-lg font-serif font-bold text-text-bark mb-1">
                Treatment Prescription
              </h3>
              <p className="text-xs text-text-stone mb-4 font-medium">
                {activePlan.statusText}
              </p>

              {/* Action Steps Checklist */}
              <div className="space-y-3 mb-4">
                {activePlan.steps.map((step, i) => (
                  <label
                    key={i}
                    className={`flex items-start gap-2.5 text-xs text-text-stone cursor-pointer group font-medium ${step.done ? 'line-through opacity-50' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={step.done}
                      disabled={step.done}
                      onChange={() => handleStepToggle(i)}
                      className="mt-0.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span>{step.text}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={handleMarkAllDone}
              disabled={activePlan.steps.every(s => s.done)}
              className="w-full py-3 min-h-[44px] rounded-xl text-xs font-serif font-bold transition-all bg-[var(--moss)] hover:bg-[var(--moss-dark)] text-white disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--moss)] focus-visible:ring-offset-2 active:scale-95 shadow-xs cursor-pointer"
            >
              {activePlan.steps.every(s => s.done) ? `✓ All Completed (+${activePlan.seedsReward} Seeds)` : 'Mark All Executed'}
            </button>
          </motion.div>

          {/* Card 2: Market Recommendations */}
          <motion.div
            whileHover={!shouldDisableAnimations ? { y: -4, scale: 1.01 } : {}}
            onClick={() => transitionTo('/market', 'Garden Market')}
            className="p-6 rounded-3xl oiled-teak-frame flex flex-col justify-between cursor-pointer relative overflow-hidden group shadow-xs hover:shadow-md"
          >
            {/* Shimmer Border Overlay */}
            {!shouldDisableAnimations && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none"
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{
                  repeat: Infinity,
                  duration: 2.5,
                  ease: 'easeInOut',
                  repeatDelay: 1.2
                }}
              />
            )}

            <div>
              <div className="text-2xl mb-4 flex items-center justify-between">
                <span>🛒</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-moss bg-moss/10 px-2 py-0.5 rounded-sm border border-moss/20">
                  Apothecary
                </span>
              </div>
              <h3 className="text-lg font-serif font-bold text-text-bark mb-1">
                Apothecary Provisions
              </h3>
              <p className="text-xs text-text-stone mb-4 font-medium">
                Tailored for your {selectedPlant?.species?.split(' ')[0] || 'Monstera'}'s vitals
              </p>

              {/* Items List */}
              <div className="space-y-3 mb-4">
                {marketItems.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 hover:bg-moss/10 transition-colors duration-200"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{item.icon}</span>
                      <div>
                        <p className="text-xs font-semibold text-text-bark">{item.name}</p>
                        <p className="text-[10px] text-text-stone font-mono">🌱 {item.cost} Seeds</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-moss group-hover:translate-x-0.5 transition-transform">
                      →
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-xs font-serif font-bold text-center text-moss uppercase tracking-widest flex items-center justify-center gap-1.5 mt-2">
              <span>Visit Garden Market</span>
              <span>➜</span>
            </div>
          </motion.div>

          {/* Card 3: Climate-Based Care */}
          <motion.div
            whileHover={!shouldDisableAnimations ? { y: -4 } : {}}
            className="p-6 rounded-3xl oiled-teak-frame flex flex-col justify-between shadow-xs"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl">🌡️</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-500/20 font-mono">
                  {condition}
                </span>
              </div>
              <h3 className="text-lg font-serif font-bold text-text-bark mb-1">
                Barometric Forecast
              </h3>
              <p className="text-xs text-text-stone mb-4 font-medium">
                Regional Telemetry • {temp}°C • {humidity}% RH
              </p>

              {/* Rain Alert Banner */}
              {isRainy && (
                <div className="mb-4 p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-[10px] flex items-center gap-1.5">
                  <span>⛈️</span>
                  <span className="font-semibold">Precipitation Expected: Defer potting hydration today!</span>
                </div>
              )}

              {/* Watering Forecast */}
              <div className="space-y-2 text-xs text-text-stone font-medium">
                <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                  <span>Today</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">Mist Foliage</span>
                </div>
                <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                  <span>Tomorrow</span>
                  <span className="font-semibold">Hold Hydration</span>
                </div>
                <div className="flex justify-between pb-1">
                  <span>In 2 Days</span>
                  <span className="font-bold text-blue-700 dark:text-blue-400">Deep Saturation</span>
                </div>
              </div>
            </div>

            <div className="text-[10px] font-mono text-center text-text-muted">
              Synchronized hourly via atmospheric telemetry
            </div>
          </motion.div>

          {/* Card 4: Did You Know? */}
          <motion.div
            whileHover={!shouldDisableAnimations ? { y: -4 } : {}}
            onClick={rotateTrivia}
            className="p-6 rounded-3xl oiled-teak-frame flex flex-col justify-between cursor-pointer group shadow-xs"
          >
            <div>
              <div className="text-2xl mb-4">💡</div>
              <h3 className="text-lg font-serif font-bold text-text-bark mb-1">
                Botanical Lore & Notes
              </h3>
              <p className="text-xs text-text-stone mb-4 font-medium">
                Folio from the head gardener's compendium
              </p>

              <div className="min-h-[80px] flex items-center">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={triviaIdx}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="text-xs font-serif italic leading-relaxed text-text-stone"
                  >
                    "{TRIVIA_TIPS[triviaIdx]}"
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>

            <div className="text-[10px] font-serif font-bold text-center text-moss group-hover:underline uppercase tracking-wider">
              Turn Folio Page →
            </div>
          </motion.div>

        </div>
      </div>
    </section>
    <ToastContainer toasts={toast.toasts} onRemove={toast.remove} position="bottom" />
    </>
  );
}
