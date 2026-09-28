import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Camera, Coins, CreditCard, HelpCircle, Leaf, Library,
  MessageCircle, ShieldCheck, Sparkles, Store, Trophy,
} from 'lucide-react';

const TOUR_KEY_PREFIX = 'botanical_guardian_tour_done_';
const RESTART_EVENT = 'phyto:onboarding-restart';

interface TourStep {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  title: string;
  body: string;
  points: string[];
  cta?: { label: string; to: string };
}

const STEPS: TourStep[] = [
  {
    icon: Sparkles,
    title: 'Welcome to PhytoDoctor AI',
    body: 'This is a full botanical clinic in your pocket — AI diagnosis, collectible plant cards, a seed economy, and a market. Here is the 60-second tour. Skip anytime; you can replay it later.',
    points: [
      'Everything starts from one action: scanning a plant.',
      'Your data is saved on this device as you go.',
    ],
  },
  {
    icon: Coins,
    title: 'Seeds — your gardener\'s currency',
    body: 'Seeds are earned, never bought. Care for plants, check in, scan, and win quizzes to grow your balance.',
    points: [
      'Earn: daily check-ins, scans, discovery rewards, Library quizzes.',
      'Spend: 1,000 seeds buys Pro, and market orders earn seed refunds.',
      'Balances are protected server-side and sync automatically.',
    ],
  },
  {
    icon: Camera,
    title: 'The Wet Lab — scan a plant',
    body: 'Photograph a leaf and the AI identifies the species, detects disease or stress, and writes a full treatment plan in seconds.',
    points: [
      'Fill the frame with one well-lit leaf for the best read.',
      'Every scan earns seeds and can add a specimen to your sanctuary.',
    ],
    cta: { label: 'Try it in the Lab', to: '/lab' },
  },
  {
    icon: Leaf,
    title: 'The Dispensary — diagnose & track',
    body: 'Run guided clinical assessments, review AI case studies, and track how a plant recovers across visits.',
    points: [
      'Free daily assessments; Pro unlocks more.',
      'Health history builds up with every check-in.',
    ],
    cta: { label: 'Visit the Dispensary', to: '/clinic' },
  },
  {
    icon: Trophy,
    title: 'The Vault & PhytoCards',
    body: 'Every plant you scan earns a collectible PhytoCard. Care grows its XP, level, and growth stage.',
    points: [
      'Survive a real crisis (like root rot) and the card records a Battle Scar.',
      'Rarity spans common to mythic — rare species, rare cards.',
    ],
    cta: { label: 'Open the Vault', to: '/collection' },
  },
  {
    icon: Store,
    title: 'The Garden Market',
    body: 'Shop real gardening products. Paying is partly on us — each order earns a seed refund you can claim from the Tickets tab.',
    points: [
      'Cart checkout mirrors the single-item claim flow.',
      'Refund codes persist and stay claimable.',
    ],
    cta: { label: 'Browse the Market', to: '/market' },
  },
  {
    icon: Library,
    title: 'The Library — learn & earn',
    body: 'A daily botanical quiz: correct answers grow your sprout up the moss pole and pay seeds. Miss, and the streak resets.',
    points: [
      'Facts are free reading — new leaf every visit.',
      'Streaks multiply your reward multipliers.',
    ],
    cta: { label: 'Read the Library', to: '/library' },
  },
  {
    icon: MessageCircle,
    title: 'The Assistant — ask anything',
    body: 'A gardening consultant that knows your sanctuary context. Ask about watering, light, pests, or that weird spot on the leaf.',
    points: [
      'Free tier includes daily messages; Pro raises the cap.',
    ],
    cta: { label: 'Meet the Assistant', to: '/assistant' },
  },
  {
    icon: CreditCard,
    title: 'Going Pro',
    body: 'Pro unlocks bigger daily AI allowances and a 1.5× seed multiplier. Buy it with 1,000 seeds you earned, or ₹99/month via secure checkout.',
    points: [
      'Purchases with seeds are atomic and server-verified.',
      'Real-money checkout is handled by Razorpay.',
    ],
    cta: { label: 'See Pro in Profile', to: '/profile' },
  },
  {
    icon: HelpCircle,
    title: 'You\'re ready',
    body: 'That\'s the whole conservatory. The Help & FAQ page answers everything else — seeds, scanning, payments, privacy, and troubleshooting.',
    points: [
      'Find Help anytime: footer link or Profile page.',
      'Replay this tour whenever you like.',
    ],
    cta: { label: 'Open Help & FAQ', to: '/help' },
  },
];

