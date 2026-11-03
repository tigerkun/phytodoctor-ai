import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BookOpen,
  Search,
  X,
  Flower2,
  Leaf,
  Sprout,
  Wheat,
  RotateCw,
  CheckCircle2,
  ExternalLink,
  Crown,
  Lock,
  Flame,
  TreePine,
  ChevronDown
} from 'lucide-react';
import { getPlantPhoto } from '../utils/plantImage';
import { GameService } from '../services/gameService';
import { db } from '../db/database';
import { PHYTO_NOTES, type PhytoNote } from '../data/phytoNotes';
import PageWrapper from '../components/home/PageWrapper';
import { triggerHaptic, playAudio } from '../utils/hapticAudio';
import { useEcoMode } from '../hooks/useEcoMode';
import BlogsSection from '../components/ui/blogs-3';
import EnvironmentalNewsCarousel from '../components/library/EnvironmentalNewsCarousel';
import { fetchLibraryDaily, type DailyQuizItem, type EnvironmentalNewsItem } from '../services/libraryService';
import {
  quizStreakMultiplier,
  quizSeedsFor,
  recordQuizOutcome,
  quizAccuracy,
  getStudiedPlates,
  markPlateStudied,
  libraryStats,
  folioMatchesForSpecies,
  SPEED_BONUS_MS,
} from '../services/libraryEngagement';

const ROMAN_NUMERALS = ['I.', 'II.', 'III.', 'IV.', 'V.'];


// ─── stagger delay applied per-index (cascade entrance) ───────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as any },
  },
};

// ─── organ → botanical icon mapping ─────────────────────────────────────────
const organIcons: Record<string, React.ReactNode> = {
  'Whole Organism': <Sprout className="text-moss" size={11} />,
  'Rhizome/Leaf':   <Leaf className="text-moss" size={11} />,
  'Foliage':        <Flower2 className="text-moss" size={11} />,
  'Fronds':         <Wheat className="text-moss" size={11} />,
  'Tuber/Stem':     <Sprout className="text-moss" size={11} />,
  'Leaf/Stem':      <Leaf className="text-moss" size={11} />,
  'Leaf Underside': <Leaf className="text-moss" size={11} />,
  'Root System':    <Sprout className="text-moss" size={11} />,
  'Node/Leaf Axil': <Leaf className="text-moss" size={11} />,
};

// ─── severity → colour strip ─────────────────────────────────────────────────
const severityStripColor: Record<string, string> = {
  Low:      'var(--moss)',
  Moderate: 'var(--gold)',
  High:     'var(--terracotta)',
  Critical: '#9c2f1f',
};



