import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BookOpen,
  Search,
  X,
  Flower2,
  Leaf,
  Sprout,
  Wheat,
  Info,
  Sparkles,
  RotateCw,
  HelpCircle,
  CheckCircle2,
  Globe2,
  ExternalLink
} from 'lucide-react';
import { getPlantPhoto } from '../utils/plantImage';
import { GameService } from '../services/gameService';
import PageWrapper from '../components/home/PageWrapper';
import { triggerHaptic, playAudio } from '../utils/hapticAudio';

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

const PHYTO_NOTES = [
  // Species Profile
  {
    name: "Monstera deliciosa",
    scientific: "Monstera deliciosa",
    type: "Species Profile",
    organ: "Whole Organism",
    symptoms: "Fenestration delay, yellowing edges (magnesium deficiency), aerial root desiccation.",
    protocol: "Maintain 18-30°C and 60%+ humidity. Wipe leaves monthly for high-efficiency photosynthesis. Use well-draining aroid mix (bark, perlite, coco coir) and provide a moss pole for climbing support.",
    evidenceLevel: "Validated (Botanical)",
    severity: "Low",
    prevalence: "Subtropical",
    image: "https://images.unsplash.com/photo-1614594975525-e45190c55d0b?q=80&w=600&auto=format&fit=crop"
  },
  {
    name: "Sansevieria trifasciata",
    scientific: "Dracaena trifasciata",
    type: "Species Profile",
    organ: "Rhizome/Leaf",
    symptoms: "Mushy base (overwatering), vertical wrinkling (severe dehydration), falling over (lack of light).",
    protocol: "Strict drought tolerance protocol. Water only when soil is 100% dry (every 14-30 days). Highly adaptable to low light but thrives in bright indirect light.",
    evidenceLevel: "Field-Tested",
    severity: "Low",
    prevalence: "Arid",
    image: "https://images.unsplash.com/photo-1485955900006-10f4d324d411?q=80&w=600&auto=format&fit=crop"
  },
  {
    name: "Ficus lyrata",
    scientific: "Ficus lyrata",
    type: "Species Profile",
    organ: "Foliage",
    symptoms: "Browning spots with yellow rings (bacterial leaf spot), sudden leaf drop (drafts or relocation shock), edema (inconsistent watering).",
    protocol: "Stationary environment required. High indirect light. Specialized drainage mandatory. Water thoroughly then allow top 50% of soil to dry.",
    evidenceLevel: "Clinical Study",
    severity: "Moderate",
    prevalence: "Tropical",
    image: "https://images.unsplash.com/photo-1580133318324-f2f76d987dd8?q=80&w=600&auto=format&fit=crop"
  },
  {
    name: "Calathea orbifolia",
    scientific: "Goeppertia orbifolia",
    type: "Species Profile",
    organ: "Foliage",
    symptoms: "Crispy brown leaf margins (fluoride/chlorine sensitivity), leaf curling (low humidity or underwatering), faded patterns (too much sun).",
    protocol: "Use distilled or rainwater only. Filtered indirect light. Maintain strict moisture consistency—never allow to fully dry out. 60%+ humidity.",
    evidenceLevel: "Validated",
    severity: "High",
    prevalence: "South America",
    image: "https://images.unsplash.com/photo-1592150621744-aca64f48394a?q=80&w=600&auto=format&fit=crop"
  },
  {
    name: "Epipremnum aureum",
    scientific: "Epipremnum aureum",
    type: "Species Profile",
    organ: "Whole Organism",
    symptoms: "Loss of variegation (low light), yellowing oldest leaves (overwatering or nitrogen deficiency), stunted growth (root bound).",
    protocol: "Extremely resilient. Adaptable to low light but variegation requires bright indirect light. Propagates easily in water via nodes.",
    evidenceLevel: "Validated",
    severity: "Low",
    prevalence: "French Polynesia",
    image: "https://images.unsplash.com/photo-1600411317281-229af6a88b2c?q=80&w=600&auto=format&fit=crop"
  },
  
  // Pathology
  {
    name: "Powdery Mildew",
    scientific: "Erysiphales",
    type: "Pathology",
    organ: "Leaf/Stem",
    symptoms: "White, flour-like powder on leaves and stems; stunted growth, leaf distortion, and premature drop in advanced stages.",
    protocol: "Apply potassium bicarbonate or sulfur-based fungicide. Isolate specimen immediately. Improve air circulation and avoid wetting foliage during watering.",
    evidenceLevel: "Validated (Clinical)",
    severity: "Moderate",
    prevalence: "Global",
    image: "https://images.unsplash.com/photo-1599307736696-26c7104b9016?q=80&w=600&auto=format&fit=crop"
  },
  {
    name: "Root Rot",
    scientific: "Phytophthora / Pythium",
    type: "Pathology",
    organ: "Root System",
    symptoms: "Mushy, dark brown or black roots, putrid odor from soil, sudden wilting despite wet soil, yellowing lower leaves.",
    protocol: "Immediate emergency repotting. Excise all necrotic tissue with sterilized shears. Apply 3% hydrogen peroxide flush or copper fungicide drench. Repot in highly aerated dry mix.",
    evidenceLevel: "Validated (Clinical)",
    severity: "Critical",
    prevalence: "High Moisture Environments",
    image: "https://images.unsplash.com/photo-1622383563227-04401ab4e5ea?q=80&w=600&auto=format&fit=crop"
  },
  {
    name: "Bacterial Leaf Spot",
    scientific: "Xanthomonas campestris",
    type: "Pathology",
    organ: "Foliage",
    symptoms: "Water-soaked dark lesions with distinct yellow halos. Rapid spread across foliage in humid conditions. Leaves may turn completely yellow and drop.",
    protocol: "No cure for infected leaves; excise immediately and destroy. Apply copper-based bactericide to healthy foliage. Stop misting entirely.",
    evidenceLevel: "Clinical Study",
    severity: "High",
    prevalence: "Warm/Humid",
    image: "https://images.unsplash.com/photo-1574883193498-8e68cb719ca3?q=80&w=600&auto=format&fit=crop"
  },
  {
    name: "Botrytis Blight",
    scientific: "Botrytis cinerea",
    type: "Pathology",
    organ: "Foliage/Flowers",
    symptoms: "Fuzzy gray mold on aging flowers or damaged leaves. Brown spots expanding rapidly in cool, damp conditions.",
    protocol: "Remove spent flowers and decaying leaves constantly. Increase airflow. Apply preventative fungicide (chlorothalonil).",
    evidenceLevel: "Validated",
    severity: "Moderate",
    prevalence: "Cool/Damp",
    image: "https://images.unsplash.com/photo-1508020268012-70b7fb5625ff?q=80&w=600&auto=format&fit=crop"
  },

  // Pests
  {
    name: "Spider Mites",
    scientific: "Tetranychidae",
    type: "Pest",
    organ: "Leaf Underside",
    symptoms: "Microscopic stippling (tiny yellow dots), fine webbing near stems and undersides, overall dulling or yellowing of foliage.",
    protocol: "Systemic miticide or repeat applications of neem oil. Forceful water spray to dislodge. Significantly increase ambient humidity to deter reproduction.",
    evidenceLevel: "Field-Tested",
    severity: "High",
    prevalence: "Arid/Indoor Heating",
    image: "https://images.unsplash.com/photo-1563810444-245f8e562772?q=80&w=600&auto=format&fit=crop"
  },
  {
    name: "Mealybugs",
    scientific: "Pseudococcidae",
    type: "Pest",
    organ: "Node/Leaf Axil",
    symptoms: "Cotton-like white fluffy clusters in crevices, sticky honeydew residue, sooty mold development, distorted new growth.",
    protocol: "Manual removal with 70% isopropyl alcohol-soaked swab. Follow with insecticidal soap or systemic imidacloprid. Check root systems as soil mealybugs exist.",
    evidenceLevel: "Field-Tested",
    severity: "High",
    prevalence: "Indoor/Tropical",
    image: "https://images.unsplash.com/photo-1596704169727-4c40212f7a07?q=80&w=600&auto=format&fit=crop"
  },
  {
    name: "Fungus Gnats",
    scientific: "Sciaridae",
    type: "Pest",
    organ: "Root System/Soil",
    symptoms: "Tiny black flies near soil surface. Larvae feed on root hairs causing delayed growth, sudden wilting, or secondary root rot infections.",
    protocol: "Allow top 2 inches of soil to dry out completely. Apply BTI (Bacillus thuringiensis israelensis) via mosquito dunks in water. Use yellow sticky traps for adults.",
    evidenceLevel: "Validated",
    severity: "Low",
    prevalence: "Overwatered Soil",
    image: "https://images.unsplash.com/photo-1533568016401-447545b736b6?q=80&w=600&auto=format&fit=crop"
  },
  {
    name: "Thrips",
    scientific: "Thysanoptera",
    type: "Pest",
    organ: "Foliage",
    symptoms: "Silvery or bronze scarring on leaves, distorted new growth, tiny black fecal specks. Pests look like slender grains of rice.",
    protocol: "Extremely difficult to eradicate. Isolate immediately. Prune heavily damaged leaves. Alternate Spinosad and systemic insecticides weekly for 4 weeks.",
    evidenceLevel: "Expert Grade",
    severity: "Critical",
    prevalence: "Global",
    image: "https://images.unsplash.com/photo-1627915570222-263a03362a93?q=80&w=600&auto=format&fit=crop"
  }
];