export function restartOnboardingTour() {
  const userId = localStorage.getItem('botanical_guardian_userId');
  if (userId) localStorage.removeItem(TOUR_KEY_PREFIX + userId);
  window.dispatchEvent(new CustomEvent(RESTART_EVENT));
}

export default function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const maybeOpen = () => {
      const userId = localStorage.getItem('botanical_guardian_userId');
      const onboarded = localStorage.getItem('botanical_guardian_onboarded') === '1';
      const seen = userId && localStorage.getItem(TOUR_KEY_PREFIX + userId) === '1';
      if (onboarded && userId && !seen) {
        setStepIndex(0);
        setOpen(true);
      }
    };
    const t = window.setTimeout(maybeOpen, 700);
    window.addEventListener(RESTART_EVENT, maybeOpen);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener(RESTART_EVENT, maybeOpen);
    };
  }, []);

  const finish = () => {
    const userId = localStorage.getItem('botanical_guardian_userId');
    if (userId) localStorage.setItem(TOUR_KEY_PREFIX + userId, '1');
    setOpen(false);
  };

  const goToStep = (to: string) => {
    finish();
    navigate(to);
  };

  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const step = STEPS[stepIndex];
  const Icon = step.icon;
  const isLast = stepIndex === STEPS.length - 1;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          initial={{ opacity: reducedMotion ? 1 : 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: reducedMotion ? 1 : 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Guided introduction to PhytoDoctor AI"
        >
          <motion.div
            className="w-full max-w-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
            style={{ background: 'var(--bg-primary, #10151c)', color: 'var(--text-primary, #ece7dc)' }}
            initial={reducedMotion ? false : { opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25 }}
          >
            <div className="px-6 pt-6 pb-2 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                Step {stepIndex + 1} of {STEPS.length}
              </span>
              <button
                onClick={finish}
                className="text-xs uppercase tracking-wider opacity-60 hover:opacity-100 underline underline-offset-4"
              >
                Skip tour
              </button>
            </div>

            {/* progress dots */}
            <div className="px-6 pb-4 flex gap-1.5">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className="h-1 flex-1 rounded-full"
                  style={{ background: i <= stepIndex ? '#5A9E6F' : 'rgba(128,128,128,0.3)' }}
                  aria-hidden="true"
                />
              ))}
            </div>

            <div className="px-6 pb-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-[#5A9E6F]/15 text-[#5A9E6F]">
                  <Icon size={22} />
                </span>
                <h2 className="text-xl font-semibold leading-tight">{step.title}</h2>
              </div>

              <p className="text-sm leading-relaxed opacity-90">{step.body}</p>

              <ul className="mt-4 space-y-2">
                {step.points.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm opacity-85">
                    <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#5A9E6F]" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  onClick={() => setStepIndex(i => Math.max(0, i - 1))}
                  disabled={stepIndex === 0}
                  className="px-4 py-2.5 rounded-lg border border-white/15 text-sm disabled:opacity-30 hover:bg-white/5 transition-colors"
                >
                  Back
                </button>
                <div className="flex items-center gap-2">
                  {step.cta && (
                    <button
                      onClick={() => goToStep(step.cta!.to)}
                      className="px-3 py-2.5 rounded-lg text-sm text-[#5A9E6F] hover:bg-[#5A9E6F]/10 transition-colors"
                    >
                      {step.cta.label}
                    </button>
                  )}
                  {isLast ? (
                    <button
                      onClick={finish}
                      className="px-5 py-2.5 rounded-lg bg-[#3E5C3A] hover:bg-[#4a6d46] text-white text-sm font-semibold transition-colors"
                    >
                      Enter the Conservatory
                    </button>
                  ) : (
                    <button
                      onClick={() => setStepIndex(i => Math.min(STEPS.length - 1, i + 1))}
                      className="px-5 py-2.5 rounded-lg bg-[#3E5C3A] hover:bg-[#4a6d46] text-white text-sm font-semibold transition-colors"
                    >
                      Next
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