const DAILY_QUIZZES = [
  {
    question: 'Which plant counts repeated touches before closing its trap?',
    options: ['Venus flytrap', 'Boston fern', 'Snake plant'],
    answer: 0,
    explanation: 'Venus flytraps wait for repeat trigger hairs before spending energy on a snap.',
  },
  {
    question: 'What usually drives crispy fern frond tips indoors?',
    options: ['Low humidity', 'Too much moonlight', 'Excess nitrogen'],
    answer: 0,
    explanation: 'Most indoor ferns punish dry air quickly, especially near fans or AC vents.',
  },
  {
    question: 'What does mycorrhiza mainly connect to plants?',
    options: ['Fungal networks', 'Plastic fibers', 'Mineral paint'],
    answer: 0,
    explanation: 'Mycorrhizal fungi extend root reach and can move signals and nutrients through soil.',
  },
  {
    question: 'Which condition most often invites root rot?',
    options: ['Poor drainage', 'Morning shade', 'Leaf dust'],
    answer: 0,
    explanation: 'Wet, oxygen-poor soil lets root pathogens outrun the plant.',
  },
  {
    question: 'How often should you repot a root-bound plant into a much larger pot?',
    options: ['Only 1–2 sizes up', 'Five sizes up', 'Never repot'],
    answer: 0,
    explanation: 'Jumping too many pot sizes keeps soil wet for too long and invites rot — go up gradually.',
  },
  {
    question: 'Yellowing lower leaves with soggy soil most often means?',
    options: ['Overwatering', 'Underwatering', 'Too much sun'],
    answer: 0,
    explanation: 'Chronically wet soil suffocates roots; the oldest leaves yellow first.',
  },
  {
    question: 'What does "bright, indirect light" actually mean?',
    options: ['Near a sunny window, not in hot beams', 'A dark corner', 'Direct midday sun'],
    answer: 0,
    explanation: 'Most tropicals want high ambient light without scorching direct rays on the leaves.',
  },
  {
    question: 'Which pest leaves fine webbing under leaves?',
    options: ['Spider mites', 'Fungus gnats', 'Mealybugs'],
    answer: 0,
    explanation: 'Spider mites spin fine webbing and cause stippled, dusty-looking leaves.',
  },
  {
    question: 'Brown, crispy leaf edges on a Calathea usually indicate?',
    options: ['Mineral build-up or dry air', 'Too much fertilizer only', 'Root bound'],
    answer: 0,
    explanation: 'Calatheas hate tap-water minerals and dry air; use filtered water and keep humidity up.',
  },
  {
    question: 'When should you water a succulent?',
    options: ['When soil is fully dry', 'Every day a little', 'Only at night'],
    answer: 0,
    explanation: 'Succulents store water in their tissues — deep, infrequent soaks prevent rot.',
  },
  {
    question: 'What is the main benefit of rotating your pots a quarter turn weekly?',
    options: ['Even, upright growth', 'Faster flowering always', 'Larger fruit'],
    answer: 0,
    explanation: 'Plants lean toward light; rotating keeps growth symmetrical instead of lopsided.',
  },
  {
    question: 'Which is a sign of a mealybug infestation?',
    options: ['Cottony white clusters at leaf joints', 'Shiny honeydew on floor', 'Tiny black flies at soil'],
    answer: 0,
    explanation: 'Mealybugs look like small cotton cushions where leaves meet stems.',
  },
  {
    question: 'Why does tap water sometimes leave white crust on soil?',
    options: ['Dissolved minerals', 'Soap traces', 'Pollen'],
    answer: 0,
    explanation: 'Calcium and lime from hard water accumulate as a pale crust; flush or filter occasionally.',
  },
  {
    question: 'Best time of day to water most houseplants?',
    options: ['Morning', 'Midday sun', 'Never water'],
    answer: 0,
    explanation: 'Morning watering lets foliage dry and roots drink ahead of the day\u2019s light.',
  },
  {
    question: 'What does leggy, stretched growth with wide gaps between leaves mean?',
    options: ['Not enough light', 'Too much light', 'Perfect care'],
    answer: 0,
    explanation: 'Plants stretch internodes hunting for light — move it gradually brighter.',
  },
  {
    question: 'Which amendment makes heavy clay soil drain better?',
    options: ['Coarse perlite or grit', 'More clay', 'Sugar'],
    answer: 0,
    explanation: 'Inorganic, chunky material creates air pockets; fine particles make drainage worse.',
  },
  {
    question: 'What do roots sense to always grow downward?',
    options: ['Gravity', 'Magnetism', 'Sound'],
    answer: 0,
    explanation: 'Statoliths — dense starch grains in root-cap cells — settle and signal the direction of gravity.',
  },
  {
    question: 'How long can a saguaro cactus take to grow its first arm?',
    options: ['75 years', '2 weeks', '6 months'],
    answer: 0,
    explanation: 'Saguaros are famously patient — arms may not appear until 50–75 years of growth.',
  },
  {
    question: 'Why do coffee plants produce caffeine?',
    options: ['To deter rivals and pests', 'To attract bees', 'To store water'],
    answer: 0,
    explanation: 'Caffeine leaches into soil to suppress competing seedlings and poisons feeding insects.',
  },
  {
    question: 'What makes lotus leaves self-cleaning?',
    options: ['Microscopic wax crystals', 'Smooth plastic coating', 'Daily rain'],
    answer: 0,
    explanation: 'The lotus effect: nano-textured wax makes water bead and roll off, carrying dirt with it.',
  },
  {
    question: 'Which tree can be a single organism with ~47,000 stems?',
    options: ['Pando the aspen colony', 'General Sherman sequoia', 'Banyan fig'],
    answer: 0,
    explanation: 'Pando is one clone connected by shared roots — arguably the heaviest living organism.',
  },
  {
    question: 'What is a strawberry\u2019s outer "seed" actually?',
    options: ['A tiny dry fruit (achene)', 'A spore', 'A bud'],
    answer: 0,
    explanation: 'Each speck is an achene — its own one-seeded fruit — making the red flesh an accessory.',
  },
  {
    question: 'Which plant famously moves its leaflets to "sleep" at night?',
    options: ['Legumes like Mimosa', 'Cacti', 'Oak trees'],
    answer: 0,
    explanation: 'Nyctinasty folds leaves at dusk — likely for heat retention and pest defense.',
  },
  {
    question: 'What do orchids of the genus Ophrys mimic to get pollinated?',
    options: ['Female wasps', 'Rotten meat', 'Mushrooms'],
    answer: 0,
    explanation: 'Male wasps pseudo-mate with the flower and carry its pollinia to the next impersonation.',
  },
  {
    question: 'Which light do plants primarily use for photosynthesis?',
    options: ['Red and blue', 'Green', 'Ultraviolet'],
    answer: 0,
    explanation: 'Chlorophyll absorbs red and blue strongly — green is reflected, which is why leaves look green.',
  },
  {
    question: 'Why should you sterilize pruning shears between plants?',
    options: ['To avoid spreading disease', 'To keep them shiny', 'For warranty'],
    answer: 0,
    explanation: 'Sap-borne pathogens ride blades — a 70% alcohol wipe between plants prevents transmission.',
  },
  {
    question: 'What\u2019s the ideal first step for a plant with soggy soil and drooping leaves?',
    options: ['Check the roots and let it dry', 'Water more', 'Full sun immediately'],
    answer: 0,
    explanation: 'Drooping plus wet soil usually means suffocated roots — withhold water and inspect for rot.',
  },
  {
    question: 'Which is a cold-natured plant that tolerates low light?',
    options: ['ZZ plant', 'Basil', 'Tomato'],
    answer: 0,
    explanation: 'ZZ plants shrug off dim corners and irregular watering; basil and tomatoes demand sun.',
  },
  {
    question: 'What does a porous terracotta pot do that plastic doesn\u2019t?',
    options: ['Wicks moisture out of soil', 'Adds nutrients', 'Blocks light'],
    answer: 0,
    explanation: 'Unglazed clay breathes — great for overwaterers, thirsty for moisture-lovers.',
  },
  {
    question: 'What is "hardening off"?',
    options: ['Gradually introducing plants outdoors', 'Freezing seeds', 'Drying leaves'],
    answer: 0,
    explanation: 'Seedlings acclimate to wind and sun over a week or so before transplanting outside.',
  },
  {
    question: 'Which part of the plant does a leaf cutting need to regrow?',
    options: ['Living meristem or vein tissue', 'Only the tip', 'The oldest edge'],
    answer: 0,
    explanation: 'Regeneration starts from meristem/vein cells — that\u2019s why node cuts root best.',
  },
  {
    question: 'Why group houseplants together?',
    options: ['They raise each other\u2019s humidity', 'They share seeds', 'It looks small'],
    answer: 0,
    explanation: 'Transpiration from clustered plants creates a humid microclimate tropicals love.',
  },
  {
    question: 'What is etiolation?',
    options: ['Pale, stretched growth in darkness', 'Leaf burn', 'Root rot'],
    answer: 0,
    explanation: 'Starved of light, plants lengthen internodes and lose chlorophyll hunting for a source.',
  },
  {
    question: 'Which season suits most repotting?',
    options: ['Spring, at the growth spurt', 'Deep winter', 'During flowering'],
    answer: 0,
    explanation: 'Roots regrow fastest as light returns, letting plants settle into fresh soil quickly.',
  },
  {
    question: 'What\u2019s the purpose of drainage holes?',
    options: ['Let excess water escape', 'Let roots breathe air', 'Decorative only'],
    answer: 0,
    explanation: 'Without an exit, waterlogs accumulate at the base — the classic recipe for root rot.',
  },
];

