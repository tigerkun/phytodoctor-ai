import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Microscope } from 'lucide-react';
import { useDayNightTheme } from '@/hooks/useDayNightTheme';
import { useEcoMode } from '@/hooks/useEcoMode';
import {
  groupPlants,
  statusIndicators,
  GROUP_LABELS,
  STATUS_META,
  type GalleryGroup,
  type GardenPlant,
} from '../../services/gardenDashboardService';

interface Plant extends GardenPlant {
  id: string;
  nickname: string;
  species: string;
  healthScore: number;
  lastWatered: Date;
  image: string;
  lastPhoto: string;
  /** Custom-cadence tag (see Plant.wateringIntervalCustom). */
  wateringIntervalCustom?: boolean;
  wateringIntervalDays?: number | null;
}

interface PlantGalleryProps {
  plants: Plant[];
  onSelectPlant: (plant: Plant) => void;
}

type GroupTab = 'all' | GalleryGroup;

export function PlantGallery({ plants, onSelectPlant }: PlantGalleryProps) {
  const { theme } = useDayNightTheme();
  const { shouldDisableAnimations } = useEcoMode();
  const navigate = useNavigate();
  const [groupTab, setGroupTab] = useState<GroupTab>('all');

  // Grouping and per-card statuses are computed, never stored — the gallery
  // is a view over the same plant records the dashboard reads.
  const groups = useMemo(() => groupPlants(plants), [plants]);
  const visible = groupTab === 'all' ? plants : groups[groupTab];

  const getHealthColor = (score: number) => {
    if (score >= 90) return '#5a7a5a';
    if (score >= 70) return '#7a9e7a';
    if (score >= 50) return '#d4af37';
    return '#d4755a';
  };

  const getDaysSinceWater = (date: Date) => {
    const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.4
      }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 30 }
  };

  return (
    <section className="py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="text-4xl font-serif font-bold mb-4"
          style={{ color: theme === 'day' ? '#3D405B' : '#E8DCC8' }}
        >
          The Living Conservatory Collection
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-lg mb-12"
          style={{ color: theme === 'day' ? '#5F7161' : '#A8B5A0' }}
        >
          {plants.length === 0 ? 'No specimens currently cataloged in sanctuary' : `${plants.length} botanical specimen${plants.length === 1 ? '' : 's'} flourishing under your stewardship`}
        </motion.p>

        {/* Health group tabs — counts computed from the same records the
            dashboard reads. "All" keeps the flat collection view. */}
        <div role="tablist" aria-label="Group plants by health" className="flex flex-wrap gap-2 mb-8">
          {(['all', 'attention', 'recovering', 'thriving', 'new'] as GroupTab[]).map(tab => {
            const count = tab === 'all' ? plants.length : groups[tab].length;
            const active = groupTab === tab;
            return (
              <button
                key={tab}
                role="tab"
                aria-selected={active}
                onClick={() => setGroupTab(tab)}
                className={`min-h-[36px] px-4 py-1.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider border transition-colors ${
                  active
                    ? 'border-moss bg-moss/15 text-moss'
                    : 'border-border-light text-text-stone hover:border-moss/40'
                }`}
              >
                {tab === 'all' ? 'All' : GROUP_LABELS[tab]} ({count})
              </button>
            );
          })}
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {visible.map((plant, index) => {
            const healthColor = getHealthColor(plant.healthScore);
            const daysSince = getDaysSinceWater(plant.lastWatered);
            const statuses = statusIndicators(plant);
            // Alternate subtle rotation angles for authentic handmade botanical stake feel
            const rotationClass = index % 2 === 0 ? '-rotate-2' : 'rotate-1';

            return (
              <motion.div
                key={plant.id}
                variants={cardVariants}
                whileHover={!shouldDisableAnimations ? { y: -8 } : {}}
                whileTap={!shouldDisableAnimations ? { scale: 0.98 } : {}}
                onClick={() => onSelectPlant(plant)}
                className="cursor-pointer group"
              >
                <div
                  className="rounded-2xl overflow-hidden oiled-teak-frame transition-all duration-300 hover:shadow-xl h-full flex flex-col relative"
                >
                  {/* Top Teak Molding Slat */}
                  <div className="h-1.5 w-full bg-gradient-to-r from-[#4d321d] via-[#785333] to-[#4d321d] opacity-80" />

                  {/* Image Container */}
                  {/* The only cold, off-palette grey left on the home page: a plant loading
                      or missing its photo got a colour found nowhere else in
                      the design system, which read as an unfinished slot rather
                      than a botanical one. Warm paper-to-moss instead. */}
                  <div className="relative h-48 bg-gradient-to-b from-[#F3EDE2] to-[#DCE5D8] dark:from-[#2a2620] dark:to-[#232b23] overflow-hidden">
                    <motion.img
                      src={plant.image}
                      alt={plant.nickname}
                      className="w-full h-full object-cover"
                      initial={{ scale: 1 }}
                      whileHover={!shouldDisableAnimations ? { scale: 1.08 } : {}}
                      transition={{ duration: 0.4 }}
                    />

                    {/* Hover quick action: into the lab with this specimen —
                        the pathology bench takes a plantId preselect, so the
                        comparison starts from this plant's own record. The
                        card itself opens the record. Revealed on desktop
                        hover, always visible on touch — an invisible button
                        is still a target on a touchscreen. */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/lab?tab=pathology&plantId=${plant.id}`);
                      }}
                      aria-label={`Diagnose ${plant.nickname} in the lab`}
                      className="absolute bottom-3 right-3 min-h-[44px] min-w-[44px] rounded-full bg-moss-deep/90 hover:bg-moss-deep text-white flex items-center justify-center shadow-md transition-opacity duration-200 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 active:scale-95"
                    >
                      <Microscope size={16} />
                    </button>

                    {/* Rotated Zinc / Slate Seedling Stake Tag */}
                    <div
                      className={`absolute top-3 left-3 ${rotationClass} zinc-stake px-2.5 py-1 rounded-xs text-[10px] font-serif font-bold tracking-widest uppercase flex items-center gap-1.5 z-10`}
                    >
                      <span className="opacity-80">№ 0{index + 1}</span>
                      <span className="w-1 h-1 rounded-full bg-white/60" />
                      <span className="truncate max-w-[110px]">{plant.nickname}</span>
                    </div>

                    {/* Health Indicator Mini Barometer Pip. Below the care
                        threshold it also pulses — the "check on me" signal —
                        muted entirely under eco mode. */}
                    <div className="absolute top-3 right-3">
                      {plant.healthScore < 60 && !shouldDisableAnimations && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-0 rounded-full bg-rose-400/60 animate-ping"
                        />
                      )}
                      <div
                        className={`relative px-2 py-0.5 rounded-full brass-bezel text-[9px] font-serif font-black text-[#2c1d08] dark:text-[#f7edd6] shadow-xs ${
                          plant.healthScore < 60 ? 'ring-2 ring-rose-400/70' : ''
                        }`}
                        title={plant.healthScore < 60 ? `${plant.healthScore}% health — check on me` : `${plant.healthScore}% health`}
                      >
                        {plant.healthScore}%
                      </div>
                    </div>

                    {/* Stamped Slate Watering Indicator */}
                    <div
                      className="absolute bottom-3 left-3 px-2.5 py-0.5 rounded-xs text-[10px] font-mono tracking-wider font-semibold backdrop-blur-md bg-black/50 text-white/90 border border-white/20"
                    >
                      {daysSince}d ago
                    </div>

                    {/* Custom-cadence tag — "a human chose this rhythm", so a
                        forgotten per-plant override is findable from the
                        gallery, not only from the drawer. */}
                    {plant.wateringIntervalCustom && (
                      <div
                        className="absolute top-3 left-3 px-2 py-0.5 rounded-xs text-[9px] font-mono font-bold uppercase tracking-wider backdrop-blur-md bg-[#2c4a63]/70 text-[#a9cce3] border border-[#7aa5c4]/40"
                        title={`Custom watering cadence: every ${plant.wateringIntervalDays ?? 7} day(s) — adjust it in the plant profile.`}
                      >
                        💧 every {plant.wateringIntervalDays ?? 7}d
                      </div>
                    )}

                    {/* Live status indicators — computed, not stored: the same
                        predicates the priority queue uses. */}
                    {statuses.length > 0 && (
                      <div
                        className="absolute bottom-3 right-3 flex gap-1"
                        role="list"
                        aria-label="Plant status"
                      >
                        {statuses.map(s => (
                          <span
                            key={s}
                            role="listitem"
                            title={STATUS_META[s].label}
                            className="w-6 h-6 rounded-full bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center text-[11px]"
                          >
                            <span aria-hidden="true">{STATUS_META[s].emoji}</span>
                            <span className="sr-only">{STATUS_META[s].label}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Content & Botanical Specimen Plate */}
                  <div className="flex-1 p-5 flex flex-col justify-between">
                    <div>
                      <h3
                        className="text-lg font-serif font-bold mb-1 truncate text-text-bark"
                      >
                        {plant.nickname}
                      </h3>
                      <p
                        className="text-xs font-serif italic mb-3 truncate text-moss"
                      >
                        {plant.species}
                      </p>
                    </div>

                    {/* Health Score Bar */}
                    <div>
                      <div className="h-1.5 rounded-full overflow-hidden bg-black/10 dark:bg-white/10">
                        <motion.div
                          className="h-full rounded-full transition-all"
                          style={{ background: healthColor, width: `${plant.healthScore}%` }}
                          initial={{ width: 0 }}
                          whileInView={{ width: `${plant.healthScore}%` }}
                          transition={{ duration: 0.6, delay: 0.2 }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-mono mt-1.5 text-text-stone">
                        <span>Vitality</span>
                        <span style={{ color: healthColor }} className="font-bold">{plant.healthScore}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