const BOTANICAL_FACTS = [
  {
    title: "The Acacia's Silent Gas Alarm",
    fact: "When browsed by herbivores, Acacia trees release ethylene gas. Neighboring trees sense this and instantly pump toxic tannins into their own leaves to defend themselves.",
    category: "Communication",
    icon: "📣"
  },
  {
    title: "The Dancing Telegraph Plant",
    fact: "Codariocalyx motorius (telegraph plant) rotates its leaflets dynamically to follow light. It moves visibly to the naked eye, appearing to dance under the sun.",
    category: "Movement",
    icon: "💃"
  },
  {
    title: "Venus Flytrap's Memory & Math",
    fact: "Venus Flytraps count electrical impulses. Touch 1: nothing. Touch 2: snap! Touch 3+: start digesting. This prevents false alarms from rain or debris.",
    category: "Cognition",
    icon: "🧠"
  },
  {
    title: "1,500 Years in the Namib Desert",
    fact: "Welwitschia mirabilis survives Namib desert heat for over 1,500 years using only two leaves that grow continuously and shred over centuries.",
    category: "Resilience",
    icon: "⏳"
  },
  {
    title: "Mimosa Pudica's Seismonasty",
    fact: "When touched, Mimosa pudica cells drop vacuole water pressure instantly, causing leaves to fold inward. This tricks predators into thinking it has wilted.",
    category: "Defense",
    icon: "🛡️"
  }
];