const getTodayKey = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

const getDayNumber = () => Math.floor(new Date(getTodayKey()).getTime() / 86400000);

// ── Daily puzzle ladder (chess.com-style, plant edition) ────────────────────
// Free explorers get QUIZZES_PER_DAY puzzles a day. Every correct answer
// climbs the moss pole 3 paces and extends the streak; a wrong answer snaps
// the streak and the sprout slides back to the compost. Pro = unlimited.
const QUIZZES_PER_DAY = 3;
const PACES_PER_SOLVE = 3;

function quizDayKey() {
  return getTodayKey();
}

function attemptsUsedToday(): number {
  return Number(localStorage.getItem(`botanical_quiz_attempts_${quizDayKey()}`) || 0);
}

function consumeQuizAttempt(): number {
  const used = attemptsUsedToday() + 1;
  localStorage.setItem(`botanical_quiz_attempts_${quizDayKey()}`, String(used));
  return used;
}

// ── Daily rotation engine ───────────────────────────────────────────────────
// A date-seeded shuffle reorders each pool deterministically for the day:
// everyone gets the same fresh set, and tomorrow the entire library —
// puzzles and featured specimen — is a different draw.
function seededShuffle(indices: number[], seed: number): number[] {
  let a = (seed >>> 0) || 1;
  const rand = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...indices];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function Library() {
  const { shouldDisableAnimations } = useEcoMode();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'All' | 'Species Profile' | 'Pathology' | 'Pest'>('All');
  // Measured at 390px the 16 folio plates rendered fully open — about 550px each
  // in a single 358px column — for a 10014px page, 11.8 phone screens, with the
  // search box and filters 3 screens above the last plate. One plate at a time
  // turns the page into a scannable list, the same accordion the Help centre
  // already uses, so the two read alike.
  const [openPlate, setOpenPlate] = useState<string | null>(null);
  // Opening a plate IS reading it — studied marks ride the open toggle.
  const togglePlate = (key: string, scientific: string) => {
    const opening = openPlate !== key;
    setOpenPlate(opening ? key : null);
    if (opening) {
      const next = markPlateStudied(scientific, true);
      setStudiedPlates(new Set(next));
    }
  };
  const dayNumber = getDayNumber();
  // Today's draws — stable all day, completely different tomorrow.
  const todaysQuizOrder = useMemo(() => seededShuffle(DAILY_QUIZZES.map((_, i) => i), dayNumber), [dayNumber]);
  const [dynamicQuizzes, setDynamicQuizzes] = useState<DailyQuizItem[] | null>(null);
  const [newsItems, setNewsItems] = useState<EnvironmentalNewsItem[]>([]);
  const [newsStale, setNewsStale] = useState(false);
  const [quizTheme, setQuizTheme] = useState<string>('');
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [quizMessage, setQuizMessage] = useState('');
  const [answered, setAnswered] = useState(false);
  // Ladder state: streak of consecutive correct answers; the sprout sits
  // `streak * PACES_PER_SOLVE` paces up the pole. Persisted like chess.com's
  // puzzle streak so it survives reloads.
  const [streak, setStreak] = useState(() => Number(localStorage.getItem('botanical_quiz_streak') || 0));
  const [bestStreak, setBestStreak] = useState(() => Number(localStorage.getItem('botanical_quiz_best_streak') || 0));
  const [isProUser, setIsProUser] = useState(false);
  const [justFell, setJustFell] = useState(false);
  const answeringRef = useRef(false);
  // Speed bonus clock: reset whenever a fresh question is presented.
  const quizShownAtRef = useRef<number>(Date.now());
  // Folio plates the Keeper has marked as studied (device-local).
  const [studiedPlates, setStudiedPlates] = useState<Set<string>>(() => getStudiedPlates());
  const [surprisePlate, setSurprisePlate] = useState<string | null>(null);
  const userId = GameService.getUserId();

  // Active quiz selection: prefers dynamic SerpApi+Gemini shaped questions
  // for today's date, falling back smoothly to static DAILY_QUIZZES if unavailable.
  const isDynamicQuiz = Boolean(dynamicQuizzes && dynamicQuizzes.length >= 3);
  const currentQuizIndex = isDynamicQuiz
    ? attemptsUsedToday() % dynamicQuizzes!.length
    : todaysQuizOrder[attemptsUsedToday() % todaysQuizOrder.length];
  const dailyQuiz = isDynamicQuiz
    ? dynamicQuizzes![currentQuizIndex]
    : DAILY_QUIZZES[currentQuizIndex];

  // Shuffling options with the date seed moves the answer to a varied position
  // while keeping today's layout deterministic for the same day.
  const presentedQuiz = useMemo(() => {
    const order = seededShuffle(dailyQuiz.options.map((_, i) => i), dayNumber * 131 + currentQuizIndex * 17 + 7);
    return {
      options: order.map(i => dailyQuiz.options[i]),
      answer: order.indexOf(dailyQuiz.answer),
    };
  }, [dailyQuiz, dayNumber, currentQuizIndex]);

  // Derived, not state: attemptsUsedToday() keys on the local date, but state
  // captured at mount went stale when a tab stayed open past midnight — the
  // new day granted three fresh attempts while puzzlesLocked kept reading 0.
  const attemptsLeft = Math.max(0, QUIZZES_PER_DAY - attemptsUsedToday());
  const profile = useLiveQuery(() => GameService.getProfile());

  useEffect(() => {
    GameService.isPro(userId).then(setIsProUser).catch(() => setIsProUser(false));
  }, [userId]);

  // Daily Library feed (dynamic questions + top 10 environmental news)
  useEffect(() => {
    let cancelled = false;
    fetchLibraryDaily()
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data?.quiz) && data.quiz.length >= 3) {
          setDynamicQuizzes(data.quiz);
        }
        if (Array.isArray(data?.news) && data.news.length > 0) {
          setNewsItems(data.news);
          setNewsStale(Boolean(data.newsStale));
        }
        if (data?.quizTheme) {
          setQuizTheme(data.quizTheme);
        }
      })
      .catch((err) => {
        console.warn('[Library] Dynamic daily refresh unavailable, using static fallback:', err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const puzzlesLocked = !isProUser && attemptsLeft <= 0;
  // Visible paces clamp to the pole; the streak number keeps counting.
  const visiblePaces = Math.min(streak * PACES_PER_SOLVE, 8 * PACES_PER_SOLVE);

  const filtered = PHYTO_NOTES.filter(
    (d) =>
      (activeFilter === 'All' || d.type === activeFilter) &&
      (d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.symptoms.toLowerCase().includes(search.toLowerCase()) ||
        d.type.toLowerCase().includes(search.toLowerCase())),
  );

  // From your garden — folios for species the Keeper ACTUALLY keeps (their
  // live Dexie plants, matched conservatively by folioMatchesForSpecies).
  // An empty garden or zero matches renders nothing; there is no filler.
  const dbPlants = useLiveQuery(() => db.plants.toArray(), []);
  const gardenFolios = useMemo(
    () => folioMatchesForSpecies(PHYTO_NOTES, (dbPlants ?? []).filter(p => !p.isDemo).map(p => p.species)),
    [dbPlants],
  );

  const openGardenFolio = (folio: PhytoNote) => {
    const idx = PHYTO_NOTES.findIndex(n => n.name === folio.name && n.scientific === folio.scientific);
    if (idx === -1) return;
    triggerHaptic('light');
    setActiveFilter('All');
    clearSearch();
    const key = `${folio.name}-${idx}`;
    if (openPlate !== key) togglePlate(key, folio.scientific);
    requestAnimationFrame(() => {
      document.getElementById(`plate-${folio.scientific.replace(/\s+/g, '-').toLowerCase()}`)
        ?.scrollIntoView({ behavior: shouldDisableAnimations ? 'auto' : 'smooth', block: 'center' });
    });
  };

  // Random featured specimen per visit
  const dailyFeaturedSpecimen = PHYTO_NOTES[dayNumber % PHYTO_NOTES.length];

  const answerQuiz = async (index: number) => {
    // answered/selectedAnswer are state, so two clicks landing in the same tick
    // both saw the old values and both reached the reward — one answer, two
    // attempts consumed and two +25 credits. The ref flips synchronously.
    if (answeringRef.current || answered || selectedAnswer !== null || puzzlesLocked) return;
    answeringRef.current = true;
    setSelectedAnswer(index);
    setAnswered(true);
    const isCorrect = index === presentedQuiz.answer;
    triggerHaptic(isCorrect ? 'medium' : 'light');
    playAudio(isCorrect ? 'success' : 'chime');

    // One attempt consumed whether right or wrong — like chess.com's daily
    // puzzles, accuracy is what preserves the streak. The sequence number
    // doubles as the ledger idempotency key suffix: a retried click can never
    // pay the same puzzle twice.
    const attemptSeq = consumeQuizAttempt();
    const elapsedMs = quizShownAtRef.current ? Date.now() - quizShownAtRef.current : 60_000;
    recordQuizOutcome(isCorrect);

    if (isCorrect) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      localStorage.setItem('botanical_quiz_streak', String(newStreak));
      if (newStreak > bestStreak) {
        setBestStreak(newStreak);
        localStorage.setItem('botanical_quiz_best_streak', String(newStreak));
      }
      // Reward scales with the streak (capped 2×) and a fast, correct answer
      // earns a small bonus — retention maths from libraryEngagement.
      const multiplier = quizStreakMultiplier(streak);
      const seeds = quizSeedsFor(streak, true, elapsedMs);
      const speedNote = elapsedMs < SPEED_BONUS_MS ? ' · ⚡ speed bonus' : '';
      // The ledger write sits between the correct-answer feedback and the result
      // message. If it throws -- a user-scoped client that is not ready, a
      // network failure on the outbox flush -- the rejection escaped a
      // fire-and-forget click handler, so the Keeper got the chime and no
      // message at all, and had already spent the day's attempt. Credit first,
      // report either way.
      let credited = true;
      try {
        await GameService.earnSeeds(seeds, 'bonus', `Library Puzzle Solved (×${multiplier})`, undefined, `quiz:${quizDayKey()}:${attemptSeq}`);
      } catch (err) {
        credited = false;
        console.error('Quiz reward could not be credited', err);
      }
      setQuizMessage(credited
        ? `✅ Correct! +${seeds} seeds (×${multiplier} streak${speedNote}) · the sprout climbed ${PACES_PER_SOLVE} paces. ${dailyQuiz.explanation}`
        : `✅ Correct! — the sprout climbed ${PACES_PER_SOLVE} paces, but the +${seeds} seeds could not be credited. They will not be lost; try again tomorrow. ${dailyQuiz.explanation}`);
    } else {
      // Streak snapped: sprout tumbles back to the compost.
      setStreak(0);
      localStorage.setItem('botanical_quiz_streak', '0');
      setJustFell(true);
      setTimeout(() => setJustFell(false), 900);
      setQuizMessage(`❌ Streak snapped at ${streak}. ${dailyQuiz.explanation}`);
    }
  };

  const nextQuiz = () => {
    if (puzzlesLocked) return;
    triggerHaptic('light');
    playAudio('leaf-rustle');
    answeringRef.current = false;
    setSelectedAnswer(null);
    setQuizMessage('');
    setAnswered(false);
    quizShownAtRef.current = Date.now();
  };

  const handleFilterChange = (filter: 'All' | 'Species Profile' | 'Pathology' | 'Pest') => {
    triggerHaptic('light');
    setActiveFilter(filter);
  };

  const clearSearch = () => {
    triggerHaptic('light');
    setSearch('');
  };

  return (
    <PageWrapper className="relative skin-library px-4 sm:px-6 py-8 sm:py-12">
      <div className="max-w-7xl mx-auto relative z-10 space-y-8 sm:space-y-12">

        {/* ── HERO ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 sm:gap-8 mast"
        >
          <div className="max-w-[620px] flex-grow min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-[#8c6d46] dark:text-[#caa651] block">
                Naturalist's Guild Codex · Herbarium Stacks
              </span>
              <span className="px-2 py-0.5 rounded text-[8px] font-mono font-bold tracking-wider bg-[#8c6d46]/10 dark:bg-[#caa651]/15 text-[#8c6d46] dark:text-[#caa651] border border-[#8c7355]/30">
                Two-Page Open Folio
              </span>
            </div>
            <h1 className="font-serif text-3xl sm:text-5xl font-semibold mb-3 leading-tight text-text-bark flex items-baseline">
              <span className="illuminated-drop-cap text-4xl sm:text-6xl mr-2">F</span>
              <span>ield notes &amp; <em className="italic text-moss">pathology</em></span>
            </h1>
            <p className="text-sm sm:text-base text-text-stone leading-relaxed max-w-2xl font-serif">
              Bound plates of species, pests, and protocols — a double-page reading room codex, not a dashboard.
            </p>
          </div>

          <div className="w-full xl:w-80 relative shrink-0">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-stone/50">
              <Search size={16} />
            </div>
            <input
              aria-label="Search pathology or symptoms"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search pathology or symptoms..."
              className="
                w-full pl-10 pr-10 py-3.5
                bg-[#fdfaf3] dark:bg-[#201a14]
                text-text-bark
                rounded-lg
                border border-[#8c7355]/30 dark:border-[#8c7355]/50
                shadow-xs
                placeholder:text-text-stone/50
                focus:outline-none
                focus:border-moss focus:ring-1 focus:ring-moss
                font-medium text-xs
              "
            />
            {search && (
              <button
                onClick={clearSearch}
                className="
                  absolute right-4 top-1/2 -translate-y-1/2
                  text-text-stone/50 hover:text-terracotta
                  transition-colors
                "
              >
                <X size={14} />
              </button>
            )}
          </div>
        </motion.div>

        <BlogsSection />

        {/* ── QUIZ & TELEGRAPH ───────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Socratic Study Carrel · Daily Puzzle Ladder */}
          <motion.div
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-5 sm:p-6 study-carrel-slip flex flex-col gap-3 relative"
          >
            {/* Brass Thumb-Tack Graphic */}
            <div className="brass-thumb-tack" />

            <div className="flex items-start justify-between gap-3 pt-1">
              <div className="min-w-0">
                <span className="text-[10px] font-sans font-semibold uppercase tracking-[0.08em] text-[#8c6d46] dark:text-[#caa651] block leading-none mb-1.5">
                  Daily Examination {isDynamicQuiz && quizTheme ? `· ${quizTheme}` : ''}
                </span>
                <h4 className="font-serif font-bold text-text-bark text-[15px] leading-snug">
                  {puzzlesLocked ? 'The carrel is closed for today' : dailyQuiz.question}
                </h4>
                <p className="text-[11px] font-sans text-text-stone mt-1.5 tracking-normal leading-snug">
                  One attempt per puzzle · 3 a day — the facts are always free.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded bg-[#b89542]/15 text-[#b89542] text-[10px] font-sans font-bold border border-[#b89542]/30 shrink-0 text-center leading-tight">
                {isProUser ? '∞ Pro' : `${attemptsLeft} of ${QUIZZES_PER_DAY} left`}
              </span>
            </div>

            {/* ── Moss-pole ladder: the sprout climbs 3 paces per solve ── */}
            <div className="flex items-stretch gap-4 rounded-xl border border-[#8c7355]/30 bg-gradient-to-b from-[#8c7355]/10 to-transparent dark:from-white/5 dark:to-transparent p-3.5 shadow-inner">
              {/* The pole with rungs */}
              <div className="relative w-14 shrink-0 h-[132px] rounded-md overflow-hidden border border-[#5f7161]/40 bg-gradient-to-b from-[#6d7d63]/30 via-[#5f7161]/15 to-[#6b4f2e]/30">
                {[...Array(9)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute left-1 right-1 h-[2px] bg-[#8c7355]/50 rounded-full"
                    style={{ bottom: `${(i + 1) * 13}px` }}
                  />
                ))}
                {/* Moss tufts on the pole */}
                <Leaf size={9} className="absolute left-0.5 bottom-[52px] opacity-70 select-none" aria-hidden="true" />
                <Leaf size={9} className="absolute right-0.5 bottom-[91px] opacity-70 select-none" aria-hidden="true" />
                {/* Soil floor */}
                <div className="absolute bottom-0 left-0 right-0 h-2 bg-[#6b4f2e]/70 rounded-b-md" />
                {/* The climbing sprout */}
                <motion.div
                  className="absolute left-1/2 text-2xl drop-shadow-[0_0_6px_rgba(134,239,172,0.7)]"
                  style={{ marginLeft: '-12px', bottom: 6 }}
                  animate={
                    justFell
                      ? { y: 0, rotate: [0, -14, 10, -6, 0], transition: { duration: 0.7, ease: 'easeIn' } }
                      : { y: -visiblePaces * 13, rotate: 0, transition: { type: 'spring', stiffness: 160, damping: 14 } }
                  }
                  key={justFell ? 'fell' : `climb-${streak}`}
                >
                  {streak >= 10 ? <TreePine size={22} aria-hidden="true" /> : streak >= 5 ? <Sprout size={22} aria-hidden="true" /> : <Sprout size={18} aria-hidden="true" />}
                </motion.div>
                {/* Leaf-burst on a fresh solve */}
                {answered && !justFell && selectedAnswer === presentedQuiz.answer && (
                  <motion.div
                    className="absolute inset-0 pointer-events-none"
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 1 }}
                  >
                    {['🍃', '✨', '🍃'].map((p, i) => (
                      <motion.span
                        key={i}
                        className="absolute text-xs"
                        style={{ left: `${18 + i * 22}%`, bottom: `${visiblePaces * 13 + 14}px` }}
                        initial={{ y: 0, opacity: 1 }}
                        animate={{ y: -26, x: (i - 1) * 18, opacity: 0 }}
                        transition={{ duration: 0.9, delay: i * 0.08 }}
                      >
                        {p}
                      </motion.span>
                    ))}
                  </motion.div>
                )}
              </div>

              {/* Streak ledger */}
              <div className="flex flex-col justify-center gap-1.5 min-w-0">
                <div className={`flex items-center gap-1.5 font-serif font-bold text-xl ${justFell ? 'text-terracotta' : 'text-text-bark'}`}>
                  <Flame size={16} className={streak > 0 ? 'text-[#d97b29] drop-shadow-[0_0_4px_rgba(217,123,41,0.5)]' : 'text-text-stone/40'} />
                  <motion.span
                    key={streak}
                    initial={justFell ? { x: 0 } : { scale: 1.5 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 12 }}
                    className="inline-block"
                  >
                    {streak * PACES_PER_SOLVE}
                  </motion.span>
                  <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-text-stone">
                    paces up
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-wider text-text-stone">
                  <span className="flex items-center gap-1">
                    <Flame size={9} className="text-[#d97b29]/70" />
                    streak {streak}
                  </span>
                  <span className="text-[#8c7355]/50">·</span>
                  <span>best {bestStreak}</span>
                  <span className="text-[#8c7355]/50">·</span>
                  <span>accuracy {quizAccuracy()}%</span>
                  <span className="text-[#8c7355]/50">·</span>
                  <span title="Folio plates marked as studied">{getStudiedPlates().size}/{PHYTO_NOTES.length} studied</span>
                </div>
                {streak >= 5 && !justFell && (
                  <motion.p
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[9px] font-mono text-moss font-bold uppercase tracking-wider"
                  >
                    {streak >= 10 ? '🌳 Canopy legend!' : '🪴 Thriving canopy!'}
                  </motion.p>
                )}
              </div>
            </div>

            {puzzlesLocked ? (
              <div className="rounded-lg border border-[#8c7355]/30 bg-black/5 dark:bg-white/5 p-4 text-center space-y-2">
                <Lock size={16} className="mx-auto text-[#8c6d46]" />
                <p className="text-[12px] font-sans text-text-stone leading-relaxed">
                  Free explorers get {QUIZZES_PER_DAY} puzzles a day. The sprout rests until tomorrow — or go unlimited now.
                </p>
                <Link
                  to="/profile"
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#b89542] hover:bg-[#d4af5a] text-[#241a12] rounded-md text-[10px] font-sans font-bold uppercase tracking-[0.06em] transition-colors"
                >
                  <Crown size={11} /> Go unlimited with Pro
                </Link>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {presentedQuiz.options.map((option, index) => {
                    const isCorrect = selectedAnswer !== null && index === presentedQuiz.answer;
                    const isWrong = selectedAnswer === index && index !== presentedQuiz.answer;
                    return (
                      <button
                        key={option}
                        disabled={answered}
                        onClick={() => answerQuiz(index)}
                        className={`w-full min-h-[44px] rounded-lg px-3.5 py-2 text-left text-[13px] font-sans leading-snug transition-colors border flex items-center justify-between gap-2 disabled:cursor-default ${
                          isCorrect
                            ? 'bg-moss text-white border-moss font-bold'
                            : isWrong
                              ? 'bg-terracotta/15 text-terracotta border-terracotta/30 font-bold'
                              : 'bg-black/5 dark:bg-white/5 text-text-bark border-[#8c7355]/25 hover:border-[#8c7355]/60 disabled:hover:border-[#8c7355]/25'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className={`font-serif font-bold text-xs w-5 shrink-0 ${
                            isCorrect ? 'text-white' : isWrong ? 'text-terracotta' : 'text-[#8c6d46] dark:text-[#caa651]'
                          }`}>
                            {ROMAN_NUMERALS[index] || `${index + 1}.`}
                          </span>
                          <span>{option}</span>
                        </span>
                        {isCorrect && <CheckCircle2 size={14} className="shrink-0 text-white" />}
                      </button>
                    );
                  })}
                </div>

                <div className="min-h-[28px] flex items-center justify-between gap-2">
                  <p className="text-[10px] text-text-stone font-mono leading-relaxed flex-1">
                    {quizMessage || `Wallet: ${(profile?.seeds ?? 0).toLocaleString()} seeds`}
                  </p>
                  {answered && (
                    <button
                      onClick={nextQuiz}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-moss hover:bg-moss-dark text-white rounded-md text-[10px] font-sans font-bold uppercase tracking-[0.06em] transition-colors shadow-xs"
                    >
                      <RotateCw size={11} />
                      {attemptsLeft > 0 ? 'New Question' : 'Done for today'}
                    </button>
                  )}
                </div>
              </>
            )}
          </motion.div>

          {/* Expeditionary Botanical Telegraph Wire · Daily Environmental News Corner */}
          <EnvironmentalNewsCarousel
            items={newsItems}
            stale={newsStale}
            actionLink={(item) => (
              <a
                href={item.link}
                target="_blank"
                rel="noreferrer"
                // Inline text link that measured 17px tall: min-h makes the
                // box a real 44px target and the negative margin keeps it
                // from disturbing the card row it sits on.
                className="-my-3 inline-flex items-center min-h-[44px] gap-1.5 py-3 text-[10px] font-mono font-bold uppercase tracking-widest text-moss hover:text-moss-dark"
              >
                Open Record <ExternalLink size={11} aria-hidden="true" />
              </a>
            )}
          />
        </div>

        {/* ── CATEGORY FILTER TABS ─────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 pb-2 border-b border-[#8c7355]/20 items-center">
          {(['All', 'Species Profile', 'Pathology', 'Pest'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => handleFilterChange(filter)}
              className={`px-4 py-2.5 sm:py-3 min-h-[44px] rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all duration-200 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--moss)] focus-visible:ring-offset-2 ${
                activeFilter === filter
                  ? 'bg-moss border-moss text-white shadow-xs'
                  : 'bg-[#fdfaf3]/90 dark:bg-[#201a14]/90 border-[#8c7355]/30 text-text-stone hover:border-[#8c7355]/60 hover:text-text-bark'
              }`}
            >
              {filter === 'All' ? 'All Folio Plates' : filter}
            </button>
          ))}

          {/* Retention rail: boredom breaker + study progress. The breaker
              jumps to a random plate from the full codex — filters reset so
              the jump always has somewhere to land. */}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[9px] font-mono uppercase tracking-widest text-text-stone">
              {studiedPlates.size}/{PHYTO_NOTES.length} studied
            </span>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                playAudio('leaf-rustle');
                const pick = PHYTO_NOTES[Math.floor(Math.random() * PHYTO_NOTES.length)];
                setActiveFilter('All');
                clearSearch();
                setSurprisePlate(pick.scientific);
                requestAnimationFrame(() => {
                  document.getElementById(`plate-${pick.scientific.replace(/\s+/g, '-').toLowerCase()}`)
                    ?.scrollIntoView({ behavior: shouldDisableAnimations ? 'auto' : 'smooth', block: 'center' });
                });
              }}
              className="min-h-[44px] px-4 py-2.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider border border-[#c5a059]/50 text-[#7a602f] dark:text-[#d4af37] hover:bg-[#c5a059]/10 transition-colors"
              title="Jump to a random folio plate"
            >
              🎲 Surprise Me
            </button>
          </div>
        </div>

        {/* From your garden — the Keeper's own species, front-loaded. Clicks
            reset the filters (so the plate has somewhere to land) and jump to
            it, the same contract as the Surprise Me breaker above. */}
        {gardenFolios.length > 0 && (
          <div role="region" aria-label="Folios from your garden" className="mb-6 px-4 py-3 rounded-xl border border-[#c5a059]/40 bg-[#c5a059]/5">
            <p className="text-[9px] font-mono uppercase tracking-widest text-[#8c7355] dark:text-[#caa651] mb-1.5">
              From your garden · plates for species you keep
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {gardenFolios.map(folio => (
                <button
                  key={`${folio.name}-${folio.scientific}`}
                  type="button"
                  onClick={() => openGardenFolio(folio)}
                  className="min-h-[44px] px-3 py-1.5 shrink-0 rounded-lg border border-[#8c7355]/30 bg-[#fdfaf3]/90 dark:bg-[#201a14]/90 text-[11px] font-serif text-text-bark hover:border-[#c5a059]/60 transition-colors"
                >
                  {folio.name} <span className="text-text-stone">· {folio.type}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── CARD GRID / EMPTY STATE ───────────────────────────── */}
        {filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 sm:p-12 text-center antique-folio-plate rounded-xl space-y-4 my-6 max-w-xl mx-auto"
          >
            <div className="w-12 h-12 mx-auto rounded-full bg-[#8c7355]/10 dark:bg-[#caa651]/10 flex items-center justify-center text-[#8c7355] dark:text-[#caa651]">
              <BookOpen size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="font-serif text-lg font-bold text-text-bark">
                No Folio Plates Found
              </h3>
              <p className="text-xs text-text-stone leading-relaxed font-serif">
                {search
                  ? `No botanical specimens matched "${search}" in the active codex filter.`
                  : 'No records available in this section.'}
              </p>
            </div>
            <button
              onClick={() => {
                clearSearch();
                setActiveFilter('All');
              }}
              className="px-4 py-2 bg-moss hover:bg-moss-dark text-white rounded-md text-xs font-mono font-bold uppercase tracking-wider transition-colors shadow-xs"
            >
              Reset Search &amp; Filters
            </button>
          </motion.div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid gap-6"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))' }}
          >
            {filtered.map((disease, i) => {
              const isDailyFeatured = disease.name === dailyFeaturedSpecimen.name;
              const key = `${disease.name}-${i}`;
              const isOpen = openPlate === key;
              return (
                <motion.div
                  key={key}
                  id={`plate-${disease.scientific.replace(/\s+/g, '-').toLowerCase()}`}
                  variants={cardVariants}
                  className="
                    relative
                    antique-folio-plate
                    flex flex-col
                    self-start
                    transition-all duration-300
                    hover:-translate-y-1.5
                  "
                >
                  {/* Dangling vermilion silk ribbon bookmark marking daily featured specimen */}
                  {isDailyFeatured && (
                    <div
                      className="ribbon-bookmark"
                      title="Daily Featured Specimen · Naturalist Codex"
                      aria-label="Daily Featured Specimen"
                    />
                  )}

                  {/* Folio Plate Tabula Identification */}
                  <div className="px-3.5 py-1.5 border-b border-[#8c7355]/20 flex items-center justify-between text-[9px] font-mono font-bold tracking-widest text-[#8c7355] dark:text-[#caa651] uppercase bg-black/[0.02] dark:bg-white/[0.02] rounded-t-[7px]">
                    <span>Tabula {String(i + 1).padStart(2, '0')}</span>
                    <span>{disease.type}</span>
                  </div>

                  {/* Plate header — the tap target. Carries the identifying facts
                      (name, Latin name, severity, organ) so a closed plate is
                      still worth reading in a list; the photograph and the
                      clinical detail live behind it. */}
                  <button
                    onClick={() => togglePlate(key, disease.scientific)}
                    aria-expanded={isOpen}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors"
                  >
                    {/* No `card-media-frame` here: that utility is unlayered CSS
                        (`width:100%; aspect-ratio:4/3`), which overrides w-14 and
                        balloons this thumb across the card, squeezing the title
                        block to zero width. The 4:3 frame is only for the expanded
                        header image below. */}
                    <div className="w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-bg-secondary border border-[#8c7355]/20">
                      <img
                        src={disease.image || getPlantPhoto(null, disease.name)}
                        alt=""
                        width={112}
                        height={112}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.opacity = '0';
                        }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-serif text-base sm:text-lg font-bold text-text-bark leading-tight truncate">
                        {disease.name}
                      </h3>
                      <p className="text-[10px] uppercase font-mono tracking-widest text-moss/90 mt-0.5 truncate">
                        {disease.scientific}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="px-2 py-0.5 bg-black/5 dark:bg-white/5 text-text-bark text-[8px] font-mono font-bold uppercase tracking-wider rounded whitespace-nowrap flex-shrink-0 border border-[#8c7355]/30">
                          {disease.severity}
                        </span>
                        <span className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-text-muted">
                          {organIcons[disease.organ] ?? <Sprout className="text-moss" size={11} />}
                          {disease.organ}
                        </span>
                      </div>
                    </div>
                    <ChevronDown
                      size={18}
                      className={`shrink-0 opacity-60 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {/* Severity Pulse line */}
                  <div
                    className="h-[3px] w-full"
                    style={{
                      backgroundColor: severityStripColor[disease.severity] ?? 'var(--moss)',
                    }}
                  />

                  {isOpen && (
                  <>
                  {/* Image Header */}
                  <div className="card-media-frame w-full h-44 relative overflow-hidden bg-bg-secondary border-b border-[#8c7355]/20">
                    <img
                      src={disease.image || getPlantPhoto(null, disease.name)}
                      alt={`${disease.name} — botanical specimen`}
                      width={600}
                      height={450}
                      decoding="async"
                      className="w-full h-full object-cover"
                    />

                    {/* target badge */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5
                      px-2.5 py-1.5 bg-bg-glass/95 backdrop-blur-sm rounded-md
                      text-[11px] font-bold uppercase tracking-wide text-text-bark border border-[#8c7355]/30 shadow-xs">
                      {organIcons[disease.organ] ?? (
                        <Sprout className="text-moss" size={12} />
                      )}
                      <span>{disease.organ}</span>
                    </div>
                  </div>

                  {/* Clinical detail */}
                  <div className="p-5 space-y-3">
                      <div className="p-3.5 bg-black/[0.03] dark:bg-white/[0.03] rounded-lg space-y-2.5 border border-[#8c7355]/20">
                        <div>
                          <h5 className="text-[8px] font-mono font-bold uppercase tracking-widest text-text-muted mb-1">
                            Clinical Symptoms
                          </h5>
                          <p className="text-xs text-text-stone leading-relaxed font-sans">
                            {disease.symptoms}
                          </p>
                        </div>

                        <div className="border-t border-[#8c7355]/15 pt-2">
                          <h5 className="text-[8px] font-mono font-bold uppercase tracking-widest text-moss mb-1">
                            Treatment Protocol
                          </h5>
                          <p className="text-xs font-medium text-text-bark leading-relaxed font-sans">
                            {disease.protocol}
                          </p>
                        </div>
                      </div>
                  </div>
                  </>
                  )}

                  {/* Evidence grade footer */}
                  <div
                    className="
                      px-5 py-2.5
                      bg-black/[0.02] dark:bg-white/[0.02]
                      flex justify-between items-center
                      text-[9px] font-mono font-bold uppercase tracking-wider
                      text-text-stone
                      border-t border-[#8c7355]/20
                    "
                  >
                    <span>Evidence / Habitat</span>
                    <span className="text-moss font-bold tracking-widest text-[9px]">
                      {disease.evidenceLevel}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* ── CTA / COLOPHON ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.99 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="
            p-6 sm:p-10 md:p-12
            antique-folio-plate
            rounded-2xl
            text-text-bark
            flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-8
            relative overflow-hidden
          "
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(184,149,82,0.08),transparent_60%)] pointer-events-none" />
          <div className="absolute top-0 right-0 p-12 opacity-[0.04] pointer-events-none">
            <BookOpen size={200} className="text-text-bark" />
          </div>

          <div className="relative z-10 space-y-3 sm:space-y-4 max-w-2xl flex-grow min-w-0">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold leading-tight flex items-baseline">
              <span className="illuminated-drop-cap text-3xl sm:text-4xl mr-1.5 align-baseline">J</span>
              <span>oin the <span className="text-moss italic">Botanical Research</span> Network</span>
            </h2>
            <p className="text-text-stone text-xs sm:text-sm leading-relaxed font-serif">
              Contribute cases, validated treatments, and naturalist field notes to
              the guild's open codex database. Help cultivate a thriving global community of plant care.
            </p>
          </div>

          <div className="relative z-10 shrink-0">
            <Link
              to="/lab"
              className="inline-flex items-center gap-2 min-h-[44px] px-5 py-3 rounded-lg bg-moss hover:bg-moss-dark text-white font-mono text-xs font-bold uppercase tracking-wider transition-colors shadow-xs"
            >
              <span>Open Botanical Lab</span>
              <ExternalLink size={13} />
            </Link>
          </div>
        </motion.div>

      </div>
    </PageWrapper>
  );
}