type EarthEvent = {
  title: string;
  category: string;
  date: string;
  source: string;
  url: string;
  magnitude?: string;
};

const FALLBACK_EARTH_EVENTS: EarthEvent[] = [
  {
    title: 'Open global natural event monitor',
    category: 'NASA EONET',
    date: 'Updated daily',
    source: 'NASA EONET',
    url: 'https://eonet.gsfc.nasa.gov/',
    magnitude: 'Live feed fallback',
  },
  {
    title: 'Wildfire, storm, volcano, dust and ice records',
    category: 'Earth Watch',
    date: 'Near real-time',
    source: 'NASA Earth Observatory',
    url: 'https://science.nasa.gov/earth/earth-observatory/',
    magnitude: 'Curated natural events',
  },
];

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
];

const getTodayKey = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

const getDayNumber = () => Math.floor(new Date(getTodayKey()).getTime() / 86400000);
export default function Library() {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'All' | 'Species Profile' | 'Pathology' | 'Pest'>('All');
  const [factIndex, setFactIndex] = useState(0);
  const [earthEvents, setEarthEvents] = useState<EarthEvent[]>(FALLBACK_EARTH_EVENTS);
  const [earthIndex, setEarthIndex] = useState(0);
  const [earthLive, setEarthLive] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [quizMessage, setQuizMessage] = useState('');
  const todayKey = getTodayKey();
  const dayNumber = getDayNumber();
  const quizKey = `botanical_library_quiz_${todayKey}`;
  const dailyQuiz = DAILY_QUIZZES[dayNumber % DAILY_QUIZZES.length];
  const dailyFact = BOTANICAL_FACTS[dayNumber % BOTANICAL_FACTS.length];
  const currentEvent = earthEvents[earthIndex % earthEvents.length];
  const profile = useLiveQuery(() => GameService.getProfile());
  const [quizClaimed, setQuizClaimed] = useState(() => localStorage.getItem(quizKey) === 'claimed');

  const filtered = PHYTO_NOTES.filter(
    (d) =>
      (activeFilter === 'All' || d.type === activeFilter) &&
      (d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.symptoms.toLowerCase().includes(search.toLowerCase()) ||
        d.type.toLowerCase().includes(search.toLowerCase())),
  );

  const dailyFeaturedSpecimen = PHYTO_NOTES[dayNumber % PHYTO_NOTES.length];

  // Fetch live NASA EONET events, fall back to static cards on failure
  useEffect(() => {
    const controller = new AbortController();
    fetch('https://eonet.gsfc.nasa.gov/api/v3/events?limit=6&status=open', { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error('EONET'); return r.json(); })
      .then(data => {
        const events: EarthEvent[] = (data.events || []).map((e: any) => ({
          title: e.title,
          category: e.categories?.[0]?.title || 'Natural Event',
          date: e.geometry?.[0]?.date?.slice(0, 10) || 'Recent',
          source: e.sources?.[0]?.id || 'NASA',
          url: e.sources?.[0]?.url || 'https://eonet.gsfc.nasa.gov/',
          magnitude: e.geometry?.[0]?.magnitudeValue
            ? `${e.geometry[0].magnitudeValue} ${e.geometry[0].magnitudeUnit || ''}`
            : undefined,
        }));
        if (events.length > 0) {
          setEarthEvents(events);
          setEarthLive(true);
        }
      })
      .catch(() => { /* keep fallback */ });

    return () => controller.abort();
  }, []);

  const answerQuiz = async (index: number) => {
    if (quizClaimed || selectedAnswer !== null) return;
    setSelectedAnswer(index);
    const isCorrect = index === dailyQuiz.answer;
    triggerHaptic(isCorrect ? 'medium' : 'light');
    playAudio(isCorrect ? 'success' : 'chime');
    if (isCorrect) {
      setQuizMessage(`✅ Correct! ${dailyQuiz.explanation}`);
      await GameService.addSeeds(25, 'bonus', 'Daily Library Quiz');
      localStorage.setItem(quizKey, 'claimed');
      setQuizClaimed(true);
    } else {
      setQuizMessage(`❌ Not quite. ${dailyQuiz.explanation}`);
      localStorage.setItem(quizKey, 'claimed');
      setQuizClaimed(true);
    }
  };

  const drawNextFact = () => {
    triggerHaptic('light');
    playAudio('leaf-rustle');
    setFactIndex((prev) => (prev + 1) % BOTANICAL_FACTS.length);
  };

  const nextEarthEvent = () => {
    triggerHaptic('light');
    setEarthIndex((prev) => (prev + 1) % earthEvents.length);
  };

  const handleFilterChange = (filter: 'All' | 'Species Profile' | 'Pathology' | 'Pest') => {
    triggerHaptic('light');
    setActiveFilter(filter);
  };

  const clearSearch = () => {
    triggerHaptic('light');
    setSearch('');
  };

  const currentFact = BOTANICAL_FACTS[factIndex];

  return (
    <PageWrapper className="relative skin-library px-4 sm:px-6 py-8 sm:py-12">
      <div className="max-w-7xl mx-auto relative z-10 space-y-8 sm:space-y-12">

        {/* ── HERO ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 sm:gap-8 mast"
        >
          <div className="max-w-[620px] flex-grow min-w-[320px]">
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

        {/* ── INTERACTIVE FACT & CURIOSITY HUB ─────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-5 sm:p-6 rounded-xl antique-folio-plate shadow-sm relative overflow-hidden flex flex-col gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#5f7161]/15 flex items-center justify-center text-moss flex-shrink-0 border border-[#5f7161]/30">
                <Sparkles size={18} className="animate-pulse text-[#b89542]" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#8c6d46] dark:text-[#caa651] block">
                  Illuminated Codex · Fact
                </span>
                <h3 className="font-serif font-bold text-text-bark text-sm sm:text-base leading-tight truncate">
                  {dailyFact.title}
                </h3>
              </div>
            </div>
            <p className="text-xs text-text-stone leading-relaxed font-sans font-medium">
              {dailyFact.fact}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-5 sm:p-6 rounded-xl antique-folio-plate shadow-sm relative overflow-hidden flex flex-col justify-between gap-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xl shrink-0">{currentFact.icon}</span>
                <div className="min-w-0">
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-terracotta block">
                    Botanical Oracle
                  </span>
                  <h4 className="font-serif font-bold text-text-bark text-sm sm:text-base leading-tight mt-0.5 truncate">
                    {currentFact.title}
                  </h4>
                </div>
              </div>
              <span className="px-2 py-0.5 bg-terracotta/10 text-terracotta text-[8px] font-mono font-bold uppercase tracking-wider rounded border border-terracotta/20 shrink-0">
                {currentFact.category}
              </span>
            </div>

            <div className="min-h-[56px] flex items-center">
              <AnimatePresence mode="wait">
                <motion.p
                  key={factIndex}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.2 }}
                  className="text-xs text-text-stone leading-relaxed font-sans font-medium"
                >
                  {currentFact.fact}
                </motion.p>
              </AnimatePresence>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#8c7355]/20">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={drawNextFact}
                className="flex items-center gap-2 px-3 py-1.5 bg-moss hover:bg-moss-dark text-white rounded-md text-[10px] font-mono font-bold uppercase tracking-widest transition-colors shadow-xs"
              >
                <RotateCw size={11} />
                New Leaf
              </motion.button>
            </div>
          </motion.div>

          {/* Socratic Study Carrel Examination Slip */}
          <motion.div
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-5 sm:p-6 study-carrel-slip flex flex-col gap-3 relative"
          >
            {/* Brass Thumb-Tack Graphic */}
            <div className="brass-thumb-tack" />

            <div className="flex items-start justify-between gap-3 pt-1">
              <div className="min-w-0">
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#8c6d46] dark:text-[#caa651] block">
                  Socratic Study Carrel // Exam Slip
                </span>
                <h4 className="font-serif font-bold text-text-bark text-sm sm:text-base leading-tight mt-0.5">
                  {dailyQuiz.question}
                </h4>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#b89542]/15 text-[#b89542] text-[9px] font-mono font-bold border border-[#b89542]/30 shrink-0">
                +25 Seeds
              </span>
            </div>

            <div className="space-y-2">
              {dailyQuiz.options.map((option, index) => {
                const isCorrect = (selectedAnswer !== null && index === dailyQuiz.answer) || (quizClaimed && index === dailyQuiz.answer);
                const isWrong = selectedAnswer === index && index !== dailyQuiz.answer;
                return (
                  <button
                    key={option}
                    disabled={quizClaimed || selectedAnswer !== null}
                    onClick={() => answerQuiz(index)}
                    className={`w-full min-h-[40px] rounded-lg px-3 py-1.5 text-left text-xs font-sans transition-colors border flex items-center justify-between gap-2 disabled:cursor-default ${
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

            <p className="min-h-[28px] text-[10px] text-text-stone font-mono leading-relaxed">
              {quizMessage || (quizClaimed ? 'Daily examination completed. Seed bonus claimed.' : `Wallet: ${(profile?.seeds ?? 0).toLocaleString()} seeds`)}
            </p>
          </motion.div>

          {/* Expeditionary Botanical Telegraph Wire */}
          <motion.div
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-5 sm:p-6 rounded-xl telegraph-ticker-tape shadow-sm relative overflow-hidden flex flex-col justify-between gap-4"
          >
            {/* Circular Ink Cancellation Stamp */}
            <div className="ink-cancellation-stamp" />

            <div className="flex items-start justify-between gap-3 relative z-10">
              <div className="flex items-center gap-2 min-w-0">
                <Globe2 size={17} className="text-moss shrink-0" />
                <div className="min-w-0">
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#8c6d46] dark:text-[#caa651] block">
                    Telegraph Wire // Dispatch
                  </span>
                  <h4 className="font-serif font-bold text-text-bark text-sm sm:text-base leading-tight mt-0.5 line-clamp-2">
                    {currentEvent.title}
                  </h4>
                </div>
              </div>
              <span className={`px-2 py-0.5 text-[8px] font-mono font-bold uppercase tracking-wider rounded border shrink-0 ${
                earthLive ? 'bg-moss/10 text-moss border-moss/30' : 'bg-black/5 dark:bg-white/5 text-text-stone border-[#8c7355]/20'
              }`}>
                {earthLive ? 'Live' : 'Archive'}
              </span>
            </div>

            <div className="space-y-1.5 relative z-10 font-mono">
              <p className="text-xs text-text-stone leading-relaxed">
                {currentEvent.category} // {currentEvent.date}
              </p>
              {currentEvent.magnitude && (
                <p className="text-[10px] font-bold uppercase tracking-wider text-terracotta">
                  MAG: {currentEvent.magnitude}
                </p>
              )}
              <p className="text-[10px] text-text-muted">SOURCE: {currentEvent.source}</p>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#8c7355]/20 relative z-10">
              <a
                href={currentEvent.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-widest text-moss hover:text-moss-dark"
              >
                Open Record <ExternalLink size={11} />
              </a>
              <button
                onClick={nextEarthEvent}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black/5 dark:bg-white/5 hover:bg-moss/10 text-text-bark rounded text-[10px] font-mono font-bold uppercase tracking-widest transition-colors border border-[#8c7355]/25"
              >
                <RotateCw size={11} />
                Next
              </button>
            </div>
          </motion.div>
        </div>

        {/* ── CATEGORY FILTER TABS ─────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 pb-2 border-b border-[#8c7355]/20">
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
        </div>

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
              return (
                <motion.div
                  key={`${disease.name}-${i}`}
                  variants={cardVariants}
                  className="
                    relative
                    antique-folio-plate
                    flex flex-col
                    h-full
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

                  {/* Image Header */}
                  <div className="card-media-frame w-full h-44 relative overflow-hidden bg-bg-secondary border-b border-[#8c7355]/20">
                    <img 
                      src={disease.image || getPlantPhoto(null, disease.name)}
                      alt={`${disease.name} — botanical specimen`}
                      width={600}
                      height={450}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
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

                  {/* Severity Pulse line */}
                  <div
                    className="h-[3px] w-full"
                    style={{
                      backgroundColor: severityStripColor[disease.severity] ?? 'var(--moss)',
                    }}
                  />

                  {/* Body Content */}
                  <div className="p-5 flex-grow flex flex-col justify-between space-y-4">
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <h3 className="font-serif text-base sm:text-lg font-bold text-text-bark leading-tight truncate">
                          {disease.name}
                        </h3>
                        <p className="text-[10px] uppercase font-mono tracking-widest text-moss/90 mt-0.5 truncate">
                          {disease.scientific}
                        </p>
                      </div>
                      <div
                        className="
                          px-2 py-0.5
                          bg-black/5 dark:bg-white/5
                          text-text-bark
                          text-[8px] font-mono font-bold uppercase tracking-wider
                          rounded whitespace-nowrap flex-shrink-0 border border-[#8c7355]/30
                        "
                      >
                        {disease.severity}
                      </div>
                    </div>

                    <div className="space-y-3 flex-grow">
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
                  </div>

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
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-moss hover:bg-moss-dark text-white font-mono text-xs font-bold uppercase tracking-wider transition-colors shadow-xs"
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
